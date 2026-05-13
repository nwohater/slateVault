"use client";

import { useState } from "react";
import { useEditorStore } from "@/stores/editorStore";
import { useUIStore } from "@/stores/uiStore";

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

function SaveIcon() {
  return (
    <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 8.75H6.75v10.5h10.5V8.75z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.25 4.75H6.75v4h8.5V4.75z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 15.25a2 2 0 1 0 4 0 2 2 0 0 0-4 0z" />
    </svg>
  );
}

type EditorMode = "editor" | "split" | "preview";

function ModeToggle() {
  const showEditor = useUIStore((s) => s.showEditor);
  const showPreview = useUIStore((s) => s.showPreview);
  const toggleEditor = useUIStore((s) => s.toggleEditor);
  const togglePreview = useUIStore((s) => s.togglePreview);

  const currentMode: EditorMode =
    showEditor && !showPreview ? "editor"
    : showEditor && showPreview ? "split"
    : "preview";

  const setMode = (mode: EditorMode) => {
    if (mode === "editor") {
      if (!showEditor) toggleEditor();
      if (showPreview) togglePreview();
    } else if (mode === "split") {
      if (!showEditor) toggleEditor();
      if (!showPreview) togglePreview();
    } else {
      if (showEditor) toggleEditor();
      if (!showPreview) togglePreview();
    }
  };

  const modes: { key: EditorMode; label: string }[] = [
    { key: "editor", label: "Edit" },
    { key: "split",  label: "Split" },
    { key: "preview", label: "Preview" },
  ];

  return (
    <div style={{
      display: "inline-flex",
      alignItems: "center",
      background: "var(--bg-app)",
      border: "1px solid var(--border)",
      borderRadius: 6,
      padding: 2,
    }}>
      {modes.map(({ key, label }) => {
        const isActive = currentMode === key;
        return (
          <button
            key={key}
            onClick={() => setMode(key)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              padding: "3px 8px",
              height: 22,
              border: "none",
              borderRadius: 4,
              fontSize: 11.5,
              fontWeight: 500,
              cursor: "pointer",
              background: isActive ? "var(--bg-elevated)" : "transparent",
              color: isActive ? "var(--text)" : "var(--text-muted)",
              boxShadow: isActive ? "0 1px 2px rgba(0,0,0,0.08)" : undefined,
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

export function FrontMatterBar() {
  const fm = useEditorStore((s) => s.frontMatter);
  const isDirty = useEditorStore((s) => s.isDirty);
  const saveDocument = useEditorStore((s) => s.saveDocument);
  const updateStatus = useEditorStore((s) => s.updateStatus);
  const activeProject = useEditorStore((s) => s.activeProject);
  const activePath = useEditorStore((s) => s.activePath);
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

  // Breadcrumb: project > folders > filename
  const pathSegments = activePath ? activePath.split("/") : [];
  const filename = pathSegments[pathSegments.length - 1] ?? "";
  const folders = pathSegments.slice(0, -1);
  const breadcrumbParts: string[] = [];
  if (activeProject) breadcrumbParts.push(activeProject);
  if (folders.length > 0) breadcrumbParts.push(folders.join("/"));
  breadcrumbParts.push(filename);

  return (
    <div
      style={{
        background: "var(--bg-panel)",
        borderBottom: "1px solid var(--border)",
        padding: "8px 14px 0",
        flexShrink: 0,
      }}
    >
      {/* Top row: breadcrumb */}
      <div
        style={{
          fontFamily: "var(--font-mono, monospace)",
          fontSize: 10.5,
          color: "var(--text-faint)",
          marginBottom: 6,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {breadcrumbParts.map((part, i) => (
          <span key={i}>
            {i > 0 && <span style={{ margin: "0 4px", opacity: 0.5 }}>&gt;</span>}
            {part}
          </span>
        ))}
      </div>

      {/* Bottom row: title + chips on left, controls on right */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, paddingBottom: 8 }}>
        {/* Left: title + chips */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, minWidth: 0, overflow: "hidden" }}>
          <h1
            style={{
              margin: 0,
              fontSize: 16,
              fontWeight: 700,
              color: "var(--text)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              maxWidth: 320,
            }}
          >
            {fm.title}
          </h1>

          {/* Status chip */}
          <button
            onClick={handleStatusClick}
            disabled={savingStatus}
            title="Click to cycle status: draft → review → final"
            style={{
              ...statusSty,
              padding: "1px 6px",
              borderRadius: 4,
              fontSize: 10,
              fontWeight: 600,
              border: "none",
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            {savingStatus ? "saving…" : fm.status}
          </button>

          {/* Protected chip */}
          {fm.protected && (
            <span
              style={{
                padding: "1px 6px",
                borderRadius: 4,
                fontSize: 10,
                fontWeight: 600,
                background: "var(--danger-soft)",
                color: "var(--danger)",
                flexShrink: 0,
              }}
              title="Protected from AI overwrites"
            >
              🔒 protected
            </span>
          )}

          {/* Canonical chip */}
          {fm.canonical && (
            <span
              style={{
                padding: "1px 6px",
                borderRadius: 4,
                fontSize: 10,
                fontWeight: 600,
                background: "var(--warning-soft)",
                color: "var(--warning)",
                flexShrink: 0,
              }}
              title="Canonical document"
            >
              ★ canonical
            </span>
          )}

          {/* Author chip */}
          <span
            style={{
              padding: "1px 6px",
              borderRadius: 4,
              fontSize: 10,
              fontWeight: 500,
              background: "var(--bg-tint)",
              color: "var(--text-muted)",
              flexShrink: 0,
            }}
          >
            {authorLabels[fm.author] || fm.author}
          </span>

          {/* Tags */}
          {fm.tags?.length > 0 && (
            <>
              {fm.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  style={{
                    padding: "1px 6px",
                    borderRadius: 4,
                    fontSize: 10,
                    background: "var(--bg-tint)",
                    color: "var(--text-muted)",
                    flexShrink: 0,
                  }}
                >
                  {tag}
                </span>
              ))}
              {fm.tags.length > 3 && (
                <span style={{ fontSize: 10, color: "var(--text-faint)" }}>
                  +{fm.tags.length - 3}
                </span>
              )}
            </>
          )}
        </div>

        {/* Right: mode toggle + save + more */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          <ModeToggle />

          <button
            onClick={handleSave}
            disabled={!isDirty || savingDocument}
            className={isDirty ? "btn primary sm" : "btn sm"}
            style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
          >
            <SaveIcon />
            {savingDocument ? "Saving..." : isDirty ? "Save" : "Saved"}
          </button>
        </div>
      </div>
    </div>
  );
}
