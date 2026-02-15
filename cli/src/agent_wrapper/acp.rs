//! ACP-based streaming session implementation.
//!
//! This module hosts ACP client connections to external agent processes
//! and adapts ACP updates into RiTerm AgentEvent messages.

use std::collections::HashMap;
use std::path::PathBuf;
use std::process::Stdio;
use std::sync::Arc;

use agent_client_protocol as acp;
use agent_client_protocol::Agent;
use anyhow::{Context, Result};
use riterm_shared::message_protocol::AgentType;
use tokio::io::AsyncBufReadExt;
use tokio::io::BufReader;
use tokio::process::Command;
use tokio::sync::{Mutex, RwLock, broadcast, mpsc, oneshot};
use tokio_util::compat::{TokioAsyncReadCompatExt, TokioAsyncWriteCompatExt};
use tracing::{debug, error, info};
use uuid::Uuid;

use crate::agent_wrapper::StreamingAgentSession;
use crate::agent_wrapper::events::{AgentEvent, AgentTurnEvent};

enum AcpCommand {
    Prompt {
        text: String,
        turn_id: String,
        response_tx: oneshot::Sender<std::result::Result<(), String>>,
    },
    Cancel {
        response_tx: oneshot::Sender<std::result::Result<(), String>>,
    },
    Shutdown {
        response_tx: oneshot::Sender<()>,
    },
}

pub struct AcpStreamingSession {
    session_id: String,
    agent_type: AgentType,
    event_sender: broadcast::Sender<AgentTurnEvent>,
    command_tx: mpsc::UnboundedSender<AcpCommand>,
}

impl AcpStreamingSession {
    pub async fn spawn(
        session_id: String,
        agent_type: AgentType,
        command: String,
        args: Vec<String>,
        working_dir: PathBuf,
    ) -> Result<Self> {
        let (event_sender, _) = broadcast::channel(1024);
        let (command_tx, command_rx) = mpsc::unbounded_channel();
        let (ready_tx, ready_rx) = oneshot::channel::<std::result::Result<(), String>>();

        let runtime_session_id = session_id.clone();
        let runtime_event_sender = event_sender.clone();

        let thread_name = format!("riterm-acp-{}", &session_id[..session_id.len().min(8)]);

        std::thread::Builder::new()
            .name(thread_name)
            .spawn(move || {
                let runtime = match tokio::runtime::Builder::new_current_thread()
                    .enable_all()
                    .build()
                {
                    Ok(runtime) => runtime,
                    Err(err) => {
                        let _ = ready_tx.send(Err(format!("Failed to build ACP runtime: {err}")));
                        return;
                    }
                };

                let local_set = tokio::task::LocalSet::new();
                runtime.block_on(local_set.run_until(async move {
                    if let Err(err) = run_acp_runtime(AcpRuntimeParams {
                        session_id: runtime_session_id,
                        agent_type,
                        command,
                        args,
                        working_dir,
                        event_sender: runtime_event_sender,
                        command_rx,
                        ready_tx,
                    })
                    .await
                    {
                        error!("ACP runtime exited with error: {err}");
                    }
                }));
            })
            .with_context(|| format!("Failed to spawn ACP thread for session {session_id}"))?;

        match ready_rx.await {
            Ok(Ok(())) => Ok(Self {
                session_id,
                agent_type,
                event_sender,
                command_tx,
            }),
            Ok(Err(err)) => Err(anyhow::anyhow!(err)),
            Err(_) => Err(anyhow::anyhow!(
                "ACP startup channel closed before session became ready"
            )),
        }
    }
}

#[async_trait::async_trait]
impl StreamingAgentSession for AcpStreamingSession {
    fn session_id(&self) -> &str {
        &self.session_id
    }

    fn agent_type(&self) -> AgentType {
        self.agent_type
    }

    fn subscribe(&self) -> broadcast::Receiver<AgentTurnEvent> {
        self.event_sender.subscribe()
    }

    async fn send_message(&self, text: String, turn_id: &str) -> std::result::Result<(), String> {
        debug!(
            "ACP send_message session={} agent={:?} turn={}",
            self.session_id, self.agent_type, turn_id
        );
        let (response_tx, response_rx) = oneshot::channel();

        self.command_tx
            .send(AcpCommand::Prompt {
                text,
                turn_id: turn_id.to_string(),
                response_tx,
            })
            .map_err(|_| "ACP session command channel closed".to_string())?;

        response_rx
            .await
            .map_err(|_| "ACP session prompt response channel closed".to_string())?
    }

