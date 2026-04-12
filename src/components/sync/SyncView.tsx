"use client";

import { useEffect, useMemo, useState } from "react";
import * as commands from "@/lib/commands";
import { GitPanel } from "@/components/git/GitPanel";
import { useGitStore } from "@/stores/gitStore";
import { useUIStore } from "@/stores/uiStore";

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

export function SyncView() {
  const files = useGitStore((s) => s.files);
  const commits = useGitStore((s) => s.commits);
  const currentBranch = useGitStore((s) => s.currentBranch);
  const remoteConfig = useGitStore((s) => s.remoteConfig);
  const output = useGitStore((s) => s.output);
  const clearOutput = useGitStore((s) => s.clearOutput);
  const loadStatus = useGitStore((s) => s.loadStatus);
  const loadLog = useGitStore((s) => s.loadLog);
  const loadBranches = useGitStore((s) => s.loadBranches);
  const loadRemoteConfig = useGitStore((s) => s.loadRemoteConfig);
  const setWorkspaceView = useUIStore((s) => s.setWorkspaceView);
  const [syncing, setSyncing] = useState<"pull" | "push" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadStatus();
    void loadLog();
    void loadBranches();
    void loadRemoteConfig();
  }, [loadBranches, loadLog, loadRemoteConfig, loadStatus]);

  const staged = useMemo(
    () => files.filter((file) => file.status.startsWith("staged_")).length,
    [files]
  );
  const unstaged = files.length - staged;
  const latestCommit = commits[0] ?? null;
  const hasRemote = Boolean(remoteConfig?.remote_url);

  const handleSync = async (direction: "pull" | "push") => {
    setSyncing(direction);
    setError(null);
    setMessage(direction === "pull" ? "Pulling latest changes..." : "Pushing changes...");
    try {
      const result =
        direction === "pull" ? await commands.gitPull() : await commands.gitPush();
      await Promise.all([loadStatus(), loadLog(), loadBranches(), loadRemoteConfig()]);
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

  return (
    <div className="h-full overflow-y-auto bg-neutral-950">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-6">
        <section className="rounded-3xl border border-neutral-800 bg-[linear-gradient(135deg,rgba(12,20,14,0.95),rgba(23,23,23,0.92))] p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-900/60 bg-emerald-950/40 px-3 py-1 text-[11px] text-emerald-300">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Team-ready documentation sync
              </div>
              <h1 className="text-2xl font-semibold tracking-tight text-neutral-100">
                Sync
              </h1>
              <p className="mt-2 text-sm leading-6 text-neutral-400">
                Keep the vault shareable like a normal repo with commits, branches,
                pull, push, and review workflows around documentation work.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[360px]">
              <button
                onClick={() => void handleSync("pull")}
                disabled={!hasRemote || syncing !== null}
                className="rounded-2xl border border-neutral-800 bg-neutral-900 px-4 py-3 text-left transition-colors hover:border-neutral-700 hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <div className="text-xs font-medium text-neutral-200">Pull latest</div>
                <div className="mt-1 text-[11px] text-neutral-500">
                  Bring the shared vault up to date before editing.
                </div>
              </button>
              <button
                onClick={() => void handleSync("push")}
                disabled={!hasRemote || syncing !== null}
                className="rounded-2xl border border-neutral-800 bg-neutral-900 px-4 py-3 text-left transition-colors hover:border-neutral-700 hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <div className="text-xs font-medium text-neutral-200">Push changes</div>
                <div className="mt-1 text-[11px] text-neutral-500">
                  Share committed documentation updates with the team.
                </div>
              </button>
              <button
                onClick={() => setWorkspaceView("docs-health")}
                className="rounded-2xl border border-neutral-800 bg-neutral-900 px-4 py-3 text-left transition-colors hover:border-neutral-700 hover:bg-neutral-800"
              >
                <div className="text-xs font-medium text-neutral-200">Review docs health</div>
                <div className="mt-1 text-[11px] text-neutral-500">
                  Check what should be updated before you sync.
                </div>
              </button>
              <button
                onClick={() => setWorkspaceView("agent-access")}
                className="rounded-2xl border border-neutral-800 bg-neutral-900 px-4 py-3 text-left transition-colors hover:border-neutral-700 hover:bg-neutral-800"
              >
                <div className="text-xs font-medium text-neutral-200">Agent access</div>
                <div className="mt-1 text-[11px] text-neutral-500">
                  Keep coding-agent workflows aligned with shared docs.
                </div>
              </button>
            </div>
          </div>
        </section>

        {(message || error || output) && (
          <div
            className={`rounded-2xl border px-4 py-3 text-sm ${
              error
                ? "border-red-900/40 bg-red-950/20 text-red-300"
                : "border-emerald-900/40 bg-emerald-950/20 text-emerald-200"
            }`}
          >
            {error || message || output}
            {output && (
              <button
                onClick={clearOutput}
                className="ml-3 text-xs text-neutral-400 underline-offset-2 hover:underline"
              >
                Clear
              </button>
            )}
          </div>
        )}

        <section className="grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
            <div className="text-[11px] uppercase tracking-wide text-neutral-500">Branch</div>
            <div className="mt-2 text-xl font-semibold text-neutral-100">{currentBranch}</div>
          </div>
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
            <div className="text-[11px] uppercase tracking-wide text-neutral-500">Pending changes</div>
            <div className="mt-2 text-xl font-semibold text-neutral-100">{files.length}</div>
            <div className="mt-1 text-[11px] text-neutral-500">{staged} staged, {unstaged} unstaged</div>
          </div>
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
            <div className="text-[11px] uppercase tracking-wide text-neutral-500">Remote</div>
            <div className="mt-2 text-sm font-medium text-neutral-200">
              {hasRemote ? "Connected" : "Not connected"}
            </div>
            <div className="mt-1 text-[11px] text-neutral-500">
              {remoteConfig?.remote_branch || "main"}
            </div>
          </div>
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
            <div className="text-[11px] uppercase tracking-wide text-neutral-500">Latest commit</div>
            <div className="mt-2 text-sm font-medium text-neutral-200">
              {latestCommit ? formatRelativeDate(latestCommit.date) : "No commits yet"}
            </div>
            <div className="mt-1 truncate text-[11px] text-neutral-500">
              {latestCommit?.message || "Commit your first docs change to start the history."}
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="rounded-3xl border border-neutral-800 bg-neutral-900/70 p-2">
            <div className="border-b border-neutral-800/60 px-3 py-3">
              <h2 className="text-lg font-semibold text-neutral-100">Detailed sync tools</h2>
              <p className="mt-1 text-xs text-neutral-500">
                Manage changes, branch work, remote settings, and pull requests.
              </p>
            </div>
            <div className="h-[680px] min-h-[480px]">
              <GitPanel />
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-3xl border border-neutral-800 bg-neutral-900/70 p-5">
              <h2 className="text-lg font-semibold text-neutral-100">Sync readiness</h2>
              <div className="mt-4 space-y-3">
                <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4">
                  <div className="text-[11px] uppercase tracking-wide text-neutral-500">
                    Remote URL
                  </div>
                  <div className="mt-2 break-all text-[12px] text-neutral-300">
                    {remoteConfig?.remote_url || "No remote configured yet"}
                  </div>
                </div>
                <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4">
                  <div className="text-[11px] uppercase tracking-wide text-neutral-500">
                    Auto sync options
                  </div>
                  <div className="mt-2 text-[12px] text-neutral-400">
                    Pull on open: <span className="text-neutral-200">{remoteConfig?.pull_on_open ? "On" : "Off"}</span>
                  </div>
                  <div className="mt-1 text-[12px] text-neutral-400">
                    Push on close: <span className="text-neutral-200">{remoteConfig?.push_on_close ? "On" : "Off"}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-neutral-800 bg-neutral-900/70 p-5">
              <h2 className="text-lg font-semibold text-neutral-100">Recommended flow</h2>
              <ol className="mt-4 space-y-3 text-[12px] leading-5 text-neutral-400">
                <li>1. Pull before editing if the vault is shared with a team.</li>
                <li>2. Stage and commit documentation work in logical chunks.</li>
                <li>3. Push branches or open a PR when changes should be reviewed.</li>
              </ol>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
