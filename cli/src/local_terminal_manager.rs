use anyhow::{Context, Result};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{RwLock, mpsc};
use tracing::{debug, error, info, warn};

use crate::local_webshare::LocalWebShareManager;
use crate::shell::ShellConfig;
use crate::terminal_session::{TerminalCommand, TerminalSession};
use riterm_shared::p2p::{
    GossipSender, P2PNetwork, TerminalInfo, TerminalStats, TerminalStatus, WebShareInfo,
    WebShareStats, WebShareStatus,
};

/// 本地终端会话信息
#[derive(Debug, Clone)]
pub struct LocalTerminalInfo {
    pub id: String,
    pub name: Option<String>,
    pub shell_type: String,
    pub current_dir: String,
    pub status: TerminalStatus,
    pub created_at: std::time::SystemTime,
    pub last_activity: std::time::SystemTime,
    pub size: (u16, u16), // (rows, cols)
    pub process_id: Option<u32>,
    pub associated_webshares: Vec<u16>,
}

impl From<LocalTerminalInfo> for TerminalInfo {
    fn from(local: LocalTerminalInfo) -> Self {
        Self {
            id: local.id,
            name: local.name,
            shell_type: local.shell_type,
            current_dir: local.current_dir,
            status: local.status,
            created_at: local
                .created_at
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs(),
            last_activity: local
                .last_activity
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs(),
            size: local.size,
            process_id: local.process_id,
            associated_webshares: local.associated_webshares,
        }
    }
}

impl From<crate::local_webshare::WebShareInfo> for WebShareInfo {
    fn from(local: crate::local_webshare::WebShareInfo) -> Self {
        Self {
            local_port: local.local_port,
            public_port: local.public_port,
            service_name: local.service_name,
            terminal_id: local.terminal_id,
            status: match local.status {
                crate::local_webshare::WebShareStatus::Starting => WebShareStatus::Starting,
                crate::local_webshare::WebShareStatus::Active => WebShareStatus::Active,
                crate::local_webshare::WebShareStatus::Error(msg) => WebShareStatus::Error(msg),
                crate::local_webshare::WebShareStatus::Stopped => WebShareStatus::Stopped,
            },
            created_at: local
                .created_at
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs(),
        }
    }
}

impl From<crate::local_webshare::WebShareStats> for WebShareStats {
    fn from(local: crate::local_webshare::WebShareStats) -> Self {
        Self {
            total: local.total,
            active: local.active,
            errors: local.errors,
            stopped: local.stopped,
        }
    }
}

/// 本地终端管理器
pub struct LocalTerminalManager {
    /// 终端会话存储
    sessions: Arc<RwLock<HashMap<String, TerminalSessionInfo>>>,
    /// WebShare管理器
    webshare_manager: Arc<LocalWebShareManager>,
    /// P2P网络
    p2p_network: Option<P2PNetwork>,
    /// 当前会话ID
    current_session_id: Arc<RwLock<Option<String>>>,
    /// Gossip发送器
    gossip_sender: Arc<RwLock<Option<GossipSender>>>,
    /// 终端输出处理回调
    output_callback: Arc<RwLock<Option<std::sync::Arc<dyn Fn(String, String) + Send + Sync>>>>,
}

/// Information about a terminal session
#[derive(Clone)]
struct TerminalSessionInfo {
    sender: mpsc::Sender<TerminalCommand>,
    name: Option<String>,
    shell_type: String,
    current_dir: String,
    status: TerminalStatus,
    created_at: std::time::SystemTime,
    last_activity: std::time::SystemTime,
    size: (u16, u16),
    process_id: Option<u32>,
    associated_webshares: Vec<u16>,
}

impl Clone for LocalTerminalManager {
    fn clone(&self) -> Self {
        Self {
            sessions: Arc::clone(&self.sessions),
            webshare_manager: Arc::clone(&self.webshare_manager),
            p2p_network: self.p2p_network.clone(),
            current_session_id: Arc::clone(&self.current_session_id),
            gossip_sender: Arc::clone(&self.gossip_sender),
            output_callback: Arc::clone(&self.output_callback),
        }
    }
}

impl LocalTerminalManager {
    pub fn new() -> Self {
        Self {
            sessions: Arc::new(RwLock::new(HashMap::new())),
            webshare_manager: Arc::new(LocalWebShareManager::new()),
            p2p_network: None,
            current_session_id: Arc::new(RwLock::new(None)),
            gossip_sender: Arc::new(RwLock::new(None)),
            output_callback: Arc::new(RwLock::new(None)),
        }
    }

