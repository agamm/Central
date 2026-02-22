import { useEffect, useRef } from "react";
import type { ChatMessage } from "../types";

interface AutoScrollRefs {
  readonly bottomRef: React.RefObject<HTMLDivElement | null>;
  readonly scrollContainerRef: React.RefObject<HTMLDivElement | null>;
}

function useAutoScroll(
  messages: readonly ChatMessage[],
  initialScrollPosition: number,
  isRunning: boolean,
): AutoScrollRefs {
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isInitialMount = useRef(true);
  const lastMessageCount = useRef(messages.length);

  useEffect(() => {
    if (!scrollContainerRef.current) return;
    if (isInitialMount.current && initialScrollPosition > 0) {
      const viewport = scrollContainerRef.current.querySelector("[data-radix-scroll-area-viewport]");
      if (viewport) {
        viewport.scrollTop = initialScrollPosition;
      }
    }
    isInitialMount.current = false;
  }, [initialScrollPosition]);

  const lastMsg = messages[messages.length - 1];
  const streamingContentLen = lastMsg?.isStreaming
    ? (lastMsg.content?.length ?? 0) + (lastMsg.thinking?.length ?? 0)
    : 0;

  useEffect(() => {
    if (messages.length > lastMessageCount.current || streamingContentLen > 0) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    lastMessageCount.current = messages.length;
  }, [messages.length, streamingContentLen]);

  useEffect(() => {
    if (isRunning) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [isRunning]);

  return { bottomRef, scrollContainerRef };
}

export { useAutoScroll };
