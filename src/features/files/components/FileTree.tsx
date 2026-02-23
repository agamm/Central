import { useEffect, useCallback, useState, useMemo, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RefreshCw, Search, X } from "lucide-react";
import { useFilesStore } from "../store";
import { FileTreeNode } from "./FileTreeNode";
import type { FileTreeEntry } from "../types";


interface FileTreeProps {
  readonly projectPath: string;
}

/** Recursively filter tree entries by name (case-insensitive substring). */
function filterTree(
  entries: readonly FileTreeEntry[],
  query: string,
): FileTreeEntry[] {
  const lower = query.toLowerCase();
  const result: FileTreeEntry[] = [];
  for (const entry of entries) {
    if (entry.is_dir) {
      const filteredChildren = filterTree(entry.children, query);
      if (filteredChildren.length > 0) {
        result.push({ ...entry, children: filteredChildren });
      }
    } else if (entry.name.toLowerCase().includes(lower)) {
      result.push(entry);
    }
  }
  return result;
}

/** Collect all directory paths in a tree (for auto-expanding during search). */
function collectDirPaths(entries: readonly FileTreeEntry[]): Set<string> {
  const dirs = new Set<string>();
  for (const entry of entries) {
    if (entry.is_dir) {
      dirs.add(entry.path);
      for (const p of collectDirPaths(entry.children)) {
        dirs.add(p);
      }
    }
  }
  return dirs;
}

function FileTree({ projectPath }: FileTreeProps) {
  const tree = useFilesStore((s) => s.tree);
  const selectedFilePath = useFilesStore((s) => s.selectedFilePath);
  const expandedDirs = useFilesStore((s) => s.expandedDirs);
  const loading = useFilesStore((s) => s.loading);
  const gitStatus = useFilesStore((s) => s.gitStatus);
  const loadTree = useFilesStore((s) => s.loadTree);
  const loadGitStatus = useFilesStore((s) => s.loadGitStatus);
  const toggleDir = useFilesStore((s) => s.toggleDir);
  const openFileInCenter = useFilesStore((s) => s.openFileInCenter);

  const [searchQuery, setSearchQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const isSearching = searchQuery.length > 0;

  const filteredTree = useMemo(
    () => (isSearching ? filterTree(tree, searchQuery) : tree),
    [tree, searchQuery, isSearching],
  );

  // When searching, auto-expand all dirs that contain matches
  const searchExpandedDirs = useMemo(
    () => (isSearching ? collectDirPaths(filteredTree) : null),
    [filteredTree, isSearching],
  );

  const effectiveExpandedDirs = searchExpandedDirs ?? expandedDirs;

  useEffect(() => {
    void loadTree(projectPath);
    void loadGitStatus(projectPath);
  }, [projectPath, loadTree, loadGitStatus]);

  const handleSelectFile = useCallback(
    (filePath: string) => {
      void openFileInCenter(projectPath, filePath);
    },
    [projectPath, openFileInCenter],
  );

  const handleRefresh = useCallback(() => {
    void loadTree(projectPath);
    void loadGitStatus(projectPath);
  }, [projectPath, loadTree, loadGitStatus]);

  const handleClearSearch = useCallback(() => {
    setSearchQuery("");
    inputRef.current?.focus();
  }, []);

  return (
    <div className="flex h-full flex-col">
      <FileTreeHeader
        loading={loading}
        changedCount={gitStatus?.changed_files.length ?? 0}
        onRefresh={handleRefresh}
      />
      <FileTreeSearch
        value={searchQuery}
        onChange={setSearchQuery}
        onClear={handleClearSearch}
        inputRef={inputRef}
      />
      <ScrollArea className="flex-1">
        <div className="py-1">
          {filteredTree.map((entry) => (
            <FileTreeNode
              key={entry.path}
              entry={entry}
              depth={0}
              expanded={effectiveExpandedDirs.has(entry.path)}
              selectedPath={selectedFilePath}
              expandedDirs={effectiveExpandedDirs}
              onToggleDir={toggleDir}
              onSelectFile={handleSelectFile}
            />
          ))}
          {filteredTree.length === 0 && !loading ? (
            <p className="px-3 py-4 text-center text-xs text-muted-foreground">
              {isSearching ? "No matching files" : "No files found"}
            </p>
          ) : null}
        </div>
      </ScrollArea>
    </div>
  );
}

interface FileTreeHeaderProps {
  readonly loading: boolean;
  readonly changedCount: number;
  readonly onRefresh: () => void;
}

function FileTreeHeader({
  loading,
  changedCount,
  onRefresh,
}: FileTreeHeaderProps) {
  return (
    <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-foreground">Files</span>
        {changedCount > 0 ? (
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-yellow-400">
            {changedCount}
          </span>
        ) : null}
      </div>
      <button
        type="button"
        className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        onClick={onRefresh}
        disabled={loading}
      >
        <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
      </button>
    </div>
  );
}

interface FileTreeSearchProps {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly onClear: () => void;
  readonly inputRef: React.RefObject<HTMLInputElement | null>;
}

function FileTreeSearch({
  value,
  onChange,
  onClear,
  inputRef,
}: FileTreeSearchProps) {
  return (
    <div className="relative border-b border-border px-2 py-1.5">
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search files..."
        className="h-6 w-full rounded bg-muted/50 pl-6 pr-6 text-xs text-foreground placeholder:text-muted-foreground/60 focus:bg-muted focus:outline-none focus:ring-1 focus:ring-ring/40"
      />
      {value.length > 0 ? (
        <button
          type="button"
          onClick={onClear}
          className="absolute right-3.5 top-1/2 -translate-y-1/2 cursor-pointer rounded-sm p-0.5 text-muted-foreground hover:text-foreground"
        >
          <X className="h-3 w-3" />
        </button>
      ) : null}
    </div>
  );
}

export { FileTree };
