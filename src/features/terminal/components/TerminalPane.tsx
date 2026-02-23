import { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import {
  startTerminal,
  writeTerminalInput,
  resizeTerminal,
  closeTerminal,
} from "../api";
import type { PtyEvent } from "../api";
import {
  trackTerminalOutput,
  trackTerminalExit,
  cleanupTerminalTracker,
} from "../terminalActivity";

const TERMINAL_THEME = {
  background: "hsl(220, 5%, 5%)",
  foreground: "hsl(220, 5%, 88%)",
  cursor: "hsl(220, 5%, 70%)",
  selectionBackground: "hsla(220, 5%, 40%, 0.3)",
  black: "hsl(220, 5%, 8%)",
  red: "#e06c75",
  green: "#98c379",
  yellow: "#e5c07b",
  blue: "#61afef",
  magenta: "#c678dd",
  cyan: "#56b6c2",
  white: "hsl(220, 5%, 80%)",
  brightBlack: "hsl(220, 5%, 30%)",
  brightRed: "#e06c75",
  brightGreen: "#98c379",
  brightYellow: "#e5c07b",
  brightBlue: "#61afef",
  brightMagenta: "#c678dd",
  brightCyan: "#56b6c2",
  brightWhite: "hsl(220, 5%, 95%)",
} as const;

// Module-level cache — survives StrictMode double-mount.

interface CachedTerminal {
  sessionId: string;
  term: Terminal;
  fit: FitAddon;
}

const terminalCache = new Map<string, CachedTerminal>();

function toBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  const binStr = Array.from(bytes, (b) => String.fromCodePoint(b)).join("");
  return btoa(binStr);
}

function fromBase64(b64: string): Uint8Array {
  const binStr = atob(b64);
  const bytes = new Uint8Array(binStr.length);
  for (let i = 0; i < binStr.length; i++) {
    bytes[i] = binStr.charCodeAt(i);
  }
  return bytes;
}

function handlePtyEvent(entry: CachedTerminal, event: PtyEvent): void {
  switch (event.type) {
    case "Output":
      entry.term.write(fromBase64(event.data));
      trackTerminalOutput(entry.sessionId);
      break;
    case "Exit":
      entry.term.writeln(
        `\r\n\x1b[90m[Process exited with code ${event.code}]\x1b[0m`,
      );
      trackTerminalExit(entry.sessionId);
      break;
    case "Error":
      entry.term.writeln(
        `\r\n\x1b[31m[Error: ${event.message}]\x1b[0m`,
      );
      break;
  }
}

function destroyCachedTerminal(sessionId: string): void {
  const entry = terminalCache.get(sessionId);
  if (entry) {
    entry.term.dispose();
    terminalCache.delete(sessionId);
  }
  cleanupTerminalTracker(sessionId);
  void closeTerminal(sessionId).catch(() => {});
}

interface TerminalPaneProps {
  readonly sessionId: string;
  readonly cwd: string;
}

function TerminalPane({ sessionId, cwd }: TerminalPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // StrictMode: reattach if already created
    const cached = terminalCache.get(sessionId);
    if (cached) {
      if (cached.term.element && !container.contains(cached.term.element)) {
        container.appendChild(cached.term.element);
      }
      requestAnimationFrame(() => {
        cached.fit.fit();
        void resizeTerminal(sessionId, cached.term.rows, cached.term.cols).catch(() => {});
      });

      const observer = new ResizeObserver(() => {
        requestAnimationFrame(() => {
          cached.fit.fit();
          void resizeTerminal(sessionId, cached.term.rows, cached.term.cols).catch(() => {});
        });
      });
      observer.observe(container);
      return () => { observer.disconnect(); };
    }

    // --- First time: create terminal + start PTY ---
    const term = new Terminal({
      fontFamily: "'JetBrains Mono', 'SF Mono', Menlo, monospace",
      fontSize: 12,
      lineHeight: 1.4,
      cursorBlink: true,
      cursorStyle: "bar",
      theme: TERMINAL_THEME,
    });

    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(container);

    const entry: CachedTerminal = { sessionId, term, fit };
    terminalCache.set(sessionId, entry);

    // Keystrokes → PTY
    term.onData((data) => {
      void writeTerminalInput(sessionId, toBase64(data));
    });

    // Fit + start PTY on next frame
    requestAnimationFrame(() => {
      fit.fit();
      void startTerminal(sessionId, cwd, term.rows, term.cols, (event) => {
        handlePtyEvent(entry, event);
      });
    });

    // Resize observer
    const observer = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        fit.fit();
        void resizeTerminal(sessionId, term.rows, term.cols).catch(() => {});
      });
    });
    observer.observe(container);

    return () => { observer.disconnect(); };
  }, [sessionId, cwd]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full bg-background"
      style={{ padding: "4px 0 0 4px" }}
    />
  );
}

export { TerminalPane, destroyCachedTerminal };
