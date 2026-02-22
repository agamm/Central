import { create } from "zustand";
import * as agentApi from "../api";
import { debugLog } from "@/shared/debugLog";
import { useSessionStore } from "./sessionStore";
import type { ChatMessage, QueuedMessage } from "../types";

interface MessageState {
  readonly messagesBySession: ReadonlyMap<string, readonly ChatMessage[]>;
  readonly messageQueue: readonly QueuedMessage[];
  readonly streamingMessages: ReadonlyMap<string, ChatMessage>;
  readonly bufferedToolCalls: ReadonlyMap<string, string>;
}

interface MessageActions {
  readonly addMessage: (sessionId: string, message: ChatMessage) => void;
  readonly setMessages: (sessionId: string, messages: readonly ChatMessage[]) => void;
  readonly queueMessage: (sessionId: string, content: string) => QueuedMessage;
  readonly dequeueMessage: (sessionId: string) => QueuedMessage | undefined;
  readonly cancelQueuedMessage: (messageId: string) => void;
  readonly editQueuedMessage: (messageId: string, content: string) => void;
  readonly appendStreamingContent: (sessionId: string, delta: string) => void;
  readonly appendStreamingThinking: (sessionId: string, delta: string) => void;
  readonly setStreamingToolCalls: (sessionId: string, toolCallsJson: string) => void;
  readonly finalizeStreamingMessage: (sessionId: string, finalMsg: ChatMessage) => void;
  readonly clearStreamingMessage: (sessionId: string) => void;
  readonly bufferToolCalls: (sessionId: string, toolCallsJson: string) => void;
  readonly mergeAndDrainBufferedToolCalls: (sessionId: string, toolCallsJson: string | null) => string | null;
  readonly flushBufferedToolCalls: (sessionId: string) => void;
  readonly clearMessages: (sessionId: string) => void;
  readonly hydrateMessages: (sessionId: string) => Promise<void>;
}

type MessageStore = MessageState & MessageActions;

const persistError = (op: string, e: unknown): void => {
  debugLog("STORE", `Persist failed [${op}]: ${String(e)}`);
};

function makeStreamingMessage(sessionId: string, overrides: Partial<ChatMessage>): ChatMessage {
  return {
    id: `streaming-${sessionId}`,
    sessionId,
    role: "assistant",
    content: null,
    thinking: null,
    toolCalls: null,
    usage: null,
    timestamp: new Date().toISOString(),
    isStreaming: true,
    ...overrides,
  };
}

