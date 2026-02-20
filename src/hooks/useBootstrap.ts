import { useEffect, useState } from "react";
import { useAgentStore } from "@/features/agents/store";
import * as agentApi from "@/features/agents/api";
import type { AgentSession } from "@/core/types";
import type { ChatMessage } from "@/features/agents/types";

interface BootstrapState {
  readonly loading: boolean;
  readonly error: string | null;
}

/** Populate the agent store from persisted sessions + messages */
async function restoreSessions(): Promise<void> {
  const store = useAgentStore.getState();

  const interruptResult = await agentApi.markInterruptedSessions();
  if (interruptResult.isErr()) {
    store.setError(interruptResult.error);
  }

  const sessionsResult = await agentApi.getAllSessions();
  if (sessionsResult.isErr()) {
    store.setError(sessionsResult.error);
    return;
  }

  const sessions = sessionsResult.value;
  populateSessionStore(sessions, store);

  const lastSession = findLastActiveSession(sessions);
  if (lastSession) {
    await restoreLastSession(lastSession, store);
  }
}

function populateSessionStore(
  sessions: readonly AgentSession[],
  store: ReturnType<typeof useAgentStore.getState>,
): void {
  for (const session of sessions) {
    store.setSession(session);
  }
}

/** Find the most recently created session (already sorted DESC) */
function findLastActiveSession(
  sessions: readonly AgentSession[],
): AgentSession | undefined {
  return sessions[0];
}

async function restoreLastSession(
  session: AgentSession,
  store: ReturnType<typeof useAgentStore.getState>,
): Promise<void> {
  store.switchSession(session.id);

  const messagesResult = await agentApi.getMessages(session.id);
  if (messagesResult.isOk()) {
    const chatMessages: readonly ChatMessage[] = messagesResult.value.map(
      (m) => ({ ...m, isStreaming: false }),
    );
    store.setMessages(session.id, chatMessages);
  }
}

/**
 * On app mount: restore sessions from SQLite, mark running->interrupted.
 * Load the message history for the last active session.
 */
function useBootstrap(): BootstrapState {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      try {
        await restoreSessions();
      } catch (e) {
        if (!cancelled) {
          setError(`Bootstrap failed: ${String(e)}`);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void boot();

    return () => {
      cancelled = true;
    };
  }, []);

  return { loading, error };
}

export { useBootstrap };
export type { BootstrapState };
