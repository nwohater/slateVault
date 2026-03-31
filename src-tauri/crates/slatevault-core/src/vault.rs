use std::path::{Path, PathBuf};

use crate::config::{VaultConfig, VaultMeta, McpConfig, SyncConfig};
use crate::document::Document;
use crate::error::Result;
use crate::project::Project;
use crate::search::SearchIndex;

pub struct Vault {
    pub root: PathBuf,
    pub config: VaultConfig,
    pub search: SearchIndex,
    repo: git2::Repository,
}

impl Vault {
    pub fn create(root: &Path, name: &str) -> Result<Self> {
        if root.join("vault.toml").exists() {
            return Err(crate::CoreError::VaultAlreadyExists(
                root.display().to_string(),
            ));
        }

        std::fs::create_dir_all(root.join("projects"))?;

        let config = VaultConfig {
            vault: VaultMeta {
                name: name.to_string(),
                version: "0.1.0".to_string(),
            },
            sync: SyncConfig::default(),
            mcp: McpConfig::default(),
        };

        let toml_str = toml::to_string_pretty(&config)?;
        std::fs::write(root.join("vault.toml"), toml_str)?;

        // Write .gitignore
        std::fs::write(
            root.join(".gitignore"),
            "index.db\nindex.db-journal\n.DS_Store\n",
        )?;

        // Init git repo with 'main' as default branch
        let repo = git2::Repository::init(root)?;
        repo.config()?.set_str("init.defaultBranch", "main")?;

        // Init search index
        let search = SearchIndex::open(&root.join("index.db"))?;

        Ok(Self {
            root: root.to_path_buf(),
            config,
            search,
            repo,
        })
    }

    pub fn open(root: &Path) -> Result<Self> {
        let toml_path = root.join("vault.toml");
        if !toml_path.exists() {
            return Err(crate::CoreError::VaultNotFound(
                root.display().to_string(),
            ));
        }

        let toml_str = std::fs::read_to_string(&toml_path)?;
        let config: VaultConfig = toml::from_str(&toml_str)?;
        let repo = git2::Repository::open(root)?;
        let search = SearchIndex::open(&root.join("index.db"))?;

        Ok(Self {
            root: root.to_path_buf(),
            config,
            search,
            repo,
        })
    }

    pub fn projects_dir(&self) -> PathBuf {
        self.root.join("projects")
    }

    /// Rebuild the FTS5 search index by walking all documents in all projects.
    pub fn rebuild_index(&self) -> Result<usize> {
        let mut count = 0;
        let projects = self.list_projects()?;
        for project_config in &projects {
            let name = &project_config.project.name;
            if let Ok(docs) = self.list_documents(name, None) {
                for doc in &docs {
                    self.search.index_document(
                        name,
                        &doc.path,
                        &doc.front_matter.title,
                        &doc.content,
                        &doc.front_matter.tags,
                    )?;
                    count += 1;
                }
            }
        }
        Ok(count)
    }

    /// Get summary stats for the vault.
    pub fn stats(&self) -> Result<VaultStats> {
        let projects = self.list_projects()?;
        let mut doc_count = 0;
        for p in &projects {
            if let Ok(docs) = self.list_documents(&p.project.name, None) {
                doc_count += docs.len();
            }
        }
        Ok(VaultStats {
            project_count: projects.len(),
            doc_count,
            mcp_enabled: self.config.mcp.enabled,
            mcp_port: self.config.mcp.port,
            remote_branch: self.config.sync.remote_branch.clone(),
            remote_url: self.config.sync.remote_url.clone(),
        })
    }

    // -- Project operations --

    pub fn create_project(
        &self,
        name: &str,
        description: &str,
        tags: Vec<String>,
    ) -> Result<Project> {
        Project::create(&self.projects_dir(), name, description, tags)
    }

    pub fn open_project(&self, name: &str) -> Result<Project> {
        Project::open(&self.projects_dir(), name)
    }

    pub fn list_projects(&self) -> Result<Vec<crate::config::ProjectConfig>> {
        Project::list_all(&self.projects_dir())
    }

    // -- Document operations --

