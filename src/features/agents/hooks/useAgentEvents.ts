import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { useAgentStore } from "../store";
import { debugLog } from "@/shared/debugLog";
import { notifySessionCompleted, notifySessionFailed } from "../notifications";
import type { AgentEventPayload, ChatMessage, SidecarEvent } from "../types";
import type { ToolCallInfo } from "../components/ToolCallBlock";

type Store = ReturnType<typeof useAgentStore.getState>;

/**
 * Module-level buffer for tool calls that arrive between message events.
 * Keyed by sessionId. Cleared when merged into the next assistant message
 * or when the session completes.
 */
const pendingToolCalls = new Map<string, ToolCallInfo[]>();

function appendPendingToolCall(sessionId: string, tool: ToolCallInfo): void {
  const existing = pendingToolCalls.get(sessionId) ?? [];
  pendingToolCalls.set(sessionId, [...existing, tool]);
}

function drainPendingToolCalls(sessionId: string): ToolCallInfo[] {
  const calls = pendingToolCalls.get(sessionId) ?? [];
  pendingToolCalls.delete(sessionId);
  return calls;
}

function mergeToolCallsJson(
  existingJson: string | null,
  pending: ToolCallInfo[],
): string | null {
  if (pending.length === 0) return existingJson;

  let existing: ToolCallInfo[] = [];
  if (existingJson) {
    try {
      const parsed: unknown = JSON.parse(existingJson);
      if (Array.isArray(parsed)) existing = parsed as ToolCallInfo[];
    } catch {
      // ignore parse errors
    }
  }

  return JSON.stringify([...existing, ...pending]);
}

function handleMessageEvent(
  store: Store,
  event: Extract<SidecarEvent, { type: "message" }>,
): void {
  const pending = drainPendingToolCalls(event.sessionId);
  const toolCallsJson = mergeToolCallsJson(
    event.toolCalls ? JSON.stringify(event.toolCalls) : null,
    pending,
  );
  const usageJson = event.usage ? JSON.stringify(event.usage) : null;

  const msg: ChatMessage = {
    id: crypto.randomUUID(),
    sessionId: event.sessionId,
    role: event.role as "assistant" | "user" | "system",
    content: event.content,
    thinking: event.thinking ?? null,
    toolCalls: toolCallsJson,
    usage: usageJson,
    timestamp: new Date().toISOString(),
  };

  store.addMessage(event.sessionId, msg);
}

async function handleSessionCompleted(
  store: Store,
  sessionId: string,
): Promise<void> {
  flushPendingToolCallsToLastMessage(store, sessionId);

  const startedAt = store.sessionStartedAt.get(sessionId);
  if (startedAt) {
    const elapsed = Date.now() - new Date(startedAt).getTime();
    store.setSessionElapsed(sessionId, elapsed);
  }

  const queued = store.dequeueMessage(sessionId);

  if (queued) {
    // Skip "completed" status — go straight to "running" for the next turn.
    // This avoids a race where two async SQLite writes (completed, then running)
    // could arrive out of order, leaving the DB stuck on "completed".
    store.addMessage(sessionId, {
      id: crypto.randomUUID(),
      sessionId,
      role: "user",
      content: queued.content,
      thinking: null,
      toolCalls: null,
      usage: null,
      timestamp: new Date().toISOString(),
    });
    await invoke("send_agent_message", { sessionId, message: queued.content });
    store.updateSessionStatus(sessionId, "running");
    store.setSessionStartedAt(sessionId, new Date().toISOString());
  } else {
    store.updateSessionStatus(sessionId, "completed");
  }

  const session = useAgentStore.getState().sessions.get(sessionId);
  notifySessionCompleted(session?.prompt ?? null);
}

/**
 * If tool_use events arrived after the last assistant message (or no
 * assistant message exists yet), attach them to the last assistant
 * message so they persist in the chat.
 */
function flushPendingToolCallsToLastMessage(
  store: Store,
  sessionId: string,
): void {
  const pending = drainPendingToolCalls(sessionId);
  if (pending.length === 0) return;

  const messages = [...(store.messagesBySession.get(sessionId) ?? [])];
  const lastAssistantIdx = findLastIndex(
    messages,
    (m) => m.role === "assistant",
  );

  if (lastAssistantIdx === -1) return;

  const msg = messages[lastAssistantIdx] as ChatMessage;
  const merged = mergeToolCallsJson(msg.toolCalls, pending);
  messages[lastAssistantIdx] = { ...msg, toolCalls: merged };
  store.setMessages(sessionId, messages);
}

