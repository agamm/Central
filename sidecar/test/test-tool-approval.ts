/**
 * Integration test: exercises the tool approval flow end-to-end.
 *
 * Spawns the session-worker directly (like Rust does), sends a prompt
 * that triggers file write (which needs approval), handles the
 * tool_approval_request event, responds with approval, and verifies
 * the session completes.
 *
 * This validates:
 *  - The worker emits tool_approval_request with correct format
 *  - The tool_approval_response command is parsed correctly
 *  - The session completes after approval (not stuck)
 *  - Event types match frontend expectations (SidecarEvent from types.ts)
 *  - Usage data format (inputTokens/outputTokens)
 *
 * Run: cd sidecar && node --import tsx test/test-tool-approval.ts
 *
 * WARNING: This uses real Claude API tokens.
 */

import { spawn, type ChildProcess } from "node:child_process";
import * as readline from "node:readline";
import * as path from "node:path";
import type { SidecarEvent, WorkerCommand } from "../src/types.js";

// --- Test harness ---

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string): void {
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.log(`  ✗ FAIL: ${message}`);
  }
}

// --- Worker wrapper ---

function spawnWorker() {
  const sidecarDir = path.resolve(import.meta.dirname ?? __dirname, "..");
  const workerPath = path.join(sidecarDir, "src", "session-worker.ts");

  const env = { ...process.env };
  delete env.CLAUDECODE; // avoid nested session detection

  const child: ChildProcess = spawn("node", ["--import", "tsx", workerPath], {
    cwd: sidecarDir,
    env,
    stdio: ["pipe", "pipe", "pipe"],
  });

  const events: SidecarEvent[] = [];
  const listeners: Array<(e: SidecarEvent) => void> = [];

  // Read stdout JSON-lines
  const rl = readline.createInterface({ input: child.stdout!, terminal: false });
  rl.on("line", (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    try {
      const event = JSON.parse(trimmed) as SidecarEvent;
      events.push(event);
      console.log(`  [event] ${event.type} ${JSON.stringify(event).slice(0, 150)}`);
      // Notify all listeners
      for (const fn of listeners) fn(event);
    } catch { /* non-JSON, skip */ }
  });

  // Log stderr
  const stderrRl = readline.createInterface({ input: child.stderr!, terminal: false });
  stderrRl.on("line", (line) => {
    const trimmed = line.trim();
    if (trimmed) console.log(`  [stderr] ${trimmed.slice(0, 200)}`);
  });

  return {
    events,

    send(cmd: WorkerCommand): void {
      const json = JSON.stringify(cmd);
      console.log(`  [send] ${json.slice(0, 200)}`);
      child.stdin!.write(json + "\n");
    },

    /** Wait for a specific event type, with timeout */
    waitFor(
      predicate: (e: SidecarEvent) => boolean,
      timeoutMs = 60_000,
    ): Promise<SidecarEvent> {
      const existing = events.find(predicate);
      if (existing) return Promise.resolve(existing);

      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          cleanup();
          reject(new Error(`Timed out (${timeoutMs}ms)`));
        }, timeoutMs);

        const handler = (e: SidecarEvent) => {
          if (predicate(e)) {
            cleanup();
            resolve(e);
          }
        };
        listeners.push(handler);

        function cleanup() {
          clearTimeout(timer);
          const idx = listeners.indexOf(handler);
          if (idx >= 0) listeners.splice(idx, 1);
        }
      });
    },

    /** Register a persistent listener (returns unsubscribe fn) */
    onEvent(fn: (e: SidecarEvent) => void): () => void {
      listeners.push(fn);
      return () => {
        const idx = listeners.indexOf(fn);
        if (idx >= 0) listeners.splice(idx, 1);
      };
    },

    kill(): void {
      child.kill("SIGTERM");
    },
  };
}

// --- Test: Tool Approval Flow ---