    async fn interrupt(&self) -> std::result::Result<(), String> {
        debug!(
            "ACP interrupt session={} agent={:?}",
            self.session_id, self.agent_type
        );
        let (response_tx, response_rx) = oneshot::channel();

        self.command_tx
            .send(AcpCommand::Cancel { response_tx })
            .map_err(|_| "ACP session command channel closed".to_string())?;

        response_rx
            .await
            .map_err(|_| "ACP session cancel response channel closed".to_string())?
    }

    async fn shutdown(&self) -> std::result::Result<(), String> {
        let (response_tx, response_rx) = oneshot::channel();

        self.command_tx
            .send(AcpCommand::Shutdown { response_tx })
            .map_err(|_| "ACP session command channel closed".to_string())?;

        let _ = response_rx.await;
        Ok(())
    }
}

struct AcpRuntimeParams {
    session_id: String,
    agent_type: AgentType,
    command: String,
    args: Vec<String>,
    working_dir: PathBuf,
    event_sender: broadcast::Sender<AgentTurnEvent>,
    command_rx: mpsc::UnboundedReceiver<AcpCommand>,
    ready_tx: oneshot::Sender<std::result::Result<(), String>>,
}

async fn run_acp_runtime(params: AcpRuntimeParams) -> Result<()> {
    info!(
        "Starting ACP runtime for session {} ({:?}) with command: {} {:?}",
        params.session_id, params.agent_type, params.command, params.args
    );

    let mut child = Command::new(&params.command)
        .args(&params.args)
        .current_dir(&params.working_dir)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .with_context(|| format!("Failed to spawn ACP agent command {}", params.command))?;

    let stdin = child
        .stdin
        .take()
        .ok_or_else(|| anyhow::anyhow!("Failed to capture ACP agent stdin"))?;

    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| anyhow::anyhow!("Failed to capture ACP agent stdout"))?;

    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| anyhow::anyhow!("Failed to capture ACP agent stderr"))?;

    let active_turn = Arc::new(RwLock::new(None::<String>));
    let tool_name_map = Arc::new(Mutex::new(HashMap::<String, String>::new()));

    let client = AcpClientHandler {
        session_id: params.session_id.clone(),
        agent_type: params.agent_type,
        event_sender: params.event_sender.clone(),
        active_turn: active_turn.clone(),
        tool_name_map: tool_name_map.clone(),
    };

    let session_id_for_stderr = params.session_id.clone();
    tokio::task::spawn_local(async move {
        let mut stderr_reader = BufReader::new(stderr).lines();
        while let Ok(Some(line)) = stderr_reader.next_line().await {
            if line.trim().is_empty() {
                continue;
            }
            debug!("[ACP stderr][{}] {}", session_id_for_stderr, line);
        }
    });

    let (connection, io_task) =
        acp::ClientSideConnection::new(client, stdin.compat_write(), stdout.compat(), |future| {
            tokio::task::spawn_local(future);
        });

    let session_id_for_io_error = params.session_id.clone();
    let event_sender_for_io_error = params.event_sender.clone();
    tokio::task::spawn_local(async move {
        if let Err(err) = io_task.await {
            let _ = event_sender_for_io_error.send(AgentTurnEvent {
                turn_id: Uuid::new_v4().to_string(),
                event: AgentEvent::TurnError {
                    session_id: session_id_for_io_error,
                    error: format!("ACP I/O task exited: {err}"),
                    code: None,
                },
            });
        }
    });

    let init_result = connection
        .initialize(
            acp::InitializeRequest::new(acp::ProtocolVersion::LATEST)
                .client_capabilities(
                    acp::ClientCapabilities::new()
                        .fs(acp::FileSystemCapability::new()
                            .read_text_file(true)
                            .write_text_file(true))
                        .terminal(false),
                )
                .client_info(
                    acp::Implementation::new("riterm-cli", env!("CARGO_PKG_VERSION"))
                        .title("RiTerm CLI"),
                ),
        )
        .await;

    if let Err(err) = init_result {
        let _ = params
            .ready_tx
            .send(Err(format!("ACP initialize failed: {err}")));
        return Err(anyhow::anyhow!("ACP initialize failed: {err}"));
    }

    let new_session_result = connection
        .new_session(acp::NewSessionRequest::new(params.working_dir.clone()))
        .await;

    let acp_session_id = match new_session_result {
        Ok(resp) => resp.session_id,
        Err(err) => {
            let _ = params
                .ready_tx
                .send(Err(format!("ACP new_session failed: {err}")));
            return Err(anyhow::anyhow!("ACP new_session failed: {err}"));
        }
    };

    let _ = params.ready_tx.send(Ok(()));

    let _ = params.event_sender.send(AgentTurnEvent {
        turn_id: Uuid::new_v4().to_string(),
        event: AgentEvent::SessionStarted {
            session_id: params.session_id.clone(),
            agent: params.agent_type,
        },
    });

    run_command_loop(
        params.session_id.clone(),
        connection,
        acp_session_id,
        active_turn,
        params.event_sender.clone(),
        params.command_rx,
    )
    .await;

    let _ = child.start_kill();
    let _ = child.wait().await;

    Ok(())
}

