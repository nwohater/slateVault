"use client";

import { useEffect } from "react";
import { useGitStore } from "@/stores/gitStore";

export function HistoryTab() {
  const commits = useGitStore((s) => s.commits);
  const loadLog = useGitStore((s) => s.loadLog);

  useEffect(() => {
    loadLog();
  }, [loadLog]);

  if (commits.length === 0) {
    return (
      <div className="p-4 text-center text-xs text-neutral-500">
        No commits yet
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto text-xs">
      {commits.map((c) => (
        <div
          key={c.oid}
          className="px-2 py-1.5 border-b border-neutral-800/50 hover:bg-neutral-800/30"
        >
          <div className="flex items-center gap-2">
            <code className="text-blue-400 font-mono">{c.oid}</code>
            <span className="text-neutral-500">{c.author}</span>
          </div>
          <div className="text-neutral-300 mt-0.5 truncate">{c.message}</div>
          <div className="text-neutral-600 mt-0.5">
            {formatDate(c.date)}
          </div>
        </div>
      ))}
    </div>
  );
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 30) return `${days}d ago`;
    return d.toLocaleDateString();
  } catch {
    return iso;
  }
}
