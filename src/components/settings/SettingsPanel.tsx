"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import * as commands from "@/lib/commands";
import { copyToClipboard } from "@/lib/clipboard";
import {
  detectMcpPlatform,
  getMcpInstallNote,
  getMcpSetupCards,
  type McpPlatform,
} from "@/lib/mcpSetup";
import { useAppStore } from "@/stores/appStore";
import { useEditorStore } from "@/stores/editorStore";
import { useGitStore } from "@/stores/gitStore";
import { useUIStore } from "@/stores/uiStore";
import { useVaultStore } from "@/stores/vaultStore";
import type { CredentialsMasked, McpServerStatus, VaultSettings, WikiDocInfo } from "@/types";

type SettingsSection = "vault" | "mcp" | "ai" | "git" | "appearance" | "keyboard" | "updates" | "advanced";
type VaultConfigPatch = {
  name?: string;
  mcp_enabled?: boolean;
  mcp_port?: number;
  auto_stage_ai_writes?: boolean;
  compress_context?: boolean;
  ssh_key_path?: string;
  ai_enabled?: boolean;
  ai_endpoint_url?: string;
  ai_model?: string;
};

const SECTIONS: Array<{
  id: SettingsSection;
  group: "Workspace" | "Sync" | "Application";
  label: string;
  icon: string;
}> = [
  { id: "vault", group: "Workspace", label: "Vault", icon: "DB" },
  { id: "mcp", group: "Workspace", label: "Agent access (MCP)", icon: "MCP" },
  { id: "git", group: "Sync", label: "Git & credentials", icon: "Git" },
  { id: "updates", group: "Application", label: "Updates", icon: "Up" },
  { id: "advanced", group: "Application", label: "Advanced", icon: "Gear" },
];

function formatBundleType(bundleType: string | null): string {
  if (!bundleType) return "dev";
  if (bundleType === "appimage") return "AppImage";
  return bundleType.toUpperCase();
}

function formatLastChecked(value: string | null): string {
  if (!value) return "not checked yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "not checked yet";
  return date.toLocaleString();
}

