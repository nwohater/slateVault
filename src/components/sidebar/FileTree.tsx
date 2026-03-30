"use client";

import { useEffect, useState } from "react";
import { useVaultStore } from "@/stores/vaultStore";
import { useEditorStore } from "@/stores/editorStore";
import * as commands from "@/lib/commands";
import { TreeNode } from "./TreeNode";

export function FileTree() {
  const projects = useVaultStore((s) => s.projects);
  const documents = useVaultStore((s) => s.documents);
  const expandedProjects = useVaultStore((s) => s.expandedProjects);
  const toggleProject = useVaultStore((s) => s.toggleProject);
  const loadProjects = useVaultStore((s) => s.loadProjects);
  const loadDocuments = useVaultStore((s) => s.loadDocuments);
  const activeProject = useEditorStore((s) => s.activeProject);
  const activePath = useEditorStore((s) => s.activePath);
  const openDocument = useEditorStore((s) => s.openDocument);

  const [newDocProject, setNewDocProject] = useState<string | null>(null);
  const [newDocName, setNewDocName] = useState("");

  useEffect(() => {
    loadProjects();
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

  if (projects.length === 0) {
    return (
      <div className="px-3 py-4 text-xs text-neutral-500 text-center">
        No projects yet. Click + to create one.
      </div>
    );
  }

  return (
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
                  depth={1}
                />
              ))}
          </div>
        );
      })}
    </div>
  );
}
