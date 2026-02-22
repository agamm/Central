import * as agentApi from "../api";
import { debugLog } from "@/shared/debugLog";
import { useSessionStore } from "./sessionStore";
import { useMessageStore } from "./messageStore";
import { useUIStore } from "./uiStore";

function clearSessionData(sessionId: string): void {
  useSessionStore.getState().clearSession(sessionId);
  useMessageStore.getState().clearMessages(sessionId);
  useUIStore.getState().clearUI(sessionId);
}

function deleteSession(sessionId: string): void {
  clearSessionData(sessionId);
  agentApi.deleteSession(sessionId)
    .catch((e: unknown) => { debugLog("STORE", `Persist failed [deleteSession]: ${String(e)}`); });
}

export { clearSessionData, deleteSession };
