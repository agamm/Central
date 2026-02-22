import { useProjectStore } from "@/features/projects/store";
import { useSessionStore } from "../stores/sessionStore";
import { useMessageStore } from "../stores/messageStore";
import { useUIStore } from "../stores/uiStore";
import { useElapsedTime } from "./useElapsedTime";
import type { ChatMessage } from "../types";

interface ChatSessionData {
  readonly selectedProjectId: string | null;
  readonly selectedProject: { id: string; name: string; path: string } | undefined;
  readonly activeSessionId: string | null;
  readonly activeSession: { id: string; status: string; sdkSessionId: string | null } | undefined;
  readonly isRunning: boolean;
  readonly messages: readonly ChatMessage[];
  readonly sessionQueue: readonly { id: string; sessionId: string; content: string; createdAt: string }[];
  readonly scrollPosition: number;
  readonly liveElapsedSeconds: number;
  readonly finalElapsedMs: number | null;
  readonly tokenUsage: { inputTokens: number; outputTokens: number } | null;
  readonly hasPendingApprovals: boolean;
  readonly sdkSessionIds: ReadonlyMap<string, string>;
}

function useChatSession(): ChatSessionData {
  const selectedProjectId = useProjectStore((s) => s.selectedProjectId);
  const projects = useProjectStore((s) => s.projects);
  const activeSessionId = useSessionStore((s) => s.activeSessionId);
  const sessions = useSessionStore((s) => s.sessions);
  const sessionStartedAt = useSessionStore((s) => s.sessionStartedAt);
  const sessionElapsedMs = useSessionStore((s) => s.sessionElapsedMs);
  const sdkSessionIds = useSessionStore((s) => s.sdkSessionIds);
  const sessionTokenUsage = useSessionStore((s) => s.sessionTokenUsage);
  const messagesBySession = useMessageStore((s) => s.messagesBySession);
  const messageQueue = useMessageStore((s) => s.messageQueue);
  const streamingMessages = useMessageStore((s) => s.streamingMessages);
  const pendingApprovals = useUIStore((s) => s.pendingApprovals);
  const getScrollPosition = useUIStore((s) => s.getScrollPosition);

  const selectedProject = projects.find((p) => p.id === selectedProjectId);
  const activeSession = activeSessionId ? sessions.get(activeSessionId) : undefined;
  const isRunning = activeSession?.status === "running";

  const startedAt = activeSessionId ? (sessionStartedAt.get(activeSessionId) ?? null) : null;
  const finalElapsedMs = activeSessionId ? (sessionElapsedMs.get(activeSessionId) ?? null) : null;
  const liveElapsedSeconds = useElapsedTime(startedAt, isRunning);

  const persistedMessages = activeSessionId ? (messagesBySession.get(activeSessionId) ?? []) : [];
  const streamingMsg = activeSessionId ? streamingMessages.get(activeSessionId) : undefined;
  const messages: readonly ChatMessage[] = streamingMsg ? [...persistedMessages, streamingMsg] : persistedMessages;

  const sessionQueue = activeSessionId ? messageQueue.filter((m) => m.sessionId === activeSessionId) : [];
  const scrollPosition = activeSessionId ? getScrollPosition(activeSessionId) : 0;
  const tokenUsage = activeSessionId ? (sessionTokenUsage.get(activeSessionId) ?? null) : null;
  const hasPendingApprovals = activeSessionId
    ? Array.from(pendingApprovals.values()).some((r) => r.sessionId === activeSessionId)
    : false;

  return {
    selectedProjectId,
    selectedProject,
    activeSessionId,
    activeSession,
    isRunning,
    messages,
    sessionQueue,
    scrollPosition,
    liveElapsedSeconds,
    finalElapsedMs,
    tokenUsage,
    hasPendingApprovals,
    sdkSessionIds,
  };
}

export { useChatSession };
export type { ChatSessionData };
