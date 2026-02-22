# UX Polish Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Three UX improvements: persistent input history via up/down arrow, notification click-to-focus on macOS, and rich sidebar status indicators (blue running, yellow approval, green unread, red error).

**Architecture:** Input history queries existing `messages` table for user messages — no new tables. Notification fix adds missing Tauri capabilities + `registerActionTypes` call. Status indicators derive visual state from existing `pendingApprovals` + new `readSessions` set in uiStore.

**Tech Stack:** React 19, Zustand, Tauri v2 notification plugin, Tailwind CSS animations, SQLite via `@tauri-apps/plugin-sql`

---

### Task 1: Persistent Input History — API Layer

**Files:**
- Modify: `src/features/agents/api.ts`

**Step 1: Add `getRecentUserMessages` to api.ts**

Add this function after the existing `getMessages` function at line ~233:

```typescript
/** Fetch recent distinct user messages for input history (global, deduped, most recent first) */
async function getRecentUserMessages(
  limit: number = 100,
): Promise<Result<string[], string>> {
  try {
    const db = getDb();
    const rows = await db.select<{ content: string }[]>(
      `SELECT DISTINCT content FROM messages
       WHERE role = 'user' AND content IS NOT NULL
       ORDER BY timestamp DESC
       LIMIT $1`,
      [limit],
    );
    return ok(rows.map((r) => r.content));
  } catch (e) {
    return err(`Failed to get user message history: ${String(e)}`);
  }
}
```

Add `getRecentUserMessages` to the export block.

**Step 2: Verify it compiles**

Run: `pnpm eslint src/features/agents/api.ts`
Expected: No errors

**Step 3: Commit**

```bash
git add src/features/agents/api.ts
git commit -m "feat: add getRecentUserMessages query for input history"
```

---

### Task 2: Persistent Input History — PromptInput Component

**Files:**
- Modify: `src/features/agents/components/PromptInput.tsx`

**Step 1: Replace module-level history with global persistent history**

Replace the entire file content. Key changes:
- Remove `historyBySession` Map, `pushHistory`, `getHistory`
- Add module-level `globalHistory: string[]` and `historyLoaded: boolean`
- Add `loadHistory()` that calls `getRecentUserMessages` on first mount, reverses result (oldest first for index navigation)
- On submit, push to `globalHistory` in-memory (deduped against last entry). DB persistence already happens via the message flow in `sessionActions.ts`.
- Up/down arrow navigates `globalHistory` (same logic, but global instead of per-session)

Replace lines 1-22 (the history infrastructure) with:

```typescript
import { useState, useCallback, useRef, useEffect } from "react";
import { Send, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useUIStore } from "../stores/uiStore";
import * as agentApi from "../api";

/** Global message history — loaded from DB on first mount, appended on submit */
let globalHistory: string[] = [];
let historyLoaded = false;

async function loadHistory(): Promise<void> {
  if (historyLoaded) return;
  historyLoaded = true;
  const result = await agentApi.getRecentUserMessages(100);
  if (result.isOk()) {
    // DB returns most-recent-first; reverse so index 0 = oldest, last = newest
    globalHistory = result.value.reverse();
  }
}

function pushHistory(message: string): void {
  if (globalHistory[globalHistory.length - 1] === message) return;
  globalHistory.push(message);
  if (globalHistory.length > 100) globalHistory.shift();
}
```

Update `handleSubmit` — change `pushHistory(sessionId, trimmed)` to `pushHistory(trimmed)`:

```typescript
  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();
    if (trimmed.length === 0) return;
    pushHistory(trimmed);
    historyIndexRef.current = -1;
    draftRef.current = "";
    onSubmit(trimmed);
    setValue("");
  }, [value, onSubmit]);
```

Add a `useEffect` for loading history on mount (add after existing useEffects):

```typescript
  // Load global history from DB on first mount
  useEffect(() => {
    void loadHistory();
  }, []);
```

Update `handleKeyDown` — remove `sessionId` guard and use `globalHistory` directly:

```typescript
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
        return;
      }

      const textarea = e.currentTarget;
      const atStart = textarea.selectionStart === 0 && textarea.selectionEnd === 0;

      if (e.key === "ArrowUp" && atStart) {
        if (globalHistory.length === 0) return;

        e.preventDefault();

        if (historyIndexRef.current === -1) {
          draftRef.current = value;
          historyIndexRef.current = globalHistory.length - 1;
        } else if (historyIndexRef.current > 0) {
          historyIndexRef.current -= 1;
        }

        setValue(globalHistory[historyIndexRef.current] ?? "");
      } else if (e.key === "ArrowDown" && historyIndexRef.current >= 0) {
        e.preventDefault();

        if (historyIndexRef.current < globalHistory.length - 1) {
          historyIndexRef.current += 1;
          setValue(globalHistory[historyIndexRef.current] ?? "");
        } else {
          historyIndexRef.current = -1;
          setValue(draftRef.current);
        }
      }
    },
    [handleSubmit, value],
  );
```

