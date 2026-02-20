import * as readline from "node:readline";
import type { SidecarCommand } from "./types.js";
import {
  startSession,
  sendMessage,
  abortSession,
  listSessions,
} from "./mock-session.js";

/**
 * Main entry point for the Central sidecar process.
 * Reads JSON-line commands from stdin, dispatches to session handlers,
 * and writes JSON-line events to stdout.
 *
 * Currently uses a mock implementation. Swap mock-session imports
 * with real Claude SDK session handler when ready.
 */

const rl = readline.createInterface({
  input: process.stdin,
  terminal: false,
});

function handleCommand(command: SidecarCommand): void {
  switch (command.type) {
    case "start_session":
      startSession(command.sessionId, command.projectPath, command.prompt);
      break;
    case "send_message":
      sendMessage(command.sessionId, command.message);
      break;
    case "abort_session":
      abortSession(command.sessionId);
      break;
    case "list_sessions":
      listSessions();
      break;
  }
}

function parseLine(line: string): void {
  const trimmed = line.trim();
  if (trimmed.length === 0) return;

  try {
    const command = JSON.parse(trimmed) as SidecarCommand;
    handleCommand(command);
  } catch {
    const errorEvent = {
      type: "error" as const,
      message: `Failed to parse command: ${trimmed}`,
    };
    process.stdout.write(JSON.stringify(errorEvent) + "\n");
  }
}

rl.on("line", parseLine);

rl.on("close", () => {
  process.exit(0);
});

// Signal ready
process.stdout.write(
  JSON.stringify({ type: "ready", message: "Central sidecar ready" }) + "\n",
);
