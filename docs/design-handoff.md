# slateVault — Design Handoff

**Version:** 0.2.2  
**Audience:** Design team  
**Prepared by:** Engineering

---

## 1. What Is slateVault?

slateVault is a **local-first AI documentation vault** built as a cross-platform desktop application. Teams use it to write, organize, and version-control project documentation — and to pipe that documentation into AI coding agents via an embedded MCP (Model Context Protocol) server.

**Core value props:**

- All docs live on-disk in the user's own git repository (no cloud required)
- Built-in git integration for team sync (commit, push, pull, PR creation)
- An MCP server exposes vault docs to AI agents (Claude, Cursor, etc.) at runtime
- A structured editor for Markdown docs with frontmatter metadata (status, author, tags, canonical flag)

**Platform:** Tauri desktop app (macOS, Windows, Linux). The UI is a Next.js/React app embedded in a Tauri webview. The backend is a Rust binary.

---

## 2. Application Structure

```
┌─────────────────────────────────────────────────────────────┐
│  AppChromeBar  (top toolbar — always visible)               │
├───────────────┬─────────────────────────────────────────────┤
│               │                                             │
│  Sidebar      │  Workspace Area                             │
│  (rail +      │  (one view at a time, see §4)               │
│   panel)      │                                             │
│               │                                             │
│               ├─────────────────────────────────────────────┤
│               │  Terminal Panel  (collapsible, bottom)      │
├───────────────┴─────────────────────────────────────────────┤
│  StatusBar  (bottom strip — always visible)                 │
└─────────────────────────────────────────────────────────────┘
```

The **Sidebar** has two zones:
- A narrow **rail** (icon nav buttons, always visible)
- An expandable **panel** (file tree, git panel, or AI chat)

The **Workspace Area** swaps between named views controlled by `workspaceView` state.

---

## 3. Design Tokens & Theming

The app ships with a warm-paper light theme as default and supports dark themes via `data-theme` attribute on `<html>`. All component colors reference CSS variables — no hardcoded hex values in components.

### Key CSS Variables

| Token | Purpose |
|---|---|
| `--bg-app` | Page/app background |
| `--bg-panel` | Panel/card surfaces |
| `--bg-subtle` | Hover tint |
| `--bg-tint` | Icon button backgrounds |
| `--border` | Default border |
| `--border-subtle` | Light divider |
| `--border-strong` | Hover border |
| `--text` | Primary text |
| `--text-muted` | Secondary / label text |
| `--text-faint` | Tertiary / hint text |
| `--accent` | Brand accent (blue-ish) |
| `--accent-soft` | Accent background tint |
| `--success` | Green status |
| `--warning` | Yellow / amber status |
| `--danger` | Red / error status |
| `--danger-soft` | Red background tint |
| `--font-mono` | Monospace font family |

### Themes to Design For
- **Default light** (warm paper): the shipped default
- **Dark**: `data-theme="dark"` — required for full coverage
- The theme toggle lives in Settings → Appearance

---

## 4. Screens

Each section below describes one named view in the workspace area.

---

### 4.1 Vault Picker

**When shown:** App is launched with no vault open yet.  
**File:** `src/components/vault/VaultPicker.tsx`

**Purpose:** Let the user open an existing vault folder or create a new one. A "vault" is just a directory on disk that slateVault manages as a git repo.

**Key UI elements:**
- Centered card / welcome panel
- Two actions: **Open existing vault** (folder picker dialog) and **Create new vault**
- Recent vaults list (if any)
- App name / logo lockup

**Design notes:**
- This is the first impression screen. It should feel calm and intentional, not busy.
- No sidebar or chrome bar — pure centered layout.

---

### 4.2 Onboarding / Setup Flow

**When shown:** Vault is open but has no projects yet (first run), or user clicks "+ New project".  
**File:** `src/components/Onboarding.tsx`

**Layout:** Two-column — left rail (step list), right content area.

**Steps (in order):**

| Step | ID | What happens |
|---|---|---|
| 1 | `welcome` | Intro copy, vault name confirmation |
| 2 | `project` | Create first project (name, description, tags, source folder, template) |
| 3 | `sync` | Configure git remote (URL, branch, SSH key, auto-push options) |
| 4 | `agent` | Set up MCP server for AI agent access; copy install snippet |
| 5 | `finish` | Summary + "Go to vault" CTA |

