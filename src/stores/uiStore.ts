import { create } from "zustand";

type ActiveView = "editor" | "search";
export type Theme = "dark" | "light" | "olive" | "deepblue";

interface UIState {
  sidebarWidth: number;
  showEditor: boolean;
  showPreview: boolean;
  previewRatio: number;
  activeView: ActiveView;
  showTerminal: boolean;
  terminalHeight: number;
  theme: Theme;

  setSidebarWidth: (width: number | ((prev: number) => number)) => void;
  toggleEditor: () => void;
  togglePreview: () => void;
  setPreviewRatio: (ratio: number | ((prev: number) => number)) => void;
  setActiveView: (view: ActiveView) => void;
  toggleTerminal: () => void;
  setTerminalHeight: (height: number | ((prev: number) => number)) => void;
  setTheme: (theme: Theme) => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarWidth: 340,
  showEditor: true,
  showPreview: true,
  previewRatio: 0.5,
  activeView: "editor",
  showTerminal: false,
  terminalHeight: 200,
  theme: "dark",

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

  setPreviewRatio: (ratio: number | ((prev: number) => number)) =>
    set((s) => {
      const next = typeof ratio === "function" ? ratio(s.previewRatio) : ratio;
      return { previewRatio: Math.max(0.2, Math.min(0.8, next)) };
    }),

  setActiveView: (view) => set({ activeView: view }),

  toggleTerminal: () => set((s) => ({ showTerminal: !s.showTerminal })),

  setTerminalHeight: (height: number | ((prev: number) => number)) =>
    set((s) => {
      const next = typeof height === "function" ? height(s.terminalHeight) : height;
      return { terminalHeight: Math.max(100, Math.min(600, next)) };
    }),

  setTheme: (theme: Theme) => {
    if (typeof document !== "undefined") {
      if (theme === "dark") {
        document.documentElement.removeAttribute("data-theme");
      } else {
        document.documentElement.setAttribute("data-theme", theme);
      }
    }
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("sv-theme", theme);
    }
    set({ theme });
  },
}));
