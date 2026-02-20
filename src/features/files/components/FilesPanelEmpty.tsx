import { FileText, MousePointerClick } from "lucide-react";

interface FilesPanelEmptyProps {
  readonly hasProject: boolean;
}

function FilesPanelEmpty({ hasProject }: FilesPanelEmptyProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 bg-background px-6">
      {hasProject ? (
        <MousePointerClick className="h-5 w-5 text-muted-foreground/30" />
      ) : (
        <FileText className="h-5 w-5 text-muted-foreground/30" />
      )}
      <p className="text-xs text-muted-foreground/50">
        {hasProject
          ? "Click a file to view its contents"
          : "Select a project to view files"}
      </p>
    </div>
  );
}

export { FilesPanelEmpty };
