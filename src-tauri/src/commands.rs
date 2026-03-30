use serde::Serialize;
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
        Ok(doc.content)
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
