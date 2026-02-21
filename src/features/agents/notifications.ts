import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";

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
): Promise<void> {
  const granted = await ensureNotificationPermission();
  if (!granted) return;

  sendNotification({ title, body });
}

function notifySessionCompleted(prompt: string | null): void {
  const truncated = truncateForNotification(prompt);
  void sendAgentNotification(
    "Agent Completed",
    `Session finished: ${truncated}`,
  );
}

function notifySessionFailed(prompt: string | null, error: string): void {
  const truncated = truncateForNotification(prompt);
  void sendAgentNotification("Agent Failed", `${truncated} - ${error}`);
}

function truncateForNotification(text: string | null): string {
  if (!text) return "Untitled session";
  if (text.length <= 60) return text;
  return text.slice(0, 57).trimEnd() + "...";
}

export { notifySessionCompleted, notifySessionFailed };
