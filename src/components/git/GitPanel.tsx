"use client";

import { useState } from "react";
import { ChangesTab } from "./ChangesTab";
import { HistoryTab } from "./HistoryTab";
import { RemoteTab } from "./RemoteTab";

type Tab = "changes" | "history" | "remote";

export function GitPanel() {
  const [tab, setTab] = useState<Tab>("changes");

  return (
    <div className="flex flex-col h-full bg-neutral-900">
      {/* Tab bar */}
      <div className="flex border-b border-neutral-800 text-xs">
        {(["changes", "history", "remote"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-1.5 capitalize transition-colors ${
              tab === t
                ? "text-neutral-100 border-b border-blue-500"
                : "text-neutral-500 hover:text-neutral-300"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {tab === "changes" && <ChangesTab />}
        {tab === "history" && <HistoryTab />}
        {tab === "remote" && <RemoteTab />}
      </div>
    </div>
  );
}
