//! TCP Forwarding Demo
//!
//! This example demonstrates how to use RiTerm's TCP forwarding functionality
//! similar to dumbpipe's listen-tcp and connect-tcp commands.

use anyhow::Result;
use riterm_shared::{
    CommunicationManager, MessageBuilder, TcpForwardingAction, TcpForwardingType,
    QuicMessageClient, QuicMessageHandler,
};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tokio::time::{sleep, Duration};
use tracing::{info, warn};
use uuid::Uuid;

#[tokio::main]
async fn main() -> Result<()> {
    // Initialize logging
    tracing_subscriber::fmt::init();

    info!("🚀 RiTerm TCP Forwarding Demo");
    info!("This demo shows how to use TCP forwarding similar to dumbpipe");

    // Demo 1: Forward local port to remote service
    demo_listen_to_remote().await?;

    // Demo 2: Forward remote service to local port
    demo_connect_to_remote().await?;

    info!("✅ TCP forwarding demo completed!");
    Ok(())
}

/// Demo 1: Listen on local port and forward to remote service
/// Similar to: dumbpipe listen-tcp --host localhost:8080
async fn demo_listen_to_remote() -> Result<()> {
    info!("\n📡 Demo 1: Listen on local port and forward to remote service");
    info!("This is equivalent to: dumbpipe listen-tcp --host localhost:8080");

    // Create communication manager
    let comm_manager = Arc::new(CommunicationManager::new(
        format!("tcp_demo_{}", Uuid::new_v4())
    ));
    comm_manager.initialize().await?;

    // Register message handler
    let handler = Arc::new(QuicMessageHandler::new("tcp_demo_handler".to_string()));
    comm_manager.register_message_handler(handler).await;

    // Create QUIC client
    let quic_client = QuicMessageClient::new(None, comm_manager.clone()).await?;

    info!("🎯 Creating TCP forwarding session:");
    info!("   Local address: 127.0.0.1:8080");
    info!("   Remote target: example.com:80");
    info!("   Forwarding type: ListenToRemote");

    // Create TCP forwarding session
    let action = TcpForwardingAction::CreateSession {
        local_addr: "127.0.0.1:8080".to_string(),
        remote_host: Some("example.com".to_string()),
        remote_port: Some(80),
        forwarding_type: TcpForwardingType::ListenToRemote,
    };

    let message = MessageBuilder::tcp_forwarding(
        format!("tcp_demo_{}", Uuid::new_v4()),
        action,
        Some(format!("req_{}", Uuid::new_v4())),
    );

    info!("📨 Sending TCP forwarding creation request...");

    // Note: In a real implementation, this would be sent to the CLI server
    // For demo purposes, we'll just show the structure
    info!("📋 Message structure:");
    info!("   - Message type: TcpForwarding");
    info!("   - Action: CreateSession");
    info!("   - Local address: {}", "127.0.0.1:8080");
    info!("   - Remote target: {}:{}", "example.com", 80);
    info!("   - Forwarding type: {:?}", TcpForwardingType::ListenToRemote);

    // Simulate session creation
    let session_id = format!("tcp_session_{}", Uuid::new_v4());
    info!("✅ TCP forwarding session created: {}", session_id);

    info!("🔗 Usage:");
    info!("   1. Connect to: http://127.0.0.1:8080");
    info!("   2. Traffic will be forwarded to example.com:80");
    info!("   3. Response will be forwarded back to the client");

    // Wait a moment to show the output
    sleep(Duration::from_secs(2)).await;

    // Simulate session management
    info!("🛑 Stopping TCP forwarding session...");

    let stop_action = TcpForwardingAction::StopSession {
        session_id: session_id.clone()
    };

    let stop_message = MessageBuilder::tcp_forwarding(
        format!("tcp_demo_{}", Uuid::new_v4()),
        stop_action,
        Some(format!("req_{}", Uuid::new_v4())),
    );

    info!("📨 Sending stop request for session: {}", session_id);

    Ok(())
}

