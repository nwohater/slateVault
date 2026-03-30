"use client";

import { useState, useEffect } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { useVaultStore } from "@/stores/vaultStore";
import * as commands from "@/lib/commands";

const RECENT_VAULTS_KEY = "slatevault_recent_vaults";
const MAX_RECENT = 5;

interface RecentVault {
  path: string;
  name: string;
  lastOpened: string;
}

function getRecentVaults(): RecentVault[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_VAULTS_KEY) || "[]");
  } catch {
    return [];
  }
}

function addRecentVault(path: string, name: string) {
  const recent = getRecentVaults().filter((v) => v.path !== path);
  recent.unshift({ path, name, lastOpened: new Date().toISOString() });
  localStorage.setItem(
    RECENT_VAULTS_KEY,
    JSON.stringify(recent.slice(0, MAX_RECENT))
  );
}

export function VaultPicker() {
  const [path, setPath] = useState("");
  const [name, setName] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [mode, setMode] = useState<"open" | "create" | "clone">("open");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [recentVaults, setRecentVaults] = useState<RecentVault[]>([]);
  const openVault = useVaultStore((s) => s.openVault);
  const createVault = useVaultStore((s) => s.createVault);

  useEffect(() => {
    setRecentVaults(getRecentVaults());
  }, []);

  const handleBrowse = async () => {
    const selected = await open({ directory: true, title: "Select vault folder" });
    if (selected) {
      setPath(selected);
    }
  };

  const handleOpen = async (vaultPath: string, vaultName?: string) => {
    setError(null);
    setLoading(true);
    try {
      await openVault(vaultPath);
      addRecentVault(vaultPath, vaultName || vaultPath.split(/[\\/]/).pop() || "vault");
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (mode === "clone") {
      if (!repoUrl.trim() || !path.trim()) return;
    } else if (!path.trim()) return;
    setError(null);
    setLoading(true);
    try {
      if (mode === "clone") {
        await commands.gitClone(repoUrl.trim(), path.trim());
        // Derive vault name from repo URL
        const repoName = repoUrl.trim().split("/").pop()?.replace(/\.git$/, "") || "vault";
        try {
          await openVault(path.trim());
        } catch {
          // No vault.toml — initialize as a vault first
          await createVault(path.trim(), repoName);
        }
        addRecentVault(path.trim(), repoName);
      } else if (mode === "create") {
        const vaultName = name.trim() || "default";
        await createVault(path.trim(), vaultName);
        addRecentVault(path.trim(), vaultName);
      } else {
        await handleOpen(path.trim());
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center h-screen bg-neutral-950 overflow-auto">
      <div className="w-full max-w-md p-8">
        <div className="flex justify-center mb-6">
          <img src="/slateVault.png" alt="slateVault" className="h-64 object-contain" />
        </div>
        <p className="text-neutral-500 text-center text-sm mb-8">
          Local-first, AI-native markdown vault
        </p>

        {/* Recent vaults */}
        {recentVaults.length > 0 && (
          <div className="mb-6">
            <label className="block text-xs text-neutral-500 mb-2">
              Recent Vaults
            </label>
            <div className="space-y-1">
              {recentVaults.map((v) => (
                <button
                  key={v.path}
                  onClick={() => handleOpen(v.path, v.name)}
                  disabled={loading}
                  className="w-full flex items-center gap-3 px-3 py-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-lg text-left transition-colors disabled:opacity-50"
                >
                  <span className="text-blue-400 text-sm">V</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-neutral-200 truncate">
                      {v.name}
                    </div>
                    <div className="text-xs text-neutral-500 truncate">
                      {v.path}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Mode tabs */}
        <div className="flex mb-4 bg-neutral-900 rounded-lg p-0.5">
          <button
            onClick={() => setMode("open")}
            className={`flex-1 py-1.5 text-sm rounded-md transition-colors ${
              mode === "open"
                ? "bg-neutral-800 text-neutral-100"
                : "text-neutral-500 hover:text-neutral-300"
            }`}
          >
            Open Vault
          </button>
          <button
            onClick={() => setMode("create")}
            className={`flex-1 py-1.5 text-sm rounded-md transition-colors ${
              mode === "create"
                ? "bg-neutral-800 text-neutral-100"
                : "text-neutral-500 hover:text-neutral-300"
            }`}
          >
            Create Vault
          </button>
          <button
            onClick={() => setMode("clone")}
            className={`flex-1 py-1.5 text-sm rounded-md transition-colors ${
              mode === "clone"
                ? "bg-neutral-800 text-neutral-100"
                : "text-neutral-500 hover:text-neutral-300"
            }`}
          >
            Clone Repo
          </button>
        </div>

        <div className="space-y-3">
          {mode === "clone" && (
            <div>
              <label className="block text-xs text-neutral-400 mb-1">
                Repository URL
              </label>
              <input
                type="text"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                placeholder="https://github.com/user/repo.git"
                className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-neutral-200 placeholder-neutral-600 outline-none focus:border-blue-600 text-sm"
              />
            </div>
          )}

          <div>
            <label className="block text-xs text-neutral-400 mb-1">
              {mode === "clone" ? "Destination path" : "Vault path"}
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={path}
                onChange={(e) => setPath(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                placeholder="Select a folder..."
                className="flex-1 px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-neutral-200 placeholder-neutral-600 outline-none focus:border-blue-600 text-sm"
              />
              <button
                onClick={handleBrowse}
                className="px-3 py-2 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded-lg text-neutral-300 text-sm transition-colors"
              >
                Browse
              </button>
            </div>
          </div>

          {mode === "create" && (
            <div>
              <label className="block text-xs text-neutral-400 mb-1">
                Vault name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                placeholder="my-vault"
                className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-neutral-200 placeholder-neutral-600 outline-none focus:border-blue-600 text-sm"
              />
            </div>
          )}

          {error && (
            <p className="text-red-400 text-xs">{error}</p>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading || !path.trim() || (mode === "clone" && !repoUrl.trim())}
            className="w-full py-2 bg-blue-700 hover:bg-blue-600 disabled:bg-neutral-800 disabled:text-neutral-500 text-white rounded-lg text-sm font-medium transition-colors"
          >
            {loading
              ? (mode === "clone" ? "Cloning..." : "...")
              : mode === "clone"
                ? "Clone & Open"
                : mode === "create"
                  ? "Create & Open"
                  : "Open Vault"}
          </button>
        </div>
      </div>
    </div>
  );
}
