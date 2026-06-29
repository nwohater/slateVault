import { create } from "zustand";
import type { DocSyncRiskInfo, FrontMatter } from "@/types";
import * as commands from "@/lib/commands";
import { parseFrontMatter } from "@/lib/frontmatter";
import { useUIStore } from "@/stores/uiStore";
import { useGitStore } from "@/stores/gitStore";
import { useVaultStore } from "@/stores/vaultStore";


interface EditorState {
  activeProject: string | null;
  activePath: string | null;
  content: string;
  frontMatter: FrontMatter | null;
  activeDocSyncRisk: DocSyncRiskInfo | null;
  isCheckingRemote: boolean;
  isDirty: boolean;
  // Raw vault file mode (e.g. templates.json)
  rawFilePath: string | null;

  openDocument: (project: string, path: string) => Promise<void>;
  openVaultFile: (path: string) => Promise<void>;
  openWikiFile: (path: string) => Promise<void>;
  updateContent: (content: string) => void;
  saveDocument: () => Promise<void>;
  updateStatus: (status: string) => Promise<void>;
  closeDocument: () => void;
  setActiveProject: (project: string) => void;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  activeProject: null,
  activePath: null,
  content: "",
  frontMatter: null,
  activeDocSyncRisk: null,
  isCheckingRemote: false,
  isDirty: false,
  rawFilePath: null,

  openDocument: async (project: string, path: string) => {
    // Auto-save current document if dirty
    const state = get();
    if (state.isDirty && (state.activeProject || state.rawFilePath)) {
      await state.saveDocument();
    }

    const raw = await commands.readDocument(project, path);
    const { data } = parseFrontMatter(raw);
    useUIStore.getState().setShowOnboarding(false);
    useUIStore.getState().setWorkspaceView("documents");

    // Show the document immediately — don't wait for the remote check.
    set({
      activeProject: project,
      activePath: path,
      content: raw,
      frontMatter: data,
      activeDocSyncRisk: null,
      isCheckingRemote: true,
      isDirty: false,
      rawFilePath: null,
    });

    // Check sync risk against already-fetched remote state (fast, no network call).
    // The sync screen keeps remote state fresh via its own fetch on load.
    try {
      const risks = await commands.gitDocSyncRisks();
      const syncRisk = risks.find((r) => r.project === project && r.path === path) ?? null;
      // Guard against the user having switched to another doc while checking.
      if (get().activeProject === project && get().activePath === path) {
        set({ activeDocSyncRisk: syncRisk, isCheckingRemote: false });
      }
    } catch {
      if (get().activeProject === project && get().activePath === path) {
        set({ isCheckingRemote: false });
      }
    }
  },

  openVaultFile: async (path: string) => {
    const state = get();
    if (state.isDirty && (state.activeProject || state.rawFilePath)) {
      await state.saveDocument();
    }

    const raw = await commands.readVaultFile(path);
    // Pretty-print JSON files so they're human-readable in the editor
    let content = raw;
    if (path.endsWith(".json")) {
      try { content = JSON.stringify(JSON.parse(raw), null, 2); } catch { /* leave as-is if invalid */ }
    }
    useUIStore.getState().setShowOnboarding(false);
    useUIStore.getState().setWorkspaceView("documents");
    set({
      activeProject: null,
      activePath: path,
      content,
      frontMatter: null,
      activeDocSyncRisk: null,
      isDirty: false,
      rawFilePath: path,
    });
  },

  openWikiFile: async (path: string) => {
    const state = get();
    if (state.isDirty && (state.activeProject || state.rawFilePath)) {
      await state.saveDocument();
    }

    const vaultPath = `wiki/${path}`;
    const raw = await commands.readVaultFile(vaultPath);
    useUIStore.getState().setShowOnboarding(false);
    useUIStore.getState().setWorkspaceView("wiki");

    // Show the file immediately.
    set({
      activeProject: null,
      activePath: path,
      content: raw,
      frontMatter: null,
      activeDocSyncRisk: null,
      isCheckingRemote: true,
      isDirty: false,
      rawFilePath: vaultPath,
    });

    // Check sync risk against already-fetched remote state (fast, no network call).
    try {
      const risks = await commands.gitDocSyncRisks();
      const syncRisk = risks.find((r) => r.project === "wiki" && r.path === path) ?? null;
      if (get().activePath === path) {
        set({ activeDocSyncRisk: syncRisk, isCheckingRemote: false });
      }
    } catch {
      if (get().activePath === path) {
        set({ isCheckingRemote: false });
      }
    }
  },

  updateContent: (content: string) => {
    const { rawFilePath } = get();
    if (rawFilePath) {
      // Raw file mode — no frontmatter parsing
      set({ content, isDirty: true });
    } else {
      try {
        const { data } = parseFrontMatter(content);
        set({ content, frontMatter: data, isDirty: true });
      } catch {
        set({ content, isDirty: true });
      }
    }
  },

  saveDocument: async () => {
    const { activeProject, activePath, content, frontMatter, rawFilePath } = get();

    if (rawFilePath) {
      // Save raw vault file
      await commands.writeVaultFile(rawFilePath, content);
      set({ isDirty: false, activeDocSyncRisk: null });
      return;
    }

    if (!activeProject || !activePath || !frontMatter) return;

    const { content: body } = parseFrontMatter(content);
    await commands.writeDocument(
      activeProject,
      activePath,
      frontMatter.title,
      body,
      frontMatter.tags,
      undefined,
      frontMatter.canonical,
      frontMatter.protected,
      frontMatter.status,
    );
    set({ isDirty: false, activeDocSyncRisk: null });
    await useVaultStore.getState().loadDocuments(activeProject);
    await useGitStore.getState().loadStatus();
    await useGitStore.getState().loadDocSyncRisks();
  },

  updateStatus: async (status: string) => {
    const { activeProject, activePath, content, frontMatter } = get();
    if (!activeProject || !activePath || !frontMatter) return;
    const { content: body } = parseFrontMatter(content);
    await commands.writeDocument(
      activeProject,
      activePath,
      frontMatter.title,
      body,
      frontMatter.tags,
      undefined,
      frontMatter.canonical,
      frontMatter.protected,
      status,
    );
    // Update in-memory front matter so the bar re-renders immediately
    set({
      frontMatter: { ...frontMatter, status: status as "draft" | "review" | "final" },
      isDirty: false,
      activeDocSyncRisk: null,
    });
    await useVaultStore.getState().loadDocuments(activeProject);
    await useGitStore.getState().loadStatus();
    await useGitStore.getState().loadDocSyncRisks();
  },

  closeDocument: () => {
    set({
      activeProject: null,
      activePath: null,
      content: "",
      frontMatter: null,
      activeDocSyncRisk: null,
      isCheckingRemote: false,
      isDirty: false,
      rawFilePath: null,
    });
  },
  setActiveProject: (project: string) => {
    set({ activeProject: project, activePath: null, content: "", frontMatter: null, isDirty: false });
  },
}));
