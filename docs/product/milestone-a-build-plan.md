# slateVault Milestone A Build Plan

## Goal
Complete the first implementation milestone before broader feature work begins:

- add top-level workspace navigation
- introduce Vault Home
- update Sidebar navigation
- update AppShell routing

This milestone is the bridge between planning and coding.

## Why This Milestone Comes First

Without this milestone:
- onboarding still lands into the old product shape
- future screens have nowhere correct to live
- the app still behaves like file explorer first, product workflow second

With this milestone:
- the app gains a true home surface
- the new information architecture becomes real
- later features can slot into the shell cleanly

## Scope

### In scope
- add a new global `workspaceView` state
- create Vault Home screen
- rework sidebar top-level navigation model
- update AppShell to render home vs documents vs existing surfaces
- keep current document workspace working

### Out of scope
- onboarding rewrite
- Start Session implementation
- Agent Access implementation
- Docs Health implementation
- Sync copy refactor
- final visual redesign

## Target User Outcome

After opening a vault, the user should:
- land on Vault Home instead of being dropped directly into the file explorer
- see projects, vault stats, and next actions
- be able to open a project workspace from home
- be able to navigate between home, search, documents, and settings-oriented surfaces more intentionally

## Technical Strategy

## 1. Expand UI navigation model

### Current limitation
`uiStore.activeView` only models:

```ts
"editor" | "search"
```

### Proposed new model
Introduce:

```ts
type WorkspaceView =
  | "home"
  | "documents"
  | "search"
  | "start-session"
  | "agent-access"
  | "docs-health"
  | "sync"
  | "settings";
```

### Immediate use in Milestone A
Only these need to render initially:
- `home`
- `documents`
- `search`
- `settings`

The others can be reserved for future milestones.

## 2. Keep current editor workspace intact

The current editor workspace already works. Do not rewrite it yet.

Instead:
- treat the existing editor/preview/search shell as the `documents` workspace
- move routing responsibility up into `AppShell`

## 3. Add Vault Home as a new primary surface

### New component
- `src/components/home/VaultHome.tsx`

### Suggested first version contents
- vault summary
- project list
- quick actions
- project cards with open action

Do not overbuild health or agent status logic in v1 of this screen.
Those can start as lightweight summary placeholders.

## File-Level Implementation Map

## A. `uiStore.ts`

### Changes
- add `workspaceView`
- add `setWorkspaceView`
- preserve editor/preview/terminal state as-is

### Acceptance check
- app can switch between `home`, `documents`, `search`, and `settings`

## B. `AppShell.tsx`

### Changes
- render `VaultHome` when `workspaceView === "home"`
- render current document/editor shell when `workspaceView === "documents"`
- render search when `workspaceView === "search"`
- keep onboarding behavior intact for now

### Important rule
When a vault opens:
- default to `home`

When a document is opened:
- switch to `documents`

### Acceptance check
- open vault -> see home
- open document -> see editor workspace

## C. `Sidebar.tsx`

### Changes
- separate top-level workspace navigation from current file-specific behavior
- introduce a Home entry
- rename/reshape navigation toward the future IA without overcommitting yet

### Suggested interim nav for Milestone A
- Home
- Documents
- Search
- Git
- AI
- Templates
- Settings

This does not need to match the final IA perfectly yet.
It just needs to support the new shell model cleanly.

### Acceptance check
- clicking nav items changes the main workspace
- file tree and project creation remain available under Documents

## D. `vaultStore.ts`

### Changes
Minimal for Milestone A:
- ensure project list and stats are loaded for home view
- optionally expose helper actions if Vault Home needs them

### Optional additions
- lazy-load document counts per project
- derive lightweight project summaries

This can stay simple in the first pass.

## E. New `home` components

### Minimum components
- `VaultHome.tsx`
- optional small children:
  - `ProjectCard.tsx`
  - `VaultSummaryCard.tsx`
  - `QuickActionCard.tsx`

### First version design constraints
- prioritize structure over polish
- keep layout simple and easy to iterate
- use existing design tokens/classes where possible

## User Flows To Preserve

### Existing flow 1
- open vault
- browse docs
- edit doc

Must still work after milestone.

### Existing flow 2
- create project
- view project in tree

Must still work after milestone.

### Existing flow 3
- use search

Must still work after milestone.

## Detailed Task Breakdown

## Task 1: Add `workspaceView` to `uiStore`
Files:
- `src/stores/uiStore.ts`

Definition of done:
- type added
- setter added
- default is `home`

## Task 2: Create `VaultHome` skeleton
Files:
- `src/components/home/VaultHome.tsx`

Definition of done:
- renders vault name
- renders vault stats
- renders project list
- has buttons for `Create project`, `Open project`, and placeholder quick actions

## Task 3: Wire `AppShell` to `workspaceView`
Files:
- `src/components/AppShell.tsx`

Definition of done:
- main area switches by workspace
- current document workspace becomes the `documents` branch
- search becomes its own branch
- home renders by default

## Task 4: Update `Sidebar` top-level navigation
Files:
- `src/components/sidebar/Sidebar.tsx`

Definition of done:
- nav updates `workspaceView`
- Home exists
- Documents view contains current file tree behavior
- Settings remains accessible

## Task 5: Ensure document opening switches to `documents`
Files:
- likely `editorStore.ts`
- possibly file tree interaction points

Definition of done:
- when a user opens a doc from file tree or search result, the app shows the document workspace automatically

## Task 6: Add lightweight project actions on home
Files:
- `VaultHome.tsx`
- maybe `vaultStore.ts`

Definition of done:
- user can create project from home
- user can open a project from home

## Suggested Component Behavior

## Vault Home header
Left:
- vault name
- vault path or short descriptor

Right:
- `Create project`
- `Open documents`

## Vault summary row
- projects count
- docs count
- MCP enabled/running summary
- current branch or remote summary if available

## Project cards
Show:
- project name
- description
- tags
- open button
- optional “Needs setup” badge if no docs loaded yet

## Quick actions
Keep simple in Milestone A:
- Create project
- Open documents
- Search vault

Do not implement advanced health/session actions yet.

## Risks And Mitigations

## Risk 1
Shell complexity grows too fast.

Mitigation:
- only introduce the minimum new workspace routing needed

## Risk 2
Sidebar becomes confusing during transition.

Mitigation:
- treat Milestone A as an interim navigation layer, not the final IA

## Risk 3
Document-opening flow breaks because it still assumes editor-first shell.

Mitigation:
- explicitly wire document-opening actions to switch workspace to `documents`

## QA Checklist

### Open / landing
- opening a vault lands on home
- closing and reopening still works

### Navigation
- Home opens correctly
- Documents opens correctly
- Search opens correctly
- Settings opens correctly

### Documents
- opening a doc from tree switches to documents workspace
- editor / preview still behave as before
- save still works

### Projects
- creating project from home works
- creating project from documents sidebar still works

### Search
- search results still open docs

## Definition Of Done

Milestone A is complete when:
- the app has a functioning Vault Home
- top-level workspace navigation exists
- the editor workspace still works
- the app structure is ready for onboarding rewrite and Start Session

## What Comes Immediately After

Once Milestone A is complete, the next coding milestone should be:

### Milestone B
- onboarding rewrite
- finish state routes to Vault Home

After that:

### Milestone C
- Start Session

That is the point where the product begins to feel substantially different, not just reorganized.
