"use client";

import { useEffect, useState } from "react";
import { useVaultStore } from "@/stores/vaultStore";
import { useUIStore } from "@/stores/uiStore";
import * as commands from "@/lib/commands";
import { copyToClipboard } from "@/lib/clipboard";
import {
  detectMcpPlatform,
  getMcpInstallNote,
  getMcpSetupCards,
  type McpPlatform,
} from "@/lib/mcpSetup";
import { setSkipOnboarding, shouldSkipOnboarding } from "@/lib/onboardingPrefs";
import { CreateProjectForm } from "@/components/shared/CreateProjectForm";
import type { McpServerStatus, RemoteConfig, VaultSettings } from "@/types";

type Step = "welcome" | "project" | "sync" | "agent" | "finish";

const STEPS: { id: Step; label: string }[] = [
  { id: "welcome", label: "Welcome" },
  { id: "project", label: "New Project" },
  { id: "sync",    label: "Team Sync" },
  { id: "agent",   label: "Agent Access" },
  { id: "finish",  label: "Finish" },
];

function StepRail({
  currentStep,
  onSelect,
  projectCreated,
  skipOnStartup,
  onSkipOnStartupChange,
}: {
  currentStep: Step;
  onSelect: (step: Step) => void;
  projectCreated: boolean;
  skipOnStartup: boolean;
  onSkipOnStartupChange: (skip: boolean) => void;
}) {
  return (
    <div className="panel rounded-2xl p-4">
      <p style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.14em", color: "var(--text-faint)", marginBottom: 12 }}>
        Setup Flow
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {STEPS.map((s, i) => {
          const isCurrent = currentStep === s.id;
          const isEnabled = s.id === "welcome" || s.id === "project" || projectCreated || currentStep === s.id;
          return (
            <button
              key={s.id}
              onClick={() => { if (isEnabled) onSelect(s.id); }}
              disabled={!isEnabled}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 10px",
                borderRadius: "var(--radius)",
                border: isCurrent ? "1px solid color-mix(in srgb, var(--accent) 30%, var(--border))" : "1px solid transparent",
                background: isCurrent ? "var(--accent-soft)" : "transparent",
                color: isCurrent ? "var(--accent)" : isEnabled ? "var(--text-muted)" : "var(--text-faint)",
                textAlign: "left",
                cursor: isEnabled ? "pointer" : "not-allowed",
                fontWeight: 500,
                fontSize: 13,
              }}
            >
              <span style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                width: 24, height: 24, borderRadius: "50%", flexShrink: 0,
                fontSize: 11, fontWeight: 600,
                background: isCurrent ? "var(--accent)" : "var(--bg-subtle)",
                color: isCurrent ? "var(--accent-fg)" : "var(--text-muted)",
              }}>
                {i + 1}
              </span>
              {s.label}
            </button>
          );
        })}
      </div>
      <label style={{
        display: "flex", alignItems: "flex-start", gap: 8,
        marginTop: 16, paddingTop: 12,
        borderTop: "1px solid var(--border-subtle)",
        fontSize: 11, color: "var(--text-muted)", cursor: "pointer",
      }}>
        <input
          type="checkbox"
          checked={skipOnStartup}
          onChange={(e) => onSkipOnStartupChange(e.target.checked)}
          style={{ marginTop: 1 }}
        />
        <span>Don&apos;t show this on startup</span>
      </label>
    </div>
  );
}

