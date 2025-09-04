use anyhow::Result;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::{mpsc, RwLock};
use tracing::{debug, error, info, warn};

use crate::p2p_buffer_manager::{AsyncP2PBufferManager, BufferConfig, ContentChunk, AckMessage};
use crate::p2p_terminal_session::{P2PTerminalMessage, P2PTerminalSession, SessionConfig};
use crate::terminal::{TerminalRecorder, TerminalEvent, EventType};
use crate::shell::ShellConfig;
use crate::resource_manager::ResourcePool;
use crate::performance_monitor::PerformanceMonitor;

/// 优化的终端记录器，集成 P2P 缓冲区管理
pub struct OptimizedTerminalRecorder {
    /// 原始终端记录器
    base_recorder: TerminalRecorder,
    /// P2P 输出缓冲区管理器
    output_buffer: AsyncP2PBufferManager,
    /// 性能监控器
    performance_monitor: PerformanceMonitor,
    /// 网络发送器
    network_sender: Option<iroh_gossip::api::GossipSender>,
    /// 会话配置
    session_id: String,
}

impl OptimizedTerminalRecorder {
    pub async fn new(
        session_id: String,
        shell_type: String,
        network_sender: Option<iroh_gossip::api::GossipSender>,
    ) -> Result<(Self, mpsc::UnboundedReceiver<TerminalEvent>)> {
        // 创建基础终端记录器
        let (base_recorder, event_receiver) = TerminalRecorder::new(session_id.clone(), shell_type).await?;

        // 创建 P2P 缓冲区配置
        let buffer_config = BufferConfig {
            max_message_size: 16 * 1024,  // 16KB 适合 P2P 网络
            rolling_buffer_size: 1024 * 1024,  // 1MB 滚动缓冲区
            prune_threshold: 2 * 1024 * 1024,  // 2MB 清理阈值
            batch_interval: Duration::from_millis(50),
            retransmit_timeout: Duration::from_secs(3),
        };

        // 创建输出缓冲区管理器
        let (output_buffer, chunk_receiver, ack_sender) = AsyncP2PBufferManager::new(buffer_config);

        // 创建性能监控器
        let performance_monitor = PerformanceMonitor::new();

        let recorder = Self {
            base_recorder,
            output_buffer,
            performance_monitor,
            network_sender: network_sender.clone(),
            session_id: session_id.clone(),
        };

        // 启动数据块处理任务
        if let Some(sender) = network_sender {
            recorder.start_chunk_processor(chunk_receiver, sender).await;
        }

        Ok((recorder, event_receiver))
    }

    /// 启动数据块处理任务
    async fn start_chunk_processor(
        &self,
        mut chunk_receiver: mpsc::UnboundedReceiver<ContentChunk>,
        network_sender: iroh_gossip::api::GossipSender,
    ) {
        let session_id = self.session_id.clone();
        let performance_monitor = self.performance_monitor.clone();

        tokio::spawn(async move {
            while let Some(chunk) = chunk_receiver.recv().await {
                debug!("Processing output chunk: seq={}, len={}", chunk.seq, chunk.length);

                // 创建 P2P 消息
                let message = P2PTerminalMessage::OutputChunk {
                    session_id: session_id.clone(),
                    chunk: chunk.clone(),
                };

                // 序列化并发送
                match bincode::serialize(&message) {
                    Ok(serialized) => {
                        match network_sender.broadcast(serialized.into()).await {
                            Ok(_) => {
                                performance_monitor.record_bytes_sent(chunk.length as u64).await;
                                debug!("Successfully sent chunk: seq={}", chunk.seq);
                            }
                            Err(e) => {
                                error!("Failed to send chunk: {}", e);
                                performance_monitor.record_error().await;
                            }
                        }
                    }
                    Err(e) => {
                        error!("Failed to serialize chunk: {}", e);
                        performance_monitor.record_error().await;
                    }
                }
            }
        });
    }

    /// 记录输出数据（优化版本）
    pub async fn record_output_optimized(&self, data: &[u8]) -> Result<()> {
        // 首先通过基础记录器记录
        self.base_recorder.record_output(data)?;

        // 然后通过 P2P 缓冲区处理
        self.output_buffer.process_bytes(data).await?;

        // 更新性能监控
        self.performance_monitor.record_bytes_received(data.len() as u64).await;

        Ok(())
    }

