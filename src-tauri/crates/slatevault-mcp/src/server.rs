use std::path::PathBuf;

use rmcp::{
    ErrorData as McpError, ServerHandler,
    handler::server::{router::tool::ToolRouter, wrapper::Parameters},
    model::*,
    tool, tool_handler, tool_router,
};

use slatevault_core::Vault;

use crate::tools::*;

#[derive(Clone)]
pub struct SlateVaultMcpServer {
    vault_path: PathBuf,
    tool_router: ToolRouter<Self>,
}

impl SlateVaultMcpServer {
    pub fn new(vault_path: PathBuf) -> Self {
        Self {
            vault_path,
            tool_router: Self::tool_router(),
        }
    }

    fn open_vault(&self) -> Result<Vault, McpError> {
        Vault::open(&self.vault_path).map_err(|e| {
            McpError::internal_error(format!("Failed to open vault: {}", e), None)
        })
    }
}

#[tool_router]
impl SlateVaultMcpServer {
    #[tool(description = "Create a new project folder with project.toml")]
    fn create_project(
        &self,
        Parameters(params): Parameters<CreateProjectParams>,
    ) -> Result<CallToolResult, McpError> {
        let vault = self.open_vault()?;
        if vault.config.mcp.read_only {
            return Err(McpError::internal_error(
                "MCP server is in read-only mode. Write operations are disabled.".to_string(),
                None,
            ));
        }
        vault
            .create_project(
                &params.name,
                &params.description.unwrap_or_default(),
                params.tags.unwrap_or_default(),
                None,
            )
            .map_err(|e| McpError::internal_error(format!("{}", e), None))?;

        Ok(CallToolResult::success(vec![Content::text(format!(
            "Project '{}' created successfully",
            params.name
        ))]))
    }

    #[tool(description = "Return all projects with metadata and doc counts")]
    fn list_projects(&self) -> Result<CallToolResult, McpError> {
        let vault = self.open_vault()?;
        let projects = vault
            .list_projects()
            .map_err(|e| McpError::internal_error(format!("{}", e), None))?;

        if projects.is_empty() {
            return Ok(CallToolResult::success(vec![Content::text(
                "No projects found in vault.",
            )]));
        }

        let mut output = String::new();
        for p in &projects {
            output.push_str(&format!(
                "## {}\n- Description: {}\n- Tags: {}\n\n",
                p.project.name,
                if p.project.description.is_empty() {
                    "(none)"
                } else {
                    &p.project.description
                },
                if p.project.tags.is_empty() {
                    "(none)".to_string()
                } else {
                    p.project.tags.join(", ")
                },
            ));
        }

        Ok(CallToolResult::success(vec![Content::text(output)]))
    }

    #[tool(description = "Return content of all ai_context_files for a project — call this first in every session")]
    fn get_project_context(
        &self,
        Parameters(params): Parameters<GetProjectContextParams>,
    ) -> Result<CallToolResult, McpError> {
        let vault = self.open_vault()?;
        let context = vault
            .get_project_context(&params.project)
            .map_err(|e| McpError::internal_error(format!("{}", e), None))?;

        if context.is_empty() {
            return Ok(CallToolResult::success(vec![Content::text(format!(
                "No AI context files configured for project '{}'.\nAdd file paths to ai_context_files in project.toml to pin documents as context.",
                params.project
            ))]));
        }

        let mut output = String::new();
        for (path, content) in &context {
            output.push_str(&format!("# {}\n\n{}\n\n---\n\n", path, content));
        }

        Ok(CallToolResult::success(vec![Content::text(output)]))
    }

    #[tool(description = "Create or overwrite a markdown document in a project")]
    fn write_document(
        &self,
        Parameters(params): Parameters<WriteDocumentParams>,
    ) -> Result<CallToolResult, McpError> {
        let vault = self.open_vault()?;
        if vault.config.mcp.read_only {
            return Err(McpError::internal_error(
                "MCP server is in read-only mode. Write operations are disabled.".to_string(),
                None,
            ));
        }
        let doc = vault
            .write_document(
                &params.project,
                &params.path,
                &params.title,
                &params.content,
                params.tags.unwrap_or_default(),
                params.ai_tool,
            )
            .map_err(|e| McpError::internal_error(format!("{}", e), None))?;

        let auto_staged = vault.config.mcp.auto_stage_ai_writes
            && doc.front_matter.ai_tool.is_some();

        let msg = format!(
            "Document written: {}/docs/{}\n- ID: {}\n- Author: {:?}\n- Status: {:?}{}",
            params.project,
            params.path,
            doc.front_matter.id,
            doc.front_matter.author,
            doc.front_matter.status,
            if auto_staged {
                "\n- Auto-staged for git commit"
            } else {
                ""
            },
        );

        Ok(CallToolResult::success(vec![Content::text(msg)]))
    }