    /// 设置P2P网络和会话信息
    pub async fn set_p2p_session(
        &mut self,
        network: P2PNetwork,
        session_id: String,
        sender: GossipSender,
    ) {
        self.p2p_network = Some(network);
        *self.current_session_id.write().await = Some(session_id);
        *self.gossip_sender.write().await = Some(sender);
    }

    /// 设置终端输出处理回调
    pub async fn set_output_callback<F>(&self, callback: F)
    where
        F: Fn(String, String) + Send + Sync + 'static,
    {
        let mut output_callback = self.output_callback.write().await;
        *output_callback = Some(std::sync::Arc::new(callback));
    }

    /// 为终端创建WebShare
    pub async fn create_terminal_webshare(
        &self,
        terminal_id: &str,
        local_port: u16,
        public_port: Option<u16>,
        service_name: String,
    ) -> Result<u16> {
        // 验证终端存在
        if !self.sessions.read().await.contains_key(terminal_id) {
            return Err(anyhow::anyhow!("Terminal {} not found", terminal_id));
        }

        // 查找可用的公共端口
        let public_port = if let Some(port) = public_port {
            if !self.webshare_manager.is_port_available(port).await {
                return Err(anyhow::anyhow!("Public port {} is already in use", port));
            }
            port
        } else {
            self.webshare_manager
                .find_available_port(8080)
                .await
                .ok_or_else(|| anyhow::anyhow!("No available ports found"))?
        };

        // 创建WebShare
        self.webshare_manager
            .create_webshare(
                local_port,
                public_port,
                service_name,
                Some(terminal_id.to_string()),
            )
            .await?;

        // 更新终端的WebShare列表
        {
            let mut sessions = self.sessions.write().await;
            if let Some(info) = sessions.get_mut(terminal_id) {
                info.associated_webshares.push(public_port);
            }
        }

        info!(
            "Created WebShare for terminal {}: {} → {}",
            terminal_id, public_port, local_port
        );

        Ok(public_port)
    }

    /// 获取WebShare管理器的引用
    pub fn webshare_manager(&self) -> &LocalWebShareManager {
        &self.webshare_manager
    }

    /// 获取终端统计信息
    pub async fn get_stats(&self) -> TerminalStats {
        let sessions = self.sessions.read().await;
        let total = sessions.len();
        let running = sessions
            .values()
            .filter(|info| info.status == TerminalStatus::Running)
            .count();
        let errors = sessions
            .values()
            .filter(|info| matches!(info.status, TerminalStatus::Error(_)))
            .count();

        TerminalStats {
            total,
            running,
            errors,
            stopped: total - running - errors,
        }
    }

    /// 创建新终端
    pub async fn create_terminal(
        &self,
        name: Option<String>,
        shell_path: String,
        working_dir: Option<String>,
        size: Option<(u16, u16)>,
    ) -> Result<String> {
        let terminal_id = format!("term_{}", uuid::Uuid::new_v4().to_string().replace("-", ""));

        info!("Creating new terminal: {}", terminal_id);

        // 获取输出回调
        let output_callback: Option<std::sync::Arc<dyn Fn(String, String) + Send + Sync>> = {
            let callback_guard = self.output_callback.read().await;
            callback_guard.as_ref().cloned()
        };

        // 创建真实的终端会话
        let mut terminal_session = TerminalSession::new(
            terminal_id.clone(),
            name.clone(),
            Some(shell_path.clone()),
            working_dir.clone(),
            size,
        )
        .await?;

        // 设置输出回调
        if let Some(callback) = output_callback {
            info!("🔥 SETTING OUTPUT CALLBACK for terminal {}", terminal_id);
            // Convert Arc<dyn Fn> to a concrete closure by cloning the Arc
            let callback_clone = callback.clone();
            terminal_session.set_output_callback(move |session_id: String, data: String| {
                tracing::info!(
                    "🔥 OUTPUT CALLBACK CALLED: session_id={}, data='{}'",
                    session_id,
                    data
                );
                callback_clone(session_id, data);
            });
        } else {
            warn!(
                "⚠️ NO OUTPUT CALLBACK AVAILABLE when creating terminal {}",
                terminal_id
            );
        }

        // 获取终端信息
        let terminal_info = terminal_session.to_terminal_info();

        // 创建命令通道
        let (command_tx, command_rx) = mpsc::channel(32);

        // 启动终端会话任务
        let session_id_clone = terminal_id.clone();
        tokio::spawn(async move {
            if let Err(e) = terminal_session.run(command_rx).await {
                error!("Terminal session {} failed: {}", session_id_clone, e);
            }
        });

        // 添加到会话列表
        let session_info = TerminalSessionInfo {
            sender: command_tx,
            name: terminal_info.name.clone(),
            shell_type: terminal_info.shell_type.clone(),
            current_dir: terminal_info.current_dir.clone(),
            status: terminal_info.status.clone(),
            created_at: std::time::SystemTime::UNIX_EPOCH
                + std::time::Duration::from_secs(terminal_info.created_at),
            last_activity: std::time::SystemTime::UNIX_EPOCH
                + std::time::Duration::from_secs(terminal_info.last_activity),
            size: terminal_info.size,
            process_id: terminal_info.process_id,
            associated_webshares: terminal_info.associated_webshares,
        };

        {
            let mut sessions = self.sessions.write().await;
            sessions.insert(terminal_id.clone(), session_info);
        }

        info!("Terminal {} created successfully", terminal_id);

        Ok(terminal_id)
    }

