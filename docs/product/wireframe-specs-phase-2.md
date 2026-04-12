# slateVault Wireframe Specs: Phase 2

## Scope
This document defines implementation-ready wireframe specs for the next three product surfaces:

1. Agent Access
2. Docs Health
3. Sync

These extend the Phase 1 screens and complete the structural UX plan before visual redesign.

## Shared UX Rules

### Tone
- trustworthy
- practical
- calm
- technical without being jargon-heavy

### Product framing
- show the user's outcome first
- keep protocol details and internal mechanics secondary
- surface safety and trust signals clearly
- tie every screen to real software-team workflows

## Screen 4: Agent Access

## Purpose
Help users connect external coding agents to the vault in a way that feels useful, safe, and understandable.

This screen should answer:
- can my agent access this vault?
- how do I connect it?
- what can it do once connected?
- how do I keep important docs safe?

## Success state
The user can:
- see whether agent access is configured
- copy working setup/config for a target agent
- test the connection
- understand canonical/protected/read-only behavior
- know what workflows agent access improves

## Layout

### Header
Left:
- Title: `Agent Access`
- Subtitle: `Connect coding agents to trusted project context`

Right:
- `Test access`
- `Copy setup`

### Main body
Desktop layout:
- left column: setup and status
- right column: safety, workflows, and examples

## Left Column

### Section 1: Status Card
Contents:
- status indicator: `Connected`, `Available`, `Needs setup`, or `Disabled`
- active vault path
- access mode: `Writable` or `Read-only`
- last successful test result

### Status badge rules
- green: configured and responding
- yellow: available but not yet tested / partially configured
- red: unavailable or disabled

### Primary actions
- `Test access`
- `Toggle read-only`
- `Open MCP settings` only if advanced controls are needed

## Section 2: Connect An Agent

### Agent setup cards
- Claude Code
- Codex / local coding agent
- Generic MCP client

Each card includes:
- short explanation of best fit
- copy setup command/config button
- test setup button
- “show details” expander for advanced setup

### Example card fields
- Agent name
- Setup snippet
- Notes
- Copy action
- Test action

### Helpful copy
For Claude Code:
- `Best for local coding sessions that should read trusted project docs before implementation.`

For Codex:
- `Use when you want your coding agent to load canonical docs, recent changes, and task-specific bundles from slateVault.`

## Section 3: Access Modes

### Title
`Choose how agents can interact with your vault`

### Options
- `Read-only`
- `Writable with protected docs`

### Explanatory copy
- Read-only:
  `Agents can read docs and build context, but cannot write or propose changes.`
- Writable:
  `Agents can create docs and suggest updates. Protected docs should still use proposal-based workflows.`

### Optional advanced toggle
- `Auto-stage AI writes`

## Right Column

### Section 4: How Agent Access Works
This should be user-facing, not implementation-facing.

#### Block 1
Title: `Trusted context first`
Body:
- canonical docs define the best place for agents to start

#### Block 2
Title: `Safe updates`
Body:
- protected docs should use proposals instead of direct overwrite

#### Block 3
Title: `Human docs remain primary`
Body:
- the vault remains the team’s source of truth; agents consume and contribute to it

## Section 5: Recommended Workflows

### Cards
- `Start implementation`
- `Investigate a subsystem`
- `Resume work after time away`
- `Draft or update project docs`

Each card includes:
- what the agent should load
- which slateVault workflow or tools matter
- one CTA: `Copy example prompt`

## Section 6: Example Prompts

### Content
Short prompts users can send to agents once connected:

- `Load the trusted context for this project, then help me implement authentication changes.`
- `Generate a session brief for the PDF export system.`
- `Review recent project changes and suggest which docs need updating.`
- `Read canonical docs, then propose a safe update to the current-state handoff.`

Actions:
- `Copy prompt`

## Empty state

### If no vault is open
- `Open a vault to configure agent access`

### If vault is open but no project exists
- `Create a project first so agents have project context to load`

## Loading and test states

### During test
Status text:
- `Checking agent access`
- `Confirming vault path`
- `Verifying tool availability`

### Successful test
Show:
- timestamp
- vault name/path
- access mode

### Failed test
Show:
- concise reason
- retry action
- open setup details action

## Recommended implementation notes

Use existing sources where possible:
- `mcpServerStatus`
- vault config
- existing MCP setup text

This screen should become the main place for agent access, replacing protocol-heavy setup buried in settings.

## Screen 5: Docs Health

## Purpose
Help users keep the vault useful over time by surfacing what needs attention.

This screen should answer:
- which docs are stale?
- which projects are under-documented?
- what important docs are missing?
- where might project memory have drifted from recent work?

## Success state
The user can:
- quickly spot documentation risk
- prioritize fixes
- jump directly to the right docs
- use generation actions when helpful

## Layout

### Header
Left:
- Title: `Docs Health`
- Subtitle: `Find what needs attention across your vault`

Right:
- `Refresh`
- `Generate handoff`

### Main body
Desktop layout:
- top summary row
- below: two-column panel grid

