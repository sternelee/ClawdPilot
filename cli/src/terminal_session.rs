use std::collections::HashMap;

use anyhow::{Context, Result};
use encoding_rs::CoderResult;
use riterm_shared::p2p::{TerminalInfo, TerminalStatus};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::sync::mpsc;
use tracing::{debug, error, info, warn};

use crate::terminal_driver::{get_default_shell, Terminal};

const BUFFER_SIZE: usize = 4096;
const CONTENT_ROLLING_BYTES: usize = 8 << 20; // 8MB

/// Terminal session management
pub struct TerminalSession {
    pub session_id: String,
    terminal: Terminal,
    pub name: Option<String>,
    pub shell_type: String,
    pub current_dir: String,
    pub status: TerminalStatus,
    pub created_at: std::time::SystemTime,
    pub last_activity: std::time::SystemTime,
    pub size: (u16, u16),
    pub process_id: Option<u32>,
    decoder: encoding_rs::Decoder,
    content: String,
    content_offset: usize,
    sequence: u64,
    pub associated_webshares: Vec<u16>,
    output_callback: Option<Box<dyn Fn(String, String) + Send + Sync>>,
}

impl TerminalSession {
    pub async fn new(
        session_id: String,
        name: Option<String>,
        shell_path: Option<String>,
        working_dir: Option<String>,
        size: Option<(u16, u16)>,
    ) -> Result<Self> {
        let shell = match shell_path {
            Some(shell) => shell,
            None => get_default_shell().await,
        };

        info!(
            "Creating terminal session '{}' ({}) with shell: {}",
            session_id, name.as_deref().unwrap_or("unnamed"), shell
        );

        let mut terminal = Terminal::new(&shell)
            .await
            .context("Failed to create terminal")?;

        // Set terminal size
        let size = size.unwrap_or((24, 80));
        terminal
            .set_winsize(size.0, size.1)
            .context("Failed to set terminal size")?;

        // Get actual terminal size
        let actual_size = terminal.get_winsize().unwrap_or(size);

        let current_dir = working_dir.unwrap_or_else(|| std::env::current_dir()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string());

        let shell_type = extract_shell_type(&shell);

        let now = std::time::SystemTime::now();

        Ok(Self {
            session_id,
            terminal,
            name,
            shell_type,
            current_dir,
            status: TerminalStatus::Running,
            created_at: now,
            last_activity: now,
            size: actual_size,
            process_id: None, // We could try to get this from the child process
            decoder: encoding_rs::UTF_8.new_decoder(),
            content: String::new(),
            content_offset: 0,
            sequence: 0,
            associated_webshares: Vec::new(),
            output_callback: None,
        })
    }

    pub async fn run(mut self, mut command_rx: mpsc::Receiver<TerminalCommand>) -> Result<()> {
        let mut buf = [0u8; BUFFER_SIZE];
        let mut finished = false;

        // Notify that terminal is ready
        self.status = TerminalStatus::Running;
        info!("Terminal {} is ready", self.session_id);

        while !finished {
            tokio::select! {
                // Read from terminal
                result = self.terminal.read(&mut buf) => {
                    match result {
                        Ok(0) => {
                            // Terminal closed
                            finished = true;
                            self.status = TerminalStatus::Stopped;
                            info!("Terminal {} closed", self.session_id);
                        }
                        Ok(n) => {
                            // Process terminal output
                            self.process_terminal_output(&buf[..n]).await?;
                        }
                        Err(e) => {
                            error!("Terminal read error: {}", e);
                            self.status = TerminalStatus::Error(e.to_string());
                            finished = true;
                        }
                    }
                }

                // Handle commands
                Some(command) = command_rx.recv() => {
                    match command {
                        TerminalCommand::Input(data) => {
                            info!("🔥 TERMINAL SESSION RECEIVED INPUT: session_id={}, data={:?}", self.session_id, String::from_utf8_lossy(&data));
                            if let Err(e) = self.terminal.write_all(&data).await {
                                error!("Failed to write to terminal: {}", e);
                                self.status = TerminalStatus::Error(e.to_string());
                            } else {
                                info!("✅ Terminal session {} wrote input successfully", self.session_id);
                                // Flush the output to ensure it's sent immediately
                                if let Err(e) = self.terminal.flush().await {
                                    error!("Failed to flush terminal: {}", e);
                                } else {
                                    info!("✅ Terminal session {} flushed successfully", self.session_id);
                                }
                                self.last_activity = std::time::SystemTime::now();
                            }
                        }
                        TerminalCommand::Resize(rows, cols) => {
                            if let Err(e) = self.terminal.set_winsize(rows, cols) {
                                error!("Failed to resize terminal: {}", e);
                            } else {
                                debug!("Resized terminal {} to {}x{}", self.session_id, rows, cols);
                                self.size = (rows, cols);
                                self.last_activity = std::time::SystemTime::now();
                            }
                        }
                        TerminalCommand::Close => {
                            info!("Closing terminal session {}", self.session_id);
                            finished = true;
                            self.status = TerminalStatus::Stopped;
                        }
                        TerminalCommand::Rename(new_name) => {
                            info!("Renaming terminal session '{}' to '{:?}'", self.session_id, new_name);
                            self.name = new_name;
                        }
                    }
                }

                // Command channel closed
                else => {
                    info!("Command channel closed for terminal {}", self.session_id);
                    finished = true;
                    self.status = TerminalStatus::Stopped;
                }
            }
        }

        info!("Terminal session {} ended", self.session_id);
        Ok(())
    }

