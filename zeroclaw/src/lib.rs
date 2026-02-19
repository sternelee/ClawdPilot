//! ZeroClaw — lightweight AI agent with multi-provider LLM support, tool execution, and memory.
//!
//! This crate provides the core agent functionality for ClawdChat's built-in ZeroClaw agent,
//! supporting 22+ LLM providers, shell/file tools, SQLite memory, and security policies.

pub mod agent;
pub mod config;
pub mod memory;
pub mod providers;
pub mod runtime;
pub mod security;
pub mod tools;
pub mod util;

// Core functionality modules
pub mod cron;
pub mod rag;
pub mod skillforge;
pub mod skills;

// Re-export common types
pub use tools::Tool;
pub use tools::{ToolResult, ToolSpec};

// Skill commands enum (for CLI integration)
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, PartialEq, Eq)]
pub enum SkillCommands {
    /// List all installed skills
    List,
    /// Install a new skill from a URL or local path
    Install {
        /// Source URL or local path
        source: String,
    },
    /// Remove an installed skill
    Remove {
        /// Skill name to remove
        name: String,
    },
}
