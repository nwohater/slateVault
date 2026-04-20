"use client";

import { useState } from "react";
import { useEditorStore } from "@/stores/editorStore";

const STATUS_CYCLE = ["draft", "review", "final"] as const;

const statusColors: Record<string, string> = {
  draft: "bg-yellow-900/70 text-yellow-300 hover:bg-yellow-800/70",
  review: "bg-blue-900/70 text-blue-300 hover:bg-blue-800/70",
  final: "bg-green-900/70 text-green-300 hover:bg-green-800/70",
};

const authorLabels: Record<string, string> = {
  human: "Human",
  ai: "AI",
  both: "Both",
};

export function FrontMatterBar() {
  const fm = useEditorStore((s) => s.frontMatter);
  const isDirty = useEditorStore((s) => s.isDirty);
  const updateStatus = useEditorStore((s) => s.updateStatus);
  const [saving, setSaving] = useState(false);

  const handleStatusClick = async () => {
    if (!fm || saving) return;
    const idx = STATUS_CYCLE.indexOf(fm.status as typeof STATUS_CYCLE[number]);
    const next = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
    setSaving(true);
    try {
      await updateStatus(next);
    } finally {
      setSaving(false);
    }
  };

  if (!fm) return null;

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-neutral-900/80 border-b border-neutral-800/50 text-xs backdrop-blur-sm">
      <span className="font-semibold text-neutral-200 truncate">
        {fm.title}
      </span>
      {isDirty && (
        <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
      )}
      <div className="flex-1" />
      {fm.canonical && (
        <span className="text-yellow-400 text-[10px] font-medium" title="Canonical document">
          ★ canonical
        </span>
      )}
      {fm.protected && (
        <span className="text-red-400 text-[10px] font-medium" title="Protected from AI overwrites">
          🔒 protected
        </span>
      )}
      <button
        onClick={handleStatusClick}
        disabled={saving}
        title="Click to cycle status: draft → review → final"
        className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors cursor-pointer ${statusColors[fm.status] || "bg-neutral-800 text-neutral-400 hover:bg-neutral-700"}`}
      >
        {saving ? "saving…" : fm.status}
      </button>
      <span className="text-neutral-500">
        {authorLabels[fm.author] || fm.author}
      </span>
      {fm.tags?.length > 0 && (
        <div className="flex gap-1">
          {fm.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400 text-[10px]"
            >
              {tag}
            </span>
          ))}
          {fm.tags.length > 3 && (
            <span className="text-neutral-500">+{fm.tags.length - 3}</span>
          )}
        </div>
      )}
    </div>
  );
}
