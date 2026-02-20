import { useEffect, useRef, useCallback } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageBubble } from "./MessageBubble";
import type { ChatMessage } from "../types";

interface MessageListProps {
  readonly messages: readonly ChatMessage[];
  readonly initialScrollPosition: number;
  readonly onScrollPositionChange: (position: number) => void;
}

function MessageList({
  messages,
  initialScrollPosition,
  onScrollPositionChange,
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

  return (
    <ScrollArea
      className="flex-1 px-4"
      ref={scrollContainerRef}
      onScrollCapture={handleScroll}
    >
      <div className="flex flex-col gap-3 py-4">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}

export { MessageList };
