"use client";

import { useEffect, useState } from "react";
import { useVaultStore } from "@/stores/vaultStore";
import { useUIStore } from "@/stores/uiStore";
import { FileTree } from "./FileTree";
import { SearchBar } from "./SearchBar";
import { SettingsPanel } from "../settings/SettingsPanel";
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

type IconProps = {
  className?: string;
};

function OnboardingCheckIcon({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 12.5 9.2 16.7 19 7.3" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.75 18.25h14.5" />
    </svg>
  );
}

function FlatHomeIcon({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.65}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m4.75 11.5 7.25-6 7.25 6" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 10.25v8h10v-8" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 18.25v-4.5h4v4.5" />
    </svg>
  );
}

function FlatFileIcon({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.65}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 4.75h6.25L17 8.5v10.75H7z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.25 4.75V8.5H17" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 12.25h4.5M9.75 15.25h4.5" />
    </svg>
  );
}

function FlatWikiIcon({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.75 7.25 7.6 16.75l4.4-8.5 4.4 8.5 2.85-9.5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 19.25h12" />
    </svg>
  );
}

function FlatSessionIcon({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.65}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m12 3.75 7.25 8.25L12 20.25 4.75 12z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="m12 7.75 1.25 2.95 2.95 1.25-2.95 1.25L12 16.25l-1.25-3.05-2.95-1.25 2.95-1.25z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3.75V7.5M12 16.5v3.75" />
    </svg>
  );
}

function FlatHealthIcon({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h4l1.8-4.75 3 9.5L14.5 12h5.75" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M5.75 18.25h12.5" />
    </svg>
  );
}

function FlatGitIcon({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.65}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 6.75v9.5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 11.5h4.5a3.5 3.5 0 0 0 3.5-3.5V6.75" />
      <circle cx="8" cy="6.75" r="1.75" />
      <circle cx="8" cy="17.25" r="1.75" />
      <circle cx="16" cy="6.75" r="1.75" />
    </svg>
  );
}

function FlatSparkIcon({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.65}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m12 4.75 1.6 4.15 4.15 1.6-4.15 1.6L12 16.25l-1.6-4.15-4.15-1.6 4.15-1.6z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="m17.25 15.5.55 1.45 1.45.55-1.45.55-.55 1.45-.55-1.45-1.45-.55 1.45-.55z" />
    </svg>
  );
}

function FlatSettingsIcon({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.65}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 4.75h3l.45 2.1a6 6 0 0 1 1.2.7l2.05-.7 1.5 2.6-1.6 1.4a6.3 6.3 0 0 1 0 1.4l1.6 1.4-1.5 2.6-2.05-.7a6 6 0 0 1-1.2.7l-.45 2.1h-3l-.45-2.1a6 6 0 0 1-1.2-.7l-2.05.7-1.5-2.6 1.6-1.4a6.3 6.3 0 0 1 0-1.4l-1.6-1.4 1.5-2.6 2.05.7a6 6 0 0 1 1.2-.7z" />
      <circle cx="12" cy="11.5" r="2.25" />
    </svg>
  );
}

const viewIcons: Record<SidebarView, React.ReactNode> = {
  home: <FlatHomeIcon className="w-5 h-5" />,
  files: <FlatFileIcon className="w-5 h-5" />,
  wiki: <FlatWikiIcon className="w-5 h-5" />,
  "start-session": <FlatSessionIcon className="w-5 h-5" />,
  "docs-health": <FlatHealthIcon className="w-5 h-5" />,
  git: <FlatGitIcon className="w-5 h-5" />,
  ai: <FlatSparkIcon className="w-5 h-5" />,
  settings: <FlatSettingsIcon className="w-5 h-5" />,
};

