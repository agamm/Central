import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AgentStatus } from "@/core/types";

type VisualStatus = "hidden" | "working" | "awaiting_approval" | "unread" | "failed";

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
  if (hasApproval) return "awaiting_approval";
  if (isWorking) return "working";
  if (isUnread) return "unread";
  if (status === "failed") return "failed";
  return "hidden";
}

const STATUS_DOT_STYLES: Record<VisualStatus, string> = {
  hidden: "",
  working: "",
  unread: "bg-blue-400 animate-pulse",
  failed: "bg-red-500/70",
  awaiting_approval: "bg-amber-400 animate-pulse",
};

const STATUS_LABELS: Record<VisualStatus, string> = {
  hidden: "",
  working: "Working",
  unread: "New Activity",
  failed: "Failed",
  awaiting_approval: "Needs Approval",
};

function StatusBadge({ status, isWorking = false, hasApproval = false, isUnread = false, className }: StatusBadgeProps) {
  const visual = deriveVisualStatus(status, isWorking, hasApproval, isUnread);

  if (visual === "hidden") return null;

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
