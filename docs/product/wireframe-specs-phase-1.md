# slateVault Wireframe Specs: Phase 1

## Scope
This document defines implementation-ready wireframe specs for the first three UX priorities:

1. Onboarding
2. Vault Home / Projects
3. Start Session

These are structure and behavior specs, not visual design specs.

## Shared UX Rules

### Tone
- calm
- credible
- helpful
- team-oriented

### UI principles
- lead with the user's next action
- keep protocol and low-level system details secondary
- make trust signals visible
- always show what the product is helping the user do right now

### Status language
Prefer:
- Agent access
- Team sync
- Trusted docs
- Project memory
- Needs attention

Avoid:
- transport
- schema
- server internals
- protocol-heavy jargon in main headings

## Screen 1: Onboarding

## Purpose
Help a new user successfully:
- understand what slateVault is
- create or open a vault
- create a first project
- connect team sync
- optionally connect a coding agent

## Success state
By the end of onboarding, the user should have:
- an open vault
- at least one project
- a useful default doc structure
- a clear next action

## Structure

### Layout
- centered multi-step panel
- left: step navigation or progress rail
- right: active step content
- footer: back / continue / skip controls

### Steps
1. Welcome
2. Create or Open Vault
3. Create First Project
4. Connect Team Sync
5. Connect Your Coding Agent
6. Finish

## Step 1: Welcome

### Header
- Title: `Project memory for software teams`
- Supporting text:
  `Create a git-backed documentation vault for your software projects. Keep docs useful for humans first, and optionally connect coding agents when you're ready.`

### Body blocks
- `Structured project docs`
- `Git-backed team sharing`
- `Trusted context for coding agents`

### Primary CTA
- `Set up your vault`

### Secondary CTA
- `Learn how it works`

## Step 2: Create or Open Vault

### Header
- Title: `Set up your vault`
- Supporting text:
  `Choose where your shared project memory should live. Everything stays as markdown files on disk.`

### Main options
- `Create new vault`
- `Open existing vault`
- `Clone vault from git`

### If create new vault
Fields:
- Vault name
- Local path

Help text:
- `The vault can hold multiple software projects.`

### If open existing vault
Fields:
- Local path picker

### If clone vault
Fields:
- Remote URL
- Local destination

Help text:
- `Use this if your team already shares a documentation vault through git.`

### Footer CTA
- `Continue`

## Step 3: Create First Project

### Header
- Title: `Start your first project`
- Supporting text:
  `Use a practical structure so your docs stay useful during real engineering work.`

### Fields
- Project name
- Optional description
- Template selector

### Template cards
- Software Project
- Product + Engineering
- API / Platform
- Solo Lightweight

Each card includes:
- short use case
- folders created
- whether canonical starter docs are included

### Preview panel
Show a simple tree preview for the selected template:

```text
overview/
architecture/
decisions/
runbooks/
handoff/
```

### Footer CTA
- `Create project`

## Step 4: Connect Team Sync

### Header
- Title: `Connect team sync`
- Supporting text:
  `Use git to share the vault, review documentation changes, and keep the team aligned.`

### Main options
- `Connect a remote now`
- `Skip for now`

### If connecting
Fields:
- Remote URL
- Branch
- Pull on open toggle
- Push on close toggle

### Education box
Title: `Why this matters`

Body:
- `Your vault becomes a normal team repo for documentation.`
- `You can branch, commit, push, pull, and review changes safely.`

### Footer CTA
- `Continue`

## Step 5: Connect Your Coding Agent

### Header
- Title: `Connect your coding agent`
- Supporting text:
  `Let Codex, Claude, or another agent load trusted project context from this vault.`

### Main sections
- Agent choices
- Copy setup command/config
- Safety explanation

### Agent cards
- Claude Code
- Codex / local agent
- Generic MCP client

Each card includes:
- one-line explanation
- copy config button
- test setup button

### Safety section
Title: `How agent access stays safe`

Bullets:
- Canonical docs are trusted context
- Protected docs should use proposal-based updates
- You can keep the vault read-only for agents if needed

### Footer CTA
- `Finish setup`

## Step 6: Finish

### Header
- Title: `You're ready to start`
- Supporting text:
  `Your vault is set up. Next, create or review your canonical docs so both teammates and agents know where to start.`

### Recommended next actions
- `Open project workspace`
- `Review starter docs`
- `Start session`
- `Open agent access`

## Empty and edge states

### No templates found
- fallback to default software project template
- show small notice: `Using the built-in default template.`

### Git remote setup failed
- show inline error and allow skip

### Agent setup skipped
- onboarding still completes successfully

## Screen 2: Vault Home / Projects

## Purpose
Give the user a useful home screen after opening a vault instead of dropping them straight into a file tree.

This screen should answer:
- what is in this vault?
- what needs attention?
- what should I do next?

## Success state
The user can:
- scan all projects
- see health signals
- start a session
- connect sync or agent access
- jump into a project

## Layout

