//! WebAssembly bindings for Irogen browser client.

use crate::node::{IrogenNode, IrogenSession};
use crate::protocol::{
    AgentControlAction, AgentControlMessage, AgentMessageContent, AgentMessageMessage,
    AgentPermissionMessage, AgentPermissionMessageInner, AgentPermissionResponse, Message,
    MessagePayload, MessageType, PermissionMode, RemoteSpawnAction, RemoteSpawnMessage,
    SystemAction, SystemControlMessage,
};
use wasm_bindgen::{prelude::wasm_bindgen, JsError, JsValue};
use wasm_bindgen_futures::future_to_promise;

#[wasm_bindgen]
pub struct IrogenNodeWasm(IrogenNode);

#[wasm_bindgen]
impl IrogenNodeWasm {
    pub async fn spawn() -> Result<IrogenNodeWasm, JsError> {
        let node = IrogenNode::spawn()
            .await
            .map_err(|e| JsError::new(&e.to_string()))?;
        Ok(IrogenNodeWasm(node))
    }

    pub fn node_id(&self) -> String {
        self.0.node_id().to_string()
    }

    pub fn connect(&self, ticket: String) -> Result<js_sys::Promise, JsError> {
        let node = self.0.clone();
        let promise = future_to_promise(async move {
            let mut session = node
                .connect(&ticket)
                .await
                .map_err(|e| JsError::new(&e.to_string()))?;
            let stream = session.take_event_stream();
            let session_wasm = IrogenSessionWasm {
                session_id: session.session_id.clone(),
                inner: session,
            };

            let obj = js_sys::Object::new();
            js_sys::Reflect::set(
                &obj,
                &JsValue::from("sessionId"),
                &JsValue::from(session_wasm.session_id.clone()),
            )
            .map_err(|e| JsError::new(&format!("{:?}", e)))?;
            js_sys::Reflect::set(&obj, &JsValue::from("events"), &JsValue::from(stream))
                .map_err(|e| JsError::new(&format!("{:?}", e)))?;
            js_sys::Reflect::set(
                &obj,
                &JsValue::from("session"),
                &JsValue::from(session_wasm),
            )
            .map_err(|e| JsError::new(&format!("{:?}", e)))?;
            Ok(JsValue::from(obj))
        });
        Ok(promise)
    }
}

#[wasm_bindgen]
pub struct IrogenSessionWasm {
    session_id: String,
    inner: IrogenSession,
}

#[wasm_bindgen]
impl IrogenSessionWasm {
    #[wasm_bindgen(getter)]
    pub fn session_id(&self) -> String {
        self.session_id.clone()
    }

    /// Send a text message to the agent session.
    pub async fn send_message(&self, content: String) -> Result<(), JsError> {
        let msg = Message::new(
            MessageType::AgentMessage,
            self.session_id.clone(),
            MessagePayload::AgentMessage(AgentMessageMessage {
                session_id: self.session_id.clone(),
                content: AgentMessageContent::UserMessage {
                    content,
                    attachments: vec![],
                },
                sequence: None,
            }),
        );
        self.inner
            .send_message(&msg)
            .await
            .map_err(|e| JsError::new(&e.to_string()))
    }

    /// Respond to a permission request.
    pub async fn respond_to_permission(
        &self,
        request_id: String,
        approved: bool,
        reason: Option<String>,
    ) -> Result<(), JsError> {
        let msg = Message::new(
            MessageType::AgentPermission,
            self.session_id.clone(),
            MessagePayload::AgentPermission(AgentPermissionMessage {
                inner: AgentPermissionMessageInner::Response(AgentPermissionResponse {
                    request_id,
                    approved,
                    permission_mode: PermissionMode::AlwaysAsk,
                    decided_at: (js_sys::Date::now() / 1000.0) as u64,
                    reason,
                }),
            }),
        );
        self.inner
            .send_message(&msg)
            .await
            .map_err(|e| JsError::new(&e.to_string()))
    }

    /// Send an interrupt/terminate control action.
    pub async fn interrupt(&self) -> Result<(), JsError> {
        let msg = Message::new(
            MessageType::AgentControl,
            self.session_id.clone(),
            MessagePayload::AgentControl(AgentControlMessage {
                session_id: self.session_id.clone(),
                action: AgentControlAction::Terminate,
            }),
        );
        self.inner
            .send_message(&msg)
            .await
            .map_err(|e| JsError::new(&e.to_string()))
    }

    /// Request remote session spawn.
    pub async fn spawn_remote_session(
        &self,
        agent_type: String,
        project_path: String,
        args: Vec<String>,
    ) -> Result<(), JsError> {
        let agent_type = match agent_type.to_lowercase().as_str() {
            "claude" | "claudecode" => crate::protocol::AgentType::ClaudeCode,
            "opencode" => crate::protocol::AgentType::OpenCode,
            "codex" => crate::protocol::AgentType::Codex,
            "gemini" => crate::protocol::AgentType::Gemini,
            "cursor" => crate::protocol::AgentType::Cursor,
            _ => crate::protocol::AgentType::ClaudeCode,
        };
        let msg = Message::new(
            MessageType::RemoteSpawn,
            self.session_id.clone(),
            MessagePayload::RemoteSpawn(RemoteSpawnMessage {
                action: RemoteSpawnAction::SpawnSession {
                    session_id: self.session_id.clone(),
                    agent_type,
                    project_path,
                    args,
                    mcp_servers: None,
                },
                request_id: None,
            }),
        )
        .requires_response();
        self.inner
            .send_message(&msg)
            .await
            .map_err(|e| JsError::new(&e.to_string()))
    }

    /// Request system status from the remote CLI.
    pub async fn get_system_status(&self) -> Result<(), JsError> {
        let msg = Message::new(
            MessageType::SystemControl,
            self.session_id.clone(),
            MessagePayload::SystemControl(SystemControlMessage {
                action: SystemAction::GetStatus,
                request_id: None,
            }),
        )
        .requires_response();
        self.inner
            .send_message(&msg)
            .await
            .map_err(|e| JsError::new(&e.to_string()))
    }

    /// Set the permission mode for the current session.
    /// Accepted values: "alwaysAsk", "acceptEdits", "autoApprove", "plan"
    pub async fn set_permission_mode(&self, mode: String) -> Result<(), JsError> {
        let mode = match mode.to_lowercase().as_str() {
            "alwaysask" | "always_ask" => crate::protocol::AgentPermissionMode::AlwaysAsk,
            "acceptedits" | "accept_edits" => crate::protocol::AgentPermissionMode::AcceptEdits,
            "autoapprove" | "auto_approve" => crate::protocol::AgentPermissionMode::AutoApprove,
            "plan" => crate::protocol::AgentPermissionMode::Plan,
            _ => crate::protocol::AgentPermissionMode::AlwaysAsk,
        };
        let msg = Message::new(
            MessageType::AgentControl,
            self.session_id.clone(),
            MessagePayload::AgentControl(AgentControlMessage {
                session_id: self.session_id.clone(),
                action: AgentControlAction::SetPermissionMode { mode },
            }),
        );
        self.inner
            .send_message(&msg)
            .await
            .map_err(|e| JsError::new(&e.to_string()))
    }

    /// Close the session.
    pub async fn close(&self) -> Result<(), JsError> {
        self.inner
            .close()
            .await
            .map_err(|e| JsError::new(&e.to_string()))
    }
}
