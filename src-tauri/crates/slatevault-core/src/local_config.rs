use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;

use crate::error::Result;

/// Machine-local settings that should never be committed to git.
/// Stored at ~/.slatevault/local.toml alongside credentials.toml.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct LocalConfig {
    /// Per-project work folders, keyed by project name.
    #[serde(default)]
    pub source_folders: HashMap<String, String>,
}

impl LocalConfig {
    fn path() -> Result<PathBuf> {
        let home = dirs::home_dir().ok_or_else(|| {
            crate::CoreError::CredentialsNotFound(
                "Cannot determine home directory".to_string(),
            )
        })?;
        Ok(home.join(".slatevault").join("local.toml"))
    }

    pub fn load() -> Result<Self> {
        let path = Self::path()?;
        if !path.exists() {
            return Ok(Self::default());
        }
        let content = std::fs::read_to_string(&path)?;
        Ok(toml::from_str(&content)?)
    }

    pub fn save(&self) -> Result<()> {
        let path = Self::path()?;
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let content = toml::to_string_pretty(self).map_err(crate::CoreError::TomlSerialize)?;
        std::fs::write(&path, content)?;
        Ok(())
    }

    pub fn get_source_folder(&self, project: &str) -> Option<String> {
        self.source_folders.get(project).cloned()
    }

    pub fn set_source_folder(&mut self, project: &str, folder: Option<String>) {
        match folder {
            Some(f) => {
                self.source_folders.insert(project.to_string(), f);
            }
            None => {
                self.source_folders.remove(project);
            }
        }
    }
}
