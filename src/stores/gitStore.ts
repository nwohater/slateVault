import { create } from "zustand";
import type { FileStatus, CommitInfo, RemoteConfig } from "@/types";
import * as commands from "@/lib/commands";

interface GitState {
  files: FileStatus[];
  commits: CommitInfo[];
  remoteConfig: RemoteConfig | null;
  commitMessage: string;
  loading: boolean;
  output: string | null;

  setCommitMessage: (msg: string) => void;
  loadStatus: () => Promise<void>;
  stage: (path: string) => Promise<void>;
  unstage: (path: string) => Promise<void>;
  stageAll: () => Promise<void>;
  commit: () => Promise<void>;
  loadLog: () => Promise<void>;
  loadRemoteConfig: () => Promise<void>;
  setRemoteConfig: (config: Partial<RemoteConfig>) => Promise<void>;
  clearOutput: () => void;
}

export const useGitStore = create<GitState>((set, get) => ({
  files: [],
  commits: [],
  remoteConfig: null,
  commitMessage: "",
  loading: false,
  output: null,

  setCommitMessage: (msg) => set({ commitMessage: msg }),
  clearOutput: () => set({ output: null }),

  loadStatus: async () => {
    try {
      const files = await commands.gitStatus();
      set({ files });
    } catch (e) {
      console.error("git status failed:", e);
    }
  },

  stage: async (path) => {
    await commands.gitStage(path);
    await get().loadStatus();
  },

  unstage: async (path) => {
    await commands.gitUnstage(path);
    await get().loadStatus();
  },

  stageAll: async () => {
    const { files } = get();
    const unstaged = files.filter(
      (f) => !f.status.startsWith("staged_")
    );
    for (const f of unstaged) {
      await commands.gitStage(f.path);
    }
    await get().loadStatus();
  },

  commit: async () => {
    const { commitMessage } = get();
    if (!commitMessage.trim()) return;
    try {
      const result = await commands.gitCommit(commitMessage.trim());
      set({ commitMessage: "", output: result });
      await get().loadStatus();
      await get().loadLog();
    } catch (e) {
      set({ output: `Commit failed: ${e}` });
    }
  },

  loadLog: async () => {
    try {
      const commits = await commands.gitLog(50);
      set({ commits });
    } catch (e) {
      console.error("git log failed:", e);
    }
  },

  loadRemoteConfig: async () => {
    try {
      const remoteConfig = await commands.gitRemoteConfig();
      set({ remoteConfig });
    } catch (e) {
      console.error("git remote config failed:", e);
    }
  },

  setRemoteConfig: async (config) => {
    await commands.gitSetRemoteConfig({
      remote_url: config.remote_url ?? undefined,
      remote_branch: config.remote_branch,
      pull_on_open: config.pull_on_open,
      push_on_close: config.push_on_close,
    });
    await get().loadRemoteConfig();
  },
}));