async fn run_command_loop(
    session_id: String,
    connection: acp::ClientSideConnection,
    acp_session_id: acp::SessionId,
    active_turn: Arc<RwLock<Option<String>>>,
    event_sender: broadcast::Sender<AgentTurnEvent>,
    mut command_rx: mpsc::UnboundedReceiver<AcpCommand>,
) {
    while let Some(command) = command_rx.recv().await {
        match command {
            AcpCommand::Prompt {
                text,
                turn_id,
                response_tx,
            } => {
                {
                    let mut active = active_turn.write().await;
                    *active = Some(turn_id.clone());
                }

                let _ = event_sender.send(AgentTurnEvent {
                    turn_id: turn_id.clone(),
                    event: AgentEvent::TurnStarted {
                        session_id: session_id.clone(),
                        turn_id: turn_id.clone(),
                    },
                });

                let result = connection
                    .prompt(acp::PromptRequest::new(
                        acp_session_id.clone(),
                        vec![acp::ContentBlock::from(text)],
                    ))
                    .await;

                match result {
                    Ok(response) => {
                        let _ = event_sender.send(AgentTurnEvent {
                            turn_id: turn_id.clone(),
                            event: AgentEvent::TurnCompleted {
                                session_id: session_id.clone(),
                                result: Some(serde_json::json!({
                                    "stopReason": stop_reason_to_string(response.stop_reason),
                                })),
                            },
                        });
                        let _ = response_tx.send(Ok(()));
                    }
                    Err(err) => {
                        let error_text = format!("ACP prompt failed: {err}");
                        let _ = event_sender.send(AgentTurnEvent {
                            turn_id: turn_id.clone(),
                            event: AgentEvent::TurnError {
                                session_id: session_id.clone(),
                                error: error_text.clone(),
                                code: None,
                            },
                        });
                        let _ = response_tx.send(Err(error_text));
                    }
                }

                let mut active = active_turn.write().await;
                *active = None;
            }
            AcpCommand::Cancel { response_tx } => {
                let result = connection
                    .cancel(acp::CancelNotification::new(acp_session_id.clone()))
                    .await
                    .map_err(|err| format!("ACP cancel failed: {err}"));
                let _ = response_tx.send(result.map(|_| ()));
            }
            AcpCommand::Shutdown { response_tx } => {
                let _ = connection
                    .cancel(acp::CancelNotification::new(acp_session_id.clone()))
                    .await;
                let _ = response_tx.send(());
                break;
            }
        }
    }

    let _ = event_sender.send(AgentTurnEvent {
        turn_id: Uuid::new_v4().to_string(),
        event: AgentEvent::SessionEnded { session_id },
    });
}

fn stop_reason_to_string(reason: acp::StopReason) -> &'static str {
    match reason {
        acp::StopReason::EndTurn => "end_turn",
        acp::StopReason::MaxTokens => "max_tokens",
        acp::StopReason::MaxTurnRequests => "max_turn_requests",
        acp::StopReason::Refusal => "refusal",
        acp::StopReason::Cancelled => "cancelled",
        _ => "unknown",
    }
}

struct AcpClientHandler {
    session_id: String,
    agent_type: AgentType,
    event_sender: broadcast::Sender<AgentTurnEvent>,
    active_turn: Arc<RwLock<Option<String>>>,
    tool_name_map: Arc<Mutex<HashMap<String, String>>>,
}

impl AcpClientHandler {
    async fn current_turn_id(&self) -> String {
        self.active_turn
            .read()
            .await
            .clone()
            .unwrap_or_else(|| Uuid::new_v4().to_string())
    }

