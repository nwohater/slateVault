"use client";

import { useEffect } from "react";
import { useGitStore } from "@/stores/gitStore";

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

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const staged = files.filter((f) => f.status.startsWith("staged_"));
  const unstaged = files.filter((f) => !f.status.startsWith("staged_"));

  const statusLabel = (s: string) => {
    switch (s) {
      case "staged_new": return "A";
      case "staged_modified": return "M";
      case "staged_deleted": return "D";
      case "new": return "?";
      case "modified": return "M";
      case "deleted": return "D";
      default: return "?";
    }
  };

  const statusColor = (s: string) => {
    if (s.includes("new") || s === "staged_new") return "text-green-400";
    if (s.includes("modified")) return "text-yellow-400";
    if (s.includes("deleted")) return "text-red-400";
    return "text-neutral-400";
  };

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
          <button
            onClick={commit}
            disabled={!commitMessage.trim() || staged.length === 0}
            className="flex-1 px-2 py-1 rounded bg-blue-700 hover:bg-blue-600 disabled:bg-neutral-800 disabled:text-neutral-500 text-white"
          >
            Commit ({staged.length})
          </button>
          {unstaged.length > 0 && (
            <button
              onClick={stageAll}
              className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300"
            >
              Stage All
            </button>
          )}
        </div>
      </div>

      {output && (
        <div className="px-2 py-1 bg-neutral-800 border-b border-neutral-700 text-neutral-400 flex justify-between">
          <span className="truncate">{output}</span>
          <button onClick={clearOutput} className="text-neutral-500 hover:text-neutral-300 ml-1">x</button>
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
                className="flex items-center px-2 py-0.5 hover:bg-neutral-800 group"
              >
                <span className={`w-4 ${statusColor(f.status)}`}>
                  {statusLabel(f.status)}
                </span>
                <span className="flex-1 truncate text-neutral-300 ml-1">
                  {f.path}
                </span>
                <button
                  onClick={() => unstage(f.path)}
                  className="text-neutral-500 hover:text-neutral-200 opacity-0 group-hover:opacity-100"
                  title="Unstage"
                >
                  -
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
                className="flex items-center px-2 py-0.5 hover:bg-neutral-800 group"
              >
                <span className={`w-4 ${statusColor(f.status)}`}>
                  {statusLabel(f.status)}
                </span>
                <span className="flex-1 truncate text-neutral-300 ml-1">
                  {f.path}
                </span>
                <button
                  onClick={() => stage(f.path)}
                  className="text-neutral-500 hover:text-neutral-200 opacity-0 group-hover:opacity-100"
                  title="Stage"
                >
                  +
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