    /// 记录输入数据
    pub fn record_input(&self, data: &[u8]) -> Result<()> {
        self.base_recorder.record_input(data)
    }

    /// 记录调整大小事件
    pub fn record_resize(&self, width: u16, height: u16) -> Result<()> {
        self.base_recorder.record_resize(width, height)
    }

    /// 获取会话信息
    pub async fn get_session_info(&self) -> crate::terminal::SessionInfo {
        self.base_recorder.get_session_info().await
    }

    /// 获取缓冲区状态
    pub async fn get_buffer_status(&self) -> crate::p2p_buffer_manager::BufferStatus {
        self.output_buffer.get_status().await
    }

    /// 获取性能指标
    pub async fn get_performance_metrics(&self) -> crate::performance_monitor::PerformanceMetrics {
        self.performance_monitor.get_metrics().await
    }

    /// 启动性能监控报告
    pub async fn start_performance_reporting(&self, interval: Duration) {
        self.performance_monitor.start_periodic_reporting(interval).await;
    }
}

/// 优化的主机会话，集成 P2P 缓冲区管理
pub struct OptimizedHostSession {
    /// P2P 终端会话
    p2p_session: Option<P2PTerminalSession>,
    /// 性能监控器
    performance_monitor: PerformanceMonitor,
    /// 资源池
    resource_pool: ResourcePool,
}

impl OptimizedHostSession {
    pub fn new() -> Self {
        Self {
            p2p_session: None,
            performance_monitor: PerformanceMonitor::new(),
            resource_pool: ResourcePool::new(10, 512), // 最多10个终端，512MB内存
        }
    }

    pub async fn start_optimized(
        &mut self,
        shell_config: ShellConfig,
        width: u16,
        height: u16,
        session_id: String,
        network_sender: iroh_gossip::api::GossipSender,
    ) -> Result<()> {
        info!("Starting optimized host session: {}", session_id);

        // 创建会话配置
        let config = SessionConfig {
            session_id: session_id.clone(),
            shell_config,
            width,
            height,
            buffer_config: BufferConfig {
                max_message_size: 32 * 1024,  // 32KB for host
                rolling_buffer_size: 4 * 1024 * 1024,  // 4MB rolling buffer
                prune_threshold: 8 * 1024 * 1024,      // 8MB prune threshold
                batch_interval: Duration::from_millis(25), // 25ms batching for host
                retransmit_timeout: Duration::from_secs(2), // 2s retransmit for host
            },
            enable_compression: true,
        };

        // 创建 P2P 终端会话
        let mut p2p_session = P2PTerminalSession::new(
            config,
            &self.resource_pool,
            network_sender,
        ).await?;

        // 启动性能监控
        self.performance_monitor.start_periodic_reporting(Duration::from_secs(30)).await;

        // 启动会话
        p2p_session.start().await?;

        self.p2p_session = Some(p2p_session);

        info!("Optimized host session started successfully");
        Ok(())
    }

    /// 处理来自网络的消息
    pub async fn handle_network_message(&mut self, message: P2PTerminalMessage) -> Result<()> {
        if let Some(ref mut session) = self.p2p_session {
            session.handle_network_message(message).await?;
            
            // 更新性能监控
            match &message {
                P2PTerminalMessage::OutputChunk { chunk, .. } |
                P2PTerminalMessage::InputChunk { chunk, .. } => {
                    self.performance_monitor.record_bytes_received(chunk.length as u64).await;
                }
                _ => {}
            }
        }
        Ok(())
    }

    /// 发送输入数据
    pub async fn send_input(&self, data: &[u8]) -> Result<()> {
        if let Some(ref session) = self.p2p_session {
            session.send_input(data).await?;
            self.performance_monitor.record_bytes_sent(data.len() as u64).await;
        }
        Ok(())
    }

    /// 调整终端大小
    pub async fn resize(&mut self, width: u16, height: u16) -> Result<()> {
        if let Some(ref mut session) = self.p2p_session {
            session.resize(width, height).await?;
        }
        Ok(())
    }

