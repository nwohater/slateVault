use serde::{Deserialize, Serialize};
use slatevault_core::Vault;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::State;

pub struct VaultState(pub Mutex<Option<Vault>>);

type CmdResult<T> = Result<T, String>;

fn with_vault<F, T>(state: &State<'_, VaultState>, f: F) -> CmdResult<T>
where
    F: FnOnce(&Vault) -> Result<T, slatevault_core::CoreError>,
{
    let lock = state.0.lock().map_err(|e| e.to_string())?;
    let vault = lock.as_ref().ok_or("No vault is open")?;
    f(vault).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_vault(path: String, name: String) -> CmdResult<String> {
    let root = PathBuf::from(&path);
    Vault::create(&root, &name).map_err(|e| e.to_string())?;
    Ok(format!("Vault '{}' created at {}", name, path))
}

#[tauri::command]
pub fn open_vault(path: String, state: State<'_, VaultState>) -> CmdResult<String> {
    let root = PathBuf::from(&path);
    let vault = Vault::open(&root).map_err(|e| e.to_string())?;
    let name = vault.config.vault.name.clone();
    let mut lock = state.0.lock().map_err(|e| e.to_string())?;
    *lock = Some(vault);
    Ok(format!("Opened vault '{}'", name))
}

#[tauri::command]
pub fn create_project(
    name: String,
    description: Option<String>,
    tags: Option<Vec<String>>,
    state: State<'_, VaultState>,
) -> CmdResult<String> {
    with_vault(&state, |vault| {
        vault.create_project(&name, &description.unwrap_or_default(), tags.unwrap_or_default())?;
        Ok(format!("Project '{}' created", name))
    })
}

#[derive(Serialize)]
pub struct ProjectInfo {
    name: String,
    description: String,
    tags: Vec<String>,
}

#[tauri::command]
pub fn list_projects(state: State<'_, VaultState>) -> CmdResult<Vec<ProjectInfo>> {
    with_vault(&state, |vault| {
        let projects = vault.list_projects()?;
        Ok(projects
            .into_iter()
            .map(|p| ProjectInfo {
                name: p.project.name,
                description: p.project.description,
                tags: p.project.tags,
            })
            .collect())
    })
}

#[tauri::command]
pub fn write_document(
    project: String,
    path: String,
    title: String,
    content: String,
    tags: Option<Vec<String>>,
    ai_tool: Option<String>,
    state: State<'_, VaultState>,
) -> CmdResult<String> {
    with_vault(&state, |vault| {
        vault.write_document(&project, &path, &title, &content, tags.unwrap_or_default(), ai_tool)?;
        Ok(format!("Document written: {}/{}", project, path))
    })
}

#[derive(Serialize)]
pub struct DocumentInfo {
    title: String,
    path: String,
    author: String,
    status: String,
    tags: Vec<String>,
    created: String,
    modified: String,
}

#[tauri::command]
pub fn read_document(
    project: String,
    path: String,
    state: State<'_, VaultState>,
) -> CmdResult<String> {
    with_vault(&state, |vault| {
        let doc = vault.read_document(&project, &path)?;
        doc.to_string()
    })
}

#[tauri::command]
pub fn list_documents(
    project: String,
    tags: Option<Vec<String>>,
    state: State<'_, VaultState>,
) -> CmdResult<Vec<DocumentInfo>> {
    with_vault(&state, |vault| {
        let docs = vault.list_documents(&project, tags.as_deref())?;
        Ok(docs
            .into_iter()
            .map(|d| DocumentInfo {
                title: d.front_matter.title,
                path: d.path,
                author: format!("{:?}", d.front_matter.author),
                status: format!("{:?}", d.front_matter.status),
                tags: d.front_matter.tags,
                created: d.front_matter.created.to_rfc3339(),
                modified: d.front_matter.modified.to_rfc3339(),
            })
            .collect())
    })
}

#[derive(Serialize)]
pub struct SearchResultInfo {
    project: String,
    path: String,
    title: String,
    snippet: String,
}

#[tauri::command]
pub fn search_documents(
    query: String,
    project: Option<String>,
    limit: Option<usize>,
    state: State<'_, VaultState>,
) -> CmdResult<Vec<SearchResultInfo>> {
    with_vault(&state, |vault| {
        let results = vault.search_documents(&query, project.as_deref(), limit)?;
        Ok(results
            .into_iter()
            .map(|r| SearchResultInfo {
                project: r.project,
                path: r.path,
                title: r.title,
                snippet: r.snippet,
            })
            .collect())
    })
}

#[tauri::command]
pub fn get_project_context(
    project: String,
    state: State<'_, VaultState>,
) -> CmdResult<Vec<(String, String)>> {
    with_vault(&state, |vault| vault.get_project_context(&project))
}

#[tauri::command]
pub fn git_commit(
    message: String,
    state: State<'_, VaultState>,
) -> CmdResult<String> {
    with_vault(&state, |vault| {
        let oid = vault.commit(&message)?;
        Ok(format!("Committed: {}", oid))
    })
}

#[tauri::command]
pub fn git_status(
    state: State<'_, VaultState>,
) -> CmdResult<Vec<slatevault_core::FileStatus>> {
    with_vault(&state, |vault| vault.status())
}

#[tauri::command]
pub fn git_stage(
    path: String,
    state: State<'_, VaultState>,
) -> CmdResult<String> {
    with_vault(&state, |vault| {
        vault.stage_path(&path)?;
        Ok(format!("Staged: {}", path))
    })
}

#[tauri::command]
pub fn git_unstage(
    path: String,
    state: State<'_, VaultState>,
) -> CmdResult<String> {
    with_vault(&state, |vault| {
        vault.unstage_file(&path)?;
        Ok(format!("Unstaged: {}", path))
    })
}

#[tauri::command]
pub fn git_log(
    limit: Option<usize>,
    state: State<'_, VaultState>,
) -> CmdResult<Vec<slatevault_core::CommitInfo>> {
    with_vault(&state, |vault| vault.log(limit.unwrap_or(50)))
}

#[derive(Serialize)]
pub struct RemoteConfig {
    pub remote_url: Option<String>,
    pub remote_branch: String,
    pub pull_on_open: bool,
    pub push_on_close: bool,
}

#[tauri::command]
pub fn git_remote_config(
    state: State<'_, VaultState>,
) -> CmdResult<RemoteConfig> {
    with_vault(&state, |vault| {
        Ok(RemoteConfig {
            remote_url: vault.config.sync.remote_url.clone(),
            remote_branch: vault.config.sync.remote_branch.clone(),
            pull_on_open: vault.config.sync.pull_on_open,
            push_on_close: vault.config.sync.push_on_close,
        })
    })
}

#[derive(Deserialize)]
pub struct SetRemoteConfigArgs {
    pub remote_url: Option<String>,
    pub remote_branch: Option<String>,
    pub pull_on_open: Option<bool>,
    pub push_on_close: Option<bool>,
}

#[tauri::command]
pub fn git_set_remote_config(
    args: SetRemoteConfigArgs,
    state: State<'_, VaultState>,
) -> CmdResult<String> {
    let mut lock = state.0.lock().map_err(|e| e.to_string())?;
    let vault = lock.as_mut().ok_or("No vault is open")?;
    if let Some(ref url) = args.remote_url {
        if !url.is_empty() {
            vault.set_git_remote(url).map_err(|e| e.to_string())?;
            vault.config.sync.remote_url = Some(url.clone());
        } else {
            vault.config.sync.remote_url = None;
        }
    }
    if let Some(ref branch) = args.remote_branch {
        if !branch.is_empty() {
            vault.config.sync.remote_branch = branch.clone();
        }
    }
    if let Some(v) = args.pull_on_open {
        vault.config.sync.pull_on_open = v;
    }
    if let Some(v) = args.push_on_close {
        vault.config.sync.push_on_close = v;
    }
    vault.save_config().map_err(|e| e.to_string())?;
    Ok("Remote config updated".to_string())
}

#[tauri::command]
pub fn git_push(
    state: State<'_, VaultState>,
) -> CmdResult<String> {
    let lock = state.0.lock().map_err(|e| e.to_string())?;
    let vault = lock.as_ref().ok_or("No vault is open")?;
    let branch = &vault.config.sync.remote_branch;
    // Ensure branch name matches by renaming if needed
    let _ = std::process::Command::new("git")
        .args(["-C", &vault.root.to_string_lossy(), "branch", "-M", branch])
        .output();
    let output = std::process::Command::new("git")
        .args(["-C", &vault.root.to_string_lossy(), "push", "-u", "origin", branch])
        .output()
        .map_err(|e| format!("Failed to run git: {}", e))?;
    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    if output.status.success() {
        Ok(format!("{}{}", stdout, stderr).trim().to_string())
    } else {
        Err(format!("Push failed: {}", stderr.trim()).to_string())
    }
}

#[tauri::command]
pub fn git_pull(
    state: State<'_, VaultState>,
) -> CmdResult<String> {
    let lock = state.0.lock().map_err(|e| e.to_string())?;
    let vault = lock.as_ref().ok_or("No vault is open")?;
    let branch = &vault.config.sync.remote_branch;
    let output = std::process::Command::new("git")
        .args(["-C", &vault.root.to_string_lossy(), "pull", "origin", branch])
        .output()
        .map_err(|e| format!("Failed to run git: {}", e))?;
    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    if output.status.success() {
        Ok(format!("{}{}", stdout, stderr).trim().to_string())
    } else {
        Err(format!("Pull failed: {}", stderr.trim()).to_string())
    }
}

#[derive(Serialize)]
pub struct VaultSettings {
    pub name: String,
    pub path: String,
    pub mcp_port: u16,
    pub auto_stage_ai_writes: bool,
    pub ssh_key_path: Option<String>,
    pub remote_url: Option<String>,
    pub remote_branch: String,
}

#[tauri::command]
pub fn get_vault_config(
    state: State<'_, VaultState>,
) -> CmdResult<VaultSettings> {
    with_vault(&state, |vault| {
        Ok(VaultSettings {
            name: vault.config.vault.name.clone(),
            path: vault.root.to_string_lossy().to_string(),
            mcp_port: vault.config.mcp.port,
            auto_stage_ai_writes: vault.config.mcp.auto_stage_ai_writes,
            ssh_key_path: vault.config.sync.ssh_key_path.clone(),
            remote_url: vault.config.sync.remote_url.clone(),
            remote_branch: vault.config.sync.remote_branch.clone(),
        })
    })
}

#[derive(Deserialize)]
pub struct SetVaultConfigArgs {
    pub name: Option<String>,
    pub mcp_port: Option<u16>,
    pub auto_stage_ai_writes: Option<bool>,
    pub ssh_key_path: Option<String>,
}

#[tauri::command]
pub fn set_vault_config(
    args: SetVaultConfigArgs,
    state: State<'_, VaultState>,
) -> CmdResult<String> {
    let mut lock = state.0.lock().map_err(|e| e.to_string())?;
    let vault = lock.as_mut().ok_or("No vault is open")?;
    if let Some(name) = args.name {
        vault.config.vault.name = name;
    }
    if let Some(port) = args.mcp_port {
        vault.config.mcp.port = port;
    }
    if let Some(v) = args.auto_stage_ai_writes {
        vault.config.mcp.auto_stage_ai_writes = v;
    }
    // Empty string clears the path, Some(path) sets it
    if let Some(path) = args.ssh_key_path {
        vault.config.sync.ssh_key_path = if path.is_empty() { None } else { Some(path) };
    }
    vault.save_config().map_err(|e| e.to_string())?;
    Ok("Settings updated".to_string())
}
