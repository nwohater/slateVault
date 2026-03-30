interface TreeNodeProps {
  label: string;
  isFolder: boolean;
  isExpanded?: boolean;
  isActive?: boolean;
  author?: string;
  onClick: () => void;
  depth: number;
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
  onClick,
  depth,
}: TreeNodeProps) {
  const badge = author ? authorBadge[author] : null;

  return (
    <button
      onClick={onClick}
      className={`
        w-full flex items-center gap-1.5 px-2 py-1 text-xs text-left
        hover:bg-neutral-800 transition-colors
        ${isActive ? "bg-neutral-800 text-blue-400" : "text-neutral-300"}
      `}
      style={{ paddingLeft: 8 + depth * 16 }}
    >
      <span className="w-4 text-center text-neutral-500 flex-shrink-0">
        {isFolder ? (isExpanded ? "v" : ">") : "#"}
      </span>
      <span className="truncate flex-1">{label}</span>
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