    /// 获取会话统计信息
    pub async fn get_session_stats(&self) -> Option<crate::p2p_terminal_session::SessionStats> {
        if let Some(ref session) = self.p2p_session {
            Some(session.get_stats().await)
        } else {
            None
        }
    }

    /// 获取性能报告
    pub async fn print_performance_report(&self) {
        self.performance_monitor.print_performance_report().await;
        
        if let Some(ref session) = self.p2p_session {
            let stats = session.get_stats().await;
            let (output_status, input_status) = session.get_buffer_status().await;
            
            info!("=== P2P Session Report ===");
            info!("Bytes sent: {}, received: {}", stats.bytes_sent, stats.bytes_received);
            info!("Chunks sent: {}, received: {}", stats.chunks_sent, stats.chunks_received);
            info!("Retransmissions: {}", stats.retransmissions);
            info!("Output buffer: {} bytes, {} pending chunks", 
                  output_status.content_size, output_status.pending_chunks);
            info!("Input buffer: {} bytes, {} pending chunks", 
                  input_status.content_size, input_status.pending_chunks);
            info!("========================");
        }
    }

    /// 优雅关闭会话
    pub async fn shutdown(&mut self) -> Result<()> {
        info!("Shutting down optimized host session");

        if let Some(mut session) = self.p2p_session.take() {
            session.shutdown().await?;
        }

        // 打印最终性能报告
        self.print_performance_report().await;

        info!("Optimized host session shutdown complete");
        Ok(())
    }
}

/// 使用示例和集成指南
pub mod integration_examples {
    use super::*;

    /// 展示如何在现有代码中集成优化的终端记录器
    pub async fn integrate_optimized_recorder_example() -> Result<()> {
        // 1. 创建优化的终端记录器
        let session_id = "example_session".to_string();
        let shell_type = "bash".to_string();
        let network_sender = None; // 在实际使用中，这里会是真实的网络发送器

        let (recorder, mut event_receiver) = OptimizedTerminalRecorder::new(
            session_id,
            shell_type,
            network_sender,
        ).await?;

        // 2. 启动性能监控
        recorder.start_performance_reporting(Duration::from_secs(60)).await;

        // 3. 处理终端输出
        let test_output = b"Hello, optimized terminal!\n";
        recorder.record_output_optimized(test_output).await?;

        // 4. 处理事件
        tokio::spawn(async move {
            while let Some(event) = event_receiver.recv().await {
                match event.event_type {
                    EventType::Output => {
                        println!("Received output: {}", event.data);
                    }
                    EventType::Input => {
                        println!("Received input: {}", event.data);
                    }
                    _ => {}
                }
            }
        });

        // 5. 获取状态信息
        let buffer_status = recorder.get_buffer_status().await;
        println!("Buffer status: {:?}", buffer_status);

        let performance_metrics = recorder.get_performance_metrics().await;
        println!("Performance metrics: {:?}", performance_metrics);

        Ok(())
    }

    /// 展示如何替换现有的终端会话
    pub async fn replace_existing_terminal_session_example() -> Result<()> {
        // 创建优化的主机会话
        let mut host_session = OptimizedHostSession::new();

        // 配置 shell
        let shell_config = ShellConfig::new(crate::shell::ShellType::Bash);

        // 在实际使用中，这里会是真实的网络发送器
        // let network_sender = create_network_sender().await?;

        // 启动优化会话
        // host_session.start_optimized(
        //     shell_config,
        //     80, 24,
        //     "optimized_session".to_string(),
        //     network_sender,
        // ).await?;

        // 模拟一些操作
        // host_session.send_input(b"ls -la\n").await?;
        // host_session.resize(120, 30).await?;

        // 获取统计信息
        if let Some(stats) = host_session.get_session_stats().await {
            println!("Session stats: {:?}", stats);
        }

        // 关闭会话
        host_session.shutdown().await?;

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_optimized_recorder_creation() {
        let session_id = "test_session".to_string();
        let shell_type = "bash".to_string();
        
        let result = OptimizedTerminalRecorder::new(session_id, shell_type, None).await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_optimized_host_session_creation() {
        let host_session = OptimizedHostSession::new();
        // 基本创建测试
        assert!(host_session.p2p_session.is_none());
    }
}