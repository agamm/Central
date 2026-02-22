import Database from "@tauri-apps/plugin-sql";
import { ok, err, type Result } from "neverthrow";
import type { AgentSession, AgentStatus, Message } from "@/core/types";
import { DB_NAME } from "@/core/constants";

/** Raw row shape from SQLite for agent_sessions */
interface SessionRow {
  readonly id: string;
  readonly project_id: string;
  readonly status: string;
  readonly prompt: string | null;
  readonly model: string | null;
  readonly sdk_session_id: string | null;
  readonly created_at: string;
  readonly ended_at: string | null;
}

/** Raw row shape from SQLite for messages */
interface MessageRow {
  readonly id: string;
  readonly session_id: string;
  readonly role: string;
  readonly content: string | null;
  readonly thinking: string | null;
  readonly tool_calls: string | null;
  readonly usage: string | null;
  readonly timestamp: string;
}

function rowToSession(row: SessionRow): AgentSession {
  return {
    id: row.id,
    projectId: row.project_id,
    status: row.status as AgentStatus,
    prompt: row.prompt,
    model: row.model,
    sdkSessionId: row.sdk_session_id,
    createdAt: row.created_at,
    endedAt: row.ended_at,
  };
}

function rowToMessage(row: MessageRow): Message {
  return {
    id: row.id,
    sessionId: row.session_id,
    role: row.role as Message["role"],
    content: row.content,
    thinking: row.thinking,
    toolCalls: row.tool_calls,
    usage: row.usage,
    timestamp: row.timestamp,
  };
}

function generateId(): string {
  return crypto.randomUUID();
}

function getDb(): Database {
  return Database.get(DB_NAME);
}

async function createSession(
  projectId: string,
  prompt: string,
  model: string | null,
): Promise<Result<AgentSession, string>> {
  try {
    const db = getDb();
    const id = generateId();
    const createdAt = new Date().toISOString();
    const status: AgentStatus = "running";

    await db.execute(
      `INSERT INTO agent_sessions (id, project_id, status, prompt, model, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, projectId, status, prompt, model, createdAt],
    );

    return ok({
      id,
      projectId,
      status,
      prompt,
      model,
      sdkSessionId: null,
      createdAt,
      endedAt: null,
    });
  } catch (e) {
    return err(`Failed to create session: ${String(e)}`);
  }
}

async function createIdleSession(
  projectId: string,
): Promise<Result<AgentSession, string>> {
  try {
    const db = getDb();
    const id = generateId();
    const createdAt = new Date().toISOString();
    const status: AgentStatus = "idle";

    await db.execute(
      `INSERT INTO agent_sessions (id, project_id, status, prompt, model, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, projectId, status, null, null, createdAt],
    );

    return ok({
      id,
      projectId,
      status,
      prompt: null,
      model: null,
      sdkSessionId: null,
      createdAt,
      endedAt: null,
    });
  } catch (e) {
    return err(`Failed to create idle session: ${String(e)}`);
  }
}

async function updateSessionPrompt(
  sessionId: string,
  prompt: string,
): Promise<Result<void, string>> {
  try {
    const db = getDb();
    await db.execute(
      `UPDATE agent_sessions SET prompt = $1 WHERE id = $2`,
      [prompt, sessionId],
    );
    return ok(undefined);
  } catch (e) {
    return err(`Failed to update session prompt: ${String(e)}`);
  }
}

async function updateSessionStatus(
  sessionId: string,
  status: AgentStatus,
  endedAt?: string,
): Promise<Result<void, string>> {
  try {
    const db = getDb();
    const ended =
      endedAt ?? (status !== "running" ? new Date().toISOString() : null);

    await db.execute(
      `UPDATE agent_sessions SET status = $1, ended_at = $2 WHERE id = $3`,
      [status, ended, sessionId],
    );

    return ok(undefined);
  } catch (e) {
    return err(`Failed to update session status: ${String(e)}`);
  }
}

