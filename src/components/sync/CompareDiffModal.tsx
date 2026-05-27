"use client";

import { useEffect, useState } from "react";
import * as commands from "@/lib/commands";
import { DiffViewer } from "@/components/git/DiffViewer";
import type { DocSyncRiskInfo, FileDiff } from "@/types";

interface CompareDiffModalProps {
  risk: DocSyncRiskInfo;
  remoteBranch: string;
  onClose: () => void;
}

function riskToGitPath(risk: DocSyncRiskInfo): string {
  if (risk.project === "wiki") return `wiki/${risk.path}`;
  return `projects/${risk.project}/docs/${risk.path}`;
}

export function CompareDiffModal({ risk, remoteBranch, onClose }: CompareDiffModalProps) {
  const [diff, setDiff] = useState<FileDiff | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const gitPath = riskToGitPath(risk);
    setLoading(true);
    setError(null);
    setDiff(null);
    commands
      .gitDiffBranches("HEAD", remoteBranch)
      .then((diffs) => {
        const found = diffs.find((d) => d.path === gitPath);
        setDiff(
          found ?? {
            path: gitPath,
            hunks: [],
            stats: { additions: 0, deletions: 0 },
          }
        );
      })
      .catch((e: unknown) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [risk, remoteBranch]);

  const isConflictRisk = risk.risk === "conflict_risk";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.55)" }}
      onClick={onClose}
    >
      <div
        className="flex flex-col overflow-hidden rounded-xl border"
        style={{
          width: "min(900px, 94vw)",
          height: "min(660px, 88vh)",
          background: "var(--bg-panel)",
          borderColor: "var(--border)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex shrink-0 items-center justify-between border-b px-4 py-3"
          style={{ borderColor: "var(--border)", background: "var(--bg-subtle)" }}
        >
          <div className="flex min-w-0 items-center gap-3">
            <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>
              Compare
            </span>
            <span className="truncate font-mono text-xs" style={{ color: "var(--text-muted)" }}>
              {risk.project}/{risk.path}
            </span>
            {isConflictRisk ? (
              <span className="chip warning shrink-0">conflict risk</span>
            ) : (
              <span className="chip shrink-0">remote changed</span>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-4">
            <span className="text-xs" style={{ color: "var(--text-faint)" }}>
              local HEAD ← {remoteBranch}
            </span>
            <button
              onClick={onClose}
              className="text-lg leading-none"
              style={{ color: "var(--text-muted)" }}
              aria-label="Close"
            >
              ×
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1">
          {loading && (
            <div
              className="flex h-full items-center justify-center text-sm"
              style={{ color: "var(--text-muted)" }}
            >
              Loading diff…
            </div>
          )}
          {error && (
            <div
              className="flex h-full items-center justify-center text-sm"
              style={{ color: "var(--danger)" }}
            >
              {error}
            </div>
          )}
          {!loading && !error && diff && <DiffViewer diff={diff} />}
        </div>
      </div>
    </div>
  );
}
