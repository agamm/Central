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

export { DB_NAME, WINDOW_DEFAULTS, ANIMATION, SPACING_BASE };
