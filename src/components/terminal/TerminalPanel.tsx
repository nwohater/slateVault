"use client";

import { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { listen } from "@tauri-apps/api/event";
import { useVaultStore } from "@/stores/vaultStore";
import * as commands from "@/lib/commands";

import "@xterm/xterm/css/xterm.css";

export function TerminalPanel() {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const spawnedRef = useRef(false);
  const vaultPath = useVaultStore((s) => s.vaultPath);

  useEffect(() => {
    if (!containerRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily:
        "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace",
      theme: {
        background: "#0a0a0a",
        foreground: "#d4d4d4",
        cursor: "#d4d4d4",
        selectionBackground: "#264f78",
        black: "#0a0a0a",
        red: "#f87171",
        green: "#4ade80",
        yellow: "#facc15",
        blue: "#60a5fa",
        magenta: "#c084fc",
        cyan: "#22d3ee",
        white: "#d4d4d4",
        brightBlack: "#525252",
        brightRed: "#fca5a5",
        brightGreen: "#86efac",
        brightYellow: "#fde68a",
        brightBlue: "#93c5fd",
        brightMagenta: "#d8b4fe",
        brightCyan: "#67e8f9",
        brightWhite: "#fafafa",
      },
    });

    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(containerRef.current);
    fit.fit();

    termRef.current = term;
    fitRef.current = fit;

    // Send user input to PTY
    term.onData((data) => {
      commands.writeTerminal(data).catch(() => {});
    });

    // Listen for PTY output
    const unlisten = listen<string>("terminal:output", (event) => {
      term.write(event.payload);
    });

    // Spawn terminal if we have a vault path
    if (vaultPath && !spawnedRef.current) {
      spawnedRef.current = true;
      commands.spawnTerminal(vaultPath).then(() => {
        fit.fit();
        const dims = fit.proposeDimensions();
        if (dims) {
          commands.resizeTerminal(dims.rows, dims.cols).catch(() => {});
        }
      }).catch((e) => {
        term.write(`\r\nFailed to spawn terminal: ${e}\r\n`);
      });
    }

    // Resize observer
    const observer = new ResizeObserver(() => {
      try {
        fit.fit();
        const dims = fit.proposeDimensions();
        if (dims) {
          commands.resizeTerminal(dims.rows, dims.cols).catch(() => {});
        }
      } catch {
        // ignore resize errors during teardown
      }
    });
    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
      unlisten.then((fn) => fn());
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={containerRef}
      className="h-full w-full"
      style={{ padding: "4px 0 0 4px" }}
    />
  );
}
