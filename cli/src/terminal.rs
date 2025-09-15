use anyhow::{Context, Result};
use crossterm;
use portable_pty::{CommandBuilder, PtySize, native_pty_system};
use std::io::{Read, Write};
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};
use tokio::fs::OpenOptions;
use tokio::io::BufWriter;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::sync::mpsc;
use tracing::{debug, error, info, warn};

use crate::shell::ShellConfig;
use riterm_shared::{EventType, SessionInfo, TerminalEvent};

/// Maximum number of events to keep in memory buffer to prevent memory leaks
const MAX_EVENTS_BUFFER: usize = 10000;
/// When buffer is full, remove this many oldest events to make room
const BUFFER_CLEANUP_SIZE: usize = 2500;

/// Filter out unwanted terminal output strings
fn filter_terminal_output(data: &str) -> String {
    // Remove "1;2c" string from terminal output
    data.replace("1;2c", "")
}

/// 终端原始模式的 RAII 包装器，确保在离开作用域时恢复终端模式
struct RawModeGuard;

impl RawModeGuard {
    fn new() -> Result<Self> {
        crossterm::terminal::enable_raw_mode().context("Failed to enable raw mode")?;
        Ok(Self)
    }
}

impl Drop for RawModeGuard {
    fn drop(&mut self) {
        if let Err(e) = crossterm::terminal::disable_raw_mode() {
            error!("Failed to disable raw mode: {}", e);
        }
    }
}

/// PTY 资源的 RAII 包装器
struct PtyResources {
    reader: Box<dyn Read + Send>,
    writer: Box<dyn Write + Send>,
    _pty_pair: portable_pty::PtyPair, // 保持 pty_pair 的所有权
}

