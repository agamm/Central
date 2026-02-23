import { invoke, Channel } from "@tauri-apps/api/core";

/** PTY event types sent from Rust backend */
interface PtyOutputEvent {
  readonly type: "Output";
  readonly data: string;
}

interface PtyExitEvent {
  readonly type: "Exit";
  readonly code: number;
}

interface PtyErrorEvent {
  readonly type: "Error";
  readonly message: string;
}

type PtyEvent = PtyOutputEvent | PtyExitEvent | PtyErrorEvent;

/** Start a terminal PTY session running `claude` CLI */
async function startTerminal(
  sessionId: string,
  cwd: string,
  rows: number,
  cols: number,
  onEvent: (event: PtyEvent) => void,
): Promise<void> {
  const channel = new Channel<PtyEvent>();
  channel.onmessage = onEvent;

  await invoke("start_terminal", {
    sessionId,
    cwd,
    rows,
    cols,
    onEvent: channel,
  });
}

/** Write base64-encoded input to a PTY session */
async function writeTerminalInput(
  sessionId: string,
  data: string,
): Promise<void> {
  await invoke("write_terminal_input", { sessionId, data });
}

/** Resize a PTY session */
async function resizeTerminal(
  sessionId: string,
  rows: number,
  cols: number,
): Promise<void> {
  await invoke("resize_terminal", { sessionId, rows, cols });
}

/** Close a PTY session */
async function closeTerminal(sessionId: string): Promise<void> {
  await invoke("close_terminal", { sessionId });
}

export {
  startTerminal,
  writeTerminalInput,
  resizeTerminal,
  closeTerminal,
};
export type { PtyEvent };
