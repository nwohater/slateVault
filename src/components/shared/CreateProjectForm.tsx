"use client";

import { useEffect, useMemo, useState } from "react";
import { useVaultStore } from "@/stores/vaultStore";
import * as commands from "@/lib/commands";
import type { TemplateInfo } from "@/types";

type TemplateConfigMap = Record<
  string,
  { label: string; folders: string[]; files: Record<string, string> }
>;

interface CreateProjectFormProps {
  onCreated: (name: string) => void;
  onCancel?: () => void;
  onBack?: () => void;
  /** Sidebar style: compact layout with dropdown template picker */
  compact?: boolean;
  /** Show a template preview panel alongside the form (onboarding) */
  showPreview?: boolean;
}

export function CreateProjectForm({
  onCreated,
  onCancel,
  onBack,
  compact = false,
  showPreview = false,
}: CreateProjectFormProps) {
  const createProject = useVaultStore((s) => s.createProject);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [sourceFolder, setSourceFolder] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [templates, setTemplates] = useState<TemplateInfo[]>([]);
  const [templateConfig, setTemplateConfig] = useState<TemplateConfigMap>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    commands
      .listTemplates()
      .then((t) => {
        setTemplates(t);
        const def = t.find((x) => x.is_default);
        if (def) setSelectedTemplate(def.name);
      })
      .catch(() => {});

    if (showPreview) {
      commands
        .getTemplatesConfig()
        .then((raw) => {
          const parsed = JSON.parse(raw) as { templates?: TemplateConfigMap };
          setTemplateConfig(parsed.templates ?? {});
        })
        .catch(() => {});
    }
  }, [showPreview]);

  const selectedTemplateConfig = useMemo(
    () => templateConfig[selectedTemplate],
    [selectedTemplate, templateConfig]
  );

  const templatePreviewItems = useMemo(() => {
    if (!selectedTemplateConfig) return [];
    const folderItems = selectedTemplateConfig.folders.map((f) => ({
      key: f, label: `${f}/`, tone: "folder" as const,
    }));
    const fileItems = Object.keys(selectedTemplateConfig.files)
      .sort().slice(0, 6)
      .map((p) => ({ key: p, label: p, tone: "file" as const }));
    return [...folderItems, ...fileItems];
  }, [selectedTemplateConfig]);

  const handleBrowse = async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const folder = await open({ directory: true, title: "Select source folder for this project" });
      if (folder) setSourceFolder(folder as string);
    } catch {}
  };

  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (!trimmed || !selectedTemplate) return;
    setLoading(true);
    setError(null);
    try {
      await createProject(trimmed, description.trim() || undefined, undefined, selectedTemplate);
      if (sourceFolder) {
        await commands.setProjectSourceFolder(trimmed, sourceFolder);
      }
      onCreated(trimmed);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  // ── Compact variant (sidebar / VaultHome quick actions) ──────────────────
  if (compact) {
    return (
      <div className="flex flex-col gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void handleSubmit();
            if (e.key === "Escape") onCancel?.();
          }}
          placeholder="project-name"
          autoFocus
          className="workspace-input w-full rounded-xl px-3 py-2 text-sm text-neutral-200 placeholder-neutral-600 outline-none focus:border-cyan-600"
        />
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Short description (optional)"
          className="workspace-input w-full rounded-xl px-3 py-2 text-sm text-neutral-200 placeholder-neutral-600 outline-none focus:border-cyan-600"
        />
        <select
          value={selectedTemplate}
          onChange={(e) => setSelectedTemplate(e.target.value)}
          className="workspace-input w-full rounded-xl px-3 py-2 text-sm text-neutral-200 outline-none focus:border-cyan-600"
        >
          {templates.length === 0 && (
            <option value="" disabled>Loading templates…</option>
          )}
          {templates.map((t) => (
            <option key={t.name} value={t.name}>
              {t.label}{t.is_default ? " (default)" : ""}
            </option>
          ))}
        </select>
        <div className="flex gap-1 items-center">
          <div className="flex-1 truncate rounded-xl workspace-input px-3 py-2 text-sm text-neutral-400">
            {sourceFolder ? sourceFolder.split("/").pop() || sourceFolder : "No source folder"}
          </div>
          {sourceFolder && (
            <button
              onClick={() => setSourceFolder(null)}
              className="px-2 py-2 text-xs rounded-xl workspace-input text-neutral-500 hover:text-neutral-300"
              title="Clear"
            >×</button>
          )}
          <button
            onClick={() => void handleBrowse()}
            className="px-3 py-2 text-xs rounded-xl workspace-input text-neutral-300 hover:text-neutral-100 whitespace-nowrap"
          >
            Browse
          </button>
        </div>
        {error && (
          <div className="rounded-xl border border-red-900/40 bg-red-950/20 px-3 py-2 text-xs text-red-300">
            {error}
          </div>
        )}
        <div className="flex gap-1">
          <button
            onClick={() => void handleSubmit()}
            disabled={loading || !name.trim() || !selectedTemplate}
            className="flex-1 rounded-xl bg-cyan-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-cyan-500 disabled:bg-neutral-800 disabled:text-neutral-500"
          >
            {loading ? "Creating…" : "Create"}
          </button>
          {onCancel && (
            <button
              onClick={onCancel}
              className="px-3 py-2 text-sm rounded-xl workspace-input text-neutral-400 hover:text-neutral-200"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── Full variant (onboarding) ─────────────────────────────────────────────
  const formFields = (
    <div className="space-y-5">
      <div>
        <label className="mb-1.5 block text-xs text-neutral-400">Project name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") void handleSubmit(); }}
          placeholder="my-project"
          autoFocus
          className="workspace-input w-full rounded-xl px-3 py-2.5 text-sm text-neutral-200 placeholder-neutral-600 outline-none focus:border-cyan-600"
        />
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
        <label className="mb-2 block text-xs text-neutral-400">Template</label>
        <div className="space-y-2">
          {templates.map((t) => (
            <button
              key={t.name}
              onClick={() => setSelectedTemplate(t.name)}
              className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-colors ${
                selectedTemplate === t.name
                  ? "border-cyan-500 bg-cyan-950/20 text-neutral-100"
                  : "workspace-subsection text-neutral-400"
              }`}
            >
              <span className={`h-3.5 w-3.5 rounded-full border-2 flex-shrink-0 ${
                selectedTemplate === t.name ? "border-cyan-400 bg-cyan-400" : "border-neutral-600"
              }`} />
              <span className="text-sm">{t.label}</span>
              {t.is_default && (
                <span className="ml-auto text-[10px] uppercase tracking-wide text-neutral-500">Default</span>
              )}
            </button>
          ))}
        </div>
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
            className="rounded-xl border border-neutral-700 px-3 py-2.5 text-xs text-neutral-300 transition-colors hover:bg-neutral-800"
          >
            Browse
          </button>
        </div>
        <p className="mt-1.5 text-[10px] text-neutral-600">
          Terminals and AI chat will default here for this project.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-900/40 bg-red-950/20 px-3 py-2 text-xs text-red-300">
          {error}
        </div>
      )}

      <div className="flex gap-3">
        {onBack && (
          <button
            onClick={onBack}
            className="rounded-xl border border-neutral-700 px-4 py-2.5 text-sm text-neutral-300 transition-colors hover:bg-neutral-800"
          >
            Back
          </button>
        )}
        <button
          onClick={() => void handleSubmit()}
          disabled={loading || !name.trim() || !selectedTemplate}
          className="rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-cyan-500 disabled:bg-neutral-800 disabled:text-neutral-500"
        >
          {loading ? "Creating…" : "Create project"}
        </button>
        {onCancel && (
          <button
            onClick={onCancel}
            className="rounded-xl border border-neutral-700 px-4 py-2.5 text-sm text-neutral-300 transition-colors hover:bg-neutral-800"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );

  if (!showPreview) return formFields;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div>{formFields}</div>
      <div className="workspace-subsection rounded-2xl p-4">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500">Preview</p>
        <p className="mt-3 text-sm font-medium text-neutral-200">
          {templates.find((t) => t.name === selectedTemplate)?.label ?? ""}
        </p>
        <div className="workspace-input mt-4 rounded-xl p-4 font-mono text-[11px] text-neutral-500">
          {templatePreviewItems.length > 0 ? (
            <>
              {templatePreviewItems.map((item) => (
                <div key={item.key} className={item.tone === "folder" ? "text-neutral-400" : "pl-3 text-neutral-600"}>
                  {item.label}
                </div>
              ))}
              {Object.keys(selectedTemplateConfig?.files ?? {}).length > 6 && (
                <div className="pl-3 text-neutral-700">
                  …{Object.keys(selectedTemplateConfig?.files ?? {}).length - 6} more starter files
                </div>
              )}
            </>
          ) : (
            <div className="text-neutral-600">Minimal template — starts empty.</div>
          )}
        </div>
        <p className="mt-4 text-[11px] leading-5 text-neutral-500">
          Pulled from the template config the project will use.
        </p>
      </div>
    </div>
  );
}