    pub fn write_document(
        &self,
        project_name: &str,
        path: &str,
        title: &str,
        content: &str,
        tags: Vec<String>,
        ai_tool: Option<String>,
    ) -> Result<Document> {
        let project = self.open_project(project_name)?;
        let doc = Document::new(
            title.to_string(),
            content.to_string(),
            project_name.to_string(),
            path.to_string(),
            tags.clone(),
            ai_tool,
        );

        let file_path = project.docs_dir().join(path);
        if let Some(parent) = file_path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        std::fs::write(&file_path, doc.to_string()?)?;

        // Index for search
        self.search
            .index_document(project_name, path, title, content, &tags)?;

        // Auto-stage if configured
        if self.config.mcp.auto_stage_ai_writes && doc.front_matter.ai_tool.is_some() {
            self.stage_file(&file_path)?;
        }

        Ok(doc)
    }

    pub fn read_document(&self, project_name: &str, path: &str) -> Result<Document> {
        let project = self.open_project(project_name)?;
        let file_path = project.docs_dir().join(path);

        if !file_path.exists() {
            return Err(crate::CoreError::DocumentNotFound(format!(
                "{}/{}",
                project_name, path
            )));
        }

        let raw = std::fs::read_to_string(&file_path)?;
        Document::parse(&raw, path)
    }

    pub fn list_documents(
        &self,
        project_name: &str,
        tag_filter: Option<&[String]>,
    ) -> Result<Vec<Document>> {
        let project = self.open_project(project_name)?;
        let docs_dir = project.docs_dir();
        let mut documents = Vec::new();

        if !docs_dir.exists() {
            return Ok(documents);
        }

        self.walk_docs(&docs_dir, &docs_dir, tag_filter, &mut documents)?;
        Ok(documents)
    }

    fn walk_docs(
        &self,
        base: &Path,
        dir: &Path,
        tag_filter: Option<&[String]>,
        docs: &mut Vec<Document>,
    ) -> Result<()> {
        for entry in std::fs::read_dir(dir)? {
            let entry = entry?;
            let path = entry.path();
            if path.is_dir() {
                self.walk_docs(base, &path, tag_filter, docs)?;
            } else if path.extension().map_or(false, |e| e == "md") {
                let raw = std::fs::read_to_string(&path)?;
                let rel = path
                    .strip_prefix(base)
                    .unwrap_or(&path)
                    .to_string_lossy()
                    .replace('\\', "/");

                if let Ok(doc) = Document::parse(&raw, &rel) {
                    if let Some(tags) = tag_filter {
                        if tags.iter().all(|t| doc.front_matter.tags.contains(t)) {
                            docs.push(doc);
                        }
                    } else {
                        docs.push(doc);
                    }
                }
            }
        }
        Ok(())
    }

    pub fn search_documents(
        &self,
        query: &str,
        project: Option<&str>,
        limit: Option<usize>,
    ) -> Result<Vec<crate::search::SearchResult>> {
        self.search.search(query, project, limit.unwrap_or(20))
    }

    pub fn get_project_context(&self, project_name: &str) -> Result<Vec<(String, String)>> {
        let project = self.open_project(project_name)?;
        let mut context = Vec::new();

        for ctx_path in &project.config.project.ai_context_files {
            let file_path = project.docs_dir().join(ctx_path);
            if file_path.exists() {
                let content = std::fs::read_to_string(&file_path)?;
                context.push((ctx_path.clone(), content));
            }
        }

        Ok(context)
    }

    // -- Git operations --

    pub fn stage_file(&self, path: &Path) -> Result<()> {
        let relative = path
            .strip_prefix(&self.root)
            .unwrap_or(path);
        let mut index = self.repo.index()?;
        if path.exists() {
            index.add_path(relative)?;
        } else {
            index.remove_path(relative)?;
        }
        index.write()?;
        Ok(())
    }

    pub fn stage_path(&self, relative_path: &str) -> Result<()> {
        let full = self.root.join(relative_path);
        self.stage_file(&full)
    }

    pub fn unstage_file(&self, relative_path: &str) -> Result<()> {
        let mut index = self.repo.index()?;
        let head = self.repo.head();

        match head {
            Ok(head_ref) => {
                let tree = head_ref.peel_to_tree()?;
                let entry = tree.get_path(std::path::Path::new(relative_path));
                match entry {
                    Ok(entry) => {
                        // File existed in HEAD — restore index entry to HEAD version
                        let idx_entry = git2::IndexEntry {
                            ctime: git2::IndexTime::new(0, 0),
                            mtime: git2::IndexTime::new(0, 0),
                            dev: 0,
                            ino: 0,
                            mode: entry.filemode() as u32,
                            uid: 0,
                            gid: 0,
                            file_size: 0,
                            id: entry.id(),
                            flags: 0,
                            flags_extended: 0,
                            path: relative_path.as_bytes().to_vec(),
                        };
                        index.add(&idx_entry)?;
                    }
                    Err(_) => {
                        // File is new (not in HEAD) — remove from index entirely
                        index.remove_path(std::path::Path::new(relative_path))?;
                    }
                }
            }
            Err(_) => {
                // No HEAD (initial commit) — remove from index
                index.remove_path(std::path::Path::new(relative_path))?;
            }
        }

        index.write()?;
        Ok(())
    }