    #[tool(description = "Read a document by project and path")]
    fn read_document(
        &self,
        Parameters(params): Parameters<ReadDocumentParams>,
    ) -> Result<CallToolResult, McpError> {
        let vault = self.open_vault()?;
        let doc = vault
            .read_document(&params.project, &params.path)
            .map_err(|e| McpError::internal_error(format!("{}", e), None))?;

        let output = format!(
            "---\ntitle: {}\nauthor: {:?}\nstatus: {:?}\ntags: [{}]\ncreated: {}\nmodified: {}\n---\n\n{}",
            doc.front_matter.title,
            doc.front_matter.author,
            doc.front_matter.status,
            doc.front_matter.tags.join(", "),
            doc.front_matter.created.to_rfc3339(),
            doc.front_matter.modified.to_rfc3339(),
            doc.content,
        );

        Ok(CallToolResult::success(vec![Content::text(output)]))
    }

    #[tool(description = "List all documents in a project, with optional tag filter")]
    fn list_documents(
        &self,
        Parameters(params): Parameters<ListDocumentsParams>,
    ) -> Result<CallToolResult, McpError> {
        let vault = self.open_vault()?;
        let docs = vault
            .list_documents(&params.project, params.tags.as_deref())
            .map_err(|e| McpError::internal_error(format!("{}", e), None))?;

        if docs.is_empty() {
            return Ok(CallToolResult::success(vec![Content::text(format!(
                "No documents found in project '{}'.",
                params.project
            ))]));
        }

        let mut output = String::new();
        for doc in &docs {
            output.push_str(&format!(
                "- **{}** (`{}`)\n  Author: {:?} | Status: {:?} | Tags: [{}]\n",
                doc.front_matter.title,
                doc.path,
                doc.front_matter.author,
                doc.front_matter.status,
                doc.front_matter.tags.join(", "),
            ));
        }

        Ok(CallToolResult::success(vec![Content::text(output)]))
    }

    #[tool(description = "Full-text search across the vault or a single project (FTS5 syntax supported)")]
    fn search_documents(
        &self,
        Parameters(params): Parameters<SearchDocumentsParams>,
    ) -> Result<CallToolResult, McpError> {
        let vault = self.open_vault()?;
        let has_filters = params.author.is_some()
            || params.status.is_some()
            || params.canonical_only.unwrap_or(false);

        let results = if has_filters {
            vault
                .search_documents_filtered(
                    &params.query,
                    params.project.as_deref(),
                    params.author.as_deref(),
                    params.status.as_deref(),
                    params.canonical_only.unwrap_or(false),
                    params.limit,
                )
                .map_err(|e| McpError::internal_error(format!("{}", e), None))?
        } else {
            vault
                .search_documents(&params.query, params.project.as_deref(), params.limit)
                .map_err(|e| McpError::internal_error(format!("{}", e), None))?
        };

        if results.is_empty() {
            return Ok(CallToolResult::success(vec![Content::text(format!(
                "No results found for query: {}",
                params.query
            ))]));
        }

        let mut output = format!("Found {} result(s):\n\n", results.len());
        for r in &results {
            output.push_str(&format!(
                "- **{}** (`{}/docs/{}`)\n  {}\n\n",
                r.title, r.project, r.path, r.snippet,
            ));
        }

        Ok(CallToolResult::success(vec![Content::text(output)]))
    }

    #[tool(description = "Propose an update to a document by writing it on a new branch. Returns the diff for human review. The human merges via PR when ready. Use this for protected or canonical docs, or anytime you want human approval before changes take effect.")]
    fn propose_doc_update(
        &self,
        Parameters(params): Parameters<ProposeDocUpdateParams>,
    ) -> Result<CallToolResult, McpError> {
        let vault = self.open_vault()?;
        if vault.config.mcp.read_only {
            return Err(McpError::internal_error(
                "MCP server is in read-only mode. Write operations are disabled.".to_string(),
                None,
            ));
        }
        let proposal = vault
            .propose_doc_update(
                &params.project,
                &params.path,
                &params.title,
                &params.content,
                params.tags.unwrap_or_default(),
                params.ai_tool,
                params.message.as_deref(),
            )
            .map_err(|e| McpError::internal_error(format!("{}", e), None))?;

        let output = format!(
            "## Proposal Created\n\n\
             - **Branch:** `{}`\n\
             - **Document:** `{}/docs/{}`\n\
             - **Files changed:** {} (+{} -{})\n\n\
             The update is on branch `{}`. To apply it:\n\
             1. Review the diff below\n\
             2. Switch to the branch in the Git panel\n\
             3. Create a PR or merge directly\n\n\
             ### Diff\n\n```diff\n{}\n```",
            proposal.branch,
            proposal.project,
            proposal.path,
            proposal.files_changed,
            proposal.additions,
            proposal.deletions,
            proposal.branch,
            proposal.diff_text.trim(),
        );

        Ok(CallToolResult::success(vec![Content::text(output)]))
    }

