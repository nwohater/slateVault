"use client";

import { useMemo, useEffect } from "react";
import { useVaultStore } from "@/stores/vaultStore";
import { useUIStore } from "@/stores/uiStore";
import { useEditorStore } from "@/stores/editorStore";
import type { ProjectInfo } from "@/types";

function formatPath(path: string | null) {
  if (!path) return "";
  return path.length > 60 ? `...${path.slice(-57)}` : path;
}

// Derive a stable accent color from project name
const PROJECT_COLORS = [
  "#7c6fcd", "#4f8ef7", "#3daa6e", "#e8834a", "#d45f8a",
  "#5aa8c4", "#b07a3e", "#6b9e4f", "#9966cc", "#c45b5b",
];
function projectColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return PROJECT_COLORS[h % PROJECT_COLORS.length];
}
function projectInitials(name: string) {
  return name.split(/[-_ ]+/).map(s => s[0] ?? "").join("").slice(0, 2).toUpperCase() || "??";
}

function StatCard({
  label, value, hint, tone = "ok", onClick,
}: {
  label: string; value: string; hint?: string | null;
  tone?: "ok" | "warn" | "bad"; onClick?: () => void;
}) {
  const hintColor = tone === "warn" ? "var(--warning)" : tone === "bad" ? "var(--danger)" : "var(--text-faint)";
  return (
    <button
      onClick={onClick}
      style={{
        textAlign: "left", padding: "14px 16px",
        background: "var(--bg-panel)", border: "1px solid var(--border)",
        borderRadius: 9, cursor: onClick ? "pointer" : "default",
        display: "flex", flexDirection: "column", gap: 4,
      }}
    >
      <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
        {label}
      </span>
      <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.01em", lineHeight: 1.1, marginTop: 2, color: "var(--text)" }}>
        {value}
      </div>
      {hint && <div style={{ fontSize: 11.5, color: hintColor }}>{hint}</div>}
    </button>
  );
}

function ProjectCard({ project, onOpen }: { project: ProjectInfo; onOpen: (name: string) => void }) {
  const color = projectColor(project.name);
  const initials = projectInitials(project.name);
  const documents = useVaultStore((s) => s.documents);
  const docCount = documents[project.name]?.length ?? null;
  return (
    <button
      onClick={() => onOpen(project.name)}
      style={{
        textAlign: "left", padding: 14,
        background: "var(--bg-panel)", border: "1px solid var(--border)",
        borderRadius: 9, display: "flex", flexDirection: "column", gap: 10,
        cursor: "pointer", width: "100%",
      }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--border-strong)")}
      onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border)")}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        <div style={{
          width: 26, height: 26, borderRadius: 6, background: color,
          color: "white", display: "grid", placeItems: "center",
          fontSize: 10.5, fontWeight: 700, fontFamily: "var(--font-mono)", flexShrink: 0,
        }}>
          {initials}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: "-0.005em", color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {project.name}
          </div>
          {project.tags.length > 0 && (
            <div style={{ fontSize: 11, color: "var(--text-faint)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {project.tags.slice(0, 3).join(" · ")}
            </div>
          )}
        </div>
        {project.folder_order.length === 0 && (
          <span className="chip" style={{ fontSize: 10 }}>New</span>
        )}
      </div>
      {project.description && (
        <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 }}>
          {project.description}
        </p>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 11, color: "var(--text-faint)" }}>
        <span><b style={{ color: "var(--text)" }}>{project.folder_order.length}</b> folders</span>
        <span><b style={{ color: "var(--text)" }}>{docCount !== null ? docCount : "…"}</b> docs</span>
        <span><b style={{ color: "var(--text)" }}>{project.tags.length}</b> tags</span>
      </div>
    </button>
  );
}

function JumpInPanel({ onNavigate }: { onNavigate: (view: string) => void }) {
  const items = [
    { title: "Start a coding session", desc: "Prepare trusted context for an AI agent.", view: "start-session", accent: true },
    { title: "Open Documents",         desc: "Edit and browse project docs.",            view: "documents" },
    { title: "Review Team Sync",        desc: "Commit, pull, push shared docs.",          view: "sync" },
    { title: "Check Docs Health",       desc: "Find stale docs and coverage gaps.",       view: "docs-health" },
  ];
  return (
    <div style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: 10, padding: 4 }}>
      <div style={{ padding: "10px 12px 6px", fontSize: 11, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>
        Jump in
      </div>
      {items.map((it) => (
        <button
          key={it.view}
          onClick={() => onNavigate(it.view)}
          style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "9px 10px", background: "transparent", border: "none", borderRadius: 6, textAlign: "left", marginBottom: 1, cursor: "pointer" }}
          onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-subtle)")}
          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
        >
          <div style={{
            width: 28, height: 28, borderRadius: 6,
            background: it.accent ? "var(--accent-soft)" : "var(--bg-tint)",
            color: it.accent ? "var(--accent)" : "var(--text-muted)",
            display: "grid", placeItems: "center", flexShrink: 0,
          }}>
            {it.accent ? (
              <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" /></svg>
            ) : (
              <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" /></svg>
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text)" }}>{it.title}</div>
            <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{it.desc}</div>
          </div>
          <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ color: "var(--text-faint)", flexShrink: 0 }}><path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" /></svg>
        </button>
      ))}
    </div>
  );
}

