"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import * as commands from "@/lib/commands";
import { useEditorStore } from "@/stores/editorStore";
import { useUIStore } from "@/stores/uiStore";
import { useVaultStore } from "@/stores/vaultStore";
import type { DocumentInfo } from "@/types";

type ProjectHealth = {
  name: string;
  docCount: number;
  canonicalCount: number;
  protectedCount: number;
  draftCount: number;
  reviewCount: number;
  finalCount: number;
  staleCount: number;
};

type VaultDoc = DocumentInfo & {
  project: string;
  ageDays: number;
};

type GapDoc = {
  project: string;
  path: string;
  title: string;
};

const STALE_DAYS = 45;
const PROJECT_COLORS = ["#c84a2f", "#2f7394", "#4f7f39", "#a36f10", "#7a56a4", "#5c6f82"];

function formatRelativeDays(ageDays: number) {
  if (ageDays <= 0) return "today";
  if (ageDays === 1) return "1 day ago";
  return `${ageDays} days ago`;
}

function getAgeDays(dateString: string) {
  const modified = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - modified.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

function includesAnchorPath(docs: DocumentInfo[], path: string) {
  return docs.some((doc) => doc.path === path || doc.path.endsWith(`/${path}`));
}

function statusRatio(count: number, total: number) {
  if (total === 0) return 0;
  return Math.max(8, Math.round((count / total) * 100));
}

export function DocsHealthView() {
  const projects = useVaultStore((s) => s.projects);
  const expandProject = useVaultStore((s) => s.expandProject);
  const openDocument = useEditorStore((s) => s.openDocument);
  const setShowOnboarding = useUIStore((s) => s.setShowOnboarding);
  const setWorkspaceView = useUIStore((s) => s.setWorkspaceView);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [projectDocs, setProjectDocs] = useState<Record<string, DocumentInfo[]>>({});
  // Map of "project/path" → timestamp when reviewed. Persisted in localStorage so it
  // survives navigation. If a doc is modified after being reviewed it reappears automatically.
  const [reviewedKeys, setReviewedKeys] = useState<Map<string, number>>(() => {
    try {
      const stored = localStorage.getItem("slatevault_reviewed_docs");
      if (stored) return new Map(JSON.parse(stored) as [string, number][]);
    } catch { /* ignore parse errors */ }
    return new Map();
  });
  const [creatingGap, setCreatingGap] = useState<string | null>(null);

  const loadHealth = useCallback(async (activeRef?: { active: boolean }) => {
    setLoading(true);
    try {
      const docsByProject = await Promise.all(
        projects.map(async (project) => {
          const docs = await commands.listDocuments(project.name);
          return [project.name, docs] as const;
        })
      );

      if (activeRef && !activeRef.active) return;

      setProjectDocs(Object.fromEntries(docsByProject));
      setError(null);
    } catch (err) {
      if (activeRef && !activeRef.active) return;
      setError(`Could not load docs health: ${err}`);
    } finally {
      if (!activeRef || activeRef.active) setLoading(false);
    }
  }, [projects]);

  useEffect(() => {
    const activeRef = { active: true };
    void loadHealth(activeRef);
    return () => {
      activeRef.active = false;
    };
  }, [loadHealth]);

  const allDocs = useMemo<VaultDoc[]>(
    () =>
      Object.entries(projectDocs).flatMap(([project, docs]) =>
        docs.map((doc) => ({
          project,
          ...doc,
          ageDays: getAgeDays(doc.modified),
        }))
      ),
    [projectDocs]
  );

  const projectHealth = useMemo<ProjectHealth[]>(() => {
    return projects
      .map((project) => {
        const docs = projectDocs[project.name] ?? [];
        return {
          name: project.name,
          docCount: docs.length,
          canonicalCount: docs.filter((doc) => doc.canonical).length,
          protectedCount: docs.filter((doc) => doc.protected).length,
          draftCount: docs.filter((doc) => doc.status === "draft").length,
          reviewCount: docs.filter((doc) => doc.status === "review").length,
          finalCount: docs.filter((doc) => doc.status === "final").length,
          staleCount: docs.filter((doc) => getAgeDays(doc.modified) >= STALE_DAYS).length,
        };
      })
      .sort((a, b) => {
        const aRisk = (a.canonicalCount === 0 ? 100 : 0) + a.staleCount;
        const bRisk = (b.canonicalCount === 0 ? 100 : 0) + b.staleCount;
        if (aRisk !== bRisk) return bRisk - aRisk;
        return a.name.localeCompare(b.name);
      });
  }, [projectDocs, projects]);

  const staleDocs = useMemo(() => {
    return allDocs
      .filter((doc) => {
        // _about.md are folder-description system files, not user docs
        if (doc.path === "_about.md" || doc.path.endsWith("/_about.md")) return false;
        if (doc.ageDays < STALE_DAYS) return false;
        // Only hide if reviewed *after* the doc was last modified
        const reviewedAt = reviewedKeys.get(`${doc.project}/${doc.path}`);
        if (reviewedAt !== undefined && reviewedAt >= new Date(doc.modified).getTime()) return false;
        return true;
      })
      .sort((a, b) => b.ageDays - a.ageDays)
      .slice(0, 12);
  }, [allDocs, reviewedKeys]);

  const summary = useMemo(() => {
    const totalDocs = allDocs.length;
    const totalProjects = projects.length;
    const projectsWithCanonical = projectHealth.filter((project) => project.canonicalCount > 0).length;
    const healthyProjects = projectHealth.filter((project) => project.canonicalCount > 0 && project.staleCount === 0).length;
    const atRiskProjects = projectHealth.filter((project) => project.docCount === 0 || project.canonicalCount === 0 || project.staleCount > 0);
    const canonicalDocs = allDocs.filter((doc) => doc.canonical).length;
    const protectedDocs = allDocs.filter((doc) => doc.protected).length;
    const draftDocs = allDocs.filter((doc) => doc.status === "draft").length;
    const reviewDocs = allDocs.filter((doc) => doc.status === "review").length;
    const finalDocs = allDocs.filter((doc) => doc.status === "final").length;

    return {
      totalDocs,
      totalProjects,
      projectsWithCanonical,
      healthyProjects,
      atRiskProjects,
      atRiskCount: atRiskProjects.length,
      canonicalDocs,
      protectedDocs,
      draftDocs,
      reviewDocs,
      finalDocs,
      staleCount: staleDocs.length,
      canonicalCoverage:
        totalProjects === 0 ? 0 : Math.round((projectsWithCanonical / totalProjects) * 100),
    };
  }, [allDocs, projectHealth, projects.length, staleDocs.length]);

  const primaryRisk = summary.atRiskProjects[0] ?? null;

  const canonicalGaps = useMemo<GapDoc[]>(() => {
    const gaps: GapDoc[] = [];
    for (const project of projectHealth) {
      const docs = projectDocs[project.name] ?? [];
      if (!includesAnchorPath(docs, "system-overview.md")) {
        gaps.push({
          project: project.name,
          path: "system-overview.md",
          title: "System Overview",
        });
      }
      if (!includesAnchorPath(docs, "release-process.md")) {
        gaps.push({
          project: project.name,
          path: "release-process.md",
          title: "Release Process",
        });
      }
    }
    return gaps.slice(0, 5);
  }, [projectDocs, projectHealth]);

  const statusBars = [
    { label: "draft", value: summary.draftDocs, color: "var(--text-muted)" },
    { label: "review", value: summary.reviewDocs, color: "var(--info)" },
    { label: "final", value: summary.finalDocs, color: "var(--success)" },
    { label: "canonical", value: summary.canonicalDocs, color: "var(--danger)" },
    { label: "protected", value: summary.protectedDocs, color: "var(--text-faint)" },
  ];

  const handleOpen = (project: string, path: string) => {
    expandProject(project);
    setShowOnboarding(false);
    setWorkspaceView("documents");
    void openDocument(project, path);
  };

  const handleMarkReviewed = (doc: VaultDoc) => {
    const key = `${doc.project}/${doc.path}`;
    setReviewedKeys((current) => {
      const next = new Map(current);
      next.set(key, Date.now());
      try {
        localStorage.setItem("slatevault_reviewed_docs", JSON.stringify([...next]));
      } catch { /* ignore storage errors */ }
      return next;
    });
  };

  const handleCreateGap = async (gap: GapDoc) => {
    const key = `${gap.project}/${gap.path}`;
    setCreatingGap(key);
    try {
      await commands.writeDocument(
        gap.project,
        gap.path,
        gap.title,
        `# ${gap.title}\n\n## Purpose\n\nDescribe the trusted project context agents and teammates should know before making changes.\n\n## Current State\n\n- \n\n## Maintenance Notes\n\n- Owner:\n- Review cadence:\n`,
        ["canonical", "anchor"],
        "slatevault",
        true,
        false,
        "draft"
      );
      await loadHealth();
      handleOpen(gap.project, gap.path);
    } catch (err) {
      setError(`Could not create ${gap.path}: ${err}`);
    } finally {
      setCreatingGap(null);
    }
  };

  return (
    <div className="workspace-page h-full min-w-0 flex-1 overflow-y-auto px-6 py-6">
      <div className="flex w-full max-w-[1500px] flex-col gap-6">
        <section className="px-1 py-2">
          <div className="workspace-kicker mb-3">
            <span className="text-base">~</span>
            Docs Health
          </div>
          <h1 className="max-w-4xl text-3xl font-semibold tracking-tight" style={{ color: "var(--text)" }}>
            Project memory looks {summary.atRiskCount > 0 ? "mostly trustworthy." : "trustworthy."}
          </h1>
          <p className="mt-4 max-w-4xl text-sm leading-6" style={{ color: "var(--text-muted)" }}>
            {loading
              ? "Checking project coverage, stale docs, and canonical anchors across the vault."
              : `${summary.healthyProjects} projects are healthy; ${primaryRisk ? `${primaryRisk.name} has ${primaryRisk.staleCount} stale docs${primaryRisk.canonicalCount === 0 ? " and is missing a canonical anchor" : ""}.` : "no project-level risks are currently standing out."} Agents start with better ground truth when these anchors stay fresh.`}
          </p>
        </section>

        {error && (
          <div className="rounded-lg px-4 py-3 text-sm" style={{ background: "var(--danger-soft)", border: "1px solid var(--danger)", color: "var(--danger)" }}>
            {error}
          </div>
        )}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <HealthStatCard
            label="Canonical coverage"
            value={`${summary.canonicalCoverage}%`}
            detail={`${summary.canonicalDocs} anchors across ${summary.totalProjects} projects`}
            accent="var(--success)"
          />
          <HealthStatCard
            label="Stale docs"
            value={summary.staleCount}
            detail={`not edited in ${STALE_DAYS}+ days`}
            accent="var(--warning)"
          />
          <HealthStatCard
            label="Total documents"
            value={summary.totalDocs}
            detail={`across ${summary.totalProjects} projects`}
            accent="var(--info)"
          />
          <HealthStatCard
            label="Projects at risk"
            value={summary.atRiskCount}
            detail={primaryRisk?.name || "none"}
            accent="var(--danger)"
          />
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="min-w-0">
            <h2 className="workspace-label mb-3 text-base font-semibold" style={{ color: "var(--text-muted)" }}>
              Per-project health
            </h2>
            <div className="panel overflow-hidden">
              <div className="grid grid-cols-[minmax(190px,1.4fr)_90px_120px_90px_minmax(150px,1fr)_76px] gap-4 border-b px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ borderColor: "var(--border-subtle)", color: "var(--text-muted)" }}>
                <div>Project</div>
                <div>Docs</div>
                <div>Canonical</div>
                <div>Stale</div>
                <div>Status mix</div>
                <div />
              </div>
              {loading ? (
                <div className="px-4 py-8 text-sm" style={{ color: "var(--text-muted)" }}>Loading project health...</div>
              ) : projectHealth.length === 0 ? (
                <div className="px-4 py-8 text-sm" style={{ color: "var(--text-muted)" }}>No projects found.</div>
              ) : (
                projectHealth.map((project, index) => (
                  <div
                    key={project.name}
                    className="grid grid-cols-[minmax(190px,1.4fr)_90px_120px_90px_minmax(150px,1fr)_76px] items-center gap-4 border-b px-4 py-4 text-sm last:border-b-0"
                    style={{ borderColor: "var(--border-subtle)" }}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="h-3 w-3 shrink-0 rounded-sm" style={{ background: PROJECT_COLORS[index % PROJECT_COLORS.length] }} />
                      <span className="truncate font-semibold" style={{ color: "var(--text)" }}>{project.name}</span>
                      {(project.canonicalCount === 0 || project.staleCount > 0) && (
                        <span className="chip warning shrink-0">at risk</span>
                      )}
                    </div>
                    <div style={{ color: "var(--text-muted)" }}>{project.docCount}</div>
                    <div style={{ color: project.canonicalCount === 0 ? "var(--danger)" : "var(--text)" }}>{project.canonicalCount}</div>
                    <div style={{ color: project.staleCount > 0 ? "var(--warning)" : "var(--text-muted)" }}>
                      {project.staleCount > 0 ? project.staleCount : "-"}
                    </div>
                    <StatusMix project={project} />
                    <button
                      onClick={() => {
                        expandProject(project.name);
                        setShowOnboarding(false);
                        setWorkspaceView("documents");
                      }}
                      className="btn justify-center"
                    >
                      Open
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="mt-6">
              <h2 className="workspace-label mb-3 text-base font-semibold" style={{ color: "var(--text-muted)" }}>
                Docs needing attention
              </h2>
              <div className="panel overflow-hidden">
                {staleDocs.length === 0 ? (
                  <div className="px-5 py-8 text-sm" style={{ color: "var(--text-muted)" }}>No stale docs need attention right now.</div>
                ) : (
                  staleDocs.map((doc, index) => (
                    <div
                      key={`${doc.project}/${doc.path}`}
                      className="flex items-center gap-4 px-5 py-4"
                      style={{ borderTop: index === 0 ? "none" : "1px solid var(--border-subtle)" }}
                    >
                      <span className="h-12 w-1 shrink-0 rounded-full" style={{ background: "var(--warning)" }} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate font-mono text-sm font-semibold" style={{ color: "var(--text)" }}>{doc.path}</span>
                          <span className="chip">{doc.project}</span>
                          {doc.canonical && <span className="chip warning">canonical</span>}
                          {doc.protected && <span className="chip danger">protected</span>}
                        </div>
                        <div className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
                          <span style={{ color: "var(--warning)" }}>{formatRelativeDays(doc.ageDays)}</span>
                          <span> - last touched by {doc.author}</span>
                        </div>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <button onClick={() => handleOpen(doc.project, doc.path)} className="btn">
                          Open
                        </button>
                        <button onClick={() => handleMarkReviewed(doc)} className="btn">
                          Mark reviewed
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <aside className="space-y-5">
            <section className="panel p-5">
              <h2 className="workspace-label text-sm font-semibold" style={{ color: "var(--text-muted)" }}>
                Status across vault
              </h2>
              <div className="mt-5 flex h-32 items-end gap-3">
                {statusBars.map((bar) => (
                  <div key={bar.label} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                    <div className="text-sm font-semibold tabular-nums" style={{ color: "var(--text)" }}>{bar.value}</div>
                    <div
                      className="w-full rounded-t"
                      style={{
                        height: `${Math.max(12, statusRatio(bar.value, summary.totalDocs))}%`,
                        background: bar.color,
                      }}
                    />
                    <div className="truncate text-[11px]" style={{ color: "var(--text-muted)" }}>{bar.label}</div>
                  </div>
                ))}
              </div>
            </section>

            <section className="panel p-5">
              <h2 className="workspace-label text-sm font-semibold" style={{ color: "var(--text-muted)" }}>
                Canonical gaps
              </h2>
              <p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>
                Anchors agents rely on but cannot find.
              </p>
              <div className="mt-4 space-y-2">
                {canonicalGaps.length === 0 ? (
                  <div className="rounded-lg px-3 py-3 text-sm" style={{ background: "var(--bg-elevated)", color: "var(--text-muted)" }}>
                    No obvious canonical gaps detected.
                  </div>
                ) : (
                  canonicalGaps.map((gap) => {
                    const key = `${gap.project}/${gap.path}`;
                    return (
                      <div key={key} className="flex items-center gap-3 rounded-lg px-3 py-3" style={{ background: "var(--bg-elevated)" }}>
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-mono text-sm" style={{ color: "var(--text)" }}>{gap.path}</div>
                          <div className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>{gap.project}</div>
                        </div>
                        <button
                          onClick={() => void handleCreateGap(gap)}
                          disabled={creatingGap === key}
                          className="btn"
                        >
                          {creatingGap === key ? "Creating..." : "+ Create"}
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </section>

            {primaryRisk && (
              <section className="rounded-lg border p-5" style={{ borderColor: "color-mix(in srgb, var(--danger) 40%, var(--border))", background: "var(--danger-soft)" }}>
                <h2 className="workspace-label text-sm font-semibold" style={{ color: "var(--danger)" }}>
                  Suggestion
                </h2>
                <p className="mt-3 text-sm leading-6" style={{ color: "var(--text)" }}>
                  Spend a short pass refreshing <strong>{primaryRisk.name}</strong>. Adding or updating its canonical anchor would improve generated briefs and make agent handoff safer.
                </p>
              </section>
            )}

            <div className="panel h-fit p-5">
              <h2 className="workspace-label text-sm font-semibold" style={{ color: "var(--text-muted)" }}>
                Review rhythm
              </h2>
              <div className="mt-4 space-y-3 text-sm leading-6" style={{ color: "var(--text-muted)" }}>
                <p>Open stale docs before starting agent work in affected projects.</p>
                <p>Canonical docs should be refreshed first because session briefs treat them as source-of-truth material.</p>
                <p>Mark reviewed hides a stale item for this session so you can work down the list without losing flow.</p>
              </div>
            </div>
          </aside>
        </section>
      </div>
    </div>
  );
}

function HealthStatCard({
  label,
  value,
  detail,
  accent,
}: {
  label: string;
  value: string | number;
  detail: string;
  accent: string;
}) {
  return (
    <div className="panel relative overflow-hidden p-5">
      <div
        className="absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-15"
        style={{ background: accent }}
      />
      <div className="workspace-label text-sm font-semibold" style={{ color: "var(--text-muted)" }}>{label}</div>
      <div className="mt-2 text-3xl font-semibold tabular-nums" style={{ color: accent }}>{value}</div>
      <div className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>{detail}</div>
    </div>
  );
}

function StatusMix({ project }: { project: ProjectHealth }) {
  const total = Math.max(1, project.docCount);
  return (
    <div>
      <div className="flex h-2 overflow-hidden rounded-full" style={{ background: "var(--bg-elevated)" }}>
        <span style={{ width: `${(project.finalCount / total) * 100}%`, background: "var(--success)" }} />
        <span style={{ width: `${(project.reviewCount / total) * 100}%`, background: "var(--info)" }} />
        <span style={{ width: `${(project.draftCount / total) * 100}%`, background: "var(--text-muted)" }} />
      </div>
      <div className="mt-1 text-xs" style={{ color: "var(--text-faint)" }}>
        {project.finalCount}f - {project.reviewCount}r - {project.draftCount}d
      </div>
    </div>
  );
}
