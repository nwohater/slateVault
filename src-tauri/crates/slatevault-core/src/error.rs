use thiserror::Error;

#[derive(Error, Debug)]
pub enum CoreError {
    #[error("Vault not found at {0}")]
    VaultNotFound(String),

    #[error("Vault already exists at {0}")]
    VaultAlreadyExists(String),

    #[error("Project not found: {0}")]
    ProjectNotFound(String),

    #[error("Project already exists: {0}")]
    ProjectAlreadyExists(String),

    #[error("Document not found: {0}")]
    DocumentNotFound(String),

    #[error("Invalid front matter: {0}")]
    InvalidFrontMatter(String),

    #[error("Git error: {0}")]
    Git(#[from] git2::Error),

    #[error("Database error: {0}")]
    Database(#[from] rusqlite::Error),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("TOML parse error: {0}")]
    TomlParse(#[from] toml::de::Error),

    #[error("TOML serialize error: {0}")]
    TomlSerialize(#[from] toml::ser::Error),

    #[error("YAML error: {0}")]
    Yaml(#[from] serde_yaml::Error),
}

pub type Result<T> = std::result::Result<T, CoreError>;
