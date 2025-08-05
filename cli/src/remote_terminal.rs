use anyhow::{Context, Result};
use portable_pty::{CommandBuilder, PtySize, native_pty_system};
use std::io::{Read, Write};
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};
use tokio::io::AsyncReadExt;
use tokio::sync::{mpsc, broadcast, Mutex};
use tracing::{debug, error, info, warn};

use crate::shell::ShellConfig;
use crate::terminal::{TerminalEvent, EventType, TerminalRecorder};

pub struct RemoteInputTerminalRecorder {
    inner: TerminalRecorder,
    pty_writer: Arc<Mutex<Option<Box<dyn Write + Send>>>>,
    remote_input_receiver: broadcast::Receiver<TerminalEvent>,
}

impl RemoteInputTerminalRecorder {
    pub fn new(
        session_id: String,
        remote_input_receiver: broadcast::Receiver<TerminalEvent>,
    ) -> (Self, mpsc::UnboundedReceiver<TerminalEvent>) {
        let (inner, event_receiver) = TerminalRecorder::new(session_id);

        // Create a resilient receiver that resubscribes to prevent channel closure issues
        let resilient_receiver = remote_input_receiver.resubscribe();

        let recorder = Self {
            inner,
            pty_writer: Arc::new(Mutex::new(None)),
            remote_input_receiver: resilient_receiver,
        };

        (recorder, event_receiver)
    }

    pub async fn start_session_with_config_and_remote_input(
        &mut self,
        shell_config: &ShellConfig,
        width: u16,
        height: u16,
    ) -> Result<()> {
        let (command, args) = shell_config.get_full_command();
        info!(
            "Starting terminal session with remote input: {} {}",
            command,
            args.join(" ")
        );

        let pty_system = native_pty_system();
        let pty_size = PtySize {
            rows: height,
            cols: width,
            pixel_width: 0,
            pixel_height: 0,
        };

        let pty_pair = pty_system.openpty(pty_size).context("Failed to open PTY")?;

        let mut cmd = CommandBuilder::new(&command);
        for arg in &args {
            cmd.arg(arg);
        }

        // Set environment variables from shell config
        for (key, value) in &shell_config.environment_vars {
            cmd.env(key, value);
        }
        cmd.env("RITERM_SESSION_ID", self.inner.get_session_id());

        let mut child = pty_pair
            .slave
            .spawn_command(cmd)
            .context("Failed to spawn command")?;

        let mut reader = pty_pair.master.try_clone_reader()?;
        let writer = pty_pair.master.take_writer()?;

        // Store the writer for remote input
        {
            let mut pty_writer_guard = self.pty_writer.lock().await;
            *pty_writer_guard = Some(writer);
        }

        let event_sender = self.inner.get_event_sender().clone();
        let start_event = TerminalEvent {
            timestamp: 0.0,
            event_type: EventType::Start,
            data: format!("{} {}", command, args.join(" ")),
        };
        event_sender.send(start_event)?;

        // Handle PTY output
        let inner_clone = self.inner.clone();
        let event_sender_clone = event_sender.clone();
        let output_task = tokio::spawn(async move {
            let mut buffer = [0u8; 8192];
            loop {
                match reader.read(&mut buffer) {
                    Ok(0) => {
                        debug!("PTY reader reached EOF");
                        break;
                    }
                    Ok(n) => {
                        let data = &buffer[..n];
                        if let Err(e) = std::io::stdout().write_all(data) {
                            error!("Failed to write to stdout: {}", e);
                            break;
                        }
                        std::io::stdout().flush().ok();

                        if let Err(e) = inner_clone.record_output(data) {
                            error!("Failed to record output: {}", e);
                        }
                    }
                    Err(e) => {
                        error!("Failed to read from PTY: {}", e);
                        break;
                    }
                }
            }

            let end_event = TerminalEvent {
                timestamp: std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_secs_f64(),
                event_type: EventType::End,
                data: String::new(),
            };
            event_sender_clone.send(end_event).ok();
        });

        // Handle local stdin input
        let pty_writer_clone = self.pty_writer.clone();
        let inner_clone2 = self.inner.clone();
        let input_task = tokio::spawn(async move {
            let mut stdin = tokio::io::stdin();
            let mut buffer = [0u8; 1024];

            loop {
                match stdin.read(&mut buffer).await {
                    Ok(0) => break,
                    Ok(n) => {
                        let data = &buffer[..n];

                        // Write to PTY
                        let mut writer_guard = pty_writer_clone.lock().await;
                        if let Some(ref mut writer) = writer_guard.as_mut() {
                            if let Err(e) = writer.write(data) {
                                error!("Failed to write to PTY: {}", e);
                                break;
                            }
                            writer.flush().ok();
                        }

                        // Record input
                        if let Err(e) = inner_clone2.record_input(data) {
                            error!("Failed to record input: {}", e);
                        }
                    }
                    Err(e) => {
                        error!("Failed to read from stdin: {}", e);
                        break;
                    }
                }
            }
        });

        // Handle remote input
        let pty_writer_clone2 = self.pty_writer.clone();
        let inner_clone3 = self.inner.clone();
        let mut remote_receiver = self.remote_input_receiver.resubscribe();
        let remote_input_task = tokio::spawn(async move {
            loop {
                match remote_receiver.recv().await {
                    Ok(event) => {
                        if matches!(event.event_type, EventType::Input) {
                            info!("Processing remote input: {}", event.data);

                            // Write to PTY
                            let mut writer_guard = pty_writer_clone2.lock().await;
                            if let Some(ref mut writer) = writer_guard.as_mut() {
                                if let Err(e) = writer.write(event.data.as_bytes()) {
                                    error!("Failed to write remote input to PTY: {}", e);
                                } else {
                                    writer.flush().ok();
                                    info!("Successfully wrote remote input to PTY");
                                }
                            }

                            // Record the remote input
                            if let Err(e) = inner_clone3.record_input(event.data.as_bytes()) {
                                error!("Failed to record remote input: {}", e);
                            }
                        }
                    }
                    Err(broadcast::error::RecvError::Closed) => {
                        debug!("Remote input channel closed");
                        break;
                    }
                    Err(broadcast::error::RecvError::Lagged(n)) => {
                        warn!("Remote input channel lagged, skipping {} messages", n);
                        continue;
                    }
                }
            }
        });

        // Wait for child process
        let child_task = tokio::spawn(async move {
            if let Ok(status) = child.wait() {
                info!("Child process exited with status: {:?}", status);
            }
        });

        // Wait for any task to complete, which indicates session should end
        tokio::select! {
            _ = output_task => {
                debug!("Output task completed");
            }
            _ = input_task => {
                debug!("Input task completed");
            }
            _ = remote_input_task => {
                debug!("Remote input task completed");
            }
            _ = child_task => {
                debug!("Child process completed");
            }
        }

        Ok(())
    }

    pub async fn save_to_file(&self, file_path: &str) -> Result<()> {
        self.inner.save_to_file(file_path).await
    }
}
