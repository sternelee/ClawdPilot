use anyhow::Result;
use encoding_rs::{CoderResult, UTF_8};
use serde::{Deserialize, Serialize};
use std::collections::VecDeque;
use std::sync::Arc;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use tokio::sync::{RwLock, mpsc};
use tracing::{debug, info, warn, error};

/// P2P 网络专用的滚动缓冲区管理器
/// 借鉴 sshx 设计，但针对 P2P 消息传输优化
pub struct P2PBufferManager {
    /// 内容缓冲区
    content: String,
    /// 内容起始偏移量（已确认发送的字节数）
    content_offset: usize,
    /// 当前序列号（下一个要发送的位置）
    current_seq: usize,
    /// 远程确认的序列号
    remote_ack_seq: usize,
    /// UTF-8 流式解码器
    decoder: encoding_rs::Decoder,
    /// 配置参数
    config: BufferConfig,
    /// 待发送的数据块队列
    pending_chunks: VecDeque<ContentChunk>,
    /// 发送统计
    stats: BufferStats,
}

#[derive(Debug, Clone)]
pub struct BufferConfig {
    /// P2P 消息的最大大小（考虑 iroh 的限制）
    pub max_message_size: usize,
    /// 保留的历史内容大小（用于重传）
    pub rolling_buffer_size: usize,
    /// 触发清理的缓冲区大小
    pub prune_threshold: usize,
    /// 批量发送的最小间隔
    pub batch_interval: Duration,
    /// 重传超时时间
    pub retransmit_timeout: Duration,
}