async function listSessions(
  projectId: string,
): Promise<Result<AgentSession[], string>> {
  try {
    const db = getDb();
    const rows = await db.select<SessionRow[]>(
      `SELECT id, project_id, status, prompt, model, sdk_session_id, created_at, ended_at
       FROM agent_sessions
       WHERE project_id = $1
       ORDER BY created_at DESC`,
      [projectId],
    );

    return ok(rows.map(rowToSession));
  } catch (e) {
    return err(`Failed to list sessions: ${String(e)}`);
  }
}

async function addMessage(
  sessionId: string,
  role: string,
  content: string | null,
  thinking: string | null,
  toolCalls: string | null,
  usage: string | null,
): Promise<Result<Message, string>> {
  try {
    const db = getDb();
    const id = generateId();
    const timestamp = new Date().toISOString();

    await db.execute(
      `INSERT INTO messages (id, session_id, role, content, thinking, tool_calls, usage, timestamp)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [id, sessionId, role, content, thinking, toolCalls, usage, timestamp],
    );

    return ok({
      id,
      sessionId,
      role: role as Message["role"],
      content,
      thinking,
      toolCalls,
      usage,
      timestamp,
    });
  } catch (e) {
    return err(`Failed to add message: ${String(e)}`);
  }
}

async function getMessages(
  sessionId: string,
): Promise<Result<Message[], string>> {
  try {
    const db = getDb();
    const rows = await db.select<MessageRow[]>(
      `SELECT id, session_id, role, content, thinking, tool_calls, usage, timestamp
       FROM messages
       WHERE session_id = $1
       ORDER BY timestamp ASC`,
      [sessionId],
    );

    return ok(rows.map(rowToMessage));
  } catch (e) {
    return err(`Failed to get messages: ${String(e)}`);
  }
}

/** Fetch recent distinct user messages for input history (global, deduped, most recent first) */
async function getRecentUserMessages(
  limit: number = 100,
): Promise<Result<string[], string>> {
  try {
    const db = getDb();
    const rows = await db.select<{ content: string }[]>(
      `SELECT DISTINCT content FROM messages
       WHERE role = 'user' AND content IS NOT NULL
       ORDER BY timestamp DESC
       LIMIT $1`,
      [limit],
    );
    return ok(rows.map((r) => r.content));
  } catch (e) {
    return err(`Failed to get user message history: ${String(e)}`);
  }
}

/** Fetch all sessions across all projects, ordered by most recent first */
async function getAllSessions(): Promise<Result<AgentSession[], string>> {
  try {
    const db = getDb();
    const rows = await db.select<SessionRow[]>(
      `SELECT id, project_id, status, prompt, model, sdk_session_id, created_at, ended_at
       FROM agent_sessions
       ORDER BY created_at DESC`,
    );

    return ok(rows.map(rowToSession));
  } catch (e) {
    return err(`Failed to get all sessions: ${String(e)}`);
  }
}

/** Mark all "running" sessions as "interrupted" after a crash/restart */
async function markInterruptedSessions(): Promise<Result<number, string>> {
  try {
    const db = getDb();
    const now = new Date().toISOString();

    const result = await db.execute(
      `UPDATE agent_sessions SET status = 'interrupted', ended_at = $1
       WHERE status = 'running'`,
      [now],
    );

    return ok(result.rowsAffected);
  } catch (e) {
    return err(`Failed to mark interrupted sessions: ${String(e)}`);
  }
}

/** Delete a session and all its messages from the database */
async function deleteSession(
  sessionId: string,
): Promise<Result<void, string>> {
  try {
    const db = getDb();
    await db.execute(`DELETE FROM messages WHERE session_id = $1`, [sessionId]);
    await db.execute(`DELETE FROM agent_sessions WHERE id = $1`, [sessionId]);
    return ok(undefined);
  } catch (e) {
    return err(`Failed to delete session: ${String(e)}`);
  }
}

export {
  createSession,
  createIdleSession,
  updateSessionPrompt,
  updateSessionStatus,
  listSessions,
  addMessage,
  getMessages,
  getRecentUserMessages,
  getAllSessions,
  markInterruptedSessions,
  deleteSession,
};
