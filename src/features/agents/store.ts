/**
 * Backward-compat shim: combines sessionStore, messageStore, uiStore
 * into a single useAgentStore hook. Existing consumers keep working.
 * New code should import from "./stores" directly.
 */
import { createStore, useStore } from "zustand";
import { useSessionStore } from "./stores/sessionStore";
import { useMessageStore } from "./stores/messageStore";
import { useUIStore } from "./stores/uiStore";
import { clearSessionData, deleteSession } from "./stores/actions";

function buildCombined() {
  return {
    ...useSessionStore.getState(),
    ...useMessageStore.getState(),
    ...useUIStore.getState(),
    clearSessionData,
    deleteSession,
  };
}

type CombinedState = ReturnType<typeof buildCombined>;

const combinedStore = createStore<CombinedState>()(() => buildCombined());

useSessionStore.subscribe(() => { combinedStore.setState(buildCombined()); });
useMessageStore.subscribe(() => { combinedStore.setState(buildCombined()); });
useUIStore.subscribe(() => { combinedStore.setState(buildCombined()); });

function useAgentStore<T>(selector: (state: CombinedState) => T): T {
  return useStore(combinedStore, selector);
}

useAgentStore.getState = () => combinedStore.getState();

export { useAgentStore };
export type { CombinedState as AgentState };
export {
  useSessionStore,
  useMessageStore,
  useUIStore,
  clearSessionData,
  deleteSession,
} from "./stores";