impl PtyResources {
    fn new(
        shell_config: &ShellConfig,
        width: u16,
        height: u16,
        session_id: &str,
        preserve_cwd: bool,
    ) -> Result<(Self, Box<dyn portable_pty::Child + Send + Sync>)> {
        let pty_system = native_pty_system();
        let pty_size = PtySize {
            rows: height,
            cols: width,
            pixel_width: 0,
            pixel_height: 0,
        };

        let pty_pair = pty_system.openpty(pty_size).context("Failed to open PTY")?;

        let (command, args) = shell_config.get_full_command();
        let mut cmd = CommandBuilder::new(&command);
        for arg in &args {
            cmd.arg(arg);
        }

        // 设置环境变量
        for (key, value) in &shell_config.environment_vars {
            cmd.env(key, value);
        }
        cmd.env("ROTERM_SESSION_ID", session_id);

        // 如果需要保留当前工作目录，设置 cwd
        if preserve_cwd {
            if let Ok(current_dir) = std::env::current_dir() {
                cmd.cwd(current_dir);
                info!(
                    "Preserving current working directory: {:?}",
                    std::env::current_dir()
                );
            }
        }

        let child = pty_pair
            .slave
            .spawn_command(cmd)
            .context("Failed to spawn command")?;

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

/// 日志记录器，用于记录终端输出到文件
pub struct LogRecorder {
    log_file: Option<BufWriter<tokio::fs::File>>,
    log_buffer: String,
    session_id: String,
}

impl LogRecorder {
    pub async fn new(session_id: String) -> Result<Self> {
        // 创建日志目录
        let log_dir = PathBuf::from("logs");
        tokio::fs::create_dir_all(&log_dir).await?;

        // 创建日志文件
        let log_file_path = log_dir.join(format!("{}.log", session_id));
        let file = OpenOptions::new()
            .create(true)
            .append(true)
            .open(&log_file_path)
            .await?;

        let log_file = Some(BufWriter::new(file));

        Ok(Self {
            log_file,
            log_buffer: String::new(),
            session_id,
        })
    }

    pub async fn write_log(&mut self, data: &str) -> Result<()> {
        // 添加到内存缓冲区
        self.log_buffer.push_str(data);

        // 写入文件
        if let Some(ref mut file) = self.log_file {
            use tokio::io::AsyncWriteExt;
            file.write_all(data.as_bytes()).await?;
            file.flush().await?;
        }

        Ok(())
    }

    pub fn get_logs(&self) -> &str {
        &self.log_buffer
    }

    pub async fn close(&mut self) -> Result<()> {
        if let Some(mut file) = self.log_file.take() {
            use tokio::io::AsyncWriteExt;
            file.flush().await?;
        }
        Ok(())
    }
}

#[derive(Clone)]
pub struct TerminalRecorder {
    session_id: String,
    start_time: SystemTime,
    event_sender: mpsc::UnboundedSender<TerminalEvent>,
    events: std::sync::Arc<std::sync::Mutex<Vec<TerminalEvent>>>,
    log_recorder: std::sync::Arc<tokio::sync::Mutex<LogRecorder>>,
    shell_type: String,
    current_dir: String,
}

impl TerminalRecorder {
    pub async fn new(
        session_id: String,
        shell_type: String,
    ) -> Result<(Self, mpsc::UnboundedReceiver<TerminalEvent>)> {
        let (event_sender, event_receiver) = mpsc::unbounded_channel();
        let events = std::sync::Arc::new(std::sync::Mutex::new(Vec::new()));

        // 获取当前工作目录
        let current_dir = std::env::current_dir()
            .unwrap_or_else(|_| PathBuf::from("~"))
            .to_string_lossy()
            .to_string();

        // 创建日志记录器
        let log_recorder = LogRecorder::new(session_id.clone()).await?;
        let log_recorder = std::sync::Arc::new(tokio::sync::Mutex::new(log_recorder));

        let recorder = Self {
            session_id,
            start_time: SystemTime::now(),
            event_sender,
            events,
            log_recorder,
            shell_type,
            current_dir,
        };
        Ok((recorder, event_receiver))
    }

    pub fn get_event_sender(&self) -> &mpsc::UnboundedSender<TerminalEvent> {
        &self.event_sender
    }

    pub fn get_session_id(&self) -> &str {
        &self.session_id
    }

    fn get_relative_timestamp(&self) -> f64 {
        self.start_time.elapsed().unwrap_or_default().as_secs_f64()
    }

    /// 获取会话信息，包含日志、shell类型和当前工作目录
    pub async fn get_session_info(&self) -> SessionInfo {
        let logs = {
            let log_recorder = self.log_recorder.lock().await;
            log_recorder.get_logs().to_string()
        };

        SessionInfo {
            logs,
            shell: self.shell_type.clone(),
            cwd: self.current_dir.clone(),
        }
    }

    /// 当新的App端加入时，发送历史记录
    pub async fn send_history_to_new_participant(&self) -> Result<SessionInfo> {
        let session_info = self.get_session_info().await;
        info!(
            "Sending history to new participant: {} logs, shell: {}, cwd: {}",
            session_info.logs.len(),
            session_info.shell,
            session_info.cwd
        );
        Ok(session_info)
    }

    pub fn record_input(&self, data: &[u8]) -> Result<()> {
        let data_str = String::from_utf8_lossy(data).to_string();
        let event = TerminalEvent {
            timestamp: self.get_relative_timestamp(),
            event_type: EventType::Input,
            data: data_str,
        };

        self.add_event_with_limit(event.clone())?;
        self.event_sender
            .send(event)
            .context("Failed to send input event")?;
        Ok(())
    }

    pub fn record_output(&self, data: &[u8]) -> Result<()> {
        let data_str = String::from_utf8_lossy(data).to_string();

        // Filter unwanted terminal output strings
        let filtered_data = filter_terminal_output(&data_str);

        // Skip if filtered data is empty
        if filtered_data.is_empty() {
            return Ok(());
        }

        let event = TerminalEvent {
            timestamp: self.get_relative_timestamp(),
            event_type: EventType::Output,
            data: filtered_data.clone(),
        };

        self.add_event_with_limit(event.clone())?;

        // 异步记录到日志文件
        let log_recorder = self.log_recorder.clone();
        let data_for_log = filtered_data.clone();
        tokio::spawn(async move {
            if let Ok(mut recorder) = log_recorder.try_lock() {
                if let Err(e) = recorder.write_log(&data_for_log).await {
                    error!("Failed to write to log file: {}", e);
                }
            }
        });

        self.event_sender
            .send(event)
            .context("Failed to send output event")?;

        Ok(())
    }

    pub fn record_resize(&self, width: u16, height: u16) -> Result<()> {
        let event = TerminalEvent {
            timestamp: self.get_relative_timestamp(),
            event_type: EventType::Resize { width, height },
            data: String::new(),
        };

        self.add_event_with_limit(event.clone())?;
        self.event_sender
            .send(event)
            .context("Failed to send resize event")?;
        Ok(())
    }

    /// Add event to buffer with memory limit enforcement
    fn add_event_with_limit(&self, event: TerminalEvent) -> Result<()> {
        if let Ok(mut events) = self.events.lock() {
            // Check if buffer is getting too large
            if events.len() >= MAX_EVENTS_BUFFER {
                debug!(
                    "Event buffer reached limit ({}), cleaning up {} oldest events",
                    MAX_EVENTS_BUFFER, BUFFER_CLEANUP_SIZE
                );

                // Remove oldest events to make room
                events.drain(0..BUFFER_CLEANUP_SIZE);

                info!(
                    "Event buffer cleaned up, current size: {} events",
                    events.len()
                );
            }

            events.push(event);
        } else {
            error!("Failed to acquire lock on events buffer");
            return Err(anyhow::anyhow!("Events buffer lock contention"));
        }

        Ok(())
    }

    /// Get current buffer statistics
    pub fn get_buffer_stats(&self) -> (usize, usize) {
        if let Ok(events) = self.events.lock() {
            (events.len(), MAX_EVENTS_BUFFER)
        } else {
            (0, MAX_EVENTS_BUFFER)
        }
    }

    pub fn handle_remote_input(&self, data: &str, writer: &mut dyn Write) -> Result<()> {
        writer
            .write_all(data.as_bytes())
            .context("Failed to write remote input to PTY")?;
        writer
            .flush()
            .context("Failed to flush remote input to PTY")?;

        self.record_input(data.as_bytes())?;
        Ok(())
    }

    pub async fn save_to_file(&self, file_path: &str) -> Result<()> {
        let events = self
            .events
            .lock()
            .map_err(|_| anyhow::anyhow!("Failed to lock events"))?
            .clone();

        let json_data =
            serde_json::to_string_pretty(&events).context("Failed to serialize events to JSON")?;

        tokio::fs::write(file_path, json_data)
            .await
            .with_context(|| format!("Failed to write session to file: {}", file_path))?;

        info!("Session saved to file: {}", file_path);
        Ok(())
    }

    pub async fn start_passthrough_session_with_config(
        &self,
        shell_config: &ShellConfig,
        width: u16,
        height: u16,
        mut pty_input_receiver: Option<mpsc::UnboundedReceiver<String>>,
    ) -> Result<()> {
        let (command, args) = shell_config.get_full_command();
        info!(
            "Starting passthrough terminal session with {}: {} {}",
            shell_config.shell_type.get_display_name(),
            command,
            args.join(" ")
        );

        // 使用 RAII 模式启用原始模式，确保函数退出时自动禁用
        let _raw_mode_guard = RawModeGuard::new()?;

        // 创建 PTY 资源，确保函数退出时自动清理，保留当前工作目录
        let (mut pty_resources, mut child) =
            PtyResources::new(shell_config, width, height, &self.session_id, true)?;

        let event_sender = self.event_sender.clone();
        let start_event = TerminalEvent {
            timestamp: self.get_relative_timestamp(),
            event_type: EventType::Start,
            data: format!("{} {}", command, args.join(" ")),
        };
        event_sender.send(start_event)?;

        // 发送 shell 初始化命令
        for init_cmd in &shell_config.init_commands {
            let init_bytes = format!("{}\n", init_cmd);
            if let Err(e) = pty_resources.writer.write(init_bytes.as_bytes()) {
                error!("Failed to send init command: {}", e);
            } else {
                pty_resources.writer.flush().ok();
                // 小延迟以允许命令执行
                tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
            }
        }

        // 克隆必要的数据用于任务
        let recorder_clone = self.clone();
        let event_sender_clone = self.event_sender.clone();

        // 处理 PTY 输出 -> stdout + iroh 共享
        let mut reader = pty_resources.reader;
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

                        // Filter the output before writing to stdout
                        let data_str = String::from_utf8_lossy(data);
                        let filtered_data = filter_terminal_output(&data_str);

                        // Write filtered data to stdout
                        let mut stdout = tokio::io::stdout();
                        if let Err(e) = stdout.write_all(filtered_data.as_bytes()).await {
                            error!("Failed to write to stdout: {}", e);
                            break;
                        }
                        if let Err(e) = stdout.flush().await {
                            error!("Failed to flush stdout: {}", e);
                            break;
                        }

                        // Record and share filtered output event (use original data for accurate recording)
                        if let Err(e) = recorder_clone.record_output(data) {
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
                timestamp: SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_secs_f64(),
                event_type: EventType::End,
                data: String::new(),
            };
            event_sender_clone.send(end_event).ok();
        });

        // 处理 stdin -> PTY + iroh 共享
        let (local_input_sender, mut local_input_receiver) = mpsc::unbounded_channel::<Vec<u8>>();
        let input_task = tokio::spawn(async move {
            let mut stdin = tokio::io::stdin();
            let mut buffer = [0u8; 1024];

            loop {
                match stdin.read(&mut buffer).await {
                    Ok(0) => break,
                    Ok(n) => {
                        let data = &buffer[..n];

                        // 发送到本地输入通道
                        if let Err(e) = local_input_sender.send(data.to_vec()) {
                            error!("Failed to send local input: {}", e);
                            break;
                        }
                    }
                    Err(e) => {
                        error!("Failed to read from stdin: {}", e);
                        break;
                    }
                }
            }
        });

        // 处理所有输入（本地 + 远程）-> PTY + iroh 共享
        let recorder_input_clone2 = self.clone();
        let mut writer = pty_resources.writer;
        let input_writer_task = tokio::spawn(async move {
            loop {
                tokio::select! {
                    // 本地输入
                    local_result = local_input_receiver.recv() => {
                        if let Some(data) = local_result {
                            if let Err(e) = writer.write(&data) {
                                error!("Failed to write local input to PTY: {}", e);
                                break;
                            }
                            writer.flush().ok();

                            // 记录和共享输入事件
                            if let Err(e) = recorder_input_clone2.record_input(&data) {
                                error!("Failed to record local input: {}", e);
                            }
                        } else {
                            break;
                        }
                    }
                    // 远程输入
                    remote_data = async {
                        if let Some(ref mut receiver) = pty_input_receiver {
                            receiver.recv().await
                        } else {
                            std::future::pending().await
                        }
                    } => {
                        if let Some(input_data) = remote_data {
                            // info!("Terminal received remote input in passthrough PTY writer task: {:?}", input_data);
                            if let Err(e) = writer.write(input_data.as_bytes()) {
                                error!("Failed to write remote input to PTY: {}", e);
                                break;
                            }
                            if let Err(e) = writer.flush() {
                                error!("Failed to flush remote input to PTY: {}", e);
                                break;
                            }
                            // info!("Successfully wrote remote input to passthrough PTY");

                            // 记录输入事件
                            if let Err(e) = recorder_input_clone2.record_input(input_data.as_bytes()) {
                                error!("Failed to record remote input: {}", e);
                            }
                        }
                    }
                }
            }
        });

        // 等待子进程
        let child_task = tokio::spawn(async move {
            if let Ok(status) = child.wait() {
                info!("Child process exited with status: {:?}", status);
            }
        });

        // 使用 tokio::select! 添加超时处理，等待任何任务完成
        tokio::select! {
            _ = output_task => {
                info!("Output task completed");
            }
            _ = input_task => {
                info!("Input task completed");
            }
            _ = input_writer_task => {
                info!("Input writer task completed");
            }
            _ = child_task => {
                info!("Child process completed");
            }
            _ = tokio::time::sleep(tokio::time::Duration::from_secs(3600)) => {
                warn!("Session timeout after 1 hour");
            }
        }

        Ok(())
    }

