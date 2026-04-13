"use client";

import { useEffect, useMemo, useState } from "react";
import { useVaultStore } from "@/stores/vaultStore";
import { useUIStore } from "@/stores/uiStore";
import * as commands from "@/lib/commands";
import type { McpServerStatus, RemoteConfig, VaultSettings } from "@/types";

const AGENT_COMMANDS = [
  {
    name: "Claude Code",
    command: "claude mcp add -s user slatevault -- slatevault-mcp",
    note:
      "Best when you want local coding sessions to load trusted project context before implementation work starts.",
  },
  {
    name: "Codex / other MCP clients",
    command: "Register slatevault-mcp as a local MCP server in your agent client, then open this vault before starting work.",
    note:
      "Use when your coding agent should read canonical docs, recent changes, and session bundles from slateVault.",
  },
];

function StatusPill({
  tone,
  label,
}: {
  tone: "green" | "yellow" | "red";
  label: string;
}) {
  const toneClass =
    tone === "green"
      ? "bg-green-500"
      : tone === "yellow"
        ? "bg-yellow-500"
        : "bg-red-500";

  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-neutral-800 bg-neutral-950/70 px-3 py-1 text-[11px] text-neutral-300">
      <span className={`h-2 w-2 rounded-full ${toneClass}`} />
      {label}
    </span>
  );
}

