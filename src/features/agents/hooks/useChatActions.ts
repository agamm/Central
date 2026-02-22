import { useCallback, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useSessionStore } from "../stores/sessionStore";
import { useMessageStore } from "../stores/messageStore";
import { useUIStore } from "../stores/uiStore";
import { startNewSession, sendFollowUp, startIdleSession } from "../sessionActions";
import type { ChatSessionData } from "./useChatSession";

type SessionActions = Pick<ChatSessionData, "selectedProjectId" | "selectedProject" | "activeSessionId" | "activeSession" | "isRunning" | "sdkSessionIds">;

function useChatActions(session: SessionActions) {
  const createSession = useSessionStore((s) => s.createSession);
  const addMessage = useMessageStore((s) => s.addMessage);
  const updateStatus = useSessionStore((s) => s.updateSessionStatus);
  const updatePrompt = useSessionStore((s) => s.updateSessionPrompt);
  const setError = useSessionStore((s) => s.setError);
  const queueMessage = useMessageStore((s) => s.queueMessage);
  const saveScrollPosition = useUIStore((s) => s.saveScrollPosition);

  const actions = useMemo(
    () => ({ createSession, addMessage, updateStatus, updatePrompt, setError }),
    [createSession, addMessage, updateStatus, updatePrompt, setError],
  );

  const handleSubmit = useCallback(
    async (content: string) => {
      if (!session.selectedProjectId || !session.selectedProject) return;

      if (!session.activeSessionId || !session.activeSession) {
        await startNewSession(session.selectedProjectId, session.selectedProject.path, content, actions);
        return;
      }

      if (session.activeSession.status === "idle") {
        await startIdleSession(session.activeSessionId, session.selectedProject.path, content, actions);
        return;
      }

      if (session.isRunning) {
        queueMessage(session.activeSessionId, content);
        return;
      }

      const resumeSdkId = session.sdkSessionIds.get(session.activeSessionId)
        ?? session.activeSession.sdkSessionId;
      await sendFollowUp(session.activeSessionId, session.selectedProject.path, content, actions, resumeSdkId);
    },
    [session.selectedProjectId, session.selectedProject, session.activeSessionId, session.activeSession, session.isRunning, session.sdkSessionIds, actions, queueMessage],
  );

  const handleAbort = useCallback(async () => {
    if (!session.activeSessionId) return;
    try {
      await invoke("abort_agent_session", { sessionId: session.activeSessionId });
      updateStatus(session.activeSessionId, "aborted");
    } catch (e) {
      setError(`Failed to abort: ${String(e)}`);
    }
  }, [session.activeSessionId, updateStatus, setError]);

  const handleScrollChange = useCallback(
    (position: number) => {
      if (session.activeSessionId) {
        saveScrollPosition(session.activeSessionId, position);
      }
    },
    [session.activeSessionId, saveScrollPosition],
  );

  return { handleSubmit, handleAbort, handleScrollChange };
}

export { useChatActions };
