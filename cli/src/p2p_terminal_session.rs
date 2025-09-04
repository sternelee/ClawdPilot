use anyhow::Result;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::{mpsc, RwLock};
use tracing::{debug, error, info, warn};

use crate::p2p_buffer_manager::{AsyncP2PBufferManager, BufferConfig, ContentChunk, AckMessage};
use crate::terminal::{TerminalEvent, EventType, TerminalRecorder};
use crate::shell::ShellConfig;
use crate::resource_manager::{ResourcePool, TerminalResourceManager};

/// 专为 P2P 网络优化的终端会话
pub struct P2PTerminalSession {
    session_id: String,
    /// 输出缓冲区管理器
    output_buffer: AsyncP2PBufferManager,
    /// 输入缓冲区管理器  
    input_buffer: AsyncP2PBufferManager,
    /// 资源管理器
    resource_manager: Option<TerminalResourceManager>,
    /// 终端记录器
    recorder: Option<TerminalRecorder>,
    /// P2P 网络发送器
    network_sender: Option<iroh_gossip::api::GossipSender>,
    /// 会话配置
    config: SessionConfig,
    /// 统计信息
    stats: Arc<RwLock<SessionStats>>,
}

#[derive(Debug, Clone)]
pub struct SessionConfig {
    pub session_id: String,
    pub shell_config: ShellConfig,
    pub width: u16,
    pub height: u16,
    pub buffer_config: BufferConfig,
    pub enable_compression: bool,
}

#[derive(Debug, Default)]
pub struct SessionStats {
    pub bytes_sent: u64,
    pub bytes_received: u64,
    pub chunks_sent: u64,
    pub chunks_received: u64,
    pub retransmissions: u64,
    pub ack_sent: u64,
    pub ack_received: u64,
}

impl P2PTerminalSession {
    pub async fn new(
        config: SessionConfig,
        resource_pool: &ResourcePool,
        network_sender: iroh_gossip::api::GossipSender,
    ) -> Result<Self> {
        info!("Creating P2P terminal session: {}", config.session_id);

        // 创建输出缓冲区管理器
        let (output_buffer, output_chunk_receiver, output_ack_sender) = 
            AsyncP2PBufferManager::new(config.buffer_config.clone());

        // 创建输入缓冲区管理器
        let (input_buffer, input_chunk_receiver, input_ack_sender) = 
            AsyncP2PBufferManager::new(config.buffer_config.clone());

        // 创建资源管理器
        let (shell_command, shell_args) = config.shell_config.get_full_command();
        let resource_manager = TerminalResourceManager::new(
            &shell_command,
            &shell_args,
            config.width,
            config.height,
            &config.shell_config.environment_vars.iter()
                .map(|(k, v)| (k.clone(), v.clone()))
                .collect::<Vec<_>>(),
            resource_pool,
        ).await?;

        // 创建终端记录器
        let shell_type = config.shell_config.shell_type.get_display_name().to_string();
        let (recorder, _event_receiver) = TerminalRecorder::new(
            config.session_id.clone(),
            shell_type,
        ).await?;

        let mut session = Self {
            session_id: config.session_id.clone(),
            output_buffer,
            input_buffer,
            resource_manager: Some(resource_manager),
            recorder: Some(recorder),
            network_sender: Some(network_sender.clone()),
            config,
            stats: Arc::new(RwLock::new(SessionStats::default())),
        };

        // 启动网络处理任务
        session.start_network_tasks(
            output_chunk_receiver,
            output_ack_sender,
            input_chunk_receiver,
            input_ack_sender,
            network_sender,
        ).await?;

        Ok(session)
    }

