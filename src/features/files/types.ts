/** A node in the file tree — either a directory or a file */
interface FileTreeEntry {
  readonly name: string;
  readonly path: string;
  readonly is_dir: boolean;
  readonly children: readonly FileTreeEntry[];
  readonly git_status: GitFileStatus | null;
}

/** Git status label for a file */
type GitFileStatus =
  | "added"
  | "modified"
  | "deleted"
  | "renamed"
  | "conflicted"
  | "unknown";

/** A single changed file from git status */
interface ChangedFile {
  readonly path: string;
  readonly status: GitFileStatus;
}

/** Git repository status info */
interface GitStatusInfo {
  readonly branch: string;
  readonly ahead: number;
  readonly behind: number;
  readonly is_repo: boolean;
  readonly changed_files: readonly ChangedFile[];
}

/** A single line in a diff hunk */
interface DiffLine {
  readonly content: string;
  readonly origin: "add" | "del" | "ctx";
  readonly old_lineno: number | null;
  readonly new_lineno: number | null;
}

/** A hunk within a file diff */
interface DiffHunk {
  readonly header: string;
  readonly lines: readonly DiffLine[];
}

/** Diff output for a single file */
interface FileDiff {
  readonly path: string;
  readonly hunks: readonly DiffHunk[];
}

/** View mode for the right pane file viewer */
type FileViewMode = "content" | "diff";

export type {
  FileTreeEntry,
  GitFileStatus,
  ChangedFile,
  GitStatusInfo,
  DiffLine,
  DiffHunk,
  FileDiff,
  FileViewMode,
};
