use std::collections::HashSet;
use std::io::{BufRead, BufReader, Write};
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};

use tauri::{AppHandle, Emitter};

use super::types::{AgentEventPayload, SidecarCommand, SidecarEvent};

/// Manages the Node.js sidecar process lifecycle
pub struct SidecarManager {
    child: Option<Child>,
    active_sessions: HashSet<String>,
    app_handle: AppHandle,
}

/// Thread-safe handle to the sidecar manager
pub type SidecarHandle = Arc<Mutex<SidecarManager>>;

/// Create a new sidecar handle managed by Tauri state
pub fn create_sidecar_handle(app_handle: AppHandle) -> SidecarHandle {
    Arc::new(Mutex::new(SidecarManager::new(app_handle)))
}

impl SidecarManager {
    fn new(app_handle: AppHandle) -> Self {
        Self {
            child: None,
            active_sessions: HashSet::new(),
            app_handle,
        }
    }

    /// Spawn the Node.js sidecar if not already running
    pub fn ensure_running(&mut self) -> Result<(), String> {
        if self.is_running() {
            return Ok(());
        }
        self.spawn()
    }

    /// Check if the sidecar process is alive
    fn is_running(&mut self) -> bool {
        if let Some(ref mut child) = self.child {
            // try_wait returns None if still running
            matches!(child.try_wait(), Ok(None))
        } else {
            false
        }
    }

    /// Spawn the sidecar process
    fn spawn(&mut self) -> Result<(), String> {
        let sidecar_path = resolve_sidecar_path()
            .map_err(|e| format!("Failed to resolve sidecar path: {e}"))?;

        let child = Command::new("node")
            .arg("--import")
            .arg("tsx")
            .arg(&sidecar_path)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| format!("Failed to spawn sidecar: {e}"))?;

        self.child = Some(child);
        self.start_reader_thread();
        Ok(())
    }

    /// Start a background thread to read stdout events from the sidecar
    fn start_reader_thread(&mut self) {
        let stdout = self
            .child
            .as_mut()
            .and_then(|c| c.stdout.take());

        let Some(stdout) = stdout else {
            return;
        };

        let app_handle = self.app_handle.clone();

        std::thread::spawn(move || {
            read_sidecar_output(stdout, &app_handle);
        });
    }

    /// Send a command to the sidecar via stdin
    pub fn send_command(&mut self, command: &SidecarCommand) -> Result<(), String> {
        self.ensure_running()?;

        let stdin = self
            .child
            .as_mut()
            .and_then(|c| c.stdin.as_mut())
            .ok_or_else(|| "Sidecar stdin not available".to_string())?;

        let json = serde_json::to_string(command)
            .map_err(|e| format!("Failed to serialize command: {e}"))?;

        stdin
            .write_all(format!("{json}\n").as_bytes())
            .map_err(|e| format!("Failed to write to sidecar stdin: {e}"))?;

        stdin
            .flush()
            .map_err(|e| format!("Failed to flush sidecar stdin: {e}"))?;

        Ok(())
    }

    /// Track a session as active
    pub fn register_session(&mut self, session_id: &str) {
        self.active_sessions.insert(session_id.to_string());
    }

    /// Remove a session from active tracking
    pub fn unregister_session(&mut self, session_id: &str) {
        self.active_sessions.remove(session_id);
    }

    /// Get list of active session IDs
    pub fn active_session_ids(&self) -> Vec<String> {
        self.active_sessions.iter().cloned().collect()
    }

    /// Kill the sidecar process and clean up
    pub fn shutdown(&mut self) {
        if let Some(ref mut child) = self.child {
            let _ = child.kill();
            let _ = child.wait();
        }
        self.child = None;
        self.active_sessions.clear();
    }
}

impl Drop for SidecarManager {
    fn drop(&mut self) {
        self.shutdown();
    }
}

/// Read JSON-line events from sidecar stdout and emit via Tauri events
fn read_sidecar_output(stdout: impl std::io::Read, app_handle: &AppHandle) {
    let reader = BufReader::new(stdout);

    for line in reader.lines() {
        let line = match line {
            Ok(l) => l,
            Err(_) => break,
        };

        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }

        match serde_json::from_str::<SidecarEvent>(trimmed) {
            Ok(event) => {
                let payload = AgentEventPayload { event };
                let _ = app_handle.emit("agent-event", &payload);
            }
            Err(e) => {
                eprintln!("Failed to parse sidecar event: {e} — line: {trimmed}");
            }
        }
    }
}

/// Resolve the path to the sidecar entry script
fn resolve_sidecar_path() -> Result<String, String> {
    // In development, the sidecar is at project_root/sidecar/src/index.ts
    // In production, it would be compiled and bundled
    let dev_path = std::env::current_dir()
        .map_err(|e| e.to_string())?
        .parent()
        .map(|p| p.join("sidecar").join("src").join("index.ts"))
        .ok_or_else(|| "Cannot resolve parent directory".to_string())?;

    if dev_path.exists() {
        return dev_path
            .to_str()
            .map(|s| s.to_string())
            .ok_or_else(|| "Invalid path encoding".to_string());
    }

    // Fallback: try relative to executable
    let exe_dir = std::env::current_exe()
        .map_err(|e| e.to_string())?
        .parent()
        .map(|p| p.join("sidecar").join("src").join("index.ts"))
        .ok_or_else(|| "Cannot resolve exe directory".to_string())?;

    if exe_dir.exists() {
        return exe_dir
            .to_str()
            .map(|s| s.to_string())
            .ok_or_else(|| "Invalid path encoding".to_string());
    }

    Err(format!(
        "Sidecar not found at {:?} or {:?}",
        dev_path, exe_dir
    ))
}
