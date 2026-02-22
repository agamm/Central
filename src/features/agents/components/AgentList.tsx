import { useEffect, useState, useCallback } from "react";
import { useAgentStore } from "../store";
import * as agentApi from "../api";
import { SessionItem } from "./SessionItem";
import type { AgentSession } from "@/core/types";

interface AgentListProps {
  readonly projectId: string;
  readonly onSessionSelect: (sessionId: string, projectId: string) => void;
  readonly onSessionDelete?: (sessionId: string) => void;
}

function AgentList({ projectId, onSessionSelect, onSessionDelete }: AgentListProps) {
  const [projectSessions, setProjectSessions] = useState<
    readonly AgentSession[]
  >([]);
  const activeSessionId = useAgentStore((s) => s.activeSessionId);
  const sessions = useAgentStore((s) => s.sessions);

  useEffect(() => {
    let cancelled = false;

    const fetchSessions = async () => {
      const result = await agentApi.listSessions(projectId);
      if (cancelled) return;

      result.match(
        (fetched) => {
          setProjectSessions(fetched);
        },
        () => {
          setProjectSessions([]);
        },
      );
    };

    void fetchSessions();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  // Merge live store sessions with DB-fetched sessions
  const mergedSessions = mergeSessions(projectSessions, sessions, projectId);

  const handleSelect = useCallback(
    (sessionId: string) => {
      onSessionSelect(sessionId, projectId);
    },
    [onSessionSelect, projectId],
  );

  const handleDelete = useCallback(
    (sessionId: string) => {
      // Remove from local state so it disappears from the list immediately
      setProjectSessions((prev) => prev.filter((s) => s.id !== sessionId));
      // Propagate to parent for DB + store cleanup
      onSessionDelete?.(sessionId);
    },
    [onSessionDelete],
  );

  return (
    <div className="flex flex-col gap-0.5 pl-4">
      {mergedSessions.map((session) => (
        <SessionItem
          key={session.id}
          session={session}
          isActive={activeSessionId === session.id}
          onSelect={handleSelect}
          onDelete={handleDelete}
        />
      ))}
    </div>
  );
}

/** Merge DB sessions with live store sessions, preferring store for status */
function mergeSessions(
  dbSessions: readonly AgentSession[],
  storeSessions: ReadonlyMap<string, AgentSession>,
  projectId: string,
): readonly AgentSession[] {
  const merged = new Map<string, AgentSession>();

  for (const session of dbSessions) {
    merged.set(session.id, session);
  }

  // Store sessions may have newer status updates
  for (const [id, session] of storeSessions) {
    if (session.projectId === projectId) {
      merged.set(id, session);
    }
  }

  return [...merged.values()].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export { AgentList };
