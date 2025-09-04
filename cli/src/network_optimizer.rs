use anyhow::Result;
use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::{RwLock, mpsc};
use tracing::{debug, warn, error};

/// 网络通信优化器
pub struct NetworkOptimizer {
    /// 消息批处理器
    batch_processor: MessageBatcher,
    /// 连接质量监控
    connection_monitor: ConnectionMonitor,
    /// 自适应压缩
    adaptive_compressor: AdaptiveCompressor,
}

/// 消息批处理器，减少网络往返次数
pub struct MessageBatcher {
    pending_messages: Arc<RwLock<Vec<BatchedMessage>>>,
    batch_size: usize,
    batch_timeout: Duration,
    sender: mpsc::UnboundedSender<Vec<BatchedMessage>>,
}

#[derive(Debug, Clone)]
pub struct BatchedMessage {
    pub data: Vec<u8>,
    pub priority: MessagePriority,
    pub timestamp: Instant,
}

#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord)]
pub enum MessagePriority {
    Low,      // 历史数据、配置信息
    Normal,   // 终端输出
    High,     // 用户输入
    Critical, // 控制消息
}

impl MessageBatcher {
    pub fn new(batch_size: usize, batch_timeout: Duration) -> (Self, mpsc::UnboundedReceiver<Vec<BatchedMessage>>) {
        let (sender, receiver) = mpsc::unbounded_channel();
        
        let batcher = Self {
            pending_messages: Arc::new(RwLock::new(Vec::new())),
            batch_size,
            batch_timeout,
            sender,
        };

        // 启动批处理定时器
        batcher.start_batch_timer();

        (batcher, receiver)
    }

    pub async fn add_message(&self, data: Vec<u8>, priority: MessagePriority) -> Result<()> {
        let message = BatchedMessage {
            data,
            priority,
            timestamp: Instant::now(),
        };

        let mut pending = self.pending_messages.write().await;
        pending.push(message);

        // 检查是否需要立即发送
        let should_send = pending.len() >= self.batch_size 
            || pending.iter().any(|m| m.priority >= MessagePriority::High);

        if should_send {
            let batch = std::mem::take(&mut *pending);
            drop(pending);
            self.send_batch(batch).await?;
        }

        Ok(())
    }

    fn start_batch_timer(&self) {
        let pending_messages = self.pending_messages.clone();
        let sender = self.sender.clone();
        let timeout = self.batch_timeout;

        tokio::spawn(async move {
            let mut interval = tokio::time::interval(timeout);
            
            loop {
                interval.tick().await;
                
                let batch = {
                    let mut pending = pending_messages.write().await;
                    if pending.is_empty() {
                        continue;
                    }
                    std::mem::take(&mut *pending)
                };

                if let Err(e) = sender.send(batch) {
                    error!("Failed to send batch: {}", e);
                    break;
                }
            }
        });
    }

    async fn send_batch(&self, mut batch: Vec<BatchedMessage>) -> Result<()> {
        if batch.is_empty() {
            return Ok(());
        }

        // 按优先级排序
        batch.sort_by(|a, b| b.priority.cmp(&a.priority));

        debug!("Sending batch of {} messages", batch.len());
        
        if let Err(e) = self.sender.send(batch) {
            error!("Failed to send batch: {}", e);
        }

        Ok(())
    }
}

/// 连接质量监控器
pub struct ConnectionMonitor {
    latency_samples: Arc<RwLock<Vec<Duration>>>,
    packet_loss_rate: Arc<RwLock<f64>>,
    bandwidth_estimate: Arc<RwLock<u64>>, // bytes per second
}

impl ConnectionMonitor {
    pub fn new() -> Self {
        Self {
            latency_samples: Arc::new(RwLock::new(Vec::new())),
            packet_loss_rate: Arc::new(RwLock::new(0.0)),
            bandwidth_estimate: Arc::new(RwLock::new(1_000_000)), // 1MB/s default
        }
    }

    pub async fn record_latency(&self, latency: Duration) {
        let mut samples = self.latency_samples.write().await;
        samples.push(latency);
        
        // 保持最近的100个样本
        if samples.len() > 100 {
            samples.drain(0..50);
        }
    }

    pub async fn get_average_latency(&self) -> Duration {
        let samples = self.latency_samples.read().await;
        if samples.is_empty() {
            return Duration::from_millis(50); // 默认值
        }

        let total: Duration = samples.iter().sum();
        total / samples.len() as u32
    }

    pub async fn update_packet_loss(&self, loss_rate: f64) {
        *self.packet_loss_rate.write().await = loss_rate;
    }

    pub async fn get_packet_loss_rate(&self) -> f64 {
        *self.packet_loss_rate.read().await
    }

    pub async fn estimate_bandwidth(&self, bytes_sent: u64, duration: Duration) {
        if duration.as_secs() > 0 {
            let bandwidth = bytes_sent / duration.as_secs();
            *self.bandwidth_estimate.write().await = bandwidth;
        }
    }

    pub async fn get_bandwidth_estimate(&self) -> u64 {
        *self.bandwidth_estimate.read().await
    }

