//! Enhanced screenshot tool with window enumeration and targeted capture.
//!
//! Supports:
//! - Listing all capturable windows
//! - Capturing specific windows by ID or title
//! - Capturing screen regions
//! - Multi-monitor support
//! - Interactive window selection

use super::traits::{Tool, ToolResult};
use crate::runtime::RuntimeAdapter;
use crate::security::SecurityPolicy;
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;
use tokio::process::Command;

/// Maximum time to wait for screenshot command
const SCREENSHOT_TIMEOUT_SECS: u64 = 15;

/// Window information for enumeration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindowInfo {
    pub id: String,
    pub title: String,
    pub app_name: String,
    pub process_id: u32,
    pub bounds: Option<WindowBounds>,
}

/// Window bounds (position and size)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindowBounds {
    pub x: i32,
    pub y: i32,
    pub width: i32,
    pub height: i32,
}

/// Enhanced screenshot tool with window enumeration support.
pub struct EnhancedScreenshotTool {
    security: Arc<SecurityPolicy>,
    #[allow(dead_code)]
    runtime: Arc<dyn RuntimeAdapter>,
}

impl EnhancedScreenshotTool {
    pub fn new(security: Arc<SecurityPolicy>, runtime: Arc<dyn RuntimeAdapter>) -> Self {
        Self { security, runtime }
    }

    /// Execute based on mode parameter
    async fn execute_capture(&self, args: serde_json::Value) -> anyhow::Result<ToolResult> {
        let mode = args
            .get("mode")
            .and_then(|v| v.as_str())
            .unwrap_or("capture");

        match mode {
            "list" => self.list_windows().await,
            "interactive" => self.capture_interactive().await,
            _ => self.capture(args).await,
        }
    }

    /// List all capturable windows
    async fn list_windows(&self) -> anyhow::Result<ToolResult> {
        let windows = if cfg!(target_os = "macos") {
            self.list_windows_macos().await?
        } else if cfg!(target_os = "linux") {
            self.list_windows_linux().await?
        } else if cfg!(target_os = "windows") {
            self.list_windows_windows().await?
        } else {
            return Ok(ToolResult {
                success: false,
                output: String::new(),
                error: Some("Platform not supported".into()),
            });
        };

        if windows.is_empty() {
            return Ok(ToolResult {
                success: true,
                output: "No windows found".into(),
                error: None,
            });
        }

        let output = serde_json::to_string_pretty(&windows)
            .map_err(|e| anyhow::anyhow!("Failed to serialize windows: {}", e))?;

        Ok(ToolResult {
            success: true,
            output,
            error: None,
        })
    }

    /// Build a command with the given program and arguments.
    ///
    /// Note: we use `Command::new(program)` directly instead of
    /// `runtime.build_shell_command()` because the latter wraps the program
    /// in `sh -c "<program>"`, causing any `.arg()` calls to become
    /// positional parameters to `sh` rather than arguments to the program.
    fn build_command(&self, program: &str, args: &[&str]) -> Command {
        let mut cmd = Command::new(program);
        cmd.args(args).current_dir(&self.security.workspace_dir);
        cmd
    }

    /// macOS window enumeration using osascript
    async fn list_windows_macos(&self) -> anyhow::Result<Vec<WindowInfo>> {
        let script = r#"
            tell application "System Events"
                set windowList to {}
                repeat with proc in (every process whose background is false)
                    try
                        set procName to name of proc
                        repeat with win in (every window of proc)
                            set winTitle to name of win
                            if winTitle is not equal to "" then
                                set winPos to position of win
                                set winSize to size of win
                                set windowList to windowList & {{name:winTitle, app:procName, x:item 1 of winPos, y:item 2 of winPos, width:item 1 of winSize, height:item 2 of winSize}}
                            end if
                        end repeat
                    end try
                end repeat
                return windowList
            end tell
        "#;

        let output = self
            .build_command("osascript", &["-e", script])
            .output()
            .await?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            anyhow::bail!("osascript failed: {}", stderr);
        }

