//! GitHub Copilot Integration Module
#![allow(dead_code)]
//!
//! Handles integration with GitHub Copilot CLI (gh copilot).

use anyhow::Result;
use riterm_shared::message_protocol::{AgentMessageContent, NotificationLevel};

/// Copilot Output Parser
pub struct CopilotOutputParser;

impl CopilotOutputParser {
    pub fn new() -> Result<Self> {
        Ok(Self)
    }

    pub fn parse_line(&self, line: &str) -> CopilotParseResult {
        let line = line.trim();
        if line.is_empty() {
            return CopilotParseResult::Empty;
        }

        // TODO: Add specific parsing logic for Copilot CLI output
        CopilotParseResult::Output {
            content: line.to_string(),
        }
    }
}

pub enum CopilotParseResult {
    Empty,
    Output { content: String },
    // Add more variants as needed
}

impl CopilotParseResult {
    pub fn to_message_content(self) -> AgentMessageContent {
        match self {
            CopilotParseResult::Empty => AgentMessageContent::SystemNotification {
                level: NotificationLevel::Info,
                message: String::new(),
            },
            CopilotParseResult::Output { content } => AgentMessageContent::AgentResponse {
                content,
                thinking: false,
                message_id: None,
            },
        }
    }
}

pub fn check_copilot_available() -> Result<bool> {
    let output = std::process::Command::new("gh")
        .args(["copilot", "--version"])
        .output()?;
    Ok(output.status.success())
}