**Step 2: Verify it compiles**

Run: `pnpm eslint src/features/agents/components/PromptInput.tsx`
Expected: No errors

**Step 3: Commit**

```bash
git add src/features/agents/components/PromptInput.tsx
git commit -m "feat: persistent global input history with up/down arrow"
```

---

### Task 3: Notification Click-to-Focus — Capabilities

**Files:**
- Modify: `src-tauri/capabilities/default.json`

**Step 1: Add missing notification capabilities**

Add these two entries to the permissions array, after the existing `notification:allow-request-permission`:

```json
    "notification:allow-register-action-types",
    "notification:allow-on-action"
```

The full permissions array should be:
```json
  "permissions": [
    "core:default",
    "core:path:default",
    "core:event:default",
    "core:window:default",
    "core:app:default",
    "sql:default",
    "sql:allow-execute",
    "sql:allow-select",
    "dialog:default",
    "dialog:allow-open",
    "notification:default",
    "notification:allow-notify",
    "notification:allow-is-permission-granted",
    "notification:allow-request-permission",
    "notification:allow-register-action-types",
    "notification:allow-on-action",
    "shell:default"
  ]
```

**Step 2: Commit**

```bash
git add src-tauri/capabilities/default.json
git commit -m "fix: add missing notification action capabilities for click-to-focus"
```

---

### Task 4: Notification Click-to-Focus — Register Action Types

**Files:**
- Modify: `src/features/agents/notifications.ts`

**Step 1: Add registerActionTypes and actionTypeId to notifications**

Update the import to include `registerActionTypes`:

```typescript
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
  onAction,
  registerActionTypes,
} from "@tauri-apps/plugin-notification";
```

Add a constant for the action type ID and update `initNotificationListener` to register it:

```typescript
const ACTION_TYPE_ID = "central-default";

/** Whether action types have been registered */
let actionTypesRegistered = false;

async function ensureActionTypes(): Promise<void> {
  if (actionTypesRegistered) return;
  actionTypesRegistered = true;
  await registerActionTypes([{
    id: ACTION_TYPE_ID,
    actions: [],
  }]);
}
```

Update `sendAgentNotification` to call `ensureActionTypes` and pass `actionTypeId`:

```typescript
async function sendAgentNotification(
  title: string,
  body: string,
  sessionId: string,
): Promise<void> {
  const granted = await ensureNotificationPermission();
  if (!granted) return;

  initNotificationListener();
  await ensureActionTypes();

  pendingNotificationSessionId = sessionId;

  sendNotification({
    title,
    body,
    extra: { sessionId },
    actionTypeId: ACTION_TYPE_ID,
  });
}
```

**Step 2: Verify it compiles**

Run: `pnpm eslint src/features/agents/notifications.ts`
Expected: No errors

**Step 3: Commit**

```bash
git add src/features/agents/notifications.ts
git commit -m "fix: register notification action types for macOS click routing"
```

---

### Task 5: Status Indicators — uiStore readSessions

**Files:**
- Modify: `src/features/agents/stores/uiStore.ts`

**Step 1: Add readSessions tracking to uiStore**

Add `readSessions` to `UIState`:

```typescript
interface UIState {
  readonly scrollPositionBySession: ReadonlyMap<string, number>;
  readonly pendingApprovals: ReadonlyMap<string, ToolApprovalRequest>;
  readonly promptFocusTrigger: number;
  readonly readSessions: ReadonlySet<string>;
}
```

Add actions to `UIActions`:

```typescript
interface UIActions {
  readonly saveScrollPosition: (sessionId: string, position: number) => void;
  readonly getScrollPosition: (sessionId: string) => number;
  readonly addPendingApproval: (req: ToolApprovalRequest) => void;
  readonly removePendingApproval: (requestId: string) => void;
  readonly triggerPromptFocus: () => void;
  readonly clearUI: (sessionId: string) => void;
  readonly markSessionRead: (sessionId: string) => void;
  readonly markSessionUnread: (sessionId: string) => void;
}
```

Add initial state and implementations:

