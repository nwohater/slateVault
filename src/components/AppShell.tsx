"use client";

import { useEffect } from "react";
import { useVaultStore } from "@/stores/vaultStore";
import { useUIStore } from "@/stores/uiStore";
import { useEditorStore } from "@/stores/editorStore";
import { Sidebar } from "./sidebar/Sidebar";
import { EditorPane } from "./editor/EditorPane";
import { MarkdownPreview } from "./preview/MarkdownPreview";
import { SearchView } from "./search/SearchView";
import { VaultPicker } from "./vault/VaultPicker";
import { ResizeHandle } from "./shared/ResizeHandle";

export function AppShell() {
  const isOpen = useVaultStore((s) => s.isOpen);
  const sidebarWidth = useUIStore((s) => s.sidebarWidth);
  const showPreview = useUIStore((s) => s.showPreview);
  const previewRatio = useUIStore((s) => s.previewRatio);
  const activeView = useUIStore((s) => s.activeView);
  const setSidebarWidth = useUIStore((s) => s.setSidebarWidth);
  const setPreviewRatio = useUIStore((s) => s.setPreviewRatio);
  const togglePreview = useUIStore((s) => s.togglePreview);
  const setActiveView = useUIStore((s) => s.setActiveView);
  const isDirty = useEditorStore((s) => s.isDirty);
  const saveDocument = useEditorStore((s) => s.saveDocument);

  // Ctrl+Shift+F to toggle search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === "F") {
        e.preventDefault();
        setActiveView(activeView === "search" ? "editor" : "search");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [activeView, setActiveView]);

  if (!isOpen) {
    return <VaultPicker />;
  }

  const editorFlex = showPreview ? previewRatio : 1;
  const previewFlex = showPreview ? 1 - previewRatio : 0;

  return (
    <div className="flex h-screen overflow-hidden bg-neutral-950">
      {/* Sidebar */}
      <div style={{ width: sidebarWidth }} className="flex-shrink-0">
        <Sidebar />
      </div>

      <ResizeHandle
        direction="vertical"
        onResize={(delta) => setSidebarWidth(sidebarWidth + delta)}
      />

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Toolbar */}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-neutral-900 border-b border-neutral-800 text-xs">
          <button
            onClick={() =>
              setActiveView(activeView === "search" ? "editor" : "search")
            }
            className={`px-2 py-0.5 rounded transition-colors ${
              activeView === "search"
                ? "bg-blue-700 text-white"
                : "bg-neutral-800 hover:bg-neutral-700 text-neutral-300"
            }`}
          >
            Search
          </button>
          {activeView === "editor" && (
            <button
              onClick={togglePreview}
              className="px-2 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300"
            >
              {showPreview ? "Hide Preview" : "Show Preview"}
            </button>
          )}
          {isDirty && (
            <button
              onClick={saveDocument}
              className="px-2 py-0.5 rounded bg-blue-700 hover:bg-blue-600 text-white"
            >
              Save
            </button>
          )}
          <div className="flex-1" />
          <kbd className="text-neutral-500">Ctrl+Shift+F search</kbd>
        </div>

        {/* Main content */}
        {activeView === "search" ? (
          <SearchView />
        ) : (
          <div className="flex-1 flex min-h-0">
            <div style={{ flex: editorFlex }} className="min-w-0">
              <EditorPane />
            </div>

            {showPreview && (
              <>
                <ResizeHandle
                  direction="vertical"
                  onResize={(delta) => {
                    const mainWidth =
                      window.innerWidth - sidebarWidth - 4;
                    setPreviewRatio(
                      previewRatio + delta / mainWidth
                    );
                  }}
                />
                <div style={{ flex: previewFlex }} className="min-w-0">
                  <MarkdownPreview />
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
