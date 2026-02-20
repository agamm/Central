import { useCallback, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useProjectStore } from "@/features/projects/store";
import { useAgentStore } from "../store";
import * as agentApi from "../api";
import { startNewSession, sendFollowUp } from "../sessionActions";
import { MessageList } from "./MessageList";
import { MessageQueue } from "./MessageQueue";
import { PromptInput } from "./PromptInput";
import { ChatEmptyState } from "./ChatEmptyState";
import type { ChatMessage } from "../types";

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
  const saveScrollPosition = useAgentStore((s) => s.saveScrollPosition);
  const getScrollPosition = useAgentStore((s) => s.getScrollPosition);

  const selectedProject = projects.find((p) => p.id === selectedProjectId);
  const activeSession = activeSessionId
    ? sessions.get(activeSessionId)
    : undefined;
  const isRunning = activeSession?.status === "running";

  // Only derive messages for the active session
  const messages: readonly ChatMessage[] = activeSessionId
    ? (messagesBySession.get(activeSessionId) ?? [])
    : [];
  const sessionQueue = activeSessionId
    ? messageQueue.filter((m) => m.sessionId === activeSessionId)
    : [];

  const scrollPosition = activeSessionId
    ? getScrollPosition(activeSessionId)
    : 0;

  const actions = useMemo(
    () => ({ setSession, switchSession, addMessage, updateStatus, setError }),
    [setSession, switchSession, addMessage, updateStatus, setError],
  );

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

  const handleScrollChange = useCallback(
    (position: number) => {
      if (activeSessionId) {
        saveScrollPosition(activeSessionId, position);
      }
    },
    [activeSessionId, saveScrollPosition],
  );

  const hasMessages = messages.length > 0;

  return (
    <div className="flex h-full flex-col bg-background">
      {hasMessages ? (
        <MessageList
          messages={messages}
          initialScrollPosition={scrollPosition}
          onScrollPositionChange={handleScrollChange}
        />
      ) : (
        <ChatEmptyState projectName={selectedProject?.name} />
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
