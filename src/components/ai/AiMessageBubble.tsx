"use client";

import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { AiChatMessage, AssetInfo } from "@/types";
import * as commands from "@/lib/commands";
import { copyToClipboard } from "@/lib/clipboard";
import { useEditorStore } from "@/stores/editorStore";

interface Props {
  message: AiChatMessage;
  project: string;
  assets?: AssetInfo[];
}

export function AiMessageBubble({ message, project, assets = [] }: Props) {
  const openDocument = useEditorStore((s) => s.openDocument);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [savePath, setSavePath] = useState("");
  const [saveTitle, setSaveTitle] = useState("");

  const isUser = message.role === "user";
  const wasSavedByTool = !!message.documents_written?.length;
  const referencedDocs = extractReferencedDocs(message.content, message.documents_written ?? []);
  const referencedAssets = extractReferencedAssets(message.content, assets);

  const handleOpenAsset = (path: string) => {
    void commands.openAsset(project, path);
  };

  const handleCopy = async () => {
    await copyToClipboard(message.content);
  };

  const handleStartSave = () => {
    // Try to detect a doc path referenced in the content (e.g. prd/product-requirements.md)
    const pathMatch = message.content.match(/(?:^|\s)([\w-]+\/[\w.-]+\.md)/m);
    const firstLine = message.content.split("\n")[0]?.replace(/^#+\s*/, "").trim() || "AI Response";

    if (pathMatch) {
      // Found a path reference — suggest updating that doc
      setSavePath(pathMatch[1]);
      setSaveTitle(firstLine.slice(0, 80));
    } else {
      const slug = firstLine.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40);
      setSaveTitle(firstLine.slice(0, 80));
      setSavePath(`notes/${slug}.md`);
    }
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
        <div className="max-w-[85%] px-3 py-2 rounded-lg text-xs whitespace-pre-wrap" style={{ background: "var(--accent-soft)", border: "1px solid var(--accent)", color: "var(--text)" }}>
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="px-3 py-2 rounded-lg bg-neutral-800/50 border border-neutral-800/50 text-xs">
        <article className="prose prose-invert prose-xs max-w-none prose-headings:text-neutral-200 prose-p:text-neutral-300 prose-code:bg-neutral-800 prose-code:px-1 prose-code:rounded prose-pre:bg-neutral-900 prose-strong:text-neutral-200 [&_*]:text-xs [&_h1]:text-sm [&_h2]:text-xs [&_h3]:text-xs [&_a]:text-[color:var(--info)] [&_code]:text-[color:var(--success)]">
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
        {wasSavedByTool ? (
          <span
            className="text-[10px]"
            style={{ color: "var(--success)" }}
            title={message.documents_written?.join(", ")}
          >
            Saved via tool
          </span>
        ) : (
          <button
            onClick={() => {
              if (!showSaveDialog && !saved) handleStartSave();
            }}
            className="text-[10px] text-neutral-600 hover:text-neutral-400 cursor-pointer"
          >
            {saved ? "Saved!" : showSaveDialog ? "Saving..." : "Save to vault"}
          </button>
        )}
      </div>
      {wasSavedByTool && (
        <div className="flex flex-wrap gap-1 px-1">
          {message.documents_written?.map((path) => (
            <button
              key={path}
              onClick={() => void openDocument(project, path)}
              className="rounded px-1.5 py-0.5 text-[10px]"
              style={{ background: "var(--success-soft)", border: "1px solid var(--success)", color: "var(--success)" }}
              title={`Open ${project}/${path}`}
            >
              {path}
            </button>
          ))}
        </div>
      )}
      {!wasSavedByTool && referencedDocs.length > 0 && (
        <div className="flex flex-wrap gap-1 px-1">
          {referencedDocs.map((doc) => (
            <button
              key={doc.path}
              onClick={() => void openDocument(project, doc.path)}
              className="rounded px-1.5 py-0.5 text-[10px]"
              style={{ background: "var(--accent-soft)", border: "1px solid var(--accent)", color: "var(--accent)" }}
              title={`Open ${project}/${doc.path}`}
            >
              {doc.label}
            </button>
          ))}
        </div>
      )}
      {referencedAssets.length > 0 && (
        <div className="flex flex-wrap gap-1 px-1">
          {referencedAssets.map((asset) => (
            <button
              key={asset.path}
              onClick={() => handleOpenAsset(asset.path)}
              className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] hover:opacity-80"
              style={assetBadgeStyle(asset.filename)}
              title={`Open ${asset.path}`}
            >
              <span>{assetIcon(asset.filename)}</span>
              <span>{asset.filename}</span>
            </button>
          ))}
        </div>
      )}
      {showSaveDialog && (
        <div className="mx-1 mt-1 p-2 rounded bg-neutral-800 border border-neutral-700 space-y-1.5">
          <input
            type="text"
            value={saveTitle}
            onChange={(e) => setSaveTitle(e.target.value)}
            placeholder="Document title"
            className="w-full px-2 py-1 bg-neutral-900 border border-neutral-700 rounded text-neutral-200 text-[10px] outline-none focus:border-neutral-500"
          />
          <input
            type="text"
            value={savePath}
            onChange={(e) => setSavePath(e.target.value)}
            placeholder="path/to/document.md"
            className="w-full px-2 py-1 bg-neutral-900 border border-neutral-700 rounded text-neutral-200 text-[10px] font-mono outline-none focus:border-neutral-500"
          />
          <div className="flex gap-1">
            <button
              onClick={handleSave}
              disabled={saving || !savePath.trim()}
              className="btn primary sm flex-1"
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

function assetIcon(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") return "📄";
  if (["png", "jpg", "jpeg", "gif", "webp", "svg", "avif"].includes(ext)) return "🖼️";
  if (["mp4", "mov", "avi", "mkv"].includes(ext)) return "🎬";
  if (["mp3", "wav", "ogg", "m4a"].includes(ext)) return "🎵";
  if (["zip", "tar", "gz", "7z"].includes(ext)) return "🗜️";
  return "📎";
}

function assetBadgeStyle(filename: string): React.CSSProperties {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf")
    return { background: "var(--danger-soft)", border: "1px solid var(--danger)", color: "var(--danger)" };
  if (["png", "jpg", "jpeg", "gif", "webp", "svg", "avif"].includes(ext))
    return { background: "var(--magic-soft)", border: "1px solid var(--magic)", color: "var(--magic)" };
  if (["mp4", "mov", "avi", "mkv"].includes(ext))
    return { background: "var(--info-soft)", border: "1px solid var(--info)", color: "var(--info)" };
  return {};
}

function extractReferencedAssets(content: string, assets: AssetInfo[]): AssetInfo[] {
  if (!assets.length) return [];
  const found: AssetInfo[] = [];
  const seen = new Set<string>();
  for (const asset of assets) {
    // Match by full path or just the filename anywhere in the content
    if (
      (content.includes(asset.path) || content.includes(asset.filename)) &&
      !seen.has(asset.path)
    ) {
      found.push(asset);
      seen.add(asset.path);
    }
  }
  return found;
}

function isInternalDoc(path: string): boolean {
  // Filter out internal template files that users shouldn't click into
  return path === "_about.md" || path.endsWith("/_about.md");
}

function extractReferencedDocs(content: string, excludedPaths: string[]) {
  const excluded = new Set(excludedPaths.map((path) => path.trim()));
  const docs = new Map<string, string>();

  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    // Match "Title (`path/to/file.md`)" or "Title (path/to/file.md)"
    const titledMatch = trimmed.match(/^-?\s*(.+?)\s+\(`?([\w./-]+\.md)`?\)\s*$/);
    if (titledMatch) {
      const [, title, path] = titledMatch;
      if (!excluded.has(path) && !isInternalDoc(path)) {
        docs.set(path, title.replace(/\*\*/g, "").trim());
      }
      continue;
    }

    const pathMatches = trimmed.match(/`([\w./-]+\.md)`|(?<![`\w])([\w][\w./-]*\.md)(?![`\w])/g);
    if (!pathMatches) {
      continue;
    }

    for (const raw of pathMatches) {
      const path = raw.replace(/`/g, "").trim();
      if (!excluded.has(path) && !docs.has(path) && !isInternalDoc(path)) {
        docs.set(path, path);
      }
    }
  }

  return Array.from(docs.entries()).map(([path, label]) => ({ path, label }));
}
