use tauri::State;
use uuid::Uuid;

use crate::sidecar::{SidecarCommand, SidecarHandle};

/// Start a new agent session for a project
#[tauri::command]
pub async fn start_agent_session(
    sidecar: State<'_, SidecarHandle>,
    project_path: String,
    prompt: String,
    model: Option<String>,
) -> Result<String, String> {
    let session_id = Uuid::new_v4().to_string();

    let command = SidecarCommand::StartSession {
        session_id: session_id.clone(),
        project_path,
        prompt,
        model,
    };

    let mut manager = sidecar
        .lock()
        .map_err(|e| format!("Failed to lock sidecar: {e}"))?;

    manager.register_session(&session_id);
    manager.send_command(&command)?;

    Ok(session_id)
}

/// Send a follow-up message to an existing session
#[tauri::command]
pub async fn send_agent_message(
    sidecar: State<'_, SidecarHandle>,
    session_id: String,
    message: String,
) -> Result<(), String> {
    let command = SidecarCommand::SendMessage {
        session_id,
        message,
    };

    let mut manager = sidecar
        .lock()
        .map_err(|e| format!("Failed to lock sidecar: {e}"))?;

    manager.send_command(&command)
}

/// Abort a running agent session
#[tauri::command]
pub async fn abort_agent_session(
    sidecar: State<'_, SidecarHandle>,
    session_id: String,
) -> Result<(), String> {
    let command = SidecarCommand::AbortSession {
        session_id: session_id.clone(),
    };

    let mut manager = sidecar
        .lock()
        .map_err(|e| format!("Failed to lock sidecar: {e}"))?;

    manager.send_command(&command)?;
    manager.unregister_session(&session_id);

    Ok(())
}

/// List currently active sessions tracked by the sidecar
#[tauri::command]
pub async fn list_agent_sessions(
    sidecar: State<'_, SidecarHandle>,
) -> Result<Vec<String>, String> {
    let manager = sidecar
        .lock()
        .map_err(|e| format!("Failed to lock sidecar: {e}"))?;

    Ok(manager.active_session_ids())
}