    pub fn start_session_with_config(
        &self,
        shell_config: &ShellConfig,
        width: u16,
        height: u16,
        mut pty_input_receiver: Option<mpsc::UnboundedReceiver<String>>,
    ) -> Result<()> {
        let (command, args) = shell_config.get_full_command();
        info!(
            "Starting terminal session with {}: {} {}",
            shell_config.shell_type.get_display_name(),
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

        let mut child = pty_pair
            .slave
            .spawn_command(cmd)
            .context("Failed to spawn command")?;

        let mut reader = pty_pair.master.try_clone_reader()?;
        let mut writer = pty_pair.master.take_writer()?;

        let event_sender = self.event_sender.clone();
        let start_event = TerminalEvent {
            timestamp: 0.0,
            event_type: EventType::Start,
            data: format!("{} {}", command, args.join(" ")),
        };
        event_sender.send(start_event)?;

        tokio::spawn(async move {
            let mut buffer = [0u8; 8192];
            loop {
                match reader.read(&mut buffer) {
                    Ok(0) => {
                        debug!("PTY reader reached EOF");
                        break;
                    }
                    Ok(n) => {
                        let data = &buffer[..n];

                        // Filter the output before writing to stdout
                        let data_str = String::from_utf8_lossy(data);
                        let filtered_data = filter_terminal_output(&data_str);

                        let mut stdout = tokio::io::stdout();
                        if let Err(e) = stdout.write_all(filtered_data.as_bytes()).await {
                            error!("Failed to write to stdout: {}", e);
                            break;
                        }
                        if let Err(e) = stdout.flush().await {
                            error!("Failed to flush stdout: {}", e);
                            break;
                        }

                        let output_event = TerminalEvent {
                            timestamp: SystemTime::now()
                                .duration_since(UNIX_EPOCH)
                                .unwrap_or_default()
                                .as_secs_f64(),
                            event_type: EventType::Output,
                            data: filtered_data.clone(),
                        };

                        // Only send event if filtered data is not empty
                        if !filtered_data.is_empty() {
                            if event_sender.send(output_event).is_err() {
                                break;
                            }
                        }
                    }
                    Err(e) => {
                        error!("Failed to read from PTY: {}", e);
                        break;
                    }
                }
            }

            let end_event = TerminalEvent {
                timestamp: SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_secs_f64(),
                event_type: EventType::End,
                data: String::new(),
            };
            event_sender.send(end_event).ok();
        });

        // Handle input (local + remote) -> PTY + iroh sharing
        let (local_input_sender, mut local_input_receiver) = mpsc::unbounded_channel::<Vec<u8>>();
        tokio::spawn(async move {
            let mut stdin = tokio::io::stdin();
            let mut buffer = [0u8; 1024];

            loop {
                match stdin.read(&mut buffer).await {
                    Ok(0) => break,
                    Ok(n) => {
                        let data = &buffer[..n];

                        // Send to local input channel
                        if let Err(e) = local_input_sender.send(data.to_vec()) {
                            error!("Failed to send local input: {}", e);
                            break;
                        }
                    }
                    Err(e) => {
                        error!("Failed to read from stdin: {}", e);
                        break;
                    }
                }
            }
        });

        // Handle all input (local + remote) -> PTY + iroh sharing
        let recorder_input_clone2 = self.clone();
        tokio::spawn(async move {
            loop {
                tokio::select! {
                    // Local input
                    local_result = local_input_receiver.recv() => {
                        if let Some(data) = local_result {
                            if let Err(e) = writer.write(&data) {
                                error!("Failed to write local input to PTY: {}", e);
                                break;
                            }
                            writer.flush().ok();

                            // Record and share the input event
                            if let Err(e) = recorder_input_clone2.record_input(&data) {
                                error!("Failed to record local input: {}", e);
                            }
                        } else {
                            break;
                        }
                    }
                    // Remote input
                    remote_data = async {
                        if let Some(ref mut receiver) = pty_input_receiver {
                            receiver.recv().await
                        } else {
                            std::future::pending().await
                        }
                    } => {
                        if let Some(input_data) = remote_data {
                            // info!("Terminal received remote input in PTY writer task: {:?}", input_data);
                            if let Err(e) = writer.write(input_data.as_bytes()) {
                                error!("Failed to write remote input to PTY: {}", e);
                                break;
                            }
                            if let Err(e) = writer.flush() {
                                error!("Failed to flush remote input to PTY: {}", e);
                                break;
                            }
                            // info!("Successfully wrote remote input to PTY");

                            // Record the input event but don't send it back to network
                            // to avoid infinite loop
                            if let Err(e) = recorder_input_clone2.record_input(input_data.as_bytes()) {
                                error!("Failed to record remote input: {}", e);
                            }
                        }
                    }
                }
            }
        });

        tokio::spawn(async move {
            if let Ok(status) = child.wait() {
                info!("Child process exited with status: {:?}", status);
            }
        });

        Ok(())
    }

    pub async fn start_passthrough_session(
        &self,
        command: &str,
        width: u16,
        height: u16,
    ) -> Result<()> {
        info!("Starting passthrough terminal session: {}", command);

        // Enable raw mode for direct terminal interaction
        crossterm::terminal::enable_raw_mode().context("Failed to enable raw mode")?;

        let pty_system = native_pty_system();
        let pty_size = PtySize {
            rows: height,
            cols: width,
            pixel_width: 0,
            pixel_height: 0,
        };

        let pty_pair = pty_system.openpty(pty_size).context("Failed to open PTY")?;

        let mut cmd = CommandBuilder::new(command);
        cmd.env("TERM", "xterm-256color");
        cmd.env("IROH_SESSION_ID", &self.session_id);

        let mut child = pty_pair
            .slave
            .spawn_command(cmd)
            .context("Failed to spawn command")?;

        let mut reader = pty_pair.master.try_clone_reader()?;
        let mut writer = pty_pair.master.take_writer()?;

        let event_sender = self.event_sender.clone();
        let start_event = TerminalEvent {
            timestamp: self.get_relative_timestamp(),
            event_type: EventType::Start,
            data: command.to_string(),
        };
        event_sender.send(start_event)?;

        // Clone necessary data for the tasks
        let recorder_clone = self.clone();
        let event_sender_clone = self.event_sender.clone();

        // Handle PTY output -> stdout + iroh sharing
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

                        // Filter the output before writing to stdout
                        let data_str = String::from_utf8_lossy(data);
                        let filtered_data = filter_terminal_output(&data_str);

                        // Write filtered data to stdout for immediate display
                        if let Err(e) = std::io::stdout().write_all(filtered_data.as_bytes()) {
                            error!("Failed to write to stdout: {}", e);
                            break;
                        }
                        std::io::stdout().flush().ok();

                        // Record and share the output event (use original data for accurate recording)
                        if let Err(e) = recorder_clone.record_output(data) {
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
                timestamp: SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_secs_f64(),
                event_type: EventType::End,
                data: String::new(),
            };
            event_sender_clone.send(end_event).ok();
        });

