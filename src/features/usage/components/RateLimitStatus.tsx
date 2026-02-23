import { useState, useEffect } from "react";
import { useUsageStore } from "../store";

function formatTimeRemaining(resetsAt: number): string {
  const msRemaining = resetsAt * 1000 - Date.now();
  if (msRemaining <= 0) return "now";

  const totalMinutes = Math.floor(msRemaining / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function RateLimitStatus() {
  const rateLimitStatus = useUsageStore((s) => s.rateLimitStatus);
  const [, setTick] = useState(0);

  // Refresh countdown every minute
  useEffect(() => {
    if (!rateLimitStatus) return;
    const id = setInterval(() => {
      setTick((n) => n + 1);
    }, 60_000);
    return () => {
      clearInterval(id);
    };
  }, [rateLimitStatus]);

  if (!rateLimitStatus) return null;

  const isAllowed = rateLimitStatus.status === "allowed";
  const timeLeft = formatTimeRemaining(rateLimitStatus.resetsAt);

  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5">
      <span
        className={`h-1.5 w-1.5 shrink-0 rounded-full ${
          isAllowed ? "bg-green-500/70" : "bg-orange-500/70"
        }`}
      />
      <span className="truncate text-[10px] text-muted-foreground/60">
        {isAllowed ? (
          <>Claude Max &middot; resets {timeLeft}</>
        ) : (
          <>Rate limited &middot; resets {timeLeft}</>
        )}
      </span>
    </div>
  );
}

export { RateLimitStatus };
