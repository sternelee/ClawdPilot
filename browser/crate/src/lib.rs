//! Irogen Browser WASM Client
//!
//! WebAssembly client for connecting to Irogen agent sessions from the browser.
//! Uses iroh for P2P connectivity over QUIC.

mod node;
mod protocol;
mod wasm;

pub use node::IrogenNode;
pub use protocol::*;
pub use wasm::{IrogenNodeWasm, IrogenSessionWasm};

use serde::{Deserialize, Serialize};
use tracing::level_filters::LevelFilter;
use tracing_subscriber_wasm::MakeConsoleWriter;
use wasm_bindgen::prelude::wasm_bindgen;

// ============================================================================
// Initialization
// ============================================================================

#[wasm_bindgen(start)]
fn start() {
    console_error_panic_hook::set_once();

    tracing_subscriber::fmt()
        .with_max_level(LevelFilter::DEBUG)
        .with_writer(
            MakeConsoleWriter::default().map_trace_level_to(tracing::Level::DEBUG),
        )
        .without_time()
        .with_ansi(false)
        .init();

    tracing::info!("Irogen browser WASM initialized");
}

#[wasm_bindgen]
pub fn init_panic_hook() {
    console_error_panic_hook::set_once();
}

// ============================================================================
// JS-Facing Agent Event Types
// ============================================================================

/// Notification severity level
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum NotificationLevel {
    Info,
    Warning,
    Error,
    Success,
}

/// File operation types
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum FileOperationType {
    Read,
    Write,
    Create,
    Delete,
    Move,
    Copy,
}

/// Agent type identifier
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum AgentType {
    ClaudeCode,
    OpenCode,
    Codex,
    Gemini,
    OpenClaw,
    Cursor,
}

/// Unified agent event for browser client
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum AgentEvent {
    #[serde(rename = "session:started")]
    SessionStarted {
        session_id: String,
        agent: AgentType,
    },
    #[serde(rename = "turn:started")]
    TurnStarted {
        session_id: String,
        turn_id: String,
    },
    #[serde(rename = "text:delta")]
    TextDelta {
        session_id: String,
        text: String,
    },
    #[serde(rename = "reasoning:delta")]
    ReasoningDelta {
        session_id: String,
        text: String,
    },
    #[serde(rename = "tool:started")]
    ToolStarted {
        session_id: String,
        tool_id: String,
        tool_name: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        input: Option<serde_json::Value>,
    },
    #[serde(rename = "tool:completed")]
    ToolCompleted {
        session_id: String,
        tool_id: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        tool_name: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        output: Option<serde_json::Value>,
        #[serde(skip_serializing_if = "Option::is_none")]
        error: Option<String>,
    },
    #[serde(rename = "tool:inputUpdated")]
    ToolInputUpdated {
        session_id: String,
        tool_id: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        tool_name: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        input: Option<serde_json::Value>,
    },
    #[serde(rename = "approval:request")]
    ApprovalRequest {
        session_id: String,
        request_id: String,
        tool_name: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        input: Option<serde_json::Value>,
        #[serde(skip_serializing_if = "Option::is_none")]
        message: Option<String>,
    },
    #[serde(rename = "turn:completed")]
    TurnCompleted {
        session_id: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        result: Option<serde_json::Value>,
    },
    #[serde(rename = "turn:error")]
    TurnError {
        session_id: String,
        error: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        code: Option<String>,
    },
    #[serde(rename = "session:ended")]
    SessionEnded {
        session_id: String,
    },
    #[serde(rename = "usage:update")]
    UsageUpdate {
        session_id: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        input_tokens: Option<i64>,
        #[serde(skip_serializing_if = "Option::is_none")]
        output_tokens: Option<i64>,
        #[serde(skip_serializing_if = "Option::is_none")]
        cached_tokens: Option<i64>,
        #[serde(skip_serializing_if = "Option::is_none")]
        model_context_window: Option<i64>,
    },
    #[serde(rename = "progress:update")]
    ProgressUpdate {
        session_id: String,
        operation: String,
        progress: f32,
        #[serde(skip_serializing_if = "Option::is_none")]
        message: Option<String>,
    },
    #[serde(rename = "notification")]
    Notification {
        session_id: String,
        level: NotificationLevel,
        message: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        details: Option<serde_json::Value>,
    },
    #[serde(rename = "file:operation")]
    FileOperation {
        session_id: String,
        operation: FileOperationType,
        path: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        status: Option<String>,
    },
    #[serde(rename = "terminal:output")]
    TerminalOutput {
        session_id: String,
        command: String,
        output: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        exit_code: Option<i32>,
    },
    #[serde(rename = "raw")]
    Raw {
        session_id: String,
        agent: AgentType,
        data: serde_json::Value,
    },
}

impl AgentEvent {
    pub fn session_id(&self) -> &str {
        match self {
            AgentEvent::SessionStarted { session_id, .. } => session_id,
            AgentEvent::TurnStarted { session_id, .. } => session_id,
            AgentEvent::TextDelta { session_id, .. } => session_id,
            AgentEvent::ReasoningDelta { session_id, .. } => session_id,
            AgentEvent::ToolStarted { session_id, .. } => session_id,
            AgentEvent::ToolCompleted { session_id, .. } => session_id,
            AgentEvent::ToolInputUpdated { session_id, .. } => session_id,
            AgentEvent::ApprovalRequest { session_id, .. } => session_id,
            AgentEvent::TurnCompleted { session_id, .. } => session_id,
            AgentEvent::TurnError { session_id, .. } => session_id,
            AgentEvent::SessionEnded { session_id } => session_id,
            AgentEvent::UsageUpdate { session_id, .. } => session_id,
            AgentEvent::ProgressUpdate { session_id, .. } => session_id,
            AgentEvent::Notification { session_id, .. } => session_id,
            AgentEvent::FileOperation { session_id, .. } => session_id,
            AgentEvent::TerminalOutput { session_id, .. } => session_id,
            AgentEvent::Raw { session_id, .. } => session_id,
        }
    }

    pub fn is_terminal(&self) -> bool {
        matches!(
            self,
            AgentEvent::TurnCompleted { .. } | AgentEvent::TurnError { .. }
        )
    }

    pub fn requires_action(&self) -> bool {
        matches!(self, AgentEvent::ApprovalRequest { .. })
    }
}
