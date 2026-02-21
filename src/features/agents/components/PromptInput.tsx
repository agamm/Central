import { useState, useCallback, useRef, useEffect } from "react";
import { Send, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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

  // Auto-focus when session changes (new chat created) or on mount
  useEffect(() => {
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
    });
  }, [sessionId]);

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();
    if (trimmed.length === 0) return;
    onSubmit(trimmed);
    setValue("");
  }, [value, onSubmit]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  return (
    <div className="border-t border-border/50 px-4 py-3">
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
          }}
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