    #[tool(description = "Build a context bundle from relevant documents — searches, ranks, and concatenates docs into a single briefing optimized for AI agents. Canonical docs are prioritized.")]
    fn build_context_bundle(
        &self,
        Parameters(params): Parameters<BuildContextBundleParams>,
    ) -> Result<CallToolResult, McpError> {
        let vault = self.open_vault()?;
        let bundle = vault
            .build_context_bundle(
                &params.query,
                params.project.as_deref(),
                params.max_docs,
            )
            .map_err(|e| McpError::internal_error(format!("{}", e), None))?;

        Ok(CallToolResult::success(vec![Content::text(bundle.content)]))
    }

    #[tool(description = "Append content to an existing document without overwriting. Respects document protection — fails on protected docs.")]
    fn append_to_doc(
        &self,
        Parameters(params): Parameters<AppendToDocParams>,
    ) -> Result<CallToolResult, McpError> {
        let vault = self.open_vault()?;
        if vault.config.mcp.read_only {
            return Err(McpError::internal_error(
                "MCP server is in read-only mode. Write operations are disabled.".to_string(),
                None,
            ));
        }
        let doc = vault
            .append_to_document(
                &params.project,
                &params.path,
                &params.content,
                params.ai_tool,
            )
            .map_err(|e| McpError::internal_error(format!("{}", e), None))?;

        Ok(CallToolResult::success(vec![Content::text(format!(
            "Appended to {}/docs/{}\n- Title: {}\n- Updated: {}",
            params.project,
            params.path,
            doc.front_matter.title,
            doc.front_matter.modified.to_rfc3339(),
        ))]))
    }

    #[tool(description = "Detect stale documents that haven't been updated recently")]
    fn detect_stale_docs(
        &self,
        Parameters(params): Parameters<DetectStaleDocsParams>,
    ) -> Result<CallToolResult, McpError> {
        let vault = self.open_vault()?;
        let stale = vault
            .detect_stale_docs(params.project.as_deref(), params.days_threshold)
            .map_err(|e| McpError::internal_error(format!("{}", e), None))?;

        if stale.is_empty() {
            return Ok(CallToolResult::success(vec![Content::text(
                "No stale documents found.",
            )]));
        }

        let mut output = format!("Found {} stale document(s):\n\n", stale.len());
        for s in &stale {
            output.push_str(&format!(
                "- **{}** (`{}/docs/{}`) — {} days since last update\n",
                s.title, s.project, s.path, s.days_stale,
            ));
        }

        Ok(CallToolResult::success(vec![Content::text(output)]))
    }

    #[tool(description = "Read a scratchpad/note and return its content alongside a structured spec template. The agent should use this to transform messy notes into clean specs, then write the result with write_document.")]
    fn convert_to_spec(
        &self,
        Parameters(params): Parameters<ConvertToSpecParams>,
    ) -> Result<CallToolResult, McpError> {
        let vault = self.open_vault()?;
        let doc = vault
            .read_document(&params.project, &params.source_path)
            .map_err(|e| McpError::internal_error(format!("{}", e), None))?;

        let output = format!(
            "## Instructions\n\n\
             Transform the source content below into a structured spec using this template:\n\n\
             ```markdown\n\
             # [Title]\n\n\
             ## Problem\n\
             What problem does this solve?\n\n\
             ## Solution\n\
             What is the proposed approach?\n\n\
             ## Requirements\n\
             - [ ] Requirement 1\n\
             - [ ] Requirement 2\n\n\
             ## Technical Design\n\
             How will this be implemented?\n\n\
             ## Acceptance Criteria\n\
             - [ ] Criteria 1\n\
             - [ ] Criteria 2\n\n\
             ## Out of Scope\n\
             What is explicitly NOT included?\n\
             ```\n\n\
             ---\n\n\
             ## Source: {} (from `{}`)\n\n\
             {}\n",
            doc.front_matter.title,
            params.source_path,
            doc.content,
        );

        Ok(CallToolResult::success(vec![Content::text(output)]))
    }

