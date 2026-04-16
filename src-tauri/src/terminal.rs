use portable_pty::{native_pty_system, CommandBuilder, MasterPty, PtySize};
use serde::Serialize;
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, State};

struct PtySession {
    master: Box<dyn MasterPty + Send>,
    writer: Box<dyn Write + Send>,
    child: Box<dyn portable_pty::Child + Send>,
}

pub struct PtyState(Arc<Mutex<HashMap<String, PtySession>>>);

#[derive(Clone, Serialize)]
struct TerminalOutput {
    terminal_id: String,
    data: String,
}

impl PtyState {
    pub fn new() -> Self {
        Self(Arc::new(Mutex::new(HashMap::new())))
    }
}

#[tauri::command]
pub fn spawn_terminal(
    terminal_id: String,
    cwd: String,
    app: AppHandle,
    state: State<'_, PtyState>,
) -> Result<String, String> {
    let mut lock = state.0.lock().map_err(|e| e.to_string())?;

    if let Some(mut session) = lock.remove(&terminal_id) {
        let _ = session.child.kill();
    }

    let pty_system = native_pty_system();

    let pair = pty_system
        .openpty(PtySize {
            rows: 24,
            cols: 80,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| format!("Failed to open PTY: {}", e))?;

    #[cfg(windows)]
    let shell = std::env::var("COMSPEC").unwrap_or_else(|_| "cmd.exe".to_string());
    #[cfg(not(windows))]
    let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/sh".to_string());

    let mut cmd = CommandBuilder::new(&shell);
    cmd.cwd(&cwd);

    let child = pair
        .slave
        .spawn_command(cmd)
        .map_err(|e| format!("Failed to spawn shell: {}", e))?;

    let writer = pair
        .master
        .take_writer()
        .map_err(|e| format!("Failed to get PTY writer: {}", e))?;

    let mut reader = pair
        .master
        .try_clone_reader()
        .map_err(|e| format!("Failed to clone PTY reader: {}", e))?;

    let app_handle = app.clone();
    let output_id = terminal_id.clone();
    std::thread::spawn(move || {
        let mut buf = [0u8; 4096];
        loop {
            match reader.read(&mut buf) {
                Ok(0) => break,
                Ok(n) => {
                    let data = String::from_utf8_lossy(&buf[..n]).to_string();
                    let _ = app_handle.emit(
                        "terminal:output",
                        TerminalOutput {
                            terminal_id: output_id.clone(),
                            data,
                        },
                    );
                }
                Err(_) => break,
            }
        }
    });

    lock.insert(
        terminal_id.clone(),
        PtySession {
            master: pair.master,
            writer,
            child,
        },
    );

    Ok(terminal_id)
}

#[tauri::command]
pub fn write_terminal(
    terminal_id: String,
    data: String,
    state: State<'_, PtyState>,
) -> Result<(), String> {
    let mut lock = state.0.lock().map_err(|e| e.to_string())?;
    let session = lock
        .get_mut(&terminal_id)
        .ok_or_else(|| format!("No terminal session: {}", terminal_id))?;
    session
        .writer
        .write_all(data.as_bytes())
        .map_err(|e| format!("Write failed: {}", e))?;
    session
        .writer
        .flush()
        .map_err(|e| format!("Flush failed: {}", e))?;
    Ok(())
}

#[tauri::command]
pub fn resize_terminal(
    terminal_id: String,
    rows: u16,
    cols: u16,
    state: State<'_, PtyState>,
) -> Result<(), String> {
    let lock = state.0.lock().map_err(|e| e.to_string())?;
    let session = lock
        .get(&terminal_id)
        .ok_or_else(|| format!("No terminal session: {}", terminal_id))?;
    session
        .master
        .resize(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| format!("Resize failed: {}", e))?;
    Ok(())
}

#[tauri::command]
pub fn close_terminal(
    terminal_id: String,
    state: State<'_, PtyState>,
) -> Result<String, String> {
    let mut lock = state.0.lock().map_err(|e| e.to_string())?;
    if let Some(mut session) = lock.remove(&terminal_id) {
        let _ = session.child.kill();
        Ok(format!("Terminal closed: {}", terminal_id))
    } else {
        Ok(format!("No terminal to close: {}", terminal_id))
    }
}
