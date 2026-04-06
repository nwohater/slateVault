"use client";

import { useEffect, useState, useRef } from "react";
import { useGitStore } from "@/stores/gitStore";
import { BranchIcon, TrashIcon, StageIcon, ChevronDown } from "@/components/icons/GitIcons";

export function BranchSelector() {
  const branches = useGitStore((s) => s.branches);
  const currentBranch = useGitStore((s) => s.currentBranch);
  const loadBranches = useGitStore((s) => s.loadBranches);
  const createBranch = useGitStore((s) => s.createBranch);
  const switchBranch = useGitStore((s) => s.switchBranch);
  const deleteBranch = useGitStore((s) => s.deleteBranch);

  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadBranches();
  }, [loadBranches]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setConfirmDelete(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    await createBranch(name);
    setNewName("");
  };

  return (
    <div className="relative px-2 py-1.5 border-b border-neutral-800" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-xs text-neutral-300 hover:text-white w-full"
      >
        <BranchIcon className="w-3.5 h-3.5 text-neutral-500" />
        <span className="font-medium truncate">{currentBranch}</span>
        <span className={`ml-auto transition-transform ${open ? "rotate-180" : ""}`}>
          <ChevronDown className="w-3 h-3" />
        </span>
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-50 bg-neutral-800 border border-neutral-700 rounded-b shadow-xl max-h-64 overflow-y-auto">
          {branches.map((b) => (
            <div
              key={b.name}
              className="flex items-center px-2 py-1 text-xs hover:bg-neutral-700 group"
            >
              <button
                onClick={() => {
                  if (!b.is_current) switchBranch(b.name);
                  setOpen(false);
                }}
                className={`flex-1 text-left truncate ${
                  b.is_current ? "text-blue-400" : "text-neutral-300"
                }`}
              >
                {b.is_current && "* "}
                {b.name}
              </button>
              {!b.is_current && (
                <>
                  {confirmDelete === b.name ? (
                    <button
                      onClick={() => {
                        deleteBranch(b.name);
                        setConfirmDelete(null);
                      }}
                      className="text-red-400 text-[10px] hover:text-red-300"
                    >
                      confirm
                    </button>
                  ) : (
                    <button
                      onClick={() => setConfirmDelete(b.name)}
                      className="text-neutral-600 hover:text-red-400 opacity-0 group-hover:opacity-100"
                      title="Delete branch"
                    >
                      <TrashIcon className="w-3 h-3" />
                    </button>
                  )}
                </>
              )}
            </div>
          ))}

          {/* Create new branch */}
          <div className="flex gap-1 p-1.5 border-t border-neutral-700">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
              }}
              placeholder="New branch..."
              className="flex-1 px-1.5 py-0.5 text-xs bg-neutral-900 border border-neutral-700 rounded text-neutral-200 placeholder-neutral-500 outline-none focus:border-blue-600"
            />
            <button
              onClick={handleCreate}
              disabled={!newName.trim()}
              className="px-1.5 py-0.5 text-xs rounded bg-blue-700 hover:bg-blue-600 disabled:bg-neutral-700 disabled:text-neutral-500 text-white flex items-center justify-center"
            >
              <StageIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
