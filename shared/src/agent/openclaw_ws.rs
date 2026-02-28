//! OpenClaw Gateway WebSocket session implementation.
//!
//! This module provides WebSocket-based communication with OpenClaw Gateway.
//! Uses a singleton manager to ensure only one Gateway connection exists.
//!
//! # Protocol
//!
//! The Gateway uses JSON frames:
//! - REQUEST: `{type: "req", id: string, method: string, params: object}`
//! - RESPONSE: `{type: "res", id: string, ok: boolean, payload?: object, error?: object}`
//! - EVENT: `{type: "event", event: string, payload: object, seq: number}`
//!
//! # Handshake Flow
//!
//! 1. Connect to WebSocket
//! 2. Wait for `connect.challenge` event to get nonce
//! 3. Send connect request with device identity and signed payload (v2 format with nonce)
//! 4. Wait for connect response with ok:true

use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::time::Duration;

use anyhow::{Context, Result, anyhow};
use base64::Engine as _;
use ed25519_dalek::{Signer, SigningKey};
use futures_util::{SinkExt, StreamExt};
use rand_core::OsRng;
use serde::Serialize;
use sha2::{Digest, Sha256};
use tokio::sync::{RwLock, broadcast, mpsc};
use tokio::time::sleep;
use tokio_tungstenite::{connect_async, tungstenite::Message};
use tracing::{debug, error, info};

use super::events::{AgentEvent, AgentTurnEvent, PendingPermission};
use crate::message_protocol::AgentType;

/// Default port for OpenClaw Gateway
pub const DEFAULT_OPENCLAW_PORT: u16 = 18789;

/// Default agent ID for OpenClaw Gateway
pub const DEFAULT_AGENT_ID: &str = "main";

/// Gateway manager - singleton that manages the single WebSocket connection
static GATEWAY_MANAGER: std::sync::LazyLock<RwLock<Option<Arc<OpenClawGatewayManager>>>> =
    std::sync::LazyLock::new(|| RwLock::new(None));

/// OpenClaw Gateway manager - single connection for all sessions
pub struct OpenClawGatewayManager {
    /// Connection state
    connected: Arc<AtomicBool>,
    /// Event broadcaster for all sessions (shares with sessions)
    event_sender: broadcast::Sender<AgentTurnEvent>,
    /// Channel to send messages to the gateway
    send_tx: mpsc::Sender<Vec<u8>>,
    /// Request ID counter
    request_counter: Arc<AtomicU64>,
    /// Pending permissions
    pending_permissions: Arc<RwLock<HashMap<String, PendingPermission>>>,
    /// Gateway config
    config: GatewayConfig,
}

/// OpenClaw session - represents a single user's session
pub struct OpenClawWsSession {
    /// Session ID
    session_id: String,
    /// Agent type
    agent_type: AgentType,
    /// Session key for gateway
    session_key: String,
    /// Event receiver subscribed to manager's broadcaster
    event_receiver: broadcast::Receiver<AgentTurnEvent>,
    /// Event sender (cloned from manager for resubscription)
    event_sender: broadcast::Sender<AgentTurnEvent>,
    /// Permission mode for this session
    permission_mode: Arc<RwLock<super::permission_handler::PermissionMode>>,
}

/// Gateway configuration
#[derive(Debug, Clone)]
struct GatewayConfig {
    port: u16,
    token: String,
    agent_id: String,
    device_identity: DeviceIdentity,
}

// ============================================================================
// Device Identity
// ============================================================================

#[derive(Clone, Debug)]
struct DeviceIdentity {
    device_id: String,
    public_key: [u8; 32],
    private_key: [u8; 32],
}

fn load_or_create_device_identity(config_dir: &std::path::Path) -> Result<DeviceIdentity> {
    let identity_path = config_dir.join("identity.json");

    if identity_path.exists() {
        let content = std::fs::read_to_string(&identity_path)?;
        let stored: serde_json::Value =
            serde_json::from_str(&content).context("Failed to parse identity file")?;

        let device_id = stored["deviceId"]
            .as_str()
            .ok_or_else(|| anyhow::anyhow!("missing deviceId"))?;
        let public_key_b64 = stored["publicKey"]
            .as_str()
            .ok_or_else(|| anyhow::anyhow!("missing publicKey"))?;
        let private_key_b64 = stored["privateKey"]
            .as_str()
            .ok_or_else(|| anyhow::anyhow!("missing privateKey"))?;

        let public_key = base64::engine::general_purpose::URL_SAFE_NO_PAD
            .decode(public_key_b64)
            .context("Invalid public key")?;
        let private_key = base64::engine::general_purpose::URL_SAFE_NO_PAD
            .decode(private_key_b64)
            .context("Invalid private key")?;

        if public_key.len() != 32 || private_key.len() != 32 {
            anyhow::bail!("Invalid key length");
        }

        let mut public_key_arr = [0u8; 32];
        let mut private_key_arr = [0u8; 32];
        public_key_arr.copy_from_slice(&public_key);
        private_key_arr.copy_from_slice(&private_key);

        // Verify device_id matches
        let computed_id = compute_device_id(&public_key_arr);
        if computed_id != device_id {
            anyhow::bail!("Device ID mismatch");
        }

        return Ok(DeviceIdentity {
            device_id: device_id.to_string(),
            public_key: public_key_arr,
            private_key: private_key_arr,
        });
    }

    // Generate new identity using Ed25519
    let signing_key = SigningKey::generate(&mut OsRng);
    let verifying_key = signing_key.verifying_key();

    let mut public_key_arr = [0u8; 32];
    let mut private_key_arr = [0u8; 32];
    public_key_arr.copy_from_slice(verifying_key.as_bytes());
    private_key_arr.copy_from_slice(signing_key.as_bytes());

    let device_id = compute_device_id(&public_key_arr);

    // Ensure directory exists
    if let Some(parent) = identity_path.parent() {
        std::fs::create_dir_all(parent)?;
    }

    // Save to file
    let stored = serde_json::json!({
        "version": 1,
        "deviceId": device_id,
        "publicKey": base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(public_key_arr),
        "privateKey": base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(private_key_arr),
        "createdAtMs": chrono::Utc::now().timestamp_millis()
    });

    std::fs::write(&identity_path, serde_json::to_string_pretty(&stored)?)?;
    info!("[OpenClaw] Generated new device identity: {}", device_id);

    Ok(DeviceIdentity {
        device_id,
        public_key: public_key_arr,
        private_key: private_key_arr,
    })
}

