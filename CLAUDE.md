# Central

macOS desktop app for orchestrating parallel Claude Code agents. Tauri v2 + React 19 + TypeScript strict + Zustand + shadcn/ui.

## Commands
- Dev: `pnpm tauri dev`
- Build: `pnpm tauri build`
- Test (TS): `pnpm vitest`
- Test (Rust): `cargo test --manifest-path src-tauri/Cargo.toml`
- Test (SDK): `cd sidecar && pnpm test` (real SDK, costs tokens)
- Lint (TS): `pnpm eslint src/`
- Lint (Rust): `cargo clippy --manifest-path src-tauri/Cargo.toml`
- Format: `pnpm prettier --write src/`

## Code Style
- Functional paradigm. No classes. Pure functions + composition.
- Feature-based file org: `src/features/{agents,projects,files,settings}/`
- Result types for errors: Rust `Result<T,E>`, TS `neverthrow`. No silent failures.
- Self-documenting code. Comments only for "why".
- camelCase (TS), snake_case (Rust).

## Architecture

### Per-Session Worker Architecture
- **One Node.js process per agent session** — no multiplexing, no shared state
- Rust `SidecarManager` spawns `node --import tsx sidecar/src/session-worker.ts` per session
- Communication: stdin (JSON-line commands) → worker → stdout (JSON-line events) → Rust → Tauri events → React
- Worker lifecycle: Rust spawns → sends `start_session` → SDK runs `query()` → events stream back → `end_session` closes queue → process exits
- **NEVER use `@anthropic-ai/claude-code`** — always use `@anthropic-ai/claude-agent-sdk` with `import { query } from "@anthropic-ai/claude-agent-sdk"`

### Key Components
- `sidecar/src/session-worker.ts` — per-session worker, wraps SDK `query()` with stdin/stdout protocol
- `sidecar/src/types.ts` — `WorkerCommand` (stdin) and `SidecarEvent` (stdout) types
- `src-tauri/src/sidecar/manager.rs` — spawns/manages worker processes, routes commands
- `src-tauri/src/sidecar/types.rs` — Rust mirrors of the JSON protocol
- `src-tauri/src/commands/agents.rs` — Tauri commands: start/send/abort/list sessions
- `src/features/agents/hooks/useAgentEvents.ts` — Tauri event listener, dispatches to store
- `src/features/agents/store.ts` — Zustand store for sessions, messages, SDK session IDs

### SDK Integration Details
- `query()` with `AsyncIterable<SDKUserMessage>` prompt for multi-turn conversations
- `settingSources: ["project"]` — loads project CLAUDE.md and .claude/settings.json
- `systemPrompt: { type: 'preset', preset: 'claude_code' }` — full Claude Code system prompt
- `thinking: { type: 'adaptive' }` — model decides when to use extended thinking
- `canUseTool` callback routes permission requests to frontend via events
- `maxBudgetUsd` for cost control per session
- SDK session IDs captured for future session resume support

### Data Layer
- **SQLite** via `@tauri-apps/plugin-sql` — single DB `sqlite:central.db`
- Schema in `src-tauri/migrations/` — tables: `projects`, `agent_sessions`, `messages`, `app_settings`
- TS API layer: `src/features/agents/api.ts`, `src/features/projects/api.ts` — `Database.get(DB_NAME)` pattern
- All queries use `neverthrow` Result types. Migrations run automatically on app start.
- KV store for app settings via `app_settings` table

### Other
- Tauri Rust backend: git ops (git2-rs), sidecar process management
- IPC: Tauri events for streaming, invoke() for request/response
- State: Zustand stores — agents, projects, files, ui, settings (separate stores, selective subscriptions)
- Styling: Tailwind + shadcn/ui. Theme via HSL CSS variables in globals.css. Dark mode only.

## Guardrails
- **Guiding principle:** Single-purpose, resilient, tested. Every file/function does one thing well.
- **Max file:** 300 lines — refactor before exceeding
- **Max function:** 50 lines — decompose if longer
- **Dependency direction:** UI → features → shared → core. No circular imports.
- **Tests required for:** agent lifecycle, parallelism, interruption/abort, data persistence/restore, IPC bridge
- **Before adding deps:** always ask first (npm or cargo)
- **Pause for review before:** architectural changes, adding dependencies
- **Forbidden:** `any` type, god objects, inline secrets, committed console.log, mega state objects
- **Tech debt:** TODO comments with description

## Environment
- No Anthropic API key needed (Claude Max auto-connects via SDK reading ~/.claude)
- AppSettings KV store in SQLite: openrouter_key, debug_mode
- Never hardcode paths or secrets

## Gotchas
- `Repository` (git2-rs) is !Send/!Sync — open new instance per Tauri command handler
- Always clean up Tauri `listen()` calls in useEffect returns
- CodeMirror: call `view.destroy()` on unmount, set explicit height + overflow
- Worker orphan processes: `SidecarManager::shutdown()` kills all on app quit, also `Drop` impl
- Zustand: always use selectors (`useStore(s => s.field)`), never bare `useStore()`
- All `@codemirror/*` packages must be compatible versions — pin together
- When testing SDK inside Claude Code, unset `CLAUDECODE` env var to avoid nested session detection
- Worker stays alive between turns (AsyncIterable blocks on follow-up queue) — send `end_session` to exit cleanly
- React StrictMode: use `cancelled` flag pattern for async `listen()` setup to prevent double listeners
- Debug log at `/tmp/central-debug.log` — all Rust + worker stderr captured there
