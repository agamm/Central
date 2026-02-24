import { useEffect, useMemo, useState } from "react";
import {
  KBarProvider,
  KBarPortal,
  KBarPositioner,
  KBarAnimator,
  KBarSearch,
  KBarResults,
  useMatches,
  useRegisterActions,
  useKBar,
  type Action,
} from "kbar";
import { invoke } from "@tauri-apps/api/core";
import { useProjectStore } from "@/features/projects/store";

interface DiscoveredDir {
  name: string;
  path: string;
}

function extractFolderName(folderPath: string): string {
  const segments = folderPath.replace(/\/+$/, "").split("/");
  return segments[segments.length - 1] ?? "Untitled";
}

function ProjectActions() {
  const addProject = useProjectStore((s) => s.addProject);
  const projects = useProjectStore((s) => s.projects);
  const selectProject = useProjectStore((s) => s.selectProject);
  const { query } = useKBar();

  const [dirs, setDirs] = useState<DiscoveredDir[]>([]);

  useEffect(() => {
    invoke<DiscoveredDir[]>("list_project_directories")
      .then(setDirs)
      .catch(() => {});
  }, []);

  // Build actions: existing projects + discoverable directories
  const actions = useMemo(() => {
    const existingPaths = new Set(projects.map((p) => p.path));
    const result: Action[] = [];

    // Existing projects — switch to them
    for (const p of projects) {
      result.push({
        id: `project-${p.id}`,
        name: p.name,
        subtitle: p.path,
        section: "Open Project",
        perform: () => {
          selectProject(p.id);
        },
      });
    }

    // Discovered directories not yet added
    for (const dir of dirs) {
      if (existingPaths.has(dir.path)) continue;
      result.push({
        id: `add-${dir.path}`,
        name: dir.name,
        subtitle: dir.path,
        section: "Add Project",
        perform: () => {
          const name = extractFolderName(dir.path);
          void addProject(dir.path, name);
          query.toggle();
        },
      });
    }

    return result;
  }, [projects, dirs, addProject, selectProject, query]);

  useRegisterActions(actions, [actions]);

  return null;
}

function Results() {
  const { results } = useMatches();

  return (
    <KBarResults
      items={results}
      maxHeight={400}
      onRender={({ item, active }) =>
        typeof item === "string" ? (
          <div className="px-4 pb-1 pt-3 text-[10px] font-medium uppercase tracking-widest text-muted-foreground/60">
            {item}
          </div>
        ) : (
          <div
            className={`flex cursor-pointer items-center gap-3 px-4 py-2.5 ${
              active ? "bg-accent" : ""
            }`}
          >
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm text-foreground">{item.name}</div>
              {item.subtitle && (
                <div className="truncate text-xs text-muted-foreground">
                  {item.subtitle}
                </div>
              )}
            </div>
          </div>
        )
      }
    />
  );
}

function CommandPaletteInner({ children }: { readonly children: React.ReactNode }) {
  return (
    <>
      <KBarPortal>
        <KBarPositioner className="z-50 bg-black/60 backdrop-blur-sm">
          <KBarAnimator className="w-full max-w-[550px] overflow-hidden rounded-lg border border-border bg-popover shadow-2xl">
            <KBarSearch
              className="w-full border-b border-border bg-transparent px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground"
              placeholder="Search projects..."
            />
            <Results />
          </KBarAnimator>
        </KBarPositioner>
      </KBarPortal>
      <ProjectActions />
      {children}
    </>
  );
}

function CommandPalette({ children }: { readonly children: React.ReactNode }) {
  return (
    <KBarProvider
      options={{
        toggleShortcut: "$mod+k",
        animations: { enterMs: 150, exitMs: 100 },
      }}
    >
      <CommandPaletteInner>{children}</CommandPaletteInner>
    </KBarProvider>
  );
}

export { CommandPalette };
