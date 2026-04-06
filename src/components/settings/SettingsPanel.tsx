"use client";

import { useEffect, useState } from "react";
import * as commands from "@/lib/commands";
import { useVaultStore } from "@/stores/vaultStore";
import { useEditorStore } from "@/stores/editorStore";
import { useUIStore } from "@/stores/uiStore";
import type { Theme } from "@/stores/uiStore";
import type { VaultSettings, CredentialsMasked } from "@/types";

export function SettingsPanel() {
  const loadStats = useVaultStore((s) => s.loadStats);
  const openVaultFile = useEditorStore((s) => s.openVaultFile);
  const theme = useUIStore((s) => s.theme);
  const setTheme = useUIStore((s) => s.setTheme);
  const [settings, setSettings] = useState<VaultSettings | null>(null);
  const [name, setName] = useState("");
  const [mcpEnabled, setMcpEnabled] = useState(true);
  const [mcpPort, setMcpPort] = useState(3742);
  const [autoStage, setAutoStage] = useState(true);
  const [sshKeyPath, setSshKeyPath] = useState("");
  const [output, setOutput] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Credentials state
  const [creds, setCreds] = useState<CredentialsMasked | null>(null);
  const [githubPat, setGithubPat] = useState("");
  const [adoPat, setAdoPat] = useState("");
  const [adoOrg, setAdoOrg] = useState("");
  const [adoProject, setAdoProject] = useState("");

  useEffect(() => {
    loadSettings();
    loadCredentials();
  }, []);

  const loadSettings = async () => {
    try {
      const s = await commands.getVaultConfig();
      setSettings(s);
      setName(s.name);
      setMcpEnabled(s.mcp_enabled);
      setMcpPort(s.mcp_port);
      setAutoStage(s.auto_stage_ai_writes);
      setSshKeyPath(s.ssh_key_path || "");
    } catch (e) {
      setOutput(`Failed to load settings: ${e}`);
    } finally {
      setLoading(false);
    }
  };

  const loadCredentials = async () => {
    try {
      const c = await commands.gitLoadCredentials();
      setCreds(c);
      setAdoOrg(c.ado_organization || "");
      setAdoProject(c.ado_project || "");
    } catch {
      // No credentials yet
    }
  };

  const handleSaveCredentials = async () => {
    try {
      await commands.gitSaveCredentials({
        github_pat: githubPat || undefined,
        ado_pat: adoPat || undefined,
        ado_organization: adoOrg || undefined,
        ado_project: adoProject || undefined,
      });
      setOutput("Credentials saved");
      setGithubPat("");
      setAdoPat("");
      await loadCredentials();
      setTimeout(() => setOutput(null), 2000);
    } catch (e) {
      setOutput(`Save credentials failed: ${e}`);
    }
  };

  const handleSave = async () => {
    try {
      await commands.setVaultConfig({
        name,
        mcp_enabled: mcpEnabled,
        mcp_port: mcpPort,
        auto_stage_ai_writes: autoStage,
        ssh_key_path: sshKeyPath,
      });
      setOutput("Settings saved");
      await loadStats();
      setTimeout(() => setOutput(null), 2000);
    } catch (e) {
      setOutput(`Save failed: ${e}`);
    }
  };

  if (loading) {
    return (
      <div className="p-4 text-neutral-500 text-xs">Loading settings...</div>
    );
  }

  return (
    <div className="flex flex-col h-full text-xs overflow-y-auto">
      {/* Vault section */}
      <div className="p-3 border-b border-neutral-800">
        <h3 className="text-neutral-400 font-medium mb-2 uppercase tracking-wider text-[10px]">
          Vault
        </h3>
        <div className="space-y-2">
          <div>
            <label className="block text-neutral-500 mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-2 py-1 bg-neutral-800 border border-neutral-700 rounded text-neutral-200 outline-none focus:border-blue-600"
            />
          </div>
          {settings && (
            <div>
              <label className="block text-neutral-500 mb-1">Path</label>
              <div className="px-2 py-1 bg-neutral-800/50 rounded text-neutral-400 truncate">
                {settings.path}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MCP section */}
      <div className="p-3 border-b border-neutral-800">
        <h3 className="text-neutral-400 font-medium mb-2 uppercase tracking-wider text-[10px]">
          MCP Server
        </h3>
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-neutral-400">
            <input
              type="checkbox"
              checked={mcpEnabled}
              onChange={(e) => setMcpEnabled(e.target.checked)}
              className="rounded"
            />
            Enabled
            <span className={`w-2 h-2 rounded-full ${mcpEnabled ? "bg-green-500" : "bg-red-500"}`} />
          </label>
          <div>
            <label className="block text-neutral-500 mb-1">Port</label>
            <input
              type="number"
              value={mcpPort}
              onChange={(e) => setMcpPort(Number(e.target.value))}
              min={1024}
              max={65535}
              className="w-full px-2 py-1 bg-neutral-800 border border-neutral-700 rounded text-neutral-200 outline-none focus:border-blue-600"
            />
          </div>
          <label className="flex items-center gap-2 text-neutral-400">
            <input
              type="checkbox"
              checked={autoStage}
              onChange={(e) => setAutoStage(e.target.checked)}
              className="rounded"
            />
            Auto-stage AI writes
          </label>
          <div className="pt-1">
            <label className="block text-neutral-500 mb-1">Claude Code Setup</label>
            <div className="flex gap-1">
              <code className="flex-1 px-2 py-1 bg-neutral-800 rounded text-neutral-400 text-[10px] truncate">
                claude mcp add -s user slatevault -- slatevault-mcp
              </code>
              <button
                onClick={() => {
                  const cmd = `claude mcp add -s user slatevault -- slatevault-mcp`;
                  navigator.clipboard.writeText(cmd);
                  setOutput("Copied MCP setup command!");
                  setTimeout(() => setOutput(null), 2000);
                }}
                className="px-2 py-1 bg-neutral-800 hover:bg-neutral-700 rounded text-neutral-400 flex-shrink-0"
              >
                Copy
              </button>
            </div>
            <p className="text-neutral-600 mt-1">
              Run this in your terminal to connect Claude Code to slateVault.
              The MCP server automatically connects to whichever vault is open.
            </p>
          </div>
        </div>
      </div>

      {/* Git/SSH section */}
      <div className="p-3 border-b border-neutral-800">
        <h3 className="text-neutral-400 font-medium mb-2 uppercase tracking-wider text-[10px]">
          Git
        </h3>
        <div className="space-y-2">
          <div>
            <label className="block text-neutral-500 mb-1">SSH Key Path</label>
            <input
              type="text"
              value={sshKeyPath}
              onChange={(e) => setSshKeyPath(e.target.value)}
              placeholder="~/.ssh/id_ed25519"
              className="w-full px-2 py-1 bg-neutral-800 border border-neutral-700 rounded text-neutral-200 placeholder-neutral-600 outline-none focus:border-blue-600"
            />
          </div>
          {settings && (
            <>
              <div>
                <label className="block text-neutral-500 mb-1">Remote URL</label>
                <div className="px-2 py-1 bg-neutral-800/50 rounded text-neutral-400 truncate">
                  {settings.remote_url || "(not configured)"}
                </div>
              </div>
              <div>
                <label className="block text-neutral-500 mb-1">Branch</label>
                <div className="px-2 py-1 bg-neutral-800/50 rounded text-neutral-400">
                  {settings.remote_branch || "main"}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Credentials section */}
      <div className="p-3 border-b border-neutral-800">
        <h3 className="text-neutral-400 font-medium mb-2 uppercase tracking-wider text-[10px]">
          PR Credentials
        </h3>
        <div className="space-y-2">
          <div>
            <label className="block text-neutral-500 mb-1">
              GitHub PAT
              {creds?.github_pat && (
                <span className="ml-1 text-green-500">({creds.github_pat})</span>
              )}
            </label>
            <input
              type="password"
              value={githubPat}
              onChange={(e) => setGithubPat(e.target.value)}
              placeholder="ghp_..."
              className="w-full px-2 py-1 bg-neutral-800 border border-neutral-700 rounded text-neutral-200 placeholder-neutral-600 outline-none focus:border-blue-600"
            />
          </div>
          <div>
            <label className="block text-neutral-500 mb-1">
              Azure DevOps PAT
              {creds?.ado_pat && (
                <span className="ml-1 text-green-500">({creds.ado_pat})</span>
              )}
            </label>
            <input
              type="password"
              value={adoPat}
              onChange={(e) => setAdoPat(e.target.value)}
              placeholder="PAT token..."
              className="w-full px-2 py-1 bg-neutral-800 border border-neutral-700 rounded text-neutral-200 placeholder-neutral-600 outline-none focus:border-blue-600"
            />
          </div>
          <div>
            <label className="block text-neutral-500 mb-1">ADO Organization</label>
            <input
              type="text"
              value={adoOrg}
              onChange={(e) => setAdoOrg(e.target.value)}
              placeholder="myorg"
              className="w-full px-2 py-1 bg-neutral-800 border border-neutral-700 rounded text-neutral-200 placeholder-neutral-600 outline-none focus:border-blue-600"
            />
          </div>
          <div>
            <label className="block text-neutral-500 mb-1">ADO Project</label>
            <input
              type="text"
              value={adoProject}
              onChange={(e) => setAdoProject(e.target.value)}
              placeholder="myproject"
              className="w-full px-2 py-1 bg-neutral-800 border border-neutral-700 rounded text-neutral-200 placeholder-neutral-600 outline-none focus:border-blue-600"
            />
          </div>
          <button
            onClick={handleSaveCredentials}
            className="w-full px-2 py-1.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300"
          >
            Save Credentials
          </button>
          <p className="text-neutral-600 text-[10px]">
            Stored in ~/.slatevault/credentials.toml (not in your vault repo).
          </p>
        </div>
      </div>

      {/* Templates section */}
      <div className="p-3 border-b border-neutral-800">
        <h3 className="text-neutral-400 font-medium mb-2 uppercase tracking-wider text-[10px]">
          Project Templates
        </h3>
        <div className="space-y-2">
          <button
            onClick={() => openVaultFile("templates.json")}
            className="w-full px-2 py-1.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs"
          >
            Edit Project Templates
          </button>
          <p className="text-neutral-600 text-[10px]">
            Opens templates.json in the editor. Customize folder structures and starter files for new projects.
          </p>
        </div>
      </div>

      {/* Theme section */}
      <div className="p-3 border-b border-neutral-800">
        <h3 className="text-neutral-400 font-medium mb-2 uppercase tracking-wider text-[10px]">
          Theme
        </h3>
        <div className="flex gap-2">
          {(
            [
              { id: "dark", label: "Dark", swatch: "#171717" },
              { id: "light", label: "Light", swatch: "#f2f2ef" },
              { id: "olive", label: "Olive", swatch: "#222a18" },
              { id: "deepblue", label: "Deep Blue", swatch: "#141c2e" },
            ] as { id: Theme; label: string; swatch: string }[]
          ).map((t) => (
            <button
              key={t.id}
              onClick={() => setTheme(t.id)}
              className={`flex-1 flex flex-col items-center gap-1.5 py-2 rounded border transition-colors ${
                theme === t.id
                  ? "border-blue-500 bg-neutral-800"
                  : "border-neutral-700 hover:border-neutral-600"
              }`}
            >
              <span
                className="w-6 h-6 rounded-full border border-neutral-600"
                style={{ background: t.swatch }}
              />
              <span className="text-neutral-300">{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Save */}
      <div className="p-3">
        <button
          onClick={handleSave}
          className="w-full px-2 py-1.5 rounded bg-blue-700 hover:bg-blue-600 text-white"
        >
          Save Settings
        </button>
        {output && (
          <div className="mt-2 text-neutral-400">{output}</div>
        )}
      </div>
    </div>
  );
}