export function Onboarding() {
  const loadProjects = useVaultStore((s) => s.loadProjects);
  const loadStats = useVaultStore((s) => s.loadStats);
  const projects = useVaultStore((s) => s.projects);
  const vaultName = useVaultStore((s) => s.vaultName);
  const setWorkspaceView = useUIStore((s) => s.setWorkspaceView);
  const setShowOnboarding = useUIStore((s) => s.setShowOnboarding);

  const [step, setStep] = useState<Step>("welcome");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remoteConfig, setRemoteConfig] = useState<RemoteConfig | null>(null);
  const [connectRemote, setConnectRemote] = useState(false);
  const [remoteUrl, setRemoteUrl] = useState("");
  const [remoteBranch, setRemoteBranch] = useState("main");
  const [pullOnOpen, setPullOnOpen] = useState(true);
  const [pushOnClose, setPushOnClose] = useState(false);
  const [vaultConfig, setVaultConfig] = useState<VaultSettings | null>(null);
  const [mcpStatus, setMcpStatus] = useState<McpServerStatus | null>(null);
  const [platform, setPlatform] = useState<McpPlatform>("unknown");
  const [skipOnStartup, setSkipOnStartupState] = useState(() => shouldSkipOnboarding());

  const projectCreated = projects.length > 0;
  const agentCommands = getMcpSetupCards(platform);

  useEffect(() => {
    setPlatform(detectMcpPlatform());
    commands.gitRemoteConfig().then((config) => {
      setRemoteConfig(config);
      setRemoteUrl(config.remote_url || "");
      setRemoteBranch(config.remote_branch || "main");
      setPullOnOpen(config.pull_on_open);
      setPushOnClose(config.push_on_close);
      setConnectRemote(Boolean(config.remote_url));
    }).catch(() => {});
    commands.getVaultConfig().then(setVaultConfig).catch(() => {});
    const refresh = () => commands.mcpServerStatus().then(setMcpStatus).catch(() => {});
    refresh();
    const iv = window.setInterval(refresh, 5000);
    return () => window.clearInterval(iv);
  }, []);

  const goToPrevious = () => {
    const i = STEPS.findIndex((s) => s.id === step);
    if (STEPS[i - 1]) setStep(STEPS[i - 1].id);
  };

  const handleProjectCreated = async (name: string) => {
    await loadProjects();
    await loadStats();
    setStep("sync");
    void name;
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
    setWorkspaceView("documents");
  };

  const handleSkipOnStartupChange = (skip: boolean) => {
    setSkipOnStartupState(skip);
    setSkipOnboarding(skip);
  };

  return (
    <div className="workspace-page" style={{ height: "100%", minWidth: 0, flex: 1, overflowY: "auto", padding: "24px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "240px minmax(0,1fr)", gap: 20, maxWidth: 960, width: "100%" }}>
        <StepRail
          currentStep={step}
          onSelect={setStep}
          projectCreated={projectCreated}
          skipOnStartup={skipOnStartup}
          onSkipOnStartupChange={handleSkipOnStartupChange}
        />

        <div className="panel" style={{ borderRadius: "var(--radius-lg)", padding: 24 }}>

          {/* ── Welcome ── */}
          {step === "welcome" && (
            <div style={{ maxWidth: 640 }}>
              <div className="chip accent" style={{ marginBottom: 14 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent)", flexShrink: 0 }} />
                {vaultName || "slateVault"} is ready
              </div>
              <h1 style={{ fontSize: 26, fontWeight: 600, letterSpacing: "-0.02em", color: "var(--text)", margin: 0 }}>
                Project memory for software teams
              </h1>
              <p style={{ marginTop: 10, fontSize: 13.5, lineHeight: 1.65, color: "var(--text-muted)" }}>
                Set up a project, decide how the vault should be shared,
                and optionally connect coding agents once your docs are in place.
              </p>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginTop: 24 }}>
                {[
                  { title: "Structured project docs", body: "Use a project template to start with architecture, decisions, runbooks, and handoff docs." },
                  { title: "Team sync through git", body: "Share the vault like a normal repo — branches, commits, pull, push, and review workflows." },
                  { title: "Trusted agent context", body: "Connect coding agents so they read trusted docs instead of relying on pasted prompts." },
                ].map((card) => (
                  <div key={card.title} className="workspace-subsection" style={{ borderRadius: "var(--radius)", padding: 14 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}>{card.title}</div>
                    <p style={{ marginTop: 6, fontSize: 11.5, lineHeight: 1.55, color: "var(--text-muted)" }}>{card.body}</p>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 24 }}>
                <button className="btn primary" style={{ height: 34, fontSize: 13, padding: "0 18px" }} onClick={() => setStep("project")}>
                  Set up a project
                </button>
              </div>
            </div>
          )}

          {/* ── Project ── */}
          {step === "project" && (
            <div style={{ maxWidth: 680 }}>
              <h2 style={{ fontSize: 20, fontWeight: 600, color: "var(--text)", margin: 0 }}>Set up a new project</h2>
              <p style={{ marginTop: 6, marginBottom: 20, fontSize: 13, color: "var(--text-muted)" }}>
                Name it, pick a template, and optionally link a source folder so
                terminals and AI chat know where your code lives.
              </p>
              <CreateProjectForm
                onCreated={handleProjectCreated}
                onBack={goToPrevious}
                showPreview
              />
            </div>
          )}

          {/* ── Sync ── */}
          {step === "sync" && (
            <div style={{ maxWidth: 560 }}>
              <h2 style={{ fontSize: 20, fontWeight: 600, color: "var(--text)", margin: 0 }}>Connect team sync</h2>
              <p style={{ marginTop: 6, fontSize: 13, color: "var(--text-muted)" }}>
                Share the vault through git when you are ready. You can skip this and configure it later.
              </p>

              <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 12 }}>
                <label className="workspace-subsection" style={{ display: "flex", alignItems: "center", gap: 10, borderRadius: "var(--radius)", padding: "10px 14px", fontSize: 13, color: "var(--text)", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={connectRemote}
                    onChange={(e) => setConnectRemote(e.target.checked)}
                  />
                  Connect a remote now
                </label>

                {connectRemote && (
                  <div className="workspace-subsection" style={{ borderRadius: "var(--radius)", padding: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div style={{ gridColumn: "1/-1" }}>
                      <label style={{ display: "block", fontSize: 11.5, color: "var(--text-muted)", marginBottom: 6 }}>Remote URL</label>
                      <input
                        type="text"
                        value={remoteUrl}
                        onChange={(e) => setRemoteUrl(e.target.value)}
                        placeholder="https://github.com/your-team/your-vault.git"
                        className="workspace-input"
                        style={{ width: "100%", borderRadius: "var(--radius-sm)", padding: "8px 10px", fontSize: 12.5 }}
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: 11.5, color: "var(--text-muted)", marginBottom: 6 }}>Branch</label>
                      <input
                        type="text"
                        value={remoteBranch}
                        onChange={(e) => setRemoteBranch(e.target.value)}
                        className="workspace-input"
                        style={{ width: "100%", borderRadius: "var(--radius-sm)", padding: "8px 10px", fontSize: 12.5 }}
                      />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingTop: 20 }}>
                      {[
                        { label: "Pull on open", val: pullOnOpen, set: setPullOnOpen },
                        { label: "Push on close", val: pushOnClose, set: setPushOnClose },
                      ].map(({ label, val, set }) => (
                        <label key={label} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--text-muted)", cursor: "pointer" }}>
                          <input type="checkbox" checked={val} onChange={(e) => set(e.target.checked)} />
                          {label}
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                <div className="workspace-subsection" style={{ borderRadius: "var(--radius)", padding: 14 }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}>Why this matters</p>
                  <ul style={{ marginTop: 8, paddingLeft: 16, display: "flex", flexDirection: "column", gap: 6, fontSize: 11.5, color: "var(--text-muted)", lineHeight: 1.55 }}>
                    <li>Your vault becomes a normal team repo for documentation.</li>
                    <li>You can branch, commit, push, pull, and review changes safely.</li>
                    <li>Keeping docs in git makes project memory easier to share and preserve.</li>
                  </ul>
                  {remoteConfig?.remote_url && (
                    <p style={{ marginTop: 8, fontSize: 11, color: "var(--text-faint)" }}>Current remote: {remoteConfig.remote_url}</p>
                  )}
                </div>

                {error && (
                  <div style={{ borderRadius: "var(--radius-sm)", border: "1px solid color-mix(in srgb, var(--danger) 30%, var(--border))", background: "var(--danger-soft)", padding: "8px 12px", fontSize: 12, color: "var(--danger)" }}>
                    {error}
                  </div>
                )}

                <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                  <button className="btn" onClick={goToPrevious}>Back</button>
                  <button
                    className="btn primary"
                    onClick={() => void handleSaveSync()}
                    disabled={loading || (connectRemote && !remoteUrl.trim())}
                  >
                    {loading ? "Saving…" : "Continue"}
                  </button>
                  <button className="btn ghost" onClick={() => setStep("agent")}>Skip for now</button>
                </div>
              </div>
            </div>
          )}

          {/* ── Agent ── */}
          {step === "agent" && (
            <div style={{ maxWidth: 760 }}>
              <h2 style={{ fontSize: 20, fontWeight: 600, color: "var(--text)", margin: 0 }}>Connect your coding agent</h2>
              <p style={{ marginTop: 6, fontSize: 13, color: "var(--text-muted)" }}>
                Agent access is optional. Connect it when you want coding tools
                to load trusted project context from this vault.
              </p>

              <div style={{ marginTop: 20, display: "grid", gridTemplateColumns: "minmax(0,1fr) 280px", gap: 16 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div className="workspace-subsection" style={{ borderRadius: "var(--radius)", padding: 14 }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}>How your AI tool finds slateVault</p>
                    <p style={{ marginTop: 6, fontSize: 11.5, lineHeight: 1.55, color: "var(--text-muted)" }}>
                      {getMcpInstallNote(platform)}
                    </p>
                  </div>

                  {agentCommands.map((agent) => (
                    <div key={agent.name} className="workspace-subsection" style={{ borderRadius: "var(--radius)", padding: 14 }}>
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                        <div>
                          <h3 style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", margin: 0 }}>{agent.name}</h3>
                          <p style={{ marginTop: 4, fontSize: 11.5, lineHeight: 1.5, color: "var(--text-muted)" }}>{agent.note}</p>
                        </div>
                        <button className="btn sm" onClick={() => copyToClipboard(agent.command)}>Copy</button>
                      </div>
                      <pre style={{ marginTop: 10, borderRadius: "var(--radius-sm)", background: "var(--bg-code)", padding: "10px 12px", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--accent)", whiteSpace: "pre-wrap", overflowX: "auto" }}>
                        {agent.command}
                      </pre>
                    </div>
                  ))}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div className="workspace-subsection" style={{ borderRadius: "var(--radius)", padding: 14 }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}>MCP server status</p>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, fontSize: 13, color: "var(--text)" }}>
                      <span style={{
                        width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                        background: mcpStatus?.running ? "var(--success)" : vaultConfig?.mcp_enabled ? "var(--warning)" : "var(--danger)",
                      }} />
                      {mcpStatus?.running ? "Running" : vaultConfig?.mcp_enabled ? "Enabled, not running" : "Disabled"}
                    </div>
                    <p style={{ marginTop: 6, fontSize: 11, lineHeight: 1.55, color: "var(--text-faint)" }}>
                      {vaultConfig?.mcp_enabled
                        ? `Server process started by slateVault${vaultConfig.mcp_port ? ` on port ${vaultConfig.mcp_port}` : ""}.`
                        : "Enable MCP later in Settings when you want slateVault to host the local server."}
                    </p>
                  </div>

                  <div className="workspace-subsection" style={{ borderRadius: "var(--radius)", padding: 14 }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}>How agent access stays safe</p>
                    <ul style={{ marginTop: 8, paddingLeft: 16, display: "flex", flexDirection: "column", gap: 6, fontSize: 11.5, lineHeight: 1.55, color: "var(--text-muted)" }}>
                      <li>Canonical docs are the best place for agents to start.</li>
                      <li>Protected docs use proposal-based updates instead of direct overwrites.</li>
                      <li>Your vault stays the team&apos;s source of truth, not the agent.</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
                <button className="btn" onClick={goToPrevious}>Back</button>
                <button className="btn primary" onClick={() => setStep("finish")}>Continue</button>
              </div>
            </div>
          )}

          {/* ── Finish ── */}
          {step === "finish" && (
            <div style={{ maxWidth: 520, margin: "0 auto", textAlign: "center" }}>
              <div style={{
                margin: "0 auto 16px",
                width: 52, height: 52, borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center",
                background: "var(--accent-soft)", color: "var(--accent)",
              }}>
                <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
              </div>
              <h2 style={{ fontSize: 22, fontWeight: 600, color: "var(--text)", margin: 0 }}>You&apos;re ready to start</h2>
              <p style={{ marginTop: 10, fontSize: 13, lineHeight: 1.65, color: "var(--text-muted)" }}>
                Your vault now has a project, optional sync settings, and a clear
                path to agent access. Next, review your starter docs and decide
                which ones should become canonical.
              </p>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginTop: 24 }}>
                {[
                  { label: "Open project workspace", desc: "Start editing the docs you just created.", view: "documents" as const },
                  { label: "Go to vault home", desc: "See your vault overview and next actions.", view: "home" as const },
                  { label: "Search the vault", desc: "Jump straight into discovery and navigation.", view: "search" as const },
                ].map(({ label, desc, view }) => (
                  <button
                    key={view}
                    className="workspace-action"
                    style={{ borderRadius: "var(--radius)", padding: 14, textAlign: "left" }}
                    onClick={() => { setShowOnboarding(false); setWorkspaceView(view); }}
                  >
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text)" }}>{label}</div>
                    <div style={{ marginTop: 4, fontSize: 11, color: "var(--text-muted)" }}>{desc}</div>
                  </button>
                ))}
              </div>

              <div style={{ marginTop: 24 }}>
                <button className="btn primary" style={{ height: 34, fontSize: 13, padding: "0 20px" }} onClick={() => void handleFinish()}>
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
