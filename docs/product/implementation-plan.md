# slateVault UX Implementation Plan

## Goal
Translate the product, IA, and wireframe work into a practical engineering plan against the current codebase.

This plan answers:
- what we should build first
- which existing components can be reused
- what new state/models are needed
- where backend support may be needed

## Current Architecture Snapshot

## Frontend
Primary shell and navigation:
- [AppShell.tsx](</C:/Users/brand/Documents/src/slateVault/src/components/AppShell.tsx>)
- [Sidebar.tsx](</C:/Users/brand/Documents/src/slateVault/src/components/sidebar/Sidebar.tsx>)
- [StatusBar.tsx](</C:/Users/brand/Documents/src/slateVault/src/components/StatusBar.tsx>)

Main state stores:
- [vaultStore.ts](</C:/Users/brand/Documents/src/slateVault/src/stores/vaultStore.ts>)
- [uiStore.ts](</C:/Users/brand/Documents/src/slateVault/src/stores/uiStore.ts>)
- [gitStore.ts](</C:/Users/brand/Documents/src/slateVault/src/stores/gitStore.ts>)
- [editorStore.ts](</C:/Users/brand/Documents/src/slateVault/src/stores/editorStore.ts>)
- [chatStore.ts](</C:/Users/brand/Documents/src/slateVault/src/stores/chatStore.ts>)

Existing feature surfaces:
- onboarding
- file explorer
- editor / preview
- search
- git panel
- AI chat
- settings

## Backend / command layer
The Tauri command layer already has enough primitives for a large part of the new UX:
- vault stats
- project listing
- document listing
- stale docs detection
- recent changes
- agent brief generation
- MCP status
- git operations

This means the next phase is primarily a product/UI composition problem, not a backend-from-scratch problem.

## Recommended Build Order

1. Vault Home / Projects
2. Onboarding rewrite
3. Start Session
4. Agent Access
5. Docs Health
6. Sync refactor
7. Visual redesign pass

This order keeps product clarity ahead of polish.

## Phase 1: Vault Home / Projects

## Why first
This is the new default landing experience after a vault is opened. It changes the product from "file tree first" to "project memory first."

## User-visible outcome
Users see:
- vault summary
- project cards
- health signals
- quick actions
- agent and sync status

## Existing pieces to reuse
- `vaultStore.projects`
- `vaultStore.stats`
- recent vault logic in `VaultPicker`
- existing project creation flow

## New frontend pieces

### New component
- `src/components/home/VaultHome.tsx`

### Likely child components
- `VaultSummaryCard`
- `ProjectCard`
- `QuickActionsPanel`
- `VaultHealthSnapshot`
- `AgentAccessSnapshot`

### New UI state
Add to `uiStore`:
- `workspaceView`

Recommended type:
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

This should eventually replace the current narrow `activeView: "editor" | "search"` model.

## Store changes

### vaultStore additions
Potential additions:
- project health summary model
- optional per-project doc counts if needed for cards

Initial implementation can derive card data from:
- `listProjects`
- `listDocuments(project)`

This may be done lazily at first.

## App shell changes
- when a vault is open, default to `home` instead of dropping directly into file browsing
- keep editor workspace accessible when a project/doc is opened

## Files to update
- [AppShell.tsx](</C:/Users/brand/Documents/src/slateVault/src/components/AppShell.tsx>)
- [Sidebar.tsx](</C:/Users/brand/Documents/src/slateVault/src/components/sidebar/Sidebar.tsx>)
- [uiStore.ts](</C:/Users/brand/Documents/src/slateVault/src/stores/uiStore.ts>)
- [vaultStore.ts](</C:/Users/brand/Documents/src/slateVault/src/stores/vaultStore.ts>)

## Acceptance criteria
- opening a vault shows Vault Home
- user can create project from home
- user can open project workspace from home
- home shows basic stats and project list

## Phase 2: Onboarding Rewrite

## Why second
Once Vault Home exists, onboarding can hand users into the right landing experience.

## User-visible outcome
Users move through:
- Welcome
- Create/Open Vault
- Create First Project
- Connect Team Sync
- Connect Coding Agent
- Finish

