"use client";

import { useState } from "react";
import { BranchSelector } from "./BranchSelector";
import { ChangesTab } from "./ChangesTab";
import { HistoryTab } from "./HistoryTab";
import { RemoteTab } from "./RemoteTab";
import { PrTab } from "./PrTab";
import { ChangesIcon, HistoryIcon, RemoteIcon, PrIcon } from "@/components/icons/GitIcons";

type Tab = "changes" | "history" | "remote" | "pr";

const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "changes", label: "Changes", icon: <ChangesIcon className="w-3.5 h-3.5" /> },
  { id: "history", label: "History", icon: <HistoryIcon className="w-3.5 h-3.5" /> },
  { id: "remote", label: "Remote", icon: <RemoteIcon className="w-3.5 h-3.5" /> },
  { id: "pr", label: "PR", icon: <PrIcon className="w-3.5 h-3.5" /> },
];

export function GitPanel() {
  const [tab, setTab] = useState<Tab>("changes");

  return (
    <div className="flex flex-col h-full bg-neutral-900/95">
      {/* Branch selector */}
      <BranchSelector />

      {/* Tab bar */}
      <div className="flex border-b border-neutral-800/50 text-[11px] font-medium">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            title={t.label}
            className={`flex-1 py-2 flex items-center justify-center gap-1.5 relative ${
              tab === t.id
                ? "text-cyan-400"
                : "text-neutral-500 hover:text-neutral-300"
            }`}
          >
            {t.icon}
            <span>{t.label}</span>
            {tab === t.id && (
              <span className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {tab === "changes" && <ChangesTab />}
        {tab === "history" && <HistoryTab />}
        {tab === "remote" && <RemoteTab />}
        {tab === "pr" && <PrTab />}
      </div>
    </div>
  );
}
