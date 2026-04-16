use serde::{Deserialize, Serialize};
use slatevault_core::Vault;
use slatevault_core::credentials::{Credentials, CredentialsMasked};
use slatevault_core::pr::{self, PrCreateRequest, PrCreateResponse};
use std::path::{Component, Path, PathBuf};
use std::sync::Mutex;
use tauri::State;

pub struct VaultState(pub Mutex<Option<Vault>>);

type CmdResult<T> = Result<T, String>;

fn invalid_input(message: impl Into<String>) -> slatevault_core::CoreError {
    slatevault_core::CoreError::Io(std::io::Error::new(
        std::io::ErrorKind::InvalidInput,
        message.into(),
    ))
}

fn sanitize_relative_path(path: &str) -> Result<PathBuf, slatevault_core::CoreError> {
    let mut cleaned = PathBuf::new();

    for component in Path::new(path).components() {
        match component {
            Component::Normal(part) => cleaned.push(part),
            Component::CurDir => {}
            Component::ParentDir | Component::RootDir | Component::Prefix(_) => {
                return Err(invalid_input(format!("Path escapes the allowed root: {}", path)));
            }
        }
    }

    if cleaned.as_os_str().is_empty() {
        return Err(invalid_input("Path cannot be empty"));
    }

    Ok(cleaned)
}

fn resolve_inside(root: &Path, path: &str) -> Result<PathBuf, slatevault_core::CoreError> {
    Ok(root.join(sanitize_relative_path(path)?))
}

fn sanitize_single_component(name: &str) -> Result<String, slatevault_core::CoreError> {
    let path = Path::new(name);
    let mut components = path.components();
    let first = components
        .next()
        .ok_or_else(|| invalid_input("Path cannot be empty"))?;

    if !matches!(first, Component::Normal(_)) || components.next().is_some() {
        return Err(invalid_input("Value must be a single relative path segment"));
    }

    Ok(name.to_string())
}

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

    // Pull on open if configured
    if vault.config.sync.pull_on_open && vault.config.sync.remote_url.is_some() {
        let branch = &vault.config.sync.remote_branch;
        let _ = std::process::Command::new("git")
            .args(["-C", &root.to_string_lossy(), "pull", "origin", branch])
            .output();
    }

    // Write active vault path so MCP server can find it
    if let Some(home) = dirs::home_dir() {
        let active_dir = home.join(".slatevault");
        let _ = std::fs::create_dir_all(&active_dir);
        let _ = std::fs::write(active_dir.join("active-vault"), root.to_string_lossy().as_bytes());
    }

    let mut lock = state.0.lock().map_err(|e| e.to_string())?;
    *lock = Some(vault);
    Ok(format!("Opened vault '{}'", name))
}

#[tauri::command]
pub fn create_project(
    name: String,
    description: Option<String>,
    tags: Option<Vec<String>>,
    template: Option<String>,
    state: State<'_, VaultState>,
) -> CmdResult<String> {
    with_vault(&state, |vault| {
        vault.create_project(
            &name,
            &description.unwrap_or_default(),
            tags.unwrap_or_default(),
            template.as_deref(),
        )?;
        Ok(format!("Project '{}' created", name))
    })
}

