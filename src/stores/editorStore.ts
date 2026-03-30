import { create } from "zustand";
import type { FrontMatter } from "@/types";
import * as commands from "@/lib/commands";
import { parseFrontMatter } from "@/lib/frontmatter";

interface EditorState {
  activeProject: string | null;
  activePath: string | null;
  content: string;
  frontMatter: FrontMatter | null;
  isDirty: boolean;

  openDocument: (project: string, path: string) => Promise<void>;
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

  openDocument: async (project: string, path: string) => {
    // Auto-save current document if dirty
    const state = get();
    if (state.isDirty && state.activeProject && state.activePath) {
      await state.saveDocument();
    }

    const raw = await commands.readDocument(project, path);
    const { data, content } = parseFrontMatter(raw);
    set({
      activeProject: project,
      activePath: path,
      content: raw,
      frontMatter: data,
      isDirty: false,
    });
  },

  updateContent: (content: string) => {
    try {
      const { data } = parseFrontMatter(content);
      set({ content, frontMatter: data, isDirty: true });
    } catch {
      set({ content, isDirty: true });
    }
  },

  saveDocument: async () => {
    const { activeProject, activePath, content, frontMatter } = get();
    if (!activeProject || !activePath || !frontMatter) return;

    const { content: body } = parseFrontMatter(content);
    await commands.writeDocument(
      activeProject,
      activePath,
      frontMatter.title,
      body,
      frontMatter.tags
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
    });
  },
}));
