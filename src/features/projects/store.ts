import { create } from "zustand";
import type { Project } from "@/core/types";
import * as projectApi from "./api";

interface ProjectState {
  readonly projects: readonly Project[];
  readonly selectedProjectId: string | null;
  readonly loading: boolean;
  readonly error: string | null;
}

interface ProjectActions {
  readonly fetchProjects: () => Promise<void>;
  readonly addProject: (path: string, name: string) => Promise<boolean>;
  readonly renameProject: (id: string, name: string) => Promise<boolean>;
  readonly deleteProject: (id: string) => Promise<boolean>;
  readonly selectProject: (id: string | null) => void;
  readonly clearError: () => void;
}

type ProjectStore = ProjectState & ProjectActions;

const useProjectStore = create<ProjectStore>()((set, get) => ({
  projects: [],
  selectedProjectId: null,
  loading: false,
  error: null,

  fetchProjects: async () => {
    set({ loading: true, error: null });
    const result = await projectApi.listProjects();

    result.match(
      (projects) => {
        set({ projects, loading: false });
      },
      (error) => {
        set({ error, loading: false });
      },
    );
  },

  addProject: async (path, name) => {
    set({ error: null });
    const result = await projectApi.addProject(path, name);

    return result.match(
      (project) => {
        const current = get().projects;
        set({ projects: [project, ...current], selectedProjectId: project.id });
        return true;
      },
      (error) => {
        set({ error });
        return false;
      },
    );
  },

  renameProject: async (id, name) => {
    set({ error: null });
    const result = await projectApi.renameProject(id, name);

    return result.match(
      () => {
        const updated = get().projects.map((p) =>
          p.id === id ? { ...p, name } : p,
        );
        set({ projects: updated });
        return true;
      },
      (error) => {
        set({ error });
        return false;
      },
    );
  },

  deleteProject: async (id) => {
    set({ error: null });
    const result = await projectApi.deleteProject(id);

    return result.match(
      () => {
        const filtered = get().projects.filter((p) => p.id !== id);
        const selectedId = get().selectedProjectId;
        set({
          projects: filtered,
          selectedProjectId: selectedId === id ? null : selectedId,
        });
        return true;
      },
      (error) => {
        set({ error });
        return false;
      },
    );
  },

  selectProject: (id) => {
    set({ selectedProjectId: id });
  },

  clearError: () => {
    set({ error: null });
  },
}));

export { useProjectStore };
export type { ProjectStore, ProjectState, ProjectActions };
