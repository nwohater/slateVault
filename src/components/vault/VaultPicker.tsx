"use client";

import { useEffect, useState } from "react";
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

function removeRecentVault(path: string) {
  const recent = getRecentVaults().filter((v) => v.path !== path);
  localStorage.setItem(RECENT_VAULTS_KEY, JSON.stringify(recent));
}

function isHttpsGitUrl(url: string) {
  return /^https?:\/\//i.test(url.trim());
}

function isSshGitUrl(url: string) {
  return /^git@/i.test(url.trim()) || /^ssh:\/\//i.test(url.trim());
}

function VaultMark() {
  return (
    <div className="vault-picker-mark" aria-hidden="true">
      <div className="vault-picker-arch" />
      <div className="vault-picker-glow" />
    </div>
  );
}

export function VaultPicker() {
  const [path, setPath] = useState("");
  const [name, setName] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [mode, setMode] = useState<"open" | "create" | "clone">("open");
  const [error, setError] = useState<string | null>(null);
  const [cloneAuthAvailable, setCloneAuthAvailable] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
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
    } else if (!path.trim()) {
      return;
    }

    setError(null);
    setCloneAuthAvailable(false);
    setLoading(true);
    try {
      if (mode === "clone") {
        await commands.gitClone(repoUrl.trim(), path.trim());
        const repoName =
          repoUrl.trim().split("/").pop()?.replace(/\.git$/, "") || "vault";
        try {
          await openVault(path.trim());
        } catch {
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
      if (mode === "clone" && isHttpsGitUrl(repoUrl)) {
        setCloneAuthAvailable(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleConnectAndRetryClone = async () => {
    if (!repoUrl.trim() || !path.trim()) return;
    setError(null);
    setAuthLoading(true);
    try {
      await commands.gitConnectProviderForUrl(repoUrl.trim());
      setCloneAuthAvailable(false);
      await handleSubmit();
    } catch (e) {
      setError(String(e));
      setCloneAuthAvailable(isHttpsGitUrl(repoUrl));
    } finally {
      setAuthLoading(false);
    }
  };

  const handleUseHttpsCloneUrl = async () => {
    if (!repoUrl.trim()) return;
    setError(null);
    setAuthLoading(true);
    try {
      const httpsUrl = await commands.gitHttpsUrlForRemote(repoUrl.trim());
      setRepoUrl(httpsUrl);
      setCloneAuthAvailable(true);
    } catch (e) {
      setError(String(e));
    } finally {
      setAuthLoading(false);
    }
  };

  const submitLabel = loading
    ? mode === "clone"
      ? "Cloning..."
      : "Opening..."
    : mode === "clone"
      ? "Clone & Open"
      : mode === "create"
        ? "Create & Open"
        : "Open Vault";

  return (
    <div className="vault-picker-shell">
      <div className="vault-picker-card">
        <section className="vault-picker-hero">
          <VaultMark />
          <div>
            <div className="workspace-kicker mb-3">
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: "var(--info)" }}
              />
              Local-first project memory
            </div>
            <h1 className="workspace-label text-3xl font-semibold tracking-tight">
              Open slateVault
            </h1>
            <p className="mt-2 text-sm leading-6" style={{ color: "var(--text-muted)" }}>
              Choose a shared markdown vault, create a new one, or clone a team
              repository to start working with docs and AI-ready context.
            </p>
          </div>
        </section>

        <section className="vault-picker-panel">
          <div className="vault-picker-tabs">
            {(["open", "create", "clone"] as const).map((nextMode) => (
              <button
                key={nextMode}
                onClick={() => setMode(nextMode)}
                className={mode === nextMode ? "active" : ""}
              >
                {nextMode === "open"
                  ? "Open Vault"
                  : nextMode === "create"
                    ? "Create Vault"
                    : "Clone Repo"}
              </button>
            ))}
          </div>

          <div className="vault-picker-form">
            {mode === "clone" && (
              <label className="vault-picker-field">
                <span>Repository URL</span>
                <input
                  type="text"
                  value={repoUrl}
                  onChange={(e) => {
                    setRepoUrl(e.target.value);
                    setCloneAuthAvailable(false);
                  }}
                  onKeyDown={(e) => e.key === "Enter" && void handleSubmit()}
                  placeholder="https://github.com/user/repo.git"
                />
              </label>
            )}

            <label className="vault-picker-field">
              <span>{mode === "clone" ? "Destination path" : "Vault path"}</span>
              <div className="vault-picker-path-row">
                <input
                  type="text"
                  value={path}
                  onChange={(e) => setPath(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && void handleSubmit()}
                  placeholder="Select a folder..."
                />
                <button onClick={handleBrowse} className="btn lg">
                  Browse
                </button>
              </div>
            </label>

            {mode === "create" && (
              <label className="vault-picker-field">
                <span>Vault name</span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && void handleSubmit()}
                  placeholder="my-vault"
                />
              </label>
            )}

            {error && <div className="vault-picker-error">{error}</div>}

            {mode === "clone" && cloneAuthAvailable && (
              <div className="rounded-lg border p-3 text-sm" style={{ borderColor: "var(--border)", background: "var(--bg-panel)" }}>
                <div className="font-medium" style={{ color: "var(--text)" }}>
                  Repository may need provider login.
                </div>
                <p className="mt-1 leading-5" style={{ color: "var(--text-muted)" }}>
                  SlateVault can open the git provider sign-in flow, then retry the clone.
                </p>
                <button
                  onClick={() => void handleConnectAndRetryClone()}
                  disabled={authLoading || loading}
                  className="btn primary sm mt-3"
                >
                  {authLoading ? "Connecting..." : "Connect provider and retry"}
                </button>
              </div>
            )}

            {mode === "clone" && !cloneAuthAvailable && isSshGitUrl(repoUrl) && (
              <div className="rounded-lg border p-3 text-sm" style={{ borderColor: "var(--border)", background: "var(--bg-panel)" }}>
                <div className="font-medium" style={{ color: "var(--text)" }}>
                  SSH clone URL detected.
                </div>
                <p className="mt-1 leading-5" style={{ color: "var(--text-muted)" }}>
                  Browser login works with HTTPS remotes. SlateVault can convert this URL before cloning.
                </p>
                <button
                  onClick={() => void handleUseHttpsCloneUrl()}
                  disabled={authLoading || loading}
                  className="btn sm mt-3"
                >
                  {authLoading ? "Converting..." : "Use HTTPS auth instead"}
                </button>
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={loading || authLoading || !path.trim() || (mode === "clone" && !repoUrl.trim())}
              className="btn primary lg vault-picker-submit"
            >
              {submitLabel}
            </button>
          </div>
        </section>

        <aside className="vault-picker-recents">
          <div>
            <h2>Recent Vaults</h2>
            <p>Jump back into a workspace you have opened on this machine.</p>
          </div>
          {recentVaults.length === 0 ? (
            <div className="vault-picker-empty">No recent vaults yet.</div>
          ) : (
            <div className="vault-picker-recent-list">
              {recentVaults.map((v) => (
                <div key={v.path} className="vault-picker-recent">
                  <button
                    onClick={() => handleOpen(v.path, v.name)}
                    disabled={loading}
                    className="vault-picker-recent-main"
                  >
                    <span className="vault-picker-recent-icon">V</span>
                    <span>
                      <strong>{v.name}</strong>
                      <small>{v.path}</small>
                    </span>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeRecentVault(v.path);
                      setRecentVaults(getRecentVaults());
                    }}
                    className="vault-picker-remove"
                    title="Remove from recent"
                    aria-label={`Remove ${v.name} from recent vaults`}
                  >
                    x
                  </button>
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
