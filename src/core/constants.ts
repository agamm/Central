/** Database name used by tauri-plugin-sql */
const DB_NAME = "sqlite:central.db" as const;

/** Default window dimensions */
const WINDOW_DEFAULTS = {
  width: 1400,
  height: 900,
  minWidth: 900,
  minHeight: 600,
} as const;

/** Animation durations in milliseconds (100-200ms ease-out per design) */
const ANIMATION = {
  fast: 100,
  normal: 150,
  slow: 200,
} as const;

/** Base spacing unit in pixels */
const SPACING_BASE = 4 as const;

/** Default agent session timeout in milliseconds (30 minutes) */
const AGENT_TIMEOUT_MS = 1_800_000 as const;

/** Interval for checking agent timeouts (every 30 seconds) */
const AGENT_TIMEOUT_CHECK_INTERVAL_MS = 30_000 as const;

export {
  DB_NAME,
  WINDOW_DEFAULTS,
  ANIMATION,
  SPACING_BASE,
  AGENT_TIMEOUT_MS,
  AGENT_TIMEOUT_CHECK_INTERVAL_MS,
};
