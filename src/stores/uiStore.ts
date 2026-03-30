import { create } from "zustand";

interface UIState {
  sidebarWidth: number;
  showPreview: boolean;
  previewRatio: number; // 0-1, portion of main area for editor

  setSidebarWidth: (width: number) => void;
  togglePreview: () => void;
  setPreviewRatio: (ratio: number) => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarWidth: 260,
  showPreview: true,
  previewRatio: 0.5,

  setSidebarWidth: (width: number) =>
    set({ sidebarWidth: Math.max(180, Math.min(500, width)) }),

  togglePreview: () => set((s) => ({ showPreview: !s.showPreview })),

  setPreviewRatio: (ratio: number) =>
    set({ previewRatio: Math.max(0.2, Math.min(0.8, ratio)) }),
}));
