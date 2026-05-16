"use client";

import { useEffect, useState } from "react";
import { useVaultStore } from "@/stores/vaultStore";
import { useSessionStore } from "@/stores/sessionStore";
import * as commands from "@/lib/commands";
import { copyToClipboard } from "@/lib/clipboard";

// ─── Monogram helpers ────────────────────────────────────────────────────────

const MONOGRAM_COLORS = [
  "#b8442a",
  "#3b6ea5",
  "#2e7d4f",
  "#7d5a2e",
  "#6b3fa0",
  "#2e6b7d",
];

function hashName(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) >>> 0;
  }
  return h;
}

function monogramColor(name: string): string {
  return MONOGRAM_COLORS[hashName(name) % MONOGRAM_COLORS.length] ?? "#3b6ea5";
}

function initials(name: string): string {
  const parts = name.trim().split(/[\s\-_]+/);
  if (parts.length >= 2) {
    return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

// ─── Doc counts per project ───────────────────────────────────────────────────

interface DocCounts {
  total: number;
  canonical: number;
  recent: number;
}

// ─── SVG icons ───────────────────────────────────────────────────────────────

function IconCheck({ color = "currentColor" }: { color?: string }) {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <path
        d="M2.5 6.5L5.5 9.5L10.5 3.5"
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconSparkle({ size = 16, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path
        d="M8 1.5L9.2 6.8L14.5 8L9.2 9.2L8 14.5L6.8 9.2L1.5 8L6.8 6.8L8 1.5Z"
        fill={color}
      />
    </svg>
  );
}

function IconFile({ size = 13, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 13 13" fill="none">
      <rect x="2" y="1" width="7" height="10" rx="1" stroke={color} strokeWidth="1.2" />
      <path d="M4 4.5H8M4 6.5H8M4 8.5H6.5" stroke={color} strokeWidth="1" strokeLinecap="round" />
    </svg>
  );
}

function IconCopy({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none">
      <rect x="1" y="3" width="7" height="8" rx="1" stroke="currentColor" strokeWidth="1.2" />
      <path d="M4 3V2a1 1 0 011-1h5a1 1 0 011 1v7a1 1 0 01-1 1H9" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

function IconFolder({ size = 13, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 13 13" fill="none">
      <path
        d="M1.5 3.5a1 1 0 011-1H5l1.5 1.5H10.5a1 1 0 011 1V10a1 1 0 01-1 1H2.5a1 1 0 01-1-1V3.5z"
        stroke={color}
        strokeWidth="1.2"
      />
    </svg>
  );
}

function IconList({ size = 13, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 13 13" fill="none">
      <path d="M2 3.5H11M2 6.5H11M2 9.5H7" stroke={color} strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function IconShieldCheck({ size = 13, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 13 13" fill="none">
      <path
        d="M6.5 1.5L11 3.5V7C11 9.5 8.5 11.5 6.5 12C4.5 11.5 2 9.5 2 7V3.5L6.5 1.5Z"
        stroke={color}
        strokeWidth="1.2"
      />
      <path d="M4.5 6.5L6 8L8.5 5" stroke={color} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconClock({ size = 13, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 13 13" fill="none">
      <circle cx="6.5" cy="6.5" r="5" stroke={color} strokeWidth="1.2" />
      <path d="M6.5 3.5V6.5L8.5 8" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function IconEdit({ size = 13, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 13 13" fill="none">
      <path
        d="M8.5 2L11 4.5L4.5 11H2V8.5L8.5 2Z"
        stroke={color}
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconLock({ size = 11, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 11 11" fill="none">
      <rect x="2" y="5" width="7" height="5" rx="1" stroke={color} strokeWidth="1.1" />
      <path d="M3.5 5V3.5a2 2 0 014 0V5" stroke={color} strokeWidth="1.1" />
    </svg>
  );
}

// ─── Step indicator ───────────────────────────────────────────────────────────

interface StepProps {
  num: number;
  title: string;
  subtitle: string;
  done: boolean;
}

function Step({ num, title, subtitle, done }: StepProps) {
  return (
    <div
      style={{
        background: "var(--bg-panel)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: "10px 14px",
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        flex: 1,
        minWidth: 0,
      }}
    >
      <div
        style={{
          width: 22,
          height: 22,
          borderRadius: "50%",
          flexShrink: 0,
          background: done ? "var(--accent)" : "var(--bg-subtle)",
          border: done ? "none" : "1.5px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginTop: 1,
        }}
      >
        {done ? (
          <IconCheck color="#fff" />
        ) : (
          <span style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)" }}>{num}</span>
        )}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}>{title}</div>
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2, lineHeight: 1.5 }}>
          {subtitle}
        </div>
      </div>
    </div>
  );
}

// ─── File row ─────────────────────────────────────────────────────────────────

interface FileRowProps {
  path: string;
  description?: string;
  canonical?: boolean;
  isLast?: boolean;
}

function FileRow({ path, description, canonical, isLast }: FileRowProps) {
  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        padding: "8px 0",
        borderBottom: isLast ? "none" : "1px dashed var(--border-subtle)",
      }}
    >
      <div style={{ flexShrink: 0, marginTop: 2, color: "var(--text-faint)" }}>
        <IconFile />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <code style={{ fontSize: 11.5, fontFamily: "monospace", color: "var(--accent)" }}>
            {path}
          </code>
          {canonical && (
            <span style={{ flexShrink: 0, color: "var(--warning)" }}>
              <IconLock color="var(--warning)" />
            </span>
          )}
        </div>
        {description && (
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
            {description}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({
  icon,
  label,
  iconColor,
}: {
  icon: React.ReactNode;
  label: string;
  iconColor: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4 }}>
      <span style={{ color: iconColor, flexShrink: 0 }}>{icon}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{label}</span>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function StartSessionView() {
  const projects = useVaultStore((s) => s.projects);
  const selectedProject = useSessionStore((s) => s.selectedProject);
  const taskPrompt = useSessionStore((s) => s.taskPrompt);
  const includeCanonical = useSessionStore((s) => s.includeCanonical);
  const includeRecentChanges = useSessionStore((s) => s.includeRecentChanges);
  const includeSourceFolder = useSessionStore((s) => s.includeSourceFolder);
  const includeStaleWarnings = useSessionStore((s) => s.includeStaleWarnings);
  const projectBrief = useSessionStore((s) => s.projectBrief);
  const recommendedDocs = useSessionStore((s) => s.recommendedDocs);
  const recentChanges = useSessionStore((s) => s.recentChanges);
  const loading = useSessionStore((s) => s.loading);
  const hasGenerated = useSessionStore((s) => s.hasGenerated);
  const setSelectedProject = useSessionStore((s) => s.setSelectedProject);
  const setTaskPrompt = useSessionStore((s) => s.setTaskPrompt);
  const setIncludeCanonical = useSessionStore((s) => s.setIncludeCanonical);
  const setIncludeRecentChanges = useSessionStore((s) => s.setIncludeRecentChanges);
  const setIncludeSourceFolder = useSessionStore((s) => s.setIncludeSourceFolder);
  const setIncludeStaleWarnings = useSessionStore((s) => s.setIncludeStaleWarnings);
  const generateSession = useSessionStore((s) => s.generateSession);
  const buildExportText = useSessionStore((s) => s.buildExportText);

  const [docCounts, setDocCounts] = useState<Record<string, DocCounts>>({});
  const [copiedBrief, setCopiedBrief] = useState(false);
  const [generatedAt, setGeneratedAt] = useState<Date | null>(null);

  // Auto-select first project
  useEffect(() => {
    if (projects.length === 0) return;
    const stillExists = projects.some((p) => p.name === selectedProject);
    if (!selectedProject || !stillExists) {
      setSelectedProject(projects[0].name);
    }
  }, [projects, selectedProject, setSelectedProject]);

  // Load doc counts for all projects
  useEffect(() => {
    if (projects.length === 0) return;
    const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000;
    for (const p of projects) {
      commands
        .listDocuments(p.name)
        .then((docs) => {
          const substantive = docs.filter(
            (d) => !d.path.endsWith("/_about.md") && d.path !== "_about.md"
          );
          const canonical = substantive.filter((d) => d.canonical).length;
          const recent = substantive.filter((d) => Date.parse(d.modified) >= cutoff).length;
          setDocCounts((prev) => ({
            ...prev,
            [p.name]: { total: substantive.length, canonical, recent },
          }));
        })
        .catch(() => {});
    }
  }, [projects]);

  // Keyboard shortcut: Cmd+Enter / Ctrl+Enter
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        if (!loading && selectedProject) {
          void handleGenerate();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  const handleGenerate = async () => {
    await generateSession();
    const next = useSessionStore.getState();
    if (next.error || !next.hasGenerated) return;
    setGeneratedAt(new Date());
    await copyToClipboard(next.buildExportText());
    setCopiedBrief(true);
    window.setTimeout(() => setCopiedBrief(false), 2000);
  };

  const handleCopyBrief = async () => {
    await copyToClipboard(buildExportText());
    setCopiedBrief(true);
    window.setTimeout(() => setCopiedBrief(false), 2000);
  };

  const canGenerate = !loading && !!selectedProject;
  const counts = selectedProject ? docCounts[selectedProject] : undefined;
  const canonicalDocs = recommendedDocs.filter((d) => d.canonical);
  const implDocs = recommendedDocs.filter((d) => !d.canonical);
  const tokenCount = projectBrief ? Math.round(projectBrief.length / 3.8) : 0;
  const briefTitle = selectedProject
    ? `${selectedProject} · ${taskPrompt.slice(0, 50)}${taskPrompt.length > 50 ? "…" : ""}`
    : "Session brief";

  const suggestedPrompt = taskPrompt.trim()
    ? `Read the attached brief. ${taskPrompt.trim().charAt(0).toUpperCase() + taskPrompt.trim().slice(1)}${taskPrompt.trim().endsWith(".") ? "" : "."} Before writing code, check for conflicts with any canonical docs or constraints listed above.`
    : "Read the attached brief. Before writing code, check for conflicts with any canonical docs or constraints listed above.";

  return (
    <div className="workspace-page h-full min-w-0 flex-1 overflow-y-auto px-6 py-6">
      <div style={{ width: "100%", maxWidth: 1400, display: "flex", flexDirection: "column", gap: 20 }}>

        {/* ── Header ── */}
        <div>
          <div className="workspace-kicker" style={{ marginBottom: 10 }}>
            <span
              style={{
                display: "inline-block",
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: "var(--accent)",
                marginRight: 6,
              }}
            />
            Start Session
          </div>
          <h1
            style={{
              fontSize: 28,
              fontWeight: 700,
              letterSpacing: "-0.02em",
              color: "var(--text)",
              margin: 0,
              lineHeight: 1.2,
            }}
          >
            Hand off trusted project context to your coding agent.
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", maxWidth: 620, marginTop: 8, lineHeight: 1.6 }}>
            Pick a project, describe your task, and generate a scoped brief the assembler builds from
            canonical docs, recent edits, and vault-wide rules.
          </p>

          {/* Step row */}
          <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
            <Step
              num={1}
              title="Pick a project"
              subtitle="Which codebase anchors this session?"
              done={!!selectedProject}
            />
            <Step
              num={2}
              title="Describe the task"
              subtitle="A sentence or two is enough — the assembler reads tags &amp; history."
              done={taskPrompt.trim().length > 5}
            />
            <Step
              num={3}
              title="Generate brief"
              subtitle="A trusted, scoped context bundle."
              done={hasGenerated}
            />
          </div>
        </div>

        {/* ── Two-column layout ── */}
        <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>

          {/* ── Left column ── */}
          <div style={{ width: 360, flexShrink: 0, display: "flex", flexDirection: "column", gap: 16 }}>

            {/* PROJECT */}
            <div className="workspace-section rounded-2xl p-4">
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "var(--text-muted)",
                  marginBottom: 10,
                }}
              >
                Project
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {projects.map((p) => {
                  const selected = p.name === selectedProject;
                  const cnt = docCounts[p.name];
                  return (
                    <button
                      key={p.name}
                      onClick={() => setSelectedProject(p.name)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "10px 12px",
                        borderRadius: 10,
                        border: `1.5px solid ${selected ? "var(--accent)" : "var(--border)"}`,
                        background: selected ? "var(--accent-soft)" : "transparent",
                        cursor: "pointer",
                        textAlign: "left",
                        transition: "background 0.12s, border-color 0.12s",
                      }}
                    >
                      {/* Monogram */}
                      <div
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 6,
                          background: monogramColor(p.name),
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                          color: "#fff",
                          fontSize: 10,
                          fontWeight: 700,
                          letterSpacing: "0.02em",
                        }}
                      >
                        {initials(p.name)}
                      </div>
                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: "var(--text)",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {p.name}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>
                          {cnt ? `${cnt.total} docs · ${cnt.canonical} canonical` : "Loading…"}
                        </div>
                      </div>
                      {/* Checkmark */}
                      {selected && (
                        <div style={{ flexShrink: 0, color: "var(--accent)" }}>
                          <IconCheck color="var(--accent)" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* TASK FOCUS */}
            <div className="workspace-section rounded-2xl p-4">
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: 8,
                  marginBottom: 10,
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "var(--text-muted)",
                  }}
                >
                  Task Focus
                </div>
                <div
                  style={{
                    fontSize: 10,
                    color: "var(--text-faint)",
                    textAlign: "right",
                    maxWidth: 160,
                    lineHeight: 1.5,
                  }}
                >
                  The assembler matches your text to tags, ADRs, runbooks, and recent edits.
                </div>
              </div>
              <textarea
                value={taskPrompt}
                onChange={(e) => setTaskPrompt(e.target.value)}
                rows={4}
                placeholder="Authentication refactor, release workflow cleanup, PDF export investigation…"
                style={{
                  width: "100%",
                  borderRadius: 8,
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--border)",
                  color: "var(--text)",
                  fontSize: 12.5,
                  padding: "8px 10px",
                  resize: "vertical",
                  outline: "none",
                  fontFamily: "inherit",
                  boxSizing: "border-box",
                }}
              />
            </div>

            {/* INCLUDE */}
            <div className="workspace-section rounded-2xl p-4">
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "var(--text-muted)",
                  marginBottom: 12,
                }}
              >
                Include
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {/* Canonical docs */}
                <label style={{ display: "flex", alignItems: "flex-start", gap: 9, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={includeCanonical}
                    onChange={(e) => setIncludeCanonical(e.target.checked)}
                    style={{ accentColor: "var(--accent)", marginTop: 2, flexShrink: 0 }}
                  />
                  <div>
                    <div style={{ fontSize: 12.5, fontWeight: 500, color: "var(--text)" }}>
                      Canonical docs ({counts?.canonical ?? 0})
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>
                      ADRs, runbooks, system overview
                    </div>
                  </div>
                </label>
                {/* Recent edits */}
                <label style={{ display: "flex", alignItems: "flex-start", gap: 9, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={includeRecentChanges}
                    onChange={(e) => setIncludeRecentChanges(e.target.checked)}
                    style={{ accentColor: "var(--accent)", marginTop: 2, flexShrink: 0 }}
                  />
                  <div>
                    <div style={{ fontSize: 12.5, fontWeight: 500, color: "var(--text)" }}>
                      Recent edits, last 14 days
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>
                      {counts?.recent ?? 0} docs
                    </div>
                  </div>
                </label>
                {/* Wiki — always on */}
                <label style={{ display: "flex", alignItems: "flex-start", gap: 9, opacity: 0.7 }}>
                  <input
                    type="checkbox"
                    checked
                    disabled
                    style={{ accentColor: "var(--accent)", marginTop: 2, flexShrink: 0 }}
                  />
                  <div>
                    <div style={{ fontSize: 12.5, fontWeight: 500, color: "var(--text)" }}>
                      Wiki: AI coding rules + Secrets policy
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>
                      vault-wide guidance
                    </div>
                  </div>
                </label>
                {/* Source folder */}
                <label style={{ display: "flex", alignItems: "flex-start", gap: 9, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={includeSourceFolder}
                    onChange={(e) => setIncludeSourceFolder(e.target.checked)}
                    style={{ accentColor: "var(--accent)", marginTop: 2, flexShrink: 0 }}
                  />
                  <div>
                    <div style={{ fontSize: 12.5, fontWeight: 500, color: "var(--text)" }}>
                      Linked source folder
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>
                      adds source path for agent reference
                    </div>
                  </div>
                </label>
                {/* Attention warnings */}
                <label style={{ display: "flex", alignItems: "flex-start", gap: 9, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={includeStaleWarnings}
                    onChange={(e) => setIncludeStaleWarnings(e.target.checked)}
                    style={{ accentColor: "var(--accent)", marginTop: 2, flexShrink: 0 }}
                  />
                  <div>
                    <div style={{ fontSize: 12.5, fontWeight: 500, color: "var(--text)" }}>
                      Attention warnings
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>
                      stale doc flags
                    </div>
                  </div>
                </label>
              </div>
            </div>

            {/* Generate button */}
            <button
              onClick={() => void handleGenerate()}
              disabled={!canGenerate}
              style={{
                width: "100%",
                padding: "13px 16px",
                borderRadius: 12,
                border: "none",
                background: canGenerate ? "var(--accent)" : "var(--bg-subtle)",
                color: canGenerate ? "#fff" : "var(--text-muted)",
                cursor: canGenerate ? "pointer" : "not-allowed",
                opacity: !canGenerate ? 0.6 : 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                fontSize: 13.5,
                fontWeight: 600,
              }}
            >
              <IconSparkle size={14} color={canGenerate ? "#fff" : "var(--text-muted)"} />
              <span>
                {loading
                  ? "Assembling brief…"
                  : hasGenerated
                  ? "Regenerate brief"
                  : "Generate brief"}
              </span>
              <kbd
                style={{
                  fontFamily: "monospace",
                  fontSize: 10,
                  background: canGenerate ? "rgba(255,255,255,0.18)" : "var(--bg-subtle)",
                  borderRadius: 4,
                  padding: "1px 5px",
                  marginLeft: 2,
                  color: canGenerate ? "rgba(255,255,255,0.85)" : "var(--text-faint)",
                }}
              >
                ⌘↵
              </kbd>
            </button>
          </div>

          {/* ── Right column ── */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="workspace-section rounded-2xl" style={{ overflow: "hidden" }}>

              {/* Brief header bar */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "10px 16px",
                  borderBottom: "1px solid var(--border)",
                  background: "var(--bg-subtle)",
                }}
              >
                <span style={{ color: "var(--text-muted)", flexShrink: 0 }}>
                  <IconFile size={13} color="var(--text-muted)" />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 12.5,
                      fontWeight: 600,
                      color: "var(--text)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {hasGenerated ? briefTitle : "Session brief"}
                  </div>
                  {hasGenerated && (
                    <div style={{ fontSize: 10.5, color: "var(--text-faint)", marginTop: 1 }}>
                      {tokenCount} tokens · {recommendedDocs.length} docs · generated just now
                    </div>
                  )}
                </div>
                {hasGenerated && (
                  <button
                    onClick={() => void handleCopyBrief()}
                    className="btn sm"
                    style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 5 }}
                  >
                    <IconCopy />
                    {copiedBrief ? "Copied" : "Copy brief"}
                  </button>
                )}
              </div>

              {/* Brief content */}
              <div style={{ padding: "20px 24px" }}>

                {/* Loading */}
                {loading && (
                  <div>
                    <div
                      style={{ fontSize: 15, fontWeight: 600, color: "var(--text)", marginBottom: 16 }}
                    >
                      Assembling session brief…
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      {["Loading project context", "Checking canonical docs", "Reviewing recent changes", "Assembling brief"].map(
                        (step, i) => (
                          <div
                            key={i}
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: "50%",
                              background: "var(--accent)",
                              opacity: 0.3 + i * 0.2,
                            }}
                          />
                        )
                      )}
                    </div>
                    <div style={{ marginTop: 12, fontSize: 12, color: "var(--text-muted)", lineHeight: 2 }}>
                      {["Loading project context…", "Checking canonical docs…", "Reviewing recent changes…", "Assembling brief…"].map(
                        (step) => (
                          <div key={step}>{step}</div>
                        )
                      )}
                    </div>
                  </div>
                )}

                {/* Empty state */}
                {!loading && !hasGenerated && (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "60px 24px",
                      gap: 10,
                    }}
                  >
                    <span style={{ color: "var(--text-faint)", opacity: 0.5 }}>
                      <IconSparkle size={32} color="var(--text-faint)" />
                    </span>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-muted)" }}>
                      No brief yet
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-faint)", textAlign: "center" }}>
                      Pick a project, describe your task, then generate.
                    </div>
                  </div>
                )}

                {/* Generated state */}
                {!loading && hasGenerated && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

                    {/* 1. Brief title block */}
                    <div>
                      <div
                        style={{
                          fontSize: 10,
                          textTransform: "uppercase",
                          letterSpacing: "0.1em",
                          color: "var(--text-faint)",
                          fontWeight: 500,
                          marginBottom: 6,
                        }}
                      >
                        # SESSION BRIEF
                      </div>
                      <h2
                        style={{
                          fontSize: 20,
                          fontWeight: 700,
                          color: "var(--text)",
                          margin: 0,
                          lineHeight: 1.25,
                        }}
                      >
                        {selectedProject}
                        {taskPrompt
                          ? ` · ${taskPrompt.slice(0, 60)}${taskPrompt.length > 60 ? "…" : ""}`
                          : ""}
                      </h2>
                      <div style={{ fontSize: 11, fontFamily: "monospace", color: "var(--text-faint)", marginTop: 4 }}>
                        {generatedAt
                          ? `Generated ${generatedAt.toLocaleTimeString()} · ${recommendedDocs.length} source${recommendedDocs.length !== 1 ? "s" : ""}`
                          : `${recommendedDocs.length} source${recommendedDocs.length !== 1 ? "s" : ""}`}
                      </div>
                    </div>

                    {/* 2. Task block */}
                    {taskPrompt.trim() && (
                      <div
                        style={{
                          borderLeft: "3px solid var(--accent)",
                          borderRadius: "0 8px 8px 0",
                          background: "var(--accent-soft)",
                          padding: "12px 14px",
                          fontSize: 13,
                          color: "var(--text)",
                          lineHeight: 1.5,
                        }}
                      >
                        <strong>Task:</strong> {taskPrompt}
                      </div>
                    )}

                    {/* 3. Canonical anchors */}
                    {canonicalDocs.length > 0 && (
                      <div>
                        <SectionHeader
                          icon={<IconFolder color="var(--accent)" />}
                          label="Canonical anchors"
                          iconColor="var(--accent)"
                        />
                        {canonicalDocs.map((doc, i) => (
                          <FileRow
                            key={doc.path}
                            path={doc.path}
                            description={doc.reason}
                            canonical
                            isLast={i === canonicalDocs.length - 1}
                          />
                        ))}
                      </div>
                    )}

                    {/* 4. Implementation context */}
                    {implDocs.length > 0 && (
                      <div>
                        <SectionHeader
                          icon={<IconList color="var(--info)" />}
                          label="Implementation context"
                          iconColor="var(--info)"
                        />
                        {implDocs.map((doc, i) => (
                          <FileRow
                            key={doc.path}
                            path={doc.path}
                            description={doc.reason}
                            isLast={i === implDocs.length - 1}
                          />
                        ))}
                      </div>
                    )}

                    {/* 5. Vault-wide rules */}
                    <div>
                      <SectionHeader
                        icon={<IconShieldCheck color="var(--magic)" />}
                        label="Vault-wide rules to respect"
                        iconColor="var(--magic)"
                      />
                      <FileRow
                        path="wiki/ai-coding-rules.md"
                        description="Don't autocommit; ask before introducing new dependencies."
                      />
                      <FileRow
                        path="wiki/secrets-policy.md"
                        description="Never log session tokens. Never embed credentials in tests."
                        isLast
                      />
                    </div>

                    {/* 6. Recent activity */}
                    {recentChanges.length > 0 && (
                      <div>
                        <SectionHeader
                          icon={<IconClock color="var(--warning)" />}
                          label="Recent activity worth knowing"
                          iconColor="var(--warning)"
                        />
                        {recentChanges.slice(0, 4).map((change, i) => (
                          <div
                            key={`${change.project}/${change.path}/${change.modified}`}
                            style={{
                              display: "flex",
                              gap: 10,
                              padding: "8px 0",
                              borderBottom:
                                i === Math.min(recentChanges.length, 4) - 1
                                  ? "none"
                                  : "1px dashed var(--border-subtle)",
                            }}
                          >
                            <span style={{ color: "var(--text-faint)", flexShrink: 0, marginTop: 2 }}>
                              <IconEdit size={13} color="var(--text-faint)" />
                            </span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div
                                style={{
                                  fontSize: 12.5,
                                  color: "var(--text)",
                                  whiteSpace: "nowrap",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                }}
                              >
                                {change.title}
                              </div>
                              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                                {change.author} · {new Date(change.modified).toLocaleDateString()}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* 7. Suggested first prompt */}
                    <div
                      style={{
                        background: "var(--bg-subtle)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        padding: "14px 16px",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 11.5,
                          fontWeight: 600,
                          color: "var(--text)",
                          marginBottom: 8,
                        }}
                      >
                        Suggested first prompt
                      </div>
                      <div
                        style={{
                          fontFamily: "monospace",
                          fontSize: 11.5,
                          color: "var(--text-muted)",
                          lineHeight: 1.6,
                          whiteSpace: "pre-wrap",
                        }}
                      >
                        {suggestedPrompt}
                      </div>
                    </div>

                    {/* 8. MCP info footer */}
                    <div
                      style={{
                        background: "var(--info-soft)",
                        border: "1px solid var(--info-soft)",
                        borderRadius: 8,
                        padding: "12px 14px",
                        display: "flex",
                        gap: 8,
                        alignItems: "flex-start",
                      }}
                    >
                      <span style={{ color: "var(--info)", flexShrink: 0, marginTop: 1 }}>
                        <IconSparkle size={13} color="var(--info)" />
                      </span>
                      <span style={{ fontSize: 11, color: "var(--info)", lineHeight: 1.6 }}>
                        Agents already connected via MCP can read this brief directly — they don&apos;t need the clipboard copy.
                      </span>
                    </div>

                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
