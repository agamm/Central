import { useCallback } from "react";
import { MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { StatusBadge } from "./StatusBadge";
import type { AgentSession } from "@/core/types";

interface SessionItemProps {
  readonly session: AgentSession;
  readonly isActive: boolean;
  readonly onSelect: (sessionId: string) => void;
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

function SessionItem({ session, isActive, onSelect }: SessionItemProps) {
  const handleClick = useCallback(() => {
    onSelect(session.id);
  }, [onSelect, session.id]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") onSelect(session.id);
    },
    [onSelect, session.id],
  );

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={cn(
        "group flex items-center gap-2 rounded px-2 py-1 text-xs",
        "cursor-pointer hover:bg-accent/50",
        isActive && "bg-accent/70",
      )}
    >
      <MessageSquare className="h-3 w-3 shrink-0 text-muted-foreground" />
      <span className="flex-1 truncate text-muted-foreground">
        {truncatePrompt(session.prompt, 40)}
      </span>
      <span className="shrink-0 text-[10px] text-muted-foreground/60">
        {formatRelativeTime(session.createdAt)}
      </span>
      <StatusBadge status={session.status} />
    </div>
  );
}

export { SessionItem };
