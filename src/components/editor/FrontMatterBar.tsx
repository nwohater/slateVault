"use client";

import { useState } from "react";
import { useEditorStore } from "@/stores/editorStore";

const STATUS_CYCLE = ["draft", "review", "final"] as const;

const statusStyle: Record<string, { background: string; color: string }> = {
  draft:  { background: "var(--warning-soft)", color: "var(--warning)" },
  review: { background: "var(--info-soft)",    color: "var(--info)"    },
  final:  { background: "var(--success-soft)", color: "var(--success)" },
};

const authorLabels: Record<string, string> = {
  human: "Human",
  ai: "AI",
  both: "Both",
};

export function FrontMatterBar() {
  const fm = useEditorStore((s) => s.frontMatter);
  const isDirty = useEditorStore((s) => s.isDirty);
  const saveDocument = useEditorStore((s) => s.saveDocument);
  const updateStatus = useEditorStore((s) => s.updateStatus);
  const [savingStatus, setSavingStatus] = useState(false);
  const [savingDocument, setSavingDocument] = useState(false);

  const handleStatusClick = async () => {
    if (!fm || savingStatus) return;
    const idx = STATUS_CYCLE.indexOf(fm.status as typeof STATUS_CYCLE[number]);
    const next = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
    setSavingStatus(true);
    try {
      await updateStatus(next);
    } finally {
      setSavingStatus(false);
    }
  };

  const handleSave = async () => {
    if (!isDirty || savingDocument) return;
    setSavingDocument(true);
    try {
      await saveDocument();
    } finally {
      setSavingDocument(false);
    }
  };

  if (!fm) return null;

  const statusSty = statusStyle[fm.status] ?? { background: "var(--bg-tint)", color: "var(--text-muted)" };

  return (
    <div
      className="flex items-center gap-2 px-4 py-2 text-xs"
      style={{ background: "var(--bg-panel)", borderBottom: "1px solid var(--border-subtle)" }}
    >
      <span className="font-semibold truncate" style={{ color: "var(--text)" }}>
        {fm.title}
      </span>
      {isDirty && (
        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: "var(--accent)" }} />
      )}
      <div className="flex-1" />
      {fm.canonical && (
        <span className="text-[10px] font-medium" style={{ color: "var(--warning)" }} title="Canonical document">
          ★ canonical
        </span>
      )}
      {fm.protected && (
        <span className="text-[10px] font-medium" style={{ color: "var(--danger)" }} title="Protected from AI overwrites">
          🔒 protected
        </span>
      )}
      <button
        onClick={handleStatusClick}
        disabled={savingStatus}
        title="Click to cycle status: draft → review → final"
        className="px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors cursor-pointer"
        style={statusSty}
      >
        {savingStatus ? "saving…" : fm.status}
      </button>
      <span style={{ color: "var(--text-faint)" }}>
        {authorLabels[fm.author] || fm.author}
      </span>
      {fm.tags?.length > 0 && (
        <div className="flex gap-1">
          {fm.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="px-1.5 py-0.5 rounded text-[10px]"
              style={{ background: "var(--bg-tint)", color: "var(--text-muted)" }}
            >
              {tag}
            </span>
          ))}
          {fm.tags.length > 3 && (
            <span style={{ color: "var(--text-faint)" }}>+{fm.tags.length - 3}</span>
          )}
        </div>
      )}
      <button
        onClick={handleSave}
        disabled={!isDirty || savingDocument}
        className="btn primary sm"
      >
        {savingDocument ? "Saving..." : isDirty ? "Save" : "Saved"}
      </button>
    </div>
  );
}
