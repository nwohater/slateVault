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

export function EditorPane() {
  const activePath = useEditorStore((s) => s.activePath);

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
      <FrontMatterBar />
      <div className="flex-1 min-h-0">
        <CodeMirrorEditor />
      </div>
    </div>
  );
}
