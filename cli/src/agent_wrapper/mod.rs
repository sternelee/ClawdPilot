//! AI Agent 管理模块
//!
//! 此模块负责启动和管理各种 AI 编码代理（Claude Code, OpenCode, Gemini 等），
//! 并处理与它们的 stdin/stdout 通信。

pub mod acp;
pub mod claude;
pub mod claude_streaming;
pub mod codex;
pub mod copilot;
pub mod events;
pub mod factory;
pub mod gemini;
pub mod generic_streaming;
pub mod message_adapter;
pub mod opencode;
pub mod qwen;
pub mod session;

pub use events::AgentTurnEvent;
pub use factory::{Agent, AgentFactory};
pub use session::{AgentConfig, AgentSession};

use anyhow::Result;
use riterm_shared::message_protocol::{
    AgentControlAction, AgentMessageContent, AgentSessionMetadata, AgentType,
};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::{RwLock, broadcast};
use tracing::{debug, error, info, warn};
use uuid::Uuid;

use crate::agent_wrapper::acp::AcpStreamingSession;
use crate::agent_wrapper::claude_streaming::ClaudeStreamingSession;
use crate::agent_wrapper::generic_streaming::GenericStreamingSession;

/// AI Agent 管理器
///
/// 负责启动和管理 AI Agent 进程，处理消息转发
pub struct AgentManager {
    /// 活跃的 Agent 会话（使用新的 streaming session）
    streaming_sessions: Arc<RwLock<HashMap<String, Arc<dyn StreamingAgentSession>>>>,
    /// 会话元数据
    session_metadata: Arc<RwLock<HashMap<String, AgentSessionMetadata>>>,
    /// 事件转发任务
    event_tasks: Arc<RwLock<HashMap<String, tokio::task::JoinHandle<()>>>>,
}

/// Trait for streaming agent sessions (internal use)
#[async_trait::async_trait]
pub trait StreamingAgentSession: Send + Sync {
    /// Get the session ID
    #[allow(dead_code)]
    fn session_id(&self) -> &str;

    /// Get the agent type
    #[allow(dead_code)]
    fn agent_type(&self) -> AgentType;

    /// Subscribe to agent events
    fn subscribe(&self) -> broadcast::Receiver<AgentTurnEvent>;

    /// Send a message to the agent
    async fn send_message(&self, text: String, turn_id: &str) -> Result<(), String>;

    /// Interrupt the current operation
    async fn interrupt(&self) -> Result<(), String>;

    /// Shutdown the session and release resources
    async fn shutdown(&self) -> Result<(), String> {
        self.interrupt().await
    }
}