export function VaultHome() {
  const vaultName  = useVaultStore((s) => s.vaultName);
  const vaultPath  = useVaultStore((s) => s.vaultPath);
  const projects   = useVaultStore((s) => s.projects);
  const stats      = useVaultStore((s) => s.stats);
  const toggleProject    = useVaultStore((s) => s.toggleProject);
  const expandedProjects = useVaultStore((s) => s.expandedProjects);
  const setWorkspaceView = useUIStore((s) => s.setWorkspaceView);
  const setShowOnboarding = useUIStore((s) => s.setShowOnboarding);
  const setActiveProject = useEditorStore((s) => s.setActiveProject);

  const loadDocuments = useVaultStore((s) => s.loadDocuments);

  const sortedProjects = useMemo(
    () => [...projects].sort((a, b) => a.name.localeCompare(b.name)),
    [projects]
  );

  // Eagerly load doc counts for all projects so cards always show them
  useEffect(() => {
    for (const p of projects) loadDocuments(p.name);
  }, [projects]);

  const openProject = (projectName: string) => {
    if (!expandedProjects.has(projectName)) toggleProject(projectName);
    setActiveProject(projectName);
    setShowOnboarding(false);
    setWorkspaceView("documents");
  };

  const navigate = (view: string) => {
    setShowOnboarding(false);
    setWorkspaceView(view as Parameters<typeof setWorkspaceView>[0]);
  };

  const syncHint = stats?.remote_url
    ? stats.remote_branch ?? "connected"
    : "no remote configured";
  const syncTone = stats?.remote_url ? "ok" : "warn";

  return (
    <div style={{ height: "100%", minWidth: 0, flex: 1, overflowY: "auto", padding: "28px 36px 40px" }}>
      <div style={{ width: "100%", maxWidth: 1200, display: "flex", flexDirection: "column", gap: 24 }}>

        {/* ── Hero ── */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6, fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.657 4.03 3 9 3s9-1.343 9-3V5"/><path d="M3 12c0 1.657 4.03 3 9 3s9-1.343 9-3"/></svg>
            Vault
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 14, flexWrap: "wrap" }}>
            <h1 style={{ margin: 0, fontSize: 28, fontWeight: 600, letterSpacing: "-0.015em", color: "var(--text)" }}>
              {vaultName || "Your vault"}
            </h1>
            {vaultPath && (
              <span style={{ fontSize: 12.5, color: "var(--text-faint)", fontFamily: "var(--font-mono)" }}>
                {formatPath(vaultPath)}
              </span>
            )}
            <span className="chip success" style={{ height: 22, display: "inline-flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--success)", flexShrink: 0 }} />
              open
            </span>
          </div>
          <p style={{ marginTop: 8, fontSize: 13.5, color: "var(--text-muted)", maxWidth: 600, lineHeight: 1.55, margin: "8px 0 0" }}>
            {sortedProjects.length} project{sortedProjects.length !== 1 ? "s" : ""} · Git {stats?.remote_url ? `connected to ${stats.remote_branch ?? "remote"}` : "not connected"} · MCP {stats?.mcp_enabled ? `serving on port ${stats.mcp_port}` : "disabled"}.
          </p>
        </div>

        {/* ── Stats row ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          <StatCard label="Projects"    value={String(stats?.project_count ?? sortedProjects.length)} hint={`${sortedProjects.length} loaded`} />
          <StatCard label="Documents"   value={String(stats?.doc_count ?? 0)} hint="across all projects" />
          <StatCard label="Team Sync"   value={stats?.remote_url ? "Connected" : "No remote"} hint={syncHint} tone={syncTone as "ok" | "warn"} onClick={() => navigate("sync")} />
          <StatCard label="MCP Server"  value={stats?.mcp_enabled ? `Live · :${stats.mcp_port}` : "Off"} hint={stats?.mcp_enabled ? "agents connected" : "configure in Settings"} tone={stats?.mcp_enabled ? "ok" : "warn"} onClick={() => navigate("settings")} />
        </div>

        {/* ── Two-column body ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 20, alignItems: "start" }}>

          {/* Projects */}
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <h2 style={{ margin: 0, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)" }}>
                Projects
              </h2>
              <button className="btn sm" onClick={() => { setShowOnboarding(true); setWorkspaceView("home"); }}>
                + New project
              </button>
            </div>

            {sortedProjects.length === 0 ? (
              <div style={{ padding: "40px 20px", textAlign: "center", background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: 10 }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", margin: 0 }}>No projects yet</h3>
                <p style={{ margin: "8px auto 0", maxWidth: 340, fontSize: 12, lineHeight: 1.6, color: "var(--text-muted)" }}>
                  Use the setup flow to create your first project with a template, description, and source folder.
                </p>
                <button className="btn primary" style={{ marginTop: 16 }} onClick={() => { setShowOnboarding(true); setWorkspaceView("home"); }}>
                  Start setup
                </button>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
                {sortedProjects.map((project) => (
                  <ProjectCard key={project.name} project={project} onOpen={openProject} />
                ))}
              </div>
            )}
          </div>

          {/* Right sidebar */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <JumpInPanel onNavigate={navigate} />
          </div>

        </div>
      </div>
    </div>
  );
}
