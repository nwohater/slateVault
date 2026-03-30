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

## Connect Claude Code (MCP)

slateVault includes an MCP server that lets AI tools read and write to your vault.

### Setup (one time)

Run this in your terminal to install the MCP globally:

\`\`\`bash
claude mcp add -s user slatevault -- slatevault-mcp
\`\`\`

That's it! The MCP server automatically connects to whichever vault you have open in the app.

### How it works

- When you open a vault, slateVault writes the path to \`~/.slatevault/active-vault\`
- When Claude Code starts a session, the MCP server reads that file and connects to the same vault
- AI tools can then create projects, write documents, search, and read your docs
- Documents written by AI are tagged with \`author: ai\` and auto-staged for git commit

### Available MCP Tools

| Tool | Description |
|------|-------------|
| \`list_projects\` | See all projects in the vault |
| \`create_project\` | Create a new project |
| \`get_project_context\` | Load pinned AI context files |
| \`write_document\` | Create or update a document |
| \`read_document\` | Read a document's content |
| \`list_documents\` | List docs in a project |
| \`search_documents\` | Full-text search across the vault |

### Settings

Configure the MCP server port and auto-stage behavior in the **Settings** tab.
You can also copy the setup command from Settings > MCP Server.

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
