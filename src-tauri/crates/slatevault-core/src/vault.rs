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

        // Init git repo
        let repo = git2::Repository::init(root)?;

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
        index.add_path(relative)?;
        index.write()?;
        Ok(())
    }

    pub fn commit(&self, message: &str) -> Result<git2::Oid> {
        let mut index = self.repo.index()?;
        let tree_oid = index.write_tree()?;
        let tree = self.repo.find_tree(tree_oid)?;

        let sig = self.repo.signature()?;

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
}
