import { useCallback } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Timer } from "lucide-react";
import { MessageBubble } from "./MessageBubble";
import { useAutoScroll } from "../hooks/useAutoScroll";
import { formatElapsedSeconds } from "../formatElapsed";
import type { ChatMessage } from "../types";

interface MessageListProps {
  readonly messages: readonly ChatMessage[];
  readonly initialScrollPosition: number;
  readonly onScrollPositionChange: (position: number) => void;
  readonly isRunning: boolean;
  readonly liveElapsedSeconds: number;
  readonly finalElapsedMs: number | null;
  readonly tokenUsage: { inputTokens: number; outputTokens: number } | null;
}

function RunningIndicator({ liveElapsedSeconds, tokenUsage }: {
  readonly liveElapsedSeconds: number;
  readonly tokenUsage: { inputTokens: number; outputTokens: number } | null;
}) {
  return (
    <div className="flex items-center gap-1.5 px-1 py-0.5 text-[11px] text-muted-foreground/70">
      <Timer className="h-2.5 w-2.5 animate-pulse" />
      <span>
        {liveElapsedSeconds > 0 ? formatElapsedSeconds(liveElapsedSeconds) : "Starting..."}
        {tokenUsage && (tokenUsage.inputTokens > 0 || tokenUsage.outputTokens > 0) && (
          <span className="ml-1.5 text-muted-foreground/50">
            {tokenUsage.inputTokens.toLocaleString()} in / {tokenUsage.outputTokens.toLocaleString()} out
          </span>
        )}
      </span>
    </div>
  );
}

function findLastAssistantIndex(messages: readonly ChatMessage[]): number {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]?.role === "assistant") return i;
  }
  return -1;
}

function MessageList({
  messages,
  initialScrollPosition,
  onScrollPositionChange,
  isRunning,
  liveElapsedSeconds,
  finalElapsedMs,
  tokenUsage,
}: MessageListProps) {
  const { bottomRef, scrollContainerRef } = useAutoScroll(messages, initialScrollPosition, isRunning);

  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const target = e.currentTarget.querySelector("[data-radix-scroll-area-viewport]");
      if (target) {
        onScrollPositionChange((target as HTMLElement).scrollTop);
      }
    },
    [onScrollPositionChange],
  );

  if (messages.length === 0) return null;

  const lastAssistantIdx = findLastAssistantIndex(messages);
  const showFinalElapsed = !isRunning && finalElapsedMs !== null;

  return (
    <ScrollArea className="flex-1 px-4" ref={scrollContainerRef} onScrollCapture={handleScroll}>
      <div className="flex flex-col gap-3 py-4">
        {messages.map((msg, idx) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            elapsedMs={showFinalElapsed && idx === lastAssistantIdx ? finalElapsedMs : undefined}
          />
        ))}
        {isRunning && <RunningIndicator liveElapsedSeconds={liveElapsedSeconds} tokenUsage={tokenUsage} />}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}

export { MessageList };