    /// 启动网络处理任务
    async fn start_network_tasks(
        &self,
        mut output_chunk_receiver: mpsc::UnboundedReceiver<ContentChunk>,
        output_ack_sender: mpsc::UnboundedSender<AckMessage>,
        mut input_chunk_receiver: mpsc::UnboundedReceiver<ContentChunk>,
        input_ack_sender: mpsc::UnboundedSender<AckMessage>,
        network_sender: iroh_gossip::api::GossipSender,
    ) -> Result<()> {
        let session_id = self.session_id.clone();
        let stats = self.stats.clone();

        // 处理输出数据块发送
        let network_sender_clone = network_sender.clone();
        let stats_clone = stats.clone();
        let session_id_clone = session_id.clone();
        tokio::spawn(async move {
            while let Some(chunk) = output_chunk_receiver.recv().await {
                debug!("Sending output chunk: seq={}, len={}", chunk.seq, chunk.length);
                
                // 创建 P2P 消息
                let message = P2PTerminalMessage::OutputChunk {
                    session_id: session_id_clone.clone(),
                    chunk: chunk.clone(),
                };

                match Self::send_p2p_message(&network_sender_clone, message).await {
                    Ok(_) => {
                        let mut stats_guard = stats_clone.write().await;
                        stats_guard.bytes_sent += chunk.length as u64;
                        stats_guard.chunks_sent += 1;
                    }
                    Err(e) => {
                        error!("Failed to send output chunk: {}", e);
                    }
                }
            }
        });

        // 处理输入数据块发送
        let network_sender_clone = network_sender.clone();
        let stats_clone = stats.clone();
        let session_id_clone = session_id.clone();
        tokio::spawn(async move {
            while let Some(chunk) = input_chunk_receiver.recv().await {
                debug!("Sending input chunk: seq={}, len={}", chunk.seq, chunk.length);
                
                let message = P2PTerminalMessage::InputChunk {
                    session_id: session_id_clone.clone(),
                    chunk: chunk.clone(),
                };

                match Self::send_p2p_message(&network_sender_clone, message).await {
                    Ok(_) => {
                        let mut stats_guard = stats_clone.write().await;
                        stats_guard.bytes_sent += chunk.length as u64;
                        stats_guard.chunks_sent += 1;
                    }
                    Err(e) => {
                        error!("Failed to send input chunk: {}", e);
                    }
                }
            }
        });

        // 处理 ACK 发送
        let network_sender_clone = network_sender.clone();
        let stats_clone = stats.clone();
        let session_id_clone = session_id.clone();
        tokio::spawn(async move {
            let mut ack_interval = tokio::time::interval(Duration::from_millis(100));
            let mut pending_output_ack: Option<AckMessage> = None;
            let mut pending_input_ack: Option<AckMessage> = None;

            loop {
                tokio::select! {
                    ack = output_ack_sender.recv() => {
                        if let Some(ack) = ack {
                            pending_output_ack = Some(ack);
                        }
                    }
                    ack = input_ack_sender.recv() => {
                        if let Some(ack) = ack {
                            pending_input_ack = Some(ack);
                        }
                    }
                    _ = ack_interval.tick() => {
                        // 批量发送 ACK
                        if let Some(ack) = pending_output_ack.take() {
                            let message = P2PTerminalMessage::OutputAck {
                                session_id: session_id_clone.clone(),
                                ack,
                            };
                            
                            if let Err(e) = Self::send_p2p_message(&network_sender_clone, message).await {
                                error!("Failed to send output ACK: {}", e);
                            } else {
                                let mut stats_guard = stats_clone.write().await;
                                stats_guard.ack_sent += 1;
                            }
                        }

                        if let Some(ack) = pending_input_ack.take() {
                            let message = P2PTerminalMessage::InputAck {
                                session_id: session_id_clone.clone(),
                                ack,
                            };
                            
                            if let Err(e) = Self::send_p2p_message(&network_sender_clone, message).await {
                                error!("Failed to send input ACK: {}", e);
                            } else {
                                let mut stats_guard = stats_clone.write().await;
                                stats_guard.ack_sent += 1;
                            }
                        }
                    }
                }
            }
        });

        Ok(())
    }

