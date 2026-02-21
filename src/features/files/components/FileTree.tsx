import { useEffect, useCallback } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RefreshCw } from "lucide-react";
import { useFilesStore } from "../store";
import { FileTreeNode } from "./FileTreeNode";
import type { GitFileStatus } from "../types";

interface FileTreeProps {
  readonly projectPath: string;
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

  return (
    <div className="flex h-full flex-col">
      <FileTreeHeader
        loading={loading}
        changedCount={gitStatus?.changed_files.length ?? 0}
        onRefresh={handleRefresh}
      />
      <ScrollArea className="flex-1">
        <div className="py-1">
          {tree.map((entry) => (
            <FileTreeNode
              key={entry.path}
              entry={entry}
              depth={0}
              expanded={expandedDirs.has(entry.path)}
              selectedPath={selectedFilePath}
              expandedDirs={expandedDirs}
              onToggleDir={toggleDir}
              onSelectFile={handleSelectFile}
            />
          ))}
          {tree.length === 0 && !loading ? (
            <p className="px-3 py-4 text-center text-xs text-muted-foreground">
              No files found
            </p>
          ) : null}
        </div>
      </ScrollArea>
      {gitStatus ? <ChangedFilesSummary gitStatus={gitStatus} /> : null}
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

interface ChangedFilesSummaryProps {
  readonly gitStatus: {
    readonly changed_files: readonly {
      readonly status: string;
    }[];
  };
}

function ChangedFilesSummary({ gitStatus }: ChangedFilesSummaryProps) {
  const added = gitStatus.changed_files.filter(
    (f) => (f.status as GitFileStatus) === "added",
  ).length;
  const modified = gitStatus.changed_files.filter(
    (f) => (f.status as GitFileStatus) === "modified",
  ).length;
  const deleted = gitStatus.changed_files.filter(
    (f) => (f.status as GitFileStatus) === "deleted",
  ).length;

  if (added === 0 && modified === 0 && deleted === 0) return null;

  return (
    <div className="flex items-center gap-3 border-t border-border px-3 py-1.5 text-[10px]">
      {modified > 0 ? (
        <span className="text-yellow-400">{modified}M</span>
      ) : null}
      {added > 0 ? <span className="text-green-400">{added}A</span> : null}
      {deleted > 0 ? <span className="text-red-400">{deleted}D</span> : null}
    </div>
  );
}

export { FileTree };