        let stdout = String::from_utf8_lossy(&output.stdout);
        self.parse_macos_windows(&stdout)
    }

    /// Parse macOS osascript output
    fn parse_macos_windows(&self, output: &str) -> anyhow::Result<Vec<WindowInfo>> {
        let mut windows = Vec::new();

        // Parse output like: {name:VSCode, app:Code, x:0, y:0, width:1920, height:1080}
        for line in output.lines() {
            let line = line.trim();
            if line.is_empty() || line == "{}" {
                continue;
            }

            // Simple parsing for AppleScript record syntax
            let mut title = String::new();
            let mut app_name = String::new();
            let mut x = 0i32;
            let mut y = 0i32;
            let mut width = 0i32;
            let mut height = 0i32;

            // Extract fields using basic string parsing
            for part in line.split(", ") {
                if let Some(pos) = part.find(':') {
                    let key = part[..pos].trim();
                    let value = part[pos + 1..].trim();

                    match key {
                        "name" => title = value.trim_matches(|c| c == '"' || c == '}').to_string(),
                        "app" => {
                            app_name = value.trim_matches(|c| c == '"' || c == '}').to_string()
                        }
                        "x" => x = value.parse().unwrap_or(0),
                        "y" => y = value.parse().unwrap_or(0),
                        "width" => width = value.parse().unwrap_or(0),
                        "height" => height = value.parse().unwrap_or(0),
                        _ => {}
                    }
                }
            }

            if !title.is_empty() {
                windows.push(WindowInfo {
                    id: format!("{}_{}", app_name, title),
                    title,
                    app_name,
                    process_id: 0,
                    bounds: Some(WindowBounds {
                        x,
                        y,
                        width,
                        height,
                    }),
                });
            }
        }

        Ok(windows)
    }

    /// Linux window enumeration using wmctrl and xdotool
    async fn list_windows_linux(&self) -> anyhow::Result<Vec<WindowInfo>> {
        // Try wmctrl first
        let output = self
            .build_command("wmctrl", &["-l", "-p", "-G"])
            .output()
            .await?;

        if output.status.success() {
            let stdout = String::from_utf8_lossy(&output.stdout);
            return self.parse_linux_windows_wmctrl(&stdout);
        }

        // Fallback to xdotool
        let output = self
            .build_command("xdotool", &["search", "--onlyvisible", "--name", ".*"])
            .output()
            .await?;

        if output.status.success() {
            let stdout = String::from_utf8_lossy(&output.stdout);
            return self.parse_linux_windows_xdotool(&stdout).await;
        }

        Ok(Vec::new())
    }

    /// Parse wmctrl output
    fn parse_linux_windows_wmctrl(&self, output: &str) -> anyhow::Result<Vec<WindowInfo>> {
        let mut windows = Vec::new();

        for line in output.lines() {
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() >= 8 {
                let id = parts[0].to_string();
                let _desktop = parts[1];
                let process_id: u32 = parts[2].parse().unwrap_or(0);
                let x: i32 = parts[3].parse().unwrap_or(0);
                let y: i32 = parts[4].parse().unwrap_or(0);
                let width: i32 = parts[5].parse().unwrap_or(0);
                let height: i32 = parts[6].parse().unwrap_or(0);
                let title = parts[7..].join(" ");

                // Skip empty titles
                if title.is_empty() || title == "N/A" {
                    continue;
                }

                windows.push(WindowInfo {
                    id,
                    title: title.clone(),
                    app_name: title.split('-').last().unwrap_or(&title).trim().to_string(),
                    process_id,
                    bounds: Some(WindowBounds {
                        x,
                        y,
                        width,
                        height,
                    }),
                });
            }
        }

        Ok(windows)
    }

    /// Parse xdotool output (window IDs) and get details
    async fn parse_linux_windows_xdotool(&self, output: &str) -> anyhow::Result<Vec<WindowInfo>> {
        let mut windows = Vec::new();

        for window_id in output.lines() {
            let window_id = window_id.trim();
            if window_id.is_empty() {
                continue;
            }

            // Get window name
            let name_output = self
                .build_command("xdotool", &["getwindowname", window_id])
                .output()
                .await?;

            let title = String::from_utf8_lossy(&name_output.stdout)
                .trim()
                .to_string();
            if title.is_empty() || title == "N/A" {
                continue;
            }

            // Get window geometry
            let geom_output = self
                .build_command("xdotool", &["getwindowgeometry", "--shell", window_id])
                .output()
                .await?;

            let mut x = 0i32;
            let mut y = 0i32;
            let mut width = 0i32;
            let mut height = 0i32;

            for line in String::from_utf8_lossy(&geom_output.stdout).lines() {
                if let Some(pos) = line.find('=') {
                    let key = &line[..pos];
                    let value: i32 = line[pos + 1..].parse().unwrap_or(0);
                    match key {
                        "X" => x = value,
                        "Y" => y = value,
                        "WIDTH" => width = value,
                        "HEIGHT" => height = value,
                        _ => {}
                    }
                }
            }

            windows.push(WindowInfo {
                id: window_id.to_string(),
                title,
                app_name: String::new(),
                process_id: 0,
                bounds: Some(WindowBounds {
                    x,
                    y,
                    width,
                    height,
                }),
            });
        }

        Ok(windows)
    }

    /// Windows window enumeration using PowerShell
    async fn list_windows_windows(&self) -> anyhow::Result<Vec<WindowInfo>> {
        let script = r#"
            Add-Type @"
            using System;
            using System.Runtime.InteropServices;
            using System.Text;
            using System.Collections.Generic;
            public class WindowHelper {
                [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);
                public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
                [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);
                [DllImport("user32.dll")] public static extern int GetWindowTextLength(IntPtr hWnd);
                [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
                [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
                [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
                [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }
            }
"@
            $windows = @()
            $callback = [WindowHelper+EnumWindowsProc]{
                param($hWnd, $lParam)
                if ([WindowHelper]::IsWindowVisible($hWnd)) {
                    $len = [WindowHelper]::GetWindowTextLength($hWnd)
                    if ($len -gt 0) {
                        $sb = New-Object System.Text.StringBuilder($len + 1)
                        [WindowHelper]::GetWindowText($hWnd, $sb, $sb.Capacity) | Out-Null
                        $title = $sb.ToString()
                        $pid = 0
                        [WindowHelper]::GetWindowThreadProcessId($hWnd, [ref]$pid) | Out-Null
                        $rect = New-Object WindowHelper+RECT
                        [WindowHelper]::GetWindowRect($hWnd, [ref]$rect) | Out-Null
                        $script:windows += [PSCustomObject]@{
                            id = $hWnd.ToInt64().ToString()
                            title = $title
                            pid = $pid
                            x = $rect.Left
                            y = $rect.Top
                            width = $rect.Right - $rect.Left
                            height = $rect.Bottom - $rect.Top
                        }
                    }
                }
                return $true
            }
            [WindowHelper]::EnumWindows($callback, [IntPtr]::Zero) | Out-Null
            $windows | ConvertTo-Json -Depth 3
        "#;

        let output = self
            .build_command("powershell", &["-NoProfile", "-Command", script])
            .output()
            .await?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            anyhow::bail!("PowerShell failed: {}", stderr);
        }

        let stdout = String::from_utf8_lossy(&output.stdout);
        self.parse_windows_windows(&stdout)
    }

    /// Parse Windows PowerShell output
    fn parse_windows_windows(&self, output: &str) -> anyhow::Result<Vec<WindowInfo>> {
        // Handle empty or invalid JSON
        let output = output.trim();
        if output.is_empty() || output == "null" {
            return Ok(Vec::new());
        }

        // Parse JSON as Vec<WindowInfo>
        #[derive(Deserialize)]
        struct PsWindowInfo {
            id: String,
            title: String,
            pid: u32,
            x: i32,
            y: i32,
            width: i32,
            height: i32,
        }

        let windows: Vec<PsWindowInfo> = serde_json::from_str(output)
            .or_else(|_| {
                // Try parsing as single object
                serde_json::from_str::<PsWindowInfo>(output).map(|w| vec![w])
            })
            .map_err(|e| anyhow::anyhow!("Failed to parse window data: {}", e))?;

        Ok(windows
            .into_iter()
            .map(|w| WindowInfo {
                id: w.id,
                title: w.title,
                app_name: String::new(),
                process_id: w.pid,
                bounds: Some(WindowBounds {
                    x: w.x,
                    y: w.y,
                    width: w.width,
                    height: w.height,
                }),
            })
            .filter(|w| !w.title.is_empty())
            .collect())
    }

    /// Capture screenshot with given parameters
    async fn capture(&self, args: serde_json::Value) -> anyhow::Result<ToolResult> {
        let timestamp = chrono::Utc::now().format("%Y%m%d_%H%M%S");
        let filename = args
            .get("filename")
            .and_then(|v| v.as_str())
            .map_or_else(|| format!("screenshot_{timestamp}.png"), String::from);

        let safe_name = PathBuf::from(&filename).file_name().map_or_else(
            || format!("screenshot_{timestamp}.png"),
            |n| n.to_string_lossy().to_string(),
        );

        let output_path = self.security.workspace_dir.join(&safe_name);
        let output_str = output_path.to_string_lossy().to_string();

        // Determine capture target
        let target = args.get("target").and_then(|v| v.as_str());
        let region = args.get("region");
        let display = args.get("display").and_then(|v| v.as_str());
        let include_cursor = args
            .get("include_cursor")
            .and_then(|v| v.as_bool())
            .unwrap_or(true);

        // Build and execute capture command
        let cmd_result = if let Some(region) = region {
            // Region capture
            let x = region.get("x").and_then(|v| v.as_i64()).unwrap_or(0) as i32;
            let y = region.get("y").and_then(|v| v.as_i64()).unwrap_or(0) as i32;
            let width = region.get("width").and_then(|v| v.as_i64()).unwrap_or(0) as i32;
            let height = region.get("height").and_then(|v| v.as_i64()).unwrap_or(0) as i32;
            self.capture_region(&output_str, x, y, width, height).await
        } else if let Some(target) = target {
            // Window capture
            self.capture_window(&output_str, target).await
        } else if let Some(display) = display {
            // Display capture
            self.capture_display(&output_str, display).await
        } else {
            // Full screen
            self.capture_screen(&output_str, include_cursor).await
        };

        // Execute command
        match cmd_result {
            Ok(mut cmd) => {
                let result = tokio::time::timeout(
                    Duration::from_secs(SCREENSHOT_TIMEOUT_SECS),
                    cmd.output(),
                )
                .await;

                match result {
                    Ok(Ok(output)) => {
                        if !output.status.success() {
                            let stderr = String::from_utf8_lossy(&output.stderr);
                            return Ok(ToolResult {
                                success: false,
                                output: String::new(),
                                error: Some(format!("Screenshot failed: {}", stderr)),
                            });
                        }
                        self.read_and_encode(&output_path).await
                    }
                    Ok(Err(e)) => Ok(ToolResult {
                        success: false,
                        output: String::new(),
                        error: Some(format!("Failed to execute: {}", e)),
                    }),
                    Err(_) => Ok(ToolResult {
                        success: false,
                        output: String::new(),
                        error: Some(format!(
                            "Screenshot timed out after {}s",
                            SCREENSHOT_TIMEOUT_SECS
                        )),
                    }),
                }
            }
            Err(e) => Ok(ToolResult {
                success: false,
                output: String::new(),
                error: Some(e.to_string()),
            }),
        }
    }

    /// Capture full screen
    async fn capture_screen(
        &self,
        output_path: &str,
        include_cursor: bool,
    ) -> anyhow::Result<Command> {
        if cfg!(target_os = "macos") {
            let mut args: Vec<&str> = Vec::new();
            if !include_cursor {
                args.push("-x");
            }
            args.push(output_path);
            Ok(self.build_command("screencapture", &args))
        } else if cfg!(target_os = "linux") {
            Ok(self.build_command("scrot", &[output_path]))
        } else if cfg!(target_os = "windows") {
            let ps_cmd = format!(
                "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Screen]::PrimaryScreen.Bitmap.Save('{}')",
                output_path.replace('\\', "\\\\")
            );
            Ok(self.build_command("powershell", &["-NoProfile", "-Command", &ps_cmd]))
        } else {
            anyhow::bail!("Platform not supported")
        }
    }

    /// Capture specific window
    async fn capture_window(&self, output_path: &str, target: &str) -> anyhow::Result<Command> {
        if cfg!(target_os = "macos") {
            // Use screencapture with window flag
            let mut args = vec!["-x"];
            if target == "frontmost" {
                args.push("-w");
            }
            args.push(output_path);
            Ok(self.build_command("screencapture", &args))
        } else if cfg!(target_os = "linux") {
            // Use xdotool to find and capture window
            Ok(self.build_command(
                "xdotool",
                &["selectwindow", "--sync", "exec", "--", "scrot", output_path],
            ))
        } else if cfg!(target_os = "windows") {
            // Use PowerShell with window handle
            let ps_cmd = format!(
                r#"Add-Type -AssemblyName System.Windows.Forms; $hwnd = (Get-Process -Id {} | Select-Object -First 1).MainWindowHandle; if($hwnd) {{ SetForegroundWindow $hwnd; Start-Sleep -Milliseconds 100; [System.Windows.Forms.Screen]::PrimaryScreen.Bitmap.Save('{}') }}"#,
                target,
                output_path.replace('\\', "\\\\")
            );
            Ok(self.build_command("powershell", &["-NoProfile", "-Command", &ps_cmd]))
        } else {
            anyhow::bail!("Window capture not supported on this platform")
        }
    }

    /// Capture screen region
    async fn capture_region(
        &self,
        output_path: &str,
        x: i32,
        y: i32,
        width: i32,
        height: i32,
    ) -> anyhow::Result<Command> {
        if cfg!(target_os = "macos") {
            let region_str = format!("{},{},{},{}", x, y, width, height);
            Ok(self.build_command("screencapture", &["-x", "-R", &region_str, output_path]))
        } else if cfg!(target_os = "linux") {
            // Use import from ImageMagick
            let crop_str = format!("{}x{}+{}+{}", width, height, x, y);
            Ok(self.build_command(
                "import",
                &["-window", "root", "-crop", &crop_str, output_path],
            ))
        } else if cfg!(target_os = "windows") {
            let ps_cmd = format!(
                r#"Add-Type -AssemblyName System.Windows.Forms; Add-Type -AssemblyName System.Drawing; $bmp = New-Object System.Drawing.Bitmap({},{}); $g = [System.Drawing.Graphics]::FromImage($bmp); $g.CopyFromScreen({},{},0,0,New-Object System.Drawing.Size({},{})); $bmp.Save('{}'); $g.Dispose(); $bmp.Dispose()"#,
                width,
                height,
                x,
                y,
                width,
                height,
                output_path.replace('\\', "\\\\")
            );
            Ok(self.build_command("powershell", &["-NoProfile", "-Command", &ps_cmd]))
        } else {
            anyhow::bail!("Region capture not supported on this platform")
        }
    }

    /// Capture specific display
    async fn capture_display(&self, output_path: &str, display: &str) -> anyhow::Result<Command> {
        if cfg!(target_os = "macos") {
            let display_flag = match display {
                "main" | "0" => "",
                _ => display,
            };
            Ok(self.build_command("screencapture", &["-x", "-D", display_flag, output_path]))
        } else if cfg!(target_os = "linux") {
            // Use display number with scrot
            Ok(self.build_command("scrot", &["-d", display, output_path]))
        } else {
            // Windows: just capture primary for now
            self.capture_screen(output_path, true).await
        }
    }

    /// Interactive window selection
    async fn capture_interactive(&self) -> anyhow::Result<ToolResult> {
        let timestamp = chrono::Utc::now().format("%Y%m%d_%H%M%S");
        let output_path = self
            .security
            .workspace_dir
            .join(format!("screenshot_{timestamp}.png"));
        let output_str = output_path.to_string_lossy().to_string();

        let cmd_result: anyhow::Result<Command> = if cfg!(target_os = "macos") {
            Ok(self.build_command("screencapture", &["-i", "-s", "-x", &output_str]))
        } else if cfg!(target_os = "linux") {
            Ok(self.build_command("scrot", &["-s", &output_str]))
        } else if cfg!(target_os = "windows") {
            let ps_cmd = format!(
                r#"Add-Type -AssemblyName System.Windows.Forms; Add-Type -AssemblyName System.Drawing; [System.Windows.Forms.Cursor]::Position = [System.Drawing.Point]::Empty; Start-Sleep -Milliseconds 500; $x = [System.Windows.Forms.Control]::MousePosition.X; $y = [System.Windows.Forms.Control]::MousePosition.Y; $bmp = New-Object System.Drawing.Bitmap(100,100); $g = [System.Drawing.Graphics]::FromImage($bmp); $g.CopyFromScreen($x,$y,0,0,New-Object System.Drawing.Size(100,100)); $bmp.Save('{}'); $g.Dispose(); $bmp.Dispose()"#,
                output_str.replace('\\', "\\\\")
            );
            Ok(self.build_command("powershell", &["-NoProfile", "-Command", &ps_cmd]))
        } else {
            Err(anyhow::anyhow!("Interactive capture not supported"))
        };

        match cmd_result {
            Ok(mut cmd) => {
                let result = tokio::time::timeout(
                    Duration::from_secs(30), // Longer timeout for interactive
                    cmd.output(),
                )
                .await;

                match result {
                    Ok(Ok(output)) => {
                        if !output.status.success() || !output_path.exists() {
                            let stderr = String::from_utf8_lossy(&output.stderr);
                            return Ok(ToolResult {
                                success: false,
                                output: String::new(),
                                error: Some(format!(
                                    "Interactive capture cancelled or failed: {}",
                                    stderr
                                )),
                            });
                        }
                        self.read_and_encode(&output_path).await
                    }
                    Ok(Err(e)) => Ok(ToolResult {
                        success: false,
                        output: String::new(),
                        error: Some(format!("Failed to execute: {}", e)),
                    }),
                    Err(_) => Ok(ToolResult {
                        success: false,
                        output: String::new(),
                        error: Some("Interactive capture timed out".into()),
                    }),
                }
            }
            Err(e) => Ok(ToolResult {
                success: false,
                output: String::new(),
                error: Some(e.to_string()),
            }),
        }
    }

    /// Read screenshot and encode as base64
    async fn read_and_encode(&self, output_path: &std::path::Path) -> anyhow::Result<ToolResult> {
        // Increased limit: 10MB raw image (~13MB base64) - most screenshots will fit
        const MAX_RAW_BYTES: u64 = 10_485_760;

        if let Ok(meta) = tokio::fs::metadata(output_path).await {
            if meta.len() > MAX_RAW_BYTES {
                return Ok(ToolResult {
                    success: true,
                    output: format!(
                        "Screenshot saved to: {}\nSize: {} bytes (too large to encode inline)",
                        output_path.display(),
                        meta.len(),
                    ),
                    error: None,
                });
            }
        }

        match tokio::fs::read(output_path).await {
            Ok(bytes) => {
                use base64::Engine;
                let size = bytes.len();
                let encoded = base64::engine::general_purpose::STANDARD.encode(&bytes);

                let mime = output_path
                    .extension()
                    .and_then(|e| e.to_str())
                    .map(|e| match e {
                        "jpg" | "jpeg" => "image/jpeg",
                        "bmp" => "image/bmp",
                        "gif" => "image/gif",
                        "webp" => "image/webp",
                        _ => "image/png",
                    })
                    .unwrap_or("image/png");

                // Format as markdown image for direct display in Tauri UI
                let data_url = format!("data:{mime};base64,{}", encoded);
                let output = format!(
                    "![screenshot]({})\n\n**File:** {} | **Size:** {} bytes",
                    data_url,
                    output_path.display(),
                    size
                );

                Ok(ToolResult {
                    success: true,
                    output,
                    error: None,
                })
            }
            Err(e) => Ok(ToolResult {
                success: false,
                output: format!("Screenshot saved to: {}", output_path.display()),
                error: Some(format!("Failed to read screenshot: {}", e)),
            }),
        }
    }
}

#[async_trait]
impl Tool for EnhancedScreenshotTool {
    fn name(&self) -> &str {
        "screenshot"
    }

    fn description(&self) -> &str {
        "Capture screenshots with advanced options: list windows, capture specific windows, regions, or displays. Supports interactive window selection."
    }

    fn parameters_schema(&self) -> serde_json::Value {
        json!({
            "type": "object",
            "properties": {
                "mode": {
                    "type": "string",
                    "enum": ["list", "capture", "interactive"],
                    "description": "Capture mode: 'list' to enumerate windows, 'capture' (default) to take screenshot, 'interactive' for user-selected capture"
                },
                "target": {
                    "type": "string",
                    "description": "Window ID, window title, or 'frontmost' to capture specific window"
                },
                "region": {
                    "type": "object",
                    "properties": {
                        "x": {"type": "integer", "description": "X coordinate"},
                        "y": {"type": "integer", "description": "Y coordinate"},
                        "width": {"type": "integer", "description": "Region width"},
                        "height": {"type": "integer", "description": "Region height"}
                    },
                    "description": "Screen region to capture"
                },
                "display": {
                    "type": "string",
                    "description": "Display ID ('main', '0', '1', etc.) for multi-monitor"
                },
                "include_cursor": {
                    "type": "boolean",
                    "default": true,
                    "description": "Include cursor in screenshot (macOS/Linux)"
                },
                "filename": {
                    "type": "string",
                    "description": "Optional output filename"
                }
            }
        })
    }

    async fn execute(&self, args: serde_json::Value) -> anyhow::Result<ToolResult> {
        if !self.security.can_act() {
            return Ok(ToolResult {
                success: false,
                output: String::new(),
                error: Some("Action blocked: autonomy is read-only".into()),
            });
        }

        self.execute_capture(args).await
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::runtime::NativeRuntime;
    use crate::security::{AutonomyLevel, SecurityPolicy};

    fn test_security() -> Arc<SecurityPolicy> {
        Arc::new(SecurityPolicy {
            autonomy: AutonomyLevel::Full,
            workspace_dir: std::env::temp_dir(),
            ..SecurityPolicy::default()
        })
    }

    #[test]
    fn tool_name() {
        let tool = EnhancedScreenshotTool::new(
            test_security(),
            Arc::new(NativeRuntime::new()) as Arc<dyn RuntimeAdapter>,
        );
        assert_eq!(tool.name(), "enhanced_screenshot");
    }

    #[test]
    fn tool_description() {
        let tool = EnhancedScreenshotTool::new(
            test_security(),
            Arc::new(NativeRuntime::new()) as Arc<dyn RuntimeAdapter>,
        );
        assert!(!tool.description().is_empty());
        assert!(tool.description().contains("window"));
    }

    #[test]
    fn tool_schema() {
        let tool = EnhancedScreenshotTool::new(
            test_security(),
            Arc::new(NativeRuntime::new()) as Arc<dyn RuntimeAdapter>,
        );
        let schema = tool.parameters_schema();
        assert!(schema["properties"].is_object());
        assert!(schema["properties"]["mode"].is_object());
    }

    #[test]
    fn tool_spec() {
        let tool = EnhancedScreenshotTool::new(
            test_security(),
            Arc::new(NativeRuntime::new()) as Arc<dyn RuntimeAdapter>,
        );
        let spec = tool.spec();
        assert_eq!(spec.name, "enhanced_screenshot");
        assert!(spec.parameters.is_object());
    }
}
