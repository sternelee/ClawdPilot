//! Generic streaming session implementation
#![allow(dead_code)]
//!
//! Handles execution of generic CLI agents that accept input as an argument
//! and output text to stdout/stderr.

use riterm_shared::message_protocol::AgentType;
use std::path::PathBuf;
use std::process::Stdio;
use std::sync::Arc;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;
use tokio::sync::broadcast;
use tracing::{debug, error, info};

use super::StreamingAgentSession;
use super::events::{AgentEvent, AgentTurnEvent};
use super::session::AgentProcessState;

/// Generic streaming session for CLI tools
pub struct GenericStreamingSession {
    session_id: String,
    agent_type: AgentType,
    command: String,
    base_args: Vec<String>,
    working_dir: PathBuf,
    process_state: Arc<AgentProcessState>,
}

impl GenericStreamingSession {
    pub fn new(
        session_id: String,
        agent_type: AgentType,
        command: String,
        base_args: Vec<String>,
        working_dir: PathBuf,
    ) -> Self {
        let process_state = Arc::new(AgentProcessState::new(session_id.clone()));

        Self {
            session_id,
            agent_type,
            command,
            base_args,
            working_dir,
            process_state,
        }
    }

    pub fn subscribe(&self) -> broadcast::Receiver<AgentTurnEvent> {
        self.process_state.event_sender.subscribe()
    }
}

#[async_trait::async_trait]
impl StreamingAgentSession for GenericStreamingSession {
    fn session_id(&self) -> &str {
        &self.session_id
    }

    fn agent_type(&self) -> AgentType {
        self.agent_type
    }

    fn subscribe(&self) -> broadcast::Receiver<AgentTurnEvent> {
        self.subscribe()
    }

    async fn send_message(&self, text: String, turn_id: &str) -> Result<(), String> {
        info!(
            "[generic_streaming] send_message: session={}, type={:?}, text={}",
            self.session_id, self.agent_type, text
        );

        let mut cmd = Command::new(&self.command);
        cmd.current_dir(&self.working_dir);
        cmd.args(&self.base_args);

        // Pass input as the last argument
        // TODO: Make this configurable (stdin vs arg)
        cmd.arg(&text);

        cmd.stdout(Stdio::piped());
        cmd.stderr(Stdio::piped());
        cmd.stdin(Stdio::null());

        debug!("[generic_streaming] Command: {:?}", cmd);

        let mut child = cmd.spawn().map_err(|e| {
            error!("[generic_streaming] Failed to spawn: {}", e);
            format!("Failed to spawn {}: {}", self.command, e)
        })?;

        let stdout = child.stdout.take().ok_or("Failed to capture stdout")?;
        let stderr = child.stderr.take().ok_or("Failed to capture stderr")?;

        self.process_state
            .register_process(turn_id.to_string(), child)
            .await;

        // Emit lifecycle events
        self.process_state.emit_event(
            turn_id,
            AgentEvent::SessionStarted {
                session_id: self.session_id.clone(),
                agent: self.agent_type,
            },
        );
        self.process_state.emit_event(
            turn_id,
            AgentEvent::TurnStarted {
                session_id: self.session_id.clone(),
                turn_id: turn_id.to_string(),
            },
        );

        // Stream stdout
        let reader = BufReader::new(stdout);
        let mut lines = reader.lines();
        let session_id = self.session_id.clone();

        // Stream stderr in background
        let stderr_reader = BufReader::new(stderr);
        let session_id_clone = self.session_id.clone();
        let stderr_handle = tokio::spawn(async move {
            let mut lines = stderr_reader.lines();
            let mut output = String::new();
            while let Ok(Some(line)) = lines.next_line().await {
                // Determine if we should treat stderr as error or just info/log
                output.push_str(&line);
                output.push('\n');
            }
            output
        });

        // Process stdout
        while let Ok(Some(line)) = lines.next_line().await {
            // Emit simple text delta
            // TODO: Add parser hook here for structured output
            self.process_state.emit_event(
                turn_id,
                AgentEvent::TextDelta {
                    session_id: session_id.clone(),
                    text: format!("{}\n", line),
                },
            );
        }

        // Cleanup
        let child = self.process_state.remove_process(turn_id).await;
        let status = if let Some(mut c) = child {
            c.wait().await.ok()
        } else {
            None
        };

        let stderr_output = stderr_handle.await.unwrap_or_default();
        if !stderr_output.is_empty() {
            // Treat stderr as a warning/system message for now
            // or text delta if it looks like content
            self.process_state.emit_event(
                turn_id,
                AgentEvent::TextDelta {
                    session_id: session_id.clone(),
                    text: format!("\n[stderr]\n{}\n", stderr_output),
                },
            );
        }

        if let Some(status) = status {
            if !status.success() {
                self.process_state.emit_event(
                    turn_id,
                    AgentEvent::TurnError {
                        session_id: self.session_id.clone(),
                        error: format!("Process exited with status: {}", status),
                        code: None,
                    },
                );
                return Err(format!("Process exited with status: {}", status));
            }
        }

        self.process_state.emit_event(
            turn_id,
            AgentEvent::TurnCompleted {
                session_id: self.session_id.clone(),
                result: None,
            },
        );

        Ok(())
    }

    async fn interrupt(&self) -> Result<(), String> {
        self.process_state.kill_all_processes().await
    }
}
