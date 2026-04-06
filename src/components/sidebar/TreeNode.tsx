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
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
}

const authorBadge: Record<string, { label: string; color: string }> = {
  Ai: { label: "AI", color: "bg-purple-900 text-purple-300" },
  Human: { label: "H", color: "bg-green-900 text-green-300" },
  Both: { label: "B", color: "bg-blue-900 text-blue-300" },
};

export function TreeNode({
  label,
  isFolder,
  isExpanded,
  isActive,
  author,
  canonical,
  onClick,
  onContextMenu,
  depth,
  draggable,
  onDragStart,
  onDragOver,
  onDrop,
}: TreeNodeProps) {
  const badge = author ? authorBadge[author] : null;
  const [dragOver, setDragOver] = useState(false);

  const icon = isFolder
    ? isExpanded
      ? <FolderOpenIcon className="w-3.5 h-3.5 text-yellow-500" />
      : <FolderIcon className="w-3.5 h-3.5 text-yellow-600" />
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
          e.dataTransfer.dropEffect = "move";
          setDragOver(true);
          if (onDragOver) onDragOver(e);
        }
      }}
      onDragLeave={() => setDragOver(false)}
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
        hover:bg-neutral-800 transition-colors
        ${isActive ? "bg-neutral-800 text-blue-400" : "text-neutral-300"}
        ${dragOver ? "bg-blue-900/30 border-l-2 border-blue-500" : ""}
      `}
      style={{ paddingLeft: 8 + depth * 16 }}
    >
      {isFolder && <span className="w-3 flex-shrink-0">{chevron}</span>}
      <span className="flex-shrink-0">{icon}</span>
      <span className="truncate flex-1">{label}</span>
      {canonical && (
        <span className="text-yellow-400 flex-shrink-0 text-[10px]" title="Canonical">★</span>
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
