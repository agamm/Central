import { useEffect } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { useAgentStore } from "../store";
import * as agentApi from "../api";
import type { AgentEventPayload, SidecarEvent } from "../types";

/** Process a sidecar event: update store and persist to SQLite */
async function handleEvent(event: SidecarEvent): Promise<void> {
  const store = useAgentStore.getState();

  switch (event.type) {
    case "ready":
      break;

    case "session_started":
      store.updateSessionStatus(event.sessionId, "running");
      break;

    case "message": {
      const toolCallsJson = event.toolCalls
        ? JSON.stringify(event.toolCalls)
        : null;
      const usageJson = event.usage ? JSON.stringify(event.usage) : null;

      const result = await agentApi.addMessage(
        event.sessionId,
        event.role,
        event.content,
        event.thinking ?? null,
        toolCallsJson,
        usageJson,
      );

      result.match(
        (msg) => { store.addMessage(event.sessionId, msg); },
        () => {
          // Persistence failed — still show in UI
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
      break;
    }

    case "tool_use":
      store.addMessage(event.sessionId, {
        id: crypto.randomUUID(),
        sessionId: event.sessionId,
        role: "system",
        content: `Tool: ${event.toolName}`,
        thinking: null,
        toolCalls: JSON.stringify([
          { name: event.toolName, input: event.input },
        ]),
        usage: null,
        timestamp: new Date().toISOString(),
      });
      break;

    case "tool_result":
      store.addMessage(event.sessionId, {
        id: crypto.randomUUID(),
        sessionId: event.sessionId,
        role: "system",
        content: `${event.toolName}: ${event.output}`,
        thinking: null,
        toolCalls: null,
        usage: null,
        timestamp: new Date().toISOString(),
      });
      break;

    case "session_completed": {
      store.updateSessionStatus(event.sessionId, "completed");
      await agentApi.updateSessionStatus(event.sessionId, "completed");

      // Auto-send next queued message if any
      const queued = store.dequeueMessage(event.sessionId);
      if (queued) {
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("send_agent_message", {
          sessionId: event.sessionId,
          message: queued.content,
        });
        store.updateSessionStatus(event.sessionId, "running");
        await agentApi.updateSessionStatus(event.sessionId, "running");
      }
      break;
    }

    case "session_failed": {
      store.updateSessionStatus(event.sessionId, "failed");
      store.setError(event.error);
      await agentApi.updateSessionStatus(event.sessionId, "failed");
      break;
    }

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
