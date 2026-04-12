import { create } from "zustand";
import type { ProjectInfo, DocumentInfo, VaultStatsInfo } from "@/types";
import * as commands from "@/lib/commands";
import { useUIStore } from "@/stores/uiStore";

interface VaultState {
  isOpen: boolean;
  vaultPath: string | null;
  vaultName: string | null;
  projects: ProjectInfo[];
  documents: Record<string, DocumentInfo[]>;
  expandedProjects: Set<string>;
  stats: VaultStatsInfo | null;

  openVault: (path: string) => Promise<void>;
  createVault: (path: string, name: string) => Promise<void>;
  loadProjects: () => Promise<void>;
  loadDocuments: (project: string) => Promise<void>;
  loadStats: () => Promise<void>;
  closeVault: () => void;
  createProject: (
    name: string,
    description?: string,
    tags?: string[],
    template?: string
  ) => Promise<void>;
  deleteDocument: (project: string, path: string) => Promise<void>;
  deleteProject: (name: string) => Promise<void>;
  renameDocument: (project: string, oldPath: string, newPath: string) => Promise<void>;
  renameProject: (oldName: string, newName: string) => Promise<void>;
  toggleProject: (name: string) => void;
}

export const useVaultStore = create<VaultState>((set, get) => ({
  isOpen: false,
  vaultPath: null,
  vaultName: null,
  projects: [],
  documents: {},
  expandedProjects: new Set(),
  stats: null,

  openVault: async (path: string) => {
    const result = await commands.openVault(path);
    const name = result.replace("Opened vault '", "").replace("'", "");
    set({ isOpen: true, vaultPath: path, vaultName: name });
    useUIStore.getState().setWorkspaceView("home");
    useUIStore.getState().setShowOnboarding(false);

    // Rebuild search index on open
    try {
      await commands.rebuildIndex();
    } catch (e) {
      console.error("Index rebuild failed:", e);
    }

    await get().loadProjects();
    await get().loadStats();

    // Auto-start MCP server for this vault
    try {
      const stats = get().stats;
      if (stats?.mcp_enabled) {
        await commands.startMcpServer(path, stats.mcp_port);
      }
    } catch (e) {
      console.error("MCP server start failed:", e);
    }
  },

  closeVault: () => {
    // Stop MCP server
    commands.stopMcpServer().catch(() => {});
    useUIStore.getState().setWorkspaceView("home");
    useUIStore.getState().setShowOnboarding(false);
    set({
      isOpen: false,
      vaultPath: null,
      vaultName: null,
      projects: [],
      documents: {},
      expandedProjects: new Set(),
      stats: null,
    });
  },

  createVault: async (path: string, name: string) => {
    await commands.createVault(path, name);
    await get().openVault(path);
  },

  loadProjects: async () => {
    const projects = await commands.listProjects();
    set({ projects });
  },

  loadDocuments: async (project: string) => {
    const docs = await commands.listDocuments(project);
    set((state) => ({
      documents: { ...state.documents, [project]: docs },
    }));
  },

  loadStats: async () => {
    try {
      const stats = await commands.vaultStats();
      set({ stats });
    } catch {
      // ignore
    }
  },

  createProject: async (name, description, tags, template) => {
    await commands.createProject(name, description, tags, template);
    await get().loadProjects();
    await get().loadStats();
  },

  deleteDocument: async (project, path) => {
    await commands.deleteDocument(project, path);
    await get().loadDocuments(project);
    await get().loadStats();
  },

  deleteProject: async (name) => {
    await commands.deleteProject(name);
    set((s) => {
      const docs = { ...s.documents };
      delete docs[name];
      const expanded = new Set(s.expandedProjects);
      expanded.delete(name);
      return { documents: docs, expandedProjects: expanded };
    });
    await get().loadProjects();
    await get().loadStats();
  },

  renameDocument: async (project, oldPath, newPath) => {
    await commands.renameDocument(project, oldPath, newPath);
    await get().loadDocuments(project);
  },

  renameProject: async (oldName, newName) => {
    await commands.renameProject(oldName, newName);
    set((s) => {
      const docs = { ...s.documents };
      delete docs[oldName];
      const expanded = new Set(s.expandedProjects);
      if (expanded.delete(oldName)) expanded.add(newName);
      return { documents: docs, expandedProjects: expanded };
    });
    await get().loadProjects();
  },

  toggleProject: (name: string) => {
    set((state) => {
      const next = new Set(state.expandedProjects);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
        get().loadDocuments(name);
      }
      return { expandedProjects: next };
    });
  },
}));
