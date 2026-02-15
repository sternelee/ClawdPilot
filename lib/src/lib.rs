// RiTerm Shared Library
//
// This library contains shared functionality used by both CLI and App crates,
// primarily AI agent management and session handling.

pub mod agent;

// Re-export commonly used types from agent module
pub use agent::AgentManager;
pub use agent::StreamingAgentSession;
pub use agent::AgentTurnEvent;
pub use agent::{Agent, AgentFactory};
pub use agent::{AgentConfig, AgentSession};
pub use agent::message_adapter;