    pub fn status(&self) -> Result<Vec<FileStatus>> {
        let statuses = self.repo.statuses(Some(
            git2::StatusOptions::new()
                .include_untracked(true)
                .recurse_untracked_dirs(true),
        ))?;

        let mut result = Vec::new();
        for entry in statuses.iter() {
            let path = entry.path().unwrap_or("").to_string();
            let s = entry.status();

            let status_str = if s.contains(git2::Status::INDEX_NEW) {
                "staged_new"
            } else if s.contains(git2::Status::INDEX_MODIFIED) {
                "staged_modified"
            } else if s.contains(git2::Status::INDEX_DELETED) {
                "staged_deleted"
            } else if s.contains(git2::Status::WT_NEW) {
                "new"
            } else if s.contains(git2::Status::WT_MODIFIED) {
                "modified"
            } else if s.contains(git2::Status::WT_DELETED) {
                "deleted"
            } else {
                continue;
            };

            result.push(FileStatus {
                path,
                status: status_str.to_string(),
            });
        }

        Ok(result)
    }

    pub fn log(&self, limit: usize) -> Result<Vec<CommitInfo>> {
        let mut commits = Vec::new();
        let head = match self.repo.head() {
            Ok(h) => h,
            Err(_) => return Ok(commits), // No commits yet
        };
        let oid = head.target().ok_or_else(|| {
            crate::CoreError::Git(git2::Error::from_str("HEAD has no target"))
        })?;

        let mut revwalk = self.repo.revwalk()?;
        revwalk.push(oid)?;
        revwalk.set_sorting(git2::Sort::TIME)?;

        for (i, oid) in revwalk.enumerate() {
            if i >= limit {
                break;
            }
            let oid = oid?;
            let commit = self.repo.find_commit(oid)?;
            commits.push(CommitInfo {
                oid: oid.to_string()[..8].to_string(),
                message: commit.message().unwrap_or("").trim().to_string(),
                author: commit.author().name().unwrap_or("unknown").to_string(),
                date: chrono::DateTime::from_timestamp(commit.time().seconds(), 0)
                    .map(|d| d.to_rfc3339())
                    .unwrap_or_default(),
            });
        }

        Ok(commits)
    }

    pub fn commit(&self, message: &str) -> Result<git2::Oid> {
        let mut index = self.repo.index()?;
        let tree_oid = index.write_tree()?;
        let tree = self.repo.find_tree(tree_oid)?;

        let sig = self.repo.signature().or_else(|_| {
            git2::Signature::now("slateVault User", "user@slatevault.local")
        })?;

        let parent = self.repo.head().ok().and_then(|head| {
            head.peel_to_commit().ok()
        });

        let parents: Vec<&git2::Commit> = parent.as_ref().map_or(vec![], |p| vec![p]);

        let oid = self.repo.commit(
            Some("HEAD"),
            &sig,
            &sig,
            message,
            &tree,
            &parents,
        )?;

        Ok(oid)
    }

    // -- Config operations --

    pub fn save_config(&self) -> Result<()> {
        let toml_str = toml::to_string_pretty(&self.config)?;
        std::fs::write(self.root.join("vault.toml"), toml_str)?;
        Ok(())
    }

    pub fn set_git_remote(&self, url: &str) -> Result<()> {
        let remote = self.repo.find_remote("origin");
        match remote {
            Ok(_) => {
                self.repo.remote_set_url("origin", url)?;
            }
            Err(_) => {
                self.repo.remote("origin", url)?;
            }
        }
        Ok(())
    }
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct FileStatus {
    pub path: String,
    pub status: String,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct CommitInfo {
    pub oid: String,
    pub message: String,
    pub author: String,
    pub date: String,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct VaultStats {
    pub project_count: usize,
    pub doc_count: usize,
    pub mcp_enabled: bool,
    pub mcp_port: u16,
    pub remote_branch: String,
    pub remote_url: Option<String>,
}
