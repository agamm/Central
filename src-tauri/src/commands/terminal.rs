use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::{Arc, Mutex};
use std::thread;

use portable_pty::{native_pty_system, CommandBuilder, MasterPty, PtySize};
use serde::Serialize;
use tauri::{AppHandle, Emitter, State};

/// Payload emitted to the frontend when PTY produces output
#[derive(Clone, Serialize)]
pub struct PtyOutput {
    pub pty_id: String,
    pub data: String,
}

/// Payload emitted when a PTY process exits
#[derive(Clone, Serialize)]
pub struct PtyExit {
    pub pty_id: String,
    pub code: Option<i32>,
}

/// A single PTY session: master handle + writer
struct PtySession {
    master: Box<dyn MasterPty + Send>,
    writer: Box<dyn Write + Send>,
}

/// Shared PTY state managed by Tauri
pub struct PtyState {
    sessions: HashMap<String, PtySession>,
}

/// Thread-safe handle for PTY state
pub type PtyHandle = Arc<Mutex<PtyState>>;

pub fn create_pty_handle() -> PtyHandle {
    Arc::new(Mutex::new(PtyState {
        sessions: HashMap::new(),
    }))
}

/// Spawn a new PTY shell for a project directory
#[tauri::command]
pub async fn pty_spawn(
    app: AppHandle,
    state: State<'_, PtyHandle>,
    pty_id: String,
    cwd: String,
    rows: u16,
    cols: u16,
) -> Result<(), String> {
    let pty_system = native_pty_system();

    let size = PtySize {
        rows,
        cols,
        pixel_width: 0,
        pixel_height: 0,
    };

    let pair = pty_system
        .openpty(size)
        .map_err(|e| format!("Failed to open PTY: {e}"))?;

    let mut cmd = CommandBuilder::new_default_prog();
    cmd.cwd(&cwd);
    // Ensure TERM is set for color support
    cmd.env("TERM", "xterm-256color");

    let child = pair
        .slave
        .spawn_command(cmd)
        .map_err(|e| format!("Failed to spawn shell: {e}"))?;

    let reader = pair
        .master
        .try_clone_reader()
        .map_err(|e| format!("Failed to clone PTY reader: {e}"))?;

    let writer = pair
        .master
        .take_writer()
        .map_err(|e| format!("Failed to take PTY writer: {e}"))?;

    let session = PtySession {
        master: pair.master,
        writer,
    };

    {
        let mut guard = state
            .lock()
            .map_err(|e| format!("Failed to lock PTY state: {e}"))?;
        guard.sessions.insert(pty_id.clone(), session);
    }

    spawn_reader_thread(app.clone(), pty_id.clone(), reader);
    spawn_waiter_thread(app, pty_id, child, state.inner().clone());

    Ok(())
}

/// Write user input to the PTY
#[tauri::command]
pub async fn pty_write(
    state: State<'_, PtyHandle>,
    pty_id: String,
    data: String,
) -> Result<(), String> {
    let mut guard = state
        .lock()
        .map_err(|e| format!("Failed to lock PTY state: {e}"))?;

    let session = guard
        .sessions
        .get_mut(&pty_id)
        .ok_or_else(|| format!("PTY not found: {pty_id}"))?;

    session
        .writer
        .write_all(data.as_bytes())
        .map_err(|e| format!("Failed to write to PTY: {e}"))?;

    session
        .writer
        .flush()
        .map_err(|e| format!("Failed to flush PTY: {e}"))?;

    Ok(())
}

/// Resize the PTY
#[tauri::command]
pub async fn pty_resize(
    state: State<'_, PtyHandle>,
    pty_id: String,
    rows: u16,
    cols: u16,
) -> Result<(), String> {
    let guard = state
        .lock()
        .map_err(|e| format!("Failed to lock PTY state: {e}"))?;

    let session = guard
        .sessions
        .get(&pty_id)
        .ok_or_else(|| format!("PTY not found: {pty_id}"))?;

    session
        .master
        .resize(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| format!("Failed to resize PTY: {e}"))?;

    Ok(())
}

/// Kill and clean up a PTY session
#[tauri::command]
pub async fn pty_kill(
    state: State<'_, PtyHandle>,
    pty_id: String,
) -> Result<(), String> {
    let mut guard = state
        .lock()
        .map_err(|e| format!("Failed to lock PTY state: {e}"))?;

    // Dropping the session closes master + writer, which kills the child
    guard.sessions.remove(&pty_id);

    Ok(())
}

/// Kill all PTY sessions — called on app shutdown to prevent orphans
pub fn shutdown_all_ptys(state: &PtyHandle) {
    if let Ok(mut guard) = state.lock() {
        let ids: Vec<String> = guard.sessions.keys().cloned().collect();
        for id in ids {
            // Dropping closes master + writer, killing the child process
            guard.sessions.remove(&id);
        }
    }
}

/// Background thread that reads PTY output and emits events
fn spawn_reader_thread(
    app: AppHandle,
    pty_id: String,
    mut reader: Box<dyn Read + Send>,
) {
    thread::spawn(move || {
        let mut buf = [0u8; 4096];
        loop {
            match reader.read(&mut buf) {
                Ok(0) => break,
                Ok(n) => {
                    let text = String::from_utf8_lossy(&buf[..n]).to_string();
                    let payload = PtyOutput {
                        pty_id: pty_id.clone(),
                        data: text,
                    };
                    let _ = app.emit("pty-output", &payload);
                }
                Err(_) => break,
            }
        }
    });
}

/// Background thread that waits for PTY child exit and emits event
fn spawn_waiter_thread(
    app: AppHandle,
    pty_id: String,
    mut child: Box<dyn portable_pty::Child + Send + Sync>,
    state: PtyHandle,
) {
    thread::spawn(move || {
        let status = child.wait();
        let code = status.ok().map(|s| s.exit_code() as i32);

        let _ = app.emit("pty-exit", &PtyExit {
            pty_id: pty_id.clone(),
            code,
        });

        // Clean up session on exit
        if let Ok(mut guard) = state.lock() {
            guard.sessions.remove(&pty_id);
        }
    });
}
