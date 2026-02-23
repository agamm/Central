use tauri::ipc::Channel;
use tauri::State;

use crate::pty::{PtyEvent, PtyHandle};

#[tauri::command]
pub fn start_terminal(
    session_id: String,
    cwd: String,
    rows: u16,
    cols: u16,
    on_event: Channel<PtyEvent>,
    pty: State<'_, PtyHandle>,
) -> Result<(), String> {
    let mut manager = pty
        .lock()
        .map_err(|e| format!("PTY lock error: {e}"))?;

    manager.start_terminal(session_id, cwd, rows, cols, on_event)
}

#[tauri::command]
pub fn write_terminal_input(
    session_id: String,
    data: String,
    pty: State<'_, PtyHandle>,
) -> Result<(), String> {
    let mut manager = pty
        .lock()
        .map_err(|e| format!("PTY lock error: {e}"))?;

    manager.write_input(&session_id, &data)
}

#[tauri::command]
pub fn resize_terminal(
    session_id: String,
    rows: u16,
    cols: u16,
    pty: State<'_, PtyHandle>,
) -> Result<(), String> {
    let mut manager = pty
        .lock()
        .map_err(|e| format!("PTY lock error: {e}"))?;

    manager.resize(&session_id, rows, cols)
}

#[tauri::command]
pub fn close_terminal(
    session_id: String,
    pty: State<'_, PtyHandle>,
) -> Result<(), String> {
    let mut manager = pty
        .lock()
        .map_err(|e| format!("PTY lock error: {e}"))?;

    manager.close(&session_id);
    Ok(())
}
