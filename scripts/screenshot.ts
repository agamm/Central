/**
 * Generate a README screenshot with mock data.
 * Requires: pnpm tauri dev (or pnpm dev) running.
 * Usage: npx tsx scripts/screenshot.ts
 */
import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 },
    deviceScaleFactor: 2,
    colorScheme: "dark",
  });
  const page = await context.newPage();

  // Provide esbuild helpers that may be missing outside Tauri webview
  await page.addInitScript(() => {
    if (typeof (globalThis as any).__name === "undefined") {
      (globalThis as any).__name = (target: any, value: string) => {
        Object.defineProperty(target, "name", { value, configurable: true });
        return target;
      };
    }
  });

  // Mock ALL Tauri IPC by intercepting the internals before app loads
  await page.addInitScript(() => {
    const now = Date.now();
    const iso = (offset: number) => new Date(now + offset).toISOString();

    const PROJECTS = [
      { id: "p1", path: "/Users/dev/my-saas-app", name: "my-saas-app", created_at: iso(-7_200_000), deleted_at: null },
    ];

    const SESSIONS = [
      { id: "s1", project_id: "p1", status: "running", session_type: "chat", prompt: "Add user authentication with JWT", model: "claude-sonnet-4-6", sdk_session_id: null, created_at: iso(-3_600_000), ended_at: null },
      { id: "s2", project_id: "p1", status: "completed", session_type: "chat", prompt: "Fix database connection pooling", model: "claude-sonnet-4-6", sdk_session_id: null, created_at: iso(-7_200_000), ended_at: iso(-5_400_000) },
      { id: "s3", project_id: "p1", status: "running", session_type: "terminal", prompt: null, model: null, sdk_session_id: null, created_at: iso(-1_800_000), ended_at: null },
      { id: "s4", project_id: "p1", status: "completed", session_type: "chat", prompt: "Write API tests for /users endpoint", model: "claude-sonnet-4-6", sdk_session_id: null, created_at: iso(-10_800_000), ended_at: iso(-9_000_000) },
    ];

    const MESSAGES_S1 = [
      { id: "m1", session_id: "s1", role: "user", content: "Add JWT-based authentication to the Express API. Include login, register, and middleware for protected routes.", thinking: null, tool_calls: null, usage: null, timestamp: iso(-3_500_000) },
      {
        id: "m2", session_id: "s1", role: "assistant",
        content: "I'll implement JWT authentication for your Express API. Let me start by setting up the dependencies and creating the auth module.\n\nHere's my plan:\n1. Install `jsonwebtoken` and `bcryptjs`\n2. Create `src/middleware/auth.ts` — JWT verification middleware\n3. Create `src/routes/auth.ts` — login and register endpoints\n4. Add refresh token rotation\n5. Write tests",
        thinking: "Let me examine the project structure first to understand the existing codebase.",
        tool_calls: JSON.stringify([
          { id: "tc1", name: "Bash", input: { command: "npm install jsonwebtoken bcryptjs" }, result: "added 4 packages in 2.1s", isError: false },
          { id: "tc2", name: "Write", input: { file_path: "src/middleware/auth.ts", content: "..." }, result: "File written successfully", isError: false },
          { id: "tc3", name: "Write", input: { file_path: "src/routes/auth.ts", content: "..." }, result: "File written successfully", isError: false },
        ]),
        usage: JSON.stringify({ inputTokens: 2450, outputTokens: 890 }),
        timestamp: iso(-3_400_000),
      },
      { id: "m3", session_id: "s1", role: "user", content: "Add refresh token rotation too", thinking: null, tool_calls: null, usage: null, timestamp: iso(-600_000) },
      {
        id: "m4", session_id: "s1", role: "assistant",
        content: "I've added refresh token rotation to the auth system. Each time a refresh token is used, a new one is issued and the old one is invalidated.\n\nChanges made:\n- Created `src/models/RefreshToken.ts` for token storage\n- Updated `src/routes/auth.ts` with `/refresh` endpoint\n- Added token family tracking to detect reuse attacks",
        thinking: null,
        tool_calls: JSON.stringify([
          { id: "tc4", name: "Write", input: { file_path: "src/models/RefreshToken.ts", content: "..." }, result: "File written successfully", isError: false },
          { id: "tc5", name: "Edit", input: { file_path: "src/routes/auth.ts", old_string: "...", new_string: "..." }, result: "File edited successfully", isError: false },
          { id: "tc6", name: "Bash", input: { command: "npm test -- --run src/routes/auth.test.ts" }, result: "Tests: 6 passed, 6 total\nTime: 1.24s", isError: false },
        ]),
        usage: JSON.stringify({ inputTokens: 3200, outputTokens: 1150 }),
        timestamp: iso(-300_000),
      },
    ];

    const GIT_CHANGES = [
      { path: "src/middleware/auth.ts", status: "new" },
      { path: "src/routes/auth.ts", status: "new" },
      { path: "src/models/RefreshToken.ts", status: "new" },
      { path: "src/routes/auth.test.ts", status: "new" },
      { path: "package.json", status: "modified" },
      { path: "package-lock.json", status: "modified" },
    ];

    const FILE_TREE = [
      { name: "src", path: "src", is_dir: true, git_status: null, children: [
        { name: "middleware", path: "src/middleware", is_dir: true, git_status: null, children: [
          { name: "auth.ts", path: "src/middleware/auth.ts", is_dir: false, git_status: "added", children: [] },
        ]},
        { name: "routes", path: "src/routes", is_dir: true, git_status: null, children: [
          { name: "auth.ts", path: "src/routes/auth.ts", is_dir: false, git_status: "added", children: [] },
          { name: "auth.test.ts", path: "src/routes/auth.test.ts", is_dir: false, git_status: "added", children: [] },
          { name: "users.ts", path: "src/routes/users.ts", is_dir: false, git_status: null, children: [] },
        ]},
        { name: "models", path: "src/models", is_dir: true, git_status: null, children: [
          { name: "RefreshToken.ts", path: "src/models/RefreshToken.ts", is_dir: false, git_status: "added", children: [] },
          { name: "User.ts", path: "src/models/User.ts", is_dir: false, git_status: null, children: [] },
        ]},
        { name: "index.ts", path: "src/index.ts", is_dir: false, git_status: null, children: [] },
      ]},
      { name: "package.json", path: "package.json", is_dir: false, git_status: "modified", children: [] },
      { name: "tsconfig.json", path: "tsconfig.json", is_dir: false, git_status: null, children: [] },
    ];

    const GIT_STATUS = {
      branch: "feature/auth",
      ahead: 3,
      behind: 0,
      is_repo: true,
      changed_files: [
        { path: "src/middleware/auth.ts", status: "added" },
        { path: "src/routes/auth.ts", status: "added" },
        { path: "src/models/RefreshToken.ts", status: "added" },
        { path: "src/routes/auth.test.ts", status: "added" },
        { path: "package.json", status: "modified" },
        { path: "package-lock.json", status: "modified" },
      ],
    };

    // Intercept Tauri IPC
    (window as any).__TAURI_INTERNALS__ = {
      invoke: (cmd: string, args?: any) => {
        // SQL plugin — load returns the db path string
        if (cmd === "plugin:sql|load") return Promise.resolve(args?.db ?? "sqlite:central.db");

        // SQL plugin — select returns row arrays
        if (cmd === "plugin:sql|select") {
          const query: string = args?.query ?? "";
          if (query.includes("projects")) return Promise.resolve(PROJECTS);
          if (query.includes("agent_sessions") && query.includes("ORDER")) return Promise.resolve(SESSIONS);
          if (query.includes("agent_sessions") && args?.values?.[0]) {
            return Promise.resolve(SESSIONS.filter((s: any) => s.id === args.values[0]));
          }
          if (query.includes("messages")) {
            const sid = args?.values?.[0];
            if (sid === "s1") return Promise.resolve(MESSAGES_S1);
            return Promise.resolve([]);
          }
          if (query.includes("app_settings")) return Promise.resolve([]);
          return Promise.resolve([]);
        }

        // SQL plugin — execute returns [rowsAffected, lastInsertId] tuple
        if (cmd === "plugin:sql|execute") return Promise.resolve([0, undefined]);

        // Event plugin — listen returns an event ID for unlisten
        if (cmd === "plugin:event|listen") return Promise.resolve(0);
        if (cmd === "plugin:event|unlisten") return Promise.resolve();

        // App settings KV
        if (cmd === "get_setting") {
          if (args?.key === "active_session_id") return Promise.resolve("s1");
          if (args?.key === "selected_project_id") return Promise.resolve("p1");
          return Promise.resolve(null);
        }
        if (cmd === "set_setting") return Promise.resolve();

        // Tauri commands
        if (cmd === "get_file_tree") return Promise.resolve(FILE_TREE);
        if (cmd === "get_git_status") return Promise.resolve(GIT_STATUS);
        if (cmd === "get_git_changes") return Promise.resolve(GIT_CHANGES);
        if (cmd === "read_file_content") return Promise.resolve("// mock file content\nexport function authenticate() {\n  // ...\n}");
        if (cmd === "debug_log") return Promise.resolve();
        if (cmd === "mark_interrupted_sessions") return Promise.resolve();
        if (cmd === "send_native_notification") return Promise.resolve();

        // Terminal PTY commands (no-op for screenshot)
        if (cmd === "start_terminal") return Promise.resolve();
        if (cmd === "resize_terminal") return Promise.resolve();
        if (cmd === "write_terminal_input") return Promise.resolve();
        if (cmd === "close_terminal") return Promise.resolve();

        return Promise.resolve(null);
      },
      transformCallback: (cb: any) => {
        const id = Math.random();
        (window as any)[`_${id}`] = cb;
        return id;
      },
      convertFileSrc: (src: string) => src,
      metadata: {
        currentWindow: { label: "main" },
        currentWebview: { label: "main" },
        windows: [{ label: "main" }],
        webviews: [{ label: "main" }],
      },
    };
  });

  try {
    await page.goto("http://localhost:1420", { timeout: 8000, waitUntil: "networkidle" });
  } catch {
    console.error("Dev server not running. Start with: pnpm dev");
    await browser.close();
    process.exit(1);
  }

  // Wait for React to render with mock data
  await page.waitForTimeout(3000);

  await page.screenshot({
    path: "docs/screenshot.png",
    type: "png",
  });

  console.log("Screenshot saved to docs/screenshot.png");
  await browser.close();
}

main().catch(console.error);
