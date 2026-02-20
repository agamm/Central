import { FolderPlus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyProjectStateProps {
  readonly onAddProject: () => void;
}

function EmptyProjectState({ onAddProject }: EmptyProjectStateProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 py-6">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
        <FolderPlus className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="text-center">
        <p className="text-sm font-medium text-foreground">No projects yet</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Add your first project to get started
        </p>
      </div>
      <Button variant="outline" size="sm" onClick={onAddProject}>
        <FolderPlus className="h-3.5 w-3.5" />
        Add Project
      </Button>
    </div>
  );
}

export { EmptyProjectState };
