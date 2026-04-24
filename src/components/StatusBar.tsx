"use client";

import { useEffect, useState } from "react";
import { useVaultStore } from "@/stores/vaultStore";
import { useEditorStore } from "@/stores/editorStore";
import { useGitStore } from "@/stores/gitStore";
import { useAppStore } from "@/stores/appStore";
import * as commands from "@/lib/commands";
import type { McpServerStatus } from "@/types";
import { BranchIcon } from "@/components/icons/GitIcons";

export function StatusBar() {
  const vaultName = useVaultStore((s) => s.vaultName);
  const stats = useVaultStore((s) => s.stats);
  const activeProject = useEditorStore((s) => s.activeProject);
  const activePath = useEditorStore((s) => s.activePath);
  const isDirty = useEditorStore((s) => s.isDirty);
  const frontMatter = useEditorStore((s) => s.frontMatter);
  const currentBranch = useGitStore((s) => s.currentBranch);
  const loadBranches = useGitStore((s) => s.loadBranches);
  const version = useAppStore((s) => s.version);
  const updateState = useAppStore((s) => s.updateState);
  const updateVersion = useAppStore((s) => s.updateVersion);
  const initializeApp = useAppStore((s) => s.initialize);
  const checkForUpdates = useAppStore((s) => s.checkForUpdates);
  const installUpdate = useAppStore((s) => s.installUpdate);
  const [mcpStatus, setMcpStatus] = useState<McpServerStatus | null>(null);

  useEffect(() => {
    const check = () => {
      commands.mcpServerStatus().then(setMcpStatus).catch(() => {});
    };
    check();
    initializeApp().catch(() => {});
    checkForUpdates().catch(() => {});
    loadBranches();
    const interval = setInterval(check, 5000);
    return () => clearInterval(interval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const mcpRunning = mcpStatus?.running ?? false;
  const mcpEnabled = stats?.mcp_enabled ?? false;
  const updateReady = updateState === "available";
  const updateBusy = updateState === "downloading" || updateState === "installing";
  const versionLabel = updateReady && updateVersion ? `Update ${updateVersion}` : version ? `v${version}` : null;

  return (
    <div className="flex flex-shrink-0 items-center gap-3 border-t border-neutral-800/50 bg-[linear-gradient(180deg,rgba(8,12,17,0.96),rgba(11,16,22,0.92))] px-3 py-1.5 text-[10px] text-neutral-500 backdrop-blur-sm">
      {vaultName && (
        <span className="rounded-full border border-neutral-800 bg-neutral-900/70 px-2 py-0.5 text-neutral-400">{vaultName}</span>
      )}

      {stats && (
        <>
          <span className="rounded-full border border-neutral-800 bg-neutral-900/60 px-2 py-0.5">{stats.project_count} projects</span>
          <span className="rounded-full border border-neutral-800 bg-neutral-900/60 px-2 py-0.5">{stats.doc_count} docs</span>
          <span className="flex items-center gap-1 rounded-full border border-neutral-800 bg-neutral-900/60 px-2 py-0.5" title={
            mcpRunning
              ? `MCP running on port ${stats.mcp_port}`
              : mcpEnabled
                ? "MCP enabled but not running"
                : "MCP disabled"
          }>
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                mcpRunning
                  ? "bg-green-500"
                  : mcpEnabled
                    ? "bg-yellow-500"
                    : "bg-red-500"
              }`}
            />
            MCP {stats.mcp_port}
          </span>
          <span className="flex items-center gap-1 rounded-full border border-neutral-800 bg-neutral-900/60 px-2 py-0.5 text-neutral-400">
            <BranchIcon className="w-3 h-3" />
            {currentBranch}
          </span>
        </>
      )}

      <div className="flex-1" />

      {activeProject && activePath && (
        <span className="truncate rounded-full border border-neutral-800 bg-neutral-900/60 px-2 py-0.5 text-neutral-400">
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

      {versionLabel && (
        <button
          type="button"
          onClick={() => {
            if (updateReady && !updateBusy) {
              void installUpdate();
            }
          }}
          disabled={!updateReady || updateBusy}
          className={`rounded-full border px-2 py-0.5 text-neutral-300 transition-colors ${
            updateReady
              ? "border-emerald-700/60 bg-emerald-950/40 text-emerald-200 hover:bg-emerald-900/50"
              : "border-neutral-800 bg-neutral-900/60 text-neutral-400"
          } ${!updateReady ? "cursor-default" : "cursor-pointer"}`}
          title={
            updateReady
              ? `Install update ${updateVersion}`
              : "slateVault app version"
          }
        >
          {versionLabel}
        </button>
      )}
    </div>
  );
}