```typescript
  readSessions: new Set(),

  markSessionRead: (sessionId) => {
    const s = new Set(get().readSessions);
    s.add(sessionId);
    set({ readSessions: s });
  },

  markSessionUnread: (sessionId) => {
    const s = new Set(get().readSessions);
    s.delete(sessionId);
    set({ readSessions: s });
  },
```

Also update `clearUI` to clean up readSessions:

```typescript
  clearUI: (sessionId) => {
    const scrollMap = new Map(get().scrollPositionBySession);
    scrollMap.delete(sessionId);

    const approvals = new Map(get().pendingApprovals);
    for (const [reqId, req] of approvals) {
      if (req.sessionId === sessionId) approvals.delete(reqId);
    }

    const readSet = new Set(get().readSessions);
    readSet.delete(sessionId);

    set({ scrollPositionBySession: scrollMap, pendingApprovals: approvals, readSessions: readSet });
  },
```

**Step 2: Mark session read on switchSession**

Modify `src/features/agents/stores/sessionStore.ts` — in `switchSession`, call `useUIStore.getState().markSessionRead(sessionId)`:

```typescript
  switchSession: (sessionId) => {
    set({ activeSessionId: sessionId });
    if (sessionId) {
      invoke("set_setting", { key: ACTIVE_SESSION_KEY, value: sessionId }).catch(() => {});
      // Dynamic import to avoid circular dep
      const { useUIStore } = require("../stores/uiStore");
      useUIStore.getState().markSessionRead(sessionId);
    }
  },
```

Wait — circular imports. Better approach: call `markSessionRead` from the component that calls `switchSession`. Let me check where that happens.

Actually, the simplest approach: import `useUIStore` in `sessionStore.ts`. Since `sessionStore` doesn't import from `uiStore` currently, there's no circular dependency — `uiStore` imports from `../types`, not from `sessionStore`.

```typescript
// At top of sessionStore.ts, add:
import { useUIStore } from "./uiStore";

// In switchSession:
  switchSession: (sessionId) => {
    set({ activeSessionId: sessionId });
    if (sessionId) {
      invoke("set_setting", { key: ACTIVE_SESSION_KEY, value: sessionId }).catch(() => {});
      useUIStore.getState().markSessionRead(sessionId);
    }
  },
```

**Step 3: Mark session unread on completion**

Modify `src/features/agents/hooks/handlers/handleSessionLifecycle.ts` — in `handleSessionCompleted`, before notifying, mark unread:

```typescript
// Add after line 70 (sessStore.updateSessionStatus(sessionId, "completed")):
    useUIStore.getState().markSessionUnread(sessionId);
```

This only runs when no queued follow-up exists (the `else` branch).

**Step 4: Verify compilation**

Run: `pnpm eslint src/features/agents/stores/uiStore.ts src/features/agents/stores/sessionStore.ts src/features/agents/hooks/handlers/handleSessionLifecycle.ts`
Expected: No errors

**Step 5: Commit**

```bash
git add src/features/agents/stores/uiStore.ts src/features/agents/stores/sessionStore.ts src/features/agents/hooks/handlers/handleSessionLifecycle.ts
git commit -m "feat: track read/unread session state for status indicators"
```

---

### Task 6: Status Indicators — StatusBadge Component

**Files:**
- Modify: `src/features/agents/components/StatusBadge.tsx`

**Step 1: Extend StatusBadge with new visual states**

Replace the entire StatusBadge component:

```typescript
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AgentStatus } from "@/core/types";

type VisualStatus = AgentStatus | "awaiting_approval" | "completed_unread";

interface StatusBadgeProps {
  readonly status: AgentStatus;
  readonly hasApproval?: boolean;
  readonly isUnread?: boolean;
  readonly className?: string;
}

function deriveVisualStatus(
  status: AgentStatus,
  hasApproval: boolean,
  isUnread: boolean,
): VisualStatus {
  if (status === "running" && hasApproval) return "awaiting_approval";
  if (status === "completed" && isUnread) return "completed_unread";
  return status;
}

const STATUS_DOT_STYLES: Record<VisualStatus, string> = {
  idle: "bg-zinc-500/40",
  running: "",
  completed: "bg-emerald-500/70",
  completed_unread: "bg-emerald-400 animate-pulse",
  failed: "bg-red-500/70",
  aborted: "bg-zinc-500/60",
  interrupted: "bg-amber-500/70",
  awaiting_approval: "bg-amber-400 animate-pulse",
};

const STATUS_LABELS: Record<VisualStatus, string> = {
  idle: "New",
  running: "Running",
  completed: "Completed",
  completed_unread: "Completed",
  failed: "Failed",
  aborted: "Aborted",
  interrupted: "Interrupted",
  awaiting_approval: "Needs Approval",
};

function StatusBadge({ status, hasApproval = false, isUnread = false, className }: StatusBadgeProps) {
  const visual = deriveVisualStatus(status, hasApproval, isUnread);

  if (visual === "running") {
    return (
      <Loader2
        className={cn(
          "h-2.5 w-2.5 shrink-0 animate-spin text-blue-400/70",
          className,
        )}
        aria-label={STATUS_LABELS[visual]}
      />
    );
  }

  return (
    <span
      className={cn(
        "h-1.5 w-1.5 shrink-0 rounded-full",
        STATUS_DOT_STYLES[visual],
        className,
      )}
      aria-label={STATUS_LABELS[visual]}
    />
  );
}

export { StatusBadge, deriveVisualStatus };
export type { StatusBadgeProps, VisualStatus };
```