/// Compute device ID from public key (SHA256 hash)
fn compute_device_id(public_key: &[u8; 32]) -> String {
    let hash = Sha256::digest(public_key);
    hex::encode(hash)
}

/// Sign device auth payload using Ed25519
fn sign_device_payload(private_key: &[u8; 32], payload: &str) -> String {
    let signing_key = SigningKey::from_bytes(private_key);
    let signature = signing_key.sign(payload.as_bytes());
    base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(signature.to_bytes())
}

// ============================================================================
// Gateway Configuration
// ============================================================================

fn load_gateway_config() -> Option<GatewayConfig> {
    let home = dirs::home_dir()?;
    let config_path = home.join(".openclaw").join("openclaw.json");

    if !config_path.exists() {
        return None;
    }

    let content = std::fs::read_to_string(&config_path).ok()?;
    let config: serde_json::Value = serde_json::from_str(&content).ok()?;

    let gateway = config.get("gateway")?;
    let port = gateway
        .get("port")
        .and_then(|v| v.as_u64())
        .unwrap_or(18789) as u16;
    let token = gateway.get("auth")?.get("token")?.as_str()?.to_string();

    // Load device identity
    let config_dir = home.join(".openclaw");
    let device_identity = load_or_create_device_identity(&config_dir).ok()?;

    Some(GatewayConfig {
        port,
        token,
        agent_id: DEFAULT_AGENT_ID.to_string(),
        device_identity,
    })
}

// ============================================================================
// Agent Request Types
// ============================================================================

#[derive(Debug, Serialize)]
struct AgentRequest {
    #[serde(rename = "type")]
    msg_type: String,
    id: String,
    method: String,
    params: AgentRequestParams,
}

#[derive(Debug, Serialize)]
struct AgentRequestParams {
    message: String,
    #[serde(rename = "agentId")]
    agent_id: String,
    #[serde(rename = "sessionKey")]
    session_key: String,
    deliver: bool,
    #[serde(rename = "idempotencyKey")]
    idempotency_key: String,
}

// ============================================================================
// OpenClawWsSession Implementation
// ============================================================================

impl OpenClawWsSession {
    /// Spawn a new OpenClaw session (registers with singleton manager)
    pub async fn spawn(
        session_id: String,
        agent_type: AgentType,
        _command: String,
        _args: Vec<String>,
        _working_dir: PathBuf,
        _home_dir: Option<String>,
    ) -> Result<Self> {
        // Get or create the singleton manager
        let manager = get_or_create_gateway_manager().await?;

        // Use session_id as session_key
        let session_key = session_id.clone();

        // Subscribe to the manager's event broadcaster
        let event_receiver = manager.subscribe();
        let event_sender = manager.event_sender();

        info!(
            "[OpenClaw] Session {} created with key {}",
            session_id, session_key
        );

        Ok(Self {
            session_id,
            agent_type,
            session_key,
            event_receiver,
            event_sender,
            permission_mode: Arc::new(RwLock::new(
                super::permission_handler::PermissionMode::AlwaysAsk,
            )),
        })
    }

    pub fn session_id(&self) -> &str {
        &self.session_id
    }

    pub fn agent_type(&self) -> AgentType {
        self.agent_type
    }

    pub fn subscribe(&self) -> broadcast::Receiver<AgentTurnEvent> {
        self.event_sender.subscribe()
    }

    pub async fn set_permission_mode(
        &self,
        mode: super::permission_handler::PermissionMode,
    ) -> std::result::Result<(), String> {
        let mut current = self.permission_mode.write().await;
        *current = mode;
        Ok(())
    }

    pub async fn get_permission_mode(&self) -> super::permission_handler::PermissionMode {
        let current = self.permission_mode.read().await;
        *current
    }

    pub async fn send_message(
        &self,
        text: String,
        _turn_id: &str,
        _attachments: Vec<String>,
    ) -> std::result::Result<(), String> {
        // Get the manager
        let manager = get_or_create_gateway_manager()
            .await
            .map_err(|e| e.to_string())?;

        manager
            .send_agent_request(&text, &self.session_key)
            .await
            .map_err(|e| e.to_string())?;

        info!("[OpenClaw] Message sent for session {}", self.session_id);
        Ok(())
    }

