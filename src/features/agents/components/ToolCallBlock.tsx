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

function getToolSummary(tool: ToolCallInfo): string | null {
  const input = tool.input;

  const filePath = input.file_path ?? input.path;
  if (typeof filePath === "string") {
    const segments = filePath.split("/");
    return segments[segments.length - 1] ?? filePath;
  }

  if (typeof input.command === "string") {
    return input.command.length > 60 ? input.command.slice(0, 60) + "..." : input.command;
  }

  if (typeof input.pattern === "string") return input.pattern;
  if (typeof input.query === "string") return input.query.length > 60 ? input.query.slice(0, 60) + "..." : input.query;
  if (typeof input.description === "string") return input.description;

  return null;
}

function SingleToolCall({ tool }: { readonly tool: ToolCallInfo }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <button
      type="button"
      className="w-full text-left"
      onClick={() => {
        setExpanded((prev) => !prev);
      }}
    >
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors duration-100 hover:text-foreground">
        <ChevronRight
          className={cn(
            "h-3 w-3 transition-transform duration-100",
            expanded && "rotate-90",
          )}
        />
        <Wrench className="h-3 w-3" />
        <span className="font-mono">{tool.name}</span>
        {!expanded && getToolSummary(tool) && (
          <span className="truncate font-mono text-muted-foreground/40">{getToolSummary(tool)}</span>
        )}
      </div>
      {expanded && (
        <div className="ml-5 mt-1.5 select-text overflow-x-auto whitespace-pre-wrap rounded border border-border/40 bg-muted/30 px-3 py-2 font-mono text-xs text-muted-foreground/80">
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
