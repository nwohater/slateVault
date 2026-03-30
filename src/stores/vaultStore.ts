import { create } from "zustand";
import type { ProjectInfo, DocumentInfo, VaultStatsInfo } from "@/types";
import * as commands from "@/lib/commands";

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
    tags?: string[]
  ) => Promise<void>;
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

    // Rebuild search index on open
    try {
      await commands.rebuildIndex();
    } catch (e) {
      console.error("Index rebuild failed:", e);
    }

    await get().loadProjects();
    await get().loadStats();
  },

  closeVault: () => {
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

  createProject: async (name, description, tags) => {
    await commands.createProject(name, description, tags);
    await get().loadProjects();
    await get().loadStats();
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
