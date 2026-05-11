"use client";

import type { WorkspaceView } from "@/stores/uiStore";
import { WindowControls } from "./WindowControls";

type ChromeAction = {
  id: WorkspaceView;
  label: string;
  shortLabel: string;
};

type AppChromeBarProps = {
  workspaceView: WorkspaceView;
  workspaceLabel: string;
  vaultName: string | null;
  showEditor: boolean;
  showPreview: boolean;
  showTerminal: boolean;
  isDirty: boolean;
  isDocumentsWorkspace: boolean;
  onWorkspaceChange: (view: WorkspaceView) => void;
  onToggleSearch: () => void;
  onToggleEditor: () => void;
  onTogglePreview: () => void;
  onToggleTerminal: () => void;
  onSaveDocument: () => void;
};

const chromeActions: ChromeAction[] = [
  { id: "home", label: "Home", shortLabel: "Home" },
  { id: "documents", label: "Documents", shortLabel: "Docs" },
  { id: "wiki", label: "Wiki", shortLabel: "Wiki" },
  { id: "start-session", label: "Start Session", shortLabel: "Session" },
  { id: "docs-health", label: "Docs Health", shortLabel: "Health" },
  { id: "sync", label: "Team Sync", shortLabel: "Sync" },
];

function SearchIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.2-5.2m0 0A7.5 7.5 0 1 0 5.2 5.2a7.5 7.5 0 0 0 10.6 10.6Z" />
    </svg>
  );
}

function TerminalIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m6.75 7.5 3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0 0 21 18V6a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 6v12a2.25 2.25 0 0 0 2.25 2.25Z" />
    </svg>
  );
}

function EditorIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m16.86 4.49 1.69-1.69a1.88 1.88 0 1 1 2.65 2.65L10.58 16.07a4.5 4.5 0 0 1-1.9 1.13L6 18l.8-2.69a4.5 4.5 0 0 1 1.13-1.9l8.93-8.92Z" />
    </svg>
  );
}

function PreviewIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.04 12.32a1 1 0 0 1 0-.64C3.42 7.51 7.36 4.5 12 4.5s8.57 3.01 9.96 7.18c.07.21.07.43 0 .64C20.58 16.49 16.64 19.5 12 19.5s-8.57-3.01-9.96-7.18Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
    </svg>
  );
}

export function AppChromeBar({
  workspaceView,
  workspaceLabel,
  vaultName,
  showEditor,
  showPreview,
  showTerminal,
  isDirty,
  isDocumentsWorkspace,
  onWorkspaceChange,
  onToggleSearch,
  onToggleEditor,
  onTogglePreview,
  onToggleTerminal,
  onSaveDocument,
}: AppChromeBarProps) {
  return (
    <header className="app-chrome-bar flex h-10 flex-shrink-0 items-center gap-2 pl-2" data-tauri-drag-region>
      <div className="flex min-w-0 items-center gap-2">
        <div className="app-chrome-mark">SV</div>
        <div className="hidden min-w-0 sm:block">
          <div className="truncate text-[12px] font-semibold text-neutral-100">
            {vaultName || "slateVault"}
          </div>
        </div>
      </div>

      <nav className="app-chrome-tabs" aria-label="Workspace navigation">
        {chromeActions.map((action) => (
          <button
            key={action.id}
            onClick={() => onWorkspaceChange(action.id)}
            className={`app-chrome-tab ${workspaceView === action.id ? "app-chrome-tab-active" : ""}`}
            title={action.label}
          >
            <span className="hidden lg:inline">{action.label}</span>
            <span className="lg:hidden">{action.shortLabel}</span>
          </button>
        ))}
      </nav>

      <button
        onClick={onToggleSearch}
        className={`app-chrome-search ${workspaceView === "search" ? "app-chrome-search-active" : ""}`}
        title="Search docs (Ctrl+Shift+F)"
      >
        <SearchIcon />
        <span className="hidden sm:inline">Search docs</span>
        <kbd className="hidden rounded-md border border-neutral-700/70 bg-neutral-950/70 px-1.5 py-0.5 text-[10px] text-neutral-500 xl:inline">
          Ctrl+Shift+F
        </kbd>
      </button>

      <div className="flex-1" />

      <div className="hidden min-w-0 items-center gap-2 md:flex">
        <span className="max-w-40 truncate text-[11px] text-neutral-500">{workspaceLabel}</span>
        {isDirty && <span className="h-1.5 w-1.5 rounded-full bg-cyan-300" title="Unsaved changes" />}
      </div>

      {isDocumentsWorkspace && (
        <div className="app-chrome-control-group hidden sm:flex">
          <button
            onClick={onToggleEditor}
            className={`app-chrome-icon-btn ${showEditor ? "app-chrome-icon-btn-active" : ""}`}
            title="Toggle editor"
          >
            <EditorIcon />
          </button>
          <button
            onClick={onTogglePreview}
            className={`app-chrome-icon-btn ${showPreview ? "app-chrome-icon-btn-active" : ""}`}
            title="Toggle preview"
          >
            <PreviewIcon />
          </button>
        </div>
      )}

      <button
        onClick={onToggleTerminal}
        className={`app-chrome-icon-btn ${showTerminal ? "app-chrome-icon-btn-active" : ""}`}
        title="Toggle terminal (Ctrl+T)"
      >
        <TerminalIcon />
      </button>

      {isDocumentsWorkspace && isDirty && (
        <button onClick={onSaveDocument} className="app-chrome-save">
          Save
        </button>
      )}

      <WindowControls />
    </header>
  );
}
