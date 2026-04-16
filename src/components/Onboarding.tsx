"use client";

import { useEffect, useMemo, useState } from "react";
import { useVaultStore } from "@/stores/vaultStore";
import { useUIStore } from "@/stores/uiStore";
import * as commands from "@/lib/commands";
import type { McpServerStatus, RemoteConfig, TemplateInfo, VaultSettings } from "@/types";

type Step = "welcome" | "project" | "sync" | "agent" | "finish";
type TemplateConfigMap = Record<
  string,
  {
    label: string;
    folders: string[];
    files: Record<string, string>;
  }
>;

const STEPS: { id: Step; label: string }[] = [
  { id: "welcome", label: "Welcome" },
  { id: "project", label: "New Project" },
  { id: "sync", label: "Team Sync" },
  { id: "agent", label: "Agent Access" },
  { id: "finish", label: "Finish" },
];

const AGENT_COMMANDS = [
  {
    name: "Claude Code",
    command: "claude mcp add -s user slatevault -- slatevault-mcp",
    note: "Best for local coding sessions that should load trusted project context first.",
  },
  {
    name: "Codex / local agent",
    command: "Configure slatevault-mcp as an MCP server in your coding agent and point it at the active vault.",
    note: "Use when your agent should read canonical docs, recent changes, and task bundles from slateVault.",
  },
];

