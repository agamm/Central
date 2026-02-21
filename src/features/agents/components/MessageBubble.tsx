import { Timer } from "lucide-react";
import { cn } from "@/lib/utils";
import { ThinkingBlock } from "./ThinkingBlock";
import { ToolCallBlock } from "./ToolCallBlock";
import { formatElapsedMs } from "../formatElapsed";
import type { ToolCallInfo } from "./ToolCallBlock";
import type { ChatMessage } from "../types";

interface MessageBubbleProps {
  readonly message: ChatMessage;
  readonly elapsedMs?: number;
}

function parseToolCalls(raw: string | null): ToolCallInfo[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as ToolCallInfo[];
  } catch {
    return [];
  }
}

function formatTimestamp(iso: string): string {
  try {
    const date = new Date(iso);
    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function MessageBubble({ message, elapsedMs }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const toolCalls = parseToolCalls(message.toolCalls);
  const timeStr = formatTimestamp(message.timestamp);

  return (
    <div
      className={cn("flex w-full", isUser ? "justify-end" : "justify-start")}
    >
      <div
        className={cn(
          "max-w-[85%] rounded-lg px-3 py-2",
          isUser ? "bg-accent/50 text-foreground/90" : "text-foreground/85",
        )}
      >
        {message.content && (
          <div className="select-text whitespace-pre-wrap break-words text-sm leading-relaxed">
            {message.content}
          </div>
        )}

        {message.thinking && <ThinkingBlock thinking={message.thinking} />}

        {toolCalls.length > 0 && <ToolCallBlock toolCalls={toolCalls} />}

        <div
          className={cn(
            "mt-1 flex items-center gap-2 text-[10px] text-muted-foreground",
            isUser ? "justify-end" : "justify-start",
          )}
        >
          {timeStr && <span>{timeStr}</span>}
          {elapsedMs !== undefined && elapsedMs > 0 && (
            <span className="flex items-center gap-0.5">
              <Timer className="h-2.5 w-2.5" />
              {formatElapsedMs(elapsedMs)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export { MessageBubble };
