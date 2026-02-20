import type { AgentSession, Project, Message } from "@/core/types";

function createMockProject(overrides?: Partial<Project>): Project {
  return {
    id: crypto.randomUUID(),
    path: "/tmp/test-project",
    name: "Test Project",
    createdAt: new Date().toISOString(),
    deletedAt: null,
    ...overrides,
  };
}

function createMockSession(
  overrides?: Partial<AgentSession>,
): AgentSession {
  return {
    id: crypto.randomUUID(),
    projectId: crypto.randomUUID(),
    status: "running",
    prompt: "Write a test",
    model: null,
    sdkSessionId: null,
    createdAt: new Date().toISOString(),
    endedAt: null,
    ...overrides,
  };
}

function createMockMessage(overrides?: Partial<Message>): Message {
  return {
    id: crypto.randomUUID(),
    sessionId: crypto.randomUUID(),
    role: "assistant",
    content: "Hello, this is a test message",
    thinking: null,
    toolCalls: null,
    usage: null,
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

export { createMockProject, createMockSession, createMockMessage };
