mod commands;
mod mcp_manager;
mod terminal;

use commands::VaultState;
use mcp_manager::McpProcessState;
use terminal::PtyState;
use std::sync::Mutex;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(VaultState(Mutex::new(None)))
        .manage(PtyState::new())
        .manage(McpProcessState::new())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::create_vault,
            commands::open_vault,
            commands::create_project,
            commands::list_projects,
            commands::write_document,
            commands::read_document,
            commands::list_documents,
            commands::search_documents,
            commands::get_project_context,
            commands::git_commit,
            commands::git_status,
            commands::git_stage,
            commands::git_unstage,
            commands::git_log,
            commands::git_remote_config,
            commands::git_set_remote_config,
            commands::git_clone,
            commands::git_push,
            commands::git_pull,
            commands::get_vault_config,
            commands::set_vault_config,
            commands::show_in_folder,
            commands::delete_document,
            commands::delete_project,
            commands::rename_document,
            commands::rename_project,
            commands::rebuild_index,
            commands::vault_stats,
            terminal::spawn_terminal,
            terminal::write_terminal,
            terminal::resize_terminal,
            terminal::close_terminal,
            mcp_manager::start_mcp_server,
            mcp_manager::stop_mcp_server,
            mcp_manager::mcp_server_status,
        ])
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                // Push on close if configured
                let state = window.state::<VaultState>();
                if let Ok(guard) = state.0.lock() {
                    if let Some(ref vault) = *guard {
                        if vault.config.sync.push_on_close && vault.config.sync.remote_url.is_some() {
                            let branch = &vault.config.sync.remote_branch;
                            let root = vault.root.to_string_lossy().to_string();
                            let _ = std::process::Command::new("git")
                                .args(["-C", &root, "push", "origin", branch])
                                .output();
                        }
                    }
                }
                // Stop MCP server
                window.state::<McpProcessState>().stop();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
