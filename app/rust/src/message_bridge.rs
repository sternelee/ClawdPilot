//! 基于消息协议的Flutter桥接
//!
//! 此模块提供Flutter FFI桥接，允许App通过统一消息协议
//! 向CLI发送终端管理和TCP转发指令。

// Legacy bridge generation - not needed
use anyhow::Result;
use flutter_rust_bridge::frb;
use riterm_shared::{
    CommunicationManager, MessageBuilder, QuicMessageClient, QuicMessageHandler,
    TcpForwardingAction, TerminalAction,
};
// Re-export for generated code
pub use riterm_shared::TcpForwardingType;

use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{debug, info};

/// Flutter消息客户端
pub struct FlutterMessageClient {
    communication_manager: Option<Arc<CommunicationManager>>,
    quic_client: Option<QuicMessageClient>,
    server_connections: Arc<RwLock<HashMap<String, String>>>, // session_id -> connection_id
    active_sessions: Arc<RwLock<HashMap<String, FlutterSession>>>,
}

impl std::fmt::Debug for FlutterMessageClient {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("FlutterMessageClient")
            .field(
                "communication_manager",
                &self.communication_manager.is_some(),
            )
            .field("quic_client", &self.quic_client.is_some())
            .field("server_connections", &"...")
            .field("active_sessions", &"...")
            .finish()
    }
}

/// Flutter会话信息
#[derive(Debug, Clone)]
pub struct FlutterSession {
    pub id: String,
    pub node_id: String,
    pub endpoint_addr: String,
    pub connection_id: String,
    pub created_at: u64,
    pub session_type: FlutterSessionType,
}

/// Flutter会话类型
#[derive(Debug, Clone, PartialEq)]
pub enum FlutterSessionType {
    Terminal,
    TcpForwarding,
    SystemControl,
}

impl Default for FlutterMessageClient {
    fn default() -> Self {
        Self::new()
    }
}

