use std::path::PathBuf;

use rmcp::{ServiceExt, transport::stdio};
use slatevault_mcp::SlateVaultMcpServer;

/// Read the active vault path from ~/.slatevault/active-vault
fn read_active_vault() -> Option<PathBuf> {
    let active_file = dirs::home_dir()?.join(".slatevault").join("active-vault");
    let content = std::fs::read_to_string(&active_file).ok()?;
    let path = PathBuf::from(content.trim());
    tracing::info!("Active vault file points to: {}", path.display());
    // Check for vault.toml directly — more reliable than is_dir() on OneDrive/cloud paths
    if path.join("vault.toml").exists() || path.is_dir() {
        Some(path)
    } else {
        tracing::warn!("Active vault path not found: {}", path.display());
        None
    }
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Log to stderr so stdout stays clean for MCP protocol
    tracing_subscriber::fmt()
        .with_writer(std::io::stderr)
        .with_ansi(false)
        .init();

    // Determine vault path: SLATEVAULT_PATH env var > active-vault file > default ~/.slatevault
    let vault_path = std::env::var("SLATEVAULT_PATH")
        .map(PathBuf::from)
        .ok()
        .or_else(read_active_vault)
        .unwrap_or_else(|| {
            dirs::home_dir()
                .expect("Could not determine home directory")
                .join(".slatevault")
        });

    // Create vault if it doesn't exist
    if !vault_path.join("vault.toml").exists() {
        tracing::info!("Creating new vault at {}", vault_path.display());
        slatevault_core::Vault::create(&vault_path, "default")?;
    }

    tracing::info!("Starting slateVault MCP server (vault: {})", vault_path.display());

    let server = SlateVaultMcpServer::new(vault_path)
        .serve(stdio())
        .await
        .inspect_err(|e| tracing::error!("Server error: {:?}", e))?;

    server.waiting().await?;

    Ok(())
}
