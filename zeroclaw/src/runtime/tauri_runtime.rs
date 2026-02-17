use super::traits::RuntimeAdapter;
use std::path::{Path, PathBuf};

#[cfg(any(feature = "tauri", feature = "desktop", feature = "mobile"))]
pub struct TauriRuntime;

#[cfg(any(feature = "tauri", feature = "desktop", feature = "mobile"))]
impl TauriRuntime {
    pub fn new() -> Self {
        Self
    }
}

#[cfg(any(feature = "tauri", feature = "desktop", feature = "mobile"))]
impl RuntimeAdapter for TauriRuntime {
    fn name(&self) -> &str {
        "tauri"
    }

    fn has_shell_access(&self) -> bool {
        true
    }

    fn has_filesystem_access(&self) -> bool {
        true
    }

    fn storage_path(&self) -> PathBuf {
        directories::UserDirs::new().map_or_else(
            || PathBuf::from(".zeroclaw"),
            |u| u.home_dir().join(".zeroclaw"),
        )
    }

    fn supports_long_running(&self) -> bool {
        true
    }

    fn memory_budget(&self) -> u64 {
        0
    }

    fn build_shell_command(
        &self,
        command: &str,
        workspace_dir: &Path,
    ) -> anyhow::Result<tokio::process::Command> {
        let mut cmd = tokio::process::Command::new("sh");
        cmd.args(["-c", command]).current_dir(workspace_dir);
        Ok(cmd)
    }

    fn read_file_sync(&self, path: &Path) -> anyhow::Result<String> {
        std::fs::read_to_string(path).map_err(|e| anyhow::anyhow!("Failed to read file: {}", e))
    }

    fn write_file_sync(&self, path: &Path, content: &str) -> anyhow::Result<()> {
        std::fs::write(path, content).map_err(|e| anyhow::anyhow!("Failed to write file: {}", e))
    }

    fn create_dir_all_sync(&self, path: &Path) -> anyhow::Result<()> {
        std::fs::create_dir_all(path)
            .map_err(|e| anyhow::anyhow!("Failed to create directory: {}", e))
    }

    fn metadata_sync(&self, path: &Path) -> anyhow::Result<std::fs::Metadata> {
        std::fs::metadata(path).map_err(|e| anyhow::anyhow!("Failed to get metadata: {}", e))
    }

    fn try_exists(&self, path: &Path) -> anyhow::Result<bool> {
        path.try_exists()
            .map_err(|e| anyhow::anyhow!("Failed to check existence: {}", e))
    }

    fn try_canonicalize(&self, path: &Path) -> anyhow::Result<PathBuf> {
        path.canonicalize()
            .map_err(|e| anyhow::anyhow!("Failed to canonicalize path: {}", e))
    }
}

#[cfg(any(feature = "tauri", feature = "desktop", feature = "mobile"))]
impl Default for TauriRuntime {
    fn default() -> Self {
        Self::new()
    }
}
