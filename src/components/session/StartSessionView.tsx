"use client";

import { useEffect, useState } from "react";
import { useVaultStore } from "@/stores/vaultStore";
import { useSessionStore, SESSION_PRESETS, buildMcpUseText } from "@/stores/sessionStore";
import { useEditorStore } from "@/stores/editorStore";
import * as commands from "@/lib/commands";
import { copyToClipboard } from "@/lib/clipboard";
import type { DocumentInfo, PlaybookInfo } from "@/types";

interface ProjectStructureInfo {
  substantiveDocCount: number;
  totalDocCount: number;
  folders: string[];
  hasCanonical: boolean;
  hasChangelog: boolean;
  hasSpecs: boolean;
  hasDecisions: boolean;
  hasNotes: boolean;
}

function buildProjectStructureInfo(
  docs: DocumentInfo[],
  folderOrder: string[]
): ProjectStructureInfo {
  const substantiveDocs = docs.filter(
    (doc) => !doc.path.endsWith("/_about.md") && doc.path !== "_about.md"
  );
  const actualFolders = substantiveDocs
    .map((doc) => doc.path.split("/")[0] ?? "")
    .filter(Boolean);
  const mergedFolders: string[] = [];

  for (const folder of actualFolders) {
    if (folder && !mergedFolders.includes(folder)) {
      mergedFolders.push(folder);
    }
  }

  for (const folder of folderOrder) {
    if (!mergedFolders.includes(folder)) {
      mergedFolders.push(folder);
    }
  }

  return {
    substantiveDocCount: substantiveDocs.length,
    totalDocCount: docs.length,
    folders: mergedFolders,
    hasCanonical: substantiveDocs.some((doc) => doc.canonical),
    hasChangelog: mergedFolders.includes("changelog"),
    hasSpecs: mergedFolders.includes("specs"),
    hasDecisions: mergedFolders.includes("decisions"),
    hasNotes: mergedFolders.includes("notes"),
  };
}

function getPlaybookFit(
  playbookId: string,
  structure: ProjectStructureInfo | null
): { label: string; note: string } {
  if (!structure) {
    return {
      label: "Project context pending",
      note: "Pick a project first so this playbook can adapt to its docs and folder structure.",
    };
  }

  switch (playbookId) {
    case "document-as-you-go":
      return structure.substantiveDocCount === 0
        ? {
            label: "Greenfield fit",
            note: "Good for a new project where docs will be created alongside implementation.",
          }
        : {
            label: "Active project fit",
            note: "Good when you want decisions, specs, and changes captured continuously as work happens.",
          };
    case "reverse-engineer":
      return structure.substantiveDocCount === 0
        ? {
            label: "Needs existing implementation",
            note: "Best once there is real code or undocumented structure to analyze.",
          }
        : {
            label: "Strong fit",
            note: "Useful when the project already has implementation detail but documentation still needs to catch up.",
          };
    case "resume-session":
      return structure.substantiveDocCount < 3
        ? {
            label: "Limited history",
            note: "This works better once the project has a bit more documentation or recent change history.",
          }
        : {
            label: "Good fit",
            note: "The current docs and change history should give an agent enough signal to resume work cleanly.",
          };
    case "code-review-docs":
      return {
        label: structure.hasChangelog ? "Good fit" : "Will bootstrap review trail",
        note: structure.hasChangelog
          ? "This project already has a changelog area, so review summaries have a clear home."
          : "This can still work, but it will likely be creating the review documentation trail from scratch.",
      };
    default:
      return {
        label: structure.hasCanonical ? "Project-aware" : "Useful, but may create new structure",
        note: structure.hasCanonical
          ? "This project has enough structure for a more opinionated kickoff."
          : "This project still looks early, so this playbook may create some of the structure it expects.",
      };
  }
}

