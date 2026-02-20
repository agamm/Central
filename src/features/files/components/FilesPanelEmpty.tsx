import { FileText, MousePointerClick } from "lucide-react";

interface FilesPanelEmptyProps {
  readonly hasProject: boolean;
}

function FilesPanelEmpty({ hasProject }: FilesPanelEmptyProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 bg-background px-6">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
        {hasProject ? (
          <MousePointerClick className="h-5 w-5 text-muted-foreground" />
        ) : (
          <FileText className="h-5 w-5 text-muted-foreground" />
        )}
      </div>
      <div className="text-center">
        <p className="text-sm font-medium text-foreground">
          {hasProject ? "Select a file" : "No project selected"}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {hasProject
            ? "Click a file in the tree to view its contents"
            : "Select a project to view its files"}
        </p>
      </div>
    </div>
  );
}

export { FilesPanelEmpty };