    /// 处理来自P2P的终端创建请求
    pub async fn handle_terminal_create_request(
        &self,
        name: Option<String>,
        shell_path: Option<String>,
        working_dir: Option<String>,
        size: Option<(u16, u16)>,
    ) -> Result<String> {
        let shell_path = shell_path.unwrap_or_else(|| "bash".to_string());
        let terminal_id = self
            .create_terminal(name, shell_path, working_dir, size)
            .await?;
        info!("Created terminal via P2P request: {}", terminal_id);
        Ok(terminal_id)
    }

    /// 获取终端列表用于响应
    pub async fn get_terminal_list(&self) -> Vec<TerminalInfo> {
        let sessions = self.sessions.read().await;
        let mut terminal_infos = Vec::new();

        for (session_id, session_info) in sessions.iter() {
            let terminal_info = TerminalInfo {
                id: session_id.clone(),
                name: session_info.name.clone(),
                shell_type: session_info.shell_type.clone(),
                current_dir: session_info.current_dir.clone(),
                status: session_info.status.clone(),
                created_at: session_info
                    .created_at
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_secs(),
                last_activity: session_info
                    .last_activity
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_secs(),
                size: session_info.size,
                process_id: session_info.process_id,
                associated_webshares: session_info.associated_webshares.clone(),
            };
            terminal_infos.push(terminal_info);
        }

        terminal_infos
    }

    /// 关闭终端会话
    pub async fn close_terminal(&self, terminal_id: &str) -> Result<()> {
        let mut sessions = self.sessions.write().await;
        if let Some(session_info) = sessions.remove(terminal_id) {
            // 发送关闭命令
            let _ = session_info.sender.send(TerminalCommand::Close).await;
            info!("Closed terminal: {}", terminal_id);
            Ok(())
        } else {
            Err(anyhow::anyhow!("Terminal {} not found", terminal_id))
        }
    }

    /// 向终端发送输入
    pub async fn send_input(&self, terminal_id: &str, data: Vec<u8>) -> Result<()> {
        info!(
            "🔥 TERMINAL MANAGER SEND_INPUT: terminal_id={}, data={:?}",
            terminal_id,
            String::from_utf8_lossy(&data)
        );
        let sessions = self.sessions.read().await;
        if let Some(session_info) = sessions.get(terminal_id) {
            session_info
                .sender
                .send(TerminalCommand::Input(data))
                .await
                .context("Failed to send input to terminal")?;
            info!(
                "✅ Successfully sent input to terminal session {}",
                terminal_id
            );
            Ok(())
        } else {
            error!(
                "❌ Terminal {} not found in {} sessions",
                terminal_id,
                sessions.len()
            );
            Err(anyhow::anyhow!("Terminal {} not found", terminal_id))
        }
    }

    /// 调整终端大小
    pub async fn resize_terminal(&self, terminal_id: &str, rows: u16, cols: u16) -> Result<()> {
        let sessions = self.sessions.read().await;
        if let Some(session_info) = sessions.get(terminal_id) {
            session_info
                .sender
                .send(TerminalCommand::Resize(rows, cols))
                .await
                .context("Failed to resize terminal")?;
            Ok(())
        } else {
            Err(anyhow::anyhow!("Terminal {} not found", terminal_id))
        }
    }

    /// 重命名终端
    pub async fn rename_terminal(&self, terminal_id: &str, new_name: Option<String>) -> Result<()> {
        let sessions = self.sessions.read().await;
        if let Some(session_info) = sessions.get(terminal_id) {
            session_info
                .sender
                .send(TerminalCommand::Rename(new_name.clone()))
                .await
                .context("Failed to rename terminal")?;

            // 更新本地存储的名称
            drop(sessions);
            let mut sessions = self.sessions.write().await;
            if let Some(session_info) = sessions.get_mut(terminal_id) {
                session_info.name = new_name;
            }
            Ok(())
        } else {
            Err(anyhow::anyhow!("Terminal {} not found", terminal_id))
        }
    }
}