## Existing pieces to reuse
- `VaultPicker` create/open/clone logic
- `Onboarding` project template loading
- current MCP setup copy blocks

## Implementation strategy

### Recommended split
Current onboarding is overloaded and assumes the vault is already open.

Refactor into:
- `VaultPicker` handles vault open/create/clone
- `Onboarding` handles first-project, sync, and agent setup after vault open

Optional later:
- unify into one polished flow

### New onboarding steps
Refactor `Onboarding.tsx` into a multi-step job-oriented flow instead of feature cards.

## Files to update
- [VaultPicker.tsx](</C:/Users/brand/Documents/src/slateVault/src/components/vault/VaultPicker.tsx>)
- [Onboarding.tsx](</C:/Users/brand/Documents/src/slateVault/src/components/Onboarding.tsx>)

## Acceptance criteria
- onboarding language matches new positioning
- first project creation feels guided
- sync and agent setup are optional but visible
- finish state routes to Vault Home

## Phase 3: Start Session

## Why third
This is the signature workflow that makes the app feel unique and ties the documentation model directly to coding work.

## User-visible outcome
A user can choose a project, enter a task, and generate a session brief they can use themselves or send to an agent.

## Existing pieces to reuse
- `generate_project_brief`
- `get_recent_changes`
- `get_project_context`
- `get_related_docs`
- current project selector patterns from `AiChatPanel`

## New frontend pieces

### New component
- `src/components/session/StartSessionView.tsx`

### Likely child components
- `SessionTaskForm`
- `SessionPresetBar`
- `SessionBriefPanel`
- `RecommendedDocsList`
- `SessionExportPanel`

## New frontend state

### New store recommended
- `sessionStore.ts`

Suggested responsibilities:
- selected project
- task prompt
- presets
- include toggles
- generated brief
- loading / error

This is cleaner than trying to overload `chatStore` or `uiStore`.

## Backend gaps
Initial implementation can compose existing calls.

Potential future backend addition:
- one consolidated `start_session` command returning:
  - brief
  - recent changes
  - stale docs
  - recommended docs

That is optional, not required for v1.

## Files to add/update
- new `src/components/session/*`
- new `src/stores/sessionStore.ts`
- [AppShell.tsx](</C:/Users/brand/Documents/src/slateVault/src/components/AppShell.tsx>)
- [Sidebar.tsx](</C:/Users/brand/Documents/src/slateVault/src/components/sidebar/Sidebar.tsx>)
- [lib/commands.ts](</C:/Users/brand/Documents/src/slateVault/src/lib/commands.ts>) only if a consolidated backend call is added later

## Acceptance criteria
- user can pick project and enter task
- user can generate a session brief
- user can copy export for agent use
- recommended docs are listed

## Phase 4: Agent Access

## Why fourth
Once Start Session exists, the agent story has a real product workflow behind it.

## User-visible outcome
Users understand:
- whether agent access is working
- how to connect agents
- what read-only vs writable means
- how canonical/protected docs affect AI workflows

## Existing pieces to reuse
- `mcpServerStatus`
- MCP config in `SettingsPanel`
- current MCP onboarding content
- status bar MCP status logic

## New frontend pieces

### New component
- `src/components/agent/AgentAccessView.tsx`

### Likely child components
- `AgentStatusCard`
- `AgentSetupCard`
- `AccessModePanel`
- `WorkflowExamplesPanel`
- `ExamplePromptsPanel`

## State changes
Small dedicated local state is likely enough at first.

If it grows:
- create `agentStore.ts`

## Refactor notes
- move primary MCP setup content out of `SettingsPanel`
- leave low-level MCP config in settings as advanced controls

## Files to update
- [SettingsPanel.tsx](</C:/Users/brand/Documents/src/slateVault/src/components/settings/SettingsPanel.tsx>)
- [StatusBar.tsx](</C:/Users/brand/Documents/src/slateVault/src/components/StatusBar.tsx>)
- [Sidebar.tsx](</C:/Users/brand/Documents/src/slateVault/src/components/sidebar/Sidebar.tsx>)
- [Onboarding.tsx](</C:/Users/brand/Documents/src/slateVault/src/components/Onboarding.tsx>)

