import { useEffect, useRef, useCallback } from "react";
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

interface TerminalPaneProps {
  readonly sessionId: string;
  readonly cwd: string;
}

/** Base64 encode a string for PTY input */
function toBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  const binStr = Array.from(bytes, (b) => String.fromCodePoint(b)).join("");
  return btoa(binStr);
}

/** Decode base64 to Uint8Array for terminal output */
function fromBase64(b64: string): Uint8Array {
  const binStr = atob(b64);
  const bytes = new Uint8Array(binStr.length);
  for (let i = 0; i < binStr.length; i++) {
    bytes[i] = binStr.charCodeAt(i);
  }
  return bytes;
}

function TerminalPane({ sessionId, cwd }: TerminalPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const startedRef = useRef(false);

  const handleEvent = useCallback(
    (event: PtyEvent) => {
      const term = termRef.current;
      if (!term) return;

      switch (event.type) {
        case "Output": {
          const bytes = fromBase64(event.data);
          term.write(bytes);
          break;
        }
        case "Exit":
          term.writeln(`\r\n\x1b[90m[Process exited with code ${event.code}]\x1b[0m`);
          break;
        case "Error":
          term.writeln(`\r\n\x1b[31m[Error: ${event.message}]\x1b[0m`);
          break;
      }
    },
    [],
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container || startedRef.current) return;
    startedRef.current = true;

    const term = new Terminal({
      fontFamily: "'JetBrains Mono', 'SF Mono', Menlo, monospace",
      fontSize: 12,
      lineHeight: 1.4,
      cursorBlink: true,
      cursorStyle: "bar",
      theme: {
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
      },
    });

    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(container);

    termRef.current = term;
    fitRef.current = fit;

    // Initial fit
    requestAnimationFrame(() => {
      fit.fit();
    });

    const { rows, cols } = term;

    // Wire up input: user keystrokes → base64 → PTY
    term.onData((data) => {
      void writeTerminalInput(sessionId, toBase64(data));
    });

    // Start PTY
    void startTerminal(sessionId, cwd, rows, cols, handleEvent);

    // Observe container resizes
    const observer = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        fit.fit();
        void resizeTerminal(sessionId, term.rows, term.cols);
      });
    });
    observer.observe(container);

    return () => {
      observer.disconnect();
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
      void closeTerminal(sessionId);
    };
  }, [sessionId, cwd, handleEvent]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full bg-background"
      style={{ padding: "4px 0 0 4px" }}
    />
  );
}

export { TerminalPane };
