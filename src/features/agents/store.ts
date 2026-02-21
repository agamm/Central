import { create } from "zustand";
import type {
  AgentSession,
  AgentStatus,
  ChatMessage,
  QueuedMessage,
} from "./types";

/**
 * Performance note for 5 concurrent agents:
 * - Messages are keyed by session ID so only the active session's messages
 *   cause re-renders in the chat pane (via selective selector on activeSessionId).
 * - Background agents append to messagesBySession without triggering chat UI updates.
 * - Session map updates are O(1) per session.
 * - TODO: If message counts grow very large (>1000 per session), consider
 *   virtualized rendering in MessageList.
 */
interface AgentState {
  readonly sessions: ReadonlyMap<string, AgentSession>;
  readonly activeSessionId: string | null;
  readonly messagesBySession: ReadonlyMap<string, readonly ChatMessage[]>;
  readonly messageQueue: readonly QueuedMessage[];
  readonly scrollPositionBySession: ReadonlyMap<string, number>;
  readonly sessionStartedAt: ReadonlyMap<string, string>;
  readonly sessionElapsedMs: ReadonlyMap<string, number>;
  /** Maps our sessionId → SDK's internal session ID (for resume) */
  readonly sdkSessionIds: ReadonlyMap<string, string>;
  readonly loading: boolean;
  readonly error: string | null;
}

interface AgentActions {
  readonly setSession: (session: AgentSession) => void;
  readonly updateSessionStatus: (
    sessionId: string,
    status: AgentStatus,
  ) => void;
  readonly switchSession: (sessionId: string | null) => void;
  readonly addMessage: (sessionId: string, message: ChatMessage) => void;
  readonly setMessages: (
    sessionId: string,
    messages: readonly ChatMessage[],
  ) => void;
  readonly queueMessage: (sessionId: string, content: string) => QueuedMessage;
  readonly dequeueMessage: (sessionId: string) => QueuedMessage | undefined;
  readonly cancelQueuedMessage: (messageId: string) => void;
  readonly editQueuedMessage: (messageId: string, content: string) => void;
  readonly saveScrollPosition: (sessionId: string, position: number) => void;
  readonly getScrollPosition: (sessionId: string) => number;
  readonly setSessionStartedAt: (sessionId: string, timestamp: string) => void;
  readonly setSessionElapsed: (sessionId: string, ms: number) => void;
  readonly setSdkSessionId: (sessionId: string, sdkSessionId: string) => void;
  readonly setLoading: (loading: boolean) => void;
  readonly setError: (error: string | null) => void;
  readonly clearSessionData: (sessionId: string) => void;
}

type AgentStore = AgentState & AgentActions;

const useAgentStore = create<AgentStore>()((set, get) => ({
  sessions: new Map(),
  activeSessionId: null,
  messagesBySession: new Map(),
  messageQueue: [],
  scrollPositionBySession: new Map(),
  sessionStartedAt: new Map(),
  sessionElapsedMs: new Map(),
  sdkSessionIds: new Map(),
  loading: false,
  error: null,

  setSession: (session) => {
    const sessions = new Map(get().sessions);
    sessions.set(session.id, session);
    set({ sessions });
  },

  updateSessionStatus: (sessionId, status) => {
    const sessions = new Map(get().sessions);
    const existing = sessions.get(sessionId);
    if (!existing) return;

    const endedAt =
      status !== "running" ? new Date().toISOString() : existing.endedAt;
    sessions.set(sessionId, { ...existing, status, endedAt });
    set({ sessions });
  },

  switchSession: (sessionId) => {
    set({ activeSessionId: sessionId });
  },

  addMessage: (sessionId, message) => {
    const msgMap = new Map(get().messagesBySession);
    const existing = msgMap.get(sessionId) ?? [];
    msgMap.set(sessionId, [...existing, message]);
    set({ messagesBySession: msgMap });
  },

  setMessages: (sessionId, messages) => {
    const msgMap = new Map(get().messagesBySession);
    msgMap.set(sessionId, messages);
    set({ messagesBySession: msgMap });
  },

  queueMessage: (sessionId, content) => {
    const queued: QueuedMessage = {
      id: crypto.randomUUID(),
      sessionId,
      content,
      createdAt: new Date().toISOString(),
    };
    set({ messageQueue: [...get().messageQueue, queued] });
    return queued;
  },

  dequeueMessage: (sessionId) => {
    const queue = get().messageQueue;
    const idx = queue.findIndex((m) => m.sessionId === sessionId);
    if (idx === -1) return undefined;

    const message = queue[idx];
    const newQueue = [...queue.slice(0, idx), ...queue.slice(idx + 1)];
    set({ messageQueue: newQueue });
    return message;
  },

  cancelQueuedMessage: (messageId) => {
    const filtered = get().messageQueue.filter((m) => m.id !== messageId);
    set({ messageQueue: filtered });
  },

  editQueuedMessage: (messageId, content) => {
    const updated = get().messageQueue.map((m) =>
      m.id === messageId ? { ...m, content } : m,
    );
    set({ messageQueue: updated });
  },

  saveScrollPosition: (sessionId, position) => {
    const scrollMap = new Map(get().scrollPositionBySession);
    scrollMap.set(sessionId, position);
    set({ scrollPositionBySession: scrollMap });
  },

  getScrollPosition: (sessionId) => {
    return get().scrollPositionBySession.get(sessionId) ?? 0;
  },

  setSessionStartedAt: (sessionId, timestamp) => {
    const startedMap = new Map(get().sessionStartedAt);
    startedMap.set(sessionId, timestamp);
    set({ sessionStartedAt: startedMap });
  },

  setSessionElapsed: (sessionId, ms) => {
    const elapsedMap = new Map(get().sessionElapsedMs);
    elapsedMap.set(sessionId, ms);
    set({ sessionElapsedMs: elapsedMap });
  },

  setSdkSessionId: (sessionId, sdkSessionId) => {
    const sdkMap = new Map(get().sdkSessionIds);
    sdkMap.set(sessionId, sdkSessionId);
    set({ sdkSessionIds: sdkMap });
  },

  setLoading: (loading) => {
    set({ loading });
  },

  setError: (error) => {
    set({ error });
  },

  clearSessionData: (sessionId) => {
    const sessions = new Map(get().sessions);
    sessions.delete(sessionId);

    const msgMap = new Map(get().messagesBySession);
    msgMap.delete(sessionId);

    const scrollMap = new Map(get().scrollPositionBySession);
    scrollMap.delete(sessionId);

    const startedMap = new Map(get().sessionStartedAt);
    startedMap.delete(sessionId);

    const elapsedMap = new Map(get().sessionElapsedMs);
    elapsedMap.delete(sessionId);

    const sdkMap = new Map(get().sdkSessionIds);
    sdkMap.delete(sessionId);

    const queue = get().messageQueue.filter((m) => m.sessionId !== sessionId);

    const activeId = get().activeSessionId;
    set({
      sessions,
      messagesBySession: msgMap,
      messageQueue: queue,
      scrollPositionBySession: scrollMap,
      sessionStartedAt: startedMap,
      sessionElapsedMs: elapsedMap,
      sdkSessionIds: sdkMap,
      activeSessionId: activeId === sessionId ? null : activeId,
    });
  },
}));

export { useAgentStore };
export type { AgentStore, AgentState, AgentActions };
