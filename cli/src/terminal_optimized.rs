use anyhow::{Context, Result};
use encoding_rs::{CoderResult, UTF_8};
use std::collections::VecDeque;
use std::sync::Arc;
use tokio::sync::Mutex;
use tracing::{debug, warn};

/// 优化的终端数据处理器，借鉴 sshx 的设计
pub struct OptimizedTerminalProcessor {
    /// UTF-8 流式解码器
    decoder: UTF_8.new_decoder(),
    /// 滚动内容缓冲区
    content: String,
    /// 内容偏移量（已发送的字节数）
    content_offset: usize,
    /// 序列号管理
    seq: usize,
    /// 配置参数
    config: ProcessorConfig,
}

#[derive(Clone)]
pub struct ProcessorConfig {
    /// 单次发送的最大字节数
    pub chunk_size: usize,
    /// 保留的最小内容字节数
    pub rolling_bytes: usize,
    /// 触发清理的最大内容字节数
    pub prune_bytes: usize,
}

impl Default for ProcessorConfig {
    fn default() -> Self {
        Self {
            chunk_size: 1 << 16,      // 64KB chunks
            rolling_bytes: 8 << 20,   // Keep 8MB
            prune_bytes: 12 << 20,    // Prune at 12MB
        }
    }
}

impl OptimizedTerminalProcessor {
    pub fn new(config: ProcessorConfig) -> Self {
        Self {
            decoder: UTF_8.new_decoder(),
            content: String::new(),
            content_offset: 0,
            seq: 0,
            config,
        }
    }

    /// 处理原始字节数据，返回需要发送的内容片段
    pub fn process_bytes(&mut self, bytes: &[u8]) -> Result<Vec<ContentChunk>> {
        // 使用流式UTF-8解码，避免重复转换
        self.content.reserve(self.decoder.max_utf8_buffer_length(bytes.len()).unwrap());
        let (result, _, _) = self.decoder.decode_to_string(bytes, &mut self.content, false);
        debug_assert!(result == CoderResult::InputEmpty);

        let chunks = self.generate_chunks();
        self.prune_if_needed();
        
        Ok(chunks)
    }

    /// 生成需要发送的内容块
    fn generate_chunks(&mut self) -> Vec<ContentChunk> {
        let mut chunks = Vec::new();
        
        while self.content_offset + self.content.len() > self.seq {
            let start = self.prev_char_boundary(self.seq - self.content_offset);
            let end = self.prev_char_boundary(
                (start + self.config.chunk_size).min(self.content.len())
            );
            
            if start >= end {
                break;
            }

            let chunk = ContentChunk {
                data: self.content[start..end].to_string(),
                offset: self.content_offset + start,
                seq: self.seq,
            };
            
            chunks.push(chunk);
            self.seq = self.content_offset + end;
        }
        
        chunks
    }

    /// 清理旧内容以防止内存泄漏
    fn prune_if_needed(&mut self) {
        if self.content.len() > self.config.prune_bytes 
            && self.seq.saturating_sub(self.config.rolling_bytes) > self.content_offset {
            
            let pruned = (self.seq - self.config.rolling_bytes) - self.content_offset;
            let pruned = self.prev_char_boundary(pruned);
            
            self.content_offset += pruned;
            self.content.drain(..pruned);
            
            debug!("Pruned {} bytes from content buffer", pruned);
        }
    }

    /// 找到字符边界（O(1) 时间复杂度）
    fn prev_char_boundary(&self, i: usize) -> usize {
        (0..=i.min(self.content.len()))
            .rev()
            .find(|&j| self.content.is_char_boundary(j))
            .unwrap_or(0)
    }

    /// 完成处理（用于会话结束时）
    pub fn finalize(&mut self) -> Result<Vec<ContentChunk>> {
        // 处理剩余的解码器状态
        self.content.reserve(self.decoder.max_utf8_buffer_length(0).unwrap());
        let (result, _, _) = self.decoder.decode_to_string(&[], &mut self.content, true);
        debug_assert!(result == CoderResult::InputEmpty);

        Ok(self.generate_chunks())
    }
}

#[derive(Debug, Clone)]
pub struct ContentChunk {
    pub data: String,
    pub offset: usize,
    pub seq: usize,
}

/// 高性能的事件缓冲区，使用环形缓冲区避免频繁内存分配
pub struct OptimizedEventBuffer<T> {
    buffer: Arc<Mutex<VecDeque<T>>>,
    max_size: usize,
    cleanup_size: usize,
}

impl<T> OptimizedEventBuffer<T> {
    pub fn new(max_size: usize) -> Self {
        Self {
            buffer: Arc::new(Mutex::new(VecDeque::with_capacity(max_size))),
            max_size,
            cleanup_size: max_size / 4, // 清理 25% 的旧事件
        }
    }

    pub async fn push(&self, item: T) -> Result<()> {
        let mut buffer = self.buffer.lock().await;
        
        // 检查是否需要清理
        if buffer.len() >= self.max_size {
            // 批量移除旧事件，减少锁竞争
            for _ in 0..self.cleanup_size {
                buffer.pop_front();
            }
            warn!("Event buffer cleaned up, removed {} old events", self.cleanup_size);
        }
        
        buffer.push_back(item);
        Ok(())
    }

    pub async fn get_recent(&self, count: usize) -> Vec<T> 
    where 
        T: Clone 
    {
        let buffer = self.buffer.lock().await;
        buffer.iter()
            .rev()
            .take(count)
            .cloned()
            .collect::<Vec<_>>()
            .into_iter()
            .rev()
            .collect()
    }

    pub async fn len(&self) -> usize {
        self.buffer.lock().await.len()
    }
}