import { describe, it, expect, beforeEach, vi } from "vitest";
import { ok, err } from "neverthrow";
import { useAgentStore } from "@/features/agents/store";
import { createMockSession, createMockMessage } from "@/shared/test-helpers";

vi.mock("@/features/agents/api", () => ({
  markInterruptedSessions: vi.fn(),
  getAllSessions: vi.fn(),
  getMessages: vi.fn(),
  createSession: vi.fn(),
  updateSessionStatus: vi.fn(),
  addMessage: vi.fn(),
}));

vi.mock("@/shared/debugLog", () => ({
  debugLog: vi.fn(),
}));

async function getApi(): Promise<typeof import("@/features/agents/api")> {
  return import("@/features/agents/api");
}

function resetStore(): void {
  useAgentStore.setState({
    sessions: new Map(),
    activeSessionId: null,
    messagesBySession: new Map(),
    messageQueue: [],
    scrollPositionBySession: new Map(),
    sessionStartedAt: new Map(),
    sessionElapsedMs: new Map(),
    sdkSessionIds: new Map(),
    loading: false,
    error: null,
  });
}

async function restoreSessionsForTest(): Promise<void> {
  await useAgentStore.getState().hydrate();
}

describe("Session restore (bootstrap logic)", () => {
  beforeEach(() => {
    resetStore();
    vi.clearAllMocks();
  });

  it("marks interrupted sessions and populates store", async () => {
    const api = await getApi();
    const s1 = createMockSession({
      id: "s1",
      status: "completed",
    });
    const s2 = createMockSession({
      id: "s2",
      status: "interrupted",
    });

    vi.mocked(api.markInterruptedSessions).mockResolvedValue(ok(1));
    vi.mocked(api.getAllSessions).mockResolvedValue(ok([s1, s2]));
    vi.mocked(api.getMessages).mockResolvedValue(ok([]));

    await restoreSessionsForTest();

    const state = useAgentStore.getState();
    expect(state.sessions.size).toBe(2);
    expect(state.sessions.get("s1")?.status).toBe("completed");
    expect(state.sessions.get("s2")?.status).toBe("interrupted");
    expect(state.activeSessionId).toBe("s1");
  });

  it("restores messages for the last active session", async () => {
    const api = await getApi();
    const session = createMockSession({ id: "s1" });
    const msg = createMockMessage({
      id: "m1",
      sessionId: "s1",
      content: "restored",
    });

    vi.mocked(api.markInterruptedSessions).mockResolvedValue(ok(0));
    vi.mocked(api.getAllSessions).mockResolvedValue(ok([session]));
    vi.mocked(api.getMessages).mockResolvedValue(ok([msg]));

    await restoreSessionsForTest();

    const messages = useAgentStore.getState().messagesBySession.get("s1");
    expect(messages).toHaveLength(1);
    expect(messages?.[0]?.content).toBe("restored");
    expect(messages?.[0]?.isStreaming).toBe(false);
  });

  it("handles empty sessions gracefully", async () => {
    const api = await getApi();

    vi.mocked(api.markInterruptedSessions).mockResolvedValue(ok(0));
    vi.mocked(api.getAllSessions).mockResolvedValue(ok([]));

    await restoreSessionsForTest();

    const state = useAgentStore.getState();
    expect(state.sessions.size).toBe(0);
    expect(state.activeSessionId).toBeNull();
  });

  it("sets error when getAllSessions fails", async () => {
    const api = await getApi();

    vi.mocked(api.markInterruptedSessions).mockResolvedValue(ok(0));
    vi.mocked(api.getAllSessions).mockResolvedValue(err("DB corrupted"));

    await restoreSessionsForTest();

    expect(useAgentStore.getState().error).toBe("DB corrupted");
    expect(useAgentStore.getState().sessions.size).toBe(0);
  });

  it("sets error when markInterrupted fails but continues", async () => {
    const api = await getApi();
    const session = createMockSession({ id: "s1" });

    vi.mocked(api.markInterruptedSessions).mockResolvedValue(
      err("Mark failed"),
    );
    vi.mocked(api.getAllSessions).mockResolvedValue(ok([session]));
    vi.mocked(api.getMessages).mockResolvedValue(ok([]));

    await restoreSessionsForTest();

    const state = useAgentStore.getState();
    expect(state.sessions.size).toBe(1);
    expect(state.activeSessionId).toBe("s1");
  });

  it("handles message load failure gracefully", async () => {
    const api = await getApi();
    const session = createMockSession({ id: "s1" });

    vi.mocked(api.markInterruptedSessions).mockResolvedValue(ok(0));
    vi.mocked(api.getAllSessions).mockResolvedValue(ok([session]));
    vi.mocked(api.getMessages).mockResolvedValue(err("messages table missing"));

    await restoreSessionsForTest();

    const state = useAgentStore.getState();
    expect(state.sessions.size).toBe(1);
    expect(state.activeSessionId).toBe("s1");
    expect(state.messagesBySession.has("s1")).toBe(false);
  });
});
