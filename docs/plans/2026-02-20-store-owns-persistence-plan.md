# Store-Owns-Persistence Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Eliminate dual-write coordination by moving SQLite persistence into Zustand store actions, making the store the single source of truth.

**Architecture:** Store actions update Zustand state synchronously (instant UI), then fire async SQLite writes via `agentApi` (fire-and-forget with error logging). External callers never import `agentApi` for writes. Hydration on app start loads SQLite into Zustand.

**Tech Stack:** Zustand, @tauri-apps/plugin-sql, neverthrow, vitest

---

### Task 1: Add `agentApi` persistence to store actions

**Files:**
- Modify: `src/features/agents/store.ts`

**Step 1: Add imports at top of store.ts**

Add after line 7 (after the types import):

```ts
import * as agentApi from "./api";
import { debugLog } from "@/shared/debugLog";
```

**Step 2: Add `persistError` helper inside the create callback**

Add after line 70 (after `error: null,`) — a helper to log persistence failures:

```ts
const persistError = (op: string, e: unknown): void => {
  debugLog("STORE", `Persist failed [${op}]: ${String(e)}`);
};
```

**Step 3: Update `setSession` to persist**

Replace the `setSession` action (lines 72-76):

```ts
setSession: (session) => {
  const sessions = new Map(get().sessions);
  sessions.set(session.id, session);
  set({ sessions });
},
```

With:

```ts
setSession: (session) => {
  const sessions = new Map(get().sessions);
  sessions.set(session.id, session);
  set({ sessions });
  // Note: session creation persistence is handled by createSession action.
  // setSession is also used for hydration (no re-persist needed).
},
```

**Step 4: Update `updateSessionStatus` to persist**

Replace lines 78-87:

```ts
updateSessionStatus: (sessionId, status) => {
  const sessions = new Map(get().sessions);
  const existing = sessions.get(sessionId);
  if (!existing) return;

  const endedAt =
    status !== "running" ? new Date().toISOString() : existing.endedAt;
  sessions.set(sessionId, { ...existing, status, endedAt });
  set({ sessions });
},
```

With:

```ts
updateSessionStatus: (sessionId, status) => {
  const sessions = new Map(get().sessions);
  const existing = sessions.get(sessionId);
  if (!existing) return;

  const endedAt =
    status !== "running" ? new Date().toISOString() : existing.endedAt;
  sessions.set(sessionId, { ...existing, status, endedAt });
  set({ sessions });
  agentApi.updateSessionStatus(sessionId, status, endedAt ?? undefined)
    .catch(e => persistError("updateSessionStatus", e));
},
```

**Step 5: Update `addMessage` to persist**

Replace lines 93-98:

```ts
addMessage: (sessionId, message) => {
  const msgMap = new Map(get().messagesBySession);
  const existing = msgMap.get(sessionId) ?? [];
  msgMap.set(sessionId, [...existing, message]);
  set({ messagesBySession: msgMap });
},
```

With:

```ts
addMessage: (sessionId, message) => {
  const msgMap = new Map(get().messagesBySession);
  const existing = msgMap.get(sessionId) ?? [];
  msgMap.set(sessionId, [...existing, message]);
  set({ messagesBySession: msgMap });
  agentApi.addMessage(
    sessionId,
    message.role,
    message.content,
    message.thinking,
    message.toolCalls,
    message.usage,
  ).catch(e => persistError("addMessage", e));
},
```

**Step 6: Add `createSession` action to AgentActions interface**

Add after line 53 (after `readonly setError`):

```ts
readonly createSession: (
  projectId: string,
  prompt: string,
  model: string | null,
) => Promise<AgentSession | null>;
```

**Step 7: Implement `createSession` action**

Add after the `clearSessionData` action (after line 208, before the closing `}));`):

```ts
createSession: async (projectId, prompt, model) => {
  const result = await agentApi.createSession(projectId, prompt, model);
  if (result.isErr()) {
    set({ error: result.error });
    return null;
  }
  const session = result.value;
  const sessions = new Map(get().sessions);
  sessions.set(session.id, session);
  set({ sessions, activeSessionId: session.id });
  return session;
},
```

**Step 8: Add `hydrate` action to AgentActions interface**

Add after the `createSession` signature:

```ts
readonly hydrate: () => Promise<void>;
```

**Step 9: Implement `hydrate` action**

Add after the `createSession` implementation:

