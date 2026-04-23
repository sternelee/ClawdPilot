//! Irogen browser node – real iroh QUIC client for WASM.

use crate::protocol::*;
use crate::AgentEvent;
use anyhow::Result;
use futures::channel::mpsc::{unbounded, UnboundedSender};
use futures::StreamExt;
use wasm_bindgen::JsValue;
use wasm_bindgen_futures::spawn_local;
use wasm_streams::ReadableStream;

#[derive(Clone)]
pub struct IrogenNode {
    endpoint: iroh::Endpoint,
    node_id: String,
}

impl IrogenNode {
    pub async fn spawn() -> Result<Self> {
        let endpoint = iroh::Endpoint::builder(iroh::endpoint::presets::N0)
            .alpns(vec![QUIC_MESSAGE_ALPN.to_vec()])
            .bind()
            .await?;
        let node_id = endpoint.id().to_string();
        tracing::info!("IrogenNode spawned: {}", node_id);
        Ok(Self { endpoint, node_id })
    }

    pub fn node_id(&self) -> &str {
        &self.node_id
    }

    pub async fn connect(&self, ticket: &str) -> Result<IrogenSession> {
        let addr = SerializableEndpointAddr::from_base64(ticket)?;
        let node_addr = addr.try_to_node_addr()?;
        tracing::info!("Connecting to {}", addr.node_id);
        let connection = self.endpoint.connect(node_addr, QUIC_MESSAGE_ALPN).await?;

        let session_id = format!("browser_session_{}", js_sys::Date::now());
        let (event_tx, event_rx) = unbounded::<AgentEvent>();

        let session = IrogenSession {
            session_id: session_id.clone(),
            connection,
            event_tx,
            event_rx: Some(event_rx),
        };

        session.spawn_readers();
        Ok(session)
    }
}

pub struct IrogenSession {
    pub session_id: String,
    connection: iroh::endpoint::Connection,
    event_tx: UnboundedSender<AgentEvent>,
    event_rx: Option<futures::channel::mpsc::UnboundedReceiver<AgentEvent>>,
}

impl IrogenSession {
    pub fn take_event_stream(&mut self) -> wasm_streams::readable::sys::ReadableStream {
        let rx = self.event_rx.take().expect("event stream already taken");
        create_event_stream(rx)
    }

    pub async fn send_message(&self, message: &Message) -> Result<()> {
        let is_streaming = matches!(
            message.message_type,
            MessageType::AgentMessage | MessageType::TcpData
        );
        let data = MessageSerializer::serialize_for_network(message)?;

        if is_streaming {
            let mut send = self.connection.open_uni().await?;
            send.write_all(&data).await?;
            send.finish()?;
        } else {
            let (mut send, _recv) = self.connection.open_bi().await?;
            send.write_all(&data).await?;
            send.finish()?;
        }
        Ok(())
    }

    pub async fn close(&self) -> Result<()> {
        let _ = self.event_tx.unbounded_send(AgentEvent::SessionEnded {
            session_id: self.session_id.clone(),
        });
        self.connection.close(0u32.into(), b"browser closing");
        Ok(())
    }

    fn spawn_readers(&self) {
        let conn = self.connection.clone();
        let tx = self.event_tx.clone();
        let session_id = self.session_id.clone();

        // Bi-directional stream reader (regular messages + TCP forwarding streams from server)
        spawn_local(async move {
            loop {
                match conn.accept_bi().await {
                    Ok((_send, mut recv)) => {
                        let tx2 = tx.clone();
                        spawn_local(async move {
                            const MAX: usize = 16 * 1024 * 1024;
                            match recv.read_to_end(MAX).await {
                                Ok(data) => {
                                    if data.starts_with(TCP_STREAM_HANDSHAKE) {
                                        tracing::debug!("Ignoring TCP forwarding bi-stream");
                                        return;
                                    }
                                    if let Err(e) = handle_message_data(&data, &tx2).await {
                                        tracing::error!("bi message error: {}", e);
                                    }
                                }
                                Err(e) => tracing::error!("bi read error: {}", e),
                            }
                        });
                    }
                    Err(e) => {
                        tracing::debug!("accept_bi ended: {}", e);
                        let _ = tx.unbounded_send(AgentEvent::SessionEnded {
                            session_id: session_id.clone(),
                        });
                        break;
                    }
                }
            }
        });

        let conn = self.connection.clone();
        let tx = self.event_tx.clone();
        let session_id = self.session_id.clone();

        // Uni-directional stream reader (streaming messages from server)
        spawn_local(async move {
            loop {
                match conn.accept_uni().await {
                    Ok(mut recv) => {
                        let tx2 = tx.clone();
                        spawn_local(async move {
                            const MAX: usize = 16 * 1024 * 1024;
                            match recv.read_to_end(MAX).await {
                                Ok(data) => {
                                    if let Err(e) = handle_message_data(&data, &tx2).await {
                                        tracing::error!("uni message error: {}", e);
                                    }
                                }
                                Err(e) => tracing::error!("uni read error: {}", e),
                            }
                        });
                    }
                    Err(e) => {
                        tracing::debug!("accept_uni ended: {}", e);
                        let _ = tx.unbounded_send(AgentEvent::SessionEnded {
                            session_id: session_id.clone(),
                        });
                        break;
                    }
                }
            }
        });
    }
}

