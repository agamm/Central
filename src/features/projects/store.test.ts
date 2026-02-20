import { describe, it, expect, beforeEach, vi } from "vitest";
import { ok, err } from "neverthrow";
import { useProjectStore } from "./store";
import { createMockProject } from "@/shared/test-helpers";

// Mock the API module
vi.mock("./api", () => ({
  listProjects: vi.fn(),
  addProject: vi.fn(),
  renameProject: vi.fn(),
  deleteProject: vi.fn(),
}));

async function getApi(): Promise<typeof import("./api")> {
  return import("./api");
}

function resetStore(): void {
  useProjectStore.setState({
    projects: [],
    selectedProjectId: null,
    loading: false,
    error: null,
  });
}

describe("ProjectStore", () => {
  beforeEach(() => {
    resetStore();
    vi.clearAllMocks();
  });

  describe("fetchProjects", () => {
    it("populates projects from API on success", async () => {
      const api = await getApi();
      const mockProjects = [
        createMockProject({ name: "Alpha" }),
        createMockProject({ name: "Beta" }),
      ];

      vi.mocked(api.listProjects).mockResolvedValue(ok(mockProjects));

      await useProjectStore.getState().fetchProjects();

      const state = useProjectStore.getState();
      expect(state.projects).toEqual(mockProjects);
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
    });

    it("sets error on API failure", async () => {
      const api = await getApi();

      vi.mocked(api.listProjects).mockResolvedValue(
        err("DB connection failed"),
      );

      await useProjectStore.getState().fetchProjects();

      const state = useProjectStore.getState();
      expect(state.error).toBe("DB connection failed");
      expect(state.loading).toBe(false);
    });
  });

  describe("addProject", () => {
    it("adds project to store and selects it on success", async () => {
      const api = await getApi();
      const newProject = createMockProject({ name: "New" });

      vi.mocked(api.addProject).mockResolvedValue(ok(newProject));

      const result = await useProjectStore
        .getState()
        .addProject("/tmp/new", "New");

      expect(result).toBe(true);
      const state = useProjectStore.getState();
      expect(state.projects).toHaveLength(1);
      expect(state.projects[0]?.name).toBe("New");
      expect(state.selectedProjectId).toBe(newProject.id);
    });

    it("sets error on failure", async () => {
      const api = await getApi();

      vi.mocked(api.addProject).mockResolvedValue(err("Duplicate path"));

      const result = await useProjectStore
        .getState()
        .addProject("/dup", "Dup");

      expect(result).toBe(false);
      expect(useProjectStore.getState().error).toBe("Duplicate path");
    });
  });

  describe("renameProject", () => {
    it("updates project name in store on success", async () => {
      const api = await getApi();
      const project = createMockProject({ name: "Old Name" });
      useProjectStore.setState({ projects: [project] });

      vi.mocked(api.renameProject).mockResolvedValue(ok(undefined));

      const result = await useProjectStore
        .getState()
        .renameProject(project.id, "New Name");

      expect(result).toBe(true);
      expect(useProjectStore.getState().projects[0]?.name).toBe("New Name");
    });

    it("sets error on failure", async () => {
      const api = await getApi();
      vi.mocked(api.renameProject).mockResolvedValue(
        err("Project not found"),
      );

      const result = await useProjectStore
        .getState()
        .renameProject("no-id", "Name");

      expect(result).toBe(false);
      expect(useProjectStore.getState().error).toBe("Project not found");
    });
  });

  describe("deleteProject", () => {
    it("removes project from store on success", async () => {
      const api = await getApi();
      const project = createMockProject();
      useProjectStore.setState({
        projects: [project],
        selectedProjectId: project.id,
      });

      vi.mocked(api.deleteProject).mockResolvedValue(ok(undefined));

      const result = await useProjectStore
        .getState()
        .deleteProject(project.id);

      expect(result).toBe(true);
      const state = useProjectStore.getState();
      expect(state.projects).toHaveLength(0);
      expect(state.selectedProjectId).toBeNull();
    });

    it("preserves selection if different project deleted", async () => {
      const api = await getApi();
      const p1 = createMockProject({ name: "Keep" });
      const p2 = createMockProject({ name: "Delete" });
      useProjectStore.setState({
        projects: [p1, p2],
        selectedProjectId: p1.id,
      });

      vi.mocked(api.deleteProject).mockResolvedValue(ok(undefined));

      await useProjectStore.getState().deleteProject(p2.id);

      const state = useProjectStore.getState();
      expect(state.projects).toHaveLength(1);
      expect(state.selectedProjectId).toBe(p1.id);
    });

    it("sets error on failure", async () => {
      const api = await getApi();
      vi.mocked(api.deleteProject).mockResolvedValue(
        err("Project not found"),
      );

      const result = await useProjectStore
        .getState()
        .deleteProject("no-id");

      expect(result).toBe(false);
      expect(useProjectStore.getState().error).toBe("Project not found");
    });
  });

  describe("selectProject", () => {
    it("sets selected project id", () => {
      useProjectStore.getState().selectProject("p1");
      expect(useProjectStore.getState().selectedProjectId).toBe("p1");
    });

    it("clears selection with null", () => {
      useProjectStore.getState().selectProject("p1");
      useProjectStore.getState().selectProject(null);
      expect(useProjectStore.getState().selectedProjectId).toBeNull();
    });
  });

  describe("clearError", () => {
    it("clears the error state", () => {
      useProjectStore.setState({ error: "some error" });
      useProjectStore.getState().clearError();
      expect(useProjectStore.getState().error).toBeNull();
    });
  });
});
