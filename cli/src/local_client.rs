//! Local ACP Client for direct interaction with ACP agents
//!
//! This module provides a local client for running ACP-based AI agents
//! interactively. It handles permission requests, message streaming,
//! and provides a terminal-based user interface.

use anyhow::{Context, Result};
use clawdchat_shared::agent::{AgentManager, PendingPermission};
use clawdchat_shared::message_protocol::AgentType;
use std::path::PathBuf;
use tracing::{debug, info};

/// Local ACP client configuration
#[derive(Clone, Debug)]
pub struct LocalClientConfig {
    /// Agent type (ClaudeCode, OpenCode, Gemini, etc.)
    pub agent_type: AgentType,
    /// Agent binary path (optional, will use default from AgentFactory)
    pub binary_path: Option<String>,
    /// Additional command-line arguments
    pub extra_args: Vec<String>,
    /// Working directory for the agent
    pub working_dir: PathBuf,
    /// Home directory override (optional)
    pub home_dir: Option<String>,
}

/// Local ACP client session
pub struct LocalClientSession {
    /// Agent manager for the session
    manager: AgentManager,
    /// Session ID
    session_id: String,
    /// Configuration
    config: LocalClientConfig,
    /// Event receiver task handle (for cleanup)
    event_task: Option<tokio::task::JoinHandle<()>>,
}

impl LocalClientSession {
    /// Create and start a new local ACP client session
    pub async fn new(config: LocalClientConfig) -> Result<Self> {
        let manager = AgentManager::new();

        info!(
            "Starting local ACP session: {:?} in {}",
            config.agent_type,
            config.working_dir.display()
        );

        // Start the session
        let session_id = manager
            .start_session(
                config.agent_type,
                config.binary_path.clone(),
                config.extra_args.clone(),
                config.working_dir.clone(),
                config.home_dir.clone(),
                "local".to_string(),
            )
            .await
            .context("Failed to start ACP session")?;

        info!("✅ Local ACP session started: {}", session_id);

        // Subscribe to events
        let session_id_clone = session_id.clone();

        // Clone manager for the event task
        let manager_clone = manager.clone();

        // Spawn event listener
        let event_task = Some(tokio::spawn(async move {
            if let Some(receiver) = manager_clone.subscribe(&session_id_clone).await {
                debug!("Starting event listener for session {}", session_id_clone);
                let mut recv = receiver;
                while let Ok(event) = recv.recv().await {
                    // Handle events - update pending permissions
                    if matches!(&event.event, clawdchat_shared::agent::AgentEvent::ApprovalRequest { .. }) {
                        debug!("Received approval request event: {:?}", event);
                        // The session will handle permission storage internally
                        // We can query permissions when listing
                    }
                }
            }
        }));

        Ok(Self {
            manager,
            session_id,
            config,
            event_task,
        })
    }

    /// Get the session ID
    #[allow(dead_code)]
    pub fn session_id(&self) -> &str {
        &self.session_id
    }

    /// Get the agent type
    #[allow(dead_code)]
    pub fn agent_type(&self) -> AgentType {
        self.config.agent_type
    }

    /// Send a message to the agent
    pub async fn send_message(&self, message: String) -> Result<()> {
        info!("Sending message to agent: {}", message.len());
        self.manager
            .send_message(&self.session_id, message)
            .await
            .context("Failed to send message")
    }

    /// Get pending permissions for the current session
    pub async fn get_pending_permissions(&self) -> Result<Vec<PendingPermission>> {
        self.manager
            .get_pending_permissions(&self.session_id)
            .await
            .context("Failed to get pending permissions")
    }

    /// Respond to a permission request
    pub async fn respond_to_permission(
        &self,
        request_id: String,
        approved: bool,
        reason: Option<String>,
    ) -> Result<()> {
        info!(
            "Responding to permission {}: approved={}",
            request_id, approved
        );
        self.manager
            .respond_to_permission(&self.session_id, request_id, approved, reason)
            .await
            .context("Failed to respond to permission")
    }

    /// Interrupt the current operation
    pub async fn interrupt(&self) -> Result<()> {
        info!("Interrupting current operation");
        self.manager
            .interrupt_session(&self.session_id)
            .await
            .context("Failed to interrupt session")
    }

    /// Gracefully shut down the session
    pub async fn shutdown(&self) -> Result<()> {
        info!("Shutting down local ACP session: {}", self.session_id);

        // Cancel event task if present
        if let Some(task) = &self.event_task {
            task.abort();
        }

        // Stop the session
        self.manager
            .stop_session(&self.session_id)
            .await
            .context("Failed to stop session")?;

        info!("✅ Local ACP session shut down: {}", self.session_id);
        Ok(())
    }

    /// Get session info for display
    pub fn get_info(&self) -> SessionInfo {
        SessionInfo {
            session_id: self.session_id.clone(),
            agent_type: self.config.agent_type,
        }
    }
}

/// Session information for display
pub struct SessionInfo {
    pub session_id: String,
    pub agent_type: AgentType,
}

impl Drop for LocalClientSession {
    fn drop(&mut self) {
        // Abort event task if still running
        if let Some(task) = &self.event_task {
            if !task.is_finished() {
                task.abort();
            }
        }
    }
}