async fn handle_message_data(data: &[u8], tx: &UnboundedSender<AgentEvent>) -> Result<()> {
    let message = MessageSerializer::deserialize_from_network(data)?;
    let events = message_to_events(&message);
    for event in events {
        let _ = tx.unbounded_send(event);
    }
    Ok(())
}

fn create_event_stream(
    mut receiver: futures::channel::mpsc::UnboundedReceiver<AgentEvent>,
) -> wasm_streams::readable::sys::ReadableStream {
    let stream = async_stream::stream! {
        while let Some(event) = receiver.next().await {
            if let Ok(js_value) = serde_wasm_bindgen::to_value(&event) {
                yield Ok(js_value);
            } else if let Ok(json) = serde_json::to_string(&event) {
                yield Ok(JsValue::from_str(&json));
            }
        }
    };
    ReadableStream::from_stream(stream).into_raw()
}

fn message_to_events(msg: &Message) -> Vec<AgentEvent> {
    let fallback_session = msg.session_id.clone().unwrap_or_default();
    match &msg.payload {
        MessagePayload::AgentSession(AgentSessionMessage { action, .. }) => match action {
            AgentSessionAction::Register { metadata } => vec![AgentEvent::SessionStarted {
                session_id: metadata.session_id.clone(),
                agent: map_agent_type(metadata.agent_type),
            }],
            AgentSessionAction::StopSession { session_id } => {
                vec![AgentEvent::SessionEnded {
                    session_id: session_id.clone(),
                }]
            }
            _ => vec![],
        },
        MessagePayload::AgentMessage(AgentMessageMessage {
            session_id,
            content,
            ..
        }) => match content {
            AgentMessageContent::UserMessage { .. } => vec![],
            AgentMessageContent::AgentResponse { content, .. } => {
                vec![AgentEvent::TextDelta {
                    session_id: session_id.clone(),
                    text: content.clone(),
                }]
            }
            AgentMessageContent::TurnStarted { turn_id } => {
                vec![AgentEvent::TurnStarted {
                    session_id: session_id.clone(),
                    turn_id: turn_id.clone(),
                }]
            }
            AgentMessageContent::TextDelta { text, thinking } => {
                if *thinking {
                    vec![AgentEvent::ReasoningDelta {
                        session_id: session_id.clone(),
                        text: text.clone(),
                    }]
                } else {
                    vec![AgentEvent::TextDelta {
                        session_id: session_id.clone(),
                        text: text.clone(),
                    }]
                }
            }
            AgentMessageContent::TurnCompleted { content } => {
                vec![AgentEvent::TurnCompleted {
                    session_id: session_id.clone(),
                    result: content.as_ref().map(|c| serde_json::json!({ "content": c })),
                }]
            }
            AgentMessageContent::TurnError { error } => {
                vec![AgentEvent::TurnError {
                    session_id: session_id.clone(),
                    error: error.clone(),
                    code: None,
                }]
            }
            AgentMessageContent::ToolCallUpdate {
                tool_name,
                status,
                output,
            } => {
                let tool_id = tool_name.clone();
                match status {
                    ToolCallStatus::Started => vec![AgentEvent::ToolStarted {
                        session_id: session_id.clone(),
                        tool_id,
                        tool_name: tool_name.clone(),
                        input: None,
                    }],
                    ToolCallStatus::Completed => vec![AgentEvent::ToolCompleted {
                        session_id: session_id.clone(),
                        tool_id,
                        tool_name: Some(tool_name.clone()),
                        output: output.as_ref().map(|o| serde_json::json!({ "output": o })),
                        error: None,
                    }],
                    ToolCallStatus::Failed => vec![AgentEvent::ToolCompleted {
                        session_id: session_id.clone(),
                        tool_id,
                        tool_name: Some(tool_name.clone()),
                        output: None,
                        error: output.clone(),
                    }],
                    _ => vec![],
                }
            }
            AgentMessageContent::SystemNotification { level, message } => {
                vec![AgentEvent::Notification {
                    session_id: session_id.clone(),
                    level: map_notification_level(*level),
                    message: message.clone(),
                    details: None,
                }]
            }
            AgentMessageContent::ApprovalRequest {
                request_id,
                tool_name,
                input,
                message,
            } => vec![AgentEvent::ApprovalRequest {
                session_id: session_id.clone(),
                request_id: request_id.clone(),
                tool_name: tool_name.clone(),
                input: input.as_ref().and_then(|s| serde_json::from_str(s).ok()),
                message: message.clone(),
            }],
            AgentMessageContent::RawEvent { event_type, data } => {
                vec![AgentEvent::Raw {
                    session_id: session_id.clone(),
                    agent: crate::AgentType::ClaudeCode,
                    data: serde_json::json!({
                        "eventType": event_type,
                        "data": data,
                    }),
                }]
            }
        },
        MessagePayload::AgentPermission(AgentPermissionMessage { inner }) => match inner {
            AgentPermissionMessageInner::Request(req) => {
                vec![AgentEvent::ApprovalRequest {
                    session_id: req.session_id.clone(),
                    request_id: req.request_id.clone(),
                    tool_name: req.tool_name.clone(),
                    input: serde_json::from_str(&req.tool_params).ok(),
                    message: req.description.clone(),
                }]
            }
            AgentPermissionMessageInner::Response(resp) => vec![AgentEvent::ToolCompleted {
                session_id: fallback_session.clone(),
                tool_id: resp.request_id.clone(),
                tool_name: None,
                output: Some(serde_json::json!({ "approved": resp.approved })),
                error: resp.reason.clone(),
            }],
        },
        MessagePayload::Notification(notif) => vec![AgentEvent::Notification {
            session_id: notif
                .notification
                .session_id
                .clone()
                .unwrap_or_else(|| fallback_session.clone()),
            level: map_protocol_notification_level(&notif.notification.priority),
            message: notif.notification.body.clone(),
            details: Some(serde_json::json!({
                "title": notif.notification.title,
                "type": format!("{:?}", notif.notification.notification_type),
            })),
        }],
        MessagePayload::Error(err) => vec![AgentEvent::Notification {
            session_id: fallback_session.clone(),
            level: crate::NotificationLevel::Error,
            message: err.message.clone(),
            details: err.details.as_ref().map(|d| serde_json::json!({ "details": d })),
        }],
        MessagePayload::Response(resp) => vec![AgentEvent::Notification {
            session_id: fallback_session.clone(),
            level: if resp.success {
                crate::NotificationLevel::Success
            } else {
                crate::NotificationLevel::Error
            },
            message: resp.message.clone().unwrap_or_default(),
            details: resp.data.as_ref().and_then(|d| serde_json::from_str(d).ok()),
        }],
        _ => {
            if let Ok(data) = serde_json::to_value(&msg.payload) {
                vec![AgentEvent::Raw {
                    session_id: fallback_session,
                    agent: crate::AgentType::ClaudeCode,
                    data,
                }]
            } else {
                vec![]
            }
        }
    }
}