    pub async fn interrupt(&self) -> std::result::Result<(), String> {
        // TODO: Implement interrupt
        Ok(())
    }

    pub async fn get_pending_permissions(
        &self,
    ) -> std::result::Result<Vec<PendingPermission>, String> {
        Ok(vec![])
    }

    pub async fn respond_to_permission(
        &self,
        _request_id: String,
        _approved: bool,
        _approve_for_session: bool,
        _reason: Option<String>,
    ) -> std::result::Result<(), String> {
        Ok(())
    }

    pub async fn shutdown(&self) -> std::result::Result<(), String> {
        info!("[OpenClaw] Session {} shutdown", self.session_id);
        Ok(())
    }
}

/// Get or create the singleton gateway manager
async fn get_or_create_gateway_manager() -> Result<Arc<OpenClawGatewayManager>> {
    // First try to get existing
    {
        let guard = GATEWAY_MANAGER.read().await;
        if let Some(manager) = guard.as_ref() {
            if manager.is_connected() {
                return Ok(manager.clone());
            }
        }
    }

    // Need to create new manager
    let mut guard = GATEWAY_MANAGER.write().await;

    // Double-check after acquiring write lock
    if let Some(manager) = guard.as_ref() {
        if manager.is_connected() {
            return Ok(manager.clone());
        }
    }

    // Load config
    let config = load_gateway_config().ok_or_else(|| {
        anyhow!("No OpenClaw gateway config found. Create ~/.openclaw/openclaw.json")
    })?;

    info!("[OpenClaw] Creating new gateway manager");

    // Create new manager with connection loop
    let manager = Arc::new(OpenClawGatewayManager::new(config).await?);

    *guard = Some(manager.clone());

    // Wait for connection
    tokio::select! {
        _ = sleep(Duration::from_secs(10)) => {
            anyhow::bail!("Timeout waiting for gateway connection");
        }
        _ = tokio::time::sleep(Duration::from_millis(100)) => {
            if manager.is_connected() {
                info!("[OpenClaw] Gateway manager connected");
                Ok(manager)
            } else {
                anyhow::bail!("Failed to establish gateway connection")
            }
        }
    }
}

impl OpenClawGatewayManager {
    /// Create and start the gateway manager
    async fn new(config: GatewayConfig) -> Result<Self> {
        let (event_sender, _) = broadcast::channel(1024);
        let (send_tx, send_rx) = mpsc::channel(100);

        let connected = Arc::new(AtomicBool::new(false));
        let request_counter = Arc::new(AtomicU64::new(0));
        let pending_permissions = Arc::new(RwLock::new(HashMap::new()));

        // Clone for the connection loop
        let connected_clone = connected.clone();
        let event_sender_clone = event_sender.clone();
        let pending_permissions_clone = pending_permissions.clone();
        let config_clone = config.clone();

        // Spawn connection loop
        tokio::spawn(async move {
            Self::connection_loop(
                config_clone,
                connected_clone,
                event_sender_clone,
                pending_permissions_clone,
                send_rx,
            )
            .await;
        });

        Ok(Self {
            connected,
            event_sender,
            send_tx,
            request_counter,
            pending_permissions,
            config,
        })
    }

    fn is_connected(&self) -> bool {
        self.connected.load(Ordering::SeqCst)
    }

    /// Subscribe to events
    fn subscribe(&self) -> broadcast::Receiver<AgentTurnEvent> {
        self.event_sender.subscribe()
    }

    /// Get event sender for resubscription
    fn event_sender(&self) -> broadcast::Sender<AgentTurnEvent> {
        self.event_sender.clone()
    }

    /// Send an agent request
    async fn send_agent_request(&self, message: &str, session_key: &str) -> Result<()> {
        if !self.is_connected() {
            anyhow::bail!("Not connected to gateway");
        }

        let now = chrono::Utc::now().timestamp_nanos_opt().unwrap_or(0);
        let request_id = format!("agent:{}", now);

        let request = AgentRequest {
            msg_type: "req".to_string(),
            id: request_id.clone(),
            method: "agent".to_string(),
            params: AgentRequestParams {
                message: message.to_string(),
                agent_id: self.config.agent_id.clone(),
                session_key: session_key.to_string(),
                deliver: false, // Don't deliver to external webhook - we receive responses directly
                idempotency_key: format!("{}", now),
            },
        };

        let data = serde_json::to_vec(&request)?;
        self.send_tx
            .send(data)
            .await
            .context("Failed to send message")?;

        info!("[OpenClaw] Sent agent request: {}", request_id);
        Ok(())
    }

