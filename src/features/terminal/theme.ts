import type { ITheme } from "@xterm/xterm";

/**
 * Dark terminal theme matching the app's HSL CSS variables from globals.css.
 * Background: hsl(224, 71%, 4%)  = #060a18
 * Foreground: hsl(213, 31%, 91%) = #dfe5ed
 * Muted:      hsl(223, 47%, 11%) = #0f1629
 * Border:     hsl(216, 34%, 17%) = #1c2a3f
 */
const terminalTheme: ITheme = {
  background: "#060a18",
  foreground: "#dfe5ed",
  cursor: "#dfe5ed",
  cursorAccent: "#060a18",
  selectionBackground: "rgba(223, 229, 237, 0.2)",
  selectionForeground: "#dfe5ed",
  selectionInactiveBackground: "rgba(223, 229, 237, 0.1)",

  // ANSI colors tuned for dark background
  black: "#1c2a3f",
  red: "#f87171",
  green: "#4ade80",
  yellow: "#fbbf24",
  blue: "#60a5fa",
  magenta: "#c084fc",
  cyan: "#22d3ee",
  white: "#dfe5ed",

  // Bright variants
  brightBlack: "#475569",
  brightRed: "#fca5a5",
  brightGreen: "#86efac",
  brightYellow: "#fde68a",
  brightBlue: "#93c5fd",
  brightMagenta: "#d8b4fe",
  brightCyan: "#67e8f9",
  brightWhite: "#f8fafc",
};

export { terminalTheme };
