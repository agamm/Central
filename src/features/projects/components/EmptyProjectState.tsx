import { FolderPlus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyProjectStateProps {
  readonly onAddProject: () => void;
}

function EmptyProjectState({ onAddProject }: EmptyProjectStateProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 py-6">
      <FolderPlus className="h-5 w-5 text-muted-foreground/40" />
      <div className="text-center">
        <p className="text-xs text-muted-foreground/70">No projects yet</p>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={onAddProject}
        className="text-xs text-muted-foreground hover:text-foreground"
      >
        <FolderPlus className="h-3 w-3" />
        Add Project
      </Button>
    </div>
  );
}

export { EmptyProjectState };
