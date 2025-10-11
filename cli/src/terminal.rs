// Terminal recording and session management module
// Currently unused in agent mode but kept for future compatibility

use riterm_shared::{SessionInfo, TerminalEvent};
use std::io::Write;

/// Filter out unwanted terminal output strings
fn filter_terminal_output(data: &str) -> String {
    // Remove "1;2c" string from terminal output
    data.replace("1;2c", "")
}

/// Terminal raw mode RAII wrapper
struct RawModeGuard;

impl RawModeGuard {
    fn new() -> anyhow::Result<()> {
        crossterm::terminal::enable_raw_mode()?;
        Ok(())
    }
}

impl Drop for RawModeGuard {
    fn drop(&mut self) {
        let _ = crossterm::terminal::disable_raw_mode();
    }
}

/// PTY resources RAII wrapper
struct PtyResources {
    reader: Box<dyn std::io::Read + Send>,
    writer: Box<dyn std::io::Write + Send>,
    _pty_pair: portable_pty::PtyPair,
}

impl PtyResources {
    fn new(
        shell_config: &crate::shell::ShellConfig,
        width: u16,
        height: u16,
        session_id: &str,
    ) -> anyhow::Result<(Self, Box<dyn portable_pty::Child + Send + Sync>)> {
        let pty_system = portable_pty::native_pty_system();
        let pty_size = portable_pty::PtySize {
            rows: height,
            cols: width,
            pixel_width: 0,
            pixel_height: 0,
        };

        let pty_pair = pty_system.openpty(pty_size)?;

        let command = shell_config.shell_type.get_command_path();
        let mut cmd = portable_pty::CommandBuilder::new(command);

        cmd.env("RITERM_SESSION_ID", session_id);

        let child = pty_pair.slave.spawn_command(cmd)?;

        let reader = pty_pair.master.try_clone_reader()?;
        let writer = pty_pair.master.take_writer()?;

        let resources = Self {
            reader,
            writer,
            _pty_pair: pty_pair,
        };

        Ok((resources, child))
    }
}

/// Log recorder for terminal output
pub struct LogRecorder {
    session_id: String,
}

impl LogRecorder {
    pub async fn new(session_id: String) -> anyhow::Result<Self> {
        Ok(Self { session_id })
    }

    pub async fn write_log(&mut self, _data: &str) -> anyhow::Result<()> {
        // Placeholder implementation
        Ok(())
    }

    pub fn get_logs(&self) -> &str {
        ""
    }

    pub async fn close(&mut self) -> anyhow::Result<()> {
        Ok(())
    }
}

/// Terminal session recorder
#[derive(Clone)]
pub struct TerminalRecorder {
    session_id: String,
}

impl TerminalRecorder {
    pub async fn new(
        session_id: String,
        _shell_type: String,
    ) -> anyhow::Result<(Self, tokio::sync::mpsc::UnboundedReceiver<TerminalEvent>)> {
        let (_event_sender, event_receiver) = tokio::sync::mpsc::unbounded_channel();

        let recorder = Self { session_id };
        Ok((recorder, event_receiver))
    }

    pub fn get_event_sender(&self) -> &tokio::sync::mpsc::UnboundedSender<TerminalEvent> {
        // This method shouldn't be called in current simplified implementation
        // but we need to return something for compilation
        static DUMMY_SENDER: std::sync::OnceLock<
            tokio::sync::mpsc::UnboundedSender<TerminalEvent>,
        > = std::sync::OnceLock::new();
        DUMMY_SENDER.get_or_init(|| {
            let (sender, _) = tokio::sync::mpsc::unbounded_channel();
            sender
        })
    }

    pub fn get_session_id(&self) -> &str {
        &self.session_id
    }

    pub async fn get_session_info(&self) -> SessionInfo {
        SessionInfo {
            logs: String::new(),
            shell: "unknown".to_string(),
            cwd: std::env::current_dir()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string(),
        }
    }

    pub async fn send_history_to_new_participant(&self) -> anyhow::Result<SessionInfo> {
        Ok(self.get_session_info().await)
    }

    pub fn record_input(&self, _data: &[u8]) -> anyhow::Result<()> {
        // Placeholder implementation
        Ok(())
    }

    pub fn record_output(&self, _data: &[u8]) -> anyhow::Result<()> {
        // Placeholder implementation
        Ok(())
    }

    pub fn record_resize(&self, _width: u16, _height: u16) -> anyhow::Result<()> {
        // Placeholder implementation
        Ok(())
    }

    pub fn handle_remote_input(&self, data: &str, writer: &mut dyn Write) -> anyhow::Result<()> {
        writer.write_all(data.as_bytes())?;
        writer.flush()?;
        Ok(())
    }

    pub async fn save_to_file(&self, _file_path: &str) -> anyhow::Result<()> {
        // Placeholder implementation
        Ok(())
    }

    pub async fn start_passthrough_session_with_config(
        &self,
        _shell_config: &crate::shell::ShellConfig,
        _width: u16,
        _height: u16,
        _pty_input_receiver: Option<tokio::sync::mpsc::UnboundedReceiver<String>>,
    ) -> anyhow::Result<()> {
        // Placeholder implementation
        Ok(())
    }

    pub fn start_session_with_config(
        &self,
        _shell_config: &crate::shell::ShellConfig,
        _width: u16,
        _height: u16,
        _pty_input_receiver: Option<tokio::sync::mpsc::UnboundedReceiver<String>>,
    ) -> anyhow::Result<()> {
        // Placeholder implementation
        Ok(())
    }

    pub async fn start_passthrough_session(
        &self,
        _command: &str,
        _width: u16,
        _height: u16,
    ) -> anyhow::Result<()> {
        // Placeholder implementation
        Ok(())
    }

    pub fn start_session(&self, _command: &str, _width: u16, _height: u16) -> anyhow::Result<()> {
        // Placeholder implementation
        Ok(())
    }
}

