interface TreeNodeProps {
  label: string;
  isFolder: boolean;
  isExpanded?: boolean;
  isActive?: boolean;
  onClick: () => void;
  depth: number;
}

export function TreeNode({
  label,
  isFolder,
  isExpanded,
  isActive,
  onClick,
  depth,
}: TreeNodeProps) {
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
      <span className="truncate">{label}</span>
    </button>
  );
}
