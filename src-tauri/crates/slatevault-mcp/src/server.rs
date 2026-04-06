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

    #[tool(description = "Generate a structured, actionable agent brief for a project. Includes project summary, key documents, current focus, constraints, and suggested actions. Use this at the start of any complex task.")]
    fn generate_agent_brief(
        &self,
        Parameters(params): Parameters<GenerateAgentBriefParams>,
    ) -> Result<CallToolResult, McpError> {
        let vault = self.open_vault()?;
        let docs = vault
            .list_documents(&params.project, None)
            .map_err(|e| McpError::internal_error(format!("{}", e), None))?;
        let project_config = vault
            .open_project(&params.project)
            .map_err(|e| McpError::internal_error(format!("{}", e), None))?;

        let canonical: Vec<_> = docs.iter().filter(|d| d.front_matter.canonical).collect();
        let protected_count = docs.iter().filter(|d| d.front_matter.protected).count();
        let ai_count = docs.iter().filter(|d| format!("{:?}", d.front_matter.author).to_lowercase() == "ai").count();
        let draft_count = docs.iter().filter(|d| format!("{:?}", d.front_matter.status).to_lowercase() == "draft").count();

        // Folder counts
        let mut folder_counts: std::collections::BTreeMap<String, usize> = std::collections::BTreeMap::new();
        for doc in &docs {
            let folder = if doc.path.contains('/') { doc.path.split('/').next().unwrap_or("root") } else { "(root)" };
            *folder_counts.entry(folder.to_string()).or_default() += 1;
        }

        let mut output = format!("# Agent Brief: {}\n\n", params.project);

        // 1. Project Summary
        output.push_str("## Project Summary\n\n");
        let desc = &project_config.config.project.description;
        if !desc.is_empty() {
            output.push_str(&format!("{}\n\n", desc));
        }
        output.push_str(&format!(
            "- **Documents:** {} ({} canonical, {} protected, {} AI-authored, {} drafts)\n",
            docs.len(), canonical.len(), protected_count, ai_count, draft_count
        ));
        if !folder_counts.is_empty() {
            output.push_str("\n**Structure:**\n");
            for (folder, count) in &folder_counts {
                output.push_str(&format!("- `{}/` — {} doc{}\n", folder, count, if *count != 1 { "s" } else { "" }));
            }
        }
        output.push_str("\n");

        // 2. Key Documents (Read First)
        output.push_str("---\n\n## Key Documents (Read First)\n\n");
        if !canonical.is_empty() {
            output.push_str("_These are canonical — they define the source of truth._\n\n");
            for doc in &canonical {
                output.push_str(&format!("### {}\n\n{}\n\n", doc.front_matter.title, doc.content));
            }
        }

        // Pinned context files
        if let Ok(context) = vault.get_project_context(&params.project) {
            let new_ctx: Vec<_> = context.iter()
                .filter(|(path, _)| !canonical.iter().any(|c| c.path == *path))
                .collect();
            if !new_ctx.is_empty() {
                if canonical.is_empty() {
                    output.push_str("_No canonical docs yet. These pinned context files are the best starting point._\n\n");
                }
                for (path, content) in &new_ctx {
                    output.push_str(&format!("### {}\n\n{}\n\n", path, content));
                }
            }
        }

        if canonical.is_empty() {
            let ctx_count = vault.get_project_context(&params.project).map(|c| c.len()).unwrap_or(0);
            if ctx_count == 0 {
                output.push_str("_No canonical or pinned context docs exist yet. Start by reading the document index below._\n\n");
            }
        }

        // Focused context (if query provided)
        if let Some(ref focus) = params.focus {
            let max = params.max_docs.unwrap_or(10);
            if let Ok(bundle) = vault.build_context_bundle(focus, Some(&params.project), Some(max)) {
                let new_docs: Vec<_> = bundle.docs.iter()
                    .filter(|d| !canonical.iter().any(|c| c.path == d.path))
                    .collect();
                if !new_docs.is_empty() {
                    output.push_str(&format!(
                        "---\n\n## Focused Context: \"{}\"\n\n_{} relevant docs_\n\n",
                        focus, new_docs.len()
                    ));
                    for doc in &new_docs {
                        output.push_str(&format!("### {}\n\n{}\n\n", doc.title, doc.content));
                    }
                }
            }
        }

        // 3. Current Focus (recently modified)
        let mut recent: Vec<_> = docs.iter().collect();
        recent.sort_by(|a, b| b.front_matter.modified.cmp(&a.front_matter.modified));
        let recent_5: Vec<_> = recent.into_iter().take(5).collect();
        output.push_str("---\n\n## Current Focus (Recently Modified)\n\n");
        for doc in &recent_5 {
            let status = format!("{:?}", doc.front_matter.status).to_lowercase();
            output.push_str(&format!(
                "- **{}** [{}] — {}\n",
                doc.front_matter.title, status, doc.front_matter.modified.format("%Y-%m-%d")
            ));
        }
        output.push_str("\n");

        // Canonical strategy
        output.push_str("---\n\n## Canonical Strategy\n\n");
        if canonical.is_empty() {
            output.push_str("No documents are currently marked as canonical. ");
            output.push_str("Establishing canonical documents (architecture, key specs, core decisions) should be prioritized. ");
            output.push_str("Mark docs as canonical by adding `canonical: true` to their frontmatter.\n\n");
        } else {
            output.push_str(&format!("{} canonical document{} established:\n", canonical.len(), if canonical.len() != 1 { "s" } else { "" }));
            for doc in &canonical {
                output.push_str(&format!("- **{}** (`{}`)\n", doc.front_matter.title, doc.path));
            }
            output.push_str("\n");
        }

        // Known gaps with urgency
        let has_gaps = canonical.is_empty() || draft_count > 0 || protected_count == 0;
        if has_gaps {
            output.push_str("## Known Gaps\n\n");
            if canonical.is_empty() && draft_count > 0 {
                output.push_str(&format!(
                    "**WARNING:** All {} documents are drafts and no canonical docs exist. This project has no established source of truth.\n\n",
                    docs.len()
                ));
            }
            if canonical.is_empty() {
                output.push_str("- No canonical documents established yet\n");
            }
            if draft_count > 0 {
                output.push_str(&format!("- {} document{} still in draft state\n", draft_count, if draft_count != 1 { "s" } else { "" }));
            }
            if protected_count == 0 && !docs.is_empty() {
                output.push_str("- No documents are protected from AI overwrites\n");
            }
            output.push_str("\n");
        }

        // 4. Constraints & Rules
        output.push_str("---\n\n## Constraints & Rules\n\n");
        output.push_str("- Do NOT overwrite protected documents — use `propose_doc_update` or `append_to_doc`\n");
        output.push_str("- Canonical docs are the source of truth — prioritize over drafts\n");
        output.push_str("- AI-authored docs are tagged `author: ai` and auto-staged for git\n");
        output.push_str("- Use `convert_to_spec` to structure messy notes\n");
        output.push_str("- Use `build_context_bundle` for focused context before major changes\n\n");

        // 5. Suggested Actions (context-aware)
        output.push_str("## Suggested Actions\n\n");
        if canonical.is_empty() {
            output.push_str("- **Identify and promote key documents to canonical status** (architecture, specs, decisions)\n");
        }
        if draft_count > 0 {
            output.push_str(&format!("- Review and finalize {} draft document{}\n", draft_count, if draft_count != 1 { "s" } else { "" }));
        }
        output.push_str("- Propose structural improvements via `propose_doc_update`\n");
        output.push_str("- Generate implementation specs from feature docs with `convert_to_spec`\n");
        output.push_str("- Use `build_context_bundle` for focused analysis before major changes\n");
        output.push_str("- Check for stale docs with `detect_stale_docs`\n\n");

        // Document index
        let non_canonical: Vec<_> = docs.iter().filter(|d| !d.front_matter.canonical).collect();
        if !non_canonical.is_empty() {
            output.push_str("---\n\n## Document Index\n\n");
            for doc in &non_canonical {
                let status = format!("{:?}", doc.front_matter.status).to_lowercase();
                let author = format!("{:?}", doc.front_matter.author).to_lowercase();
                output.push_str(&format!(
                    "- **{}** (`{}`) [{}, {}]\n",
                    doc.front_matter.title, doc.path, status, author
                ));
            }
        }

        Ok(CallToolResult::success(vec![Content::text(output)]))
    }

    #[tool(description = "Get a summary of recent changes — what docs were modified, added, or updated. Useful for session resumption ('what happened since last time?').")]
    fn get_recent_changes(
        &self,
        Parameters(params): Parameters<GetRecentChangesParams>,
    ) -> Result<CallToolResult, McpError> {
        let vault = self.open_vault()?;
        let limit = params.limit.unwrap_or(20);
        let commits = vault
            .log(limit)
            .map_err(|e| McpError::internal_error(format!("{}", e), None))?;

        if commits.is_empty() {
            return Ok(CallToolResult::success(vec![Content::text(
                "No recent changes found.",
            )]));
        }

        let mut output = format!("# Recent Changes\n\n_{} recent commits_\n\n", commits.len());

        for commit in &commits {
            output.push_str(&format!(
                "- **{}** `{}` — {}\n",
                commit.message, commit.oid, commit.date,
            ));
        }

        // Also show recently modified docs
        let projects = vault
            .list_projects()
            .map_err(|e| McpError::internal_error(format!("{}", e), None))?;

        let mut recent_docs: Vec<(String, String, String, String)> = Vec::new();

        for p in &projects {
            if let Some(ref scope) = params.project {
                if p.project.name != *scope {
                    continue;
                }
            }
            if let Ok(docs) = vault.list_documents(&p.project.name, None) {
                for doc in &docs {
                    recent_docs.push((
                        p.project.name.clone(),
                        doc.path.clone(),
                        doc.front_matter.title.clone(),
                        doc.front_matter.modified.to_rfc3339(),
                    ));
                }
            }
        }

        recent_docs.sort_by(|a, b| b.3.cmp(&a.3));
        let top_docs: Vec<_> = recent_docs.into_iter().take(10).collect();

        if !top_docs.is_empty() {
            output.push_str("\n## Recently Modified Documents\n\n");
            for (proj, path, title, modified) in &top_docs {
                output.push_str(&format!(
                    "- **{}** (`{}/docs/{}`) — {}\n",
                    title, proj, path, modified,
                ));
            }
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
