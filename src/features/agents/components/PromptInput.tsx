import { useState, useCallback, useRef, useEffect } from "react";
import { Send, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useUIStore } from "../stores/uiStore";
import * as agentApi from "../api";

/** Global message history — loaded from DB on first mount, appended on submit */
let globalHistory: string[] = [];
let historyLoaded = false;

async function loadHistory(): Promise<void> {
  if (historyLoaded) return;
  historyLoaded = true;
  const result = await agentApi.getRecentUserMessages(100);
  if (result.isOk()) {
    // DB returns most-recent-first; reverse so index 0 = oldest, last = newest
    globalHistory = result.value.reverse();
  }
}

function pushHistory(message: string): void {
  if (globalHistory[globalHistory.length - 1] === message) return;
  globalHistory.push(message);
  if (globalHistory.length > 100) globalHistory.shift();
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

  const promptFocusTrigger = useUIStore((s) => s.promptFocusTrigger);

  // Auto-focus when session changes (new chat created) or on explicit trigger
  useEffect(() => {
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
    });
  }, [sessionId, promptFocusTrigger]);

  // Reset history index when session changes
  useEffect(() => {
    historyIndexRef.current = -1;
    draftRef.current = "";
  }, [sessionId]);

  // Load global history from DB on first mount
  useEffect(() => {
    void loadHistory();
  }, []);

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();
    if (trimmed.length === 0) return;
    pushHistory(trimmed);
    historyIndexRef.current = -1;
    draftRef.current = "";
    onSubmit(trimmed);
    setValue("");
  }, [value, onSubmit]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
        return;
      }

      const textarea = e.currentTarget;
      const atStart = textarea.selectionStart === 0 && textarea.selectionEnd === 0;

      if (e.key === "ArrowUp" && atStart) {
        if (globalHistory.length === 0) return;
        e.preventDefault();

        if (historyIndexRef.current === -1) {
          draftRef.current = value;
          historyIndexRef.current = globalHistory.length - 1;
        } else if (historyIndexRef.current > 0) {
          historyIndexRef.current -= 1;
        }

        setValue(globalHistory[historyIndexRef.current] ?? "");
      } else if (e.key === "ArrowDown" && historyIndexRef.current >= 0) {
        e.preventDefault();

        if (historyIndexRef.current < globalHistory.length - 1) {
          historyIndexRef.current += 1;
          setValue(globalHistory[historyIndexRef.current] ?? "");
        } else {
          historyIndexRef.current = -1;
          setValue(draftRef.current);
        }
      }
    },
    [handleSubmit, value],
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

  const hasText = value.trim().length > 0;

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
            "focus:border-foreground/25 focus:outline-none focus:ring-1 focus:ring-foreground/10",
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
            className={cn(
              "h-8 w-8 shrink-0",
              hasText
                ? "text-foreground hover:bg-foreground/10"
                : "text-muted-foreground hover:text-foreground",
            )}
            onClick={handleSubmit}
            disabled={disabled || !hasText}
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
