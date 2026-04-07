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

  const tabs: { id: SidebarView; label: string }[] = [
    { id: "files", label: "Files" },
    { id: "git", label: "Git" },
    { id: "settings", label: "Settings" },
  ];

  return (
    <div className="flex flex-col h-full bg-neutral-900/95 border-r border-neutral-800/50">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-neutral-800/50 bg-neutral-900/50">
        <button
          onClick={closeVault}
          className="text-sm font-semibold text-neutral-200 truncate hover:text-cyan-400 transition-colors flex items-center gap-2"
          title="Switch vault"
        >
          <span className="w-2 h-2 rounded-full bg-cyan-500/80 flex-shrink-0" />
          {vaultName || "slateVault"}
        </button>
        <div className="flex items-center gap-1">
          {view === "files" && (
            <button
              onClick={() => setShowNewProject(!showNewProject)}
              className="w-6 h-6 flex items-center justify-center rounded-md text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 text-sm"
              title="New project"
            >
              +
            </button>
          )}
        </div>
      </div>

      {/* View tabs */}
      <div className="flex border-b border-neutral-800/50 text-[11px] font-medium">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => switchView(t.id)}
            className={`flex-1 py-2 transition-colors relative ${
              view === t.id
                ? "text-cyan-400"
                : "text-neutral-500 hover:text-neutral-300"
            }`}
          >
            {t.label}
            {view === t.id && (
              <span className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full" />
            )}
          </button>
        ))}
      </div>

      {view === "files" && (
        <>
          {showNewProject && (
            <div className="px-3 py-2 border-b border-neutral-800 space-y-2">
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
                  className="flex-1 px-2 py-1 text-xs rounded bg-blue-700 hover:bg-blue-600 disabled:bg-neutral-800 disabled:text-neutral-500 text-white"
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
        <div className="flex-1 min-h-0">
          <SettingsPanel />
        </div>
      )}
    </div>
  );
}
