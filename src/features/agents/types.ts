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
  | { type: "error"; message: string };

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
  QueuedMessage,
  ChatMessage,
  AgentSession,
  AgentStatus,
  Message,
};
