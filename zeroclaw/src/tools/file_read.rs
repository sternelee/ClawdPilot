use super::traits::{Tool, ToolResult};
use crate::runtime::RuntimeAdapter;
use crate::security::SecurityPolicy;
use async_trait::async_trait;
use serde_json::json;
use std::sync::Arc;

pub struct FileReadTool {
    security: Arc<SecurityPolicy>,
    runtime: Arc<dyn RuntimeAdapter>,
}

impl FileReadTool {
    pub fn new(security: Arc<SecurityPolicy>, runtime: Arc<dyn RuntimeAdapter>) -> Self {
        Self { security, runtime }
    }
}

#[async_trait]
impl Tool for FileReadTool {
    fn name(&self) -> &str {
        "file_read"
    }

    fn description(&self) -> &str {
        "Read the contents of a file in the workspace"
    }

    fn parameters_schema(&self) -> serde_json::Value {
        json!({
            "type": "object",
            "properties": {
                "path": {
                    "type": "string",
                    "description": "Relative path to the file within the workspace"
                }
            },
            "required": ["path"]
        })
    }

    async fn execute(&self, args: serde_json::Value) -> anyhow::Result<ToolResult> {
        let path = args
            .get("path")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow::anyhow!("Missing 'path' parameter"))?;

        if !self.security.is_path_allowed(path) {
            return Ok(ToolResult {
                success: false,
                output: String::new(),
                error: Some(format!("Path not allowed by security policy: {path}")),
            });
        }

        let full_path = self.security.workspace_dir.join(path);

        let resolved_path = self.runtime.try_canonicalize(&full_path)?;

        if !self.security.is_resolved_path_allowed(&resolved_path) {
            return Ok(ToolResult {
                success: false,
                output: String::new(),
                error: Some(format!(
                    "Resolved path escapes workspace: {}",
                    resolved_path.display()
                )),
            });
        }

        const MAX_FILE_SIZE: u64 = 10 * 1024 * 1024;
        let meta = self.runtime.metadata_sync(&resolved_path)?;

        if meta.len() > MAX_FILE_SIZE {
            return Ok(ToolResult {
                success: false,
                output: String::new(),
                error: Some(format!(
                    "File too large: {} bytes (limit: {MAX_FILE_SIZE} bytes)",
                    meta.len()
                )),
            });
        }

        let contents = self.runtime.read_file_sync(&resolved_path)?;

