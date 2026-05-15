"use client";

import { useEffect, useState } from "react";
import { useVaultStore } from "@/stores/vaultStore";
import { useUIStore } from "@/stores/uiStore";
import { FileTree } from "./FileTree";
import { SearchBar } from "./SearchBar";
import { AiChatPanel } from "../ai/AiChatPanel";
import { CreateProjectForm } from "@/components/shared/CreateProjectForm";
import * as commands from "@/lib/commands";

type SidebarView =
  | "home"
  | "files"
  | "wiki"
  | "start-session"
  | "docs-health"
  | "git"
  | "ai"
  | "settings";

/* ── Icons ── */
function HomeIcon() {
  return (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.65}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m4.75 11.5 7.25-6 7.25 6" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 10.25v8h10v-8" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 18.25v-4.5h4v4.5" />
    </svg>
  );
}
function FilesIcon() {
  return (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.65}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 4.75h6.25L17 8.5v10.75H7z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.25 4.75V8.5H17" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 12.25h4.5M9.75 15.25h4.5" />
    </svg>
  );
}
function WikiIcon() {
  return (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.75 7.25 7.6 16.75l4.4-8.5 4.4 8.5 2.85-9.5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 19.25h12" />
    </svg>
  );
}
function SessionIcon() {
  return (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.65}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m12 4.75 7.25 8.25L12 20.25 4.75 12z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="m12 7.75 1.25 2.95 2.95 1.25-2.95 1.25L12 16.25l-1.25-3.05-2.95-1.25 2.95-1.25z" />
    </svg>
  );
}
function HealthIcon() {
  return (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h4l1.8-4.75 3 9.5L14.5 12h5.75" />
    </svg>
  );
}
function GitIcon() {
  return (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.65}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 6.75v9.5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 11.5h4.5a3.5 3.5 0 0 0 3.5-3.5V6.75" />
      <circle cx="8" cy="6.75" r="1.75" fill="currentColor" stroke="none" />
      <circle cx="8" cy="17.25" r="1.75" fill="currentColor" stroke="none" />
      <circle cx="16" cy="6.75" r="1.75" fill="currentColor" stroke="none" />
    </svg>
  );
}
function SparkIcon() {
  return (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.65}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m12 4.75 1.6 4.15 4.15 1.6-4.15 1.6L12 16.25l-1.6-4.15-4.15-1.6 4.15-1.6z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="m17.25 15.5.55 1.45 1.45.55-1.45.55-.55 1.45-.55-1.45-1.45-.55 1.45-.55z" />
    </svg>
  );
}
function SettingsIcon() {
  return (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.65}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 4.75h3l.45 2.1a6 6 0 0 1 1.2.7l2.05-.7 1.5 2.6-1.6 1.4a6.3 6.3 0 0 1 0 1.4l1.6 1.4-1.5 2.6-2.05-.7a6 6 0 0 1-1.2.7l-.45 2.1h-3l-.45-2.1a6 6 0 0 1-1.2-.7l-2.05.7-1.5-2.6 1.6-1.4a6.3 6.3 0 0 1 0-1.4l-1.6-1.4 1.5-2.6 2.05.7a6 6 0 0 1 1.2-.7z" />
      <circle cx="12" cy="11.5" r="2.25" />
    </svg>
  );
}
function RefreshIcon({ spinning }: { spinning?: boolean }) {
  return (
    <svg
      width="14" height="14" fill="none" viewBox="0 0 24 24"
      stroke="currentColor" strokeWidth={2}
      style={{ animation: spinning ? "spin 0.8s linear infinite" : undefined }}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992V4.356m-1.59 14.287A9 9 0 1 1 21 12" />
    </svg>
  );
}
function PlusIcon() {
  return (
    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  );
}
function ChevronIcon() {
  return (
    <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 15 12 18.75 15.75 15m-7.5-6L12 5.25 15.75 9" />
    </svg>
  );
}

/* ── Rail items ── */
const RAIL_ITEMS: { view: SidebarView; label: string; icon: React.ReactNode }[] = [
  { view: "home",          label: "Home",         icon: <HomeIcon /> },
  { view: "files",         label: "Documents",    icon: <FilesIcon /> },
  { view: "wiki",          label: "Wiki",         icon: <WikiIcon /> },
  { view: "start-session", label: "Start Session",icon: <SessionIcon /> },
  { view: "docs-health",   label: "Docs Health",  icon: <HealthIcon /> },
  { view: "git",           label: "Team Sync",    icon: <GitIcon /> },
  { view: "ai",            label: "AI Chat",      icon: <SparkIcon /> },
];

