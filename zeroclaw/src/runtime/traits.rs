use std::path::{Path, PathBuf};

pub trait RuntimeAdapter: Send + Sync {
    fn name(&self) -> &str;
    fn has_shell_access(&self) -> bool;
    fn has_filesystem_access(&self) -> bool;
    fn storage_path(&self) -> PathBuf;
    fn supports_long_running(&self) -> bool;
    fn memory_budget(&self) -> u64 {
        0
    }

    fn build_shell_command(
        &self,
        command: &str,
        workspace_dir: &Path,
    ) -> anyhow::Result<tokio::process::Command>;

    fn read_file_sync(&self, path: &Path) -> anyhow::Result<String>;
    fn write_file_sync(&self, path: &Path, content: &str) -> anyhow::Result<()>;
    fn create_dir_all_sync(&self, path: &Path) -> anyhow::Result<()>;
    fn metadata_sync(&self, path: &Path) -> anyhow::Result<std::fs::Metadata>;
    fn try_exists(&self, path: &Path) -> anyhow::Result<bool>;
    fn try_canonicalize(&self, path: &Path) -> anyhow::Result<PathBuf>;
}
