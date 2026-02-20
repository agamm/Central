# Central Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

## Original Vision

> **Raw user input:** "Build a daily power tool - Mac desktop app for orchestrating multiple parallel Claude Code (later also Codex agents), each running in local folders. The UI shows all active agents at a glance — what they're working on, status, and what needs attention — with the ability to spin up new agents, monitor progress in real time, and review/merge their code changes in a basic file viewer with syntax highlighting. Support multiple repos across multiple folders, allow agents to run via existing Claude Pro/Max subscriptions via the Claude Agent SDK. Native app snappy interface. Left pane projects, mid pane chat, right pane files (with git support) + terminal. High quality from day one — a small feature set but each feature feels great to use. No keyboard shortcuts yet, but the core experience (launching agents, switching between parallel running agents, monitoring, viewing files/git) should be polished and snappy. For distribution: build for myself, keep it clean enough to share, and open source when ready. That means no hardcoded paths, reasonable config, but no need for onboarding flows or multi-platform support yet. I'll probably run 2-5 agents at once, but they might be all running in parallel - so it has to be robust for that."

**Goal:** A macOS desktop app for orchestrating 2-5 parallel Claude Code agents across multiple repos, with real-time monitoring, file viewing with git support, and a polished three-pane UI.

**Problem:** Managing multiple Claude Code sessions manually is context-switching hell — no way to see what all agents are doing at a glance, switch between them quickly, or review their changes without juggling terminal windows.

**Platform:** macOS native desktop app

**Scope:** MVP with polish — small feature set, each feature feels great

**Audience:** Solo developer (self), open-sourceable later

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Desktop | Tauri v2 | Rust backend, web frontend, small binary |
| Frontend | React 19 + Vite + TypeScript strict | UI framework |
| State | Zustand + immer | Multiple stores with selective subscriptions |
| Styling | Tailwind CSS + shadcn/ui | Components + HSL CSS variable theming |
| Agent SDK | `@anthropic-ai/claude-code` | Spawning/managing Claude Code agents |
| Code viewer | CodeMirror 6 | Syntax highlighting, diff view, read-only |
| Terminal | xterm.js v5 + `portable-pty` | Embedded terminal with real PTY |
| Storage | SQLite (Tauri plugin) | Projects, sessions, messages, settings |
| Git | git2-rs (vendored) | Status, diff, log, branches — native Rust |
| IPC | Tauri v2 Channels API | High-throughput streaming |
| Errors (TS) | neverthrow | Result types for TypeScript |
| Icons | Lucide | Clean, tree-shakeable |
| Package mgr | pnpm | Fast, strict resolution |
| Lint/Format | ESLint + Prettier (TS), clippy + rustfmt (Rust) | Code quality |

**Avoid:** Electron, Redux/MobX, heavy ORMs

### Documentation References

| Technology | Docs | Key Reference |
|---|---|---|
| Tauri v2 | https://v2.tauri.app | Channels API, SQLite plugin, sidecar |
| React 19 | https://react.dev | llms.txt available |
| Zustand | https://zustand.docs.pmnd.rs | Slices pattern, middleware |
| shadcn/ui | https://ui.shadcn.com/docs | Theming, dark mode |
| CodeMirror 6 | https://codemirror.net/docs/ | System guide, extensions |
| xterm.js | https://xtermjs.org/docs/ | Addons |
| Claude SDK | https://docs.anthropic.com/en/docs/claude-code/sdk | npm: @anthropic-ai/claude-code |
| git2-rs | https://docs.rs/git2/latest/git2/ | GitHub: rust-lang/git2-rs |

### Best Practices (condensed)

**Tauri v2:** Use Channels API (not events) for streaming. Vite config: `clearScreen: false`, `strictPort: true`, port 1420. Sidecar for Node.js in `bundle.externalBin`. Sign sidecar binaries for macOS.

**React 19:** Use `useTransition` for agent switching. `ref` is a regular prop now. Skip Server Components entirely. Clean up `listen()` in useEffect returns.

**Zustand:** Separate stores per domain. Always use selectors. `useShallow` for object selections. Middleware order: devtools → persist → immer. Custom persist adapter for Tauri filesystem.

**shadcn/ui:** CLI-based (`npx shadcn@latest add`). Key components: ResizablePanel, Tabs, ScrollArea, Command, Dialog. Set `darkMode: "class"` in tailwind.config.

**CodeMirror 6:** Use `Compartment` for dynamic language switching. `EditorState.readOnly.of(true)` + `EditorView.editable.of(false)`. Theme via CSS variables. Destroy view on unmount.

**xterm.js:** `@xterm/xterm` v5+ with fit, web-links, webgl addons. PTY via `portable-pty` + Channels. ResizeObserver → debounced fit → resize PTY.

**git2-rs:** Vendor features: `vendored-libgit2` + `vendored-openssl`. Open new Repository per command handler (!Send/!Sync). Filter paths with StatusOptions.

### Architecture

