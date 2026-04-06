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
        let results = vault
            .search_documents(&params.query, params.project.as_deref(), params.limit)
            .map_err(|e| McpError::internal_error(format!("{}", e), None))?;

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
                 ## Best practices\n\
                 - Do NOT create projects without asking the user first\n\
                 - Organize docs by type: specs/, decisions/, guides/, notes/\n\
                 - Update existing documents rather than creating duplicates\n\
                 - Use tags to categorize documents for easy filtering"
                    .to_string(),
            ),
            capabilities: ServerCapabilities::builder()
                .enable_tools()
                .build(),
            ..Default::default()
        }
    }
}
