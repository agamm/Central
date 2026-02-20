import { MessageSquare } from "lucide-react";
import { useProjectStore } from "@/features/projects/store";

function ChatPlaceholder() {
  const selectedProjectId = useProjectStore((s) => s.selectedProjectId);
  const projects = useProjectStore((s) => s.projects);

  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 bg-background px-6">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
        <MessageSquare className="h-5 w-5 text-muted-foreground" />
      </div>
      {selectedProject ? (
        <div className="text-center">
          <p className="text-sm font-medium text-foreground">
            {selectedProject.name}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Agent chat will appear here
          </p>
        </div>
      ) : (
        <div className="text-center">
          <p className="text-sm font-medium text-foreground">
            Select a project to get started
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Choose a project from the sidebar to launch an agent
          </p>
        </div>
      )}
    </div>
  );
}

export { ChatPlaceholder };
