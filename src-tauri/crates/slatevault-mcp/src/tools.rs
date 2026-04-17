use rmcp::schemars;
use schemars::JsonSchema;
use serde::{Deserialize, Deserializer};

/// Deserialize tags that might come as an array or a JSON-encoded string
fn deserialize_flexible_tags<'de, D>(deserializer: D) -> Result<Option<Vec<String>>, D::Error>
where
    D: Deserializer<'de>,
{
    use serde::de;

    #[derive(Deserialize)]
    #[serde(untagged)]
    enum FlexTags {
        Array(Vec<String>),
        JsonString(String),
        Null,
    }

    match Option::<FlexTags>::deserialize(deserializer)? {
        Some(FlexTags::Array(v)) => Ok(Some(v)),
        Some(FlexTags::JsonString(s)) => {
            // Try to parse as JSON array
            if let Ok(parsed) = serde_json::from_str::<Vec<String>>(&s) {
                Ok(Some(parsed))
            } else {
                // Treat as comma-separated
                Ok(Some(
                    s.split(',')
                        .map(|t| t.trim().trim_matches('"').to_string())
                        .filter(|t| !t.is_empty())
                        .collect(),
                ))
            }
        }
        Some(FlexTags::Null) | None => Ok(None),
    }
}

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
    #[serde(default, deserialize_with = "deserialize_flexible_tags")]
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
    #[schemars(description = "Filter by author: 'human', 'ai', or 'both'")]
    pub author: Option<String>,
    #[schemars(description = "Filter by status: 'draft', 'review', or 'final'")]
    pub status: Option<String>,
    #[schemars(description = "Only return canonical documents")]
    pub canonical_only: Option<bool>,
    #[schemars(description = "Maximum results to return (default 20)")]
    pub limit: Option<usize>,
}

#[derive(Debug, Deserialize, JsonSchema)]
#[schemars(description = "Propose an update to a document by writing it on a new branch. The human reviews the diff and merges via PR. Use this instead of write_document for existing protected or canonical docs.")]
pub struct ProposeDocUpdateParams {
    #[schemars(description = "Project name")]
    pub project: String,
    #[schemars(description = "Path to the document to update")]
    pub path: String,
    #[schemars(description = "Updated document title")]
    pub title: String,
    #[schemars(description = "Full updated markdown body")]
    pub content: String,
    #[schemars(description = "Tags for the document")]
    pub tags: Option<Vec<String>>,
    #[schemars(description = "Name of the calling AI tool")]
    pub ai_tool: Option<String>,
    #[schemars(description = "Commit message for the proposal")]
    pub message: Option<String>,
}

#[derive(Debug, Deserialize, JsonSchema)]
#[schemars(description = "Build a context bundle from relevant documents for AI agent consumption")]
pub struct BuildContextBundleParams {
    #[schemars(description = "Search query to find relevant documents")]
    pub query: String,
    #[schemars(description = "Scope to a single project")]
    pub project: Option<String>,
    #[schemars(description = "Maximum number of documents to include (default 10)")]
    pub max_docs: Option<usize>,
}

#[derive(Debug, Deserialize, JsonSchema)]
#[schemars(description = "Append content to an existing document without overwriting")]
pub struct AppendToDocParams {
    #[schemars(description = "Project name")]
    pub project: String,
    #[schemars(description = "Path to the existing document")]
    pub path: String,
    #[schemars(description = "Markdown content to append")]
    pub content: String,
    #[schemars(description = "Name of the calling AI tool")]
    pub ai_tool: Option<String>,
}

#[derive(Debug, Deserialize, JsonSchema)]
#[schemars(description = "Detect stale documents that haven't been updated recently")]
pub struct DetectStaleDocsParams {
    #[schemars(description = "Scope to a single project")]
    pub project: Option<String>,
    #[schemars(description = "Number of days since last update to consider stale (default 30)")]
    pub days_threshold: Option<u32>,
}

#[derive(Debug, Deserialize, JsonSchema)]
#[schemars(description = "Generate a structured agent brief for a project or topic. Assembles canonical docs, recent changes, key constraints, and relevant context into a single prompt-ready briefing.")]
pub struct GenerateAgentBriefParams {
    #[schemars(description = "Project name")]
    pub project: String,
    #[schemars(description = "Optional focus query to scope the brief (e.g. 'authentication', 'API design')")]
    pub focus: Option<String>,
    #[schemars(description = "Maximum number of docs to include (default 10)")]
    pub max_docs: Option<usize>,
}

