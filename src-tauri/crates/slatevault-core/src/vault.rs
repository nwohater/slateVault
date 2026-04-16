use std::path::{Component, Path, PathBuf};

use crate::config::{VaultConfig, VaultMeta, McpConfig, SyncConfig};
use crate::template::TemplateConfig;
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
            ai: crate::config::AiConfig::default(),
        };

        let toml_str = toml::to_string_pretty(&config)?;
        std::fs::write(root.join("vault.toml"), toml_str)?;

        // Write .gitignore
        std::fs::write(
            root.join(".gitignore"),
            "index.db\nindex.db-journal\n.DS_Store\n",
        )?;

        // Write default templates.json
        let _ = TemplateConfig::load(root);

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

        // Ensure templates.json exists (migration for older vaults)
        let _ = TemplateConfig::load(root);

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
        self.search.clear()?;
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
                        &format!("{:?}", doc.front_matter.author).to_lowercase(),
                        &format!("{:?}", doc.front_matter.status).to_lowercase(),
                        doc.front_matter.canonical,
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
        template: Option<&str>,
    ) -> Result<Project> {
        let mut project = Project::create(&self.projects_dir(), name, description, tags)?;

        // Apply template, pin created files as AI context, and set folder order
        let template_config = TemplateConfig::load(&self.root)?;
        if let Some(tmpl) = template_config.get(template) {
            let created = crate::template::apply_template(&project.docs_dir(), tmpl)?;
            if !created.is_empty() {
                project.config.project.ai_context_files = created;
            }
            if !tmpl.folders.is_empty() {
                project.config.project.folder_order = tmpl.folders.clone();
            }
            let toml_str = toml::to_string_pretty(&project.config)
                .map_err(|e| crate::CoreError::TomlSerialize(e))?;
            std::fs::write(
                self.projects_dir().join(name).join("project.toml"),
                toml_str,
            )?;
        }

        Ok(project)
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
        let relative_path = sanitize_relative_path(path)?;
        let normalized_path = normalize_relative_path(&relative_path);
        let file_path = project.docs_dir().join(&relative_path);

        // Check if existing doc is protected (only block AI overwrites)
        if ai_tool.is_some() {
            if file_path.exists() {
                if let Ok(existing) = self.read_document(project_name, &normalized_path) {
                    if existing.front_matter.protected {
                        return Err(crate::CoreError::Branch(
                            "Document is protected. Use append_to_doc or remove protection first."
                                .to_string(),
                        ));
                    }
                }
            }
        }
        let doc = if file_path.exists() {
            let existing = self.read_document(project_name, &normalized_path)?;
            Document::update(
                &existing,
                title.to_string(),
                content.to_string(),
                tags.clone(),
                ai_tool,
            )
        } else {
            Document::new(
                title.to_string(),
                content.to_string(),
                project_name.to_string(),
                normalized_path.clone(),
                tags.clone(),
                ai_tool,
            )
        };

        if let Some(parent) = file_path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        std::fs::write(&file_path, doc.to_string()?)?;

        // Index for search
        self.search.index_document(
            project_name,
            &normalized_path,
            title,
            content,
            &tags,
            &format!("{:?}", doc.front_matter.author).to_lowercase(),
            &format!("{:?}", doc.front_matter.status).to_lowercase(),
            doc.front_matter.canonical,
        )?;

        // Auto-stage if configured
        if self.config.mcp.auto_stage_ai_writes && doc.front_matter.ai_tool.is_some() {
            self.stage_file(&file_path)?;
        }

        Ok(doc)
    }

    pub fn read_document(&self, project_name: &str, path: &str) -> Result<Document> {
        let project = self.open_project(project_name)?;
        let relative_path = sanitize_relative_path(path)?;
        let normalized_path = normalize_relative_path(&relative_path);
        let file_path = project.docs_dir().join(&relative_path);

        if !file_path.exists() {
            return Err(crate::CoreError::DocumentNotFound(format!(
                "{}/{}",
                project_name, normalized_path
            )));
        }

        let raw = std::fs::read_to_string(&file_path)?;
        Document::parse(&raw, &normalized_path)
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

    /// List non-markdown assets (images, PDFs, etc.) in a project's docs directory.
    pub fn list_assets(&self, project_name: &str) -> Result<Vec<(String, String)>> {
        let project = self.open_project(project_name)?;
        let docs_dir = project.docs_dir();
        let mut assets: Vec<(String, String)> = Vec::new();

        if !docs_dir.exists() {
            return Ok(assets);
        }

        self.walk_assets(&docs_dir, &docs_dir, &mut assets)?;
        Ok(assets)
    }

    fn walk_assets(
        &self,
        base: &Path,
        dir: &Path,
        assets: &mut Vec<(String, String)>,
    ) -> Result<()> {
        for entry in std::fs::read_dir(dir)? {
            let entry = entry?;
            let path = entry.path();
            let filename = path
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_default();

            // Skip hidden files and macOS metadata files
            if filename.starts_with('.') {
                continue;
            }

            if path.is_dir() {
                self.walk_assets(base, &path, assets)?;
            } else if !path.extension().map_or(false, |e| e == "md") {
                let rel = path
                    .strip_prefix(base)
                    .unwrap_or(&path)
                    .to_string_lossy()
                    .replace('\\', "/");
                assets.push((rel, filename));
            }
        }
        Ok(())
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

    pub fn search_documents_filtered(
        &self,
        query: &str,
        project: Option<&str>,
        author: Option<&str>,
        status: Option<&str>,
        canonical_only: bool,
        limit: Option<usize>,
    ) -> Result<Vec<crate::search::SearchResult>> {
        self.search
            .search_filtered(query, project, author, status, canonical_only, limit.unwrap_or(20))
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

    // -- Propose doc update (branch-based safe edits) --

    /// Propose a document update by writing it on a new branch.
    /// Creates branch, writes doc, commits, switches back to original branch.
    /// Returns the diff so the human can review before merging.
    pub fn propose_doc_update(
        &self,
        project_name: &str,
        path: &str,
        title: &str,
        content: &str,
        tags: Vec<String>,
        ai_tool: Option<String>,
        proposal_message: Option<&str>,
    ) -> Result<DocProposal> {
        let original_branch = self.current_branch()?;

        // Generate branch name from path
        let slug = path
            .replace('/', "-")
            .replace(".md", "")
            .replace(' ', "-")
            .to_lowercase();
        let branch_name = format!("proposal/{}", slug);

        // Check if branch already exists, if so delete it first
        if let Ok(mut existing) = self.repo.find_branch(&branch_name, git2::BranchType::Local) {
            // Can only delete if not current
            if self.current_branch()? != branch_name {
                let _ = existing.delete();
            }
        }

        // Create branch from current HEAD
        let head = self.repo.head().map_err(|_| {
            crate::CoreError::Branch("Cannot create proposal: no commits yet".to_string())
        })?;
        let head_commit = head.peel_to_commit()?;
        self.repo.branch(&branch_name, &head_commit, true)?;

        // Switch to proposal branch
        let refname = format!("refs/heads/{}", branch_name);
        self.repo.set_head(&refname)?;
        let mut checkout = git2::build::CheckoutBuilder::new();
        checkout.safe();
        self.repo.checkout_head(Some(&mut checkout))?;

        // Read the original doc content for diff (if exists)
        let original_content = self
            .read_document(project_name, path)
            .ok()
            .map(|d| d.content.clone());

        // Write the proposed update
        let _doc = self.write_document(
            project_name,
            path,
            title,
            content,
            tags,
            ai_tool,
        )?;

        // Stage and commit
        let project_obj = self.open_project(project_name)?;
        let file_path = project_obj.docs_dir().join(path);
        self.stage_file(&file_path)?;

        let default_msg = format!("Propose update: {}", title);
        let commit_msg = proposal_message.unwrap_or(&default_msg);
        self.commit(commit_msg)?;

        // Get the diff between branches
        let diff_result = self.diff_branches(&original_branch, &branch_name);

        // Switch back to original branch
        let orig_refname = format!("refs/heads/{}", original_branch);
        self.repo.set_head(&orig_refname)?;
        let mut checkout = git2::build::CheckoutBuilder::new();
        checkout.force();
        self.repo.checkout_head(Some(&mut checkout))?;

        // Build diff summary
        let diff_files = diff_result.unwrap_or_default();
        let total_additions: usize = diff_files.iter().map(|f| f.stats.additions).sum();
        let total_deletions: usize = diff_files.iter().map(|f| f.stats.deletions).sum();

        // Build a readable diff string
        let mut diff_text = String::new();
        for file_diff in &diff_files {
            diff_text.push_str(&format!("### {}\n", file_diff.path));
            for hunk in &file_diff.hunks {
                diff_text.push_str(&format!("{}\n", hunk.header));
                for line in &hunk.lines {
                    let prefix = match line.origin {
                        '+' => "+",
                        '-' => "-",
                        _ => " ",
                    };
                    diff_text.push_str(&format!("{}{}\n", prefix, line.content));
                }
            }
            diff_text.push('\n');
        }

        Ok(DocProposal {
            branch: branch_name,
            project: project_name.to_string(),
            path: path.to_string(),
            title: title.to_string(),
            original_content,
            proposed_content: content.to_string(),
            diff_text,
            files_changed: diff_files.len(),
            additions: total_additions,
            deletions: total_deletions,
        })
    }

    // -- Context Bundling --

    /// Build a context bundle by searching for relevant docs and concatenating them.
    /// Returns a single markdown string optimized for AI agent consumption.
    pub fn build_context_bundle(
        &self,
        query: &str,
        project: Option<&str>,
        max_docs: Option<usize>,
    ) -> Result<ContextBundle> {
        let limit = max_docs.unwrap_or(10);

        // Search for relevant docs
        let results = self.search.search(query, project, limit)?;

        let mut docs = Vec::new();
        let mut total_chars = 0usize;

        for result in &results {
            if let Ok(doc) = self.read_document(&result.project, &result.path) {
                total_chars += doc.content.len();
                docs.push(BundleDoc {
                    project: result.project.clone(),
                    path: result.path.clone(),
                    title: doc.front_matter.title.clone(),
                    content: doc.content.clone(),
                    canonical: doc.front_matter.canonical,
                    status: format!("{:?}", doc.front_matter.status).to_lowercase(),
                    rank: result.rank,
                });
            }
        }

        // Sort: canonical docs first, then by search rank
        docs.sort_by(|a, b| {
            b.canonical
                .cmp(&a.canonical)
                .then(a.rank.partial_cmp(&b.rank).unwrap_or(std::cmp::Ordering::Equal))
        });

        // Build the bundle text
        let mut output = format!("# Context Bundle: {}\n\n", query);
        output.push_str(&format!(
            "_{} documents, {} chars_\n\n---\n\n",
            docs.len(),
            total_chars
        ));

        for doc in &docs {
            let markers = [
                if doc.canonical { Some("[canonical]") } else { None },
                Some(&format!("[{}]", doc.status) as &str),
            ]
            .into_iter()
            .flatten()
            .collect::<Vec<_>>()
            .join(" ");

            output.push_str(&format!(
                "## {} {}\n_Source: {}/docs/{}_\n\n{}\n\n---\n\n",
                doc.title, markers, doc.project, doc.path, doc.content
            ));
        }

        Ok(ContextBundle {
            query: query.to_string(),
            doc_count: docs.len(),
            total_chars,
            content: output,
            docs,
        })
    }

    // -- Append to document --

    pub fn append_to_document(
        &self,
        project_name: &str,
        path: &str,
        content: &str,
        ai_tool: Option<String>,
    ) -> Result<Document> {
        let doc = self.read_document(project_name, path)?;

        if doc.front_matter.protected {
            return Err(crate::CoreError::Branch(
                "Document is protected. Use propose_doc_update or remove protection first."
                    .to_string(),
            ));
        }

        let new_content = format!("{}\n\n{}", doc.content.trim_end(), content);

        self.write_document(
            project_name,
            path,
            &doc.front_matter.title,
            &new_content,
            doc.front_matter.tags.clone(),
            ai_tool,
        )
    }

    // -- Staleness Detection --

    pub fn detect_stale_docs(
        &self,
        project: Option<&str>,
        days_threshold: Option<u32>,
    ) -> Result<Vec<StaleDoc>> {
        let threshold = days_threshold.unwrap_or(30);
        let cutoff = chrono::Utc::now() - chrono::Duration::days(threshold as i64);
        let mut stale = Vec::new();

        let projects = if let Some(p) = project {
            vec![self
                .open_project(p)?
                .config
                .project
                .name
                .clone()]
        } else {
            self.list_projects()?
                .into_iter()
                .map(|p| p.project.name)
                .collect()
        };

        for proj_name in &projects {
            if let Ok(docs) = self.list_documents(proj_name, None) {
                for doc in &docs {
                    if doc.front_matter.modified < cutoff {
                        let days_since = (chrono::Utc::now() - doc.front_matter.modified)
                            .num_days();
                        stale.push(StaleDoc {
                            project: proj_name.clone(),
                            path: doc.path.clone(),
                            title: doc.front_matter.title.clone(),
                            last_modified: doc.front_matter.modified.to_rfc3339(),
                            days_stale: days_since as u32,
                        });
                    }
                }
            }
        }

        stale.sort_by(|a, b| b.days_stale.cmp(&a.days_stale));
        Ok(stale)
    }

    // -- Branch diff summary --

    pub fn summarize_branch_diff(&self, base: &str, head: &str) -> Result<BranchDiffSummary> {
        let diffs = self.diff_branches(base, head)?;

        let mut files_changed = Vec::new();
        let mut total_additions = 0usize;
        let mut total_deletions = 0usize;

        for diff in &diffs {
            total_additions += diff.stats.additions;
            total_deletions += diff.stats.deletions;
            files_changed.push(DiffFileSummary {
                path: diff.path.clone(),
                additions: diff.stats.additions,
                deletions: diff.stats.deletions,
            });
        }

        Ok(BranchDiffSummary {
            base: base.to_string(),
            head: head.to_string(),
            files_changed,
            total_additions,
            total_deletions,
        })
    }

    // -- Branch operations --

    pub fn current_branch(&self) -> Result<String> {
        match self.repo.head() {
            Ok(head) => Ok(head
                .shorthand()
                .unwrap_or("HEAD (detached)")
                .to_string()),
            Err(_) => Ok("main".to_string()), // No commits yet
        }
    }

    pub fn list_branches(&self) -> Result<Vec<BranchInfo>> {
        let mut branches = Vec::new();
        let current = self.current_branch()?;

        let repo_branches = self.repo.branches(Some(git2::BranchType::Local))?;
        for branch in repo_branches {
            let (branch, _) = branch?;
            if let Some(name) = branch.name()? {
                branches.push(BranchInfo {
                    name: name.to_string(),
                    is_current: name == current,
                });
            }
        }

        // If no branches yet (empty repo), show "main"
        if branches.is_empty() {
            branches.push(BranchInfo {
                name: "main".to_string(),
                is_current: true,
            });
        }

        Ok(branches)
    }

    pub fn create_branch(&self, name: &str) -> Result<()> {
        let head = self.repo.head().map_err(|_| {
            crate::CoreError::Branch("Cannot create branch: no commits yet".to_string())
        })?;
        let commit = head.peel_to_commit()?;
        self.repo.branch(name, &commit, false)?;
        Ok(())
    }

    pub fn switch_branch(&self, name: &str) -> Result<()> {
        // Refuse on dirty worktree
        let status = self.status()?;
        if !status.is_empty() {
            return Err(crate::CoreError::Branch(
                "Cannot switch branches with uncommitted changes. Commit or discard changes first."
                    .to_string(),
            ));
        }

        let refname = format!("refs/heads/{}", name);
        self.repo.set_head(&refname)?;

        let mut checkout = git2::build::CheckoutBuilder::new();
        checkout.safe();
        self.repo.checkout_head(Some(&mut checkout))?;

        Ok(())
    }

    pub fn delete_branch(&self, name: &str) -> Result<()> {
        let current = self.current_branch()?;
        if name == current {
            return Err(crate::CoreError::Branch(
                "Cannot delete the current branch".to_string(),
            ));
        }

        let mut branch = self
            .repo
            .find_branch(name, git2::BranchType::Local)?;
        branch.delete()?;
        Ok(())
    }

    // -- Diff operations --

    pub fn diff_file(&self, path: &str, staged: bool) -> Result<FileDiff> {
        let mut diff_opts = git2::DiffOptions::new();
        diff_opts.pathspec(path);

        let diff = if staged {
            let head_tree = self
                .repo
                .head()
                .ok()
                .and_then(|h| h.peel_to_tree().ok());
            self.repo.diff_tree_to_index(
                head_tree.as_ref(),
                None,
                Some(&mut diff_opts),
            )?
        } else {
            self.repo
                .diff_index_to_workdir(None, Some(&mut diff_opts))?
        };

        Self::parse_diff_for_file(&diff, path)
    }

    pub fn diff_branches(&self, base: &str, head: &str) -> Result<Vec<FileDiff>> {
        let base_branch = self.repo.find_branch(base, git2::BranchType::Local)?;
        let head_branch = self.repo.find_branch(head, git2::BranchType::Local)?;

        let base_tree = base_branch.get().peel_to_tree()?;
        let head_tree = head_branch.get().peel_to_tree()?;

        let diff = self
            .repo
            .diff_tree_to_tree(Some(&base_tree), Some(&head_tree), None)?;

        Self::parse_diff_to_files(&diff)
    }

    fn parse_diff_to_files(diff: &git2::Diff) -> Result<Vec<FileDiff>> {
        use std::collections::BTreeMap;

        let mut file_map: BTreeMap<String, (Vec<DiffHunk>, usize, usize)> = BTreeMap::new();

        // Process each delta (file) separately
        for delta_idx in 0..diff.deltas().len() {
            let delta = diff.get_delta(delta_idx).unwrap();
            let path = delta
                .new_file()
                .path()
                .or_else(|| delta.old_file().path())
                .map(|p| p.to_string_lossy().to_string())
                .unwrap_or_default();

            if let Ok(patch) = git2::Patch::from_diff(diff, delta_idx) {
                if let Some(patch) = patch {
                    let mut hunks = Vec::new();
                    let mut additions = 0usize;
                    let mut deletions = 0usize;

                    for hunk_idx in 0..patch.num_hunks() {
                        let (hunk, _) = patch.hunk(hunk_idx).unwrap();
                        let header = String::from_utf8_lossy(hunk.header()).trim().to_string();
                        let mut lines = Vec::new();

                        for line_idx in 0..patch.num_lines_in_hunk(hunk_idx).unwrap_or(0) {
                            if let Ok(line) = patch.line_in_hunk(hunk_idx, line_idx) {
                                let origin = line.origin();
                                if origin == '+' {
                                    additions += 1;
                                } else if origin == '-' {
                                    deletions += 1;
                                }
                                lines.push(DiffLine {
                                    origin,
                                    content: String::from_utf8_lossy(line.content())
                                        .trim_end_matches('\n')
                                        .to_string(),
                                    old_lineno: line.old_lineno(),
                                    new_lineno: line.new_lineno(),
                                });
                            }
                        }

                        hunks.push(DiffHunk { header, lines });
                    }

                    file_map.insert(path, (hunks, additions, deletions));
                }
            }
        }

        Ok(file_map
            .into_iter()
            .map(|(path, (hunks, additions, deletions))| FileDiff {
                path,
                hunks,
                stats: DiffFileStats {
                    additions,
                    deletions,
                },
            })
            .collect())
    }

    fn parse_diff_for_file(diff: &git2::Diff, path: &str) -> Result<FileDiff> {
        let files = Self::parse_diff_to_files(diff)?;
        Ok(files
            .into_iter()
            .find(|f| f.path == path)
            .unwrap_or_else(|| FileDiff {
                path: path.to_string(),
                hunks: Vec::new(),
                stats: DiffFileStats {
                    additions: 0,
                    deletions: 0,
                },
            }))
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

fn sanitize_relative_path(path: &str) -> Result<PathBuf> {
    let mut cleaned = PathBuf::new();

    for component in Path::new(path).components() {
        match component {
            Component::Normal(part) => cleaned.push(part),
            Component::CurDir => {}
            Component::ParentDir | Component::RootDir | Component::Prefix(_) => {
                return Err(crate::CoreError::Io(std::io::Error::new(
                    std::io::ErrorKind::InvalidInput,
                    format!("Path escapes the vault root: {}", path),
                )));
            }
        }
    }

    if cleaned.as_os_str().is_empty() {
        return Err(crate::CoreError::Io(std::io::Error::new(
            std::io::ErrorKind::InvalidInput,
            "Path cannot be empty",
        )));
    }

    Ok(cleaned)
}

fn normalize_relative_path(path: &Path) -> String {
    path.to_string_lossy().replace('\\', "/")
}

#[cfg(test)]
mod tests {
    use super::Vault;

    #[test]
    fn rebuild_index_removes_stale_entries_for_deleted_documents() {
        let temp_dir = tempfile::tempdir().expect("create temp dir");
        let vault = Vault::create(temp_dir.path(), "Test Vault").expect("create vault");
        vault
            .create_project("demo", "Demo project", Vec::new(), None)
            .expect("create project");
        vault
            .write_document(
                "demo",
                "notes.md",
                "Notes",
                "staletoken",
                Vec::new(),
                None,
            )
            .expect("write document");

        let initial_results = vault
            .search_documents("staletoken", Some("demo"), Some(10))
            .expect("search before delete");
        assert_eq!(initial_results.len(), 1);

        std::fs::remove_file(temp_dir.path().join("projects").join("demo").join("docs").join("notes.md"))
            .expect("delete markdown file");

        let _ = vault.rebuild_index().expect("rebuild index");

        let final_results = vault
            .search_documents("staletoken", Some("demo"), Some(10))
            .expect("search after delete");
        assert!(final_results.is_empty());
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

#[derive(Debug, Clone, serde::Serialize)]
pub struct BranchInfo {
    pub name: String,
    pub is_current: bool,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct FileDiff {
    pub path: String,
    pub hunks: Vec<DiffHunk>,
    pub stats: DiffFileStats,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct DiffHunk {
    pub header: String,
    pub lines: Vec<DiffLine>,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct DiffLine {
    pub origin: char,
    pub content: String,
    pub old_lineno: Option<u32>,
    pub new_lineno: Option<u32>,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct DiffFileStats {
    pub additions: usize,
    pub deletions: usize,
}

// -- Proposal types --

#[derive(Debug, Clone, serde::Serialize)]
pub struct DocProposal {
    pub branch: String,
    pub project: String,
    pub path: String,
    pub title: String,
    pub original_content: Option<String>,
    pub proposed_content: String,
    pub diff_text: String,
    pub files_changed: usize,
    pub additions: usize,
    pub deletions: usize,
}

// -- Context Bundling types --

#[derive(Debug, Clone, serde::Serialize)]
pub struct ContextBundle {
    pub query: String,
    pub doc_count: usize,
    pub total_chars: usize,
    pub content: String,
    pub docs: Vec<BundleDoc>,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct BundleDoc {
    pub project: String,
    pub path: String,
    pub title: String,
    pub content: String,
    pub canonical: bool,
    pub status: String,
    pub rank: f64,
}

// -- Staleness types --

#[derive(Debug, Clone, serde::Serialize)]
pub struct StaleDoc {
    pub project: String,
    pub path: String,
    pub title: String,
    pub last_modified: String,
    pub days_stale: u32,
}

// -- Branch diff summary types --

#[derive(Debug, Clone, serde::Serialize)]
pub struct BranchDiffSummary {
    pub base: String,
    pub head: String,
    pub files_changed: Vec<DiffFileSummary>,
    pub total_additions: usize,
    pub total_deletions: usize,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct DiffFileSummary {
    pub path: String,
    pub additions: usize,
    pub deletions: usize,
}