    /// 根据网络质量调整发送策略
    pub async fn get_send_strategy(&self) -> SendStrategy {
        let latency = self.get_average_latency().await;
        let loss_rate = self.get_packet_loss_rate().await;
        let bandwidth = self.get_bandwidth_estimate().await;

        if loss_rate > 0.05 || latency > Duration::from_millis(200) {
            SendStrategy::Conservative {
                batch_size: 10,
                retry_count: 3,
                compression_level: CompressionLevel::High,
            }
        } else if bandwidth > 10_000_000 && latency < Duration::from_millis(50) {
            SendStrategy::Aggressive {
                batch_size: 50,
                compression_level: CompressionLevel::Low,
            }
        } else {
            SendStrategy::Balanced {
                batch_size: 25,
                compression_level: CompressionLevel::Medium,
            }
        }
    }
}

#[derive(Debug, Clone)]
pub enum SendStrategy {
    Conservative {
        batch_size: usize,
        retry_count: u32,
        compression_level: CompressionLevel,
    },
    Balanced {
        batch_size: usize,
        compression_level: CompressionLevel,
    },
    Aggressive {
        batch_size: usize,
        compression_level: CompressionLevel,
    },
}

/// 自适应压缩器
pub struct AdaptiveCompressor {
    compression_stats: Arc<RwLock<HashMap<CompressionLevel, CompressionStats>>>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CompressionLevel {
    None,
    Low,
    Medium,
    High,
}

#[derive(Debug, Clone)]
struct CompressionStats {
    total_input_bytes: u64,
    total_output_bytes: u64,
    total_time: Duration,
    sample_count: u64,
}

impl AdaptiveCompressor {
    pub fn new() -> Self {
        Self {
            compression_stats: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub async fn compress(&self, data: &[u8], level: CompressionLevel) -> Result<Vec<u8>> {
        let start_time = Instant::now();
        
        let compressed = match level {
            CompressionLevel::None => data.to_vec(),
            CompressionLevel::Low => self.compress_low(data)?,
            CompressionLevel::Medium => self.compress_medium(data)?,
            CompressionLevel::High => self.compress_high(data)?,
        };

        let compression_time = start_time.elapsed();
        
        // 更新统计信息
        self.update_stats(level, data.len(), compressed.len(), compression_time).await;

        Ok(compressed)
    }

    async fn update_stats(&self, level: CompressionLevel, input_size: usize, output_size: usize, time: Duration) {
        let mut stats = self.compression_stats.write().await;
        let entry = stats.entry(level).or_insert(CompressionStats {
            total_input_bytes: 0,
            total_output_bytes: 0,
            total_time: Duration::ZERO,
            sample_count: 0,
        });

        entry.total_input_bytes += input_size as u64;
        entry.total_output_bytes += output_size as u64;
        entry.total_time += time;
        entry.sample_count += 1;
    }

    pub async fn get_best_compression_level(&self, data_size: usize, bandwidth: u64) -> CompressionLevel {
        let stats = self.compression_stats.read().await;
        
        // 根据数据大小和带宽选择最佳压缩级别
        if data_size < 1024 {
            return CompressionLevel::None; // 小数据不压缩
        }

        if bandwidth < 1_000_000 { // 低带宽
            CompressionLevel::High
        } else if bandwidth > 10_000_000 { // 高带宽
            CompressionLevel::Low
        } else {
            CompressionLevel::Medium
        }
    }

    fn compress_low(&self, data: &[u8]) -> Result<Vec<u8>> {
        // 实现低级别压缩（例如 LZ4）
        Ok(data.to_vec()) // 占位符
    }

    fn compress_medium(&self, data: &[u8]) -> Result<Vec<u8>> {
        // 实现中等级别压缩（例如 Zlib）
        Ok(data.to_vec()) // 占位符
    }

    fn compress_high(&self, data: &[u8]) -> Result<Vec<u8>> {
        // 实现高级别压缩（例如 Brotli）
        use crate::string_compressor::StringCompressor;
        let data_str = String::from_utf8_lossy(data);
        StringCompressor::compress_hybrid(&data_str)
            .map(|s| s.into_bytes())
            .map_err(|e| anyhow::anyhow!("Compression failed: {}", e))
    }
}

impl NetworkOptimizer {
    pub fn new() -> Self {
        let (batch_processor, _receiver) = MessageBatcher::new(25, Duration::from_millis(100));
        
        Self {
            batch_processor,
            connection_monitor: ConnectionMonitor::new(),
            adaptive_compressor: AdaptiveCompressor::new(),
        }
    }

    pub async fn send_optimized(&self, data: Vec<u8>, priority: MessagePriority) -> Result<()> {
        // 获取当前网络策略
        let strategy = self.connection_monitor.get_send_strategy().await;
        let bandwidth = self.connection_monitor.get_bandwidth_estimate().await;

        // 选择压缩级别
        let compression_level = match strategy {
            SendStrategy::Conservative { compression_level, .. } => compression_level,
            SendStrategy::Balanced { compression_level, .. } => compression_level,
            SendStrategy::Aggressive { compression_level, .. } => compression_level,
        };

        // 压缩数据
        let compressed_data = self.adaptive_compressor.compress(&data, compression_level).await?;

        // 添加到批处理队列
        self.batch_processor.add_message(compressed_data, priority).await?;

        Ok(())
    }
}