import { Loader2 } from "lucide-react";

/** Full-screen loading state shown while the app restores session data */
function BootstrapLoading() {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/40" />
        <p className="text-[11px] text-muted-foreground/40">Restoring sessions...</p>
      </div>
    </div>
  );
}

export { BootstrapLoading };
