import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import * as agentApi from "../api";
import { debugLog } from "@/shared/debugLog";
import type { AgentSession, AgentStatus } from "../types";

const ACTIVE_SESSION_KEY = "active_session_id";

interface SessionState {
  readonly sessions: ReadonlyMap<string, AgentSession>;
  readonly activeSessionId: string | null;
  readonly sdkSessionIds: ReadonlyMap<string, string>;
  readonly sessionStartedAt: ReadonlyMap<string, string>;
  readonly sessionElapsedMs: ReadonlyMap<string, number>;
  readonly sessionTokenUsage: ReadonlyMap<string, { inputTokens: number; outputTokens: number }>;
  readonly loading: boolean;
  readonly error: string | null;
}

interface SessionActions {
  readonly setSession: (session: AgentSession) => void;
  readonly updateSessionStatus: (sessionId: string, status: AgentStatus) => void;
  readonly switchSession: (sessionId: string | null) => void;
  readonly setSessionStartedAt: (sessionId: string, timestamp: string) => void;
  readonly setSessionElapsed: (sessionId: string, ms: number) => void;
  readonly setSdkSessionId: (sessionId: string, sdkSessionId: string) => void;
  readonly updateSessionTokens: (sessionId: string, inputTokens: number, outputTokens: number) => void;
  readonly setLoading: (loading: boolean) => void;
  readonly setError: (error: string | null) => void;
  readonly createSession: (projectId: string, prompt: string, model: string | null) => Promise<AgentSession | null>;
  readonly hydrate: () => Promise<void>;
  readonly clearSession: (sessionId: string) => void;
}

type SessionStore = SessionState & SessionActions;

const persistError = (op: string, e: unknown): void => {
  debugLog("STORE", `Persist failed [${op}]: ${String(e)}`);
};

const useSessionStore = create<SessionStore>()((set, get) => ({
  sessions: new Map(),
  activeSessionId: null,
  sdkSessionIds: new Map(),
  sessionStartedAt: new Map(),
  sessionElapsedMs: new Map(),
  sessionTokenUsage: new Map(),
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

    const endedAt = status !== "running" ? new Date().toISOString() : existing.endedAt;
    sessions.set(sessionId, { ...existing, status, endedAt });
    set({ sessions });
    agentApi
      .updateSessionStatus(sessionId, status, endedAt ?? undefined)
      .catch((e: unknown) => { persistError("updateSessionStatus", e); });
  },

  switchSession: (sessionId) => {
    set({ activeSessionId: sessionId });
    if (sessionId) {
      invoke("set_setting", { key: ACTIVE_SESSION_KEY, value: sessionId }).catch(() => {});
    }
  },

  setSessionStartedAt: (sessionId, timestamp) => {
    const m = new Map(get().sessionStartedAt);
    m.set(sessionId, timestamp);
    set({ sessionStartedAt: m });
  },

  setSessionElapsed: (sessionId, ms) => {
    const m = new Map(get().sessionElapsedMs);
    m.set(sessionId, ms);
    set({ sessionElapsedMs: m });
  },

  setSdkSessionId: (sessionId, sdkSessionId) => {
    const m = new Map(get().sdkSessionIds);
    m.set(sessionId, sdkSessionId);
    set({ sdkSessionIds: m });
  },

  updateSessionTokens: (sessionId, inputTokens, outputTokens) => {
    const m = new Map(get().sessionTokenUsage);
    const existing = m.get(sessionId) ?? { inputTokens: 0, outputTokens: 0 };
    m.set(sessionId, {
      inputTokens: existing.inputTokens + inputTokens,
      outputTokens: existing.outputTokens + outputTokens,
    });
    set({ sessionTokenUsage: m });
  },

  setLoading: (loading) => { set({ loading }); },
  setError: (error) => { set({ error }); },

  createSession: async (projectId, prompt, model) => {
    const result = await agentApi.createSession(projectId, prompt, model);
    if (result.isErr()) {
      set({ error: result.error });
      return null;
    }
    const session = result.value;
    const sessions = new Map(get().sessions);
    sessions.set(session.id, session);
    set({ sessions, activeSessionId: session.id });
    return session;
  },

  hydrate: async () => {
    set({ loading: true });

    const interruptResult = await agentApi.markInterruptedSessions();
    if (interruptResult.isErr()) {
      set({ error: interruptResult.error });
    }

    const sessionsResult = await agentApi.getAllSessions();
    if (sessionsResult.isErr()) {
      set({ error: sessionsResult.error, loading: false });
      return;
    }

    const sessions = new Map<string, AgentSession>();
    for (const s of sessionsResult.value) {
      sessions.set(s.id, s);
    }

    const savedSessionId = await invoke<string | null>("get_setting", { key: ACTIVE_SESSION_KEY })
      .catch(() => null);
    const restoredId = savedSessionId && sessions.has(savedSessionId)
      ? savedSessionId
      : (sessionsResult.value[0]?.id ?? null);

    set({ sessions, activeSessionId: restoredId, loading: false });
  },

  clearSession: (sessionId) => {
    const sessions = new Map(get().sessions);
    sessions.delete(sessionId);

    const startedMap = new Map(get().sessionStartedAt);
    startedMap.delete(sessionId);

    const elapsedMap = new Map(get().sessionElapsedMs);
    elapsedMap.delete(sessionId);

    const sdkMap = new Map(get().sdkSessionIds);
    sdkMap.delete(sessionId);

    const tokenMap = new Map(get().sessionTokenUsage);
    tokenMap.delete(sessionId);

    const activeId = get().activeSessionId;
    set({
      sessions,
      sessionStartedAt: startedMap,
      sessionElapsedMs: elapsedMap,
      sdkSessionIds: sdkMap,
      sessionTokenUsage: tokenMap,
      activeSessionId: activeId === sessionId ? null : activeId,
    });
  },
}));

export { useSessionStore };
export type { SessionStore, SessionState, SessionActions };
