"use client";

import { useState, useRef, useCallback } from "react";
import { useEditorStore } from "@/stores/editorStore";
import * as commands from "@/lib/commands";
import type { SearchResultInfo } from "@/types";

export function SearchBar() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResultInfo[]>([]);
  const [showResults, setShowResults] = useState(false);
  const openDocument = useEditorStore((s) => s.openDocument);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const handleSearch = useCallback((value: string) => {
    setQuery(value);
    clearTimeout(timerRef.current);
    if (!value.trim()) {
      setResults([]);
      setShowResults(false);
      return;
    }
    timerRef.current = setTimeout(async () => {
      try {
        const res = await commands.searchDocuments(value);
        setResults(res);
        setShowResults(true);
      } catch {
        setResults([]);
      }
    }, 300);
  }, []);

  return (
    <div className="sidebar-search relative">
      <input
        type="text"
        value={query}
        onChange={(e) => handleSearch(e.target.value)}
        onFocus={() => results.length > 0 && setShowResults(true)}
        onBlur={() => setTimeout(() => setShowResults(false), 200)}
        placeholder="Search documents..."
      />
      {showResults && results.length > 0 && (
        <div style={{
          position: "absolute",
          left: 8,
          right: 8,
          zIndex: 10,
          marginTop: 4,
          maxHeight: 240,
          overflowY: "auto",
          borderRadius: "var(--radius)",
          border: "1px solid var(--border)",
          background: "var(--bg-elevated)",
          boxShadow: "var(--shadow-lg)",
        }}>
          {results.map((r, i) => (
            <button
              key={i}
              onMouseDown={() => {
                openDocument(r.project, r.path);
                setShowResults(false);
                setQuery("");
              }}
              style={{
                display: "block",
                width: "100%",
                padding: "6px 10px",
                textAlign: "left",
                background: "transparent",
                border: "none",
                borderTop: i > 0 ? "1px solid var(--border-subtle)" : undefined,
                cursor: "pointer",
              }}
              className="hover:bg-neutral-900"
            >
              <div style={{ fontSize: 12, fontWeight: 500, color: "var(--text)" }}>{r.title}</div>
              <div style={{ fontSize: 11, color: "var(--text-faint)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {r.project}/{r.path}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