/// Demo 2: Connect from local port to remote service via P2P
/// Similar to: dumbpipe connect-tcp --addr 127.0.0.1:3001 <ticket>
async fn demo_connect_to_remote() -> Result<()> {
    info!("\n📡 Demo 2: Connect to remote service via P2P tunnel");
    info!("This is equivalent to: dumbpipe connect-tcp --addr 127.0.0.1:3001 <ticket>");

    // Create communication manager
    let comm_manager = Arc::new(CommunicationManager::new(
        format!("tcp_demo_{}", Uuid::new_v4())
    ));
    comm_manager.initialize().await?;

    // Register message handler
    let handler = Arc::new(QuicMessageHandler::new("tcp_demo_handler".to_string()));
    comm_manager.register_message_handler(handler).await;

    // Create QUIC client
    let quic_client = QuicMessageClient::new(None, comm_manager.clone()).await?;

    info!("🎯 Creating TCP forwarding session:");
    info!("   Local address: 127.0.0.1:3001");
    info!("   Remote endpoint: P2P tunnel via ticket");
    info!("   Forwarding type: ConnectToRemote");

    // Create TCP forwarding session for connect mode
    let action = TcpForwardingAction::CreateSession {
        local_addr: "127.0.0.1:3001".to_string(),
        remote_host: Some("remote-service.example.com".to_string()),
        remote_port: Some(22), // SSH example
        forwarding_type: TcpForwardingType::ConnectToRemote,
    };

    let message = MessageBuilder::tcp_forwarding(
        format!("tcp_demo_{}", Uuid::new_v4()),
        action,
        Some(format!("req_{}", Uuid::new_v4())),
    );

    info!("📨 Sending TCP forwarding creation request...");

    info!("📋 Message structure:");
    info!("   - Message type: TcpForwarding");
    info!("   - Action: CreateSession");
    info!("   - Local address: {}", "127.0.0.1:3001");
    info!("   - Remote target: {}:{}", "remote-service.example.com", 22);
    info!("   - Forwarding type: {:?}", TcpForwardingType::ConnectToRemote);

    // Simulate session creation
    let session_id = format!("tcp_session_{}", Uuid::new_v4());
    info!("✅ TCP forwarding session created: {}", session_id);

    info!("🔗 Usage:");
    info!("   1. Connect to: ssh user@127.0.0.1 -p 3001");
    info!("   2. Traffic will be forwarded through P2P tunnel");
    info!("   3. Remote service: remote-service.example.com:22");

    // Simulate connection stats
    info!("📊 Connection Statistics:");
    info!("   - Session ID: {}", session_id);
    info!("   - Active connections: 0");
    info!("   - Bytes sent: 0");
    info!("   - Bytes received: 0");
    info!("   - Status: running");

    // Wait a moment to show the output
    sleep(Duration::from_secs(2)).await;

    info!("🛑 Stopping TCP forwarding session...");

    let stop_action = TcpForwardingAction::StopSession {
        session_id: session_id.clone()
    };

    let stop_message = MessageBuilder::tcp_forwarding(
        format!("tcp_demo_{}", Uuid::new_v4()),
        stop_action,
        Some(format!("req_{}", Uuid::new_v4())),
    );

    info!("📨 Sending stop request for session: {}", session_id);

    Ok(())
}

/// Demo 3: List active TCP forwarding sessions
async fn demo_list_sessions() -> Result<()> {
    info!("\n📋 Demo 3: List active TCP forwarding sessions");

    // Create communication manager
    let comm_manager = Arc::new(CommunicationManager::new(
        format!("tcp_demo_{}", Uuid::new_v4())
    ));
    comm_manager.initialize().await?;

    // Create list sessions request
    let action = TcpForwardingAction::ListSessions;

    let message = MessageBuilder::tcp_forwarding(
        format!("tcp_demo_{}", Uuid::new_v4()),
        action,
        Some(format!("req_{}", Uuid::new_v4())),
    );

    info!("📨 Sending list sessions request...");

    // Simulate response
    info!("📊 Active TCP forwarding sessions:");
    info!("   1. Session ID: tcp_session_123");
    info!("      Local: 127.0.0.1:8080");
    info!("      Remote: example.com:80");
    info!("      Type: ListenToRemote");
    info!("      Connections: 2");
    info!("      Bytes sent: 1024");
    info!("      Bytes received: 2048");
    info!("      Status: running");

    info!("   2. Session ID: tcp_session_456");
    info!("      Local: 127.0.0.1:3001");
    info!("      Remote: remote.example.com:22");
    info!("      Type: ConnectToRemote");
    info!("      Connections: 1");
    info!("      Bytes sent: 512");
    info!("      Bytes received: 1024");
    info!("      Status: running");

    Ok(())
}

/// Helper function to create a mock connection ticket
fn create_mock_ticket() -> String {
    use data_encoding::BASE32;
    use serde_json;

    let ticket_data = serde_json::json!({
        "node_id": "PublicKey(d9b7f966a2ff39ca5486d53025bdd890260832f3591a974394f9c8d36fea867f)",
        "relay_url": Option::<String>::None,
        "alpn": "riterm_quic",
        "created_at": std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs(),
    });

    let ticket_json = serde_json::to_string(&ticket_data).unwrap();
    format!("ticket:{}", BASE32.encode(ticket_json.as_bytes()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_create_tcp_forwarding_message() {
        let action = TcpForwardingAction::CreateSession {
            local_addr: "127.0.0.1:8080".to_string(),
            remote_host: Some("example.com".to_string()),
            remote_port: Some(80),
            forwarding_type: TcpForwardingType::ListenToRemote,
        };

        let message = MessageBuilder::tcp_forwarding(
            "test_sender".to_string(),
            action,
            Some("test_req".to_string()),
        );

        assert_eq!(message.sender, "test_sender");
        assert_eq!(message.request_id, Some("test_req".to_string()));

        if let riterm_shared::MessagePayload::TcpForwarding(tcp_msg) = message.payload {
            match tcp_msg.action {
                TcpForwardingAction::CreateSession { local_addr, remote_host, remote_port, forwarding_type } => {
                    assert_eq!(local_addr, "127.0.0.1:8080");
                    assert_eq!(remote_host, Some("example.com".to_string()));
                    assert_eq!(remote_port, Some(80));
                    assert_eq!(forwarding_type, TcpForwardingType::ListenToRemote);
                }
                _ => panic!("Expected CreateSession action"),
            }
        } else {
            panic!("Expected TcpForwarding message payload");
        }
    }

    #[test]
    fn test_mock_ticket_creation() {
        let ticket = create_mock_ticket();
        assert!(ticket.starts_with("ticket:"));
        assert!(ticket.len() > 50); // Should be reasonably long
    }

    #[test]
    fn test_forwarding_type_formatting() {
        assert_eq!(
            format!("{:?}", TcpForwardingType::ListenToRemote),
            "ListenToRemote"
        );
        assert_eq!(
            format!("{:?}", TcpForwardingType::ConnectToRemote),
            "ConnectToRemote"
        );
    }
}