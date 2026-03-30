mod commands;
mod terminal;

use commands::VaultState;
use terminal::PtyState;
use std::sync::Mutex;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(VaultState(Mutex::new(None)))
        .manage(PtyState::new())
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
            commands::git_push,
            commands::git_pull,
            commands::get_vault_config,
            commands::set_vault_config,
            commands::rebuild_index,
            commands::vault_stats,
            terminal::spawn_terminal,
            terminal::write_terminal,
            terminal::resize_terminal,
            terminal::close_terminal,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
