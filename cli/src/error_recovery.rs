use anyhow::Result;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::{RwLock, mpsc};
use tracing::{debug, warn, error, info};

/// 错误恢复管理器
pub struct ErrorRecoveryManager {
    /// 重试策略配置
    retry_config: RetryConfig,
    /// 错误统计
    error_stats: Arc<RwLock<ErrorStats>>,
    /// 恢复操作队列
    recovery_queue: mpsc::UnboundedSender<RecoveryAction>,
}

#[derive(Debug, Clone)]
pub struct RetryConfig {
    pub max_retries: u32,
    pub initial_delay: Duration,
    pub max_delay: Duration,
    pub backoff_multiplier: f64,
    pub jitter: bool,
}

impl Default for RetryConfig {
    fn default() -> Self {
        Self {
            max_retries: 5,
            initial_delay: Duration::from_millis(100),
            max_delay: Duration::from_secs(30),
            backoff_multiplier: 2.0,
            jitter: true,
        }
    }
}

#[derive(Debug, Default)]
struct ErrorStats {
    total_errors: u64,
    network_errors: u64,
    pty_errors: u64,
    encryption_errors: u64,
    last_error_time: Option<Instant>,
    error_rate: f64, // errors per minute
}

#[derive(Debug, Clone)]
pub enum RecoveryAction {
    ReconnectNetwork,
    RestartPty,
    ClearBuffers,
    ResetEncryption,
    NotifyUser(String),
}

#[derive(Debug)]
pub enum ErrorType {
    Network(NetworkError),
    Pty(PtyError),
    Encryption(EncryptionError),
    Protocol(ProtocolError),
}

#[derive(Debug)]
pub enum NetworkError {
    ConnectionLost,
    Timeout,
    InvalidResponse,
    PeerDisconnected,
}

#[derive(Debug)]
pub enum PtyError {
    ProcessDied,
    ReadError,
    WriteError,
    SizeError,
}

#[derive(Debug)]
pub enum EncryptionError {
    KeyMismatch,
    DecryptionFailed,
    InvalidNonce,
}

#[derive(Debug)]
pub enum ProtocolError {
    InvalidMessage,
    VersionMismatch,
    UnknownCommand,
}

impl ErrorRecoveryManager {
    pub fn new(retry_config: RetryConfig) -> (Self, mpsc::UnboundedReceiver<RecoveryAction>) {
        let (recovery_sender, recovery_receiver) = mpsc::unbounded_channel();
        
        let manager = Self {
            retry_config,
            error_stats: Arc::new(RwLock::new(ErrorStats::default())),
            recovery_queue: recovery_sender,
        };

        (manager, recovery_receiver)
    }

    /// 处理错误并决定恢复策略
    pub async fn handle_error(&self, error: ErrorType) -> Result<RecoveryStrategy> {
        // 更新错误统计
        self.update_error_stats(&error).await;

        // 根据错误类型和历史决定恢复策略
        let strategy = self.determine_recovery_strategy(&error).await;

        info!("Error recovery strategy: {:?}", strategy);

        // 执行恢复操作
        self.execute_recovery_strategy(&strategy).await?;

        Ok(strategy)
    }

    async fn update_error_stats(&self, error: &ErrorType) {
        let mut stats = self.error_stats.write().await;
        stats.total_errors += 1;
        stats.last_error_time = Some(Instant::now());

        match error {
            ErrorType::Network(_) => stats.network_errors += 1,
            ErrorType::Pty(_) => stats.pty_errors += 1,
            ErrorType::Encryption(_) => stats.encryption_errors += 1,
            ErrorType::Protocol(_) => {
                // Protocol errors might indicate version issues
            }
        }

        // 计算错误率（每分钟错误数）
        if stats.total_errors > 1 {
            // 简化的错误率计算
            stats.error_rate = stats.total_errors as f64 / 60.0;
        }
    }

    async fn determine_recovery_strategy(&self, error: &ErrorType) -> RecoveryStrategy {
        let stats = self.error_stats.read().await;
        
        match error {
            ErrorType::Network(net_err) => {
                match net_err {
                    NetworkError::ConnectionLost | NetworkError::PeerDisconnected => {
                        if stats.network_errors > 3 {
                            RecoveryStrategy::Escalated {
                                actions: vec![
                                    RecoveryAction::ClearBuffers,
                                    RecoveryAction::ReconnectNetwork,
                                    RecoveryAction::NotifyUser("Network connection unstable, attempting recovery...".to_string()),
                                ],
                                retry_config: self.retry_config.clone(),
                            }
                        } else {
                            RecoveryStrategy::Simple {
                                action: RecoveryAction::ReconnectNetwork,
                                retry_config: self.retry_config.clone(),
                            }
                        }
                    }
                    NetworkError::Timeout => {
                        RecoveryStrategy::Simple {
                            action: RecoveryAction::ReconnectNetwork,
                            retry_config: RetryConfig {
                                max_retries: 3,
                                initial_delay: Duration::from_secs(1),
                                ..self.retry_config.clone()
                            },
                        }
                    }
                    NetworkError::InvalidResponse => {
                        RecoveryStrategy::Simple {
                            action: RecoveryAction::ClearBuffers,
                            retry_config: self.retry_config.clone(),
                        }
                    }
                }
            }
            ErrorType::Pty(pty_err) => {
                match pty_err {
                    PtyError::ProcessDied => {
                        RecoveryStrategy::Critical {
                            actions: vec![
                                RecoveryAction::NotifyUser("Terminal process died, restarting...".to_string()),
                                RecoveryAction::RestartPty,
                            ],
                        }
                    }
                    PtyError::ReadError | PtyError::WriteError => {
                        RecoveryStrategy::Simple {
                            action: RecoveryAction::RestartPty,
                            retry_config: self.retry_config.clone(),
                        }
                    }
                    PtyError::SizeError => {
                        RecoveryStrategy::Simple {
                            action: RecoveryAction::ClearBuffers,
                            retry_config: RetryConfig {
                                max_retries: 2,
                                ..self.retry_config.clone()
                            },
                        }
                    }
                }
            }
            ErrorType::Encryption(enc_err) => {
                match enc_err {
                    EncryptionError::KeyMismatch => {
                        RecoveryStrategy::Critical {
                            actions: vec![
                                RecoveryAction::NotifyUser("Encryption key mismatch, session may be compromised".to_string()),
                                RecoveryAction::ResetEncryption,
                            ],
                        }
                    }
                    EncryptionError::DecryptionFailed | EncryptionError::InvalidNonce => {
                        RecoveryStrategy::Simple {
                            action: RecoveryAction::ClearBuffers,
                            retry_config: self.retry_config.clone(),
                        }
                    }
                }
            }
            ErrorType::Protocol(_) => {
                RecoveryStrategy::Simple {
                    action: RecoveryAction::ClearBuffers,
                    retry_config: self.retry_config.clone(),
                }
            }
        }
    }

