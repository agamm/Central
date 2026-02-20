import { GitBranch, ArrowUp, ArrowDown } from "lucide-react";
import type { GitStatusInfo } from "../types";

interface GitStatusBarProps {
  readonly status: GitStatusInfo | null;
}

function GitStatusBar({ status }: GitStatusBarProps) {
  if (!status || !status.is_repo) {
    return (
      <div className="flex items-center border-t border-border/50 px-3 py-1">
        <span className="text-[10px] text-muted-foreground/50">
          Not a git repository
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 border-t border-border/50 px-3 py-1">
      <BranchDisplay branch={status.branch} />
      <AheadBehindDisplay ahead={status.ahead} behind={status.behind} />
    </div>
  );
}

interface BranchDisplayProps {
  readonly branch: string;
}

function BranchDisplay({ branch }: BranchDisplayProps) {
  return (
    <div className="flex items-center gap-1">
      <GitBranch className="h-3 w-3 text-muted-foreground" />
      <span className="text-[10px] font-medium text-foreground/70">
        {branch}
      </span>
    </div>
  );
}

interface AheadBehindDisplayProps {
  readonly ahead: number;
  readonly behind: number;
}

function AheadBehindDisplay({ ahead, behind }: AheadBehindDisplayProps) {
  if (ahead === 0 && behind === 0) return null;

  return (
    <div className="flex items-center gap-2">
      {ahead > 0 ? (
        <div className="flex items-center gap-0.5">
          <ArrowUp className="h-2.5 w-2.5 text-green-400" />
          <span className="text-[10px] text-green-400">{ahead}</span>
        </div>
      ) : null}
      {behind > 0 ? (
        <div className="flex items-center gap-0.5">
          <ArrowDown className="h-2.5 w-2.5 text-orange-400" />
          <span className="text-[10px] text-orange-400">{behind}</span>
        </div>
      ) : null}
    </div>
  );
}

export { GitStatusBar };
