import { create } from "zustand";
import type { DocumentInfo, RecentChange } from "@/types";
import * as commands from "@/lib/commands";

export interface SessionPreset {
  id: string;
  label: string;
  taskPrompt: string;
  includeCanonical: boolean;
  includeRecentChanges: boolean;
  includeSourceFolder: boolean;
  includeStaleWarnings: boolean;
}

export interface SessionRecommendedDoc {
  title: string;
  path: string;
  reason: string;
  canonical: boolean;
  modified: string;
}

interface SessionState {
  selectedProject: string;
  taskPrompt: string;
  includeCanonical: boolean;
  includeRecentChanges: boolean;
  includeSourceFolder: boolean;
  includeStaleWarnings: boolean;
  sourceFolder: string | null;
  projectBrief: string;
  recommendedDocs: SessionRecommendedDoc[];
  recentChanges: RecentChange[];
  loading: boolean;
  error: string | null;
  hasGenerated: boolean;

  setSelectedProject: (project: string) => void;
  setTaskPrompt: (prompt: string) => void;
  setIncludeCanonical: (value: boolean) => void;
  setIncludeRecentChanges: (value: boolean) => void;
  setIncludeSourceFolder: (value: boolean) => void;
  setIncludeStaleWarnings: (value: boolean) => void;
  applyPreset: (preset: SessionPreset) => void;
  generateSession: () => Promise<void>;
  buildExportText: () => string;
}

export const SESSION_PRESETS: SessionPreset[] = [
  {
    id: "implementation",
    label: "Start implementation",
    taskPrompt: "Prepare context for implementation work in this project",
    includeCanonical: true,
    includeRecentChanges: true,
    includeSourceFolder: true,
    includeStaleWarnings: true,
  },
  {
    id: "bug",
    label: "Investigate bug",
    taskPrompt: "Prepare context to investigate a bug in this project",
    includeCanonical: true,
    includeRecentChanges: true,
    includeSourceFolder: true,
    includeStaleWarnings: false,
  },
  {
    id: "spec",
    label: "Draft feature spec",
    taskPrompt: "Prepare context for drafting a feature specification",
    includeCanonical: true,
    includeRecentChanges: false,
    includeSourceFolder: false,
    includeStaleWarnings: true,
  },
  {
    id: "resume",
    label: "Resume work",
    taskPrompt: "Summarize what matters now before resuming work on this project",
    includeCanonical: true,
    includeRecentChanges: true,
    includeSourceFolder: false,
    includeStaleWarnings: true,
  },
  {
    id: "handoff",
    label: "Prepare handoff",
    taskPrompt: "Prepare context for a handoff or onboarding session",
    includeCanonical: true,
    includeRecentChanges: true,
    includeSourceFolder: false,
    includeStaleWarnings: true,
  },
];

function buildRecommendedDocs(
  docs: DocumentInfo[],
  includeCanonical: boolean
): SessionRecommendedDoc[] {
  const sorted = [...docs].sort(
    (a, b) => Date.parse(b.modified) - Date.parse(a.modified)
  );

  const canonicalDocs = sorted
    .filter((doc) => doc.canonical)
    .map((doc) => ({
      title: doc.title,
      path: doc.path,
      reason: "Canonical document for trusted project context",
      canonical: doc.canonical,
      modified: doc.modified,
    }));

  const recentDocs = sorted
    .filter((doc) => !doc.canonical)
    .slice(0, 3)
    .map((doc) => ({
      title: doc.title,
      path: doc.path,
      reason: "Recently updated and likely relevant to current work",
      canonical: doc.canonical,
      modified: doc.modified,
    }));

  return (includeCanonical ? [...canonicalDocs, ...recentDocs] : recentDocs).slice(
    0,
    6
  );
}

