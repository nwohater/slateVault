"use client";

import { useEffect, useState } from "react";
import { useVaultStore } from "@/stores/vaultStore";
import { useEditorStore } from "@/stores/editorStore";
import * as commands from "@/lib/commands";
import { parseFrontMatter } from "@/lib/frontmatter";
import { TreeNode } from "./TreeNode";

type ContextMenu = {
  type: "project" | "doc";
  project: string;
  path?: string;
  x: number;
  y: number;
  action: "menu" | "confirm-delete" | "rename";
  renameValue: string;
} | null;

export function FileTree() {
  const projects = useVaultStore((s) => s.projects);
  const documents = useVaultStore((s) => s.documents);
  const expandedProjects = useVaultStore((s) => s.expandedProjects);
  const toggleProject = useVaultStore((s) => s.toggleProject);
  const loadProjects = useVaultStore((s) => s.loadProjects);
  const loadDocuments = useVaultStore((s) => s.loadDocuments);
  const deleteDocument = useVaultStore((s) => s.deleteDocument);
  const deleteProject = useVaultStore((s) => s.deleteProject);
  const renameDocument = useVaultStore((s) => s.renameDocument);
  const renameProject = useVaultStore((s) => s.renameProject);

  const activeProject = useEditorStore((s) => s.activeProject);
  const activePath = useEditorStore((s) => s.activePath);
  const openDocument = useEditorStore((s) => s.openDocument);
  const closeDocument = useEditorStore((s) => s.closeDocument);

  const [newDocProject, setNewDocProject] = useState<string | null>(null);
  const [newDocName, setNewDocName] = useState("");
  const [contextMenu, setContextMenu] = useState<ContextMenu>(null);
  const [menuError, setMenuError] = useState<string | null>(null);

  useEffect(() => {
    loadProjects();
    const interval = setInterval(loadProjects, 5000);
    return () => clearInterval(interval);
  }, [loadProjects]);

  const handleCreateDoc = async (projectName: string) => {
    if (!newDocName.trim()) return;
    const filename = newDocName.trim().endsWith(".md")
      ? newDocName.trim()
      : `${newDocName.trim()}.md`;
    const title = filename.replace(/\.md$/, "").replace(/[-_]/g, " ");

    await commands.writeDocument(projectName, filename, title, `# ${title}\n`);
    setNewDocProject(null);
    setNewDocName("");
    await loadDocuments(projectName);
    await openDocument(projectName, filename);
  };

  const openContextMenu = (
    e: React.MouseEvent,
    type: "project" | "doc",
    project: string,
    path?: string,
    label?: string
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setMenuError(null);
    setContextMenu({
      type,
      project,
      path,
      x: e.clientX,
      y: e.clientY,
      action: "menu",
      renameValue: type === "project" ? project : (label ?? path ?? ""),
    });
  };

  const handleDelete = async () => {
    if (!contextMenu) return;
    try {
      if (contextMenu.type === "project") {
        await deleteProject(contextMenu.project);
        if (activeProject === contextMenu.project) closeDocument();
      } else if (contextMenu.path) {
        await deleteDocument(contextMenu.project, contextMenu.path);
        if (
          activeProject === contextMenu.project &&
          activePath === contextMenu.path
        ) {
          closeDocument();
        }
      }
      setContextMenu(null);
    } catch (e) {
      setMenuError(String(e));
    }
  };

  const handleRename = async () => {
    if (!contextMenu || !contextMenu.renameValue.trim()) return;
    const newName = contextMenu.renameValue.trim();
    try {
      if (contextMenu.type === "project") {
        await renameProject(contextMenu.project, newName);
        if (activeProject === contextMenu.project) closeDocument();
      } else if (contextMenu.path) {
        // Rename = update frontmatter title, keep filename
        const raw = await commands.readDocument(contextMenu.project, contextMenu.path);
        const { data, content: body } = parseFrontMatter(raw);
        await commands.writeDocument(
          contextMenu.project,
          contextMenu.path,
          newName,
          body,
          data?.tags ?? []
        );
        await loadDocuments(contextMenu.project);
        // If this doc is open in the editor, reload it
        if (
          activeProject === contextMenu.project &&
          activePath === contextMenu.path
        ) {
          await openDocument(contextMenu.project, contextMenu.path);
        }
      }
      setContextMenu(null);
    } catch (e) {
      setMenuError(String(e));
    }
  };

  if (projects.length === 0) {
    return (
      <div className="px-3 py-4 text-xs text-neutral-500 text-center">
        No projects yet. Click + to create one.
      </div>
    );
  }

  return (
    <>
      <div className="py-1">
        {projects.map((project) => {
          const isExpanded = expandedProjects.has(project.name);
          return (
            <div key={project.name}>
              <div className="flex items-center group">
                <div className="flex-1 min-w-0">
                  <TreeNode
                    label={project.name}
                    isFolder
                    isExpanded={isExpanded}
                    onClick={() => toggleProject(project.name)}
                    onContextMenu={(e) =>
                      openContextMenu(e, "project", project.name)
                    }
                    depth={0}
                  />
                </div>
                {isExpanded && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setNewDocProject(
                        newDocProject === project.name ? null : project.name
                      );
                      setNewDocName("");
                    }}
                    className="px-2 text-neutral-500 hover:text-neutral-200 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                    title="New document"
                  >
                    +
                  </button>
                )}
              </div>

              {isExpanded && newDocProject === project.name && (
                <div className="pl-8 pr-2 py-1">
                  <div className="flex gap-1">
                    <input
                      type="text"
                      value={newDocName}
                      onChange={(e) => setNewDocName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleCreateDoc(project.name);
                        if (e.key === "Escape") {
                          setNewDocProject(null);
                          setNewDocName("");
                        }
                      }}
                      placeholder="filename.md"
                      className="flex-1 min-w-0 px-1.5 py-0.5 text-xs bg-neutral-800 border border-neutral-700 rounded text-neutral-200 placeholder-neutral-500 outline-none focus:border-blue-600"
                      autoFocus
                    />
                    <button
                      onClick={() => handleCreateDoc(project.name)}
                      disabled={!newDocName.trim()}
                      className="px-1.5 py-0.5 text-xs rounded bg-blue-700 hover:bg-blue-600 disabled:bg-neutral-800 disabled:text-neutral-500 text-white"
                    >
                      Add
                    </button>
                  </div>
                </div>
              )}

              {isExpanded &&
                (documents[project.name] || []).map((doc) => (
                  <TreeNode
                    key={doc.path}
                    label={doc.title || doc.path}
                    isFolder={false}
                    isActive={
                      activeProject === project.name &&
                      activePath === doc.path
                    }
                    author={doc.author}
                    onClick={() => openDocument(project.name, doc.path)}
                    onContextMenu={(e) =>
                      openContextMenu(e, "doc", project.name, doc.path, doc.title || doc.path)
                    }
                    depth={1}
                  />
                ))}
            </div>
          );
        })}
      </div>

      {contextMenu && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setContextMenu(null)}
            onContextMenu={(e) => {
              e.preventDefault();
              setContextMenu(null);
            }}
          />
          <div
            className="fixed z-50 bg-neutral-800 border border-neutral-700 rounded-lg shadow-xl py-1 w-48 text-xs"
            style={{ top: contextMenu.y, left: contextMenu.x }}
          >
            {contextMenu.action === "menu" && (
              <>
                <button
                  onClick={() =>
                    setContextMenu({ ...contextMenu, action: "rename" })
                  }
                  className="w-full px-3 py-1.5 text-left text-neutral-200 hover:bg-neutral-700"
                >
                  Rename
                </button>
                <button
                  onClick={async () => {
                    await commands.showInFolder(
                      contextMenu.project,
                      contextMenu.type === "doc" ? contextMenu.path : undefined
                    );
                    setContextMenu(null);
                  }}
                  className="w-full px-3 py-1.5 text-left text-neutral-200 hover:bg-neutral-700"
                >
                  {navigator.platform?.toLowerCase().includes("mac") ? "Show in Finder" : "Show in Explorer"}
                </button>
                <div className="my-1 border-t border-neutral-700" />
                <button
                  onClick={() =>
                    setContextMenu({
                      ...contextMenu,
                      action: "confirm-delete",
                    })
                  }
                  className="w-full px-3 py-1.5 text-left text-red-400 hover:bg-neutral-700"
                >
                  Delete
                </button>
              </>
            )}

            {contextMenu.action === "confirm-delete" && (
              <div className="px-3 py-2">
                <p className="text-neutral-300 mb-1">
                  Delete{" "}
                  <span className="font-semibold">
                    {contextMenu.type === "project"
                      ? contextMenu.project
                      : contextMenu.path}
                  </span>
                  ?
                </p>
                <p className="text-neutral-500 mb-2 text-[10px]">
                  Recoverable via git history.
                </p>
                {menuError && (
                  <p className="text-red-400 mb-2 text-[10px]">{menuError}</p>
                )}
                <div className="flex gap-1">
                  <button
                    onClick={handleDelete}
                    className="flex-1 px-2 py-1 bg-red-700 hover:bg-red-600 text-white rounded"
                  >
                    Delete
                  </button>
                  <button
                    onClick={() => setContextMenu(null)}
                    className="px-2 py-1 bg-neutral-700 hover:bg-neutral-600 text-neutral-300 rounded"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {contextMenu.action === "rename" && (
              <div className="px-3 py-2">
                <input
                  autoFocus
                  type="text"
                  value={contextMenu.renameValue}
                  onChange={(e) =>
                    setContextMenu({
                      ...contextMenu,
                      renameValue: e.target.value,
                    })
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleRename();
                    if (e.key === "Escape") setContextMenu(null);
                  }}
                  className="w-full px-2 py-1 bg-neutral-700 border border-neutral-600 rounded text-neutral-200 outline-none focus:border-blue-500 mb-2"
                />
                {menuError && (
                  <p className="text-red-400 mb-2 text-[10px]">{menuError}</p>
                )}
                <div className="flex gap-1">
                  <button
                    onClick={handleRename}
                    disabled={!contextMenu.renameValue.trim()}
                    className="flex-1 px-2 py-1 bg-blue-700 hover:bg-blue-600 disabled:bg-neutral-700 disabled:text-neutral-500 text-white rounded"
                  >
                    Rename
                  </button>
                  <button
                    onClick={() => setContextMenu(null)}
                    className="px-2 py-1 bg-neutral-700 hover:bg-neutral-600 text-neutral-300 rounded"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}
