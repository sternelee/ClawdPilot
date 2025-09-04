use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::RwLock;
use tracing::{debug, info, warn};

/// 性能监控器
pub struct PerformanceMonitor {
    metrics: Arc<RwLock<PerformanceMetrics>>,
    start_time: Instant,
}

#[derive(Debug, Default)]
pub struct PerformanceMetrics {
    pub bytes_sent: u64,
    pub bytes_received: u64,
    pub messages_sent: u64,
    pub messages_received: u64,
    pub errors_count: u64,
    pub average_latency: Duration,
    pub peak_memory_usage: usize,
    pub cpu_usage_percent: f64,
    pub custom_metrics: HashMap<String, f64>,
}

impl PerformanceMonitor {
    pub fn new() -> Self {
        Self {
            metrics: Arc::new(RwLock::new(PerformanceMetrics::default())),
            start_time: Instant::now(),
        }
    }

    pub async fn record_bytes_sent(&self, bytes: u64) {
        let mut metrics = self.metrics.write().await;
        metrics.bytes_sent += bytes;
        metrics.messages_sent += 1;
    }

    pub async fn record_bytes_received(&self, bytes: u64) {
        let mut metrics = self.metrics.write().await;
        metrics.bytes_received += bytes;
        metrics.messages_received += 1;
    }

    pub async fn record_latency(&self, latency: Duration) {
        let mut metrics = self.metrics.write().await;
        // 简单的移动平均
        metrics.average_latency = Duration::from_millis(
            (metrics.average_latency.as_millis() as u64 + latency.as_millis() as u64) / 2
        );
    }

    pub async fn record_error(&self) {
        let mut metrics = self.metrics.write().await;
        metrics.errors_count += 1;
    }

    pub async fn get_metrics(&self) -> PerformanceMetrics {
        self.metrics.read().await.clone()
    }

    pub async fn print_performance_report(&self) {
        let metrics = self.get_metrics().await;
        let uptime = self.start_time.elapsed();

        info!("=== Performance Report ===");
        info!("Uptime: {:?}", uptime);
        info!("Bytes sent: {} ({:.2} MB)", metrics.bytes_sent, metrics.bytes_sent as f64 / 1_048_576.0);
        info!("Bytes received: {} ({:.2} MB)", metrics.bytes_received, metrics.bytes_received as f64 / 1_048_576.0);
        info!("Messages sent: {}", metrics.messages_sent);
        info!("Messages received: {}", metrics.messages_received);
        info!("Errors: {}", metrics.errors_count);
        info!("Average latency: {:?}", metrics.average_latency);
        
        if uptime.as_secs() > 0 {
            let throughput_sent = metrics.bytes_sent as f64 / uptime.as_secs() as f64;
            let throughput_received = metrics.bytes_received as f64 / uptime.as_secs() as f64;
            info!("Throughput sent: {:.2} bytes/sec", throughput_sent);
            info!("Throughput received: {:.2} bytes/sec", throughput_received);
        }

        for (key, value) in &metrics.custom_metrics {
            info!("Custom metric {}: {:.2}", key, value);
        }
        info!("========================");
    }

    pub async fn start_periodic_reporting(&self, interval: Duration) {
        let monitor = self.clone();
        tokio::spawn(async move {
            let mut interval_timer = tokio::time::interval(interval);
            loop {
                interval_timer.tick().await;
                monitor.print_performance_report().await;
            }
        });
    }
}

impl Clone for PerformanceMonitor {
    fn clone(&self) -> Self {
        Self {
            metrics: self.metrics.clone(),
            start_time: self.start_time,
        }
    }
}

impl Clone for PerformanceMetrics {
    fn clone(&self) -> Self {
        Self {
            bytes_sent: self.bytes_sent,
            bytes_received: self.bytes_received,
            messages_sent: self.messages_sent,
            messages_received: self.messages_received,
            errors_count: self.errors_count,
            average_latency: self.average_latency,
            peak_memory_usage: self.peak_memory_usage,
            cpu_usage_percent: self.cpu_usage_percent,
            custom_metrics: self.custom_metrics.clone(),
        }
    }
}