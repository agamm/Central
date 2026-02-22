/** Commands sent from Rust to the worker via stdin JSON-lines */
type WorkerCommand =
  | {
      type: "start_session";
      sessionId: string;
      projectPath: string;
      prompt: string;
      model?: string;
      maxBudgetUsd?: number;
      /** SDK session ID from a prior run — enables conversation resume */
      resumeSessionId?: string;
    }
  | { type: "send_message"; sessionId: string; message: string }
  | { type: "abort_session"; sessionId: string }
  | { type: "end_session"; sessionId: string }
  | {
      type: "tool_approval_response";
      requestId: string;
      allowed: boolean;
      /** Permission updates to persist (e.g. "remember for project") */
      updatedPermissions?: PermissionUpdateInfo[];
    };

/** Mirrors SDK's PermissionUpdate for serialization over stdin */
interface PermissionUpdateInfo {
  type: "addRules" | "replaceRules" | "removeRules" | "setMode" | "addDirectories" | "removeDirectories";
  rules?: Array<{ toolName: string; ruleContent?: string }>;
  behavior?: "allow" | "deny" | "ask";
  mode?: string;
  directories?: string[];
  destination: "session" | "projectSettings" | "userSettings" | "localSettings" | "cliArg";
}

/** Events emitted from the worker to Rust via stdout JSON-lines */
type SidecarEvent =
  | { type: "session_started"; sessionId: string; sdkSessionId: string }
  | {
      type: "message";
      sessionId: string;
      role: "assistant" | "user";
      content: string;
      thinking?: string;
      toolCalls?: ToolCallInfo[];
      usage?: UsageInfo;
    }
  | { type: "tool_use"; sessionId: string; toolName: string; input: Record<string, unknown> }
  | { type: "tool_result"; sessionId: string; toolName: string; output: string }
  | {
      type: "tool_approval_request";
      sessionId: string;
      requestId: string;
      toolName: string;
      input: Record<string, unknown>;
      /** SDK-suggested permission updates the UI can offer as "remember" options */
      suggestions?: PermissionUpdateInfo[];
    }
  | { type: "content_delta"; sessionId: string; delta: string }
  | { type: "thinking_delta"; sessionId: string; delta: string }
  | { type: "tool_progress"; sessionId: string; toolName: string; elapsedSeconds: number }
  | {
      type: "session_completed";
      sessionId: string;
      sdkSessionId: string;
      totalCostUsd?: number;
      durationMs?: number;
    }
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

export type {
  WorkerCommand,
  SidecarEvent,
  ToolCallInfo,
  UsageInfo,
  PermissionUpdateInfo,
};
