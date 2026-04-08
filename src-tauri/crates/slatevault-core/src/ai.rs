use serde::{Deserialize, Serialize};
use std::path::Path;

use crate::error::Result;
use crate::vault::Vault;

// -- OpenAI-compatible API types --

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Serialize)]
struct ChatRequest {
    model: String,
    messages: Vec<ChatMessage>,
    #[serde(skip_serializing_if = "Option::is_none")]
    temperature: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    max_tokens: Option<u32>,
    stream: bool,
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

pub fn chat_completion(
    endpoint_url: &str,
    api_key: Option<&str>,
    model: &str,
    messages: Vec<ChatMessage>,
) -> Result<AiChatResult> {
    let url = format!("{}/chat/completions", endpoint_url.trim_end_matches('/'));

    let request = ChatRequest {
        model: model.to_string(),
        messages,
        temperature: Some(0.7),
        max_tokens: None,
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

    let content = response
        .choices
        .first()
        .map(|c| c.message.content.clone())
        .unwrap_or_default();

    Ok(AiChatResult {
        content,
        model: response.model.unwrap_or_else(|| model.to_string()),
        usage: response.usage,
    })
}

pub fn list_models(endpoint_url: &str, api_key: Option<&str>) -> Result<Vec<String>> {
    let url = format!("{}/models", endpoint_url.trim_end_matches('/'));

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

    // 2. Search-based relevant docs
    if let Ok(bundle) = vault.build_context_bundle(user_message, Some(project), Some(5)) {
        if !bundle.docs.is_empty() {
            context.push_str("## Relevant Documents\n\n");
            for doc in &bundle.docs {
                context.push_str(&format!("### {} ({})\n{}\n\n", doc.title, doc.path, doc.content));
            }
        }
    }

    // 3. Source code (if enabled and configured)
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
    "toml", "yaml", "yml", "json", "md", "css", "scss",
    "html", "sql", "sh", "bash", "dockerfile", "svelte", "vue",
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
