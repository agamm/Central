import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
  onAction,
} from "@tauri-apps/plugin-notification";
import type { Options } from "@tauri-apps/plugin-notification";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useAgentStore } from "./store";
import { debugLog } from "@/shared/debugLog";

/**
 * Tracks the sessionId from the most recently fired notification.
 * Used as a fallback when the native onAction listener doesn't fire
 * (e.g. on some macOS versions where web-api notifications don't
 * route through the Tauri plugin action system).
 */
let pendingNotificationSessionId: string | null = null;

/** Whether the onAction listener has been registered. */
let listenerInitialized = false;

/**
 * Routes a notification click to the correct session.
 * Brings the window to front and switches the active session.
 */
function routeToSession(sessionId: string): void {
  debugLog("NOTIFICATION", `Routing to session: ${sessionId}`);
  useAgentStore.getState().switchSession(sessionId);
  void getCurrentWindow().setFocus();
}

/**
 * Initializes the notification action listener (once).
 * When the user clicks a notification, onAction fires with the
 * original Options object including `extra.sessionId`.
 */
function initNotificationListener(): void {
  if (listenerInitialized) return;
  listenerInitialized = true;

  void onAction((notification: Options) => {
    debugLog("NOTIFICATION", `onAction fired: ${JSON.stringify(notification.extra)}`);
    const sessionId = notification.extra?.sessionId;
    if (typeof sessionId === "string" && sessionId.length > 0) {
      pendingNotificationSessionId = null;
      routeToSession(sessionId);
    }
  });

  // Fallback: when app window regains focus, route to last notified session.
  // This handles cases where onAction doesn't fire (web-api notification path).
  window.addEventListener("focus", () => {
    if (pendingNotificationSessionId) {
      const sessionId = pendingNotificationSessionId;
      pendingNotificationSessionId = null;
      routeToSession(sessionId);
    }
  });

  debugLog("NOTIFICATION", "Listener initialized");
}

async function ensureNotificationPermission(): Promise<boolean> {
  let granted = await isPermissionGranted();

  if (!granted) {
    const permission = await requestPermission();
    granted = permission === "granted";
  }

  return granted;
}

async function sendAgentNotification(
  title: string,
  body: string,
  sessionId: string,
): Promise<void> {
  const granted = await ensureNotificationPermission();
  if (!granted) return;

  initNotificationListener();

  pendingNotificationSessionId = sessionId;

  sendNotification({
    title,
    body,
    extra: { sessionId },
  });
}

function notifySessionCompleted(
  prompt: string | null,
  sessionId: string,
): void {
  const truncated = truncateForNotification(prompt);
  void sendAgentNotification(
    "Agent Completed",
    `Session finished: ${truncated}`,
    sessionId,
  );
}

function notifySessionFailed(
  prompt: string | null,
  error: string,
  sessionId: string,
): void {
  const truncated = truncateForNotification(prompt);
  void sendAgentNotification(
    "Agent Failed",
    `${truncated} - ${error}`,
    sessionId,
  );
}

function truncateForNotification(text: string | null): string {
  if (!text) return "Untitled session";
  if (text.length <= 60) return text;
  return text.slice(0, 57).trimEnd() + "...";
}

export { notifySessionCompleted, notifySessionFailed };