export function AgentAccessView() {
  const vaultPath = useVaultStore((s) => s.vaultPath);
  const stats = useVaultStore((s) => s.stats);
  const loadStats = useVaultStore((s) => s.loadStats);
  const setWorkspaceView = useUIStore((s) => s.setWorkspaceView);
  const [vaultConfig, setVaultConfig] = useState<VaultSettings | null>(null);
  const [remoteConfig, setRemoteConfig] = useState<RemoteConfig | null>(null);
  const [mcpStatus, setMcpStatus] = useState<McpServerStatus | null>(null);
  const [toolsSupported, setToolsSupported] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const [config, remote, status] = await Promise.all([
        commands.getVaultConfig(),
        commands.gitRemoteConfig().catch(() => null),
        commands.mcpServerStatus(),
      ]);
      setVaultConfig(config);
      setRemoteConfig(remote);
      setMcpStatus(status);
      setError(null);
    } catch (err) {
      setError(`Could not load agent access details: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const runningState = useMemo(() => {
    if (mcpStatus?.running) {
      return {
        tone: "green" as const,
        label: `Running on port ${mcpStatus.port ?? vaultConfig?.mcp_port ?? "?"}`,
      };
    }
    if (vaultConfig?.mcp_enabled) {
      return {
        tone: "yellow" as const,
        label: "Enabled, waiting for an agent connection",
      };
    }
    return {
      tone: "red" as const,
      label: "Disabled",
    };
  }, [mcpStatus, vaultConfig]);

  const updateConfig = async (
    next: Partial<Pick<VaultSettings, "mcp_enabled" | "auto_stage_ai_writes" | "compress_context">>
  ) => {
    setSaving(true);
    try {
      await commands.setVaultConfig(next);
      if (next.mcp_enabled === false) {
        await commands.stopMcpServer().catch(() => {});
      }
      if (next.mcp_enabled === true && vaultPath && vaultConfig?.mcp_port) {
        await commands.startMcpServer(vaultPath, vaultConfig.mcp_port).catch(() => {});
      }
      await loadStats();
      await refresh();
      setMessage("Agent access settings saved.");
      setError(null);
      window.setTimeout(() => setMessage(null), 2200);
    } catch (err) {
      setError(`Could not update agent access settings: ${err}`);
    } finally {
      setSaving(false);
    }
  };

  const handleCopy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setMessage(`${label} copied.`);
      setError(null);
      window.setTimeout(() => setMessage(null), 2200);
    } catch (err) {
      setError(`Could not copy ${label.toLowerCase()}: ${err}`);
    }
  };

  const handleTestTools = async () => {
    try {
      const supported = await commands.aiTestTools();
      setToolsSupported(supported);
      setMessage(supported ? "AI endpoint supports tools." : "AI endpoint is text-only.");
      setError(null);
      window.setTimeout(() => setMessage(null), 2400);
    } catch (err) {
      setToolsSupported(false);
      setError(`Could not test AI tools: ${err}`);
    }
  };

  const handleStartServer = async () => {
    if (!vaultPath || !vaultConfig?.mcp_port) return;
    setSaving(true);
    try {
      await commands.startMcpServer(vaultPath, vaultConfig.mcp_port);
      await refresh();
      setMessage("MCP server started.");
      setError(null);
      window.setTimeout(() => setMessage(null), 2200);
    } catch (err) {
      setError(`Could not start MCP server: ${err}`);
    } finally {
      setSaving(false);
    }
  };

  const handleStopServer = async () => {
    setSaving(true);
    try {
      await commands.stopMcpServer();
      await refresh();
      setMessage("MCP server stopped.");
      setError(null);
      window.setTimeout(() => setMessage(null), 2200);
    } catch (err) {
      setError(`Could not stop MCP server: ${err}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading && !vaultConfig) {
    return (
      <div className="workspace-page flex h-full items-center justify-center text-sm text-neutral-500">
        Loading agent access...
      </div>
    );
  }

  return (
    <div className="workspace-page h-full overflow-y-auto px-6 py-6">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <section className="workspace-hero rounded-3xl p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl">
              <div className="workspace-kicker mb-3">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
                Agent-ready project memory
              </div>
              <h1 className="workspace-label text-3xl font-semibold tracking-tight text-neutral-100">
                Agent Access
              </h1>
              <p className="mt-2 text-sm leading-6 text-neutral-400">
                Connect coding agents to this vault so they can start from trusted
                docs, recent changes, and session briefs instead of pasted context.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <StatusPill tone={runningState.tone} label={runningState.label} />
                {!mcpStatus?.binary_found && (
                  <StatusPill tone="red" label="slatevault-mcp binary not found" />
                )}
                {remoteConfig?.remote_url ? (
                  <StatusPill tone="green" label={`Team sync on ${remoteConfig.remote_branch}`} />
                ) : (
                  <StatusPill tone="yellow" label="No remote configured yet" />
                )}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[360px]">
              <button
                onClick={() => setWorkspaceView("start-session")}
                className="workspace-action rounded-2xl px-4 py-3 text-left transition-colors"
              >
                <div className="text-xs font-medium text-neutral-200">
                  Start Session
                </div>
                <div className="mt-1 text-[11px] text-neutral-500">
                  Build the context bundle agents should use first.
                </div>
              </button>
              <button
                onClick={() => setWorkspaceView("search")}
                className="workspace-action rounded-2xl px-4 py-3 text-left transition-colors"
              >
                <div className="text-xs font-medium text-neutral-200">
                  Search vault
                </div>
                <div className="mt-1 text-[11px] text-neutral-500">
                  Review trusted docs before exposing them to agents.
                </div>
              </button>
              <button
                onClick={mcpStatus?.running ? handleStopServer : handleStartServer}
                disabled={saving || !vaultConfig?.mcp_enabled || !mcpStatus?.binary_found}
                className="workspace-action rounded-2xl px-4 py-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50"
              >
                <div className="text-xs font-medium text-neutral-200">
                  {mcpStatus?.running ? "Stop MCP server" : "Start MCP server"}
                </div>
                <div className="mt-1 text-[11px] text-neutral-500">
                  {mcpStatus?.running
                    ? "Stop the local server if you want to disconnect agents."
                    : "Launch the local MCP server for the currently open vault."}
                </div>
              </button>
              <button
                onClick={handleTestTools}
                className="workspace-action rounded-2xl px-4 py-3 text-left transition-colors"
              >
                <div className="text-xs font-medium text-neutral-200">
                  Test AI tools
                </div>
                <div className="mt-1 text-[11px] text-neutral-500">
                  Check whether your configured AI endpoint supports tool use.
                </div>
              </button>
            </div>
          </div>
        </section>

        {(message || error) && (
          <div
            className={`rounded-2xl border px-4 py-3 text-sm ${
              error
                ? "border-red-900/40 bg-red-950/20 text-red-300"
                : "border-cyan-900/40 bg-cyan-950/20 text-cyan-200"
            }`}
          >
            {error || message}
          </div>
        )}

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-6">
            <div className="workspace-section rounded-3xl p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-neutral-100">
                    Connection setup
                  </h2>
                  <p className="mt-1 text-xs text-neutral-500">
                    Give your coding agent a stable way to read from the active vault.
                  </p>
                </div>
              </div>

              <div className="mt-5 space-y-4">
                {AGENT_COMMANDS.map((agent) => (
                  <div
                    key={agent.name}
                    className="workspace-subsection rounded-2xl p-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="text-sm font-medium text-neutral-200">
                          {agent.name}
                        </h3>
                        <p className="mt-1 text-[11px] leading-5 text-neutral-500">
                          {agent.note}
                        </p>
                      </div>
                      <button
                        onClick={() => void handleCopy(agent.command, `${agent.name} setup`)}
                        className="rounded-lg border border-neutral-700 px-3 py-1.5 text-xs text-neutral-300 transition-colors hover:bg-neutral-800"
                      >
                        Copy
                      </button>
                    </div>
                    <code className="mt-3 block rounded-xl bg-neutral-950 px-3 py-3 text-[11px] text-cyan-300">
                      {agent.command}
                    </code>
                  </div>
                ))}
              </div>
            </div>

            <div className="workspace-section rounded-3xl p-5">
              <h2 className="text-lg font-semibold text-neutral-100">
                Access behavior
              </h2>
              <p className="mt-1 text-xs text-neutral-500">
                These settings shape how agent-driven work lands back into the vault.
              </p>

              <div className="mt-5 space-y-4">
                <label className="workspace-subsection flex items-start gap-3 rounded-2xl px-4 py-4">
                  <input
                    type="checkbox"
                    checked={vaultConfig?.mcp_enabled ?? false}
                    onChange={(e) => void updateConfig({ mcp_enabled: e.target.checked })}
                    className="mt-0.5 rounded"
                    disabled={saving}
                  />
                  <div>
                    <div className="text-sm font-medium text-neutral-200">
                      Enable MCP for this vault
                    </div>
                    <div className="mt-1 text-[11px] leading-5 text-neutral-500">
                      Allows local coding agents to connect through the built-in MCP server.
                    </div>
                  </div>
                </label>

                <label className="workspace-subsection flex items-start gap-3 rounded-2xl px-4 py-4">
                  <input
                    type="checkbox"
                    checked={vaultConfig?.auto_stage_ai_writes ?? false}
                    onChange={(e) =>
                      void updateConfig({ auto_stage_ai_writes: e.target.checked })
                    }
                    className="mt-0.5 rounded"
                    disabled={saving}
                  />
                  <div>
                    <div className="text-sm font-medium text-neutral-200">
                      Auto-stage AI writes
                    </div>
                    <div className="mt-1 text-[11px] leading-5 text-neutral-500">
                      Keeps agent-authored changes ready for commit and review in team sync flows.
                    </div>
                  </div>
                </label>

                <label className="workspace-subsection flex items-start gap-3 rounded-2xl px-4 py-4">
                  <input
                    type="checkbox"
                    checked={vaultConfig?.compress_context ?? false}
                    onChange={(e) => void updateConfig({ compress_context: e.target.checked })}
                    className="mt-0.5 rounded"
                    disabled={saving}
                  />
                  <div>
                    <div className="text-sm font-medium text-neutral-200">
                      Compress context for AI handoff
                    </div>
                    <div className="mt-1 text-[11px] leading-5 text-neutral-500">
                      Uses shorthand-friendly context output when you want lighter bundles for agents.
                    </div>
                  </div>
                </label>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="workspace-section rounded-3xl p-5">
              <h2 className="text-lg font-semibold text-neutral-100">
                Readiness
              </h2>
              <div className="mt-4 space-y-3">
                <div className="workspace-stat rounded-2xl p-4">
                  <div className="workspace-stat-label">
                    Vault
                  </div>
                  <div className="mt-2 text-sm font-medium text-neutral-200">
                    {stats?.project_count ?? 0} projects, {stats?.doc_count ?? 0} docs
                  </div>
                </div>
                <div className="workspace-stat rounded-2xl p-4">
                  <div className="workspace-stat-label">
                    Server
                  </div>
                  <div className="mt-2 text-sm font-medium text-neutral-200">
                    {mcpStatus?.binary_found ? "Binary available" : "Binary missing"}
                  </div>
                  <div className="mt-1 text-[11px] text-neutral-500">
                    {vaultConfig?.mcp_port
                      ? `Configured for port ${vaultConfig.mcp_port}`
                      : "No port configured"}
                  </div>
                </div>
                <div className="workspace-stat rounded-2xl p-4">
                  <div className="workspace-stat-label">
                    Team sync
                  </div>
                  <div className="mt-2 text-sm font-medium text-neutral-200">
                    {remoteConfig?.remote_url ? "Connected" : "Not connected"}
                  </div>
                  <div className="mt-1 text-[11px] text-neutral-500">
                    {remoteConfig?.remote_url
                      ? remoteConfig.remote_url
                      : "Connect a remote when your team is ready to share the vault."}
                  </div>
                </div>
                <div className="workspace-stat rounded-2xl p-4">
                  <div className="workspace-stat-label">
                    AI endpoint
                  </div>
                  <div className="mt-2 text-sm font-medium text-neutral-200">
                    {toolsSupported === null
                      ? "Untested"
                      : toolsSupported
                        ? "Tools supported"
                        : "Text only"}
                  </div>
                  <div className="mt-1 text-[11px] text-neutral-500">
                    Tool support matters most when you want the built-in AI assistant to take richer actions.
                  </div>
                </div>
              </div>
            </div>

            <div className="workspace-section rounded-3xl p-5">
              <h2 className="text-lg font-semibold text-neutral-100">
                Recommended flow
              </h2>
              <ol className="mt-4 space-y-3 text-[12px] leading-5 text-neutral-400">
                <li>1. Mark the most trusted docs as canonical before letting agents rely on them.</li>
                <li>2. Use Start Session to build a context brief for the task at hand.</li>
                <li>3. Let the agent read from the vault, then review any proposed documentation updates through git.</li>
              </ol>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