#[derive(Debug, Deserialize, JsonSchema)]
#[schemars(description = "Get a summary of recent changes in the vault — what docs were modified, added, or updated. Useful for session resumption and understanding what happened since last visit.")]
pub struct GetRecentChangesParams {
    #[schemars(description = "Scope to a single project")]
    pub project: Option<String>,
    #[schemars(description = "Number of recent git commits to scan (default 20)")]
    pub limit: Option<usize>,
}

#[derive(Debug, Deserialize, JsonSchema)]
#[schemars(description = "Read a scratchpad/note and return its content with a structured spec template. Use write_document to save the structured output.")]
pub struct ConvertToSpecParams {
    #[schemars(description = "Project name")]
    pub project: String,
    #[schemars(description = "Path to the source note/scratchpad document")]
    pub source_path: String,
}

#[derive(Debug, Deserialize, JsonSchema)]
#[schemars(description = "Get all canonical (source-of-truth) documents for a project — fast path for loading critical context")]
pub struct GetCanonicalContextParams {
    #[schemars(description = "Project name")]
    pub project: String,
}

#[derive(Debug, Deserialize, JsonSchema)]
#[schemars(description = "Get a structured summary of changes between two branches")]
pub struct SummarizeBranchDiffParams {
    #[schemars(description = "Base branch name (e.g. 'main')")]
    pub base: String,
    #[schemars(description = "Head branch name (e.g. 'feature/new-docs')")]
    pub head: String,
}

#[derive(Debug, Deserialize, JsonSchema)]
#[schemars(description = "List non-markdown files (assets) in a project — PDFs, images, config files, etc.")]
pub struct ListProjectAssetsParams {
    #[schemars(description = "Project name")]
    pub project: String,
}

#[derive(Debug, Deserialize, JsonSchema)]
#[schemars(description = "Read the raw content of a non-markdown asset file (text files only; binary files will report their size)")]
pub struct ReadAssetParams {
    #[schemars(description = "Project name")]
    pub project: String,
    #[schemars(description = "Path relative to the project's docs/ folder, e.g. 'specs/diagram.json'")]
    pub path: String,
}

#[derive(Debug, Deserialize, JsonSchema)]
#[schemars(description = "Get the local source code folder configured for a project — useful for understanding where the codebase lives on this machine")]
pub struct GetProjectSourceFolderParams {
    #[schemars(description = "Project name")]
    pub project: String,
}

#[derive(Debug, Deserialize, JsonSchema)]
#[schemars(description = "Set or clear the local source code folder for a project on this machine. Use this when the user tells you where their source code lives.")]
pub struct SetProjectSourceFolderParams {
    #[schemars(description = "Project name")]
    pub project: String,
    #[schemars(description = "Absolute path to the source folder, e.g. '/Users/alice/Dev/my-app'. Omit or pass null to clear.")]
    pub path: Option<String>,
}

#[derive(Debug, Deserialize, JsonSchema)]
#[schemars(description = "Commit all staged changes in the vault with a message")]
pub struct GitCommitParams {
    #[schemars(description = "Commit message describing what was changed")]
    pub message: String,
}

#[derive(Debug, Deserialize, JsonSchema)]
#[schemars(description = "Create a new project and optionally set its source folder and write an initial context document — bootstraps a project in one step")]
pub struct BootstrapProjectParams {
    #[schemars(description = "Project folder name in slug format (e.g. 'my-app')")]
    pub name: String,
    #[schemars(description = "Short description of the project")]
    pub description: Option<String>,
    #[schemars(description = "Initial tags for the project")]
    pub tags: Option<Vec<String>>,
    #[schemars(description = "Template to use for folder structure. Options: 'vibe-coding' (prd/todo/bugs/context/changelog/ideas/prompts), 'software-dev' (specs/features/decisions/guides/runbooks/notes), 'agile', 'minimal'. Defaults to vault default if omitted.")]
    pub template: Option<String>,
    #[schemars(description = "Absolute path to the local source code folder, if known")]
    pub source_folder: Option<String>,
    #[schemars(description = "Initial context document content (markdown). If provided, written to context/overview.md")]
    pub context: Option<String>,
}
