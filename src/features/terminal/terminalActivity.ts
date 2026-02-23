/**
 * Terminal activity state machine.
 *
 * Tracks output bursts to determine whether a terminal CLI is actively
 * working or idle. Generic — works with any TUI (claude, codex, etc.)
 * because Ink-based apps redraw continuously while working and go silent
 * when idle at the prompt.
 *
 * States:  idle → working → done → idle
 *                    ↑        │
 *                    └────────┘  (new output)
 *
 * Transitions are driven by PTY output events (not xterm.js DOM events).
 */

import { useUIStore } from "@/features/agents/stores/uiStore";
import { notifySessionCompleted } from "@/features/agents/notifications";

/** Silence threshold — output gap that means "burst ended" */
const SILENCE_MS = 500;
/** Delay before showing spinner — filters out brief output blips */
const WORKING_DELAY_MS = 400;
/** Minimum burst duration to count as real work (not just keystroke echo) */
const MIN_WORK_MS = 2000;

interface Tracker {
  burstStartedAt: number;
  silenceTimer: ReturnType<typeof setTimeout> | null;
  /** Fires after WORKING_DELAY_MS to show spinner — null once fired or cleared */
  workingTimer: ReturnType<typeof setTimeout> | null;
}

const trackers = new Map<string, Tracker>();

function getTracker(sessionId: string): Tracker {
  let t = trackers.get(sessionId);
  if (!t) {
    t = { burstStartedAt: 0, silenceTimer: null, workingTimer: null };
    trackers.set(sessionId, t);
  }
  return t;
}

/** Call on every PTY output event. Drives idle → working → done. */
function trackTerminalOutput(sessionId: string): void {
  const t = getTracker(sessionId);

  // Start of a new burst
  if (t.burstStartedAt === 0) {
    t.burstStartedAt = Date.now();
    // Don't set "working" immediately — wait to see if output sustains
    t.workingTimer = setTimeout(() => {
      t.workingTimer = null;
      useUIStore.getState().setTerminalPhase(sessionId, "working");
    }, WORKING_DELAY_MS);
  }

  // Reset silence timer on every output
  if (t.silenceTimer) clearTimeout(t.silenceTimer);
  t.silenceTimer = setTimeout(() => {
    const duration = Date.now() - t.burstStartedAt;
    t.burstStartedAt = 0;
    t.silenceTimer = null;

    // Cancel pending working transition if burst was too short
    if (t.workingTimer) {
      clearTimeout(t.workingTimer);
      t.workingTimer = null;
    }

    if (duration >= MIN_WORK_MS) {
      // working → done (real work finished)
      const store = useUIStore.getState();
      store.setTerminalPhase(sessionId, "done");
      store.markSessionUnread(sessionId);
      notifySessionCompleted("Terminal", sessionId);
    } else {
      // Brief blip — stay idle (or revert to idle if working was shown)
      useUIStore.getState().setTerminalPhase(sessionId, "idle");
    }
  }, SILENCE_MS);
}

/** Call when the PTY process exits. */
function trackTerminalExit(sessionId: string): void {
  const t = getTracker(sessionId);
  if (t.silenceTimer) clearTimeout(t.silenceTimer);
  if (t.workingTimer) clearTimeout(t.workingTimer);
  t.burstStartedAt = 0;
  t.silenceTimer = null;
  t.workingTimer = null;

  const store = useUIStore.getState();
  store.setTerminalPhase(sessionId, "done");
  store.markSessionUnread(sessionId);
  notifySessionCompleted("Terminal", sessionId);
}

/** Call when the terminal session is deleted. */
function cleanupTerminalTracker(sessionId: string): void {
  const t = trackers.get(sessionId);
  if (t) {
    if (t.silenceTimer) clearTimeout(t.silenceTimer);
    if (t.workingTimer) clearTimeout(t.workingTimer);
  }
  trackers.delete(sessionId);
}

export { trackTerminalOutput, trackTerminalExit, cleanupTerminalTracker };
