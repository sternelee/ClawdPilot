//! Terminal driver, which communicates with a shell subprocess through PTY.

#![allow(unsafe_code)]

cfg_if::cfg_if! {
    if #[cfg(unix)] {
        mod unix;
        pub use unix::*;
    } else if #[cfg(windows)] {
        mod windows;
        pub use windows::*;
    } else {
        compile_error!("unsupported platform for terminal driver");
    }
}

#[cfg(test)]
mod tests {
    use anyhow::Result;

    use super::Terminal;

    #[tokio::test]
    async fn winsize() -> Result<()> {
        let shell = if cfg!(unix) { "/bin/sh" } else { "cmd.exe" };
        let mut terminal = Terminal::new(shell).await?;
        assert_eq!(terminal.get_winsize()?, (0, 0));
        terminal.set_winsize(120, 72)?;
        assert_eq!(terminal.get_winsize()?, (120, 72));
        Ok(())
    }
}
