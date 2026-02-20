import { describe, it, expect, beforeEach, vi } from "vitest";
import { useTerminalStore, buildPtyId } from "./store";
import { ok, err } from "neverthrow";

vi.mock("./api", () => ({
  ptySpawn: vi.fn(),
  ptyWrite: vi.fn(),
  ptyResize: vi.fn(),
  ptyKill: vi.fn(),
}));

async function getApi(): Promise<typeof import("./api")> {
  return import("./api");
}

function resetStore(): void {
  useTerminalStore.setState({
    sessions: {},
    error: null,
  });
}

describe("buildPtyId", () => {
  it("creates a pty id from project id", () => {
    expect(buildPtyId("proj-abc")).toBe("pty-proj-abc");
  });
});

describe("TerminalStore", () => {
  beforeEach(() => {
    resetStore();
    vi.clearAllMocks();
  });

  describe("spawn", () => {
    it("creates a terminal session on success", async () => {
      const api = await getApi();
      vi.mocked(api.ptySpawn).mockResolvedValue(ok(undefined));

      const result = await useTerminalStore
        .getState()
        .spawn("proj-1", "/tmp/project", 24, 80);

      expect(result).toBe(true);
      const state = useTerminalStore.getState();
      const session = state.sessions["pty-proj-1"];
      expect(session).toBeDefined();
      expect(session?.status).toBe("running");
      expect(session?.projectId).toBe("proj-1");
      expect(state.error).toBeNull();
    });

    it("sets error on spawn failure", async () => {
      const api = await getApi();
      vi.mocked(api.ptySpawn).mockResolvedValue(
        err("Failed to open PTY"),
      );

      const result = await useTerminalStore
        .getState()
        .spawn("proj-1", "/tmp", 24, 80);

      expect(result).toBe(false);
      expect(useTerminalStore.getState().error).toBe("Failed to open PTY");
    });

    it("kills existing session before re-spawning", async () => {
      const api = await getApi();
      vi.mocked(api.ptyKill).mockResolvedValue(ok(undefined));
      vi.mocked(api.ptySpawn).mockResolvedValue(ok(undefined));

      // Pre-populate an existing running session
      useTerminalStore.setState({
        sessions: {
          "pty-proj-1": {
            ptyId: "pty-proj-1",
            projectId: "proj-1",
            status: "running",
            exitCode: null,
          },
        },
      });

      await useTerminalStore.getState().spawn("proj-1", "/tmp", 24, 80);

      expect(api.ptyKill).toHaveBeenCalledWith("pty-proj-1");
    });
  });

  describe("markExited", () => {
    it("updates session status and exit code", () => {
      useTerminalStore.setState({
        sessions: {
          "pty-1": {
            ptyId: "pty-1",
            projectId: "p1",
            status: "running",
            exitCode: null,
          },
        },
      });

      useTerminalStore.getState().markExited("pty-1", 0);

      const session = useTerminalStore.getState().sessions["pty-1"];
      expect(session?.status).toBe("exited");
      expect(session?.exitCode).toBe(0);
    });

    it("handles null exit code", () => {
      useTerminalStore.setState({
        sessions: {
          "pty-1": {
            ptyId: "pty-1",
            projectId: "p1",
            status: "running",
            exitCode: null,
          },
        },
      });

      useTerminalStore.getState().markExited("pty-1", null);

      expect(
        useTerminalStore.getState().sessions["pty-1"]?.exitCode,
      ).toBeNull();
    });

    it("is a no-op for non-existent pty id", () => {
      useTerminalStore.getState().markExited("non-existent", 1);
      expect(
        Object.keys(useTerminalStore.getState().sessions),
      ).toHaveLength(0);
    });
  });

  describe("removeSession", () => {
    it("removes a session from the store", () => {
      useTerminalStore.setState({
        sessions: {
          "pty-1": {
            ptyId: "pty-1",
            projectId: "p1",
            status: "exited",
            exitCode: 0,
          },
        },
      });

      useTerminalStore.getState().removeSession("pty-1");

      expect(useTerminalStore.getState().sessions["pty-1"]).toBeUndefined();
    });
  });

  describe("getSessionForProject", () => {
    it("returns the session for a given project", () => {
      useTerminalStore.setState({
        sessions: {
          "pty-proj-1": {
            ptyId: "pty-proj-1",
            projectId: "proj-1",
            status: "running",
            exitCode: null,
          },
        },
      });

      const session = useTerminalStore
        .getState()
        .getSessionForProject("proj-1");

      expect(session?.ptyId).toBe("pty-proj-1");
    });

    it("returns undefined for unknown project", () => {
      const session = useTerminalStore
        .getState()
        .getSessionForProject("unknown");
      expect(session).toBeUndefined();
    });
  });

  describe("write", () => {
    it("delegates to API", async () => {
      const api = await getApi();
      vi.mocked(api.ptyWrite).mockResolvedValue(ok(undefined));

      await useTerminalStore.getState().write("pty-1", "ls -la\n");

      expect(api.ptyWrite).toHaveBeenCalledWith("pty-1", "ls -la\n");
    });

    it("sets error on write failure", async () => {
      const api = await getApi();
      vi.mocked(api.ptyWrite).mockResolvedValue(
        err("PTY not found: pty-1"),
      );

      await useTerminalStore.getState().write("pty-1", "data");

      expect(useTerminalStore.getState().error).toBe(
        "PTY not found: pty-1",
      );
    });
  });

  describe("resize", () => {
    it("delegates to API", async () => {
      const api = await getApi();
      vi.mocked(api.ptyResize).mockResolvedValue(ok(undefined));

      await useTerminalStore.getState().resize("pty-1", 50, 120);

      expect(api.ptyResize).toHaveBeenCalledWith("pty-1", 50, 120);
    });
  });

  describe("kill", () => {
    it("removes session from store on success", async () => {
      const api = await getApi();
      vi.mocked(api.ptyKill).mockResolvedValue(ok(undefined));

      useTerminalStore.setState({
        sessions: {
          "pty-1": {
            ptyId: "pty-1",
            projectId: "p1",
            status: "running",
            exitCode: null,
          },
        },
      });

      await useTerminalStore.getState().kill("pty-1");

      expect(useTerminalStore.getState().sessions["pty-1"]).toBeUndefined();
    });
  });

  describe("clearError", () => {
    it("clears error state", () => {
      useTerminalStore.setState({ error: "some error" });
      useTerminalStore.getState().clearError();
      expect(useTerminalStore.getState().error).toBeNull();
    });
  });
});