**Step rail behavior:**
- Steps 3–5 are disabled (grayed out) until a project has been created in step 2
- Current step is highlighted with accent color
- Completed steps show a checkmark
- A "Skip on startup" checkbox lives at the bottom of the rail

**Key sub-components:**
- `CreateProjectForm` — project name, description, tags, source folder picker, template selector
- MCP setup cards (platform-aware: shows Claude Desktop, Cursor, or generic config snippet)
- Git remote config form (URL, branch, pull-on-open, push-on-close toggles)

**Design notes:**
- Right content area should have generous padding and clear step headings
- Progress should feel linear; avoid overwhelming the user with all options at once
- MCP setup step includes a copyable code snippet block — needs monospace treatment

---

### 4.3 Home / Dashboard

**When shown:** Default view after vault is open and onboarding is complete.  
**File:** `src/components/home/VaultHome.tsx`

**Layout:** Full-width scroll container, max-width 1200px, two-column body.

**Sections (top to bottom):**

#### Hero
- Vault name (large heading)
- Vault path (mono, truncated)
- "Open" status chip
- Subtitle: project count · git status · MCP status

#### Stats Row (4 cards, equal-width grid)
| Card | Value | Action |
|---|---|---|
| Projects | count | — |
| Documents | count across all projects | — |
| Team Sync | "Connected" / "No remote" | Navigates to Sync view |
| MCP Server | "Live :port" / "Off" | Navigates to Settings |

Each stat card: label (uppercase, small), large number or status value, hint text below.  
`tone` prop controls hint color: `ok` (faint), `warn` (amber), `bad` (red).

#### Two-Column Body
- **Left (main):** Projects grid — 2 columns of ProjectCards
  - Each card: colored initial avatar, project name, description, tag list, folder/doc/tag counts
  - "+ New project" button in section header
  - Empty state: centered card with CTA if no projects exist
- **Right (300px fixed):** Jump-In panel — vertical list of quick-nav actions
  - "Start a coding session" (accented, AI icon)
  - "Open Documents"
  - "Review Team Sync"
  - "Check Docs Health"

**Design notes:**
- Project cards use a deterministic color derived from the project name (stable across sessions)
- "New" chip appears on projects with no folders yet
- Jump-In panel is always visible on the right — acts as a persistent shortcuts panel
- Stats row should scan quickly; values are the focus, not labels

---

### 4.4 Documents Workspace

**When shown:** `workspaceView === "documents"` — the primary editing view.  
**Files:** `src/components/editor/EditorPane.tsx`, `src/components/preview/MarkdownPreview.tsx`, `src/components/editor/FrontMatterBar.tsx`

**Layout:** Horizontal split — editor left, preview right (resizable via drag handle). Either pane can be hidden independently.

#### FrontMatterBar (above editor+preview)
A thin bar showing the active document's frontmatter fields:
- `title`, `status` (draft / review / final), `author` (human / ai / both), `tags`
- All fields are inline-editable
- Canonical and Protected badges when set

#### Editor Pane
- CodeMirror-based Markdown editor
- **RawFileBar** at top: filename, dirty indicator dot, Save button (Ctrl+S)
- **SecretWarning** banner: shown when editor content matches known secret patterns (API keys, PATs, private keys). Red background, warns user before committing.
- **RemoteCheckSpinner**: shown while checking if the active document has remote changes

#### Preview Pane
- Rendered Markdown output (read-only)
- Synced scroll with editor
- Supports standard Markdown plus frontmatter-aware rendering

**Resize handle:** Vertical drag handle between editor and preview. User can drag to adjust split ratio.

**Toolbar toggles (in AppChromeBar):** Show/hide editor, show/hide preview.

**Design notes:**
- Dirty state indicator: small accent-colored dot next to filename
- Secret warning is a critical safety feature — must be visually alarming (red)
- Editor and preview panes should be cleanly separated, not visually competing

---

### 4.5 Search

**When shown:** `workspaceView === "search"`, or Ctrl+Shift+F.  
**File:** `src/components/search/SearchView.tsx`

**Layout:** Vertical — search header at top, results list below.

