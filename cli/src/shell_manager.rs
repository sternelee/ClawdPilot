use anyhow::Result;
use crossterm::{
    execute,
    style::{Color, Print, ResetColor, SetForegroundColor},
};
use std::io;

use crate::shell::ShellDetector;

pub struct ShellManager;

impl ShellManager {
    pub fn list_available() -> Result<()> {
        println!("🐚 Available Shells:");
        println!();

        let available_shells = ShellDetector::detect_available_shells();
        let current_shell = ShellDetector::get_current_shell();

        if available_shells.is_empty() {
            println!("❌ No supported shells found on this system");
            return Ok(());
        }

        for (index, shell) in available_shells.iter().enumerate() {
            let is_current = current_shell.as_ref() == Some(shell);
            let marker = if is_current { "→" } else { " " };
            let status = if is_current { " (current)" } else { "" };

            execute!(
                io::stdout(),
                SetForegroundColor(if is_current {
                    Color::Green
                } else {
                    Color::Cyan
                }),
                Print(format!(
                    "{}{}. {} - {}{}\n",
                    marker,
                    index + 1,
                    shell.get_display_name(),
                    shell.get_command_path(),
                    status
                )),
                ResetColor
            )?;
        }

        println!();
        println!(
            "💡 Use --shell <name> to specify a shell, or let the system detect automatically"
        );

        Ok(())
    }
}
