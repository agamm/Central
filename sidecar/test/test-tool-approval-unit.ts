/**
 * Unit tests for tool-approval.ts — no SDK, no tokens.
 *
 * Validates the PermissionResult shape matches what the SDK's Zod schema
 * expects. The critical invariant: "allow" results MUST include `updatedInput`
 * with the original tool input, otherwise the SDK rejects with a ZodError.
 *
 * Run: cd sidecar && node --import tsx test/test-tool-approval-unit.ts
 */

import { requestToolApproval, resolveApproval } from "../src/tool-approval.js";
import type { SidecarEvent, PermissionUpdateInfo } from "../src/types.js";

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

function makeSignal(): AbortSignal {
  return new AbortController().signal;
}

// --- Tests ---

async function testAllowIncludesUpdatedInput(): Promise<void> {
  console.log("\n=== allow result includes updatedInput ===");

  const emitted: SidecarEvent[] = [];
  const emit = (e: SidecarEvent) => { emitted.push(e); };
  const input = { url: "https://example.com", prompt: "get title" };

  const promise = requestToolApproval("s1", "WebFetch", input, makeSignal(), emit);

  assert(emitted.length === 1, "emitted tool_approval_request");
  assert(emitted[0].type === "tool_approval_request", "event type is tool_approval_request");

  const requestId = emitted[0].type === "tool_approval_request" ? emitted[0].requestId : "";
  resolveApproval(requestId, true);

  const result = await promise;
  assert(result.behavior === "allow", "behavior is allow");
  assert("updatedInput" in result, "result has updatedInput field");
  if (result.behavior === "allow") {
    assert(result.updatedInput === input, "updatedInput is the original input reference");
    assert(result.updatedInput.url === "https://example.com", "updatedInput preserves url");
    assert(result.updatedInput.prompt === "get title", "updatedInput preserves prompt");
    assert(result.updatedPermissions === undefined, "no updatedPermissions when none provided");
  }
}

async function testDenyResult(): Promise<void> {
  console.log("\n=== deny result has required message ===");

  const emitted: SidecarEvent[] = [];
  const emit = (e: SidecarEvent) => { emitted.push(e); };

  const promise = requestToolApproval("s1", "Bash", { command: "rm -rf /" }, makeSignal(), emit);

  const requestId = emitted[0].type === "tool_approval_request" ? emitted[0].requestId : "";
  resolveApproval(requestId, false);

  const result = await promise;
  assert(result.behavior === "deny", "behavior is deny");
  if (result.behavior === "deny") {
    assert(typeof result.message === "string", "deny has message string");
    assert(result.message.length > 0, "deny message is non-empty");
  }
}

async function testAllowWithUpdatedPermissions(): Promise<void> {
  console.log("\n=== allow with updatedPermissions ===");

  const emitted: SidecarEvent[] = [];
  const emit = (e: SidecarEvent) => { emitted.push(e); };
  const input = { file_path: "/tmp/test.txt", content: "hello" };

  const promise = requestToolApproval("s1", "Write", input, makeSignal(), emit);

  const requestId = emitted[0].type === "tool_approval_request" ? emitted[0].requestId : "";
  const permissions: PermissionUpdateInfo[] = [{
    type: "addRules",
    destination: "localSettings",
    rules: [{ toolName: "Write", ruleContent: "/tmp/**" }],
    behavior: "allow",
  }];
  resolveApproval(requestId, true, permissions);

  const result = await promise;
  assert(result.behavior === "allow", "behavior is allow");
  if (result.behavior === "allow") {
    assert(result.updatedInput === input, "updatedInput is present");
    assert(Array.isArray(result.updatedPermissions), "updatedPermissions is array");
    assert(result.updatedPermissions!.length === 1, "has 1 permission update");
  }
}

async function testSuggestionsForwarded(): Promise<void> {
  console.log("\n=== suggestions forwarded in event ===");

  const emitted: SidecarEvent[] = [];
  const emit = (e: SidecarEvent) => { emitted.push(e); };

  const suggestions = [{
    type: "addRules" as const,
    destination: "localSettings" as const,
    rules: [{ toolName: "WebFetch", ruleContent: "domain:example.com" }],
    behavior: "allow" as const,
  }];

  const promise = requestToolApproval(
    "s1", "WebFetch", { url: "https://example.com" }, makeSignal(), emit,
    suggestions as never,
  );

  const event = emitted[0];
  assert(event.type === "tool_approval_request", "emitted event");
  if (event.type === "tool_approval_request") {
    assert(Array.isArray(event.suggestions), "suggestions is array");
    assert(event.suggestions!.length === 1, "has 1 suggestion");
    assert(event.suggestions![0].type === "addRules", "suggestion type preserved");
    assert(event.suggestions![0].destination === "localSettings", "suggestion destination preserved");
  }

  // Clean up the pending promise
  const requestId = event.type === "tool_approval_request" ? event.requestId : "";
  resolveApproval(requestId, true);
  await promise;
}

async function testResolveUnknownRequestIsNoop(): Promise<void> {
  console.log("\n=== resolveApproval with unknown ID is noop ===");

  // Should not throw
  resolveApproval("nonexistent_id", true);
  assert(true, "no error on unknown requestId");
}

async function testAbortRejectsPending(): Promise<void> {
  console.log("\n=== abort rejects pending approval ===");

  const emitted: SidecarEvent[] = [];
  const emit = (e: SidecarEvent) => { emitted.push(e); };
  const ac = new AbortController();

  const promise = requestToolApproval("s1", "Bash", { command: "ls" }, ac.signal, emit);

  ac.abort();

  try {
    await promise;
    assert(false, "should have rejected");
  } catch (e) {
    assert(e instanceof Error && e.message === "aborted", "rejected with abort error");
  }
}

// --- Run ---

async function main(): Promise<void> {
  console.log("Tool Approval Unit Tests");

  await testAllowIncludesUpdatedInput();
  await testDenyResult();
  await testAllowWithUpdatedPermissions();
  await testSuggestionsForwarded();
  await testResolveUnknownRequestIsNoop();
  await testAbortRejectsPending();

  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("Test crashed:", e);
  process.exit(1);
});
