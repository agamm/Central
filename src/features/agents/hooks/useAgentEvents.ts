import { useEffect } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { useSessionStore } from "../stores/sessionStore";
import { useMessageStore } from "../stores/messageStore";
import { useUIStore } from "../stores/uiStore";
import { handleMessageEvent } from "./handlers/handleMessage";
import { handleSessionCompleted, handleSessionFailed } from "./handlers/handleSessionLifecycle";
import { debugLog } from "@/shared/debugLog";
import type { AgentEventPayload, SidecarEvent, ToolApprovalRequest } from "../types";

async function dispatchEvent(event: SidecarEvent): Promise<void> {
  debugLog("REACT-EVENT", `Received: ${event.type} ${JSON.stringify(event).slice(0, 200)}`);

  switch (event.type) {
    case "session_started":
      useSessionStore.getState().updateSessionStatus(event.sessionId, "running");
      useSessionStore.getState().setSessionStartedAt(event.sessionId, new Date().toISOString());
      useSessionStore.getState().setSdkSessionId(event.sessionId, event.sdkSessionId);
      break;
    case "message":
      handleMessageEvent(event);
      break;
    case "content_delta":
      useMessageStore.getState().appendStreamingContent(event.sessionId, event.delta);
      break;
    case "thinking_delta":
      useMessageStore.getState().appendStreamingThinking(event.sessionId, event.delta);
      break;
    case "tool_use":
    case "tool_result":
    case "tool_progress":
      break;
    case "tool_approval_request":
      useUIStore.getState().addPendingApproval({
        requestId: event.requestId,
        sessionId: event.sessionId,
        toolName: event.toolName,
        input: event.input,
        suggestions: event.suggestions as ToolApprovalRequest["suggestions"],
      });
      break;
    case "session_completed":
      await handleSessionCompleted(event.sessionId);
      break;
    case "session_failed":
      handleSessionFailed(event.sessionId, event.error);
      break;
    case "error":
      useSessionStore.getState().setError(event.message);
      break;
  }
}

function useAgentEvents(): void {
  useEffect(() => {
    let cancelled = false;
    let unlisten: UnlistenFn | undefined;

    const setup = async () => {
      debugLog("REACT", "Setting up agent-event listener");
      const fn = await listen<AgentEventPayload>("agent-event", (tauriEvent) => {
        void dispatchEvent(tauriEvent.payload.event);
      });

      if (cancelled) {
        fn();
        return;
      }
      unlisten = fn;
    };

    void setup();

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);
}

export { useAgentEvents };