const useMessageStore = create<MessageStore>()((set, get) => ({
  messagesBySession: new Map(),
  messageQueue: [],
  streamingMessages: new Map(),
  bufferedToolCalls: new Map(),

  addMessage: (sessionId, message) => {
    const msgMap = new Map(get().messagesBySession);
    const existing = msgMap.get(sessionId) ?? [];
    msgMap.set(sessionId, [...existing, message]);
    set({ messagesBySession: msgMap });

    if (useSessionStore.getState().sessions.has(sessionId)) {
      agentApi
        .addMessage(sessionId, message.role, message.content, message.thinking, message.toolCalls, message.usage)
        .catch((e: unknown) => { persistError("addMessage", e); });
    }
  },

  setMessages: (sessionId, messages) => {
    const msgMap = new Map(get().messagesBySession);
    msgMap.set(sessionId, messages);
    set({ messagesBySession: msgMap });
  },

  queueMessage: (sessionId, content) => {
    const queued: QueuedMessage = {
      id: crypto.randomUUID(),
      sessionId,
      content,
      createdAt: new Date().toISOString(),
    };
    set({ messageQueue: [...get().messageQueue, queued] });
    return queued;
  },

  dequeueMessage: (sessionId) => {
    const queue = get().messageQueue;
    const idx = queue.findIndex((m) => m.sessionId === sessionId);
    if (idx === -1) return undefined;
    const message = queue[idx];
    set({ messageQueue: [...queue.slice(0, idx), ...queue.slice(idx + 1)] });
    return message;
  },

  cancelQueuedMessage: (messageId) => {
    set({ messageQueue: get().messageQueue.filter((m) => m.id !== messageId) });
  },

  editQueuedMessage: (messageId, content) => {
    set({
      messageQueue: get().messageQueue.map((m) =>
        m.id === messageId ? { ...m, content } : m,
      ),
    });
  },

  appendStreamingContent: (sessionId, delta) => {
    const streamMap = new Map(get().streamingMessages);
    const existing = streamMap.get(sessionId);
    if (existing) {
      streamMap.set(sessionId, { ...existing, content: (existing.content ?? "") + delta });
    } else {
      streamMap.set(sessionId, makeStreamingMessage(sessionId, { content: delta }));
    }
    set({ streamingMessages: streamMap });
  },

  appendStreamingThinking: (sessionId, delta) => {
    const streamMap = new Map(get().streamingMessages);
    const existing = streamMap.get(sessionId);
    if (existing) {
      streamMap.set(sessionId, { ...existing, thinking: (existing.thinking ?? "") + delta });
    } else {
      streamMap.set(sessionId, makeStreamingMessage(sessionId, { thinking: delta }));
    }
    set({ streamingMessages: streamMap });
  },

  setStreamingToolCalls: (sessionId, toolCallsJson) => {
    const streamMap = new Map(get().streamingMessages);
    const existing = streamMap.get(sessionId);
    if (existing) {
      streamMap.set(sessionId, { ...existing, toolCalls: toolCallsJson });
    } else {
      streamMap.set(sessionId, makeStreamingMessage(sessionId, { toolCalls: toolCallsJson }));
    }
    set({ streamingMessages: streamMap });
  },

  finalizeStreamingMessage: (sessionId, finalMsg) => {
    const streamMap = new Map(get().streamingMessages);
    streamMap.delete(sessionId);

    const msgMap = new Map(get().messagesBySession);
    const existing = msgMap.get(sessionId) ?? [];
    msgMap.set(sessionId, [...existing, finalMsg]);

    set({ streamingMessages: streamMap, messagesBySession: msgMap });

    if (useSessionStore.getState().sessions.has(sessionId)) {
      agentApi
        .addMessage(sessionId, finalMsg.role, finalMsg.content, finalMsg.thinking, finalMsg.toolCalls, finalMsg.usage)
        .catch((e: unknown) => { persistError("addMessage", e); });
    }
  },

  clearStreamingMessage: (sessionId) => {
    const streamMap = new Map(get().streamingMessages);
    streamMap.delete(sessionId);
    set({ streamingMessages: streamMap });
  },

  bufferToolCalls: (sessionId, toolCallsJson) => {
    const bufMap = new Map(get().bufferedToolCalls);
    const existing = bufMap.get(sessionId);
    if (existing) {
      const merged = [...JSON.parse(existing) as unknown[], ...JSON.parse(toolCallsJson) as unknown[]];
      bufMap.set(sessionId, JSON.stringify(merged));
    } else {
      bufMap.set(sessionId, toolCallsJson);
    }
    set({ bufferedToolCalls: bufMap });
  },

  mergeAndDrainBufferedToolCalls: (sessionId, toolCallsJson) => {
    const bufMap = new Map(get().bufferedToolCalls);
    const buffered = bufMap.get(sessionId);
    if (!buffered) return toolCallsJson;

    bufMap.delete(sessionId);
    set({ bufferedToolCalls: bufMap });

    const allToolCalls = [...JSON.parse(buffered) as unknown[]];
    if (toolCallsJson) {
      allToolCalls.push(...JSON.parse(toolCallsJson) as unknown[]);
    }
    return JSON.stringify(allToolCalls);
  },

  flushBufferedToolCalls: (sessionId) => {
    const bufMap = new Map(get().bufferedToolCalls);
    const buffered = bufMap.get(sessionId);
    if (!buffered) return;

    bufMap.delete(sessionId);
    set({ bufferedToolCalls: bufMap });

    get().addMessage(sessionId, {
      id: crypto.randomUUID(),
      sessionId,
      role: "assistant",
      content: "",
      thinking: null,
      toolCalls: buffered,
      usage: null,
      timestamp: new Date().toISOString(),
    });
  },

  clearMessages: (sessionId) => {
    const msgMap = new Map(get().messagesBySession);
    msgMap.delete(sessionId);

    const streamMap = new Map(get().streamingMessages);
    streamMap.delete(sessionId);

    const bufMap = new Map(get().bufferedToolCalls);
    bufMap.delete(sessionId);

    const queue = get().messageQueue.filter((m) => m.sessionId !== sessionId);

    set({ messagesBySession: msgMap, streamingMessages: streamMap, bufferedToolCalls: bufMap, messageQueue: queue });
  },

  hydrateMessages: async (sessionId) => {
    const result = await agentApi.getMessages(sessionId);
    if (result.isOk()) {
      const chatMessages = result.value.map((m) => ({
        ...m,
        isStreaming: false as const,
      }));
      const msgMap = new Map(get().messagesBySession);
      msgMap.set(sessionId, chatMessages);
      set({ messagesBySession: msgMap });
    }
  },
}));

export { useMessageStore };
export type { MessageStore, MessageState, MessageActions };
