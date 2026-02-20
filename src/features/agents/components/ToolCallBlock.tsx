import { useState } from "react";
import { ChevronRight, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";

interface ToolCallInfo {
  readonly name: string;
  readonly input: Record<string, unknown>;
}

interface ToolCallBlockProps {
  readonly toolCalls: readonly ToolCallInfo[];
}

function SingleToolCall({ tool }: { readonly tool: ToolCallInfo }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <button
      type="button"
      className="w-full text-left"
      onClick={() => { setExpanded((prev) => !prev); }}
    >
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors duration-100">
        <ChevronRight
          className={cn(
            "h-3 w-3 transition-transform duration-100",
            expanded && "rotate-90",
          )}
        />
        <Wrench className="h-3 w-3" />
        <span className="font-mono">{tool.name}</span>
      </div>
      {expanded && (
        <div className="mt-1.5 ml-5 rounded border border-border bg-muted/50 px-3 py-2 text-xs font-mono whitespace-pre-wrap text-muted-foreground overflow-x-auto">
          {JSON.stringify(tool.input, null, 2)}
        </div>
      )}
    </button>
  );
}

function ToolCallBlock({ toolCalls }: ToolCallBlockProps) {
  if (toolCalls.length === 0) return null;

  return (
    <div className="mt-1.5 flex flex-col gap-1">
      {toolCalls.map((tool, idx) => (
        <SingleToolCall key={`${tool.name}-${String(idx)}`} tool={tool} />
      ))}
    </div>
  );
}

export { ToolCallBlock };
export type { ToolCallInfo };
