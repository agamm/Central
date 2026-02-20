import { describe, it, expect, beforeEach, vi } from "vitest";
import { useFilesStore } from "./store";
import { ok, err } from "neverthrow";
import type { FileTreeEntry, GitStatusInfo, FileDiff } from "./types";

vi.mock("./api", () => ({
  getFileTree: vi.fn(),
  getGitStatus: vi.fn(),
  getFileContent: vi.fn(),
  getDiff: vi.fn(),
}));

async function getApi(): Promise<typeof import("./api")> {
  return import("./api");
}

function resetStore(): void {
  useFilesStore.setState({
    tree: [],
    gitStatus: null,
    selectedFilePath: null,
    fileContent: null,
    fileDiffs: [],
    viewMode: "content",
    loading: false,
    error: null,
    expandedDirs: new Set<string>(),
  });
}

describe("FilesStore", () => {
  beforeEach(() => {
    resetStore();
    vi.clearAllMocks();
  });

  describe("loadTree", () => {
    it("populates tree on success", async () => {
      const api = await getApi();
      const mockTree: FileTreeEntry[] = [
        {
          name: "src",
          path: "src",
          is_dir: true,
          children: [],
          git_status: null,
        },
      ];

      vi.mocked(api.getFileTree).mockResolvedValue(ok(mockTree));

      await useFilesStore.getState().loadTree("/tmp/project");

      const state = useFilesStore.getState();
      expect(state.tree).toEqual(mockTree);
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
    });

    it("sets error on failure", async () => {
      const api = await getApi();
      vi.mocked(api.getFileTree).mockResolvedValue(
        err("Path does not exist"),
      );

      await useFilesStore.getState().loadTree("/bad/path");

      const state = useFilesStore.getState();
      expect(state.error).toBe("Path does not exist");
      expect(state.loading).toBe(false);
    });
  });

  describe("loadGitStatus", () => {
    it("populates git status on success", async () => {
      const api = await getApi();
      const mockStatus: GitStatusInfo = {
        branch: "main",
        ahead: 2,
        behind: 0,
        is_repo: true,
        changed_files: [{ path: "src/app.ts", status: "modified" }],
      };

      vi.mocked(api.getGitStatus).mockResolvedValue(ok(mockStatus));

      await useFilesStore.getState().loadGitStatus("/tmp/project");

      expect(useFilesStore.getState().gitStatus).toEqual(mockStatus);
    });

    it("sets gitStatus to null on failure", async () => {
      const api = await getApi();
      vi.mocked(api.getGitStatus).mockResolvedValue(
        err("Not a git repo"),
      );

      await useFilesStore.getState().loadGitStatus("/tmp/no-git");

      expect(useFilesStore.getState().gitStatus).toBeNull();
    });
  });

  describe("selectFile", () => {
    it("sets file content and view mode", async () => {
      const api = await getApi();
      vi.mocked(api.getFileContent).mockResolvedValue(
        ok("const x = 42;"),
      );

      await useFilesStore.getState().selectFile("/tmp/p", "main.ts");

      const state = useFilesStore.getState();
      expect(state.selectedFilePath).toBe("main.ts");
      expect(state.viewMode).toBe("content");
      expect(state.fileContent).toBe("const x = 42;");
      expect(state.loading).toBe(false);
    });

    it("sets error when file read fails", async () => {
      const api = await getApi();
      vi.mocked(api.getFileContent).mockResolvedValue(
        err("File not found: missing.ts"),
      );

      await useFilesStore.getState().selectFile("/tmp/p", "missing.ts");

      const state = useFilesStore.getState();
      expect(state.error).toBe("File not found: missing.ts");
      expect(state.fileContent).toBeNull();
    });
  });

  describe("selectDiff", () => {
    it("sets diffs and view mode", async () => {
      const api = await getApi();
      const mockDiffs: FileDiff[] = [
        {
          path: "app.ts",
          hunks: [
            {
              header: "@@ -1,3 +1,4 @@",
              lines: [
                {
                  content: "+new line",
                  origin: "add",
                  old_lineno: null,
                  new_lineno: 4,
                },
              ],
            },
          ],
        },
      ];

      vi.mocked(api.getDiff).mockResolvedValue(ok(mockDiffs));

      await useFilesStore.getState().selectDiff("/tmp/p", "app.ts");

      const state = useFilesStore.getState();
      expect(state.viewMode).toBe("diff");
      expect(state.fileDiffs).toEqual(mockDiffs);
      expect(state.loading).toBe(false);
    });
  });

  describe("toggleDir", () => {
    it("adds dir to expanded set", () => {
      useFilesStore.getState().toggleDir("src");
      expect(useFilesStore.getState().expandedDirs.has("src")).toBe(true);
    });

    it("removes dir from expanded set on second toggle", () => {
      const store = useFilesStore.getState();
      store.toggleDir("src");
      useFilesStore.getState().toggleDir("src");
      expect(useFilesStore.getState().expandedDirs.has("src")).toBe(false);
    });

    it("manages multiple dirs independently", () => {
      const store = useFilesStore.getState();
      store.toggleDir("src");
      useFilesStore.getState().toggleDir("lib");

      const dirs = useFilesStore.getState().expandedDirs;
      expect(dirs.has("src")).toBe(true);
      expect(dirs.has("lib")).toBe(true);
    });
  });

  describe("clearSelection", () => {
    it("resets selection state", () => {
      useFilesStore.setState({
        selectedFilePath: "some/file.ts",
        fileContent: "content",
        fileDiffs: [{ path: "f", hunks: [] }],
        viewMode: "diff",
        error: "old error",
      });

      useFilesStore.getState().clearSelection();

      const state = useFilesStore.getState();
      expect(state.selectedFilePath).toBeNull();
      expect(state.fileContent).toBeNull();
      expect(state.fileDiffs).toEqual([]);
      expect(state.viewMode).toBe("content");
      expect(state.error).toBeNull();
    });
  });
});
