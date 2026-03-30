import { create } from "zustand";

type ActiveView = "editor" | "search";

interface UIState {
  sidebarWidth: number;
  showPreview: boolean;
  previewRatio: number;
  activeView: ActiveView;
  showTerminal: boolean;
  terminalHeight: number;

  setSidebarWidth: (width: number) => void;
  togglePreview: () => void;
  setPreviewRatio: (ratio: number) => void;
  setActiveView: (view: ActiveView) => void;
  toggleTerminal: () => void;
  setTerminalHeight: (height: number) => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarWidth: 260,
  showPreview: true,
  previewRatio: 0.5,
  activeView: "editor",
  showTerminal: false,
  terminalHeight: 200,

  setSidebarWidth: (width: number) =>
    set({ sidebarWidth: Math.max(180, Math.min(500, width)) }),

  togglePreview: () => set((s) => ({ showPreview: !s.showPreview })),

  setPreviewRatio: (ratio: number) =>
    set({ previewRatio: Math.max(0.2, Math.min(0.8, ratio)) }),

  setActiveView: (view) => set({ activeView: view }),

  toggleTerminal: () => set((s) => ({ showTerminal: !s.showTerminal })),

  setTerminalHeight: (height: number) =>
    set({ terminalHeight: Math.max(100, Math.min(600, height)) }),
}));
