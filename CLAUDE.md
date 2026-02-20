# Central

macOS desktop app for orchestrating parallel Claude Code agents. Tauri v2 + React 19 + TypeScript strict + Zustand + shadcn/ui.

## Commands
- Dev: `pnpm tauri dev`
- Build: `pnpm tauri build`
- Test (TS): `pnpm vitest`
- Test (Rust): `cargo test --manifest-path src-tauri/Cargo.toml`
- Lint (TS): `pnpm eslint src/`
- Lint (Rust): `cargo clippy --manifest-path src-tauri/Cargo.toml`
- Format: `pnpm prettier --write src/`

## Code Style
- Functional paradigm. No classes. Pure functions + composition.
- Feature-based file org: `src/features/{agents,projects,files,terminal,settings}/`
- Result types for errors: Rust `Result<T,E>`, TS `neverthrow`. No silent failures.
- Self-documenting code. Comments only for "why".
- camelCase (TS), snake_case (Rust).

## Architecture
- Tauri Rust backend: git ops (git2-rs), PTY (portable-pty), sidecar management
- Node.js sidecar: Claude Agent SDK (`@anthropic-ai/claude-code`) for agent orchestration
- IPC: Tauri v2 Channels API for streaming, invoke() for request/response
- State: Zustand stores — agents, projects, files, ui, settings (separate stores, selective subscriptions)
- Styling: Tailwind + shadcn/ui. Theme via HSL CSS variables in globals.css. Dark mode only.
- Agent abstraction layer: design for Claude Code now, extensible to Codex/others later

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
- xterm.js: call `term.dispose()` on unmount, don't call `fit()` before container visible
- Sidecar orphan processes: register cleanup on app quit, track all child PIDs
- Zustand: always use selectors (`useStore(s => s.field)`), never bare `useStore()`
- All `@codemirror/*` packages must be compatible versions — pin together
