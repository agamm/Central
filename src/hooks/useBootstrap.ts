import { useEffect } from "react";
import { useAgentStore } from "@/features/agents/store";

interface BootstrapState {
  readonly loading: boolean;
  readonly error: string | null;
}

/**
 * On app mount: restore sessions from SQLite, mark running->interrupted.
 * Load the message history for the last active session.
 * Loading/error state is managed by store.hydrate().
 */
function useBootstrap(): BootstrapState {
  const loading = useAgentStore((s) => s.loading);
  const error = useAgentStore((s) => s.error);

  useEffect(() => {
    void useAgentStore.getState().hydrate();
  }, []);

  return { loading, error };
}

export { useBootstrap };
export type { BootstrapState };
