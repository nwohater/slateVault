pub mod config;
pub mod document;
pub mod error;
pub mod project;
pub mod search;
pub mod vault;

pub use error::CoreError;
pub use vault::{CommitInfo, FileStatus, Vault};
