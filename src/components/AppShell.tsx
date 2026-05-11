"use client";

import { useEffect } from "react";
import { useVaultStore } from "@/stores/vaultStore";
import { useUIStore } from "@/stores/uiStore";
import { useEditorStore } from "@/stores/editorStore";
import { Sidebar } from "./sidebar/Sidebar";
import { EditorPane } from "./editor/EditorPane";
import { MarkdownPreview } from "./preview/MarkdownPreview";
import { SearchView } from "./search/SearchView";
import { WikiView } from "./wiki/WikiView";
import { VaultHome } from "./home/VaultHome";
import { StartSessionView } from "./session/StartSessionView";
import { DocsHealthView } from "./health/DocsHealthView";
import { SyncView } from "./sync/SyncView";
import { TerminalPanel } from "./terminal/TerminalPanel";
import { VaultPicker } from "./vault/VaultPicker";
import { ResizeHandle } from "./shared/ResizeHandle";
import { StatusBar } from "./StatusBar";
import { Onboarding } from "./Onboarding";
import { AppChromeBar } from "./AppChromeBar";
import { shouldSkipOnboarding } from "@/lib/onboardingPrefs";

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
  const vaultName = useVaultStore((s) => s.vaultName);
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
          : workspaceView === "wiki"
            ? "Wiki"
            : workspaceView === "start-session"
              ? "Start Session"
              : workspaceView === "docs-health"
                  ? "Docs Health"
                  : workspaceView === "sync"
                    ? "Team Sync"
                    : workspaceView === "settings"
                      ? "Settings"
                      : "Workspace";

  // Keep the workspace on the default dark theme.
  useEffect(() => {
    document.documentElement.removeAttribute("data-theme");
    localStorage.removeItem("sv-theme");
  }, []);

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
      if (shouldSkipOnboarding()) {
        setShowOnboarding(false);
        setWorkspaceView("home");
        return;
      }
      setShowOnboarding(true);
    }
  }, [isOpen, projects.length, setShowOnboarding, setWorkspaceView]);

  if (!isOpen) {
    return <VaultPicker />;
  }

  const editorFlex = showEditor ? (showPreview ? previewRatio : 1) : 0;
  const previewFlex = showPreview ? (showEditor ? 1 - previewRatio : 1) : 0;
  const isDocumentsWorkspace = workspaceView === "documents";
  const hasSidebarPanel =
    isDocumentsWorkspace ||
    workspaceView === "settings";
  const effectiveSidebarWidth = hasSidebarPanel ? sidebarWidth : 56;
  const openWorkspaceView = (view: typeof workspaceView) => {
    setShowOnboarding(false);
    setWorkspaceView(view);
  };

  return (
    <div className="app-shell flex h-screen flex-col overflow-hidden">
      <AppChromeBar
        workspaceView={workspaceView}
        workspaceLabel={workspaceLabel}
        vaultName={vaultName}
        showEditor={showEditor}
        showPreview={showPreview}
        showTerminal={showTerminal}
        isDirty={isDirty}
        isDocumentsWorkspace={isDocumentsWorkspace && activeView === "editor"}
        onWorkspaceChange={openWorkspaceView}
        onToggleSearch={() => openWorkspaceView(workspaceView === "search" ? "documents" : "search")}
        onToggleEditor={toggleEditor}
        onTogglePreview={togglePreview}
        onToggleTerminal={toggleTerminal}
        onSaveDocument={saveDocument}
      />

      <div className="flex min-h-0 flex-1">
        {/* Sidebar */}
        <div style={{ width: effectiveSidebarWidth }} className="flex-shrink-0">
          <Sidebar />
        </div>

        {hasSidebarPanel && (
          <ResizeHandle
            direction="vertical"
            onResize={(delta) => setSidebarWidth((w) => w + delta)}
          />
        )}

        {/* Main area */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Content + Terminal + StatusBar */}
          <div className="flex min-h-0 flex-1 flex-col">
          {/* Main content */}
          <div className="flex-1 flex min-h-0">
            {showOnboarding ? (
              <Onboarding />
            ) : workspaceView === "home" ? (
              <VaultHome />
            ) : workspaceView === "search" ? (
              <SearchView />
            ) : workspaceView === "wiki" ? (
              <WikiView />
            ) : workspaceView === "start-session" ? (
              <StartSessionView />
            ) : workspaceView === "docs-health" ? (
              <DocsHealthView />
            ) : workspaceView === "sync" ? (
              <SyncView />
            ) : isDocumentsWorkspace ? (
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
                        window.innerWidth - effectiveSidebarWidth - 4;
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
            ) : (
              <div className="flex-1 bg-neutral-950" />
            )}
          </div>

          {/* Terminal stays mounted so xterm scrollback and PTY state survive toggles. */}
          <div
            onPointerDown={(e) => {
              if (!showTerminal) return;
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
            className={`flex-shrink-0 bg-neutral-800 transition-colors ${
              showTerminal
                ? "h-1.5 cursor-row-resize hover:bg-blue-600"
                : "h-0 overflow-hidden"
            }`}
          />
          <div
            style={{ height: showTerminal ? terminalHeight : 0 }}
            className={`flex-shrink-0 overflow-hidden border-t border-neutral-800 ${
              showTerminal ? "" : "pointer-events-none border-t-0"
            }`}
            aria-hidden={!showTerminal}
          >
            <TerminalPanel />
          </div>
        </div>

        {/* Status bar */}
        <StatusBar />
      </div>
      </div>
    </div>
  );
}
