"use client";

import { useEffect, useMemo, useState } from "react";
import * as commands from "@/lib/commands";
import { GitPanel } from "@/components/git/GitPanel";
import { useGitStore } from "@/stores/gitStore";
import { useUIStore } from "@/stores/uiStore";
import { useEditorStore } from "@/stores/editorStore";
import type { DocumentInfo } from "@/types";

function formatRelativeDate(iso: string) {
  try {
    const date = new Date(iso);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    return date.toLocaleDateString();
  } catch {
    return iso;
  }
}

type ChangedDocSummary = {
  key: string;
  project: string;
  path: string;
  title: string;
  statuses: string[];
  stagedCount: number;
  unstagedCount: number;
  isAiAuthored: boolean;
  isCanonical: boolean;
  isProtected: boolean;
};

function parseDocPath(path: string) {
  const match = path.match(/^projects\/([^/]+)\/docs\/(.+\.md)$/);
  if (!match) return null;
  return {
    project: match[1],
    path: match[2],
  };
}

function summarizeFileStatus(status: string) {
  switch (status) {
    case "staged_new":
      return "staged new";
    case "staged_modified":
      return "staged edits";
    case "staged_deleted":
      return "staged delete";
    case "new":
      return "new";
    case "modified":
      return "edited";
    case "deleted":
      return "deleted";
    default:
      return status.replaceAll("_", " ");
  }
}

function buildHealthToneStyle(level: "neutral" | "good" | "warning" | "attention"): React.CSSProperties {
  if (level === "good")      return { background: "var(--success-soft)", border: "1px solid var(--success)", color: "var(--success)" };
  if (level === "warning")   return { background: "var(--warning-soft)", border: "1px solid var(--warning)", color: "var(--warning)" };
  if (level === "attention") return { background: "var(--danger-soft)",  border: "1px solid var(--danger)",  color: "var(--danger)"  };
  return { background: "var(--info-soft)", border: "1px solid var(--info)", color: "var(--info)" };
}