**Search header:**
- Full-text search input (FTS5 SQLite syntax supported)
- Project filter dropdown ("All projects" or specific project name)
- Search is debounced (200ms), fires automatically on typing

**Results list:**
- Each result: project name chip, document title, path, snippet with matched text highlighted
- Clicking a result opens the document in the editor

**Empty states:**
- Pre-search: prompt to start typing
- No results: "No documents found" message

---

### 4.6 Wiki

**When shown:** `workspaceView === "wiki"`.  
**File:** `src/components/wiki/WikiView.tsx`

**Purpose:** A shared wiki layer that lives across all projects (stored in `wiki/` in the vault root). Used for cross-project reference docs.

**Layout:** Similar to Documents workspace — sidebar file list on the left, editor+preview on the right.

**Key differences from Documents:**
- No project scoping — wiki docs are vault-wide
- Save button label reflects wiki context
- No FrontMatterBar (wiki docs have simpler metadata)

---

### 4.7 Start Session

**When shown:** `workspaceView === "start-session"`.  
**File:** `src/components/session/StartSessionView.tsx`

**Purpose:** Prepare a context bundle for an AI coding session. The user selects which project docs to include, and slateVault generates a structured context payload the AI agent reads via MCP.

**Key UI elements:**
- Project selector
- Document checklist (include/exclude specific docs)
- Playbook selector (pre-configured prompt patterns)
- "Generate context" / "Start session" CTA
- Output: shows the MCP command or context bundle summary