    async fn process_terminal_output(&mut self, data: &[u8]) -> Result<()> {
        // Update last activity time
        self.last_activity = std::time::SystemTime::now();

        // Decode UTF-8
        self.content
            .reserve(self.decoder.max_utf8_buffer_length(data.len()).unwrap_or(0));
        let (result, _, _) = self
            .decoder
            .decode_to_string(data, &mut self.content, false);

        if result != CoderResult::InputEmpty {
            warn!("UTF-8 decoding error in terminal output");
        }

        // Update sequence to track processed data
        let total_content_len = (self.content_offset + self.content.len()) as u64;
        info!("🔥 OUTPUT PROCESSING: session_id={}, total_content_len={}, sequence={}", self.session_id, total_content_len, self.sequence);

        if total_content_len > self.sequence {
            let start_offset = (self.sequence - self.content_offset as u64) as usize;
            let start = self.prev_char_boundary(start_offset);
            let end = self.prev_char_boundary((start + BUFFER_SIZE).min(self.content.len()));

            info!("🔥 OUTPUT PROCESSING DETAILS: session_id={}, start_offset={}, start={}, end={}, content_len={}",
                  self.session_id, start_offset, start, end, self.content.len());

            if start < end {
                // Get the new output data
                let output_data = &self.content[start..end];

                info!("🔥 SENDING OUTPUT DATA: session_id={}, data='{}'", self.session_id, output_data);

                // Send output via callback if available
                if let Some(ref callback) = self.output_callback {
                    tracing::info!("🔥 TERMINAL SESSION PRODUCING OUTPUT: session_id={}, data='{}'", self.session_id, output_data);
                    callback(self.session_id.clone(), output_data.to_string());
                } else {
                    tracing::warn!("⚠️ No output callback set for terminal session {}", self.session_id);
                }

                self.sequence = (self.content_offset + end) as u64;
            } else {
                info!("🔥 NO NEW OUTPUT TO SEND: start={}, end={}", start, end);
            }
        } else {
            info!("🔥 NO NEW CONTENT: total_content_len={} <= sequence={}", total_content_len, self.sequence);
        }

        // Prune old content to prevent memory growth
        if self.content.len() > CONTENT_ROLLING_BYTES
            && self.sequence > (self.content_offset + CONTENT_ROLLING_BYTES) as u64
        {
            let prune_amount =
                self.sequence - self.content_offset as u64 - CONTENT_ROLLING_BYTES as u64;
            let pruned = self.prev_char_boundary(prune_amount as usize);
            self.content.drain(..pruned);
            self.content_offset += pruned;
        }

        Ok(())
    }

    fn prev_char_boundary(&self, index: usize) -> usize {
        (0..=index)
            .rev()
            .find(|&i| self.content.is_char_boundary(i))
            .unwrap_or(0)
    }

    /// 设置终端输出回调
    pub fn set_output_callback<F>(&mut self, callback: F)
    where
        F: Fn(String, String) + Send + Sync + 'static,
    {
        self.output_callback = Some(Box::new(callback));
    }

    pub fn to_terminal_info(&self) -> TerminalInfo {
        TerminalInfo {
            id: self.session_id.clone(),
            name: self.name.clone(),
            shell_type: self.shell_type.clone(),
            current_dir: self.current_dir.clone(),
            status: self.status.clone(),
            created_at: self
                .created_at
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs(),
            last_activity: self
                .last_activity
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs(),
            size: self.size,
            process_id: self.process_id,
            associated_webshares: self.associated_webshares.clone(),
        }
    }
}

/// Commands that can be sent to a terminal session
pub enum TerminalCommand {
    Input(Vec<u8>),
    Resize(u16, u16),
    Close,
    Rename(Option<String>),
}

fn extract_shell_type(shell_path: &str) -> String {
    let shell_name = std::path::Path::new(shell_path)
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or(shell_path);

    match shell_name.to_lowercase().as_str() {
        "bash" => "Bash".to_string(),
        "zsh" => "Zsh".to_string(),
        "fish" => "Fish".to_string(),
        "sh" => "Sh".to_string(),
        "cmd.exe" | "cmd" => "Command Prompt".to_string(),
        "powershell.exe" | "powershell" => "PowerShell".to_string(),
        "pwsh.exe" | "pwsh" => "PowerShell Core".to_string(),
        _ => shell_name.to_string(),
    }
}