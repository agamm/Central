import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import type { SidecarEvent, ToolCallInfo } from "./types.js";

let sdkSessionId = "";

function getSdkSessionId(): string {
  return sdkSessionId;
}

function processSDKMessage(
  sessionId: string,
  msg: SDKMessage,
  emit: (event: SidecarEvent) => void,
  log: (msg: string) => void,
): void {
  const handler = messageHandlers[msg.type];
  if (handler) {
    handler(sessionId, msg, emit, log);
  } else {
    log(`Unhandled SDK msg type="${msg.type}" ${JSON.stringify(msg).slice(0, 300)}`);
  }
}

type Handler = (
  sessionId: string,
  msg: SDKMessage,
  emit: (event: SidecarEvent) => void,
  log: (msg: string) => void,
) => void;

function handleSystem(
  sessionId: string,
  msg: SDKMessage,
  emit: (event: SidecarEvent) => void,
  log: (msg: string) => void,
): void {
  if ("subtype" in msg && msg.subtype === "init") {
    sdkSessionId = msg.session_id;
    emit({ type: "session_started", sessionId, sdkSessionId });
    log(`Session init: model=${msg.model}, tools=${msg.tools.length}, sdk_sid=${sdkSessionId}`);
  } else if ("subtype" in msg) {
    log(`System event: ${(msg as Record<string, unknown>).subtype}`);
  }
}

function handleAssistant(
  sessionId: string,
  msg: SDKMessage,
  emit: (event: SidecarEvent) => void,
  log: (msg: string) => void,
): void {
  if (msg.type !== "assistant") return;
  const assistantError = (msg as unknown as { error?: string }).error;
  let textContent = "";
  let thinking: string | undefined;
  const toolCalls: ToolCallInfo[] = [];

  for (const block of msg.message.content) {
    if (block.type === "text") {
      textContent += block.text;
    } else if (block.type === "thinking" && "thinking" in block) {
      thinking = block.thinking as string;
    } else if (block.type === "tool_use") {
      toolCalls.push({ name: block.name, input: block.input as Record<string, unknown> });
    }
  }

  if (assistantError) {
    log(`Assistant error: ${assistantError} content="${textContent.slice(0, 100)}"`);
  }

  if (textContent || thinking || msg.message.usage) {
    emit({
      type: "message",
      sessionId,
      role: "assistant",
      content: textContent,
      thinking,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      usage: msg.message.usage
        ? { inputTokens: msg.message.usage.input_tokens, outputTokens: msg.message.usage.output_tokens }
        : undefined,
    });
  }
}

function handleToolProgress(
  sessionId: string,
  msg: SDKMessage,
  emit: (event: SidecarEvent) => void,
): void {
  if (msg.type !== "tool_progress") return;
  emit({
    type: "tool_progress",
    sessionId,
    toolName: msg.tool_name,
    elapsedSeconds: msg.elapsed_time_seconds,
  });
}

function handleResult(
  sessionId: string,
  msg: SDKMessage,
  emit: (event: SidecarEvent) => void,
  log: (msg: string) => void,
): void {
  if (msg.type !== "result") return;

  if (msg.subtype === "success") {
    emit({ type: "session_completed", sessionId, sdkSessionId, totalCostUsd: msg.total_cost_usd, durationMs: msg.duration_ms });
    log(`Session completed: ${msg.duration_ms}ms, cost=$${msg.total_cost_usd}, turns=${msg.num_turns}`);
  } else {
    const reason = msg.subtype === "error_max_budget_usd"
      ? `Budget exceeded ($${msg.total_cost_usd})`
      : `${msg.subtype}: ${msg.num_turns} turns, ${msg.duration_ms}ms`;
    emit({ type: "session_failed", sessionId, error: reason });
    log(`Session failed: ${reason}`);
  }
}

function handleAuthStatus(
  sessionId: string,
  msg: SDKMessage,
  emit: (event: SidecarEvent) => void,
  log: (msg: string) => void,
): void {
  const authMsg = msg as unknown as { isAuthenticating: boolean; output: string[]; error?: string };
  const content = authMsg.error
    ? `Authentication error: ${authMsg.error}`
    : authMsg.output.join("\n") || (authMsg.isAuthenticating ? "Authenticating..." : "");
  if (content) {
    emit({ type: "message", sessionId, role: "assistant", content });
  }
  log(`Auth status: authenticating=${authMsg.isAuthenticating} error=${authMsg.error ?? "none"}`);
}

function handleStreamEvent(
  sessionId: string,
  msg: SDKMessage,
  emit: (event: SidecarEvent) => void,
): void {
  const event = (msg as Record<string, unknown>).event as Record<string, unknown> | undefined;
  if (!event || event.type !== "content_block_delta") return;

  const delta = event.delta as Record<string, unknown> | undefined;
  if (!delta) return;

  if (delta.type === "text_delta" && typeof delta.text === "string") {
    emit({ type: "content_delta", sessionId, delta: delta.text });
  } else if (delta.type === "thinking_delta" && typeof delta.thinking === "string") {
    emit({ type: "thinking_delta", sessionId, delta: delta.thinking });
  }
}

function handleRateLimitEvent(
  sessionId: string,
  msg: SDKMessage,
  emit: (event: SidecarEvent) => void,
  log: (msg: string) => void,
): void {
  const rlMsg = msg as unknown as {
    rate_limit_info?: { status: string; resetsAt: number; rateLimitType: string };
  };
  const info = rlMsg.rate_limit_info;
  if (!info) return;

  emit({
    type: "rate_limit_status",
    sessionId,
    status: info.status,
    resetsAt: info.resetsAt,
    rateLimitType: info.rateLimitType,
  });
  log(`Rate limit: status=${info.status} resets=${info.resetsAt} type=${info.rateLimitType}`);
}

const messageHandlers: Record<string, Handler> = {
  system: handleSystem,
  assistant: handleAssistant,
  tool_progress: handleToolProgress,
  result: handleResult,
  auth_status: handleAuthStatus,
  stream_event: handleStreamEvent,
  rate_limit_event: handleRateLimitEvent,
};

export { processSDKMessage, getSdkSessionId };
