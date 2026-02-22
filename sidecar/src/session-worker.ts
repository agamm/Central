/**
 * Per-session sidecar worker. One Node.js process per agent session.
 *
 * Protocol (stdin JSON-lines): start_session, send_message, abort_session,
 * end_session, tool_approval_response
 *
 * Protocol (stdout JSON-lines): session_started, message, tool_use, tool_result,
 * tool_approval_request, tool_progress, session_completed, session_failed
 */

import * as readline from "node:readline";
import { query, type SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";
import type { SidecarEvent, WorkerCommand } from "./types.js";
import { createAsyncQueue } from "./async-queue.js";
import { requestToolApproval, resolveApproval } from "./tool-approval.js";
import { processSDKMessage } from "./sdk-message-handler.js";

function log(msg: string): void {
  process.stderr.write(`[SESSION-WORKER] ${msg}\n`);
}

function emit(event: SidecarEvent): void {
  process.stdout.write(JSON.stringify(event) + "\n");
}

function makeUserMessage(sessionId: string, content: string): SDKUserMessage {
  return {
    type: "user",
    session_id: sessionId,
    parent_tool_use_id: null,
    message: { role: "user", content },
  };
}

function buildQueryOptions(
  sessionId: string,
  projectPath: string,
  model: string | undefined,
  maxBudgetUsd: number | undefined,
  resumeSessionId: string | undefined,
  abortController: AbortController,
) {
  return {
    abortController,
    cwd: projectPath,
    model,
    maxTurns: 50,
    maxBudgetUsd,
    ...(resumeSessionId ? { resume: resumeSessionId } : {}),
    settingSources: ["project"] as const,
    systemPrompt: { type: "preset" as const, preset: "claude_code" as const },
    thinking: { type: "adaptive" as const },
    includePartialMessages: true,
    permissionMode: "default" as const,
    canUseTool: (toolName: string, input: Record<string, unknown>, { signal, suggestions }: { signal: AbortSignal; suggestions?: unknown[] }) =>
      requestToolApproval(sessionId, toolName, input, signal, emit, suggestions as never),
    stderr: (data: string) => log(`SDK: ${data.trimEnd()}`),
  };
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

  async function* promptGenerator(): AsyncGenerator<SDKUserMessage> {
    yield makeUserMessage(sessionId, prompt);
    const iter = followUps.iterator();
    while (true) {
      const { value, done } = await iter.next();
      if (done) break;
      yield makeUserMessage(sessionId, value);
    }
  }

  const options = buildQueryOptions(sessionId, projectPath, model, maxBudgetUsd, resumeSessionId, abortController);
  const q = query({ prompt: promptGenerator(), options });

  try {
    for await (const msg of q) {
      if (abortController.signal.aborted) break;
      processSDKMessage(sessionId, msg, emit, log);
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

interface WorkerContext {
  sessionId: string;
  started: boolean;
  readonly followUpQueue: ReturnType<typeof createAsyncQueue<string>>;
  readonly abortController: AbortController;
}

function handleCommand(ctx: WorkerContext, cmd: WorkerCommand): void {
  if (cmd.type === "start_session" && !ctx.started) {
    ctx.started = true;
    ctx.sessionId = cmd.sessionId;
    runSession(ctx.sessionId, cmd.projectPath, cmd.prompt, cmd.model, cmd.maxBudgetUsd, cmd.resumeSessionId, ctx.followUpQueue, ctx.abortController)
      .catch((e: unknown) => {
        const errMsg = e instanceof Error ? e.message : String(e);
        if (!errMsg.includes("abort")) {
          log(`Session error: ${errMsg}`);
          emit({ type: "session_failed", sessionId: ctx.sessionId, error: errMsg });
        }
      })
      .finally(() => {
        log("Session ended, exiting process");
        setTimeout(() => process.exit(0), 100);
      });
  } else if (cmd.type === "send_message") {
    ctx.followUpQueue.push(cmd.message);
  } else if (cmd.type === "end_session") {
    log("End session requested — closing follow-up queue");
    ctx.followUpQueue.close();
  } else if (cmd.type === "abort_session") {
    log("Abort requested");
    ctx.abortController.abort();
    ctx.followUpQueue.close();
  } else if (cmd.type === "tool_approval_response") {
    resolveApproval(cmd.requestId, cmd.allowed, cmd.updatedPermissions);
  }
}

async function main(): Promise<void> {
  const rl = readline.createInterface({ input: process.stdin, terminal: false });
  const ctx: WorkerContext = {
    sessionId: "",
    started: false,
    followUpQueue: createAsyncQueue<string>(),
    abortController: new AbortController(),
  };

  rl.on("line", (line: string) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    log(`stdin: ${trimmed.slice(0, 200)}`);
    try {
      handleCommand(ctx, JSON.parse(trimmed) as WorkerCommand);
    } catch (e) {
      log(`Parse error: ${String(e)}`);
    }
  });

  rl.on("close", () => {
    log("stdin closed, aborting");
    ctx.abortController.abort();
    ctx.followUpQueue.close();
  });
}

main().catch((e) => {
  log(`Fatal: ${String(e)}`);
  process.exit(1);
});
