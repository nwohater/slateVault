"use client";

import dynamic from "next/dynamic";
import { useEditorStore } from "@/stores/editorStore";
import { FrontMatterBar } from "./FrontMatterBar";
import { EmptyState } from "../shared/EmptyState";

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

export function EditorPane() {
  const activePath = useEditorStore((s) => s.activePath);
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
      <div className="flex-1 min-h-0">
        <CodeMirrorEditor />
      </div>
    </div>
  );
}
