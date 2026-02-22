use std::collections::HashMap;
use std::io::{BufRead, BufReader, Write};
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};

use tauri::{AppHandle, Emitter};

use super::types::{AgentEventPayload, SidecarCommand, SidecarEvent};
use crate::debug_log;

/// One worker process per agent session
struct SessionWorker {
    child: Child,
}

impl SessionWorker {
    /// Send a JSON-line command to this worker's stdin
    fn send(&mut self, json: &str) -> Result<(), String> {
        let stdin = self.child.stdin.as_mut().ok_or_else(|| {
            "Worker stdin not available".to_string()
        })?;

        stdin
            .write_all(format!("{json}\n").as_bytes())
            .map_err(|e| format!("Failed to write to worker stdin: {e}"))?;

        stdin
            .flush()
            .map_err(|e| format!("Failed to flush worker stdin: {e}"))?;

        Ok(())
    }

    /// Kill the worker process
    fn kill(&mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}

/// Manages per-session Node.js worker processes
pub struct SidecarManager {
    workers: HashMap<String, SessionWorker>,
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
            workers: HashMap::new(),
            app_handle,
        }
    }

    /// Spawn a new worker for this session and send the start_session command
    pub fn start_session(&mut self, command: &SidecarCommand) -> Result<(), String> {
        let session_id = match command {
            SidecarCommand::StartSession { session_id, .. } => session_id.clone(),
            _ => return Err("Expected StartSession command".to_string()),
        };

        if self.workers.contains_key(&session_id) {
            return Err(format!("Session {session_id} already has a running worker"));
        }

        let worker_path = resolve_worker_path()?;
        let sidecar_dir = std::path::Path::new(&worker_path)
            .parent()
            .and_then(|p| p.parent())
            .ok_or_else(|| "Cannot resolve sidecar directory".to_string())?;

        debug_log::log("SIDECAR", &format!("Spawning worker for session {session_id}"));
        debug_log::log("SIDECAR", &format!("Worker path: {worker_path}"));

        let ca_certs = resolve_ca_certs();

        let mut cmd = Command::new("node");
        cmd.arg("--import")
            .arg("tsx")
            .arg(&worker_path)
            .current_dir(sidecar_dir);

        // Ensure Node.js can verify TLS certs (macOS system bundle)
        // See https://github.com/anthropics/claude-code/issues/4053
        if let Some(ref certs) = ca_certs {
            cmd.env("NODE_EXTRA_CA_CERTS", certs);
        }

        let mut child = cmd
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| {
                let msg = format!("Failed to spawn worker for {session_id}: {e}");
                debug_log::log("SIDECAR", &msg);
                msg
            })?;

        let pid = child.id();
        debug_log::log("SIDECAR", &format!("Worker spawned for {session_id}, PID: {pid}"));

        // Start stdout reader thread
        if let Some(stdout) = child.stdout.take() {
            let app_handle = self.app_handle.clone();
            let sid = session_id.clone();
            std::thread::spawn(move || {
                debug_log::log("SIDECAR", &format!("[{sid}] stdout reader started"));
                read_worker_output(stdout, &app_handle, &sid);
                debug_log::log("SIDECAR", &format!("[{sid}] stdout reader ended"));
            });
        }

        // Start stderr reader thread
        if let Some(stderr) = child.stderr.take() {
            let sid = session_id.clone();
            std::thread::spawn(move || {
                let reader = BufReader::new(stderr);
                for line in reader.lines() {
                    match line {
                        Ok(l) if !l.trim().is_empty() => {
                            debug_log::log("SIDECAR-STDERR", &format!("[{sid}] {l}"));
                        }
                        Err(_) => break,
                        _ => {}
                    }
                }
            });
        }

        let mut worker = SessionWorker { child };

        // Send the start_session command
        let json = serde_json::to_string(command)
            .map_err(|e| format!("Failed to serialize command: {e}"))?;
        debug_log::log("SIDECAR-CMD", &format!("[{session_id}] {json}"));
        worker.send(&json)?;

        self.workers.insert(session_id, worker);
        Ok(())
    }

    /// Send a command to a specific session's worker (session ID extracted from command)
    pub fn send_command(&mut self, command: &SidecarCommand) -> Result<(), String> {
        let session_id = command_session_id(command)
            .ok_or_else(|| "Command has no session ID".to_string())?;

        self.send_to_session(&session_id, command)
    }

    /// Send a command to a specific session's worker by explicit session ID
    pub fn send_to_session(&mut self, session_id: &str, command: &SidecarCommand) -> Result<(), String> {
        let worker = self.workers.get_mut(session_id).ok_or_else(|| {
            let msg = format!("No worker found for session {session_id}");
            debug_log::log("SIDECAR", &msg);
            msg
        })?;

        let json = serde_json::to_string(command)
            .map_err(|e| format!("Failed to serialize command: {e}"))?;

        debug_log::log("SIDECAR-CMD", &format!("[{session_id}] {json}"));
        worker.send(&json)?;
        debug_log::log("SIDECAR", &format!("[{session_id}] command sent OK"));
        Ok(())
    }

    /// Remove a session's worker (kills the process)
    pub fn remove_session(&mut self, session_id: &str) {
        if let Some(mut worker) = self.workers.remove(session_id) {
            debug_log::log("SIDECAR", &format!("Killing worker for session {session_id}"));
            worker.kill();
        }
    }

    /// Get list of active session IDs
    pub fn active_session_ids(&self) -> Vec<String> {
        self.workers.keys().cloned().collect()
    }

    /// Kill all worker processes and clean up
    pub fn shutdown(&mut self) {
        debug_log::log("SIDECAR", &format!("Shutting down {} workers", self.workers.len()));
        for (sid, mut worker) in self.workers.drain() {
            debug_log::log("SIDECAR", &format!("Killing worker for session {sid}"));
            worker.kill();
        }
    }
}