#[derive(Serialize)]
pub struct ProjectInfo {
    name: String,
    description: String,
    tags: Vec<String>,
    folder_order: Vec<String>,
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
                folder_order: p.project.folder_order,
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
    canonical: Option<bool>,
    is_protected: Option<bool>,
    state: State<'_, VaultState>,
) -> CmdResult<String> {
    with_vault(&state, |vault| {
        let mut doc = vault.write_document(&project, &path, &title, &content, tags.unwrap_or_default(), ai_tool)?;
        // Apply canonical/protected if provided
        if canonical.is_some() || is_protected.is_some() {
            let mut needs_rewrite = false;
            if let Some(c) = canonical {
                if doc.front_matter.canonical != c {
                    doc.front_matter.canonical = c;
                    needs_rewrite = true;
                }
            }
            if let Some(p) = is_protected {
                if doc.front_matter.protected != p {
                    doc.front_matter.protected = p;
                    needs_rewrite = true;
                }
            }
            if needs_rewrite {
                let project_obj = vault.open_project(&project)?;
                let file_path = resolve_inside(&project_obj.docs_dir(), &path)?;
                std::fs::write(&file_path, doc.to_string()?)?;
                vault.search.index_document(
                    &project,
                    &doc.path,
                    &doc.front_matter.title,
                    &doc.content,
                    &doc.front_matter.tags,
                    &format!("{:?}", doc.front_matter.author).to_lowercase(),
                    &format!("{:?}", doc.front_matter.status).to_lowercase(),
                    doc.front_matter.canonical,
                )?;
            }
        }
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
    canonical: bool,
    protected: bool,
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
                canonical: d.front_matter.canonical,
                protected: d.front_matter.protected,
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
pub fn git_clone(url: String, path: String) -> CmdResult<String> {
    let dest = PathBuf::from(&path);
    if dest.exists() && std::fs::read_dir(&dest).map(|mut d| d.next().is_some()).unwrap_or(false) {
        return Err("Destination directory already exists and is not empty".to_string());
    }
    let output = std::process::Command::new("git")
        .args(["clone", &url, &path])
        .output()
        .map_err(|e| format!("Failed to run git: {}", e))?;
    if output.status.success() {
        Ok(format!("Cloned {} into {}", url, path))
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(format!("Clone failed: {}", stderr.trim()))
    }
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
    pub mcp_enabled: bool,
    pub mcp_port: u16,
    pub auto_stage_ai_writes: bool,
    pub compress_context: bool,
    pub ssh_key_path: Option<String>,
    pub remote_url: Option<String>,
    pub remote_branch: String,
    pub ai_enabled: bool,
    pub ai_endpoint_url: String,
    pub ai_model: String,
}

#[tauri::command]
pub fn get_vault_config(
    state: State<'_, VaultState>,
) -> CmdResult<VaultSettings> {
    with_vault(&state, |vault| {
        Ok(VaultSettings {
            name: vault.config.vault.name.clone(),
            path: vault.root.to_string_lossy().to_string(),
            mcp_enabled: vault.config.mcp.enabled,
            mcp_port: vault.config.mcp.port,
            auto_stage_ai_writes: vault.config.mcp.auto_stage_ai_writes,
            compress_context: vault.config.mcp.compress_context,
            ai_enabled: vault.config.ai.enabled,
            ai_endpoint_url: vault.config.ai.endpoint_url.clone(),
            ai_model: vault.config.ai.model.clone(),
            ssh_key_path: vault.config.sync.ssh_key_path.clone(),
            remote_url: vault.config.sync.remote_url.clone(),
            remote_branch: vault.config.sync.remote_branch.clone(),
        })
    })
}

#[derive(Deserialize)]
pub struct SetVaultConfigArgs {
    pub name: Option<String>,
    pub mcp_enabled: Option<bool>,
    pub mcp_port: Option<u16>,
    pub auto_stage_ai_writes: Option<bool>,
    pub compress_context: Option<bool>,
    pub ssh_key_path: Option<String>,
    pub ai_enabled: Option<bool>,
    pub ai_endpoint_url: Option<String>,
    pub ai_model: Option<String>,
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
    if let Some(v) = args.mcp_enabled {
        vault.config.mcp.enabled = v;
    }
    if let Some(port) = args.mcp_port {
        vault.config.mcp.port = port;
    }
    if let Some(v) = args.auto_stage_ai_writes {
        vault.config.mcp.auto_stage_ai_writes = v;
    }
    if let Some(v) = args.compress_context {
        vault.config.mcp.compress_context = v;
    }
    if let Some(v) = args.ai_enabled {
        vault.config.ai.enabled = v;
    }
    if let Some(url) = args.ai_endpoint_url {
        vault.config.ai.endpoint_url = url;
    }
    if let Some(model) = args.ai_model {
        vault.config.ai.model = model;
    }
    // Empty string clears the path, Some(path) sets it
    if let Some(path) = args.ssh_key_path {
        vault.config.sync.ssh_key_path = if path.is_empty() { None } else { Some(path) };
    }
    vault.save_config().map_err(|e| e.to_string())?;
    Ok("Settings updated".to_string())
}

#[tauri::command]
pub fn show_in_folder(
    project: String,
    path: Option<String>,
    state: State<'_, VaultState>,
) -> CmdResult<()> {
    with_vault(&state, |vault| {
        let project_obj = vault.open_project(&project)?;
        let full_path = match &path {
            Some(doc_path) => resolve_inside(&project_obj.docs_dir(), doc_path)?,
            None => project_obj.root.clone(),
        };

        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            let path_str = full_path.to_string_lossy().replace('/', "\\");
            std::process::Command::new("explorer.exe")
                .raw_arg(format!("/select,\"{path_str}\""))
                .spawn()?;
        }

        #[cfg(target_os = "macos")]
        std::process::Command::new("open")
            .args(["-R", &full_path.to_string_lossy()])
            .spawn()?;

        #[cfg(target_os = "linux")]
        {
            let parent = full_path.parent().unwrap_or(&full_path);
            std::process::Command::new("xdg-open")
                .arg(parent)
                .spawn()?;
        }

        Ok(())
    })
}

#[tauri::command]
pub fn delete_document(
    project: String,
    path: String,
    state: State<'_, VaultState>,
) -> CmdResult<String> {
    with_vault(&state, |vault| {
        let project_obj = vault.open_project(&project)?;
        let file_path = resolve_inside(&project_obj.docs_dir(), &path)?;
        std::fs::remove_file(&file_path)?;
        vault.search.remove_document(&project, &sanitize_relative_path(&path)?.to_string_lossy().replace('\\', "/"))?;
        Ok(format!("Deleted: {}/{}", project, path))
    })
}

#[tauri::command]
pub fn delete_project(
    name: String,
    state: State<'_, VaultState>,
) -> CmdResult<String> {
    with_vault(&state, |vault| {
        let name = sanitize_single_component(&name)?;
        let project_path = resolve_inside(&vault.projects_dir(), &name)?;
        std::fs::remove_dir_all(&project_path)?;
        vault.search.remove_project(&name)?;
        Ok(format!("Project '{}' deleted", name))
    })
}

#[tauri::command]
pub fn rename_document(
    project: String,
    old_path: String,
    new_path: String,
    state: State<'_, VaultState>,
) -> CmdResult<String> {
    with_vault(&state, |vault| {
        let project_obj = vault.open_project(&project)?;
        let docs_dir = project_obj.docs_dir();
        let old_rel = sanitize_relative_path(&old_path)?;
        let new_rel = sanitize_relative_path(&new_path)?;
        let old_full = docs_dir.join(&old_rel);
        let new_full = docs_dir.join(&new_rel);
        // Ensure target directory exists
        if let Some(parent) = new_full.parent() {
            std::fs::create_dir_all(parent)?;
        }
        std::fs::rename(&old_full, &new_full)?;
        // Stage both old (delete) and new (add) paths for git
        let old_repo_path = vault.projects_dir().join(&project).join("docs").join(&old_rel);
        let new_repo_path = vault.projects_dir().join(&project).join("docs").join(&new_rel);
        let _ = vault.stage_file(&old_repo_path);
        let _ = vault.stage_file(&new_repo_path);
        let old_index_path = old_rel.to_string_lossy().replace('\\', "/");
        vault.search.remove_document(&project, &old_index_path)?;
        let renamed = vault.read_document(&project, &new_rel.to_string_lossy().replace('\\', "/"))?;
        vault.search.index_document(
            &project,
            &renamed.path,
            &renamed.front_matter.title,
            &renamed.content,
            &renamed.front_matter.tags,
            &format!("{:?}", renamed.front_matter.author).to_lowercase(),
            &format!("{:?}", renamed.front_matter.status).to_lowercase(),
            renamed.front_matter.canonical,
        )?;
        Ok(format!("Moved: {}/{} -> {}", project, old_path, new_path))
    })
}

#[tauri::command]
pub fn rename_project(
    old_name: String,
    new_name: String,
    state: State<'_, VaultState>,
) -> CmdResult<String> {
    with_vault(&state, |vault| {
        let old_name = sanitize_single_component(&old_name)?;
        let new_name = sanitize_single_component(&new_name)?;
        let projects_dir = vault.projects_dir();
        let old_path = resolve_inside(&projects_dir, &old_name)?;
        let new_path = resolve_inside(&projects_dir, &new_name)?;
        if new_path.exists() {
            return Err(slatevault_core::CoreError::ProjectAlreadyExists(new_name.clone()));
        }
        std::fs::rename(&old_path, &new_path)?;
        vault.search.remove_project(&old_name)?;
        // Update name in project.toml
        let toml_path = new_path.join("project.toml");
        if toml_path.exists() {
            if let Ok(toml_str) = std::fs::read_to_string(&toml_path) {
                if let Ok(mut config) = toml::from_str::<slatevault_core::config::ProjectConfig>(&toml_str) {
                    config.project.name = new_name.clone();
                    if let Ok(new_toml) = toml::to_string_pretty(&config) {
                        let _ = std::fs::write(&toml_path, new_toml);
                    }
                }
            }
        }
        vault.rebuild_index()?;
        Ok(format!("Renamed project '{}' to '{}'", old_name, new_name))
    })
}

// -- Branch commands --

#[tauri::command]
pub fn git_current_branch(
    state: State<'_, VaultState>,
) -> CmdResult<String> {
    with_vault(&state, |vault| vault.current_branch())
}

#[tauri::command]
pub fn git_list_branches(
    state: State<'_, VaultState>,
) -> CmdResult<Vec<slatevault_core::BranchInfo>> {
    with_vault(&state, |vault| vault.list_branches())
}

#[tauri::command]
pub fn git_create_branch(
    name: String,
    state: State<'_, VaultState>,
) -> CmdResult<String> {
    with_vault(&state, |vault| {
        vault.create_branch(&name)?;
        Ok(format!("Branch '{}' created", name))
    })
}

#[tauri::command]
pub fn git_switch_branch(
    name: String,
    state: State<'_, VaultState>,
) -> CmdResult<String> {
    with_vault(&state, |vault| {
        vault.switch_branch(&name)?;
        Ok(format!("Switched to branch '{}'", name))
    })
}

#[tauri::command]
pub fn git_delete_branch(
    name: String,
    state: State<'_, VaultState>,
) -> CmdResult<String> {
    with_vault(&state, |vault| {
        vault.delete_branch(&name)?;
        Ok(format!("Branch '{}' deleted", name))
    })
}

// -- Diff commands --

#[tauri::command]
pub fn git_diff_file(
    path: String,
    staged: bool,
    state: State<'_, VaultState>,
) -> CmdResult<slatevault_core::FileDiff> {
    with_vault(&state, |vault| vault.diff_file(&path, staged))
}

#[tauri::command]
pub fn git_diff_branches(
    base: String,
    head: String,
    state: State<'_, VaultState>,
) -> CmdResult<Vec<slatevault_core::FileDiff>> {
    with_vault(&state, |vault| vault.diff_branches(&base, &head))
}

// -- PR commands --

#[tauri::command]
pub fn git_create_pr(
    title: String,
    description: String,
    source_branch: String,
    target_branch: String,
    state: State<'_, VaultState>,
) -> CmdResult<PrCreateResponse> {
    let lock = state.0.lock().map_err(|e| e.to_string())?;
    let vault = lock.as_ref().ok_or("No vault is open")?;

    let remote_url = vault
        .config
        .sync
        .remote_url
        .as_ref()
        .ok_or("No remote URL configured")?;

    let credentials = Credentials::load().map_err(|e| e.to_string())?;

    let request = PrCreateRequest {
        title,
        description,
        source_branch,
        target_branch,
    };

    pr::create_pull_request(remote_url, &credentials, &request).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn git_detect_platform(
    state: State<'_, VaultState>,
) -> CmdResult<Option<String>> {
    with_vault(&state, |vault| {
        Ok(vault
            .config
            .sync
            .remote_url
            .as_ref()
            .and_then(|url| pr::detect_platform(url)))
    })
}

#[tauri::command]
pub fn git_save_credentials(
    github_pat: Option<String>,
    ado_pat: Option<String>,
    ado_organization: Option<String>,
    ado_project: Option<String>,
    ai_api_key: Option<String>,
) -> CmdResult<String> {
    let mut creds = Credentials::load().unwrap_or_default();
    if let Some(pat) = github_pat {
        creds.github_pat = if pat.is_empty() { None } else { Some(pat) };
    }
    if let Some(pat) = ado_pat {
        creds.ado_pat = if pat.is_empty() { None } else { Some(pat) };
    }
    if let Some(org) = ado_organization {
        creds.ado_organization = if org.is_empty() { None } else { Some(org) };
    }
    if let Some(proj) = ado_project {
        creds.ado_project = if proj.is_empty() { None } else { Some(proj) };
    }
    if let Some(key) = ai_api_key {
        creds.ai_api_key = if key.is_empty() { None } else { Some(key) };
    }
    creds.save().map_err(|e| e.to_string())?;
    Ok("Credentials saved".to_string())
}

#[tauri::command]
pub fn git_load_credentials() -> CmdResult<CredentialsMasked> {
    let creds = Credentials::load().unwrap_or_default();
    Ok(creds.masked())
}

// -- Push with branch parameter --

#[tauri::command]
pub fn git_push_branch(
    branch: String,
    state: State<'_, VaultState>,
) -> CmdResult<String> {
    let lock = state.0.lock().map_err(|e| e.to_string())?;
    let vault = lock.as_ref().ok_or("No vault is open")?;
    let output = std::process::Command::new("git")
        .args(["-C", &vault.root.to_string_lossy(), "push", "-u", "origin", &branch])
        .output()
        .map_err(|e| format!("Failed to run git: {}", e))?;
    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    if output.status.success() {
        Ok(format!("{}{}", stdout, stderr).trim().to_string())
    } else {
        Err(format!("Push failed: {}", stderr.trim()))
    }
}

// -- AI commands --

#[derive(Deserialize)]
pub struct AiChatArgs {
    pub message: String,
    pub project: String,
    pub include_context: bool,
    pub include_source: bool,
    pub history: Vec<slatevault_core::ai::ChatMessage>,
}

#[tauri::command]
pub async fn ai_chat(
    args: AiChatArgs,
    state: State<'_, VaultState>,
) -> CmdResult<slatevault_core::ai::AiChatResult> {
    let (endpoint_url, model, api_key, context) = {
        let lock = state.0.lock().map_err(|e| e.to_string())?;
        let vault = lock.as_ref().ok_or("No vault is open")?;

        if !vault.config.ai.enabled {
            return Err("AI is not enabled. Configure in Settings > AI Assistant.".to_string());
        }
        if vault.config.ai.model.is_empty() {
            return Err("No AI model configured. Set a model in Settings > AI Assistant.".to_string());
        }

        let credentials = slatevault_core::credentials::Credentials::load().unwrap_or_default();
        let api_key = credentials.ai_api_key;

        let context = if args.include_context || args.include_source {
            slatevault_core::ai::assemble_context(
                vault,
                &args.project,
                &args.message,
                args.include_source,
            )
        } else {
            String::new()
        };

        (
            vault.config.ai.endpoint_url.clone(),
            vault.config.ai.model.clone(),
            api_key,
            context,
        )
    };

    // Build messages
    let mut messages = Vec::new();

    // System message with context
    let system_msg = if context.is_empty() {
        format!(
            "You are an AI assistant for the project '{}' in slateVault. Help with documentation, analysis, and writing.\n\
            You have tool access for listing, reading, searching, and writing project documents.\n\
            When the user asks what documents exist or asks for documents in a folder like 'todo', 'prd', or 'features', prefer list_documents instead of guessing from search.\n\
            When the user explicitly asks you to create, update, revise, or save a document in the vault, prefer calling the write_document tool instead of only returning draft text.\n\
            Use list_documents, read_document, and search_documents before writing when you need context.\n\
            Only return full markdown for manual saving when the user is brainstorming, asks for a draft only, or tool use is not possible.\n\
            Be concise and helpful.", args.project
        )
    } else {
        format!(
            "You are an AI assistant for the project '{}' in slateVault. Use the following project context:\n\n{}\n\n\
            You have tool access for listing, reading, searching, and writing project documents.\n\
            When the user asks what documents exist or asks for documents in a folder like 'todo', 'prd', or 'features', prefer list_documents instead of guessing from search.\n\
            When the user explicitly asks you to create, update, revise, or save a document in the vault, prefer calling the write_document tool instead of only returning draft text.\n\
            Use list_documents, read_document, and search_documents before writing when you need context.\n\
            Only return full markdown for manual saving when the user is brainstorming, asks for a draft only, or tool use is not possible.\n\
            Be concise and helpful.", args.project, context
        )
    };
    messages.push(slatevault_core::ai::ChatMessage::text("system", &system_msg));

    // History
    for msg in &args.history {
        messages.push(msg.clone());
    }

    // Current user message
    messages.push(slatevault_core::ai::ChatMessage::text("user", &args.message));

    // Try with tools first
    let tools = Some(slatevault_core::ai::vault_tools());
    let endpoint_url_for_first_call = endpoint_url.clone();
    let model_for_first_call = model.clone();
    let api_key_for_first_call = api_key.clone();
    let messages_for_first_call = messages.clone();
    let mut result = tauri::async_runtime::spawn_blocking(move || {
        slatevault_core::ai::chat_completion_with_tools(
            &endpoint_url_for_first_call,
            api_key_for_first_call.as_deref(),
            &model_for_first_call,
            messages_for_first_call.clone(),
            tools,
        )
        .or_else(|_| {
            // Fallback: try without tools if model doesn't support them
            slatevault_core::ai::chat_completion(
                &endpoint_url_for_first_call,
                api_key_for_first_call.as_deref(),
                &model_for_first_call,
                messages_for_first_call,
            )
        })
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(|e| e.to_string())?;

    // Execute tool calls if any (up to 3 rounds)
    let mut tool_rounds = 0;
    let mut documents_written = Vec::new();
    while let Some(ref tool_calls) = result.tool_calls {
        if tool_calls.is_empty() || tool_rounds >= 3 {
            break;
        }
        tool_rounds += 1;

        // Add assistant message with tool calls to history
        messages.push(slatevault_core::ai::ChatMessage {
            role: "assistant".to_string(),
            content: result.content.clone().into(),
            tool_calls: Some(tool_calls.clone()),
            tool_call_id: None,
        });

        // Execute each tool call
        let mut actions_taken = Vec::new();
        for tc in tool_calls {
            if tc.function.name == "write_document" {
                if let Ok(tool_args) = serde_json::from_str::<serde_json::Value>(&tc.function.arguments) {
                    if let Some(path) = tool_args["path"].as_str() {
                        documents_written.push(path.to_string());
                    }
                }
            }
            let tool_result = {
                let lock = state.0.lock().map_err(|e| e.to_string())?;
                let vault = lock.as_ref().ok_or("No vault is open")?;
                execute_tool_call(
                    vault,
                    &args.project,
                    &args.message,
                    &tc.function.name,
                    &tc.function.arguments,
                )
            };
            actions_taken.push(format!("{}: {}", tc.function.name, tool_result.as_deref().unwrap_or("OK")));

            messages.push(slatevault_core::ai::ChatMessage {
                role: "tool".to_string(),
                content: Some(tool_result.unwrap_or_else(|e| format!("Error: {}", e))),
                tool_calls: None,
                tool_call_id: Some(tc.id.clone()),
            });
        }

        // Get next response
        let endpoint_url_for_followup = endpoint_url.clone();
        let model_for_followup = model.clone();
        let api_key_for_followup = api_key.clone();
        let messages_for_followup = messages.clone();
        result = tauri::async_runtime::spawn_blocking(move || {
            slatevault_core::ai::chat_completion_with_tools(
                &endpoint_url_for_followup,
                api_key_for_followup.as_deref(),
                &model_for_followup,
                messages_for_followup,
                None, // No tools on follow-up to get final text response
            )
        })
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())?;

        // Append action summary to content
        if !actions_taken.is_empty() {
            let summary = actions_taken.join("\n");
            result.content = format!(
                "{}\n\n---\n*Actions taken:*\n{}",
                result.content, summary
            );
        }
    }

    if !documents_written.is_empty() {
        let mut lines = Vec::new();
        lines.push("Saved via tool:".to_string());
        for path in &documents_written {
            lines.push(format!("- {}/{}", args.project, path));
        }
        result.content = lines.join("\n");
    }

    result.documents_written = documents_written;

    Ok(result)
}

fn execute_tool_call(
    vault: &slatevault_core::Vault,
    project: &str,
    user_message: &str,
    tool_name: &str,
    arguments: &str,
) -> std::result::Result<String, String> {
    let args: serde_json::Value = serde_json::from_str(arguments).map_err(|e| e.to_string())?;

    match tool_name {
        "write_document" => {
            let path = args["path"].as_str().ok_or("Missing path")?;
            validate_requested_path(user_message, path)?;
            let title = args["title"].as_str().ok_or("Missing title")?;
            let content = args["content"].as_str().ok_or("Missing content")?;
            let content = normalize_ai_written_content(content);
            let tags: Vec<String> = args["tags"]
                .as_array()
                .map(|a| a.iter().filter_map(|v| v.as_str().map(String::from)).collect())
                .unwrap_or_default();

            vault
                .write_document(project, path, title, &content, tags, Some("ai-chat".to_string()))
                .map_err(|e| e.to_string())?;

            Ok(format!("Document written: {}/{}", project, path))
        }
        "read_document" => {
            let path = args["path"].as_str().ok_or("Missing path")?;
            let doc = vault.read_document(project, path).map_err(|e| e.to_string())?;
            Ok(format!(
                "Title: {}\nStatus: {:?}\n\n{}",
                doc.front_matter.title, doc.front_matter.status, doc.content
            ))
        }
        "list_documents" => {
            let path_prefix = args["path_prefix"].as_str().map(|prefix| {
                let normalized = prefix.replace('\\', "/").trim().trim_matches('/').to_string();
                if normalized.is_empty() {
                    String::new()
                } else {
                    format!("{}/", normalized)
                }
            });
            let docs = vault
                .list_documents(project, None)
                .map_err(|e| e.to_string())?;

            let filtered: Vec<_> = docs
                .into_iter()
                .filter(|doc| {
                    if let Some(prefix) = &path_prefix {
                        doc.path.starts_with(prefix)
                    } else {
                        true
                    }
                })
                .collect();

            if filtered.is_empty() {
                if let Some(prefix) = path_prefix {
                    Ok(format!("No documents found under {}", prefix))
                } else {
                    Ok("No documents found".to_string())
                }
            } else {
                let mut out = String::new();
                for doc in filtered.iter().take(50) {
                    out.push_str(&format!(
                        "- {} ({})\n",
                        doc.front_matter.title, doc.path
                    ));
                }
                if filtered.len() > 50 {
                    out.push_str(&format!("...and {} more\n", filtered.len() - 50));
                }
                Ok(out)
            }
        }
        "search_documents" => {
            let query = args["query"].as_str().ok_or("Missing query")?;
            let results = vault
                .search_documents(query, Some(project), Some(5))
                .map_err(|e| e.to_string())?;

            if results.is_empty() {
                Ok("No results found".to_string())
            } else {
                let mut out = String::new();
                for r in &results {
                    out.push_str(&format!("- {} ({})\n  {}\n", r.title, r.path, r.snippet));
                }
                Ok(out)
            }
        }
        _ => Err(format!("Unknown tool: {}", tool_name)),
    }
}

fn validate_requested_path(user_message: &str, tool_path: &str) -> std::result::Result<(), String> {
    let requested_paths = extract_markdown_paths(user_message);
    if requested_paths.is_empty() {
        return Ok(());
    }

    let actual = normalize_doc_path(tool_path);
    if requested_paths
        .iter()
        .map(|path| normalize_doc_path(path))
        .any(|requested| requested == actual)
    {
        return Ok(());
    }

    if requested_paths.len() == 1 {
        Err(format!(
            "Path mismatch: user requested '{}', but tool tried to write '{}'",
            requested_paths[0], tool_path
        ))
    } else {
        Err(format!(
            "Path mismatch: tool tried to write '{}', but allowed paths were: {}",
            tool_path,
            requested_paths.join(", ")
        ))
    }
}

fn extract_markdown_paths(text: &str) -> Vec<String> {
    let bytes = text.as_bytes();
    let mut paths = Vec::new();
    let mut start = 0usize;

    while let Some(rel_idx) = text[start..].find(".md") {
        let end = start + rel_idx + 3;
        let mut begin = end.saturating_sub(1);

        while begin > 0 {
            let ch = bytes[begin - 1] as char;
            if ch.is_ascii_alphanumeric() || matches!(ch, '/' | '\\' | '-' | '_' | '.') {
                begin -= 1;
            } else {
                break;
            }
        }

        let candidate = text[begin..end]
            .trim_matches(|c: char| matches!(c, '"' | '\'' | '`' | '(' | ')' | '[' | ']' | '{' | '}' | '<' | '>' | ',' | ';'))
            .trim();

        if candidate.contains('/') || candidate.contains('\\') {
            let normalized = candidate.replace('\\', "/");
            if !paths.iter().any(|p: &String| p.eq_ignore_ascii_case(&normalized)) {
                paths.push(normalized);
            }
        }

        start = end;
    }

    paths
}

fn normalize_doc_path(path: &str) -> String {
    path.replace('\\', "/").trim().trim_matches('/').to_ascii_lowercase()
}

fn normalize_ai_written_content(content: &str) -> String {
    let trimmed = content.trim();

    // Some models accidentally place a schema-like wrapper into the content string itself.
    // If that happens, prefer the nested `content` field rather than writing the wrapper verbatim.
    if trimmed.starts_with('{') && trimmed.contains("\"content\"") {
        if let Ok(value) = serde_json::from_str::<serde_json::Value>(trimmed) {
            if let Some(inner) = value.get("content").and_then(|v| v.as_str()) {
                return decode_common_entities(inner);
            }
        }
    }

    decode_common_entities(trimmed)
}

fn decode_common_entities(content: &str) -> String {
    content
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&amp;", "&")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
}

#[tauri::command]
pub fn ai_test_tools(
    state: State<'_, VaultState>,
) -> CmdResult<bool> {
    let lock = state.0.lock().map_err(|e| e.to_string())?;
    let vault = lock.as_ref().ok_or("No vault is open")?;
    let credentials = slatevault_core::credentials::Credentials::load().unwrap_or_default();
    let api_key = credentials.ai_api_key.as_deref();

    Ok(slatevault_core::ai::test_tool_support(
        &vault.config.ai.endpoint_url,
        api_key,
        &vault.config.ai.model,
    ))
}

#[tauri::command]
pub fn ai_list_models(
    state: State<'_, VaultState>,
) -> CmdResult<Vec<String>> {
    let lock = state.0.lock().map_err(|e| e.to_string())?;
    let vault = lock.as_ref().ok_or("No vault is open")?;

    let credentials = slatevault_core::credentials::Credentials::load().unwrap_or_default();
    let api_key = credentials.ai_api_key.as_deref();

    slatevault_core::ai::list_models(&vault.config.ai.endpoint_url, api_key)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn set_project_source_folder(
    project: String,
    source_folder: Option<String>,
    _state: State<'_, VaultState>,
) -> CmdResult<String> {
    let mut local = slatevault_core::local_config::LocalConfig::load()
        .map_err(|e| e.to_string())?;
    let label = source_folder.as_deref().unwrap_or("cleared").to_string();
    local.set_source_folder(&project, source_folder);
    local.save().map_err(|e| e.to_string())?;
    Ok(format!("Source folder {} for project '{}'", label, project))
}

#[tauri::command]
pub fn get_project_source_folder(
    project: String,
    _state: State<'_, VaultState>,
) -> CmdResult<Option<String>> {
    let local = slatevault_core::local_config::LocalConfig::load()
        .map_err(|e| e.to_string())?;
    Ok(local.get_source_folder(&project))
}

// -- Playbook commands --

#[derive(Serialize)]
pub struct PlaybookInfo {
    pub id: String,
    pub label: String,
    pub description: String,
}

#[tauri::command]
pub fn list_playbooks(
    state: State<'_, VaultState>,
) -> CmdResult<Vec<PlaybookInfo>> {
    with_vault(&state, |vault| {
        let config = slatevault_core::playbook::PlaybookConfig::load(&vault.root)?;
        Ok(config
            .playbooks
            .iter()
            .map(|p| PlaybookInfo {
                id: p.id.clone(),
                label: p.label.clone(),
                description: p.description.clone(),
            })
            .collect())
    })
}

#[tauri::command]
pub fn get_playbook_prompt(
    playbook_id: String,
    project: String,
    state: State<'_, VaultState>,
) -> CmdResult<String> {
    with_vault(&state, |vault| {
        let config = slatevault_core::playbook::PlaybookConfig::load(&vault.root)?;
        let playbook = config
            .playbooks
            .iter()
            .find(|p| p.id == playbook_id)
            .ok_or_else(|| {
                slatevault_core::CoreError::Io(std::io::Error::new(
                    std::io::ErrorKind::NotFound,
                    format!("Playbook '{}' not found", playbook_id),
                ))
            })?;

        // Gather project context
        let docs = vault.list_documents(&project, None)?;
        let doc_count = docs.len();
        let canonical_count = docs.iter().filter(|d| d.front_matter.canonical).count();

        let mut folders: Vec<String> = docs
            .iter()
            .filter_map(|d| {
                let parts: Vec<&str> = d.path.split('/').collect();
                if parts.len() > 1 {
                    Some(parts[0].to_string())
                } else {
                    None
                }
            })
            .collect();
        folders.sort();
        folders.dedup();

        Ok(slatevault_core::playbook::render_prompt(
            playbook,
            &project,
            &folders,
            doc_count,
            canonical_count,
        ))
    })
}

// -- Recent changes command (session continuity) --

#[derive(Serialize)]
pub struct RecentChange {
    pub project: String,
    pub path: String,
    pub title: String,
    pub modified: String,
    pub author: String,
}

#[tauri::command]
pub fn get_recent_changes(
    limit: Option<usize>,
    state: State<'_, VaultState>,
) -> CmdResult<Vec<RecentChange>> {
    with_vault(&state, |vault| {
        let max = limit.unwrap_or(20);
        let projects = vault.list_projects()?;
        let mut changes: Vec<RecentChange> = Vec::new();

        for p in &projects {
            if let Ok(docs) = vault.list_documents(&p.project.name, None) {
                for doc in &docs {
                    changes.push(RecentChange {
                        project: p.project.name.clone(),
                        path: doc.path.clone(),
                        title: doc.front_matter.title.clone(),
                        modified: doc.front_matter.modified.to_rfc3339(),
                        author: format!("{:?}", doc.front_matter.author).to_lowercase(),
                    });
                }
            }
        }

        changes.sort_by(|a, b| b.modified.cmp(&a.modified));
        Ok(changes.into_iter().take(max).collect())
    })
}

// -- Agent brief command --

fn is_about_doc(path: &str) -> bool {
    path.ends_with("/_about.md") || path == "_about.md"
}

fn task_keywords(task_focus: &str) -> Vec<String> {
    task_focus
        .to_lowercase()
        .split(|c: char| !c.is_alphanumeric())
        .filter(|token| token.len() >= 4)
        .map(|token| token.to_string())
        .collect()
}

fn feature_doc_slug(task_focus: &str) -> String {
    let focus = task_focus.to_lowercase();
    if focus.contains("dry") && focus.contains("tracker") {
        return "dry-day-tracking".to_string();
    }
    if focus.contains("feature") && focus.contains("spec") {
        return "feature-spec".to_string();
    }

    let mut parts: Vec<String> = task_keywords(task_focus)
        .into_iter()
        .take(4)
        .collect();
    if parts.is_empty() {
        parts.push("core-feature".to_string());
    }
    parts.join("-")
}

fn recommended_first_docs(task_focus: &str) -> Vec<(String, String)> {
    let focus = task_focus.to_lowercase();
    let feature_slug = feature_doc_slug(task_focus);
    let mut docs = vec![
        (
            "prd/product-requirements.md".to_string(),
            "Capture problem, target users, success criteria, and product scope.".to_string(),
        ),
        (
            format!("features/{}.md", feature_slug),
            "Define the first concrete user-facing feature and acceptance criteria.".to_string(),
        ),
        (
            "todo/initial-build.md".to_string(),
            "Break the first implementation pass into concrete tasks.".to_string(),
        ),
    ];

    if focus.contains("ios") || focus.contains("swiftui") {
        docs.push((
            "context/ios-architecture.md".to_string(),
            "Outline app structure, SwiftUI state flow, persistence, and platform constraints.".to_string(),
        ));
    }

    docs
}

fn infer_task_folders(task_focus: &str) -> Vec<&'static str> {
    let focus = task_focus.to_lowercase();
    let mut folders = Vec::new();

    let contains_any = |terms: &[&str]| terms.iter().any(|term| focus.contains(term));

    if contains_any(&["feature", "spec", "requirement", "prd"]) {
        folders.extend(["prd", "features", "todo", "specs", "notes"]);
    }
    if contains_any(&["implement", "implementation", "build", "develop", "coding"]) {
        folders.extend(["todo", "features", "prd", "specs", "context", "notes"]);
    }
    if contains_any(&["bug", "fix", "issue", "regression"]) {
        folders.extend(["bugs", "todo", "changelog", "notes", "specs"]);
    }
    if contains_any(&["architecture", "design", "system", "refactor"]) {
        folders.extend(["specs", "decisions", "context", "features"]);
    }
    if contains_any(&["handoff", "onboard", "resume", "session"]) {
        folders.extend(["context", "changelog", "guides", "specs", "notes"]);
    }
    if contains_any(&["release", "ship", "launch"]) {
        folders.extend(["changelog", "todo", "guides", "notes"]);
    }

    if folders.is_empty() {
        folders.extend(["prd", "features", "todo", "specs", "notes", "context"]);
    }

    folders
}

fn score_doc_for_task(
    doc: &slatevault_core::document::Document,
    task_focus: &str,
    preferred_folders: &[&str],
    newest_modified: chrono::DateTime<chrono::Utc>,
) -> i32 {
    if is_about_doc(&doc.path) {
        return i32::MIN / 2;
    }

    let path_lower = doc.path.to_lowercase();
    let title_lower = doc.front_matter.title.to_lowercase();
    let folder = doc.path.split('/').next().unwrap_or("");
    let keywords = task_keywords(task_focus);
    let mut score = 0;

    if doc.front_matter.canonical {
        score += 40;
    }

    if path_lower.starts_with("wbmgr/") {
        score += 18;
    }

    if let Some(index) = preferred_folders.iter().position(|candidate| *candidate == folder) {
        score += 24 - (index as i32 * 3);
    }

    let age_days = newest_modified
        .signed_duration_since(doc.front_matter.modified)
        .num_days();
    if age_days <= 1 {
        score += 16;
    } else if age_days <= 7 {
        score += 10;
    } else if age_days <= 30 {
        score += 4;
    }

    for keyword in keywords {
        if title_lower.contains(&keyword) {
            score += 12;
        }
        if path_lower.contains(&keyword) {
            score += 8;
        }
    }

    if title_lower.contains("product requirements") || title_lower.contains("prd") {
        score += 10;
    }
    if path_lower.starts_with("prd/") {
        score += 14;
    }
    if title_lower.contains("feature") || path_lower.contains("/features/") {
        score += 8;
    }
    if title_lower.contains("todo") || path_lower.contains("/todo/") {
        score += 6;
    }
    if title_lower.contains("spec") || path_lower.contains("/specs/") {
        score += 8;
    }

    let workflow_like = title_lower.contains("workflow")
        || title_lower.contains("getting started")
        || path_lower.contains("/guides/");
    let explicit_process_task = task_focus.to_lowercase().contains("workflow")
        || task_focus.to_lowercase().contains("process")
        || task_focus.to_lowercase().contains("guide");
    if workflow_like && !explicit_process_task {
        score -= 10;
    }

    let implementation_like = task_focus.to_lowercase().contains("implement")
        || task_focus.to_lowercase().contains("implementation")
        || task_focus.to_lowercase().contains("build");
    if implementation_like && path_lower.contains("settings-ai") {
        score -= 8;
    }

    score
}

#[tauri::command]
pub fn generate_project_brief(
    project: String,
    focus: Option<String>,
    state: State<'_, VaultState>,
) -> CmdResult<String> {
    with_vault(&state, |vault| {
        let docs = vault.list_documents(&project, None)?;
        let project_config = vault.open_project(&project)?;
        let desc = &project_config.config.project.description;
        let focus = focus.unwrap_or_default();
        let focus_trimmed = focus.trim();

        let canonical: Vec<_> = docs.iter().filter(|d| d.front_matter.canonical).collect();
        let protected_count = docs.iter().filter(|d| d.front_matter.protected).count();
        let ai_count = docs.iter().filter(|d| format!("{:?}", d.front_matter.author).to_lowercase() == "ai").count();
        let draft_count = docs.iter().filter(|d| format!("{:?}", d.front_matter.status).to_lowercase() == "draft").count();
        let final_count = docs.iter().filter(|d| format!("{:?}", d.front_matter.status).to_lowercase() == "final").count();
        let newest_modified = docs
            .iter()
            .map(|d| d.front_matter.modified)
            .max()
            .unwrap_or_else(chrono::Utc::now);
        let preferred_folders = infer_task_folders(focus_trimmed);
        let substantive_docs: Vec<_> = docs.iter().filter(|d| !is_about_doc(&d.path)).collect();
        let greenfield_mode = substantive_docs.is_empty();

        // Group by folder
        let mut folder_counts: std::collections::BTreeMap<String, usize> = std::collections::BTreeMap::new();
        for doc in &docs {
            let folder = doc.path.split('/').next().unwrap_or("root");
            let folder = if doc.path.contains('/') { folder } else { "(root)" };
            *folder_counts.entry(folder.to_string()).or_default() += 1;
        }

        let mut brief = format!("# Agent Brief: {}\n\n", project);

        brief.push_str("## Agent Rules\n\n");
        brief.push_str("- Use the SlateVault MCP for documentation discovery, reading, and writing whenever possible.\n");
        brief.push_str("- Prefer SlateVault document tools over direct filesystem edits for docs that live in the vault.\n");
        brief.push_str("- Treat canonical SlateVault docs as the source of truth when they exist.\n\n");

        if !focus_trimmed.is_empty() {
            brief.push_str("## Current Task\n\n");
            brief.push_str(&format!("{}\n\n", focus_trimmed));
        }

        // 1. Project Summary
        brief.push_str("## Project Summary\n\n");
        if !desc.is_empty() {
            brief.push_str(&format!("{}\n\n", desc));
        }
        brief.push_str("_This brief serves as an initialization context for AI agents entering this project. Read key documents first, respect constraints, and follow suggested actions._\n\n");
        brief.push_str(&format!(
            "- **Total documents:** {}\n- **Canonical (source of truth):** {}\n- **Protected:** {}\n- **AI-authored:** {}\n- **Drafts:** {} | **Final:** {}\n\n",
            docs.len(), canonical.len(), protected_count, ai_count, draft_count, final_count
        ));

        // Folder breakdown
        if !folder_counts.is_empty() {
            brief.push_str("**Structure:**\n");
            for (folder, count) in &folder_counts {
                brief.push_str(&format!("- `{}/` — {} doc{}\n", folder, count, if *count != 1 { "s" } else { "" }));
            }
            brief.push_str("\n");
        }

        // 2. Key Documents (Read First) — canonical + high-signal docs
        if greenfield_mode {
            brief.push_str("---\n\n## Greenfield Status\n\n");
            brief.push_str("No substantive project docs exist yet beyond starter folder descriptions.\n\n");
            brief.push_str("## Recommended First Docs\n\n");
            for (path, reason) in recommended_first_docs(focus_trimmed) {
                brief.push_str(&format!("- `{}` â€” {}\n", path, reason));
            }
            brief.push_str("\n");
        }
        brief.push_str("---\n\n## Key Documents (Read First)\n\n");
        if !canonical.is_empty() {
            brief.push_str("_These are canonical — they define the source of truth._\n\n");
            for doc in &canonical {
                if !is_about_doc(&doc.path) {
                    brief.push_str(&format!("### {}\n\n{}\n\n", doc.front_matter.title, doc.content));
                }
            }
        }

        // Context files (not already included as canonical)
        if let Ok(context) = vault.get_project_context(&project) {
            let new_context: Vec<_> = context.iter()
                .filter(|(path, _)| !canonical.iter().any(|c| c.path == *path))
                .filter(|(path, _)| !is_about_doc(path))
                .collect();
            if !new_context.is_empty() {
                if canonical.is_empty() {
                    brief.push_str("_No canonical docs yet. These pinned context files are the best starting point._\n\n");
                }
                for (path, content) in &new_context {
                    brief.push_str(&format!("### {}\n\n{}\n\n", path, content));
                }
            }
        }

        // If nothing to read first, suggest best starting docs
        if canonical.is_empty() {
            let context_count = vault.get_project_context(&project).map(|c| c.len()).unwrap_or(0);
            if context_count == 0 {
                // Auto-detect best starting docs
                let starters: Vec<_> = docs.iter()
                    .filter(|d| {
                        if is_about_doc(&d.path) {
                            return false;
                        }
                        let p = d.path.to_lowercase();
                        let t = d.front_matter.title.to_lowercase();
                        p.contains("overview") || p.contains("architecture") || p.contains("readme")
                            || t.contains("overview") || t.contains("architecture")
                    })
                    .take(3)
                    .collect();

                if !starters.is_empty() {
                    brief.push_str("_No canonical or pinned context docs exist yet. Start by reviewing:_\n\n");
                    for doc in &starters {
                        brief.push_str(&format!("- **{}** (`{}`)\n", doc.front_matter.title, doc.path));
                    }
                    brief.push_str("\n");
                } else {
                    brief.push_str("_No canonical or pinned context docs exist yet. Start by reading the document index below._\n\n");
                }
            }
        }

        if !focus_trimmed.is_empty() {
            let mut focus_docs: Vec<_> = docs
                .iter()
                .filter(|d| !is_about_doc(&d.path))
                .map(|doc| (score_doc_for_task(doc, focus_trimmed, &preferred_folders, newest_modified), doc))
                .filter(|(score, _)| *score > 0)
                .collect();
            focus_docs.sort_by(|a, b| b.0.cmp(&a.0).then_with(|| b.1.front_matter.modified.cmp(&a.1.front_matter.modified)));
            if !focus_docs.is_empty() {
                brief.push_str("## Task-Relevant Docs\n\n");
                brief.push_str("_These documents appear most relevant to the current task._\n\n");
                for (_, doc) in focus_docs.into_iter().take(6) {
                    let status = format!("{:?}", doc.front_matter.status).to_lowercase();
                    brief.push_str(&format!(
                        "- **{}** (`{}`) [{}]\n",
                        doc.front_matter.title, doc.path, status
                    ));
                }
                brief.push_str("\n");
            }
        }

        // 3. Current Focus (recent docs by modification date)
        let mut recent: Vec<_> = docs.iter().filter(|d| !is_about_doc(&d.path)).collect();
        recent.sort_by(|a, b| b.front_matter.modified.cmp(&a.front_matter.modified));
        let recent_5: Vec<_> = recent.into_iter().take(5).collect();
        if !recent_5.is_empty() {
            brief.push_str("---\n\n## Current Focus (Recently Modified)\n\n");
            for doc in &recent_5 {
                let status = format!("{:?}", doc.front_matter.status).to_lowercase();
                brief.push_str(&format!(
                    "- **{}** [{}] — {}\n",
                    doc.front_matter.title, status, doc.front_matter.modified.format("%Y-%m-%d")
                ));
            }
            brief.push_str("\n");
        }

        // Canonical strategy
        brief.push_str("---\n\n## Canonical Strategy\n\n");
        if canonical.is_empty() {
            brief.push_str("No documents are currently marked as canonical. ");
            brief.push_str("Establishing canonical documents (architecture, key specs, core decisions) should be prioritized. ");
            brief.push_str("Mark docs as canonical by adding `canonical: true` to their frontmatter.\n\n");
        } else {
            brief.push_str(&format!("{} canonical document{} established:\n", canonical.len(), if canonical.len() != 1 { "s" } else { "" }));
            for doc in &canonical {
                brief.push_str(&format!("- **{}** (`{}`)\n", doc.front_matter.title, doc.path));
            }
            brief.push_str("\n");
        }

        // Known gaps with urgency
        let gap_count = [canonical.is_empty(), draft_count > 0 && final_count == 0, protected_count == 0]
            .iter().filter(|&&x| x).count();
        if gap_count > 0 {
            brief.push_str("## Known Gaps\n\n");
            if canonical.is_empty() && draft_count > 0 {
                brief.push_str(&format!(
                    "**WARNING:** All {} documents are drafts and no canonical docs exist. This project has no established source of truth.\n\n",
                    docs.len()
                ));
            }
            if canonical.is_empty() {
                brief.push_str("- No canonical documents established yet\n");
            }
            if draft_count > 0 {
                brief.push_str(&format!("- {} document{} still in draft state\n", draft_count, if draft_count != 1 { "s" } else { "" }));
            }
            if final_count == 0 && docs.len() > 0 {
                brief.push_str("- No documents marked as final\n");
            }
            if protected_count == 0 && docs.len() > 0 {
                brief.push_str("- No documents are protected from AI overwrites\n");
            }
            brief.push_str("\n");
        }

        // 4. Constraints & Rules
        brief.push_str("---\n\n## Constraints & Rules\n\n");
        brief.push_str("- Do NOT overwrite protected documents — use `propose_doc_update` or `append_to_doc`\n");
        brief.push_str("- Canonical docs are the source of truth — prioritize over drafts\n");
        brief.push_str("- AI-authored docs are tagged `author: ai` and auto-staged for git\n");
        brief.push_str("- Use `convert_to_spec` to structure messy notes into clean specs\n");
        brief.push_str("- Use `build_context_bundle` to gather focused context before major changes\n\n");

        // Compression instructions
        if vault.config.mcp.compress_context {
            brief.push_str("## Compression Mode (Active)\n\n");
            brief.push_str("When writing session summaries, changelogs, and notes, use compressed shorthand to maximize context density:\n");
            brief.push_str("- Drop articles (a, the, an) and filler words\n");
            brief.push_str("- Abbreviate common terms: config, impl, auth, func, param, req, res, db, repo, deps, env, init, msg, err, ctx\n");
            brief.push_str("- Use symbols: → (leads to), + (added), - (removed), = (equals/set to), ~ (approximately), @ (at/regarding)\n");
            brief.push_str("- Use shorthand paths: `specs/auth.md` not `the auth specification document`\n");
            brief.push_str("- Skip obvious context — don't restate what's in the project summary\n");
            brief.push_str("- For code refs: `fn:handleAuth` not `the handleAuth function`\n");
            brief.push_str("- Dates: `04-06` not `April 6th, 2026`\n\n");
            brief.push_str("Example compressed changelog:\n");
            brief.push_str("```\n+ auth flow spec → specs/auth.md (draft)\n+ ADR-003 JWT over sessions → decisions/003-jwt.md\n~ refactored db schema docs, updated er diagram\n- removed deprecated api-v1 refs from guides/\nnext: impl rate limiting spec, review stale docs\n```\n\n");
        }

        // 5. Suggested Actions (context-aware)
        brief.push_str("## Suggested Actions\n\n");
        if greenfield_mode {
            brief.push_str("- Create `prd/product-requirements.md` to define product scope, target user, and success criteria\n");
            brief.push_str("- Draft the first feature spec with the core user flow and acceptance criteria\n");
            if focus_trimmed.to_lowercase().contains("dry") || focus_trimmed.to_lowercase().contains("tracker") {
                brief.push_str("- Define exactly what counts as a dry day, how logging works, and how streak/history should behave\n");
            }
            if focus_trimmed.to_lowercase().contains("ios") || focus_trimmed.to_lowercase().contains("swiftui") {
                brief.push_str("- Decide SwiftUI app structure, state management, and local persistence approach before implementation\n");
            }
            brief.push_str("- Break the initial build into concrete tasks in `todo/initial-build.md`\n");
        } else {
            if canonical.is_empty() {
                brief.push_str("- **Identify and promote key documents to canonical status** (architecture, specs, decisions)\n");
            }
            if draft_count > 0 {
                brief.push_str(&format!("- Review and finalize {} draft document{}\n", draft_count, if draft_count != 1 { "s" } else { "" }));
            }
            brief.push_str("- Propose structural improvements via `propose_doc_update`\n");
            brief.push_str("- Generate implementation specs from feature docs with `convert_to_spec`\n");
            brief.push_str("- Use `build_context_bundle` for focused analysis before major changes\n");
            brief.push_str("- Check for stale docs with `detect_stale_docs`\n");
        }

        // All docs index
        let non_canonical: Vec<_> = docs
            .iter()
            .filter(|d| !d.front_matter.canonical)
            .filter(|d| !greenfield_mode || !is_about_doc(&d.path))
            .collect();
        if !non_canonical.is_empty() {
            brief.push_str("\n---\n\n## Document Index\n\n");
            for doc in &non_canonical {
                let status = format!("{:?}", doc.front_matter.status).to_lowercase();
                let author = format!("{:?}", doc.front_matter.author).to_lowercase();
                brief.push_str(&format!(
                    "- **{}** (`{}`) [{}, {}]\n",
                    doc.front_matter.title, doc.path, status, author
                ));
            }
        }

        let brief = brief
            .replace(
                "---\n\n## Key Documents (Read First)\n\n## Task-Relevant Docs\n\n",
                "## Task-Relevant Docs\n\n",
            )
            .replace(
                "---\n\n## Key Documents (Read First)\n\n---\n\n## Current Focus (Recently Modified)\n\n",
                "---\n\n## Current Focus (Recently Modified)\n\n",
            )
            .replace(
                "---\n\n## Key Documents (Read First)\n\n---\n\n## Canonical Strategy\n\n",
                "---\n\n## Canonical Strategy\n\n",
            )
            .replace("Ã¢â‚¬â€", "-")
            .replace("â€”", "-")
            .replace("â†’", "->");

        Ok(brief)
    })
}

// -- Backlinks command --

#[derive(Serialize)]
pub struct BacklinkInfo {
    pub project: String,
    pub path: String,
    pub title: String,
}

#[tauri::command]
pub fn get_backlinks(
    project: String,
    path: String,
    state: State<'_, VaultState>,
) -> CmdResult<Vec<BacklinkInfo>> {
    with_vault(&state, |vault| {
        let all_docs = vault.list_documents(&project, None)?;
        let mut backlinks = Vec::new();

        // Patterns to search for: the path itself, the filename, and [[title]]
        let target_doc = vault.read_document(&project, &path).ok();
        let filename = path.split('/').last().unwrap_or(&path);
        let filename_no_ext = filename.trim_end_matches(".md");
        let title = target_doc
            .as_ref()
            .map(|d| d.front_matter.title.as_str())
            .unwrap_or("");

        for doc in &all_docs {
            if doc.path == path {
                continue;
            }
            let content = &doc.content;
            let has_ref = content.contains(&path)
                || content.contains(&format!("[[{}]]", filename_no_ext))
                || content.contains(&format!("[[{}]]", title))
                || content.contains(&format!("`{}`", path));

            if has_ref {
                backlinks.push(BacklinkInfo {
                    project: project.clone(),
                    path: doc.path.clone(),
                    title: doc.front_matter.title.clone(),
                });
            }
        }

        Ok(backlinks)
    })
}

// -- Related docs command --

#[derive(Serialize)]
pub struct RelatedDocInfo {
    pub project: String,
    pub path: String,
    pub title: String,
    pub shared_tags: Vec<String>,
}

#[tauri::command]
pub fn get_related_docs(
    project: String,
    path: String,
    state: State<'_, VaultState>,
) -> CmdResult<Vec<RelatedDocInfo>> {
    with_vault(&state, |vault| {
        let doc = vault.read_document(&project, &path)?;
        let doc_tags = &doc.front_matter.tags;
        if doc_tags.is_empty() {
            return Ok(Vec::new());
        }

        let all_docs = vault.list_documents(&project, None)?;
        let mut related = Vec::new();

        for other in &all_docs {
            if other.path == path {
                continue;
            }
            let shared: Vec<String> = doc_tags
                .iter()
                .filter(|t| other.front_matter.tags.contains(t))
                .cloned()
                .collect();
            if !shared.is_empty() {
                related.push(RelatedDocInfo {
                    project: project.clone(),
                    path: other.path.clone(),
                    title: other.front_matter.title.clone(),
                    shared_tags: shared,
                });
            }
        }

        // Sort by number of shared tags (most related first)
        related.sort_by(|a, b| b.shared_tags.len().cmp(&a.shared_tags.len()));
        Ok(related.into_iter().take(5).collect())
    })
}

// -- Export commands --

#[derive(Serialize)]
pub struct ExportDoc {
    pub title: String,
    pub path: String,
    pub content: String,
}

#[derive(Serialize)]
pub struct ExportSection {
    pub folder: String,
    pub docs: Vec<ExportDoc>,
}

#[derive(Serialize)]
pub struct ProjectExport {
    pub project_name: String,
    pub sections: Vec<ExportSection>,
}

#[tauri::command]
pub fn export_project_docs(
    project: String,
    state: State<'_, VaultState>,
) -> CmdResult<ProjectExport> {
    with_vault(&state, |vault| {
        let project_obj = vault.open_project(&project)?;
        let folder_order = &project_obj.config.project.folder_order;
        let docs = vault.list_documents(&project, None)?;

        // Group docs by folder
        let mut root_docs: Vec<ExportDoc> = Vec::new();
        let mut folder_map: std::collections::HashMap<String, Vec<ExportDoc>> =
            std::collections::HashMap::new();

        for doc in &docs {
            // Skip _about.md template files
            if doc.path.ends_with("/_about.md") || doc.path == "_about.md" {
                continue;
            }

            let parts: Vec<&str> = doc.path.split('/').collect();
            let export_doc = ExportDoc {
                title: doc.front_matter.title.clone(),
                path: doc.path.clone(),
                content: doc.content.clone(),
            };

            if parts.len() == 1 {
                root_docs.push(export_doc);
            } else {
                let folder = parts[0].to_string();
                folder_map.entry(folder).or_default().push(export_doc);
            }
        }

        let mut sections = Vec::new();

        // Root-level docs first as "General"
        if !root_docs.is_empty() {
            root_docs.sort_by(|a, b| a.title.cmp(&b.title));
            sections.push(ExportSection {
                folder: "General".to_string(),
                docs: root_docs,
            });
        }

        // Ordered folders first
        for folder in folder_order {
            if let Some(mut docs) = folder_map.remove(folder) {
                docs.sort_by(|a, b| a.title.cmp(&b.title));
                // Capitalize folder name for section header
                let label = folder
                    .chars()
                    .next()
                    .map(|c| c.to_uppercase().to_string() + &folder[1..])
                    .unwrap_or_else(|| folder.clone());
                sections.push(ExportSection {
                    folder: label,
                    docs,
                });
            }
        }

        // Remaining folders (not in folder_order) alphabetically
        let mut remaining: Vec<(String, Vec<ExportDoc>)> = folder_map.into_iter().collect();
        remaining.sort_by(|a, b| a.0.cmp(&b.0));
        for (folder, mut docs) in remaining {
            docs.sort_by(|a, b| a.title.cmp(&b.title));
            let label = folder
                .chars()
                .next()
                .map(|c| c.to_uppercase().to_string() + &folder[1..])
                .unwrap_or_else(|| folder.clone());
            sections.push(ExportSection {
                folder: label,
                docs,
            });
        }

        Ok(ProjectExport {
            project_name: project.clone(),
            sections,
        })
    })
}

// -- Backup / Restore / Import --

#[tauri::command]
pub fn backup_vault(
    dest_path: String,
    state: State<'_, VaultState>,
) -> CmdResult<String> {
    let lock = state.0.lock().map_err(|e| e.to_string())?;
    let vault = lock.as_ref().ok_or("No vault is open")?;
    let vault_root = &vault.root;

    let file = std::fs::File::create(&dest_path).map_err(|e| format!("Failed to create zip: {}", e))?;
    let mut zip = zip::ZipWriter::new(file);
    let options = zip::write::SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated);

    fn add_dir(
        zip: &mut zip::ZipWriter<std::fs::File>,
        base: &std::path::Path,
        dir: &std::path::Path,
        options: zip::write::SimpleFileOptions,
    ) -> Result<usize, String> {
        let mut count = 0;
        for entry in std::fs::read_dir(dir).map_err(|e| e.to_string())? {
            let entry = entry.map_err(|e| e.to_string())?;
            let path = entry.path();
            let rel = path.strip_prefix(base).unwrap_or(&path).to_string_lossy().replace('\\', "/");

            // Skip index.db, .git, and target directories
            if rel.starts_with(".git") || rel.starts_with("index.db") || rel.starts_with("target") {
                continue;
            }

            if path.is_dir() {
                zip.add_directory(&format!("{}/", rel), options).map_err(|e| e.to_string())?;
                count += add_dir(zip, base, &path, options)?;
            } else {
                zip.start_file(&rel, options).map_err(|e| e.to_string())?;
                let data = std::fs::read(&path).map_err(|e| e.to_string())?;
                std::io::Write::write_all(zip, &data).map_err(|e| e.to_string())?;
                count += 1;
            }
        }
        Ok(count)
    }

    let count = add_dir(&mut zip, vault_root, vault_root, options)?;
    zip.finish().map_err(|e| format!("Failed to finalize zip: {}", e))?;

    Ok(format!("Backup complete: {} files archived", count))
}

#[tauri::command]
pub fn restore_vault(
    zip_path: String,
    dest_path: String,
) -> CmdResult<String> {
    fn zip_entry_destination(dest: &Path, entry_name: &str) -> Result<PathBuf, String> {
        let mut relative = PathBuf::new();

        for component in Path::new(entry_name).components() {
            match component {
                Component::Normal(part) => relative.push(part),
                Component::CurDir => {}
                Component::ParentDir | Component::RootDir | Component::Prefix(_) => {
                    return Err(format!("Archive entry escapes destination: {}", entry_name));
                }
            }
        }

        if relative.as_os_str().is_empty() {
            return Err(format!("Archive entry has no safe relative path: {}", entry_name));
        }

        Ok(dest.join(relative))
    }

    let file = std::fs::File::open(&zip_path).map_err(|e| format!("Failed to open zip: {}", e))?;
    let mut archive = zip::ZipArchive::new(file).map_err(|e| format!("Invalid zip: {}", e))?;

    let dest = std::path::PathBuf::from(&dest_path);
    std::fs::create_dir_all(&dest).map_err(|e| e.to_string())?;

    let mut count = 0;
    for i in 0..archive.len() {
        let mut entry = archive.by_index(i).map_err(|e| e.to_string())?;
        let out_path = zip_entry_destination(&dest, entry.name())?;

        if entry.is_dir() {
            std::fs::create_dir_all(&out_path).map_err(|e| e.to_string())?;
        } else {
            if let Some(parent) = out_path.parent() {
                std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
            }
            let mut out_file = std::fs::File::create(&out_path).map_err(|e| e.to_string())?;
            std::io::copy(&mut entry, &mut out_file).map_err(|e| e.to_string())?;
            count += 1;
        }
    }

    Ok(format!("Restored {} files to {}", count, dest_path))
}

#[tauri::command]
pub fn import_markdown_folder(
    project: String,
    source_path: String,
    state: State<'_, VaultState>,
) -> CmdResult<String> {
    with_vault(&state, |vault| {
        let project_obj = vault.open_project(&project)?;
        let docs_dir = project_obj.docs_dir();
        let source = std::path::PathBuf::from(&source_path);

        if !source.is_dir() {
            return Err(slatevault_core::CoreError::Io(std::io::Error::new(
                std::io::ErrorKind::NotFound,
                "Source folder not found",
            )));
        }

        let mut count = 0;

        fn import_dir(
            src: &std::path::Path,
            src_base: &std::path::Path,
            dest_base: &std::path::Path,
            count: &mut usize,
        ) -> Result<(), slatevault_core::CoreError> {
            for entry in std::fs::read_dir(src)? {
                let entry = entry?;
                let path = entry.path();
                let rel = path.strip_prefix(src_base).unwrap_or(&path);
                let dest = dest_base.join(rel);

                if path.is_dir() {
                    std::fs::create_dir_all(&dest)?;
                    import_dir(&path, src_base, dest_base, count)?;
                } else if path.extension().map_or(false, |e| e == "md" || e == "markdown") {
                    if let Some(parent) = dest.parent() {
                        std::fs::create_dir_all(parent)?;
                    }

                    let content = std::fs::read_to_string(&path)?;

                    // Check if file already has frontmatter
                    if content.trim_start().starts_with("---") {
                        // Has frontmatter, copy as-is
                        std::fs::write(&dest, &content)?;
                    } else {
                        // Add frontmatter
                        let filename = path.file_stem()
                            .map(|s| s.to_string_lossy().to_string())
                            .unwrap_or_default();
                        let title = filename.replace(['-', '_'], " ");
                        let now = chrono::Utc::now().to_rfc3339();
                        let fm = format!(
                            "---\nid: {}\ntitle: \"{}\"\nauthor: human\nstatus: draft\ntags: [imported]\ncreated: \"{}\"\nmodified: \"{}\"\nproject: \"\"\ncanonical: false\nprotected: false\n---\n\n{}",
                            uuid::Uuid::new_v4(), title, now, now, content
                        );
                        std::fs::write(&dest, fm)?;
                    }

                    *count += 1;
                }
            }
            Ok(())
        }

        import_dir(&source, &source, &docs_dir, &mut count)?;

        // Rebuild index to pick up imported docs
        let _ = vault.rebuild_index();

        Ok(format!("Imported {} markdown files into project '{}'", count, project))
    })
}

// -- Import files dragged in from the OS into a project folder --

#[derive(serde::Deserialize)]
pub struct ImportFileArg {
    filename: String,
    data_base64: String,
}

/// Returns the destination path inside `dir` that doesn't conflict with an
/// existing file.  E.g. "notes.md" → "notes (1).md" → "notes (2).md" …
fn unique_file_path(dir: &std::path::Path, filename: &str) -> std::path::PathBuf {
    let candidate = dir.join(filename);
    if !candidate.exists() {
        return candidate;
    }
    let p = std::path::Path::new(filename);
    let stem = p.file_stem().and_then(|s| s.to_str()).unwrap_or(filename);
    let ext = p.extension().and_then(|s| s.to_str());
    let mut i = 1u32;
    loop {
        let new_name = match ext {
            Some(e) => format!("{} ({}).{}", stem, i, e),
            None => format!("{} ({})", stem, i),
        };
        let candidate = dir.join(&new_name);
        if !candidate.exists() {
            return candidate;
        }
        i += 1;
    }
}

/// Extract a human-readable title from raw markdown text.
/// Prefers the first `# Heading`; falls back to the filename stem.
fn extract_md_title(text: &str, filename: &str) -> String {
    for line in text.lines() {
        if let Some(heading) = line.trim().strip_prefix("# ") {
            let t = heading.trim();
            if !t.is_empty() {
                return t.to_string();
            }
        }
    }
    Path::new(filename)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or(filename)
        .replace(['-', '_'], " ")
}

#[tauri::command]
pub fn import_files_to_project(
    project: String,
    folder_path: String,
    files: Vec<ImportFileArg>,
    state: State<'_, VaultState>,
) -> CmdResult<Vec<String>> {
    use base64::Engine;
    with_vault(&state, |vault| {
        let project_obj = vault.open_project(&project)?;
        let docs_dir = project_obj.docs_dir();

        // Resolve target directory inside docs/
        let target_dir = if folder_path.is_empty() {
            docs_dir.clone()
        } else {
            let rel = sanitize_relative_path(&folder_path)?;
            docs_dir.join(rel)
        };
        std::fs::create_dir_all(&target_dir)?;

        let mut imported: Vec<String> = Vec::new();

        for file_arg in &files {
            // Reject path traversal in filename
            let filename = sanitize_single_component(&file_arg.filename)?;

            // Decode base64
            let data = base64::engine::general_purpose::STANDARD
                .decode(&file_arg.data_base64)
                .map_err(|e| invalid_input(format!("Bad base64 for {}: {}", filename, e)))?;

            if filename.to_lowercase().ends_with(".md") {
                // --- Markdown: ensure it has vault front matter ---
                let text = String::from_utf8_lossy(&data).into_owned();
                let has_front_matter = text.trim_start().starts_with("---");

                // Figure out the final (conflict-free) filename
                let dest_check = unique_file_path(&target_dir, &filename);
                let final_name = dest_check
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or(&filename)
                    .to_string();
                let vault_rel = if folder_path.is_empty() {
                    final_name.clone()
                } else {
                    format!("{}/{}", folder_path, final_name)
                };

                if has_front_matter {
                    // Raw write — vault already can parse it
                    std::fs::write(&dest_check, &data)?;
                    let _ = vault.stage_file(&dest_check);
                    if let Ok(doc) = vault.read_document(&project, &vault_rel) {
                        let _ = vault.search.index_document(
                            &project,
                            &doc.path,
                            &doc.front_matter.title,
                            &doc.content,
                            &doc.front_matter.tags,
                            &format!("{:?}", doc.front_matter.author).to_lowercase(),
                            &format!("{:?}", doc.front_matter.status).to_lowercase(),
                            doc.front_matter.canonical,
                        );
                    }
                    imported.push(vault_rel);
                } else {
                    // No front matter — let vault.write_document add it so the
                    // file parses correctly and appears in the tree / search.
                    let title = extract_md_title(&text, &final_name);
                    let doc = vault.write_document(
                        &project,
                        &vault_rel,
                        &title,
                        &text,
                        vec![],
                        None,
                    )?;
                    imported.push(doc.path);
                }
            } else {
                // --- Non-markdown: raw copy, won't appear in doc tree ---
                let dest = unique_file_path(&target_dir, &filename);
                std::fs::write(&dest, &data)?;
                let _ = vault.stage_file(&dest);
                let rel = dest
                    .strip_prefix(&docs_dir)
                    .unwrap_or(&dest)
                    .to_string_lossy()
                    .replace('\\', "/");
                imported.push(rel);
            }
        }

        Ok(imported)
    })
}

// -- Binary file write (for PDF export) --

#[tauri::command]
pub fn write_binary_file(path: String, data_base64: String) -> CmdResult<String> {
    use base64::Engine;
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(&data_base64)
        .map_err(|e| format!("Invalid base64: {}", e))?;
    std::fs::write(&path, &bytes).map_err(|e| format!("Failed to write file: {}", e))?;
    Ok(format!("Written to {}", path))
}

// -- Raw file commands (for vault-root files like templates.json) --

#[tauri::command]
pub fn read_vault_file(
    path: String,
    state: State<'_, VaultState>,
) -> CmdResult<String> {
    with_vault(&state, |vault| {
        let full = resolve_inside(&vault.root, &path)?;
        let content = std::fs::read_to_string(&full)?;
        Ok(content)
    })
}

#[tauri::command]
pub fn write_vault_file(
    path: String,
    content: String,
    state: State<'_, VaultState>,
) -> CmdResult<String> {
    with_vault(&state, |vault| {
        let full = resolve_inside(&vault.root, &path)?;
        std::fs::write(&full, &content)?;
        Ok(format!("Saved {}", path))
    })
}

// -- Template commands --

#[tauri::command]
pub fn list_templates(
    state: State<'_, VaultState>,
) -> CmdResult<Vec<slatevault_core::template::TemplateInfo>> {
    with_vault(&state, |vault| {
        let config = slatevault_core::template::TemplateConfig::load(&vault.root)?;
        Ok(config.list())
    })
}

#[tauri::command]
pub fn get_templates_config(
    state: State<'_, VaultState>,
) -> CmdResult<String> {
    with_vault(&state, |vault| {
        let path = vault.root.join("templates.json");
        let content = std::fs::read_to_string(&path)?;
        Ok(content)
    })
}

#[tauri::command]
pub fn save_templates_config(
    json: String,
    state: State<'_, VaultState>,
) -> CmdResult<String> {
    with_vault(&state, |vault| {
        // Validate JSON before saving
        let _: slatevault_core::template::TemplateConfig =
            serde_json::from_str(&json).map_err(|e| {
                slatevault_core::CoreError::Io(std::io::Error::new(
                    std::io::ErrorKind::InvalidData,
                    format!("Invalid template config: {}", e),
                ))
            })?;
        std::fs::write(vault.root.join("templates.json"), &json)?;
        Ok("Templates saved".to_string())
    })
}

#[tauri::command]
pub fn list_folders(
    project: String,
    state: State<'_, VaultState>,
) -> CmdResult<Vec<String>> {
    with_vault(&state, |vault| {
        let project_obj = vault.open_project(&project)?;
        let docs_dir = project_obj.docs_dir();
        let mut folders = Vec::new();
        if docs_dir.exists() {
            collect_folders(&docs_dir, &docs_dir, &mut folders)?;
        }
        folders.sort();
        Ok(folders)
    })
}

fn collect_folders(
    base: &std::path::Path,
    dir: &std::path::Path,
    folders: &mut Vec<String>,
) -> Result<(), slatevault_core::CoreError> {
    for entry in std::fs::read_dir(dir)? {
        let entry = entry?;
        let path = entry.path();
        if path.is_dir() {
            let rel = path
                .strip_prefix(base)
                .unwrap_or(&path)
                .to_string_lossy()
                .replace('\\', "/");
            folders.push(rel);
            collect_folders(base, &path, folders)?;
        }
    }
    Ok(())
}

#[tauri::command]
pub fn delete_folder(
    project: String,
    folder_path: String,
    state: State<'_, VaultState>,
) -> CmdResult<String> {
    with_vault(&state, |vault| {
        let project_obj = vault.open_project(&project)?;
        let full_path = resolve_inside(&project_obj.docs_dir(), &folder_path)?;
        if !full_path.is_dir() {
            return Err(slatevault_core::CoreError::Io(std::io::Error::new(
                std::io::ErrorKind::NotFound,
                "Folder not found",
            )));
        }
        // Check for user content (markdown files or subdirectories with content)
        fn has_user_content(dir: &std::path::Path) -> std::io::Result<bool> {
            for entry in std::fs::read_dir(dir)? {
                let entry = entry?;
                let path = entry.path();
                if path.is_dir() {
                    if has_user_content(&path)? {
                        return Ok(true);
                    }
                } else if path.extension().map_or(false, |e| e == "md") {
                    return Ok(true);
                }
            }
            Ok(false)
        }
        if has_user_content(&full_path).unwrap_or(false) {
            return Err(slatevault_core::CoreError::Io(std::io::Error::new(
                std::io::ErrorKind::Other,
                "Folder contains documents. Move or delete them first.",
            )));
        }
        // Use remove_dir_all to handle hidden system files (Thumbs.db, desktop.ini, etc.)
        std::fs::remove_dir_all(&full_path)?;
        Ok(format!("Folder deleted: {}/{}", project, folder_path))
    })
}

#[tauri::command]
pub fn create_folder(
    project: String,
    folder_path: String,
    state: State<'_, VaultState>,
) -> CmdResult<String> {
    with_vault(&state, |vault| {
        let project_obj = vault.open_project(&project)?;
        let full_path = resolve_inside(&project_obj.docs_dir(), &folder_path)?;
        std::fs::create_dir_all(&full_path)?;
        Ok(format!("Folder created: {}/{}", project, folder_path))
    })
}

#[tauri::command]
pub fn rebuild_index(
    state: State<'_, VaultState>,
) -> CmdResult<usize> {
    with_vault(&state, |vault| vault.rebuild_index())
}

#[tauri::command]
pub fn vault_stats(
    state: State<'_, VaultState>,
) -> CmdResult<slatevault_core::VaultStats> {
    with_vault(&state, |vault| vault.stats())
}
