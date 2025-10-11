// Shell detection and configuration module
// Currently unused in agent mode but kept for future compatibility

use std::collections::HashMap;

/// Shell type enumeration
#[derive(Debug, Clone, PartialEq)]
pub enum ShellType {
    Zsh,
    Bash,
    Fish,
    Nushell,
    PowerShell,
    Cmd,
    Unknown(String),
}

impl ShellType {
    /// Get the shell command path
    pub fn get_command_path(&self) -> &str {
        match self {
            ShellType::Zsh => "zsh",
            ShellType::Bash => "bash",
            ShellType::Fish => "fish",
            ShellType::Nushell => "nu",
            ShellType::PowerShell => "pwsh",
            ShellType::Cmd => "cmd",
            ShellType::Unknown(cmd) => cmd,
        }
    }

    /// Get display name for the shell
    pub fn get_display_name(&self) -> &str {
        match self {
            ShellType::Zsh => "Zsh",
            ShellType::Bash => "Bash",
            ShellType::Fish => "Fish",
            ShellType::Nushell => "Nushell",
            ShellType::PowerShell => "PowerShell",
            ShellType::Cmd => "Command Prompt",
            ShellType::Unknown(name) => name,
        }
    }
}

/// Shell configuration
#[derive(Debug, Clone)]
pub struct ShellConfig {
    pub shell_type: ShellType,
    pub env_vars: HashMap<String, String>,
}

impl ShellConfig {
    pub fn new(shell_type: ShellType) -> Self {
        Self {
            shell_type,
            env_vars: HashMap::new(),
        }
    }
}

/// Shell detector for finding available shells
pub struct ShellDetector;

impl ShellDetector {
    /// Get the default shell for the current platform
    pub fn get_default_shell() -> ShellType {
        #[cfg(unix)]
        {
            std::env::var("SHELL")
                .ok()
                .and_then(|shell_path| {
                    if shell_path.contains("zsh") {
                        Some(ShellType::Zsh)
                    } else if shell_path.contains("bash") {
                        Some(ShellType::Bash)
                    } else if shell_path.contains("fish") {
                        Some(ShellType::Fish)
                    } else if shell_path.contains("nu") {
                        Some(ShellType::Nushell)
                    } else {
                        None
                    }
                })
                .unwrap_or(ShellType::Bash)
        }

        #[cfg(windows)]
        {
            ShellType::PowerShell
        }
    }
}

