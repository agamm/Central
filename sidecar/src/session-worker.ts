/**
 * Per-session sidecar worker. One Node.js process per agent session.
 *
 * Protocol (stdin → JSON-lines):
 *   start_session  — must be the first command, starts query()
 *   send_message   — queued and yielded to query() as a follow-up
 *   abort_session  — aborts the running query
 *   end_session    — closes the follow-up queue for clean exit
 *   tool_approval_response — resolves a pending canUseTool prompt
 *
 * Protocol (stdout ← JSON-lines):
 *   session_started, message, tool_use, tool_result,
 *   tool_approval_request, tool_progress,
 *   session_completed, session_failed
 *
 * Lifecycle:
 *   Rust spawns this process → sends start_session → worker runs query()
 *   → events written to stdout → SDK blocks between turns waiting for
 *   follow-ups → send_message unblocks it → process exits when
 *   end_session closes the queue or abort_session fires.
 */

import * as readline from "node:readline";
import {
  query,
  type SDKMessage,
  type SDKUserMessage,
  type PermissionResult,
  type PermissionUpdate,
} from "@anthropic-ai/claude-agent-sdk";
import type {
  SidecarEvent,
  ToolCallInfo,
  WorkerCommand,
  PermissionUpdateInfo,
} from "./types.js";

// --- Logging (stderr, captured by Rust) ---

function log(msg: string): void {
  process.stderr.write(`[SESSION-WORKER] ${msg}\n`);
}

// --- Stdout: atomic JSON-line writes ---

function emit(event: SidecarEvent): void {
  process.stdout.write(JSON.stringify(event) + "\n");
}

// --- Async queue for follow-up messages ---

function createAsyncQueue<T>(): {
  push: (item: T) => void;
  close: () => void;
  iterator: () => AsyncIterableIterator<T>;
} {
  const buffer: T[] = [];
  const waiters: Array<(result: IteratorResult<T>) => void> = [];
  let closed = false;

  return {
    push(item: T): void {
      if (closed) return;
      const waiter = waiters.shift();
      if (waiter) {
        waiter({ value: item, done: false });
      } else {
        buffer.push(item);
      }
    },
    close(): void {
      closed = true;
      for (const waiter of waiters) {
        waiter({ value: undefined as unknown as T, done: true });
      }
      waiters.length = 0;
    },
    iterator(): AsyncIterableIterator<T> {
      const iter: AsyncIterableIterator<T> = {
        next(): Promise<IteratorResult<T>> {
          if (buffer.length > 0) {
            return Promise.resolve({ value: buffer.shift()!, done: false });
          }
          if (closed) {
            return Promise.resolve({ value: undefined as unknown as T, done: true });
          }
          return new Promise((resolve) => waiters.push(resolve));
        },
        [Symbol.asyncIterator]() { return iter; },
      };
      return iter;
    },
  };
}

// --- Tool approval routing ---

const pendingApprovals = new Map<string, (result: PermissionResult) => void>();
let approvalCounter = 0;

/** Convert SDK PermissionUpdate[] to our serializable format */
function serializeSuggestions(
  suggestions: PermissionUpdate[] | undefined,
): PermissionUpdateInfo[] | undefined {
  if (!suggestions || suggestions.length === 0) return undefined;
  return suggestions.map((s) => {
    const info: PermissionUpdateInfo = {
      type: s.type,
      destination: s.destination,
    };
    if ("rules" in s) info.rules = s.rules;
    if ("behavior" in s) info.behavior = s.behavior;
    if ("mode" in s) info.mode = s.mode;
    if ("directories" in s) info.directories = s.directories;
    return info;
  });
}

/** Convert our PermissionUpdateInfo[] back to SDK PermissionUpdate[] */
function deserializePermissions(
  infos: PermissionUpdateInfo[] | undefined,
): PermissionUpdate[] | undefined {
  if (!infos || infos.length === 0) return undefined;
  // The shapes are compatible — cast through unknown
  return infos as unknown as PermissionUpdate[];
}

