import { invoke } from "@tauri-apps/api/core";
import * as agentApi from "./api";
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
  const result = await agentApi.createSession(projectId, content, null);
  if (result.isErr()) {
    actions.setError(result.error);
    return;
  }

  const session = result.value;
  actions.setSession(session);
  actions.switchSession(session.id);
  await persistAndAddUserMessage(session.id, content, actions.addMessage);

  try {
    await invoke("start_agent_session", {
      projectPath,
      prompt: content,
      model: null,
    });
  } catch (e) {
    actions.updateStatus(session.id, "failed");
    actions.setError(`Failed to start agent: ${String(e)}`);
  }
}

async function sendFollowUp(
  sessionId: string,
  content: string,
  actions: Pick<SessionActions, "addMessage" | "updateStatus" | "setError">,
): Promise<void> {
  await persistAndAddUserMessage(sessionId, content, actions.addMessage);
  actions.updateStatus(sessionId, "running");
  await agentApi.updateSessionStatus(sessionId, "running");

  try {
    await invoke("send_agent_message", { sessionId, message: content });
  } catch (e) {
    actions.updateStatus(sessionId, "failed");
    actions.setError(`Failed to send message: ${String(e)}`);
  }
}

export { startNewSession, sendFollowUp };
export type { SessionActions };
