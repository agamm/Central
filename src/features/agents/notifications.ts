import { invoke } from "@tauri-apps/api/core";
import { debugLog } from "@/shared/debugLog";

async function sendAgentNotification(
  title: string,
  body: string,
  sessionId: string,
): Promise<void> {
  try {
    await invoke("send_native_notification", { title, body, sessionId });
  } catch (e) {
    debugLog("NOTIFICATION", `Failed to send: ${String(e)}`);
  }
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