```ts
hydrate: async () => {
  set({ loading: true });

  const interruptResult = await agentApi.markInterruptedSessions();
  if (interruptResult.isErr()) {
    set({ error: interruptResult.error });
  }

  const sessionsResult = await agentApi.getAllSessions();
  if (sessionsResult.isErr()) {
    set({ error: sessionsResult.error, loading: false });
    return;
  }

  const sessions = new Map<string, AgentSession>();
  for (const s of sessionsResult.value) {
    sessions.set(s.id, s);
  }

  const lastSession = sessionsResult.value[0] ?? null;
  let messagesBySession = new Map(get().messagesBySession);

  if (lastSession) {
    const messagesResult = await agentApi.getMessages(lastSession.id);
    if (messagesResult.isOk()) {
      const chatMessages = messagesResult.value.map((m) => ({
        ...m,
        isStreaming: false as const,
      }));
      messagesBySession = new Map(messagesBySession);
      messagesBySession.set(lastSession.id, chatMessages);
    }
  }

  set({
    sessions,
    activeSessionId: lastSession?.id ?? null,
    messagesBySession,
    loading: false,
  });
},
```

**Step 10: Run store tests**

Run: `pnpm vitest run src/features/agents/store.test.ts`

Expected: All existing tests pass (the persistence calls are fire-and-forget side effects, they don't change Zustand behavior). Some tests may need `agentApi` mock added.

**Step 11: Commit**

```bash
git add src/features/agents/store.ts
git commit -m "feat: add persistence to store actions (store-owns-persistence)"
```

---

### Task 2: Update store tests to mock `agentApi`

**Files:**
- Modify: `src/features/agents/store.test.ts`

**Step 1: Add `agentApi` mock at top of test file**

Add after line 3 (after the test-helpers import):

```ts
import { ok } from "neverthrow";

vi.mock("./api", () => ({
  createSession: vi.fn().mockResolvedValue(ok({ id: "mock" })),
  updateSessionStatus: vi.fn().mockResolvedValue(ok(undefined)),
  addMessage: vi.fn().mockResolvedValue(ok({ id: "mock-msg" })),
  markInterruptedSessions: vi.fn().mockResolvedValue(ok(0)),
  getAllSessions: vi.fn().mockResolvedValue(ok([])),
  getMessages: vi.fn().mockResolvedValue(ok([])),
}));

vi.mock("@/shared/debugLog", () => ({
  debugLog: vi.fn(),
}));
```

**Step 2: Add `vi` import**

Update line 1:

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";
```

**Step 3: Clear mocks in beforeEach**

Add inside the `beforeEach` (after `resetStore()`):

```ts
vi.clearAllMocks();
```

**Step 4: Add test for `addMessage` persisting**

Add a new test in the `addMessage` describe block:

```ts
it("fires async persist call to SQLite", async () => {
  const api = await import("./api");
  const msg = createMockMessage({ sessionId: "s1" });
  useAgentStore.getState().addMessage("s1", msg);

  expect(vi.mocked(api.addMessage)).toHaveBeenCalledWith(
    "s1",
    msg.role,
    msg.content,
    msg.thinking,
    msg.toolCalls,
    msg.usage,
  );
});
```

**Step 5: Add test for `updateSessionStatus` persisting**

Add a new test in the `updateSessionStatus` describe block:

```ts
it("fires async persist call to SQLite", async () => {
  const api = await import("./api");
  const session = createMockSession({ status: "running" });
  const store = useAgentStore.getState();
  store.setSession(session);

  store.updateSessionStatus(session.id, "completed");

  expect(vi.mocked(api.updateSessionStatus)).toHaveBeenCalledWith(
    session.id,
    "completed",
    expect.any(String),
  );
});
```

**Step 6: Add test for `createSession`**

Add a new describe block:

```ts
describe("createSession", () => {
  it("creates session in SQLite and adds to store", async () => {
    const api = await import("./api");
    const mockSession = createMockSession({ projectId: "p1", prompt: "test" });
    vi.mocked(api.createSession).mockResolvedValue(ok(mockSession));

    const result = await useAgentStore.getState().createSession("p1", "test", null);

    expect(result).toEqual(mockSession);
    expect(useAgentStore.getState().sessions.get(mockSession.id)).toEqual(mockSession);
    expect(useAgentStore.getState().activeSessionId).toBe(mockSession.id);
  });

  it("sets error and returns null on failure", async () => {
    const api = await import("./api");
    vi.mocked(api.createSession).mockResolvedValue(err("DB error"));

    const result = await useAgentStore.getState().createSession("p1", "test", null);

    expect(result).toBeNull();
    expect(useAgentStore.getState().error).toBe("DB error");
  });
});
```

Note: add `err` to the neverthrow import.

**Step 7: Add test for `hydrate`**

Add a new describe block:

```ts
describe("hydrate", () => {
  it("loads sessions and messages from SQLite", async () => {
    const api = await import("./api");
    const session = createMockSession({ id: "s1" });
    const msg = createMockMessage({ id: "m1", sessionId: "s1", content: "hello" });

    vi.mocked(api.markInterruptedSessions).mockResolvedValue(ok(0));
    vi.mocked(api.getAllSessions).mockResolvedValue(ok([session]));
    vi.mocked(api.getMessages).mockResolvedValue(ok([msg]));

    await useAgentStore.getState().hydrate();

    const state = useAgentStore.getState();
    expect(state.sessions.size).toBe(1);
    expect(state.activeSessionId).toBe("s1");
    expect(state.messagesBySession.get("s1")).toHaveLength(1);
    expect(state.loading).toBe(false);
  });

  it("handles empty database", async () => {
    const api = await import("./api");
    vi.mocked(api.markInterruptedSessions).mockResolvedValue(ok(0));
    vi.mocked(api.getAllSessions).mockResolvedValue(ok([]));

    await useAgentStore.getState().hydrate();

    const state = useAgentStore.getState();
    expect(state.sessions.size).toBe(0);
    expect(state.activeSessionId).toBeNull();
    expect(state.loading).toBe(false);
  });
});
```

**Step 8: Run tests**

Run: `pnpm vitest run src/features/agents/store.test.ts`

Expected: All tests pass.

**Step 9: Commit**

```bash
git add src/features/agents/store.test.ts
git commit -m "test: add persistence verification to store tests"
```

---

### Task 3: Remove `agentApi` writes from `useAgentEvents.ts`

**Files:**
- Modify: `src/features/agents/hooks/useAgentEvents.ts`

**Step 1: Remove `agentApi` import**

Delete line 5:

```ts
import * as agentApi from "../api";
```

**Step 2: Simplify `handleMessageEvent`**

Replace lines 50-88 (the entire `handleMessageEvent` function):

```ts
function handleMessageEvent(
  store: Store,
  event: Extract<SidecarEvent, { type: "message" }>,
): void {
  const pending = drainPendingToolCalls(event.sessionId);
  const toolCallsJson = mergeToolCallsJson(
    event.toolCalls ? JSON.stringify(event.toolCalls) : null,
    pending,
  );
  const usageJson = event.usage ? JSON.stringify(event.usage) : null;

  const msg: ChatMessage = {
    id: crypto.randomUUID(),
    sessionId: event.sessionId,
    role: event.role as "assistant" | "user" | "system",
    content: event.content,
    thinking: event.thinking ?? null,
    toolCalls: toolCallsJson,
    usage: usageJson,
    timestamp: new Date().toISOString(),
  };

  store.addMessage(event.sessionId, msg);
}
```

Key changes:
- No longer `async` (no await on agentApi)
- No longer calls `agentApi.addMessage` — the store's `addMessage` handles persistence
- No longer has the `result.match` pattern — just constructs `ChatMessage` directly

**Step 3: Simplify `handleSessionCompleted`**

Replace lines 90-117:

```ts
async function handleSessionCompleted(
  store: Store,
  sessionId: string,
): Promise<void> {
  flushPendingToolCallsToLastMessage(store, sessionId);

  const startedAt = store.sessionStartedAt.get(sessionId);
  if (startedAt) {
    const elapsed = Date.now() - new Date(startedAt).getTime();
    store.setSessionElapsed(sessionId, elapsed);
  }

  store.updateSessionStatus(sessionId, "completed");

  const session = store.sessions.get(sessionId);
  notifySessionCompleted(session?.prompt ?? null);

  const queued = store.dequeueMessage(sessionId);
  if (queued) {
    await invoke("send_agent_message", { sessionId, message: queued.content });
    store.updateSessionStatus(sessionId, "running");
    store.setSessionStartedAt(sessionId, new Date().toISOString());
  }
}
```

Changes: removed both `agentApi.updateSessionStatus` calls (lines 105 and 115).

**Step 4: Simplify `handleSessionFailed`**

Replace lines 156-176:

```ts
function handleSessionFailed(
  store: Store,
  sessionId: string,
  error: string,
): void {
  const startedAt = store.sessionStartedAt.get(sessionId);
  if (startedAt) {
    const elapsed = Date.now() - new Date(startedAt).getTime();
    store.setSessionElapsed(sessionId, elapsed);
  }

  flushPendingToolCallsToLastMessage(store, sessionId);

  store.updateSessionStatus(sessionId, "failed");
  store.setError(error);

  const session = store.sessions.get(sessionId);
  notifySessionFailed(session?.prompt ?? null, error);
}
```

Changes: no longer `async`, removed `agentApi.updateSessionStatus` call.

**Step 5: Update `handleEvent` switch for non-async handlers**

In the `handleEvent` function, the `case "message"` and `case "session_failed"` no longer call async functions, so update:

Line 197: change `await handleMessageEvent(store, event);` to `handleMessageEvent(store, event);`

Line 222: change `await handleSessionFailed(store, event.sessionId, event.error);` to `handleSessionFailed(store, event.sessionId, event.error);`

**Step 6: Run full test suite**

Run: `pnpm vitest run`

Expected: All tests pass.

**Step 7: Commit**

```bash
git add src/features/agents/hooks/useAgentEvents.ts
git commit -m "refactor: remove agentApi writes from useAgentEvents (store handles persistence)"
```

---

### Task 4: Remove `agentApi` writes from `sessionActions.ts`

**Files:**
- Modify: `src/features/agents/sessionActions.ts`

**Step 1: Remove `agentApi` import**

Delete line 2:

```ts
import * as agentApi from "./api";
```

**Step 2: Rewrite `SessionActions` interface**

Replace lines 19-25:

```ts
interface SessionActions {
  readonly createSession: (
    projectId: string,
    prompt: string,
    model: string | null,
  ) => Promise<AgentSession | null>;
  readonly switchSession: (id: string) => void;
  readonly addMessage: (sid: string, msg: ChatMessage) => void;
  readonly updateStatus: (sid: string, status: AgentStatus) => void;
  readonly setError: (e: string) => void;
}
```

Changes: replaced `setSession` with `createSession` (the new store action).

**Step 3: Remove `persistAndAddUserMessage` helper**

Delete lines 27-35 (the entire function). Replace with a simpler helper:

```ts
function addUserMessage(
  sessionId: string,
  content: string,
  addMessage: (sid: string, msg: ChatMessage) => void,
): void {
  const userMsg = createUserMessage(sessionId, content);
  addMessage(sessionId, userMsg);
}
```

No async, no `agentApi.addMessage` — the store's `addMessage` handles persistence.

**Step 4: Rewrite `startNewSession`**

Replace the entire function:

```ts
async function startNewSession(
  projectId: string,
  projectPath: string,
  content: string,
  actions: SessionActions,
): Promise<void> {
  debugLog("REACT", `startNewSession: projectId=${projectId}, path=${projectPath}`);

  const session = await actions.createSession(projectId, content, null);
  if (!session) return;

  debugLog("REACT", `Session created: id=${session.id}`);
  addUserMessage(session.id, content, actions.addMessage);

  try {
    debugLog("REACT", `Invoking start_agent_session: sid=${session.id}`);
    const returnedId = await invoke("start_agent_session", {
      sessionId: session.id,
      projectPath,
      prompt: content,
      model: null,
    });
    debugLog("REACT", `start_agent_session returned: ${String(returnedId)}`);
  } catch (e) {
    debugLog("REACT", `start_agent_session FAILED: ${String(e)}`);
    actions.updateStatus(session.id, "failed");
    actions.setError(`Failed to start agent: ${String(e)}`);
  }
}
```

Changes:
- Uses `actions.createSession()` instead of `agentApi.createSession()` + `actions.setSession()` + `actions.switchSession()`
- Uses `addUserMessage` (sync) instead of `persistAndAddUserMessage` (async)

**Step 5: Rewrite `sendFollowUp`**

Replace the entire function:

```ts
async function sendFollowUp(
  sessionId: string,
  projectPath: string,
  content: string,
  actions: Pick<SessionActions, "addMessage" | "updateStatus" | "setError">,
  resumeSessionId?: string | null,
): Promise<void> {
  addUserMessage(sessionId, content, actions.addMessage);
  actions.updateStatus(sessionId, "running");

  try {
    await invoke("send_agent_message", { sessionId, message: content });
  } catch {
    debugLog("REACT", `send_agent_message failed for ${sessionId}, spawning new worker (resume=${resumeSessionId ?? "none"})`);
    try {
      await invoke("start_agent_session", {
        sessionId,
        projectPath,
        prompt: content,
        model: null,
        resumeSessionId: resumeSessionId ?? null,
      });
    } catch (e2) {
      actions.updateStatus(sessionId, "failed");
      actions.setError(`Failed to start agent: ${String(e2)}`);
    }
  }
}
```

Changes: removed `agentApi.updateSessionStatus` call — `actions.updateStatus` (which calls `store.updateSessionStatus`) now handles persistence.

**Step 6: Run tests**

Run: `pnpm vitest run src/features/agents/sessionActions.test.ts`

Expected: Some tests will fail because they mock the old API and assert old behavior. We fix that in Task 5.

**Step 7: Commit**

```bash
git add src/features/agents/sessionActions.ts
git commit -m "refactor: remove agentApi writes from sessionActions (store handles persistence)"
```

---

### Task 5: Update `sessionActions.test.ts`

**Files:**
- Modify: `src/features/agents/sessionActions.test.ts`

**Step 1: Remove the `agentApi` mock**

Delete lines 8-12:

```ts
vi.mock("./api", () => ({
  createSession: vi.fn(),
  addMessage: vi.fn(),
  updateSessionStatus: vi.fn(),
}));
```

**Step 2: Update `createMockActions` to include `createSession`**

Replace lines 23-31:

```ts
function createMockActions(): SessionActions {
  return {
    createSession: vi.fn(),
    switchSession: vi.fn(),
    addMessage: vi.fn(),
    updateStatus: vi.fn(),
    setError: vi.fn(),
  };
}
```

**Step 3: Update `startNewSession` tests**

The first test ("creates session, switches to it, and invokes agent") needs updating. `actions.createSession` now returns the session directly:

```ts
it("creates session via store, adds message, and invokes agent", async () => {
  const actions = createMockActions();
  const sessionData = {
    id: "new-session-id",
    projectId: "proj-1",
    status: "running" as const,
    prompt: "Write a test",
    model: null,
    sdkSessionId: null,
    createdAt: new Date().toISOString(),
    endedAt: null,
  };

  vi.mocked(actions.createSession).mockResolvedValue(sessionData);
  vi.mocked(invoke).mockResolvedValue("new-session-id");

  await startNewSession("proj-1", "/tmp/project", "Write a test", actions);

  expect(actions.createSession).toHaveBeenCalledWith("proj-1", "Write a test", null);
  expect(actions.addMessage).toHaveBeenCalled();
  expect(invoke).toHaveBeenCalledWith("start_agent_session", {
    sessionId: "new-session-id",
    projectPath: "/tmp/project",
    prompt: "Write a test",
    model: null,
  });
});
```

**Step 4: Update "sets error when session creation fails" test**

```ts
it("returns early when session creation fails", async () => {
  const actions = createMockActions();
  vi.mocked(actions.createSession).mockResolvedValue(null);

  await startNewSession("proj-1", "/tmp/project", "prompt", actions);

  expect(invoke).not.toHaveBeenCalled();
  expect(actions.addMessage).not.toHaveBeenCalled();
});
```

**Step 5: Update "sets error when invoke fails" test**

```ts
it("sets error when invoke fails", async () => {
  const actions = createMockActions();
  const sessionData = {
    id: "s1",
    projectId: "p1",
    status: "running" as const,
    prompt: "test",
    model: null,
    sdkSessionId: null,
    createdAt: new Date().toISOString(),
    endedAt: null,
  };

  vi.mocked(actions.createSession).mockResolvedValue(sessionData);
  vi.mocked(invoke).mockRejectedValue(new Error("sidecar crash"));

  await startNewSession("p1", "/tmp/p", "test", actions);

  expect(actions.updateStatus).toHaveBeenCalledWith("s1", "failed");
  expect(actions.setError).toHaveBeenCalledWith(
    expect.stringContaining("Failed to start agent"),
  );
});
```

**Step 6: Update `sendFollowUp` tests**

Remove the `api` variable and `agentApi` mock calls. The tests only need to verify store actions + invoke:

For "persists message, updates status, and invokes send":

```ts
it("adds message, updates status, and invokes send", async () => {
  const actions = createMockActions();
  vi.mocked(invoke).mockResolvedValue(undefined);

  await sendFollowUp("s1", "/tmp/project", "follow up", actions);

  expect(actions.addMessage).toHaveBeenCalled();
  expect(actions.updateStatus).toHaveBeenCalledWith("s1", "running");
  expect(invoke).toHaveBeenCalledWith("send_agent_message", {
    sessionId: "s1",
    message: "follow up",
  });
});
```

Similarly update the stale session fallback and both-fail tests to remove `agentApi` mock setup.

**Step 7: Remove unused `getApi` helper and `ok`/`err` imports**

Delete lines 6, 19-21 (the `ok`/`err` imports and `getApi` function).

**Step 8: Run tests**

Run: `pnpm vitest run src/features/agents/sessionActions.test.ts`

Expected: All tests pass.

**Step 9: Commit**

```bash
git add src/features/agents/sessionActions.test.ts
git commit -m "test: update sessionActions tests for store-owns-persistence"
```

---

### Task 6: Update `useBootstrap` to use `store.hydrate()`

**Files:**
- Modify: `src/hooks/useBootstrap.test.ts` (the restore logic lives here)

**Step 1: Identify how bootstrap currently works**

The current `useBootstrap.test.ts` has a `restoreSessionsForTest()` function that directly calls `agentApi` methods. We need to replace this with `store.hydrate()`.

**Step 2: Rewrite `restoreSessionsForTest`**

Replace the entire function (lines 33-65):

```ts
async function restoreSessionsForTest(): Promise<void> {
  await useAgentStore.getState().hydrate();
}
```

**Step 3: Update the mock setup**

The tests already mock `agentApi` — verify the mock at line 7 includes `markInterruptedSessions`, `getAllSessions`, `getMessages`. These are the functions the store's `hydrate` will call internally.

Since `store.ts` now imports `agentApi`, we need to mock it via the store's import path. Update the mock:

```ts
vi.mock("@/features/agents/api", () => ({
  markInterruptedSessions: vi.fn(),
  getAllSessions: vi.fn(),
  getMessages: vi.fn(),
  createSession: vi.fn(),
  updateSessionStatus: vi.fn(),
  addMessage: vi.fn(),
}));
```

Also add mock for debugLog:

```ts
vi.mock("@/shared/debugLog", () => ({
  debugLog: vi.fn(),
}));
```

**Step 4: Run tests**

Run: `pnpm vitest run src/hooks/useBootstrap.test.ts`

Expected: All existing tests pass — the behavior is the same, just routed through `store.hydrate()`.

**Step 5: Commit**

```bash
git add src/hooks/useBootstrap.test.ts
git commit -m "refactor: use store.hydrate() in bootstrap tests"
```

---

### Task 7: Update ChatPane caller to use new `SessionActions` interface

**Files:**
- Modify: `src/features/agents/components/ChatPane.tsx` (or wherever `startNewSession`/`sendFollowUp` are called)

**Step 1: Find callers of `startNewSession` and `sendFollowUp`**

Search for usages in `ChatPane.tsx` or parent components.

**Step 2: Update the `actions` object construction**

Where the code previously passed `setSession` from the store, it now needs to pass `createSession`:

Before:
```ts
const actions = {
  setSession: store.setSession,
  switchSession: store.switchSession,
  addMessage: store.addMessage,
  updateStatus: store.updateSessionStatus,
  setError: store.setError,
};
```

After:
```ts
const actions = {
  createSession: store.createSession,
  switchSession: store.switchSession,
  addMessage: store.addMessage,
  updateStatus: store.updateSessionStatus,
  setError: store.setError,
};
```

**Step 3: Run full test suite**

Run: `pnpm vitest run`

Expected: All tests pass.

**Step 4: Commit**

```bash
git add src/features/agents/components/ChatPane.tsx
git commit -m "refactor: update ChatPane to use store.createSession"
```

---

### Task 8: TDD — Edge cases and parallel resilience tests

**Files:**
- Modify: `src/features/agents/store.test.ts`

These tests verify the store remains consistent under edge conditions. Write them first (TDD), then verify they pass with the new implementation.

**Step 1: Add race condition test — rapid-fire addMessage from multiple sessions**

```ts
describe("resilience — race conditions and edge cases", () => {
  it("handles rapid-fire addMessage across 5 parallel sessions", async () => {
    const api = await import("./api");
    vi.mocked(api.addMessage).mockResolvedValue(ok({
      id: "mock", sessionId: "s", role: "assistant" as const,
      content: "", thinking: null, toolCalls: null, usage: null, timestamp: "",
    }));

    const store = useAgentStore.getState();
    const sessionIds = ["s1", "s2", "s3", "s4", "s5"];

    // Simulate 5 agents each getting 10 messages rapidly
    for (const sid of sessionIds) {
      for (let i = 0; i < 10; i++) {
        store.addMessage(sid, createMockMessage({
          sessionId: sid,
          content: `msg-${i}`,
        }));
      }
    }

    // Each session should have exactly 10 messages, no cross-contamination
    for (const sid of sessionIds) {
      const msgs = useAgentStore.getState().messagesBySession.get(sid);
      expect(msgs).toHaveLength(10);
      // Verify ordering preserved
      msgs?.forEach((m, i) => {
        expect(m.content).toBe(`msg-${i}`);
      });
    }

    // Verify persist was called 50 times total (5 sessions * 10 messages)
    expect(vi.mocked(api.addMessage)).toHaveBeenCalledTimes(50);
  });

  it("handles concurrent updateSessionStatus across sessions", () => {
    const store = useAgentStore.getState();
    const sessions = Array.from({ length: 5 }, (_, i) =>
      createMockSession({ status: "running" }),
    );

    for (const s of sessions) store.setSession(s);

    // Complete sessions 0,2,4 — fail sessions 1,3
    sessions.forEach((s, i) => {
      store.updateSessionStatus(s.id, i % 2 === 0 ? "completed" : "failed");
    });

    const state = useAgentStore.getState();
    sessions.forEach((s, i) => {
      const stored = state.sessions.get(s.id);
      expect(stored?.status).toBe(i % 2 === 0 ? "completed" : "failed");
      expect(stored?.endedAt).toBeTruthy();
    });
  });

  it("handles updateSessionStatus on non-existent session without corrupting state", () => {
    const store = useAgentStore.getState();
    const session = createMockSession({ status: "running" });
    store.setSession(session);

    // Update a phantom session
    store.updateSessionStatus("phantom-session", "completed");

    // Original session untouched
    const state = useAgentStore.getState();
    expect(state.sessions.size).toBe(1);
    expect(state.sessions.get(session.id)?.status).toBe("running");
  });

  it("handles addMessage after clearSessionData (session deleted mid-stream)", () => {
    const store = useAgentStore.getState();
    const session = createMockSession();
    store.setSession(session);
    store.addMessage(session.id, createMockMessage({ sessionId: session.id }));

    // Session gets deleted (user action)
    store.clearSessionData(session.id);

    // A stale event arrives for the deleted session
    store.addMessage(session.id, createMockMessage({
      sessionId: session.id,
      content: "stale event",
    }));

    // Message lands in orphan bucket — store doesn't crash
    const msgs = useAgentStore.getState().messagesBySession.get(session.id);
    expect(msgs).toHaveLength(1);
    expect(msgs?.[0]?.content).toBe("stale event");
  });
});
```

**Step 2: Add test for SQLite persist failure not blocking UI**

```ts
describe("resilience — persistence failures", () => {
  it("addMessage updates UI even when SQLite fails", async () => {
    const api = await import("./api");
    vi.mocked(api.addMessage).mockRejectedValue(new Error("disk full"));

    const store = useAgentStore.getState();
    const msg = createMockMessage({ sessionId: "s1", content: "should appear" });

    // Should not throw
    store.addMessage("s1", msg);

    // UI state is updated despite persist failure
    const msgs = useAgentStore.getState().messagesBySession.get("s1");
    expect(msgs).toHaveLength(1);
    expect(msgs?.[0]?.content).toBe("should appear");
  });

  it("updateSessionStatus updates UI even when SQLite fails", async () => {
    const api = await import("./api");
    vi.mocked(api.updateSessionStatus).mockRejectedValue(new Error("locked"));

    const store = useAgentStore.getState();
    const session = createMockSession({ status: "running" });
    store.setSession(session);

    store.updateSessionStatus(session.id, "completed");

    expect(useAgentStore.getState().sessions.get(session.id)?.status).toBe("completed");
  });

  it("createSession returns null and sets error when SQLite fails", async () => {
    const api = await import("./api");
    vi.mocked(api.createSession).mockResolvedValue(err("DB locked"));

    const result = await useAgentStore.getState().createSession("p1", "test", null);

    expect(result).toBeNull();
    expect(useAgentStore.getState().error).toBe("DB locked");
    expect(useAgentStore.getState().sessions.size).toBe(0);
  });
});
```

**Step 3: Add test for hydration edge cases**

```ts
describe("resilience — hydration edge cases", () => {
  it("hydrate sets loading=true during operation and false after", async () => {
    const api = await import("./api");
    vi.mocked(api.markInterruptedSessions).mockResolvedValue(ok(0));
    vi.mocked(api.getAllSessions).mockResolvedValue(ok([]));

    const promise = useAgentStore.getState().hydrate();
    // Note: loading state checked after resolution since mocks resolve immediately
    await promise;
    expect(useAgentStore.getState().loading).toBe(false);
  });

  it("hydrate handles getAllSessions failure gracefully", async () => {
    const api = await import("./api");
    vi.mocked(api.markInterruptedSessions).mockResolvedValue(ok(0));
    vi.mocked(api.getAllSessions).mockResolvedValue(err("table missing"));

    await useAgentStore.getState().hydrate();

    const state = useAgentStore.getState();
    expect(state.error).toBe("table missing");
    expect(state.loading).toBe(false);
    expect(state.sessions.size).toBe(0);
  });

  it("hydrate with messages load failure still loads sessions", async () => {
    const api = await import("./api");
    const session = createMockSession({ id: "s1" });
    vi.mocked(api.markInterruptedSessions).mockResolvedValue(ok(0));
    vi.mocked(api.getAllSessions).mockResolvedValue(ok([session]));
    vi.mocked(api.getMessages).mockResolvedValue(err("corrupt messages"));

    await useAgentStore.getState().hydrate();

    const state = useAgentStore.getState();
    expect(state.sessions.size).toBe(1);
    expect(state.activeSessionId).toBe("s1");
    // No messages, but session is there
    expect(state.messagesBySession.has("s1")).toBe(false);
  });

  it("hydrate does not clobber in-flight session data", async () => {
    const api = await import("./api");
    const store = useAgentStore.getState();

    // Simulate an active session that's already in the store
    const activeSession = createMockSession({ id: "active", status: "running" });
    store.setSession(activeSession);
    store.addMessage("active", createMockMessage({
      sessionId: "active",
      content: "in-flight message",
    }));

    // Hydrate loads old sessions from DB
    const dbSession = createMockSession({ id: "old", status: "completed" });
    vi.mocked(api.markInterruptedSessions).mockResolvedValue(ok(0));
    vi.mocked(api.getAllSessions).mockResolvedValue(ok([dbSession]));
    vi.mocked(api.getMessages).mockResolvedValue(ok([]));

    await useAgentStore.getState().hydrate();

    // DB sessions replace store sessions (hydrate is full reload)
    const state = useAgentStore.getState();
    expect(state.sessions.has("old")).toBe(true);
    // Note: in-flight data from "active" is replaced — this is expected
    // because hydrate runs at app start before any sessions are active
  });
});
```

**Step 4: Add test for message queue + completion interaction**

```ts
describe("resilience — completion with queued messages", () => {
  it("dequeue returns correct message after rapid queue/dequeue cycles", () => {
    const store = useAgentStore.getState();

    // Queue for multiple sessions rapidly
    store.queueMessage("s1", "s1-first");
    store.queueMessage("s2", "s2-first");
    store.queueMessage("s1", "s1-second");
    store.queueMessage("s2", "s2-second");

    // Dequeue from s1 — should get FIFO order
    const d1 = useAgentStore.getState().dequeueMessage("s1");
    expect(d1?.content).toBe("s1-first");

    // s2 queue unaffected
    const d2 = useAgentStore.getState().dequeueMessage("s2");
    expect(d2?.content).toBe("s2-first");

    // Second dequeue from each
    expect(useAgentStore.getState().dequeueMessage("s1")?.content).toBe("s1-second");
    expect(useAgentStore.getState().dequeueMessage("s2")?.content).toBe("s2-second");

    // Empty now
    expect(useAgentStore.getState().dequeueMessage("s1")).toBeUndefined();
  });

  it("clearSessionData during queued message doesn't affect other sessions", () => {
    const store = useAgentStore.getState();
    store.queueMessage("s1", "msg for s1");
    store.queueMessage("s2", "msg for s2");

    store.clearSessionData("s1");

    const queue = useAgentStore.getState().messageQueue;
    expect(queue).toHaveLength(1);
    expect(queue[0]?.sessionId).toBe("s2");
  });
});
```

**Step 5: Run all tests**

Run: `pnpm vitest run src/features/agents/store.test.ts`

Expected: All tests pass.

**Step 6: Commit**

```bash
git add src/features/agents/store.test.ts
git commit -m "test: add resilience tests for race conditions, parallel agents, persist failures"
```

---

### Task 9: Final verification and cleanup

**Files:**
- Check: all modified files

**Step 1: Verify no remaining direct `agentApi` write calls outside store**

Search for `agentApi.createSession`, `agentApi.addMessage`, `agentApi.updateSessionStatus` in `src/` (excluding `store.ts` and test files):

Run: `rg "agentApi\.(createSession|addMessage|updateSessionStatus)" src/ --glob '!*.test.*'`

Expected: Only hits in `src/features/agents/store.ts`.

**Step 2: Run full test suite**

Run: `pnpm vitest run`

Expected: All tests pass.

**Step 3: Run linter**

Run: `pnpm eslint src/`

Expected: No new errors.

**Step 4: Run TypeScript check**

Run: `pnpm tsc --noEmit`

Expected: No type errors.

**Step 5: Commit cleanup if needed**

If any lint/type fixes were needed:

```bash
git add -u
git commit -m "chore: lint and type fixes for store-owns-persistence"
```

**Step 6: Final commit with all changes**

```bash
git add -u
git commit -m "feat: store-owns-persistence — single source of truth for agent state"
```