impl AgentManager {
    /// 创建新的 AgentManager
    pub fn new() -> Self {
        Self {
            streaming_sessions: Arc::new(RwLock::new(HashMap::new())),
            session_metadata: Arc::new(RwLock::new(HashMap::new())),
            event_tasks: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// 启动 AI Agent 会话
    ///
    /// # Arguments
    /// * `agent_type` - AI Agent 类型
    /// * `project_path` - 项目路径
    /// * `args` - 额外的命令行参数
    ///
    /// # Returns
    /// 返回会话 ID 和元数据
    pub async fn start_session(
        &self,
        agent_type: AgentType,
        project_path: String,
        args: Vec<String>,
    ) -> Result<(String, AgentSessionMetadata)> {
        // Generate a new session ID
        let session_id = Uuid::new_v4().to_string();
        self.start_session_with_id(session_id, agent_type, project_path, args)
            .await
    }

    /// 启动 AI Agent 会话（使用指定的会话 ID）
    ///
    /// # Arguments
    /// * `session_id` - 指定的会话 ID（来自 App 端）
    /// * `agent_type` - AI Agent 类型
    /// * `project_path` - 项目路径
    ///
    /// # Returns
    /// 返回会话 ID 和元数据
    pub async fn start_session_with_id(
        &self,
        session_id: String,
        agent_type: AgentType,
        project_path: String,
        args: Vec<String>,
    ) -> Result<(String, AgentSessionMetadata)> {
        info!(
            "Starting AI Agent session with ID {}: {:?} in {}",
            session_id, agent_type, project_path
        );

        // Expand ~ (both ASCII ~ and full-width ～) to home directory
        let expanded_path = if project_path.starts_with("~/") || project_path.starts_with("～/") {
            if let Some(home) = std::env::var("HOME")
                .ok()
                .or_else(|| std::env::var("USERPROFILE").ok())
            {
                // Replace both tilde variants with home directory
                let path = project_path
                    .replacen("~", &home, 1)
                    .replacen("～", &home, 1);
                if !path.starts_with("/") && !path.starts_with("\\") {
                    format!(
                        "{}/{}",
                        home.trim_end_matches('/'),
                        path.trim_start_matches(|c| c == '~' || c == '／')
                    )
                } else {
                    path
                }
            } else {
                project_path.clone()
            }
        } else {
            project_path.clone()
        };

        // 获取系统信息构建元数据
        let metadata = self
            .build_session_metadata(session_id.clone(), agent_type, expanded_path.clone())
            .await;

        let session: Arc<dyn StreamingAgentSession> =
            if let Some(candidates) = Self::resolve_acp_commands(agent_type, args)? {
                let mut last_error: Option<anyhow::Error> = None;
                let mut started: Option<AcpStreamingSession> = None;

                for (command, command_args) in candidates {
                    match AcpStreamingSession::spawn(
                        session_id.clone(),
                        agent_type,
                        command.clone(),
                        command_args.clone(),
                        PathBuf::from(&expanded_path),
                    )
                    .await
                    {
                        Ok(acp_session) => {
                            info!(
                                "ACP session launched for {:?} using command '{}' with args {:?}",
                                agent_type, command, command_args
                            );
                            started = Some(acp_session);
                            break;
                        }
                        Err(err) => {
                            warn!(
                                "ACP launch failed for {:?} using command '{}' with args {:?}: {}",
                                agent_type, command, command_args, err
                            );
                            last_error = Some(err);
                        }
                    }
                }

                let acp_session = started.ok_or_else(|| {
                    last_error.unwrap_or_else(|| anyhow::anyhow!("No ACP launch candidates"))
                })?;
                Arc::new(acp_session)
            } else {
                match agent_type {
                    AgentType::ClaudeCode => {
                        let session = ClaudeStreamingSession::new(
                            session_id.clone(),
                            PathBuf::from(&expanded_path),
                            Some(AgentConfig::default()),
                        );
                        Arc::new(session)
                    }
                    AgentType::Copilot => {
                        let session = GenericStreamingSession::new(
                            session_id.clone(),
                            AgentType::Copilot,
                            "gh".to_string(),
                            vec!["copilot".to_string(), "explain".to_string()],
                            PathBuf::from(&expanded_path),
                        );
                        Arc::new(session)
                    }
                    AgentType::Qwen => {
                        let session = GenericStreamingSession::new(
                            session_id.clone(),
                            AgentType::Qwen,
                            "qwen-agent".to_string(),
                            vec![],
                            PathBuf::from(&expanded_path),
                        );
                        Arc::new(session)
                    }
                    AgentType::Custom => {
                        return Err(anyhow::anyhow!(
                            "Custom agent requires command args in ACP mode"
                        ));
                    }
                    _ => {
                        return Err(anyhow::anyhow!(
                            "No available session implementation for {:?}",
                            agent_type
                        ));
                    }
                }
            };

        // Store the session
        {
            let mut sessions = self.streaming_sessions.write().await;
            sessions.insert(session_id.clone(), session.clone());
        }

        // Store metadata
        {
            let mut meta = self.session_metadata.write().await;
            meta.insert(session_id.clone(), metadata.clone());
        }

        info!("AI Agent session started: {}", session_id);
        Ok((session_id, metadata))
    }

    /// 构建会话元数据
    async fn build_session_metadata(
        &self,
        session_id: String,
        agent_type: AgentType,
        project_path: String,
    ) -> AgentSessionMetadata {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();

        // 获取 git 分支
        let git_branch = self.get_git_branch(&project_path).await;

        // 获取系统信息
        let hostname = gethostname::gethostname().to_string_lossy().to_string();
        let os = std::env::consts::OS.to_string();

        // 获取 agent 版本
        let agent_version = self.get_agent_version(&agent_type).await;

        // 获取当前目录
        let current_dir = std::env::current_dir()
            .ok()
            .and_then(|p| p.to_str().map(String::from))
            .unwrap_or_else(|| project_path.clone());

        AgentSessionMetadata {
            session_id,
            agent_type,
            project_path,
            started_at: now,
            active: true,
            controlled_by_remote: false,
            hostname,
            os,
            agent_version,
            current_dir,
            git_branch,
            machine_id: gethostname::gethostname().to_string_lossy().to_string(),
        }
    }

    /// 获取 git 分支
    async fn get_git_branch(&self, project_path: &str) -> Option<String> {
        let output = tokio::process::Command::new("git")
            .args(["rev-parse", "--abbrev-ref", "HEAD"])
            .current_dir(project_path)
            .output()
            .await;

        output.ok().and_then(|o| {
            let branch = String::from_utf8_lossy(&o.stdout).trim().to_string();
            if branch.is_empty() || branch == "HEAD" {
                None
            } else {
                Some(branch)
            }
        })
    }

    /// 获取 agent 版本
    async fn get_agent_version(&self, agent_type: &AgentType) -> Option<String> {
        match agent_type {
            AgentType::ClaudeCode => self.run_version_cmd("claude", &["--version"]).await,
            AgentType::OpenCode => self.run_version_cmd("opencode", &["--version"]).await,
            AgentType::Codex => self.run_version_cmd("codex", &["--version"]).await,
            AgentType::Gemini => self.run_version_cmd("gemini", &["--version"]).await,
            AgentType::Copilot => self.run_version_cmd("gh", &["copilot", "--version"]).await,
            AgentType::Qwen => self.run_version_cmd("qwen-agent", &["--version"]).await,
            AgentType::Custom => None,
        }
    }

    /// Helper to run version command
    async fn run_version_cmd(&self, cmd: &str, args: &[&str]) -> Option<String> {
        let output = tokio::process::Command::new(cmd).args(args).output().await;

        output.ok().and_then(|o| {
            let version = String::from_utf8_lossy(&o.stdout).trim().to_string();
            if version.is_empty() {
                None
            } else {
                Some(version)
            }
        })
    }

    fn resolve_acp_commands(
        agent_type: AgentType,
        extra_args: Vec<String>,
    ) -> Result<Option<Vec<(String, Vec<String>)>>> {
        let mut candidates: Vec<(String, Vec<String>)> = Vec::new();
        let append = |mut base: Vec<String>, tail: &[String]| {
            base.extend_from_slice(tail);
            base
        };

        if agent_type == AgentType::Custom {
            let mut iter = extra_args.into_iter();
            let command = iter
                .next()
                .ok_or_else(|| anyhow::anyhow!("Custom ACP agent requires command and args"))?;
            return Ok(Some(vec![(command, iter.collect())]));
        }

        match agent_type {
            // ACP registry indicates Claude Code should use Zed's adapter.
            AgentType::ClaudeCode => {
                candidates.push(("claude-code-acp".to_string(), extra_args.clone()));
                candidates.push((
                    "npx".to_string(),
                    append(
                        vec![
                            "-y".to_string(),
                            "@zed-industries/claude-code-acp@0.16.1".to_string(),
                        ],
                        &extra_args,
                    ),
                ));
            }
            AgentType::Gemini => {
                candidates.push((
                    "gemini".to_string(),
                    append(vec!["--experimental-acp".to_string()], &extra_args),
                ));
                candidates.push((
                    "npx".to_string(),
                    append(
                        vec![
                            "-y".to_string(),
                            "@google/gemini-cli@0.28.2".to_string(),
                            "--experimental-acp".to_string(),
                        ],
                        &extra_args,
                    ),
                ));
            }
            AgentType::OpenCode => {
                candidates.push((
                    "opencode".to_string(),
                    append(vec!["acp".to_string()], &extra_args),
                ));
            }
            AgentType::Codex => {
                candidates.push(("codex-acp".to_string(), extra_args.clone()));
            }
            AgentType::Copilot => {
                candidates.push((
                    "npx".to_string(),
                    append(
                        vec![
                            "-y".to_string(),
                            "@github/copilot-language-server@1.430.0".to_string(),
                            "--acp".to_string(),
                        ],
                        &extra_args,
                    ),
                ));
            }
            AgentType::Qwen => {
                candidates.push((
                    "qwen".to_string(),
                    append(
                        vec!["--acp".to_string(), "--experimental-skills".to_string()],
                        &extra_args,
                    ),
                ));
                candidates.push((
                    "qwen-code".to_string(),
                    append(
                        vec!["--acp".to_string(), "--experimental-skills".to_string()],
                        &extra_args,
                    ),
                ));
                candidates.push((
                    "npx".to_string(),
                    append(
                        vec![
                            "-y".to_string(),
                            "@qwen-code/qwen-code@0.10.1".to_string(),
                            "--acp".to_string(),
                            "--experimental-skills".to_string(),
                        ],
                        &extra_args,
                    ),
                ));
            }
            AgentType::Custom => {}
        }

        if !candidates.is_empty() {
            return Ok(Some(candidates));
        }

        Ok(None)
    }

    /// Subscribe to session events
    pub async fn subscribe(&self, session_id: &str) -> Option<broadcast::Receiver<AgentTurnEvent>> {
        let sessions = self.streaming_sessions.read().await;
        sessions.get(session_id).map(|s| s.subscribe())
    }

    /// 发送消息到 Agent
    pub async fn send_to_agent(&self, session_id: &str, content: String) -> Result<()> {
        debug!(
            "Attempting to send to agent session_id: '{}', content: '{}'",
            session_id, content
        );

        let sessions = self.streaming_sessions.read().await;

        if !sessions.contains_key(session_id) {
            let available_ids: Vec<&str> = sessions.keys().map(|s| s.as_str()).collect();
            warn!(
                "Session '{}' not found. Available sessions: {:?}",
                session_id, available_ids
            );
            return Err(anyhow::anyhow!("Session not found: {}", session_id));
        }

        let session = sessions
            .get(session_id)
            .ok_or_else(|| anyhow::anyhow!("Session not found: {}", session_id))?;

        let turn_id = Uuid::new_v4().to_string();
        session
            .send_message(content, &turn_id)
            .await
            .map_err(|e| anyhow::anyhow!("Failed to send message: {}", e))?;

        debug!("Sent message to agent {}", session_id);
        Ok(())
    }

    /// 发送控制命令到 Agent
    pub async fn send_control(&self, session_id: &str, action: AgentControlAction) -> Result<()> {
        info!(
            "[AgentManager] send_control called: session_id='{}', action={:?}",
            session_id, action
        );

        let sessions = self.streaming_sessions.read().await;
        let session = sessions.get(session_id).ok_or_else(|| {
            error!("[AgentManager] Session not found: {}", session_id);
            anyhow::anyhow!("Session not found: {}", session_id)
        })?;

        match action {
            AgentControlAction::SendInput { content } => {
                let turn_id = Uuid::new_v4().to_string();
                info!(
                    "[AgentManager] Sending message to session {}: turn_id={}",
                    session_id, turn_id
                );
                session.send_message(content, &turn_id).await.map_err(|e| {
                    error!("[AgentManager] Failed to send message: {}", e);
                    anyhow::anyhow!("Failed to send message: {}", e)
                })?;
                info!(
                    "[AgentManager] Message sent successfully to session {}",
                    session_id
                );
            }
            AgentControlAction::SendInterrupt => {
                session
                    .interrupt()
                    .await
                    .map_err(|e| anyhow::anyhow!("Failed to interrupt: {}", e))?;
            }
            AgentControlAction::Terminate => {
                drop(sessions); // Release read lock
                self.stop_session(session_id).await?;
            }
            AgentControlAction::Pause | AgentControlAction::Resume => {
                // These are handled at the manager level
            }
            AgentControlAction::GetStatus => {
                // Return status info
            }
        }

        Ok(())
    }

    /// 处理权限请求
    #[allow(dead_code)]
    pub async fn handle_permission_request(
        &self,
        session_id: &str,
        tool_name: String,
        _tool_params: serde_json::Value,
    ) -> Result<String> {
        let request_id = Uuid::new_v4().to_string();

        info!(
            "Permission request created: {} for tool {} in session {}",
            request_id, tool_name, session_id
        );

        Ok(request_id)
    }

    /// 处理权限响应
    #[allow(dead_code)]
    pub async fn handle_permission_response(
        &self,
        session_id: &str,
        request_id: &str,
        approved: bool,
        reason: Option<String>,
    ) -> Result<()> {
        info!(
            "Permission response received: {} approved={}",
            request_id, approved
        );

        // TODO: Forward permission response to the agent session
        let _ = (session_id, approved, reason);

        Ok(())
    }

    /// 停止会话
    pub async fn stop_session(&self, session_id: &str) -> Result<()> {
        info!("Stopping session: {}", session_id);

        // Remove and interrupt the session
        {
            let sessions = self.streaming_sessions.read().await;
            if let Some(session) = sessions.get(session_id) {
                let _ = session.shutdown().await;
            }
        }

        // Remove from all maps
        {
            let mut sessions = self.streaming_sessions.write().await;
            sessions.remove(session_id);
        }
        {
            let mut meta = self.session_metadata.write().await;
            meta.remove(session_id);
        }
        {
            let mut tasks = self.event_tasks.write().await;
            if let Some(handle) = tasks.remove(session_id) {
                handle.abort();
            }
        }

        info!("Session stopped: {}", session_id);
        Ok(())
    }

    /// 获取会话元数据
    pub async fn get_session_metadata(&self, session_id: &str) -> Option<AgentSessionMetadata> {
        let meta = self.session_metadata.read().await;
        meta.get(session_id).cloned()
    }

    /// 获取所有活跃会话
    pub async fn list_sessions(&self) -> Vec<AgentSessionMetadata> {
        let meta = self.session_metadata.read().await;
        meta.values().cloned().collect()
    }

    /// 检查会话是否存在
    #[allow(dead_code)]
    pub async fn session_exists(&self, session_id: &str) -> bool {
        let sessions = self.streaming_sessions.read().await;
        sessions.contains_key(session_id)
    }

    /// 设置远程控制状态
    #[allow(dead_code)]
    pub async fn set_remote_control(&self, session_id: &str, controlled: bool) -> Result<()> {
        let mut meta = self.session_metadata.write().await;
        let metadata = meta
            .get_mut(session_id)
            .ok_or_else(|| anyhow::anyhow!("Session not found: {}", session_id))?;

        metadata.controlled_by_remote = controlled;

        Ok(())
    }
}

impl Default for AgentManager {
    fn default() -> Self {
        Self::new()
    }
}

/// Agent 输出处理器
///
/// 从 Agent stdout 读取输出并转换为 RiTerm 消息
#[allow(dead_code)]
pub struct AgentOutputHandler {
    session_id: String,
    agent_type: AgentType,
}

#[allow(dead_code)]
impl AgentOutputHandler {
    pub fn new(session_id: String, agent_type: AgentType) -> Self {
        Self {
            session_id,
            agent_type,
        }
    }

    /// 解析 Agent 输出
    pub fn parse_output(&self, line: &str) -> Option<AgentMessageContent> {
        // 这里需要根据不同的 agent 类型解析输出
        // Claude Code, OpenCode, Codex, Gemini 的输出格式不同

        match self.agent_type {
            AgentType::ClaudeCode => self.parse_claude_output(line),
            AgentType::OpenCode => self.parse_opencode_output(line),
            AgentType::Codex => self.parse_codex_output(line),
            AgentType::Gemini => self.parse_gemini_output(line),
            AgentType::Copilot => self.parse_copilot_output(line),
            AgentType::Qwen => self.parse_qwen_output(line),
            AgentType::Custom => self.parse_custom_output(line),
        }
    }

    fn parse_claude_output(&self, line: &str) -> Option<AgentMessageContent> {
        // 使用 ClaudeOutputParser 解析输出
        let parser = claude::ClaudeOutputParser::new().ok()?;
        let parse_result = parser.parse_line(line);
        Some(parse_result.to_message_content())
    }

    fn parse_opencode_output(&self, line: &str) -> Option<AgentMessageContent> {
        // 使用 OpenCodeOutputParser 解析输出
        let parser = opencode::OpenCodeOutputParser::new().ok()?;
        let parse_result = parser.parse_line(line);
        Some(parse_result.to_message_content())
    }

    fn parse_codex_output(&self, line: &str) -> Option<AgentMessageContent> {
        // 使用 CodexOutputParser 解析输出
        let parser = codex::CodexOutputParser::new().ok()?;
        let parse_result = parser.parse_line(line);
        Some(parse_result.to_message_content())
    }

    fn parse_gemini_output(&self, line: &str) -> Option<AgentMessageContent> {
        // 使用 GeminiOutputParser 解析输出
        let parser = gemini::GeminiOutputParser::new().ok()?;
        let parse_result = parser.parse_line(line);
        Some(parse_result.to_message_content())
    }

    fn parse_copilot_output(&self, line: &str) -> Option<AgentMessageContent> {
        // Use CopilotOutputParser
        let parser = copilot::CopilotOutputParser::new().ok()?;
        let parse_result = parser.parse_line(line);
        Some(parse_result.to_message_content())
    }

    fn parse_qwen_output(&self, line: &str) -> Option<AgentMessageContent> {
        // Use QwenOutputParser
        let parser = qwen::QwenOutputParser::new().ok()?;
        let parse_result = parser.parse_line(line);
        Some(parse_result.to_message_content())
    }

    fn parse_custom_output(&self, line: &str) -> Option<AgentMessageContent> {
        // 自定义 agent 输出解析
        Some(AgentMessageContent::AgentResponse {
            content: line.to_string(),
            thinking: false,
            message_id: None,
        })
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
    async fn test_session_not_exists() {
        let manager = AgentManager::new();
        assert!(!manager.session_exists("fake-id").await);
    }
}
