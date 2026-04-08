pub mod config;
pub mod ai;
pub mod credentials;
pub mod playbook;
pub mod document;
pub mod error;
pub mod pr;
pub mod project;
pub mod search;
pub mod template;
pub mod vault;

pub use error::CoreError;
pub use vault::{
    BranchInfo, CommitInfo, DiffFileStats, DiffHunk, DiffLine, FileDiff, FileStatus, Vault,
    VaultStats,
};
