import { describe, it, expect, beforeEach, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { startNewSession, sendFollowUp } from "./sessionActions";
import type { SessionActions } from "./sessionActions";
import { ok, err } from "neverthrow";

// Mock the API module
vi.mock("./api", () => ({
  createSession: vi.fn(),
  addMessage: vi.fn(),
  updateSessionStatus: vi.fn(),
}));

async function getApi(): Promise<typeof import("./api")> {
  return import("./api");
}

function createMockActions(): SessionActions {
  return {
    setSession: vi.fn(),
    switchSession: vi.fn(),
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
    it("creates session, switches to it, and invokes agent", async () => {
      const api = await getApi();
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

      vi.mocked(api.createSession).mockResolvedValue(ok(sessionData));
      vi.mocked(api.addMessage).mockResolvedValue(
        ok({
          id: "msg-1",
          sessionId: "new-session-id",
          role: "user" as const,
          content: "Write a test",
          thinking: null,
          toolCalls: null,
          usage: null,
          timestamp: new Date().toISOString(),
        }),
      );
      vi.mocked(invoke).mockResolvedValue("new-session-id");

      await startNewSession("proj-1", "/tmp/project", "Write a test", actions);

      expect(actions.setSession).toHaveBeenCalledWith(sessionData);
      expect(actions.switchSession).toHaveBeenCalledWith("new-session-id");
      expect(actions.addMessage).toHaveBeenCalled();
      expect(invoke).toHaveBeenCalledWith("start_agent_session", {
        projectPath: "/tmp/project",
        prompt: "Write a test",
        model: null,
      });
    });

    it("sets error when session creation fails", async () => {
      const api = await getApi();
      const actions = createMockActions();

      vi.mocked(api.createSession).mockResolvedValue(
        err("DB error creating session"),
      );

      await startNewSession("proj-1", "/tmp/project", "prompt", actions);

      expect(actions.setError).toHaveBeenCalledWith(
        "DB error creating session",
      );
      expect(invoke).not.toHaveBeenCalled();
    });

    it("sets error when invoke fails", async () => {
      const api = await getApi();
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

      vi.mocked(api.createSession).mockResolvedValue(ok(sessionData));
      vi.mocked(api.addMessage).mockResolvedValue(
        ok({
          id: "m1",
          sessionId: "s1",
          role: "user" as const,
          content: "test",
          thinking: null,
          toolCalls: null,
          usage: null,
          timestamp: new Date().toISOString(),
        }),
      );
      vi.mocked(invoke).mockRejectedValue(new Error("sidecar crash"));

      await startNewSession("p1", "/tmp/p", "test", actions);

      expect(actions.updateStatus).toHaveBeenCalledWith("s1", "failed");
      expect(actions.setError).toHaveBeenCalledWith(
        expect.stringContaining("Failed to start agent"),
      );
    });
  });

  describe("sendFollowUp", () => {
    it("persists message, updates status, and invokes send", async () => {
      const api = await getApi();
      const actions = createMockActions();

      vi.mocked(api.addMessage).mockResolvedValue(
        ok({
          id: "m1",
          sessionId: "s1",
          role: "user" as const,
          content: "follow up",
          thinking: null,
          toolCalls: null,
          usage: null,
          timestamp: new Date().toISOString(),
        }),
      );
      vi.mocked(api.updateSessionStatus).mockResolvedValue(ok(undefined));
      vi.mocked(invoke).mockResolvedValue(undefined);

      await sendFollowUp("s1", "follow up", actions);

      expect(actions.addMessage).toHaveBeenCalled();
      expect(actions.updateStatus).toHaveBeenCalledWith("s1", "running");
      expect(invoke).toHaveBeenCalledWith("send_agent_message", {
        sessionId: "s1",
        message: "follow up",
      });
    });

    it("marks session as failed when invoke errors", async () => {
      const api = await getApi();
      const actions = createMockActions();

      vi.mocked(api.addMessage).mockResolvedValue(
        ok({
          id: "m1",
          sessionId: "s1",
          role: "user" as const,
          content: "msg",
          thinking: null,
          toolCalls: null,
          usage: null,
          timestamp: new Date().toISOString(),
        }),
      );
      vi.mocked(api.updateSessionStatus).mockResolvedValue(ok(undefined));
      vi.mocked(invoke).mockRejectedValue(new Error("session not found"));

      await sendFollowUp("s1", "msg", actions);

      expect(actions.updateStatus).toHaveBeenCalledWith("s1", "failed");
      expect(actions.setError).toHaveBeenCalledWith(
        expect.stringContaining("Failed to send message"),
      );
    });
  });
});
