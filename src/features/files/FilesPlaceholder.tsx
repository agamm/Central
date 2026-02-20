import { FileText } from "lucide-react";
import { useProjectStore } from "@/features/projects/store";

function FilesPlaceholder() {
  const selectedProjectId = useProjectStore((s) => s.selectedProjectId);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 bg-background px-6">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
        <FileText className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="text-center">
        <p className="text-sm font-medium text-foreground">
          {selectedProjectId ? "Files will appear here" : "No project selected"}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {selectedProjectId
            ? "File tree and diff viewer coming in Phase 5"
            : "Select a project to view its files"}
        </p>
      </div>
    </div>
  );
}

export { FilesPlaceholder };
