"use client";

import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useVaultStore } from "@/stores/vaultStore";
import { useEditorStore } from "@/stores/editorStore";
import { useGitStore } from "@/stores/gitStore";
import { useAppStore } from "@/stores/appStore";
import * as commands from "@/lib/commands";
import type { McpServerStatus } from "@/types";

function BranchIcon() {
  return (
    <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 6.75v9.5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 11.5h4.5a3.5 3.5 0 0 0 3.5-3.5V6.75" />
      <circle cx="8" cy="6.75" r="1.75" fill="currentColor" stroke="none" />
      <circle cx="8" cy="17.25" r="1.75" fill="currentColor" stroke="none" />
      <circle cx="16" cy="6.75" r="1.75" fill="currentColor" stroke="none" />
    </svg>
  );
}

function TerminalIcon() {
  return (
    <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m6.75 7.5 3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0 0 21 18V6a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 6v12a2.25 2.25 0 0 0 2.25 2.25Z" />
    </svg>
  );
}

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
  const updateProgress = useAppStore((s) => s.updateProgress);
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
  const updateInstalled = updateState === "installed";
  const versionLabel =
    updateBusy
      ? updateProgress !== null
        ? `Downloading ${updateProgress}%`
        : "Downloading update..."
      : updateInstalled
        ? "Restart to update"
        : updateReady && updateVersion
          ? `Update ${updateVersion}`
          : version
            ? `v${version}`
            : null;

  const mcpColor = mcpRunning ? "var(--success)" : mcpEnabled ? "var(--warning)" : "var(--text-faint)";
  const mcpTitle = mcpRunning
    ? `MCP running on port ${stats?.mcp_port}`
    : mcpEnabled
      ? "MCP enabled but not running"
      : "MCP disabled";

  const authorColor =
    frontMatter?.author === "ai"
      ? "var(--magic)"
      : frontMatter?.author === "both"
        ? "var(--info)"
        : "var(--success)";

  return (
    <>
    <div className="statusbar">
      {/* Branch */}
      {currentBranch && (
        <div className="sb-cell">
          <BranchIcon />
          <span>{currentBranch}</span>
        </div>
      )}

      {/* MCP status */}
      {stats && (
        <div className="sb-cell" title={mcpTitle}>
          <span className="sb-dot" style={{ background: mcpColor }} />
          <span>MCP {mcpRunning ? `· :${stats.mcp_port}` : "off"}</span>
        </div>
      )}

      {/* Project / doc counts */}
      {stats && (
        <div className="sb-cell">
          <span>{stats.project_count} projects</span>
          <span style={{ color: "var(--text-faint)" }}>·</span>
          <span>{stats.doc_count} docs</span>
        </div>
      )}

      <div style={{ flex: 1 }} />

      {/* Active file */}
      {activeProject && activePath && (
        <div className="sb-cell r" style={{ maxWidth: 280, overflow: "hidden" }}>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {activeProject}/{activePath}
            {isDirty && " *"}
          </span>
        </div>
      )}

      {/* Author indicator */}
      {frontMatter && (
        <div className="sb-cell" style={{ color: authorColor }}>
          {frontMatter.author}
        </div>
      )}

      {/* Vault name */}
      {vaultName && (
        <div className="sb-cell">
          {vaultName}
        </div>
      )}

      {/* Version / update */}
      {versionLabel && (
        <button
          type="button"
          className="sb-cell"
          onClick={() => {
            if (updateReady && !updateBusy) void installUpdate();
            if (updateInstalled) void getCurrentWindow().close();
          }}
          disabled={(!updateReady && !updateInstalled) || updateBusy}
          title={
            updateInstalled
              ? "Close slateVault to finish installing the update"
              : updateReady
                ? `Install update ${updateVersion}`
                : updateBusy
                  ? "Downloading update"
                  : "slateVault version"
          }
          style={{
            color: updateReady || updateBusy || updateInstalled ? "var(--success)" : undefined,
            cursor: updateReady || updateInstalled ? "pointer" : "default",
          }}
        >
          {versionLabel}
        </button>
      )}

      {/* Terminal shortcut */}
      <button
        className="sb-cell"
        title="Toggle terminal (Ctrl+T)"
        onClick={() => {
          window.dispatchEvent(new KeyboardEvent("keydown", { key: "t", ctrlKey: true }));
        }}
      >
        <TerminalIcon />
        <span>Terminal</span>
      </button>
    </div>
    {updateInstalled && (
      <div className="update-restart-prompt">
        <div>
          <strong>Update ready</strong>
          <span>Close slateVault to finish installing the update.</span>
        </div>
        <button className="btn primary sm" onClick={() => void getCurrentWindow().close()}>
          Close app
        </button>
      </div>
    )}
    </>
  );
}
