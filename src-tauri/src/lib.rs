mod commands;

use commands::VaultState;
use std::sync::Mutex;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(VaultState(Mutex::new(None)))
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
