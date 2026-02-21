# Store-Owns-Persistence Design

## Problem

The current architecture has dual write paths: every state mutation requires separate calls to both the Zustand store (for UI) and SQLite via `agentApi` (for persistence). This is spread across `sessionActions.ts` and `useAgentEvents.ts`, creating risk of data consistency bugs and race conditions under parallel agent load.

## Design

### Core Principle

The Zustand store becomes the single mutation API. Every store action:
1. Updates state synchronously (UI renders immediately)
2. Fires an async SQLite write (fire-and-forget, errors logged to debug log)

No code outside the store calls `agentApi` for writes.

### Approach: Store-Owns-Persistence

**Store actions gain built-in persistence:**

```ts
// Before: pure state update
addMessage: (sessionId, msg) => set(state => /* append */),

// After: state update + async persist
addMessage: (sessionId, msg) => {
  set(state => /* append */);
  agentApi.addMessage(sessionId, msg.role, msg.content, ...)
    .catch(e => debugLog('persist failed', e));
},
```

**sessionActions.ts simplifies from 5 calls to 3:**

```ts
// Before
await agentApi.createSession(...)     // SQLite
actions.setSession(session)           // Zustand
actions.switchSession(session.id)     // Zustand
await agentApi.addMessage(...)        // SQLite
actions.addMessage(...)               // Zustand
await invoke("start_agent_session")   // Rust IPC

// After
const session = await actions.createSession(projectId, content)  // both
actions.addUserMessage(sessionId, content)                        // both
await invoke("start_agent_session")                               // Rust IPC
```

**useAgentEvents.ts halves its logic:**

```ts
// Before
await agentApi.addMessage(sid, role, content, ...)
store.addMessage(sid, msg)

// After
store.addMessage(sid, msg)
```

### Hydration

On app start, `useBootstrap` calls `store.hydrate()` which loads all sessions and messages from SQLite into Zustand. This is the only time we read from SQLite into the store.

### api.ts Becomes Store-Internal

`agentApi` still exists as the SQLite access layer but only the store imports it for writes. External code can use it for read-only queries (hydration). This makes the write path impossible to misuse.

### Error Handling

Failed SQLite writes are logged to the debug log (`/tmp/central-debug.log`) and the UI continues. For a desktop app, the crash window between Zustand update and SQLite write is negligible (ms).

## File Changes

| File | Change |
|------|--------|
| `store.ts` | Actions gain async persistence. Import `agentApi`. Add `hydrate()` and `createSession()`. |
| `sessionActions.ts` | Remove all `agentApi.*` write calls. Only store actions + `invoke()`. |
| `useAgentEvents.ts` | Remove all `agentApi.*` write calls. Event handlers call store actions only. |
| `api.ts` | No code changes. Becomes store-internal for writes. |
| `useBootstrap.ts` | Call `store.hydrate()` on app start. |

## Migration Path

Incremental, each step independently shippable:

1. Add persistence to store actions (briefly redundant with existing writes)
2. Remove `agentApi` calls from `useAgentEvents.ts`
3. Remove `agentApi` calls from `sessionActions.ts`
4. Add `hydrate()` to `useBootstrap`
5. Clean up tests

## Testing

- **Store tests**: mock `agentApi` at module level. Verify state updates AND persist calls.
- **sessionActions tests**: verify store actions + `invoke()` called. No SQLite coordination testing.
- **useAgentEvents tests**: verify store actions called per event type.

## Decisions

- **Single source of truth**: Zustand (in-memory) for UI, SQLite as async persistence
- **Write ordering**: Zustand first (sync), SQLite second (async fire-and-forget)
- **Error handling**: Log and continue on SQLite failures
- **Recovery**: Full conversation history from SQLite on app restart
