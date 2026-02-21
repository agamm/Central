use tauri::State;

use crate::debug_log;
use crate::sidecar::{SidecarCommand, SidecarHandle};

/// Start a new agent session for a project
#[tauri::command]
pub async fn start_agent_session(
    sidecar: State<'_, SidecarHandle>,
    session_id: String,
    project_path: String,
    prompt: String,
    model: Option<String>,
    resume_session_id: Option<String>,
) -> Result<String, String> {
    debug_log::log("RUST-CMD", &format!("start_agent_session: sid={session_id}, path={project_path}, resume={}, prompt={}", resume_session_id.as_deref().unwrap_or("none"), &prompt[..prompt.len().min(50)]));

    let command = SidecarCommand::StartSession {
        session_id: session_id.clone(),
        project_path,
        prompt,
        model,
        max_budget_usd: None,
        resume_session_id,
    };

    let mut manager = sidecar
        .lock()
        .map_err(|e| {
            let msg = format!("Failed to lock sidecar: {e}");
            debug_log::log("RUST-CMD", &msg);
            msg
        })?;

    manager.start_session(&command)?;

    debug_log::log("RUST-CMD", &format!("start_agent_session: worker spawned for sid={session_id}"));
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

    let _ = manager.send_command(&command);
    manager.remove_session(&session_id);

    Ok(())
}

/// Gracefully end a session (close follow-up queue, worker exits)
#[tauri::command]
pub async fn end_agent_session(
    sidecar: State<'_, SidecarHandle>,
    session_id: String,
) -> Result<(), String> {
    let command = SidecarCommand::EndSession {
        session_id: session_id.clone(),
    };

    let mut manager = sidecar
        .lock()
        .map_err(|e| format!("Failed to lock sidecar: {e}"))?;

    let _ = manager.send_command(&command);
    // Worker will exit on its own after queue closes
    manager.remove_session(&session_id);

    Ok(())
}

/// Respond to a tool approval request from a session worker
#[tauri::command]
pub async fn respond_tool_approval(
    sidecar: State<'_, SidecarHandle>,
    session_id: String,
    request_id: String,
    allowed: bool,
    updated_permissions: Option<serde_json::Value>,
) -> Result<(), String> {
    debug_log::log("RUST-CMD", &format!("respond_tool_approval: sid={session_id}, req={request_id}, allowed={allowed}"));

    let command = SidecarCommand::ToolApprovalResponse {
        request_id,
        allowed,
        updated_permissions,
    };

    let mut manager = sidecar
        .lock()
        .map_err(|e| format!("Failed to lock sidecar: {e}"))?;

    manager.send_to_session(&session_id, &command)
}

/// List currently active sessions tracked by the manager
#[tauri::command]
pub async fn list_agent_sessions(
    sidecar: State<'_, SidecarHandle>,
) -> Result<Vec<String>, String> {
    let manager = sidecar
        .lock()
        .map_err(|e| format!("Failed to lock sidecar: {e}"))?;

    Ok(manager.active_session_ids())
}
