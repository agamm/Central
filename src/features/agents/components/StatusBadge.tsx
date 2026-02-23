import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AgentStatus } from "@/core/types";

type VisualStatus = AgentStatus | "awaiting_approval" | "completed_unread" | "has_activity";

interface StatusBadgeProps {
  readonly status: AgentStatus;
  readonly hasApproval?: boolean;
  readonly isUnread?: boolean;
  readonly isTerminal?: boolean;
  readonly className?: string;
}

function deriveVisualStatus(
  status: AgentStatus,
  hasApproval: boolean,
  isUnread: boolean,
  isTerminal: boolean,
): VisualStatus {
  if (status === "running" && hasApproval) return "awaiting_approval";
  if (status === "running" && isUnread) return "has_activity";
  // Terminal sessions are always "running" — don't show spinner
  if (status === "running" && isTerminal) return "idle";
  if (status === "completed" && isUnread) return "completed_unread";
  return status;
}

const STATUS_DOT_STYLES: Record<VisualStatus, string> = {
  idle: "bg-zinc-500/40",
  running: "",
  completed: "bg-emerald-500/70",
  completed_unread: "bg-emerald-400 animate-pulse",
  has_activity: "bg-blue-400 animate-pulse",
  failed: "bg-red-500/70",
  aborted: "bg-zinc-500/60",
  interrupted: "bg-amber-500/70",
  awaiting_approval: "bg-amber-400 animate-pulse",
};

const STATUS_LABELS: Record<VisualStatus, string> = {
  idle: "New",
  running: "Running",
  completed: "Completed",
  completed_unread: "Completed",
  has_activity: "New Activity",
  failed: "Failed",
  aborted: "Aborted",
  interrupted: "Interrupted",
  awaiting_approval: "Needs Approval",
};

function StatusBadge({ status, hasApproval = false, isUnread = false, isTerminal = false, className }: StatusBadgeProps) {
  const visual = deriveVisualStatus(status, hasApproval, isUnread, isTerminal);

  if (visual === "running") {
    return (
      <Loader2
        className={cn(
          "h-2.5 w-2.5 shrink-0 animate-spin text-foreground/50",
          className,
        )}
        aria-label={STATUS_LABELS[visual]}
      />
    );
  }

  return (
    <span
      className={cn(
        "h-1.5 w-1.5 shrink-0 rounded-full",
        STATUS_DOT_STYLES[visual],
        className,
      )}
      aria-label={STATUS_LABELS[visual]}
    />
  );
}

export { StatusBadge, deriveVisualStatus };
export type { StatusBadgeProps, VisualStatus };
