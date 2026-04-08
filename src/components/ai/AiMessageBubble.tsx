"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { AiChatMessage } from "@/types";
import * as commands from "@/lib/commands";

interface Props {
  message: AiChatMessage;
  project: string;
}

export function AiMessageBubble({ message, project }: Props) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [savePath, setSavePath] = useState("");
  const [saveTitle, setSaveTitle] = useState("");

  const isUser = message.role === "user";

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
  };

  const handleStartSave = () => {
    // Auto-suggest path and title from content
    const firstLine = message.content.split("\n")[0]?.replace(/^#+\s*/, "").trim() || "AI Response";
    const slug = firstLine.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40);
    setSaveTitle(firstLine.slice(0, 80));
    setSavePath(`notes/${slug}.md`);
    setShowSaveDialog(true);
  };

  const handleSave = async () => {
    if (!savePath.trim()) return;
    setSaving(true);
    try {
      const path = savePath.endsWith(".md") ? savePath : `${savePath}.md`;
      await commands.writeDocument(project, path, saveTitle || "AI Response", message.content, ["ai-generated"], "ai-chat");
      setSaved(true);
      setShowSaveDialog(false);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      console.error("Save failed:", e);
    } finally {
      setSaving(false);
    }
  };

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] px-3 py-2 rounded-lg bg-cyan-900/30 border border-cyan-800/30 text-neutral-200 text-xs whitespace-pre-wrap">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="px-3 py-2 rounded-lg bg-neutral-800/50 border border-neutral-800/50 text-xs">
        <article className="prose prose-invert prose-xs max-w-none prose-headings:text-neutral-200 prose-p:text-neutral-300 prose-a:text-blue-400 prose-code:text-emerald-400 prose-code:bg-neutral-800 prose-code:px-1 prose-code:rounded prose-pre:bg-neutral-900 prose-strong:text-neutral-200 [&_*]:text-xs [&_h1]:text-sm [&_h2]:text-xs [&_h3]:text-xs">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {message.content}
          </ReactMarkdown>
        </article>
      </div>
      <div className="flex gap-2 px-1">
        <button
          onClick={handleCopy}
          className="text-[10px] text-neutral-600 hover:text-neutral-400"
        >
          Copy
        </button>
        <button
          onClick={() => {
            if (!showSaveDialog && !saved) handleStartSave();
          }}
          className="text-[10px] text-neutral-600 hover:text-neutral-400 cursor-pointer"
        >
          {saved ? "Saved!" : showSaveDialog ? "Saving..." : "Save to vault"}
        </button>
      </div>
      {showSaveDialog && (
        <div className="mx-1 mt-1 p-2 rounded bg-neutral-800 border border-neutral-700 space-y-1.5">
          <input
            type="text"
            value={saveTitle}
            onChange={(e) => setSaveTitle(e.target.value)}
            placeholder="Document title"
            className="w-full px-2 py-1 bg-neutral-900 border border-neutral-700 rounded text-neutral-200 text-[10px] outline-none focus:border-blue-600"
          />
          <input
            type="text"
            value={savePath}
            onChange={(e) => setSavePath(e.target.value)}
            placeholder="path/to/document.md"
            className="w-full px-2 py-1 bg-neutral-900 border border-neutral-700 rounded text-neutral-200 text-[10px] font-mono outline-none focus:border-blue-600"
          />
          <div className="flex gap-1">
            <button
              onClick={handleSave}
              disabled={saving || !savePath.trim()}
              className="flex-1 px-2 py-1 text-[10px] rounded bg-cyan-700 hover:bg-cyan-600 disabled:bg-neutral-700 text-white"
            >
              {saving ? "Saving..." : "Save"}
            </button>
            <button
              onClick={() => setShowSaveDialog(false)}
              className="px-2 py-1 text-[10px] rounded bg-neutral-700 hover:bg-neutral-600 text-neutral-300"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
