//! Agent management module
//!
//! This module provides unified agent session management through ACP (Agent Client Protocol).
//! All agent types communicate via ACP using JSON-RPC 2.0 over stdio.

pub mod acp;
pub mod events;
pub mod factory;
pub mod message_adapter;

use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;

use anyhow::{anyhow, Context, Result};
use riterm_shared::message_protocol::AgentType;
use tokio::sync::RwLock;
use tracing::{debug, info, warn};

pub use acp::AcpStreamingSession;
pub use events::{AgentEvent, AgentTurnEvent, PermissionMode};
pub use factory::{Agent, AgentAvailability, AgentFactory};
pub use message_adapter::event_to_message_content;

/// Agent manager for managing multiple agent sessions
///
/// The AgentManager is responsible for creating and managing agent sessions.
/// All sessions use ACP (Agent Client Protocol) for communication.
#[derive(Clone)]
pub struct AgentManager {
    /// Active sessions by session ID
    sessions: Arc<RwLock<HashMap<String, Arc<AcpStreamingSession>>>>,
}

impl AgentManager {
    /// Create a new agent manager
    pub fn new() -> Self {
        Self {
            sessions: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Start an agent session with automatic session ID generation
    ///
    /// # Arguments
    /// * `agent_type` - Type of agent to start
    /// * `binary_path` - Override path to agent binary (optional)
    /// * `extra_args` - Additional command-line arguments
    /// * `working_dir` - Working directory for agent
    /// * `home_dir` - Override home directory (optional)
    /// * `source` - Source identifier (e.g., "local", "remote")
    ///
    /// # Returns
    /// Session ID if successful, error otherwise
    pub async fn start_session(
        &self,
        agent_type: AgentType,
        binary_path: Option<String>,
        extra_args: Vec<String>,
        working_dir: PathBuf,
        home_dir: Option<String>,
        _source: String,
    ) -> Result<String> {
        let session_id = uuid::Uuid::new_v4().to_string();
        self.start_session_with_id(
            session_id.clone(),
            agent_type,
            binary_path,
            extra_args,
            working_dir,
            home_dir,
            _source,
        )
        .await?;
        Ok(session_id)
    }

    /// Start an agent session with specific session ID
    ///
    /// This method creates an ACP-based session for the specified agent type.
    /// All agents communicate via JSON-RPC 2.0 over stdio.
    pub async fn start_session_with_id(
        &self,
        session_id: String,
        agent_type: AgentType,
        binary_path: Option<String>,
        extra_args: Vec<String>,
        working_dir: PathBuf,
        home_dir: Option<String>,
        _source: String,
    ) -> Result<()> {
        info!(
            "Starting {:?} session (ACP) with ID: {}",
            agent_type,
            session_id
        );

        // Get ACP command and default arguments for this agent type
        let (command, default_args) = AgentFactory::get_acp_command(agent_type);

        // Combine default arguments with extra arguments
        let mut args = default_args;
        args.extend(extra_args);

        // Create ACP streaming session
        let session = AcpStreamingSession::spawn(
            session_id.clone(),
            agent_type,
            if let Some(bin_path) = binary_path {
                bin_path
            } else {
                command
            },
            args,
            working_dir,
            home_dir,
        )
        .await
        .with_context(|| {
            format!(
                "Failed to start ACP session for {:?}",
                agent_type
            )
        })?;

        // Store session
        let mut sessions = self.sessions.write().await;
        sessions.insert(session_id.clone(), Arc::new(session));

        info!("✅ ACP session started: {}", session_id);
        Ok(())
    }

    /// Stop an agent session
    pub async fn stop_session(&self, session_id: &str) -> Result<()> {
        let mut sessions = self.sessions.write().await;

        if sessions.remove(session_id).is_some() {
            debug!("Stopping session: {}", session_id);
            info!("✅ Session stopped: {}", session_id);
            Ok(())
        } else {
            warn!("Session not found: {}", session_id);
            Err(anyhow!("Session not found: {}", session_id))
        }
    }

    /// Send a message to an agent session
    pub async fn send_message(&self, session_id: &str, message: String) -> Result<()> {
        let sessions = self.sessions.read().await;

        if let Some(session) = sessions.get(session_id) {
            let turn_id = uuid::Uuid::new_v4().to_string();
            session
                .send_message(message, turn_id.as_str())
                .await
                .map_err(|e| anyhow!("Failed to send message: {}", e))
        } else {
            Err(anyhow!("Session not found: {}", session_id))
        }
    }

    /// Interrupt current operation in a session
    pub async fn interrupt_session(&self, session_id: &str) -> Result<()> {
        let sessions = self.sessions.read().await;

        if let Some(session) = sessions.get(session_id) {
            session
                .interrupt()
                .await
                .map_err(|e| anyhow!("Failed to interrupt session: {}", e))
        } else {
            Err(anyhow!("Session not found: {}", session_id))
        }
    }

    /// Get list of active session IDs
    pub async fn list_sessions(&self) -> Vec<String> {
        let sessions = self.sessions.read().await;
        sessions.keys().cloned().collect()
    }

    /// Check if a session exists
    pub async fn has_session(&self, session_id: &str) -> bool {
        let sessions = self.sessions.read().await;
        sessions.contains_key(session_id)
    }

    /// Get agent type for a session
    pub async fn get_session_agent_type(&self, session_id: &str) -> Option<AgentType> {
        let sessions = self.sessions.read().await;
        sessions.get(session_id).map(|s| s.agent_type())
    }

    /// Subscribe to events from a session
    pub async fn subscribe(&self, session_id: &str) -> Option<tokio::sync::broadcast::Receiver<AgentTurnEvent>> {
        let sessions = self.sessions.read().await;
        sessions.get(session_id).map(|s| s.subscribe())
    }

    /// Get a session reference
    pub async fn get_session(&self, session_id: &str) -> Option<Arc<AcpStreamingSession>> {
        let sessions = self.sessions.read().await;
        sessions.get(session_id).cloned()
    }
}

impl Default for AgentManager {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_agent_manager_creation() {
        let manager = AgentManager::new();
        assert_eq!(manager.list_sessions().await.len(), 0);
    }

    #[tokio::test]
    async fn test_agent_manager_default() {
        let manager = AgentManager::default();
        assert_eq!(manager.list_sessions().await.len(), 0);
    }
}
