/**
 * Smoke test: calls Claude Agent SDK directly to verify it works.
 *
 * Run: cd sidecar && node --import tsx test/test-real-sdk.ts
 */

import { query, type SDKMessage } from "@anthropic-ai/claude-agent-sdk";

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

async function testDirectSDK(): Promise<void> {
  console.log("\n=== Direct SDK query() — 'what is the cwd?' ===");

  const origClaudeCode = process.env.CLAUDECODE;
  delete process.env.CLAUDECODE;

  const messages: SDKMessage[] = [];
  const abortController = new AbortController();

  try {
    const q = query({
      prompt: "What is the cwd? Just tell me the path, nothing else.",
      options: {
        abortController,
        cwd: process.cwd(),
        model: "claude-sonnet-4-20250514",
        maxTurns: 3,
        permissionMode: "default",
        systemPrompt: { type: "preset", preset: "claude_code" },
        thinking: { type: "adaptive" },
        stderr: (data: string) => {
          const trimmed = data.trim();
          if (trimmed) console.log(`  [stderr] ${trimmed}`);
        },
      },
    });

    for await (const msg of q) {
      messages.push(msg);

      if (msg.type === "system" && "subtype" in msg && msg.subtype === "init") {
        console.log(`  [init] model=${msg.model}, tools=${msg.tools.length}, session=${msg.session_id}`);
      }

      if (msg.type === "assistant") {
        for (const block of msg.message.content) {
          if (block.type === "text") {
            console.log(`  [assistant] ${block.text}`);
          }
        }
      }

      if (msg.type === "result") {
        console.log(`  [result] ${msg.subtype}, cost=$${msg.total_cost_usd}, duration=${msg.duration_ms}ms`);
      }
    }

    const initMsg = messages.find((m) => m.type === "system" && "subtype" in m && m.subtype === "init");
    assert(initMsg !== undefined, "Received init message");

    const assistantMsgs = messages.filter((m) => m.type === "assistant");
    assert(assistantMsgs.length >= 1, `Got ${assistantMsgs.length} assistant message(s)`);

    const resultMsg = messages.find((m) => m.type === "result");
    assert(resultMsg !== undefined, "Received result message");
    assert(resultMsg!.type === "result" && resultMsg!.subtype === "success", "Result is success");

    const allText = assistantMsgs
      .flatMap((m) => m.type === "assistant" ? m.message.content : [])
      .filter((b): b is { type: "text"; text: string } => b.type === "text")
      .map((b) => b.text)
      .join(" ");
    const hasCwd = allText.includes(process.cwd()) || allText.includes("sidecar");
    assert(hasCwd, `Response mentions cwd (got: ${allText.slice(0, 150)})`);
  } finally {
    if (origClaudeCode !== undefined) {
      process.env.CLAUDECODE = origClaudeCode;
    }
  }
}

async function main(): Promise<void> {
  console.log("SDK Smoke Test");
  const start = Date.now();

  await testDirectSDK();

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`\nResults: ${passed} passed, ${failed} failed (${elapsed}s)`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("Test crashed:", e);
  process.exit(1);
});