        // Handle stdin -> PTY + iroh sharing
        let recorder_input_clone = self.clone();
        let input_task = tokio::spawn(async move {
            let mut stdin = tokio::io::stdin();
            let mut buffer = [0u8; 1024];

            loop {
                match stdin.read(&mut buffer).await {
                    Ok(0) => break,
                    Ok(n) => {
                        let data = &buffer[..n];

                        // Write to PTY
                        if let Err(e) = writer.write(data) {
                            error!("Failed to write to PTY: {}", e);
                            break;
                        }
                        writer.flush().ok();

                        // Record and share the input event
                        if let Err(e) = recorder_input_clone.record_input(data) {
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

        // Wait for child process
        let child_task = tokio::spawn(async move {
            if let Ok(status) = child.wait() {
                info!("Child process exited with status: {:?}", status);
            }
        });

        // Wait for any task to complete
        tokio::select! {
            _ = output_task => {},
            _ = input_task => {},
            _ = child_task => {},
        }

        // Restore terminal mode
        crossterm::terminal::disable_raw_mode().context("Failed to disable raw mode")?;

        Ok(())
    }

    pub fn start_session(&self, command: &str, width: u16, height: u16) -> Result<()> {
        info!("Starting terminal session: {}", command);

        let pty_system = native_pty_system();
        let pty_size = PtySize {
            rows: height,
            cols: width,
            pixel_width: 0,
            pixel_height: 0,
        };

        let pty_pair = pty_system.openpty(pty_size).context("Failed to open PTY")?;

        let mut cmd = CommandBuilder::new(command);
        cmd.env("TERM", "xterm-256color");

        let mut child = pty_pair
            .slave
            .spawn_command(cmd)
            .context("Failed to spawn command")?;

        let mut reader = pty_pair.master.try_clone_reader()?;
        let mut writer = pty_pair.master.take_writer()?;

        let event_sender = self.event_sender.clone();
        let start_event = TerminalEvent {
            timestamp: 0.0,
            event_type: EventType::Start,
            data: command.to_string(),
        };
        event_sender.send(start_event)?;

        tokio::spawn(async move {
            let mut buffer = [0u8; 8192];
            loop {
                match reader.read(&mut buffer) {
                    Ok(0) => {
                        debug!("PTY reader reached EOF");
                        break;
                    }
                    Ok(n) => {
                        let data = &buffer[..n];

                        // Filter the output before writing to stdout
                        let data_str = String::from_utf8_lossy(data);
                        let filtered_data = filter_terminal_output(&data_str);

                        if let Err(e) = std::io::stdout().write_all(filtered_data.as_bytes()) {
                            error!("Failed to write to stdout: {}", e);
                            break;
                        }
                        std::io::stdout().flush().ok();

                        let output_event = TerminalEvent {
                            timestamp: SystemTime::now()
                                .duration_since(UNIX_EPOCH)
                                .unwrap_or_default()
                                .as_secs_f64(),
                            event_type: EventType::Output,
                            data: filtered_data.clone(),
                        };

                        // Only send event if filtered data is not empty
                        if !filtered_data.is_empty() {
                            if event_sender.send(output_event).is_err() {
                                break;
                            }
                        }
                    }
                    Err(e) => {
                        error!("Failed to read from PTY: {}", e);
                        break;
                    }
                }
            }

            let end_event = TerminalEvent {
                timestamp: SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_secs_f64(),
                event_type: EventType::End,
                data: String::new(),
            };
            event_sender.send(end_event).ok();
        });

        tokio::spawn(async move {
            let mut stdin = tokio::io::stdin();
            let mut buffer = [0u8; 1024];

            loop {
                match stdin.read(&mut buffer).await {
                    Ok(0) => break,
                    Ok(n) => {
                        let data = &buffer[..n];
                        if let Err(e) = writer.write(data) {
                            error!("Failed to write to PTY: {}", e);
                            break;
                        }
                    }
                    Err(e) => {
                        error!("Failed to read from stdin: {}", e);
                        break;
                    }
                }
            }
        });

        tokio::spawn(async move {
            if let Ok(status) = child.wait() {
                info!("Child process exited with status: {:?}", status);
            }
        });

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::filter_terminal_output;

    #[test]
    fn test_filter_terminal_output() {
        // Test basic filtering
        assert_eq!(filter_terminal_output("hello1;2cworld"), "helloworld");

        // Test multiple occurrences
        assert_eq!(filter_terminal_output("1;2cfoo1;2cbar1;2c"), "foobar");

        // Test no filtering needed
        assert_eq!(filter_terminal_output("normal text"), "normal text");

        // Test empty string
        assert_eq!(filter_terminal_output(""), "");

        // Test just the filter string (results in empty string)
        assert_eq!(filter_terminal_output("1;2c"), "");

        // Test multiple filter strings only (results in empty string)
        assert_eq!(filter_terminal_output("1;2c1;2c1;2c"), "");

        // Test with ANSI escape sequences and the filter string
        assert_eq!(
            filter_terminal_output("\x1b[31mred1;2ctext\x1b[0m"),
            "\x1b[31mredtext\x1b[0m"
        );

        // Test whitespace and filter string combination
        assert_eq!(filter_terminal_output("   1;2c   "), "      ");
    }
}
