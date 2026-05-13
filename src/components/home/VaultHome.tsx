"use client";

import { useMemo } from "react";
import { useVaultStore } from "@/stores/vaultStore";
import { useUIStore } from "@/stores/uiStore";
import type { ProjectInfo } from "@/types";

function formatPath(path: string | null) {
  if (!path) return "";
  return path.length > 70 ? `...${path.slice(-67)}` : path;
}

function ProjectCard({ project, onOpen }: { project: ProjectInfo; onOpen: (name: string) => void }) {
  return (
    <div className="workspace-subsection" style={{ borderRadius: "var(--radius-md)", padding: 16 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <h3 style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {project.name}
          </h3>
          <p style={{ marginTop: 4, fontSize: 12, color: "var(--text-muted)" }}>
            {project.description || "No description yet."}
          </p>
        </div>
        <span className="chip">
          {project.folder_order.length > 0 ? "Structured" : "New"}
        </span>
      </div>

      {project.tags.length > 0 && (
        <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 4 }}>
          {project.tags.slice(0, 4).map((tag) => (
            <span key={tag} className="chip" style={{ fontSize: 10 }}>{tag}</span>
          ))}
        </div>
      )}

      <div style={{ marginTop: 14, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <span style={{ fontSize: 11, color: "var(--text-faint)" }}>Project memory space</span>
        <button className="btn primary sm" onClick={() => onOpen(project.name)}>Open</button>
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
    if (!expandedProjects.has(projectName)) toggleProject(projectName);
    setShowOnboarding(false);
    setWorkspaceView("documents");
  };

  const quickActions = [
    { label: "Open documents",  desc: "Jump into the project tree and editor",          view: "documents"    as const },
    { label: "Search vault",    desc: "Find docs across every project",                  view: "search"       as const },
    { label: "Start session",   desc: "Prepare trusted context before coding work",      view: "start-session" as const },
    { label: "Docs health",     desc: "Review stale docs and coverage gaps",             view: "docs-health"  as const },
    { label: "Team sync",       desc: "Commit, pull, push, and review shared docs",      view: "sync"         as const },
  ];

  return (
    <div className="workspace-page" style={{ height: "100%", minWidth: 0, flex: 1, overflowY: "auto", padding: "24px" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 20, width: "100%" }}>

        {/* ── Hero ── */}
        <section className="workspace-hero" style={{ borderRadius: "var(--radius-lg)", padding: 24 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
              <div style={{ maxWidth: 480 }}>
                <div className="chip accent" style={{ marginBottom: 12 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent)", flexShrink: 0 }} />
                  Git-backed project memory
                </div>
                <h1 style={{ fontSize: 26, fontWeight: 600, letterSpacing: "-0.02em", color: "var(--text)", margin: 0 }}>
                  {vaultName || "Your vault"}
                </h1>
                <p style={{ marginTop: 8, fontSize: 13.5, lineHeight: 1.65, color: "var(--text-muted)" }}>
                  Keep software project docs in one shared markdown vault, then
                  use them during implementation work and agent workflows.
                </p>
                {vaultPath && (
                  <p style={{ marginTop: 6, fontSize: 11, color: "var(--text-faint)", fontFamily: "var(--font-mono)" }}>
                    {formatPath(vaultPath)}
                  </p>
                )}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, minWidth: 280 }}>
                {quickActions.map(({ label, desc, view }) => (
                  <button
                    key={view}
                    className="workspace-action"
                    style={{ borderRadius: "var(--radius)", padding: "10px 12px", textAlign: "left" }}
                    onClick={() => { setShowOnboarding(false); setWorkspaceView(view); }}
                  >
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text)" }}>{label}</div>
                    <div style={{ marginTop: 3, fontSize: 11, color: "var(--text-muted)" }}>{desc}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── Stats ── */}
        <section style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
          {[
            {
              label: "Projects",
              value: String(stats?.project_count ?? projects.length),
              sub: null,
            },
            {
              label: "Documents",
              value: String(stats?.doc_count ?? 0),
              sub: null,
            },
            {
              label: "Team Sync",
              value: stats?.remote_url ? "Connected" : "Not connected",
              sub: stats?.remote_url ? stats.remote_branch : "Set a remote when ready",
            },
            {
              label: "MCP Server",
              value: stats?.mcp_enabled ? "Enabled" : "Disabled",
              sub: stats?.mcp_enabled ? `Port ${stats.mcp_port}` : "Configure in Settings",
            },
          ].map(({ label, value, sub }) => (
            <div key={label} className="workspace-stat" style={{ borderRadius: "var(--radius-md)", padding: 16 }}>
              <div className="workspace-stat-label">{label}</div>
              <div style={{ marginTop: 8, fontSize: 20, fontWeight: 600, color: "var(--text)" }}>{value}</div>
              {sub && <div style={{ marginTop: 4, fontSize: 11, color: "var(--text-faint)" }}>{sub}</div>}
            </div>
          ))}
        </section>

        {/* ── Projects ── */}
        <section className="workspace-section" style={{ borderRadius: "var(--radius-lg)", padding: 20 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 600, color: "var(--text)", margin: 0 }}>Projects</h2>
              <p style={{ marginTop: 3, fontSize: 12, color: "var(--text-muted)" }}>
                Open a project workspace to start editing docs.
              </p>
            </div>
          </div>

          {sortedProjects.length === 0 ? (
            <div className="workspace-empty" style={{ borderRadius: "var(--radius-md)", padding: "40px 20px", textAlign: "center" }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", margin: 0 }}>No projects yet</h3>
              <p style={{ margin: "8px auto 0", maxWidth: 380, fontSize: 12, lineHeight: 1.6, color: "var(--text-muted)" }}>
                Use the onboarding flow to create your first project with a template, description, and source folder.
              </p>
              <button
                className="btn primary"
                style={{ marginTop: 16 }}
                onClick={() => { setShowOnboarding(true); setWorkspaceView("home"); }}
              >
                Start setup
              </button>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
              {sortedProjects.map((project) => (
                <ProjectCard key={project.name} project={project} onOpen={openProject} />
              ))}
            </div>
          )}
        </section>

      </div>
    </div>
  );
}
