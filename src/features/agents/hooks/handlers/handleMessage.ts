import { useSessionStore } from "../../stores/sessionStore";
import { useMessageStore } from "../../stores/messageStore";
import { debugLog } from "@/shared/debugLog";
import type { SidecarEvent, ChatMessage } from "../../types";

function handleMessageEvent(
  event: Extract<SidecarEvent, { type: "message" }>,
): void {
  const msgStore = useMessageStore.getState();
  const toolCallsJson = event.toolCalls ? JSON.stringify(event.toolCalls) : null;
  const usageJson = event.usage ? JSON.stringify(event.usage) : null;

  if (!event.content && !event.thinking && toolCallsJson) {
    msgStore.bufferToolCalls(event.sessionId, toolCallsJson);
    const allBuffered = useMessageStore.getState().bufferedToolCalls.get(event.sessionId);
    if (allBuffered) {
      msgStore.setStreamingToolCalls(event.sessionId, allBuffered);
    }
    accumulateTokens(event);
    return;
  }

  const mergedToolCallsJson = msgStore.mergeAndDrainBufferedToolCalls(event.sessionId, toolCallsJson);

  const msg: ChatMessage = {
    id: crypto.randomUUID(),
    sessionId: event.sessionId,
    role: event.role as "assistant" | "user" | "system",
    content: event.content,
    thinking: event.thinking ?? null,
    toolCalls: mergedToolCallsJson,
    usage: usageJson,
    timestamp: new Date().toISOString(),
  };

  msgStore.clearStreamingMessage(event.sessionId);

  debugLog("REACT-EVENT", `addMessage: sid=${event.sessionId} content_len=${event.content.length}`);
  msgStore.addMessage(event.sessionId, msg);
  accumulateTokens(event);
}

function accumulateTokens(
  event: Extract<SidecarEvent, { type: "message" }>,
): void {
  if (!event.usage) return;
  const usage = event.usage as { inputTokens?: number; outputTokens?: number };
  if (typeof usage.inputTokens === "number" || typeof usage.outputTokens === "number") {
    useSessionStore.getState().updateSessionTokens(
      event.sessionId,
      usage.inputTokens ?? 0,
      usage.outputTokens ?? 0,
    );
  }
}

export { handleMessageEvent };
