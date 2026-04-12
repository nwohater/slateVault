"use client";

import { useState, useCallback, useRef } from "react";
import { useEditorStore } from "@/stores/editorStore";
import { useVaultStore } from "@/stores/vaultStore";
import * as commands from "@/lib/commands";
import type { SearchResultInfo } from "@/types";

export function SearchView() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResultInfo[]>([]);
  const [searching, setSearching] = useState(false);
  const [projectFilter, setProjectFilter] = useState<string>("");
  const [hasSearched, setHasSearched] = useState(false);
  const openDocument = useEditorStore((s) => s.openDocument);
  const projects = useVaultStore((s) => s.projects);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const handleSearch = useCallback(
    (value: string) => {
      setQuery(value);
      clearTimeout(timerRef.current);
      if (!value.trim()) {
        setResults([]);
        setHasSearched(false);
        return;
      }
      timerRef.current = setTimeout(async () => {
        setSearching(true);
        try {
          const res = await commands.searchDocuments(
            value,
            projectFilter || undefined,
            50
          );
          setResults(res);
          setHasSearched(true);
        } catch {
          setResults([]);
        } finally {
          setSearching(false);
        }
      }, 200);
    },
    [projectFilter]
  );

  const handleOpen = (project: string, path: string) => {
    openDocument(project, path);
  };

  return (
    <div className="flex flex-col h-full bg-neutral-950">
      {/* Search header */}
      <div className="p-4 border-b border-neutral-800 space-y-2">
        <div className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search documents... (FTS5 syntax supported)"
            className="flex-1 px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-neutral-200 placeholder-neutral-500 outline-none focus:border-blue-600 text-sm"
            autoFocus
          />
          <select
            value={projectFilter}
            onChange={(e) => {
              setProjectFilter(e.target.value);
              if (query) handleSearch(query);
            }}
            className="px-2 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-neutral-300 text-sm outline-none"
          >
            <option value="">All projects</option>
            {projects.map((p) => (
              <option key={p.name} value={p.name}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        {hasSearched && (
          <div className="text-xs text-neutral-500">
            {results.length} result{results.length !== 1 ? "s" : ""} found
            {searching && " (searching...)"}
          </div>
        )}
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto">
        {results.length === 0 && hasSearched && !searching && (
          <div className="p-8 text-center text-neutral-500 text-sm">
            No results found for &quot;{query}&quot;
          </div>
        )}

        {results.map((r, i) => (
          <button
            key={`${r.project}/${r.path}-${i}`}
            onClick={() => handleOpen(r.project, r.path)}
            className="w-full px-4 py-3 text-left border-b border-neutral-800/50 hover:bg-neutral-900 transition-colors"
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-medium text-neutral-200">
                {r.title}
              </span>
              <span className="text-xs text-neutral-600">
                {r.project}/{r.path}
              </span>
            </div>
            <div
              className="text-xs text-neutral-400 line-clamp-2"
              dangerouslySetInnerHTML={{ __html: r.snippet }}
            />
          </button>
        ))}

        {!hasSearched && (
          <div className="p-8 text-center text-neutral-500 text-sm">
            Type to search across all documents in the vault
          </div>
        )}
      </div>
    </div>
  );
}
