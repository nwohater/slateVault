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
    <div className="app-sidebar-search relative">
      <input
        type="text"
        value={query}
        onChange={(e) => handleSearch(e.target.value)}
        onFocus={() => results.length > 0 && setShowResults(true)}
        onBlur={() => setTimeout(() => setShowResults(false), 200)}
        placeholder="Search documents..."
        className="w-full rounded-lg border border-neutral-800/80 bg-neutral-950/45 px-2.5 py-1.5 text-xs text-neutral-200 placeholder-neutral-600 outline-none focus:border-cyan-700"
      />
      {showResults && results.length > 0 && (
        <div className="absolute left-3 right-3 z-10 mt-1 max-h-60 overflow-y-auto rounded-lg border border-neutral-700 bg-neutral-900 shadow-xl">
          {results.map((r, i) => (
            <button
              key={i}
              onMouseDown={() => {
                openDocument(r.project, r.path);
                setShowResults(false);
                setQuery("");
              }}
              className="w-full px-2 py-1.5 text-left text-xs hover:bg-neutral-700"
            >
              <div className="text-neutral-200 font-medium">{r.title}</div>
              <div className="text-neutral-500 truncate">
                {r.project}/{r.path}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
