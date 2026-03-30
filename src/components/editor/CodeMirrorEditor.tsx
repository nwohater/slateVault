"use client";

import { useEffect, useRef } from "react";
import { EditorView, keymap } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { oneDark } from "@codemirror/theme-one-dark";
import { useEditorStore } from "@/stores/editorStore";

export function CodeMirrorEditor() {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const content = useEditorStore((s) => s.content);
  const updateContent = useEditorStore((s) => s.updateContent);
  const saveDocument = useEditorStore((s) => s.saveDocument);
  const activeProject = useEditorStore((s) => s.activeProject);
  const activePath = useEditorStore((s) => s.activePath);

  // Track which document the view was created for
  const docKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const currentKey = `${activeProject}:${activePath}`;

    // If same document, just update content if it changed externally
    if (viewRef.current && docKeyRef.current === currentKey) {
      return;
    }

    // Destroy previous view
    if (viewRef.current) {
      viewRef.current.destroy();
      viewRef.current = null;
    }

    docKeyRef.current = currentKey;

    const view = new EditorView({
      parent: containerRef.current,
      state: EditorState.create({
        doc: content,
        extensions: [
          markdown({ base: markdownLanguage, codeLanguages: languages }),
          oneDark,
          history(),
          keymap.of([
            ...defaultKeymap,
            ...historyKeymap,
            {
              key: "Mod-s",
              run: () => {
                saveDocument();
                return true;
              },
            },
          ]),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              updateContent(update.state.doc.toString());
            }
          }),
          EditorView.theme({
            "&": {
              height: "100%",
              fontSize: "13px",
            },
            ".cm-scroller": {
              overflow: "auto",
              fontFamily:
                "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace",
            },
            ".cm-gutters": {
              backgroundColor: "transparent",
              borderRight: "1px solid #333",
            },
          }),
        ],
      }),
    });

    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // Re-create when document changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProject, activePath]);

  return <div ref={containerRef} className="h-full" />;
}
