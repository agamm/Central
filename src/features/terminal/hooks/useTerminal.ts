import { useEffect, useRef, useCallback } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { WebglAddon } from "@xterm/addon-webgl";
import { terminalTheme } from "../theme";
import { useTerminalStore, buildPtyId } from "../store";
import type { PtyOutput, PtyExit } from "../types";

interface UseTerminalOptions {
  readonly projectId: string;
  readonly cwd: string;
}

interface UseTerminalResult {
  readonly containerRef: React.RefObject<HTMLDivElement | null>;
}

/** Hook that manages xterm.js lifecycle for a project terminal */
function useTerminal({ projectId, cwd }: UseTerminalOptions): UseTerminalResult {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const resizeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const spawn = useTerminalStore((s) => s.spawn);
  const write = useTerminalStore((s) => s.write);
  const resize = useTerminalStore((s) => s.resize);
  const markExited = useTerminalStore((s) => s.markExited);

  const ptyId = buildPtyId(projectId);

  const handleResize = useCallback(() => {
    if (resizeTimerRef.current) clearTimeout(resizeTimerRef.current);
    resizeTimerRef.current = setTimeout(() => {
      const fitAddon = fitAddonRef.current;
      const term = termRef.current;
      if (!fitAddon || !term) return;

      fitAddon.fit();
      const dims = fitAddon.proposeDimensions();
      if (dims) {
        void resize(ptyId, dims.rows, dims.cols);
      }
    }, 100);
  }, [ptyId, resize]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const term = createTerminal();
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(new WebLinksAddon());

    term.open(container);
    loadWebglAddon(term);

    termRef.current = term;
    fitAddonRef.current = fitAddon;

    // Wait a frame so container dimensions are resolved before fitting
    requestAnimationFrame(() => {
      fitAddon.fit();
      const dims = fitAddon.proposeDimensions();
      const rows = dims?.rows ?? 24;
      const cols = dims?.cols ?? 80;
      void spawn(projectId, cwd, rows, cols);
    });

    const onDataDisposable = term.onData((data: string) => {
      void write(ptyId, data);
    });

    const observer = new ResizeObserver(() => { handleResize(); });
    observer.observe(container);

    let unlistenOutput: UnlistenFn | undefined;
    let unlistenExit: UnlistenFn | undefined;

    void setupListeners(term, ptyId, markExited).then(([uo, ue]) => {
      unlistenOutput = uo;
      unlistenExit = ue;
    });

    return () => {
      onDataDisposable.dispose();
      observer.disconnect();
      if (resizeTimerRef.current) clearTimeout(resizeTimerRef.current);
      unlistenOutput?.();
      unlistenExit?.();
      term.dispose();
      termRef.current = null;
      fitAddonRef.current = null;
    };
  }, [projectId, cwd, ptyId, spawn, write, resize, markExited, handleResize]);

  return { containerRef };
}

function createTerminal(): Terminal {
  return new Terminal({
    theme: terminalTheme,
    fontFamily:
      "'JetBrains Mono', ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace",
    fontSize: 12,
    lineHeight: 1.3,
    cursorBlink: true,
    cursorStyle: "bar",
    scrollback: 5000,
    allowTransparency: true,
  });
}

function loadWebglAddon(term: Terminal): void {
  try {
    term.loadAddon(new WebglAddon());
  } catch {
    // WebGL not supported — falls back to canvas renderer
  }
}

async function setupListeners(
  term: Terminal,
  ptyId: string,
  markExited: (id: string, code: number | null) => void,
): Promise<[UnlistenFn, UnlistenFn]> {
  const unlistenOutput = await listen<PtyOutput>("pty-output", (event) => {
    if (event.payload.pty_id === ptyId) {
      term.write(event.payload.data);
    }
  });

  const unlistenExit = await listen<PtyExit>("pty-exit", (event) => {
    if (event.payload.pty_id === ptyId) {
      markExited(ptyId, event.payload.code);
    }
  });

  return [unlistenOutput, unlistenExit];
}

export { useTerminal };
export type { UseTerminalOptions, UseTerminalResult };
