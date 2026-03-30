import { create } from "zustand";

type ActiveView = "editor" | "search";

interface UIState {
  sidebarWidth: number;
  showPreview: boolean;
  previewRatio: number;
  activeView: ActiveView;

  setSidebarWidth: (width: number) => void;
  togglePreview: () => void;
  setPreviewRatio: (ratio: number) => void;
  setActiveView: (view: ActiveView) => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarWidth: 260,
  showPreview: true,
  previewRatio: 0.5,
  activeView: "editor",

  setSidebarWidth: (width: number) =>
    set({ sidebarWidth: Math.max(180, Math.min(500, width)) }),

  togglePreview: () => set((s) => ({ showPreview: !s.showPreview })),

  setPreviewRatio: (ratio: number) =>
    set({ previewRatio: Math.max(0.2, Math.min(0.8, ratio)) }),

  setActiveView: (view) => set({ activeView: view }),
}));
