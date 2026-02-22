import type {
  PermissionResult,
  PermissionUpdate,
} from "@anthropic-ai/claude-agent-sdk";
import type { SidecarEvent, PermissionUpdateInfo } from "./types.js";

interface PendingApproval {
  readonly input: Record<string, unknown>;
  readonly resolve: (result: PermissionResult) => void;
}

const pendingApprovals = new Map<string, PendingApproval>();
let approvalCounter = 0;

function serializeSuggestions(
  suggestions: PermissionUpdate[] | undefined,
): PermissionUpdateInfo[] | undefined {
  if (!suggestions || suggestions.length === 0) return undefined;
  return suggestions.map((s) => {
    const info: PermissionUpdateInfo = {
      type: s.type,
      destination: s.destination,
    };
    if ("rules" in s) info.rules = s.rules;
    if ("behavior" in s) info.behavior = s.behavior;
    if ("mode" in s) info.mode = s.mode;
    if ("directories" in s) info.directories = s.directories;
    return info;
  });
}

function deserializePermissions(
  infos: PermissionUpdateInfo[] | undefined,
): PermissionUpdate[] | undefined {
  if (!infos || infos.length === 0) return undefined;
  return infos as unknown as PermissionUpdate[];
}

function requestToolApproval(
  sessionId: string,
  toolName: string,
  input: Record<string, unknown>,
  signal: AbortSignal,
  emit: (event: SidecarEvent) => void,
  suggestions?: PermissionUpdate[],
): Promise<PermissionResult> {
  const requestId = `apr_${++approvalCounter}`;

  emit({
    type: "tool_approval_request",
    sessionId,
    requestId,
    toolName,
    input,
    suggestions: serializeSuggestions(suggestions),
  });

  return new Promise<PermissionResult>((resolve, reject) => {
    const onAbort = () => {
      pendingApprovals.delete(requestId);
      reject(new Error("aborted"));
    };
    signal.addEventListener("abort", onAbort, { once: true });

    pendingApprovals.set(requestId, {
      input,
      resolve: (result) => {
        signal.removeEventListener("abort", onAbort);
        resolve(result);
      },
    });
  });
}

function resolveApproval(
  requestId: string,
  allowed: boolean,
  updatedPermissions?: PermissionUpdateInfo[],
): void {
  const pending = pendingApprovals.get(requestId);
  if (!pending) return;
  pendingApprovals.delete(requestId);

  if (allowed) {
    pending.resolve({
      behavior: "allow",
      updatedInput: pending.input,
      updatedPermissions: deserializePermissions(updatedPermissions),
    });
  } else {
    pending.resolve({ behavior: "deny", message: "User denied" });
  }
}

export { requestToolApproval, resolveApproval };