    async fn emit_event(&self, event: AgentEvent) {
        let turn_id = self.current_turn_id().await;
        let _ = self.event_sender.send(AgentTurnEvent { turn_id, event });
    }

    fn content_block_text(block: &acp::ContentBlock) -> String {
        match block {
            acp::ContentBlock::Text(text) => text.text.clone(),
            acp::ContentBlock::Image(_) => "[image]".to_string(),
            acp::ContentBlock::Audio(_) => "[audio]".to_string(),
            acp::ContentBlock::ResourceLink(link) => {
                format!("[resource:{}]", link.uri)
            }
            acp::ContentBlock::Resource(resource) => match &resource.resource {
                acp::EmbeddedResourceResource::TextResourceContents(text) => text.text.clone(),
                acp::EmbeddedResourceResource::BlobResourceContents(blob) => {
                    format!("[blob:{} bytes]", blob.blob.len())
                }
                _ => "[resource]".to_string(),
            },
            _ => "[content]".to_string(),
        }
    }

    fn choose_permission_option(
        options: &[acp::PermissionOption],
    ) -> acp::RequestPermissionOutcome {
        let selected = options
            .iter()
            .find(|option| {
                matches!(
                    option.kind,
                    acp::PermissionOptionKind::AllowOnce | acp::PermissionOptionKind::AllowAlways
                )
            })
            .or_else(|| options.first());

        match selected {
            Some(option) => acp::RequestPermissionOutcome::Selected(
                acp::SelectedPermissionOutcome::new(option.option_id.clone()),
            ),
            None => acp::RequestPermissionOutcome::Cancelled,
        }
    }

    async fn emit_tool_call_update(&self, update: acp::ToolCallUpdate) {
        let tool_id = update.tool_call_id.0.to_string();

        if let Some(title) = update.fields.title.clone() {
            self.tool_name_map
                .lock()
                .await
                .insert(tool_id.clone(), title);
        }

        let cached_tool_name = self.tool_name_map.lock().await.get(&tool_id).cloned();
        let tool_name = update
            .fields
            .title
            .clone()
            .or(cached_tool_name)
            .unwrap_or_else(|| "tool".to_string());

        if let Some(raw_input) = update.fields.raw_input.clone() {
            self.emit_event(AgentEvent::ToolInputUpdated {
                session_id: self.session_id.clone(),
                tool_id: tool_id.clone(),
                tool_name: Some(tool_name.clone()),
                input: Some(raw_input),
            })
            .await;
        }

        if let Some(status) = update.fields.status {
            match status {
                acp::ToolCallStatus::Pending | acp::ToolCallStatus::InProgress => {
                    self.emit_event(AgentEvent::ToolInputUpdated {
                        session_id: self.session_id.clone(),
                        tool_id,
                        tool_name: Some(tool_name),
                        input: update.fields.raw_input.clone(),
                    })
                    .await;
                }
                acp::ToolCallStatus::Completed => {
                    self.emit_event(AgentEvent::ToolCompleted {
                        session_id: self.session_id.clone(),
                        tool_id,
                        tool_name: Some(tool_name),
                        output: update.fields.raw_output.clone(),
                        error: None,
                    })
                    .await;
                }
                acp::ToolCallStatus::Failed => {
                    let error_message = update
                        .fields
                        .raw_output
                        .as_ref()
                        .map(|value| {
                            value
                                .as_str()
                                .map(ToString::to_string)
                                .unwrap_or_else(|| value.to_string())
                        })
                        .unwrap_or_else(|| "Tool call failed".to_string());

                    self.emit_event(AgentEvent::ToolCompleted {
                        session_id: self.session_id.clone(),
                        tool_id,
                        tool_name: Some(tool_name),
                        output: update.fields.raw_output.clone(),
                        error: Some(error_message),
                    })
                    .await;
                }
                _ => {}
            }
        }
    }
}

#[async_trait::async_trait(?Send)]
impl acp::Client for AcpClientHandler {
    async fn request_permission(
        &self,
        args: acp::RequestPermissionRequest,
    ) -> acp::Result<acp::RequestPermissionResponse> {
        let tool_name = args
            .tool_call
            .fields
            .title
            .clone()
            .unwrap_or_else(|| "tool".to_string());

        self.emit_event(AgentEvent::ApprovalRequest {
            session_id: self.session_id.clone(),
            request_id: args.tool_call.tool_call_id.0.to_string(),
            tool_name,
            input: args.tool_call.fields.raw_input.clone(),
            message: Some("Agent requested permission".to_string()),
        })
        .await;

        Ok(acp::RequestPermissionResponse::new(
            Self::choose_permission_option(&args.options),
        ))
    }