export function Sidebar() {
  const vaultName = useVaultStore((s) => s.vaultName);
  const closeVault = useVaultStore((s) => s.closeVault);
  const expandedProjects = useVaultStore((s) => s.expandedProjects);
  const loadDocuments = useVaultStore((s) => s.loadDocuments);
  const loadProjects = useVaultStore((s) => s.loadProjects);
  const workspaceView = useUIStore((s) => s.workspaceView);
  const showOnboarding = useUIStore((s) => s.showOnboarding);
  const setWorkspaceView = useUIStore((s) => s.setWorkspaceView);
  const setShowOnboarding = useUIStore((s) => s.setShowOnboarding);
  const [showNewProject, setShowNewProject] = useState(false);
  const [view, setView] = useState<SidebarView>("home");
  const [refreshingFiles, setRefreshingFiles] = useState(false);

  const showPanel = view === "files" || view === "ai";

  useEffect(() => {
    if (view === "settings") return;
    if (workspaceView === "documents" && view !== "files")         setView("files");
    if (workspaceView === "home" && view !== "home")               setView("home");
    if (workspaceView === "wiki" && view !== "wiki")               setView("wiki");
    if (workspaceView === "start-session" && view !== "start-session") setView("start-session");
    if (workspaceView === "docs-health" && view !== "docs-health") setView("docs-health");
    if (workspaceView === "sync" && view !== "git")                setView("git");
  }, [view, workspaceView]);

  const switchView = (v: SidebarView) => {
    setView(v);
    setShowOnboarding(false);
    if (v === "home")           setWorkspaceView("home");
    else if (v === "files")     { setWorkspaceView("documents"); loadProjects(); }
    else if (v === "wiki")      setWorkspaceView("wiki");
    else if (v === "start-session") setWorkspaceView("start-session");
    else if (v === "docs-health")   setWorkspaceView("docs-health");
    else if (v === "git")       setWorkspaceView("sync");
    else if (v === "settings")  setWorkspaceView("settings");
    else                        setWorkspaceView("documents");
  };

  const handleRefreshFiles = async () => {
    setRefreshingFiles(true);
    try {
      await loadProjects();
      await Promise.all(Array.from(expandedProjects).map((p) => loadDocuments(p)));
    } finally {
      setRefreshingFiles(false);
    }
  };

  return (
    <div style={{ display: "flex", height: "100%" }}>
      {/* ── Icon rail ── */}
      <div className="rail">
        {RAIL_ITEMS.map(({ view: v, label, icon }) => {
          const isActive = view === v && !showOnboarding;
          return (
            <button
              key={v}
              className={`rail-btn${isActive ? " active" : ""}`}
              onClick={() => switchView(v)}
              title={label}
            >
              {icon}
              {isActive && <span className="rail-indicator" />}
              <span className="rail-tooltip">{label}</span>
            </button>
          );
        })}

        <div style={{ flex: 1 }} />

        {/* Settings at bottom */}
        <button
          className={`rail-btn${view === "settings" ? " active" : ""}`}
          onClick={() => switchView("settings")}
          title="Settings"
        >
          <SettingsIcon />
          {view === "settings" && <span className="rail-indicator" />}
          <span className="rail-tooltip">Settings</span>
        </button>
      </div>

      {/* ── Sidebar panel ── */}
      {showPanel && (
        <div className="sidebar">
          {/* Panel header */}
          <div className="sidebar-h">
            {view === "files" ? (
              <button
                onClick={closeVault}
                className="label"
                style={{ background: "transparent", border: "none", padding: 0, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, color: "var(--text)", fontWeight: 600, fontSize: 11.5 }}
                title="Switch vault"
              >
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--accent)", flexShrink: 0 }} />
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 160 }}>
                  {vaultName || "slateVault"}
                </span>
                <ChevronIcon />
              </button>
            ) : (
              <span className="label">
                {view === "ai" ? "AI Assistant" : "Settings"}
              </span>
            )}

            <div className="actions">
              {view === "files" && (
                <>
                  <button
                    className="icon-btn"
                    onClick={() => void handleRefreshFiles()}
                    disabled={refreshingFiles}
                    title="Refresh files"
                  >
                    <RefreshIcon spinning={refreshingFiles} />
                  </button>
                  <button
                    className="icon-btn"
                    onClick={() => setShowNewProject(!showNewProject)}
                    title="New project"
                  >
                    <PlusIcon />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Files view */}
          {view === "files" && (
            <>
              {showNewProject && (
                <div style={{ padding: "8px 12px", borderBottom: "1px solid var(--border-subtle)" }}>
                  <CreateProjectForm
                    compact
                    onCreated={async (name) => {
                      await loadProjects();
                      setShowNewProject(false);
                      switchView("files");
                      void name;
                    }}
                    onCancel={() => setShowNewProject(false)}
                  />
                </div>
              )}
              <SearchBar />
              <div style={{ flex: 1, overflowY: "auto" }}>
                <FileTree />
              </div>
              <div style={{ padding: "8px 10px", borderTop: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--text-muted)", flexShrink: 0 }}>
                <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <circle cx="12" cy="12" r="9.25" />
                  <path strokeLinecap="round" d="M12 11v5" />
                  <circle cx="12" cy="8" r="0.5" fill="currentColor" stroke="none" />
                </svg>
                <span>Drag files in to import. Right-click for actions.</span>
              </div>
            </>
          )}

          {view === "ai" && (
            <div style={{ flex: 1, minHeight: 0 }}>
              <AiChatPanel />
            </div>
          )}

        </div>
      )}
    </div>
  );
}
