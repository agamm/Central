import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Shield, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAgentStore } from "../store";
import { debugLog } from "@/shared/debugLog";
import type { ToolApprovalRequest } from "../types";

/** Format tool name for display */
function formatToolName(name: string): string {
  if (name.length === 0) return name;
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/** One-line summary of tool input */
function summarizeInput(input: Record<string, unknown>): string {
  const json = JSON.stringify(input);
  if (json.length <= 60) return json;
  return json.slice(0, 60) + "\u2026";
}

interface ApprovalItemProps {
  readonly approval: ToolApprovalRequest;
}

function ApprovalItem({ approval }: ApprovalItemProps) {
  const [expanded, setExpanded] = useState(false);
  const [responding, setResponding] = useState(false);
  const removePendingApproval = useAgentStore((s) => s.removePendingApproval);
  const setError = useAgentStore((s) => s.setError);

  const respond = useCallback(
    async (allowed: boolean) => {
      if (responding) return;
      setResponding(true);
      debugLog("APPROVAL-UI", `Sending ${allowed ? "approve" : "deny"}: req=${approval.requestId} tool=${approval.toolName}`);
      try {
        await invoke("respond_tool_approval", {
          sessionId: approval.sessionId,
          requestId: approval.requestId,
          allowed,
          updatedPermissions: null,
        });
        removePendingApproval(approval.requestId);
        debugLog("APPROVAL-UI", `Success: req=${approval.requestId}`);
      } catch (e) {
        const msg = `Tool approval failed: ${String(e)}`;
        setError(msg);
        debugLog("APPROVAL-UI", `Error: ${msg}`);
        setResponding(false);
      }
    },
    [approval, removePendingApproval, setError, responding],
  );

  const handleApprove = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      void respond(true);
    },
    [respond],
  );

  const handleDeny = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      void respond(false);
    },
    [respond],
  );

  const toggleExpanded = useCallback(() => { setExpanded((v) => !v); }, []);

  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-border/50 bg-muted/30 p-2.5">
      {/* Top row: icon + tool name + collapsed input */}
      <button
        type="button"
        onClick={toggleExpanded}
        className="flex items-center gap-1.5 text-left text-xs"
      >
        <Shield className="h-3.5 w-3.5 shrink-0 text-yellow-500/80" />
        {expanded ? (
          <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
        )}
        <span className="font-medium text-foreground">
          {formatToolName(approval.toolName)}
        </span>
        {!expanded && (
          <span className="truncate text-muted-foreground/70">
            {summarizeInput(approval.input)}
          </span>
        )}
      </button>

      {/* Expanded input details */}
      {expanded && (
        <pre className="max-h-32 overflow-auto rounded bg-background/50 p-2 text-[11px] text-muted-foreground">
          {JSON.stringify(approval.input, null, 2)}
        </pre>
      )}

      {/* Action buttons */}
      <div className="flex items-center justify-end gap-2">
        <Button
          size="sm"
          variant="ghost"
          onClick={handleDeny}
          disabled={responding}
          className="h-6 px-2 text-[11px] text-muted-foreground hover:text-destructive"
        >
          Deny
        </Button>
        <Button
          size="sm"
          onClick={handleApprove}
          disabled={responding}
          className="h-6 bg-emerald-700 px-3 text-[11px] text-white hover:bg-emerald-600"
        >
          {responding ? "Sending..." : "Approve"}
        </Button>
      </div>
    </div>
  );
}

interface ToolApprovalDialogProps {
  readonly sessionId: string;
}

function ToolApprovalDialog({ sessionId }: ToolApprovalDialogProps) {
  const pendingApprovals = useAgentStore((s) => s.pendingApprovals);

  const approvals: ToolApprovalRequest[] = [];
  for (const req of pendingApprovals.values()) {
    if (req.sessionId === sessionId) approvals.push(req);
  }

  if (approvals.length === 0) return null;

  return (
    <div className="border-t border-border/50 bg-background px-3 py-2">
      <div className="flex flex-col gap-1.5">
        {approvals.map((req) => (
          <ApprovalItem key={req.requestId} approval={req} />
        ))}
      </div>
    </div>
  );
}

export { ToolApprovalDialog };
