use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VaultConfig {
    pub vault: VaultMeta,
    #[serde(default)]
    pub sync: SyncConfig,
    #[serde(default)]
    pub mcp: McpConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VaultMeta {
    pub name: String,
    #[serde(default = "default_version")]
    pub version: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SyncConfig {
    pub remote_url: Option<String>,
    #[serde(default = "default_branch")]
    pub remote_branch: String,
    #[serde(default = "default_true")]
    pub pull_on_open: bool,
    #[serde(default)]
    pub push_on_close: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpConfig {
    #[serde(default = "default_mcp_port")]
    pub port: u16,
    #[serde(default = "default_true")]
    pub auto_stage_ai_writes: bool,
}

impl Default for McpConfig {
    fn default() -> Self {
        Self {
            port: default_mcp_port(),
            auto_stage_ai_writes: true,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectConfig {
    pub project: ProjectMeta,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectMeta {
    pub name: String,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub ai_context_files: Vec<String>,
}

fn default_version() -> String {
    "0.1.0".to_string()
}

fn default_branch() -> String {
    "main".to_string()
}

fn default_mcp_port() -> u16 {
    3742
}

fn default_true() -> bool {
    true
}
