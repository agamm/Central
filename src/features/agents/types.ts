import type { AgentSession, AgentStatus, Message } from "@/core/types";

/** Matches SidecarEvent from the Rust backend */
interface AgentEventPayload {
  readonly event: SidecarEvent;
}

type SidecarEvent =
  | { type: "session_started"; sessionId: string; sdkSessionId: string }
  | {
      type: "message";
      sessionId: string;
      role: string;
      content: string;
      thinking?: string;
      toolCalls?: unknown;
      usage?: unknown;
    }
  | {
      type: "tool_use";
      sessionId: string;
      toolName: string;
      input: Record<string, unknown>;
    }
  | {
      type: "tool_result";
      sessionId: string;
      toolName: string;
      output: string;
    }
  | {
      type: "tool_approval_request";
      sessionId: string;
      requestId: string;
      toolName: string;
      input: Record<string, unknown>;
      suggestions?: unknown[];
    }
  | { type: "content_delta"; sessionId: string; delta: string }
  | { type: "thinking_delta"; sessionId: string; delta: string }
  | {
      type: "tool_progress";
      sessionId: string;
      toolName: string;
      elapsedSeconds: number;
    }
  | {
      type: "session_completed";
      sessionId: string;
      sdkSessionId: string;
      totalCostUsd?: number;
      durationMs?: number;
    }
  | { type: "session_failed"; sessionId: string; error: string }
  | { type: "error"; message: string }
  | {
      type: "rate_limit_status";
      sessionId: string;
      status: string;
      resetsAt: number;
      rateLimitType: string;
    };

/** SDK permission-update suggestion returned with canUseTool */
interface PermissionUpdateSuggestion {
  readonly type: string;
  readonly destination: string;
  readonly rules?: readonly { toolName: string; ruleContent?: string }[];
  readonly behavior?: string;
}

/** A pending tool approval request from the sidecar worker */
interface ToolApprovalRequest {
  readonly requestId: string;
  readonly sessionId: string;
  readonly toolName: string;
  readonly input: Record<string, unknown>;
  readonly suggestions?: readonly PermissionUpdateSuggestion[];
}

/** A queued message waiting to be sent when agent completes */
interface QueuedMessage {
  readonly id: string;
  readonly sessionId: string;
  readonly content: string;
  readonly createdAt: string;
}

/** Display-ready message combining DB message with UI state */
interface ChatMessage extends Message {
  readonly isStreaming?: boolean;
}

export type {
  AgentEventPayload,
  SidecarEvent,
  ToolApprovalRequest,
  PermissionUpdateSuggestion,
  QueuedMessage,
  ChatMessage,
  AgentSession,
  AgentStatus,
  Message,
};
