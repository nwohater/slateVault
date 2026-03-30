use rmcp::schemars;
use schemars::JsonSchema;
use serde::Deserialize;

#[derive(Debug, Deserialize, JsonSchema)]
#[schemars(description = "Create a new project in the vault")]
pub struct CreateProjectParams {
    #[schemars(description = "Project folder name in slug format (e.g. 'my-app')")]
    pub name: String,
    #[schemars(description = "Short description of the project")]
    pub description: Option<String>,
    #[schemars(description = "Initial tags for the project")]
    pub tags: Option<Vec<String>>,
}

#[derive(Debug, Deserialize, JsonSchema)]
#[schemars(description = "Get AI context files for a project — call this first in every session")]
pub struct GetProjectContextParams {
    #[schemars(description = "Project name")]
    pub project: String,
}

#[derive(Debug, Deserialize, JsonSchema)]
#[schemars(description = "Create or overwrite a markdown document")]
pub struct WriteDocumentParams {
    #[schemars(description = "Target project name")]
    pub project: String,
    #[schemars(description = "Path relative to the project's docs/ folder (e.g. 'api-spec.md' or 'decisions/001-use-tauri.md')")]
    pub path: String,
    #[schemars(description = "Document title (used in front matter)")]
    pub title: String,
    #[schemars(description = "Full markdown body (no front matter — server adds it)")]
    pub content: String,
    #[schemars(description = "Tags to apply to the document")]
    pub tags: Option<Vec<String>>,
    #[schemars(description = "Name of the calling AI tool, e.g. 'claude-code'")]
    pub ai_tool: Option<String>,
}

#[derive(Debug, Deserialize, JsonSchema)]
#[schemars(description = "Read a document by project and path")]
pub struct ReadDocumentParams {
    #[schemars(description = "Project name")]
    pub project: String,
    #[schemars(description = "Path relative to the project's docs/ folder")]
    pub path: String,
}

#[derive(Debug, Deserialize, JsonSchema)]
#[schemars(description = "List all documents in a project, with optional tag filter")]
pub struct ListDocumentsParams {
    #[schemars(description = "Project name")]
    pub project: String,
    #[schemars(description = "Filter to docs that have ALL of these tags")]
    pub tags: Option<Vec<String>>,
}

#[derive(Debug, Deserialize, JsonSchema)]
#[schemars(description = "Full-text search across the vault or a single project")]
pub struct SearchDocumentsParams {
    #[schemars(description = "Search query (SQLite FTS5 syntax supported)")]
    pub query: String,
    #[schemars(description = "Scope search to a single project")]
    pub project: Option<String>,
    #[schemars(description = "Maximum results to return (default 20)")]
    pub limit: Option<usize>,
}
