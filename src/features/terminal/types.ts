/** PTY output event payload from the Rust backend */
interface PtyOutput {
  readonly pty_id: string;
  readonly data: string;
}

/** PTY exit event payload from the Rust backend */
interface PtyExit {
  readonly pty_id: string;
  readonly code: number | null;
}

/** Terminal session status */
type TerminalStatus = "idle" | "running" | "exited";

/** Represents a terminal session for a project */
interface TerminalSession {
  readonly ptyId: string;
  readonly projectId: string;
  readonly status: TerminalStatus;
  readonly exitCode: number | null;
}

export type { PtyOutput, PtyExit, TerminalStatus, TerminalSession };
