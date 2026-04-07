"use client";

import { useEffect, useState } from "react";
import { useVaultStore } from "@/stores/vaultStore";
import { FileTree } from "./FileTree";
import { SearchBar } from "./SearchBar";
import { GitPanel } from "../git/GitPanel";
import { SettingsPanel } from "../settings/SettingsPanel";
import * as commands from "@/lib/commands";
import type { TemplateInfo } from "@/types";

type SidebarView = "files" | "git" | "settings";

const viewIcons: Record<SidebarView, React.ReactNode> = {
  files: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
    </svg>
  ),
  git: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 3v12m0 0a3 3 0 1 0 3 3m-3-3a3 3 0 0 1 3 3m0 0h6a3 3 0 0 0 3-3V9m0 0a3 3 0 1 0-3-3m3 3a3 3 0 0 1-3-3m0 0V3" />
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
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [templates, setTemplates] = useState<TemplateInfo[]>([]);
  const loadProjects = useVaultStore((s) => s.loadProjects);
  const [view, setView] = useState<SidebarView>("files");

  useEffect(() => {
    commands.listTemplates().then((t) => {
      setTemplates(t);
      const def = t.find((x) => x.is_default);
      if (def) setSelectedTemplate(def.name);
    }).catch(() => {});
  }, []);

  const switchView = (v: SidebarView) => {
    setView(v);
    if (v === "files") {
      loadProjects();
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
      <div className="flex flex-col items-center w-12 bg-neutral-950 border-r border-neutral-800/50 py-2 gap-1 flex-shrink-0">
        {(["files", "git"] as SidebarView[]).map((v) => (
          <button
            key={v}
            onClick={() => switchView(v)}
            title={v === "files" ? "Explorer" : "Source Control"}
            className={`w-10 h-10 flex items-center justify-center rounded-lg transition-colors relative ${
              view === v && view !== "settings"
                ? "text-white bg-neutral-800"
                : "text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800/50"
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
      <div className="flex flex-col flex-1 min-w-0 bg-neutral-900">
        {/* Panel header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-800/50">
          <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
            {view === "files" ? "Explorer" : view === "git" ? "Source Control" : "Settings"}
          </span>
          {view === "files" && (
            <button
              onClick={() => setShowNewProject(!showNewProject)}
              className="w-5 h-5 flex items-center justify-center rounded text-neutral-500 hover:text-neutral-200 hover:bg-neutral-800"
              title="New project"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </button>
          )}
        </div>

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

        {view === "git" && (
          <div className="flex-1 min-h-0">
            <GitPanel />
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
