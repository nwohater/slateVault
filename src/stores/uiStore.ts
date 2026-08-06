import { create } from "zustand";

type ActiveView = "editor" | "search";
export type WorkspaceView =
  | "home"
  | "documents"
  | "search"
  | "wiki"
  | "start-session"
  | "docs-health"
  | "sync"
  | "settings";
export type Theme = "dark" | "light";
export type EditorMode = "editor" | "split" | "preview";
export type Density = "comfortable" | "compact";

export const DEFAULT_EDITOR_MODE_STORAGE_KEY = "sv-default-editor-mode";
export const THEME_STORAGE_KEY = "sv-theme";
export const DENSITY_STORAGE_KEY = "sv-density";

export function isEditorMode(value: string | null): value is EditorMode {
  return value === "editor" || value === "split" || value === "preview";
}

export function isDensity(value: string | null): value is Density {
  return value === "comfortable" || value === "compact";
}

interface UIState {
  sidebarWidth: number;
  showEditor: boolean;
  showPreview: boolean;
  previewRatio: number;
  activeView: ActiveView;
  workspaceView: WorkspaceView;
  showOnboarding: boolean;
  showTerminal: boolean;
  terminalHeight: number;
  theme: Theme;
  defaultEditorMode: EditorMode;
  density: Density;

  setSidebarWidth: (width: number | ((prev: number) => number)) => void;
  toggleEditor: () => void;
  togglePreview: () => void;
  setEditorMode: (mode: EditorMode) => void;
  setDefaultEditorMode: (mode: EditorMode) => void;
  setPreviewRatio: (ratio: number | ((prev: number) => number)) => void;
  setActiveView: (view: ActiveView) => void;
  setWorkspaceView: (view: WorkspaceView) => void;
  setShowOnboarding: (show: boolean) => void;
  toggleTerminal: () => void;
  setTerminalHeight: (height: number | ((prev: number) => number)) => void;
  setTheme: (theme: Theme) => void;
  setDensity: (density: Density) => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarWidth: 340,
  showEditor: true,
  showPreview: true,
  previewRatio: 0.5,
  activeView: "editor",
  workspaceView: "documents",
  showOnboarding: false,
  showTerminal: false,
  terminalHeight: 200,
  theme: "light",
  defaultEditorMode: "split",
  density: "comfortable",

  setSidebarWidth: (width: number | ((prev: number) => number)) =>
    set((s) => {
      const next = typeof width === "function" ? width(s.sidebarWidth) : width;
      return { sidebarWidth: Math.max(180, Math.min(500, next)) };
    }),

  toggleEditor: () =>
    set((s) => ({
      showEditor: !s.showEditor,
      showPreview: !s.showEditor ? s.showPreview : true,
    })),

  togglePreview: () =>
    set((s) => ({
      showPreview: !s.showPreview,
      showEditor: !s.showPreview ? s.showEditor : true,
    })),

  setEditorMode: (mode) =>
    set(() => {
      if (mode === "editor") return { showEditor: true, showPreview: false };
      if (mode === "preview") return { showEditor: false, showPreview: true };
      return { showEditor: true, showPreview: true };
    }),

  setDefaultEditorMode: (mode) => {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(DEFAULT_EDITOR_MODE_STORAGE_KEY, mode);
    }
    set({ defaultEditorMode: mode });
  },

  setPreviewRatio: (ratio: number | ((prev: number) => number)) =>
    set((s) => {
      const next = typeof ratio === "function" ? ratio(s.previewRatio) : ratio;
      return { previewRatio: Math.max(0.2, Math.min(0.8, next)) };
    }),

  setActiveView: (view) => set({ activeView: view }),

  setWorkspaceView: (view) =>
    set({
      workspaceView: view,
      activeView: view === "search" ? "search" : "editor",
    }),

  setShowOnboarding: (show) => set({ showOnboarding: show }),

  toggleTerminal: () => set((s) => ({ showTerminal: !s.showTerminal })),

  setTerminalHeight: (height: number | ((prev: number) => number)) =>
    set((s) => {
      const next = typeof height === "function" ? height(s.terminalHeight) : height;
      return { terminalHeight: Math.max(100, Math.min(600, next)) };
    }),

  setTheme: (theme: Theme) => {
    if (typeof document !== "undefined") {
      if (theme === "light") {
        document.documentElement.removeAttribute("data-theme");
      } else {
        document.documentElement.setAttribute("data-theme", theme);
      }
    }
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    }
    set({ theme });
  },

  setDensity: (density: Density) => {
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-density", density);
    }
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(DENSITY_STORAGE_KEY, density);
    }
    set({ density });
  },
}));
