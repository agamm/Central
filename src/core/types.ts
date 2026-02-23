/** Agent session status lifecycle: idle -> running -> completed | failed | aborted | interrupted */
type AgentStatus =
  | "idle"
  | "running"
  | "completed"
  | "failed"
  | "aborted"
  | "interrupted";

/** Session type: chat (SDK agent) or terminal (PTY) */
type SessionType = "chat" | "terminal";

/** Message role in agent conversation */
type MessageRole = "user" | "assistant" | "system";

interface Project {
  readonly id: string;
  readonly path: string;
  readonly name: string;
  readonly createdAt: string;
  readonly deletedAt: string | null;
}

interface AgentSession {
  readonly id: string;
  readonly projectId: string;
  readonly status: AgentStatus;
  readonly sessionType: SessionType;
  readonly prompt: string | null;
  readonly model: string | null;
  readonly sdkSessionId: string | null;
  readonly createdAt: string;
  readonly endedAt: string | null;
}

interface Message {
  readonly id: string;
  readonly sessionId: string;
  readonly role: MessageRole;
  readonly content: string | null;
  readonly thinking: string | null;
  readonly toolCalls: string | null;
  readonly usage: string | null;
  readonly timestamp: string;
}

interface AppSetting {
  readonly key: string;
  readonly value: string | null;
}

export type {
  AgentStatus,
  SessionType,
  MessageRole,
  Project,
  AgentSession,
  Message,
  AppSetting,
};
