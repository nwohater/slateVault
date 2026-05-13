"use client";

import { useMemo } from "react";
import { useEditorStore } from "@/stores/editorStore";
import { useUIStore } from "@/stores/uiStore";
import { CodeMirrorEditor } from "./CodeMirrorEditor";
import { FrontMatterBar } from "./FrontMatterBar";
import { EmptyState } from "../shared/EmptyState";

const SECRET_PATTERNS = [
  { pattern: /(?:api[_-]?key|apikey)\s*[:=]\s*['"]?[A-Za-z0-9_\-]{16,}/i, label: "API key" },
  { pattern: /(?:secret|token|password|passwd|pwd)\s*[:=]\s*['"]?[A-Za-z0-9_\-]{8,}/i, label: "Secret/token" },
  { pattern: /ghp_[A-Za-z0-9_]{36,}/, label: "GitHub PAT" },
  { pattern: /sk-[A-Za-z0-9]{32,}/, label: "OpenAI/Anthropic key" },
  { pattern: /AKIA[0-9A-Z]{16}/, label: "AWS access key" },
  { pattern: /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/, label: "Private key" },
];

function RawFileBar() {
  const activePath = useEditorStore((s) => s.activePath);
  const isDirty = useEditorStore((s) => s.isDirty);
  const saveDocument = useEditorStore((s) => s.saveDocument);
  const workspaceView = useUIStore((s) => s.workspaceView);
  const showSaveButton = workspaceView !== "wiki";

  return (
    <div
      className="flex items-center gap-2 px-3 py-1.5 text-xs"
      style={{ background: "var(--bg-panel)", borderBottom: "1px solid var(--border-subtle)" }}
    >
      <span className="font-semibold truncate" style={{ color: "var(--text)" }}>
        {activePath}
      </span>
      {isDirty && (
        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: "var(--accent)" }} />
      )}
      <div className="flex-1" />
      {showSaveButton && (
        <button
          onClick={saveDocument}
          disabled={!isDirty}
          className="btn primary sm"
        >
          {isDirty ? "Save (Ctrl+S)" : "Saved"}
        </button>
      )}
    </div>
  );
}

function SecretWarning({ content }: { content: string }) {
  const detected = useMemo(() => {
    const found: string[] = [];
    for (const { pattern, label } of SECRET_PATTERNS) {
      if (pattern.test(content)) found.push(label);
    }
    return found;
  }, [content]);

  if (detected.length === 0) return null;

  return (
    <div
      className="flex items-center gap-2 px-3 py-1.5 text-[10px]"
      style={{ background: "var(--danger-soft)", borderBottom: "1px solid var(--danger)", color: "var(--danger)" }}
    >
      <span className="font-medium">Warning:</span>
      <span>Possible {detected.join(", ")} detected. Avoid committing secrets to the vault.</span>
    </div>
  );
}

function SyncRiskWarning() {
  const syncRisk = useEditorStore((s) => s.activeDocSyncRisk);

  if (!syncRisk) return null;

  const isConflictRisk = syncRisk.risk === "conflict_risk";

  const riskBg    = isConflictRisk ? "var(--danger-soft)"  : "var(--warning-soft)";
  const riskColor = isConflictRisk ? "var(--danger)"       : "var(--warning)";

  return (
    <div
      className="px-3 py-2 text-[11px]"
      style={{ background: riskBg, borderBottom: `1px solid ${riskColor}`, color: riskColor }}
    >
      <div className="font-medium">
        {isConflictRisk ? "Conflict risk" : "Remote changed this document"}
      </div>
      <div className="mt-0.5" style={{ color: "var(--text-muted)" }}>
        {isConflictRisk
          ? "This doc changed locally and also has newer remote changes. Pull and review before saving or pushing."
          : "The shared vault has a newer version of this doc. Pull before editing further to avoid starting from stale content."}
      </div>
    </div>
  );
}

export function EditorPane() {
  const activePath = useEditorStore((s) => s.activePath);
  const content = useEditorStore((s) => s.content);
  const rawFilePath = useEditorStore((s) => s.rawFilePath);
  const workspaceView = useUIStore((s) => s.workspaceView);
  const showRawFileBar = Boolean(rawFilePath) && workspaceView !== "wiki";

  if (!activePath) {
    return (
      <EmptyState
        title="No document open"
        description="Select a document from the sidebar"
      />
    );
  }

  return (
    <div className="flex flex-col h-full">
      {showRawFileBar ? <RawFileBar /> : rawFilePath ? null : <FrontMatterBar />}
      <SecretWarning content={content} />
      {!rawFilePath && <SyncRiskWarning />}
      <div className="flex-1 min-h-0">
        <CodeMirrorEditor />
      </div>
    </div>
  );
}
