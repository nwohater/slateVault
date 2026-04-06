use serde::{Deserialize, Serialize};
use slatevault_core::Vault;
use slatevault_core::credentials::{Credentials, CredentialsMasked};
use slatevault_core::pr::{self, PrCreateRequest, PrCreateResponse};
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
                let file_path = project_obj.docs_dir().join(&path);
                std::fs::write(&file_path, doc.to_string()?)?;
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
            mcp_enabled: vault.config.mcp.enabled,
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
    pub mcp_enabled: Option<bool>,
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
    if let Some(v) = args.mcp_enabled {
        vault.config.mcp.enabled = v;
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

#[tauri::command]
pub fn show_in_folder(
    project: String,
    path: Option<String>,
    state: State<'_, VaultState>,
) -> CmdResult<()> {
    with_vault(&state, |vault| {
        let full_path = match &path {
            Some(doc_path) => {
                let project_obj = vault.open_project(&project)?;
                project_obj.docs_dir().join(doc_path)
            }
            None => vault.projects_dir().join(&project),
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
        let file_path = project_obj.docs_dir().join(&path);
        std::fs::remove_file(&file_path)?;
        Ok(format!("Deleted: {}/{}", project, path))
    })
}

#[tauri::command]
pub fn delete_project(
    name: String,
    state: State<'_, VaultState>,
) -> CmdResult<String> {
    with_vault(&state, |vault| {
        let project_path = vault.projects_dir().join(&name);
        std::fs::remove_dir_all(&project_path)?;
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
        let new_full = docs_dir.join(&new_path);
        // Ensure target directory exists
        if let Some(parent) = new_full.parent() {
            std::fs::create_dir_all(parent)?;
        }
        std::fs::rename(docs_dir.join(&old_path), &new_full)?;
        // Stage both old (delete) and new (add) paths for git
        let old_repo_path = vault.projects_dir().join(&project).join("docs").join(&old_path);
        let new_repo_path = vault.projects_dir().join(&project).join("docs").join(&new_path);
        let _ = vault.stage_file(&old_repo_path);
        let _ = vault.stage_file(&new_repo_path);
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
        let projects_dir = vault.projects_dir();
        let new_path = projects_dir.join(&new_name);
        if new_path.exists() {
            return Err(slatevault_core::CoreError::ProjectAlreadyExists(new_name.clone()));
        }
        std::fs::rename(projects_dir.join(&old_name), &new_path)?;
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
        let full = vault.root.join(&path);
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
        let full = vault.root.join(&path);
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
        let full_path = project_obj.docs_dir().join(&folder_path);
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
        let full_path = project_obj.docs_dir().join(&folder_path);
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