export const useSessionStore = create<SessionState>((set, get) => ({
  selectedProject: "",
  taskPrompt: "",
  includeCanonical: true,
  includeRecentChanges: true,
  includeSourceFolder: true,
  includeStaleWarnings: true,
  sourceFolder: null,
  projectBrief: "",
  recommendedDocs: [],
  recentChanges: [],
  loading: false,
  error: null,
  hasGenerated: false,

  setSelectedProject: (project) => set({ selectedProject: project }),
  setTaskPrompt: (prompt) => set({ taskPrompt: prompt }),
  setIncludeCanonical: (value) => set({ includeCanonical: value }),
  setIncludeRecentChanges: (value) => set({ includeRecentChanges: value }),
  setIncludeSourceFolder: (value) => set({ includeSourceFolder: value }),
  setIncludeStaleWarnings: (value) => set({ includeStaleWarnings: value }),

  applyPreset: (preset) =>
    set({
      taskPrompt: preset.taskPrompt,
      includeCanonical: preset.includeCanonical,
      includeRecentChanges: preset.includeRecentChanges,
      includeSourceFolder: preset.includeSourceFolder,
      includeStaleWarnings: preset.includeStaleWarnings,
    }),

  generateSession: async () => {
    const {
      selectedProject,
      includeCanonical,
      includeRecentChanges,
      includeSourceFolder,
      includeStaleWarnings,
    } = get();

    if (!selectedProject) {
      set({ error: "Select a project first." });
      return;
    }

    set({ loading: true, error: null });
    try {
      const [brief, docs, allRecentChanges, sourceFolder] = await Promise.all([
        commands.generateProjectBrief(selectedProject),
        commands.listDocuments(selectedProject),
        commands.getRecentChanges(25),
        commands.getProjectSourceFolder(selectedProject),
      ]);

      const recentChanges = includeRecentChanges
        ? allRecentChanges
            .filter((change) => change.project === selectedProject)
            .slice(0, 8)
        : [];

      const recommendedDocs = buildRecommendedDocs(docs, includeCanonical);

      let projectBrief = brief.trim();

      if (includeRecentChanges && recentChanges.length > 0) {
        projectBrief += `\n\n## Recent Changes\n\n${recentChanges
          .map(
            (change) =>
              `- ${change.title} (\`${change.path}\`) by ${change.author} on ${new Date(
                change.modified
              ).toLocaleDateString()}`
          )
          .join("\n")}`;
      }

      if (includeStaleWarnings) {
        const staleDocs = docs
          .filter(
            (doc) =>
              (Date.now() - Date.parse(doc.modified)) / (1000 * 60 * 60 * 24) > 45
          )
          .slice(0, 5);

        if (staleDocs.length > 0) {
          projectBrief += `\n\n## Attention\n\n${staleDocs
            .map(
              (doc) =>
                `- ${doc.title} (\`${doc.path}\`) has not been updated recently`
            )
            .join("\n")}`;
        }
      }

      if (includeSourceFolder && sourceFolder) {
        projectBrief += `\n\n## Source Folder\n\n- Linked source folder: \`${sourceFolder}\``;
      }

      set({
        projectBrief,
        recommendedDocs,
        recentChanges,
        sourceFolder,
        loading: false,
        hasGenerated: true,
      });
    } catch (e) {
      set({
        loading: false,
        error: String(e),
      });
    }
  },

  buildExportText: () => {
    const {
      selectedProject,
      taskPrompt,
      projectBrief,
      recommendedDocs,
      recentChanges,
      sourceFolder,
      includeSourceFolder,
    } = get();

    const lines = [
      `# Start Session: ${selectedProject}`,
      "",
      taskPrompt ? `## Task\n\n${taskPrompt}\n` : "",
      "## Session Brief",
      "",
      projectBrief,
      "",
      "## Recommended Reading",
      "",
      ...recommendedDocs.map(
        (doc) => `- ${doc.title} (\`${doc.path}\`): ${doc.reason}`
      ),
      "",
    ];

    if (recentChanges.length > 0) {
      lines.push("## Recent Changes", "");
      lines.push(
        ...recentChanges.map(
          (change) =>
            `- ${change.title} (\`${change.path}\`) by ${change.author}`
        )
      );
      lines.push("");
    }

    if (includeSourceFolder && sourceFolder) {
      lines.push("## Source Folder", "", `- \`${sourceFolder}\``, "");
    }

    return lines.join("\n").trim();
  },
}));
