import { useCallback } from "react";
import { MessageSquare, TerminalSquare, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { StatusBadge } from "./StatusBadge";
import { useUIStore } from "../stores/uiStore";
import type { AgentSession } from "@/core/types";

interface SessionItemProps {
  readonly session: AgentSession;
  readonly isActive: boolean;
  readonly onSelect: (sessionId: string) => void;
  readonly onDelete?: (sessionId: string) => void;
}

function truncatePrompt(prompt: string | null, maxLength: number): string {
  if (!prompt) return "Untitled session";
  if (prompt.length <= maxLength) return prompt;
  return prompt.slice(0, maxLength).trimEnd() + "...";
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);

  if (diffMins < 1) return "now";
  if (diffMins < 60) return `${diffMins}m`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d`;
}

function SessionItem({ session, isActive, onSelect, onDelete }: SessionItemProps) {
  const pendingApprovals = useUIStore((s) => s.pendingApprovals);
  const unreadSessions = useUIStore((s) => s.unreadSessions);

  const hasApproval = Array.from(pendingApprovals.values()).some(
    (req) => req.sessionId === session.id,
  );
  const isUnread = session.status === "completed" && unreadSessions.has(session.id);
  const isTerminal = session.sessionType === "terminal";

  const handleClick = useCallback(() => {
    onSelect(session.id);
  }, [onSelect, session.id]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") onSelect(session.id);
    },
    [onSelect, session.id],
  );

  const handleDelete = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onDelete?.(session.id);
    },
    [onDelete, session.id],
  );

  const Icon = isTerminal ? TerminalSquare : MessageSquare;
  const label = isTerminal
    ? truncatePrompt(session.prompt, 30) === "Untitled session" ? "Terminal" : truncatePrompt(session.prompt, 30)
    : truncatePrompt(session.prompt, 30);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={cn(
        "group flex items-center gap-1.5 overflow-hidden rounded px-2 py-1 text-xs",
        "cursor-pointer hover:bg-accent/50",
        isActive && "border-l-2 border-l-foreground/40 bg-accent text-foreground",
      )}
    >
      <Icon className={cn("h-3 w-3 shrink-0", isActive ? "text-foreground/70" : "text-muted-foreground/60")} />
      <span className={cn("min-w-0 flex-1 truncate", isActive ? "text-foreground/90" : "text-muted-foreground")}>
        {label}
      </span>
      <span className="shrink-0 text-[9px] text-muted-foreground/40">
        {formatRelativeTime(session.createdAt)}
      </span>
      <StatusBadge
        status={session.status}
        hasApproval={hasApproval}
        isUnread={isUnread}
        className="shrink-0"
      />
      {onDelete && (
        <button
          onClick={handleDelete}
          className="shrink-0 rounded p-0.5 opacity-0 hover:bg-destructive/20 group-hover:opacity-100"
          aria-label="Delete session"
        >
          <X className="h-3 w-3 text-muted-foreground hover:text-destructive" />
        </button>
      )}
    </div>
  );
}

export { SessionItem };
