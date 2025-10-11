use anyhow::Result;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::info;

use crate::local_webshare::LocalWebShareManager;
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
    terminals: Arc<RwLock<HashMap<String, LocalTerminalInfo>>>,
    /// WebShare管理器
    webshare_manager: Arc<LocalWebShareManager>,
    /// P2P网络
    p2p_network: Option<P2PNetwork>,
    /// 当前会话ID
    current_session_id: Arc<RwLock<Option<String>>>,
    /// Gossip发送器
    gossip_sender: Arc<RwLock<Option<GossipSender>>>,
}

impl Clone for LocalTerminalManager {
    fn clone(&self) -> Self {
        Self {
            terminals: Arc::clone(&self.terminals),
            webshare_manager: Arc::clone(&self.webshare_manager),
            p2p_network: self.p2p_network.clone(),
            current_session_id: Arc::clone(&self.current_session_id),
            gossip_sender: Arc::clone(&self.gossip_sender),
        }
    }
}

impl LocalTerminalManager {
    pub fn new() -> Self {
        Self {
            terminals: Arc::new(RwLock::new(HashMap::new())),
            webshare_manager: Arc::new(LocalWebShareManager::new()),
            p2p_network: None,
            current_session_id: Arc::new(RwLock::new(None)),
            gossip_sender: Arc::new(RwLock::new(None)),
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

    /// 为终端创建WebShare
    pub async fn create_terminal_webshare(
        &self,
        terminal_id: &str,
        local_port: u16,
        public_port: Option<u16>,
        service_name: String,
    ) -> Result<u16> {
        // 验证终端存在
        if !self.terminals.read().await.contains_key(terminal_id) {
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
            let mut terminals = self.terminals.write().await;
            if let Some(info) = terminals.get_mut(terminal_id) {
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
        let terminals = self.terminals.read().await;
        let total = terminals.len();
        let running = terminals
            .values()
            .filter(|info| info.status == TerminalStatus::Running)
            .count();
        let errors = terminals
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
}
