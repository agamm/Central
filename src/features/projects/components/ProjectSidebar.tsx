import { useEffect, useCallback } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { FolderOpen, Loader2, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { ProjectList } from "./ProjectList";
import { useProjectStore } from "../store";
import { useSettingsStore } from "@/features/settings/store";

function extractFolderName(folderPath: string): string {
  const segments = folderPath.replace(/\/+$/, "").split("/");
  return segments[segments.length - 1] ?? "Untitled";
}

function ProjectSidebar() {
  const fetchProjects = useProjectStore((s) => s.fetchProjects);
  const addProject = useProjectStore((s) => s.addProject);
  const loading = useProjectStore((s) => s.loading);
  const toggleSettings = useSettingsStore((s) => s.toggleSettings);

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
      await addProject(selected, name);
    }
  }, [addProject]);

  return (
    <div className="flex h-full flex-col bg-sidebar">
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
              <FolderOpen className="h-3.5 w-3.5" />
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

      <Separator className="opacity-50" />

      <div className="px-3 py-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={toggleSettings}
            >
              <Settings className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">Settings</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}

export { ProjectSidebar };
