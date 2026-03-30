use std::path::PathBuf;

use rmcp::{ServiceExt, transport::stdio};
use slatevault_mcp::SlateVaultMcpServer;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Log to stderr so stdout stays clean for MCP protocol
    tracing_subscriber::fmt()
        .with_writer(std::io::stderr)
        .with_ansi(false)
        .init();

    // Determine vault path: SLATEVAULT_PATH env var, or default ~/.slatevault
    let vault_path = std::env::var("SLATEVAULT_PATH")
        .map(PathBuf::from)
        .unwrap_or_else(|_| {
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
