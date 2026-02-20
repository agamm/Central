import type { SidecarEvent } from "./types.js";

/** Simulated tool call scenarios for realistic mock output */
const MOCK_TOOL_CALLS = [
  { name: "Read", input: { file_path: "/src/index.ts" } },
  { name: "Edit", input: { file_path: "/src/index.ts", old_string: "TODO", new_string: "DONE" } },
  { name: "Bash", input: { command: "npm test" } },
];

const MOCK_THINKING_LINES = [
  "Let me analyze the project structure first.",
  "I need to understand the existing code before making changes.",
  "Looking at the file structure to determine the best approach.",
];

const MOCK_RESPONSES = [
  "I'll help you with that. Let me take a look at the codebase.",
  "I've analyzed the project and here's what I found.",
  "I've made the requested changes. Here's a summary of what I did.",
];

interface MockSession {
  readonly sessionId: string;
  readonly projectPath: string;
  readonly abortController: AbortController;
}

const activeSessions = new Map<string, MockSession>();

function emit(event: SidecarEvent): void {
  process.stdout.write(JSON.stringify(event) + "\n");
}

function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(new Error("aborted"));
    });
  });
}

function pickRandom<T>(items: readonly T[]): T {
  const idx = Math.floor(Math.random() * items.length);
  return items[idx]!;
}

async function runMockSession(
  sessionId: string,
  projectPath: string,
  prompt: string,
  signal: AbortSignal,
): Promise<void> {
  emit({ type: "session_started", sessionId });

  try {
    // Simulate initial thinking delay
    await delay(500, signal);

    // Emit thinking + first response
    emit({
      type: "message",
      sessionId,
      role: "assistant",
      content: `${pickRandom(MOCK_RESPONSES)}\n\nYou asked: "${prompt}"`,
      thinking: pickRandom(MOCK_THINKING_LINES),
      usage: { inputTokens: 150, outputTokens: 80 },
    });

    await delay(800, signal);

    // Simulate a tool call
    const tool = pickRandom(MOCK_TOOL_CALLS);
    emit({
      type: "tool_use",
      sessionId,
      toolName: tool.name,
      input: { ...tool.input, _context: projectPath },
    });

    await delay(600, signal);

    emit({
      type: "tool_result",
      sessionId,
      toolName: tool.name,
      output: `Mock result for ${tool.name} completed successfully.`,
    });

    await delay(500, signal);

    // Final response
    emit({
      type: "message",
      sessionId,
      role: "assistant",
      content: "I've completed the task. Let me know if you need anything else.",
      thinking: "The changes look correct. Let me provide a summary.",
      toolCalls: [{ name: tool.name, input: tool.input }],
      usage: { inputTokens: 320, outputTokens: 150 },
    });

    await delay(300, signal);

    emit({ type: "session_completed", sessionId });
  } catch {
    // Aborted sessions are handled by the caller
    throw new Error("aborted");
  }
}

function startSession(
  sessionId: string,
  projectPath: string,
  prompt: string,
): void {
  if (activeSessions.has(sessionId)) {
    emit({
      type: "error",
      message: `Session ${sessionId} already exists`,
    });
    return;
  }

  const abortController = new AbortController();
  activeSessions.set(sessionId, { sessionId, projectPath, abortController });

  runMockSession(sessionId, projectPath, prompt, abortController.signal)
    .then(() => {
      activeSessions.delete(sessionId);
    })
    .catch(() => {
      activeSessions.delete(sessionId);
    });
}

function sendMessage(sessionId: string, message: string): void {
  const session = activeSessions.get(sessionId);
  if (!session) {
    // Session completed — start a follow-up mock response
    const abortController = new AbortController();
    activeSessions.set(sessionId, {
      sessionId,
      projectPath: "",
      abortController,
    });

    const signal = abortController.signal;
    (async () => {
      try {
        await delay(600, signal);
        emit({
          type: "message",
          sessionId,
          role: "assistant",
          content: `Follow-up response to: "${message}"`,
          thinking: "Processing the follow-up message.",
          usage: { inputTokens: 100, outputTokens: 60 },
        });
        await delay(300, signal);
        emit({ type: "session_completed", sessionId });
      } catch {
        // aborted
      } finally {
        activeSessions.delete(sessionId);
      }
    })();
    return;
  }

  // If session is still running, queue will handle it on the frontend
  emit({
    type: "error",
    message: `Session ${sessionId} is still running. Message queued on frontend.`,
  });
}

function abortSession(sessionId: string): void {
  const session = activeSessions.get(sessionId);
  if (!session) {
    emit({
      type: "error",
      message: `Session ${sessionId} not found`,
    });
    return;
  }

  session.abortController.abort();
  activeSessions.delete(sessionId);
  emit({
    type: "session_failed",
    sessionId,
    error: "Session aborted by user",
  });
}

function listSessions(): void {
  const sessionIds = Array.from(activeSessions.keys());
  // Emit as a message event with session list encoded
  emit({
    type: "message",
    sessionId: "__system__",
    role: "assistant",
    content: JSON.stringify(sessionIds),
  });
}

export { startSession, sendMessage, abortSession, listSessions };
