"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";
import { useVaultStore } from "@/stores/vaultStore";
import { useUIStore } from "@/stores/uiStore";
import type { Theme } from "@/stores/uiStore";
import { useEditorStore } from "@/stores/editorStore";
import { Sidebar } from "./sidebar/Sidebar";
import { EditorPane } from "./editor/EditorPane";
import { MarkdownPreview } from "./preview/MarkdownPreview";
import { SearchView } from "./search/SearchView";
import { VaultPicker } from "./vault/VaultPicker";
import { ResizeHandle } from "./shared/ResizeHandle";
import { StatusBar } from "./StatusBar";
import { Onboarding } from "./Onboarding";

const TerminalPanel = dynamic(
  () =>
    import("./terminal/TerminalPanel").then((mod) => ({
      default: mod.TerminalPanel,
    })),
  { ssr: false }
);

export function AppShell() {
  const isOpen = useVaultStore((s) => s.isOpen);
  const sidebarWidth = useUIStore((s) => s.sidebarWidth);
  const showEditor = useUIStore((s) => s.showEditor);
  const showPreview = useUIStore((s) => s.showPreview);
  const previewRatio = useUIStore((s) => s.previewRatio);
  const activeView = useUIStore((s) => s.activeView);
  const showTerminal = useUIStore((s) => s.showTerminal);
  const terminalHeight = useUIStore((s) => s.terminalHeight);
  const setSidebarWidth = useUIStore((s) => s.setSidebarWidth);
  const setPreviewRatio = useUIStore((s) => s.setPreviewRatio);
  const toggleEditor = useUIStore((s) => s.toggleEditor);
  const togglePreview = useUIStore((s) => s.togglePreview);
  const setActiveView = useUIStore((s) => s.setActiveView);
  const toggleTerminal = useUIStore((s) => s.toggleTerminal);
  const setTerminalHeight = useUIStore((s) => s.setTerminalHeight);
  const setTheme = useUIStore((s) => s.setTheme);
  const projects = useVaultStore((s) => s.projects);
  const isDirty = useEditorStore((s) => s.isDirty);
  const saveDocument = useEditorStore((s) => s.saveDocument);

  // Restore theme from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("sv-theme") as Theme | null;
    if (saved && saved !== "dark") setTheme(saved);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === "F") {
        e.preventDefault();
        setActiveView(activeView === "search" ? "editor" : "search");
      }
      if (e.ctrlKey && e.key === "t") {
        e.preventDefault();
        toggleTerminal();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [activeView, setActiveView, toggleTerminal]);

  if (!isOpen) {
    return <VaultPicker />;
  }

  const editorFlex = showEditor ? (showPreview ? previewRatio : 1) : 0;
  const previewFlex = showPreview ? (showEditor ? 1 - previewRatio : 1) : 0;

  return (
    <div className="flex h-screen overflow-hidden bg-neutral-950">
      {/* Sidebar */}
      <div style={{ width: sidebarWidth }} className="flex-shrink-0">
        <Sidebar />
      </div>

      <ResizeHandle
        direction="vertical"
        onResize={(delta) => setSidebarWidth((w) => w + delta)}
      />

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Toolbar */}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-neutral-900 border-b border-neutral-800 text-xs">
          <button
            onClick={() =>
              setActiveView(activeView === "search" ? "editor" : "search")
            }
            className={`px-2 py-0.5 rounded transition-colors ${
              activeView === "search"
                ? "bg-blue-700 text-white"
                : "bg-neutral-800 hover:bg-neutral-700 text-neutral-300"
            }`}
          >
            Search
          </button>
          {activeView === "editor" && (
            <>
              <button
                onClick={toggleEditor}
                className={`px-2 py-0.5 rounded transition-colors ${
                  showEditor
                    ? "bg-neutral-800 hover:bg-neutral-700 text-neutral-300"
                    : "bg-neutral-700 text-neutral-400"
                }`}
              >
                {showEditor ? "Hide Editor" : "Show Editor"}
              </button>
              <button
                onClick={togglePreview}
                className={`px-2 py-0.5 rounded transition-colors ${
                  showPreview
                    ? "bg-neutral-800 hover:bg-neutral-700 text-neutral-300"
                    : "bg-neutral-700 text-neutral-400"
                }`}
              >
                {showPreview ? "Hide Preview" : "Show Preview"}
              </button>
            </>
          )}
          <button
            onClick={toggleTerminal}
            className={`px-2 py-0.5 rounded transition-colors ${
              showTerminal
                ? "bg-blue-700 text-white"
                : "bg-neutral-800 hover:bg-neutral-700 text-neutral-300"
            }`}
          >
            Terminal
          </button>
          {isDirty && (
            <button
              onClick={saveDocument}
              className="px-2 py-0.5 rounded bg-blue-700 hover:bg-blue-600 text-white"
            >
              Save
            </button>
          )}
          <div className="flex-1" />
          <kbd className="text-neutral-500">Ctrl+T terminal</kbd>
        </div>

        {/* Content + Terminal + StatusBar */}
        <div className="flex-1 flex flex-col min-h-0">
          {/* Main content */}
          <div className="flex-1 flex min-h-0">
            {projects.length === 0 ? (
              <Onboarding />
            ) : activeView === "search" ? (
              <SearchView />
            ) : (
              <>
                {showEditor && (
                  <div style={{ flex: editorFlex }} className="min-w-0">
                    <EditorPane />
                  </div>
                )}

                {showEditor && showPreview && (
                  <ResizeHandle
                    direction="vertical"
                    onResize={(delta) => {
                      const mainWidth =
                        window.innerWidth - sidebarWidth - 4;
                      setPreviewRatio((r) => r + delta / mainWidth);
                    }}
                  />
                )}

                {showPreview && (
                  <div style={{ flex: previewFlex }} className="min-w-0">
                    <MarkdownPreview />
                  </div>
                )}
              </>
            )}
          </div>

          {/* Terminal */}
          {showTerminal && (
            <>
              <div
                onPointerDown={(e) => {
                  e.preventDefault();
                  const startY = e.clientY;
                  const startHeight = terminalHeight;
                  const onMove = (ev: PointerEvent) => {
                    setTerminalHeight(startHeight - (ev.clientY - startY));
                  };
                  const onUp = () => {
                    document.removeEventListener("pointermove", onMove);
                    document.removeEventListener("pointerup", onUp);
                    document.body.style.cursor = "";
                    document.body.style.userSelect = "";
                  };
                  document.addEventListener("pointermove", onMove);
                  document.addEventListener("pointerup", onUp);
                  document.body.style.cursor = "row-resize";
                  document.body.style.userSelect = "none";
                }}
                className="flex-shrink-0 h-1.5 bg-neutral-800 hover:bg-blue-600 cursor-row-resize transition-colors"
              />
              <div
                style={{ height: terminalHeight }}
                className="flex-shrink-0 border-t border-neutral-800"
              >
                <TerminalPanel />
              </div>
            </>
          )}
        </div>

        {/* Status bar */}
        <StatusBar />
      </div>
    </div>
  );
}
