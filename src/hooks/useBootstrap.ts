import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useAgentStore } from "@/features/agents/store";
import { useSessionStore, useMessageStore } from "@/features/agents/stores";
import { useProjectStore } from "@/features/projects/store";

interface BootstrapState {
  readonly loading: boolean;
  readonly error: string | null;
}

/**
 * On app mount: restore sessions from SQLite, mark running->interrupted.
 * Load the message history for the last active session.
 * Restore persisted project and session selections.
 */
function useBootstrap(): BootstrapState {
  const loading = useAgentStore((s) => s.loading);
  const error = useAgentStore((s) => s.error);

  useEffect(() => {
    const boot = async () => {
      // Truncate debug log for clean state on each frontend load
      await invoke("debug_log", { source: "BOOTSTRAP", message: "TRUNCATE" }).catch(() => {});

      // Hydrate sessions, then load messages for the active session
      await useSessionStore.getState().hydrate();
      const restoredId = useSessionStore.getState().activeSessionId;
      if (restoredId) {
        await useMessageStore.getState().hydrateMessages(restoredId);
      }

      // Fetch projects, then restore the last selected project
      await useProjectStore.getState().fetchProjects();
      await useProjectStore.getState().restoreSelection();
    };
    void boot();
  }, []);

  return { loading, error };
}

export { useBootstrap };
export type { BootstrapState };
