import { TerminalIcon } from "lucide-react";

function TerminalEmpty() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 bg-background">
      <TerminalIcon className="h-5 w-5 text-muted-foreground/25" />
      <p className="text-xs text-muted-foreground/40">
        Select a project to open a terminal
      </p>
    </div>
  );
}

export { TerminalEmpty };
