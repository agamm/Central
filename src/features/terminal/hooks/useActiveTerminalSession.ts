import { useAgentStore } from "@/features/agents/store";
import { useProjectStore } from "@/features/projects/store";
import type { AgentSession } from "@/core/types";

/** Derive the active terminal session (if any) from the agent store */
function useActiveTerminalSession(): AgentSession | null {
  const activeSessionId = useAgentStore((s) => s.activeSessionId);
  const sessions = useAgentStore((s) => s.sessions);
  const selectedProjectId = useProjectStore((s) => s.selectedProjectId);

  if (!activeSessionId || !selectedProjectId) return null;

  const session = sessions.get(activeSessionId);
  if (!session || session.projectId !== selectedProjectId) return null;
  if (session.sessionType !== "terminal") return null;

  return session;
}

export { useActiveTerminalSession };
