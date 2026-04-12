"use client";

import { useMemo, useState } from "react";
import { useVaultStore } from "@/stores/vaultStore";
import { useUIStore } from "@/stores/uiStore";
import type { ProjectInfo } from "@/types";

function formatPath(path: string | null) {
  if (!path) return "";
  return path.length > 70 ? `...${path.slice(-67)}` : path;
}

function ProjectCard({
  project,
  onOpen,
}: {
  project: ProjectInfo;
  onOpen: (projectName: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900/70 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-neutral-100">
            {project.name}
          </h3>
          <p className="mt-1 text-xs text-neutral-500">
            {project.description || "No description yet."}
          </p>
        </div>
        <span className="rounded-full border border-neutral-700 px-2 py-0.5 text-[10px] text-neutral-400">
          {project.folder_order.length > 0 ? "Structured" : "New"}
        </span>
      </div>

      {project.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {project.tags.slice(0, 4).map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-neutral-800 px-2 py-0.5 text-[10px] text-neutral-400"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="text-[11px] text-neutral-500">
          Project memory space ready for docs
        </div>
        <button
          onClick={() => onOpen(project.name)}
          className="rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-cyan-500"
        >
          Open
        </button>
      </div>
    </div>
  );
}

export function VaultHome() {
  const vaultName = useVaultStore((s) => s.vaultName);
  const vaultPath = useVaultStore((s) => s.vaultPath);
  const projects = useVaultStore((s) => s.projects);
  const stats = useVaultStore((s) => s.stats);
  const createProject = useVaultStore((s) => s.createProject);
  const loadProjects = useVaultStore((s) => s.loadProjects);
  const loadStats = useVaultStore((s) => s.loadStats);
  const toggleProject = useVaultStore((s) => s.toggleProject);
  const expandedProjects = useVaultStore((s) => s.expandedProjects);
  const setWorkspaceView = useUIStore((s) => s.setWorkspaceView);
  const setShowOnboarding = useUIStore((s) => s.setShowOnboarding);
  const [isCreating, setIsCreating] = useState(false);
  const [projectName, setProjectName] = useState("");

  const sortedProjects = useMemo(
    () => [...projects].sort((a, b) => a.name.localeCompare(b.name)),
    [projects]
  );

  const openProject = async (projectName: string) => {
    if (!expandedProjects.has(projectName)) {
      toggleProject(projectName);
    }
    setShowOnboarding(false);
    setWorkspaceView("documents");
  };

  const handleCreateProject = async () => {
    const name = projectName.trim();
    if (!name) return;

    setIsCreating(true);
    try {
      await createProject(name);
      await loadProjects();
      await loadStats();
      setProjectName("");
      await openProject(name);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-neutral-950">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-6">
        <section className="rounded-3xl border border-neutral-800 bg-[linear-gradient(135deg,rgba(10,18,24,0.95),rgba(23,23,23,0.92))] p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-900/60 bg-cyan-950/40 px-3 py-1 text-[11px] text-cyan-300">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
                Project memory backed by git
              </div>
              <h1 className="text-2xl font-semibold tracking-tight text-neutral-100">
                {vaultName || "Your vault"}
              </h1>
              <p className="mt-2 text-sm leading-6 text-neutral-400">
                Keep software project docs in one shared markdown vault, then
                use them during implementation work and future agent workflows.
              </p>
              <p className="mt-3 text-xs text-neutral-600">
                {formatPath(vaultPath)}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 lg:min-w-[320px]">
              <button
                onClick={() => {
                  setShowOnboarding(false);
                  setWorkspaceView("documents");
                }}
                className="rounded-2xl border border-neutral-800 bg-neutral-900 px-4 py-3 text-left transition-colors hover:border-neutral-700 hover:bg-neutral-800"
              >
                <div className="text-xs font-medium text-neutral-200">
                  Open documents
                </div>
                <div className="mt-1 text-[11px] text-neutral-500">
                  Jump into the project tree and editor
                </div>
              </button>
              <button
                onClick={() => {
                  setShowOnboarding(false);
                  setWorkspaceView("search");
                }}
                className="rounded-2xl border border-neutral-800 bg-neutral-900 px-4 py-3 text-left transition-colors hover:border-neutral-700 hover:bg-neutral-800"
              >
                <div className="text-xs font-medium text-neutral-200">
                  Search vault
                </div>
                <div className="mt-1 text-[11px] text-neutral-500">
                  Find docs across every project
                </div>
              </button>
              <button
                onClick={() => {
                  setShowOnboarding(false);
                  setWorkspaceView("start-session");
                }}
                className="rounded-2xl border border-neutral-800 bg-neutral-900 px-4 py-3 text-left transition-colors hover:border-neutral-700 hover:bg-neutral-800"
              >
                <div className="text-xs font-medium text-neutral-200">
                  Start session
                </div>
                <div className="mt-1 text-[11px] text-neutral-500">
                  Prepare trusted context before coding work starts
                </div>
              </button>
              <button
                onClick={() => {
                  setShowOnboarding(false);
                  setWorkspaceView("agent-access");
                }}
                className="rounded-2xl border border-neutral-800 bg-neutral-900 px-4 py-3 text-left transition-colors hover:border-neutral-700 hover:bg-neutral-800"
              >
                <div className="text-xs font-medium text-neutral-200">
                  Agent access
                </div>
                <div className="mt-1 text-[11px] text-neutral-500">
                  Connect coding agents to the active vault
                </div>
              </button>
              <button
                onClick={() => {
                  setShowOnboarding(false);
                  setWorkspaceView("docs-health");
                }}
                className="rounded-2xl border border-neutral-800 bg-neutral-900 px-4 py-3 text-left transition-colors hover:border-neutral-700 hover:bg-neutral-800"
              >
                <div className="text-xs font-medium text-neutral-200">
                  Docs health
                </div>
                <div className="mt-1 text-[11px] text-neutral-500">
                  Review stale docs and coverage gaps
                </div>
              </button>
              <button
                onClick={() => {
                  setShowOnboarding(false);
                  setWorkspaceView("sync");
                }}
                className="rounded-2xl border border-neutral-800 bg-neutral-900 px-4 py-3 text-left transition-colors hover:border-neutral-700 hover:bg-neutral-800"
              >
                <div className="text-xs font-medium text-neutral-200">
                  Team sync
                </div>
                <div className="mt-1 text-[11px] text-neutral-500">
                  Commit, pull, push, and review shared docs
                </div>
              </button>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
            <div className="text-[11px] uppercase tracking-wide text-neutral-500">
              Projects
            </div>
            <div className="mt-2 text-2xl font-semibold text-neutral-100">
              {stats?.project_count ?? projects.length}
            </div>
          </div>
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
            <div className="text-[11px] uppercase tracking-wide text-neutral-500">
              Documents
            </div>
            <div className="mt-2 text-2xl font-semibold text-neutral-100">
              {stats?.doc_count ?? 0}
            </div>
          </div>
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
            <div className="text-[11px] uppercase tracking-wide text-neutral-500">
              Team Sync
            </div>
            <div className="mt-2 text-sm font-medium text-neutral-200">
              {stats?.remote_url ? "Connected" : "Not connected"}
            </div>
            <div className="mt-1 text-[11px] text-neutral-500">
              {stats?.remote_url ? stats.remote_branch : "Set a remote when ready"}
            </div>
          </div>
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
            <div className="text-[11px] uppercase tracking-wide text-neutral-500">
              Agent Access
            </div>
            <div className="mt-2 text-sm font-medium text-neutral-200">
              {stats?.mcp_enabled ? "Enabled" : "Disabled"}
            </div>
            <div className="mt-1 text-[11px] text-neutral-500">
              {stats?.mcp_enabled
                ? `MCP available on port ${stats.mcp_port}`
                : "Enable when you want agents to read the vault"}
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="rounded-3xl border border-neutral-800 bg-neutral-900/70 p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-neutral-100">
                  Projects
                </h2>
                <p className="mt-1 text-xs text-neutral-500">
                  Open a project workspace or start a new one.
                </p>
              </div>
            </div>

            {sortedProjects.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-neutral-800 bg-neutral-950/60 px-5 py-10 text-center">
                <h3 className="text-sm font-medium text-neutral-200">
                  Create your first project memory space
                </h3>
                <p className="mx-auto mt-2 max-w-md text-xs leading-5 text-neutral-500">
                  Start with architecture, decisions, runbooks, and handoff
                  docs so future work has a reliable place to begin.
                </p>
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {sortedProjects.map((project) => (
                  <ProjectCard
                    key={project.name}
                    project={project}
                    onOpen={openProject}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-neutral-800 bg-neutral-900/70 p-5">
            <h2 className="text-lg font-semibold text-neutral-100">
              Quick actions
            </h2>
            <p className="mt-1 text-xs text-neutral-500">
              Keep moving without dropping into low-level setup first.
            </p>

            <div className="mt-5 space-y-4">
              <div>
                <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-neutral-500">
                  Create project
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void handleCreateProject();
                    }}
                    placeholder="project-name"
                    className="flex-1 rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-200 placeholder-neutral-600 outline-none focus:border-cyan-600"
                  />
                  <button
                    onClick={() => void handleCreateProject()}
                    disabled={isCreating || !projectName.trim()}
                    className="rounded-xl bg-cyan-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-cyan-500 disabled:bg-neutral-800 disabled:text-neutral-500"
                  >
                    {isCreating ? "Creating..." : "Create"}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <button
                  onClick={() => {
                    setShowOnboarding(false);
                    setWorkspaceView("start-session");
                  }}
                  className="w-full rounded-2xl border border-neutral-800 bg-neutral-950 px-4 py-3 text-left transition-colors hover:border-neutral-700 hover:bg-neutral-900"
                >
                  <div className="text-xs font-medium text-neutral-200">
                    Start Session
                  </div>
                  <div className="mt-1 text-[11px] text-neutral-500">
                    Generate a project brief and recommended reading list.
                  </div>
                </button>
                <button
                  onClick={() => {
                    setShowOnboarding(false);
                    setWorkspaceView("agent-access");
                  }}
                  className="w-full rounded-2xl border border-neutral-800 bg-neutral-950 px-4 py-3 text-left transition-colors hover:border-neutral-700 hover:bg-neutral-900"
                >
                  <div className="text-xs font-medium text-neutral-200">
                    Open agent access
                  </div>
                  <div className="mt-1 text-[11px] text-neutral-500">
                    Review MCP status, setup steps, and agent-safe defaults.
                  </div>
                </button>
                <button
                  onClick={() => {
                    setShowOnboarding(false);
                    setWorkspaceView("search");
                  }}
                  className="w-full rounded-2xl border border-neutral-800 bg-neutral-950 px-4 py-3 text-left transition-colors hover:border-neutral-700 hover:bg-neutral-900"
                >
                  <div className="text-xs font-medium text-neutral-200">
                    Search across the vault
                  </div>
                  <div className="mt-1 text-[11px] text-neutral-500">
                    Find architecture notes, specs, and decisions quickly.
                  </div>
                </button>
                <button
                  onClick={() => {
                    setShowOnboarding(false);
                    setWorkspaceView("docs-health");
                  }}
                  className="w-full rounded-2xl border border-neutral-800 bg-neutral-950 px-4 py-3 text-left transition-colors hover:border-neutral-700 hover:bg-neutral-900"
                >
                  <div className="text-xs font-medium text-neutral-200">
                    Review docs health
                  </div>
                  <div className="mt-1 text-[11px] text-neutral-500">
                    See stale docs, status mix, and project-level gaps.
                  </div>
                </button>
                <button
                  onClick={() => {
                    setShowOnboarding(false);
                    setWorkspaceView("sync");
                  }}
                  className="w-full rounded-2xl border border-neutral-800 bg-neutral-950 px-4 py-3 text-left transition-colors hover:border-neutral-700 hover:bg-neutral-900"
                >
                  <div className="text-xs font-medium text-neutral-200">
                    Open team sync
                  </div>
                  <div className="mt-1 text-[11px] text-neutral-500">
                    Manage branches, commits, remotes, and pull requests.
                  </div>
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
