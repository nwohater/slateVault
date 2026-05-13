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

const authorBadge: Record<string, { label: string; bg: string; color: string }> = {
  Ai:    { label: "AI", bg: "var(--magic-soft)",   color: "var(--magic)"   },
  Human: { label: "H",  bg: "var(--success-soft)", color: "var(--success)" },
  Both:  { label: "B",  bg: "var(--info-soft)",    color: "var(--info)"    },
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
      ? <span style={{ color: "var(--warning)" }}><FolderOpenIcon className="w-3.5 h-3.5" /></span>
      : <span style={{ color: "var(--warning)" }}><FolderIcon className="w-3.5 h-3.5" /></span>
    : isAsset
      ? <span style={{ color: "var(--text-faint)" }}><AssetIcon className="w-3.5 h-3.5" /></span>
      : <span style={{ color: "var(--text-faint)" }}><FileIcon className="w-3.5 h-3.5" /></span>;

  const chevron = isFolder
    ? isExpanded
      ? <span style={{ color: "var(--text-faint)" }}><ChevronDown className="w-3 h-3" /></span>
      : <span style={{ color: "var(--text-faint)" }}><ChevronRight className="w-3 h-3" /></span>
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
      className="w-full flex items-center gap-1.5 px-2 py-1.5 text-xs text-left rounded-md transition-colors"
      style={{
        paddingLeft: 8 + depth * 16,
        background: isExternalDropTarget
          ? "var(--accent-soft)"
          : dragOver
          ? "var(--info-soft)"
          : isActive
          ? "var(--accent-soft)"
          : undefined,
        color: isActive
          ? "var(--accent)"
          : isAsset
          ? "var(--text-faint)"
          : "var(--text-muted)",
        borderLeft: isExternalDropTarget
          ? "2px solid var(--accent)"
          : dragOver
          ? "2px solid var(--info)"
          : undefined,
      }}
      title={isAsset ? `${label} — click to reveal in Finder` : undefined}
    >
      {isFolder && <span className="w-3 flex-shrink-0">{chevron}</span>}
      <span className="flex-shrink-0">{icon}</span>
      <span className="truncate flex-1">{label}</span>
      {canonical && (
        <span className="text-yellow-400 flex-shrink-0 text-[10px]" title="Canonical">★</span>
      )}
      {isProtected && (
        <span className="flex-shrink-0 text-[10px]" style={{ color: "var(--danger)" }} title="Protected">🔒</span>
      )}
      {badge && (
        <span
          style={{ background: badge.bg, color: badge.color }}
          className="px-1 rounded text-[9px] font-medium flex-shrink-0"
        >
          {badge.label}
        </span>
      )}
    </button>
  );
}