    async fn session_notification(&self, args: acp::SessionNotification) -> acp::Result<()> {
        match args.update {
            acp::SessionUpdate::UserMessageChunk(_) => {}
            acp::SessionUpdate::AgentMessageChunk(chunk) => {
                self.emit_event(AgentEvent::TextDelta {
                    session_id: self.session_id.clone(),
                    text: Self::content_block_text(&chunk.content),
                })
                .await;
            }
            acp::SessionUpdate::AgentThoughtChunk(chunk) => {
                self.emit_event(AgentEvent::ReasoningDelta {
                    session_id: self.session_id.clone(),
                    text: Self::content_block_text(&chunk.content),
                })
                .await;
            }
            acp::SessionUpdate::ToolCall(tool_call) => {
                let tool_id = tool_call.tool_call_id.0.to_string();
                self.tool_name_map
                    .lock()
                    .await
                    .insert(tool_id.clone(), tool_call.title.clone());

                self.emit_event(AgentEvent::ToolStarted {
                    session_id: self.session_id.clone(),
                    tool_id: tool_id.clone(),
                    tool_name: tool_call.title.clone(),
                    input: tool_call.raw_input.clone(),
                })
                .await;

                match tool_call.status {
                    acp::ToolCallStatus::Pending | acp::ToolCallStatus::InProgress => {
                        if let Some(raw_input) = tool_call.raw_input {
                            self.emit_event(AgentEvent::ToolInputUpdated {
                                session_id: self.session_id.clone(),
                                tool_id,
                                tool_name: Some(tool_call.title),
                                input: Some(raw_input),
                            })
                            .await;
                        }
                    }
                    acp::ToolCallStatus::Completed => {
                        self.emit_event(AgentEvent::ToolCompleted {
                            session_id: self.session_id.clone(),
                            tool_id,
                            tool_name: Some(tool_call.title),
                            output: tool_call.raw_output,
                            error: None,
                        })
                        .await;
                    }
                    acp::ToolCallStatus::Failed => {
                        let error_message = tool_call
                            .raw_output
                            .as_ref()
                            .map(|value| {
                                value
                                    .as_str()
                                    .map(ToString::to_string)
                                    .unwrap_or_else(|| value.to_string())
                            })
                            .unwrap_or_else(|| "Tool call failed".to_string());

                        self.emit_event(AgentEvent::ToolCompleted {
                            session_id: self.session_id.clone(),
                            tool_id,
                            tool_name: Some(tool_call.title),
                            output: tool_call.raw_output,
                            error: Some(error_message),
                        })
                        .await;
                    }
                    _ => {}
                }
            }
            acp::SessionUpdate::ToolCallUpdate(update) => {
                self.emit_tool_call_update(update).await;
            }
            update => {
                self.emit_event(AgentEvent::Raw {
                    session_id: self.session_id.clone(),
                    agent: self.agent_type,
                    data: serde_json::to_value(update).unwrap_or_else(|_| serde_json::json!({})),
                })
                .await;
            }
        }

        Ok(())
    }

    async fn write_text_file(
        &self,
        args: acp::WriteTextFileRequest,
    ) -> acp::Result<acp::WriteTextFileResponse> {
        tokio::fs::write(&args.path, args.content)
            .await
            .map_err(|err| {
                acp::Error::internal_error().data(format!("write_text_file failed: {err}"))
            })?;

        Ok(acp::WriteTextFileResponse::new())
    }

    async fn read_text_file(
        &self,
        args: acp::ReadTextFileRequest,
    ) -> acp::Result<acp::ReadTextFileResponse> {
        let content = tokio::fs::read_to_string(&args.path).await.map_err(|err| {
            acp::Error::internal_error().data(format!("read_text_file failed: {err}"))
        })?;

        let content = if args.line.is_some() || args.limit.is_some() {
            let start_line = args.line.unwrap_or(1).max(1) as usize;
            let limit = args.limit.unwrap_or(u32::MAX) as usize;

            content
                .lines()
                .skip(start_line.saturating_sub(1))
                .take(limit)
                .collect::<Vec<_>>()
                .join("\n")
        } else {
            content
        };

        Ok(acp::ReadTextFileResponse::new(content))
    }
}
