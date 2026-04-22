//! Minimal message protocol for browser WASM client.
//! Mirrors the wire format from shared/src/message_protocol.rs for bincode compatibility.

use anyhow::Result;
use base64::Engine as _;
use serde::{Deserialize, Serialize};
use std::collections::{BTreeSet, HashMap};
use std::net::SocketAddr;
use std::str::FromStr;

pub const QUIC_MESSAGE_ALPN: &[u8] = b"com.irogen.messages/1";
pub const TCP_STREAM_HANDSHAKE: &[u8] = &[0x00, 0x01, 0x02, 0x03, 0x04];

pub const MESSAGE_PROTOCOL_VERSION: u8 = 2;
pub const MESSAGE_SCHEMA_FINGERPRINT: u64 = 0xa1b2c3d4e5f0_0u64;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[repr(u8)]
pub enum MessageType {
    Heartbeat = 0x01,
    TcpForwarding = 0x04,
    TcpData = 0x05,
    SystemControl = 0x06,
    SystemInfo = 0x09,
    Response = 0x07,
    Error = 0x08,
    AgentSession = 0x10,
    AgentMessage = 0x11,
    AgentPermission = 0x12,
    AgentControl = 0x13,
    AgentMetadata = 0x14,
    FileBrowser = 0x15,
    GitStatus = 0x16,
    RemoteSpawn = 0x17,
    Notification = 0x18,
    SlashCommand = 0x19,
}

