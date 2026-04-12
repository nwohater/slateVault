# slateVault Product Roadmap

## Product Direction
slateVault should be built as a git-backed project memory system for software teams, with MCP as the bridge to AI coding agents.

The product should become excellent in this order:
1. Human documentation workflow
2. Team sharing and trust
3. AI context and safe agent collaboration

## Near-Term Priorities

### Priority 1: Make The Core Story Obvious
Goal:
Users should immediately understand that slateVault is the documentation home for software projects.

Ship:
- homepage copy rewrite around "git-backed project memory"
- onboarding rewrite around vault -> project -> sync -> agent
- stronger empty states for projects, canonical docs, and MCP setup
- cleaner terminology in the UI: prefer "agent access" over protocol-heavy language

### Priority 2: Ship A Strong Default Project Structure
Goal:
Users should not have to invent their own documentation system from scratch.

Ship:
- better default project template
- canonical starter docs
- template chooser with practical examples
- "create missing starter docs" action

### Priority 3: Make MCP Useful During Real Coding Work
Goal:
The MCP layer should clearly improve implementation sessions.

Ship:
- start-session brief
- task-specific context bundle action
- better MCP setup/test flow
- agent presets for common coding tasks
- stronger protected/canonical guidance in agent-facing flows

### Priority 4: Keep Docs Healthy Over Time
Goal:
The vault should stay useful after the first week.

Ship:
- stale docs dashboard
- docs missing canonical coverage
- docs with no backlinks
- recent work without doc updates
- "current state" handoff generator

## Suggested Release Plan

## Phase 1: Product Clarity
Focus:
- positioning
- onboarding
- templates
- empty states

Success signals:
- users can explain the product after one minute
- first project setup feels guided instead of open-ended

## Phase 2: Team Memory Workflow
Focus:
- stronger project structure
- better git sync flow
- review-safe doc editing
- handoff/current-state docs

Success signals:
- teams use slateVault even without AI enabled
- important docs become canonical and stay maintained

## Phase 3: Agent Workflow
Focus:
- brief generation
- context bundles
- proposal-based edits
- source-aware context

Success signals:
- users connect agents because it improves coding sessions
- MCP usage maps to real implementation tasks, not just experiments

## Phase 4: Docs Health And Maintenance
Focus:
- drift detection
- stale docs
- code-to-doc hints
- maintenance dashboard

Success signals:
- users return to slateVault to understand what needs updating

## Concrete Feature Backlog

### Tier A: Highest leverage
- Start Session button
- Better default project template
- Canonical starter docs
- MCP setup wizard with test connection
- Generate current-state handoff doc
- Docs health panel

### Tier B: High-value follow-up
- Suggest docs impacted by recent code changes
- Missing-doc detection based on linked source folder
- Proposal-first flow for canonical docs
- Agent activity history
- Richer onboarding for remote git sync

### Tier C: Later
- Broken link validation
- Import from existing markdown repos
- semantic or hybrid search
- comments or annotation workflow
- team/enterprise governance features

## What To Measure

If you later add analytics, measure:
- time to first project created
- time to first canonical doc
- time to first git sync
- time to first successful MCP connection
- percentage of sessions using Start Session / briefs
- percentage of projects with at least 3 canonical docs
- doc update activity after code work

## Team / Enterprise Direction

If you ever move beyond one-time license into a team tier, likely value adds are:
- hosted team vault sync
- role-based permissions
- approval workflows
- audit logs for AI edits
- shared MCP policy controls
- SSO / identity integration

## Strategic Rule

The product wins if a team says:
"This is where our project context lives, and it makes both humans and coding agents faster."

If they instead say:
"It has an MCP server and a markdown editor,"
the product story is still too weak.