### Top header
Left:
- Vault name
- Vault path

Right:
- `Create project`
- `Start session`
- `Connect agent`

### Main grid
Use a 2-column layout on desktop:
- left wide column: project list/cards
- right narrow column: summaries and quick actions

## Section A: Vault Summary

### Content
- number of projects
- total docs
- canonical doc count
- sync status
- agent access status

### Quick badges
- `Git connected`
- `Agent access enabled`
- `Needs canonical docs`

## Section B: Project Cards

### Card contents
- project name
- description
- tags
- doc count
- canonical doc count
- last updated
- source folder linked or not
- health callout if applicable

### Card actions
- `Open project`
- `Start session`
- `View health`

### Health callouts
Examples:
- `No canonical docs yet`
- `Missing current-state handoff`
- `Recent work with no doc updates`

## Section C: Quick Actions Panel

### Blocks
- `Create project`
- `Connect team sync`
- `Connect your coding agent`
- `Generate current-state handoff`

## Section D: Vault Health Snapshot

### Rows
- stale docs count
- projects missing canonical docs
- projects missing handoff docs
- docs needing review

Each row has:
- metric
- brief explanation
- CTA

## Section E: Agent Access Snapshot

### Content
- status indicator: connected / available / not configured
- short explanation
- primary CTA: `Open agent access`
- secondary CTA: `Test setup`

## Empty state

### No projects
Headline:
- `Create your first project memory space`

Body:
- `Start with a practical structure for architecture, decisions, runbooks, and handoff docs.`

Primary CTA:
- `Create project`

Secondary CTA:
- `Import an existing docs repo`

## Interaction rules

### When user creates a project
- new card appears immediately
- highlight it briefly
- offer next steps:
  - `Open project`
  - `Review starter docs`
  - `Mark canonical docs`

### When vault has only one project
- still show Vault Home first after onboarding
- do not auto-drop into file tree

## Screen 3: Start Session

## Purpose
Prepare a developer or coding agent to work on a project with trusted context.

This should be one of slateVault's signature workflows.

## Core user questions
- What should I read first?
- What changed recently?
- What docs matter for this task?
- What might be stale or risky?
- What can I copy into my coding agent right now?

## Layout

### Header
Left:
- Title: `Start Session`
- subtitle: `Prepare trusted project context for implementation work`

Right:
- `Copy for agent`
- `Open docs`

### Main body
Two-column layout:
- left: inputs and options
- right: generated session brief

## Left Column: Inputs

### Section 1: Project
Controls:
- Project selector

### Section 2: Task prompt
Controls:
- single text input or textarea

Placeholder examples:
- `Authentication refactor`
- `Investigate PDF export failures`
- `Prepare for release workflow cleanup`

### Section 3: Include options
Toggles:
- Include canonical docs
- Include recent changes
- Include linked source folder
- Include stale doc warnings

### Section 4: Quick presets
Buttons:
- `Start implementation`
- `Investigate bug`
- `Draft feature spec`
- `Resume work`
- `Prepare handoff`

Selecting a preset:
- pre-fills toggles
- optionally suggests a task prompt

### Primary CTA
- `Generate session brief`

## Right Column: Output

### Output block 1: Overview
Contents:
- project summary
- current state
- recommended first docs

### Output block 2: Recent Changes
Contents:
- recent documentation changes
- key commits or branch activity if available

### Output block 3: Recommended Reading
Contents:
- 3-6 docs with reasons

Examples:
- `system-overview.md — canonical architecture entry point`
- `current-state.md — best summary of active work`

### Output block 4: Risks / Attention
Contents:
- stale docs
- missing canonical docs
- possible doc drift indicators

### Output block 5: Agent Context Export
Contents:
- copyable brief
- optional task-scoped context bundle

Actions:
- `Copy for agent`
- `Open relevant docs`
- `Generate focused bundle`

## Empty state

If no project selected yet:
- show guidance panel
- include examples of what Start Session helps with

## Loading state

Show staged progress labels:
- `Loading project context`
- `Checking canonical docs`
- `Reviewing recent changes`
- `Assembling session brief`

## Error state

If brief generation fails:
- preserve entered task prompt
- show retry action
- show secondary action: `Open project docs manually`

## Recommended backend/tool mapping

This screen should likely compose:
- `get_project_context`
- `get_canonical_context`
- `generate_agent_brief`
- `get_recent_changes`
- `detect_stale_docs`
- optional `build_context_bundle`

## Suggested implementation order

### First implementation
- project selector
- task prompt
- generate brief
- recommended docs
- copy for agent

### Second implementation
- recent changes
- stale docs warnings
- presets

### Third implementation
- source-aware context
- more advanced task bundle generation

## Handoff To Visual Design

Once these three screens exist structurally, the visual redesign should focus on:
- stronger hierarchy
- professional typography
- clearer trust/status signaling
- cleaner cards and panels
- more polished empty states

Do not begin the final styling pass until these workflows are stable enough to design around.
