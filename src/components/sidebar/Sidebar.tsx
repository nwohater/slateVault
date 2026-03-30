"use client";

import { useState } from "react";
import { useVaultStore } from "@/stores/vaultStore";
import { FileTree } from "./FileTree";
import { SearchBar } from "./SearchBar";
import { GitPanel } from "../git/GitPanel";
import { SettingsPanel } from "../settings/SettingsPanel";

type SidebarView = "files" | "git" | "settings";

export function Sidebar() {
  const vaultName = useVaultStore((s) => s.vaultName);
  const createProject = useVaultStore((s) => s.createProject);
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [view, setView] = useState<SidebarView>("files");

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;
    await createProject(newProjectName.trim());
    setNewProjectName("");
    setShowNewProject(false);
  };

  const tabs: { id: SidebarView; label: string }[] = [
    { id: "files", label: "Files" },
    { id: "git", label: "Git" },
    { id: "settings", label: "Settings" },
  ];

  return (
    <div className="flex flex-col h-full bg-neutral-900 border-r border-neutral-800">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-800">
        <span className="text-sm font-semibold text-neutral-200 truncate">
          {vaultName || "slateVault"}
        </span>
        <div className="flex items-center gap-1">
          {view === "files" && (
            <button
              onClick={() => setShowNewProject(!showNewProject)}
              className="text-neutral-400 hover:text-neutral-200 text-lg leading-none"
              title="New project"
            >
              +
            </button>
          )}
        </div>
      </div>

      {/* View tabs */}
      <div className="flex border-b border-neutral-800 text-xs">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setView(t.id)}
            className={`flex-1 py-1.5 transition-colors ${
              view === t.id
                ? "text-neutral-100 border-b border-blue-500"
                : "text-neutral-500 hover:text-neutral-300"
            }`}
          >
            {t.label}
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