    #[tool(description = "Get all canonical (source-of-truth) documents for a project. Returns full content of docs marked canonical: true. Use this for quick access to critical project context.")]
    fn get_canonical_context(
        &self,
        Parameters(params): Parameters<GetCanonicalContextParams>,
    ) -> Result<CallToolResult, McpError> {
        let vault = self.open_vault()?;
        let docs = vault
            .list_documents(&params.project, None)
            .map_err(|e| McpError::internal_error(format!("{}", e), None))?;

        let canonical: Vec<_> = docs
            .iter()
            .filter(|d| d.front_matter.canonical)
            .collect();

        if canonical.is_empty() {
            return Ok(CallToolResult::success(vec![Content::text(format!(
                "No canonical documents found in project '{}'. Mark docs as canonical by setting `canonical: true` in frontmatter.",
                params.project
            ))]));
        }

        let mut output = format!(
            "# Canonical Documents — {}\n\n_{} canonical doc(s)_\n\n---\n\n",
            params.project,
            canonical.len()
        );
        for doc in &canonical {
            output.push_str(&format!(
                "## {} [{}]\n_Source: {}/docs/{}_\n\n{}\n\n---\n\n",
                doc.front_matter.title,
                format!("{:?}", doc.front_matter.status).to_lowercase(),
                params.project,
                doc.path,
                doc.content,
            ));
        }

        Ok(CallToolResult::success(vec![Content::text(output)]))
    }

    #[tool(description = "Get a structured summary of changes between two branches — files changed, additions, deletions")]
    fn summarize_branch_diff(
        &self,
        Parameters(params): Parameters<SummarizeBranchDiffParams>,
    ) -> Result<CallToolResult, McpError> {
        let vault = self.open_vault()?;
        let summary = vault
            .summarize_branch_diff(&params.base, &params.head)
            .map_err(|e| McpError::internal_error(format!("{}", e), None))?;

        let mut output = format!(
            "## Branch Diff: {} → {}\n\n**{} files changed** (+{} -{})\n\n",
            summary.base,
            summary.head,
            summary.files_changed.len(),
            summary.total_additions,
            summary.total_deletions,
        );

        for f in &summary.files_changed {
            output.push_str(&format!(
                "- `{}` (+{} -{})\n",
                f.path, f.additions, f.deletions,
            ));
        }

        Ok(CallToolResult::success(vec![Content::text(output)]))
    }
}

#[tool_handler]
impl ServerHandler for SlateVaultMcpServer {
    fn get_info(&self) -> ServerInfo {
        ServerInfo {
            instructions: Some(
                "slateVault is a local-first markdown document vault for persisting AI-generated documentation.\n\n\
                 ## Startup workflow\n\
                 1. Call list_projects to see what projects exist\n\
                 2. If a relevant project exists, call get_project_context to load its pinned AI context files\n\
                 3. If no relevant project exists, ask the user which project to use or whether to create one\n\n\
                 ## Writing documents\n\
                 - Use write_document to save any documentation, specs, decisions, or notes you generate\n\
                 - Choose a descriptive path like 'architecture.md' or 'decisions/001-use-tauri.md'\n\
                 - Always set ai_tool to your tool name (e.g. 'claude-code') so authorship is tracked\n\
                 - Documents are auto-staged for git commit when ai_tool is set\n\n\
                 ## Reading and searching\n\
                 - Use search_documents before writing to check if a document on the topic already exists\n\
                 - Use read_document to load existing docs for context or updates\n\
                 - Use list_documents to see all docs in a project\n\n\
                 ## Context bundling\n\
                 - Use build_context_bundle to assemble relevant docs into a single briefing\n\
                 - Canonical docs are automatically prioritized in bundles\n\
                 - Use this at the start of complex tasks to gather project context\n\n\
                 ## Document safety\n\
                 - For protected or canonical docs, use propose_doc_update instead of write_document\n\
                 - propose_doc_update writes to a branch — the human reviews the diff and merges\n\
                 - Protected docs cannot be overwritten by AI tools — use append_to_doc or propose_doc_update\n\
                 - Use append_to_doc to add content without replacing existing text\n\
                 - Check detect_stale_docs periodically to flag outdated documentation\n\n\
                 ## Best practices\n\
                 - Do NOT create projects without asking the user first\n\
                 - Organize docs by type: specs/, decisions/, guides/, notes/\n\
                 - Update existing documents rather than creating duplicates\n\
                 - Use tags to categorize documents for easy filtering\n\
                 - Mark critical docs as canonical and protected"
                    .to_string(),
            ),
            capabilities: ServerCapabilities::builder()
                .enable_tools()
                .build(),
            ..Default::default()
        }
    }
}
