"use client";

import { useEffect, useState } from "react";
import { useVaultStore } from "@/stores/vaultStore";
import { useUIStore } from "@/stores/uiStore";
import { FileTree } from "./FileTree";
import { SearchBar } from "./SearchBar";
import { SettingsPanel } from "../settings/SettingsPanel";
import { AiChatPanel } from "../ai/AiChatPanel";
import * as commands from "@/lib/commands";
import type { TemplateInfo } from "@/types";

type SidebarView =
  | "home"
  | "files"
  | "start-session"
  | "agent-access"
  | "docs-health"
  | "git"
  | "ai"
  | "settings";

const viewIcons: Record<SidebarView, React.ReactNode> = {
  home: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 12 8.954-8.955a1.125 1.125 0 0 1 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-6.75c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75" />
    </svg>
  ),
  files: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
    </svg>
  ),
  "start-session": (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M18 6v12m-4.5-7.5h9" />
    </svg>
  ),
  "agent-access": (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 3.75h6m-7.5 3h9a2.25 2.25 0 0 1 2.25 2.25v6a2.25 2.25 0 0 1-2.25 2.25h-9A2.25 2.25 0 0 1 5.25 15v-6A2.25 2.25 0 0 1 7.5 6.75Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.5A2.25 2.25 0 0 0 11.25 21h1.5A2.25 2.25 0 0 0 15 18.75v-1.5m-7.5-4.5h9" />
    </svg>
  ),
  "docs-health": (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125h3.75L9 8.625l3 7.5 3-4.5H21" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 5.25h18v13.5H3z" />
    </svg>
  ),
  git: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 3v12m0 0a3 3 0 1 0 3 3m-3-3a3 3 0 0 1 3 3m0 0h6a3 3 0 0 0 3-3V9m0 0a3 3 0 1 0-3-3m3 3a3 3 0 0 1-3-3m0 0V3" />
    </svg>
  ),
  ai: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
    </svg>
  ),
  settings: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
    </svg>
  ),
};

