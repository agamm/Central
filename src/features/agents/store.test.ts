import { describe, it, expect, beforeEach } from "vitest";
import { useAgentStore } from "./store";
import { createMockSession, createMockMessage } from "@/shared/test-helpers";

function resetStore(): void {
  useAgentStore.setState({
    sessions: new Map(),
    activeSessionId: null,
    messagesBySession: new Map(),
    messageQueue: [],
    scrollPositionBySession: new Map(),
    loading: false,
    error: null,
  });
}

describe("AgentStore", () => {
  beforeEach(() => {
    resetStore();
  });

  describe("setSession", () => {
    it("adds a new session to the map", () => {
      const session = createMockSession();
      useAgentStore.getState().setSession(session);

      const stored = useAgentStore.getState().sessions.get(session.id);
      expect(stored).toEqual(session);
    });

    it("overwrites an existing session with the same id", () => {
      const session = createMockSession({ prompt: "original" });
      const store = useAgentStore.getState();
      store.setSession(session);

      const updated = { ...session, prompt: "updated" };
      store.setSession(updated);

      const stored = useAgentStore.getState().sessions.get(session.id);
      expect(stored?.prompt).toBe("updated");
      expect(useAgentStore.getState().sessions.size).toBe(1);
    });
  });

  describe("updateSessionStatus", () => {
    it("updates status and sets endedAt for terminal statuses", () => {
      const session = createMockSession({ status: "running" });
      const store = useAgentStore.getState();
      store.setSession(session);

      store.updateSessionStatus(session.id, "completed");

      const updated = useAgentStore.getState().sessions.get(session.id);
      expect(updated?.status).toBe("completed");
      expect(updated?.endedAt).toBeTruthy();
    });

    it("does not set endedAt when status is running", () => {
      const session = createMockSession({
        status: "completed",
        endedAt: null,
      });
      const store = useAgentStore.getState();
      store.setSession(session);

      store.updateSessionStatus(session.id, "running");

      const updated = useAgentStore.getState().sessions.get(session.id);
      expect(updated?.status).toBe("running");
      expect(updated?.endedAt).toBeNull();
    });

    it("is a no-op for non-existent session id", () => {
      const store = useAgentStore.getState();
      store.updateSessionStatus("non-existent", "completed");

      expect(useAgentStore.getState().sessions.size).toBe(0);
    });
  });

  describe("switchSession", () => {
    it("sets the active session id", () => {
      useAgentStore.getState().switchSession("sess-1");
      expect(useAgentStore.getState().activeSessionId).toBe("sess-1");
    });

    it("sets active session to null", () => {
      useAgentStore.getState().switchSession("sess-1");
      useAgentStore.getState().switchSession(null);
      expect(useAgentStore.getState().activeSessionId).toBeNull();
    });
  });

  describe("addMessage", () => {
    it("appends a message to a new session", () => {
      const msg = createMockMessage({ sessionId: "s1" });
      useAgentStore.getState().addMessage("s1", msg);

      const messages = useAgentStore.getState().messagesBySession.get("s1");
      expect(messages).toHaveLength(1);
      expect(messages?.[0]).toEqual(msg);
    });

    it("appends to existing messages preserving order", () => {
      const msg1 = createMockMessage({ sessionId: "s1", content: "first" });
      const msg2 = createMockMessage({ sessionId: "s1", content: "second" });
      const store = useAgentStore.getState();

      store.addMessage("s1", msg1);
      store.addMessage("s1", msg2);

      const messages = useAgentStore.getState().messagesBySession.get("s1");
      expect(messages).toHaveLength(2);
      expect(messages?.[0]?.content).toBe("first");
      expect(messages?.[1]?.content).toBe("second");
    });

    it("keeps messages isolated per session", () => {
      const msg1 = createMockMessage({ sessionId: "s1" });
      const msg2 = createMockMessage({ sessionId: "s2" });
      const store = useAgentStore.getState();

      store.addMessage("s1", msg1);
      store.addMessage("s2", msg2);

      expect(
        useAgentStore.getState().messagesBySession.get("s1"),
      ).toHaveLength(1);
      expect(
        useAgentStore.getState().messagesBySession.get("s2"),
      ).toHaveLength(1);
    });
  });

  describe("setMessages", () => {
    it("replaces all messages for a session", () => {
      const msg1 = createMockMessage({ sessionId: "s1" });
      const store = useAgentStore.getState();
      store.addMessage("s1", msg1);

      const replacement = createMockMessage({
        sessionId: "s1",
        content: "replaced",
      });
      store.setMessages("s1", [replacement]);

      const messages = useAgentStore.getState().messagesBySession.get("s1");
      expect(messages).toHaveLength(1);
      expect(messages?.[0]?.content).toBe("replaced");
    });
  });

  describe("message queue", () => {
    it("queues a message and returns it", () => {
      const queued = useAgentStore
        .getState()
        .queueMessage("s1", "do this next");

      expect(queued.sessionId).toBe("s1");
      expect(queued.content).toBe("do this next");
      expect(queued.id).toBeTruthy();
      expect(useAgentStore.getState().messageQueue).toHaveLength(1);
    });

    it("dequeues the first message for a session", () => {
      const store = useAgentStore.getState();
      store.queueMessage("s1", "first");
      store.queueMessage("s1", "second");
      store.queueMessage("s2", "other session");

      const dequeued = useAgentStore.getState().dequeueMessage("s1");
      expect(dequeued?.content).toBe("first");
      expect(useAgentStore.getState().messageQueue).toHaveLength(2);
    });

    it("returns undefined when dequeuing from empty session", () => {
      const dequeued = useAgentStore.getState().dequeueMessage("empty");
      expect(dequeued).toBeUndefined();
    });

    it("cancels a queued message by id", () => {
      const store = useAgentStore.getState();
      const q1 = store.queueMessage("s1", "cancel me");
      store.queueMessage("s1", "keep me");

      useAgentStore.getState().cancelQueuedMessage(q1.id);

      const queue = useAgentStore.getState().messageQueue;
      expect(queue).toHaveLength(1);
      expect(queue[0]?.content).toBe("keep me");
    });

    it("edits a queued message content", () => {
      const store = useAgentStore.getState();
      const q = store.queueMessage("s1", "original");

      useAgentStore.getState().editQueuedMessage(q.id, "edited");

      const queue = useAgentStore.getState().messageQueue;
      expect(queue[0]?.content).toBe("edited");
    });

    it("edit is a no-op for non-existent message id", () => {
      const store = useAgentStore.getState();
      store.queueMessage("s1", "original");

      store.editQueuedMessage("non-existent", "edited");

      const queue = useAgentStore.getState().messageQueue;
      expect(queue[0]?.content).toBe("original");
    });
  });

  describe("scroll positions", () => {
    it("saves and retrieves scroll position", () => {
      const store = useAgentStore.getState();
      store.saveScrollPosition("s1", 250);

      expect(store.getScrollPosition("s1")).toBe(250);
    });

    it("returns 0 for unknown session", () => {
      expect(useAgentStore.getState().getScrollPosition("unknown")).toBe(0);
    });

    it("overwrites previous scroll position", () => {
      const store = useAgentStore.getState();
      store.saveScrollPosition("s1", 100);
      store.saveScrollPosition("s1", 500);

      expect(useAgentStore.getState().getScrollPosition("s1")).toBe(500);
    });
  });

  describe("loading and error", () => {
    it("sets and clears loading state", () => {
      const store = useAgentStore.getState();
      store.setLoading(true);
      expect(useAgentStore.getState().loading).toBe(true);

      store.setLoading(false);
      expect(useAgentStore.getState().loading).toBe(false);
    });

    it("sets and clears error", () => {
      const store = useAgentStore.getState();
      store.setError("Something broke");
      expect(useAgentStore.getState().error).toBe("Something broke");

      store.setError(null);
      expect(useAgentStore.getState().error).toBeNull();
    });
  });

  describe("clearSessionData", () => {
    it("removes session, messages, scroll, and queue", () => {
      const session = createMockSession();
      const msg = createMockMessage({ sessionId: session.id });
      const store = useAgentStore.getState();

      store.setSession(session);
      store.addMessage(session.id, msg);
      store.saveScrollPosition(session.id, 100);
      store.queueMessage(session.id, "queued");

      useAgentStore.getState().clearSessionData(session.id);

      const state = useAgentStore.getState();
      expect(state.sessions.has(session.id)).toBe(false);
      expect(state.messagesBySession.has(session.id)).toBe(false);
      expect(state.scrollPositionBySession.has(session.id)).toBe(false);
      expect(
        state.messageQueue.some((m) => m.sessionId === session.id),
      ).toBe(false);
    });

    it("clears activeSessionId if it matches the deleted session", () => {
      const session = createMockSession();
      const store = useAgentStore.getState();

      store.setSession(session);
      store.switchSession(session.id);
      store.clearSessionData(session.id);

      expect(useAgentStore.getState().activeSessionId).toBeNull();
    });

    it("preserves activeSessionId if it does not match", () => {
      const session = createMockSession();
      const store = useAgentStore.getState();

      store.setSession(session);
      store.switchSession("other-session");
      store.clearSessionData(session.id);

      expect(useAgentStore.getState().activeSessionId).toBe("other-session");
    });

    it("preserves queue for other sessions", () => {
      const store = useAgentStore.getState();
      store.queueMessage("s1", "for s1");
      store.queueMessage("s2", "for s2");

      store.clearSessionData("s1");

      const queue = useAgentStore.getState().messageQueue;
      expect(queue).toHaveLength(1);
      expect(queue[0]?.sessionId).toBe("s2");
    });
  });

  describe("parallelism — multiple concurrent sessions", () => {
    it("manages 5 concurrent sessions independently", () => {
      const store = useAgentStore.getState();
      const sessions = Array.from({ length: 5 }, (_, i) =>
        createMockSession({ prompt: `Agent ${i}` }),
      );

      for (const s of sessions) {
        store.setSession(s);
      }

      expect(useAgentStore.getState().sessions.size).toBe(5);

      // Update one session without affecting others
      const target = sessions[2];
      const first = sessions[0];
      if (!target || !first) throw new Error("test setup failed");
      store.updateSessionStatus(target.id, "completed");

      const s0 = useAgentStore.getState().sessions.get(first.id);
      const s2 = useAgentStore.getState().sessions.get(target.id);
      expect(s0?.status).toBe("running");
      expect(s2?.status).toBe("completed");
    });

    it("isolates messages across concurrent sessions", () => {
      const store = useAgentStore.getState();
      const ids = ["s1", "s2", "s3", "s4", "s5"];

      for (const id of ids) {
        for (let j = 0; j < 3; j++) {
          store.addMessage(
            id,
            createMockMessage({ sessionId: id, content: `msg-${j}` }),
          );
        }
      }

      for (const id of ids) {
        const msgs = useAgentStore.getState().messagesBySession.get(id);
        expect(msgs).toHaveLength(3);
      }
    });
  });
});