function findLastIndex<T>(
  arr: readonly T[],
  predicate: (item: T) => boolean,
): number {
  for (let i = arr.length - 1; i >= 0; i--) {
    const item = arr[i];
    if (item !== undefined && predicate(item)) return i;
  }
  return -1;
}

function handleSessionFailed(
  store: Store,
  sessionId: string,
  error: string,
): void {
  const startedAt = store.sessionStartedAt.get(sessionId);
  if (startedAt) {
    const elapsed = Date.now() - new Date(startedAt).getTime();
    store.setSessionElapsed(sessionId, elapsed);
  }

  flushPendingToolCallsToLastMessage(store, sessionId);

  store.updateSessionStatus(sessionId, "failed");
  store.setError(error);

  const session = store.sessions.get(sessionId);
  notifySessionFailed(session?.prompt ?? null, error);
}

/**
 * Dispatch a sidecar event to the appropriate handler.
 * Performance: Events from all 5 agents route through here. Each handler
 * only updates the specific session's data in the store, so only components
 * subscribed to that session (or the active session) re-render.
 */
async function handleEvent(event: SidecarEvent): Promise<void> {
  debugLog("REACT-EVENT", `Received: ${event.type} ${JSON.stringify(event).slice(0, 200)}`);
  const store = useAgentStore.getState();

  switch (event.type) {
    case "session_started":
      debugLog("REACT-EVENT", `Session started: ${event.sessionId} sdk=${event.sdkSessionId}`);
      store.updateSessionStatus(event.sessionId, "running");
      store.setSessionStartedAt(event.sessionId, new Date().toISOString());
      store.setSdkSessionId(event.sessionId, event.sdkSessionId);
      break;
    case "message":
      debugLog("REACT-EVENT", `Message: sid=${event.sessionId} role=${event.role} content=${event.content.slice(0, 100)}`);
      handleMessageEvent(store, event);
      break;
    case "tool_use":
      debugLog("REACT-EVENT", `Tool use: sid=${event.sessionId} tool=${event.toolName}`);
      appendPendingToolCall(event.sessionId, {
        name: event.toolName,
        input: event.input,
      });
      break;
    case "tool_result":
      debugLog("REACT-EVENT", `Tool result: sid=${event.sessionId} tool=${event.toolName}`);
      break;
    case "tool_approval_request":
      debugLog("REACT-EVENT", `Tool approval: sid=${event.sessionId} tool=${event.toolName} req=${event.requestId}`);
      // TODO: Surface in UI for user approval. For now, auto-approve.
      break;
    case "tool_progress":
      debugLog("REACT-EVENT", `Tool progress: sid=${event.sessionId} tool=${event.toolName} ${event.elapsedSeconds}s`);
      break;
    case "session_completed":
      debugLog("REACT-EVENT", `Session completed: ${event.sessionId} cost=$${event.totalCostUsd ?? "?"} duration=${event.durationMs ?? "?"}ms`);
      await handleSessionCompleted(store, event.sessionId);
      break;
    case "session_failed":
      debugLog("REACT-EVENT", `Session FAILED: ${event.sessionId} error=${event.error}`);
      handleSessionFailed(store, event.sessionId, event.error);
      break;
    case "error":
      debugLog("REACT-EVENT", `Error event: ${event.message}`);
      store.setError(event.message);
      break;
  }
}

/** Hook to listen for sidecar events and dispatch to the agent store */
function useAgentEvents(): void {
  useEffect(() => {
    // Track whether cleanup ran before listen() resolved (StrictMode).
    let cancelled = false;
    let unlisten: UnlistenFn | undefined;

    const setup = async () => {
      debugLog("REACT", "Setting up agent-event listener");
      const fn = await listen<AgentEventPayload>(
        "agent-event",
        (tauriEvent) => {
          debugLog("REACT", `agent-event received: ${tauriEvent.payload.event.type}`);
          void handleEvent(tauriEvent.payload.event);
        },
      );

      if (cancelled) {
        // Cleanup ran while listen() was pending — remove immediately
        fn();
        debugLog("REACT", "agent-event listener removed (stale mount)");
        return;
      }

      unlisten = fn;
      debugLog("REACT", "agent-event listener registered OK");
    };

    void setup();

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);
}

export { useAgentEvents };
