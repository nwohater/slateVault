"use client";

import { useState, useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { WorkspaceView } from "@/stores/uiStore";

type AppChromeBarProps = {
  workspaceView: WorkspaceView;
  vaultName: string | null;
  showEditor: boolean;
  showPreview: boolean;
  showTerminal: boolean;
  sidebarCollapsed: boolean;
  isDirty: boolean;
  isDocumentsWorkspace: boolean;
  onWorkspaceChange: (view: WorkspaceView) => void;
  onToggleSearch: () => void;
  onToggleEditor: () => void;
  onTogglePreview: () => void;
  onToggleTerminal: () => void;
  onToggleSidebar: () => void;
  onSaveDocument: () => void;
};

const NAV: { id: WorkspaceView; label: string }[] = [
  { id: "home",          label: "Home" },
  { id: "documents",     label: "Documents" },
  { id: "wiki",          label: "Wiki" },
  { id: "start-session", label: "Start Session" },
  { id: "docs-health",   label: "Docs Health" },
  { id: "sync",          label: "Team Sync" },
];

function WinControls() {
  const appWindow = getCurrentWindow();

  return (
    <div className="win-ctrls">
      <button
        onClick={() => void appWindow.minimize()}
        title="Minimize"
        aria-label="Minimize window"
      >
        <svg width="10" height="10" viewBox="0 0 10 10">
          <path d="M0 5h10" stroke="currentColor" strokeWidth="1" />
        </svg>
      </button>
      <button
        onClick={() => void appWindow.toggleMaximize()}
        title="Maximize"
        aria-label="Maximize window"
      >
        <svg width="10" height="10" viewBox="0 0 10 10">
          <rect x="0.5" y="0.5" width="9" height="9" stroke="currentColor" strokeWidth="1" fill="none" />
        </svg>
      </button>
      <button
        className="close"
        onClick={() => void appWindow.close()}
        title="Close"
        aria-label="Close window"
      >
        <svg width="10" height="10" viewBox="0 0 10 10">
          <path d="M0 0l10 10M10 0L0 10" stroke="currentColor" strokeWidth="1" />
        </svg>
      </button>
    </div>
  );
}

function SearchIcon() {
  return (
    <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.2-5.2m0 0A7.5 7.5 0 1 0 5.2 5.2a7.5 7.5 0 0 0 10.6 10.6Z" />
    </svg>
  );
}

function TerminalIcon() {
  return (
    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m6.75 7.5 3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0 0 21 18V6a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 6v12a2.25 2.25 0 0 0 2.25 2.25Z" />
    </svg>
  );
}

function SidebarIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
      <rect x="3.75" y="5" width="16.5" height="14" rx="2" />
      <path strokeLinecap="round" d="M9 5v14" />
      {collapsed ? (
        <path strokeLinecap="round" strokeLinejoin="round" d="m14 9 3 3-3 3" />
      ) : (
        <path strokeLinecap="round" strokeLinejoin="round" d="m17 9-3 3 3 3" />
      )}
    </svg>
  );
}

function EditorIcon() {
  return (
    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m16.86 4.49 1.69-1.69a1.88 1.88 0 1 1 2.65 2.65L10.58 16.07a4.5 4.5 0 0 1-1.9 1.13L6 18l.8-2.69a4.5 4.5 0 0 1 1.13-1.9l8.93-8.92Z" />
    </svg>
  );
}

function PreviewIcon() {
  return (
    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.04 12.32a1 1 0 0 1 0-.64C3.42 7.51 7.36 4.5 12 4.5s8.57 3.01 9.96 7.18c.07.21.07.43 0 .64C20.58 16.49 16.64 19.5 12 19.5s-8.57-3.01-9.96-7.18Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 4.75h3l.45 2.1a6 6 0 0 1 1.2.7l2.05-.7 1.5 2.6-1.6 1.4a6.3 6.3 0 0 1 0 1.4l1.6 1.4-1.5 2.6-2.05-.7a6 6 0 0 1-1.2.7l-.45 2.1h-3l-.45-2.1a6 6 0 0 1-1.2-.7l-2.05.7-1.5-2.6 1.6-1.4a6.3 6.3 0 0 1 0-1.4l-1.6-1.4 1.5-2.6 2.05.7a6 6 0 0 1 1.2-.7z" />
      <circle cx="12" cy="11.5" r="2.25" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
      <circle cx="12" cy="12" r="4" />
      <path strokeLinecap="round" d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

export function AppChromeBar({
  workspaceView,
  vaultName,
  showEditor,
  showPreview,
  showTerminal,
  sidebarCollapsed,
  isDirty,
  isDocumentsWorkspace,
  onWorkspaceChange,
  onToggleSearch,
  onToggleEditor,
  onTogglePreview,
  onToggleTerminal,
  onToggleSidebar,
  onSaveDocument,
}: AppChromeBarProps) {
  const isMac =
    typeof navigator !== "undefined" &&
    /Mac|iPhone|iPad|iPod/.test(navigator.platform);

  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setIsDark(document.documentElement.getAttribute("data-theme") === "dark");
  }, []);

  const toggleTheme = () => {
    const next = isDark ? null : "dark";
    if (next) {
      document.documentElement.setAttribute("data-theme", "dark");
      localStorage.setItem("sv-theme", "dark");
    } else {
      document.documentElement.removeAttribute("data-theme");
      localStorage.removeItem("sv-theme");
    }
    setIsDark(!isDark);
  };

  return (
    <header className={`topbar${isMac ? " mac" : ""}`} data-tauri-drag-region>

      {/* Vault identity */}
      <div className="vault-id">
        <img className="brand-mark" src="/icon.png" alt="" aria-hidden="true" />
        <span>{vaultName || "slateVault"}</span>
      </div>

      {/* Nav tabs */}
      <nav className="nav-tabs" aria-label="Workspace navigation">
        {NAV.map((item) => (
          <button
            key={item.id}
            className={`nav-tab${workspaceView === item.id ? " active" : ""}`}
            onClick={() => onWorkspaceChange(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <div className="drag-spacer" data-tauri-drag-region />

      {/* Right-side controls */}
      <div className="topbar-right">
        <button
          className="search-pill"
          onClick={onToggleSearch}
          title="Search"
        >
          <SearchIcon />
          <span>Search</span>
        </button>


        <button
          className={`icon-btn${showTerminal ? " on" : ""}`}
          onClick={onToggleTerminal}
          title="Toggle terminal (Ctrl+T)"
        >
          <TerminalIcon />
        </button>

        <button
          className={`icon-btn${sidebarCollapsed ? " on" : ""}`}
          onClick={onToggleSidebar}
          title={sidebarCollapsed ? "Show sidebar" : "Hide sidebar"}
          aria-pressed={sidebarCollapsed}
        >
          <SidebarIcon collapsed={sidebarCollapsed} />
        </button>

        <button
          className="icon-btn"
          onClick={toggleTheme}
          title={isDark ? "Switch to light mode" : "Switch to dark mode"}
        >
          {isDark ? <SunIcon /> : <MoonIcon />}
        </button>

        <button
          className="icon-btn"
          onClick={() => onWorkspaceChange("settings")}
          title="Settings"
        >
          <SettingsIcon />
        </button>

        {!isDocumentsWorkspace && (
          <div className={`save-pill${isDirty ? " dirty" : ""}`} title={isDirty ? "Unsaved changes" : "All changes saved"}>
            <span className="dot" />
            <span>{isDirty ? "Unsaved" : "Saved"}</span>
          </div>
        )}
      </div>

      {!isMac && <WinControls />}
    </header>
  );
}
