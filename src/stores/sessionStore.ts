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

export function buildMcpUseText(project: string): string {
  const projectLabel = project || "this project";
  const instructions = [
    `Use the SlateVault MCP for documentation discovery, reading, and writing for ${projectLabel} whenever possible.`,
    `Prefer SlateVault document tools over direct filesystem edits for docs that live in ${projectLabel}.`,
    "Treat canonical SlateVault docs as the source of truth when they exist.",
    `When you need context for ${projectLabel}, list and read vault docs before guessing.`,
    `If ${projectLabel} is still greenfield, create the recommended docs in the vault rather than drafting only in chat.`,
  ];

  return [
    "## MCP Use",
    "",
    ...instructions.map((line) => `- ${line}`),
  ].join("\n");
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
  includeCanonical: boolean,
  taskPrompt: string
): SessionRecommendedDoc[] {
  const sorted = [...docs].sort(
    (a, b) => Date.parse(b.modified) - Date.parse(a.modified)
  );
  const substantiveDocs = sorted.filter(
    (doc) => !doc.path.endsWith("/_about.md") && doc.path !== "_about.md"
  );
  const normalizedTask = taskPrompt.toLowerCase();
  const taskKeywords = normalizedTask
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 4);
  const preferredFolders = inferTaskFolders(normalizedTask);
  const newestModified = sorted.length > 0 ? Date.parse(sorted[0].modified) : Date.now();

  if (substantiveDocs.length === 0) {
    return recommendedFirstDocs(normalizedTask);
  }

  const canonicalDocs = sorted
    .filter((doc) => doc.canonical)
    .map((doc) => ({
      title: doc.title,
      path: doc.path,
      reason: "Canonical document for trusted project context",
      canonical: doc.canonical,
      modified: doc.modified,
    }));

  const taskDocs = sorted
    .filter((doc) => !doc.path.endsWith("/_about.md") && doc.path !== "_about.md")
    .map((doc) => ({
      doc,
      score: scoreDocForTask(doc, taskKeywords, preferredFolders, newestModified, normalizedTask),
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map(({ doc }) => ({
      title: doc.title,
      path: doc.path,
      reason: "Matches the current task intent and project structure",
      canonical: doc.canonical,
      modified: doc.modified,
    }));

  const recentDocs = sorted
    .filter((doc) => !doc.canonical && !doc.path.endsWith("/_about.md") && doc.path !== "_about.md")
    .slice(0, 3)
    .map((doc) => ({
      title: doc.title,
      path: doc.path,
      reason: "Recently updated and likely relevant to current work",
      canonical: doc.canonical,
      modified: doc.modified,
    }));

  const combined = includeCanonical
    ? [...canonicalDocs, ...taskDocs, ...recentDocs]
    : [...taskDocs, ...recentDocs];

  return combined
    .filter(
      (doc, index, arr) => arr.findIndex((candidate) => candidate.path === doc.path) === index
    )
    .slice(0, 6);
}

function recommendedFirstDocs(taskPrompt: string): SessionRecommendedDoc[] {
  const featureSlug =
    taskPrompt.includes("dry") && taskPrompt.includes("tracker")
      ? "dry-day-tracking"
      : "core-feature";

  const docs: SessionRecommendedDoc[] = [
    {
      title: "Product Requirements Document",
      path: "prd/product-requirements.md",
      reason: "Create the core product definition before implementation starts",
      canonical: false,
      modified: "",
    },
    {
      title: "First Feature Spec",
      path: `features/${featureSlug}.md`,
      reason: "Define the main user-facing feature and acceptance criteria",
      canonical: false,
      modified: "",
    },
    {
      title: "Initial Build Plan",
      path: "todo/initial-build.md",
      reason: "Break the first build into concrete implementation tasks",
      canonical: false,
      modified: "",
    },
  ];

  if (taskPrompt.includes("ios") || taskPrompt.includes("swiftui")) {
    docs.push({
      title: "iOS Architecture Notes",
      path: "context/ios-architecture.md",
      reason: "Capture SwiftUI structure, state management, and persistence decisions",
      canonical: false,
      modified: "",
    });
  }

  return docs;
}

function inferTaskFolders(taskPrompt: string): string[] {
  const folders: string[] = [];
  const add = (items: string[]) => {
    for (const item of items) {
      if (!folders.includes(item)) folders.push(item);
    }
  };

  const hasAny = (terms: string[]) => terms.some((term) => taskPrompt.includes(term));

  if (hasAny(["feature", "spec", "requirement", "prd"])) {
    add(["prd", "features", "todo", "specs", "notes"]);
  }
  if (hasAny(["implement", "implementation", "build", "develop", "coding"])) {
    add(["todo", "features", "prd", "specs", "context", "notes"]);
  }
  if (hasAny(["bug", "fix", "issue", "regression"])) {
    add(["bugs", "todo", "changelog", "notes", "specs"]);
  }
  if (hasAny(["architecture", "design", "system", "refactor"])) {
    add(["specs", "decisions", "context", "features"]);
  }
  if (hasAny(["handoff", "onboard", "resume", "session"])) {
    add(["context", "changelog", "guides", "specs", "notes"]);
  }
  if (hasAny(["release", "ship", "launch"])) {
    add(["changelog", "todo", "guides", "notes"]);
  }

  if (folders.length === 0) {
    add(["prd", "features", "todo", "specs", "notes", "context"]);
  }

  return folders;
}

function scoreDocForTask(
  doc: DocumentInfo,
  taskKeywords: string[],
  preferredFolders: string[],
  newestModified: number,
  taskPrompt: string
): number {
  const pathLower = doc.path.toLowerCase();
  const titleLower = doc.title.toLowerCase();
  const folder = doc.path.split("/")[0] ?? "";
  let score = 0;

  if (doc.canonical) score += 40;
  if (pathLower.startsWith("wbmgr/")) score += 18;

  const folderIndex = preferredFolders.indexOf(folder);
  if (folderIndex >= 0) {
    score += 24 - folderIndex * 3;
  }

  const ageDays = Math.floor((newestModified - Date.parse(doc.modified)) / (1000 * 60 * 60 * 24));
  if (ageDays <= 1) score += 16;
  else if (ageDays <= 7) score += 10;
  else if (ageDays <= 30) score += 4;

  for (const keyword of taskKeywords) {
    if (titleLower.includes(keyword)) score += 12;
    if (pathLower.includes(keyword)) score += 8;
  }

  if (titleLower.includes("product requirements") || titleLower.includes("prd")) score += 10;
  if (pathLower.startsWith("prd/")) score += 14;
  if (titleLower.includes("feature") || pathLower.includes("/features/")) score += 8;
  if (titleLower.includes("todo") || pathLower.includes("/todo/")) score += 6;
  if (titleLower.includes("spec") || pathLower.includes("/specs/")) score += 8;

  const workflowLike =
    titleLower.includes("workflow") ||
    titleLower.includes("getting started") ||
    pathLower.includes("/guides/");
  const explicitProcessTask =
    taskPrompt.includes("workflow") ||
    taskPrompt.includes("process") ||
    taskPrompt.includes("guide");
  if (workflowLike && !explicitProcessTask) {
    score -= 10;
  }

  const implementationLike =
    taskPrompt.includes("implement") ||
    taskPrompt.includes("implementation") ||
    taskPrompt.includes("build");
  if (implementationLike && pathLower.includes("settings-ai")) {
    score -= 8;
  }

  return score;
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
      taskPrompt,
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
        commands.generateProjectBrief(selectedProject, taskPrompt),
        commands.listDocuments(selectedProject),
        commands.getRecentChanges(25),
        commands.getProjectSourceFolder(selectedProject),
      ]);
      const substantiveDocs = docs.filter(
        (doc) => !doc.path.endsWith("/_about.md") && doc.path !== "_about.md"
      );
      const greenfieldMode = substantiveDocs.length === 0;

      const recentChanges = includeRecentChanges
        ? allRecentChanges
            .filter((change) => change.project === selectedProject)
            .filter((change) => !greenfieldMode || (!change.path.endsWith("/_about.md") && change.path !== "_about.md"))
            .slice(0, 8)
        : [];

      const recommendedDocs = buildRecommendedDocs(docs, includeCanonical, taskPrompt);

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
      buildMcpUseText(selectedProject),
      "",
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

    return lines.join("\n").trim();
  },
}));