```
┌─────────────────────────────────────────────┐
│ Tauri Frontend (React + Zustand)            │
│ ┌──────────┬──────────────┬────────────────┐│
│ │ Projects │  Agent Chat  │ Files + Term   ││
│ │ (left)   │  (middle)    │ (right)        ││
│ └──────────┴──────────────┴────────────────┘│
└─────────────┬───────────────────────────────┘
              │ invoke() / Channels API
┌─────────────▼───────────────────────────────┐
│ Tauri Rust Backend                          │
│ ┌──────────────┐ ┌───────────────────────┐  │
│ │ git2-rs      │ │ Sidecar Manager       │  │
│ │ status/diff/ │ │ spawn/route/abort     │  │
│ │ log/branches │ │ agent processes       │  │
│ └──────────────┘ └──────────┬────────────┘  │
│ ┌──────────────┐            │               │
│ │ portable-pty │            │ stdin/stdout   │
│ │ PTY mgmt     │            │ JSON-lines     │
│ └──────────────┘ ┌──────────▼────────────┐  │
│                  │ Node.js Sidecar       │  │
│                  │ @anthropic-ai/        │  │
│                  │ claude-code SDK       │  │
│                  │ Agent 1..N            │  │
│                  └───────────────────────┘  │
└─────────────────────────────────────────────┘
```

## Data Model

| Entity | Key Attributes | Relationships |
|---|---|---|
| **Project** | id, path, name, created_at | has many AgentSessions |
| **AgentSession** | id, project_id, status, prompt, model, sdk_session_id, created_at, ended_at | belongs to Project, has many Messages |
| **Message** | id, session_id, role, content, thinking, tool_calls (JSON), usage (JSON), timestamp | belongs to AgentSession |
| **AppSettings** | key, value | KV store singleton |

**Status enum:** running → completed | failed | aborted | interrupted (crash recovery)

**Rules:** Projects are mutable (soft-delete). Sessions are immutable once complete. Messages are append-only with full detail (content + thinking + tool calls + usage). Files/git state derived at runtime via git2-rs (not stored). All history kept forever. No Anthropic API key needed (SDK reads ~/.claude).

## User Stories & Flows

### Flow 1: Add Project
1. Click "Add Project" (or empty state CTA) → macOS folder picker → project appears in left pane
- Empty state: "Add your first project" CTA
- Edge: No git repo → works, git features disabled

### Flow 2: Launch Agent
1. Select project → type prompt in chat → Enter → agent starts streaming
2. Chat shows: assistant bubbles + collapsible tool calls + expandable thinking
3. Left pane: agent nested under project with "running" badge
- Error: SDK unavailable → inline error, status = failed

### Flow 3: Monitor Agents
- Left pane: projects → nested agents with status badges (running/completed/failed/aborted)
- Click any agent → chat + right pane update
- Edge: 5 agents streaming — throttle/virtualize rendering

### Flow 4: Switch Between Agents
- Click agent in left pane → chat switches (preserved scroll position) → right pane shows project files
- Edge: mid-stream switching must not lose output

### Flow 5: Review File Changes
- Right pane: file tree with changed files highlighted → click → diff view in CodeMirror
- Edge: large diffs need performant rendering

### Flow 6: Notifications
- Status badge updates + macOS notification if backgrounded

### Flow 7: Message Queue (follow-ups)
- Type messages while agent is running → queued → sent when agent responds
- Queue is visible, editable, and cancellable

### Priority
1. Add project → 2. Launch agent → 3. Switch agents → 4. Monitor → 5. Notifications → 6. File review → 7. Message queue

## Design Language

**Aesthetic:** Linear + Raycast inspired. Clean, minimal, premium dark. Dense/compact for max info density.

| Token | Value | Usage |
|---|---|---|
| Background | hsl(224, 71%, 4%) | Main background |
| Surface | hsl(224, 71%, 6%) | Cards, panels |
| Muted | hsl(223, 47%, 11%) | Secondary backgrounds |
| Border | hsl(216, 34%, 17%) | 1px subtle borders |
| Foreground | hsl(213, 31%, 91%) | Primary text |
| Accent | TBD | Interactive elements |

**Typography:** Inter (UI, 13px base), JetBrains Mono (code/terminal, 12-13px)

**Spacing:** 4px base unit, 8px standard gap. Dense padding.

**Motion:** 100-200ms ease-out fades/slides. No springs. Instant for status changes.

**Surfaces:** 1px borders, no shadows, flat separation.

## Architecture Decisions

| Decision | Reasoning |
|---|---|
| SDK auth via ~/.claude | SDK reads existing Claude Max config. Zero auth management in Central. |
| Git conflicts: not handled for MVP | Users responsible. Conflicts surface in diff viewer if they occur. |
| Terminal: general shell per project | Not per-agent. For running tests, git commands independently. |
| git2-rs over gitoxide | Battle-tested (used by Cargo), stable API, better docs. Gitoxide is pre-1.0. |
| Sidecar for Agent SDK | SDK is Node.js. Tauri sidecar pattern bundles compiled Node binary. JSON-lines IPC. |
| Separate Zustand stores | Prevents re-render cascading. Agents store updates don't re-render file viewer. |

