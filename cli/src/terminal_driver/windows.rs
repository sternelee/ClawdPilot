use std::pin::Pin;
use std::process::Command;
use std::task::Context;
use std::task::Poll;

use anyhow::Result;
use pin_project::{pin_project, pinned_drop};
use tokio::fs::{self, File};
use tokio::io::{self, AsyncRead, AsyncWrite};
use tracing::instrument;

/// Returns the default shell on this system.
///
/// For Windows, this tries to detect the user's preferred shell by checking
/// COMSPEC and common shell locations.
pub async fn get_default_shell() -> String {
    use std::env;

    // First try COMSPEC environment variable (Windows system shell)
    if let Ok(comspec) = env::var("COMSPEC") {
        if !comspec.is_empty() && fs::metadata(&comspec).await.is_ok() {
            tracing::trace!("Using shell from COMSPEC: {}", comspec);
            return comspec;
        }
    }

    // Try to detect PowerShell first (more modern)
    let power_shell_paths = [
        "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe",
        "C:\\Windows\\SysWOW64\\WindowsPowerShell\\v1.0\\powershell.exe",
        "powershell.exe",
    ];

    for shell in power_shell_paths {
        if fs::metadata(shell).await.is_ok() {
            tracing::trace!("Using PowerShell: {}", shell);
            return shell.to_string();
        }
    }

    // Try Git Bash (common for developers)
    let git_bash_paths = [
        "C:\\Program Files\\Git\\bin\\bash.exe",
        "C:\\Program Files (x86)\\Git\\bin\\bash.exe",
        "C:\\Program Files\\Git\\usr\\bin\\bash.exe",
        "C:\\Program Files (x86)\\Git\\usr\\bin\\bash.exe",
    ];

    for shell in git_bash_paths {
        if fs::metadata(shell).await.is_ok() {
            tracing::trace!("Using Git Bash: {}", shell);
            return shell.to_string();
        }
    }

    // Fallback to cmd.exe
    let cmd_paths = [
        "C:\\Windows\\System32\\cmd.exe",
        "C:\\Windows\\SysWOW64\\cmd.exe",
        "cmd.exe",
    ];

    for shell in cmd_paths {
        if fs::metadata(shell).await.is_ok() {
            tracing::trace!("Using cmd.exe: {}", shell);
            return shell.to_string();
        }
    }

    // Last resort
    tracing::trace!("Using last resort shell: cmd.exe");
    String::from("cmd.exe")
}

/// An object that stores the state for a terminal session.
#[pin_project(PinnedDrop)]
pub struct Terminal {
    child: conpty::Process,
    #[pin]
    reader: File,
    #[pin]
    writer: File,
    winsize: (u16, u16),
}

impl Terminal {
    /// Create a new terminal, with attached PTY.
    #[instrument]
    pub async fn new(shell: &str) -> Result<Terminal> {
        let mut command = Command::new(shell);

        // Set terminal environment variables appropriately.
        command.env("TERM", "xterm-256color");
        command.env("COLORTERM", "truecolor");
        command.env("TERM_PROGRAM", "riterm");
        command.env_remove("TERM_PROGRAM_VERSION");

        let mut child =
            tokio::task::spawn_blocking(move || conpty::Process::spawn(command)).await??;
        let reader = File::from_std(child.output()?.into());
        let writer = File::from_std(child.input()?.into());

        Ok(Self {
            child,
            reader,
            writer,
            winsize: (0, 0),
        })
    }

    /// Get the window size of the TTY.
    pub fn get_winsize(&self) -> Result<(u16, u16)> {
        Ok(self.winsize)
    }

    /// Set the window size of the TTY.
    pub fn set_winsize(&mut self, rows: u16, cols: u16) -> Result<()> {
        let rows_i16 = rows.min(i16::MAX as u16) as i16;
        let cols_i16 = cols.min(i16::MAX as u16) as i16;
        self.child.resize(cols_i16, rows_i16)?; // Note argument order
        self.winsize = (rows, cols);
        Ok(())
    }
}

// Redirect terminal reads to the read file object.
impl AsyncRead for Terminal {
    fn poll_read(
        self: Pin<&mut Self>,
        cx: &mut Context<'_>,
        buf: &mut io::ReadBuf<'_>,
    ) -> Poll<io::Result<()>> {
        self.project().reader.poll_read(cx, buf)
    }
}

// Redirect terminal writes to the write file object.
impl AsyncWrite for Terminal {
    fn poll_write(
        self: Pin<&mut Self>,
        cx: &mut Context<'_>,
        buf: &[u8],
    ) -> Poll<io::Result<usize>> {
        self.project().writer.poll_write(cx, buf)
    }

    fn poll_flush(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<io::Result<()>> {
        self.project().writer.poll_flush(cx)
    }

    fn poll_shutdown(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<io::Result<()>> {
        self.project().writer.poll_shutdown(cx)
    }
}

#[pinned_drop]
impl PinnedDrop for Terminal {
    fn drop(self: Pin<&mut Self>) {
        let this = self.project();
        this.child.exit(0).ok();
    }
}
