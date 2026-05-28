"use client";

import { useEffect, useMemo, useState } from "react";
import * as commands from "@/lib/commands";
import { GitPanel } from "@/components/git/GitPanel";
import { useGitStore } from "@/stores/gitStore";
import { useUIStore } from "@/stores/uiStore";
import { useEditorStore } from "@/stores/editorStore";
import type { DocSyncRiskInfo, DocumentInfo } from "@/types";
import { CompareDiffModal } from "@/components/sync/CompareDiffModal";

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
  const wikiMatch = path.match(/^wiki\/(.+\.md)$/);
  if (wikiMatch) {
    return {
      project: "wiki",
      path: wikiMatch[1],
    };
  }

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

export function SyncView() {
  const files = useGitStore((s) => s.files);
  const currentBranch = useGitStore((s) => s.currentBranch);
  const remoteConfig = useGitStore((s) => s.remoteConfig);
  const syncStatus = useGitStore((s) => s.syncStatus);
  const docSyncRisks = useGitStore((s) => s.docSyncRisks);
  const conflictFiles = useGitStore((s) => s.conflictFiles);
  const output = useGitStore((s) => s.output);
  const clearOutput = useGitStore((s) => s.clearOutput);
  const loadStatus = useGitStore((s) => s.loadStatus);
  const loadBranches = useGitStore((s) => s.loadBranches);
  const loadRemoteConfig = useGitStore((s) => s.loadRemoteConfig);
  const loadSyncStatus = useGitStore((s) => s.loadSyncStatus);
  const loadDocSyncRisks = useGitStore((s) => s.loadDocSyncRisks);
  const loadConflictFiles = useGitStore((s) => s.loadConflictFiles);
  const pushRemote = useGitStore((s) => s.push);
  const updateSafely = useGitStore((s) => s.updateSafely);
  const pullDiscardLocal = useGitStore((s) => s.pullDiscardLocal);
  const resolveConflictFile = useGitStore((s) => s.resolveConflictFile);
  const continueUpdate = useGitStore((s) => s.continueUpdate);
  const stageAll = useGitStore((s) => s.stageAll);
  const commit = useGitStore((s) => s.commit);
  const commitMessage = useGitStore((s) => s.commitMessage);
  const setCommitMessage = useGitStore((s) => s.setCommitMessage);
  const setWorkspaceView = useUIStore((s) => s.setWorkspaceView);
  const setShowOnboarding = useUIStore((s) => s.setShowOnboarding);
  const openDocument = useEditorStore((s) => s.openDocument);
  const openWikiFile = useEditorStore((s) => s.openWikiFile);
  const [fetchingRemote, setFetchingRemote] = useState(true);
  const [syncing, setSyncing] = useState<"pull" | "push" | "safe-pull" | "safe-sync" | "discard-pull" | "commit" | "fetch" | "resolve" | "continue" | null>(null);
  const [confirmDiscardPull, setConfirmDiscardPull] = useState(false);
  const [activeFilter, setActiveFilter] = useState<"all" | "conflict" | "ai" | "sensitive" | "mine">("all");
  const [showGitTools, setShowGitTools] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updatePaused, setUpdatePaused] = useState(false);
  const [docMetaByKey, setDocMetaByKey] = useState<Record<string, DocumentInfo>>({});
  const [compareRisk, setCompareRisk] = useState<DocSyncRiskInfo | null>(null);

  useEffect(() => {
    let active = true;

    const refreshLocal = async () => {
      await Promise.all([
        loadStatus(),
        loadBranches(),
        loadRemoteConfig(),
        loadConflictFiles(),
        loadSyncStatus(),
        loadDocSyncRisks(),
      ]);
    };

    const refreshRemote = async () => {
      setFetchingRemote(true);
      try {
        await commands.gitFetchRemote();
      } catch {
        // Keep local status usable even when offline/auth is unavailable.
      }
      if (!active) return;
      await Promise.all([
        loadSyncStatus(),
        loadDocSyncRisks(),
      ]);
      if (active) setFetchingRemote(false);
    };

    void refreshLocal();
    const timer = window.setTimeout(() => {
      void refreshRemote();
    }, 250);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [
    loadBranches,
    loadConflictFiles,
    loadDocSyncRisks,
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
            if (project === "wiki") {
              return [project, []] as const;
            }
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
  const filteredChangedDocs = useMemo(() => {
    if (activeFilter === "conflict") {
      const conflictKeys = new Set(conflictRiskDocs.map((risk) => `${risk.project}/${risk.path}`));
      return changedDocs.filter((doc) => conflictKeys.has(doc.key));
    }
    if (activeFilter === "ai") return changedDocs.filter((doc) => doc.isAiAuthored);
    if (activeFilter === "sensitive") return changedDocs.filter((doc) => doc.isCanonical || doc.isProtected);
    if (activeFilter === "mine") return changedDocs.filter((doc) => doc.unstagedCount > 0 || doc.stagedCount > 0);
    return changedDocs;
  }, [activeFilter, changedDocs, conflictRiskDocs]);
  const needsPullStrategy = Boolean(syncStatus && (syncStatus.behind > 0 || syncStatus.diverged));
  const hasPausedConflicts = conflictFiles.length > 0 || updatePaused;
  const canUpdateSafely = hasRemote && needsPullStrategy && !hasPausedConflicts;
  const canPush = Boolean(hasRemote && syncStatus && syncStatus.ahead > 0 && syncStatus.behind === 0 && !syncStatus.diverged);
  const recommendedLabel = syncStatus?.diverged
    ? "Update safely"
    : canUpdateSafely && (syncStatus?.ahead ?? 0) > 0
      ? "Update, then Push"
      : "Get latest safely";
  const pushLabel = syncing === "push" ? "Pushing..." : (syncStatus?.ahead ?? 0) > 0 ? `Push ${syncStatus?.ahead} commit${syncStatus?.ahead === 1 ? "" : "s"}` : "Push";
  const pushHint = !hasRemote
    ? "Configure a remote before pushing."
    : (syncStatus?.ahead ?? 0) === 0
      ? "No committed changes ready to push."
      : syncStatus?.behind || syncStatus?.diverged
        ? "Pull latest before pushing."
        : "Share committed changes with the remote.";

  const handleSafePull = async () => {
    setSyncing("safe-pull");
    setError(null);
    setMessage(syncStatus?.diverged
      ? "Applying shared changes first, then replaying your local commits..."
      : "Getting latest safely and preserving local work...");
    try {
      const result = await updateSafely();
      setUpdatePaused(false);
      setMessage(result || "Updated safely.");
      window.setTimeout(() => setMessage(null), 3200);
    } catch (err) {
      setUpdatePaused(true);
      setError(String(err));
    } finally {
      setSyncing(null);
    }
  };

  const handleSafePullThenPush = async () => {
    setSyncing("safe-sync");
    setError(null);
    setMessage("Updating safely, then checking whether commits can be pushed...");
    try {
      const pullResult = await updateSafely();
      setUpdatePaused(false);
      if ((syncStatus?.ahead ?? 0) > 0 && !syncStatus?.diverged) {
        const pushResult = await pushRemote();
        setMessage([pullResult, pushResult].filter(Boolean).join("\n") || "Pulled latest and pushed committed changes.");
      } else {
        setMessage(pullResult || "Updated safely.");
      }
      window.setTimeout(() => setMessage(null), 3600);
    } catch (err) {
      setUpdatePaused(true);
      setError(String(err));
    } finally {
      setSyncing(null);
    }
  };

  const handlePush = async () => {
    setSyncing("push");
    setError(null);
    setMessage("Pushing committed documentation changes...");
    try {
      const result = await pushRemote();
      setMessage(result || "Pushed committed changes.");
      window.setTimeout(() => setMessage(null), 2600);
    } catch (err) {
      setError(String(err));
    } finally {
      setSyncing(null);
    }
  };

  const handleCommitAll = async () => {
    if (!commitMessage.trim()) return;
    setSyncing("commit");
    setError(null);
    setMessage("Staging and committing local documentation changes...");
    try {
      await stageAll();
      await commit();
      setMessage("Committed local changes.");
      window.setTimeout(() => setMessage(null), 2600);
    } catch (err) {
      setError(String(err));
    } finally {
      setSyncing(null);
    }
  };

  const handleDiscardLocalPull = async () => {
    if (!confirmDiscardPull) {
      setConfirmDiscardPull(true);
      return;
    }
    setSyncing("discard-pull");
    setError(null);
    setMessage("Discarding local changes and loading latest remote...");
    try {
      const result = await pullDiscardLocal();
      setMessage(result || "Local changes discarded and latest remote loaded.");
      setConfirmDiscardPull(false);
      window.setTimeout(() => setMessage(null), 3200);
    } catch (err) {
      setError(String(err));
    } finally {
      setSyncing(null);
    }
  };

  const handleResolveConflict = async (
    path: string,
    resolution: "keep_both" | "use_shared" | "use_local"
  ) => {
    setSyncing("resolve");
    setError(null);
    setMessage("Resolving conflicted document...");
    try {
      const result = await resolveConflictFile(path, resolution);
      setMessage(result || "Conflict resolved.");
      window.setTimeout(() => setMessage(null), 2200);
    } catch (err) {
      setError(String(err));
    } finally {
      setSyncing(null);
    }
  };

  const handleContinueUpdate = async () => {
    setSyncing("continue");
    setError(null);
    setMessage("Continuing the paused update...");
    try {
      const result = await continueUpdate();
      setUpdatePaused(false);
      setMessage(result || "Update completed.");
      window.setTimeout(() => setMessage(null), 3200);
    } catch (err) {
      setError(String(err));
    } finally {
      setSyncing(null);
    }
  };

  const handleOpenChangedDoc = (doc: ChangedDocSummary) => {
    if (doc.statuses.every((status) => status.includes("deleted"))) {
      return;
    }
    setShowOnboarding(false);
    if (doc.project === "wiki") {
      setWorkspaceView("wiki");
      void openWikiFile(doc.path);
      return;
    }
    setWorkspaceView("documents");
    void openDocument(doc.project, doc.path);
  };

  const handleOpenRiskDoc = (risk: { project: string; path: string }) => {
    setShowOnboarding(false);
    if (risk.project === "wiki") {
      setWorkspaceView("wiki");
      void openWikiFile(risk.path);
      return;
    }
    setWorkspaceView("documents");
    void openDocument(risk.project, risk.path);
  };

  return (
    <div className="workspace-page h-full min-w-0 flex-1 overflow-y-auto">
      <div className="grid min-h-full grid-cols-[252px_minmax(0,1fr)]">
        <aside className="flex min-h-0 flex-col border-r" style={{ borderColor: "var(--border)", background: "var(--bg-subtle)" }}>
          <div className="border-b px-3 py-3" style={{ borderColor: "var(--border)" }}>
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--text-muted)" }}>Sync</div>
            <div className="mt-3 rounded-lg border p-3" style={{ borderColor: "var(--border)", background: "var(--bg-panel)" }}>
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--text-muted)" }}>Remote</div>
              <div className="mt-2 break-all font-mono text-[12px]" style={{ color: "var(--text)" }}>
                {remoteConfig?.remote_url || "No remote configured"}
              </div>
            </div>
          </div>

          <div className="border-b py-3" style={{ borderColor: "var(--border)" }}>
            <div className="px-3 text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--text-muted)" }}>Filters</div>
            <div className="mt-2 space-y-0.5">
              {[
                ["all", "All changes", changedDocs.length],
                ["conflict", "Conflict risk", conflictRiskDocs.length],
                ["ai", "AI-authored", aiChangedDocs],
                ["sensitive", "Sensitive / protected", sensitiveChangedDocs],
                ["mine", "Edited by me", changedDocs.length],
              ].map(([id, label, count]) => (
                <button
                  key={id}
                  onClick={() => setActiveFilter(id as typeof activeFilter)}
                  className="flex w-full items-center justify-between px-3 py-1.5 text-left text-sm"
                  style={{
                    background: activeFilter === id ? "var(--bg-tint)" : "transparent",
                    color: activeFilter === id ? "var(--text)" : "var(--text-muted)",
                  }}
                >
                  <span>{label}</span>
                  <span className="text-xs" style={{ color: "var(--text-faint)" }}>{count}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="border-b py-3" style={{ borderColor: "var(--border)" }}>
            <div className="px-3 text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--text-muted)" }}>Branches</div>
            <div className="mt-2 px-3">
              <div className="rounded-md px-2 py-2" style={{ background: "var(--bg-tint)" }}>
                <div className="font-mono text-sm" style={{ color: "var(--text)" }}>{currentBranch}</div>
                <div className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
                  {syncStatus?.has_upstream ? `ahead ${syncStatus.ahead} - behind ${syncStatus.behind}` : "no upstream"}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-auto p-3">
            <button
              onClick={() => setShowGitTools(true)}
              className="btn w-full justify-center"
            >
              Open Git tools
            </button>
          </div>
        </aside>

        <main className="min-w-0 px-6 py-5">
          {(message || error || output) && (
            <div
              className="mb-4 rounded-lg px-4 py-3 text-sm"
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

          <section className="panel p-5">
            <div className="flex flex-col gap-5 2xl:grid 2xl:grid-cols-[220px_minmax(360px,1fr)_minmax(240px,auto)] 2xl:items-center">
              <div className="min-w-0">
                <div className="workspace-stat-label">Branch</div>
                <div className="mt-2 flex min-w-0 items-center gap-2">
                  <span className="truncate font-mono text-lg font-semibold" style={{ color: "var(--text)" }}>{currentBranch}</span>
                  <span className="shrink-0 text-xs" style={{ color: "var(--text-muted)" }}>{remoteConfig?.remote_branch || "origin"}</span>
                </div>
              </div>

              <div className="min-w-0">
                <div className="grid gap-3 sm:grid-cols-3">
                  <Metric value={syncStatus?.ahead ?? 0} label="Ahead" hint="commits ready to push" tone="accent" />
                  <Metric value={syncStatus?.behind ?? 0} label="Behind" hint="from shared vault" tone="info" />
                  <Metric value={changedDocs.length} label="Local docs" hint="not yet committed" tone="warning" />
                </div>
                {fetchingRemote && (
                  <div className="mt-2 flex items-center gap-1.5 text-xs" style={{ color: "var(--text-faint)" }}>
                    <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: "var(--text-faint)" }} />
                    Checking remote…
                  </div>
                )}
              </div>

              <div className="flex min-w-0 flex-col items-start gap-2 2xl:items-end">
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--text-muted)" }}>Recommended</div>
                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row 2xl:justify-end">
                  <button
                    onClick={() => void handleSafePullThenPush()}
                    disabled={!canUpdateSafely || syncing !== null}
                    className="btn primary lg justify-center whitespace-nowrap"
                  >
                    {syncing === "safe-sync" ? "Working..." : recommendedLabel}
                  </button>
                  <button
                    onClick={() => void handlePush()}
                    disabled={!canPush || syncing !== null}
                    className="btn lg justify-center whitespace-nowrap"
                    title={pushHint}
                  >
                    {pushLabel}
                  </button>
                </div>
                <div className="max-w-[360px] text-xs leading-5 2xl:text-right" style={{ color: "var(--text-faint)" }}>
                  {hasPausedConflicts
                    ? "Resolve conflicts below, then continue the update."
                    : canUpdateSafely
                      ? syncStatus?.diverged
                        ? "Applies shared changes first, then replays your local commits."
                        : "Stashes local edits if needed, gets latest, then reapplies them."
                      : pushHint}
                </div>
              </div>
            </div>
          </section>

          {hasPausedConflicts && (
            <section className="mt-6 rounded-lg border-2 p-4" style={{ borderColor: "var(--warning)", background: "var(--warning-soft)" }}>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--text-muted)" }}>
                    Update paused
                  </div>
                  <h2 className="mt-2 text-xl font-semibold" style={{ color: "var(--text)" }}>
                    Resolve document conflicts
                  </h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6" style={{ color: "var(--text-muted)" }}>
                    The shared vault and your local work changed the same document. Pick how to resolve each file, then continue the update.
                  </p>
                </div>
                <button
                  onClick={() => void handleContinueUpdate()}
                  disabled={syncing !== null || conflictFiles.length > 0}
                  className="btn primary lg"
                  title={conflictFiles.length > 0 ? "Resolve all conflicts first." : "Continue the paused update."}
                >
                  {syncing === "continue" ? "Continuing..." : "Continue update"}
                </button>
              </div>

              <div className="mt-4 space-y-3">
                {conflictFiles.map((conflict) => (
                  <div key={conflict.path} className="rounded-lg border p-4" style={{ borderColor: "var(--border)", background: "var(--bg-panel)" }}>
                    <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                      <div className="min-w-0">
                        <div className="font-mono text-sm font-semibold" style={{ color: "var(--text)" }}>{conflict.path}</div>
                        <div className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>{conflict.summary}</div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => void handleResolveConflict(conflict.path, "keep_both")}
                          disabled={syncing !== null}
                          className="btn primary"
                        >
                          Keep both
                        </button>
                        <button
                          onClick={() => void handleResolveConflict(conflict.path, "use_shared")}
                          disabled={syncing !== null}
                          className="btn"
                        >
                          Use shared
                        </button>
                        <button
                          onClick={() => void handleResolveConflict(conflict.path, "use_local")}
                          disabled={syncing !== null}
                          className="btn"
                        >
                          Use mine
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 lg:grid-cols-2">
                      <div className="rounded-md border p-3" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-elevated)" }}>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--text-muted)" }}>
                          Shared vault
                        </div>
                        <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap text-xs leading-5" style={{ color: "var(--text)" }}>
                          {conflict.shared_sections.join("\n\n") || "No shared-side text detected."}
                        </pre>
                      </div>
                      <div className="rounded-md border p-3" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-elevated)" }}>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--text-muted)" }}>
                          My local work
                        </div>
                        <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap text-xs leading-5" style={{ color: "var(--text)" }}>
                          {conflict.local_sections.join("\n\n") || "No local-side text detected."}
                        </pre>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {needsPullStrategy && !hasPausedConflicts && (
            <section className="mt-6">
              <h2 className="mb-3 text-base font-semibold" style={{ color: "var(--text)" }}>
                {syncStatus?.diverged ? "Your vault has changes in two places" : "How would you like to update?"}
              </h2>
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-lg border-2 p-4" style={{ borderColor: "var(--accent)", background: "var(--bg-panel)" }}>
                  <div className="flex items-center gap-3">
                    <span className="chip accent">recommended</span>
                    <h3 className="text-lg font-semibold" style={{ color: "var(--text)" }}>
                      {syncStatus?.diverged ? "Update safely" : "Safe update"}
                    </h3>
                  </div>
                  <p className="mt-3 text-sm leading-6" style={{ color: "var(--text-muted)" }}>
                    {syncStatus?.diverged
                      ? `The shared vault has ${syncStatus.behind} newer commit${syncStatus.behind === 1 ? "" : "s"} and your vault has ${syncStatus.ahead} local commit${syncStatus.ahead === 1 ? "" : "s"}. SlateVault will apply shared changes first, then replay your local commits.`
                      : `SlateVault will set aside your ${changedDocs.length} local doc change${changedDocs.length === 1 ? "" : "s"}, load the latest shared vault, then reapply your work.`}
                  </p>
                  <ol className="mt-4 space-y-2 text-sm" style={{ color: "var(--text-muted)" }}>
                    {syncStatus?.diverged ? (
                      <>
                        <li>1. Fetch origin/{remoteConfig?.remote_branch || currentBranch}</li>
                        <li>2. Apply shared commits first</li>
                        <li>3. Replay your local commits and pause if conflicts appear</li>
                      </>
                    ) : (
                      <>
                        <li>1. Set aside local edits if needed</li>
                        <li>2. Load origin/{remoteConfig?.remote_branch || currentBranch}</li>
                        <li>3. Reapply local edits and pause if conflicts appear</li>
                      </>
                    )}
                  </ol>
                  <button
                    onClick={() => void handleSafePull()}
                    disabled={syncing !== null}
                    className="btn primary mt-5 lg"
                  >
                    {syncing === "safe-pull" ? "Running..." : syncStatus?.diverged ? "Run safe update" : "Run safe update"}
                  </button>
                </div>

                <div className="rounded-lg border p-4" style={{ borderColor: "var(--border)", background: "var(--bg-panel)" }}>
                  <div className="flex items-center gap-3">
                    <span className="chip danger">destructive</span>
                    <h3 className="text-lg font-semibold" style={{ color: "var(--text)" }}>Discard Local & Pull</h3>
                  </div>
                  <p className="mt-3 text-sm leading-6" style={{ color: "var(--text-muted)" }}>
                    Throw away your {changedDocs.length} local doc changes and pull origin clean. This is not reversible.
                  </p>
                  <ol className="mt-4 space-y-2 text-sm" style={{ color: "var(--text-muted)" }}>
                    <li>1. Delete uncommitted edits permanently</li>
                    <li>2. Reset working tree to origin/{remoteConfig?.remote_branch || currentBranch}</li>
                    <li>3. Cannot be undone</li>
                  </ol>
                  <div className="mt-5 flex gap-2">
                    <button
                      onClick={() => void handleDiscardLocalPull()}
                      disabled={syncing !== null}
                      className="btn danger lg"
                    >
                      {confirmDiscardPull ? "Confirm discard & pull" : "Discard & Pull..."}
                    </button>
                    {confirmDiscardPull && (
                      <button
                        onClick={() => setConfirmDiscardPull(false)}
                        disabled={syncing !== null}
                        className="btn lg"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </section>
          )}

          <section className="mt-8">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold" style={{ color: "var(--text)" }}>
                Incoming from origin{" "}
                {fetchingRemote ? (
                  <span className="font-normal" style={{ color: "var(--text-faint)" }}>
                    — <span className="animate-pulse">checking…</span>
                  </span>
                ) : (
                  <span className="font-normal" style={{ color: "var(--text-faint)" }}>- {docSyncRisks.length} docs</span>
                )}
              </h2>
            </div>
            <div className="panel overflow-hidden">
              {fetchingRemote ? (
                <div className="flex items-center gap-2 px-4 py-5 text-sm" style={{ color: "var(--text-muted)" }}>
                  <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: "var(--text-muted)" }} />
                  Reaching out to remote…
                </div>
              ) : docSyncRisks.length === 0 ? (
                <div className="px-4 py-5 text-sm" style={{ color: "var(--text-muted)" }}>No incoming document risks detected.</div>
              ) : (
                docSyncRisks.map((risk, index) => {
                  const isConflictRisk = risk.risk === "conflict_risk";
                  return (
                    <div
                      key={`${risk.project}/${risk.path}`}
                      className="flex items-center gap-4 px-4 py-3"
                      style={{ borderTop: index === 0 ? "none" : "1px solid var(--border-subtle)" }}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate font-mono text-sm" style={{ color: "var(--text)" }}>
                            {risk.project}/{risk.path}
                          </span>
                          {isConflictRisk && <span className="chip warning">overlaps your local edits</span>}
                        </div>
                        {isConflictRisk && (
                          <div className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>
                            Edited the same doc you have local changes on.
                          </div>
                        )}
                      </div>
                      <button onClick={() => setCompareRisk(risk)} className="btn">
                        Compare
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </section>

          {conflictRiskDocs[0] && (
            <section className="mt-5 rounded-lg border px-4 py-4" style={{ borderColor: "color-mix(in srgb, var(--danger) 40%, var(--border))", background: "var(--danger-soft)" }}>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <p className="text-sm" style={{ color: "var(--text)" }}>
                  <strong>Recommended next step:</strong> review the overlapping doc, then run Safe Pull. After conflicts resolve, commit and push the full set.
                </p>
                <div className="flex gap-2">
                  <button onClick={() => handleOpenRiskDoc(conflictRiskDocs[0])} className="btn lg">Open overlapping doc</button>
                  <button onClick={() => void handleSafePull()} disabled={syncing !== null} className="btn primary lg">Run Safe Pull</button>
                </div>
              </div>
            </section>
          )}

          <section className="mt-8">
            <div className="mb-3 space-y-3">
              <h2 className="text-base font-semibold" style={{ color: "var(--text)" }}>
                Local changes <span className="font-normal" style={{ color: "var(--text-faint)" }}>- {filteredChangedDocs.length} docs - ready to commit</span>
              </h2>
              <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
                <input
                  value={commitMessage}
                  onChange={(e) => setCommitMessage(e.target.value)}
                  placeholder="Commit message... e.g. Update session timeout ADR"
                  className="min-w-0 flex-1 rounded-lg border px-4 text-sm"
                  style={{ height: 36, borderColor: "var(--border)", background: "var(--bg-elevated)" }}
                />
                <button
                  onClick={() => void handleCommitAll()}
                  disabled={!commitMessage.trim() || files.length === 0 || syncing !== null}
                  className="btn primary lg justify-center whitespace-nowrap sm:w-[160px]"
                >
                  Commit all
                </button>
              </div>
            </div>
            <div className="panel overflow-hidden">
              {filteredChangedDocs.length === 0 ? (
                <div className="px-4 py-5 text-sm" style={{ color: "var(--text-muted)" }}>No local docs match this filter.</div>
              ) : (
                filteredChangedDocs.map((doc, index) => {
                  const isDeletedOnly = doc.statuses.every((status) => status.includes("deleted"));
                  const hasConflict = conflictRiskDocs.some((risk) => `${risk.project}/${risk.path}` === doc.key);
                  return (
                    <div
                      key={doc.key}
                      className="flex items-center gap-3 px-4 py-3"
                      style={{ borderTop: index === 0 ? "none" : "1px solid var(--border-subtle)" }}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-sm" style={{ color: "var(--text)" }}>
                            {doc.project}/{doc.path}
                          </span>
                          {hasConflict && <span className="chip warning">overlaps remote</span>}
                          {doc.isProtected && <span className="chip danger">protected</span>}
                          {doc.isCanonical && <span className="chip warning">canonical</span>}
                          {doc.isAiAuthored && <span className="chip magic">AI-authored</span>}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {Array.from(new Set(doc.statuses)).map((status) => (
                            <span key={status} className="chip">{summarizeFileStatus(status)}</span>
                          ))}
                        </div>
                      </div>
                      <div className="hidden text-sm tabular-nums md:block" style={{ color: "var(--text-faint)" }}>
                        {doc.stagedCount} staged - {doc.unstagedCount} unstaged
                      </div>
                      <button
                        onClick={() => handleOpenChangedDoc(doc)}
                        disabled={isDeletedOnly}
                        className="btn"
                      >
                        Open
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </section>

          <details
            className="mt-8"
            open={showGitTools}
            onToggle={(event) => setShowGitTools(event.currentTarget.open)}
          >
            <summary className="cursor-pointer text-sm font-medium" style={{ color: "var(--text-muted)" }}>
              Detailed Git tools
            </summary>
            <div className="mt-3 h-[680px] min-h-[480px] rounded-lg border" style={{ borderColor: "var(--border)" }}>
              <GitPanel />
            </div>
          </details>
        </main>
      </div>

      {compareRisk && (
        <CompareDiffModal
          risk={compareRisk}
          remoteBranch={`origin/${currentBranch ?? "main"}`}
          onClose={() => setCompareRisk(null)}
        />
      )}
    </div>
  );
}

function Metric({
  value,
  label,
  hint,
  tone,
}: {
  value: number;
  label: string;
  hint: string;
  tone: "accent" | "info" | "warning";
}) {
  const color = tone === "accent" ? "var(--accent)" : tone === "info" ? "var(--info)" : "var(--warning)";
  return (
    <div
      className="min-w-0 rounded-lg border px-3 py-2 text-left"
      style={{ borderColor: "var(--border-subtle)", background: "var(--bg-elevated)" }}
    >
      <div className="flex items-baseline gap-2">
        <div className="text-2xl font-semibold tabular-nums" style={{ color }}>{value}</div>
        <div className="truncate text-sm font-medium" style={{ color: "var(--text)" }}>{label}</div>
      </div>
      <div className="mt-1 truncate text-xs" style={{ color: "var(--text-faint)" }}>{hint}</div>
    </div>
  );
}
