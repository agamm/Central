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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn serialize_start_session_command() {
        let cmd = SidecarCommand::StartSession {
            session_id: "s1".to_string(),
            project_path: "/tmp/project".to_string(),
            prompt: "Write tests".to_string(),
            model: Some("claude-opus-4".to_string()),
        };

        let json = serde_json::to_string(&cmd).unwrap();
        assert!(json.contains("\"type\":\"start_session\""));
        assert!(json.contains("\"sessionId\":\"s1\""));
        assert!(json.contains("\"projectPath\":\"/tmp/project\""));
        assert!(json.contains("\"prompt\":\"Write tests\""));
        assert!(json.contains("\"model\":\"claude-opus-4\""));
    }

    #[test]
    fn serialize_start_session_without_model() {
        let cmd = SidecarCommand::StartSession {
            session_id: "s1".to_string(),
            project_path: "/tmp".to_string(),
            prompt: "test".to_string(),
            model: None,
        };

        let json = serde_json::to_string(&cmd).unwrap();
        // model should be skipped when None
        assert!(!json.contains("\"model\""));
    }

    #[test]
    fn serialize_send_message_command() {
        let cmd = SidecarCommand::SendMessage {
            session_id: "s1".to_string(),
            message: "Follow up".to_string(),
        };

        let json = serde_json::to_string(&cmd).unwrap();
        assert!(json.contains("\"type\":\"send_message\""));
        assert!(json.contains("\"sessionId\":\"s1\""));
        assert!(json.contains("\"message\":\"Follow up\""));
    }

    #[test]
    fn serialize_abort_session_command() {
        let cmd = SidecarCommand::AbortSession {
            session_id: "s2".to_string(),
        };

        let json = serde_json::to_string(&cmd).unwrap();
        assert!(json.contains("\"type\":\"abort_session\""));
        assert!(json.contains("\"sessionId\":\"s2\""));
    }

    #[test]
    fn serialize_list_sessions_command() {
        let cmd = SidecarCommand::ListSessions;
        let json = serde_json::to_string(&cmd).unwrap();
        assert!(json.contains("\"type\":\"list_sessions\""));
    }

    #[test]
    fn deserialize_ready_event() {
        let json = r#"{"type":"ready","message":"Sidecar started"}"#;
        let event: SidecarEvent = serde_json::from_str(json).unwrap();
        match event {
            SidecarEvent::Ready { message } => {
                assert_eq!(message, "Sidecar started");
            }
            _ => panic!("Expected Ready event"),
        }
    }

    #[test]
    fn deserialize_session_started_event() {
        let json = r#"{"type":"session_started","sessionId":"s1"}"#;
        let event: SidecarEvent = serde_json::from_str(json).unwrap();
        match event {
            SidecarEvent::SessionStarted { session_id } => {
                assert_eq!(session_id, "s1");
            }
            _ => panic!("Expected SessionStarted event"),
        }
    }

    #[test]
    fn deserialize_message_event_full() {
        let json = r#"{
            "type":"message",
            "sessionId":"s1",
            "role":"assistant",
            "content":"Hello",
            "thinking":"Let me think...",
            "toolCalls":[{"name":"write"}],
            "usage":{"input_tokens":100}
        }"#;
        let event: SidecarEvent = serde_json::from_str(json).unwrap();
        match event {
            SidecarEvent::Message {
                session_id,
                role,
                content,
                thinking,
                tool_calls,
                usage,
            } => {
                assert_eq!(session_id, "s1");
                assert_eq!(role, "assistant");
                assert_eq!(content, "Hello");
                assert_eq!(thinking.unwrap(), "Let me think...");
                assert!(tool_calls.is_some());
                assert!(usage.is_some());
            }
            _ => panic!("Expected Message event"),
        }
    }

    #[test]
    fn deserialize_message_event_minimal() {
        let json = r#"{
            "type":"message",
            "sessionId":"s1",
            "role":"assistant",
            "content":"Hi"
        }"#;
        let event: SidecarEvent = serde_json::from_str(json).unwrap();
        match event {
            SidecarEvent::Message {
                thinking,
                tool_calls,
                usage,
                ..
            } => {
                assert!(thinking.is_none());
                assert!(tool_calls.is_none());
                assert!(usage.is_none());
            }
            _ => panic!("Expected Message event"),
        }
    }

    #[test]
    fn deserialize_tool_use_event() {
        let json = r#"{
            "type":"tool_use",
            "sessionId":"s1",
            "toolName":"write_file",
            "input":{"path":"test.rs","content":"fn main() {}"}
        }"#;
        let event: SidecarEvent = serde_json::from_str(json).unwrap();
        match event {
            SidecarEvent::ToolUse {
                session_id,
                tool_name,
                input,
            } => {
                assert_eq!(session_id, "s1");
                assert_eq!(tool_name, "write_file");
                assert_eq!(input["path"], "test.rs");
            }
            _ => panic!("Expected ToolUse event"),
        }
    }

    #[test]
    fn deserialize_tool_result_event() {
        let json = r#"{
            "type":"tool_result",
            "sessionId":"s1",
            "toolName":"write_file",
            "output":"File written successfully"
        }"#;
        let event: SidecarEvent = serde_json::from_str(json).unwrap();
        match event {
            SidecarEvent::ToolResult {
                tool_name, output, ..
            } => {
                assert_eq!(tool_name, "write_file");
                assert_eq!(output, "File written successfully");
            }
            _ => panic!("Expected ToolResult event"),
        }
    }

    #[test]
    fn deserialize_session_completed_event() {
        let json = r#"{"type":"session_completed","sessionId":"s1"}"#;
        let event: SidecarEvent = serde_json::from_str(json).unwrap();
        match event {
            SidecarEvent::SessionCompleted { session_id } => {
                assert_eq!(session_id, "s1");
            }
            _ => panic!("Expected SessionCompleted event"),
        }
    }

    #[test]
    fn deserialize_session_failed_event() {
        let json = r#"{"type":"session_failed","sessionId":"s1","error":"timeout"}"#;
        let event: SidecarEvent = serde_json::from_str(json).unwrap();
        match event {
            SidecarEvent::SessionFailed { session_id, error } => {
                assert_eq!(session_id, "s1");
                assert_eq!(error, "timeout");
            }
            _ => panic!("Expected SessionFailed event"),
        }
    }

    #[test]
    fn deserialize_error_event() {
        let json = r#"{"type":"error","message":"SDK unavailable"}"#;
        let event: SidecarEvent = serde_json::from_str(json).unwrap();
        match event {
            SidecarEvent::Error { message } => {
                assert_eq!(message, "SDK unavailable");
            }
            _ => panic!("Expected Error event"),
        }
    }

    #[test]
    fn serialize_agent_event_payload() {
        let payload = AgentEventPayload {
            event: SidecarEvent::Ready {
                message: "ok".to_string(),
            },
        };
        let json = serde_json::to_string(&payload).unwrap();
        assert!(json.contains("\"event\""));
        assert!(json.contains("\"type\":\"ready\""));
    }

    #[test]
    fn roundtrip_message_event_serialization() {
        let event = SidecarEvent::Message {
            session_id: "s1".to_string(),
            role: "assistant".to_string(),
            content: "Hello world".to_string(),
            thinking: Some("Thinking...".to_string()),
            tool_calls: None,
            usage: None,
        };

        let json = serde_json::to_string(&event).unwrap();
        let deserialized: SidecarEvent = serde_json::from_str(&json).unwrap();

        match deserialized {
            SidecarEvent::Message {
                session_id,
                content,
                thinking,
                ..
            } => {
                assert_eq!(session_id, "s1");
                assert_eq!(content, "Hello world");
                assert_eq!(thinking.unwrap(), "Thinking...");
            }
            _ => panic!("Roundtrip failed"),
        }
    }
}
