import { create } from "zustand";
import type {
  AgentSession,
  AgentStatus,
  ChatMessage,
  QueuedMessage,
} from "./types";

interface AgentState {
  readonly sessions: ReadonlyMap<string, AgentSession>;
  readonly activeSessionId: string | null;
  readonly messagesBySession: ReadonlyMap<string, readonly ChatMessage[]>;
  readonly messageQueue: readonly QueuedMessage[];
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
  readonly queueMessage: (
    sessionId: string,
    content: string,
  ) => QueuedMessage;
  readonly dequeueMessage: (sessionId: string) => QueuedMessage | undefined;
  readonly cancelQueuedMessage: (messageId: string) => void;
  readonly editQueuedMessage: (messageId: string, content: string) => void;
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

    const queue = get().messageQueue.filter(
      (m) => m.sessionId !== sessionId,
    );

    const activeId = get().activeSessionId;
    set({
      sessions,
      messagesBySession: msgMap,
      messageQueue: queue,
      activeSessionId: activeId === sessionId ? null : activeId,
    });
  },
}));

export { useAgentStore };
export type { AgentStore, AgentState, AgentActions };