impl Drop for SidecarManager {
    fn drop(&mut self) {
        self.shutdown();
    }
}

/// Extract session_id from a SidecarCommand
fn command_session_id(command: &SidecarCommand) -> Option<String> {
    match command {
        SidecarCommand::StartSession { session_id, .. } => Some(session_id.clone()),
        SidecarCommand::SendMessage { session_id, .. } => Some(session_id.clone()),
        SidecarCommand::AbortSession { session_id, .. } => Some(session_id.clone()),
        SidecarCommand::EndSession { session_id, .. } => Some(session_id.clone()),
        SidecarCommand::ToolApprovalResponse { .. } => None,
    }
}

/// Read JSON-line events from a worker's stdout and emit via Tauri events
fn read_worker_output(stdout: impl std::io::Read, app_handle: &AppHandle, session_id: &str) {
    let reader = BufReader::new(stdout);

    for line in reader.lines() {
        let line = match line {
            Ok(l) => l,
            Err(e) => {
                debug_log::log("SIDECAR", &format!("[{session_id}] stdout read error: {e}"));
                break;
            }
        };

        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }

        debug_log::log("SIDECAR-STDOUT", &format!("[{session_id}] {trimmed}"));

        match serde_json::from_str::<SidecarEvent>(trimmed) {
            Ok(event) => {
                let payload = AgentEventPayload { event };
                match app_handle.emit("agent-event", &payload) {
                    Ok(_) => debug_log::log("SIDECAR", &format!("[{session_id}] event emitted OK")),
                    Err(e) => debug_log::log("SIDECAR", &format!("[{session_id}] EMIT ERROR: {e}")),
                }
            }
            Err(e) => {
                debug_log::log("SIDECAR", &format!("[{session_id}] PARSE ERROR: {e} — {trimmed}"));
            }
        }
    }
}

/// Resolve the CA certificate bundle path for Node.js TLS.
/// Checks the user's env first, then falls back to well-known system paths.
fn resolve_ca_certs() -> Option<String> {
    // Respect user's explicit setting
    if let Ok(val) = std::env::var("NODE_EXTRA_CA_CERTS") {
        if !val.is_empty() {
            return Some(val);
        }
    }

    // macOS system bundle, then common Linux paths
    let candidates = [
        "/etc/ssl/cert.pem",
        "/etc/ssl/certs/ca-certificates.crt",
        "/etc/pki/tls/certs/ca-bundle.crt",
    ];
    for path in &candidates {
        if std::path::Path::new(path).exists() {
            return Some(path.to_string());
        }
    }
    None
}

/// Resolve the path to the session-worker entry script
fn resolve_worker_path() -> Result<String, String> {
    // In development: project_root/sidecar/src/session-worker.ts
    // Rust CWD is src-tauri/, so parent is project_root
    let dev_path = std::env::current_dir()
        .map_err(|e| e.to_string())?
        .parent()
        .map(|p| p.join("sidecar").join("src").join("session-worker.ts"))
        .ok_or_else(|| "Cannot resolve parent directory".to_string())?;

    if dev_path.exists() {
        return dev_path
            .to_str()
            .map(|s| s.to_string())
            .ok_or_else(|| "Invalid path encoding".to_string());
    }

    // Fallback: relative to executable
    let exe_dir = std::env::current_exe()
        .map_err(|e| e.to_string())?
        .parent()
        .map(|p| p.join("sidecar").join("src").join("session-worker.ts"))
        .ok_or_else(|| "Cannot resolve exe directory".to_string())?;

    if exe_dir.exists() {
        return exe_dir
            .to_str()
            .map(|s| s.to_string())
            .ok_or_else(|| "Invalid path encoding".to_string());
    }

    Err(format!(
        "Worker not found at {:?} or {:?}",
        dev_path, exe_dir
    ))
}
