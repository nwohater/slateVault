"use client";

import { useState } from "react";
import { ChevronRight, ChevronDown, FileIcon, FolderIcon, FolderOpenIcon } from "@/components/icons/GitIcons";

interface TreeNodeProps {
  label: string;
  isFolder: boolean;
  isExpanded?: boolean;
  isActive?: boolean;
  author?: string;
  onClick: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  depth: number;
  canonical?: boolean;
  isProtected?: boolean;
  draggable?: boolean;
  /** Non-markdown file — shown read-only with a paperclip icon */
  isAsset?: boolean;
  /** Highlight as an external-file drop target (cyan) vs internal move (blue) */
  isExternalDropTarget?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDragLeave?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
}

const authorBadge: Record<string, { label: string; color: string }> = {
  Ai: { label: "AI", color: "bg-purple-900 text-purple-300" },
  Human: { label: "H", color: "bg-green-900 text-green-300" },
  Both: { label: "B", color: "bg-blue-900 text-blue-300" },
};

/** Paperclip icon for non-markdown assets */
function AssetIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m18.375 12.739-7.693 7.693a4.5 4.5 0 0 1-6.364-6.364l10.94-10.94A3 3 0 1 1 19.5 7.372L8.552 18.32m.009-.01-.01.01m5.699-9.941-7.81 7.81a1.5 1.5 0 0 0 2.112 2.13" />
    </svg>
  );
}

export function TreeNode({
  label,
  isFolder,
  isExpanded,
  isActive,
  author,
  canonical,
  isProtected,
  onClick,
  onContextMenu,
  depth,
  draggable,
  isAsset,
  isExternalDropTarget,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
}: TreeNodeProps) {
  const badge = author ? authorBadge[author] : null;
  const [dragOver, setDragOver] = useState(false);

  const icon = isFolder
    ? isExpanded
      ? <FolderOpenIcon className="w-3.5 h-3.5 text-yellow-500" />
      : <FolderIcon className="w-3.5 h-3.5 text-yellow-600" />
    : isAsset
      ? <AssetIcon className="w-3.5 h-3.5 text-neutral-500" />
      : <FileIcon className="w-3.5 h-3.5 text-neutral-500" />;

  const chevron = isFolder
    ? isExpanded
      ? <ChevronDown className="w-3 h-3 text-neutral-500" />
      : <ChevronRight className="w-3 h-3 text-neutral-500" />
    : null;

  return (
    <button
      onClick={onClick}
      onContextMenu={onContextMenu}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={(e) => {
        if (isFolder) {
          e.preventDefault();
          e.stopPropagation();
          e.dataTransfer.dropEffect = "copy";
          setDragOver(true);
          if (onDragOver) onDragOver(e);
        }
      }}
      onDragLeave={(e) => {
        setDragOver(false);
        if (onDragLeave) onDragLeave(e);
      }}
      onDrop={(e) => {
        if (isFolder) {
          e.preventDefault();
          e.stopPropagation();
          setDragOver(false);
          if (onDrop) onDrop(e);
        }
      }}
      className={`
        w-full flex items-center gap-1 px-2 py-1 text-xs text-left
        transition-colors
        ${isAsset
          ? "text-neutral-500 hover:text-neutral-400 hover:bg-neutral-800/50"
          : isActive
            ? "bg-neutral-800 text-blue-400 hover:bg-neutral-800"
            : "text-neutral-300 hover:bg-neutral-800"}
        ${isExternalDropTarget ? "bg-cyan-950/40 border-l-2 border-cyan-500" : dragOver ? "bg-blue-900/30 border-l-2 border-blue-500" : ""}
      `}
      style={{ paddingLeft: 8 + depth * 16 }}
      title={isAsset ? `${label} — click to reveal in Finder` : undefined}
    >
      {isFolder && <span className="w-3 flex-shrink-0">{chevron}</span>}
      <span className="flex-shrink-0">{icon}</span>
      <span className="truncate flex-1">{label}</span>
      {canonical && (
        <span className="text-yellow-400 flex-shrink-0 text-[10px]" title="Canonical">★</span>
      )}
      {isProtected && (
        <span className="text-red-400 flex-shrink-0 text-[10px]" title="Protected">🔒</span>
      )}
      {badge && (
        <span
          className={`px-1 rounded text-[9px] font-medium flex-shrink-0 ${badge.color}`}
        >
          {badge.label}
        </span>
      )}
    </button>
  );
}
