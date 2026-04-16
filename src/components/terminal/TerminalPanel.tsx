"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { listen } from "@tauri-apps/api/event";
import { useVaultStore } from "@/stores/vaultStore";
import { useUIStore } from "@/stores/uiStore";
import * as commands from "@/lib/commands";

interface TerminalTab {
  id: string;
  label: string;
  cwd: string | null;
}

interface TerminalOutput {
  terminal_id: string;
  data: string;
}

function createTab(number: number, cwd: string | null = null): TerminalTab {
  return {
    id: `terminal-${number}`,
    label: `Terminal ${number}`,
    cwd,
  };
}

function TerminalInstance({
  id,
  active,
  cwd,
  onRegister,
}: {
  id: string;
  active: boolean;
  cwd: string | null;
  onRegister: (id: string, term: Terminal | null) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const vaultPath = useVaultStore((s) => s.vaultPath);
  const showTerminal = useUIStore((s) => s.showTerminal);
  const activeRef = useRef(active);
  const showTerminalRef = useRef(showTerminal);
  activeRef.current = active;
  showTerminalRef.current = showTerminal;

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

    termRef.current = term;
    fitRef.current = fit;

    onRegister(id, term);

    term.onData((data) => {
      commands.writeTerminal(id, data).catch(() => {});
    });

    // Defer initial fit so WKWebView layout has settled before measuring
    requestAnimationFrame(() => {
      try {
        fit.fit();
      } catch {
        // ignore if disposed before frame fires
      }
    });

    const startPath = cwd ?? vaultPath;
    if (startPath) {
      commands
        .spawnTerminalSession(id, startPath)
        .then(() => {
          fit.fit();
          const dims = fit.proposeDimensions();
          if (dims) {
            commands.resizeTerminal(id, dims.rows, dims.cols).catch(() => {});
          }
        })
        .catch((e) => {
          term.write(`\r\nFailed to spawn terminal: ${e}\r\n`);
        });
    }

    const observer = new ResizeObserver(() => {
      if (!activeRef.current || !showTerminalRef.current) return;
      try {
        fit.fit();
        const dims = fit.proposeDimensions();
        if (dims) {
          commands.resizeTerminal(id, dims.rows, dims.cols).catch(() => {});
        }
      } catch {
        // ignore resize errors during teardown
      }
    });
    observer.observe(containerRef.current);

    return () => {
      onRegister(id, null);
      observer.disconnect();
      commands.closeTerminal(id).catch(() => {});
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!active || !showTerminal || !fitRef.current) return;
    requestAnimationFrame(() => {
      try {
        fitRef.current?.fit();
        const dims = fitRef.current?.proposeDimensions();
        if (dims) {
          commands.resizeTerminal(id, dims.rows, dims.cols).catch(() => {});
        }
        termRef.current?.focus();
      } catch {
        // ignore fit errors while hidden
      }
    });
  }, [active, id, showTerminal]);

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 h-full w-full transition-opacity ${
        active
          ? "z-10 opacity-100"
          : "pointer-events-none z-0 opacity-0"
      }`}
      style={{
        padding: "4px 0 0 4px",
        visibility: active ? "visible" : "hidden",
      }}
    />
  );
}

export function TerminalPanel() {
  const nextTerminalNumberRef = useRef(2);
  const [tabs, setTabs] = useState<TerminalTab[]>([]);
  const [activeId, setActiveId] = useState("terminal-1");
  const termMapRef = useRef<Map<string, Terminal>>(new Map());

  const projects = useVaultStore((s) => s.projects);
  const toggleTerminal = useUIStore((s) => s.toggleTerminal);
  const [selectedProject, setSelectedProject] = useState<string>("");
  // undefined = not yet loaded; null = loaded but none set; string = loaded with value
  const [workFolder, setWorkFolder] = useState<string | null | undefined>(undefined);

  // Initialize selectedProject once projects load
  useEffect(() => {
    if (projects.length > 0 && !selectedProject) {
      setSelectedProject(projects[0].name);
    }
  }, [projects, selectedProject]);

  // Load work folder when selected project changes
  useEffect(() => {
    if (!selectedProject) {
      setWorkFolder(projects.length === 0 ? null : undefined);
      return;
    }
    setWorkFolder(undefined);
    commands.getProjectSourceFolder(selectedProject).then((folder) => {
      setWorkFolder(folder);
    }).catch(() => {
      setWorkFolder(null);
    });
  }, [selectedProject, projects.length]);

  // Defer first tab creation until work folder is known so it gets the right cwd
  useEffect(() => {
    if (tabs.length > 0) return;
    if (workFolder === undefined) return; // still loading
    const tab = createTab(1, workFolder);
    setTabs([tab]);
    setActiveId(tab.id);
  }, [workFolder, tabs.length]);

  // Single shared listener for all terminal instances — avoids Tauri listener
  // corruption that occurs when multiple instances register/unregister the same
  // event concurrently (especially under React StrictMode double-mount).
  useEffect(() => {
    let cancelled = false;
    let unlistenFn: (() => void) | null = null;

    listen<TerminalOutput>("terminal:output", (event) => {
      termMapRef.current.get(event.payload.terminal_id)?.write(event.payload.data);
    }).then((fn) => {
      if (cancelled) fn();
      else unlistenFn = fn;
    });

    return () => {
      cancelled = true;
      unlistenFn?.();
    };
  }, []);

  const handleRegister = useCallback((id: string, term: Terminal | null) => {
    if (term) termMapRef.current.set(id, term);
    else termMapRef.current.delete(id);
  }, []);

  const handleNewTerminal = async () => {
    // Always fetch fresh — user may have set a work folder after the panel mounted
    const folder = selectedProject
      ? await commands.getProjectSourceFolder(selectedProject).catch(() => null)
      : null;
    const tab = createTab(nextTerminalNumberRef.current, folder);
    nextTerminalNumberRef.current += 1;
    setTabs((current) => [...current, tab]);
    setActiveId(tab.id);
  };

  const handleCloseTerminal = (id: string) => {
    if (tabs.length <= 1) {
      toggleTerminal();
      return;
    }
    const index = tabs.findIndex((tab) => tab.id === id);
    const nextTabs = tabs.filter((tab) => tab.id !== id);
    setTabs(nextTabs);

    if (activeId === id) {
      const nextActive = nextTabs[Math.max(0, index - 1)] ?? nextTabs[0];
      setActiveId(nextActive.id);
    }
  };

  const workFolderBasename = workFolder
    ? workFolder.split("/").pop() || workFolder
    : null;

  return (
    <div className="flex h-full flex-col bg-neutral-950">
      <div className="flex h-8 flex-shrink-0 items-center gap-1 border-b border-neutral-800 bg-neutral-900/80 px-2">
        <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveId(tab.id)}
              className={`group flex h-6 max-w-36 items-center gap-2 rounded-lg border px-2 text-[11px] transition-colors ${
                activeId === tab.id
                  ? "border-cyan-900/50 bg-cyan-950/30 text-cyan-200"
                  : "border-transparent text-neutral-500 hover:bg-neutral-800 hover:text-neutral-300"
              }`}
              title={tab.label}
            >
              <span className="truncate">{tab.label}</span>
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  handleCloseTerminal(tab.id);
                }}
                className="rounded px-1 text-neutral-600 hover:bg-neutral-700 hover:text-neutral-200"
                title={tabs.length === 1 ? "Close terminal" : `Close ${tab.label}`}
              >
                x
              </span>
            </button>
          ))}
        </div>
        <div className="flex flex-shrink-0 items-center gap-1.5">
          {projects.length > 0 && (
            <>
              <select
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
                className="bg-neutral-900 border border-neutral-800 text-neutral-400 text-[10px] rounded px-1 py-0.5 outline-none"
                title="Project for new terminals"
              >
                {projects.map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.name}
                  </option>
                ))}
              </select>
              {workFolderBasename && (
                <span className="text-[10px] text-neutral-600 truncate max-w-24" title={workFolder ?? ""}>
                  {workFolderBasename}
                </span>
              )}
            </>
          )}
          <button
            onClick={handleNewTerminal}
            className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200"
            title="New terminal"
          >
            +
          </button>
        </div>
      </div>
      <div className="relative min-h-0 flex-1">
        {tabs.map((tab) => (
          <TerminalInstance
            key={tab.id}
            id={tab.id}
            active={activeId === tab.id}
            cwd={tab.cwd}
            onRegister={handleRegister}
          />
        ))}
      </div>
    </div>
  );
}
