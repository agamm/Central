import { MessageSquare } from "lucide-react";

interface ChatEmptyStateProps {
  readonly projectName?: string;
}

function ChatEmptyState({ projectName }: ChatEmptyStateProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6">
      <MessageSquare className="h-5 w-5 text-muted-foreground/30" />
      {projectName ? (
        <div className="text-center">
          <p className="text-sm text-foreground/70">{projectName}</p>
          <p className="mt-1 text-xs text-muted-foreground/60">
            Type a message below to start an agent session
          </p>
        </div>
      ) : (
        <div className="text-center">
          <p className="text-sm text-foreground/60">
            Select a project to get started
          </p>
          <p className="mt-1 text-xs text-muted-foreground/50">
            Choose a project from the sidebar
          </p>
        </div>
      )}
    </div>
  );
}

export { ChatEmptyState };
