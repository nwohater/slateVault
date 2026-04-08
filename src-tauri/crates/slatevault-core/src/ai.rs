use serde::{Deserialize, Serialize};
use std::path::Path;

use crate::error::Result;
use crate::vault::Vault;

// -- OpenAI-compatible API types --

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub content: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_calls: Option<Vec<ToolCall>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_call_id: Option<String>,
}

impl ChatMessage {
    pub fn text(role: &str, content: &str) -> Self {
        Self {
            role: role.to_string(),
            content: Some(content.to_string()),
            tool_calls: None,
            tool_call_id: None,
        }
    }

    pub fn content_str(&self) -> &str {
        self.content.as_deref().unwrap_or("")
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolCall {
    pub id: String,
    #[serde(rename = "type")]
    pub call_type: String,
    pub function: ToolCallFunction,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolCallFunction {
    pub name: String,
    pub arguments: String,
}

#[derive(Debug, Serialize)]
struct ChatRequest {
    model: String,
    messages: Vec<ChatMessage>,
    #[serde(skip_serializing_if = "Option::is_none")]
    temperature: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    max_tokens: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    tools: Option<Vec<ToolDefinition>>,
    stream: bool,
}

#[derive(Debug, Serialize)]
pub struct ToolDefinition {
    #[serde(rename = "type")]
    pub tool_type: String,
    pub function: FunctionDefinition,
}

#[derive(Debug, Serialize)]
pub struct FunctionDefinition {
    pub name: String,
    pub description: String,
    pub parameters: serde_json::Value,
}

#[derive(Debug, Deserialize)]
struct ChatResponse {
    choices: Vec<ChatChoice>,
    #[serde(default)]
    usage: Option<UsageInfo>,
    model: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ChatChoice {
    message: ChatMessage,
    #[serde(default)]
    finish_reason: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UsageInfo {
    pub prompt_tokens: u32,
    pub completion_tokens: u32,
    pub total_tokens: u32,
}

#[derive(Debug, Clone, Serialize)]
pub struct AiChatResult {
    pub content: String,
    pub model: String,
    pub usage: Option<UsageInfo>,
    pub tool_calls: Option<Vec<ToolCall>>,
    pub tools_supported: bool,
}

#[derive(Debug, Deserialize)]
struct ModelsResponse {
    data: Option<Vec<ModelInfo>>,
    // Ollama returns "models" instead of "data"
    models: Option<Vec<OllamaModelInfo>>,
}

#[derive(Debug, Deserialize)]
struct ModelInfo {
    id: String,
}

#[derive(Debug, Deserialize)]
struct OllamaModelInfo {
    #[serde(alias = "name")]
    model: String,
}

// -- API calls --

/// Get the tool definitions for vault operations
pub fn vault_tools() -> Vec<ToolDefinition> {
    vec![
        ToolDefinition {
            tool_type: "function".to_string(),
            function: FunctionDefinition {
                name: "write_document".to_string(),
                description: "Write or update a document in the vault".to_string(),
                parameters: serde_json::json!({
                    "type": "object",
                    "properties": {
                        "path": { "type": "string", "description": "Path like 'prd/my-doc.md' or 'specs/auth.md'" },
                        "title": { "type": "string", "description": "Document title" },
                        "content": { "type": "string", "description": "Full markdown content" },
                        "tags": { "type": "array", "items": { "type": "string" }, "description": "Tags for the document" }
                    },
                    "required": ["path", "title", "content"]
                }),
            },
        },
        ToolDefinition {
            tool_type: "function".to_string(),
            function: FunctionDefinition {
                name: "read_document".to_string(),
                description: "Read a document from the vault".to_string(),
                parameters: serde_json::json!({
                    "type": "object",
                    "properties": {
                        "path": { "type": "string", "description": "Document path like 'prd/product-requirements.md'" }
                    },
                    "required": ["path"]
                }),
            },
        },
        ToolDefinition {
            tool_type: "function".to_string(),
            function: FunctionDefinition {
                name: "search_documents".to_string(),
                description: "Search for documents in the vault".to_string(),
                parameters: serde_json::json!({
                    "type": "object",
                    "properties": {
                        "query": { "type": "string", "description": "Search query" }
                    },
                    "required": ["query"]
                }),
            },
        },
    ]
}

/// Test if a model supports function/tool calling
pub fn test_tool_support(
    endpoint_url: &str,
    api_key: Option<&str>,
    model: &str,
) -> bool {
    let messages = vec![ChatMessage::text("user", "What is 2+2? Use the calculator tool.")];
    let tools = vec![ToolDefinition {
        tool_type: "function".to_string(),
        function: FunctionDefinition {
            name: "calculator".to_string(),
            description: "Calculate a math expression".to_string(),
            parameters: serde_json::json!({
                "type": "object",
                "properties": { "expression": { "type": "string" } },
                "required": ["expression"]
            }),
        },
    }];

    let base = endpoint_url.trim_end_matches('/');
    let url = if base.ends_with("/v1") {
        format!("{}/chat/completions", base)
    } else {
        format!("{}/v1/chat/completions", base)
    };

    let request = ChatRequest {
        model: model.to_string(),
        messages,
        temperature: Some(0.0),
        max_tokens: Some(100),
        tools: Some(tools),
        stream: false,
    };

    let client = match reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .build()
    {
        Ok(c) => c,
        Err(_) => return false,
    };

    let mut req = client.post(&url).header("Content-Type", "application/json");
    if let Some(key) = api_key {
        if !key.is_empty() {
            req = req.header("Authorization", format!("Bearer {}", key));
        }
    }

    match req.json(&request).send() {
        Ok(resp) => {
            if let Ok(text) = resp.text() {
                if let Ok(response) = serde_json::from_str::<ChatResponse>(&text) {
                    return response
                        .choices
                        .first()
                        .and_then(|c| c.message.tool_calls.as_ref())
                        .map(|tc| !tc.is_empty())
                        .unwrap_or(false);
                }
            }
            false
        }
        Err(_) => false,
    }
}

pub fn chat_completion(
    endpoint_url: &str,
    api_key: Option<&str>,
    model: &str,
    messages: Vec<ChatMessage>,
) -> Result<AiChatResult> {
    chat_completion_with_tools(endpoint_url, api_key, model, messages, None)
}

pub fn chat_completion_with_tools(
    endpoint_url: &str,
    api_key: Option<&str>,
    model: &str,
    messages: Vec<ChatMessage>,
    tools: Option<Vec<ToolDefinition>>,
) -> Result<AiChatResult> {
    let base = endpoint_url.trim_end_matches('/');
    let url = if base.ends_with("/v1") {
        format!("{}/chat/completions", base)
    } else if base.contains("/v1") {
        format!("{}/chat/completions", base)
    } else {
        format!("{}/v1/chat/completions", base)
    };

    let request = ChatRequest {
        model: model.to_string(),
        messages,
        temperature: Some(0.7),
        max_tokens: None,
        tools,
        stream: false,
    };

    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .build()
        .map_err(|e| crate::CoreError::Http(e.to_string()))?;

    let mut req = client
        .post(&url)
        .header("Content-Type", "application/json");

    if let Some(key) = api_key {
        if !key.is_empty() {
            req = req.header("Authorization", format!("Bearer {}", key));
        }
    }

    let resp = req
        .json(&request)
        .send()
        .map_err(|e| crate::CoreError::Http(format!("Failed to connect to AI endpoint: {}", e)))?;

    let status = resp.status();
    let text = resp
        .text()
        .map_err(|e| crate::CoreError::Http(e.to_string()))?;

    if !status.is_success() {
        return Err(crate::CoreError::Http(format!(
            "AI API error ({}): {}",
            status,
            text.chars().take(500).collect::<String>()
        )));
    }

    let response: ChatResponse =
        serde_json::from_str(&text).map_err(|e| crate::CoreError::Http(format!("Invalid AI response: {}", e)))?;

    let choice = response.choices.first();
    let content = choice
        .and_then(|c| c.message.content.clone())
        .unwrap_or_default();
    let tool_calls = choice.and_then(|c| c.message.tool_calls.clone());
    let has_tools = tool_calls.as_ref().map(|tc| !tc.is_empty()).unwrap_or(false);

    Ok(AiChatResult {
        content,
        model: response.model.unwrap_or_else(|| model.to_string()),
        usage: response.usage,
        tool_calls,
        tools_supported: has_tools,
    })
}

pub fn list_models(endpoint_url: &str, api_key: Option<&str>) -> Result<Vec<String>> {
    let base = endpoint_url.trim_end_matches('/');
    let url = if base.ends_with("/v1") {
        format!("{}/models", base)
    } else {
        format!("{}/v1/models", base)
    };

    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| crate::CoreError::Http(e.to_string()))?;

    let mut req = client.get(&url);

    if let Some(key) = api_key {
        if !key.is_empty() {
            req = req.header("Authorization", format!("Bearer {}", key));
        }
    }

    let resp = req
        .send()
        .map_err(|e| crate::CoreError::Http(format!("Failed to connect: {}", e)))?;

    let status = resp.status();
    let text = resp
        .text()
        .map_err(|e| crate::CoreError::Http(e.to_string()))?;

    if !status.is_success() {
        return Err(crate::CoreError::Http(format!("Models API error ({}): {}", status, text)));
    }

    let response: ModelsResponse =
        serde_json::from_str(&text).map_err(|e| crate::CoreError::Http(format!("Invalid response: {}", e)))?;

    // Handle both OpenAI format (data) and Ollama format (models)
    let mut models: Vec<String> = Vec::new();
    if let Some(data) = response.data {
        models.extend(data.into_iter().map(|m| m.id));
    }
    if let Some(ollama_models) = response.models {
        models.extend(ollama_models.into_iter().map(|m| m.model));
    }

    models.sort();
    Ok(models)
}

// -- Context assembly --

pub fn assemble_context(
    vault: &Vault,
    project: &str,
    user_message: &str,
    include_source: bool,
) -> String {
    let mut context = String::new();

    // 1. Pinned AI context files
    if let Ok(ctx_files) = vault.get_project_context(project) {
        if !ctx_files.is_empty() {
            context.push_str("## Project Context Files\n\n");
            for (path, content) in &ctx_files {
                context.push_str(&format!("### {}\n{}\n\n", path, content));
            }
        }
    }

    // 2. Search-based relevant docs (skip _about.md template files)
    if let Ok(bundle) = vault.build_context_bundle(user_message, Some(project), Some(8)) {
        let real_docs: Vec<_> = bundle.docs.iter()
            .filter(|d| !d.path.ends_with("/_about.md") && d.path != "_about.md")
            .collect();
        if !real_docs.is_empty() {
            context.push_str("## Relevant Documents\n\n");
            for doc in &real_docs {
                context.push_str(&format!("### {} ({})\n{}\n\n", doc.title, doc.path, doc.content));
            }
        }
    }

    // 3. If search found nothing useful, list all non-template docs so AI knows what exists
    if let Ok(all_docs) = vault.list_documents(project, None) {
        let real_docs: Vec<_> = all_docs.iter()
            .filter(|d| !d.path.ends_with("/_about.md") && d.path != "_about.md")
            .collect();
        if !real_docs.is_empty() {
            context.push_str("## All Project Documents\n\n");
            for doc in &real_docs {
                context.push_str(&format!("- **{}** (`{}`)\n", doc.front_matter.title, doc.path));
            }
            context.push('\n');
        }
    }

    // 4. Source code (if enabled and configured)
    if include_source {
        if let Ok(project_obj) = vault.open_project(project) {
            if let Some(ref source_folder) = project_obj.config.project.source_folder {
                let source_path = std::path::PathBuf::from(source_folder);
                if source_path.is_dir() {
                    let source_content = read_source_files(&source_path, 50_000);
                    if !source_content.is_empty() {
                        context.push_str("## Source Code\n\n");
                        context.push_str(&source_content);
                    }
                }
            }
        }
    }

    context
}

// -- Source code reader --

const SKIP_DIRS: &[&str] = &[
    "node_modules", "target", ".git", "dist", "build", "__pycache__",
    ".next", "out", ".cache", ".turbo", "vendor", "coverage",
    ".svelte-kit", ".nuxt", ".output",
];

const SOURCE_EXTENSIONS: &[&str] = &[
    "rs", "ts", "tsx", "js", "jsx", "py", "go", "java", "kt",
    "toml", "yaml", "yml", "css", "scss",
    "html", "sql", "sh", "bash", "dockerfile", "svelte", "vue",
];

const SKIP_FILES: &[&str] = &[
    "package-lock.json", "yarn.lock", "pnpm-lock.yaml", "Cargo.lock",
    "bun.lockb", "composer.lock", "Gemfile.lock", "poetry.lock",
    ".DS_Store", "thumbs.db",
];

fn read_source_files(root: &Path, max_chars: usize) -> String {
    let mut output = String::new();
    let mut total_chars = 0;
    read_dir_recursive(root, root, &mut output, &mut total_chars, max_chars);
    output
}

fn read_dir_recursive(
    base: &Path,
    dir: &Path,
    output: &mut String,
    total_chars: &mut usize,
    max_chars: usize,
) {
    let entries = match std::fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return,
    };

    for entry in entries.flatten() {
        if *total_chars >= max_chars {
            return;
        }

        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();

        if path.is_dir() {
            if SKIP_DIRS.contains(&name.as_str()) || name.starts_with('.') {
                continue;
            }
            read_dir_recursive(base, &path, output, total_chars, max_chars);
        } else {
            // Skip known noise files
            if SKIP_FILES.contains(&name.as_str()) {
                continue;
            }

            let ext = path
                .extension()
                .map(|e| e.to_string_lossy().to_lowercase())
                .unwrap_or_default();

            if !SOURCE_EXTENSIONS.contains(&ext.as_str()) {
                continue;
            }

            if let Ok(content) = std::fs::read_to_string(&path) {
                let rel = path
                    .strip_prefix(base)
                    .unwrap_or(&path)
                    .to_string_lossy()
                    .replace('\\', "/");

                let remaining = max_chars.saturating_sub(*total_chars);
                let truncated: String = content.chars().take(remaining).collect();

                output.push_str(&format!("### {}\n```{}\n{}\n```\n\n", rel, ext, truncated));
                *total_chars += truncated.len();
            }
        }
    }
}
