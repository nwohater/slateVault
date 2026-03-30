"use client";

import { useState } from "react";
import { useVaultStore } from "@/stores/vaultStore";
import * as commands from "@/lib/commands";

export function Onboarding() {
  const [loading, setLoading] = useState(false);
  const createProject = useVaultStore((s) => s.createProject);
  const loadProjects = useVaultStore((s) => s.loadProjects);
  const loadStats = useVaultStore((s) => s.loadStats);

  const handleQuickStart = async () => {
    setLoading(true);
    try {
      await createProject("getting-started", "Welcome to slateVault", [
        "onboarding",
      ]);
      await commands.writeDocument(
        "getting-started",
        "welcome.md",
        "Welcome to slateVault",
        `# Welcome to slateVault

Your local-first, AI-native markdown vault is ready.

## Quick Start

1. **Create a project** — Click the + button in the sidebar
2. **Add documents** — Expand a project and click + to create a new doc
3. **Edit with live preview** — The editor supports full markdown with split preview
4. **Search everything** — Use Ctrl+Shift+F to search across all documents
5. **Version control** — Switch to the Git tab to stage, commit, and push
6. **Open terminal** — Press Ctrl+\` to open the embedded terminal
7. **MCP integration** — AI tools can read and write to this vault via the MCP server

## MCP Server

The MCP server runs on port 3742 by default. Configure it in Settings.

To connect Claude Code, add to your MCP config:

\`\`\`json
{
  "mcpServers": {
    "slatevault": {
      "command": "slatevault-mcp"
    }
  }
}
\`\`\`

Happy writing!
`,
        ["onboarding", "guide"],
        undefined
      );
      await loadProjects();
      await loadStats();
    } catch (e) {
      console.error("Onboarding failed:", e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full w-full text-center px-8">
      <img
        src="/slateVault.png"
        alt="slateVault"
        className="h-48 object-contain mb-6"
      />
      <h2 className="text-2xl font-bold text-neutral-100 mb-3">
        Welcome to your vault
      </h2>
      <p className="text-sm text-neutral-500 mb-8 max-w-sm">
        This vault is empty. Create your first project with the + button, or let
        us set up a quick-start guide for you.
      </p>
      <button
        onClick={handleQuickStart}
        disabled={loading}
        className="px-6 py-2.5 bg-blue-700 hover:bg-blue-600 disabled:bg-neutral-800 text-white rounded-lg text-sm font-medium transition-colors"
      >
        {loading ? "Setting up..." : "Quick Start"}
      </button>
    </div>
  );
}
