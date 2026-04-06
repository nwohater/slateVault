"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";
import { useEditorStore } from "@/stores/editorStore";
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

const CodeMirrorEditor = dynamic(
  () =>
    import("./CodeMirrorEditor").then((mod) => ({
      default: mod.CodeMirrorEditor,
    })),
  { ssr: false }
);

function RawFileBar() {
  const activePath = useEditorStore((s) => s.activePath);
  const isDirty = useEditorStore((s) => s.isDirty);
  const saveDocument = useEditorStore((s) => s.saveDocument);

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-neutral-900 border-b border-neutral-800 text-xs">
      <span className="font-semibold text-neutral-200 truncate">
        {activePath}
      </span>
      {isDirty && (
        <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
      )}
      <div className="flex-1" />
      <button
        onClick={saveDocument}
        disabled={!isDirty}
        className="px-2.5 py-1 rounded bg-blue-700 hover:bg-blue-600 disabled:bg-neutral-800 disabled:text-neutral-500 text-white text-[10px] font-medium transition-colors"
      >
        {isDirty ? "Save (Ctrl+S)" : "Saved"}
      </button>
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
    <div className="flex items-center gap-2 px-3 py-1.5 bg-red-900/30 border-b border-red-800 text-[10px] text-red-300">
      <span className="font-medium">Warning:</span>
      <span>Possible {detected.join(", ")} detected. Avoid committing secrets to the vault.</span>
    </div>
  );
}

export function EditorPane() {
  const activePath = useEditorStore((s) => s.activePath);
  const content = useEditorStore((s) => s.content);
  const rawFilePath = useEditorStore((s) => s.rawFilePath);

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
      {rawFilePath ? <RawFileBar /> : <FrontMatterBar />}
      <SecretWarning content={content} />
      <div className="flex-1 min-h-0">
        <CodeMirrorEditor />
      </div>
    </div>
  );
}