impl Default for BufferConfig {
    fn default() -> Self {
        Self {
            // P2P 网络通常有消息大小限制，设置为较小的值
            max_message_size: 32 * 1024,  // 32KB per message
            rolling_buffer_size: 2 * 1024 * 1024,  // 2MB rolling buffer
            prune_threshold: 4 * 1024 * 1024,      // 4MB prune threshold
            batch_interval: Duration::from_millis(50), // 50ms batching
            retransmit_timeout: Duration::from_secs(5), // 5s retransmit timeout
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContentChunk {
    /// 数据内容
    pub data: Vec<u8>,
    /// 在整个流中的偏移量
    pub offset: usize,
    /// 序列号
    pub seq: usize,
    /// 数据长度
    pub length: usize,
    /// 创建时间（用于重传判断）
    pub timestamp: SystemTime,
    /// 是否已确认
    pub acknowledged: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AckMessage {
    /// 确认的序列号
    pub ack_seq: usize,
    /// 接收窗口大小
    pub window_size: usize,
}

#[derive(Debug, Default)]
struct BufferStats {
    total_bytes_processed: u64,
    chunks_sent: u64,
    chunks_acked: u64,
    retransmissions: u64,
    buffer_cleanups: u64,
}

impl P2PBufferManager {
    pub fn new(config: BufferConfig) -> Self {
        Self {
            content: String::new(),
            content_offset: 0,
            current_seq: 0,
            remote_ack_seq: 0,
            decoder: UTF_8.new_decoder(),
            config,
            pending_chunks: VecDeque::new(),
            stats: BufferStats::default(),
        }
    }

    /// 处理新的原始字节数据
    pub fn process_bytes(&mut self, bytes: &[u8]) -> Result<Vec<ContentChunk>> {
        // 使用流式 UTF-8 解码，避免重复转换
        self.content.reserve(self.decoder.max_utf8_buffer_length(bytes.len()).unwrap());
        let (result, _, _) = self.decoder.decode_to_string(bytes, &mut self.content, false);
        debug_assert!(result == CoderResult::InputEmpty);

        self.stats.total_bytes_processed += bytes.len() as u64;

        // 生成新的数据块
        let chunks = self.generate_chunks()?;
        
        // 清理旧数据
        self.prune_if_needed();

        Ok(chunks)
    }

    /// 生成待发送的数据块
    fn generate_chunks(&mut self) -> Result<Vec<ContentChunk>> {
        let mut new_chunks = Vec::new();
        
        // 计算可发送的数据范围
        let available_data = self.content_offset + self.content.len();
        
        while self.current_seq < available_data {
            let start_pos = self.current_seq - self.content_offset;
            
            // 确保在字符边界上开始
            let start_pos = self.find_char_boundary(start_pos, true);
            if start_pos >= self.content.len() {
                break;
            }

            // 计算这个块的大小
            let remaining = self.content.len() - start_pos;
            let chunk_size = remaining.min(self.config.max_message_size);
            
            // 确保在字符边界上结束
            let end_pos = self.find_char_boundary(start_pos + chunk_size, false);
            if end_pos <= start_pos {
                break;
            }

            // 创建数据块
            let chunk_data = self.content[start_pos..end_pos].as_bytes().to_vec();
            let chunk = ContentChunk {
                data: chunk_data,
                offset: self.content_offset + start_pos,
                seq: self.current_seq,
                length: end_pos - start_pos,
                timestamp: SystemTime::now(),
                acknowledged: false,
            };

            new_chunks.push(chunk.clone());
            self.pending_chunks.push_back(chunk);
            
            self.current_seq = self.content_offset + end_pos;
            self.stats.chunks_sent += 1;
        }

        debug!("Generated {} new chunks, total pending: {}", 
               new_chunks.len(), self.pending_chunks.len());

        Ok(new_chunks)
    }

    /// 处理来自远程的确认消息
    pub fn handle_ack(&mut self, ack: AckMessage) -> Result<()> {
        debug!("Received ACK for seq: {}, current remote_ack: {}", 
               ack.ack_seq, self.remote_ack_seq);

        if ack.ack_seq > self.remote_ack_seq {
            self.remote_ack_seq = ack.ack_seq;
            
            // 标记已确认的块
            let mut acked_count = 0;
            for chunk in &mut self.pending_chunks {
                if chunk.offset + chunk.length <= ack.ack_seq && !chunk.acknowledged {
                    chunk.acknowledged = true;
                    acked_count += 1;
                    self.stats.chunks_acked += 1;
                }
            }

            // 移除已确认的块
            self.pending_chunks.retain(|chunk| !chunk.acknowledged);
            
            debug!("Acknowledged {} chunks, {} chunks remaining", 
                   acked_count, self.pending_chunks.len());
        }

        Ok(())
    }

    /// 获取需要重传的数据块
    pub fn get_retransmit_chunks(&mut self) -> Vec<ContentChunk> {
        let now = SystemTime::now();
        let mut retransmit_chunks = Vec::new();

        for chunk in &mut self.pending_chunks {
            if !chunk.acknowledged {
                if let Ok(elapsed) = now.duration_since(chunk.timestamp) {
                    if elapsed > self.config.retransmit_timeout {
                        // 更新时间戳并标记为重传
                        chunk.timestamp = now;
                        retransmit_chunks.push(chunk.clone());
                        self.stats.retransmissions += 1;
                    }
                }
            }
        }

        if !retransmit_chunks.is_empty() {
            warn!("Retransmitting {} chunks", retransmit_chunks.len());
        }

        retransmit_chunks
    }

    /// 清理旧数据以防止内存泄漏
    fn prune_if_needed(&mut self) {
        if self.content.len() <= self.config.prune_threshold {
            return;
        }

        // 计算可以安全清理的位置（已被远程确认的数据）
        let safe_prune_pos = if self.remote_ack_seq > self.content_offset {
            (self.remote_ack_seq - self.content_offset).min(self.content.len())
        } else {
            0
        };

        // 保留一定量的数据用于可能的重传
        let keep_size = self.config.rolling_buffer_size;
        let prune_pos = if self.content.len() > keep_size {
            let max_prune = self.content.len() - keep_size;
            safe_prune_pos.min(max_prune)
        } else {
            safe_prune_pos
        };

        if prune_pos > 0 {
            // 确保在字符边界上清理
            let prune_pos = self.find_char_boundary(prune_pos, false);
            
            if prune_pos > 0 {
                self.content_offset += prune_pos;
                self.content.drain(..prune_pos);
                self.stats.buffer_cleanups += 1;
                
                debug!("Pruned {} bytes from buffer, new offset: {}", 
                       prune_pos, self.content_offset);
            }
        }
    }

    /// 查找字符边界
    fn find_char_boundary(&self, pos: usize, forward: bool) -> usize {
        if pos >= self.content.len() {
            return self.content.len();
        }

        if forward {
            // 向前查找字符边界
            (pos..=self.content.len())
                .find(|&i| self.content.is_char_boundary(i))
                .unwrap_or(self.content.len())
        } else {
            // 向后查找字符边界
            (0..=pos)
                .rev()
                .find(|&i| self.content.is_char_boundary(i))
                .unwrap_or(0)
        }
    }

    /// 完成处理（会话结束时调用）
    pub fn finalize(&mut self) -> Result<Vec<ContentChunk>> {
        // 处理解码器中剩余的数据
        self.content.reserve(self.decoder.max_utf8_buffer_length(0).unwrap());
        let (result, _, _) = self.decoder.decode_to_string(&[], &mut self.content, true);
        debug_assert!(result == CoderResult::InputEmpty);

        // 生成最后的数据块
        self.generate_chunks()
    }

    /// 获取缓冲区统计信息
    pub fn get_stats(&self) -> BufferStats {
        self.stats.clone()
    }

    /// 获取当前状态信息
    pub fn get_status(&self) -> BufferStatus {
        BufferStatus {
            content_size: self.content.len(),
            content_offset: self.content_offset,
            current_seq: self.current_seq,
            remote_ack_seq: self.remote_ack_seq,
            pending_chunks: self.pending_chunks.len(),
            unacked_bytes: self.current_seq.saturating_sub(self.remote_ack_seq),
        }
    }
}

#[derive(Debug, Clone)]
pub struct BufferStatus {
    pub content_size: usize,
    pub content_offset: usize,
    pub current_seq: usize,
    pub remote_ack_seq: usize,
    pub pending_chunks: usize,
    pub unacked_bytes: usize,
}

/// P2P 缓冲区管理器的异步包装器
pub struct AsyncP2PBufferManager {
    inner: Arc<RwLock<P2PBufferManager>>,
    chunk_sender: mpsc::UnboundedSender<ContentChunk>,
    ack_receiver: Arc<RwLock<Option<mpsc::UnboundedReceiver<AckMessage>>>>,
}

impl AsyncP2PBufferManager {
    pub fn new(config: BufferConfig) -> (Self, mpsc::UnboundedReceiver<ContentChunk>, mpsc::UnboundedSender<AckMessage>) {
        let manager = P2PBufferManager::new(config.clone());
        let (chunk_sender, chunk_receiver) = mpsc::unbounded_channel();
        let (ack_sender, ack_receiver) = mpsc::unbounded_channel();

        let async_manager = Self {
            inner: Arc::new(RwLock::new(manager)),
            chunk_sender,
            ack_receiver: Arc::new(RwLock::new(Some(ack_receiver))),
        };

        // 启动 ACK 处理任务
        async_manager.start_ack_processor();
        
        // 启动重传检查任务
        async_manager.start_retransmit_checker(config.retransmit_timeout);

        (async_manager, chunk_receiver, ack_sender)
    }

    /// 异步处理字节数据
    pub async fn process_bytes(&self, bytes: &[u8]) -> Result<()> {
        let chunks = {
            let mut manager = self.inner.write().await;
            manager.process_bytes(bytes)?
        };

        // 发送新生成的块
        for chunk in chunks {
            if let Err(e) = self.chunk_sender.send(chunk) {
                error!("Failed to send chunk: {}", e);
            }
        }

        Ok(())
    }

    /// 启动 ACK 处理任务
    fn start_ack_processor(&self) {
        let inner = self.inner.clone();
        let ack_receiver = self.ack_receiver.clone();

        tokio::spawn(async move {
            let mut receiver = {
                let mut guard = ack_receiver.write().await;
                guard.take()
            };

            if let Some(mut receiver) = receiver {
                while let Some(ack) = receiver.recv().await {
                    let mut manager = inner.write().await;
                    if let Err(e) = manager.handle_ack(ack) {
                        error!("Failed to handle ACK: {}", e);
                    }
                }
            }
        });
    }

    /// 启动重传检查任务
    fn start_retransmit_checker(&self, check_interval: Duration) {
        let inner = self.inner.clone();
        let chunk_sender = self.chunk_sender.clone();

        tokio::spawn(async move {
            let mut interval = tokio::time::interval(check_interval);
            
            loop {
                interval.tick().await;
                
                let retransmit_chunks = {
                    let mut manager = inner.write().await;
                    manager.get_retransmit_chunks()
                };

                for chunk in retransmit_chunks {
                    if let Err(e) = chunk_sender.send(chunk) {
                        error!("Failed to send retransmit chunk: {}", e);
                    }
                }
            }
        });
    }

    /// 获取缓冲区状态
    pub async fn get_status(&self) -> BufferStatus {
        let manager = self.inner.read().await;
        manager.get_status()
    }

    /// 获取统计信息
    pub async fn get_stats(&self) -> BufferStats {
        let manager = self.inner.read().await;
        manager.get_stats()
    }

    /// 完成处理
    pub async fn finalize(&self) -> Result<()> {
        let chunks = {
            let mut manager = self.inner.write().await;
            manager.finalize()?
        };

        for chunk in chunks {
            if let Err(e) = self.chunk_sender.send(chunk) {
                error!("Failed to send final chunk: {}", e);
            }
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_buffer_manager_basic() {
        let config = BufferConfig::default();
        let mut manager = P2PBufferManager::new(config);

        let test_data = "Hello, 世界! This is a test.".as_bytes();
        let chunks = manager.process_bytes(test_data).unwrap();

        assert!(!chunks.is_empty());
        assert_eq!(chunks[0].offset, 0);
        assert!(chunks[0].length > 0);
    }

    #[test]
    fn test_ack_handling() {
        let config = BufferConfig::default();
        let mut manager = P2PBufferManager::new(config);

        let test_data = "Test data for ACK".as_bytes();
        let chunks = manager.process_bytes(test_data).unwrap();
        
        let ack = AckMessage {
            ack_seq: chunks[0].offset + chunks[0].length,
            window_size: 1024,
        };

        manager.handle_ack(ack).unwrap();
        assert_eq!(manager.remote_ack_seq, chunks[0].offset + chunks[0].length);
    }
}