fn map_agent_type(agent: crate::protocol::AgentType) -> crate::AgentType {
    match agent {
        crate::protocol::AgentType::ClaudeCode => crate::AgentType::ClaudeCode,
        crate::protocol::AgentType::OpenCode => crate::AgentType::OpenCode,
        crate::protocol::AgentType::Codex => crate::AgentType::Codex,
        crate::protocol::AgentType::Gemini => crate::AgentType::Gemini,
        crate::protocol::AgentType::Cursor => crate::AgentType::Cursor,
    }
}

fn map_notification_level(level: crate::protocol::NotificationLevel) -> crate::NotificationLevel {
    match level {
        crate::protocol::NotificationLevel::Info => crate::NotificationLevel::Info,
        crate::protocol::NotificationLevel::Warning => crate::NotificationLevel::Warning,
        crate::protocol::NotificationLevel::Error => crate::NotificationLevel::Error,
        crate::protocol::NotificationLevel::Success => crate::NotificationLevel::Success,
    }
}

fn map_protocol_notification_level(
    level: &crate::protocol::NotificationPriority,
) -> crate::NotificationLevel {
    match level {
        crate::protocol::NotificationPriority::Low => crate::NotificationLevel::Info,
        crate::protocol::NotificationPriority::Normal => crate::NotificationLevel::Info,
        crate::protocol::NotificationPriority::High => crate::NotificationLevel::Warning,
        crate::protocol::NotificationPriority::Critical => crate::NotificationLevel::Error,
    }
}