function updateStatusLabel(state: string, version: string | null) {
  if (state === "available" && version) return `Update available: v${version}`;
  if (state === "up-to-date") return "You're on the latest version";
  if (state === "checking") return "Checking for updates...";
  if (state === "downloading") return "Downloading update...";
  if (state === "installing") return "Installing update...";
  if (state === "installed") return "Update downloaded. Restart slateVault to finish installing.";
  if (state === "error") return "Update check failed";
  return "Ready to check for updates";
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 MB";
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function SettingsPanel() {
  const vaultPath = useVaultStore((s) => s.vaultPath);
  const vaultName = useVaultStore((s) => s.vaultName);
  const stats = useVaultStore((s) => s.stats);
  const loadStats = useVaultStore((s) => s.loadStats);
  const closeVault = useVaultStore((s) => s.closeVault);
  const openVaultFile = useEditorStore((s) => s.openVaultFile);
  const setShowOnboarding = useUIStore((s) => s.setShowOnboarding);
  const setWorkspaceView = useUIStore((s) => s.setWorkspaceView);
  const version = useAppStore((s) => s.version);
  const bundleType = useAppStore((s) => s.bundleType);
  const channel = useAppStore((s) => s.channel);
  const updateState = useAppStore((s) => s.updateState);
  const updateVersion = useAppStore((s) => s.updateVersion);
  const updateError = useAppStore((s) => s.updateError);
  const updateBody = useAppStore((s) => s.updateBody);
  const updateDownloadedBytes = useAppStore((s) => s.updateDownloadedBytes);
  const updateTotalBytes = useAppStore((s) => s.updateTotalBytes);
  const updateProgress = useAppStore((s) => s.updateProgress);
  const lastCheckedAt = useAppStore((s) => s.lastCheckedAt);
  const initializeApp = useAppStore((s) => s.initialize);
  const checkForUpdates = useAppStore((s) => s.checkForUpdates);
  const installUpdate = useAppStore((s) => s.installUpdate);

  const remoteConfig = useGitStore((s) => s.remoteConfig);
  const loadRemoteConfig = useGitStore((s) => s.loadRemoteConfig);
  const setRemoteConfig = useGitStore((s) => s.setRemoteConfig);

  const [activeSection, setActiveSection] = useState<SettingsSection>("vault");
  const [settings, setSettings] = useState<VaultSettings | null>(null);
  const [mcpStatus, setMcpStatus] = useState<McpServerStatus | null>(null);
  const [wikiDocs, setWikiDocs] = useState<WikiDocInfo[]>([]);
  const [creds, setCreds] = useState<CredentialsMasked | null>(null);
  const [name, setName] = useState("");
  const [mcpEnabled, setMcpEnabled] = useState(true);
  const [mcpPort, setMcpPort] = useState(3742);
  const [autoStage, setAutoStage] = useState(true);
  const [compressContext, setCompressContext] = useState(false);
  const [sshKeyPath, setSshKeyPath] = useState("");
  const [aiEnabled, setAiEnabled] = useState(false);
  const [aiEndpointUrl, setAiEndpointUrl] = useState("http://localhost:11434/v1");
  const [aiModel, setAiModel] = useState("");
  const [githubPat, setGithubPat] = useState("");
  const [adoPat, setAdoPat] = useState("");
  const [adoOrg, setAdoOrg] = useState("");
  const [adoProject, setAdoProject] = useState("");
  const [showAzureDevOps, setShowAzureDevOps] = useState(false);
  const [remoteUrl, setRemoteUrl] = useState("");
  const [platform, setPlatform] = useState<McpPlatform>("unknown");
  const [selectedMcpSetup, setSelectedMcpSetup] = useState("Claude Code");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const [vaultConfig, credentials, status, docs] = await Promise.all([
        commands.getVaultConfig(),
        commands.gitLoadCredentials().catch(() => null),
        commands.mcpServerStatus().catch(() => null),
        commands.listWikiDocs().catch(() => []),
      ]);

      setSettings(vaultConfig);
      setName(vaultConfig.name);
      setMcpEnabled(vaultConfig.mcp_enabled);
      setMcpPort(vaultConfig.mcp_port);
      setAutoStage(vaultConfig.auto_stage_ai_writes);
      setCompressContext(vaultConfig.compress_context);
      setSshKeyPath(vaultConfig.ssh_key_path || "");
      setAiEnabled(vaultConfig.ai_enabled);
      setAiEndpointUrl(vaultConfig.ai_endpoint_url || "http://localhost:11434/v1");
      setAiModel(vaultConfig.ai_model || "");
      setCreds(credentials);
      setAdoOrg(credentials?.ado_organization || "");
      setAdoProject(credentials?.ado_project || "");
      setMcpStatus(status);
      setWikiDocs(docs);
      setError(null);
    } catch (err) {
      setError(`Could not load settings: ${err}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setPlatform(detectMcpPlatform());
    void initializeApp().catch(() => {});
    void loadSettings();
    void loadRemoteConfig();
  }, [initializeApp, loadSettings, loadRemoteConfig]);

  useEffect(() => {
    if (remoteConfig) setRemoteUrl(remoteConfig.remote_url ?? "");
  }, [remoteConfig]);

  const mcpSetupCards = getMcpSetupCards(platform);
  const selectedMcpCard = mcpSetupCards.find((card) => card.name === selectedMcpSetup) ?? mcpSetupCards[0];
  const mcpLive = Boolean(mcpStatus?.running);
  const azureDevOpsConfigured = Boolean(creds?.ado_pat || creds?.ado_organization || creds?.ado_project);
  const updateBusy = updateState === "checking" || updateState === "downloading" || updateState === "installing";

  const groupedSections = useMemo(() => {
    return SECTIONS.reduce<Record<string, typeof SECTIONS>>((acc, section) => {
      acc[section.group] = [...(acc[section.group] ?? []), section];
      return acc;
    }, {});
  }, []);

  const showMessage = (text: string) => {
    setMessage(text);
    setError(null);
    window.setTimeout(() => setMessage(null), 2400);
  };

  const saveConfig = async (next?: VaultConfigPatch) => {
    setSaving(true);
    try {
      await commands.setVaultConfig({
        name,
        mcp_enabled: mcpEnabled,
        mcp_port: mcpPort,
        auto_stage_ai_writes: autoStage,
        compress_context: compressContext,
        ssh_key_path: sshKeyPath,
        ai_enabled: aiEnabled,
        ai_endpoint_url: aiEndpointUrl,
        ai_model: aiModel,
        ...next,
      });
      await loadStats();
      await loadSettings();
      showMessage("Settings saved.");
    } catch (err) {
      setError(`Save failed: ${err}`);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleMcp = async (enabled: boolean) => {
    setMcpEnabled(enabled);
    setSaving(true);
    try {
      await commands.setVaultConfig({ mcp_enabled: enabled, mcp_port: mcpPort });
      if (enabled && vaultPath) {
        await commands.startMcpServer(vaultPath, mcpPort).catch(() => {});
      } else {
        await commands.stopMcpServer().catch(() => {});
      }
      await loadStats();
      await loadSettings();
      showMessage(enabled ? "MCP server enabled." : "MCP server disabled.");
    } catch (err) {
      setError(`Could not update MCP server: ${err}`);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveGitSettings = async () => {
    setSaving(true);
    try {
      await commands.setVaultConfig({
        name,
        mcp_enabled: mcpEnabled,
        mcp_port: mcpPort,
        auto_stage_ai_writes: autoStage,
        compress_context: compressContext,
        ssh_key_path: sshKeyPath,
        ai_enabled: aiEnabled,
        ai_endpoint_url: aiEndpointUrl,
        ai_model: aiModel,
      });
      await setRemoteConfig({
        remote_url: remoteUrl || undefined,
        remote_branch: remoteConfig?.remote_branch ?? "main",
        pull_on_open: remoteConfig?.pull_on_open ?? false,
        push_on_close: remoteConfig?.push_on_close ?? false,
      });
      await commands.gitSaveCredentials({
        github_pat: githubPat || undefined,
        ado_pat: adoPat || undefined,
        ado_organization: adoOrg || undefined,
        ado_project: adoProject || undefined,
      });
      setGithubPat("");
      setAdoPat("");
      await loadStats();
      await loadSettings();
      showMessage("Git settings saved.");
    } catch (err) {
      setError(`Save failed: ${err}`);
    } finally {
      setSaving(false);
    }
  };

  const handleCopy = async (text: string, label: string) => {
    try {
      await copyToClipboard(text);
      showMessage(`${label} copied.`);
    } catch (err) {
      setError(`Could not copy ${label.toLowerCase()}: ${err}`);
    }
  };

  const handleBackup = async () => {
    try {
      const { save } = await import("@tauri-apps/plugin-dialog");
      const path = await save({
        defaultPath: `slatevault-backup-${new Date().toISOString().slice(0, 10)}.zip`,
        filters: [{ name: "ZIP", extensions: ["zip"] }],
      });
      if (!path) return;
      const result = await commands.backupVault(path);
      showMessage(result);
    } catch (err) {
      setError(`Backup failed: ${err}`);
    }
  };

  const handleRestore = async () => {
    try {
      const { open, ask } = await import("@tauri-apps/plugin-dialog");
      const zipPath = await open({
        filters: [{ name: "ZIP", extensions: ["zip"] }],
        title: "Select vault backup ZIP",
      });
      if (!zipPath) return;
      const destPath = await open({
        directory: true,
        title: "Select destination folder for restore",
      });
      if (!destPath) return;
      const confirmed = await ask(
        "This will extract the backup to the selected folder. Existing files may be overwritten. Continue?",
        { title: "Restore Vault", kind: "warning" }
      );
      if (!confirmed) return;
      const result = await commands.restoreVault(zipPath as string, destPath as string);
      showMessage(result);
    } catch (err) {
      setError(`Restore failed: ${err}`);
    }
  };

  if (loading && !settings) {
    return (
      <div className="workspace-page h-full min-w-0 flex-1 overflow-y-auto px-6 py-6">
        <div className="text-sm" style={{ color: "var(--text-muted)" }}>Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="workspace-page h-full min-w-0 flex-1 overflow-y-auto">
      <div className="grid min-h-full grid-cols-[280px_minmax(0,1fr)]">
        <aside className="border-r px-4 py-5" style={{ borderColor: "var(--border)", background: "var(--bg-subtle)" }}>
          <div className="workspace-label mb-6 text-sm font-semibold" style={{ color: "var(--text-muted)" }}>Settings</div>
          <div className="space-y-6">
            {Object.entries(groupedSections).map(([group, sections]) => (
              <div key={group}>
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--text-muted)" }}>{group}</div>
                <div className="space-y-1">
                  {sections.map((section) => (
                    <button
                      key={section.id}
                      onClick={() => setActiveSection(section.id)}
                      className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm"
                      style={{
                        background: activeSection === section.id ? "var(--bg-tint)" : "transparent",
                        color: activeSection === section.id ? "var(--text)" : "var(--text-muted)",
                      }}
                    >
                      <span className="w-8 shrink-0 text-[11px] font-semibold" style={{ color: "var(--text-faint)" }}>{section.icon}</span>
                      <span className="min-w-0 flex-1 truncate">{section.label}</span>
                      {section.id === "mcp" && mcpLive && <span className="chip success">live</span>}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </aside>

        <main className="min-w-0 px-8 py-8">
          <div className="max-w-[1180px]">
            {(message || error) && (
              <div
                className="mb-5 rounded-lg px-4 py-3 text-sm"
                style={error
                  ? { background: "var(--danger-soft)", border: "1px solid var(--danger)", color: "var(--danger)" }
                  : { background: "var(--success-soft)", border: "1px solid var(--success)", color: "var(--success)" }
                }
              >
                {error || message}
              </div>
            )}

            {activeSection === "vault" && (
              <SettingsSectionShell
                icon="DB"
                title="Vault"
                description="The local-first folder that holds every project's docs. Edits here are written directly to disk; git is what makes them shared."
              >
                <SettingRow label="Vault name" help="Used as the brand mark and in MCP responses.">
                  <input className="settings-input" value={name} onChange={(event) => setName(event.target.value)} />
                </SettingRow>
                <SettingRow label="Vault path" help="Local folder containing the vault.">
                  <div className="flex min-w-0 gap-2">
                    <input className="settings-input min-w-0 flex-1" value={settings?.path || vaultPath || ""} readOnly />
                    <button className="btn" onClick={closeVault}>Choose...</button>
                  </div>
                </SettingRow>
                <SettingRow label="Default editor mode" help="Documents can still be switched from the document toolbar.">
                  <select className="settings-input max-w-[260px]" defaultValue="split">
                    <option value="split">Split (editor + preview)</option>
                    <option value="editor">Editor</option>
                    <option value="preview">Preview</option>
                  </select>
                </SettingRow>
                <SettingRow label="Backups" help="Manual backups include projects, documents, and config.">
                  <div className="flex flex-wrap gap-2">
                    <button className="btn" onClick={() => void handleBackup()}>Backup vault...</button>
                    <button className="btn" onClick={() => void handleRestore()}>Restore backup...</button>
                  </div>
                </SettingRow>
                <SettingRow label="Danger zone">
                  <button className="btn danger" onClick={closeVault}>Close vault</button>
                </SettingRow>
                <div className="pt-4">
                  <button className="btn primary lg whitespace-nowrap" disabled={saving} onClick={() => void saveConfig()}>
                    {saving ? "Saving..." : "Save vault settings"}
                  </button>
                </div>
              </SettingsSectionShell>
            )}

            {activeSection === "mcp" && (
              <SettingsSectionShell
                icon="MCP"
                title="Agent access (MCP)"
                description="slateVault runs a Model Context Protocol server on localhost. Connected coding agents can read trusted project docs without scraping or guessing."
              >
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="panel p-5">
                    <div className="flex items-center gap-3">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: mcpLive ? "var(--success)" : "var(--warning)" }} />
                      <h3 className="text-lg font-semibold" style={{ color: "var(--text)" }}>
                        {mcpLive ? "Server running" : mcpEnabled ? "Server enabled" : "Server disabled"}
                      </h3>
                    </div>
                    <div className="mt-3 font-mono text-lg" style={{ color: "var(--text-muted)" }}>
                      localhost:{mcpStatus?.port ?? mcpPort}
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button className="btn" disabled={saving || mcpLive || !vaultPath} onClick={() => void handleToggleMcp(true)}>Start</button>
                      <button className="btn" disabled={saving || !mcpLive} onClick={() => void handleToggleMcp(false)}>Stop</button>
                    </div>
                  </div>
                  <div className="panel p-5">
                    <h3 className="text-lg font-semibold" style={{ color: "var(--text)" }}>Available to agents</h3>
                    <div className="mt-3 space-y-1 text-sm" style={{ color: "var(--text-muted)" }}>
                      <div>- {stats?.doc_count ?? 0} project docs</div>
                      <div>- {wikiDocs.length} wiki docs</div>
                      <div>- Brief generator and session context</div>
                      <div>- Search and read-only discovery tools</div>
                    </div>
                  </div>
                </div>

                <SettingRow label="Enabled">
                  <Toggle checked={mcpEnabled} onChange={(checked) => void handleToggleMcp(checked)} label="Run MCP server when vault is open" />
                </SettingRow>
                <SettingRow label="Port">
                  <input className="settings-input max-w-[260px]" type="number" min={1024} max={65535} value={mcpPort} onChange={(event) => setMcpPort(Number(event.target.value))} />
                </SettingRow>
                <SettingRow label="Auto-stage AI writes" help="When an agent writes a doc, stage it for review automatically.">
                  <Toggle checked={autoStage} onChange={setAutoStage} label="Stage and flag as AI-authored" />
                </SettingRow>
                <SettingRow label="Compression mode" help="Uses terse agent brief output for long session summaries.">
                  <Toggle checked={compressContext} onChange={setCompressContext} label="Use compressed context output" />
                </SettingRow>

                <section className="pt-6">
                  <h3 className="mb-4 text-lg font-semibold" style={{ color: "var(--text)" }}>Connect your agent</h3>
                  <div className="grid gap-3 lg:grid-cols-3">
                    {mcpSetupCards.slice(0, 3).map((card) => (
                      <button
                        key={card.name}
                        onClick={() => setSelectedMcpSetup(card.name)}
                        className="panel p-4 text-left"
                        style={{ borderColor: selectedMcpSetup === card.name ? "var(--accent)" : "var(--border)" }}
                      >
                        <div className="font-semibold" style={{ color: "var(--text)" }}>{card.name}</div>
                        <div className="mt-2 text-xs" style={{ color: "var(--text-muted)" }}>Copy setup config</div>
                      </button>
                    ))}
                  </div>
                  <div className="mt-4 rounded-lg border p-4" style={{ borderColor: "var(--border)", background: "var(--bg-elevated)" }}>
                    <pre className="max-h-48 overflow-auto whitespace-pre-wrap font-mono text-xs" style={{ color: "var(--text-muted)" }}>{selectedMcpCard.command}</pre>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button className="btn" onClick={() => void handleCopy(selectedMcpCard.command, selectedMcpCard.name)}>Copy config</button>
                      <span className="text-xs" style={{ color: "var(--text-faint)" }}>{selectedMcpCard.note} {getMcpInstallNote(platform)}</span>
                    </div>
                  </div>
                </section>
                <div className="pt-4">
                  <button className="btn primary lg whitespace-nowrap" disabled={saving} onClick={() => void saveConfig()}>
                    {saving ? "Saving..." : "Save agent settings"}
                  </button>
                </div>
              </SettingsSectionShell>
            )}

            {activeSection === "ai" && (
              <SettingsSectionShell
                icon="AI"
                title="AI settings"
                description="Optional local or OpenAI-compatible assistant settings for features that call a model directly."
              >
                <SettingRow label="Enabled">
                  <Toggle checked={aiEnabled} onChange={setAiEnabled} label="Enable built-in AI assistant features" />
                </SettingRow>
                <SettingRow label="Endpoint URL" help="Works with Ollama, LM Studio, OpenAI-compatible gateways, or local servers.">
                  <input className="settings-input" value={aiEndpointUrl} onChange={(event) => setAiEndpointUrl(event.target.value)} placeholder="http://localhost:11434/v1" />
                </SettingRow>
                <SettingRow label="Model">
                  <input className="settings-input" value={aiModel} onChange={(event) => setAiModel(event.target.value)} placeholder="llama3.1, gpt-4.1, claude..." />
                </SettingRow>
                <SettingRow label="API key" help="Stored outside the vault repo with other credentials.">
                  <input
                    className="settings-input"
                    type="password"
                    placeholder={creds?.ai_api_key ? `Saved (${creds.ai_api_key})` : "Optional for local models"}
                    onChange={async (event) => {
                      if (!event.target.value) return;
                      await commands.gitSaveCredentials({ ai_api_key: event.target.value });
                      await loadSettings();
                      showMessage("AI API key saved.");
                    }}
                  />
                </SettingRow>
                <button className="btn primary lg whitespace-nowrap" disabled={saving} onClick={() => void saveConfig()}>
                  {saving ? "Saving..." : "Save AI settings"}
                </button>
              </SettingsSectionShell>
            )}

            {activeSection === "git" && (
              <SettingsSectionShell
                icon="Git"
                title="Git & credentials"
                description="Configure how slateVault talks to your remote and creates pull requests on your behalf."
              >
                <SettingRow label="Remote repository URL" help="The git remote used for team sync. Changes here also update the Sync screen.">
                  <input className="settings-input" value={remoteUrl} onChange={(event) => setRemoteUrl(event.target.value)} placeholder="https://github.com/org/vault.git" />
                </SettingRow>
                <SettingRow label="SSH key path">
                  <input className="settings-input" value={sshKeyPath} onChange={(event) => setSshKeyPath(event.target.value)} placeholder="~/.ssh/id_ed25519" />
                </SettingRow>
                <SettingRow label="GitHub credentials" help="Used to create pull requests. Git SSH push uses your SSH key.">
                  <div className="flex flex-wrap items-center gap-3">
                    {creds?.github_pat ? <span className="chip success">Connected</span> : <span className="chip warning">Not connected</span>}
                    <input className="settings-input max-w-[360px]" type="password" value={githubPat} onChange={(event) => setGithubPat(event.target.value)} placeholder="ghp_..." />
                  </div>
                </SettingRow>
                <SettingRow label="Azure DevOps" help="Optional. For org repos hosted on Azure.">
                  <div className="space-y-3">
                    <button className="btn" onClick={() => setShowAzureDevOps((value) => !value)}>
                      {azureDevOpsConfigured ? "Edit Azure DevOps..." : "Connect..."}
                    </button>
                    {showAzureDevOps && (
                      <div className="grid gap-3 lg:grid-cols-3">
                        <input className="settings-input" type="password" value={adoPat} onChange={(event) => setAdoPat(event.target.value)} placeholder={creds?.ado_pat ? `Saved (${creds.ado_pat})` : "PAT token"} />
                        <input className="settings-input" value={adoOrg} onChange={(event) => setAdoOrg(event.target.value)} placeholder="organization" />
                        <input className="settings-input" value={adoProject} onChange={(event) => setAdoProject(event.target.value)} placeholder="project" />
                      </div>
                    )}
                  </div>
                </SettingRow>
                <SettingRow label="Commit signing">
                  <Toggle checked={false} onChange={() => {}} label="Sign commits with SSH key" disabled />
                </SettingRow>
                <div className="flex flex-wrap gap-2 pt-4">
                  <button className="btn primary lg whitespace-nowrap" disabled={saving} onClick={() => void handleSaveGitSettings()}>
                    {saving ? "Saving..." : "Save Git settings"}
                  </button>
                </div>
              </SettingsSectionShell>
            )}

            {activeSection === "appearance" && (
              <SettingsSectionShell icon="*" title="Appearance" description="Small display preferences for the local app shell.">
                <SettingRow label="Theme">
                  <select className="settings-input max-w-[220px]" defaultValue="system">
                    <option value="system">System</option>
                    <option value="dark">Dark</option>
                  </select>
                </SettingRow>
                <SettingRow label="Density">
                  <select className="settings-input max-w-[220px]" defaultValue="comfortable">
                    <option value="comfortable">Comfortable</option>
                    <option value="compact">Compact</option>
                  </select>
                </SettingRow>
              </SettingsSectionShell>
            )}

            {activeSection === "keyboard" && (
              <SettingsSectionShell icon="<>" title="Keyboard" description="Shortcuts used across the app.">
                <ShortcutRow label="Search docs" value="Command K" />
                <ShortcutRow label="Toggle terminal" value="Control T" />
                <ShortcutRow label="Save current document" value="Command S" />
              </SettingsSectionShell>
            )}

            {activeSection === "updates" && (
              <SettingsSectionShell icon="Up" title="Updates">
                <div className="panel flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h3 className="text-lg font-semibold" style={{ color: "var(--text)" }}>
                      {updateStatusLabel(updateState, updateVersion)}
                    </h3>
                    <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
                      slateVault {version ? `v${version}` : "version unavailable"} - {formatBundleType(bundleType)} - checked {formatLastChecked(lastCheckedAt)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button className="btn lg whitespace-nowrap" disabled={updateBusy} onClick={() => void checkForUpdates(true)}>
                      {updateState === "checking" ? "Checking..." : "Check for updates"}
                    </button>
                    <button className="btn primary lg whitespace-nowrap" disabled={updateState !== "available"} onClick={() => void installUpdate()}>
                      Install update
                    </button>
                  </div>
                </div>
                {(updateState === "downloading" || updateState === "installing") && (
                  <div className="panel p-5">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span style={{ color: "var(--text)" }}>
                        {updateState === "installing" ? "Installing update..." : "Downloading update..."}
                      </span>
                      <span style={{ color: "var(--text-muted)" }}>
                        {updateProgress !== null
                          ? `${updateProgress}%`
                          : updateTotalBytes
                            ? `${formatBytes(updateDownloadedBytes)} of ${formatBytes(updateTotalBytes)}`
                            : formatBytes(updateDownloadedBytes)}
                      </span>
                    </div>
                    <div className="update-progress mt-3" aria-label="Update download progress">
                      <span style={{ width: `${updateProgress ?? 12}%` }} />
                    </div>
                  </div>
                )}
                {updateState === "installed" && (
                  <div className="rounded-lg p-4 text-sm" style={{ background: "var(--success-soft)", border: "1px solid var(--success)", color: "var(--success)" }}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <span>Update installed. Close and reopen slateVault to finish.</span>
                      <button className="btn primary sm" onClick={() => void getCurrentWindow().close()}>
                        Close app
                      </button>
                    </div>
                  </div>
                )}
                <SettingRow label="Update channel">
                  <select className="settings-input max-w-[180px]" value={channel} disabled>
                    <option value={channel}>{channel}</option>
                  </select>
                </SettingRow>
                <SettingRow label="Install automatically">
                  <Toggle checked={false} onChange={() => {}} label="Download and install in the background" disabled />
                </SettingRow>
                {updateError && <div className="rounded-lg p-4 text-sm" style={{ background: "var(--warning-soft)", border: "1px solid var(--warning)", color: "var(--warning)" }}>{updateError}</div>}
                {updateBody && updateState === "available" && (
                  <pre className="rounded-lg border p-4 text-xs whitespace-pre-wrap" style={{ borderColor: "var(--border)", background: "var(--bg-elevated)", color: "var(--text-muted)" }}>{updateBody}</pre>
                )}
              </SettingsSectionShell>
            )}

            {activeSection === "advanced" && (
              <SettingsSectionShell icon="Gear" title="Advanced" description="For users who want to look under the hood.">
                <SettingRow label="Vault config file" help="The raw JSON that backs workspace-level settings.">
                  <button className="btn" onClick={() => openVaultFile("vault.local.toml")}>Open config</button>
                </SettingRow>
                <SettingRow label="Project templates">
                  <button className="btn" onClick={() => openVaultFile("templates.json")}>Open templates.json</button>
                </SettingRow>
                <SettingRow label="Session playbooks">
                  <button className="btn" onClick={() => openVaultFile("playbooks.json")}>Open playbooks.json</button>
                </SettingRow>
                <SettingRow label="Reset onboarding">
                  <button className="btn" onClick={() => { setShowOnboarding(true); setWorkspaceView("home"); }}>Show onboarding again</button>
                </SettingRow>
                <SettingRow label="Diagnostic logs">
                  <button className="btn" disabled>Reveal in Finder</button>
                </SettingRow>
                <SettingRow label="Telemetry">
                  <Toggle checked={false} onChange={() => {}} label="Share anonymous usage data" disabled />
                </SettingRow>
              </SettingsSectionShell>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

function SettingsSectionShell({
  icon,
  title,
  description,
  children,
}: {
  icon: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="workspace-kicker mb-3">
        <span>{icon}</span>
        Settings
      </div>
      <h1 className="text-3xl font-semibold tracking-tight" style={{ color: "var(--text)" }}>{title}</h1>
      {description && (
        <p className="mt-4 max-w-4xl text-sm leading-6" style={{ color: "var(--text-muted)" }}>{description}</p>
      )}
      <div className="mt-8 space-y-0 border-t" style={{ borderColor: "var(--border-subtle)" }}>
        {children}
      </div>
    </section>
  );
}

function SettingRow({
  label,
  help,
  children,
}: {
  label: string;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-4 border-b py-5 lg:grid-cols-[280px_minmax(0,1fr)] lg:items-start" style={{ borderColor: "var(--border-subtle)" }}>
      <div>
        <div className="text-sm font-semibold" style={{ color: "var(--text)" }}>{label}</div>
        {help && <div className="mt-1 max-w-[260px] text-sm leading-5" style={{ color: "var(--text-muted)" }}>{help}</div>}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex items-center gap-3 text-left disabled:opacity-50"
      style={{ color: "var(--text)" }}
    >
      <span
        className="relative h-6 w-11 rounded-full transition-colors"
        style={{ background: checked ? "var(--success)" : "var(--text-faint)" }}
      >
        <span
          className="absolute top-1 h-4 w-4 rounded-full bg-white transition-all"
          style={{ left: checked ? 23 : 4 }}
        />
      </span>
      <span className="text-sm">{label}</span>
    </button>
  );
}

function ShortcutRow({ label, value }: { label: string; value: string }) {
  return (
    <SettingRow label={label}>
      <kbd className="rounded-md border px-3 py-1.5 text-sm" style={{ borderColor: "var(--border)", background: "var(--bg-elevated)", color: "var(--text)" }}>{value}</kbd>
    </SettingRow>
  );
}