## Known Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Agent crashes/hangs | Timeout + AbortController. Status → failed. User can retry. |
| 5 agents streaming perf | Virtualize chat. Selective subscriptions. Only render visible agent. |
| Agent switching fragile | Full state in Zustand per agent. Lazy-load CodeMirror/xterm. Preserve scroll. |
| Crash/close recovery | Persist to SQLite on every message. Restore on restart. Mark interrupted sessions. |
| SDK breaking changes | Agent abstraction layer. Pin version. Update in isolation. |
| Orphan sidecar processes | Cleanup on app quit. Track PIDs. Force-kill on shutdown. |

---

## Implementation Phases

### Phase 1: Project Setup
- [ ] `pnpm create tauri-app` with React + TypeScript template
- [ ] Configure Vite for Tauri (clearScreen, strictPort, envPrefix)
- [ ] Set up ESLint + Prettier + clippy + rustfmt
- [ ] Install shadcn/ui (`npx shadcn@latest init`), configure dark theme CSS variables
- [ ] Add Zustand, neverthrow, lucide-react
- [ ] Add git2-rs to Cargo.toml with vendored features
- [ ] Set up SQLite via Tauri plugin, create initial schema (projects, sessions, messages, settings)
- [ ] Verify `pnpm tauri dev` runs clean
- [ ] Set up vitest

### Phase 2: Core Layout + Projects
- [ ] Three-pane layout with shadcn/ui ResizablePanelGroup
- [ ] Left pane: project list with "Add Project" button
- [ ] Folder picker via Tauri dialog API
- [ ] Project CRUD (add, rename, soft-delete) with SQLite persistence
- [ ] Empty state CTA
- [ ] Zustand project store with persistence

### Phase 3: Agent Orchestration (core)
- [ ] Node.js sidecar setup with Claude Agent SDK
- [ ] Rust sidecar manager: spawn, route messages, abort
- [ ] Tauri Channels for streaming agent output to frontend
- [ ] Agent session CRUD in SQLite
- [ ] Zustand agent store: session state, status tracking
- [ ] Chat pane: prompt input → launch agent → stream response
- [ ] Chat UI: message bubbles + collapsible tool calls + expandable thinking
- [ ] AbortController integration for cancellation
- [ ] Message queue: type while agent running, queue visible/editable/cancellable

### Phase 4: Agent Monitoring + Switching
- [ ] Left pane: agents nested under projects with status badges
- [ ] Click agent → switch chat + right pane context
- [ ] Preserve scroll position and chat state per agent
- [ ] Status badges: running (spinner), completed (green), failed (red), aborted (gray)
- [ ] macOS notifications on completion/failure (Tauri notification plugin)
- [ ] Performance: selective subscriptions, only render visible agent's stream

### Phase 5: File Viewer + Git
- [ ] Right pane file tree via git2-rs (Tauri commands for tree, status)
- [ ] Changed files highlighted in tree
- [ ] CodeMirror 6 viewer: read-only, dynamic language via Compartment
- [ ] Diff view for changed files
- [ ] Git status, branch info display
- [ ] Theme CodeMirror to match shadcn/ui dark palette

### Phase 6: Terminal
- [ ] xterm.js setup with fit, web-links, webgl addons
- [ ] portable-pty in Rust backend
- [ ] PTY spawn/resize/write via Tauri Channels
- [ ] ResizeObserver → debounced fit → PTY resize
- [ ] Terminal in right pane (below file viewer, resizable split)

### Phase 7: Crash Recovery + Polish
- [ ] Persist all session state to SQLite on every message
- [ ] On restart: restore sessions, mark running→interrupted
- [ ] Orphan process cleanup on app quit
- [ ] Agent timeout handling
- [ ] Error boundaries for React
- [ ] Loading/empty states for all panes
- [ ] Performance audit with 5 concurrent agents

### Phase 8: Testing
- [ ] Rust: unit tests for git2-rs wrappers, sidecar manager, PTY management
- [ ] TS: vitest for agent store logic, message queue, session restore
- [ ] Integration: agent lifecycle (spawn → stream → complete/fail/abort)
- [ ] Integration: parallelism (multiple agents, switching)
- [ ] Integration: crash recovery (persist → restore)

---

## Testing Strategy

- **Rust unit tests:** git2-rs wrappers (status, diff, log), sidecar spawn/kill, PTY lifecycle
- **TS unit tests (vitest):** Zustand store logic, neverthrow error handling, message queue operations
- **Integration tests:** Agent lifecycle end-to-end, parallel agents, data persistence/restore
- **UI tests:** Critical interactions only — agent launch, switching, status updates
- **No tests for:** Pure UI layout, styling, static components

## Open Questions
- Exact accent color for dark theme
- Whether to use Tauri's auto-updater plugin for distribution
- Message queue UI: inline in chat vs separate panel section
- CodeMirror diff: side-by-side vs unified
