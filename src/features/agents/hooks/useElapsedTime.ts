import { useEffect, useSyncExternalStore } from "react";

/**
 * Module-level timer store. Only one timer is needed at a time since
 * only one session is visible in the ChatPane. When the active session
 * changes, the previous timer is stopped and a new one starts.
 */
let snapshot = 0;
let intervalId: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<() => void>();

function notify(): void {
  for (const cb of listeners) {
    cb();
  }
}

function start(startMs: number): void {
  stop();
  snapshot = Math.floor((Date.now() - startMs) / 1000);
  notify();

  intervalId = setInterval(() => {
    snapshot = Math.floor((Date.now() - startMs) / 1000);
    notify();
  }, 1000);
}

function stop(): void {
  if (intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

function reset(): void {
  stop();
  snapshot = 0;
  notify();
}

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

function getSnapshot(): number {
  return snapshot;
}

/**
 * Returns the number of elapsed seconds since `startTimestamp`.
 * Updates every second while `isRunning` is true.
 * Returns 0 if no start timestamp is provided or not running.
 */
function useElapsedTime(
  startTimestamp: string | null,
  isRunning: boolean,
): number {
  useEffect(() => {
    if (!startTimestamp || !isRunning) {
      reset();
      return;
    }

    const startMs = new Date(startTimestamp).getTime();
    start(startMs);

    return () => {
      stop();
    };
  }, [startTimestamp, isRunning]);

  return useSyncExternalStore(subscribe, getSnapshot);
}

export { useElapsedTime };
