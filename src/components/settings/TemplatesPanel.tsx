"use client";

import { useEffect, useState } from "react";
import * as commands from "@/lib/commands";
import { useEditorStore } from "@/stores/editorStore";
import type { TemplateInfo } from "@/types";

export function TemplatesPanel() {
  const [templates, setTemplates] = useState<TemplateInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const openVaultFile = useEditorStore((s) => s.openVaultFile);

  useEffect(() => {
    commands
      .listTemplates()
      .then((t) => {
        setTemplates(t);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-4 text-neutral-500 text-xs">Loading templates...</div>
    );
  }

  return (
    <div className="flex flex-col h-full text-xs">
      {/* Template list */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-3 space-y-2">
          {templates.map((t) => (
            <div
              key={t.name}
              className="p-3 rounded-lg border border-neutral-800/50 bg-neutral-800/20"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-neutral-200">
                  {t.label}
                </span>
                {t.is_default && (
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-cyan-900/30 text-cyan-400 border border-cyan-500/20">
                    default
                  </span>
                )}
              </div>
              <span className="text-[10px] text-neutral-500 font-mono">
                {t.name}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="p-3 border-t border-neutral-800/50 space-y-2">
        <button
          onClick={() => openVaultFile("templates.json")}
          className="w-full px-3 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-medium flex items-center justify-center gap-2"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" />
          </svg>
          Edit templates.json
        </button>
        <p className="text-[10px] text-neutral-600 text-center">
          Add custom templates, change defaults, customize folder structures
        </p>
      </div>
    </div>
  );
}