## Acceptance criteria
- user can test agent access
- user can copy setup for Claude/Codex/generic client
- access mode is understandable
- canonical/protected safety is explained clearly

## Phase 5: Docs Health

## Why fifth
This is high-value, but it depends on the product story already being established.

## User-visible outcome
Users can see stale docs, weak project memory, and likely documentation gaps.

## Existing pieces to reuse
- `detect_stale_docs`
- `list_projects`
- `list_documents`
- `get_recent_changes`

## New frontend pieces

### New component
- `src/components/health/DocsHealthView.tsx`

### Likely child components
- `HealthMetricCard`
- `StaleDocsPanel`
- `MissingContextPanel`
- `ReviewQueuePanel`
- `DriftRiskPanel`

## Backend gaps
Initial version can be frontend-composed.

Likely later backend additions:
- missing canonical summary per project
- missing handoff/runbook detection
- drift heuristics

## New data types
Add derived frontend models for:
- project health summary
- stale doc row
- missing context row
- review queue row

## Files to update
- new `src/components/health/*`
- maybe `src/types/index.ts` for new view models
- maybe `vaultStore.ts` or a dedicated `healthStore.ts`

## Acceptance criteria
- stale docs shown clearly
- missing trusted context shown per project
- users can jump directly to affected docs

## Phase 6: Sync Refactor

## Why sixth
The capabilities already exist. This phase is mainly about renaming, reframing, and tightening entry behavior.

## User-visible outcome
Git becomes "team sync" instead of just "a Git tab."

## Existing pieces to reuse
- `GitPanel`
- `gitStore`
- `BranchSelector`
- `ChangesTab`
- `HistoryTab`
- `RemoteTab`
- `PrTab`

## Main work
- rename top-level nav from Git to Sync
- improve empty states
- start on more helpful tabs based on context
- reword copy toward team sharing and review

## Optional refactor
Keep `GitPanel` internally but wrap it in:
- `SyncView.tsx`

This avoids disruptive rewrites.

## Files to update
- [GitPanel.tsx](</C:/Users/brand/Documents/src/slateVault/src/components/git/GitPanel.tsx>)
- related git tab components
- [Sidebar.tsx](</C:/Users/brand/Documents/src/slateVault/src/components/sidebar/Sidebar.tsx>)
- [StatusBar.tsx](</C:/Users/brand/Documents/src/slateVault/src/components/StatusBar.tsx>)

## Acceptance criteria
- nav label and screen copy emphasize sharing and review
- no-remote state is clearer
- PR/review flow is easier to understand

## Cross-Cutting Technical Changes

## 1. Expand top-level navigation state
Current `uiStore.activeView` is too narrow.

This is likely the first architectural step before any screen work.

## 2. Separate global surfaces from document workspace
The app currently assumes the main area is mostly editor/search.

We should move toward:
- global workspace views
- document workspace as one of those views

## 3. Add lightweight screen-level stores where needed
Recommended:
- `sessionStore.ts`

Optional later:
- `agentStore.ts`
- `healthStore.ts`

## 4. Keep reuse high
Avoid rewriting the editor, preview, terminal, and git internals unless needed.
Most changes are shell, routing, copy, and workflow composition.

## Suggested Sprint Breakdown

## Sprint 1
- expand `uiStore` navigation model
- build Vault Home
- wire Sidebar and AppShell to new home flow

## Sprint 2
- rewrite onboarding
- hand off to Vault Home

## Sprint 3
- build Start Session

## Sprint 4
- build Agent Access

## Sprint 5
- build Docs Health

## Sprint 6
- Sync reframe and cleanup

## Sprint 7
- visual redesign pass

## Recommended First Build Target

If we start implementing right now, the cleanest first milestone is:

### Milestone A
- add `workspaceView` state
- create `VaultHome`
- update `Sidebar`
- update `AppShell`

Why:
- it unlocks the whole new app structure
- it is visible immediately
- it gives the onboarding and future screens somewhere correct to land

## Definition Of Ready For Visual Design

Do not start the professional UI polish pass until:
- Vault Home exists
- new onboarding exists
- Start Session exists
- Agent Access exists
- Docs Health exists
- Sync wording and entry logic are updated

At that point, the app will have the right bones for a serious visual design pass instead of just a surface-level repaint.
