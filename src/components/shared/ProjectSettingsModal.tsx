"use client";

import { useEffect, useRef, useState } from "react";
import { useVaultStore } from "@/stores/vaultStore";
import * as commands from "@/lib/commands";

interface ProjectSettingsModalProps {
  projectName: string;
  onClose: () => void;
}

export function ProjectSettingsModal({ projectName, onClose }: ProjectSettingsModalProps) {
  const loadProjects = useVaultStore((s) => s.loadProjects);
  const renameProject = useVaultStore((s) => s.renameProject);

  const [name, setName] = useState(projectName);
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [sourceFolder, setSourceFolder] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  // Load current values
  useEffect(() => {
    const load = async () => {
      try {
        const [projects, folder] = await Promise.all([
          commands.listProjects(),
          commands.getProjectSourceFolder(projectName).catch(() => null),
        ]);
        const project = projects.find((p) => p.name === projectName);
        if (project) {
          setDescription(project.description || "");
          setTags(project.tags?.join(", ") || "");
        }
        setSourceFolder(folder ?? null);
      } finally {
        setLoading(false);
        setTimeout(() => nameRef.current?.focus(), 50);
      }
    };
    void load();
  }, [projectName]);

  const handleBrowse = async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const folder = await open({ directory: true, title: "Select source folder" });
      if (folder) setSourceFolder(folder as string);
    } catch {}
  };

  const handleSave = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    setSaving(true);
    setError(null);
    try {
      const parsedTags = tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      // Rename if name changed
      if (trimmedName !== projectName) {
        await renameProject(projectName, trimmedName);
      }

      // Update description + tags
      await commands.updateProjectMeta(trimmedName, description.trim(), parsedTags);

      // Update source folder
      await commands.setProjectSourceFolder(trimmedName, sourceFolder ?? "");

      await loadProjects();
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 800);
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="workspace-section w-full max-w-md rounded-3xl p-6 shadow-2xl mx-4">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-neutral-100">Project Settings</h2>
          <button
            onClick={onClose}
            className="text-neutral-500 hover:text-neutral-300 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {loading ? (
          <div className="py-8 text-center text-sm text-neutral-500">Loading…</div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs text-neutral-400">Name</label>
              <input
                ref={nameRef}
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") void handleSave(); }}
                className="workspace-input w-full rounded-xl px-3 py-2.5 text-sm text-neutral-200 placeholder-neutral-600 outline-none focus:border-cyan-600"
              />
              {name.trim() !== projectName && (
                <p className="mt-1 text-[10px] text-yellow-500/80">
                  Renaming will move the project folder on disk.
                </p>
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-xs text-neutral-400">
                Description <span className="text-neutral-600">— optional</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="What is this project for?"
                className="workspace-input w-full rounded-xl px-3 py-2.5 text-sm text-neutral-200 placeholder-neutral-600 outline-none focus:border-cyan-600 resize-none"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs text-neutral-400">
                Tags <span className="text-neutral-600">— comma separated</span>
              </label>
              <input
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="backend, api, typescript"
                className="workspace-input w-full rounded-xl px-3 py-2.5 text-sm text-neutral-200 placeholder-neutral-600 outline-none focus:border-cyan-600"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs text-neutral-400">
                Source folder <span className="text-neutral-600">— optional</span>
              </label>
              <div className="flex gap-2">
                <div className="workspace-input flex-1 truncate rounded-xl px-3 py-2.5 text-sm text-neutral-400">
                  {sourceFolder ? sourceFolder.split("/").pop() || sourceFolder : "No folder selected"}
                </div>
                {sourceFolder && (
                  <button
                    onClick={() => setSourceFolder(null)}
                    className="rounded-xl border border-neutral-700 px-3 py-2 text-xs text-neutral-500 hover:bg-neutral-800"
                    title="Clear"
                  >×</button>
                )}
                <button
                  onClick={() => void handleBrowse()}
                  className="rounded-xl border border-neutral-700 px-3 py-2.5 text-xs text-neutral-300 transition-colors hover:bg-neutral-800 whitespace-nowrap"
                >
                  Browse
                </button>
              </div>
              <p className="mt-1.5 text-[10px] text-neutral-600">
                Terminals and AI chat default to this folder for this project.
              </p>
            </div>

            {error && (
              <div className="rounded-xl border border-red-900/40 bg-red-950/20 px-3 py-2 text-xs text-red-300">
                {error}
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button
                onClick={() => void handleSave()}
                disabled={saving || !name.trim()}
                className="flex-1 rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-cyan-500 disabled:bg-neutral-800 disabled:text-neutral-500"
              >
                {success ? "Saved ✓" : saving ? "Saving…" : "Save changes"}
              </button>
              <button
                onClick={onClose}
                className="rounded-xl border border-neutral-700 px-4 py-2.5 text-sm text-neutral-300 transition-colors hover:bg-neutral-800"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