impl TryFrom<u8> for MessageType {
    type Error = anyhow::Error;
    fn try_from(value: u8) -> Result<Self> {
        match value {
            0x01 => Ok(MessageType::Heartbeat),
            0x04 => Ok(MessageType::TcpForwarding),
            0x05 => Ok(MessageType::TcpData),
            0x06 => Ok(MessageType::SystemControl),
            0x09 => Ok(MessageType::SystemInfo),
            0x07 => Ok(MessageType::Response),
            0x08 => Ok(MessageType::Error),
            0x10 => Ok(MessageType::AgentSession),
            0x11 => Ok(MessageType::AgentMessage),
            0x12 => Ok(MessageType::AgentPermission),
            0x13 => Ok(MessageType::AgentControl),
            0x14 => Ok(MessageType::AgentMetadata),
            0x15 => Ok(MessageType::FileBrowser),
            0x16 => Ok(MessageType::GitStatus),
            0x17 => Ok(MessageType::RemoteSpawn),
            0x18 => Ok(MessageType::Notification),
            0x19 => Ok(MessageType::SlashCommand),
            _ => Err(anyhow::anyhow!("Invalid message type: {}", value)),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum MessagePriority {
    Low = 0,
    Normal = 1,
    High = 2,
    Critical = 3,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Message {
    pub id: String,
    pub message_type: MessageType,
    pub priority: MessagePriority,
    pub sender_id: String,
    pub receiver_id: Option<String>,
    pub session_id: Option<String>,
    pub timestamp: u64,
    pub payload: MessagePayload,
    #[serde(default)]
    pub requires_response: bool,
    #[serde(default)]
    pub correlation_id: Option<String>,
}

impl Message {
    pub fn new(message_type: MessageType, sender_id: String, payload: MessagePayload) -> Self {
        Self {
            id: format!("msg_{}", js_sys::Date::now()),
            message_type,
            priority: MessagePriority::Normal,
            sender_id,
            receiver_id: None,
            session_id: None,
            timestamp: (js_sys::Date::now() / 1000.0) as u64,
            payload,
            requires_response: false,
            correlation_id: None,
        }
    }

    pub fn with_session(mut self, session_id: String) -> Self {
        self.session_id = Some(session_id);
        self
    }

    pub fn requires_response(mut self) -> Self {
        self.requires_response = true;
        self
    }

    pub fn to_bytes(&self) -> Result<Vec<u8>> {
        bincode::serialize(self).map_err(Into::into)
    }

    pub fn from_bytes(bytes: &[u8]) -> Result<Self> {
        bincode::deserialize(bytes).map_err(Into::into)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum MessagePayload {
    Heartbeat(HeartbeatMessage),
    TcpForwarding(TcpForwardingMessage),
    TcpData(TcpDataMessage),
    SystemControl(SystemControlMessage),
    SystemInfo(SystemInfoMessage),
    Response(ResponseMessage),
    Error(ErrorMessage),
    AgentSession(AgentSessionMessage),
    AgentMessage(AgentMessageMessage),
    AgentPermission(AgentPermissionMessage),
    AgentControl(AgentControlMessage),
    AgentMetadata(AgentMetadataMessage),
    FileBrowser(FileBrowserMessage),
    GitStatus(GitStatusMessage),
    RemoteSpawn(RemoteSpawnMessage),
    Notification(NotificationMessage),
    SlashCommand(SlashCommandMessage),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HeartbeatMessage {
    pub sequence: u64,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TcpForwardingMessage {
    pub action: TcpForwardingAction,
    pub request_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum TcpForwardingAction {
    CreateSession {
        local_addr: String,
        remote_host: Option<String>,
        remote_port: Option<u16>,
        forwarding_type: TcpForwardingType,
        #[serde(default)]
        session_id: Option<String>,
    },
    ListSessions,
    StopSession { session_id: String },
    GetSessionInfo { session_id: String },
    Connect { ticket: String, local_addr: String },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum TcpForwardingType {
    ListenToRemote,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TcpDataMessage {
    pub session_id: String,
    pub connection_id: String,
    pub data_type: TcpDataType,
    pub data: Vec<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum TcpDataType {
    Data,
    ConnectionOpen,
    ConnectionClose,
    Error,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemControlMessage {
    pub action: SystemAction,
    pub request_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SystemAction {
    GetStatus,
    Restart,
    Shutdown,
    GetLogs { limit: Option<u32> },
    InstallAcp { agent_type: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemInfoMessage {
    pub action: SystemInfoAction,
    pub request_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SystemInfoAction {
    GetSystemInfo,
    SystemInfoResponse(SystemInfo),
    GetSystemStats,
    SystemStatsResponse(SystemStats),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemStats {
    pub cpu_usage: f32,
    pub memory_usage: f32,
    pub total_memory: u64,
    pub used_memory: u64,
    pub disk_usage: f32,
    pub total_disk: u64,
    pub used_disk: u64,
    pub uptime: u64,
    pub load_avg: Option<LoadAverage>,
    pub network_stats: Option<NetworkStats>,
    pub timestamp: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoadAverage {
    pub one: f64,
    pub five: f64,
    pub fifteen: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkStats {
    pub bytes_received: u64,
    pub bytes_sent: u64,
    pub packets_received: u64,
    pub packets_sent: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemInfo {
    pub os_info: OSInfo,
    pub shell_info: ShellInfo,
    pub available_tools: AvailableTools,
    pub environment_vars: HashMap<String, String>,
    pub architecture: String,
    pub hostname: String,
    pub user_info: UserInfo,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OSInfo {
    pub os_type: String,
    pub name: String,
    pub version: String,
    pub kernel_version: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShellInfo {
    pub default_shell: String,
    pub shell_type: String,
    pub shell_version: String,
    pub available_shells: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AvailableTools {
    pub package_managers: Vec<PackageManager>,
    pub version_control: Vec<Tool>,
    pub text_editors: Vec<Tool>,
    pub search_tools: Vec<Tool>,
    pub development_tools: Vec<Tool>,
    pub system_tools: Vec<Tool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PackageManager {
    pub name: String,
    pub command: String,
    pub version: String,
    pub available: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Tool {
    pub name: String,
    pub command: String,
    pub version: String,
    pub available: bool,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserInfo {
    pub username: String,
    pub home_directory: String,
    pub current_directory: String,
    pub user_id: String,
    pub group_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResponseMessage {
    pub request_id: String,
    pub success: bool,
    pub data: Option<String>,
    pub message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ErrorMessage {
    pub code: i32,
    pub message: String,
    pub details: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentSessionMessage {
    pub action: AgentSessionAction,
    pub request_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AgentSessionAction {
    Register { metadata: AgentSessionMetadata },
    UpdateStatus { active: bool, thinking: bool },
    ListSessions,
    StopSession { session_id: String },
    Heartbeat { sequence: u64 },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentSessionMetadata {
    pub session_id: String,
    pub agent_type: AgentType,
    pub project_path: String,
    pub started_at: u64,
    pub active: bool,
    pub controlled_by_remote: bool,
    pub hostname: String,
    pub os: String,
    pub agent_version: Option<String>,
    pub current_dir: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum AgentType {
    ClaudeCode,
    OpenCode,
    Codex,
    Cursor,
    Gemini,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentMessageMessage {
    pub session_id: String,
    pub content: AgentMessageContent,
    pub sequence: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AgentMessageContent {
    UserMessage {
        content: String,
        attachments: Vec<String>,
    },
    AgentResponse {
        content: String,
        thinking: bool,
        message_id: Option<String>,
    },
    TurnStarted { turn_id: String },
    TextDelta {
        text: String,
        thinking: bool,
    },
    TurnCompleted {
        content: Option<String>,
    },
    TurnError { error: String },
    ToolCallUpdate {
        tool_name: String,
        status: ToolCallStatus,
        output: Option<String>,
    },
    SystemNotification {
        level: NotificationLevel,
        message: String,
    },
    RawEvent {
        event_type: String,
        data: String,
    },
    ApprovalRequest {
        request_id: String,
        tool_name: String,
        input: Option<String>,
        message: Option<String>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ToolCallStatus {
    Started,
    InProgress,
    Completed,
    Failed,
    Cancelled,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum NotificationLevel {
    Info,
    Warning,
    Error,
    Success,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentPermissionMessage {
    pub inner: AgentPermissionMessageInner,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AgentPermissionMessageInner {
    Request(AgentPermissionRequest),
    Response(AgentPermissionResponse),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentPermissionRequest {
    pub request_id: String,
    pub session_id: String,
    pub tool_name: String,
    pub tool_params: String,
    pub requested_at: u64,
    pub permission_mode: PermissionMode,
    pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentPermissionResponse {
    pub request_id: String,
    pub approved: bool,
    pub permission_mode: PermissionMode,
    pub decided_at: u64,
    pub reason: Option<String>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum PermissionMode {
    AlwaysAsk,
    ApproveForSession,
    AutoApprove,
    Deny,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum AgentPermissionMode {
    AlwaysAsk,
    AcceptEdits,
    AutoApprove,
    Plan,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentControlMessage {
    pub session_id: String,
    pub action: AgentControlAction,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AgentControlAction {
    Pause,
    Resume,
    Terminate,
    SetPermissionMode { mode: AgentPermissionMode },
    GetPermissionMode,
    SendInput {
        content: String,
        attachments: Vec<String>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentMetadataMessage {
    pub update: AgentMetadataUpdate,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentMetadataUpdate {
    pub session_id: String,
    pub updated_at: u64,
    pub metadata: AgentMetadataContent,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AgentMetadataContent {
    UpdateTodos { todos: Vec<TodoItem> },
    UpdateSummary { summary: String },
    UpdateAvailableTools { tools: Vec<String> },
    UpdateSlashCommands { commands: Vec<String> },
    LifecycleState { state: String, since: u64 },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TodoItem {
    pub id: String,
    pub content: String,
    pub status: TodoStatus,
    pub priority: TodoPriority,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum TodoStatus {
    Pending,
    InProgress,
    Completed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum TodoPriority {
    High,
    Medium,
    Low,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileBrowserMessage {
    pub action: FileBrowserAction,
    pub request_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum FileBrowserAction {
    ListDirectory { path: String },
    ListMentionCandidates {
        base_path: String,
        query: String,
        limit: Option<usize>,
    },
    ReadFile { path: String },
    WriteFile { path: String, content: String },
    GetFileInfo { path: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitStatusMessage {
    pub action: GitAction,
    pub request_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum GitAction {
    GetStatus { path: String },
    GetDiff { path: String, file: String },
    GetLog { path: String, limit: Option<usize> },
    GetBranch { path: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RemoteSpawnMessage {
    pub action: RemoteSpawnAction,
    pub request_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum RemoteSpawnAction {
    SpawnSession {
        session_id: String,
        agent_type: AgentType,
        project_path: String,
        args: Vec<String>,
        #[serde(default)]
        mcp_servers: Option<String>,
    },
    ListSessions,
    ListAvailableAgents,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NotificationMessage {
    pub notification: NotificationData,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NotificationData {
    pub id: String,
    pub session_id: Option<String>,
    pub notification_type: NotificationType,
    pub title: String,
    pub body: String,
    pub timestamp: u64,
    pub priority: NotificationPriority,
    pub read: bool,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum NotificationType {
    PermissionRequest,
    ToolCompleted,
    SessionStatus,
    Error,
    Info,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum NotificationPriority {
    Low,
    Normal,
    High,
    Critical,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SlashCommandMessage {
    pub session_id: String,
    pub command: SlashCommand,
    pub request_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SlashCommand {
    Passthrough { raw: String },
    Builtin { command_type: BuiltinCommand },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum BuiltinCommand {
    ListSessions,
    SpawnAgent {
        agent_type: AgentType,
        project_path: String,
        args: Vec<String>,
    },
    StopSession { session_id: String },
    ListCommands,
    GetAgentInfo,
    Init { description: Option<String> },
    Review { target: Option<String> },
    ReviewBranch,
    ReviewCommit,
    Commit { message: Option<String> },
    Loop {
        task: String,
        iterations: Option<u32>,
    },
    AddDir { path: String },
    Branch { name: Option<String> },
    Btw { message: String },
    Clear,
    Compact,
    Plan { description: String },
    Rename { new_name: String },
    Logout,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SerializableEndpointAddr {
    pub node_id: String,
    pub relay_url: Option<String>,
    pub direct_addresses: Vec<String>,
    pub alpn: String,
}

impl SerializableEndpointAddr {
    pub fn from_base64(s: &str) -> Result<Self> {
        let cleaned: String = s.chars().filter(|c| !c.is_whitespace()).collect();
        let engine = base64::engine::general_purpose::STANDARD;
        let decoded = engine.decode(&cleaned)?;
        let json = String::from_utf8(decoded)?;
        Ok(serde_json::from_str(&json)?)
    }

    pub fn try_to_node_addr(&self) -> Result<iroh::EndpointAddr> {
        let public_key = iroh_base::PublicKey::from_str(&self.node_id)?;
        let mut addrs = BTreeSet::new();
        for addr_str in &self.direct_addresses {
            if let Ok(addr) = SocketAddr::from_str(addr_str) {
                addrs.insert(iroh_base::TransportAddr::Ip(addr));
            }
        }
        if let Some(ref relay_url_str) = self.relay_url {
            if let Ok(url) = relay_url_str.parse::<iroh_base::RelayUrl>() {
                addrs.insert(iroh_base::TransportAddr::Relay(url));
            }
        }
        Ok(iroh::EndpointAddr::from_parts(public_key, addrs))
    }
}

pub struct MessageSerializer;

impl MessageSerializer {
    pub fn serialize_for_network(message: &Message) -> Result<Vec<u8>> {
        let message_bytes = message.to_bytes()?;
        let length = message_bytes.len() as u32;
        let mut result = Vec::with_capacity(4 + message_bytes.len());
        result.extend_from_slice(&length.to_be_bytes());
        result.extend_from_slice(&message_bytes);
        Ok(result)
    }

    pub fn deserialize_from_network(data: &[u8]) -> Result<Message> {
        if data.len() < 4 {
            return Err(anyhow::anyhow!("Data too short: {}", data.len()));
        }
        let length = u32::from_be_bytes([data[0], data[1], data[2], data[3]]) as usize;
        if data.len() < 4 + length {
            return Err(anyhow::anyhow!(
                "Incomplete message: expected {}, got {}",
                4 + length,
                data.len()
            ));
        }
        let message_bytes = &data[4..4 + length];
        Message::from_bytes(message_bytes)
    }
}