function requestToolApproval(
  sessionId: string,
  toolName: string,
  input: Record<string, unknown>,
  signal: AbortSignal,
  suggestions?: PermissionUpdate[],
): Promise<PermissionResult> {
  const requestId = `apr_${++approvalCounter}`;

  emit({
    type: "tool_approval_request",
    sessionId,
    requestId,
    toolName,
    input,
    suggestions: serializeSuggestions(suggestions),
  });

  return new Promise<PermissionResult>((resolve, reject) => {
    const onAbort = () => {
      pendingApprovals.delete(requestId);
      reject(new Error("aborted"));
    };
    signal.addEventListener("abort", onAbort, { once: true });

    pendingApprovals.set(requestId, (result) => {
      signal.removeEventListener("abort", onAbort);
      resolve(result);
    });
  });
}

// --- Build SDKUserMessage from a string ---

function makeUserMessage(sessionId: string, content: string): SDKUserMessage {
  return {
    type: "user",
    session_id: sessionId,
    parent_tool_use_id: null,
    message: { role: "user", content },
  };
}

// --- Map SDK messages to SidecarEvents ---

/** Captured from the SDK init message for resume/persistence */
let sdkSessionId = "";

function processSDKMessage(sessionId: string, msg: SDKMessage): void {
  // System init — session started
  if (msg.type === "system" && "subtype" in msg && msg.subtype === "init") {
    sdkSessionId = msg.session_id;
    emit({ type: "session_started", sessionId, sdkSessionId });
    log(`Session init: model=${msg.model}, tools=${msg.tools.length}, sdk_sid=${sdkSessionId}`);
    return;
  }

  // Assistant message — text, thinking, tool calls
  if (msg.type === "assistant") {
    let textContent = "";
    let thinking: string | undefined;
    const toolCalls: ToolCallInfo[] = [];

    for (const block of msg.message.content) {
      if (block.type === "text") {
        textContent += block.text;
      } else if (block.type === "thinking" && "thinking" in block) {
        thinking = block.thinking as string;
      } else if (block.type === "tool_use") {
        toolCalls.push({ name: block.name, input: block.input as Record<string, unknown> });
        emit({
          type: "tool_use",
          sessionId,
          toolName: block.name,
          input: block.input as Record<string, unknown>,
        });
      }
    }

    if (textContent || thinking) {
      emit({
        type: "message",
        sessionId,
        role: "assistant",
        content: textContent,
        thinking,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        usage: msg.message.usage
          ? {
              inputTokens: msg.message.usage.input_tokens,
              outputTokens: msg.message.usage.output_tokens,
            }
          : undefined,
      });
    }
    return;
  }

  // Tool progress — elapsed time for running tools
  if (msg.type === "tool_progress") {
    emit({
      type: "tool_progress",
      sessionId,
      toolName: msg.tool_name,
      elapsedSeconds: msg.elapsed_time_seconds,
    });
    return;
  }

  // Result — turn completed or failed
  if (msg.type === "result") {
    if (msg.subtype === "success") {
      emit({
        type: "session_completed",
        sessionId,
        sdkSessionId,
        totalCostUsd: msg.total_cost_usd,
        durationMs: msg.duration_ms,
      });
      log(`Session completed: ${msg.duration_ms}ms, cost=$${msg.total_cost_usd}, turns=${msg.num_turns}`);
    } else {
      const reason = msg.subtype === "error_max_budget_usd"
        ? `Budget exceeded ($${msg.total_cost_usd})`
        : `${msg.subtype}: ${msg.num_turns} turns, ${msg.duration_ms}ms`;
      emit({ type: "session_failed", sessionId, error: reason });
      log(`Session failed: ${reason}`);
    }
    return;
  }

  // Status messages (compacting, etc.) — log only
  if (msg.type === "system" && "subtype" in msg && msg.subtype !== "init") {
    log(`System event: ${(msg as Record<string, unknown>).subtype}`);
    return;
  }

  // stream_event, user messages, compact_boundary, etc. — skip
}

// --- Main ---

