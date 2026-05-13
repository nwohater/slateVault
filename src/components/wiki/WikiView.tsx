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
    <div className="flex h-full min-w-0 flex-1" style={{ background: "var(--bg-app)" }}>
      <aside className="flex w-72 flex-shrink-0 flex-col" style={{ background: "var(--bg-panel)", borderRight: "1px solid var(--border)" }}>
        <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
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
              className="icon-btn"
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
              className="mt-3 rounded-lg p-3"
              style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)" }}
            >
              <label className="block text-[10px] font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                Title
              </label>
              <input
                value={newDocTitle}
                onChange={(e) => handleNewDocTitleChange(e.target.value)}
                autoFocus
                placeholder="Team AI Rules"
                className="mt-1 w-full rounded-lg px-3 py-2 text-sm outline-none"
                style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text)" }}
              />
              <label className="mt-3 block text-[10px] font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                Filename
              </label>
              <input
                value={newDocPath}
                onChange={(e) => setNewDocPath(e.target.value)}
                placeholder="team-ai-rules.md"
                className="mt-1 w-full rounded-lg px-3 py-2 text-sm outline-none"
                style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text)" }}
              />
              <div className="mt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowNewDoc(false);
                    setNewDocTitle("");
                    setNewDocPath("");
                  }}
                  className="btn sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newDocTitle.trim() || !normalizeMarkdownFilename(newDocPath) || creating}
                  className="btn primary sm disabled:opacity-40"
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
            className="mt-3 w-full rounded-lg px-3 py-2 text-sm outline-none"
            style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)", color: "var(--text)" }}
          />
        </div>

        {error && (
          <div className="mx-3 mt-3 rounded-lg px-3 py-2 text-xs" style={{ background: "var(--danger-soft)", border: "1px solid var(--danger)", color: "var(--danger)" }}>
            {error}
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {loading ? (
            <div className="px-3 py-4 text-xs" style={{ color: "var(--text-muted)" }}>Loading wiki...</div>
          ) : visibleDocs.length === 0 ? (
            <div className="px-3 py-4 text-xs" style={{ color: "var(--text-muted)" }}>No wiki docs found.</div>
          ) : (
            visibleDocs.map((doc) => (
              <button
                key={doc.path}
                onClick={() => openWikiFile(doc.path)}
                onContextMenu={(e) => openContextMenu(e, doc)}
                className="mb-1 w-full rounded-lg px-3 py-2 text-left transition-colors"
                style={{
                  background: activeWikiPath === doc.path ? "var(--accent-soft)" : undefined,
                  color: activeWikiPath === doc.path ? "var(--accent)" : "var(--text-muted)",
                }}
              >
                <div className="truncate text-sm font-medium">{doc.title}</div>
                <div className="mt-1 flex items-center justify-between gap-2 text-[10px]" style={{ color: "var(--text-faint)" }}>
                  <span className="truncate">{doc.path}</span>
                  <span className="flex-shrink-0">{formatModified(doc.modified)}</span>
                </div>
              </button>
            ))
          )}
        </div>

        <div className="px-4 py-3 text-[11px]" style={{ borderTop: "1px solid var(--border)", color: "var(--text-faint)" }}>
          MCP tools can read these docs as vault-wide guidance.
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-11 flex-shrink-0 items-center justify-between px-4" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="min-w-0 text-sm font-semibold" style={{ color: "var(--text)" }}>
            {activeWikiPath || "Wiki"}
          </div>
          <div className="flex flex-shrink-0 items-center gap-2">
            <button
              onClick={toggleEditor}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${showEditor ? "on" : ""}`}
              style={{
                background: showEditor ? "var(--accent-soft)" : "var(--bg-tint)",
                color: showEditor ? "var(--accent)" : "var(--text-muted)",
              }}
            >
              Editor
            </button>
            <button
              onClick={togglePreview}
              className="rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
              style={{
                background: showPreview ? "var(--accent-soft)" : "var(--bg-tint)",
                color: showPreview ? "var(--accent)" : "var(--text-muted)",
              }}
            >
              Preview
            </button>
            <button
              onClick={saveDocument}
              disabled={!isDirty || !activeWikiPath}
              className="btn primary sm disabled:opacity-40"
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
            className="fixed z-50 min-w-52 rounded-lg p-1 text-xs"
            style={{
              left: contextMenu.x,
              top: contextMenu.y,
              background: "var(--bg-elevated)",
              border: "1px solid var(--border)",
              boxShadow: "var(--shadow-lg)",
              color: "var(--text)",
            }}
          >
            {contextMenu.action === "menu" && (
              <>
                <div className="px-3 py-2 text-[10px] uppercase tracking-wider" style={{ borderBottom: "1px solid var(--border-subtle)", color: "var(--text-faint)" }}>
                  {contextMenu.title}
                </div>
                <button
                  onClick={() =>
                    setContextMenu({ ...contextMenu, action: "rename" })
                  }
                  className="mt-1 w-full rounded px-3 py-2 text-left"
                  style={{ color: "var(--text)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-tint)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                >
                  Rename file
                </button>
                <button
                  onClick={() =>
                    setContextMenu({ ...contextMenu, action: "delete" })
                  }
                  className="w-full rounded px-3 py-2 text-left"
                  style={{ color: "var(--danger)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--danger-soft)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                >
                  Delete file
                </button>
              </>
            )}
            {contextMenu.action === "rename" && (
              <form onSubmit={handleRename} className="p-2">
                <label className="block text-[10px] font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
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
                  className="mt-1 w-72 rounded-lg px-3 py-2 text-sm outline-none"
                  style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)", color: "var(--text)" }}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") setContextMenu(null);
                  }}
                />
                <div className="mt-3 flex justify-end gap-2">
                  <button type="button" onClick={() => setContextMenu(null)} className="btn sm">
                    Cancel
                  </button>
                  <button type="submit" className="btn primary sm">
                    Rename
                  </button>
                </div>
              </form>
            )}
            {contextMenu.action === "delete" && (
              <div className="w-72 p-3">
                <div className="font-medium" style={{ color: "var(--text)" }}>
                  Delete this wiki doc?
                </div>
                <div className="mt-1" style={{ color: "var(--text-muted)" }}>{contextMenu.path}</div>
                <div className="mt-3 flex justify-end gap-2">
                  <button onClick={() => setContextMenu(null)} className="btn sm">
                    Cancel
                  </button>
                  <button
                    onClick={() => void handleDelete()}
                    className="btn sm"
                    style={{ background: "var(--danger)", color: "white", border: "1px solid var(--danger)" }}
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