    /// Connection loop with auto-reconnect
    async fn connection_loop(
        config: GatewayConfig,
        connected: Arc<AtomicBool>,
        event_sender: broadcast::Sender<AgentTurnEvent>,
        pending_permissions: Arc<RwLock<HashMap<String, PendingPermission>>>,
        mut send_rx: mpsc::Receiver<Vec<u8>>,
    ) {
        let mut reconnect_delay = Duration::from_secs(1);
        let max_reconnect_delay = Duration::from_secs(30);

        // Track last sent content to compute incremental deltas
        let last_sent_content = Arc::new(RwLock::new(String::new()));

        loop {
            info!("[OpenClaw] Starting connection attempt...");

            // Reset content tracker on new connection
            *last_sent_content.write().await = String::new();

            let result = Self::connect_and_read(
                &config,
                &connected,
                &event_sender,
                &pending_permissions,
                &mut send_rx,
                &last_sent_content,
            )
            .await;

            match result {
                Ok(_) => {
                    info!("[OpenClaw] Connection closed normally");
                    reconnect_delay = Duration::from_secs(1);
                }
                Err(e) => {
                    error!("[OpenClaw] Connection error: {}", e);
                    if reconnect_delay < max_reconnect_delay {
                        reconnect_delay *= 2;
                    }
                }
            }

            connected.store(false, Ordering::SeqCst);

            // Wait before reconnecting
            tokio::select! {
                _ = sleep(reconnect_delay) => {
                    info!("[OpenClaw] Reconnecting...");
                }
                _ = send_rx.recv() => {
                    // Channel closed, exit
                    info!("[OpenClaw] Send channel closed, stopping connection loop");
                    break;
                }
            }
        }
    }

    /// Connect and handle messages
    async fn connect_and_read(
        config: &GatewayConfig,
        connected: &Arc<AtomicBool>,
        event_sender: &broadcast::Sender<AgentTurnEvent>,
        pending_permissions: &Arc<RwLock<HashMap<String, PendingPermission>>>,
        send_rx: &mut mpsc::Receiver<Vec<u8>>,
        last_sent_content: &Arc<RwLock<String>>,
    ) -> Result<()> {
        let url = format!("ws://127.0.0.1:{}", config.port);
        info!("[OpenClaw] Connecting to {}", url);

        let (ws_stream, _) = connect_async(&url).await.context("Failed to connect")?;

        let (mut write, mut read) = ws_stream.split();

        // Step 1: Wait for connect.challenge event to get the nonce
        let nonce = Self::wait_for_connect_challenge(&mut read).await?;

        // Step 2: Send connect request with device identity and nonce
        Self::send_connect_request(&mut write, &config.token, &config.device_identity, &nonce)
            .await?;

        // Step 3: Wait for connect response
        let connect_timeout = sleep(Duration::from_secs(10));
        tokio::pin!(connect_timeout);

        loop {
            tokio::select! {
                msg_result = read.next() => {
                    match msg_result {
                        Some(Ok(Message::Text(text))) => {
                            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&text) {
                                let msg_type = json.get("type").and_then(|v| v.as_str());
                                let msg_id = json.get("id").and_then(|v| v.as_str());

                                if msg_type == Some("res") && msg_id == Some("connect") {
                                    let ok = json.get("ok").and_then(|v| v.as_bool()).unwrap_or(false);
                                    if ok {
                                        info!("[OpenClaw] Connect handshake succeeded");
                                        break;
                                    } else {
                                        let error = json.get("error")
                                            .and_then(|e| e.get("message"))
                                            .and_then(|v| v.as_str())
                                            .unwrap_or("unknown error");
                                        anyhow::bail!("Connect handshake failed: {}", error);
                                    }
                                }
                            }
                        }
                        Some(Ok(Message::Binary(data))) => {
                            if let Ok(json) = serde_json::from_slice::<serde_json::Value>(&data) {
                                let msg_type = json.get("type").and_then(|v| v.as_str());
                                let msg_id = json.get("id").and_then(|v| v.as_str());

                                if msg_type == Some("res") && msg_id == Some("connect") {
                                    let ok = json.get("ok").and_then(|v| v.as_bool()).unwrap_or(false);
                                    if ok {
                                        info!("[OpenClaw] Connect handshake succeeded");
                                        break;
                                    } else {
                                        let error = json.get("error")
                                            .and_then(|e| e.get("message"))
                                            .and_then(|v| v.as_str())
                                            .unwrap_or("unknown error");
                                        anyhow::bail!("Connect handshake failed: {}", error);
                                    }
                                }
                            }
                        }
                        Some(Ok(Message::Close(_))) => {
                            anyhow::bail!("Connection closed during handshake");
                        }
                        Some(Ok(Message::Ping(data))) => {
                            let _ = write.send(Message::Pong(data)).await;
                        }
                        Some(Err(e)) => {
                            anyhow::bail!("Read error during handshake: {}", e);
                        }
                        None => {
                            anyhow::bail!("Stream ended during handshake");
                        }
                        _ => {}
                    }
                }
                _ = &mut connect_timeout => {
                    anyhow::bail!("Timeout waiting for connect response");
                }
            }
        }

        // Mark as connected
        connected.store(true, Ordering::SeqCst);
        info!("[OpenClaw] Connected to gateway, starting message loop");