export function Sidebar() {
  const vaultName = useVaultStore((s) => s.vaultName);
  const closeVault = useVaultStore((s) => s.closeVault);
  const createProject = useVaultStore((s) => s.createProject);
  const workspaceView = useUIStore((s) => s.workspaceView);
  const setWorkspaceView = useUIStore((s) => s.setWorkspaceView);
  const setShowOnboarding = useUIStore((s) => s.setShowOnboarding);
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [templates, setTemplates] = useState<TemplateInfo[]>([]);
  const loadProjects = useVaultStore((s) => s.loadProjects);
  const [view, setView] = useState<SidebarView>("home");

  useEffect(() => {
    commands.listTemplates().then((t) => {
      setTemplates(t);
      const def = t.find((x) => x.is_default);
      if (def) setSelectedTemplate(def.name);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (workspaceView === "documents" && view === "home") {
      setView("files");
    }
    if (workspaceView === "home" && view !== "home") {
      setView("home");
    }
    if (workspaceView === "start-session" && view !== "start-session") {
      setView("start-session");
    }
    if (workspaceView === "agent-access" && view !== "agent-access") {
      setView("agent-access");
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
    } else if (v === "start-session") {
      setWorkspaceView("start-session");
    } else if (v === "agent-access") {
      setWorkspaceView("agent-access");
    } else if (v === "docs-health") {
      setWorkspaceView("docs-health");
    } else if (v === "git") {
      setWorkspaceView("sync");
    } else if (v === "settings") {
      setWorkspaceView(workspaceView);
    } else {
      setWorkspaceView("documents");
    }
  };

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;
    await createProject(
      newProjectName.trim(),
      undefined,
      undefined,
      selectedTemplate || undefined
    );
    setNewProjectName("");
    setShowNewProject(false);
  };

  return (
    <div className="flex h-full">
      {/* Activity Bar */}
      <div className="flex w-14 flex-col items-center gap-1 border-r border-neutral-800/50 bg-[linear-gradient(180deg,rgba(5,9,14,0.98),rgba(8,13,19,0.92))] py-3 flex-shrink-0">
        <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-2xl border border-cyan-900/30 bg-cyan-950/20 text-[11px] font-semibold text-cyan-200">
          SV
        </div>
        {(["home", "files", "start-session", "agent-access", "docs-health", "git", "ai"] as SidebarView[]).map((v) => (
          <button
            key={v}
            onClick={() => switchView(v)}
            title={
              v === "home"
                ? "Home"
                : v === "files"
                  ? "Documents"
                  : v === "start-session"
                    ? "Start Session"
                    : v === "agent-access"
                      ? "Agent Access"
                      : v === "docs-health"
                        ? "Docs Health"
                  : v === "git"
                    ? "Source Control"
                    : "AI Chat"
            }
            className={`relative flex h-10 w-10 items-center justify-center rounded-2xl transition-colors ${
              view === v && view !== "settings"
                ? "bg-neutral-800/90 text-white shadow-[0_10px_24px_rgba(0,0,0,0.22)]"
                : "text-neutral-500 hover:bg-neutral-800/50 hover:text-neutral-300"
            }`}
          >
            {viewIcons[v]}
            {view === v && view !== "settings" && (
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
      <div className="flex min-w-0 flex-1 flex-col bg-[linear-gradient(180deg,rgba(13,18,24,0.82),rgba(9,13,18,0.92))]">
        {/* Panel header */}
        <div className="flex items-center justify-between border-b border-neutral-800/50 px-4 py-3">
          {view === "home" ? (
            <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
              Vault Home
            </span>
          ) : view === "files" ? (
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
              {view === "start-session"
                ? "Start Session"
                : view === "agent-access"
                  ? "Agent Access"
                : view === "docs-health"
                  ? "Docs Health"
                : view === "git"
                  ? "Source Control"
                  : view === "ai"
                    ? "AI Assistant"
                    : "Settings"}
            </span>
          )}
          <div className="flex items-center gap-1">
            {view === "files" && (
              <button
                onClick={() => setShowNewProject(!showNewProject)}
                className="flex h-6 w-6 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200"
                title="New project"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {view === "home" && (
          <div className="flex flex-col gap-3 p-3">
            <div className="rounded-xl border border-neutral-800 bg-neutral-950/60 p-3">
              <div className="text-xs font-medium text-neutral-200">
                {vaultName || "slateVault"}
              </div>
              <p className="mt-1 text-[11px] leading-5 text-neutral-500">
                Use Home for the vault overview, then jump into Documents when
                you want to edit project files.
              </p>
            </div>
            <button
              onClick={() => {
                setView("files");
                setShowOnboarding(false);
                setWorkspaceView("documents");
                loadProjects();
              }}
              className="w-full rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2 text-left transition-colors hover:border-neutral-700 hover:bg-neutral-800"
            >
              <div className="text-xs font-medium text-neutral-200">
                Open documents
              </div>
              <div className="mt-1 text-[11px] text-neutral-500">
                Browse the file tree and open the editor workspace.
              </div>
            </button>
            <button
              onClick={() => {
                setShowOnboarding(false);
                setWorkspaceView("search");
              }}
              className="w-full rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2 text-left transition-colors hover:border-neutral-700 hover:bg-neutral-800"
            >
              <div className="text-xs font-medium text-neutral-200">
                Search vault
              </div>
              <div className="mt-1 text-[11px] text-neutral-500">
                Find docs across all projects quickly.
              </div>
            </button>
          </div>
        )}

        {view === "start-session" && (
          <div className="flex flex-col gap-3 p-3">
            <div className="rounded-xl border border-neutral-800 bg-neutral-950/60 p-3">
              <div className="text-xs font-medium text-neutral-200">
                Prepare context first
              </div>
              <p className="mt-1 text-[11px] leading-5 text-neutral-500">
                Build a clean session brief before implementation or handoff work starts.
              </p>
            </div>
            <button
              onClick={() => {
                setShowOnboarding(false);
                setWorkspaceView("start-session");
              }}
              className="w-full rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2 text-left transition-colors hover:border-neutral-700 hover:bg-neutral-800"
            >
              <div className="text-xs font-medium text-neutral-200">
                Open Start Session
              </div>
              <div className="mt-1 text-[11px] text-neutral-500">
                Generate a project brief and recommended reading list.
              </div>
            </button>
          </div>
        )}

        {view === "agent-access" && (
          <div className="flex flex-col gap-3 p-3">
            <div className="rounded-xl border border-neutral-800 bg-neutral-950/60 p-3">
              <div className="text-xs font-medium text-neutral-200">
                Connect agents safely
              </div>
              <p className="mt-1 text-[11px] leading-5 text-neutral-500">
                Review MCP status, copy setup commands, and keep trusted docs at the center of agent work.
              </p>
            </div>
            <button
              onClick={() => {
                setShowOnboarding(false);
                setWorkspaceView("agent-access");
              }}
              className="w-full rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2 text-left transition-colors hover:border-neutral-700 hover:bg-neutral-800"
            >
              <div className="text-xs font-medium text-neutral-200">
                Open Agent Access
              </div>
              <div className="mt-1 text-[11px] text-neutral-500">
                Manage MCP, setup steps, and agent-facing defaults.
              </div>
            </button>
          </div>
        )}

        {view === "docs-health" && (
          <div className="flex flex-col gap-3 p-3">
            <div className="rounded-xl border border-neutral-800 bg-neutral-950/60 p-3">
              <div className="text-xs font-medium text-neutral-200">
                Keep docs useful
              </div>
              <p className="mt-1 text-[11px] leading-5 text-neutral-500">
                Review stale documents, missing canonical anchors, and status backlog before things drift.
              </p>
            </div>
            <button
              onClick={() => {
                setShowOnboarding(false);
                setWorkspaceView("docs-health");
              }}
              className="w-full rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2 text-left transition-colors hover:border-neutral-700 hover:bg-neutral-800"
            >
              <div className="text-xs font-medium text-neutral-200">
                Open Docs Health
              </div>
              <div className="mt-1 text-[11px] text-neutral-500">
                See stale docs, recent changes, and project coverage.
              </div>
            </button>
          </div>
        )}

        {view === "git" && (
          <div className="flex flex-col gap-3 p-3">
            <div className="rounded-xl border border-neutral-800 bg-neutral-950/60 p-3">
              <div className="text-xs font-medium text-neutral-200">
                Share docs like code
              </div>
              <p className="mt-1 text-[11px] leading-5 text-neutral-500">
                Use pull, commit, push, and PR workflows so the vault stays collaborative and reviewable.
              </p>
            </div>
            <button
              onClick={() => {
                setShowOnboarding(false);
                setWorkspaceView("sync");
              }}
              className="w-full rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2 text-left transition-colors hover:border-neutral-700 hover:bg-neutral-800"
            >
              <div className="text-xs font-medium text-neutral-200">
                Open Sync
              </div>
              <div className="mt-1 text-[11px] text-neutral-500">
                See team sync status and detailed git tools.
              </div>
            </button>
          </div>
        )}

        {view === "files" && (
          <>
            {showNewProject && (
              <div className="px-3 py-2 border-b border-neutral-800/50 space-y-2">
                <input
                  type="text"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreateProject();
                    if (e.key === "Escape") setShowNewProject(false);
                  }}
                  placeholder="project-name"
                  className="w-full px-2 py-1 text-xs bg-neutral-800 border border-neutral-700 rounded text-neutral-200 placeholder-neutral-500 outline-none focus:border-blue-600"
                  autoFocus
                />
                {templates.length > 0 && (
                  <select
                    value={selectedTemplate}
                    onChange={(e) => setSelectedTemplate(e.target.value)}
                    className="w-full px-2 py-1 text-xs bg-neutral-800 border border-neutral-700 rounded text-neutral-200 outline-none focus:border-blue-600"
                  >
                    {templates.map((t) => (
                      <option key={t.name} value={t.name}>
                        {t.label}{t.is_default ? " (default)" : ""}
                      </option>
                    ))}
                  </select>
                )}
                <div className="flex gap-1">
                  <button
                    onClick={handleCreateProject}
                    disabled={!newProjectName.trim()}
                    className="flex-1 px-2 py-1 text-xs rounded bg-blue-600 hover:bg-blue-500 disabled:bg-neutral-800 disabled:text-neutral-500 text-white font-medium"
                  >
                    Create
                  </button>
                  <button
                    onClick={() => { setShowNewProject(false); setNewProjectName(""); }}
                    className="px-2 py-1 text-xs rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-400"
                  >
                    Cancel
                  </button>
                </div>
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
    </div>
  );
}
