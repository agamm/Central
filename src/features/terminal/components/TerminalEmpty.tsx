import { TerminalIcon } from "lucide-react";

function TerminalEmpty() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 bg-background">
      <TerminalIcon className="h-6 w-6 text-muted-foreground/40" />
      <p className="text-xs text-muted-foreground/60">
        Select a project to open a terminal
      </p>
    </div>
  );
}

export { TerminalEmpty };
