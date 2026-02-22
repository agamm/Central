import { useState, useCallback, useRef, useEffect } from "react";
import { Send, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Per-session message history for up-arrow recall */
const historyBySession = new Map<string, string[]>();
const MAX_HISTORY = 50;

function pushHistory(sessionId: string, message: string): void {
  const history = historyBySession.get(sessionId) ?? [];
  if (history[history.length - 1] === message) return;
  history.push(message);
  if (history.length > MAX_HISTORY) history.shift();
  historyBySession.set(sessionId, history);
}

function getHistory(sessionId: string): readonly string[] {
  return historyBySession.get(sessionId) ?? [];
}

interface PromptInputProps {
  readonly onSubmit: (message: string) => void;
  readonly onAbort: () => void;
  readonly isRunning: boolean;
  readonly disabled: boolean;
  readonly placeholder?: string;
  readonly sessionId?: string;
}

function PromptInput({
  onSubmit,
  onAbort,
  isRunning,
  disabled,
  placeholder = "Send a message...",
  sessionId,
}: PromptInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // -1 = not browsing history, 0+ = index from end of history array
  const historyIndexRef = useRef(-1);
  const draftRef = useRef("");

  // Auto-focus when session changes (new chat created) or on mount
  useEffect(() => {
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
    });
  }, [sessionId]);

  // Reset history index when session changes
  useEffect(() => {
    historyIndexRef.current = -1;
    draftRef.current = "";
  }, [sessionId]);

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();
    if (trimmed.length === 0) return;
    if (sessionId) pushHistory(sessionId, trimmed);
    historyIndexRef.current = -1;
    draftRef.current = "";
    onSubmit(trimmed);
    setValue("");
  }, [value, onSubmit, sessionId]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
        return;
      }

      if (!sessionId) return;

      // Only handle up/down arrow when cursor is at position 0 (start of input)
      const textarea = e.currentTarget;
      const atStart = textarea.selectionStart === 0 && textarea.selectionEnd === 0;

      if (e.key === "ArrowUp" && atStart) {
        const history = getHistory(sessionId);
        if (history.length === 0) return;

        e.preventDefault();

        if (historyIndexRef.current === -1) {
          draftRef.current = value;
          historyIndexRef.current = history.length - 1;
        } else if (historyIndexRef.current > 0) {
          historyIndexRef.current -= 1;
        }

        setValue(history[historyIndexRef.current] ?? "");
      } else if (e.key === "ArrowDown" && historyIndexRef.current >= 0) {
        const history = getHistory(sessionId);
        e.preventDefault();

        if (historyIndexRef.current < history.length - 1) {
          historyIndexRef.current += 1;
          setValue(history[historyIndexRef.current] ?? "");
        } else {
          historyIndexRef.current = -1;
          setValue(draftRef.current);
        }
      }
    },
    [handleSubmit, sessionId, value],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setValue(e.target.value);
      // If user types while browsing history, exit history mode
      historyIndexRef.current = -1;
      draftRef.current = "";
    },
    [],
  );

  return (
    <div className="border-t border-border/50 px-4 py-3">
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          className={cn(
            "flex-1 resize-none rounded-lg border border-border/60 bg-muted/40 px-3 py-2",
            "text-sm text-foreground/90 placeholder:text-muted-foreground/50",
            "focus:border-border focus:outline-none",
            "disabled:cursor-not-allowed disabled:opacity-40",
            "max-h-[120px] min-h-[36px] select-text",
          )}
          style={{ fieldSizing: "content" } as React.CSSProperties}
        />

        {isRunning ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-red-400/80 hover:bg-red-400/10 hover:text-red-400"
            onClick={onAbort}
            title="Stop agent"
          >
            <Square className="h-3.5 w-3.5" />
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
            onClick={handleSubmit}
            disabled={disabled || value.trim().length === 0}
            title="Send message"
          >
            <Send className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

export { PromptInput };
