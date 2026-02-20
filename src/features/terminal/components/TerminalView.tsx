import { TerminalIcon } from "lucide-react";
import { useTerminal } from "../hooks/useTerminal";
import { useTerminalStore, buildPtyId } from "../store";
import "@xterm/xterm/css/xterm.css";

interface TerminalViewProps {
  readonly projectId: string;
  readonly cwd: string;
}

function TerminalView({ projectId, cwd }: TerminalViewProps) {
  const { containerRef } = useTerminal({ projectId, cwd });

  return (
    <div className="flex h-full flex-col bg-background">
      <TerminalHeader projectId={projectId} />
      <div
        ref={containerRef}
        className="flex-1 overflow-hidden px-1 py-1"
        style={{ minHeight: 0 }}
      />
    </div>
  );
}

interface TerminalHeaderProps {
  readonly projectId: string;
}

function TerminalHeader({ projectId }: TerminalHeaderProps) {
  const ptyId = buildPtyId(projectId);
  const session = useTerminalStore((s) => s.sessions[ptyId]);
  const kill = useTerminalStore((s) => s.kill);

  const statusLabel = formatStatus(session?.status ?? "idle", session?.exitCode ?? null);

  return (
    <div className="flex items-center justify-between border-b border-border px-2 py-1">
      <div className="flex items-center gap-1.5">
        <TerminalIcon className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground">
          Terminal
        </span>
        <span className="text-xs text-muted-foreground/60">{statusLabel}</span>
      </div>
      {session?.status === "running" && (
        <button
          onClick={() => void kill(ptyId)}
          className="rounded px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          Kill
        </button>
      )}
    </div>
  );
}

function formatStatus(
  status: string,
  exitCode: number | null,
): string {
  switch (status) {
    case "running":
      return "running";
    case "exited":
      return exitCode === 0 ? "exited" : `exited (${String(exitCode)})`;
    default:
      return "";
  }
}

export { TerminalView };
