import { ScrollArea } from "@/components/ui/scroll-area";
import type { FileDiff, DiffLine, DiffHunk } from "../types";

interface DiffViewerProps {
  readonly diffs: readonly FileDiff[];
  readonly filePath: string;
}

function DiffViewer({ diffs, filePath }: DiffViewerProps) {
  const fileDiff = diffs.find((d) => d.path === filePath);

  if (!fileDiff || fileDiff.hunks.length === 0) {
    return (
      <div className="flex h-full flex-col overflow-hidden">
        <DiffHeader filePath={filePath} />
        <div className="flex flex-1 items-center justify-center">
          <p className="text-xs text-muted-foreground">No changes</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <DiffHeader filePath={filePath} />
      <ScrollArea className="flex-1" style={{ height: "calc(100% - 28px)" }}>
        <div className="font-mono text-xs">
          {fileDiff.hunks.map((hunk, i) => (
            <HunkView key={`${hunk.header}-${i}`} hunk={hunk} />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

interface DiffHeaderProps {
  readonly filePath: string;
}

function DiffHeader({ filePath }: DiffHeaderProps) {
  const fileName = filePath.split("/").pop() ?? filePath;

  return (
    <div className="flex items-center border-b border-border px-3 py-1">
      <span className="text-xs font-medium text-yellow-400">diff</span>
      <span className="ml-2 truncate text-xs text-muted-foreground">
        {fileName}
      </span>
      <span className="ml-2 truncate text-[10px] text-muted-foreground/50">
        {filePath}
      </span>
    </div>
  );
}

interface HunkViewProps {
  readonly hunk: DiffHunk;
}

function HunkView({ hunk }: HunkViewProps) {
  return (
    <div className="border-b border-border/50">
      <div className="bg-muted/50 px-3 py-0.5 text-[10px] text-blue-400">
        {hunk.header}
      </div>
      {hunk.lines.map((line, i) => (
        <DiffLineView key={`${line.origin}-${i}`} line={line} />
      ))}
    </div>
  );
}

interface DiffLineViewProps {
  readonly line: DiffLine;
}

function lineBackground(origin: string): string {
  switch (origin) {
    case "add":
      return "bg-green-950/30";
    case "del":
      return "bg-red-950/30";
    default:
      return "";
  }
}

function linePrefix(origin: string): string {
  switch (origin) {
    case "add":
      return "+";
    case "del":
      return "-";
    default:
      return " ";
  }
}

function linePrefixColor(origin: string): string {
  switch (origin) {
    case "add":
      return "text-green-400";
    case "del":
      return "text-red-400";
    default:
      return "text-muted-foreground";
  }
}

function lineTextColor(origin: string): string {
  switch (origin) {
    case "add":
      return "text-green-300";
    case "del":
      return "text-red-300";
    default:
      return "text-foreground";
  }
}

function DiffLineView({ line }: DiffLineViewProps) {
  return (
    <div
      className={`flex min-h-[18px] ${lineBackground(line.origin)}`}
    >
      <span className="w-10 shrink-0 select-none px-1 text-right text-muted-foreground/50">
        {line.old_lineno ?? ""}
      </span>
      <span className="w-10 shrink-0 select-none px-1 text-right text-muted-foreground/50">
        {line.new_lineno ?? ""}
      </span>
      <span
        className={`w-4 shrink-0 select-none text-center ${linePrefixColor(line.origin)}`}
      >
        {linePrefix(line.origin)}
      </span>
      <span className={`flex-1 whitespace-pre px-1 ${lineTextColor(line.origin)}`}>
        {line.content}
      </span>
    </div>
  );
}

export { DiffViewer };
