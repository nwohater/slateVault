# slateVault UX Structure And Screen Plan

## Goal
Turn slateVault from a capable toolset into a product with an obvious workflow:

1. Set up a vault
2. Create structured project memory
3. Sync it with a team through git
4. Use it during coding work
5. Connect coding agents when ready
6. Keep docs healthy over time

This document defines the UX structure that should come before visual polish.

## Current UX Shape

## What the current app does well
- The app already has a strong desktop-workbench foundation
- The sidebar exposes most major surfaces quickly
- The editor + preview + terminal layout fits technical users
- Git and AI capabilities already exist inside the product

## What currently feels unclear
- The product story is not reflected in the information architecture
- MCP is presented more as a feature than as a workflow
- AI chat is visible, but "agent access" is not framed as a real-world outcome
- The onboarding is feature-oriented instead of job-oriented
- Important user states like canonical docs, docs health, and session kickoff are not yet first-class surfaces

## UX Principle
The UI should be organized around user jobs, not implementation modules.

That means the app should prioritize:
- project memory
- sync and trust
- start-session context
- docs health
- agent access

over:
- tool categories
- protocol terms
- internal architecture

## Recommended Information Architecture

## Primary product surfaces

### 1. Projects
Purpose:
- browse projects
- create new projects
- understand project status quickly

This should answer:
- what projects exist?
- which ones are healthy?
- which ones need attention?

### 2. Documents
Purpose:
- edit docs
- browse structure
- manage canonical and protected docs

This is the main working surface once a project is open.

### 3. Start Session
Purpose:
- prepare a human or agent for implementation work

This should become one of the product's signature screens.

It should answer:
- what should I read first?
- what changed recently?
- what docs are most relevant to the task?

### 4. Sync
Purpose:
- remote git setup
- commit / push / pull / branch / PR workflows

This is more understandable than a generic "Git" tab when paired with the product story.

### 5. Agent Access
Purpose:
- connect Codex / Claude / other agents
- test access
- explain safe write behavior
- show key agent workflows

This should replace the feeling of "MCP server settings buried in settings."

### 6. Docs Health
Purpose:
- stale docs
- missing canonical docs
- missing handoff docs
- likely drift between recent work and docs

This helps keep the vault useful over time.

### 7. Settings
Purpose:
- advanced configuration
- theme
- credentials
- lower-level controls

Settings should no longer be where the primary MCP story lives.

## Recommended Navigation Model

## Left rail
Suggested order:
- Projects
- Search
- Start Session
- Sync
- Agent Access
- Docs Health
- Settings

## Within a selected project
The project workspace should then emphasize:
- document tree
- current doc
- preview
- project actions

This keeps global navigation separate from project-level editing.

## Screen Plan

## Screen 1: Vault Home / Projects
This should replace the feeling of jumping straight into a file explorer with little orientation.

### Core sections
- Vault summary
- Project cards or list
- Quick actions
- Docs health summary
- Agent access summary

### Project card contents
- project name
- description
- number of docs
- number of canonical docs
- recent activity
- linked source folder status
- health warning if key docs are missing

### Quick actions
- Create project
- Connect remote
- Start session
- Connect agent

## Screen 2: Project Workspace
This remains the main editing area.

### Layout
- left project navigator
- center editor
- right preview / context / metadata
- bottom terminal optional

### Improvements
- stronger project header
- visible canonical and protected indicators
- explicit "Generate brief" or "Start session" action
- better empty states for folders and missing docs

### Recommended project header actions
- Start Session
- Build Context Bundle
- Mark as Canonical
- Propose Update
- Open Sync

## Screen 3: Start Session
This should become a first-class workflow, not just something the AI panel can approximate.

### Inputs
- selected project
- optional task prompt
- include canonical docs
- include recent changes
- include linked source folder

### Outputs
- project brief
- recommended docs to read
- recent changes summary
- stale or risky docs
- copy/export to agent

### Calls to action
- Copy for agent
- Open relevant docs
- Generate focused context bundle

## Screen 4: Agent Access
This is the replacement for protocol-heavy MCP framing.

### Core sections
- status: connected or not
- supported agents
- one-click copy config
- read-only / writable mode
- safe editing explanation
- key workflows

### User-facing framing
Use:
- Connect your coding agent
- Let your agent load trusted project context
- Test agent access

Avoid:
- raw protocol language
- tool schema dumps
- server implementation details

### Key widgets
- copy-paste setup cards for Claude / Codex / others
- test connection button
- sample prompts
- explanation of canonical/protected behavior

## Screen 5: Docs Health
This should make ongoing maintenance feel manageable.

### Core sections
- stale docs
- no canonical docs
- missing current-state handoff
- recent project changes with no doc updates
- docs with no backlinks

### Suggested actions
- Review stale docs
- Generate current-state handoff
- Create missing starter docs
- Open affected docs

## Screen 6: Sync
This is the human collaboration layer.

### Core sections
- remote status
- current branch
- uncommitted changes
- recent commits
- pull / push / branch / PR actions

### Product framing
Do not present this as only developer plumbing.
Present it as:
- how the team shares the vault
- how documentation changes are reviewed safely

## Screen 7: Onboarding
The current onboarding explains features. The new onboarding should set up the habit loop.

### New step order
1. Create or open your vault
2. Create your first project
3. Connect team sync
4. Connect your coding agent

### Success criteria
At the end of onboarding, the user should have:
- one project
- a practical structure
- a clear sense of what canonical docs are
- a visible next step: either edit docs or connect an agent

## Current Component Mapping

## Existing components that can likely be reused
- `AppShell`
- `Sidebar`
- `EditorPane`
- `MarkdownPreview`
- `GitPanel`
- `TerminalPanel`
- `SearchView`
- `SettingsPanel`

## Existing components that likely need conceptual repositioning
- `Onboarding`
- `AiChatPanel`
- MCP settings in `SettingsPanel`
- sidebar labels and ordering

## Recommended feature repositioning
- Move MCP setup out of generic settings into Agent Access
- Reframe AI chat as one part of agent workflows, not the whole AI story
- Promote Start Session to a major action
- Promote Docs Health to a primary product surface

## Priority UX Implementation Order

### Phase 1
- onboarding rewrite
- left-rail restructuring
- vault home / projects screen

### Phase 2
- Start Session screen
- Agent Access screen
- Docs Health screen

### Phase 3
- project workspace refinements
- sync screen cleanup
- better empty states and call-to-action placement

### Phase 4
- visual redesign across all surfaces

## Professional UI Goals For The Later Design Pass
When the UI pass begins, it should aim for:
- calmer and more editorial hierarchy
- stronger sense of trust and reliability
- clearer distinction between human docs and agent actions
- more intentional spacing and typography
- better empty states and onboarding guidance

The later visual design should make slateVault feel like a serious documentation workspace for software teams, not a generic dev utility.

## Next Design Deliverables
After this UX structure is accepted, the next design artifacts should be:
- wireframe spec for Vault Home
- wireframe spec for Onboarding
- wireframe spec for Start Session
- wireframe spec for Agent Access
- wireframe spec for Docs Health

Only after those should the visual redesign begin.
