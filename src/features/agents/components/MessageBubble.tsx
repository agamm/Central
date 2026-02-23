import { Timer, LogIn, Terminal, Copy, Check } from "lucide-react";
import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { ThinkingBlock } from "./ThinkingBlock";
import { ToolCallBlock } from "./ToolCallBlock";
import { MarkdownContent } from "./MarkdownContent";
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
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

const AUTH_CMD = "claude auth login";

function isAuthError(content: string | null): boolean {
  if (!content) return false;
  return content.includes("Not logged in") || content.includes("Please run /login");
}

function AuthCard() {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    void navigator.clipboard.writeText(AUTH_CMD);
    setCopied(true);
    setTimeout(() => { setCopied(false); }, 2000);
  }, []);

  return (
    <div className="flex flex-col gap-2.5 rounded-md border border-border/60 bg-muted/20 px-4 py-3">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground/90">
        <LogIn className="h-4 w-4 text-yellow-500" />
        Not logged in
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">
        Claude requires authentication. Run this command in a terminal:
      </p>
      <div className="flex items-center gap-2">
        <code className="flex-1 rounded bg-background/80 px-3 py-1.5 font-mono text-xs text-foreground/80">
          <Terminal className="mr-1.5 inline h-3 w-3 text-muted-foreground" />
          {AUTH_CMD}
        </code>
        <button
          type="button"
          onClick={handleCopy}
          className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      </div>
      <p className="text-[10px] text-muted-foreground/60">
        After logging in, start a new session to reconnect.
      </p>
    </div>
  );
}

function UserMessageContent({ content }: { readonly content: string }) {
  return (
    <div className="select-text whitespace-pre-wrap break-words text-sm leading-relaxed">
      {content}
    </div>
  );
}

function AssistantMessageContent({ content, isStreaming }: { readonly content: string; readonly isStreaming: boolean }) {
  if (isAuthError(content)) return <AuthCard />;
  return (
    <span>
      <MarkdownContent content={content} />
      {isStreaming && (
        <span className="inline-block h-4 w-0.5 animate-pulse bg-foreground/60 align-text-bottom" />
      )}
    </span>
  );
}

function MessageTimestamp({ timeStr, elapsedMs, isUser }: { readonly timeStr: string; readonly elapsedMs?: number; readonly isUser: boolean }) {
  return (
    <div className={cn("mt-1 flex items-center gap-2 text-[10px] text-muted-foreground", isUser ? "justify-end" : "justify-start")}>
      {timeStr && <span>{timeStr}</span>}
      {elapsedMs !== undefined && elapsedMs > 0 && (
        <span className="flex items-center gap-0.5">
          <Timer className="h-2.5 w-2.5" />
          {formatElapsedMs(elapsedMs)}
        </span>
      )}
    </div>
  );
}

function MessageBubble({ message, elapsedMs }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";
  const isStreaming = message.isStreaming === true;
  const toolCalls = parseToolCalls(message.toolCalls);
  const timeStr = formatTimestamp(message.timestamp);

  return (
    <div className={cn("flex w-full", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-lg px-3 py-2",
          isUser
            ? "bg-accent-primary-muted/40 border border-border/40 text-foreground/90"
            : isSystem
              ? "text-muted-foreground italic text-xs"
              : "text-foreground/85",
        )}
      >
        {!isUser && message.thinking && <ThinkingBlock thinking={message.thinking} isStreaming={isStreaming} />}
        {!isUser && toolCalls.length > 0 && <ToolCallBlock toolCalls={toolCalls} />}

        {message.content && (
          isUser
            ? <UserMessageContent content={message.content} />
            : <AssistantMessageContent content={message.content} isStreaming={isStreaming} />
        )}

        {isStreaming && !message.content && toolCalls.length === 0 && (
          <span className="inline-block h-4 w-0.5 animate-pulse bg-foreground/60" />
        )}

        {!isStreaming && (message.content || isUser) && (
          <MessageTimestamp timeStr={timeStr} elapsedMs={elapsedMs} isUser={isUser} />
        )}
      </div>
    </div>
  );
}

export { MessageBubble };