        Ok(ToolResult {
            success: true,
            output: contents,
            error: None,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::runtime::NativeRuntime;
    use crate::security::{AutonomyLevel, SecurityPolicy};

    fn test_security(workspace: std::path::PathBuf) -> Arc<SecurityPolicy> {
        Arc::new(SecurityPolicy {
            autonomy: AutonomyLevel::Supervised,
            workspace_dir: workspace,
            ..SecurityPolicy::default()
        })
    }

    #[test]
    fn file_read_name() {
        let tool = FileReadTool::new(
            test_security(std::env::temp_dir()),
            Arc::new(NativeRuntime::new()),
        );
        assert_eq!(tool.name(), "file_read");
    }

    #[test]
    fn file_read_schema_has_path() {
        let tool = FileReadTool::new(
            test_security(std::env::temp_dir()),
            Arc::new(NativeRuntime::new()),
        );
        let schema = tool.parameters_schema();
        assert!(schema["properties"]["path"].is_object());
        assert!(
            schema["required"]
                .as_array()
                .unwrap()
                .contains(&json!("path"))
        );
    }

    #[tokio::test]
    async fn file_read_existing_file() {
        let dir = std::env::temp_dir().join("zeroclaw_test_file_read");
        let _ = tokio::fs::remove_dir_all(&dir).await;
        tokio::fs::create_dir_all(&dir).await.unwrap();
        tokio::fs::write(dir.join("test.txt"), "hello world")
            .await
            .unwrap();

        let tool = FileReadTool::new(test_security(dir.clone()), Arc::new(NativeRuntime::new()));
        let result = tool.execute(json!({"path": "test.txt"})).await.unwrap();
        assert!(result.success);
        assert_eq!(result.output, "hello world");
        assert!(result.error.is_none());

        let _ = tokio::fs::remove_dir_all(&dir).await;
    }

    #[tokio::test]
    async fn file_read_nonexistent_file() {
        let dir = std::env::temp_dir().join("zeroclaw_test_file_read_missing");
        let _ = tokio::fs::remove_dir_all(&dir).await;
        tokio::fs::create_dir_all(&dir).await.unwrap();

        let tool = FileReadTool::new(test_security(dir.clone()), Arc::new(NativeRuntime::new()));
        let result = tool.execute(json!({"path": "nope.txt"})).await.unwrap();
        assert!(!result.success);
        assert!(
            result
                .error
                .as_ref()
                .unwrap()
                .contains("Failed to canonicalize")
        );

        let _ = tokio::fs::remove_dir_all(&dir).await;
    }

    #[tokio::test]
    async fn file_read_blocks_path_traversal() {
        let dir = std::env::temp_dir().join("zeroclaw_test_file_read_traversal");
        let _ = tokio::fs::remove_dir_all(&dir).await;
        tokio::fs::create_dir_all(&dir).await.unwrap();

        let tool = FileReadTool::new(test_security(dir.clone()), Arc::new(NativeRuntime::new()));
        let result = tool
            .execute(json!({"path": "../../../etc/passwd"}))
            .await
            .unwrap();
        assert!(!result.success);
        assert!(result.error.as_ref().unwrap().contains("not allowed"));

        let _ = tokio::fs::remove_dir_all(&dir).await;
    }

    #[tokio::test]
    async fn file_read_blocks_absolute_path() {
        let tool = FileReadTool::new(
            test_security(std::env::temp_dir()),
            Arc::new(NativeRuntime::new()),
        );
        let result = tool.execute(json!({"path": "/etc/passwd"})).await.unwrap();
        assert!(!result.success);
        assert!(result.error.as_ref().unwrap().contains("not allowed"));
    }

    #[tokio::test]
    async fn file_read_missing_path_param() {
        let tool = FileReadTool::new(
            test_security(std::env::temp_dir()),
            Arc::new(NativeRuntime::new()),
        );
        let result = tool.execute(json!({})).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn file_read_empty_file() {
        let dir = std::env::temp_dir().join("zeroclaw_test_file_read_empty");
        let _ = tokio::fs::remove_dir_all(&dir).await;
        tokio::fs::create_dir_all(&dir).await.unwrap();
        tokio::fs::write(dir.join("empty.txt"), "").await.unwrap();

        let tool = FileReadTool::new(test_security(dir.clone()), Arc::new(NativeRuntime::new()));
        let result = tool.execute(json!({"path": "empty.txt"})).await.unwrap();
        assert!(result.success);
        assert_eq!(result.output, "");

        let _ = tokio::fs::remove_dir_all(&dir).await;
    }

    #[tokio::test]
    async fn file_read_nested_path() {
        let dir = std::env::temp_dir().join("zeroclaw_test_file_read_nested");
        let _ = tokio::fs::remove_dir_all(&dir).await;
        tokio::fs::create_dir_all(dir.join("sub/dir"))
            .await
            .unwrap();
        tokio::fs::write(dir.join("sub/dir/deep.txt"), "deep content")
            .await
            .unwrap();

        let tool = FileReadTool::new(test_security(dir.clone()), Arc::new(NativeRuntime::new()));
        let result = tool
            .execute(json!({"path": "sub/dir/deep.txt"}))
            .await
            .unwrap();
        assert!(result.success);
        assert_eq!(result.output, "deep content");

        let _ = tokio::fs::remove_dir_all(&dir).await;
    }

    #[cfg(unix)]
    #[tokio::test]
    async fn file_read_blocks_symlink_escape() {
        use std::os::unix::fs::symlink;

        let root = std::env::temp_dir().join("zeroclaw_test_file_read_symlink_escape");
        let workspace = root.join("workspace");
        let outside = root.join("outside");

        let _ = tokio::fs::remove_dir_all(&root).await;
        tokio::fs::create_dir_all(&workspace).await.unwrap();
        tokio::fs::create_dir_all(&outside).await.unwrap();

        tokio::fs::write(outside.join("secret.txt"), "outside workspace")
            .await
            .unwrap();

        symlink(outside.join("secret.txt"), workspace.join("escape.txt")).unwrap();

        let tool = FileReadTool::new(
            test_security(workspace.clone()),
            Arc::new(NativeRuntime::new()),
        );
        let result = tool.execute(json!({"path": "escape.txt"})).await.unwrap();

        assert!(!result.success);
        assert!(
            result
                .error
                .as_deref()
                .unwrap_or("")
                .contains("escapes workspace")
        );

        let _ = tokio::fs::remove_dir_all(&root).await;
    }

    #[tokio::test]
    async fn file_read_rejects_oversized_file() {
        let dir = std::env::temp_dir().join("zeroclaw_test_file_read_large");
        let _ = tokio::fs::remove_dir_all(&dir).await;
        tokio::fs::create_dir_all(&dir).await.unwrap();

        let big = vec![b'x'; 10 * 1024 * 1024 + 1];
        tokio::fs::write(dir.join("huge.bin"), &big).await.unwrap();

        let tool = FileReadTool::new(test_security(dir.clone()), Arc::new(NativeRuntime::new()));
        let result = tool.execute(json!({"path": "huge.bin"})).await.unwrap();
        assert!(!result.success);
        assert!(result.error.as_ref().unwrap().contains("File too large"));

        let _ = tokio::fs::remove_dir_all(&dir).await;
    }
}
