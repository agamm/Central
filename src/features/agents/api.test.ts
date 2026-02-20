import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  createSession,
  updateSessionStatus,
  listSessions,
  addMessage,
  getMessages,
  getAllSessions,
  markInterruptedSessions,
} from "./api";
import { mockExecute, mockSelect } from "@/test-setup";

describe("Agent API — neverthrow Result patterns", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createSession", () => {
    it("returns Ok with a new session on success", async () => {
      mockExecute.mockResolvedValueOnce({
        rowsAffected: 1,
        lastInsertId: 0,
      });

      const result = await createSession("proj-1", "Write tests", null);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.projectId).toBe("proj-1");
        expect(result.value.prompt).toBe("Write tests");
        expect(result.value.status).toBe("running");
        expect(result.value.model).toBeNull();
        expect(result.value.endedAt).toBeNull();
        expect(result.value.id).toBeTruthy();
      }
    });

    it("returns Err when database throws", async () => {
      mockExecute.mockRejectedValueOnce(new Error("DB locked"));

      const result = await createSession("proj-1", "Write tests", null);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toContain("Failed to create session");
        expect(result.error).toContain("DB locked");
      }
    });
  });

  describe("updateSessionStatus", () => {
    it("returns Ok on successful update", async () => {
      mockExecute.mockResolvedValueOnce({
        rowsAffected: 1,
        lastInsertId: 0,
      });

      const result = await updateSessionStatus("s1", "completed");

      expect(result.isOk()).toBe(true);
      expect(mockExecute).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE agent_sessions"),
        expect.arrayContaining(["completed", expect.any(String), "s1"]),
      );
    });

    it("passes explicit endedAt when provided", async () => {
      mockExecute.mockResolvedValueOnce({
        rowsAffected: 1,
        lastInsertId: 0,
      });

      const endedAt = "2026-01-01T00:00:00.000Z";
      await updateSessionStatus("s1", "failed", endedAt);

      expect(mockExecute).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(["failed", endedAt, "s1"]),
      );
    });

    it("returns Err on database failure", async () => {
      mockExecute.mockRejectedValueOnce(new Error("connection lost"));

      const result = await updateSessionStatus("s1", "failed");

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toContain("Failed to update session status");
      }
    });
  });

  describe("listSessions", () => {
    it("returns Ok with mapped sessions", async () => {
      const rows = [
        {
          id: "s1",
          project_id: "p1",
          status: "completed",
          prompt: "test prompt",
          model: null,
          sdk_session_id: null,
          created_at: "2026-01-01T00:00:00Z",
          ended_at: "2026-01-01T00:05:00Z",
        },
      ];
      mockSelect.mockResolvedValueOnce(rows);

      const result = await listSessions("p1");

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toHaveLength(1);
        expect(result.value[0]?.projectId).toBe("p1");
        expect(result.value[0]?.status).toBe("completed");
      }
    });

    it("returns Err on database failure", async () => {
      mockSelect.mockRejectedValueOnce(new Error("table not found"));

      const result = await listSessions("p1");

      expect(result.isErr()).toBe(true);
    });
  });

  describe("addMessage", () => {
    it("returns Ok with a new message on success", async () => {
      mockExecute.mockResolvedValueOnce({
        rowsAffected: 1,
        lastInsertId: 0,
      });

      const result = await addMessage(
        "s1",
        "assistant",
        "Hello",
        null,
        null,
        null,
      );

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.sessionId).toBe("s1");
        expect(result.value.role).toBe("assistant");
        expect(result.value.content).toBe("Hello");
      }
    });

    it("persists thinking and tool calls", async () => {
      mockExecute.mockResolvedValueOnce({
        rowsAffected: 1,
        lastInsertId: 0,
      });

      const toolCalls = JSON.stringify([{ name: "write_file" }]);
      const result = await addMessage(
        "s1",
        "assistant",
        "content",
        "Let me think...",
        toolCalls,
        '{"input_tokens": 100}',
      );

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.thinking).toBe("Let me think...");
        expect(result.value.toolCalls).toBe(toolCalls);
        expect(result.value.usage).toBe('{"input_tokens": 100}');
      }
    });
  });

  describe("getMessages", () => {
    it("returns Ok with mapped messages", async () => {
      const rows = [
        {
          id: "m1",
          session_id: "s1",
          role: "user",
          content: "Hello",
          thinking: null,
          tool_calls: null,
          usage: null,
          timestamp: "2026-01-01T00:00:00Z",
        },
        {
          id: "m2",
          session_id: "s1",
          role: "assistant",
          content: "Hi there",
          thinking: "Thinking...",
          tool_calls: null,
          usage: null,
          timestamp: "2026-01-01T00:00:01Z",
        },
      ];
      mockSelect.mockResolvedValueOnce(rows);

      const result = await getMessages("s1");

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toHaveLength(2);
        expect(result.value[0]?.role).toBe("user");
        expect(result.value[1]?.thinking).toBe("Thinking...");
      }
    });
  });

  describe("getAllSessions", () => {
    it("returns all sessions across projects", async () => {
      const rows = [
        {
          id: "s1",
          project_id: "p1",
          status: "running",
          prompt: "a",
          model: null,
          sdk_session_id: null,
          created_at: "2026-01-02T00:00:00Z",
          ended_at: null,
        },
        {
          id: "s2",
          project_id: "p2",
          status: "completed",
          prompt: "b",
          model: null,
          sdk_session_id: null,
          created_at: "2026-01-01T00:00:00Z",
          ended_at: "2026-01-01T00:10:00Z",
        },
      ];
      mockSelect.mockResolvedValueOnce(rows);

      const result = await getAllSessions();

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toHaveLength(2);
        expect(result.value[0]?.projectId).toBe("p1");
      }
    });
  });

  describe("markInterruptedSessions", () => {
    it("returns count of affected rows on success", async () => {
      mockExecute.mockResolvedValueOnce({
        rowsAffected: 3,
        lastInsertId: 0,
      });

      const result = await markInterruptedSessions();

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toBe(3);
      }
    });

    it("returns 0 when no running sessions exist", async () => {
      mockExecute.mockResolvedValueOnce({
        rowsAffected: 0,
        lastInsertId: 0,
      });

      const result = await markInterruptedSessions();

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toBe(0);
      }
    });

    it("returns Err on database failure", async () => {
      mockExecute.mockRejectedValueOnce(new Error("constraint violated"));

      const result = await markInterruptedSessions();

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toContain("Failed to mark interrupted");
      }
    });
  });
});
