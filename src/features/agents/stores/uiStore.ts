import { create } from "zustand";
import type { ToolApprovalRequest } from "../types";

type TerminalPhase = "idle" | "working" | "done";

interface UIState {
  readonly scrollPositionBySession: ReadonlyMap<string, number>;
  readonly pendingApprovals: ReadonlyMap<string, ToolApprovalRequest>;
  readonly promptFocusTrigger: number;
  readonly unreadSessions: ReadonlySet<string>;
  readonly terminalPhases: ReadonlyMap<string, TerminalPhase>;
}

interface UIActions {
  readonly saveScrollPosition: (sessionId: string, position: number) => void;
  readonly getScrollPosition: (sessionId: string) => number;
  readonly addPendingApproval: (req: ToolApprovalRequest) => void;
  readonly removePendingApproval: (requestId: string) => void;
  readonly triggerPromptFocus: () => void;
  readonly clearUI: (sessionId: string) => void;
  readonly markSessionRead: (sessionId: string) => void;
  readonly markSessionUnread: (sessionId: string) => void;
  readonly setTerminalPhase: (sessionId: string, phase: TerminalPhase) => void;
}

type UIStore = UIState & UIActions;

const useUIStore = create<UIStore>()((set, get) => ({
  scrollPositionBySession: new Map(),
  pendingApprovals: new Map(),
  promptFocusTrigger: 0,
  unreadSessions: new Set(),
  terminalPhases: new Map(),

  saveScrollPosition: (sessionId, position) => {
    const m = new Map(get().scrollPositionBySession);
    m.set(sessionId, position);
    set({ scrollPositionBySession: m });
  },

  getScrollPosition: (sessionId) => {
    return get().scrollPositionBySession.get(sessionId) ?? 0;
  },

  addPendingApproval: (req) => {
    const m = new Map(get().pendingApprovals);
    m.set(req.requestId, req);
    set({ pendingApprovals: m });
  },

  triggerPromptFocus: () => {
    set({ promptFocusTrigger: get().promptFocusTrigger + 1 });
  },

  removePendingApproval: (requestId) => {
    const m = new Map(get().pendingApprovals);
    m.delete(requestId);
    set({ pendingApprovals: m });
  },

  markSessionRead: (sessionId) => {
    const s = new Set(get().unreadSessions);
    s.delete(sessionId);
    set({ unreadSessions: s });
  },

  markSessionUnread: (sessionId) => {
    const s = new Set(get().unreadSessions);
    s.add(sessionId);
    set({ unreadSessions: s });
  },

  setTerminalPhase: (sessionId, phase) => {
    const m = new Map(get().terminalPhases);
    m.set(sessionId, phase);
    set({ terminalPhases: m });
  },

  clearUI: (sessionId) => {
    const scrollMap = new Map(get().scrollPositionBySession);
    scrollMap.delete(sessionId);

    const approvals = new Map(get().pendingApprovals);
    for (const [reqId, req] of approvals) {
      if (req.sessionId === sessionId) approvals.delete(reqId);
    }

    const readSet = new Set(get().unreadSessions);
    readSet.delete(sessionId);

    const phaseMap = new Map(get().terminalPhases);
    phaseMap.delete(sessionId);

    set({ scrollPositionBySession: scrollMap, pendingApprovals: approvals, unreadSessions: readSet, terminalPhases: phaseMap });
  },
}));

export { useUIStore };
export type { UIStore, UIState, UIActions, TerminalPhase };
