import { useEffect, useRef, useCallback } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Timer } from "lucide-react";
import { MessageBubble } from "./MessageBubble";
import { formatElapsedSeconds } from "../formatElapsed";
import type { ChatMessage } from "../types";

interface MessageListProps {
  readonly messages: readonly ChatMessage[];
  readonly initialScrollPosition: number;
  readonly onScrollPositionChange: (position: number) => void;
  readonly isRunning: boolean;
  readonly liveElapsedSeconds: number;
  readonly finalElapsedMs: number | null;
}

/**
 * Performance: Only the active session's messages are passed here (filtered
 * in ChatPane via selector). With 5 concurrent agents, only 1 MessageList
 * renders at a time. TODO: Virtualize if message count exceeds ~500 per session.
 */
function MessageList({
  messages,
  initialScrollPosition,
  onScrollPositionChange,
  isRunning,
  liveElapsedSeconds,
  finalElapsedMs,
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isInitialMount = useRef(true);
  const lastMessageCount = useRef(messages.length);

  // Restore scroll position on mount or session switch
  useEffect(() => {
    if (!scrollContainerRef.current) return;

    if (isInitialMount.current && initialScrollPosition > 0) {
      const viewport = scrollContainerRef.current.querySelector(
        "[data-radix-scroll-area-viewport]",
      );
      if (viewport) {
        viewport.scrollTop = initialScrollPosition;
      }
    }
    isInitialMount.current = false;
  }, [initialScrollPosition]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (messages.length > lastMessageCount.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    lastMessageCount.current = messages.length;
  }, [messages.length]);

  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const target = e.currentTarget.querySelector(
        "[data-radix-scroll-area-viewport]",
      );
      if (target) {
        onScrollPositionChange((target as HTMLElement).scrollTop);
      }
    },
    [onScrollPositionChange],
  );

  if (messages.length === 0) return null;

  // Find the index of the last assistant message for attaching final elapsed
  const lastAssistantIdx = findLastAssistantIndex(messages);
  const showFinalElapsed = !isRunning && finalElapsedMs !== null;

  return (
    <ScrollArea
      className="flex-1 px-4"
      ref={scrollContainerRef}
      onScrollCapture={handleScroll}
    >
      <div className="flex flex-col gap-3 py-4">
        {messages.map((msg, idx) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            elapsedMs={
              showFinalElapsed && idx === lastAssistantIdx
                ? finalElapsedMs
                : undefined
            }
          />
        ))}

        {isRunning && liveElapsedSeconds > 0 && (
          <div className="flex items-center gap-1.5 px-1 py-1 text-xs text-muted-foreground">
            <Timer className="h-3 w-3 animate-pulse" />
            <span>{formatElapsedSeconds(liveElapsedSeconds)} elapsed</span>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}

function findLastAssistantIndex(messages: readonly ChatMessage[]): number {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg !== undefined && msg.role === "assistant") return i;
  }
  return -1;
}

export { MessageList };
