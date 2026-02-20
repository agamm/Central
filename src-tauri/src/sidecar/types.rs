use serde::{Deserialize, Serialize};

/// Commands sent from Rust to the Node.js sidecar via stdin JSON-lines
#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
#[allow(dead_code)]
pub enum SidecarCommand {
    StartSession {
        #[serde(rename = "sessionId")]
        session_id: String,
        #[serde(rename = "projectPath")]
        project_path: String,
        prompt: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        model: Option<String>,
    },
    SendMessage {
        #[serde(rename = "sessionId")]
        session_id: String,
        message: String,
    },
    AbortSession {
        #[serde(rename = "sessionId")]
        session_id: String,
    },
    ListSessions,
}

/// Events received from the Node.js sidecar via stdout JSON-lines
#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum SidecarEvent {
    Ready {
        message: String,
    },
    SessionStarted {
        #[serde(rename = "sessionId")]
        session_id: String,
    },
    Message {
        #[serde(rename = "sessionId")]
        session_id: String,
        role: String,
        content: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        thinking: Option<String>,
        #[serde(rename = "toolCalls", skip_serializing_if = "Option::is_none")]
        tool_calls: Option<serde_json::Value>,
        #[serde(skip_serializing_if = "Option::is_none")]
        usage: Option<serde_json::Value>,
    },
    ToolUse {
        #[serde(rename = "sessionId")]
        session_id: String,
        #[serde(rename = "toolName")]
        tool_name: String,
        input: serde_json::Value,
    },
    ToolResult {
        #[serde(rename = "sessionId")]
        session_id: String,
        #[serde(rename = "toolName")]
        tool_name: String,
        output: String,
    },
    SessionCompleted {
        #[serde(rename = "sessionId")]
        session_id: String,
    },
    SessionFailed {
        #[serde(rename = "sessionId")]
        session_id: String,
        error: String,
    },
    Error {
        message: String,
    },
}

/// Payload emitted to the frontend via Tauri events
#[derive(Debug, Clone, Serialize)]
pub struct AgentEventPayload {
    pub event: SidecarEvent,
}
