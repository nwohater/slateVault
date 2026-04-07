"use client";

import { useEffect } from "react";
import { useGitStore } from "@/stores/gitStore";
import { DiffViewer } from "./DiffViewer";
import {
  GitAddedIcon,
  GitModifiedIcon,
  GitDeletedIcon,
  GitUntrackedIcon,
  StageIcon,
  UnstageIcon,
  CloseIcon,
} from "@/components/icons/GitIcons";

export function ChangesTab() {
  const files = useGitStore((s) => s.files);
  const commitMessage = useGitStore((s) => s.commitMessage);
  const setCommitMessage = useGitStore((s) => s.setCommitMessage);
  const stage = useGitStore((s) => s.stage);
  const unstage = useGitStore((s) => s.unstage);
  const stageAll = useGitStore((s) => s.stageAll);
  const commit = useGitStore((s) => s.commit);
  const loadStatus = useGitStore((s) => s.loadStatus);
  const output = useGitStore((s) => s.output);
  const clearOutput = useGitStore((s) => s.clearOutput);
  const activeDiff = useGitStore((s) => s.activeDiff);
  const loadFileDiff = useGitStore((s) => s.loadFileDiff);
  const clearDiff = useGitStore((s) => s.clearDiff);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const staged = files.filter((f) => f.status.startsWith("staged_"));
  const unstaged = files.filter((f) => !f.status.startsWith("staged_"));

  const statusIcon = (s: string) => {
    switch (s) {
      case "staged_new":
      case "new":
        return <GitAddedIcon className="w-3.5 h-3.5 text-green-400" />;
      case "staged_modified":
      case "modified":
        return <GitModifiedIcon className="w-3.5 h-3.5 text-yellow-400" />;
      case "staged_deleted":
      case "deleted":
        return <GitDeletedIcon className="w-3.5 h-3.5 text-red-400" />;
      default:
        return <GitUntrackedIcon className="w-3.5 h-3.5 text-neutral-400" />;
    }
  };

  const handleFileClick = (path: string, isStaged: boolean) => {
    loadFileDiff(path, isStaged);
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
              commit();
            }
          }}
          placeholder="Commit message..."
          rows={2}
          className="w-full px-2 py-1.5 bg-neutral-800 border border-neutral-700 rounded text-neutral-200 placeholder-neutral-500 outline-none focus:border-blue-600 resize-none"
        />
        <div className="flex gap-1 mt-1.5">
          {unstaged.length > 0 && staged.length === 0 ? (
            /* Nothing staged — primary action is stage all + commit */
            <button
              onClick={async () => {
                await stageAll();
                if (commitMessage.trim()) {
                  await commit();
                }
              }}
              disabled={!commitMessage.trim()}
              className="flex-1 px-2 py-1 rounded bg-blue-700 hover:bg-blue-600 disabled:bg-neutral-800 disabled:text-neutral-500 text-white"
            >
              Commit All ({unstaged.length})
            </button>
          ) : (
            <button
              onClick={commit}
              disabled={!commitMessage.trim() || staged.length === 0}
              className="flex-1 px-2 py-1 rounded bg-blue-700 hover:bg-blue-600 disabled:bg-neutral-800 disabled:text-neutral-500 text-white"
            >
              Commit ({staged.length})
            </button>
          )}
          {unstaged.length > 0 && staged.length > 0 && (
            <button
              onClick={stageAll}
              className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300"
            >
              + All
            </button>
          )}
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
        {staged.length > 0 && (
          <div>
            <div className="px-2 py-1 text-neutral-500 font-medium bg-neutral-900/50">
              Staged Changes ({staged.length})
            </div>
            {staged.map((f) => (
              <div
                key={f.path}
                className="flex items-center gap-1 px-2 py-0.5 hover:bg-neutral-800 group cursor-pointer"
                onClick={() => handleFileClick(f.path, true)}
              >
                <span className="w-4 flex-shrink-0 flex justify-center">
                  {statusIcon(f.status)}
                </span>
                <span className="flex-1 truncate text-neutral-300">
                  {f.path}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    unstage(f.path);
                  }}
                  className="text-neutral-500 hover:text-neutral-200 opacity-0 group-hover:opacity-100"
                  title="Unstage"
                >
                  <UnstageIcon className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {unstaged.length > 0 && (
          <div>
            <div className="px-2 py-1 text-neutral-500 font-medium bg-neutral-900/50">
              Changes ({unstaged.length})
            </div>
            {unstaged.map((f) => (
              <div
                key={f.path}
                className="flex items-center gap-1 px-2 py-0.5 hover:bg-neutral-800 group cursor-pointer"
                onClick={() => handleFileClick(f.path, false)}
              >
                <span className="w-4 flex-shrink-0 flex justify-center">
                  {statusIcon(f.status)}
                </span>
                <span className="flex-1 truncate text-neutral-300">
                  {f.path}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    stage(f.path);
                  }}
                  className="text-neutral-500 hover:text-neutral-200 opacity-0 group-hover:opacity-100"
                  title="Stage"
                >
                  <StageIcon className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {staged.length === 0 && unstaged.length === 0 && (
          <div className="p-4 text-center text-neutral-500">
            No changes
          </div>
        )}
      </div>
    </div>
  );
}