export function Sidebar() {
  const vaultName = useVaultStore((s) => s.vaultName);
  const closeVault = useVaultStore((s) => s.closeVault);
  const expandedProjects = useVaultStore((s) => s.expandedProjects);
  const loadDocuments = useVaultStore((s) => s.loadDocuments);
  const workspaceView = useUIStore((s) => s.workspaceView);
  const showOnboarding = useUIStore((s) => s.showOnboarding);
  const setWorkspaceView = useUIStore((s) => s.setWorkspaceView);
  const setShowOnboarding = useUIStore((s) => s.setShowOnboarding);
  const [showNewProject, setShowNewProject] = useState(false);
  const loadProjects = useVaultStore((s) => s.loadProjects);
  const [view, setView] = useState<SidebarView>("home");
  const [refreshingFiles, setRefreshingFiles] = useState(false);
  const showPanel = view === "files" || view === "settings" || view === "ai";

  useEffect(() => {
    if (view === "settings") {
      return;
    }
    if (workspaceView === "documents" && view !== "files") {
      setView("files");
    }
    if (workspaceView === "home" && view !== "home") {
      setView("home");
    }
    if (workspaceView === "wiki" && view !== "wiki") {
      setView("wiki");
    }
    if (workspaceView === "start-session" && view !== "start-session") {
      setView("start-session");
    }
    if (workspaceView === "docs-health" && view !== "docs-health") {
      setView("docs-health");
    }
    if (workspaceView === "sync" && view !== "git") {
      setView("git");
    }
  }, [view, workspaceView]);

  const switchView = (v: SidebarView) => {
    setView(v);
    setShowOnboarding(false);
    if (v === "home") {
      setWorkspaceView("home");
    } else if (v === "files") {
      setWorkspaceView("documents");
      loadProjects();
    } else if (v === "wiki") {
      setWorkspaceView("wiki");
    } else if (v === "start-session") {
      setWorkspaceView("start-session");
    } else if (v === "docs-health") {
      setWorkspaceView("docs-health");
    } else if (v === "git") {
      setWorkspaceView("sync");
    } else if (v === "settings") {
      setWorkspaceView("settings");
    } else {
      setWorkspaceView("documents");
    }
  };

  const handleRefreshFiles = async () => {
    setRefreshingFiles(true);
    try {
      await loadProjects();
      await Promise.all(Array.from(expandedProjects).map((project) => loadDocuments(project)));
    } finally {
      setRefreshingFiles(false);
    }
  };

  return (
    <div className="flex h-full">
      {/* Activity Bar */}
      <div className="flex w-14 flex-col items-center gap-1 border-r border-neutral-800/50 bg-[linear-gradient(180deg,rgba(5,9,14,0.98),rgba(8,13,19,0.92))] py-3 flex-shrink-0">
        <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-2xl border border-cyan-900/30 bg-cyan-950/20 text-[11px] font-semibold text-cyan-200">
          SV
        </div>
        <button
          onClick={() => {
            setView("home");
            setWorkspaceView("home");
            setShowOnboarding(true);
          }}
          title="Open onboarding"
          className={`relative flex h-10 w-10 items-center justify-center rounded-2xl transition-colors ${
            showOnboarding
              ? "bg-cyan-950/70 text-cyan-200 shadow-[0_10px_24px_rgba(0,0,0,0.22)]"
              : "text-neutral-500 hover:bg-neutral-800/50 hover:text-neutral-300"
          }`}
        >
          <OnboardingCheckIcon />
          {showOnboarding && (
            <span className="absolute left-0 top-2 bottom-2 w-0.5 bg-cyan-400 rounded-r-full" />
          )}
        </button>
        {(["home", "files", "wiki", "start-session", "docs-health", "git"] as SidebarView[]).map((v) => (
          <button
            key={v}
            onClick={() => switchView(v)}
            title={
              v === "home"
                ? "Home"
                : v === "files"
                  ? "Documents"
                  : v === "wiki"
                    ? "Wiki"
                    : v === "start-session"
                      ? "Start Session"
                      : v === "docs-health"
                        ? "Docs Health"
                        : v === "git"
                          ? "Source Control"
                          : "AI Chat"
            }
            className={`relative flex h-10 w-10 items-center justify-center rounded-2xl transition-colors ${
              view === v && view !== "settings" && !showOnboarding
                ? "bg-neutral-800/90 text-white shadow-[0_10px_24px_rgba(0,0,0,0.22)]"
                : "text-neutral-500 hover:bg-neutral-800/50 hover:text-neutral-300"
            }`}
          >
            {viewIcons[v]}
            {view === v && view !== "settings" && !showOnboarding && (
              <span className="absolute left-0 top-2 bottom-2 w-0.5 bg-cyan-400 rounded-r-full" />
            )}
          </button>
        ))}

        <div className="flex-1" />

        {/* Settings at bottom */}
        <button
          onClick={() => switchView("settings")}
          title="Settings"
          className={`w-10 h-10 flex items-center justify-center rounded-lg transition-colors relative ${
            view === "settings"
              ? "text-white bg-neutral-800"
              : "text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800/50"
          }`}
        >
          {viewIcons.settings}
          {view === "settings" && (
            <span className="absolute left-0 top-2 bottom-2 w-0.5 bg-cyan-400 rounded-r-full" />
          )}
        </button>
      </div>

      {/* Panel */}
      {showPanel && (
      <div className="flex min-w-0 flex-1 flex-col bg-[linear-gradient(180deg,rgba(13,18,24,0.82),rgba(9,13,18,0.92))]">
        {/* Panel header */}
        <div className="flex items-center justify-between border-b border-neutral-800/50 px-4 py-3">
          {view === "files" ? (
            <button
              onClick={closeVault}
              className="flex items-center gap-1.5 text-[11px] font-semibold text-neutral-300 hover:text-cyan-400 truncate group"
              title="Click to switch vault"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 flex-shrink-0" />
              <span className="truncate">{vaultName || "slateVault"}</span>
              <svg className="w-3 h-3 text-neutral-600 group-hover:text-cyan-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 15 12 18.75 15.75 15m-7.5-6L12 5.25 15.75 9" />
              </svg>
            </button>
          ) : (
            <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
              {view === "ai" ? "AI Assistant" : "Settings"}
            </span>
          )}
          <div className="flex items-center gap-1">
            {view === "files" && (
              <>
                <button
                  onClick={() => void handleRefreshFiles()}
                  disabled={refreshingFiles}
                  className="flex h-6 w-6 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200 disabled:text-neutral-700"
                  title="Refresh files"
                >
                  <svg className={`w-3.5 h-3.5 ${refreshingFiles ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992V4.356m-1.59 14.287A9 9 0 1 1 21 12" />
                  </svg>
                </button>
                <button
                  onClick={() => setShowNewProject(!showNewProject)}
                  className="flex h-6 w-6 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200"
                  title="New project"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                </button>
              </>
            )}
          </div>
        </div>

        {view === "files" && (
          <>
            {showNewProject && (
              <div className="px-3 py-3 border-b border-neutral-800/50">
                <CreateProjectForm
                  compact
                  onCreated={async (name) => {
                    await loadProjects();
                    setShowNewProject(false);
                    // Switch to files view to see the new project
                    switchView("files");
                    void name;
                  }}
                  onCancel={() => setShowNewProject(false)}
                />
              </div>
            )}
            <SearchBar />
            <div className="flex-1 overflow-y-auto">
              <FileTree />
            </div>
          </>
        )}

        {view === "ai" && (
          <div className="flex-1 min-h-0">
            <AiChatPanel />
          </div>
        )}

        {view === "settings" && (
          <div className="flex-1 min-h-0 overflow-y-auto">
            <SettingsPanel />
          </div>
        )}
      </div>
      )}
    </div>
  );
}
