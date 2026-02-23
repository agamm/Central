import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AgentStatus } from "@/core/types";

type VisualStatus = "idle" | "working" | "awaiting_approval" | "unread" | "completed" | "failed" | "aborted" | "interrupted";

interface StatusBadgeProps {
  readonly status: AgentStatus;
  readonly isWorking?: boolean;
  readonly hasApproval?: boolean;
  readonly isUnread?: boolean;
  readonly className?: string;
}

function deriveVisualStatus(
  status: AgentStatus,
  isWorking: boolean,
  hasApproval: boolean,
  isUnread: boolean,
): VisualStatus {
  // Priority: approval > working > unread > base status
  if (hasApproval) return "awaiting_approval";
  if (isWorking) return "working";
  if (isUnread) return "unread";
  if (status === "running") return "idle"; // running but not working = idle at prompt
  if (status === "completed") return "completed";
  if (status === "failed") return "failed";
  if (status === "aborted") return "aborted";
  if (status === "interrupted") return "interrupted";
  return "idle";
}

const STATUS_DOT_STYLES: Record<VisualStatus, string> = {
  idle: "bg-zinc-500/40",
  working: "",
  completed: "bg-emerald-500/70",
  unread: "bg-blue-400 animate-pulse",
  failed: "bg-red-500/70",
  aborted: "bg-zinc-500/60",
  interrupted: "bg-amber-500/70",
  awaiting_approval: "bg-amber-400 animate-pulse",
};

const STATUS_LABELS: Record<VisualStatus, string> = {
  idle: "Idle",
  working: "Working",
  completed: "Completed",
  unread: "New Activity",
  failed: "Failed",
  aborted: "Aborted",
  interrupted: "Interrupted",
  awaiting_approval: "Needs Approval",
};

function StatusBadge({ status, isWorking = false, hasApproval = false, isUnread = false, className }: StatusBadgeProps) {
  const visual = deriveVisualStatus(status, isWorking, hasApproval, isUnread);

  if (visual === "working") {
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
