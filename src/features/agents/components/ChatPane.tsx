import { useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { MessageSquare } from "lucide-react";
import { useProjectStore } from "@/features/projects/store";
import { useAgentStore } from "../store";
import * as agentApi from "../api";
import { MessageList } from "./MessageList";
import { MessageQueue } from "./MessageQueue";
import { PromptInput } from "./PromptInput";
import type { AgentSession, AgentStatus, ChatMessage } from "../types";

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

async function persistAndAddUserMessage(
  sessionId: string,
  content: string,
  addMessage: (sid: string, msg: ChatMessage) => void,
) {
  const userMsg = createUserMessage(sessionId, content);
  addMessage(sessionId, userMsg);
  await agentApi.addMessage(sessionId, "user", content, null, null, null);
}

async function startNewSession(
  projectId: string,
  projectPath: string,
  content: string,
  actions: {
    setSession: (s: AgentSession) => void;
    switchSession: (id: string) => void;
    addMessage: (sid: string, msg: ChatMessage) => void;
    updateStatus: (sid: string, status: AgentStatus) => void;
    setError: (e: string) => void;
  },
) {
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
  actions: {
    addMessage: (sid: string, msg: ChatMessage) => void;
    updateStatus: (sid: string, status: AgentStatus) => void;
    setError: (e: string) => void;
  },
) {
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

function EmptyState({ projectName }: { readonly projectName?: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
        <MessageSquare className="h-5 w-5 text-muted-foreground" />
      </div>
      {projectName ? (
        <div className="text-center">
          <p className="text-sm font-medium text-foreground">{projectName}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Type a message below to start an agent session
          </p>
        </div>
      ) : (
        <div className="text-center">
          <p className="text-sm font-medium text-foreground">
            Select a project to get started
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Choose a project from the sidebar to launch an agent
          </p>
        </div>
      )}
    </div>
  );
}

function ChatPane() {
  const selectedProjectId = useProjectStore((s) => s.selectedProjectId);
  const projects = useProjectStore((s) => s.projects);
  const activeSessionId = useAgentStore((s) => s.activeSessionId);
  const sessions = useAgentStore((s) => s.sessions);
  const messagesBySession = useAgentStore((s) => s.messagesBySession);
  const messageQueue = useAgentStore((s) => s.messageQueue);
  const setSession = useAgentStore((s) => s.setSession);
  const switchSession = useAgentStore((s) => s.switchSession);
  const addMessage = useAgentStore((s) => s.addMessage);
  const updateStatus = useAgentStore((s) => s.updateSessionStatus);
  const queueMessage = useAgentStore((s) => s.queueMessage);
  const cancelQueued = useAgentStore((s) => s.cancelQueuedMessage);
  const editQueued = useAgentStore((s) => s.editQueuedMessage);
  const setError = useAgentStore((s) => s.setError);

  const selectedProject = projects.find((p) => p.id === selectedProjectId);
  const activeSession = activeSessionId
    ? sessions.get(activeSessionId)
    : undefined;
  const isRunning = activeSession?.status === "running";
  const messages: readonly ChatMessage[] = activeSessionId
    ? (messagesBySession.get(activeSessionId) ?? [])
    : [];
  const sessionQueue = activeSessionId
    ? messageQueue.filter((m) => m.sessionId === activeSessionId)
    : [];

  const actions = { setSession, switchSession, addMessage, updateStatus, setError };

  const handleSubmit = useCallback(
    async (content: string) => {
      if (!selectedProjectId || !selectedProject) return;

      if (!activeSessionId || !activeSession) {
        await startNewSession(selectedProjectId, selectedProject.path, content, actions);
        return;
      }

      if (isRunning) {
        queueMessage(activeSessionId, content);
        return;
      }

      await sendFollowUp(activeSessionId, content, actions);
    },
    [selectedProjectId, selectedProject, activeSessionId, activeSession, isRunning, actions, queueMessage],
  );

  const handleAbort = useCallback(async () => {
    if (!activeSessionId) return;

    try {
      await invoke("abort_agent_session", { sessionId: activeSessionId });
      updateStatus(activeSessionId, "aborted");
      await agentApi.updateSessionStatus(activeSessionId, "aborted");
    } catch (e) {
      setError(`Failed to abort: ${String(e)}`);
    }
  }, [activeSessionId, updateStatus, setError]);

  const hasMessages = messages.length > 0;

  return (
    <div className="flex h-full flex-col bg-background">
      {hasMessages ? (
        <MessageList messages={messages} />
      ) : (
        <EmptyState projectName={selectedProject?.name} />
      )}

      {sessionQueue.length > 0 && (
        <MessageQueue
          messages={sessionQueue}
          onCancel={cancelQueued}
          onEdit={editQueued}
        />
      )}

      <PromptInput
        onSubmit={(msg) => void handleSubmit(msg)}
        onAbort={() => void handleAbort()}
        isRunning={isRunning}
        disabled={!selectedProjectId}
        placeholder={
          isRunning
            ? "Message will be queued..."
            : "Send a message to start an agent..."
        }
      />
    </div>
  );
}

export { ChatPane };
