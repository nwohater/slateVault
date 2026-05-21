import { create } from "zustand";
import type {
  FileStatus,
  CommitInfo,
  RemoteConfig,
  BranchInfo,
  DocSyncRiskInfo,
  FileDiff,
  SyncStatusInfo,
  GitConflictInfo,
} from "@/types";
import * as commands from "@/lib/commands";

export type SyncHealthLevel = "neutral" | "good" | "warning" | "attention";

export interface SyncHealth {
  level: SyncHealthLevel;
  label: string;
  detail: string;
  recommendedAction: "configure-remote" | "pull" | "commit" | "push" | "review" | "none";
}

interface GitState {
  files: FileStatus[];
  commits: CommitInfo[];
  remoteConfig: RemoteConfig | null;
  syncStatus: SyncStatusInfo | null;
  syncHealth: SyncHealth | null;
  docSyncRisks: DocSyncRiskInfo[];
  conflictFiles: GitConflictInfo[];
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
  push: () => Promise<string>;
  pull: () => Promise<string>;
  updateSafely: () => Promise<string>;
  pullWithStash: () => Promise<string>;
  pullDiscardLocal: () => Promise<string>;
  fetchRemote: () => Promise<string>;
  loadConflictFiles: () => Promise<void>;
  resolveConflictFile: (path: string, resolution: "keep_both" | "use_shared" | "use_local") => Promise<string>;
  continueUpdate: () => Promise<string>;
  loadLog: () => Promise<void>;
  loadRemoteConfig: () => Promise<void>;
  loadSyncStatus: () => Promise<void>;
  loadDocSyncRisks: () => Promise<void>;
  refreshSyncState: () => Promise<void>;
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

function deriveSyncHealth(
  syncStatus: SyncStatusInfo | null,
  files: FileStatus[],
  remoteConfig: RemoteConfig | null
): SyncHealth {
  const hasRemote = Boolean(remoteConfig?.remote_url) && Boolean(syncStatus?.has_remote);
  const stagedCount = files.filter((file) => file.status.startsWith("staged_")).length;
  const hasLocalChanges = files.length > 0;

  if (!hasRemote) {
    return {
      level: "neutral",
      label: "Remote not configured",
      detail: "Connect a remote when you are ready to share this vault with a team or another machine.",
      recommendedAction: "configure-remote",
    };
  }

  if (syncStatus?.diverged) {
    return {
      level: "attention",
      label: "Local and remote history diverged",
      detail: "Pull and review before pushing more documentation changes so the shared vault stays clean.",
      recommendedAction: "pull",
    };
  }

  if ((syncStatus?.behind ?? 0) > 0 && hasLocalChanges) {
    return {
      level: "attention",
      label: "Remote has newer changes",
      detail: "You have local documentation edits and the shared vault is ahead. Pull and review before you push.",
      recommendedAction: "pull",
    };
  }

  if ((syncStatus?.behind ?? 0) > 0) {
    return {
      level: "warning",
      label: "Pull before editing further",
      detail: "The shared vault has newer changes. Update locally so you do not start from stale project memory.",
      recommendedAction: "pull",
    };
  }

  if (stagedCount > 0) {
    return {
      level: "warning",
      label: "Ready to commit",
      detail: "You already have staged documentation changes. Commit them when this change set is ready.",
      recommendedAction: "commit",
    };
  }

  if ((syncStatus?.ahead ?? 0) > 0) {
    return {
      level: "warning",
      label: "Ready to push",
      detail: "Your local vault is ahead of the shared branch. Push when you are ready to share the latest docs.",
      recommendedAction: "push",
    };
  }

  if (hasLocalChanges) {
    return {
      level: "warning",
      label: "Local changes in progress",
      detail: "You have unstaged documentation edits. Review and stage them when the change set is coherent.",
      recommendedAction: "review",
    };
  }

  return {
    level: "good",
    label: "Up to date with shared vault",
    detail: "No pending local changes and no newer remote history detected.",
    recommendedAction: "none",
  };
}

export const useGitStore = create<GitState>((set, get) => ({
  files: [],
  commits: [],
  remoteConfig: null,
  syncStatus: null,
  syncHealth: null,
  docSyncRisks: [],
  conflictFiles: [],
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
      set((state) => ({
        files,
        syncHealth: deriveSyncHealth(state.syncStatus, files, state.remoteConfig),
      }));
    } catch (e) {
      console.error("git status failed:", e);
    }
  },

  loadSyncStatus: async () => {
    try {
      const syncStatus = await commands.gitSyncStatus();
      set((state) => ({
        syncStatus,
        syncHealth: deriveSyncHealth(syncStatus, state.files, state.remoteConfig),
      }));
    } catch (e) {
      console.error("git sync status failed:", e);
    }
  },

  loadDocSyncRisks: async () => {
    try {
      const docSyncRisks = await commands.gitDocSyncRisks();
      set({ docSyncRisks });
    } catch (e) {
      console.error("git doc sync risks failed:", e);
      set({ docSyncRisks: [] });
    }
  },

  loadConflictFiles: async () => {
    try {
      const conflictFiles = await commands.gitConflictFiles();
      set({ conflictFiles });
    } catch (e) {
      console.error("git conflict files failed:", e);
      set({ conflictFiles: [] });
    }
  },

  refreshSyncState: async () => {
    await Promise.all([
      get().loadStatus(),
      get().loadLog(),
      get().loadBranches(),
      get().loadRemoteConfig(),
      get().loadSyncStatus(),
      get().loadDocSyncRisks(),
      get().loadConflictFiles(),
    ]);
  },

  fetchRemote: async () => {
    try {
      const result = await commands.gitFetchRemote();
      set({ output: result || "Fetched latest remote state" });
      await get().refreshSyncState();
      return result;
    } catch (e) {
      const message = `Fetch failed: ${e}`;
      set({ output: message });
      throw e;
    }
  },

  stage: async (path) => {
    await commands.gitStage(path);
    await get().loadStatus();
    await get().loadDocSyncRisks();
  },

  unstage: async (path) => {
    await commands.gitUnstage(path);
    await get().loadStatus();
    await get().loadDocSyncRisks();
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
    await get().loadDocSyncRisks();
  },

  commit: async () => {
    const { commitMessage } = get();
    if (!commitMessage.trim()) return;
    try {
      const result = await commands.gitCommit(commitMessage.trim());
      set({ commitMessage: "", output: result });
      await get().refreshSyncState();
    } catch (e) {
      set({ output: `Commit failed: ${e}` });
    }
  },

  push: async () => {
    try {
      const result = await commands.gitPush();
      set({ output: result || "Pushed successfully" });
      await get().refreshSyncState();
      return result;
    } catch (e) {
      const message = `Push failed: ${e}`;
      set({ output: message });
      throw e;
    }
  },

  pull: async () => {
    try {
      const result = await commands.gitPull();
      set({ output: result || "Pulled successfully" });
      await get().refreshSyncState();
      return result;
    } catch (e) {
      const message = `Pull failed: ${e}`;
      set({ output: message });
      throw e;
    }
  },

  updateSafely: async () => {
    try {
      const result = await commands.gitUpdateSafely();
      set({ output: result || "Updated safely" });
      await get().refreshSyncState();
      return result;
    } catch (e) {
      const message = `Safe update paused: ${e}`;
      set({ output: message });
      await get().refreshSyncState();
      throw e;
    }
  },

  pullWithStash: async () => {
    try {
      const result = await commands.gitPullWithStash();
      set({ output: result || "Pulled successfully" });
      await get().refreshSyncState();
      return result;
    } catch (e) {
      const message = `Safe pull failed: ${e}`;
      set({ output: message });
      throw e;
    }
  },

  pullDiscardLocal: async () => {
    try {
      const result = await commands.gitPullDiscardLocal();
      set({ output: result || "Local changes discarded and latest remote loaded" });
      await get().refreshSyncState();
      return result;
    } catch (e) {
      const message = `Discard local and pull failed: ${e}`;
      set({ output: message });
      throw e;
    }
  },

  resolveConflictFile: async (path, resolution) => {
    try {
      const result = await commands.gitResolveConflictFile(path, resolution);
      set({ output: result || `Resolved ${path}` });
      await get().refreshSyncState();
      return result;
    } catch (e) {
      const message = `Resolve conflict failed: ${e}`;
      set({ output: message });
      throw e;
    }
  },

  continueUpdate: async () => {
    try {
      const result = await commands.gitContinueUpdate();
      set({ output: result || "Update continued" });
      await get().refreshSyncState();
      return result;
    } catch (e) {
      const message = `Continue update failed: ${e}`;
      set({ output: message });
      await get().refreshSyncState();
      throw e;
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
      set((state) => ({
        remoteConfig,
        syncHealth: deriveSyncHealth(state.syncStatus, state.files, remoteConfig),
      }));
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
    await get().loadSyncStatus();
    await get().loadDocSyncRisks();
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
      await get().refreshSyncState();
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
