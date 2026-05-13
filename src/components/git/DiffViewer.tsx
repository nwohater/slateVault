"use client";

import type { FileDiff } from "@/types";
import { CloseIcon } from "@/components/icons/GitIcons";

interface DiffViewerProps {
  diff: FileDiff;
  onClose?: () => void;
}

export function DiffViewer({ diff, onClose }: DiffViewerProps) {
  return (
    <div className="flex flex-col h-full bg-neutral-950 text-xs font-mono">
      {/* Header */}
      <div className="flex items-center justify-between px-2 py-1 bg-neutral-900 border-b border-neutral-800">
        <div className="flex items-center gap-2 truncate">
          <span className="text-neutral-400 truncate">{diff.path}</span>
          <span style={{ color: "var(--success)" }}>+{diff.stats.additions}</span>
          <span style={{ color: "var(--danger)" }}>-{diff.stats.deletions}</span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-neutral-500 hover:text-neutral-300"
          >
            <CloseIcon className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Diff content */}
      <div className="flex-1 overflow-auto">
        {diff.hunks.length === 0 ? (
          <div className="p-4 text-center text-neutral-500">
            No changes to display
          </div>
        ) : (
          diff.hunks.map((hunk, hi) => (
            <div key={hi}>
              {/* Hunk header */}
              <div className="px-2 py-0.5 bg-neutral-900/50 border-y border-neutral-800/50" style={{ color: "var(--info)" }}>
                {hunk.header}
              </div>
              {/* Lines */}
              {hunk.lines.map((line, li) => {
                const isAdd = line.origin === "+";
                const isDel = line.origin === "-";
                const bgStyle = isAdd
                  ? { background: "color-mix(in srgb, var(--success) 10%, transparent)" }
                  : isDel
                    ? { background: "color-mix(in srgb, var(--danger) 10%, transparent)" }
                    : {};
                const textColorStyle = isAdd
                  ? { color: "var(--success)" }
                  : isDel
                    ? { color: "var(--danger)" }
                    : undefined;

                return (
                  <div
                    key={`${hi}-${li}`}
                    className="flex hover:brightness-125"
                    style={bgStyle}
                  >
                    <span className="w-8 text-right pr-1 text-neutral-600 select-none shrink-0">
                      {line.old_lineno ?? ""}
                    </span>
                    <span className="w-8 text-right pr-1 text-neutral-600 select-none shrink-0 border-r border-neutral-800">
                      {line.new_lineno ?? ""}
                    </span>
                    <span className="w-4 text-center select-none shrink-0 text-neutral-400" style={textColorStyle}>
                      {line.origin === " " ? "" : line.origin}
                    </span>
                    <span className="flex-1 pr-2 whitespace-pre text-neutral-400" style={textColorStyle}>
                      {line.content}
                    </span>
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
