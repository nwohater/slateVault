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
    <div className="relative px-3 py-2 border-b border-neutral-800">
      <input
        type="text"
        value={query}
        onChange={(e) => handleSearch(e.target.value)}
        onFocus={() => results.length > 0 && setShowResults(true)}
        onBlur={() => setTimeout(() => setShowResults(false), 200)}
        placeholder="Search documents..."
        className="w-full px-2 py-1 text-xs bg-neutral-800 border border-neutral-700 rounded text-neutral-200 placeholder-neutral-500 outline-none focus:border-blue-600"
      />
      {showResults && results.length > 0 && (
        <div className="absolute left-3 right-3 mt-1 bg-neutral-800 border border-neutral-700 rounded shadow-lg z-10 max-h-60 overflow-y-auto">
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