        // Main message loop
        loop {
            tokio::select! {
                // Handle incoming messages
                msg_result = read.next() => {
                    match msg_result {
                        Some(Ok(Message::Text(text))) => {
                            handle_gateway_message(&text, event_sender, pending_permissions, last_sent_content).await;
                        }
                        Some(Ok(Message::Binary(data))) => {
                            let text = String::from_utf8_lossy(&data);
                            handle_gateway_message(&text, event_sender, pending_permissions, last_sent_content).await;
                        }
                        Some(Ok(Message::Close(_))) => {
                            info!("[OpenClaw] Connection closed by server");
                            break;
                        }
                        Some(Ok(Message::Ping(data))) => {
                            if let Err(e) = write.send(Message::Pong(data)).await {
                                error!("[OpenClaw] Failed to send pong: {}", e);
                                break;
                            }
                        }
                        Some(Err(e)) => {
                            error!("[OpenClaw] Read error: {}", e);
                            break;
                        }
                        None => {
                            info!("[OpenClaw] Stream ended");
                            break;
                        }
                        _ => {}
                    }
                }
                // Handle outgoing messages
                Some(data) = send_rx.recv() => {
                    match String::from_utf8(data) {
                        Ok(text) => {
                            debug!("[OpenClaw] Sending text message: {} bytes", text.len());
                            if let Err(e) = write.send(Message::Text(text.into())).await {
                                error!("[OpenClaw] Failed to send message: {}", e);
                                break;
                            }
                        }
                        Err(e) => {
                            error!("[OpenClaw] Invalid UTF-8: {}", e);
                            if let Err(e) = write.send(Message::Binary(e.into_bytes().into())).await {
                                error!("[OpenClaw] Failed to send binary: {}", e);
                                break;
                            }
                        }
                    }
                }
            }
        }

        connected.store(false, Ordering::SeqCst);
        Ok(())
    }

    /// Wait for connect.challenge event and extract nonce
    async fn wait_for_connect_challenge(
        read: &mut futures_util::stream::SplitStream<
            tokio_tungstenite::WebSocketStream<
                tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>,
            >,
        >,
    ) -> Result<String> {
        let challenge_timeout = sleep(Duration::from_secs(10));
        tokio::pin!(challenge_timeout);

        loop {
            tokio::select! {
                msg_result = read.next() => {
                    match msg_result {
                        Some(Ok(Message::Text(text))) => {
                            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&text) {
                                let msg_type = json.get("type").and_then(|v| v.as_str());
                                let event = json.get("event").and_then(|v| v.as_str());

                                if msg_type == Some("event") && event == Some("connect.challenge") {
                                    if let Some(payload) = json.get("payload") {
                                        if let Some(nonce) = payload.get("nonce").and_then(|v| v.as_str()) {
                                            info!("[OpenClaw] Received connect challenge with nonce");
                                            return Ok(nonce.to_string());
                                        }
                                    }
                                    anyhow::bail!("connect.challenge missing nonce payload");
                                }
                            }
                        }
                        Some(Ok(Message::Binary(data))) => {
                            if let Ok(json) = serde_json::from_slice::<serde_json::Value>(&data) {
                                let msg_type = json.get("type").and_then(|v| v.as_str());
                                let event = json.get("event").and_then(|v| v.as_str());

                                if msg_type == Some("event") && event == Some("connect.challenge") {
                                    if let Some(payload) = json.get("payload") {
                                        if let Some(nonce) = payload.get("nonce").and_then(|v| v.as_str()) {
                                            info!("[OpenClaw] Received connect challenge with nonce");
                                            return Ok(nonce.to_string());
                                        }
                                    }
                                    anyhow::bail!("connect.challenge missing nonce payload");
                                }
                            }
                        }
                        Some(Ok(Message::Close(_))) => {
                            anyhow::bail!("Connection closed while waiting for challenge");
                        }
                        Some(Ok(_)) => {}
                        Some(Err(e)) => {
                            anyhow::bail!("Error waiting for challenge: {}", e);
                        }
                        None => {
                            anyhow::bail!("Stream ended while waiting for challenge");
                        }
                    }
                }
                _ = &mut challenge_timeout => {
                    anyhow::bail!("Timeout waiting for connect.challenge");
                }
            }
        }
    }

    /// Send the initial connect handshake with v2 payload format
    async fn send_connect_request(
        write: &mut futures_util::stream::SplitSink<
            tokio_tungstenite::WebSocketStream<
                tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>,
            >,
            Message,
        >,
        token: &str,
        device_identity: &DeviceIdentity,
        nonce: &str,
    ) -> Result<()> {
        let signed_at = chrono::Utc::now().timestamp_millis();

        // Build device auth payload (v2 format with nonce):
        // v2|deviceId|clientId|clientMode|role|scopes|signedAtMs|token|nonce
        let scopes = "operator.read,operator.write,operator.admin";
        let payload = format!(
            "v2|{}|gateway-client|backend|operator|{}|{}|{}|{}",
            device_identity.device_id, scopes, signed_at, token, nonce
        );

        let signature = sign_device_payload(&device_identity.private_key, &payload);

        let connect_req = serde_json::json!({
            "type": "req",
            "id": "connect",
            "method": "connect",
            "params": {
                "minProtocol": 3,
                "maxProtocol": 3,
                "client": {
                    "id": "gateway-client",
                    "version": "0.2.0",
                    "platform": "linux",
                    "mode": "backend"
                },
                "role": "operator",
                "scopes": ["operator.read", "operator.write", "operator.admin"],
                "auth": {
                    "token": token
                },
                "locale": "zh-CN",
                "userAgent": "clawdpilot-openclaw",
                "device": {
                    "id": device_identity.device_id,
                    "publicKey": base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(device_identity.public_key),
                    "signature": signature,
                    "signedAt": signed_at,
                    "nonce": nonce
                }
            }
        });

        info!(
            "[OpenClaw] Sending connect request for device: {}",
            device_identity.device_id
        );

        let data = serde_json::to_vec(&connect_req)?;
        write
            .send(Message::Binary(data.into()))
            .await
            .context("Failed to send connect request")?;

        Ok(())
    }
}

