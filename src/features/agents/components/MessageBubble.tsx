import { cn } from "@/lib/utils";
import { ThinkingBlock } from "./ThinkingBlock";
import { ToolCallBlock } from "./ToolCallBlock";
import type { ToolCallInfo } from "./ToolCallBlock";
import type { ChatMessage } from "../types";

interface MessageBubbleProps {
  readonly message: ChatMessage;
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

function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const toolCalls = parseToolCalls(message.toolCalls);
  const timeStr = formatTimestamp(message.timestamp);

  return (
    <div
      className={cn(
        "flex w-full",
        isUser ? "justify-end" : "justify-start",
      )}
    >
      <div
        className={cn(
          "max-w-[85%] rounded-lg px-3 py-2",
          isUser
            ? "bg-primary/10 text-foreground"
            : "bg-muted text-foreground",
        )}
      >
        {message.content && (
          <div className="text-sm whitespace-pre-wrap break-words select-text">
            {message.content}
          </div>
        )}

        {message.thinking && <ThinkingBlock thinking={message.thinking} />}

        {toolCalls.length > 0 && <ToolCallBlock toolCalls={toolCalls} />}

        {timeStr && (
          <div
            className={cn(
              "mt-1 text-[10px] text-muted-foreground",
              isUser ? "text-right" : "text-left",
            )}
          >
            {timeStr}
          </div>
        )}
      </div>
    </div>
  );
}

export { MessageBubble };
