use anyhow::{Context, Result};
use portable_pty::{CommandBuilder, PtySize, native_pty_system};
use std::io::{Read, Write};
use std::sync::Arc;
use tokio::sync::Semaphore;
use tracing::{debug, error, info, warn};

/// RAII 资源管理器，确保终端资源正确清理
pub struct TerminalResourceManager {
    /// PTY 资源
    pty_resources: Option<PtyResources>,
    /// 子进程句柄
    child: Option<Box<dyn portable_pty::Child + Send + Sync>>,
    /// 资源信号量，限制并发终端数量
    _resource_permit: tokio::sync::SemaphorePermit<'static>,
}

struct PtyResources {
    reader: Box<dyn Read + Send>,
    writer: Box<dyn Write + Send>,
    _pty_pair: portable_pty::PtyPair,
}

/// 全局资源池，限制系统资源使用
pub struct ResourcePool {
    /// 限制同时运行的终端数量
    terminal_semaphore: Arc<Semaphore>,
    /// 限制内存使用的信号量
    memory_semaphore: Arc<Semaphore>,
}

impl ResourcePool {
    pub fn new(max_terminals: usize, max_memory_mb: usize) -> Self {
        Self {
            terminal_semaphore: Arc::new(Semaphore::new(max_terminals)),
            memory_semaphore: Arc::new(Semaphore::new(max_memory_mb)),
        }
    }

    pub async fn acquire_terminal(&self) -> Result<tokio::sync::SemaphorePermit<'_>> {
        self.terminal_semaphore
            .acquire()
            .await
            .map_err(|_| anyhow::anyhow!("Failed to acquire terminal resource"))
    }

    pub async fn acquire_memory(&self, mb: usize) -> Result<tokio::sync::SemaphorePermit<'_>> {
        self.memory_semaphore
            .acquire_many(mb as u32)
            .await
            .map_err(|_| anyhow::anyhow!("Failed to acquire memory resource"))
    }
}

impl TerminalResourceManager {
    pub async fn new(
        shell_command: &str,
        shell_args: &[String],
        width: u16,
        height: u16,
        env_vars: &[(String, String)],
        resource_pool: &ResourcePool,
    ) -> Result<Self> {
        // 获取资源许可
        let resource_permit = resource_pool.acquire_terminal().await?;

        let pty_system = native_pty_system();
        let pty_size = PtySize {
            rows: height,
            cols: width,
            pixel_width: 0,
            pixel_height: 0,
        };

        let pty_pair = pty_system
            .openpty(pty_size)
            .context("Failed to open PTY")?;

        let mut cmd = CommandBuilder::new(shell_command);
        for arg in shell_args {
            cmd.arg(arg);
        }

        // 设置环境变量
        for (key, value) in env_vars {
            cmd.env(key, value);
        }

        let child = pty_pair
            .slave
            .spawn_command(cmd)
            .context("Failed to spawn command")?;

        let reader = pty_pair.master.try_clone_reader()?;
        let writer = pty_pair.master.take_writer()?;

        let pty_resources = PtyResources {
            reader,
            writer,
            _pty_pair: pty_pair,
        };

        info!("Terminal resource manager created successfully");

        Ok(Self {
            pty_resources: Some(pty_resources),
            child: Some(child),
            _resource_permit: resource_permit,
        })
    }

    pub fn get_reader(&mut self) -> Result<&mut dyn Read> {
        self.pty_resources
            .as_mut()
            .map(|r| r.reader.as_mut())
            .ok_or_else(|| anyhow::anyhow!("PTY resources not available"))
    }

    pub fn get_writer(&mut self) -> Result<&mut dyn Write> {
        self.pty_resources
            .as_mut()
            .map(|r| r.writer.as_mut())
            .ok_or_else(|| anyhow::anyhow!("PTY resources not available"))
    }

    pub async fn wait_for_exit(&mut self) -> Result<()> {
        if let Some(mut child) = self.child.take() {
            match child.wait() {
                Ok(status) => {
                    info!("Child process exited with status: {:?}", status);
                    Ok(())
                }
                Err(e) => {
                    error!("Failed to wait for child process: {}", e);
                    Err(e.into())
                }
            }
        } else {
            Ok(())
        }
    }

    /// 优雅关闭终端
    pub async fn shutdown(&mut self) -> Result<()> {
        debug!("Shutting down terminal resource manager");

        // 首先尝试优雅关闭子进程
        if let Some(mut child) = self.child.take() {
            // 给子进程一些时间来清理
            let shutdown_timeout = tokio::time::Duration::from_secs(5);
            
            match tokio::time::timeout(shutdown_timeout, async {
                child.wait()
            }).await {
                Ok(Ok(status)) => {
                    info!("Child process exited gracefully with status: {:?}", status);
                }
                Ok(Err(e)) => {
                    warn!("Error waiting for child process: {}", e);
                }
                Err(_) => {
                    warn!("Child process did not exit within timeout, may need force kill");
                    // 在实际实现中，这里可以发送 SIGTERM 然后 SIGKILL
                }
            }
        }

        // 清理 PTY 资源
        if let Some(_pty_resources) = self.pty_resources.take() {
            debug!("PTY resources cleaned up");
        }

        info!("Terminal resource manager shutdown complete");
        Ok(())
    }
}

impl Drop for TerminalResourceManager {
    fn drop(&mut self) {
        debug!("TerminalResourceManager dropping");
        
        // 确保资源被清理
        if self.child.is_some() || self.pty_resources.is_some() {
            warn!("Resources not properly cleaned up before drop");
        }
    }
}

/// 内存使用监控器
pub struct MemoryMonitor {
    max_memory_mb: usize,
    check_interval: tokio::time::Duration,
}

impl MemoryMonitor {
    pub fn new(max_memory_mb: usize) -> Self {
        Self {
            max_memory_mb,
            check_interval: tokio::time::Duration::from_secs(30),
        }
    }

    pub async fn start_monitoring(&self) {
        let mut interval = tokio::time::interval(self.check_interval);
        
        loop {
            interval.tick().await;
            
            if let Ok(memory_usage) = self.get_memory_usage().await {
                if memory_usage > self.max_memory_mb {
                    warn!(
                        "Memory usage ({} MB) exceeds limit ({} MB)",
                        memory_usage, self.max_memory_mb
                    );
                    
                    // 触发垃圾回收或其他清理操作
                    self.trigger_cleanup().await;
                }
            }
        }
    }

    async fn get_memory_usage(&self) -> Result<usize> {
        // 在实际实现中，这里应该获取进程的实际内存使用情况
        // 可以使用 procfs 或系统调用
        Ok(0) // 占位符
    }

    async fn trigger_cleanup(&self) {
        debug!("Triggering memory cleanup");
        // 实现内存清理逻辑
        // 例如：清理旧的事件缓冲区、压缩日志等
    }
}