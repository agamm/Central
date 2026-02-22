# UX Polish: Input History, Notifications, Status Indicators

## Feature 1: Persistent Input History (Up/Down Arrow)

**Goal:** Up/down arrow in chat input recalls previous messages across restarts, like a terminal.

**Approach:** Reuse existing `messages` table — user messages (`role = 'user'`) are already persisted. No new table needed.

**Changes:**
- `src/features/agents/api.ts` — add `getRecentUserMessages(limit)`: query `SELECT DISTINCT content FROM messages WHERE role = 'user' ORDER BY timestamp DESC LIMIT ?`
- `src/features/agents/components/PromptInput.tsx` — replace module-level `historyBySession` Map with a single global history array. On mount, seed from SQLite via the new query. On submit, prepend to in-memory array (already persisted via existing message flow). Up/down navigates the global list.

**Behavior:** Global history across all sessions. Deduped. Most recent first. Max 100 entries loaded on startup.

## Feature 2: Notification Click-to-Focus

**Problem:** Clicking macOS notifications does nothing — app doesn't come to front or switch to the correct chat.

**Root cause:** Missing Tauri capabilities. `onAction` requires `notification:allow-register-action-types` and `notification:allow-on-action` to be declared. Without them, the callback never fires.

**Fix:**
- `src-tauri/capabilities/default.json` — add `"notification:allow-register-action-types"`, `"notification:allow-on-action"`
- `src/features/agents/notifications.ts` — call `registerActionTypes` with a default action type before sending notifications. Attach `actionTypeId` to each notification so macOS routes clicks through `onAction`.

The existing `routeToSession()` logic (switch session + setFocus) should then work as written.

## Feature 3: Rich Sidebar Status Indicators

**Goal:** Sidebar session items show richer status with visual urgency cues.

**New visual states (derived, not stored):**
| State | Condition | Visual |
|---|---|---|
| Running | `status === "running"` AND no pending approvals | Blue spinner + elapsed time |
| Awaiting approval | `status === "running"` AND `pendingApprovals` has entries for session | Amber/yellow pulsing dot + wait time |
| Completed (unread) | `status === "completed"` AND session not viewed since completion | Green pulsing dot |
| Completed (read) | `status === "completed"` AND viewed | Solid green dot |
| Failed | `status === "failed"` | Solid red dot |
| Aborted/Interrupted | existing behavior | Solid gray/amber dot |

**Changes:**
- `src/features/agents/stores/uiStore.ts` — add `readSessions: Set<string>`. Mark session as read when `switchSession` is called. Clear read status when a new `session_completed` event arrives for that session.
- `src/features/agents/components/StatusBadge.tsx` — accept optional `hasApproval` and `isUnread` props. Add pulsing amber and pulsing green variants.
- `src/features/agents/components/SessionItem.tsx` — derive `hasApproval` from uiStore `pendingApprovals`, derive `isUnread` from uiStore `readSessions`. Pass to StatusBadge. Show elapsed/wait time text next to badge for running/approval states.
- Add CSS keyframes for pulse animation (or use Tailwind `animate-pulse` with color overrides).
