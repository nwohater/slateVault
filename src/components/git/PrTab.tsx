"use client";

import { useEffect, useState } from "react";
import { useGitStore } from "@/stores/gitStore";
import * as commands from "@/lib/commands";
import type { FileDiff, PrCreateResponse } from "@/types";

export function PrTab() {
  const currentBranch = useGitStore((s) => s.currentBranch);
  const branches = useGitStore((s) => s.branches);
  const loadBranches = useGitStore((s) => s.loadBranches);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [targetBranch, setTargetBranch] = useState("main");
  const [platform, setPlatform] = useState<string | null>(null);
  const [diffSummary, setDiffSummary] = useState<{
    files: number;
    additions: number;
    deletions: number;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PrCreateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadBranches();
    commands.gitDetectPlatform().then(setPlatform).catch(() => {});
  }, [loadBranches]);

  // Auto-populate title from branch name
  useEffect(() => {
    if (!title) {
      const name = currentBranch
        .replace(/^(feature|fix|chore|docs)\//, "")
        .replace(/[-_]/g, " ");
      setTitle(name.charAt(0).toUpperCase() + name.slice(1));
    }
  }, [currentBranch]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load diff summary when branch changes
  useEffect(() => {
    if (currentBranch && targetBranch && currentBranch !== targetBranch) {
      commands
        .gitDiffBranches(targetBranch, currentBranch)
        .then((diffs: FileDiff[]) => {
          const additions = diffs.reduce((a, d) => a + d.stats.additions, 0);
          const deletions = diffs.reduce((a, d) => a + d.stats.deletions, 0);
          setDiffSummary({ files: diffs.length, additions, deletions });
        })
        .catch(() => setDiffSummary(null));
    } else {
      setDiffSummary(null);
    }
  }, [currentBranch, targetBranch]);

  const isOnDefault = currentBranch === targetBranch || currentBranch === "main";

  const handleCreatePr = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      // Push branch first
      await commands.gitPushBranch(currentBranch);

      // Create PR
      const pr = await commands.gitCreatePr(
        title,
        description,
        currentBranch,
        targetBranch
      );

      setResult(pr);

      // Open in browser
      const { open } = await import("@tauri-apps/plugin-shell");
      await open(pr.url);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const platformLabel =
    platform === "github"
      ? "GitHub"
      : platform === "azure_devops"
        ? "Azure DevOps"
        : null;

  return (
    <div className="flex flex-col h-full text-xs p-2 gap-2 overflow-y-auto">
      {/* Platform badge */}
      {platformLabel && (
        <div className="flex items-center gap-1.5">
          <span className="px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400 text-[10px]">
            {platformLabel}
          </span>
        </div>
      )}

      {isOnDefault && (
        <div className="p-3 text-center text-neutral-500 border border-neutral-800 rounded">
          Switch to a feature branch to create a PR.
          <br />
          Currently on <span className="text-neutral-400">{currentBranch}</span>.
        </div>
      )}

      {!isOnDefault && (
        <>
          {/* Source branch (read-only) */}
          <div>
            <label className="text-neutral-500 mb-0.5 block">Source</label>
            <div className="px-2 py-1.5 bg-neutral-800 border border-neutral-700 rounded text-neutral-300">
              {currentBranch}
            </div>
          </div>

          {/* Target branch */}
          <div>
            <label className="text-neutral-500 mb-0.5 block">Target</label>
            <select
              value={targetBranch}
              onChange={(e) => setTargetBranch(e.target.value)}
              className="w-full px-2 py-1.5 bg-neutral-800 border border-neutral-700 rounded text-neutral-200 outline-none focus:border-blue-600"
            >
              {branches
                .filter((b) => b.name !== currentBranch)
                .map((b) => (
                  <option key={b.name} value={b.name}>
                    {b.name}
                  </option>
                ))}
            </select>
          </div>

          {/* Title */}
          <div>
            <label className="text-neutral-500 mb-0.5 block">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-2 py-1.5 bg-neutral-800 border border-neutral-700 rounded text-neutral-200 placeholder-neutral-500 outline-none focus:border-blue-600"
              placeholder="PR title..."
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-neutral-500 mb-0.5 block">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-2 py-1.5 bg-neutral-800 border border-neutral-700 rounded text-neutral-200 placeholder-neutral-500 outline-none focus:border-blue-600 resize-none"
              placeholder="Describe the changes..."
            />
          </div>

          {/* Diff summary */}
          {diffSummary && (
            <div className="flex items-center gap-2 px-2 py-1.5 bg-neutral-800/50 rounded text-neutral-400">
              <span>{diffSummary.files} file{diffSummary.files !== 1 ? "s" : ""}</span>
              <span className="text-green-400">+{diffSummary.additions}</span>
              <span className="text-red-400">-{diffSummary.deletions}</span>
            </div>
          )}

          {/* Create button */}
          <button
            onClick={handleCreatePr}
            disabled={loading || !title.trim() || !platform}
            className="w-full py-2 rounded bg-blue-700 hover:bg-blue-600 disabled:bg-neutral-800 disabled:text-neutral-500 text-white font-medium"
          >
            {loading ? "Pushing & Creating PR..." : "Push & Create PR"}
          </button>

          {!platform && (
            <p className="text-yellow-500 text-[10px]">
              No supported platform detected. Configure a GitHub or Azure DevOps
              remote and add credentials in Settings.
            </p>
          )}

          {/* Result */}
          {result && (
            <div className="p-2 rounded bg-green-900/30 border border-green-800 text-green-300">
              PR #{result.number} created on {result.platform}.
              <br />
              <a
                href="#"
                onClick={async (e) => {
                  e.preventDefault();
                  const { open } = await import("@tauri-apps/plugin-shell");
                  await open(result.url);
                }}
                className="text-blue-400 hover:underline"
              >
                Open in browser
              </a>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="p-2 rounded bg-red-900/30 border border-red-800 text-red-300 break-words">
              {error}
            </div>
          )}
        </>
      )}
    </div>
  );
}
