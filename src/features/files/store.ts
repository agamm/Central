import { create } from "zustand";
import type {
  FileTreeEntry,
  GitStatusInfo,
  FileDiff,
  FileViewMode,
} from "./types";
import * as filesApi from "./api";

interface FilesState {
  readonly tree: readonly FileTreeEntry[];
  readonly gitStatus: GitStatusInfo | null;
  readonly selectedFilePath: string | null;
  readonly fileContent: string | null;
  readonly fileDiffs: readonly FileDiff[];
  readonly viewMode: FileViewMode;
  readonly loading: boolean;
  readonly error: string | null;
  readonly expandedDirs: ReadonlySet<string>;
}

interface FilesActions {
  readonly loadTree: (projectPath: string) => Promise<void>;
  readonly loadGitStatus: (projectPath: string) => Promise<void>;
  readonly selectFile: (
    projectPath: string,
    filePath: string,
  ) => Promise<void>;
  readonly selectDiff: (
    projectPath: string,
    filePath: string,
  ) => Promise<void>;
  readonly loadAllDiffs: (projectPath: string) => Promise<void>;
  readonly toggleDir: (dirPath: string) => void;
  readonly clearSelection: () => void;
  readonly refreshAll: (projectPath: string) => Promise<void>;
}

type FilesStore = FilesState & FilesActions;

const useFilesStore = create<FilesStore>()((set, get) => ({
  tree: [],
  gitStatus: null,
  selectedFilePath: null,
  fileContent: null,
  fileDiffs: [],
  viewMode: "content",
  loading: false,
  error: null,
  expandedDirs: new Set<string>(),

  loadTree: async (projectPath) => {
    set({ loading: true, error: null });
    const result = await filesApi.getFileTree(projectPath);
    result.match(
      (tree) => { set({ tree, loading: false }); },
      (error) => { set({ error, loading: false }); },
    );
  },

  loadGitStatus: async (projectPath) => {
    const result = await filesApi.getGitStatus(projectPath);
    result.match(
      (gitStatus) => { set({ gitStatus }); },
      () => { set({ gitStatus: null }); },
    );
  },

  selectFile: async (projectPath, filePath) => {
    set({
      selectedFilePath: filePath,
      viewMode: "content",
      fileContent: null,
      loading: true,
      error: null,
    });
    const result = await filesApi.getFileContent(projectPath, filePath);
    result.match(
      (fileContent) => { set({ fileContent, loading: false }); },
      (error) => { set({ error, loading: false }); },
    );
  },

  selectDiff: async (projectPath, filePath) => {
    set({
      selectedFilePath: filePath,
      viewMode: "diff",
      fileDiffs: [],
      loading: true,
      error: null,
    });
    const result = await filesApi.getDiff(projectPath, filePath);
    result.match(
      (fileDiffs) => { set({ fileDiffs, loading: false }); },
      (error) => { set({ error, loading: false }); },
    );
  },

  loadAllDiffs: async (projectPath) => {
    const result = await filesApi.getDiff(projectPath);
    result.match(
      (fileDiffs) => { set({ fileDiffs }); },
      () => { set({ fileDiffs: [] }); },
    );
  },

  toggleDir: (dirPath) => {
    const current = get().expandedDirs;
    const next = new Set(current);
    if (next.has(dirPath)) {
      next.delete(dirPath);
    } else {
      next.add(dirPath);
    }
    set({ expandedDirs: next });
  },

  clearSelection: () => {
    set({
      selectedFilePath: null,
      fileContent: null,
      fileDiffs: [],
      viewMode: "content",
      error: null,
    });
  },

  refreshAll: async (projectPath) => {
    const store = get();
    await Promise.all([
      store.loadTree(projectPath),
      store.loadGitStatus(projectPath),
    ]);
  },
}));

export { useFilesStore };
export type { FilesStore, FilesState, FilesActions };
