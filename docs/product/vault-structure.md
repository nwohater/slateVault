# Recommended Vault And Project Structure

## Design Goal
The structure should help a developer or team answer three questions quickly:

- What is this project?
- How does it work?
- What should an engineer or agent read before changing it?

## Vault Model

### Vault level
A vault should represent a person's or team's software-project memory repo.

Recommended vault responsibilities:
- Hold multiple software projects
- Be shareable through a remote git repo
- Keep reusable templates and playbooks at the vault root
- Provide a stable MCP entry point for agents

### Project level
Each project should be the unit of context loading, maintenance, and team ownership.

Recommended project metadata:
- Name
- Description
- Tags
- Source folder or source repo link
- Canonical docs
- Owner or team
- Current lifecycle state

## Recommended Default Project Template

### Folder layout
```text
project/
  docs/
    overview/
      _about.md
      project-summary.md
      glossary.md
    architecture/
      _about.md
      system-overview.md
      data-model.md
      integration-map.md
    decisions/
      _about.md
      0001-example-decision.md
    features/
      _about.md
      feature-index.md
    delivery/
      _about.md
      roadmap.md
      milestones.md
    runbooks/
      _about.md
      local-development.md
      deploy.md
      incident-response.md
    handoff/
      _about.md
      onboarding.md
      current-state.md
```

### Why this works
- `overview` answers "what is this?"
- `architecture` answers "how does it work?"
- `decisions` captures why tradeoffs were made
- `features` tracks product or implementation-specific work
- `delivery` covers planning and sequencing
- `runbooks` captures operational tasks
- `handoff` makes the project understandable to a new human or agent

## Canonical Doc Recommendations

Every project should have 3-5 canonical docs by default:

- `overview/project-summary.md`
- `architecture/system-overview.md`
- `decisions/0001-example-decision.md` once real decisions exist
- `runbooks/local-development.md`
- `handoff/current-state.md`

These should be the first docs humans and agents load.

## Protected Doc Recommendations

Docs that should usually be protected:
- Core architecture docs
- Security or compliance docs
- Operational runbooks
- Current-state handoff docs
- Any decision log once finalized

Protected docs should still be editable by humans, but agents should propose updates instead of direct overwrites.

## AI Context Strategy

### Pin these by default
- Project summary
- System overview
- Local development guide
- Current-state handoff

### Context bundle guidance
Use search-built context bundles for task-specific work such as:
- authentication changes
- API updates
- deployment work
- debugging a subsystem

Do not rely only on pinned context for every task.

## Templates To Ship

### 1. Software Project
Best for:
- web apps
- desktop apps
- backend services

### 2. Product + Engineering
Best for:
- teams mixing product specs and implementation docs

Add:
- `research/`
- `requirements/`

### 3. API / Platform
Best for:
- SDKs
- platform tools
- internal services

Add:
- `contracts/`
- `integrations/`

### 4. Solo Lightweight
Best for:
- indie builders
- side projects

Reduce to:
- `overview/`
- `features/`
- `runbooks/`
- `handoff/`

## Helpful Project Health Signals

The app should eventually surface these:

- No canonical docs yet
- No current-state handoff doc
- No local development runbook
- Many drafts, few finals
- Source folder connected but no architecture docs
- Recent code work with no doc updates

## Suggested In-App Actions

The project sidebar should make these common:

- Create canonical starter docs
- Mark current doc as canonical
- Generate current-state handoff
- Build agent brief
- Review stale docs
- Propose update to protected doc

## Rule Of Thumb

If a new teammate or coding agent cannot get productive in ten minutes from the project docs, the structure is not doing enough work yet.
