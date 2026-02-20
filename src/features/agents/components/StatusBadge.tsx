import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AgentStatus } from "@/core/types";

interface StatusBadgeProps {
  readonly status: AgentStatus;
  readonly className?: string;
}

const STATUS_DOT_STYLES: Record<AgentStatus, string> = {
  running: "",
  completed: "bg-emerald-500",
  failed: "bg-red-500",
  aborted: "bg-zinc-500",
  interrupted: "bg-amber-500",
};

const STATUS_LABELS: Record<AgentStatus, string> = {
  running: "Running",
  completed: "Completed",
  failed: "Failed",
  aborted: "Aborted",
  interrupted: "Interrupted",
};

function StatusBadge({ status, className }: StatusBadgeProps) {
  if (status === "running") {
    return (
      <Loader2
        className={cn(
          "h-3 w-3 shrink-0 animate-spin text-blue-400",
          className,
        )}
        aria-label={STATUS_LABELS[status]}
      />
    );
  }

  return (
    <span
      className={cn(
        "h-2 w-2 shrink-0 rounded-full",
        STATUS_DOT_STYLES[status],
        className,
      )}
      aria-label={STATUS_LABELS[status]}
    />
  );
}

export { StatusBadge };
export type { StatusBadgeProps };
