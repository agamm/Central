import { MessageSquare } from "lucide-react";

interface ChatEmptyStateProps {
  readonly projectName?: string;
}

function ChatEmptyState({ projectName }: ChatEmptyStateProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
        <MessageSquare className="h-5 w-5 text-muted-foreground" />
      </div>
      {projectName ? (
        <div className="text-center">
          <p className="text-sm font-medium text-foreground">{projectName}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Type a message below to start an agent session
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

export { ChatEmptyState };
