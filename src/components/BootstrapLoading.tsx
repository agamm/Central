import { Loader2 } from "lucide-react";

/** Full-screen loading state shown while the app restores session data */
function BootstrapLoading() {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <p className="text-xs text-muted-foreground">Restoring sessions...</p>
      </div>
    </div>
  );
}

export { BootstrapLoading };
