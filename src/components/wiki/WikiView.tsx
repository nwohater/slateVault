"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent, MouseEvent } from "react";
import type { WikiDocInfo } from "@/types";
import * as commands from "@/lib/commands";
import { useEditorStore } from "@/stores/editorStore";
import { useUIStore } from "@/stores/uiStore";
import { EditorPane } from "../editor/EditorPane";
import { MarkdownPreview } from "../preview/MarkdownPreview";
import { ResizeHandle } from "../shared/ResizeHandle";
import { EmptyState } from "../shared/EmptyState";

function formatModified(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function suggestPath(title: string): string {
  const slug = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${slug || "new-wiki-doc"}.md`;
}

function normalizeMarkdownFilename(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.endsWith(".md") ? trimmed : `${trimmed}.md`;
}

function displayFilename(value: string): string {
  return value.split("/").pop() || value;
}

type WikiContextMenu =
  | {
      path: string;
      title: string;
      x: number;
      y: number;
      action: "menu" | "rename" | "delete";
      renameValue: string;
    }
  | null;

export function WikiView() {
  const [docs, setDocs] = useState<WikiDocInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [showNewDoc, setShowNewDoc] = useState(false);
  const [newDocTitle, setNewDocTitle] = useState("");
  const [newDocPath, setNewDocPath] = useState("");
  const [creating, setCreating] = useState(false);
  const [contextMenu, setContextMenu] = useState<WikiContextMenu>(null);
  const activePath = useEditorStore((s) => s.activePath);
  const rawFilePath = useEditorStore((s) => s.rawFilePath);
  const openWikiFile = useEditorStore((s) => s.openWikiFile);
  const saveDocument = useEditorStore((s) => s.saveDocument);
  const closeDocument = useEditorStore((s) => s.closeDocument);
  const isDirty = useEditorStore((s) => s.isDirty);
  const showEditor = useUIStore((s) => s.showEditor);
  const showPreview = useUIStore((s) => s.showPreview);
  const previewRatio = useUIStore((s) => s.previewRatio);
  const toggleEditor = useUIStore((s) => s.toggleEditor);
  const togglePreview = useUIStore((s) => s.togglePreview);
  const setPreviewRatio = useUIStore((s) => s.setPreviewRatio);

  const activeWikiPath = rawFilePath?.startsWith("wiki/") ? activePath : null;
  const visibleDocs = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return docs;
    return docs.filter(
      (doc) => {
        const searchable = `${doc.title}\n${doc.path}\n${doc.search_text}`.toLowerCase();
        return searchable.includes(q);
      },
    );
  }, [docs, filter]);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await commands.listWikiDocs();
      setDocs(next);
      if (!activeWikiPath && next[0]) {
        await openWikiFile(next[0].path);
      }
    } catch (e) {
      setError(`Could not load wiki docs: ${e}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleNewDocTitleChange = (value: string) => {
    setNewDocTitle(value);
    if (!newDocPath.trim() || newDocPath === suggestPath(newDocTitle)) {
      setNewDocPath(suggestPath(value));
    }
  };

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const title = newDocTitle.trim();
    const path = normalizeMarkdownFilename(newDocPath);
    if (!title || !path || creating) return;

    setCreating(true);
    try {
      const createdPath = await commands.createWikiDoc(path, title);
      const next = await commands.listWikiDocs();
      setDocs(next);
      await openWikiFile(createdPath);
      setNewDocTitle("");
      setNewDocPath("");
      setShowNewDoc(false);
    } catch (e) {
      setError(`Could not create wiki doc: ${e}`);
    } finally {
      setCreating(false);
    }
  };

  const openContextMenu = (event: MouseEvent, doc: WikiDocInfo) => {
    event.preventDefault();
    event.stopPropagation();
    setError(null);
    setContextMenu({
      path: doc.path,
      title: doc.title,
      x: event.clientX,
      y: event.clientY,
      action: "menu",
      renameValue: displayFilename(doc.path),
    });
  };

  const handleRename = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!contextMenu || !contextMenu.renameValue.trim()) return;

    try {
      const oldPath = contextMenu.path;
      const renamedPath = await commands.renameWikiDoc(
        oldPath,
        normalizeMarkdownFilename(contextMenu.renameValue),
      );
      const next = await commands.listWikiDocs();
      setDocs(next);
      if (activeWikiPath === oldPath) {
        await openWikiFile(renamedPath);
      }
      setContextMenu(null);
    } catch (e) {
      setError(`Could not rename wiki doc: ${e}`);
    }
  };

  const handleDelete = async () => {
    if (!contextMenu) return;

    try {
      const deletedPath = contextMenu.path;
      await commands.deleteWikiDoc(deletedPath);
      const next = await commands.listWikiDocs();
      setDocs(next);
      if (activeWikiPath === deletedPath) {
        closeDocument();
        if (next[0]) {
          await openWikiFile(next[0].path);
        }
      }
      setContextMenu(null);
    } catch (e) {
      setError(`Could not delete wiki doc: ${e}`);
    }
  };

  const editorFlex = showEditor ? (showPreview ? previewRatio : 1) : 0;
  const previewFlex = showPreview ? (showEditor ? 1 - previewRatio : 1) : 0;

  return (
    <div className="flex h-full min-w-0 flex-1 bg-neutral-950">
      <aside className="flex w-72 flex-shrink-0 flex-col border-r border-neutral-800 bg-[linear-gradient(180deg,rgba(10,15,21,0.95),rgba(7,10,14,0.96))]">
        <div className="border-b border-neutral-800 px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
                Global Wiki
              </div>
              <div className="mt-1 text-xs text-neutral-400">
                Vault-wide standards and AI rules
              </div>
            </div>
            <button
              onClick={() => {
                setError(null);
                setShowNewDoc((show) => !show);
              }}
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-cyan-900/40 text-cyan-200 hover:bg-cyan-800/50"
              title="New wiki doc"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
              </svg>
            </button>
          </div>
          {showNewDoc && (
            <form
              onSubmit={handleCreate}
              className="mt-3 rounded-lg border border-neutral-800 bg-neutral-950/70 p-3"
            >
              <label className="block text-[10px] font-medium uppercase tracking-wider text-neutral-500">
                Title
              </label>
              <input
                value={newDocTitle}
                onChange={(e) => handleNewDocTitleChange(e.target.value)}
                autoFocus
                placeholder="Team AI Rules"
                className="mt-1 w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-neutral-200 outline-none placeholder:text-neutral-600 focus:border-cyan-800"
              />
              <label className="mt-3 block text-[10px] font-medium uppercase tracking-wider text-neutral-500">
                Filename
              </label>
              <input
                value={newDocPath}
                onChange={(e) => setNewDocPath(e.target.value)}
                placeholder="team-ai-rules.md"
                className="mt-1 w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-neutral-200 outline-none placeholder:text-neutral-600 focus:border-cyan-800"
              />
              <div className="mt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowNewDoc(false);
                    setNewDocTitle("");
                    setNewDocPath("");
                  }}
                  className="rounded-lg px-2.5 py-1.5 text-xs text-neutral-500 hover:bg-neutral-900 hover:text-neutral-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newDocTitle.trim() || !normalizeMarkdownFilename(newDocPath) || creating}
                  className="rounded-lg bg-cyan-800 px-2.5 py-1.5 text-xs font-medium text-cyan-50 hover:bg-cyan-700 disabled:bg-neutral-800 disabled:text-neutral-500"
                >
                  {creating ? "Creating..." : "Create"}
                </button>
              </div>
            </form>
          )}
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search wiki..."
            className="mt-3 w-full rounded-lg border border-neutral-800 bg-neutral-950/80 px-3 py-2 text-sm text-neutral-200 outline-none placeholder:text-neutral-600 focus:border-cyan-800"
          />
        </div>

        {error && (
          <div className="mx-3 mt-3 rounded-lg border border-red-900/60 bg-red-950/30 px-3 py-2 text-xs text-red-200">
            {error}
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {loading ? (
            <div className="px-3 py-4 text-xs text-neutral-500">Loading wiki...</div>
          ) : visibleDocs.length === 0 ? (
            <div className="px-3 py-4 text-xs text-neutral-500">No wiki docs found.</div>
          ) : (
            visibleDocs.map((doc) => (
              <button
                key={doc.path}
                onClick={() => openWikiFile(doc.path)}
                onContextMenu={(e) => openContextMenu(e, doc)}
                className={`mb-1 w-full rounded-lg px-3 py-2 text-left transition-colors ${
                  activeWikiPath === doc.path
                    ? "bg-neutral-800 text-neutral-100"
                    : "text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200"
                }`}
              >
                <div className="truncate text-sm font-medium">{doc.title}</div>
                <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-neutral-600">
                  <span className="truncate">{doc.path}</span>
                  <span className="flex-shrink-0">{formatModified(doc.modified)}</span>
                </div>
              </button>
            ))
          )}
        </div>

        <div className="border-t border-neutral-800 px-4 py-3 text-[11px] text-neutral-500">
          MCP tools can read these docs as vault-wide guidance.
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-11 flex-shrink-0 items-center justify-between border-b border-neutral-800 px-4">
          <div className="min-w-0 text-sm font-semibold text-neutral-200">
            {activeWikiPath || "Wiki"}
          </div>
          <div className="flex flex-shrink-0 items-center gap-2">
            <button
              onClick={toggleEditor}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                showEditor
                  ? "bg-neutral-800 text-neutral-200"
                  : "bg-neutral-900 text-neutral-500"
              }`}
            >
              Editor
            </button>
            <button
              onClick={togglePreview}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                showPreview
                  ? "bg-neutral-800 text-neutral-200"
                  : "bg-neutral-900 text-neutral-500"
              }`}
            >
              Preview
            </button>
            <button
              onClick={saveDocument}
              disabled={!isDirty || !activeWikiPath}
              className="rounded-lg bg-blue-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-600 disabled:bg-neutral-800 disabled:text-neutral-500"
            >
              {isDirty ? "Save" : "Saved"}
            </button>
          </div>
        </div>

        {!activeWikiPath ? (
          <EmptyState title="No wiki doc open" description="Select or create a wiki document" />
        ) : (
          <div className="flex min-h-0 flex-1">
            {showEditor && (
              <div style={{ flex: editorFlex }} className="min-w-0">
                <EditorPane />
              </div>
            )}
            {showEditor && showPreview && (
              <ResizeHandle
                direction="vertical"
                onResize={(delta) => {
                  const mainWidth = window.innerWidth - 56 - 288 - 4;
                  setPreviewRatio((r) => r + delta / mainWidth);
                }}
              />
            )}
            {showPreview && (
              <div style={{ flex: previewFlex }} className="min-w-0">
                <MarkdownPreview />
              </div>
            )}
          </div>
        )}
      </main>
      {contextMenu && (
        <>
          <button
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setContextMenu(null)}
            onContextMenu={(e) => {
              e.preventDefault();
              setContextMenu(null);
            }}
            aria-label="Close wiki menu"
          />
          <div
            className="fixed z-50 min-w-52 rounded-lg border border-neutral-800 bg-neutral-950 p-1 text-xs text-neutral-200 shadow-2xl"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            {contextMenu.action === "menu" && (
              <>
                <div className="border-b border-neutral-800 px-3 py-2 text-[10px] uppercase tracking-wider text-neutral-500">
                  {contextMenu.title}
                </div>
                <button
                  onClick={() =>
                    setContextMenu({ ...contextMenu, action: "rename" })
                  }
                  className="mt-1 w-full rounded px-3 py-2 text-left hover:bg-neutral-800"
                >
                  Rename file
                </button>
                <button
                  onClick={() =>
                    setContextMenu({ ...contextMenu, action: "delete" })
                  }
                  className="w-full rounded px-3 py-2 text-left text-red-300 hover:bg-red-950/40"
                >
                  Delete file
                </button>
              </>
            )}
            {contextMenu.action === "rename" && (
              <form onSubmit={handleRename} className="p-2">
                <label className="block text-[10px] font-medium uppercase tracking-wider text-neutral-500">
                  Filename
                </label>
                <input
                  value={contextMenu.renameValue}
                  onChange={(e) =>
                    setContextMenu({
                      ...contextMenu,
                      renameValue: e.target.value,
                    })
                  }
                  autoFocus
                  className="mt-1 w-72 rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-neutral-200 outline-none focus:border-cyan-800"
                  onKeyDown={(e) => {
                    if (e.key === "Escape") setContextMenu(null);
                  }}
                />
                <div className="mt-3 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setContextMenu(null)}
                    className="rounded px-2.5 py-1.5 text-neutral-500 hover:bg-neutral-900 hover:text-neutral-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded bg-cyan-800 px-2.5 py-1.5 font-medium text-cyan-50 hover:bg-cyan-700"
                  >
                    Rename
                  </button>
                </div>
              </form>
            )}
            {contextMenu.action === "delete" && (
              <div className="w-72 p-3">
                <div className="font-medium text-neutral-100">
                  Delete this wiki doc?
                </div>
                <div className="mt-1 text-neutral-500">{contextMenu.path}</div>
                <div className="mt-3 flex justify-end gap-2">
                  <button
                    onClick={() => setContextMenu(null)}
                    className="rounded px-2.5 py-1.5 text-neutral-500 hover:bg-neutral-900 hover:text-neutral-300"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => void handleDelete()}
                    className="rounded bg-red-900 px-2.5 py-1.5 font-medium text-red-100 hover:bg-red-800"
                  >
                    Delete
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
