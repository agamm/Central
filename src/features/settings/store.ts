import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";

interface SettingsState {
  readonly showSettings: boolean;
  readonly openRouterKey: string;
  readonly openRouterKeyValid: boolean | null;
  readonly loading: boolean;
  readonly error: string | null;
}

interface SettingsActions {
  readonly toggleSettings: () => void;
  readonly setShowSettings: (show: boolean) => void;
  readonly loadSettings: () => Promise<void>;
  readonly saveOpenRouterKey: (key: string) => Promise<void>;
  readonly validateOpenRouterKey: (key: string) => Promise<boolean>;
}

type SettingsStore = SettingsState & SettingsActions;

const OPENROUTER_KEY = "openrouter_key";
const OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models";

async function fetchSetting(key: string): Promise<string | null> {
  return invoke<string | null>("get_setting", { key });
}

async function storeSetting(key: string, value: string): Promise<void> {
  return invoke("set_setting", { key, value });
}

async function checkOpenRouterKey(key: string): Promise<boolean> {
  try {
    const response = await fetch(OPENROUTER_MODELS_URL, {
      method: "GET",
      headers: { Authorization: `Bearer ${key}` },
    });
    return response.ok;
  } catch {
    return false;
  }
}

const useSettingsStore = create<SettingsStore>()((set, get) => ({
  showSettings: false,
  openRouterKey: "",
  openRouterKeyValid: null,
  loading: false,
  error: null,

  toggleSettings: () => {
    set((state) => ({ showSettings: !state.showSettings }));
  },

  setShowSettings: (show: boolean) => {
    set({ showSettings: show });
  },

  loadSettings: async () => {
    set({ loading: true, error: null });
    try {
      const key = await fetchSetting(OPENROUTER_KEY);
      set({
        openRouterKey: key ?? "",
        loading: false,
      });

      // Validate existing key if present
      if (key) {
        const valid = await checkOpenRouterKey(key);
        set({ openRouterKeyValid: valid });
      }
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  saveOpenRouterKey: async (key: string) => {
    set({ loading: true, error: null });
    try {
      await storeSetting(OPENROUTER_KEY, key);
      set({ openRouterKey: key });

      const valid = await get().validateOpenRouterKey(key);
      set({ loading: false });

      if (valid) {
        set({ showSettings: false });
      }
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  validateOpenRouterKey: async (key: string) => {
    set({ openRouterKeyValid: null });
    const valid = await checkOpenRouterKey(key);
    set({ openRouterKeyValid: valid });
    return valid;
  },
}));

export { useSettingsStore };
export type { SettingsStore, SettingsState, SettingsActions };
