import { useState, useEffect, useCallback } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { ProjectList } from "./ProjectList";
import { AddProjectDialog } from "./AddProjectDialog";
import { useProjectStore } from "../store";

interface PendingProject {
  readonly path: string;
  readonly name: string;
}

function extractFolderName(folderPath: string): string {
  const segments = folderPath.replace(/\/+$/, "").split("/");
  return segments[segments.length - 1] ?? "Untitled";
}

function ProjectSidebar() {
  const fetchProjects = useProjectStore((s) => s.fetchProjects);
  const addProject = useProjectStore((s) => s.addProject);
  const loading = useProjectStore((s) => s.loading);
  const [pending, setPending] = useState<PendingProject | null>(null);

  useEffect(() => {
    void fetchProjects();
  }, [fetchProjects]);

  const handleOpenFolderPicker = useCallback(async () => {
    const selected = await open({
      directory: true,
      multiple: false,
      title: "Select Project Folder",
    });

    if (typeof selected === "string") {
      const name = extractFolderName(selected);
      setPending({ path: selected, name });
    }
  }, []);

  const handleConfirmAdd = useCallback(
    async (name: string) => {
      if (pending) {
        await addProject(pending.path, name);
        setPending(null);
      }
    },
    [pending, addProject],
  );

  const handleCancelAdd = useCallback(() => {
    setPending(null);
  }, []);

  return (
    <div className="flex h-full flex-col" style={{ backgroundColor: "hsl(0 0% 4%)" }}>
      <div className="flex items-center justify-between px-3 py-2">
        <h2 className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/70">
          Projects
        </h2>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => void handleOpenFolderPicker()}
              disabled={loading}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">Add Project</TooltipContent>
        </Tooltip>
      </div>

      <Separator className="opacity-50" />

      {loading ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <ProjectList onAddProject={() => void handleOpenFolderPicker()} />
      )}

      {pending && (
        <AddProjectDialog
          open={true}
          folderPath={pending.path}
          defaultName={pending.name}
          onConfirm={(name) => void handleConfirmAdd(name)}
          onCancel={handleCancelAdd}
        />
      )}
    </div>
  );
}

export { ProjectSidebar };
