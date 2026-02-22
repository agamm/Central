import { useState } from "react";
import { ChevronRight, Brain } from "lucide-react";
import { cn } from "@/lib/utils";

interface ThinkingBlockProps {
  readonly thinking: string;
  readonly isStreaming?: boolean;
}

function ThinkingBlock({ thinking, isStreaming }: ThinkingBlockProps) {
  const [expanded, setExpanded] = useState(false);

  // Auto-expand while streaming
  const isExpanded = isStreaming || expanded;

  return (
    <button
      type="button"
      className="mt-1.5 w-full text-left"
      onClick={() => {
        setExpanded((prev) => !prev);
      }}
    >
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors duration-100 hover:text-foreground">
        <ChevronRight
          className={cn(
            "h-3 w-3 transition-transform duration-100",
            isExpanded && "rotate-90",
          )}
        />
        <Brain className={cn("h-3 w-3", isStreaming && "animate-pulse")} />
        <span>Thinking</span>
      </div>
      {isExpanded && (
        <div className="ml-5 mt-1.5 select-text whitespace-pre-wrap rounded border border-border/40 bg-muted/30 px-3 py-2 font-mono text-xs text-muted-foreground/80">
          {thinking}
        </div>
      )}
    </button>
  );
}

export { ThinkingBlock };