    /// 启动终端会话
    pub async fn start(&mut self) -> Result<()> {
        info!("Starting P2P terminal session: {}", self.session_id);

        let (pty_output_sender, mut pty_output_receiver) = mpsc::unbounded_channel::<Vec<u8>>();
        let (pty_input_sender, mut pty_input_receiver) = mpsc::unbounded_channel::<Vec<u8>>();

        // 启动 PTY 输出读取任务
        if let Some(ref mut resource_manager) = self.resource_manager {
            tokio::spawn(async move {
                let mut buffer = [0u8; 8192];
                loop {
                    // 在实际实现中，这里会从 resource_manager 读取数据
                    // match resource_manager.get_reader()?.read(&mut buffer) {
                    //     Ok(0) => break,
                    //     Ok(n) => {
                    //         let data = buffer[..n].to_vec();
                    //         if pty_output_sender.send(data).is_err() {
                    //             break;
                    //         }
                    //     }
                    //     Err(e) => {
                    //         error!("PTY read error: {}", e);
                    //         break;
                    //     }
                    // }
                    
                    // 占位符 - 模拟数据
                    tokio::time::sleep(Duration::from_millis(100)).await;
                }
            });
        }

        // 启动 PTY 输入写入任务
        if let Some(ref mut resource_manager) = self.resource_manager {
            tokio::spawn(async move {
                while let Some(data) = pty_input_receiver.recv().await {
                    // 在实际实现中，这里会向 resource_manager 写入数据
                    // if let Err(e) = resource_manager.get_writer()?.write_all(&data) {
                    //     error!("PTY write error: {}", e);
                    //     break;
                    // }
                    debug!("Would write {} bytes to PTY", data.len());
                }
            });
        }

        // 处理 PTY 输出 -> 缓冲区
        let output_buffer = self.output_buffer.clone();
        let recorder = self.recorder.clone();
        tokio::spawn(async move {
            while let Some(data) = pty_output_receiver.recv().await {
                // 记录到终端记录器
                if let Some(ref recorder) = recorder {
                    if let Err(e) = recorder.record_output(&data) {
                        error!("Failed to record output: {}", e);
                    }
                }

                // 处理到输出缓冲区
                if let Err(e) = output_buffer.process_bytes(&data).await {
                    error!("Failed to process output bytes: {}", e);
                }
            }
        });

        // 等待会话结束
        if let Some(ref mut resource_manager) = self.resource_manager {
            resource_manager.wait_for_exit().await?;
        }

        // 完成缓冲区处理
        self.output_buffer.finalize().await?;
        self.input_buffer.finalize().await?;

        info!("P2P terminal session ended: {}", self.session_id);
        Ok(())
    }

    /// 处理来自网络的消息
    pub async fn handle_network_message(&mut self, message: P2PTerminalMessage) -> Result<()> {
        match message {
            P2PTerminalMessage::OutputChunk { chunk, .. } => {
                debug!("Received output chunk: seq={}, len={}", chunk.seq, chunk.length);
                
                // 发送 ACK
                let ack = AckMessage {
                    ack_seq: chunk.offset + chunk.length,
                    window_size: 1024 * 1024, // 1MB window
                };
                
                // 这里应该通过某种方式发送 ACK，但由于架构限制，我们先记录
                let mut stats = self.stats.write().await;
                stats.bytes_received += chunk.length as u64;
                stats.chunks_received += 1;

                // 输出到终端（如果是客户端）
                if let Some(ref recorder) = self.recorder {
                    if let Err(e) = recorder.record_output(&chunk.data) {
                        error!("Failed to record received output: {}", e);
                    }
                }
            }
            P2PTerminalMessage::InputChunk { chunk, .. } => {
                debug!("Received input chunk: seq={}, len={}", chunk.seq, chunk.length);
                
                // 发送到 PTY（如果是主机）
                // 这里需要实际的 PTY 输入处理
                
                let mut stats = self.stats.write().await;
                stats.bytes_received += chunk.length as u64;
                stats.chunks_received += 1;
            }
            P2PTerminalMessage::OutputAck { ack, .. } => {
                debug!("Received output ACK: seq={}", ack.ack_seq);
                // 这里应该通知输出缓冲区管理器
                let mut stats = self.stats.write().await;
                stats.ack_received += 1;
            }
            P2PTerminalMessage::InputAck { ack, .. } => {
                debug!("Received input ACK: seq={}", ack.ack_seq);
                // 这里应该通知输入缓冲区管理器
                let mut stats = self.stats.write().await;
                stats.ack_received += 1;
            }
        }

        Ok(())
    }

