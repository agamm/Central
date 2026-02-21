import { useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useAgentStore } from "@/features/agents/store";
import {
  AGENT_TIMEOUT_MS,
  AGENT_TIMEOUT_CHECK_INTERVAL_MS,
} from "@/core/constants";

/** Find sessions that have exceeded the timeout threshold */
function findTimedOutSessionIds(
  sessions: ReadonlyMap<string, { status: string; createdAt: string }>,
  timeoutMs: number,
): readonly string[] {
  const now = Date.now();
  const timedOut: string[] = [];

  for (const [id, session] of sessions) {
    if (session.status !== "running") continue;
    const elapsed = now - new Date(session.createdAt).getTime();
    if (elapsed > timeoutMs) {
      timedOut.push(id);
    }
  }

  return timedOut;
}

/** Abort a single timed-out session */
async function abortTimedOutSession(sessionId: string): Promise<void> {
  const store = useAgentStore.getState();

  try {
    await invoke("abort_agent_session", { sessionId });
  } catch {
    // Sidecar may already be dead; proceed with status update
  }

  store.updateSessionStatus(sessionId, "failed");
  store.setError(`Session timed out after ${AGENT_TIMEOUT_MS / 60000} minutes`);
}

/**
 * Periodically checks all running sessions and aborts those that exceed
 * the configured timeout. Runs on a fixed interval.
 *
 * Performance: interval only iterates the sessions Map, O(n) where n is
 * total session count. With 5 concurrent agents this is negligible.
 */
function useAgentTimeout(): void {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const checkTimeouts = () => {
      const { sessions } = useAgentStore.getState();
      const timedOut = findTimedOutSessionIds(sessions, AGENT_TIMEOUT_MS);

      for (const sessionId of timedOut) {
        void abortTimedOutSession(sessionId);
      }
    };

    intervalRef.current = setInterval(
      checkTimeouts,
      AGENT_TIMEOUT_CHECK_INTERVAL_MS,
    );

    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);
}

export { useAgentTimeout };
