import { invoke } from "@tauri-apps/api/core";
import * as agentApi from "./api";
import { debugLog } from "@/shared/debugLog";
import type { AgentSession, AgentStatus, ChatMessage } from "./types";

function createUserMessage(sessionId: string, content: string): ChatMessage {
  return {
    id: crypto.randomUUID(),
    sessionId,
    role: "user",
    content,
    thinking: null,
    toolCalls: null,
    usage: null,
    timestamp: new Date().toISOString(),
  };
}

interface SessionActions {
  readonly setSession: (s: AgentSession) => void;
  readonly switchSession: (id: string) => void;
  readonly addMessage: (sid: string, msg: ChatMessage) => void;
  readonly updateStatus: (sid: string, status: AgentStatus) => void;
  readonly setError: (e: string) => void;
}

async function persistAndAddUserMessage(
  sessionId: string,
  content: string,
  addMessage: (sid: string, msg: ChatMessage) => void,
): Promise<void> {
  const userMsg = createUserMessage(sessionId, content);
  addMessage(sessionId, userMsg);
  await agentApi.addMessage(sessionId, "user", content, null, null, null);
}

async function startNewSession(
  projectId: string,
  projectPath: string,
  content: string,
  actions: SessionActions,
): Promise<void> {
  debugLog("REACT", `startNewSession: projectId=${projectId}, path=${projectPath}`);

  const result = await agentApi.createSession(projectId, content, null);
  if (result.isErr()) {
    debugLog("REACT", `createSession FAILED: ${result.error}`);
    actions.setError(result.error);
    return;
  }

  const session = result.value;
  debugLog("REACT", `Session created: id=${session.id}`);
  actions.setSession(session);
  actions.switchSession(session.id);
  await persistAndAddUserMessage(session.id, content, actions.addMessage);

  try {
    debugLog("REACT", `Invoking start_agent_session: sid=${session.id}`);
    const returnedId = await invoke("start_agent_session", {
      sessionId: session.id,
      projectPath,
      prompt: content,
      model: null,
    });
    debugLog("REACT", `start_agent_session returned: ${String(returnedId)}`);
  } catch (e) {
    debugLog("REACT", `start_agent_session FAILED: ${String(e)}`);
    actions.updateStatus(session.id, "failed");
    actions.setError(`Failed to start agent: ${String(e)}`);
  }
}

async function sendFollowUp(
  sessionId: string,
  projectPath: string,
  content: string,
  actions: Pick<SessionActions, "addMessage" | "updateStatus" | "setError">,
  resumeSessionId?: string | null,
): Promise<void> {
  await persistAndAddUserMessage(sessionId, content, actions.addMessage);
  actions.updateStatus(sessionId, "running");
  await agentApi.updateSessionStatus(sessionId, "running");

  try {
    // Try sending to an existing worker first
    await invoke("send_agent_message", { sessionId, message: content });
  } catch {
    // Worker doesn't exist (e.g. stale session from previous app run).
    // Spawn a new worker with this message as the prompt + resume context.
    debugLog("REACT", `send_agent_message failed for ${sessionId}, spawning new worker (resume=${resumeSessionId ?? "none"})`);
    try {
      await invoke("start_agent_session", {
        sessionId,
        projectPath,
        prompt: content,
        model: null,
        resumeSessionId: resumeSessionId ?? null,
      });
    } catch (e2) {
      actions.updateStatus(sessionId, "failed");
      actions.setError(`Failed to start agent: ${String(e2)}`);
    }
  }
}

export { startNewSession, sendFollowUp };
export type { SessionActions };