    /// 发送输入数据
    pub async fn send_input(&self, data: &[u8]) -> Result<()> {
        debug!("Sending input: {} bytes", data.len());
        
        // 记录输入
        if let Some(ref recorder) = self.recorder {
            if let Err(e) = recorder.record_input(data) {
                error!("Failed to record input: {}", e);
            }
        }

        // 处理到输入缓冲区
        self.input_buffer.process_bytes(data).await?;

        Ok(())
    }

    /// 调整终端大小
    pub async fn resize(&mut self, width: u16, height: u16) -> Result<()> {
        info!("Resizing terminal to {}x{}", width, height);
        
        self.config.width = width;
        self.config.height = height;

        // 记录 resize 事件
        if let Some(ref recorder) = self.recorder {
            if let Err(e) = recorder.record_resize(width, height) {
                error!("Failed to record resize: {}", e);
            }
        }

        // 在实际实现中，这里会调用 resource_manager 的 resize 方法

        Ok(())
    }

    /// 获取会话统计信息
    pub async fn get_stats(&self) -> SessionStats {
        let stats = self.stats.read().await;
        stats.clone()
    }

    /// 获取缓冲区状态
    pub async fn get_buffer_status(&self) -> (crate::p2p_buffer_manager::BufferStatus, crate::p2p_buffer_manager::BufferStatus) {
        let output_status = self.output_buffer.get_status().await;
        let input_status = self.input_buffer.get_status().await;
        (output_status, input_status)
    }

    /// 发送 P2P 消息的辅助方法
    async fn send_p2p_message(
        sender: &iroh_gossip::api::GossipSender,
        message: P2PTerminalMessage,
    ) -> Result<()> {
        let serialized = bincode::serialize(&message)?;
        sender.broadcast(serialized.into()).await?;
        Ok(())
    }

    /// 优雅关闭会话
    pub async fn shutdown(&mut self) -> Result<()> {
        info!("Shutting down P2P terminal session: {}", self.session_id);

        // 完成缓冲区处理
        self.output_buffer.finalize().await?;
        self.input_buffer.finalize().await?;

        // 关闭资源管理器
        if let Some(mut resource_manager) = self.resource_manager.take() {
            resource_manager.shutdown().await?;
        }

        // 关闭记录器
        if let Some(recorder) = self.recorder.take() {
            // 在实际实现中，这里会关闭记录器
        }

        info!("P2P terminal session shutdown complete: {}", self.session_id);
        Ok(())
    }
}

/// P2P 终端消息类型
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub enum P2PTerminalMessage {
    OutputChunk {
        session_id: String,
        chunk: ContentChunk,
    },
    InputChunk {
        session_id: String,
        chunk: ContentChunk,
    },
    OutputAck {
        session_id: String,
        ack: AckMessage,
    },
    InputAck {
        session_id: String,
        ack: AckMessage,
    },
}

impl Clone for AsyncP2PBufferManager {
    fn clone(&self) -> Self {
        Self {
            inner: self.inner.clone(),
            chunk_sender: self.chunk_sender.clone(),
            ack_receiver: self.ack_receiver.clone(),
        }
    }
}

impl Clone for SessionStats {
    fn clone(&self) -> Self {
        Self {
            bytes_sent: self.bytes_sent,
            bytes_received: self.bytes_received,
            chunks_sent: self.chunks_sent,
            chunks_received: self.chunks_received,
            retransmissions: self.retransmissions,
            ack_sent: self.ack_sent,
            ack_received: self.ack_received,
        }
    }
}