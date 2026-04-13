"use client";

import { useEffect, useMemo, useState } from "react";
import * as commands from "@/lib/commands";
import { useEditorStore } from "@/stores/editorStore";
import { useUIStore } from "@/stores/uiStore";
import { useVaultStore } from "@/stores/vaultStore";
import type { DocumentInfo, RecentChange } from "@/types";

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

type StaleDoc = {
  project: string;
  path: string;
  title: string;
  modified: string;
  ageDays: number;
  canonical: boolean;
  status: string;
};

const STALE_DAYS = 45;

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

export function DocsHealthView() {
  const projects = useVaultStore((s) => s.projects);
  const openDocument = useEditorStore((s) => s.openDocument);
  const setShowOnboarding = useUIStore((s) => s.setShowOnboarding);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [projectDocs, setProjectDocs] = useState<Record<string, DocumentInfo[]>>({});
  const [recentChanges, setRecentChanges] = useState<RecentChange[]>([]);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      try {
        const [docsByProject, changes] = await Promise.all([
          Promise.all(
            projects.map(async (project) => {
              const docs = await commands.listDocuments(project.name);
              return [project.name, docs] as const;
            })
          ),
          commands.getRecentChanges(20),
        ]);

        if (!active) return;

        setProjectDocs(Object.fromEntries(docsByProject));
        setRecentChanges(changes);
        setError(null);
      } catch (err) {
        if (!active) return;
        setError(`Could not load docs health: ${err}`);
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [projects]);

  const allDocs = useMemo(
    () => Object.entries(projectDocs).flatMap(([project, docs]) => docs.map((doc) => ({ project, ...doc }))),
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
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [projectDocs, projects]);

  const staleDocs = useMemo<StaleDoc[]>(() => {
    return allDocs
      .map((doc) => ({
        project: doc.project,
        path: doc.path,
        title: doc.title,
        modified: doc.modified,
        ageDays: getAgeDays(doc.modified),
        canonical: doc.canonical,
        status: doc.status,
      }))
      .filter((doc) => doc.ageDays >= STALE_DAYS)
      .sort((a, b) => b.ageDays - a.ageDays)
      .slice(0, 12);
  }, [allDocs]);

  const summary = useMemo(() => {
    const totalDocs = allDocs.length;
    const canonicalDocs = allDocs.filter((doc) => doc.canonical).length;
    const protectedDocs = allDocs.filter((doc) => doc.protected).length;
    const draftDocs = allDocs.filter((doc) => doc.status === "draft").length;
    const reviewDocs = allDocs.filter((doc) => doc.status === "review").length;
    const finalDocs = allDocs.filter((doc) => doc.status === "final").length;
    const staleCount = staleDocs.length;

    return {
      totalDocs,
      canonicalDocs,
      protectedDocs,
      draftDocs,
      reviewDocs,
      finalDocs,
      staleCount,
      canonicalCoverage:
        totalDocs === 0 ? 0 : Math.round((canonicalDocs / totalDocs) * 100),
    };
  }, [allDocs, staleDocs]);

  const atRiskProjects = useMemo(() => {
    return projectHealth
      .filter((project) => project.docCount === 0 || project.canonicalCount === 0 || project.staleCount > 0)
      .slice(0, 6);
  }, [projectHealth]);

  const handleOpen = (project: string, path: string) => {
    setShowOnboarding(false);
    void openDocument(project, path);
  };

  return (
    <div className="workspace-page h-full overflow-y-auto px-6 py-6">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <section className="workspace-hero rounded-3xl p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl">
              <div className="workspace-kicker mb-3">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
                Keep project memory trustworthy
              </div>
              <h1 className="workspace-label text-3xl font-semibold tracking-tight text-neutral-100">
                Docs Health
              </h1>
              <p className="mt-2 text-sm leading-6 text-neutral-400">
                Review where documentation is aging, missing canonical anchors, or
                piling up in draft so the vault stays useful for both people and agents.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 lg:min-w-[320px]">
              <div className="workspace-stat rounded-2xl px-4 py-3">
                <div className="workspace-stat-label">
                  Canonical coverage
                </div>
                <div className="mt-1 text-xl font-semibold text-neutral-100">
                  {summary.canonicalCoverage}%
                </div>
              </div>
              <div className="workspace-stat rounded-2xl px-4 py-3">
                <div className="workspace-stat-label">
                  Stale docs
                </div>
                <div className="mt-1 text-xl font-semibold text-neutral-100">
                  {summary.staleCount}
                </div>
              </div>
            </div>
          </div>
        </section>

        {error && (
          <div className="rounded-2xl border border-red-900/40 bg-red-950/20 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <section className="grid gap-4 md:grid-cols-4">
          <div className="workspace-stat rounded-2xl p-4">
            <div className="workspace-stat-label">Documents</div>
            <div className="mt-2 text-2xl font-semibold text-neutral-100">{summary.totalDocs}</div>
            <div className="mt-1 text-[11px] text-neutral-500">Across all projects</div>
          </div>
          <div className="workspace-stat rounded-2xl p-4">
            <div className="workspace-stat-label">Canonical docs</div>
            <div className="mt-2 text-2xl font-semibold text-neutral-100">{summary.canonicalDocs}</div>
            <div className="mt-1 text-[11px] text-neutral-500">Trusted starting points</div>
          </div>
          <div className="workspace-stat rounded-2xl p-4">
            <div className="workspace-stat-label">Protected docs</div>
            <div className="mt-2 text-2xl font-semibold text-neutral-100">{summary.protectedDocs}</div>
            <div className="mt-1 text-[11px] text-neutral-500">Should prefer proposal flow</div>
          </div>
          <div className="workspace-stat rounded-2xl p-4">
            <div className="workspace-stat-label">Draft / Review</div>
            <div className="mt-2 text-2xl font-semibold text-neutral-100">
              {summary.draftDocs + summary.reviewDocs}
            </div>
            <div className="mt-1 text-[11px] text-neutral-500">
              {summary.draftDocs} draft, {summary.reviewDocs} review
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="workspace-section rounded-3xl p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-neutral-100">Project health</h2>
                <p className="mt-1 text-xs text-neutral-500">
                  Spot thin coverage, stale docs, and projects missing canonical anchors.
                </p>
              </div>
            </div>

            {loading ? (
              <div className="py-10 text-sm text-neutral-500">Loading project health...</div>
            ) : (
              <div className="mt-5 space-y-3">
                {projectHealth.map((project) => (
                  <div
                    key={project.name}
                    className="workspace-subsection rounded-2xl p-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-sm font-medium text-neutral-200">{project.name}</div>
                        <div className="mt-1 text-[11px] text-neutral-500">
                          {project.docCount} docs, {project.canonicalCount} canonical, {project.protectedCount} protected
                        </div>
                      </div>
                      <div className="text-right text-[11px] text-neutral-500">
                        {project.staleCount > 0 ? `${project.staleCount} stale` : "Up to date"}
                      </div>
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-3">
                      <div className="workspace-action rounded-xl px-3 py-2 text-[11px] text-neutral-400">
                        Draft: <span className="text-neutral-200">{project.draftCount}</span>
                      </div>
                      <div className="workspace-action rounded-xl px-3 py-2 text-[11px] text-neutral-400">
                        Review: <span className="text-neutral-200">{project.reviewCount}</span>
                      </div>
                      <div className="workspace-action rounded-xl px-3 py-2 text-[11px] text-neutral-400">
                        Final: <span className="text-neutral-200">{project.finalCount}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="workspace-section rounded-3xl p-5">
              <h2 className="text-lg font-semibold text-neutral-100">Needs attention</h2>
              <div className="mt-4 space-y-3">
                {atRiskProjects.length === 0 ? (
                  <div className="workspace-empty rounded-2xl p-4 text-[11px] text-neutral-500">
                    No obvious project-level gaps right now.
                  </div>
                ) : (
                  atRiskProjects.map((project) => (
                    <div
                      key={project.name}
                      className="workspace-subsection rounded-2xl p-4"
                    >
                      <div className="text-sm font-medium text-neutral-200">{project.name}</div>
                      <div className="mt-2 text-[11px] leading-5 text-neutral-500">
                        {project.docCount === 0
                          ? "No docs yet."
                          : project.canonicalCount === 0
                            ? "No canonical docs yet."
                            : `${project.staleCount} docs may need review.`}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="workspace-section rounded-3xl p-5">
              <h2 className="text-lg font-semibold text-neutral-100">Status mix</h2>
              <div className="mt-4 space-y-3 text-[12px] text-neutral-400">
                <div className="workspace-subsection rounded-2xl px-4 py-3">
                  Draft docs: <span className="text-neutral-200">{summary.draftDocs}</span>
                </div>
                <div className="workspace-subsection rounded-2xl px-4 py-3">
                  Review docs: <span className="text-neutral-200">{summary.reviewDocs}</span>
                </div>
                <div className="workspace-subsection rounded-2xl px-4 py-3">
                  Final docs: <span className="text-neutral-200">{summary.finalDocs}</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="workspace-section rounded-3xl p-5">
            <h2 className="text-lg font-semibold text-neutral-100">Stale documents</h2>
            <p className="mt-1 text-xs text-neutral-500">
              Documents untouched for at least {STALE_DAYS} days.
            </p>

            <div className="mt-5 space-y-3">
              {staleDocs.length === 0 ? (
                <div className="workspace-empty rounded-2xl p-4 text-[11px] text-neutral-500">
                  No stale docs right now.
                </div>
              ) : (
                staleDocs.map((doc) => (
                  <button
                    key={`${doc.project}/${doc.path}`}
                    onClick={() => handleOpen(doc.project, doc.path)}
                    className="workspace-action w-full rounded-2xl p-4 text-left transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-neutral-200">{doc.title}</div>
                        <div className="mt-1 text-[11px] text-neutral-500">
                          {doc.project}/{doc.path}
                        </div>
                      </div>
                      <div className="text-[11px] text-neutral-500">{formatRelativeDays(doc.ageDays)}</div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-neutral-400">
                      <span className="rounded-full border border-neutral-700 px-2 py-0.5">{doc.status}</span>
                      {doc.canonical && (
                        <span className="rounded-full border border-amber-700/60 px-2 py-0.5 text-amber-300">
                          canonical
                        </span>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="workspace-section rounded-3xl p-5">
            <h2 className="text-lg font-semibold text-neutral-100">Recent changes</h2>
            <p className="mt-1 text-xs text-neutral-500">
              Useful for deciding which docs might need canonical review next.
            </p>

            <div className="mt-5 space-y-3">
              {recentChanges.length === 0 ? (
                <div className="workspace-empty rounded-2xl p-4 text-[11px] text-neutral-500">
                  No recent doc changes found.
                </div>
              ) : (
                recentChanges.slice(0, 12).map((change) => (
                  <button
                    key={`${change.project}/${change.path}/${change.modified}`}
                    onClick={() => handleOpen(change.project, change.path)}
                    className="workspace-action w-full rounded-2xl p-4 text-left transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-neutral-200">{change.title}</div>
                        <div className="mt-1 text-[11px] text-neutral-500">
                          {change.project}/{change.path}
                        </div>
                      </div>
                      <div className="text-[11px] text-neutral-500">
                        {formatRelativeDays(getAgeDays(change.modified))}
                      </div>
                    </div>
                    <div className="mt-2 text-[11px] text-neutral-500">Last touched by {change.author}</div>
                  </button>
                ))
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
