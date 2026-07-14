"use client";

import { useEffect, useRef, useState } from "react";
import { useGitStore } from "@/stores/gitStore";
import { DiffViewer } from "./DiffViewer";
import {
  GitAddedIcon,
  GitModifiedIcon,
  GitDeletedIcon,
  GitUntrackedIcon,
  CloseIcon,
} from "@/components/icons/GitIcons";

export function ChangesTab() {
  const files = useGitStore((s) => s.files);
  const commitMessage = useGitStore((s) => s.commitMessage);
  const setCommitMessage = useGitStore((s) => s.setCommitMessage);
  const unstage = useGitStore((s) => s.unstage);
  const stagePaths = useGitStore((s) => s.stagePaths);
  const commit = useGitStore((s) => s.commit);
  const loadStatus = useGitStore((s) => s.loadStatus);
  const output = useGitStore((s) => s.output);
  const clearOutput = useGitStore((s) => s.clearOutput);
  const activeDiff = useGitStore((s) => s.activeDiff);
  const loadFileDiff = useGitStore((s) => s.loadFileDiff);
  const clearDiff = useGitStore((s) => s.clearDiff);
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const prevFilePathsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    const currentPaths = new Set(files.map((f) => f.path));
    setSelectedPaths((prev) => {
      const next = new Set<string>();
      for (const path of currentPaths) {
        if (!prevFilePathsRef.current.has(path) || prev.has(path)) {
          next.add(path);
        }
      }
      prevFilePathsRef.current = currentPaths;
      return next;
    });
  }, [files]);

  const selectedCount = files.filter((file) => selectedPaths.has(file.path)).length;
  const allSelected = files.length > 0 && selectedCount === files.length;

  const statusIcon = (s: string) => {
    switch (s) {
      case "staged_new":
      case "new":
        return <span style={{ color: "var(--success)" }}><GitAddedIcon className="w-3.5 h-3.5" /></span>;
      case "staged_modified":
      case "modified":
        return <span style={{ color: "var(--warning)" }}><GitModifiedIcon className="w-3.5 h-3.5" /></span>;
      case "staged_deleted":
      case "deleted":
        return <span style={{ color: "var(--danger)" }}><GitDeletedIcon className="w-3.5 h-3.5" /></span>;
      default:
        return <GitUntrackedIcon className="w-3.5 h-3.5 text-neutral-400" />;
    }
  };

  const statusLabel = (s: string) => {
    switch (s) {
      case "staged_new":
        return "Staged new";
      case "staged_modified":
        return "Staged edit";
      case "staged_deleted":
        return "Staged delete";
      case "new":
        return "New";
      case "modified":
        return "Modified";
      case "deleted":
        return "Deleted";
      default:
        return s.replaceAll("_", " ");
    }
  };

  const handleFileClick = (path: string, isStaged: boolean) => {
    loadFileDiff(path, isStaged);
  };

  const handleCommitSelected = async () => {
    if (!commitMessage.trim() || selectedCount === 0) return;

    const selected = new Set(selectedPaths);
    const stagedExcluded = files.filter((f) => f.status.startsWith("staged_") && !selected.has(f.path));
    const unstagedSelected = files.filter((f) => !f.status.startsWith("staged_") && selected.has(f.path));

    for (const file of stagedExcluded) {
      await unstage(file.path);
    }
    if (unstagedSelected.length > 0) {
      await stagePaths(unstagedSelected.map((f) => f.path));
    }
    await commit();
  };

  // Show diff viewer if active
  if (activeDiff) {
    return <DiffViewer diff={activeDiff} onClose={clearDiff} />;
  }

  return (
    <div className="flex flex-col h-full text-xs">
      {/* Commit area */}
      <div className="p-2 border-b border-neutral-800">
        <textarea
          value={commitMessage}
          onChange={(e) => setCommitMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              void handleCommitSelected();
            }
          }}
          placeholder="Commit message..."
          rows={2}
          className="w-full px-2 py-1.5 bg-neutral-800 border border-neutral-700 rounded text-neutral-200 placeholder-neutral-500 outline-none focus:[border-color:var(--accent)] resize-none"
        />
        <div className="mt-1.5 flex items-center gap-2">
          {files.length > 0 && (
            <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-neutral-400">
              <input
                type="checkbox"
                checked={allSelected}
                ref={(el) => {
                  if (el) el.indeterminate = selectedCount > 0 && selectedCount < files.length;
                }}
                onChange={(e) => {
                  setSelectedPaths(e.target.checked ? new Set(files.map((f) => f.path)) : new Set());
                }}
                style={{ accentColor: "var(--accent)", width: 13, height: 13 }}
              />
              Include all
            </label>
          )}
          <button
            onClick={() => void handleCommitSelected()}
            disabled={!commitMessage.trim() || selectedCount === 0}
            className="ml-auto min-w-[128px] rounded px-2 py-1 text-white disabled:bg-neutral-800 disabled:text-neutral-500"
            style={{ background: "var(--accent)" }}
          >
            {allSelected ? `Commit All (${files.length})` : `Commit Selected (${selectedCount})`}
          </button>
        </div>
      </div>

      {output && (
        <div className="px-2 py-1 bg-neutral-800 border-b border-neutral-700 text-neutral-400 flex justify-between">
          <span className="truncate">{output}</span>
          <button onClick={clearOutput} className="text-neutral-500 hover:text-neutral-300 ml-1"><CloseIcon className="w-3 h-3" /></button>
        </div>
      )}

      {/* File lists */}
      <div className="flex-1 overflow-y-auto">
        {files.length > 0 && (
          <div>
            <div className="flex items-center justify-between px-2 py-1 text-neutral-500 font-medium bg-neutral-900/50">
              <span>Changes ({files.length})</span>
              <span>{selectedCount} included</span>
            </div>
            {files.map((f) => {
              const included = selectedPaths.has(f.path);
              const isStaged = f.status.startsWith("staged_");
              return (
              <div
                key={f.path}
                className="flex items-center gap-2 px-2 py-1 hover:bg-neutral-800 group cursor-pointer"
                onClick={() => handleFileClick(f.path, isStaged)}
              >
                <input
                  type="checkbox"
                  checked={included}
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                  onChange={(e) => {
                    setSelectedPaths((prev) => {
                      const next = new Set(prev);
                      e.target.checked ? next.add(f.path) : next.delete(f.path);
                      return next;
                    });
                  }}
                  title={included ? "Included in commit" : "Excluded from commit"}
                  style={{ accentColor: "var(--accent)", width: 13, height: 13, flexShrink: 0 }}
                />
                <span className="w-4 flex-shrink-0 flex justify-center">
                  {statusIcon(f.status)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-neutral-300">{f.path}</div>
                  <div className="mt-0.5 flex flex-wrap gap-1.5">
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${included ? "text-[var(--accent)]" : "text-neutral-500"}`}
                      style={{ background: included ? "var(--accent-soft)" : "rgb(38 38 38)" }}
                    >
                      {included ? "Included" : "Excluded"}
                    </span>
                    <span className="rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] font-medium text-neutral-400">
                      {statusLabel(f.status)}
                    </span>
                  </div>
                </div>
              </div>
            );
            })}
          </div>
        )}

        {files.length === 0 && (
          <div className="p-4 text-center text-neutral-500">
            No changes
          </div>
        )}
      </div>
    </div>
  );
}
