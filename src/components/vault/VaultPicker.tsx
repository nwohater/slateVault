"use client";

import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { useVaultStore } from "@/stores/vaultStore";

export function VaultPicker() {
  const [path, setPath] = useState("");
  const [name, setName] = useState("");
  const [mode, setMode] = useState<"open" | "create">("open");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const openVault = useVaultStore((s) => s.openVault);
  const createVault = useVaultStore((s) => s.createVault);

  const handleBrowse = async () => {
    const selected = await open({ directory: true, title: "Select vault folder" });
    if (selected) {
      setPath(selected);
    }
  };

  const handleSubmit = async () => {
    if (!path.trim()) return;
    setError(null);
    setLoading(true);
    try {
      if (mode === "create") {
        await createVault(path.trim(), name.trim() || "default");
      } else {
        await openVault(path.trim());
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center h-screen bg-neutral-950">
      <div className="w-full max-w-md p-8">
        <h1 className="text-3xl font-bold text-neutral-100 text-center mb-2">
          slateVault
        </h1>
        <p className="text-neutral-500 text-center text-sm mb-8">
          Local-first, AI-native markdown vault
        </p>

        {/* Mode tabs */}
        <div className="flex mb-6 bg-neutral-900 rounded-lg p-0.5">
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
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs text-neutral-400 mb-1">
              Vault path
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
            disabled={loading || !path.trim()}
            className="w-full py-2 bg-blue-700 hover:bg-blue-600 disabled:bg-neutral-800 disabled:text-neutral-500 text-white rounded-lg text-sm font-medium transition-colors"
          >
            {loading
              ? "..."
              : mode === "create"
                ? "Create & Open"
                : "Open Vault"}
          </button>
        </div>
      </div>
    </div>
  );
}