impl FlutterMessageClient {
    pub fn new() -> Self {
        Self {
            communication_manager: None,
            quic_client: None,
            server_connections: Arc::new(RwLock::new(HashMap::new())),
            active_sessions: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// 初始化通信管理器和QUIC客户端
    async fn ensure_initialized(&mut self, relay_url: Option<String>) -> Result<()> {
        if self.communication_manager.is_none() {
            // 创建通信管理器
            let comm_manager = Arc::new(CommunicationManager::new(format!(
                "flutter_app_{}",
                uuid::Uuid::new_v4()
            )));

            // 初始化通信管理器
            comm_manager.initialize().await?;

            // 注册消息处理器
            let handler = Arc::new(QuicMessageHandler::new("flutter_handler".to_string()));
            comm_manager.register_message_handler(handler).await;

            // 创建QUIC客户端
            let quic_client = QuicMessageClient::new(relay_url, comm_manager.clone()).await?;

            self.communication_manager = Some(comm_manager);
            self.quic_client = Some(quic_client);
        }
        Ok(())
    }
}

// Flutter FFI函数

#[frb(sync)]
pub fn create_message_client() -> FlutterMessageClient {
    FlutterMessageClient::new()
}

#[frb]
pub async fn connect_to_cli_server(
    mut client: FlutterMessageClient,
    endpoint_addr_str: String,
    relay_url: Option<String>,
) -> Result<String> {
    info!("=== Connect to CLI Server Start ===");
    info!("Endpoint address string: {}", endpoint_addr_str);
    info!("Relay URL: {:?}", relay_url);

    // 确保客户端已初始化
    info!("Initializing client...");
    client.ensure_initialized(relay_url.clone()).await?;
    info!("Client initialized successfully");

    // 尝试解析 endpoint_addr_str
    // 可能的格式：
    // 1. Node ID (hex string)
    // 2. EndpointAddr (iroh format)
    // 3. IP:Port (legacy format)
    
    info!("Parsing endpoint address...");
    
    // 尝试作为 Node ID 解析
    use iroh::PublicKey;
    use std::str::FromStr;
    
    let node_id = PublicKey::from_str(&endpoint_addr_str)
        .map_err(|e| {
            tracing::error!("Failed to parse as node ID: {}", e);
            anyhow::anyhow!("Invalid endpoint address format. Expected node ID (hex string): {}", e)
        })?;
    
    info!("Parsed as node ID: {:?}", node_id);
    
    // 使用 connect_by_node_id 建立连接
    connect_by_node_id(client, endpoint_addr_str, relay_url).await
}

#[frb]
pub async fn create_remote_terminal(
    mut client: FlutterMessageClient,
    session_id: String,
    name: Option<String>,
    shell_path: Option<String>,
    working_dir: Option<String>,
    rows: u16,
    cols: u16,
) -> Result<String> {
    info!(
        "Flutter: Creating remote terminal in session: {}",
        session_id
    );

    // 确保连接存在
    let connections = client.server_connections.read().await;
    let connection_id = connections
        .get(&session_id)
        .ok_or_else(|| anyhow::anyhow!("Session not found: {}", session_id))?;

    // 创建终端管理消息
    let action = TerminalAction::Create {
        name,
        shell_path,
        working_dir,
        size: (rows, cols),
    };

    let message = MessageBuilder::terminal_management(
        format!("flutter_app_{}", uuid::Uuid::new_v4()),
        action,
        Some(format!("req_{}", uuid::Uuid::new_v4())),
    )
    .with_receiver(connection_id.clone());

    // 发送消息
    if let Some(quic_client) = &mut client.quic_client {
        quic_client
            .send_message_to_server(connection_id, message)
            .await
            .map_err(|e| anyhow::anyhow!("Failed to send terminal creation request: {}", e))?;
    }

    // 暂时返回一个终端ID，实际应该在响应中获取
    let terminal_id = format!("term_{}", uuid::Uuid::new_v4());
    info!(
        "Flutter: Terminal creation request sent, terminal_id: {}",
        terminal_id
    );

    Ok(terminal_id)
}

#[frb]
pub async fn send_terminal_input(
    mut client: FlutterMessageClient,
    session_id: String,
    terminal_id: String,
    input: String,
) -> Result<()> {
    debug!(
        "Flutter: Sending input to terminal {}: {} bytes",
        terminal_id,
        input.len()
    );

    // 确保连接存在
    let connections = client.server_connections.read().await;
    let connection_id = connections
        .get(&session_id)
        .ok_or_else(|| anyhow::anyhow!("Session not found: {}", session_id))?;

    // 创建终端I/O消息
    let message = MessageBuilder::terminal_io(
        format!("flutter_app_{}", uuid::Uuid::new_v4()),
        terminal_id,
        riterm_shared::IODataType::Input,
        input.into_bytes(),
    )
    .with_receiver(connection_id.clone());

    // 发送消息
    if let Some(quic_client) = &mut client.quic_client {
        quic_client
            .send_message_to_server(connection_id, message)
            .await
            .map_err(|e| anyhow::anyhow!("Failed to send terminal input: {}", e))?;
    }

    Ok(())
}

#[frb]
pub async fn resize_remote_terminal(
    mut client: FlutterMessageClient,
    session_id: String,
    terminal_id: String,
    rows: u16,
    cols: u16,
) -> Result<()> {
    debug!(
        "Flutter: Resizing remote terminal {} to {}x{}",
        terminal_id, rows, cols
    );

    // 确保连接存在
    let connections = client.server_connections.read().await;
    let connection_id = connections
        .get(&session_id)
        .ok_or_else(|| anyhow::anyhow!("Session not found: {}", session_id))?;

    // 创建终端管理消息
    let action = TerminalAction::Resize {
        terminal_id,
        rows,
        cols,
    };

    let message = MessageBuilder::terminal_management(
        format!("flutter_app_{}", uuid::Uuid::new_v4()),
        action,
        Some(format!("req_{}", uuid::Uuid::new_v4())),
    )
    .with_receiver(connection_id.clone());

    // 发送消息
    if let Some(quic_client) = &mut client.quic_client {
        quic_client
            .send_message_to_server(connection_id, message)
            .await
            .map_err(|e| anyhow::anyhow!("Failed to send resize request: {}", e))?;
    }

    Ok(())
}

#[frb]
pub async fn stop_remote_terminal(
    mut client: FlutterMessageClient,
    session_id: String,
    terminal_id: String,
) -> Result<()> {
    info!("Flutter: Stopping remote terminal: {}", terminal_id);

    // 确保连接存在
    let connections = client.server_connections.read().await;
    let connection_id = connections
        .get(&session_id)
        .ok_or_else(|| anyhow::anyhow!("Session not found: {}", session_id))?;

    // 创建终端管理消息
    let action = TerminalAction::Stop { terminal_id };

    let message = MessageBuilder::terminal_management(
        format!("flutter_app_{}", uuid::Uuid::new_v4()),
        action,
        Some(format!("req_{}", uuid::Uuid::new_v4())),
    )
    .with_receiver(connection_id.clone());

    // 发送消息
    if let Some(quic_client) = &mut client.quic_client {
        quic_client
            .send_message_to_server(connection_id, message)
            .await
            .map_err(|e| anyhow::anyhow!("Failed to send stop request: {}", e))?;
    }

    Ok(())
}

#[frb]
pub async fn create_tcp_forwarding_session(
    mut client: FlutterMessageClient,
    session_id: String,
    local_addr: String,
    remote_host: Option<String>,
    remote_port: Option<u16>,
    forwarding_type: String, // "ListenToRemote" or "ConnectToRemote"
) -> Result<String> {
    info!(
        "Flutter: Creating TCP forwarding session in session: {}",
        session_id
    );

    // 解析转发类型
    let forwarding_type = match forwarding_type.as_str() {
        "ListenToRemote" => TcpForwardingType::ListenToRemote,
        "ConnectToRemote" => TcpForwardingType::ConnectToRemote,
        _ => {
            return Err(anyhow::anyhow!(
                "Invalid forwarding type: {}",
                forwarding_type
            ))
        }
    };

    // 确保连接存在
    let connections = client.server_connections.read().await;
    let connection_id = connections
        .get(&session_id)
        .ok_or_else(|| anyhow::anyhow!("Session not found: {}", session_id))?;

    // 创建TCP转发消息
    let action = TcpForwardingAction::CreateSession {
        local_addr,
        remote_host,
        remote_port,
        forwarding_type,
    };

    let message = MessageBuilder::tcp_forwarding(
        format!("flutter_app_{}", uuid::Uuid::new_v4()),
        action,
        Some(format!("req_{}", uuid::Uuid::new_v4())),
    )
    .with_receiver(connection_id.clone());

    // 发送消息
    if let Some(quic_client) = &mut client.quic_client {
        quic_client
            .send_message_to_server(connection_id, message)
            .await
            .map_err(|e| anyhow::anyhow!("Failed to send TCP forwarding request: {}", e))?;
    }

    // 暂时返回一个会话ID
    let tcp_session_id = format!("tcp_session_{}", uuid::Uuid::new_v4());
    info!(
        "Flutter: TCP forwarding session creation request sent, session_id: {}",
        tcp_session_id
    );

    Ok(tcp_session_id)
}

#[frb]
pub async fn stop_tcp_forwarding_session(
    mut client: FlutterMessageClient,
    session_id: String,
    tcp_session_id: String,
) -> Result<()> {
    info!(
        "Flutter: Stopping TCP forwarding session: {}",
        tcp_session_id
    );

    // 确保连接存在
    let connections = client.server_connections.read().await;
    let connection_id = connections
        .get(&session_id)
        .ok_or_else(|| anyhow::anyhow!("Session not found: {}", session_id))?;

    // 创建TCP转发消息
    let action = TcpForwardingAction::StopSession {
        session_id: tcp_session_id,
    };

    let message = MessageBuilder::tcp_forwarding(
        format!("flutter_app_{}", uuid::Uuid::new_v4()),
        action,
        Some(format!("req_{}", uuid::Uuid::new_v4())),
    )
    .with_receiver(connection_id.clone());

    // 发送消息
    if let Some(quic_client) = &mut client.quic_client {
        quic_client
            .send_message_to_server(connection_id, message)
            .await
            .map_err(|e| anyhow::anyhow!("Failed to send TCP stop request: {}", e))?;
    }

    Ok(())
}

#[frb]
pub async fn list_remote_terminals(
    mut client: FlutterMessageClient,
    session_id: String,
) -> Result<Vec<FlutterRemoteTerminal>> {
    info!(
        "Flutter: Listing remote terminals in session: {}",
        session_id
    );

    // 确保连接存在
    let connections = client.server_connections.read().await;
    let connection_id = connections
        .get(&session_id)
        .ok_or_else(|| anyhow::anyhow!("Session not found: {}", session_id))?;

    // 创建终端管理消息
    let action = TerminalAction::List;

    let message = MessageBuilder::terminal_management(
        format!("flutter_app_{}", uuid::Uuid::new_v4()),
        action,
        Some(format!("req_{}", uuid::Uuid::new_v4())),
    )
    .with_receiver(connection_id.clone());

    // 发送消息
    if let Some(quic_client) = &mut client.quic_client {
        quic_client
            .send_message_to_server(connection_id, message)
            .await
            .map_err(|e| anyhow::anyhow!("Failed to send list request: {}", e))?;
    }

    // 暂时返回空列表，实际应该等待响应
    Ok(vec![])
}

#[frb]
pub async fn disconnect_from_cli_server(
    mut client: FlutterMessageClient,
    session_id: String,
) -> Result<()> {
    info!(
        "Flutter: Disconnecting from CLI server, session: {}",
        session_id
    );

    // 获取连接ID并断开连接
    let connection_id = {
        let mut connections = client.server_connections.write().await;
        connections.remove(&session_id)
    };

    if let Some(conn_id) = connection_id {
        if let Some(quic_client) = &mut client.quic_client {
            quic_client
                .disconnect_from_server(&conn_id)
                .await
                .map_err(|e| anyhow::anyhow!("Failed to disconnect: {}", e))?;
        }
    }

    // 移除会话
    {
        let mut sessions = client.active_sessions.write().await;
        sessions.remove(&session_id);
    }

    info!("Flutter: Disconnected from CLI server");
    Ok(())
}

#[frb]
pub async fn get_active_sessions(client: FlutterMessageClient) -> Result<Vec<FlutterSession>> {
    let sessions = client.active_sessions.read().await;
    let session_list = sessions.values().cloned().collect();
    Ok(session_list)
}

/// Flutter远程终端信息
#[derive(Debug, Clone)]
pub struct FlutterRemoteTerminal {
    pub id: String,
    pub name: Option<String>,
    pub shell_type: String,
    pub current_dir: String,
    pub size: (u16, u16),
    pub running: bool,
    pub created_at: u64,
}

/// Flutter TCP转发会话信息
#[derive(Debug, Clone)]
pub struct FlutterTcpForwardingSession {
    pub id: String,
    pub local_addr: String,
    pub remote_endpoint: String,
    pub forwarding_type: String,
    pub active_connections: u32,
    pub bytes_sent: u64,
    pub bytes_received: u64,
    pub created_at: u64,
}

#[frb]
pub async fn get_tcp_forwarding_sessions(
    mut client: FlutterMessageClient,
    session_id: String,
) -> Result<Vec<FlutterTcpForwardingSession>> {
    info!(
        "Flutter: Getting TCP forwarding sessions in session: {}",
        session_id
    );

    // 确保连接存在
    let connections = client.server_connections.read().await;
    let connection_id = connections
        .get(&session_id)
        .ok_or_else(|| anyhow::anyhow!("Session not found: {}", session_id))?;

    // 创建TCP转发消息
    let action = TcpForwardingAction::ListSessions;

    let message = MessageBuilder::tcp_forwarding(
        format!("flutter_app_{}", uuid::Uuid::new_v4()),
        action,
        Some(format!("req_{}", uuid::Uuid::new_v4())),
    )
    .with_receiver(connection_id.clone());

    // 发送消息
    if let Some(quic_client) = &mut client.quic_client {
        quic_client
            .send_message_to_server(connection_id, message)
            .await
            .map_err(|e| anyhow::anyhow!("Failed to send list request: {}", e))?;
    }

    // 暂时返回空列表，实际应该等待响应
    Ok(vec![])
}

/// 系统控制功能
#[frb]
pub async fn get_system_status(
    mut client: FlutterMessageClient,
    session_id: String,
) -> Result<FlutterSystemStatus> {
    info!("Flutter: Getting system status in session: {}", session_id);

    // 确保连接存在
    let connections = client.server_connections.read().await;
    let connection_id = connections
        .get(&session_id)
        .ok_or_else(|| anyhow::anyhow!("Session not found: {}", session_id))?;

    // 创建系统控制消息
    let action = riterm_shared::SystemAction::GetStatus;

    let message = MessageBuilder::system_control(
        format!("flutter_app_{}", uuid::Uuid::new_v4()),
        action,
        Some(format!("req_{}", uuid::Uuid::new_v4())),
    )
    .with_receiver(connection_id.clone());

    // 发送消息
    if let Some(quic_client) = &mut client.quic_client {
        quic_client
            .send_message_to_server(connection_id, message)
            .await
            .map_err(|e| anyhow::anyhow!("Failed to send status request: {}", e))?;
    }

    // 暂时返回默认状态
    Ok(FlutterSystemStatus {
        status: "running".to_string(),
        uptime: 0,
        active_terminals: 0,
        active_tcp_sessions: 0,
        memory_usage: 0,
    })
}

/// Flutter系统状态信息
#[derive(Debug, Clone)]
pub struct FlutterSystemStatus {
    pub status: String,
    pub uptime: u64,
    pub active_terminals: u32,
    pub active_tcp_sessions: u32,
    pub memory_usage: u64,
}

/// 工具函数

#[frb(sync)]
pub fn parse_endpoint_addr(addr: String) -> Result<String> {
    // 验证端点地址格式
    if addr.is_empty() {
        return Err(anyhow::anyhow!("Empty endpoint address"));
    }
    Ok(addr)
}

/// 测试 ticket 解析（用于调试）
#[frb(sync)]
pub fn test_ticket_parsing(ticket: String) -> Result<String> {
    info!("=== Testing Ticket Parsing ===");

    if !ticket.starts_with("ticket:") {
        return Err(anyhow::anyhow!(
            "Ticket must start with 'ticket:', got: {}",
            &ticket[..std::cmp::min(20, ticket.len())]
        ));
    }

    let encoded_data = &ticket[7..];
    info!("Encoded data length: {}", encoded_data.len());

    use data_encoding::BASE32;
    match BASE32.decode(encoded_data.as_bytes()) {
        Ok(decoded_data) => {
            info!(
                "✓ Base32 decode successful, decoded length: {}",
                decoded_data.len()
            );

            match serde_json::from_slice::<serde_json::Value>(&decoded_data) {
                Ok(ticket_data) => {
                    let result = serde_json::to_string_pretty(&ticket_data)?;
                    info!("✓ JSON parse successful");
                    info!("Ticket data:\n{}", result);

                    // 验证必需字段
                    if ticket_data.get("node_id").is_some() {
                        info!("✓ node_id field present");
                    } else {
                        return Err(anyhow::anyhow!("✗ Missing node_id field"));
                    }

                    if ticket_data.get("alpn").is_some() {
                        info!("✓ alpn field present");
                    } else {
                        info!("⚠ alpn field missing (will use default)");
                    }

                    Ok(format!("✓ Ticket is valid!\n\n{}", result))
                }
                Err(e) => Err(anyhow::anyhow!(
                    "✗ Failed to parse JSON: {}\nDecoded data (hex): {}",
                    e,
                    hex::encode(&decoded_data)
                )),
            }
        }
        Err(e) => Err(anyhow::anyhow!(
            "✗ Failed to decode Base32: {}\nEncoded data prefix: {}",
            e,
            &encoded_data[..std::cmp::min(50, encoded_data.len())]
        )),
    }
}

/// 解析 iroh 连接票据
#[frb(sync)]
pub fn parse_connection_ticket(ticket: String) -> Result<String> {
    debug!("=== Parsing Connection Ticket ===");
    debug!("Ticket full length: {}", ticket.len());
    debug!(
        "Ticket starts with 'ticket:': {}",
        ticket.starts_with("ticket:")
    );

    // 检查票据格式
    if !ticket.starts_with("ticket:") {
        tracing::error!("Invalid ticket format: does not start with 'ticket:'");
        return Err(anyhow::anyhow!(
            "Invalid ticket format: must start with 'ticket:'"
        ));
    }

    // 移除前缀
    let encoded_data = &ticket[7..];
    debug!("Encoded data length: {}", encoded_data.len());
    debug!(
        "Encoded data prefix: {}",
        &encoded_data[..std::cmp::min(20, encoded_data.len())]
    );

    // Base32 解码
    use data_encoding::BASE32;
    let decoded_data = match BASE32.decode(encoded_data.as_bytes()) {
        Ok(data) => {
            debug!("Base32 decode successful, decoded length: {}", data.len());
            data
        }
        Err(e) => {
            tracing::error!("Failed to decode Base32: {}", e);
            return Err(anyhow::anyhow!(
                "Failed to decode ticket (Base32 error): {}",
                e
            ));
        }
    };

    // 解析 JSON
    let ticket_data: serde_json::Value = match serde_json::from_slice(&decoded_data) {
        Ok(data) => {
            debug!("JSON parse successful");
            debug!(
                "Ticket JSON: {}",
                serde_json::to_string_pretty(&data).unwrap_or_default()
            );
            data
        }
        Err(e) => {
            tracing::error!("Failed to parse JSON: {}", e);
            return Err(anyhow::anyhow!("Failed to parse ticket JSON: {}", e));
        }
    };

    // 验证必要的字段
    let node_id = ticket_data
        .get("node_id")
        .ok_or_else(|| {
            tracing::error!("Missing 'node_id' field in ticket");
            anyhow::anyhow!("Missing node_id in ticket")
        })?
        .as_str()
        .ok_or_else(|| {
            tracing::error!("Invalid 'node_id' format (not a string)");
            anyhow::anyhow!("Invalid node_id format")
        })?;

    let relay_url = ticket_data.get("relay_url").and_then(|v| v.as_str());

    let alpn = ticket_data
        .get("alpn")
        .and_then(|v| v.as_str())
        .unwrap_or("riterm_quic");

    debug!("Node ID: {}", node_id);
    debug!("Relay URL: {:?}", relay_url);
    debug!("ALPN: {}", alpn);

    // 验证 ALPN
    if alpn != "riterm_quic" {
        tracing::error!("Unsupported ALPN: {}", alpn);
        return Err(anyhow::anyhow!("Unsupported ALPN: {}", alpn));
    }

    info!(
        "Ticket parsed successfully - Node ID: {}, Relay: {:?}",
        node_id, relay_url
    );
    debug!("=== Ticket Parsing Complete ===");

    // 返回节点ID用于连接
    Ok(node_id.to_string())
}

/// 使用票据连接到 CLI 服务器
#[frb]
pub async fn connect_by_ticket(mut client: FlutterMessageClient, ticket: String) -> Result<String> {
    info!("=== Connect by Ticket Debug Start ===");
    info!("Ticket length: {}", ticket.len());
    info!(
        "Ticket prefix: {}",
        &ticket[..std::cmp::min(30, ticket.len())]
    );

    // 解析票据
    info!("Step 1: Parsing connection ticket...");
    let node_id_str = match parse_connection_ticket(ticket.clone()) {
        Ok(node_id) => {
            info!("Step 1: Ticket parsed successfully, Node ID: {}", node_id);
            node_id
        }
        Err(e) => {
            tracing::error!("Step 1: Failed to parse ticket: {}", e);
            return Err(anyhow::anyhow!("Failed to parse ticket: {}", e));
        }
    };

    // 确保客户端已初始化
    info!("Step 2: Initializing client...");
    match client.ensure_initialized(None).await {
        Ok(_) => info!("Step 2: Client initialized successfully"),
        Err(e) => {
            tracing::error!("Step 2: Failed to initialize client: {}", e);
            return Err(anyhow::anyhow!("Failed to initialize client: {}", e));
        }
    }

    // 创建连接
    info!("Step 3: Connecting by node ID...");
    let session_id = match connect_by_node_id(client, node_id_str.clone(), None).await {
        Ok(session_id) => {
            info!("Step 3: Connected successfully, session: {}", session_id);
            session_id
        }
        Err(e) => {
            tracing::error!("Step 3: Failed to connect by node ID: {}", e);
            return Err(anyhow::anyhow!("Failed to connect by node ID: {}", e));
        }
    };

    info!("=== Connect by Ticket Debug End (Success) ===");
    info!(
        "Flutter: Connected to CLI server using ticket, session: {}",
        session_id
    );
    Ok(session_id)
}

/// 简化的连接方法 - 使用节点ID直接连接
pub async fn connect_by_node_id(
    mut client: FlutterMessageClient,
    node_id_str: String,
    relay_url: Option<String>,
) -> Result<String> {
    info!("=== Connect by Node ID Start ===");
    info!("Node ID: {}", node_id_str);
    info!("Relay URL: {:?}", relay_url);

    // 确保客户端已初始化
    info!("Ensuring client is initialized...");
    client.ensure_initialized(relay_url.clone()).await?;

    // 解析节点ID
    use iroh::PublicKey;
    use std::str::FromStr;

    info!("Parsing node ID...");
    let node_id = PublicKey::from_str(&node_id_str)
        .map_err(|e| {
            tracing::error!("Failed to parse node ID: {}", e);
            anyhow::anyhow!("Invalid node ID format: {}", e)
        })?;
    info!("Node ID parsed successfully: {:?}", node_id);

    // 获取 quic_client 的可变引用
    let quic_client = client.quic_client.as_mut()
        .ok_or_else(|| anyhow::anyhow!("QUIC client not initialized"))?;

    // 构建 EndpointAddr
    info!("Building endpoint address...");
    
    // 使用 PublicKey 直接构建 EndpointAddr
    // iroh 0.94 中，EndpointAddr 可以从 PublicKey 构建
    if let Some(relay) = &relay_url {
        info!("Using relay URL: {}", relay);
        info!("Note: Relay URL support may require additional configuration");
    } else {
        info!("No relay URL, using direct connection");
    }
    
    // 直接从 PublicKey 创建 EndpointAddr
    let endpoint_addr = iroh::EndpointAddr::from(node_id);
    info!("Endpoint address built: {:?}", endpoint_addr);

    // 建立真实的 QUIC 连接
    info!("Establishing QUIC connection...");
    info!("Using ALPN: {:?}", riterm_shared::QUIC_MESSAGE_ALPN);
    
    let connection_result = tokio::time::timeout(
        std::time::Duration::from_secs(30),
        quic_client.connect_to_server(&endpoint_addr)
    ).await;

    let connection_id = match connection_result {
        Ok(Ok(conn_id)) => {
            info!("✓ QUIC connection established successfully!");
            info!("Connection ID: {}", conn_id);
            conn_id
        }
        Ok(Err(e)) => {
            tracing::error!("✗ Failed to establish QUIC connection: {}", e);
            return Err(anyhow::anyhow!("Failed to connect to server: {}", e));
        }
        Err(_) => {
            tracing::error!("✗ Connection timeout after 30 seconds");
            return Err(anyhow::anyhow!("Connection timeout: server did not respond within 30 seconds"));
        }
    };

    // 创建会话
    let session_id = format!("session_{}", uuid::Uuid::new_v4());
    let client_node_id = format!("{:?}", quic_client.get_node_id());

    info!("Creating session...");
    let session = FlutterSession {
        id: session_id.clone(),
        node_id: client_node_id,
        endpoint_addr: node_id_str.clone(),
        connection_id: connection_id.clone(),
        created_at: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs(),
        session_type: FlutterSessionType::Terminal,
    };

    // 存储连接和会话
    info!("Storing connection and session...");
    {
        let mut connections = client.server_connections.write().await;
        connections.insert(session_id.clone(), connection_id.clone());
        info!("Connection stored: {} -> {}", session_id, connection_id);
    }

    {
        let mut sessions = client.active_sessions.write().await;
        sessions.insert(session_id.clone(), session.clone());
        info!("Session stored: {}", session_id);
    }

    info!("=== Connect by Node ID Complete ===");
    info!("✓ Successfully connected to CLI server!");
    info!("Session ID: {}", session_id);
    info!("Connection ID: {}", connection_id);
    info!("Node ID: {}", node_id_str);
    
    Ok(session_id)
}

/// 通过节点ID和中继URL构造 EndpointAddr
#[frb(sync)]
pub fn construct_endpoint_addr_from_node_info(
    node_id_hex: String,
    relay_url: Option<String>,
) -> Result<String> {
    use iroh::PublicKey;
    use std::str::FromStr;

    // 解析节点ID
    let node_id =
        PublicKey::from_str(&node_id_hex).map_err(|e| anyhow::anyhow!("Invalid node ID: {}", e))?;

    // 构造地址字符串
    let addr_str = if let Some(relay) = relay_url {
        format!("{:?}@{}", node_id, relay)
    } else {
        format!("{:?}", node_id)
    };

    Ok(addr_str)
}

#[frb(sync)]
pub fn format_forwarding_type(forwarding_type: TcpForwardingType) -> String {
    match forwarding_type {
        TcpForwardingType::ListenToRemote => "ListenToRemote".to_string(),
        TcpForwardingType::ConnectToRemote => "ConnectToRemote".to_string(),
    }
}

#[frb(sync)]
pub fn validate_terminal_size(rows: u16, cols: u16) -> Result<()> {
    if rows < 10 || rows > 200 {
        return Err(anyhow::anyhow!("Rows must be between 10 and 200"));
    }
    if cols < 40 || cols > 500 {
        return Err(anyhow::anyhow!("Columns must be between 40 and 500"));
    }
    Ok(())
}

/// 错误处理
#[derive(Debug, Clone)]
pub struct FlutterMessageError {
    pub code: i32,
    pub message: String,
    pub details: Option<String>,
}

impl From<anyhow::Error> for FlutterMessageError {
    fn from(error: anyhow::Error) -> Self {
        Self {
            code: -1,
            message: error.to_string(),
            details: Some(format!("{:?}", error)),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_client_creation() {
        let client = FlutterMessageClient::new();
        assert!(client.communication_manager.is_none());
        assert!(client.quic_client.is_none());
    }

    #[test]
    fn test_session_type() {
        assert_eq!(FlutterSessionType::Terminal, FlutterSessionType::Terminal);
        assert_ne!(
            FlutterSessionType::Terminal,
            FlutterSessionType::TcpForwarding
        );
    }

    #[tokio::test]
    async fn test_endpoint_validation() {
        assert!(parse_endpoint_addr("valid_addr".to_string()).is_ok());
        assert!(parse_endpoint_addr("".to_string()).is_err());
    }

    #[test]
    fn test_terminal_size_validation() {
        assert!(validate_terminal_size(24, 80).is_ok());
        assert!(validate_terminal_size(5, 80).is_err()); // Too few rows
        assert!(validate_terminal_size(24, 20).is_err()); // Too few columns
        assert!(validate_terminal_size(300, 80).is_err()); // Too many rows
    }
}

