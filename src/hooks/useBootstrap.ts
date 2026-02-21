import { useEffect } from "react";
import { useAgentStore } from "@/features/agents/store";
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
      // Hydrate agents (sessions, messages)
      await useAgentStore.getState().hydrate();

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
