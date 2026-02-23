use serde::Serialize;

/// Events sent from PTY sessions to the frontend via Tauri Channel
#[derive(Clone, Serialize)]
#[serde(tag = "type")]
pub enum PtyEvent {
    /// Base64-encoded terminal output
    Output { data: String },
    /// Process exited with a code
    Exit { code: i32 },
    /// Error occurred
    Error { message: String },
}