**Design notes:**
- This is the most "workflow" screen — should feel like a pre-flight checklist
- Accent-colored primary action (this is the product's flagship feature)

---

### 4.8 Docs Health

**When shown:** `workspaceView === "docs-health"`.  
**File:** `src/components/health/DocsHealthView.tsx`

**Purpose:** Surface stale, incomplete, or at-risk documentation. Runs an analysis pass and shows a report.

**Key UI elements:**
- Per-project health cards or a unified list
- Each issue: document path, staleness reason (e.g. "not modified in 90 days", "missing canonical", "draft status")
- Tone indicators: `ok` / `warn` / `bad` coloring
- "Open document" action on each row

**Design notes:**
- Scanning/loading state while analysis runs
- Should feel like a dashboard report, not a bug tracker

---

### 4.9 Team Sync

**When shown:** `workspaceView === "sync"`.  
**File:** `src/components/sync/SyncView.tsx`

**Layout:** Two-pane — document change list on the left, Git panel on the right.

#### Left: Changed Documents List
Shows all vault documents that have uncommitted or unstaged changes:
- Document title, project, path
- Status chips: "staged new", "staged edits", "staged delete", "edited", "deleted"
- AI-authored badge, Canonical badge, Protected badge
- Risk warnings: `remote_changed` or `conflict_risk`
- "Compare diff" button → opens `CompareDiffModal`

#### CompareDiffModal
Full-screen modal showing a side-by-side or unified diff of a document vs. the remote version. Highlights conflict risk sections.

#### Right: Git Panel
Tabbed panel with four tabs:

| Tab | Contents |
|---|---|
| **Changes** | Staged vs. unstaged file list, stage/unstage/discard controls, commit message input, Commit button |
| **History** | Commit log — hash, message, author, date. Click to view commit diff. |
| **Remote** | Remote URL status, pull/push controls, sync status (ahead/behind/diverged) |
| **PR** | Create pull request form (title, body, target branch). Supports GitHub and Azure DevOps. |

**Branch selector** sits above the tabs: current branch name, branch switcher dropdown, create branch button.

**Design notes:**
- Sync is a high-stakes view — changes are real git operations
- Risk warnings (conflict, remote changed) must be visually prominent
- Git panel tabs should feel like a lightweight source control panel (VS Code SCM pane is a reference)

---

### 4.10 Settings

**When shown:** `workspaceView === "settings"`.  
**File:** `src/components/settings/SettingsPanel.tsx`

**Layout:** Two-column — left nav (sections list), right content area.

**Section groups and sections:**

| Group | Section | Contents |
|---|---|---|
| Workspace | **Vault** | Vault name, MCP enabled toggle, MCP port |
| Workspace | **Agent access (MCP)** | MCP server start/stop, install snippet, status, per-platform setup guide |
| Sync | **Git & credentials** | Remote URL, branch, SSH key path, GitHub PAT, Azure DevOps PAT/org/project, auto-pull/push toggles |
| Application | **Updates** | Current version, last-checked timestamp, "Check for updates" / "Install update" buttons, bundle type |
| Application | **Advanced** | Auto-stage AI writes toggle, compress context toggle |

**Note:** AI and Appearance sections appear in the `SettingsSection` type but are not currently wired into the nav — may be planned additions.

**Design notes:**
- Settings nav uses icon abbreviations ("DB", "MCP", "Git") as placeholders — icons should be replaced with proper symbols
- Each section should be a clean form with clear save affordance (the current code shows save/error feedback inline)
- Credential fields are masked; "reveal" pattern needed

---

### 4.11 Agent Access View

**When shown:** Navigated to from Settings or from Onboarding step 4.  
**File:** `src/components/agent/AgentAccessView.tsx`

**Purpose:** Standalone full-page view of MCP server status and setup instructions. (Overlaps with Settings → Agent access, but provides more detail.)

**Key UI elements:**
- `StatusPill` components: green / yellow / red dots with label ("MCP running", "Binary not found", etc.)
- MCP server start/stop toggle
- Platform-aware setup cards (Claude Desktop, Cursor, generic)
- Copyable config snippet (JSON block for claude_desktop_config or similar)
- Link to navigate back to Settings

---

## 5. Persistent UI Chrome

These elements are always visible regardless of which view is active.

---

### 5.1 AppChromeBar

**File:** `src/components/AppChromeBar.tsx`

A top toolbar that spans the full window width. Contains:

**Left zone:**
- Window controls (macOS traffic lights or custom close/min/max)
- Vault name / breadcrumb
- Dirty indicator (unsaved changes dot)

**Center zone:**
- Workspace view tabs / segmented control:
  - Home, Documents, Search, Wiki, Start Session, Docs Health, Sync, Settings

**Right zone (contextual — shown only in Documents view):**
- Toggle Editor button
- Toggle Preview button
- Toggle Terminal button
- Toggle Sidebar button
- Save Document button (when dirty)

**Design notes:**
- The bar is draggable for window movement on macOS (title bar region)
- Workspace switcher is the primary navigation; it should be clear which view is active
- Right-zone controls appear/disappear based on context — avoid layout shift

---

### 5.2 Sidebar

**File:** `src/components/sidebar/Sidebar.tsx`  
**Sub-components:** `FileTree.tsx`, `TreeNode.tsx`, `SearchBar.tsx`

**Structure:**
- A narrow **rail** (icon column, ~40px wide) — always visible, collapsible
- An expandable **panel** to the right of the rail

**Rail icon buttons:**
- Files (opens file tree panel)
- Git (opens git panel)
- AI Chat (opens AI chat panel)

**File Tree Panel:**
- Hierarchical list: Projects → Folders → Documents
- Tree nodes expand/collapse
- Active document highlighted
- Inline "New doc" and "New folder" actions
- Right-click context menu (rename, delete)
- Search bar at top filters visible nodes

**Git Panel** (when rail icon selected): See §4.9 Git Panel — same component.

**AI Chat Panel:**  
**File:** `src/components/ai/AiChatPanel.tsx`

A chat interface embedded in the sidebar panel:
- Project selector dropdown (scopes context to one project)
- Message thread with `AiMessageBubble` per message (user vs. assistant styling)
- "Include context" and "Include source" toggles
- Text input + Send button
- "Clear chat" action
- Model name display (shown when a response arrives)
- Tool-support indicator (shows when the connected model supports tool calls)

**Design notes:**
- Sidebar collapses fully (rail only) — collapsed state persists across sessions
- File tree is the most-used panel; it should be scannable at a glance
- AI chat in the sidebar is a secondary interface; the full agent workflow is in Start Session

---

### 5.3 StatusBar

**File:** `src/components/StatusBar.tsx`

A thin strip at the very bottom of the window. Contains:
- Current branch name
- Sync status (ahead/behind count)
- Active document path
- Word/character count for the open document
- MCP server status indicator

---

### 5.4 Terminal Panel

**File:** `src/components/terminal/TerminalPanel.tsx`

A collapsible xterm.js terminal at the bottom of the workspace (above the status bar). Toggled with Ctrl+T or the toolbar button. Height is user-resizable by dragging the top edge. The terminal stays mounted when hidden so shell state and scrollback survive toggling.

---

## 6. Shared UI Patterns

These patterns appear across multiple screens and should be defined in the design system.

### Buttons
- `.btn` — default secondary button
- `.btn.primary` — filled accent button (primary CTA)
- `.btn.sm` — small variant
- `.btn.danger` — destructive action (red)

### Chips / Badges
- `.chip` — neutral rounded badge (tags, counts)
- `.chip.success` — green badge (open, connected, live)
- `.chip.warn` — amber badge
- `.chip.danger` — red badge

Status chips appear on: documents (draft/review/final), files (staged/edited/deleted), MCP server (running/off), git (ahead/behind).

### Cards
- **StatCard** — label + large value + hint text. Clickable variant navigates to a view.
- **ProjectCard** — avatar (colored initial), name, description, tag list, counts row.
- **Setup card** — used in Onboarding and Agent Access; titled card with icon and instructions.

### Modals
- **CompareDiffModal** — full-screen overlay with diff viewer
- **ProjectSettingsModal** — edit project metadata
- **CreateProjectForm** — embedded in Onboarding and modal contexts

### Empty States
- **File:** `src/components/shared/EmptyState.tsx`
- Centered panel with heading, description, and optional CTA button
- Used in: file tree (no docs), home (no projects), search (no results), docs health (all healthy)

### Frontmatter Metadata Display
Documents carry structured metadata: `title`, `author`, `status`, `tags`, `canonical`, `protected`. These surface as:
- Inline chips in document list rows
- Editable fields in the `FrontMatterBar`
- Filter/sort dimensions in the file tree

### Diff Viewer
**File:** `src/components/git/DiffViewer.tsx`  
Unified diff display with:
- `+` lines in green, `-` lines in red, unchanged lines in neutral
- Hunk headers (@@) in a distinct style
- Addition/deletion stat summary

---

## 7. Document Metadata Reference

Every vault document has a frontmatter header. This metadata drives UI labeling and filtering throughout the app.

| Field | Values | UI impact |
|---|---|---|
| `title` | string | Shown everywhere as the document name |
| `status` | `draft` / `review` / `final` | Chip in file tree and sync view |
| `author` | `human` / `ai` / `both` | Badge in sync view |
| `tags` | string[] | Shown in file tree, project card, search results |
| `canonical` | boolean | Gold badge — this doc is the authoritative source |
| `protected` | boolean | Lock badge — requires special handling to edit |
| `created` / `modified` | ISO date | Used in staleness detection (Docs Health) |

---

## 8. Navigation Map

```
Vault Picker
    │
    ▼ (vault opened)
Onboarding (5 steps)  ─── skip ──▶  Home
    │ finish
    ▼
Home
├── → Documents (editor + preview)
├── → Search
├── → Wiki
├── → Start Session
├── → Docs Health
├── → Sync
│       └── Git Panel (Changes / History / Remote / PR)
└── → Settings
        └── Agent Access (MCP setup)
```

Sidebar (always present in open vault):
- Rail → Files panel (file tree)
- Rail → Git panel
- Rail → AI chat panel

---

## 9. Open Design Questions for the Team

1. **Onboarding step indicators** — current rail uses text labels; should steps use icons, numbers, or both?
2. **Settings icons** — section nav uses text abbreviations ("DB", "MCP") as placeholders; replace with icon set.
3. **Appearance / AI sections** — coded but not surfaced in settings nav; confirm if these are in-scope for this design pass.
4. **Mobile / responsive** — app is desktop-only today; no responsive requirements.
5. **Window chrome** — macOS uses native traffic lights; Windows/Linux uses custom window controls (`WindowControls.tsx`). Both need to be designed consistently with the bar layout.
6. **Theme switcher UX** — currently buried in Settings → Appearance (not yet surfaced in nav). Should it live in the status bar or the chrome bar?
7. **Keyboard shortcut discoverability** — shortcuts exist (Ctrl+Shift+F for search, Ctrl+T for terminal, Ctrl+S for save) but are not documented in-app. Consider a shortcut reference panel.
