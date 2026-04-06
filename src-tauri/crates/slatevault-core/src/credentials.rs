use serde::{Deserialize, Serialize};
use std::path::PathBuf;

use crate::error::Result;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Credentials {
    #[serde(default)]
    pub github_pat: Option<String>,
    #[serde(default)]
    pub ado_pat: Option<String>,
    #[serde(default)]
    pub ado_organization: Option<String>,
    #[serde(default)]
    pub ado_project: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct CredentialsMasked {
    pub github_pat: Option<String>,
    pub ado_pat: Option<String>,
    pub ado_organization: Option<String>,
    pub ado_project: Option<String>,
}

impl Credentials {
    fn credentials_path() -> Result<PathBuf> {
        let home = dirs::home_dir().ok_or_else(|| {
            crate::CoreError::CredentialsNotFound("Cannot determine home directory".to_string())
        })?;
        Ok(home.join(".slatevault").join("credentials.toml"))
    }

    pub fn load() -> Result<Self> {
        let path = Self::credentials_path()?;
        if !path.exists() {
            return Ok(Self::default());
        }
        let content = std::fs::read_to_string(&path)?;
        let creds: Credentials = toml::from_str(&content)?;
        Ok(creds)
    }

    pub fn save(&self) -> Result<()> {
        let path = Self::credentials_path()?;
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let content = toml::to_string_pretty(self).map_err(|e| {
            crate::CoreError::TomlSerialize(e)
        })?;
        std::fs::write(&path, content)?;
        Ok(())
    }

    pub fn masked(&self) -> CredentialsMasked {
        CredentialsMasked {
            github_pat: self.github_pat.as_ref().map(|t| mask_token(t)),
            ado_pat: self.ado_pat.as_ref().map(|t| mask_token(t)),
            ado_organization: self.ado_organization.clone(),
            ado_project: self.ado_project.clone(),
        }
    }
}

fn mask_token(token: &str) -> String {
    if token.len() <= 4 {
        "****".to_string()
    } else {
        format!("****{}", &token[token.len() - 4..])
    }
}
