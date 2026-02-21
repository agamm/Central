import { describe, it, expect, beforeEach, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { startNewSession, sendFollowUp } from "./sessionActions";
import type { SessionActions } from "./sessionActions";

vi.mock("@/shared/debugLog", () => ({
  debugLog: vi.fn(),
}));

function createMockActions(): SessionActions {
  return {
    createSession: vi.fn(),
    addMessage: vi.fn(),
    updateStatus: vi.fn(),
    setError: vi.fn(),
  };
}

describe("sessionActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("startNewSession", () => {
    it("creates session via store, adds message, and invokes agent", async () => {
      const actions = createMockActions();
      const sessionData = {
        id: "new-session-id",
        projectId: "proj-1",
        status: "running" as const,
        prompt: "Write a test",
        model: null,
        sdkSessionId: null,
        createdAt: new Date().toISOString(),
        endedAt: null,
      };

      vi.mocked(actions.createSession).mockResolvedValue(sessionData);
      vi.mocked(invoke).mockResolvedValue("new-session-id");

      await startNewSession("proj-1", "/tmp/project", "Write a test", actions);

      expect(actions.createSession).toHaveBeenCalledWith(
        "proj-1",
        "Write a test",
        null,
      );
      expect(actions.addMessage).toHaveBeenCalled();
      expect(invoke).toHaveBeenCalledWith("start_agent_session", {
        sessionId: "new-session-id",
        projectPath: "/tmp/project",
        prompt: "Write a test",
        model: null,
      });
    });

    it("returns early when session creation fails", async () => {
      const actions = createMockActions();
      vi.mocked(actions.createSession).mockResolvedValue(null);

      await startNewSession("proj-1", "/tmp/project", "prompt", actions);

      expect(invoke).not.toHaveBeenCalled();
      expect(actions.addMessage).not.toHaveBeenCalled();
    });

    it("sets error when invoke fails", async () => {
      const actions = createMockActions();
      const sessionData = {
        id: "s1",
        projectId: "p1",
        status: "running" as const,
        prompt: "test",
        model: null,
        sdkSessionId: null,
        createdAt: new Date().toISOString(),
        endedAt: null,
      };

      vi.mocked(actions.createSession).mockResolvedValue(sessionData);
      vi.mocked(invoke).mockRejectedValue(new Error("sidecar crash"));

      await startNewSession("p1", "/tmp/p", "test", actions);

      expect(actions.updateStatus).toHaveBeenCalledWith("s1", "failed");
      expect(actions.setError).toHaveBeenCalledWith(
        expect.stringContaining("Failed to start agent"),
      );
    });
  });

  describe("sendFollowUp", () => {
    it("adds message, updates status, and invokes send", async () => {
      const actions = createMockActions();
      vi.mocked(invoke).mockResolvedValue(undefined);

      await sendFollowUp("s1", "/tmp/project", "follow up", actions);

      expect(actions.addMessage).toHaveBeenCalled();
      expect(actions.updateStatus).toHaveBeenCalledWith("s1", "running");
      expect(invoke).toHaveBeenCalledWith("send_agent_message", {
        sessionId: "s1",
        message: "follow up",
      });
    });

    it("falls back to start_agent_session when send fails (stale session)", async () => {
      const actions = createMockActions();

      vi.mocked(invoke)
        .mockRejectedValueOnce(new Error("No worker found"))
        .mockResolvedValueOnce("s1");

      await sendFollowUp("s1", "/tmp/project", "msg", actions);

      expect(invoke).toHaveBeenCalledWith("send_agent_message", {
        sessionId: "s1",
        message: "msg",
      });
      expect(invoke).toHaveBeenCalledWith("start_agent_session", {
        sessionId: "s1",
        projectPath: "/tmp/project",
        prompt: "msg",
        model: null,
        resumeSessionId: null,
      });
    });

    it("marks session as failed when both send and start fail", async () => {
      const actions = createMockActions();

      vi.mocked(invoke)
        .mockRejectedValueOnce(new Error("No worker found"))
        .mockRejectedValueOnce(new Error("sidecar crash"));

      await sendFollowUp("s1", "/tmp/project", "msg", actions);

      expect(actions.updateStatus).toHaveBeenCalledWith("s1", "failed");
      expect(actions.setError).toHaveBeenCalledWith(
        expect.stringContaining("Failed to start agent"),
      );
    });
  });
});