export function SyncView() {
  const files = useGitStore((s) => s.files);
  const commits = useGitStore((s) => s.commits);
  const currentBranch = useGitStore((s) => s.currentBranch);
  const remoteConfig = useGitStore((s) => s.remoteConfig);
  const syncStatus = useGitStore((s) => s.syncStatus);
  const syncHealth = useGitStore((s) => s.syncHealth);
  const docSyncRisks = useGitStore((s) => s.docSyncRisks);
  const output = useGitStore((s) => s.output);
  const clearOutput = useGitStore((s) => s.clearOutput);
  const loadStatus = useGitStore((s) => s.loadStatus);
  const loadLog = useGitStore((s) => s.loadLog);
  const loadBranches = useGitStore((s) => s.loadBranches);
  const loadRemoteConfig = useGitStore((s) => s.loadRemoteConfig);
  const loadSyncStatus = useGitStore((s) => s.loadSyncStatus);
  const loadDocSyncRisks = useGitStore((s) => s.loadDocSyncRisks);
  const pushRemote = useGitStore((s) => s.push);
  const pullRemote = useGitStore((s) => s.pull);
  const setWorkspaceView = useUIStore((s) => s.setWorkspaceView);
  const setShowOnboarding = useUIStore((s) => s.setShowOnboarding);
  const openDocument = useEditorStore((s) => s.openDocument);
  const [syncing, setSyncing] = useState<"pull" | "push" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [docMetaByKey, setDocMetaByKey] = useState<Record<string, DocumentInfo>>({});

  useEffect(() => {
    void loadStatus();
    void loadLog();
    void loadBranches();
    void loadRemoteConfig();
    void loadSyncStatus();
    void loadDocSyncRisks();
  }, [
    loadBranches,
    loadDocSyncRisks,
    loadLog,
    loadRemoteConfig,
    loadStatus,
    loadSyncStatus,
  ]);

  useEffect(() => {
    let active = true;
    const changedProjects = Array.from(
      new Set(
        files
          .map((file) => parseDocPath(file.path)?.project)
          .filter((project): project is string => Boolean(project))
      )
    );

    if (changedProjects.length === 0) {
      setDocMetaByKey({});
      return () => {
        active = false;
      };
    }

    const loadDocMetadata = async () => {
      try {
        const docsByProject = await Promise.all(
          changedProjects.map(async (project) => {
            const docs = await commands.listDocuments(project);
            return [project, docs] as const;
          })
        );

        if (!active) return;

        const next: Record<string, DocumentInfo> = {};
        for (const [project, docs] of docsByProject) {
          for (const doc of docs) {
            next[`${project}/${doc.path}`] = doc;
          }
        }
        setDocMetaByKey(next);
      } catch {
        if (active) {
          setDocMetaByKey({});
        }
      }
    };

    void loadDocMetadata();
    return () => {
      active = false;
    };
  }, [files]);

  const staged = useMemo(
    () => files.filter((file) => file.status.startsWith("staged_")).length,
    [files]
  );
  const unstaged = files.length - staged;
  const latestCommit = commits[0] ?? null;
  const hasRemote = Boolean(remoteConfig?.remote_url);
  const changedDocs = useMemo<ChangedDocSummary[]>(() => {
    const grouped = new Map<string, ChangedDocSummary>();

    for (const file of files) {
      const docRef = parseDocPath(file.path);
      if (!docRef) continue;

      const key = `${docRef.project}/${docRef.path}`;
      const meta = docMetaByKey[key];
      const existing = grouped.get(key);

      if (existing) {
        existing.statuses.push(file.status);
        if (file.status.startsWith("staged_")) {
          existing.stagedCount += 1;
        } else {
          existing.unstagedCount += 1;
        }
        continue;
      }

      grouped.set(key, {
        key,
        project: docRef.project,
        path: docRef.path,
        title: meta?.title || docRef.path.split("/").at(-1)?.replace(/\.md$/, "") || docRef.path,
        statuses: [file.status],
        stagedCount: file.status.startsWith("staged_") ? 1 : 0,
        unstagedCount: file.status.startsWith("staged_") ? 0 : 1,
        isAiAuthored: meta?.author === "ai" || meta?.author === "both",
        isCanonical: Boolean(meta?.canonical),
        isProtected: Boolean(meta?.protected),
      });
    }

    return Array.from(grouped.values()).sort((a, b) => {
      if (a.isCanonical !== b.isCanonical) return a.isCanonical ? -1 : 1;
      if (a.isProtected !== b.isProtected) return a.isProtected ? -1 : 1;
      return a.title.localeCompare(b.title);
    });
  }, [docMetaByKey, files]);

  const changedDocProjects = useMemo(
    () => new Set(changedDocs.map((doc) => doc.project)).size,
    [changedDocs]
  );
  const aiChangedDocs = useMemo(
    () => changedDocs.filter((doc) => doc.isAiAuthored).length,
    [changedDocs]
  );
  const sensitiveChangedDocs = useMemo(
    () => changedDocs.filter((doc) => doc.isCanonical || doc.isProtected).length,
    [changedDocs]
  );
  const conflictRiskDocs = useMemo(
    () => docSyncRisks.filter((risk) => risk.risk === "conflict_risk"),
    [docSyncRisks]
  );
  const remoteChangedDocs = useMemo(
    () => docSyncRisks.filter((risk) => risk.risk !== "conflict_risk"),
    [docSyncRisks]
  );
  const nonDocChanges = useMemo(
    () => files.filter((file) => !parseDocPath(file.path)).length,
    [files]
  );

  const handleSync = async (direction: "pull" | "push") => {
    setSyncing(direction);
    setError(null);
    setMessage(direction === "pull" ? "Pulling latest changes..." : "Pushing changes...");
    try {
      const result =
        direction === "pull" ? await pullRemote() : await pushRemote();
      setMessage(
        result || (direction === "pull" ? "Pulled successfully." : "Pushed successfully.")
      );
      window.setTimeout(() => setMessage(null), 2600);
    } catch (err) {
      setError(String(err));
    } finally {
      setSyncing(null);
    }
  };

  const handlePrimaryAction = async () => {
    if (!syncHealth) return;
    if (syncHealth.recommendedAction === "pull") {
      await handleSync("pull");
      return;
    }
    if (syncHealth.recommendedAction === "push") {
      await handleSync("push");
      return;
    }
    if (syncHealth.recommendedAction === "configure-remote") {
      setWorkspaceView("settings");
      return;
    }
  };

  const handleOpenChangedDoc = (doc: ChangedDocSummary) => {
    if (doc.statuses.every((status) => status.includes("deleted"))) {
      return;
    }
    setShowOnboarding(false);
    setWorkspaceView("documents");
    void openDocument(doc.project, doc.path);
  };

  const primaryActionLabel =
    syncHealth?.recommendedAction === "pull"
      ? "Pull latest"
      : syncHealth?.recommendedAction === "push"
        ? "Push changes"
        : syncHealth?.recommendedAction === "configure-remote"
          ? "Open settings"
          : null;

  return (
    <div className="workspace-page h-full min-w-0 flex-1 overflow-y-auto px-6 py-6">
      <div className="flex w-full flex-col gap-6">
        <section className="workspace-hero rounded-3xl p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl">
              <div className="workspace-kicker mb-3">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--accent)" }} />
                Team-ready documentation sync
              </div>
              <h1 className="workspace-label text-3xl font-semibold tracking-tight" style={{ color: "var(--text)" }}>
                Sync
              </h1>
              <p className="mt-2 text-sm leading-6" style={{ color: "var(--text-muted)" }}>
                Keep the vault shareable like a normal repo with commits, branches,
                pull, push, and review workflows around documentation work.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[360px]">
              <button
                onClick={() => void handleSync("pull")}
                disabled={!hasRemote || syncing !== null}
                className="workspace-action rounded-2xl px-4 py-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50"
              >
                <div className="text-xs font-medium" style={{ color: "var(--text)" }}>Pull latest</div>
                <div className="mt-1 text-[11px]" style={{ color: "var(--text-muted)" }}>
                  Bring the shared vault up to date before editing.
                </div>
              </button>
              <button
                onClick={() => void handleSync("push")}
                disabled={!hasRemote || syncing !== null}
                className="workspace-action rounded-2xl px-4 py-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50"
              >
                <div className="text-xs font-medium" style={{ color: "var(--text)" }}>Push changes</div>
                <div className="mt-1 text-[11px]" style={{ color: "var(--text-muted)" }}>
                  Share committed documentation updates with the team.
                </div>
              </button>
              <button
                onClick={() => setWorkspaceView("docs-health")}
                className="workspace-action rounded-2xl px-4 py-3 text-left transition-colors"
              >
                <div className="text-xs font-medium" style={{ color: "var(--text)" }}>Review docs health</div>
                <div className="mt-1 text-[11px]" style={{ color: "var(--text-muted)" }}>
                  Check what should be updated before you sync.
                </div>
              </button>
              <button
                onClick={() => setWorkspaceView("start-session")}
                className="workspace-action rounded-2xl px-4 py-3 text-left transition-colors"
              >
                <div className="text-xs font-medium" style={{ color: "var(--text)" }}>Start session</div>
                <div className="mt-1 text-[11px]" style={{ color: "var(--text-muted)" }}>
                  Build a fresh context bundle after pulling shared updates.
                </div>
              </button>
            </div>
          </div>
        </section>

        {(message || error || output) && (
          <div
            className="rounded-2xl px-4 py-3 text-sm"
            style={error
              ? { background: "var(--danger-soft)", border: "1px solid var(--danger)", color: "var(--danger)" }
              : { background: "var(--success-soft)", border: "1px solid var(--success)", color: "var(--success)" }
            }
          >
            {error || message || output}
            {output && (
              <button
                onClick={clearOutput}
                className="ml-3 text-xs underline-offset-2 hover:underline"
                style={{ color: "var(--text-muted)" }}
              >
                Clear
              </button>
            )}
          </div>
        )}

        {syncHealth && (
          <section className="rounded-3xl px-5 py-4" style={buildHealthToneStyle(syncHealth.level)}>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="text-xs font-medium uppercase tracking-[0.16em] opacity-70">
                  Sync health
                </div>
                <div className="mt-2 text-lg font-semibold">{syncHealth.label}</div>
                <div className="mt-1 text-sm opacity-80">{syncHealth.detail}</div>
                {syncStatus?.has_upstream && (
                  <div className="mt-2 text-xs opacity-70">
                    {syncStatus.ahead} ahead, {syncStatus.behind} behind on {syncStatus.remote_branch}
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-3">
                {primaryActionLabel && (
                  <button
                    onClick={() => void handlePrimaryAction()}
                    disabled={syncing !== null}
                    className="btn primary sm disabled:opacity-50"
                  >
                    {primaryActionLabel}
                  </button>
                )}
                <button
                  onClick={() => setWorkspaceView("docs-health")}
                  className="btn sm"
                >
                  Review docs
                </button>
              </div>
            </div>
          </section>
        )}

        <section className="grid gap-4 md:grid-cols-4">
          <div className="workspace-stat rounded-2xl p-4">
            <div className="workspace-stat-label">Branch</div>
            <div className="mt-2 text-xl font-semibold" style={{ color: "var(--text)" }}>{currentBranch}</div>
            <div className="mt-1 text-[11px]" style={{ color: "var(--text-faint)" }}>
              {syncStatus?.has_upstream
                ? `${syncStatus.ahead} ahead, ${syncStatus.behind} behind`
                : hasRemote
                  ? `Tracking ${remoteConfig?.remote_branch || currentBranch}`
                  : "No upstream yet"}
            </div>
          </div>
          <div className="workspace-stat rounded-2xl p-4">
            <div className="workspace-stat-label">Pending docs</div>
            <div className="mt-2 text-xl font-semibold" style={{ color: "var(--text)" }}>{changedDocs.length}</div>
            <div className="mt-1 text-[11px]" style={{ color: "var(--text-faint)" }}>
              {changedDocProjects} projects, {staged} staged file changes
            </div>
          </div>
          <div className="workspace-stat rounded-2xl p-4">
            <div className="workspace-stat-label">Review signals</div>
            <div className="mt-2 text-sm font-medium" style={{ color: "var(--text)" }}>
              {conflictRiskDocs.length} conflict risks
            </div>
            <div className="mt-1 text-[11px]" style={{ color: "var(--text-faint)" }}>
              {aiChangedDocs} AI-authored, {sensitiveChangedDocs} sensitive docs
            </div>
          </div>
          <div className="workspace-stat rounded-2xl p-4">
            <div className="workspace-stat-label">Latest commit</div>
            <div className="mt-2 text-sm font-medium" style={{ color: "var(--text)" }}>
              {latestCommit ? formatRelativeDate(latestCommit.date) : "No commits yet"}
            </div>
            <div className="mt-1 truncate text-[11px]" style={{ color: "var(--text-faint)" }}>
              {latestCommit?.message || "Commit your first docs change to start the history."}
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="workspace-section rounded-3xl p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold" style={{ color: "var(--text)" }}>Pending documentation changes</h2>
                <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
                  Review the docs affected by this change set before you commit or push.
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {changedDocs.length === 0 ? (
                <div className="workspace-empty rounded-2xl p-4 text-sm" style={{ color: "var(--text-muted)" }}>
                  No markdown docs are currently changing. If you expected doc changes here, check the detailed git tools below.
                </div>
              ) : (
                changedDocs.map((doc) => {
                  const isDeletedOnly = doc.statuses.every((status) => status.includes("deleted"));

                  return (
                  <button
                    key={doc.key}
                    type="button"
                    onClick={() => handleOpenChangedDoc(doc)}
                    disabled={isDeletedOnly}
                    className={`workspace-subsection group w-full rounded-2xl p-4 text-left transition-colors ${
                      isDeletedOnly ? "cursor-not-allowed opacity-65" : ""
                    }`}
                    title={isDeletedOnly ? "Deleted docs cannot be opened from the vault" : "Open document for review"}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium" style={{ color: "var(--text)" }}>{doc.title}</div>
                        <div className="mt-1 text-[11px]" style={{ color: "var(--text-muted)" }}>
                          {doc.project}/{doc.path}
                        </div>
                      </div>
                      <div className="text-right text-[11px]" style={{ color: "var(--text-faint)" }}>
                        <div>{doc.stagedCount} staged</div>
                        <div>{doc.unstagedCount} unstaged</div>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-[10px]">
                      {Array.from(new Set(doc.statuses)).map((status) => (
                        <span
                          key={status}
                          className="rounded-full px-2 py-0.5"
                          style={{ border: "1px solid var(--border)", color: "var(--text-muted)" }}
                        >
                          {summarizeFileStatus(status)}
                        </span>
                      ))}
                      {doc.isAiAuthored && (
                        <span
                          className="rounded-full px-2 py-0.5"
                          style={{ border: "1px solid var(--magic)", color: "var(--magic)", background: "var(--magic-soft)" }}
                        >
                          AI-authored
                        </span>
                      )}
                      {doc.isCanonical && (
                        <span
                          className="rounded-full px-2 py-0.5"
                          style={{ border: "1px solid var(--warning)", color: "var(--warning)", background: "var(--warning-soft)" }}
                        >
                          canonical
                        </span>
                      )}
                      {doc.isProtected && (
                        <span
                          className="rounded-full px-2 py-0.5"
                          style={{ border: "1px solid var(--danger)", color: "var(--danger)", background: "var(--danger-soft)" }}
                        >
                          protected
                        </span>
                      )}
                    </div>
                  </button>
                  );
                })
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="workspace-section rounded-3xl p-5">
              <h2 className="text-lg font-semibold" style={{ color: "var(--text)" }}>Remote doc risks</h2>
              <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
                Docs changed upstream since your current local base.
              </p>
              <div className="mt-4 space-y-3">
                {docSyncRisks.length === 0 ? (
                  <div className="workspace-empty rounded-2xl p-4 text-[12px]" style={{ color: "var(--text-muted)" }}>
                    No remote doc risks detected from the current tracking branch.
                  </div>
                ) : (
                  docSyncRisks.slice(0, 8).map((risk) => {
                    const isConflictRisk = risk.risk === "conflict_risk";
                    return (
                      <div
                        key={`${risk.project}/${risk.path}`}
                        className="rounded-2xl p-4"
                        style={isConflictRisk
                          ? { background: "var(--danger-soft)", border: "1px solid var(--danger)" }
                          : { background: "var(--warning-soft)", border: "1px solid var(--warning)" }
                        }
                      >
                        <div className="text-xs font-medium" style={{ color: "var(--text)" }}>
                          {risk.project}/{risk.path}
                        </div>
                        <div
                          className="mt-2 text-[11px]"
                          style={{ color: isConflictRisk ? "var(--danger)" : "var(--warning)" }}
                        >
                          {isConflictRisk
                            ? "Local and remote both touched this doc"
                            : "Remote changed this doc"}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2 text-[10px]">
                          {risk.remote_statuses.map((status) => (
                            <span
                              key={status}
                              className="rounded-full px-2 py-0.5"
                              style={{ border: "1px solid var(--border)", color: "var(--text-muted)" }}
                            >
                              remote {status}
                            </span>
                          ))}
                          {risk.local_statuses.map((status) => (
                            <span
                              key={status}
                              className="rounded-full px-2 py-0.5"
                              style={{ border: "1px solid var(--border)", color: "var(--text-muted)" }}
                            >
                              local {summarizeFileStatus(status)}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })
                )}
                {remoteChangedDocs.length > 0 && conflictRiskDocs.length === 0 && (
                  <div className="text-[11px] leading-5" style={{ color: "var(--text-muted)" }}>
                    Pull latest before editing these docs so your local copy starts from the newest shared version.
                  </div>
                )}
              </div>
            </div>

            <div className="workspace-section rounded-3xl p-5">
              <h2 className="text-lg font-semibold" style={{ color: "var(--text)" }}>Next step</h2>
              <div className="mt-4 space-y-3">
                <div className="workspace-subsection rounded-2xl p-4">
                  <div className="text-sm font-medium" style={{ color: "var(--text)" }}>
                    {syncHealth?.label || "Review sync state"}
                  </div>
                  <div className="mt-2 text-[12px] leading-5" style={{ color: "var(--text-muted)" }}>
                    {syncHealth?.detail ||
                      "Use this space to understand whether you should pull, commit, or push next."}
                  </div>
                </div>
                <div className="workspace-subsection rounded-2xl p-4">
                  <div className="workspace-stat-label">Remote</div>
                  <div className="mt-2 break-all text-[12px]" style={{ color: "var(--text)" }}>
                    {remoteConfig?.remote_url || "No remote configured yet"}
                  </div>
                  <div className="mt-2 text-[11px]" style={{ color: "var(--text-muted)" }}>
                    {hasRemote
                      ? `Tracking ${remoteConfig?.remote_branch || currentBranch}`
                      : "Connect a remote when this vault should be shared."}
                  </div>
                </div>
                <div className="workspace-subsection rounded-2xl p-4">
                  <div className="workspace-stat-label">Recommended flow</div>
                  <ol className="mt-2 space-y-2 text-[12px] leading-5" style={{ color: "var(--text-muted)" }}>
                    <li>1. Pull first if the remote is ahead.</li>
                    <li>2. Review doc changes before mixing in workspace files.</li>
                    <li>3. Commit sensitive or AI-authored docs in intentional groups.</li>
                  </ol>
                  {nonDocChanges > 0 && (
                    <div className="mt-3 text-[11px]" style={{ color: "var(--text-faint)" }}>
                      {nonDocChanges} non-doc file changes are also present in the working tree.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="workspace-section rounded-3xl p-2">
          <div className="px-3 py-3" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
            <h2 className="text-lg font-semibold" style={{ color: "var(--text)" }}>Sync tools</h2>
            <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
              Manage changes, branches, remote settings, and pull requests.
            </p>
          </div>
          <div className="h-[680px] min-h-[480px]">
            <GitPanel />
          </div>
        </section>
      </div>
    </div>
  );
}