Note: Running spinner changed from `text-emerald-400/70` to `text-blue-400/70` per user spec (blue for running).

**Step 2: Verify it compiles**

Run: `pnpm eslint src/features/agents/components/StatusBadge.tsx`
Expected: No errors

**Step 3: Commit**

```bash
git add src/features/agents/components/StatusBadge.tsx
git commit -m "feat: StatusBadge with approval/unread visual states"
```

---

### Task 7: Status Indicators — SessionItem Integration

**Files:**
- Modify: `src/features/agents/components/SessionItem.tsx`

**Step 1: Wire up approval and unread state to SessionItem**

Add imports and derive the new props from uiStore:

```typescript
import { useCallback } from "react";
import { MessageSquare, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { StatusBadge } from "./StatusBadge";
import { useUIStore } from "../stores/uiStore";
import type { AgentSession } from "@/core/types";
```

Update `SessionItemProps` — no change needed, the derivation happens inside the component.

Replace the `SessionItem` function body to derive `hasApproval` and `isUnread`:

```typescript
function SessionItem({ session, isActive, onSelect, onDelete }: SessionItemProps) {
  const pendingApprovals = useUIStore((s) => s.pendingApprovals);
  const readSessions = useUIStore((s) => s.readSessions);

  const hasApproval = Array.from(pendingApprovals.values()).some(
    (req) => req.sessionId === session.id,
  );
  const isUnread = session.status === "completed" && !readSessions.has(session.id);

  const handleClick = useCallback(() => {
    onSelect(session.id);
  }, [onSelect, session.id]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") onSelect(session.id);
    },
    [onSelect, session.id],
  );

  const handleDelete = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onDelete?.(session.id);
    },
    [onDelete, session.id],
  );

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={cn(
        "group flex items-center gap-1.5 overflow-hidden rounded px-2 py-1 text-xs",
        "cursor-pointer hover:bg-accent/50",
        isActive && "bg-accent text-foreground",
      )}
    >
      <MessageSquare className={cn("h-3 w-3 shrink-0", isActive ? "text-foreground/70" : "text-muted-foreground/60")} />
      <span className={cn("min-w-0 flex-1 truncate", isActive ? "text-foreground/90" : "text-muted-foreground")}>
        {truncatePrompt(session.prompt, 30)}
      </span>
      <span className="shrink-0 text-[9px] text-muted-foreground/40">
        {formatRelativeTime(session.createdAt)}
      </span>
      <StatusBadge
        status={session.status}
        hasApproval={hasApproval}
        isUnread={isUnread}
        className="shrink-0"
      />
      {onDelete && (
        <button
          onClick={handleDelete}
          className="shrink-0 rounded p-0.5 opacity-0 hover:bg-destructive/20 group-hover:opacity-100"
          aria-label="Delete session"
        >
          <X className="h-3 w-3 text-muted-foreground hover:text-destructive" />
        </button>
      )}
    </div>
  );
}
```

**Step 2: Verify it compiles**

Run: `pnpm eslint src/features/agents/components/SessionItem.tsx`
Expected: No errors

**Step 3: Commit**

```bash
git add src/features/agents/components/SessionItem.tsx
git commit -m "feat: SessionItem derives approval/unread state for StatusBadge"
```

---

### Task 8: Smoke Test

**Step 1: Run full lint**

Run: `pnpm eslint src/`
Expected: No errors

**Step 2: Run tests**

Run: `pnpm vitest --run`
Expected: All tests pass (except pre-existing `sessionActions.test.ts` failures)

**Step 3: Final commit (if any lint fixes needed)**

```bash
git add -A
git commit -m "chore: lint fixes for UX polish features"
```
