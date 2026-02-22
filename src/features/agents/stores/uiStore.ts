import { create } from "zustand";
import type { ToolApprovalRequest } from "../types";

interface UIState {
  readonly scrollPositionBySession: ReadonlyMap<string, number>;
  readonly pendingApprovals: ReadonlyMap<string, ToolApprovalRequest>;
}

interface UIActions {
  readonly saveScrollPosition: (sessionId: string, position: number) => void;
  readonly getScrollPosition: (sessionId: string) => number;
  readonly addPendingApproval: (req: ToolApprovalRequest) => void;
  readonly removePendingApproval: (requestId: string) => void;
  readonly clearUI: (sessionId: string) => void;
}

type UIStore = UIState & UIActions;

const useUIStore = create<UIStore>()((set, get) => ({
  scrollPositionBySession: new Map(),
  pendingApprovals: new Map(),

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

  removePendingApproval: (requestId) => {
    const m = new Map(get().pendingApprovals);
    m.delete(requestId);
    set({ pendingApprovals: m });
  },

  clearUI: (sessionId) => {
    const scrollMap = new Map(get().scrollPositionBySession);
    scrollMap.delete(sessionId);

    const approvals = new Map(get().pendingApprovals);
    for (const [reqId, req] of approvals) {
      if (req.sessionId === sessionId) approvals.delete(reqId);
    }

    set({ scrollPositionBySession: scrollMap, pendingApprovals: approvals });
  },
}));

export { useUIStore };
export type { UIStore, UIState, UIActions };