export function StartSessionView() {
  const projects = useVaultStore((s) => s.projects);
  const selectedProject = useSessionStore((s) => s.selectedProject);
  const taskPrompt = useSessionStore((s) => s.taskPrompt);
  const includeCanonical = useSessionStore((s) => s.includeCanonical);
  const includeRecentChanges = useSessionStore((s) => s.includeRecentChanges);
  const includeSourceFolder = useSessionStore((s) => s.includeSourceFolder);
  const includeStaleWarnings = useSessionStore((s) => s.includeStaleWarnings);
  const projectBrief = useSessionStore((s) => s.projectBrief);
  const recommendedDocs = useSessionStore((s) => s.recommendedDocs);
  const recentChanges = useSessionStore((s) => s.recentChanges);
  const sourceFolder = useSessionStore((s) => s.sourceFolder);
  const loading = useSessionStore((s) => s.loading);
  const error = useSessionStore((s) => s.error);
  const hasGenerated = useSessionStore((s) => s.hasGenerated);
  const setSelectedProject = useSessionStore((s) => s.setSelectedProject);
  const setTaskPrompt = useSessionStore((s) => s.setTaskPrompt);
  const setIncludeCanonical = useSessionStore((s) => s.setIncludeCanonical);
  const setIncludeRecentChanges = useSessionStore((s) => s.setIncludeRecentChanges);
  const setIncludeSourceFolder = useSessionStore((s) => s.setIncludeSourceFolder);
  const setIncludeStaleWarnings = useSessionStore((s) => s.setIncludeStaleWarnings);
  const applyPreset = useSessionStore((s) => s.applyPreset);
  const generateSession = useSessionStore((s) => s.generateSession);
  const buildExportText = useSessionStore((s) => s.buildExportText);
  const openDocument = useEditorStore((s) => s.openDocument);
  const [playbooks, setPlaybooks] = useState<PlaybookInfo[]>([]);
  const [playbooksLoading, setPlaybooksLoading] = useState(true);
  const [copiedPlaybookId, setCopiedPlaybookId] = useState<string | null>(null);
  const [copiedBrief, setCopiedBrief] = useState(false);
  const [copiedMcpUse, setCopiedMcpUse] = useState(false);
  const [projectStructure, setProjectStructure] =
    useState<ProjectStructureInfo | null>(null);
  const [projectStructureLoading, setProjectStructureLoading] = useState(false);
  const currentProject =
    projects.find((project) => project.name === selectedProject) ?? null;
  const mcpUseText = buildMcpUseText(selectedProject);

  useEffect(() => {
    if (projects.length === 0) {
      return;
    }

    const selectedStillExists = projects.some(
      (project) => project.name === selectedProject
    );

    if (!selectedProject || !selectedStillExists) {
      setSelectedProject(projects[0].name);
    }
  }, [projects, selectedProject, setSelectedProject]);

  useEffect(() => {
    commands
      .listPlaybooks()
      .then((items) => setPlaybooks(items))
      .catch(() => setPlaybooks([]))
      .finally(() => setPlaybooksLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedProject) {
      setProjectStructure(null);
      return;
    }

    setProjectStructureLoading(true);
    commands
      .listDocuments(selectedProject)
      .then((docs) =>
        setProjectStructure(
          buildProjectStructureInfo(docs, currentProject?.folder_order ?? [])
        )
      )
      .catch(() =>
        setProjectStructure(
          buildProjectStructureInfo([], currentProject?.folder_order ?? [])
        )
      )
      .finally(() => setProjectStructureLoading(false));
  }, [selectedProject, currentProject]);

  const handleCopy = async () => {
    await copyToClipboard(buildExportText());
    setCopiedBrief(true);
    window.setTimeout(() => setCopiedBrief(false), 1800);
  };

  const handleGenerateAndCopy = async () => {
    await generateSession();
    const nextState = useSessionStore.getState();
    if (nextState.error || !nextState.hasGenerated) {
      return;
    }
    await copyToClipboard(nextState.buildExportText());
    setCopiedBrief(true);
    window.setTimeout(() => setCopiedBrief(false), 1800);
  };

  const handleCopyPlaybook = async (playbookId: string) => {
    if (!selectedProject) return;
    try {
      const prompt = await commands.getPlaybookPrompt(playbookId, selectedProject);
      await copyToClipboard(prompt);
      setCopiedPlaybookId(playbookId);
      window.setTimeout(() => setCopiedPlaybookId(null), 1800);
    } catch (error) {
      console.error("Playbook copy failed:", error);
    }
  };

  const handleCopyMcpUse = async () => {
    await copyToClipboard(mcpUseText);
    setCopiedMcpUse(true);
    window.setTimeout(() => setCopiedMcpUse(false), 1800);
  };

  return (
    <div className="workspace-page h-full min-w-0 flex-1 overflow-y-auto bg-neutral-950 px-6 py-6">
      <div className="flex w-full flex-col gap-6">
        <div className="workspace-hero flex flex-col gap-4 rounded-3xl p-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <div className="workspace-kicker">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
              Prepare trusted project context
            </div>
            <h1 className="workspace-label text-3xl font-semibold tracking-tight text-neutral-100">
              Start Session
            </h1>
            <p className="mt-2 text-sm leading-6 text-neutral-400">
              Generate a project brief, review recommended docs, and copy a clean
              context package into your coding agent before implementation work starts.
            </p>
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 px-4 py-4">
                <div className="text-xs font-medium text-neutral-200">1. Pick the project</div>
                <div className="mt-1 text-[11px] leading-5 text-neutral-500">
                  Choose the vault project that should anchor the session.
                </div>
              </div>
              <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 px-4 py-4">
                <div className="text-xs font-medium text-neutral-200">2. Describe the task</div>
                <div className="mt-1 text-[11px] leading-5 text-neutral-500">
                  Give the brief enough direction to bias reading and recommendations.
                </div>
              </div>
              <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 px-4 py-4">
                <div className="text-xs font-medium text-neutral-200">3. Generate the brief</div>
                <div className="mt-1 text-[11px] leading-5 text-neutral-500">
                  Generate the session brief, then paste it into your coding agent.
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="surface-card-strong rounded-3xl p-5">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-neutral-100">
                Session setup
              </h2>
              <p className="mt-1 text-xs text-neutral-500">
                Start here. Pick the project first, then the rest of the session helpers will adapt to that project.
              </p>
            </div>
            <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 px-4 py-3 text-[11px] leading-5 text-neutral-500">
              {projectStructureLoading
                ? "Reading project structure..."
                : currentProject
                  ? `${currentProject.name}${projectStructure ? ` • ${projectStructure.substantiveDocCount} docs across ${projectStructure.folders.length} folders` : ""}`
                  : "Pick a project to load context-aware guidance."}
            </div>
          </div>

          <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(260px,320px)]">
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-neutral-500">
                  Project
                </label>
                <select
                  value={selectedProject}
                  onChange={(e) => setSelectedProject(e.target.value)}
                  className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2.5 text-sm text-neutral-200 outline-none focus:border-cyan-600"
                >
                  {projects.map((project) => (
                    <option key={project.name} value={project.name}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-neutral-500">
                  Task prompt
                </label>
                <textarea
                  value={taskPrompt}
                  onChange={(e) => setTaskPrompt(e.target.value)}
                  rows={5}
                  placeholder="Authentication refactor, release workflow cleanup, PDF export investigation..."
                  className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2.5 text-sm text-neutral-200 placeholder-neutral-600 outline-none focus:border-cyan-600"
                />
              </div>

              <div>
                <div className="mb-2 block text-[11px] font-medium uppercase tracking-wide text-neutral-500">
                  Quick presets
                </div>
                <div className="flex flex-wrap gap-2">
                  {SESSION_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => applyPreset(preset)}
                      className="rounded-full border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-[11px] text-neutral-300 transition-colors hover:border-neutral-600 hover:bg-neutral-900"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4">
              <div className="mb-2 block text-[11px] font-medium uppercase tracking-wide text-neutral-500">
                Include
              </div>
              <div className="space-y-2 text-sm text-neutral-400">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={includeCanonical}
                    onChange={(e) => setIncludeCanonical(e.target.checked)}
                    className="rounded"
                  />
                  Canonical docs
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={includeRecentChanges}
                    onChange={(e) => setIncludeRecentChanges(e.target.checked)}
                    className="rounded"
                  />
                  Recent changes
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={includeSourceFolder}
                    onChange={(e) => setIncludeSourceFolder(e.target.checked)}
                    className="rounded"
                  />
                  Linked source folder
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={includeStaleWarnings}
                    onChange={(e) => setIncludeStaleWarnings(e.target.checked)}
                    className="rounded"
                  />
                  Attention warnings
                </label>
              </div>
              <div className="mt-4 rounded-xl border border-neutral-800 bg-neutral-900/70 px-3 py-3 text-[11px] leading-5 text-neutral-500">
                Include only the context your agent actually needs. Smaller, task-shaped briefs usually produce better work than dumping the whole vault.
              </div>
              <div className="mt-3 rounded-xl border border-cyan-900/40 bg-cyan-950/20 px-3 py-3 text-[11px] leading-5 text-cyan-100/80">
                Global Wiki is always part of session hygiene: agents should check vault-wide AI rules, coding standards, and documentation style before substantial work.
              </div>
            </div>
          </div>

          <div className="mt-5">
            <button
              onClick={() => void handleGenerateAndCopy()}
              disabled={loading || !selectedProject}
              className="w-full rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-cyan-500 disabled:bg-neutral-800 disabled:text-neutral-500"
            >
              {loading
                ? "Generating..."
                : copiedBrief
                  ? "Copied"
                  : "Generate Session Brief"}
            </button>

            {error && (
              <div className="mt-3 rounded-xl border border-red-900/40 bg-red-950/20 px-3 py-2 text-xs text-red-300">
                {error}
              </div>
            )}
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
          <div className="space-y-4">
            <div className="surface-card-strong rounded-3xl p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-neutral-100">
                    MCP Use
                  </h2>
                  <p className="mt-1 text-xs text-neutral-500">
                    Project-specific SlateVault rules plus global Wiki guidance to paste before the task prompt.
                  </p>
                </div>
                <button
                  onClick={() => void handleCopyMcpUse()}
                  className="rounded-xl border border-neutral-700 px-3 py-2 text-xs text-neutral-300 transition-colors hover:bg-neutral-800"
                >
                  {copiedMcpUse ? "Copied" : "Copy"}
                </button>
              </div>
              <pre className="mt-4 overflow-x-auto whitespace-pre-wrap rounded-2xl bg-neutral-950 p-4 text-xs leading-6 text-neutral-300">
                {mcpUseText}
              </pre>
            </div>

            {hasGenerated && !loading && (
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
                <div className="surface-card-strong rounded-3xl p-5">
                  <h3 className="text-base font-semibold text-neutral-100">
                    Recommended reading
                  </h3>
                  <div className="mt-4 space-y-3">
                    {recommendedDocs.length === 0 ? (
                      <p className="text-xs text-neutral-500">
                        No recommended docs yet.
                      </p>
                    ) : (
                      recommendedDocs.map((doc) => (
                        <button
                          key={doc.path}
                          onClick={() => void openDocument(selectedProject, doc.path)}
                          className="w-full rounded-2xl border border-neutral-800 bg-neutral-950/60 px-4 py-3 text-left transition-colors hover:border-neutral-700 hover:bg-neutral-900"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-neutral-200">
                              {doc.title}
                            </span>
                            {doc.canonical && (
                              <span className="rounded-full bg-cyan-950/40 px-2 py-0.5 text-[10px] text-cyan-300">
                                Canonical
                              </span>
                            )}
                          </div>
                          <div className="mt-1 text-[11px] text-neutral-500">
                            {doc.path}
                          </div>
                          <div className="mt-2 text-[11px] leading-5 text-neutral-500">
                            {doc.reason}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>

                <div className="surface-card-strong rounded-3xl p-5">
                  <h3 className="text-base font-semibold text-neutral-100">
                    Recent changes
                  </h3>
                  <div className="mt-4 space-y-3">
                    {recentChanges.length === 0 ? (
                      <p className="text-xs text-neutral-500">
                        No recent changes included.
                      </p>
                    ) : (
                      recentChanges.map((change) => (
                        <div
                          key={`${change.project}/${change.path}/${change.modified}`}
                          className="rounded-2xl border border-neutral-800 bg-neutral-950/60 px-4 py-3"
                        >
                          <div className="text-sm font-medium text-neutral-200">
                            {change.title}
                          </div>
                          <div className="mt-1 text-[11px] text-neutral-500">
                            {change.path}
                          </div>
                          <div className="mt-2 text-[11px] text-neutral-600">
                            {change.author} - {new Date(change.modified).toLocaleString()}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="surface-card-strong rounded-3xl p-5">
              <h2 className="text-lg font-semibold text-neutral-100">
                Session playbooks
              </h2>
              <p className="mt-1 text-xs text-neutral-500">
                These kickoff prompts now key off the selected project and should be read as project-aware starting points, not generic boilerplate.
              </p>
              <div className="mt-4 rounded-2xl border border-neutral-800 bg-neutral-950/60 px-4 py-4">
                <div className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">
                  Selected project
                </div>
                <div className="mt-2 text-sm text-neutral-200">
                  {selectedProject || "No project selected"}
                </div>
                <div className="mt-1 text-[11px] leading-5 text-neutral-500">
                  {projectStructureLoading
                    ? "Reading docs and folders..."
                    : projectStructure
                      ? `${projectStructure.substantiveDocCount} substantive docs across ${projectStructure.folders.length} folders`
                      : "Pick a project to tailor these playbooks."}
                </div>
                {!!projectStructure?.folders.length && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {projectStructure.folders.slice(0, 8).map((folder) => (
                      <span
                        key={folder}
                        className="rounded-full border border-neutral-700 bg-neutral-900 px-2.5 py-1 text-[10px] text-neutral-400"
                      >
                        {folder}/
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="mt-4 space-y-2">
                {playbooksLoading ? (
                  <div className="text-xs text-neutral-500">Loading playbooks...</div>
                ) : playbooks.length === 0 ? (
                  <div className="text-xs text-neutral-500">No playbooks available.</div>
                ) : (
                  playbooks.slice(0, 4).map((playbook) => {
                    const fit = getPlaybookFit(playbook.id, projectStructure);
                    return (
                      <div
                        key={playbook.id}
                        className="rounded-xl border border-neutral-800 bg-neutral-900/70 px-3 py-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-xs font-medium text-neutral-200">
                              {playbook.label}
                            </div>
                            <div className="mt-1 text-[11px] leading-5 text-neutral-500">
                              {playbook.description}
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <span className="rounded-full border border-cyan-900/60 bg-cyan-950/30 px-2 py-0.5 text-[10px] text-cyan-300">
                                {fit.label}
                              </span>
                              <span className="text-[10px] leading-5 text-neutral-500">
                                {fit.note}
                              </span>
                            </div>
                          </div>
                          <button
                            onClick={() => void handleCopyPlaybook(playbook.id)}
                            disabled={!selectedProject}
                            className="rounded-lg border border-neutral-700 px-2.5 py-1 text-[10px] text-neutral-300 transition-colors hover:bg-neutral-800 disabled:border-neutral-800 disabled:text-neutral-600"
                          >
                            {copiedPlaybookId === playbook.id ? "Copied" : "Copy"}
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {loading && (
              <div className="surface-card-strong rounded-3xl p-6">
                <h2 className="text-lg font-semibold text-neutral-100">
                  Assembling session brief
                </h2>
                <div className="mt-4 space-y-2 text-sm text-neutral-500">
                  <div>Loading project context</div>
                  <div>Checking canonical docs</div>
                  <div>Reviewing recent changes</div>
                  <div>Assembling session brief</div>
                </div>
              </div>
            )}

            {!hasGenerated && !loading && (
              <div className="rounded-3xl border border-neutral-800 bg-neutral-900/70 p-5">
                <h3 className="text-base font-semibold text-neutral-100">
                  What this gives you
                </h3>
                <div className="mt-4 space-y-2 text-xs leading-5 text-neutral-500">
                  <p>A concise project brief instead of an empty prompt box.</p>
                  <p>Recommended docs to read before implementation or review work.</p>
                  <p>Recent changes so the next coding session starts from the current project state.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
