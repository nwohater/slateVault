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
import { VaultHome } from "./home/VaultHome";
import { StartSessionView } from "./session/StartSessionView";
import { AgentAccessView } from "./agent/AgentAccessView";
import { DocsHealthView } from "./health/DocsHealthView";
import { SyncView } from "./sync/SyncView";
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
  const workspaceView = useUIStore((s) => s.workspaceView);
  const showOnboarding = useUIStore((s) => s.showOnboarding);
  const showTerminal = useUIStore((s) => s.showTerminal);
  const terminalHeight = useUIStore((s) => s.terminalHeight);
  const setSidebarWidth = useUIStore((s) => s.setSidebarWidth);
  const setPreviewRatio = useUIStore((s) => s.setPreviewRatio);
  const toggleEditor = useUIStore((s) => s.toggleEditor);
  const togglePreview = useUIStore((s) => s.togglePreview);
  const setWorkspaceView = useUIStore((s) => s.setWorkspaceView);
  const setShowOnboarding = useUIStore((s) => s.setShowOnboarding);
  const toggleTerminal = useUIStore((s) => s.toggleTerminal);
  const setTerminalHeight = useUIStore((s) => s.setTerminalHeight);
  const setTheme = useUIStore((s) => s.setTheme);
  const projects = useVaultStore((s) => s.projects);
  const isDirty = useEditorStore((s) => s.isDirty);
  const saveDocument = useEditorStore((s) => s.saveDocument);
  const workspaceLabel =
    workspaceView === "home"
      ? "Vault Home"
      : workspaceView === "documents"
        ? "Documents"
        : workspaceView === "search"
          ? "Search"
          : workspaceView === "start-session"
            ? "Start Session"
            : workspaceView === "agent-access"
              ? "Agent Access"
              : workspaceView === "docs-health"
                ? "Docs Health"
                : workspaceView === "sync"
                  ? "Team Sync"
                  : "Workspace";

  // Restore theme from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("sv-theme") as Theme | null;
    if (saved && saved !== "dark") setTheme(saved);
  }, [setTheme]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === "F") {
        e.preventDefault();
        setWorkspaceView(workspaceView === "search" ? "documents" : "search");
      }
      if (e.ctrlKey && e.key === "t") {
        e.preventDefault();
        toggleTerminal();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [setWorkspaceView, toggleTerminal, workspaceView]);

  useEffect(() => {
    if (isOpen && projects.length === 0) {
      setShowOnboarding(true);
    }
  }, [isOpen, projects.length, setShowOnboarding]);

  if (!isOpen) {
    return <VaultPicker />;
  }

  const editorFlex = showEditor ? (showPreview ? previewRatio : 1) : 0;
  const previewFlex = showPreview ? (showEditor ? 1 - previewRatio : 1) : 0;

  return (
    <div className="app-shell flex h-screen overflow-hidden">
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
        <div className="toolbar-shell flex items-center gap-3 px-4 py-2">
          <div className="min-w-0">
            <div className="workspace-label text-sm font-semibold text-neutral-100">
              {workspaceLabel}
            </div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-neutral-500">
              Project memory workspace
            </div>
          </div>
          <div className="toolbar-group">
            <button
              onClick={() => setWorkspaceView(workspaceView === "search" ? "documents" : "search")}
              className={`toolbar-btn ${
                workspaceView === "search" ? "toolbar-btn-active" : "toolbar-btn-default"
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
              Search
            </button>
            {workspaceView === "documents" && activeView === "editor" && (
              <>
                <button
                  onClick={toggleEditor}
                  className={`toolbar-btn ${showEditor ? "toolbar-btn-default" : "toolbar-btn-default opacity-50"}`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" />
                  </svg>
                  Editor
                </button>
                <button
                  onClick={togglePreview}
                  className={`toolbar-btn ${showPreview ? "toolbar-btn-default" : "toolbar-btn-default opacity-50"}`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                  </svg>
                  Preview
                </button>
              </>
            )}
            <button
              onClick={toggleTerminal}
              className={`toolbar-btn ${showTerminal ? "toolbar-btn-active" : "toolbar-btn-default"}`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m6.75 7.5 3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0 0 21 18V6a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 6v12a2.25 2.25 0 0 0 2.25 2.25Z" />
              </svg>
              Terminal
            </button>
          </div>
          <div className="flex-1" />
          {isDirty && (
            <button
              onClick={saveDocument}
              className="toolbar-btn toolbar-btn-active"
            >
              Save
            </button>
          )}
          <span className="rounded-full border border-neutral-800 bg-neutral-900/70 px-3 py-1 text-[10px] text-neutral-500">
            Ctrl+T terminal
          </span>
        </div>

        {/* Content + Terminal + StatusBar */}
        <div className="flex-1 flex flex-col min-h-0">
          {/* Main content */}
          <div className="flex-1 flex min-h-0">
            {showOnboarding ? (
              <Onboarding />
            ) : workspaceView === "home" ? (
              <VaultHome />
            ) : workspaceView === "search" ? (
              <SearchView />
            ) : workspaceView === "start-session" ? (
              <StartSessionView />
            ) : workspaceView === "agent-access" ? (
              <AgentAccessView />
            ) : workspaceView === "docs-health" ? (
              <DocsHealthView />
            ) : workspaceView === "sync" ? (
              <SyncView />
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