## Top Summary Row

### Metric cards
- stale docs
- projects missing canonical docs
- projects missing current-state handoff
- docs in draft/review

Each card includes:
- count
- short label
- small trend or status note when possible

## Main Panels

### Panel 1: Stale Docs
Contents:
- list of stale docs
- project
- doc title
- days stale
- last modified

Actions per row:
- `Open`
- `Mark for review`
- `Generate update draft`

### Panel 2: Missing Trusted Context
Contents:
- projects with no canonical docs
- projects with too few canonical docs
- projects with no local development runbook
- projects with no current-state handoff

Actions:
- `Create starter docs`
- `Open project`

### Panel 3: Review Queue
Contents:
- docs in draft
- docs in review
- optionally recently AI-authored docs needing human review

Actions:
- `Open`
- `Promote to canonical` if appropriate
- `Propose update`

### Panel 4: Drift Risk
This panel can start simple and become smarter later.

Initial version contents:
- projects with recent changes
- no recent doc changes in those projects
- source folder linked but low doc activity

Actions:
- `Start session`
- `Build context bundle`
- `Open project`

## Supporting states

### Healthy vault state
If no issues are found:
- show reassuring message
- still show:
  - `Review projects`
  - `Generate current-state handoff`

### Empty vault state
- `Create a project to begin tracking docs health`

## Interaction rules

### Clicking a metric card
Filters the relevant panel below

### Clicking a row action
Should deep-link to the relevant project/doc

### Create starter docs action
Should open a focused flow that creates:
- project summary
- system overview
- local development runbook
- current-state handoff

## Recommended backend/tool mapping

Initial version can combine:
- `detect_stale_docs`
- `list_projects`
- `list_documents`
- `get_recent_changes`

Later versions can add:
- drift heuristics
- backlink analysis
- source-aware signals

## Screen 6: Sync

## Purpose
Help teams understand and manage how the vault is shared through git.

This screen should answer:
- is this vault connected to a remote?
- what has changed locally?
- what branch am I on?
- what should I do next to share or review changes?

## Success state
The user can:
- see sync state immediately
- commit and push changes confidently
- understand branch context
- open PR workflows without thinking in raw git plumbing

## Layout

### Header
Left:
- Title: `Sync`
- Subtitle: `Share and review your project memory through git`

Right:
- `Pull`
- `Push`
- `Create PR`

### Main body
Desktop layout:
- left narrow column: sync summary and remote status
- right wide column: tabbed work area

## Left Column

### Section 1: Sync Status
Contents:
- remote connected or not
- current branch
- ahead/behind state if available later
- number of uncommitted changes

### Primary actions
- `Connect remote`
- `Pull`
- `Push`

### Section 2: Safe Collaboration Tips
Short guidance:
- use branches for larger documentation updates
- use PRs for important changes
- protected docs are still git-reviewed like normal project files

## Right Column

### Tab model
Keep the existing underlying capabilities, but reframe labels if useful:
- `Changes`
- `History`
- `Remote`
- `Review`

If keeping `PR`, label can stay `PR` for technical audiences, but `Review` may be friendlier at the top level.

## Tab: Changes

### Contents
- staged and unstaged files
- concise diff preview
- commit message box
- commit and push actions

### Improvements
- explain that these are documentation changes to the vault
- highlight AI-authored changes when present

## Tab: History

### Contents
- recent commits
- author
- timestamp
- message

### Action
- `Use for session brief`

## Tab: Remote

### Contents
- remote URL
- branch config
- pull on open
- push on close
- connect/disconnect flow

### Primary CTA
- `Save sync settings`

## Tab: Review / PR

### Contents
- branch diff summary
- PR title/description
- push current branch
- create PR

### Helpful framing
- `Review larger doc changes before sharing with the team`

## Empty states

### No remote configured
Headline:
- `Connect this vault to a remote repo`

Body:
- `Use git to share documentation changes with your team, keep the vault backed up, and review updates safely.`

Primary CTA:
- `Connect remote`

### No local changes
- show recent sync activity or quick tips instead of a blank tab

## Interaction rules

### If user enters Sync with no remote
- start on the `Remote` tab automatically

### If user enters Sync with local changes
- start on the `Changes` tab

### If user recently created a branch proposal
- surface a `Continue review` card near the top

## Recommended implementation notes

This screen can largely reuse the existing `GitPanel` functionality, but should be renamed and recontextualized around team sharing and review rather than raw git as a feature bucket.

## Phase 2 Implementation Order

### First
- Agent Access screen
- move MCP setup language out of generic settings

### Second
- Docs Health screen with initial signals

### Third
- Sync rename/reframe and entry logic cleanup

## Handoff To Visual Design

Once Phase 1 and Phase 2 screens exist structurally, the later design pass should focus on:
- stronger layout hierarchy
- trust-oriented status components
- polished cards and summary rows
- more professional typography and spacing
- consistent action placement across screens

At that point the product will have a clear enough workflow for the final visual design to feel meaningful rather than decorative.
