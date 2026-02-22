import { invoke } from "@tauri-apps/api/core";
import { useSessionStore } from "../../stores/sessionStore";
import { useMessageStore } from "../../stores/messageStore";
import { useUIStore } from "../../stores/uiStore";
import { debugLog } from "@/shared/debugLog";
import { notifySessionCompleted, notifySessionFailed } from "../../notifications";

function finalizeSession(sessionId: string): void {
  const msgStore = useMessageStore.getState();
  msgStore.flushBufferedToolCalls(sessionId);

  const streamingMsg = msgStore.streamingMessages.get(sessionId);
  if (streamingMsg) {
    debugLog("REACT-EVENT", `Finalizing leftover streaming msg for ${sessionId}`);
    msgStore.finalizeStreamingMessage(sessionId, { ...streamingMsg, isStreaming: false });
  }

  const startedAt = useSessionStore.getState().sessionStartedAt.get(sessionId);
  if (startedAt) {
    const elapsed = Date.now() - new Date(startedAt).getTime();
    useSessionStore.getState().setSessionElapsed(sessionId, elapsed);
  }

  // Clear any pending approvals for this session
  const uiState = useUIStore.getState();
  for (const [reqId, req] of uiState.pendingApprovals) {
    if (req.sessionId === sessionId) uiState.removePendingApproval(reqId);
  }
}

async function handleSessionCompleted(sessionId: string): Promise<void> {
  finalizeSession(sessionId);

  const msgStore = useMessageStore.getState();
  const sessStore = useSessionStore.getState();

  const messages = msgStore.messagesBySession.get(sessionId) ?? [];
  const lastMsg = messages[messages.length - 1];
  if (lastMsg && lastMsg.role === "user") {
    debugLog("REACT-EVENT", `Silent completion: no assistant response for ${sessionId}`);
    msgStore.addMessage(sessionId, {
      id: crypto.randomUUID(),
      sessionId,
      role: "system",
      content: "No response received.",
      thinking: null,
      toolCalls: null,
      usage: null,
      timestamp: new Date().toISOString(),
    });
  }

  const queued = msgStore.dequeueMessage(sessionId);

  if (queued) {
    msgStore.addMessage(sessionId, {
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
    sessStore.updateSessionStatus(sessionId, "running");
    sessStore.setSessionStartedAt(sessionId, new Date().toISOString());
  } else {
    sessStore.updateSessionStatus(sessionId, "completed");
  }

  const session = useSessionStore.getState().sessions.get(sessionId);
  notifySessionCompleted(session?.prompt ?? null, sessionId);
}

function handleSessionFailed(sessionId: string, error: string): void {
  finalizeSession(sessionId);

  const sessStore = useSessionStore.getState();
  sessStore.updateSessionStatus(sessionId, "failed");
  sessStore.setError(error);

  const session = sessStore.sessions.get(sessionId);
  notifySessionFailed(session?.prompt ?? null, error, sessionId);
}

export { handleSessionCompleted, handleSessionFailed };
