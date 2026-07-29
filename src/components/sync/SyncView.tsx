"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as commands from "@/lib/commands";
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
  isAsset: boolean;
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
      isAsset: false,
    };
  }

  const match = path.match(/^projects\/([^/]+)\/docs\/(.+)$/);
  if (!match) return null;
  return {
    project: match[1],
    path: match[2],
    isAsset: !match[2].toLowerCase().endsWith(".md"),
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

function statusChipClass(status: string): string {
  if (status.startsWith("staged_")) {
    return status === "staged_deleted" ? "chip danger" : "chip accent";
  }
  if (status === "deleted") return "chip danger";
  if (status === "modified") return "chip warning";
  return "chip";
}

export function SyncView() {
  const files = useGitStore((s) => s.files);
  const commits = useGitStore((s) => s.commits);
  const currentBranch = useGitStore((s) => s.currentBranch);
  const remoteConfig = useGitStore((s) => s.remoteConfig);
  const authStatus = useGitStore((s) => s.authStatus);
  const syncStatus = useGitStore((s) => s.syncStatus);
  const docSyncRisks = useGitStore((s) => s.docSyncRisks);
  const conflictFiles = useGitStore((s) => s.conflictFiles);
  const output = useGitStore((s) => s.output);
  const clearOutput = useGitStore((s) => s.clearOutput);
  const loadStatus = useGitStore((s) => s.loadStatus);
  const loadLog = useGitStore((s) => s.loadLog);
  const loadBranches = useGitStore((s) => s.loadBranches);
  const loadRemoteConfig = useGitStore((s) => s.loadRemoteConfig);
  const loadAuthStatus = useGitStore((s) => s.loadAuthStatus);
  const loadSyncStatus = useGitStore((s) => s.loadSyncStatus);
  const loadDocSyncRisks = useGitStore((s) => s.loadDocSyncRisks);
  const loadConflictFiles = useGitStore((s) => s.loadConflictFiles);
  const pushRemote = useGitStore((s) => s.push);
  const updateSafely = useGitStore((s) => s.updateSafely);
  const pullDiscardLocal = useGitStore((s) => s.pullDiscardLocal);
  const connectProvider = useGitStore((s) => s.connectProvider);
  const reconnectProvider = useGitStore((s) => s.reconnectProvider);
  const convertRemoteToHttps = useGitStore((s) => s.convertRemoteToHttps);
  const resolveConflictFile = useGitStore((s) => s.resolveConflictFile);
  const continueUpdate = useGitStore((s) => s.continueUpdate);
  const stageAll = useGitStore((s) => s.stageAll);
  const stagePaths = useGitStore((s) => s.stagePaths);
  const commit = useGitStore((s) => s.commit);
  const commitMessage = useGitStore((s) => s.commitMessage);
  const setCommitMessage = useGitStore((s) => s.setCommitMessage);
  const setWorkspaceView = useUIStore((s) => s.setWorkspaceView);
  const setShowOnboarding = useUIStore((s) => s.setShowOnboarding);
  const openDocument = useEditorStore((s) => s.openDocument);
  const openWikiFile = useEditorStore((s) => s.openWikiFile);
  const [fetchingRemote, setFetchingRemote] = useState(true);
  const [syncing, setSyncing] = useState<"pull" | "push" | "safe-pull" | "safe-sync" | "discard-pull" | "commit" | "fetch" | "resolve" | "continue" | "auth" | null>(null);
  const [confirmDiscardPull, setConfirmDiscardPull] = useState(false);
  const [confirmHttpsSwitch, setConfirmHttpsSwitch] = useState(false);
  const [activeFilter, setActiveFilter] = useState<"all" | "conflict" | "ai" | "sensitive" | "mine">("all");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updatePaused, setUpdatePaused] = useState(false);
  const [docMetaByKey, setDocMetaByKey] = useState<Record<string, DocumentInfo>>({});
  const [compareRisk, setCompareRisk] = useState<DocSyncRiskInfo | null>(null);
  const [selectedDocKeys, setSelectedDocKeys] = useState<Set<string>>(new Set());
  const prevDocKeysRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let active = true;

    const refreshLocal = async () => {
      await Promise.all([
        loadStatus(),
        loadLog(),
        loadBranches(),
        loadRemoteConfig(),
        loadAuthStatus(),
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
        loadAuthStatus(),
        loadDocSyncRisks(),
      ]);
      if (active) setFetchingRemote(false);
    };

    void refreshLocal();
    const timer = window.setTimeout(() => {
      void refreshRemote();
    }, 800);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [
    loadBranches,
    loadAuthStatus,
    loadConflictFiles,
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
      const filename = docRef.path.split("/").at(-1) || docRef.path;

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
        title: meta?.title || (docRef.isAsset ? filename : filename.replace(/\.md$/, "")),
        isAsset: docRef.isAsset,
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

  // Keep selectedDocKeys in sync with changedDocs:
  // auto-select newly appeared items, prune items that were committed/reverted.
  useEffect(() => {
    const currentKeys = new Set(changedDocs.map((d) => d.key));
    setSelectedDocKeys((prev) => {
      const next = new Set<string>();
      for (const key of currentKeys) {
        if (!prevDocKeysRef.current.has(key) || prev.has(key)) {
          next.add(key);
        }
      }
      prevDocKeysRef.current = currentKeys;
      return next;
    });
  }, [changedDocs]);

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

  const riskByKey = useMemo(
    () => new Map(docSyncRisks.map((r) => [`${r.project}/${r.path}`, r])),
    [docSyncRisks]
  );

  const needsPullStrategy = Boolean(syncStatus && (syncStatus.behind > 0 || syncStatus.diverged));
  const hasPausedConflicts = conflictFiles.length > 0 || updatePaused;
  const canUpdateSafely = hasRemote && needsPullStrategy && !hasPausedConflicts;
  const canPush = Boolean(hasRemote && syncStatus && syncStatus.ahead > 0 && syncStatus.behind === 0 && !syncStatus.diverged);
  const recommendedLabel = syncStatus?.diverged
    ? "Update safely"
    : canUpdateSafely && (syncStatus?.ahead ?? 0) > 0
      ? "Update, then Push"
      : "Get latest safely";
  const pushLabel = syncing === "push" ? "Pushing..." : (syncStatus?.ahead ?? 0) > 0 ? `Push ${syncStatus?.ahead}` : "Push";
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
      await loadConflictFiles();
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
      await loadConflictFiles();
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
    if (!commitMessage.trim() || selectedDocKeys.size === 0) return;
    setSyncing("commit");
    setError(null);
    const allSelected = selectedDocKeys.size === changedDocs.length;
    setMessage(allSelected
      ? "Staging and committing local documentation changes..."
      : `Staging and committing ${selectedDocKeys.size} selected doc${selectedDocKeys.size === 1 ? "" : "s"}...`
    );
    try {
      if (allSelected) {
        await stageAll();
      } else {
        const pathsToStage = files
          .filter((f) => {
            const parsed = parseDocPath(f.path);
            return parsed ? selectedDocKeys.has(`${parsed.project}/${parsed.path}`) : false;
          })
          .map((f) => f.path);
        await stagePaths(pathsToStage);
      }
      await commit();
      setMessage("Committed changes.");
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
    if (doc.isAsset) {
      void commands.showInFolder(doc.project, doc.path);
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

  const handleConnectProvider = async () => {
    setSyncing("auth");
    setError(null);
    setMessage("Opening git provider login...");
    try {
      const result = await connectProvider();
      setMessage(result || "Git provider authentication is ready.");
      window.setTimeout(() => setMessage(null), 2600);
    } catch (err) {
      setError(String(err));
    } finally {
      setSyncing(null);
    }
  };

  const handleReconnectProvider = async () => {
    setSyncing("auth");
    setError(null);
    setMessage("Forgetting saved git credential and opening provider login...");
    try {
      const result = await reconnectProvider();
      setMessage(result || "Git provider authentication refreshed.");
      window.setTimeout(() => setMessage(null), 2600);
    } catch (err) {
      setError(String(err));
    } finally {
      setSyncing(null);
    }
  };

  const handleSwitchToHttpsAuth = async () => {
    if (!confirmHttpsSwitch) {
      setConfirmHttpsSwitch(true);
      return;
    }

    setSyncing("auth");
    setError(null);
    setMessage("Switching remote to HTTPS auth...");
    try {
      const httpsUrl = await convertRemoteToHttps();
      setMessage(`Remote switched to ${httpsUrl}. Connect the provider to finish HTTPS auth.`);
      setConfirmHttpsSwitch(false);
      window.setTimeout(() => setMessage(null), 2600);
    } catch (err) {
      setError(String(err));
    } finally {
      setSyncing(null);
    }
  };

  const stagedCount = files.filter((f) => f.status.startsWith("staged_")).length;
  const unstagedCount = files.filter((f) => !f.status.startsWith("staged_")).length;

  const filterOptions: { id: typeof activeFilter; label: string; count: number }[] = [
    { id: "all", label: "All", count: changedDocs.length },
    { id: "conflict", label: "Conflicts", count: conflictRiskDocs.length },
    { id: "ai", label: "AI", count: aiChangedDocs },
    { id: "sensitive", label: "Sensitive", count: sensitiveChangedDocs },
    { id: "mine", label: "Mine", count: changedDocs.length },
  ];

  return (
    <div className="workspace-page h-full min-w-0 flex-1 overflow-hidden">
      <div className="flex h-full min-h-0">

        {/* ── Left: changed documents ──────────────────────────────── */}
        <main className="flex-1 min-w-0 overflow-y-auto px-8 py-6">
          <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--text-muted)" }}>
                Team Sync
              </div>
              <h1 className="mt-2 text-2xl font-semibold" style={{ color: "var(--text)" }}>
                {hasPausedConflicts
                  ? "Update paused"
                  : needsPullStrategy
                    ? "Review shared updates"
                    : changedDocs.length > 0
                      ? "Prepare local changes"
                      : "Vault is in sync"}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6" style={{ color: "var(--text-muted)" }}>
                {hasPausedConflicts
                  ? "Resolve the paused update before pulling, committing, or pushing more work."
                  : needsPullStrategy
                    ? "Bring in shared work first, then commit or push your local documentation changes."
                    : changedDocs.length > 0
                      ? "Select the local docs you want to commit, then share them when the branch is ready."
                      : "No local document edits or incoming document risks were found."}
              </p>
            </div>
            <div className="grid min-w-[360px] grid-cols-3 overflow-hidden rounded-lg border" style={{ borderColor: "var(--border)", background: "var(--bg-panel)" }}>
              <MetricTile label="Ahead" value={syncStatus?.ahead ?? 0} />
              <MetricTile label="Behind" value={syncStatus?.behind ?? 0} />
              <MetricTile label="Local" value={changedDocs.length} />
            </div>
          </div>

          {/* Status / error banner */}
          {(message || error || output) && (
            <div
              className="mb-5 rounded-lg px-4 py-3 text-sm"
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

          {/* Paused conflicts */}
          {hasPausedConflicts && (
            <section className="mb-6 rounded-lg border-2 p-4" style={{ borderColor: "var(--warning)", background: "var(--warning-soft)" }}>
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
                        <button onClick={() => void handleResolveConflict(conflict.path, "keep_both")} disabled={syncing !== null} className="btn primary">Keep both</button>
                        <button onClick={() => void handleResolveConflict(conflict.path, "use_shared")} disabled={syncing !== null} className="btn">Use shared</button>
                        <button onClick={() => void handleResolveConflict(conflict.path, "use_local")} disabled={syncing !== null} className="btn">Use mine</button>
                      </div>
                    </div>
                    <div className="mt-4 grid gap-3 lg:grid-cols-2">
                      <div className="rounded-md border p-3" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-elevated)" }}>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--text-muted)" }}>Shared vault</div>
                        <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap text-xs leading-5" style={{ color: "var(--text)" }}>
                          {conflict.shared_sections.join("\n\n") || "No shared-side text detected."}
                        </pre>
                      </div>
                      <div className="rounded-md border p-3" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-elevated)" }}>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--text-muted)" }}>My local work</div>
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

          {/* Pull strategy */}
          {needsPullStrategy && !hasPausedConflicts && (
            <section className="mb-6">
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
                      : `SlateVault will set aside your ${changedDocs.length} local change${changedDocs.length === 1 ? "" : "s"}, load the latest shared vault, then reapply your work.`}
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
                  <button onClick={() => void handleSafePull()} disabled={syncing !== null} className="btn primary mt-5 lg">
                    {syncing === "safe-pull" ? "Running..." : "Run safe update"}
                  </button>
                </div>

                <div className="rounded-lg border p-4" style={{ borderColor: "var(--border)", background: "var(--bg-panel)" }}>
                  <div className="flex items-center gap-3">
                    <span className="chip danger">destructive</span>
                    <h3 className="text-lg font-semibold" style={{ color: "var(--text)" }}>Discard Local & Pull</h3>
                  </div>
                  <p className="mt-3 text-sm leading-6" style={{ color: "var(--text-muted)" }}>
                    Throw away your {changedDocs.length} local changes and pull origin clean. This is not reversible.
                  </p>
                  <ol className="mt-4 space-y-2 text-sm" style={{ color: "var(--text-muted)" }}>
                    <li>1. Delete uncommitted edits permanently</li>
                    <li>2. Reset working tree to origin/{remoteConfig?.remote_branch || currentBranch}</li>
                    <li>3. Cannot be undone</li>
                  </ol>
                  <div className="mt-5 flex gap-2">
                    <button onClick={() => void handleDiscardLocalPull()} disabled={syncing !== null} className="btn danger lg">
                      {confirmDiscardPull ? "Confirm discard & pull" : "Discard & Pull..."}
                    </button>
                    {confirmDiscardPull && (
                      <button onClick={() => setConfirmDiscardPull(false)} disabled={syncing !== null} className="btn lg">Cancel</button>
                    )}
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Conflict risk recommendation */}
          {conflictRiskDocs[0] && (
            <div className="mb-5 rounded-lg border px-4 py-4" style={{ borderColor: "color-mix(in srgb, var(--danger) 40%, var(--border))", background: "var(--danger-soft)" }}>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <p className="text-sm" style={{ color: "var(--text)" }}>
                  <strong>Recommended next step:</strong> review the overlapping doc, then run Safe Pull. After conflicts resolve, commit and push the full set.
                </p>
                <div className="flex gap-2">
                  <button onClick={() => handleOpenRiskDoc(conflictRiskDocs[0])} className="btn lg">Open overlapping doc</button>
                  <button onClick={() => void handleSafePull()} disabled={syncing !== null} className="btn primary lg">Run Safe Pull</button>
                </div>
              </div>
            </div>
          )}

          {/* Changed documents header */}
          <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h2 className="text-base font-semibold" style={{ color: "var(--text)" }}>
                Changed documents{" "}
                <span className="font-normal" style={{ color: "var(--text-faint)" }}>
                  ({filteredChangedDocs.length})
                </span>
              </h2>
              <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
                Local documentation and vault assets ready for review.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {filterOptions.map(({ id, label, count }) => (
                <button
                  key={id}
                  onClick={() => setActiveFilter(id)}
                  className="h-8 rounded-md border px-3 text-xs font-medium transition-colors"
                  style={{
                    background: activeFilter === id ? "var(--accent)" : "var(--bg-panel)",
                    color: activeFilter === id ? "#fff" : "var(--text-muted)",
                    borderColor: activeFilter === id ? "var(--accent)" : "var(--border)",
                  }}
                >
                  {label}{count > 0 ? ` ${count}` : ""}
                </button>
              ))}
              {changedDocs.length > 0 && (
                <label className="flex h-8 cursor-pointer items-center gap-2 rounded-md border px-3 text-xs font-medium select-none" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
                  <input
                    type="checkbox"
                    checked={selectedDocKeys.size === changedDocs.length}
                    ref={(el) => {
                      if (el) el.indeterminate = selectedDocKeys.size > 0 && selectedDocKeys.size < changedDocs.length;
                    }}
                    onChange={(e) =>
                      setSelectedDocKeys(e.target.checked ? new Set(changedDocs.map((d) => d.key)) : new Set())
                    }
                    style={{ accentColor: "var(--accent)", width: 14, height: 14 }}
                  />
                  Select all
                </label>
              )}
            </div>
          </div>

          {/* Document cards */}
          {filteredChangedDocs.length === 0 ? (
            <div
              className="rounded-xl border px-6 py-10 text-center text-sm"
              style={{ borderColor: "var(--border-subtle)", background: "var(--bg-panel)", color: "var(--text-muted)" }}
            >
              {activeFilter === "all" ? "No local changes." : "No changes match this filter."}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredChangedDocs.map((doc) => {
                const isDeletedOnly = doc.statuses.every((s) => s.includes("deleted"));
                const hasConflict = conflictRiskDocs.some((risk) => `${risk.project}/${risk.path}` === doc.key);
                const riskForDoc = riskByKey.get(doc.key);
                const isRemoteChanged = Boolean(riskForDoc) && !hasConflict;
                const isSelected = selectedDocKeys.has(doc.key);

                return (
                  <div
                    key={doc.key}
                    className="rounded-xl border p-4 transition-colors"
                    style={{
                      borderColor: isSelected ? "var(--accent)" : "var(--border)",
                      background: "var(--bg-panel)",
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) =>
                          setSelectedDocKeys((prev) => {
                            const next = new Set(prev);
                            e.target.checked ? next.add(doc.key) : next.delete(doc.key);
                            return next;
                          })
                        }
                        style={{ accentColor: "var(--accent)", width: 15, height: 15, flexShrink: 0, marginTop: 3 }}
                      />

                      <div className="min-w-0 flex-1">
                        {/* Title row + status badges */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div
                              className="truncate font-semibold text-sm leading-5"
                              style={{ color: "var(--text)" }}
                            >
                              {doc.title}
                            </div>
                            <div
                              className="mt-0.5 truncate text-xs"
                              style={{ color: "var(--text-muted)" }}
                            >
                              {doc.project} · {doc.path}
                            </div>
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-1">
                            {Array.from(new Set(doc.statuses)).map((s) => (
                              <span key={s} className={statusChipClass(s)}>
                                {summarizeFileStatus(s)}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Tag pills + action buttons */}
                        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap gap-1.5">
                            {doc.isAiAuthored && <span className="chip magic">AI-authored</span>}
                            {doc.isCanonical && <span className="chip warning">Canonical</span>}
                            {doc.isProtected && <span className="chip danger">protected</span>}
                            {hasConflict && <span className="chip warning">conflict risk</span>}
                            {isRemoteChanged && <span className="chip">remote changed</span>}
                            {doc.isAsset && <span className="chip">asset</span>}
                          </div>
                          <div className="flex shrink-0 gap-2">
                            {riskForDoc && (
                              <button onClick={() => setCompareRisk(riskForDoc)} className="btn sm">
                                Compare diff
                              </button>
                            )}
                            <button
                              onClick={() => handleOpenChangedDoc(doc)}
                              disabled={isDeletedOnly}
                              className="btn sm"
                            >
                              {doc.isAsset ? "Reveal" : "Open"}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Incoming from origin */}
          <section className="mt-8">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold" style={{ color: "var(--text)" }}>
                Incoming from origin{" "}
                {fetchingRemote ? (
                  <span className="font-normal" style={{ color: "var(--text-faint)" }}>
                    — <span className="animate-pulse">checking…</span>
                  </span>
                ) : (
                  <span className="font-normal" style={{ color: "var(--text-faint)" }}>
                    — {docSyncRisks.length} docs
                  </span>
                )}
              </h2>
            </div>
            <div className="panel overflow-hidden">
              {fetchingRemote ? (
                <div>
                  {[1, 2].map((i) => (
                    <div
                      key={i}
                      className="flex items-center gap-4 px-4 py-3"
                      style={{ borderTop: i === 1 ? "none" : "1px solid var(--border-subtle)" }}
                    >
                      <div className="flex-1 space-y-2">
                        <div className="h-3 w-48 animate-pulse rounded" style={{ background: "var(--border)" }} />
                        <div className="h-2.5 w-32 animate-pulse rounded" style={{ background: "var(--border-subtle)" }} />
                      </div>
                      <div className="h-7 w-16 animate-pulse rounded-md" style={{ background: "var(--border)" }} />
                    </div>
                  ))}
                </div>
              ) : docSyncRisks.length === 0 ? (
                <div className="px-4 py-5 text-sm" style={{ color: "var(--text-muted)" }}>
                  No incoming document risks detected.
                </div>
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
                          <div className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
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
        </main>

        {/* ── Right: git sidebar ───────────────────────────────────── */}
        <aside
          className="flex w-[372px] shrink-0 flex-col overflow-y-auto border-l"
          style={{ borderColor: "var(--border)", background: "var(--bg-subtle)" }}
        >
          <div className="border-b p-4" style={{ borderColor: "var(--border)" }}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--text-muted)" }}>Branch</div>
                <div className="mt-1 truncate font-mono text-base font-semibold" style={{ color: "var(--text)" }}>{currentBranch}</div>
              </div>
              <span className="shrink-0 rounded-md border px-2 py-1 text-xs" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
                {remoteConfig?.remote_branch || "main"}
              </span>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <SidebarStat label="Ahead" value={syncStatus?.ahead ?? 0} />
              <SidebarStat label="Behind" value={syncStatus?.behind ?? 0} />
              <SidebarStat label="Local" value={changedDocs.length} />
            </div>
            <div className="mt-3 flex items-center gap-2 text-xs" style={{ color: "var(--text-muted)" }}>
              {fetchingRemote && <Spinner />}
              <span>{fetchingRemote ? "Checking origin..." : "Remote check complete"}</span>
            </div>
          </div>

          <div className="border-b p-4" style={{ borderColor: "var(--border)" }}>
            <div className="rounded-lg border p-4" style={{ borderColor: "var(--border)", background: "var(--bg-panel)" }}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--text-muted)" }}>Authentication</div>
                  <div className="mt-2 text-sm font-semibold" style={{ color: "var(--text)" }}>{providerLabel(authStatus?.provider)}</div>
                </div>
                <span className={`chip ${authTone(authStatus?.auth_state)}`}>{authLabel(authStatus?.auth_state)}</span>
              </div>
              <div className="mt-3 text-xs leading-5" style={{ color: "var(--text-muted)" }}>
                {authStatus?.message || "Checking git authentication..."}
              </div>
              {authStatus?.remote_kind === "https" && (
                <button
                  onClick={() =>
                    authStatus.auth_state === "ready"
                      ? void handleReconnectProvider()
                      : void handleConnectProvider()
                  }
                  disabled={syncing !== null}
                  className={`btn ${authStatus.auth_state === "ready" ? "" : "primary"} mt-4 h-9 w-full justify-center`}
                >
                  {syncing === "auth"
                    ? authStatus.auth_state === "ready" ? "Reconnecting..." : "Connecting..."
                    : authStatus.auth_state === "ready" ? "Reconnect provider" : "Connect provider"}
                </button>
              )}
              {authStatus?.remote_kind === "ssh" && (
                <>
                  <button
                    onClick={() => void handleSwitchToHttpsAuth()}
                    disabled={syncing !== null}
                    className="btn mt-4 h-9 w-full justify-center"
                  >
                    {syncing === "auth"
                      ? "Switching..."
                      : confirmHttpsSwitch
                        ? "Confirm HTTPS switch"
                        : "Switch to HTTPS auth"}
                  </button>
                  {confirmHttpsSwitch && (
                    <button
                      onClick={() => setConfirmHttpsSwitch(false)}
                      disabled={syncing !== null}
                      className="btn mt-2 h-9 w-full justify-center"
                    >
                      Cancel
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="border-b p-4" style={{ borderColor: "var(--border)" }}>
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--text-muted)" }}>Sync actions</div>
            <div className="mt-3 grid gap-2">
              <button
                onClick={() => void handleSafePullThenPush()}
                disabled={!canUpdateSafely || syncing !== null}
                className="btn primary h-9 w-full justify-center whitespace-nowrap"
              >
                {syncing === "safe-sync" ? "Working..." : recommendedLabel}
              </button>
              <button
                onClick={() => void handlePush()}
                disabled={!canPush || syncing !== null}
                className="btn h-9 w-full justify-center whitespace-nowrap"
                title={pushHint}
              >
                {pushLabel}
              </button>
            </div>
            <p className="mt-2 text-xs leading-5" style={{ color: "var(--text-faint)" }}>{pushHint}</p>
          </div>

          <div className="border-b p-4" style={{ borderColor: "var(--border)" }}>
            <div className="flex items-center justify-between gap-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--text-muted)" }}>Commit</div>
              <span className="text-xs" style={{ color: "var(--text-faint)" }}>{selectedDocKeys.size} selected</span>
            </div>
            <div className="mt-3 grid gap-2">
              <input
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) void handleCommitAll();
                }}
                placeholder="Commit message..."
                className="h-9 min-w-0 rounded-lg border px-3 text-sm"
                style={{
                  borderColor: "var(--border)",
                  background: "var(--bg-elevated)",
                  color: "var(--text)",
                }}
              />
              <button
                onClick={() => void handleCommitAll()}
                disabled={!commitMessage.trim() || selectedDocKeys.size === 0 || syncing !== null}
                className="btn primary h-9 w-full justify-center whitespace-nowrap"
              >
                {syncing === "commit" ? "Committing..." : selectedDocKeys.size > 0 ? `Commit selected (${selectedDocKeys.size})` : "Commit selected"}
              </button>
            </div>
            <div className="mt-2 text-xs" style={{ color: "var(--text-faint)" }}>
              {selectedDocKeys.size === changedDocs.length && changedDocs.length > 0
                ? "All selected"
                : `${selectedDocKeys.size} selected`}
              {" · "}
              {stagedCount} staged · {unstagedCount} unstaged
            </div>
          </div>

          <div className="p-4">
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--text-muted)" }}>
              Recent commits
            </div>
            <div className="space-y-2">
              {commits.slice(0, 5).map((commitItem) => (
                <div
                  key={commitItem.oid}
                  className="rounded-md border px-3 py-2"
                  style={{ borderColor: "var(--border)", background: "var(--bg-panel)" }}
                >
                  <div className="truncate text-sm" style={{ color: "var(--text)" }}>
                    {commitItem.message}
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-2 text-xs" style={{ color: "var(--text-faint)" }}>
                    <span className="font-mono">{commitItem.oid}</span>
                    <span>{formatRelativeDate(commitItem.date)}</span>
                  </div>
                </div>
              ))}
              {commits.length === 0 && (
                <div className="rounded-md border px-3 py-4 text-center text-sm" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
                  No commits yet.
                </div>
              )}
            </div>
          </div>
        </aside>
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

function providerLabel(provider?: string) {
  switch (provider) {
    case "github":
      return "GitHub";
    case "azure-devops":
      return "Azure DevOps";
    case "gitlab":
      return "GitLab";
    case "bitbucket":
      return "Bitbucket";
    case "unknown":
      return "Git provider";
    default:
      return provider ? provider : "Git provider";
  }
}

function authLabel(state?: string) {
  switch (state) {
    case "ready":
      return "ready";
    case "needs-login":
      return "login needed";
    case "ssh-configured":
      return "ssh";
    case "missing-gcm":
      return "gcm missing";
    case "missing-remote":
      return "no remote";
    case "repo-not-found":
      return "no access";
    case "network-error":
      return "offline";
    default:
      return "checking";
  }
}

function authTone(state?: string) {
  if (state === "ready" || state === "ssh-configured") return "success";
  if (state === "missing-remote") return "";
  if (!state) return "";
  return "warning";
}

function SidebarStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border px-2 py-2 text-center" style={{ borderColor: "var(--border)", background: "var(--bg-panel)" }}>
      <div className="text-base font-semibold tabular-nums" style={{ color: "var(--text)" }}>{value}</div>
      <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.1em]" style={{ color: "var(--text-faint)" }}>{label}</div>
    </div>
  );
}

function MetricTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="px-5 py-4 text-left" style={{ borderLeft: "1px solid var(--border-subtle)" }}>
      <div className="text-xl font-semibold tabular-nums" style={{ color: "var(--text)" }}>{value}</div>
      <div className="mt-1 text-xs font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--text-faint)" }}>{label}</div>
    </div>
  );
}

function formatRelativeDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;

  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString();
}

function Spinner() {
  return (
    <svg
      className="animate-spin"
      width="12"
      height="12"
      viewBox="0 0 14 14"
      fill="none"
      style={{ flexShrink: 0 }}
    >
      <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" />
      <path d="M7 1.5A5.5 5.5 0 0 1 12.5 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
