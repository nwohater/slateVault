# slateVault Positioning And Onboarding

## Core Positioning

### One-line version
slateVault is a git-backed project memory vault for software teams, with optional AI agent access through MCP.

### Expanded version
slateVault gives developers and small teams a shared, structured place to keep project documentation for every software project in a vault. The vault lives on disk as markdown, can sync to a remote git repository, and can be exposed to AI coding agents through MCP so they can read trusted context and propose safe updates.

### Product promise
- Human-usable first: your docs should be valuable even if no AI is connected.
- Git-native collaboration: the vault can be versioned, branched, shared, reviewed, and backed up using normal git workflows.
- AI-readable second: agents can load reliable context from the same project memory instead of relying on ad hoc pasted prompts.

## Ideal Customer

### Primary users
- Solo developers managing multiple client or personal software projects
- Small engineering teams that want lightweight internal docs without a hosted wiki
- AI-assisted developers using Codex, Claude, or similar tools during implementation

### Best-fit team traits
- Already comfortable with git
- Prefer markdown and local files over web-only tools
- Need project context to stay close to code work
- Want AI help, but do not want AI to become the system of record

## Messaging Hierarchy

### Lead with this
- A shared, git-backed knowledge repo for software projects
- Structured project memory that stays useful during real implementation work
- Trusted context for coding agents

### Do not lead with this
- Built-in MCP server
- AI-native markdown vault
- Tool count or protocol details

### Translate MCP into user language
Instead of saying "slateVault has an MCP server," say:

- Connect your coding agent to your project docs
- Let agents load trusted context before they start coding
- Let agents propose documentation updates without overwriting source-of-truth docs

## Homepage Copy Draft

### Hero
#### Headline
Project memory for software teams, backed by git

#### Subhead
Keep architecture notes, feature specs, decisions, runbooks, and handoff docs in one markdown vault. Share them through git, and optionally connect AI coding agents through MCP so they can read trusted context and propose safe updates.

#### Primary CTA
Download slateVault

#### Secondary CTA
See how agent context works

### Supporting bullets
- Markdown files on disk, no lock-in
- Git-backed collaboration for project docs
- Canonical and protected docs for safe AI workflows
- MCP access for Codex, Claude, and other coding agents

### Problem section
Software teams keep re-explaining the same project context: architecture, product intent, conventions, decisions, and open questions. It gets scattered across chats, repos, tickets, and note apps. AI coding tools only make that worse when every session starts from zero.

### Solution section
slateVault gives each team a shared project-memory vault. Store the docs that matter, version them with git, and let AI agents read the same trusted context your team uses.

### MCP section
The MCP server is not a separate product. It is how your coding agent plugs into the vault.

- Load canonical docs before starting work
- Build focused context bundles for a task
- Review recent documentation changes
- Propose doc updates on a branch instead of overwriting protected docs

## Product Narrative

### The mental model
- The vault is the shared memory
- Projects organize that memory
- Canonical docs define trusted context
- Git is the collaboration layer
- MCP is the doorway for agents

### The user value loop
1. Create or open a vault
2. Add a project with a clear documentation structure
3. Sync it to a remote repo for team sharing
4. Use the vault during implementation and planning
5. Let AI agents read the same context while coding
6. Keep docs current through updates and proposed changes

## Onboarding Rewrite

### Goal
The onboarding should sell the habit loop, not just explain features.

### Recommended 4-step flow

#### Step 1: Create Your Vault
Prompt:
"Choose where your team documentation vault should live."

Explain:
- All docs are markdown files on disk
- You can back them up or sync them with git

#### Step 2: Start Your First Project
Prompt:
"Pick the kind of project memory you want to start with."

Template choices:
- Software Project
- Product + Engineering
- API / Platform
- Lightweight Solo Project

Explain:
- Each template creates a practical folder structure
- You can customize it later

#### Step 3: Connect Team Sync
Prompt:
"Do you want to connect this vault to a remote git repo?"

Explain:
- Pull updates when opening the vault
- Push documentation changes to share with your team
- Use branches and PRs for larger doc changes

#### Step 4: Connect Your Coding Agent
Prompt:
"Do you want AI coding tools to read this vault?"

Explain:
- Agents can load trusted project context through MCP
- Protected and canonical docs help keep important docs safe
- You will get a tested copy-paste config, not protocol jargon

## First-Run Empty States

### No projects yet
"Create your first project memory space. Start with architecture, decisions, runbooks, and feature docs."

### No canonical docs yet
"Mark a few docs as canonical so your team and agents know what to trust first."

### MCP not configured yet
"Connect your coding agent so it can load project context automatically before implementation work."

## What Makes slateVault Different

- It is a documentation system designed for code-adjacent work, not a general-purpose wiki.
- It stays local and git-friendly instead of forcing a hosted workspace model.
- It treats AI as a consumer of trusted docs, not as the owner of the knowledge base.
- It has a built-in safety model for AI context and AI edits.

## Product Risks To Avoid

- Do not market MCP as the primary feature.
- Do not let the app feel like "just a markdown editor with chat."
- Do not make users invent their own project structure from scratch.
- Do not let AI overwrite important docs without a proposal workflow.