function StepRail({
  currentStep,
  onSelect,
  projectCreated,
}: {
  currentStep: Step;
  onSelect: (step: Step) => void;
  projectCreated: boolean;
}) {
  return (
    <div className="workspace-section rounded-3xl p-4">
      <p className="mb-4 text-[11px] font-medium uppercase tracking-[0.2em] text-neutral-500">
        Setup Flow
      </p>
      <div className="space-y-2">
        {STEPS.map((step, index) => {
          const isCurrent = currentStep === step.id;
          const isEnabled =
            step.id === "welcome" ||
            step.id === "project" ||
            projectCreated ||
            currentStep === step.id;
          return (
            <button
              key={step.id}
              onClick={() => {
                if (isEnabled) onSelect(step.id);
              }}
              disabled={!isEnabled}
              className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition-colors ${
                isCurrent
                  ? "border border-cyan-400/25 bg-cyan-950/40 text-white"
                  : isEnabled
                    ? "workspace-action text-neutral-400 hover:text-neutral-200"
                    : "cursor-not-allowed text-neutral-700"
              }`}
            >
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold ${
                  isCurrent
                    ? "bg-cyan-500 text-neutral-950"
                    : isEnabled
                      ? "bg-neutral-800 text-neutral-300"
                      : "bg-neutral-900 text-neutral-600"
                }`}
              >
                {index + 1}
              </span>
              <span className="text-sm font-medium">{step.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function Onboarding() {
  const createProject = useVaultStore((s) => s.createProject);
  const loadProjects = useVaultStore((s) => s.loadProjects);
  const loadStats = useVaultStore((s) => s.loadStats);
  const projects = useVaultStore((s) => s.projects);
  const vaultName = useVaultStore((s) => s.vaultName);
  const setWorkspaceView = useUIStore((s) => s.setWorkspaceView);
  const setShowOnboarding = useUIStore((s) => s.setShowOnboarding);

  const [step, setStep] = useState<Step>("welcome");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [workFolder, setWorkFolder] = useState<string | null>(null);
  const [templates, setTemplates] = useState<TemplateInfo[]>([]);
  const [templateConfig, setTemplateConfig] = useState<TemplateConfigMap>({});
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [remoteConfig, setRemoteConfig] = useState<RemoteConfig | null>(null);
  const [connectRemote, setConnectRemote] = useState(false);
  const [remoteUrl, setRemoteUrl] = useState("");
  const [remoteBranch, setRemoteBranch] = useState("main");
  const [pullOnOpen, setPullOnOpen] = useState(true);
  const [pushOnClose, setPushOnClose] = useState(false);
  const [vaultConfig, setVaultConfig] = useState<VaultSettings | null>(null);
  const [mcpStatus, setMcpStatus] = useState<McpServerStatus | null>(null);

  const projectCreated = projects.length > 0;

  useEffect(() => {
    commands
      .listTemplates()
      .then((t) => {
        setTemplates(t);
        const def = t.find((x) => x.is_default);
        if (def) setSelectedTemplate(def.name);
      })
      .catch(() => {});

    commands
      .getTemplatesConfig()
      .then((raw) => {
        const parsed = JSON.parse(raw) as { templates?: TemplateConfigMap };
        setTemplateConfig(parsed.templates ?? {});
      })
      .catch(() => {});

    commands
      .gitRemoteConfig()
      .then((config) => {
        setRemoteConfig(config);
        setRemoteUrl(config.remote_url || "");
        setRemoteBranch(config.remote_branch || "main");
        setPullOnOpen(config.pull_on_open);
        setPushOnClose(config.push_on_close);
        setConnectRemote(Boolean(config.remote_url));
      })
      .catch(() => {});

    commands
      .getVaultConfig()
      .then(setVaultConfig)
      .catch(() => {});

    const refreshMcpStatus = () => {
      commands
        .mcpServerStatus()
        .then(setMcpStatus)
        .catch(() => {});
    };
    refreshMcpStatus();
    const statusInterval = window.setInterval(refreshMcpStatus, 5000);

    return () => window.clearInterval(statusInterval);
  }, []);

  const selectedTemplateLabel = useMemo(
    () => templates.find((t) => t.name === selectedTemplate)?.label ?? "Software Project",
    [selectedTemplate, templates]
  );
  const selectedTemplateConfig = useMemo(
    () => templateConfig[selectedTemplate],
    [selectedTemplate, templateConfig]
  );
  const templatePreviewItems = useMemo(() => {
    if (!selectedTemplateConfig) {
      return [];
    }

    const folderItems = selectedTemplateConfig.folders.map((folder) => ({
      key: folder,
      label: `${folder}/`,
      tone: "folder" as const,
    }));
    const fileItems = Object.keys(selectedTemplateConfig.files)
      .sort()
      .slice(0, 6)
      .map((path) => ({
        key: path,
        label: path,
        tone: "file" as const,
      }));

    return [...folderItems, ...fileItems];
  }, [selectedTemplateConfig]);

  const goToNext = () => {
    const currentIndex = STEPS.findIndex((s) => s.id === step);
    const next = STEPS[currentIndex + 1];
    if (next) setStep(next.id);
  };

  const goToPrevious = () => {
    const currentIndex = STEPS.findIndex((s) => s.id === step);
    const previous = STEPS[currentIndex - 1];
    if (previous) setStep(previous.id);
  };

  const handleBrowseWorkFolder = async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const folder = await open({ directory: true, title: "Select work folder for this project" });
      if (folder) setWorkFolder(folder as string);
    } catch {}
  };

  const handleCreateProject = async () => {
    if (!projectName.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await createProject(
        projectName.trim(),
        projectDescription.trim() || undefined,
        undefined,
        selectedTemplate || undefined
      );
      if (workFolder) {
        await commands.setProjectSourceFolder(projectName.trim(), workFolder);
      }
      await loadProjects();
      await loadStats();
      setStep("sync");
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSync = async () => {
    setLoading(true);
    setError(null);
    try {
      await commands.gitSetRemoteConfig({
        remote_url: connectRemote ? remoteUrl.trim() || undefined : "",
        remote_branch: remoteBranch.trim() || "main",
        pull_on_open: pullOnOpen,
        push_on_close: pushOnClose,
      });
      const config = await commands.gitRemoteConfig();
      setRemoteConfig(config);
      setStep("agent");
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleFinish = async () => {
    await loadProjects();
    await loadStats();
    setShowOnboarding(false);
    setWorkspaceView("home");
  };

  return (
    <div className="workspace-page h-full overflow-y-auto px-6 py-6">
      <div className="mx-auto grid w-full max-w-6xl gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <StepRail
          currentStep={step}
          onSelect={setStep}
          projectCreated={projectCreated}
        />

        <div className="workspace-section rounded-3xl p-6">
          {step === "welcome" && (
            <div className="mx-auto max-w-3xl">
              <div className="workspace-kicker mb-4">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
                {vaultName || "slateVault"} is ready
              </div>
              <h1 className="workspace-label text-3xl font-semibold tracking-tight text-neutral-100">
                Project memory for software teams
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-400">
                Set up a project, decide how the vault should be shared,
                and optionally connect coding agents once your docs are in place.
              </p>

              <div className="mt-8 grid gap-4 md:grid-cols-3">
                <div className="workspace-subsection rounded-2xl p-4">
                  <div className="text-xs font-medium text-neutral-200">
                    Structured project docs
                  </div>
                  <p className="mt-2 text-[11px] leading-5 text-neutral-500">
                    Use a project template to start with architecture, decisions,
                    runbooks, and handoff docs.
                  </p>
                </div>
                <div className="workspace-subsection rounded-2xl p-4">
                  <div className="text-xs font-medium text-neutral-200">
                    Team sync through git
                  </div>
                  <p className="mt-2 text-[11px] leading-5 text-neutral-500">
                    Share the vault like a normal repo with branches, commits,
                    pull, push, and review workflows.
                  </p>
                </div>
                <div className="workspace-subsection rounded-2xl p-4">
                  <div className="text-xs font-medium text-neutral-200">
                    Trusted agent context
                  </div>
                  <p className="mt-2 text-[11px] leading-5 text-neutral-500">
                    Later, connect coding agents so they can read trusted docs
                    instead of relying on pasted prompts.
                  </p>
                </div>
              </div>

              <div className="mt-8 flex gap-3">
                <button
                  onClick={() => setStep("project")}
                  className="rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-cyan-500"
                >
                  Set up a project
                </button>
              </div>
            </div>
          )}

          {step === "project" && (
            <div className="mx-auto grid max-w-4xl gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
              <div>
                <h2 className="text-2xl font-semibold text-neutral-100">
                  Set up a new project
                </h2>
                <p className="mt-2 text-sm text-neutral-400">
                  Name it, pick a template, and optionally link a work folder so
                  terminals and AI chat know where your code lives.
                </p>

                <div className="mt-6 space-y-4">
                  <div>
                    <label className="mb-1.5 block text-xs text-neutral-400">
                      Project name
                    </label>
                    <input
                      type="text"
                      value={projectName}
                      onChange={(e) => setProjectName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void handleCreateProject();
                      }}
                      placeholder="my-project"
                    className="workspace-input w-full rounded-xl px-3 py-2.5 text-sm text-neutral-200 placeholder-neutral-600 outline-none focus:border-cyan-600"
                      autoFocus
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs text-neutral-400">
                      Description
                    </label>
                    <textarea
                      value={projectDescription}
                      onChange={(e) => setProjectDescription(e.target.value)}
                      rows={3}
                      placeholder="What is this project for?"
                      className="workspace-input w-full rounded-xl px-3 py-2.5 text-sm text-neutral-200 placeholder-neutral-600 outline-none focus:border-cyan-600"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-xs text-neutral-400">
                      Template
                    </label>
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
                          <span
                            className={`h-3.5 w-3.5 rounded-full border-2 ${
                              selectedTemplate === t.name
                                ? "border-cyan-400 bg-cyan-400"
                                : "border-neutral-600"
                            }`}
                          />
                          <span className="text-sm">{t.label}</span>
                          {t.is_default && (
                            <span className="ml-auto text-[10px] uppercase tracking-wide text-neutral-500">
                              Default
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs text-neutral-400">
                      Work folder{" "}
                      <span className="text-neutral-600">— optional</span>
                    </label>
                    <div className="flex gap-2">
                      <div className="workspace-input flex-1 truncate rounded-xl px-3 py-2.5 text-sm text-neutral-400">
                        {workFolder
                          ? workFolder.split("/").pop() || workFolder
                          : "No folder selected"}
                      </div>
                      {workFolder && (
                        <button
                          onClick={() => setWorkFolder(null)}
                          className="rounded-xl border border-neutral-700 px-3 py-2 text-xs text-neutral-500 hover:bg-neutral-800"
                          title="Clear"
                        >
                          ×
                        </button>
                      )}
                      <button
                        onClick={() => void handleBrowseWorkFolder()}
                        className="rounded-xl border border-neutral-700 px-3 py-2 text-xs text-neutral-300 transition-colors hover:bg-neutral-800"
                      >
                        Browse
                      </button>
                    </div>
                    <p className="mt-1.5 text-[10px] text-neutral-600">
                      Terminals and AI chat will default to this folder for this project.
                    </p>
                  </div>

                  {error && (
                    <div className="rounded-xl border border-red-900/40 bg-red-950/20 px-3 py-2 text-xs text-red-300">
                      {error}
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button
                      onClick={goToPrevious}
                      className="rounded-xl border border-neutral-700 px-4 py-2.5 text-sm text-neutral-300 transition-colors hover:bg-neutral-800"
                    >
                      Back
                    </button>
                    <button
                      onClick={() => void handleCreateProject()}
                      disabled={loading || !projectName.trim()}
                      className="rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-cyan-500 disabled:bg-neutral-800 disabled:text-neutral-500"
                    >
                      {loading ? "Creating..." : "Create project"}
                    </button>
                  </div>
                </div>
              </div>

              <div className="workspace-subsection rounded-2xl p-4">
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500">
                  Preview
                </p>
                <p className="mt-3 text-sm font-medium text-neutral-200">
                  {selectedTemplateLabel}
                </p>
                <div className="workspace-input mt-4 rounded-xl p-4 font-mono text-[11px] text-neutral-500">
                  {templatePreviewItems.length > 0 ? (
                    <>
                      {templatePreviewItems.map((item) => (
                        <div
                          key={item.key}
                          className={item.tone === "folder" ? "text-neutral-400" : "pl-3 text-neutral-600"}
                        >
                          {item.label}
                        </div>
                      ))}
                      {Object.keys(selectedTemplateConfig?.files ?? {}).length > 6 && (
                        <div className="pl-3 text-neutral-700">
                          ...{Object.keys(selectedTemplateConfig?.files ?? {}).length - 6} more starter files
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-neutral-600">
                      Minimal template starts empty so you can shape the project yourself.
                    </div>
                  )}
                </div>
                <p className="mt-4 text-[11px] leading-5 text-neutral-500">
                  This preview is pulled from the actual template config the project will use.
                </p>
              </div>
            </div>
          )}

          {step === "sync" && (
            <div className="mx-auto max-w-3xl">
              <h2 className="text-2xl font-semibold text-neutral-100">
                Connect team sync
              </h2>
              <p className="mt-2 text-sm text-neutral-400">
                Share the vault through git when you are ready. You can skip
                this now and configure it later.
              </p>

              <div className="mt-6 space-y-4">
                <label className="workspace-subsection flex items-center gap-3 rounded-2xl px-4 py-3 text-sm text-neutral-300">
                  <input
                    type="checkbox"
                    checked={connectRemote}
                    onChange={(e) => setConnectRemote(e.target.checked)}
                    className="rounded"
                  />
                  Connect a remote now
                </label>

                {connectRemote && (
                  <div className="workspace-subsection grid gap-4 rounded-2xl p-4 md:grid-cols-2">
                    <div className="md:col-span-2">
                      <label className="mb-1.5 block text-xs text-neutral-400">
                        Remote URL
                      </label>
                      <input
                        type="text"
                        value={remoteUrl}
                        onChange={(e) => setRemoteUrl(e.target.value)}
                        placeholder="https://github.com/your-team/your-vault.git"
                        className="workspace-input w-full rounded-xl px-3 py-2.5 text-sm text-neutral-200 placeholder-neutral-600 outline-none focus:border-cyan-600"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs text-neutral-400">
                        Branch
                      </label>
                      <input
                        type="text"
                        value={remoteBranch}
                        onChange={(e) => setRemoteBranch(e.target.value)}
                        className="workspace-input w-full rounded-xl px-3 py-2.5 text-sm text-neutral-200 outline-none focus:border-cyan-600"
                      />
                    </div>
                    <div className="space-y-3 pt-6">
                      <label className="flex items-center gap-2 text-xs text-neutral-400">
                        <input
                          type="checkbox"
                          checked={pullOnOpen}
                          onChange={(e) => setPullOnOpen(e.target.checked)}
                          className="rounded"
                        />
                        Pull on open
                      </label>
                      <label className="flex items-center gap-2 text-xs text-neutral-400">
                        <input
                          type="checkbox"
                          checked={pushOnClose}
                          onChange={(e) => setPushOnClose(e.target.checked)}
                          className="rounded"
                        />
                        Push on close
                      </label>
                    </div>
                  </div>
                )}

                <div className="workspace-subsection rounded-2xl p-4">
                  <p className="text-xs font-medium text-neutral-200">
                    Why this matters
                  </p>
                  <ul className="mt-3 space-y-2 text-[11px] leading-5 text-neutral-500">
                    <li>Your vault becomes a normal team repo for documentation.</li>
                    <li>You can branch, commit, push, pull, and review changes safely.</li>
                    <li>Keeping docs in git makes project memory easier to share and preserve.</li>
                  </ul>
                  {remoteConfig?.remote_url && (
                    <p className="mt-3 text-[11px] text-neutral-600">
                      Current remote: {remoteConfig.remote_url}
                    </p>
                  )}
                </div>

                {error && (
                  <div className="rounded-xl border border-red-900/40 bg-red-950/20 px-3 py-2 text-xs text-red-300">
                    {error}
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={goToPrevious}
                    className="rounded-xl border border-neutral-700 px-4 py-2.5 text-sm text-neutral-300 transition-colors hover:bg-neutral-800"
                  >
                    Back
                  </button>
                  <button
                    onClick={() => void handleSaveSync()}
                    disabled={loading || (connectRemote && !remoteUrl.trim())}
                    className="rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-cyan-500 disabled:bg-neutral-800 disabled:text-neutral-500"
                  >
                    {loading ? "Saving..." : "Continue"}
                  </button>
                  <button
                    onClick={() => setStep("agent")}
                    className="rounded-xl border border-neutral-700 px-4 py-2.5 text-sm text-neutral-300 transition-colors hover:bg-neutral-800"
                  >
                    Skip for now
                  </button>
                </div>
              </div>
            </div>
          )}

          {step === "agent" && (
            <div className="mx-auto max-w-4xl">
              <h2 className="text-2xl font-semibold text-neutral-100">
                Connect your coding agent
              </h2>
              <p className="mt-2 text-sm text-neutral-400">
                Agent access is optional. Connect it when you want coding tools
                to load trusted project context from this vault.
              </p>

              <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
                <div className="space-y-4">
                  {AGENT_COMMANDS.map((agent) => (
                    <div key={agent.name} className="workspace-subsection rounded-2xl p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className="text-sm font-medium text-neutral-200">
                            {agent.name}
                          </h3>
                          <p className="mt-1 text-[11px] leading-5 text-neutral-500">
                            {agent.note}
                          </p>
                        </div>
                        <button
                          onClick={() => navigator.clipboard.writeText(agent.command)}
                          className="rounded-lg border border-neutral-700 px-3 py-1.5 text-xs text-neutral-300 transition-colors hover:bg-neutral-800"
                        >
                          Copy
                        </button>
                      </div>
                      <code className="mt-3 block rounded-xl bg-neutral-950 px-3 py-3 text-[11px] text-cyan-300">
                        {agent.command}
                      </code>
                    </div>
                  ))}
                </div>

                <div className="space-y-4">
                  <div className="workspace-subsection rounded-2xl p-4">
                    <p className="text-xs font-medium text-neutral-200">
                      Built-in MCP server status
                    </p>
                    <div className="mt-3 flex items-center gap-2 text-sm text-neutral-300">
                      <span
                        className={`h-2.5 w-2.5 rounded-full ${
                          mcpStatus?.running
                            ? "bg-green-500"
                            : vaultConfig?.mcp_enabled
                              ? "bg-yellow-500"
                              : "bg-red-500"
                        }`}
                      />
                      {mcpStatus?.running
                        ? "Running in slateVault"
                        : vaultConfig?.mcp_enabled
                          ? "Enabled, but slateVault is not hosting a server process right now"
                          : "Disabled"}
                    </div>
                    <p className="mt-2 text-[11px] leading-5 text-neutral-500">
                      {vaultConfig?.mcp_enabled
                        ? `This only reflects the MCP server process started by slateVault${vaultConfig.mcp_port ? ` on port ${vaultConfig.mcp_port}` : ""}. If you already configured an external MCP client or wrapper, that can still be working even when this status stays yellow.`
                        : "Enable MCP later in settings when you want slateVault to host the local server itself."}
                    </p>
                  </div>

                  <div className="workspace-subsection rounded-2xl p-4">
                    <p className="text-xs font-medium text-neutral-200">
                      How agent access stays safe
                    </p>
                    <ul className="mt-3 space-y-2 text-[11px] leading-5 text-neutral-500">
                      <li>Canonical docs are the best place for agents to start.</li>
                      <li>Protected docs should use proposal-based updates instead of direct overwrite.</li>
                      <li>Your vault remains the team&apos;s source of truth, not the agent.</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex gap-3">
                <button
                  onClick={goToPrevious}
                  className="rounded-xl border border-neutral-700 px-4 py-2.5 text-sm text-neutral-300 transition-colors hover:bg-neutral-800"
                >
                  Back
                </button>
                <button
                  onClick={() => setStep("finish")}
                  className="rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-cyan-500"
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {step === "finish" && (
            <div className="mx-auto max-w-3xl text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-cyan-950/40 text-cyan-300">
                <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
              </div>
              <h2 className="text-2xl font-semibold text-neutral-100">
                You&apos;re ready to start
              </h2>
              <p className="mt-3 text-sm leading-6 text-neutral-400">
                Your vault now has a project, optional sync settings, and a clear
                path to agent access later. Next, review your starter docs and
                decide which ones should become canonical.
              </p>

              <div className="mt-8 grid gap-4 md:grid-cols-3">
                <button
                  onClick={() => {
                    setShowOnboarding(false);
                    setWorkspaceView("documents");
                  }}
                  className="workspace-action rounded-2xl px-4 py-4 text-left transition-colors"
                >
                  <div className="text-sm font-medium text-neutral-200">
                    Open project workspace
                  </div>
                  <div className="mt-1 text-[11px] leading-5 text-neutral-500">
                    Start editing the docs you just created.
                  </div>
                </button>
                <button
                  onClick={() => {
                    setShowOnboarding(false);
                    setWorkspaceView("home");
                  }}
                  className="workspace-action rounded-2xl px-4 py-4 text-left transition-colors"
                >
                  <div className="text-sm font-medium text-neutral-200">
                    Go to vault home
                  </div>
                  <div className="mt-1 text-[11px] leading-5 text-neutral-500">
                    See your vault overview and next actions.
                  </div>
                </button>
                <button
                  onClick={() => {
                    setShowOnboarding(false);
                    setWorkspaceView("search");
                  }}
                  className="workspace-action rounded-2xl px-4 py-4 text-left transition-colors"
                >
                  <div className="text-sm font-medium text-neutral-200">
                    Search the vault
                  </div>
                  <div className="mt-1 text-[11px] leading-5 text-neutral-500">
                    Jump straight into discovery and navigation.
                  </div>
                </button>
              </div>

              <div className="mt-8">
                <button
                  onClick={() => void handleFinish()}
                  className="rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-cyan-500"
                >
                  Finish setup
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