/// Handle incoming gateway messages and broadcast events
async fn handle_gateway_message(
    text: &str,
    event_sender: &broadcast::Sender<AgentTurnEvent>,
    pending_permissions: &Arc<RwLock<HashMap<String, PendingPermission>>>,
    last_sent_content: &Arc<RwLock<String>>,
) {
    // Always log received messages for debugging (truncate safely at char boundary)
    let log_text = if text.len() > 500 {
        text.chars().take(500).collect::<String>()
    } else {
        text.to_string()
    };
    info!("[OpenClaw] Received message: {}", log_text);

    let msg: serde_json::Value = match serde_json::from_str(text) {
        Ok(m) => m,
        Err(e) => {
            error!("[OpenClaw] Failed to parse JSON: {}", e);
            return;
        }
    };

    let msg_type = msg.get("type").and_then(|v| v.as_str()).unwrap_or("");
    info!("[OpenClaw] Message type: {}", msg_type);

    match msg_type {
        "res" => {
            let id = msg.get("id").and_then(|v| v.as_str()).unwrap_or("");
            let ok = msg.get("ok").and_then(|v| v.as_bool()).unwrap_or(false);

            info!(
                "[OpenClaw] Response id={}, ok={}, payload={:?}",
                id,
                ok,
                msg.get("payload")
            );

            if ok {
                // Check for content in payload
                if let Some(payload) = msg.get("payload") {
                    info!("[OpenClaw] Response payload: {:?}", payload);
                    // Handle agent response with content
                    if let Some(content) = payload.get("content").and_then(|v| v.as_str()) {
                        info!(
                            "[OpenClaw] Found content in response: {} bytes",
                            content.len()
                        );
                        let _ = event_sender.send(AgentTurnEvent {
                            turn_id: id.to_string(),
                            event: AgentEvent::TextDelta {
                                text: content.to_string(),
                                session_id: "default".to_string(),
                            },
                        });
                    }
                }

                // Mark turn as completed
                info!("[OpenClaw] Turn completed: {}", id);
                let _ = event_sender.send(AgentTurnEvent {
                    turn_id: id.to_string(),
                    event: AgentEvent::TurnCompleted {
                        session_id: "default".to_string(),
                        result: None,
                    },
                });
            } else {
                let error = msg
                    .get("error")
                    .and_then(|e| e.get("message"))
                    .and_then(|v| v.as_str())
                    .unwrap_or("Unknown error");
                info!("[OpenClaw] Turn error: {}", error);
                let _ = event_sender.send(AgentTurnEvent {
                    turn_id: id.to_string(),
                    event: AgentEvent::TurnError {
                        session_id: "default".to_string(),
                        error: error.to_string(),
                        code: None,
                    },
                });
            }
        }
        "event" => {
            let event_name = msg.get("event").and_then(|v| v.as_str()).unwrap_or("");
            let payload = msg.get("payload");

            info!("[OpenClaw] Event: {}, payload: {:?}", event_name, payload);

            match event_name {
                // OpenClaw Gateway agent event (streaming content)
                "agent" => {
                    let stream = payload
                        .and_then(|p| p.get("stream"))
                        .and_then(|v| v.as_str());

                    match stream {
                        Some("assistant") => {
                            // Streaming text content
                            let data = payload.and_then(|p| p.get("data"));
                            let delta = data
                                .and_then(|d| d.get("delta"))
                                .and_then(|v| v.as_str())
                                .unwrap_or("")
                                .to_string();
                            // Also get cumulative text for tracking
                            let cumulative_text = data
                                .and_then(|d| d.get("text"))
                                .and_then(|v| v.as_str())
                                .unwrap_or("")
                                .to_string();

                            if !delta.is_empty() {
                                info!(
                                    "[OpenClaw] Broadcasting agent delta: {} bytes (cumulative: {})",
                                    delta.len(),
                                    cumulative_text.len()
                                );
                                let _ = event_sender.send(AgentTurnEvent {
                                    turn_id: "stream".to_string(),
                                    event: AgentEvent::TextDelta {
                                        text: delta,
                                        session_id: "default".to_string(),
                                    },
                                });
                                // Update tracker with cumulative text so chat events can compute correct delta
                                *last_sent_content.write().await = cumulative_text;
                            }
                        }
                        Some("lifecycle") => {
                            // Lifecycle events (start, end)
                            let phase = payload
                                .and_then(|p| p.get("data"))
                                .and_then(|d| d.get("phase"))
                                .and_then(|v| v.as_str());
                            info!("[OpenClaw] Agent lifecycle: {:?}", phase);

                            match phase {
                                Some("start") => {
                                    // Reset content tracker for new turn
                                    *last_sent_content.write().await = String::new();
                                    // Send turn started event
                                    let _ = event_sender.send(AgentTurnEvent {
                                        turn_id: "stream".to_string(),
                                        event: AgentEvent::TurnStarted {
                                            session_id: "default".to_string(),
                                            turn_id: "stream".to_string(),
                                        },
                                    });
                                }
                                Some("end") => {
                                    // Turn ended - handled by chat state=final
                                }
                                _ => {}
                            }
                        }
                        _ => {
                            info!("[OpenClaw] Unknown agent stream type: {:?}", stream);
                        }
                    }
                }
                // OpenClaw Gateway chat event (structured messages)
                // Note: chat event content is cumulative, so we need to compute incremental delta
                "chat" => {
                    let state = payload
                        .and_then(|p| p.get("state"))
                        .and_then(|v| v.as_str());

                    match state {
                        Some("delta") => {
                            // Extract text from content array
                            let content = payload
                                .and_then(|p| p.get("message"))
                                .and_then(|m| m.get("content"))
                                .and_then(|c| c.as_array())
                                .and_then(|arr| arr.first())
                                .and_then(|item| item.get("text"))
                                .and_then(|v| v.as_str())
                                .unwrap_or("")
                                .to_string();

                            // Compute incremental delta (content is cumulative)
                            let mut last = last_sent_content.write().await;
                            let delta = if content.starts_with(&*last) {
                                // Content extends previous content, send only new part
                                content[last.len()..].to_string()
                            } else {
                                // Content changed completely, send full content
                                content.clone()
                            };

                            if !delta.is_empty() {
                                info!(
                                    "[OpenClaw] Broadcasting chat delta (state=delta): {} bytes (full: {})",
                                    delta.len(),
                                    content.len()
                                );
                                let _ = event_sender.send(AgentTurnEvent {
                                    turn_id: "stream".to_string(),
                                    event: AgentEvent::TextDelta {
                                        text: delta,
                                        session_id: "default".to_string(),
                                    },
                                });
                                // Update last sent content
                                *last = content;
                            }
                        }
                        Some("final") => {
                            // Extract text from content array for final message
                            let content = payload
                                .and_then(|p| p.get("message"))
                                .and_then(|m| m.get("content"))
                                .and_then(|c| c.as_array())
                                .and_then(|arr| arr.first())
                                .and_then(|item| item.get("text"))
                                .and_then(|v| v.as_str())
                                .unwrap_or("")
                                .to_string();

                            // Compute incremental delta for final content
                            let mut last = last_sent_content.write().await;
                            let delta = if content.starts_with(&*last) && content.len() > last.len()
                            {
                                content[last.len()..].to_string()
                            } else if content != *last {
                                content.clone()
                            } else {
                                String::new()
                            };

                            if !delta.is_empty() {
                                info!(
                                    "[OpenClaw] Broadcasting chat delta (state=final): {} bytes (full: {})",
                                    delta.len(),
                                    content.len()
                                );
                                let _ = event_sender.send(AgentTurnEvent {
                                    turn_id: "stream".to_string(),
                                    event: AgentEvent::TextDelta {
                                        text: delta,
                                        session_id: "default".to_string(),
                                    },
                                });
                            }

                            // Update last sent content and reset for next turn
                            *last = content;

                            // Mark turn as completed
                            info!("[OpenClaw] Turn completed (chat state=final)");
                            let _ = event_sender.send(AgentTurnEvent {
                                turn_id: "stream".to_string(),
                                event: AgentEvent::TurnCompleted {
                                    session_id: "default".to_string(),
                                    result: None,
                                },
                            });

                            // Reset content tracker for next turn
                            *last = String::new();
                        }
                        _ => {
                            info!("[OpenClaw] Unknown chat state: {:?}", state);
                        }
                    }
                }
                // Legacy agent.delta format
                "agent.delta" => {
                    // Content can be in payload.content or payload.message.content
                    let text = payload
                        .and_then(|p| p.get("content"))
                        .and_then(|v| v.as_str())
                        .or_else(|| {
                            payload
                                .and_then(|p| p.get("message"))
                                .and_then(|m| m.get("content"))
                                .and_then(|v| v.as_str())
                        })
                        .unwrap_or("")
                        .to_string();

                    if !text.is_empty() {
                        info!("[OpenClaw] Broadcasting agent.delta: {} bytes", text.len());
                        let _ = event_sender.send(AgentTurnEvent {
                            turn_id: "stream".to_string(),
                            event: AgentEvent::TextDelta {
                                text,
                                session_id: "default".to_string(),
                            },
                        });
                    }
                }
                // OpenClaw Gateway final event
                "agent.final" => {
                    // Content can be in payload.content or payload.message.content
                    let text = payload
                        .and_then(|p| p.get("content"))
                        .and_then(|v| v.as_str())
                        .or_else(|| {
                            payload
                                .and_then(|p| p.get("message"))
                                .and_then(|m| m.get("content"))
                                .and_then(|v| v.as_str())
                        })
                        .unwrap_or("")
                        .to_string();

                    if !text.is_empty() {
                        info!(
                            "[OpenClaw] Broadcasting agent.final content: {} bytes",
                            text.len()
                        );
                        let _ = event_sender.send(AgentTurnEvent {
                            turn_id: "stream".to_string(),
                            event: AgentEvent::TextDelta {
                                text,
                                session_id: "default".to_string(),
                            },
                        });
                    }
                }
                // Legacy text_delta format (some agents might still use this)
                "text_delta" => {
                    let text = payload
                        .and_then(|p| p.get("text"))
                        .and_then(|v| v.as_str())
                        .or_else(|| {
                            payload
                                .and_then(|p| p.get("content"))
                                .and_then(|v| v.as_str())
                        })
                        .unwrap_or("")
                        .to_string();

                    if !text.is_empty() {
                        info!("[OpenClaw] Broadcasting text_delta: {} bytes", text.len());
                        let _ = event_sender.send(AgentTurnEvent {
                            turn_id: "stream".to_string(),
                            event: AgentEvent::TextDelta {
                                text,
                                session_id: "default".to_string(),
                            },
                        });
                    }
                }
                "tool_started" => {
                    let tool_name = payload
                        .and_then(|p| p.get("name"))
                        .and_then(|v| v.as_str())
                        .unwrap_or("unknown")
                        .to_string();
                    let input = payload.and_then(|p| p.get("input")).cloned();

                    let _ = event_sender.send(AgentTurnEvent {
                        turn_id: uuid::Uuid::new_v4().to_string(),
                        event: AgentEvent::ToolStarted {
                            tool_id: uuid::Uuid::new_v4().to_string(),
                            tool_name,
                            input,
                            session_id: "default".to_string(),
                        },
                    });
                }
                "tool_completed" => {
                    let tool_name = payload
                        .and_then(|p| p.get("name"))
                        .and_then(|v| v.as_str())
                        .unwrap_or("unknown")
                        .to_string();
                    let output = payload.and_then(|p| p.get("output")).cloned();

                    let _ = event_sender.send(AgentTurnEvent {
                        turn_id: uuid::Uuid::new_v4().to_string(),
                        event: AgentEvent::ToolCompleted {
                            tool_id: uuid::Uuid::new_v4().to_string(),
                            tool_name: Some(tool_name),
                            output,
                            session_id: "default".to_string(),
                            error: None,
                        },
                    });
                }
                "permission_request" => {
                    let request_id = payload
                        .and_then(|p| p.get("request_id"))
                        .and_then(|v| v.as_str())
                        .unwrap_or("")
                        .to_string();
                    let tool_name = payload
                        .and_then(|p| p.get("tool_name"))
                        .and_then(|v| v.as_str())
                        .unwrap_or("unknown")
                        .to_string();
                    let message = payload
                        .and_then(|p| p.get("message"))
                        .and_then(|v| v.as_str())
                        .map(|s| s.to_string());

                    let permission = PendingPermission {
                        request_id: request_id.clone(),
                        session_id: "default".to_string(),
                        tool_name: tool_name.clone(),
                        tool_params: serde_json::Value::Null,
                        message,
                        created_at: std::time::SystemTime::now()
                            .duration_since(std::time::UNIX_EPOCH)
                            .unwrap_or_default()
                            .as_secs(),
                        response_tx: None,
                    };

                    pending_permissions
                        .write()
                        .await
                        .insert(request_id.clone(), permission);

                    let _ = event_sender.send(AgentTurnEvent {
                        turn_id: uuid::Uuid::new_v4().to_string(),
                        event: AgentEvent::ApprovalRequest {
                            session_id: "default".to_string(),
                            request_id,
                            tool_name,
                            message: None,
                            input: None,
                        },
                    });
                }
                "error" | "agent.error" | "agent.abort" => {
                    // Error can be in payload.message, payload.error, or payload.errorMessage
                    let error = payload
                        .and_then(|p| p.get("message"))
                        .and_then(|v| v.as_str())
                        .or_else(|| {
                            payload
                                .and_then(|p| p.get("error"))
                                .and_then(|v| v.as_str())
                        })
                        .or_else(|| {
                            payload
                                .and_then(|p| p.get("errorMessage"))
                                .and_then(|v| v.as_str())
                        })
                        .unwrap_or("Unknown error")
                        .to_string();

                    info!("[OpenClaw] Agent error: {}", error);
                    let _ = event_sender.send(AgentTurnEvent {
                        turn_id: uuid::Uuid::new_v4().to_string(),
                        event: AgentEvent::TurnError {
                            session_id: "default".to_string(),
                            error,
                            code: None,
                        },
                    });
                }
                "connected" | "progress" | "complete" | "connect.challenge"
                | "gateway.response" => {
                    info!("[OpenClaw] Skipping control event: {}", event_name);
                }
                // Health event from OpenClaw Gateway
                "health" => {
                    info!("[OpenClaw] Health event: {:?}", payload);
                    // Forward as notification for future use
                    let _ = event_sender.send(AgentTurnEvent {
                        turn_id: "system".to_string(),
                        event: AgentEvent::Notification {
                            session_id: "default".to_string(),
                            level: crate::message_protocol::NotificationLevel::Info,
                            message: "health".to_string(),
                            details: payload.cloned(),
                        },
                    });
                }
                // Ticket event from OpenClaw Gateway
                "ticket" => {
                    info!("[OpenClaw] Ticket event: {:?}", payload);
                    // Forward as notification for future use
                    let _ = event_sender.send(AgentTurnEvent {
                        turn_id: "system".to_string(),
                        event: AgentEvent::Notification {
                            session_id: "default".to_string(),
                            level: crate::message_protocol::NotificationLevel::Info,
                            message: "ticket".to_string(),
                            details: payload.cloned(),
                        },
                    });
                }
                _ => {
                    // Log unknown events with their full payload for debugging
                    info!(
                        "[OpenClaw] Unknown event '{}', full message: {}",
                        event_name, text
                    );
                }
            }
        }
        _ => {
            info!(
                "[OpenClaw] Unknown message type '{}', full message: {}",
                msg_type, text
            );
        }
    }
}
