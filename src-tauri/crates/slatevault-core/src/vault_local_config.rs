use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

use crate::config::VaultConfig;
use crate::error::Result;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct VaultLocalConfig {
    #[serde(default)]
    pub sync: VaultLocalSyncConfig,
    #[serde(default)]
    pub mcp: VaultLocalMcpConfig,
    #[serde(default)]
    pub ai: VaultLocalAiConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct VaultLocalSyncConfig {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub remote_url: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub pull_on_open: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub push_on_close: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ssh_key_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct VaultLocalMcpConfig {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub port: Option<u16>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct VaultLocalAiConfig {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub enabled: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub endpoint_url: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
}

impl VaultLocalConfig {
    pub fn path(root: &Path) -> PathBuf {
        root.join("vault.local.toml")
    }

    pub fn load(root: &Path) -> Result<Self> {
        let path = Self::path(root);
        if !path.exists() {
            return Ok(Self::default());
        }
        let content = std::fs::read_to_string(&path)?;
        Ok(toml::from_str(&content)?)
    }

    pub fn save(&self, root: &Path) -> Result<()> {
        let path = Self::path(root);
        let content = toml::to_string_pretty(self).map_err(crate::CoreError::TomlSerialize)?;
        std::fs::write(path, content)?;
        Ok(())
    }

    pub fn merge_with_fallback(mut self, fallback: Self) -> Self {
        if self.sync.remote_url.is_none() {
            self.sync.remote_url = fallback.sync.remote_url;
        }
        if self.sync.pull_on_open.is_none() {
            self.sync.pull_on_open = fallback.sync.pull_on_open;
        }
        if self.sync.push_on_close.is_none() {
            self.sync.push_on_close = fallback.sync.push_on_close;
        }
        if self.sync.ssh_key_path.is_none() {
            self.sync.ssh_key_path = fallback.sync.ssh_key_path;
        }
        if self.mcp.port.is_none() {
            self.mcp.port = fallback.mcp.port;
        }
        if self.ai.enabled.is_none() {
            self.ai.enabled = fallback.ai.enabled;
        }
        if self.ai.endpoint_url.is_none() {
            self.ai.endpoint_url = fallback.ai.endpoint_url;
        }
        if self.ai.model.is_none() {
            self.ai.model = fallback.ai.model;
        }
        self
    }

    pub fn apply_to(&self, config: &mut VaultConfig) {
        if let Some(remote_url) = &self.sync.remote_url {
            config.sync.remote_url = Some(remote_url.clone());
        }
        if let Some(pull_on_open) = self.sync.pull_on_open {
            config.sync.pull_on_open = pull_on_open;
        }
        if let Some(push_on_close) = self.sync.push_on_close {
            config.sync.push_on_close = push_on_close;
        }
        if let Some(ssh_key_path) = &self.sync.ssh_key_path {
            config.sync.ssh_key_path = Some(ssh_key_path.clone());
        }
        if let Some(port) = self.mcp.port {
            config.mcp.port = port;
        }
        if let Some(enabled) = self.ai.enabled {
            config.ai.enabled = enabled;
        }
        if let Some(endpoint_url) = &self.ai.endpoint_url {
            config.ai.endpoint_url = endpoint_url.clone();
        }
        if let Some(model) = &self.ai.model {
            config.ai.model = model.clone();
        }
    }

    pub fn from_effective_config(config: &VaultConfig) -> Self {
        Self {
            sync: VaultLocalSyncConfig {
                remote_url: config.sync.remote_url.clone(),
                pull_on_open: Some(config.sync.pull_on_open),
                push_on_close: Some(config.sync.push_on_close),
                ssh_key_path: config.sync.ssh_key_path.clone(),
            },
            mcp: VaultLocalMcpConfig {
                port: Some(config.mcp.port),
            },
            ai: VaultLocalAiConfig {
                enabled: Some(config.ai.enabled),
                endpoint_url: Some(config.ai.endpoint_url.clone()),
                model: Some(config.ai.model.clone()),
            },
        }
    }
}