async function main(): Promise<void> {
  const rl = readline.createInterface({ input: process.stdin, terminal: false });
  const abortController = new AbortController();
  const followUpQueue = createAsyncQueue<string>();

  let sessionId = "";
  let started = false;

  rl.on("line", (line: string) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    log(`stdin: ${trimmed.slice(0, 200)}`);

    try {
      const cmd = JSON.parse(trimmed) as WorkerCommand;

      if (cmd.type === "start_session" && !started) {
        started = true;
        sessionId = cmd.sessionId;
        const projectPath = cmd.projectPath;
        const prompt = cmd.prompt;
        const model = cmd.model;
        const maxBudgetUsd = cmd.maxBudgetUsd;
        const resumeSessionId = cmd.resumeSessionId;

        runSession(sessionId, projectPath, prompt, model, maxBudgetUsd, resumeSessionId, followUpQueue, abortController)
          .catch((e: unknown) => {
            const errMsg = e instanceof Error ? e.message : String(e);
            if (!errMsg.includes("abort")) {
              log(`Session error: ${errMsg}`);
              emit({ type: "session_failed", sessionId, error: errMsg });
            }
          })
          .finally(() => {
            log("Session ended, exiting process");
            setTimeout(() => process.exit(0), 100);
          });
      } else if (cmd.type === "send_message") {
        followUpQueue.push(cmd.message);
      } else if (cmd.type === "end_session") {
        log("End session requested — closing follow-up queue");
        followUpQueue.close();
      } else if (cmd.type === "abort_session") {
        log("Abort requested");
        abortController.abort();
        followUpQueue.close();
      } else if (cmd.type === "tool_approval_response") {
        const resolver = pendingApprovals.get(cmd.requestId);
        if (resolver) {
          pendingApprovals.delete(cmd.requestId);
          if (cmd.allowed) {
            resolver({
              behavior: "allow",
              updatedInput: {},
              updatedPermissions: deserializePermissions(cmd.updatedPermissions),
            });
          } else {
            resolver({ behavior: "deny", message: "User denied" });
          }
        }
      }
    } catch (e) {
      log(`Parse error: ${String(e)}`);
    }
  });

  rl.on("close", () => {
    log("stdin closed, aborting");
    abortController.abort();
    followUpQueue.close();
  });
}

async function runSession(
  sessionId: string,
  projectPath: string,
  prompt: string,
  model: string | undefined,
  maxBudgetUsd: number | undefined,
  resumeSessionId: string | undefined,
  followUps: ReturnType<typeof createAsyncQueue<string>>,
  abortController: AbortController,
): Promise<void> {
  log(`Starting SDK query: sid=${sessionId}, cwd=${projectPath}, model=${model ?? "default"}, resume=${resumeSessionId ?? "none"}`);

  // Build async iterable: initial prompt + follow-ups from queue
  async function* promptGenerator(): AsyncGenerator<SDKUserMessage> {
    yield makeUserMessage(sessionId, prompt);

    const iter = followUps.iterator();
    while (true) {
      const { value, done } = await iter.next();
      if (done) break;
      yield makeUserMessage(sessionId, value);
    }
  }

  const q = query({
    prompt: promptGenerator(),
    options: {
      abortController,
      cwd: projectPath,
      model,
      maxTurns: 50,
      maxBudgetUsd,

      // Resume a prior SDK session if available (preserves conversation context)
      ...(resumeSessionId ? { resume: resumeSessionId } : {}),

      // Load project CLAUDE.md and .claude/settings.json
      settingSources: ["project"],

      // Use Claude Code's full system prompt
      systemPrompt: { type: "preset", preset: "claude_code" },

      // Adaptive thinking — model decides when to use extended thinking
      thinking: { type: "adaptive" },

      // Permission routing — forward to UI via events
      permissionMode: "default",
      canUseTool: (toolName, input, { signal, suggestions }) =>
        requestToolApproval(sessionId, toolName, input, signal, suggestions),

      // Stderr goes to our log (captured by Rust)
      stderr: (data: string) => log(`SDK: ${data.trimEnd()}`),
    },
  });

  try {
    for await (const msg of q) {
      if (abortController.signal.aborted) break;
      processSDKMessage(sessionId, msg);
    }
  } catch (e: unknown) {
    if (e instanceof Error && e.name === "AbortError") {
      emit({ type: "session_failed", sessionId, error: "Aborted by user" });
    } else {
      throw e;
    }
  } finally {
    followUps.close();
  }
}

main().catch((e) => {
  log(`Fatal: ${String(e)}`);
  process.exit(1);
});
