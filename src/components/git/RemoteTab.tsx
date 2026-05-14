"use client";

import { useEffect, useState } from "react";
import { useGitStore } from "@/stores/gitStore";

export function RemoteTab() {
  const remoteConfig = useGitStore((s) => s.remoteConfig);
  const loadRemoteConfig = useGitStore((s) => s.loadRemoteConfig);
  const setRemoteConfig = useGitStore((s) => s.setRemoteConfig);
  const pushRemote = useGitStore((s) => s.push);
  const pullRemote = useGitStore((s) => s.pull);
  const pullWithStash = useGitStore((s) => s.pullWithStash);

  const [url, setUrl] = useState("");
  const [branch, setBranch] = useState("main");
  const [output, setOutput] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    loadRemoteConfig();
  }, [loadRemoteConfig]);

  useEffect(() => {
    if (remoteConfig) {
      setUrl(remoteConfig.remote_url || "");
      setBranch(remoteConfig.remote_branch || "main");
    }
  }, [remoteConfig]);

  const saveConfig = async () => {
    try {
      await setRemoteConfig({
        remote_url: url || undefined,
        remote_branch: branch || "main",
      });
      setOutput("Config saved");
    } catch (e) {
      setOutput(`Save failed: ${e}`);
    }
  };

  const push = async () => {
    setRunning(true);
    setOutput("Pushing...");
    try {
      const result = await pushRemote();
      setOutput(result || "Pushed successfully");
    } catch (e) {
      setOutput(String(e));
    } finally {
      setRunning(false);
    }
  };

  const pull = async () => {
    setRunning(true);
    setOutput("Pulling...");
    try {
      const result = await pullRemote();
      setOutput(result || "Pulled successfully");
    } catch (e) {
      setOutput(String(e));
    } finally {
      setRunning(false);
    }
  };

  const safePull = async () => {
    setRunning(true);
    setOutput("Stashing local changes and pulling...");
    try {
      const result = await pullWithStash();
      setOutput(result || "Pulled successfully");
    } catch (e) {
      setOutput(String(e));
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="flex flex-col h-full text-xs p-2 space-y-3">
      <div>
        <label className="block text-neutral-500 mb-1">Remote URL</label>
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://github.com/user/repo.git"
          className="w-full px-2 py-1 bg-neutral-800 border border-neutral-700 rounded text-neutral-200 placeholder-neutral-500 outline-none focus:[border-color:var(--accent)]"
        />
      </div>

      <div>
        <label className="block text-neutral-500 mb-1">Branch</label>
        <input
          type="text"
          value={branch}
          onChange={(e) => setBranch(e.target.value)}
          className="w-full px-2 py-1 bg-neutral-800 border border-neutral-700 rounded text-neutral-200 outline-none focus:[border-color:var(--accent)]"
        />
      </div>

      <button
        onClick={saveConfig}
        className="w-full px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300"
      >
        Save Config
      </button>

      <div className="flex gap-1">
        <button
          onClick={pull}
          disabled={running || !url}
          className="flex-1 px-2 py-1.5 rounded bg-neutral-800 hover:bg-neutral-700 disabled:text-neutral-600 text-neutral-300"
        >
          Pull
        </button>
        <button
          onClick={safePull}
          disabled={running || !url}
          className="flex-1 px-2 py-1.5 rounded bg-amber-800 hover:bg-amber-700 disabled:bg-neutral-800 disabled:text-neutral-500 text-amber-100"
        >
          Safe Pull
        </button>
        <button
          onClick={push}
          disabled={running || !url}
          className="flex-1 px-2 py-1.5 rounded disabled:bg-neutral-800 disabled:text-neutral-500 text-white"
          style={{ background: "var(--accent)" }}
        >
          Push
        </button>
      </div>

      {remoteConfig && (
        <div className="space-y-1 pt-1 border-t border-neutral-800">
          <label className="flex items-center gap-2 text-neutral-400">
            <input
              type="checkbox"
              checked={remoteConfig.pull_on_open}
              onChange={(e) =>
                setRemoteConfig({ pull_on_open: e.target.checked })
              }
              className="rounded"
            />
            Pull on open
          </label>
          <label className="flex items-center gap-2 text-neutral-400">
            <input
              type="checkbox"
              checked={remoteConfig.push_on_close}
              onChange={(e) =>
                setRemoteConfig({ push_on_close: e.target.checked })
              }
              className="rounded"
            />
            Push on close
          </label>
        </div>
      )}

      {output && (
        <pre className="p-2 bg-neutral-900 rounded text-neutral-400 whitespace-pre-wrap break-all max-h-32 overflow-y-auto">
          {output}
        </pre>
      )}
    </div>
  );
}
