import { create } from "zustand";
import type { FrontMatter } from "@/types";
import * as commands from "@/lib/commands";
import { parseFrontMatter } from "@/lib/frontmatter";
import { useUIStore } from "@/stores/uiStore";

interface EditorState {
  activeProject: string | null;
  activePath: string | null;
  content: string;
  frontMatter: FrontMatter | null;
  isDirty: boolean;
  // Raw vault file mode (e.g. templates.json)
  rawFilePath: string | null;

  openDocument: (project: string, path: string) => Promise<void>;
  openVaultFile: (path: string) => Promise<void>;
  updateContent: (content: string) => void;
  saveDocument: () => Promise<void>;
  closeDocument: () => void;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  activeProject: null,
  activePath: null,
  content: "",
  frontMatter: null,
  isDirty: false,
  rawFilePath: null,

  openDocument: async (project: string, path: string) => {
    // Auto-save current document if dirty
    const state = get();
    if (state.isDirty && (state.activeProject || state.rawFilePath)) {
      await state.saveDocument();
    }

    const raw = await commands.readDocument(project, path);
    const { data, content } = parseFrontMatter(raw);
    useUIStore.getState().setShowOnboarding(false);
    useUIStore.getState().setWorkspaceView("documents");
    set({
      activeProject: project,
      activePath: path,
      content: raw,
      frontMatter: data,
      isDirty: false,
      rawFilePath: null,
    });
  },

  openVaultFile: async (path: string) => {
    const state = get();
    if (state.isDirty && (state.activeProject || state.rawFilePath)) {
      await state.saveDocument();
    }

    const content = await commands.readVaultFile(path);
    useUIStore.getState().setShowOnboarding(false);
    useUIStore.getState().setWorkspaceView("documents");
    set({
      activeProject: null,
      activePath: path,
      content,
      frontMatter: null,
      isDirty: false,
      rawFilePath: path,
    });
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
      set({ isDirty: false });
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
      frontMatter.protected
    );
    set({ isDirty: false });
  },

  closeDocument: () => {
    set({
      activeProject: null,
      activePath: null,
      content: "",
      frontMatter: null,
      isDirty: false,
      rawFilePath: null,
    });
  },
}));
