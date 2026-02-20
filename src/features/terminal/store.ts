import { create } from "zustand";
import type { TerminalSession } from "./types";
import * as terminalApi from "./api";

interface TerminalState {
  readonly sessions: Readonly<Record<string, TerminalSession>>;
  readonly error: string | null;
}

interface TerminalActions {
  readonly spawn: (
    projectId: string,
    cwd: string,
    rows: number,
    cols: number,
  ) => Promise<boolean>;
  readonly write: (ptyId: string, data: string) => Promise<void>;
  readonly resize: (
    ptyId: string,
    rows: number,
    cols: number,
  ) => Promise<void>;
  readonly kill: (ptyId: string) => Promise<void>;
  readonly markExited: (ptyId: string, code: number | null) => void;
  readonly removeSession: (ptyId: string) => void;
  readonly getSessionForProject: (
    projectId: string,
  ) => TerminalSession | undefined;
  readonly clearError: () => void;
}

type TerminalStore = TerminalState & TerminalActions;

function buildPtyId(projectId: string): string {
  return `pty-${projectId}`;
}

const useTerminalStore = create<TerminalStore>()((set, get) => ({
  sessions: {},
  error: null,

  spawn: async (projectId, cwd, rows, cols) => {
    const ptyId = buildPtyId(projectId);

    // Kill existing session for this project if present
    const existing = get().sessions[ptyId];
    if (existing && existing.status === "running") {
      await terminalApi.ptyKill(ptyId);
    }

    const result = await terminalApi.ptySpawn(ptyId, cwd, rows, cols);

    return result.match(
      () => {
        const session: TerminalSession = {
          ptyId,
          projectId,
          status: "running",
          exitCode: null,
        };
        set((state) => ({
          sessions: { ...state.sessions, [ptyId]: session },
          error: null,
        }));
        return true;
      },
      (error) => {
        set({ error });
        return false;
      },
    );
  },

  write: async (ptyId, data) => {
    const result = await terminalApi.ptyWrite(ptyId, data);
    result.match(
      () => {},
      (error) => { set({ error }); },
    );
  },

  resize: async (ptyId, rows, cols) => {
    const result = await terminalApi.ptyResize(ptyId, rows, cols);
    result.match(
      () => {},
      (error) => { set({ error }); },
    );
  },

  kill: async (ptyId) => {
    const result = await terminalApi.ptyKill(ptyId);
    result.match(
      () => {
        set((state) => {
          const sessions = Object.fromEntries(
            Object.entries(state.sessions).filter(([k]) => k !== ptyId),
          );
          return { sessions };
        });
      },
      (error) => { set({ error }); },
    );
  },

  markExited: (ptyId, code) => {
    set((state) => {
      const session = state.sessions[ptyId];
      if (!session) return state;
      return {
        sessions: {
          ...state.sessions,
          [ptyId]: { ...session, status: "exited", exitCode: code },
        },
      };
    });
  },

  removeSession: (ptyId) => {
    set((state) => {
      const sessions = Object.fromEntries(
        Object.entries(state.sessions).filter(([k]) => k !== ptyId),
      );
      return { sessions };
    });
  },

  getSessionForProject: (projectId) => {
    const ptyId = buildPtyId(projectId);
    return get().sessions[ptyId];
  },

  clearError: () => { set({ error: null }); },
}));

export { useTerminalStore, buildPtyId };
export type { TerminalStore, TerminalState, TerminalActions };
