import { create } from "zustand";
import type { FileStatus, CommitInfo, RemoteConfig, BranchInfo, FileDiff } from "@/types";
import * as commands from "@/lib/commands";

interface GitState {
  files: FileStatus[];
  commits: CommitInfo[];
  remoteConfig: RemoteConfig | null;
  commitMessage: string;
  loading: boolean;
  output: string | null;

  // Branch state
  branches: BranchInfo[];
  currentBranch: string;

  // Diff state
  activeDiff: FileDiff | null;

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

  // Branch actions
  loadBranches: () => Promise<void>;
  createBranch: (name: string) => Promise<void>;
  switchBranch: (name: string) => Promise<void>;
  deleteBranch: (name: string) => Promise<void>;

  // Diff actions
  loadFileDiff: (path: string, staged: boolean) => Promise<void>;
  clearDiff: () => void;
}

export const useGitStore = create<GitState>((set, get) => ({
  files: [],
  commits: [],
  remoteConfig: null,
  commitMessage: "",
  loading: false,
  output: null,
  branches: [],
  currentBranch: "main",
  activeDiff: null,

  setCommitMessage: (msg) => set({ commitMessage: msg }),
  clearOutput: () => set({ output: null }),
  clearDiff: () => set({ activeDiff: null }),

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

  // Branch actions

  loadBranches: async () => {
    try {
      const [branches, currentBranch] = await Promise.all([
        commands.gitListBranches(),
        commands.gitCurrentBranch(),
      ]);
      set({ branches, currentBranch });
    } catch (e) {
      console.error("load branches failed:", e);
    }
  },

  createBranch: async (name) => {
    try {
      await commands.gitCreateBranch(name);
      set({ output: `Branch '${name}' created` });
      await get().loadBranches();
    } catch (e) {
      set({ output: `Create branch failed: ${e}` });
    }
  },

  switchBranch: async (name) => {
    try {
      await commands.gitSwitchBranch(name);
      set({ output: `Switched to '${name}'` });
      await get().loadBranches();
      await get().loadStatus();
      await get().loadLog();
    } catch (e) {
      set({ output: `Switch branch failed: ${e}` });
    }
  },

  deleteBranch: async (name) => {
    try {
      await commands.gitDeleteBranch(name);
      set({ output: `Branch '${name}' deleted` });
      await get().loadBranches();
    } catch (e) {
      set({ output: `Delete branch failed: ${e}` });
    }
  },

  // Diff actions

  loadFileDiff: async (path, staged) => {
    try {
      const diff = await commands.gitDiffFile(path, staged);
      set({ activeDiff: diff });
    } catch (e) {
      console.error("diff failed:", e);
    }
  },
}));
