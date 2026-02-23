import { create } from "zustand";

interface RateLimitInfo {
  readonly status: string;
  readonly resetsAt: number;
  readonly rateLimitType: string;
}

interface UsageState {
  readonly rateLimitStatus: RateLimitInfo | null;
}

interface UsageActions {
  readonly setRateLimitStatus: (info: RateLimitInfo) => void;
}

type UsageStore = UsageState & UsageActions;

const useUsageStore = create<UsageStore>()((set) => ({
  rateLimitStatus: null,

  setRateLimitStatus: (info) => {
    set({ rateLimitStatus: info });
  },
}));

export { useUsageStore };
export type { RateLimitInfo };
