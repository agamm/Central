import {
  ChevronRight,
  ChevronDown,
  File,
  Folder,
  FolderOpen,
} from "lucide-react";
import type { FileTreeEntry, GitFileStatus } from "../types";

interface FileTreeNodeProps {
  readonly entry: FileTreeEntry;
  readonly depth: number;
  readonly expanded: boolean;
  readonly selectedPath: string | null;
  readonly expandedDirs: ReadonlySet<string>;
  readonly onToggleDir: (path: string) => void;
  readonly onSelectFile: (path: string) => void;
}

function gitStatusColor(status: GitFileStatus | null): string {
  switch (status) {
    case "modified":
      return "text-yellow-400";
    case "added":
      return "text-green-400";
    case "deleted":
      return "text-red-400";
    case "renamed":
      return "text-blue-400";
    case "conflicted":
      return "text-orange-400";
    default:
      return "text-muted-foreground";
  }
}

function gitStatusDot(status: GitFileStatus | null): string | null {
  switch (status) {
    case "modified":
      return "bg-yellow-400";
    case "added":
      return "bg-green-400";
    case "deleted":
      return "bg-red-400";
    case "renamed":
      return "bg-blue-400";
    case "conflicted":
      return "bg-orange-400";
    default:
      return null;
  }
}

function FileTreeNode({
  entry,
  depth,
  expanded,
  selectedPath,
  expandedDirs,
  onToggleDir,
  onSelectFile,
}: FileTreeNodeProps) {
  const isSelected = entry.path === selectedPath;
  const dotColor = gitStatusDot(entry.git_status);
  const paddingLeft = `${depth * 16 + 8}px`;

  if (entry.is_dir) {
    return (
      <DirectoryNode
        entry={entry}
        depth={depth}
        expanded={expanded}
        selectedPath={selectedPath}
        expandedDirs={expandedDirs}
        onToggleDir={onToggleDir}
        onSelectFile={onSelectFile}
        paddingLeft={paddingLeft}
        dotColor={dotColor}
      />
    );
  }

  return (
    <button
      type="button"
      className={`flex w-full items-center gap-1.5 py-0.5 pr-2 text-left text-xs hover:bg-muted/50 ${
        isSelected ? "bg-muted" : ""
      }`}
      style={{ paddingLeft }}
      onClick={() => { onSelectFile(entry.path); }}
    >
      <File
        className={`h-3.5 w-3.5 shrink-0 ${gitStatusColor(entry.git_status)}`}
      />
      <span
        className={`truncate ${gitStatusColor(entry.git_status)}`}
      >
        {entry.name}
      </span>
      {dotColor ? (
        <span
          className={`ml-auto h-1.5 w-1.5 shrink-0 rounded-full ${dotColor}`}
        />
      ) : null}
    </button>
  );
}

interface DirectoryNodeProps extends FileTreeNodeProps {
  readonly paddingLeft: string;
  readonly dotColor: string | null;
}

function DirectoryNode({
  entry,
  depth,
  expanded,
  selectedPath,
  expandedDirs,
  onToggleDir,
  onSelectFile,
  paddingLeft,
  dotColor,
}: DirectoryNodeProps) {
  const Chevron = expanded ? ChevronDown : ChevronRight;
  const FolderIcon = expanded ? FolderOpen : Folder;

  return (
    <div>
      <button
        type="button"
        className="flex w-full items-center gap-1.5 py-0.5 pr-2 text-left text-xs hover:bg-muted/50"
        style={{ paddingLeft }}
        onClick={() => { onToggleDir(entry.path); }}
      >
        <Chevron className="h-3 w-3 shrink-0 text-muted-foreground" />
        <FolderIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="truncate text-foreground">{entry.name}</span>
        {dotColor ? (
          <span
            className={`ml-auto h-1.5 w-1.5 shrink-0 rounded-full ${dotColor}`}
          />
        ) : null}
      </button>
      {expanded
        ? entry.children.map((child) => (
            <FileTreeNode
              key={child.path}
              entry={child}
              depth={depth + 1}
              expanded={expandedDirs.has(child.path)}
              selectedPath={selectedPath}
              expandedDirs={expandedDirs}
              onToggleDir={onToggleDir}
              onSelectFile={onSelectFile}
            />
          ))
        : null}
    </div>
  );
}

export { FileTreeNode };
