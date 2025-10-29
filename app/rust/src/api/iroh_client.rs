use anyhow::Result;
use flutter_rust_bridge::frb;
use riterm_shared::P2PNetwork;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::str::FromStr;
use std::sync::Arc;
use tokio::sync::{broadcast, RwLock};
use tracing::{debug, error, info};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IrohSessionInfo {
    pub node_id: String,
    pub node_addr: String,
    pub relay_url: Option<String>,
    pub is_connected: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerminalInfo {
    pub id: String,
    pub name: Option<String>,
    pub shell_type: String,
    pub current_dir: String,
    pub status: String,
    pub created_at: u64,
    pub size: (u16, u16),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerminalOutput {
    pub terminal_id: String,
    pub data: String,
    pub timestamp: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerminalInput {
    pub terminal_id: String,
    pub data: String,
}

// Flutter-visible data structures
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FlutterSession {
    pub id: String,
    pub ticket: String,
    pub title: Option<String>,
    pub created_at: u64,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FlutterTerminal {
    pub id: String,
    pub name: Option<String>,
    pub shell_type: String,
    pub current_dir: String,
    pub status: String,
    pub created_at: u64,
    pub size: (u16, u16),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StreamEvent {
    pub event_type: String,
    pub data: serde_json::Value,
}

pub struct IrohClientManager {
    network: Arc<P2PNetwork>,
    active_sessions: Arc<RwLock<HashMap<String, FlutterSession>>>,
    active_terminals: Arc<RwLock<HashMap<String, FlutterTerminal>>>,
    event_sender: broadcast::Sender<StreamEvent>,
}

impl IrohClientManager {
    pub fn new(network: P2PNetwork) -> Self {
        let (event_sender, _) = broadcast::channel(1000);

        Self {
            network: Arc::new(network),
            active_sessions: Arc::new(RwLock::new(HashMap::new())),
            active_terminals: Arc::new(RwLock::new(HashMap::new())),
            event_sender,
        }
    }

    pub async fn start(&self) -> Result<()> {
        info!("Starting Iroh client manager");

        // Start network event handling
        let network = self.network.clone();
        let event_sender = self.event_sender.clone();
        let active_sessions = self.active_sessions.clone();
        let active_terminals = self.active_terminals.clone();

        tokio::spawn(async move {
            if let Err(e) = Self::handle_network_events(
                network,
                event_sender,
                active_sessions,
                active_terminals,
            )
            .await
            {
                error!("Error handling network events: {}", e);
            }
        });

        Ok(())
    }

    async fn handle_network_events(
        network: Arc<P2PNetwork>,
        event_sender: broadcast::Sender<StreamEvent>,
        active_sessions: Arc<RwLock<HashMap<String, FlutterSession>>>,
        active_terminals: Arc<RwLock<HashMap<String, FlutterTerminal>>>,
    ) -> Result<()> {
        let mut receiver = network.subscribe();

        while let Some(message) = receiver.recv().await {
            debug!("Received network message: {:?}", message);

            match message {
                riterm_shared::NetworkMessage::SessionInfo { from: _, header } => {
                    let session = FlutterSession {
                        id: header.session_id.clone(),
                        ticket: header.session_id.clone(), // TODO: Generate proper ticket
                        title: header.title,
                        created_at: header.timestamp,
                        status: "connected".to_string(),
                    };

                    active_sessions
                        .write()
                        .await
                        .insert(header.session_id.clone(), session.clone());

                    let event = StreamEvent {
                        event_type: "session_connected".to_string(),
                        data: serde_json::to_value(&session).unwrap_or_default(),
                    };

                    let _ = event_sender.send(event);
                }

                riterm_shared::NetworkMessage::SessionEnd { from: _, timestamp } => {
                    let event = StreamEvent {
                        event_type: "session_ended".to_string(),
                        data: serde_json::json!({
                            "timestamp": timestamp,
                            "from": "unknown",
                        }),
                    };

                    let _ = event_sender.send(event);
                }

                riterm_shared::NetworkMessage::TerminalOutput {
                    from: _,
                    terminal_id,
                    data,
                    timestamp,
                } => {
                    let event = StreamEvent {
                        event_type: "terminal_output".to_string(),
                        data: serde_json::to_value(&TerminalOutput {
                            terminal_id,
                            data,
                            timestamp,
                        })
                        .unwrap_or_default(),
                    };

                    let _ = event_sender.send(event);
                }

                riterm_shared::NetworkMessage::TerminalCreate {
                    from: _,
                    name,
                    shell_path,
                    working_dir,
                    size,
                    timestamp,
                } => {
                    let terminal = FlutterTerminal {
                        id: Uuid::new_v4().to_string(),
                        name,
                        shell_type: shell_path.unwrap_or_else(|| "bash".to_string()),
                        current_dir: working_dir.unwrap_or_else(|| "/".to_string()),
                        status: "created".to_string(),
                        created_at: timestamp,
                        size: size.unwrap_or((80, 24)),
                    };

                    active_terminals
                        .write()
                        .await
                        .insert(terminal.id.clone(), terminal.clone());

                    let event = StreamEvent {
                        event_type: "terminal_created".to_string(),
                        data: serde_json::to_value(&terminal).unwrap_or_default(),
                    };

                    let _ = event_sender.send(event);
                }

                _ => {
                    debug!("Unhandled message type: {:?}", message);
                }
            }
        }

        Ok(())
    }

    // pub fn subscribe_events(&self) -> broadcast::Receiver<StreamEvent> {
    //     self.event_sender.subscribe()
    // }
    // Note: This function is commented out because Receiver cannot be serialized across FFI
    // TODO: Implement a different approach for event streaming

    pub async fn get_active_sessions(&self) -> Vec<FlutterSession> {
        self.active_sessions
            .read()
            .await
            .values()
            .cloned()
            .collect()
    }

    pub async fn get_active_terminals(&self) -> Vec<FlutterTerminal> {
        self.active_terminals
            .read()
            .await
            .values()
            .cloned()
            .collect()
    }
}

// Global manager instance
static mut MANAGER: Option<Arc<IrohClientManager>> = None;
static MANAGER_INIT: std::sync::Once = std::sync::Once::new();

#[frb(init)]
pub fn init_app() {
    flutter_rust_bridge::setup_default_user_utils();

    // Initialize logging only if not already set
    if let Err(_) = tracing_subscriber::fmt()
        .with_max_level(tracing::Level::INFO)
        .try_init()
    {
        // Logger already initialized, which is fine
    }

    info!("Flutter Rust Bridge initialized");
}

#[frb]
pub async fn create_iroh_client(relay_url: Option<String>) -> Result<IrohSessionInfo, String> {
    match P2PNetwork::new(relay_url).await {
        Ok(network) => {
            let node_id = network.node_id().to_string();
            let node_addr = network.node_addr().await.map(|addr| addr.to_string()).ok();
            let relay = network.relay_url().map(|url| url.to_string());

            let manager = IrohClientManager::new(network);
            manager.start().await.map_err(|e| e.to_string())?;

            // Store manager globally
            MANAGER_INIT.call_once(|| unsafe {
                MANAGER = Some(Arc::new(manager));
            });

            Ok(IrohSessionInfo {
                node_id,
                node_addr: node_addr.unwrap_or_default(),
                relay_url: relay,
                is_connected: true,
            })
        }
        Err(e) => Err(format!("Failed to create iroh client: {}", e)),
    }
}

#[frb]
pub async fn connect_to_peer(ticket: String) -> Result<String, String> {
    let manager = unsafe { MANAGER.as_ref().ok_or("Iroh client not initialized")? };

    // Parse ticket and connect to peer
    use riterm_shared::SessionTicket;

    match SessionTicket::from_str(&ticket) {
        Ok(session_ticket) => {
            match manager.network.join_session(session_ticket).await {
                Ok((_, _event_receiver)) => {
                    info!("Connected to peer successfully");
                    // TODO: Return session ID and handle events
                    Ok("connected".to_string())
                }
                Err(e) => Err(format!("Failed to connect to peer: {}", e)),
            }
        }
        Err(e) => Err(format!("Invalid ticket format: {}", e)),
    }
}

#[frb]
pub async fn create_terminal(
    name: Option<String>,
    shell_path: Option<String>,
    working_dir: Option<String>,
    rows: Option<u16>,
    cols: Option<u16>,
) -> Result<String, String> {
    let manager = unsafe { MANAGER.as_ref().ok_or("Iroh client not initialized")? };

    let terminal_id = Uuid::new_v4().to_string();
    let size = (rows.unwrap_or(24), cols.unwrap_or(80));

    // Send terminal creation request using Flutter-specific method
    match manager
        .network
        .send_flutter_terminal_create(name, shell_path, working_dir, Some(size))
        .await
    {
        Ok(()) => Ok(terminal_id),
        Err(e) => Err(format!("Failed to create terminal: {}", e)),
    }
}

#[frb]
pub async fn send_terminal_input(terminal_id: String, input: String) -> Result<(), String> {
    let manager = unsafe { MANAGER.as_ref().ok_or("Iroh client not initialized")? };

    match manager
        .network
        .send_flutter_terminal_input(&terminal_id, &input)
        .await
    {
        Ok(()) => Ok(()),
        Err(e) => Err(format!("Failed to send terminal input: {}", e)),
    }
}

#[frb]
pub async fn resize_terminal(terminal_id: String, rows: u16, cols: u16) -> Result<(), String> {
    let manager = unsafe { MANAGER.as_ref().ok_or("Iroh client not initialized")? };

    match manager
        .network
        .send_flutter_terminal_resize(&terminal_id, rows, cols)
        .await
    {
        Ok(()) => Ok(()),
        Err(e) => Err(format!("Failed to resize terminal: {}", e)),
    }
}

#[frb]
pub async fn stop_terminal(terminal_id: String) -> Result<(), String> {
    let manager = unsafe { MANAGER.as_ref().ok_or("Iroh client not initialized")? };

    match manager
        .network
        .send_flutter_terminal_stop(&terminal_id)
        .await
    {
        Ok(()) => Ok(()),
        Err(e) => Err(format!("Failed to stop terminal: {}", e)),
    }
}

#[frb]
pub async fn disconnect_session(session_id: String) -> Result<(), String> {
    let manager = unsafe { MANAGER.as_ref().ok_or("Iroh client not initialized")? };

    match manager
        .network
        .disconnect_flutter_session(&session_id)
        .await
    {
        Ok(()) => Ok(()),
        Err(e) => Err(format!("Failed to disconnect session: {}", e)),
    }
}

#[frb]
pub async fn get_active_sessions() -> Result<Vec<FlutterSession>, String> {
    let manager = unsafe { MANAGER.as_ref().ok_or("Iroh client not initialized")? };

    Ok(manager.get_active_sessions().await)
}

#[frb]
pub async fn get_active_terminals() -> Result<Vec<FlutterTerminal>, String> {
    let manager = unsafe { MANAGER.as_ref().ok_or("Iroh client not initialized")? };

    Ok(manager.get_active_terminals().await)
}

#[frb]
pub fn generate_qr_code(data: String) -> Result<String, String> {
    // Simple QR code generation - return a placeholder for now
    // TODO: Implement proper QR code generation
    Ok(format!("QR placeholder for: {}", data))
}
