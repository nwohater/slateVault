"use client";

import { useMemo } from "react";
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
    <div className="workspace-subsection rounded-2xl p-4">
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
  const toggleProject = useVaultStore((s) => s.toggleProject);
  const expandedProjects = useVaultStore((s) => s.expandedProjects);
  const setWorkspaceView = useUIStore((s) => s.setWorkspaceView);
  const setShowOnboarding = useUIStore((s) => s.setShowOnboarding);

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

  return (
    <div className="workspace-page h-full overflow-y-auto px-6 py-6">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <section className="workspace-hero rounded-3xl p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl">
              <div className="workspace-kicker mb-3">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
                Project memory backed by git
              </div>
              <h1 className="workspace-label text-3xl font-semibold tracking-tight text-neutral-100">
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
                className="workspace-action rounded-2xl px-4 py-3 text-left transition-colors"
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
                className="workspace-action rounded-2xl px-4 py-3 text-left transition-colors"
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
                className="workspace-action rounded-2xl px-4 py-3 text-left transition-colors"
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
                  setWorkspaceView("docs-health");
                }}
                className="workspace-action rounded-2xl px-4 py-3 text-left transition-colors"
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
                className="workspace-action rounded-2xl px-4 py-3 text-left transition-colors"
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
          <div className="workspace-stat rounded-2xl p-4">
            <div className="workspace-stat-label">
              Projects
            </div>
            <div className="mt-2 text-2xl font-semibold text-neutral-100">
              {stats?.project_count ?? projects.length}
            </div>
          </div>
          <div className="workspace-stat rounded-2xl p-4">
            <div className="workspace-stat-label">
              Documents
            </div>
            <div className="mt-2 text-2xl font-semibold text-neutral-100">
              {stats?.doc_count ?? 0}
            </div>
          </div>
          <div className="workspace-stat rounded-2xl p-4">
            <div className="workspace-stat-label">
              Team Sync
            </div>
            <div className="mt-2 text-sm font-medium text-neutral-200">
              {stats?.remote_url ? "Connected" : "Not connected"}
            </div>
            <div className="mt-1 text-[11px] text-neutral-500">
              {stats?.remote_url ? stats.remote_branch : "Set a remote when ready"}
            </div>
          </div>
          <div className="workspace-stat rounded-2xl p-4">
            <div className="workspace-stat-label">
              MCP Server
            </div>
            <div className="mt-2 text-sm font-medium text-neutral-200">
              {stats?.mcp_enabled ? "Enabled" : "Disabled"}
            </div>
            <div className="mt-1 text-[11px] text-neutral-500">
              {stats?.mcp_enabled
                ? `Available on port ${stats.mcp_port}`
                : "Configure in Settings → MCP Server"}
            </div>
          </div>
        </section>

        <section className="workspace-section rounded-3xl p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-neutral-100">Projects</h2>
              <p className="mt-1 text-xs text-neutral-500">
                Open a project workspace to start editing docs.
              </p>
            </div>
          </div>

          {sortedProjects.length === 0 ? (
            <div className="workspace-empty rounded-2xl px-5 py-10 text-center">
              <h3 className="text-sm font-medium text-neutral-200">
                No projects yet
              </h3>
              <p className="mx-auto mt-2 max-w-md text-xs leading-5 text-neutral-500">
                Use the onboarding flow to create your first project with a template, description, and source folder.
              </p>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {sortedProjects.map((project) => (
                <ProjectCard
                  key={project.name}
                  project={project}
                  onOpen={openProject}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
