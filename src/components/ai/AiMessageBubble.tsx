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

  const isUser = message.role === "user";

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const timestamp = new Date().toISOString().slice(0, 16).replace(/[T:]/g, "-");
      const path = `notes/ai-response-${timestamp}.md`;
      const title = message.content.split("\n")[0]?.slice(0, 60) || "AI Response";
      await commands.writeDocument(project, path, title, message.content, ["ai-generated"], "ai-chat");
      setSaved(true);
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
          onClick={handleSave}
          disabled={saving || saved}
          className="text-[10px] text-neutral-600 hover:text-neutral-400 disabled:text-neutral-700"
        >
          {saved ? "Saved!" : saving ? "Saving..." : "Save to vault"}
        </button>
      </div>
    </div>
  );
}
