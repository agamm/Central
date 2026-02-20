/** Commands sent from Rust to the sidecar via stdin JSON-lines */
type SidecarCommand =
  | { type: "start_session"; sessionId: string; projectPath: string; prompt: string; model?: string }
  | { type: "send_message"; sessionId: string; message: string }
  | { type: "abort_session"; sessionId: string }
  | { type: "list_sessions" };

/** Events emitted from the sidecar to Rust via stdout JSON-lines */
type SidecarEvent =
  | { type: "session_started"; sessionId: string }
  | { type: "message"; sessionId: string; role: "assistant" | "user"; content: string; thinking?: string; toolCalls?: ToolCallInfo[]; usage?: UsageInfo }
  | { type: "tool_use"; sessionId: string; toolName: string; input: Record<string, unknown> }
  | { type: "tool_result"; sessionId: string; toolName: string; output: string }
  | { type: "session_completed"; sessionId: string }
  | { type: "session_failed"; sessionId: string; error: string }
  | { type: "error"; message: string };

interface ToolCallInfo {
  readonly name: string;
  readonly input: Record<string, unknown>;
}

interface UsageInfo {
  readonly inputTokens: number;
  readonly outputTokens: number;
}

export type { SidecarCommand, SidecarEvent, ToolCallInfo, UsageInfo };
