"use client";

import { useVaultStore } from "@/stores/vaultStore";
import { useEditorStore } from "@/stores/editorStore";

export function StatusBar() {
  const vaultName = useVaultStore((s) => s.vaultName);
  const stats = useVaultStore((s) => s.stats);
  const activeProject = useEditorStore((s) => s.activeProject);
  const activePath = useEditorStore((s) => s.activePath);
  const isDirty = useEditorStore((s) => s.isDirty);
  const frontMatter = useEditorStore((s) => s.frontMatter);

  return (
    <div className="flex items-center gap-3 px-3 py-0.5 bg-neutral-900 border-t border-neutral-800 text-[10px] text-neutral-500 flex-shrink-0">
      {vaultName && (
        <span className="text-neutral-400">{vaultName}</span>
      )}

      {stats && (
        <>
          <span>{stats.project_count} projects</span>
          <span>{stats.doc_count} docs</span>
          <span className="flex items-center gap-1">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                stats.mcp_enabled ? "bg-green-500" : "bg-red-500"
              }`}
            />
            MCP :{stats.mcp_port}
          </span>
          {stats.remote_url && (
            <span>{stats.remote_branch}</span>
          )}
        </>
      )}

      <div className="flex-1" />

      {activeProject && activePath && (
        <span className="text-neutral-400">
          {activeProject}/{activePath}
          {isDirty && " *"}
        </span>
      )}

      {frontMatter && (
        <span className={
          frontMatter.author === "ai"
            ? "text-purple-400"
            : frontMatter.author === "both"
              ? "text-blue-400"
              : "text-green-400"
        }>
          {frontMatter.author}
        </span>
      )}
    </div>
  );
}
