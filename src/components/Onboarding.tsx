"use client";

import { useEffect, useState } from "react";
import { useVaultStore } from "@/stores/vaultStore";
import * as commands from "@/lib/commands";
import type { TemplateInfo } from "@/types";

export function Onboarding() {
  const [step, setStep] = useState<"welcome" | "create" | "mcp">("welcome");
  const [loading, setLoading] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [templates, setTemplates] = useState<TemplateInfo[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const createProject = useVaultStore((s) => s.createProject);
  const loadProjects = useVaultStore((s) => s.loadProjects);
  const loadStats = useVaultStore((s) => s.loadStats);

  useEffect(() => {
    commands
      .listTemplates()
      .then((t) => {
        setTemplates(t);
        const def = t.find((x) => x.is_default);
        if (def) setSelectedTemplate(def.name);
      })
      .catch(() => {});
  }, []);

  const handleCreateProject = async () => {
    if (!projectName.trim()) return;
    setLoading(true);
    try {
      await createProject(
        projectName.trim(),
        undefined,
        undefined,
        selectedTemplate || undefined
      );
      await loadProjects();
      await loadStats();
      setStep("mcp");
    } catch (e) {
      console.error("Create project failed:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleSkipToMcp = () => setStep("mcp");
  const handleDone = () => {
    // Close onboarding by loading projects (AppShell shows Onboarding when projects.length === 0)
    loadProjects();
  };

  const mcpCommand = "claude mcp add -s user slatevault -- slatevault-mcp";

  return (
    <div className="flex flex-col items-center justify-center h-full w-full text-center px-8">
      {step === "welcome" && (
        <>
          <img
            src="/slateVault.png"
            alt="slateVault"
            className="h-40 object-contain mb-6"
          />
          <h2 className="text-2xl font-bold text-neutral-100 mb-3">
            Welcome to slateVault
          </h2>
          <p className="text-sm text-neutral-400 mb-2 max-w-md">
            Your local-first, AI-native document vault. Organize documentation,
            version-control with git, and let AI tools read and write via MCP.
          </p>

          <div className="grid grid-cols-3 gap-3 mt-6 mb-8 max-w-lg w-full text-left">
            <div className="p-3 rounded-lg bg-neutral-900 border border-neutral-800">
              <div className="text-blue-400 text-xs font-medium mb-1">Documents</div>
              <div className="text-[10px] text-neutral-500">
                Markdown with frontmatter, full-text search, tags
              </div>
            </div>
            <div className="p-3 rounded-lg bg-neutral-900 border border-neutral-800">
              <div className="text-blue-400 text-xs font-medium mb-1">Git Built-In</div>
              <div className="text-[10px] text-neutral-500">
                Branch, commit, PR to GitHub or Azure DevOps
              </div>
            </div>
            <div className="p-3 rounded-lg bg-neutral-900 border border-neutral-800">
              <div className="text-blue-400 text-xs font-medium mb-1">MCP Server</div>
              <div className="text-[10px] text-neutral-500">
                15 tools for AI agents to read, write, search
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setStep("create")}
              className="px-6 py-2.5 bg-blue-700 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Create First Project
            </button>
            <button
              onClick={handleSkipToMcp}
              className="px-6 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg text-sm transition-colors"
            >
              Skip — I&apos;ll create one later
            </button>
          </div>
        </>
      )}

      {step === "create" && (
        <>
          <h2 className="text-xl font-bold text-neutral-100 mb-2">
            Create your first project
          </h2>
          <p className="text-sm text-neutral-500 mb-6 max-w-sm">
            Pick a template to get started with a pre-built folder structure, or choose Minimal for a blank slate.
          </p>

          <div className="w-full max-w-sm space-y-3">
            <div>
              <label className="block text-xs text-neutral-400 mb-1 text-left">
                Project name
              </label>
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateProject()}
                placeholder="my-project"
                className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-neutral-200 placeholder-neutral-600 outline-none focus:border-blue-600 text-sm"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-xs text-neutral-400 mb-1 text-left">
                Template
              </label>
              <div className="space-y-1.5">
                {templates.map((t) => (
                  <button
                    key={t.name}
                    onClick={() => setSelectedTemplate(t.name)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg border text-left text-sm transition-colors ${
                      selectedTemplate === t.name
                        ? "border-blue-500 bg-blue-900/20 text-neutral-200"
                        : "border-neutral-800 bg-neutral-900 text-neutral-400 hover:border-neutral-700"
                    }`}
                  >
                    <span
                      className={`w-3 h-3 rounded-full border-2 flex-shrink-0 ${
                        selectedTemplate === t.name
                          ? "border-blue-500 bg-blue-500"
                          : "border-neutral-600"
                      }`}
                    />
                    <span>{t.label}</span>
                    {t.is_default && (
                      <span className="ml-auto text-[10px] text-neutral-600">
                        default
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleCreateProject}
              disabled={loading || !projectName.trim()}
              className="w-full py-2.5 bg-blue-700 hover:bg-blue-600 disabled:bg-neutral-800 disabled:text-neutral-500 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {loading ? "Creating..." : "Create Project"}
            </button>
          </div>
        </>
      )}

      {step === "mcp" && (
        <>
          <h2 className="text-xl font-bold text-neutral-100 mb-2">
            Connect your AI agent
          </h2>
          <p className="text-sm text-neutral-500 mb-6 max-w-md">
            slateVault includes an MCP server with 15 tools. Connect Claude Code so it can read, write, search, and bundle context from your vault.
          </p>

          <div className="w-full max-w-md space-y-4">
            <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
              <label className="block text-xs text-neutral-400 mb-2 text-left">
                Run this once in your terminal:
              </label>
              <div className="flex gap-2">
                <code className="flex-1 px-3 py-2 bg-neutral-950 rounded text-blue-400 text-xs font-mono truncate">
                  {mcpCommand}
                </code>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(mcpCommand);
                  }}
                  className="px-3 py-2 bg-neutral-800 hover:bg-neutral-700 rounded text-neutral-300 text-xs transition-colors flex-shrink-0"
                >
                  Copy
                </button>
              </div>
            </div>

            <div className="text-left text-xs text-neutral-500 space-y-2 bg-neutral-900 border border-neutral-800 rounded-lg p-4">
              <p className="text-neutral-300 font-medium">How it works:</p>
              <ul className="space-y-1.5 list-none">
                <li className="flex gap-2">
                  <span className="text-blue-400">1.</span>
                  <span>Open a vault → slateVault writes the path to <code className="text-neutral-400">~/.slatevault/active-vault</code></span>
                </li>
                <li className="flex gap-2">
                  <span className="text-blue-400">2.</span>
                  <span>Claude Code starts → MCP server reads that file and connects</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-blue-400">3.</span>
                  <span>AI can search docs, write specs, build context bundles, propose updates</span>
                </li>
              </ul>
            </div>

            <div className="text-left text-xs text-neutral-500 bg-neutral-900 border border-neutral-800 rounded-lg p-4">
              <p className="text-neutral-300 font-medium mb-2">Key MCP tools:</p>
              <div className="grid grid-cols-2 gap-1">
                {[
                  ["build_context_bundle", "Assemble AI briefing"],
                  ["write_document", "Create/update docs"],
                  ["propose_doc_update", "Safe edits via branch"],
                  ["search_documents", "Full-text search"],
                  ["get_canonical_context", "Source-of-truth docs"],
                  ["append_to_doc", "Add without overwriting"],
                  ["detect_stale_docs", "Find outdated docs"],
                  ["summarize_branch_diff", "Diff for PR descriptions"],
                ].map(([tool, desc]) => (
                  <div key={tool} className="flex gap-1.5">
                    <code className="text-blue-400 text-[10px]">{tool}</code>
                    <span className="text-[10px] text-neutral-600 truncate">{desc}</span>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={handleDone}
              className="w-full py-2.5 bg-blue-700 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Get Started
            </button>
          </div>
        </>
      )}
    </div>
  );
}