async function testToolApprovalFlow(): Promise<void> {
  console.log("\n=== Tool Approval Flow Test ===");

  const worker = spawnWorker();
  const sessionId = `test-approval-${Date.now()}`;
  const testFile = `/tmp/central-test-approval-${Date.now()}.txt`;

  // Set up auto-approver: approve every tool_approval_request automatically
  const approvedSet = new Set<string>();
  const unsubAutoApprove = worker.onEvent((e) => {
    if (e.type === "tool_approval_request" && !approvedSet.has(e.requestId)) {
      approvedSet.add(e.requestId);
      console.log(`  [auto-approve] ${e.toolName} req=${e.requestId}`);
      worker.send({
        type: "tool_approval_response",
        requestId: e.requestId,
        allowed: true,
      });
    }
  });

  try {
    // Step 1: Start session
    console.log("\n  Step 1: Starting session...");
    worker.send({
      type: "start_session",
      sessionId,
      projectPath: process.cwd(),
      prompt: `Write the text "hello approval test" to the file ${testFile}. Just write the file, nothing else.`,
      model: "claude-sonnet-4-20250514",
    });

    // Step 2: Wait for session_started
    console.log("\n  Step 2: Waiting for session_started...");
    const started = await worker.waitFor((e) => e.type === "session_started", 30_000);
    assert(started.type === "session_started", "Received session_started");
    if (started.type === "session_started") {
      assert(started.sessionId === sessionId, `sessionId matches`);
      assert(started.sdkSessionId.length > 0, `Has sdkSessionId`);
    }

    // Step 3: Wait for at least one tool_approval_request
    console.log("\n  Step 3: Waiting for tool_approval_request...");
    const approval = await worker.waitFor(
      (e) => e.type === "tool_approval_request",
      60_000,
    );
    assert(approval.type === "tool_approval_request", "Received tool_approval_request");

    if (approval.type === "tool_approval_request") {
      // Validate format matches frontend ToolApprovalRequest type
      assert(typeof approval.sessionId === "string", `Has sessionId`);
      assert(typeof approval.requestId === "string", `Has requestId`);
      assert(typeof approval.toolName === "string", `Has toolName (${approval.toolName})`);
      assert(typeof approval.input === "object" && approval.input !== null, `Has input object`);
      assert(approval.sessionId === sessionId, `sessionId matches request`);

      console.log(`  Tool: ${approval.toolName}`);
      console.log(`  Input: ${JSON.stringify(approval.input).slice(0, 200)}`);
      if (approval.suggestions) {
        console.log(`  Suggestions: ${JSON.stringify(approval.suggestions).slice(0, 200)}`);
        assert(Array.isArray(approval.suggestions), "suggestions is array");
      }
    }

    // Step 4: Wait for session completion (auto-approver handles all requests)
    console.log("\n  Step 4: Waiting for session to complete...");
    const final = await worker.waitFor(
      (e) => e.type === "session_completed" || e.type === "session_failed",
      120_000,
    );

    if (final.type === "session_completed") {
      assert(true, `Session completed: cost=$${final.totalCostUsd ?? "?"}, duration=${final.durationMs ?? "?"}ms`);
    } else if (final.type === "session_failed") {
      // Not necessarily a test failure — might just be the SDK being flaky
      console.log(`  Session failed: ${final.error}`);
      assert(false, `Session completed without error`);
    }

    // Step 5: Validate collected events
    console.log("\n  Step 5: Validating event shapes...");

    const messages = worker.events.filter((e) => e.type === "message");
    assert(messages.length >= 1, `Got ${messages.length} message event(s)`);

    // Check message with usage data
    const msgWithUsage = messages.find(
      (m) => m.type === "message" && m.usage != null,
    );
    if (msgWithUsage && msgWithUsage.type === "message" && msgWithUsage.usage) {
      const usage = msgWithUsage.usage as { inputTokens?: number; outputTokens?: number };
      assert(typeof usage.inputTokens === "number", `Usage.inputTokens is number (${usage.inputTokens})`);
      assert(typeof usage.outputTokens === "number", `Usage.outputTokens is number (${usage.outputTokens})`);
    } else {
      console.log("  (no message with usage data found)");
    }

    const toolUses = worker.events.filter((e) => e.type === "tool_use");
    assert(toolUses.length >= 1, `Got ${toolUses.length} tool_use event(s)`);

    const approvals = worker.events.filter((e) => e.type === "tool_approval_request");
    assert(approvals.length >= 1, `Got ${approvals.length} tool_approval_request(s)`);
    console.log(`  Auto-approved ${approvedSet.size} request(s)`);

    const progress = worker.events.filter((e) => e.type === "tool_progress");
    console.log(`  Got ${progress.length} tool_progress event(s)`);

    // Summary
    const types = [...new Set(worker.events.map((e) => e.type))];
    console.log(`\n  Total: ${worker.events.length} events — types: ${types.join(", ")}`);

  } finally {
    unsubAutoApprove();
    worker.kill();
    // Clean up test file
    try {
      const { unlink } = await import("node:fs/promises");
      await unlink(testFile).catch(() => {});
    } catch {}
  }
}

// --- Main ---

async function main(): Promise<void> {
  console.log("Tool Approval Integration Test");
  console.log("(This test uses real Claude API tokens)\n");
  const start = Date.now();

  await testToolApprovalFlow();

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`\nResults: ${passed} passed, ${failed} failed (${elapsed}s)`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("Test crashed:", e);
  process.exit(1);
});
