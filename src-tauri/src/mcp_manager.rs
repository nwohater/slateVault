use std::process::{Child, Command};
use std::sync::{Arc, Mutex};
use tauri::State;

pub struct McpProcessState(Arc<Mutex<Option<McpProcess>>>);

struct McpProcess {
    child: Child,
    vault_path: String,
    port: u16,
}

impl McpProcessState {
    pub fn new() -> Self {
        Self(Arc::new(Mutex::new(None)))
    }

    pub fn stop(&self) {
        if let Ok(mut lock) = self.0.lock() {
            if let Some(mut proc) = lock.take() {
                let _ = proc.child.kill();
                let _ = proc.child.wait();
            }
        }
    }
}

impl Drop for McpProcess {
    fn drop(&mut self) {
        let _ = self.child.kill();
    }
}

/// Find the slatevault-mcp binary. Checks:
/// 1. Next to the current executable
/// 2. In the cargo target/debug directory (dev mode)
/// 3. On PATH
fn find_mcp_binary() -> Option<String> {
    // Next to current exe
    if let Ok(exe) = std::env::current_exe() {
        let dir = exe.parent()?;
        let mcp = dir.join("slatevault-mcp.exe");
        if mcp.exists() {
            return Some(mcp.to_string_lossy().to_string());
        }
        let mcp = dir.join("slatevault-mcp");
        if mcp.exists() {
            return Some(mcp.to_string_lossy().to_string());
        }
    }

    // Check if `slatevault-mcp` is on PATH
    if let Ok(output) = Command::new("slatevault-mcp").arg("--help").output() {
        if output.status.success() || output.status.code() == Some(1) {
            return Some("slatevault-mcp".to_string());
        }
    }

    None
}

#[tauri::command]
pub fn start_mcp_server(
    vault_path: String,
    port: u16,
    state: State<'_, McpProcessState>,
) -> Result<String, String> {
    let mut lock = state.0.lock().map_err(|e| e.to_string())?;

    // Kill existing process if any
    if let Some(mut proc) = lock.take() {
        let _ = proc.child.kill();
        let _ = proc.child.wait();
    }

    let binary = find_mcp_binary()
        .ok_or("slatevault-mcp binary not found. Build it with: cargo build -p slatevault-mcp")?;

    let child = Command::new(&binary)
        .env("SLATEVAULT_PATH", &vault_path)
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::null())
        .spawn()
        .map_err(|e| format!("Failed to start MCP server: {}", e))?;

    *lock = Some(McpProcess {
        child,
        vault_path: vault_path.clone(),
        port,
    });

    Ok(format!(
        "MCP server started for vault: {} (stdio mode)",
        vault_path
    ))
}

#[tauri::command]
pub fn stop_mcp_server(
    state: State<'_, McpProcessState>,
) -> Result<String, String> {
    let mut lock = state.0.lock().map_err(|e| e.to_string())?;
    if let Some(mut proc) = lock.take() {
        let _ = proc.child.kill();
        let _ = proc.child.wait();
        Ok("MCP server stopped".to_string())
    } else {
        Ok("No MCP server running".to_string())
    }
}

#[derive(serde::Serialize)]
pub struct McpServerStatus {
    pub running: bool,
    pub vault_path: Option<String>,
    pub port: Option<u16>,
    pub binary_found: bool,
}

#[tauri::command]
pub fn mcp_server_status(
    state: State<'_, McpProcessState>,
) -> Result<McpServerStatus, String> {
    let lock = state.0.lock().map_err(|e| e.to_string())?;
    let binary_found = find_mcp_binary().is_some();

    match lock.as_ref() {
        Some(proc) => Ok(McpServerStatus {
            running: true,
            vault_path: Some(proc.vault_path.clone()),
            port: Some(proc.port),
            binary_found,
        }),
        None => Ok(McpServerStatus {
            running: false,
            vault_path: None,
            port: None,
            binary_found,
        }),
    }
}
