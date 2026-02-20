import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { useAgentStore } from "../store";
import * as agentApi from "../api";
import { notifySessionCompleted, notifySessionFailed } from "../notifications";
import type { AgentEventPayload, ChatMessage, SidecarEvent } from "../types";

type Store = ReturnType<typeof useAgentStore.getState>;

function makeSystemMessage(
  sessionId: string,
  content: string,
  toolCalls: string | null,
): ChatMessage {
  return {
    id: crypto.randomUUID(),
    sessionId,
    role: "system",
    content,
    thinking: null,
    toolCalls,
    usage: null,
    timestamp: new Date().toISOString(),
  };
}

async function handleMessageEvent(
  store: Store,
  event: Extract<SidecarEvent, { type: "message" }>,
): Promise<void> {
  const toolCallsJson = event.toolCalls ? JSON.stringify(event.toolCalls) : null;
  const usageJson = event.usage ? JSON.stringify(event.usage) : null;

  const result = await agentApi.addMessage(
    event.sessionId, event.role, event.content,
    event.thinking ?? null, toolCallsJson, usageJson,
  );

  result.match(
    (msg) => { store.addMessage(event.sessionId, msg); },
    () => {
      store.addMessage(event.sessionId, {
        id: crypto.randomUUID(),
        sessionId: event.sessionId,
        role: event.role as "assistant" | "user" | "system",
        content: event.content,
        thinking: event.thinking ?? null,
        toolCalls: toolCallsJson,
        usage: usageJson,
        timestamp: new Date().toISOString(),
      });
    },
  );
}

async function handleSessionCompleted(
  store: Store,
  sessionId: string,
): Promise<void> {
  store.updateSessionStatus(sessionId, "completed");
  await agentApi.updateSessionStatus(sessionId, "completed");

  const session = store.sessions.get(sessionId);
  notifySessionCompleted(session?.prompt ?? null);

  const queued = store.dequeueMessage(sessionId);
  if (queued) {
    await invoke("send_agent_message", { sessionId, message: queued.content });
    store.updateSessionStatus(sessionId, "running");
    await agentApi.updateSessionStatus(sessionId, "running");
  }
}

async function handleSessionFailed(
  store: Store,
  sessionId: string,
  error: string,
): Promise<void> {
  store.updateSessionStatus(sessionId, "failed");
  store.setError(error);
  await agentApi.updateSessionStatus(sessionId, "failed");

  const session = store.sessions.get(sessionId);
  notifySessionFailed(session?.prompt ?? null, error);
}

/** Dispatch a sidecar event to the appropriate handler */
async function handleEvent(event: SidecarEvent): Promise<void> {
  const store = useAgentStore.getState();

  switch (event.type) {
    case "ready":
      break;
    case "session_started":
      store.updateSessionStatus(event.sessionId, "running");
      break;
    case "message":
      await handleMessageEvent(store, event);
      break;
    case "tool_use":
      store.addMessage(event.sessionId, makeSystemMessage(
        event.sessionId,
        `Tool: ${event.toolName}`,
        JSON.stringify([{ name: event.toolName, input: event.input }]),
      ));
      break;
    case "tool_result":
      store.addMessage(event.sessionId, makeSystemMessage(
        event.sessionId, `${event.toolName}: ${event.output}`, null,
      ));
      break;
    case "session_completed":
      await handleSessionCompleted(store, event.sessionId);
      break;
    case "session_failed":
      await handleSessionFailed(store, event.sessionId, event.error);
      break;
    case "error":
      store.setError(event.message);
      break;
  }
}

/** Hook to listen for sidecar events and dispatch to the agent store */
function useAgentEvents(): void {
  useEffect(() => {
    let unlisten: UnlistenFn | undefined;

    const setup = async () => {
      unlisten = await listen<AgentEventPayload>(
        "agent-event",
        (tauriEvent) => {
          void handleEvent(tauriEvent.payload.event);
        },
      );
    };

    void setup();

    return () => {
      unlisten?.();
    };
  }, []);
}

export { useAgentEvents };
