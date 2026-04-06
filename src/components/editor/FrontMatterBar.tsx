"use client";

import { useEditorStore } from "@/stores/editorStore";

const statusColors: Record<string, string> = {
  draft: "bg-yellow-900 text-yellow-300",
  review: "bg-blue-900 text-blue-300",
  final: "bg-green-900 text-green-300",
};

const authorLabels: Record<string, string> = {
  human: "Human",
  ai: "AI",
  both: "Both",
};

export function FrontMatterBar() {
  const fm = useEditorStore((s) => s.frontMatter);
  const isDirty = useEditorStore((s) => s.isDirty);

  if (!fm) return null;

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-neutral-900 border-b border-neutral-800 text-xs">
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
      <span
        className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${statusColors[fm.status] || "bg-neutral-800 text-neutral-400"}`}
      >
        {fm.status}
      </span>
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