    async fn execute_recovery_strategy(&self, strategy: &RecoveryStrategy) -> Result<()> {
        match strategy {
            RecoveryStrategy::Simple { action, .. } => {
                self.recovery_queue.send(action.clone())?;
            }
            RecoveryStrategy::Escalated { actions, .. } => {
                for action in actions {
                    self.recovery_queue.send(action.clone())?;
                }
            }
            RecoveryStrategy::Critical { actions } => {
                for action in actions {
                    self.recovery_queue.send(action.clone())?;
                }
            }
        }
        Ok(())
    }

    /// 执行重试操作
    pub async fn retry_with_backoff<F, T, E>(&self, mut operation: F) -> Result<T>
    where
        F: FnMut() -> Result<T, E>,
        E: std::fmt::Display,
    {
        let mut delay = self.retry_config.initial_delay;
        let mut last_error = None;

        for attempt in 1..=self.retry_config.max_retries {
            match operation() {
                Ok(result) => {
                    if attempt > 1 {
                        info!("Operation succeeded on attempt {}", attempt);
                    }
                    return Ok(result);
                }
                Err(e) => {
                    warn!("Operation failed on attempt {}: {}", attempt, e);
                    last_error = Some(format!("{}", e));

                    if attempt < self.retry_config.max_retries {
                        // 添加抖动以避免雷群效应
                        let actual_delay = if self.retry_config.jitter {
                            let jitter = rand::random::<f64>() * 0.1; // ±10% jitter
                            Duration::from_millis(
                                (delay.as_millis() as f64 * (1.0 + jitter)) as u64
                            )
                        } else {
                            delay
                        };

                        debug!("Waiting {:?} before retry attempt {}", actual_delay, attempt + 1);
                        tokio::time::sleep(actual_delay).await;

                        // 指数退避
                        delay = std::cmp::min(
                            Duration::from_millis(
                                (delay.as_millis() as f64 * self.retry_config.backoff_multiplier) as u64
                            ),
                            self.retry_config.max_delay,
                        );
                    }
                }
            }
        }

        Err(anyhow::anyhow!(
            "Operation failed after {} attempts. Last error: {}",
            self.retry_config.max_retries,
            last_error.unwrap_or_else(|| "Unknown error".to_string())
        ))
    }

    /// 获取错误统计信息
    pub async fn get_error_stats(&self) -> ErrorStats {
        self.error_stats.read().await.clone()
    }

    /// 重置错误统计
    pub async fn reset_error_stats(&self) {
        let mut stats = self.error_stats.write().await;
        *stats = ErrorStats::default();
        info!("Error statistics reset");
    }
}

#[derive(Debug, Clone)]
pub enum RecoveryStrategy {
    Simple {
        action: RecoveryAction,
        retry_config: RetryConfig,
    },
    Escalated {
        actions: Vec<RecoveryAction>,
        retry_config: RetryConfig,
    },
    Critical {
        actions: Vec<RecoveryAction>,
    },
}

/// 健康检查器
pub struct HealthChecker {
    check_interval: Duration,
    health_threshold: f64,
}

impl HealthChecker {
    pub fn new(check_interval: Duration, health_threshold: f64) -> Self {
        Self {
            check_interval,
            health_threshold,
        }
    }

    pub async fn start_health_monitoring(&self, error_manager: Arc<ErrorRecoveryManager>) {
        let mut interval = tokio::time::interval(self.check_interval);

        loop {
            interval.tick().await;

            let stats = error_manager.get_error_stats().await;
            let health_score = self.calculate_health_score(&stats);

            debug!("System health score: {:.2}", health_score);

            if health_score < self.health_threshold {
                warn!("System health below threshold: {:.2} < {:.2}", health_score, self.health_threshold);
                
                // 触发预防性恢复操作
                if let Err(e) = error_manager.recovery_queue.send(RecoveryAction::ClearBuffers) {
                    error!("Failed to send preventive recovery action: {}", e);
                }
            }
        }
    }

    fn calculate_health_score(&self, stats: &ErrorStats) -> f64 {
        if stats.total_errors == 0 {
            return 1.0;
        }

        // 简化的健康评分算法
        let error_factor = 1.0 - (stats.error_rate / 10.0).min(1.0);
        let recency_factor = if let Some(last_error) = stats.last_error_time {
            let minutes_since = last_error.elapsed().as_secs() as f64 / 60.0;
            (minutes_since / 10.0).min(1.0) // 10分钟后完全恢复
        } else {
            1.0
        };

        (error_factor * 0.7 + recency_factor * 0.3).max(0.0).min(1.0)
    }
}