# MCP Workflow For Coding Agents

## Purpose
The MCP server should make slateVault useful during coding work, not just expose documentation APIs.

The best mental model is:
- Humans maintain the project memory
- Agents consume that memory before and during coding
- Agents can propose documentation updates back into the vault

## Core MCP Story

### What the MCP layer should help an agent do
- Understand a project before making changes
- Find trusted context for a specific task
- Resume work after time away
- Suggest doc updates after implementation
- Avoid overwriting important source-of-truth docs

### What it should not feel like
- A long generic tool list
- A second documentation UI
- A protocol feature users must understand before getting value

## Recommended Default Agent Flow

### Workflow 1: Start Coding Session
Use when:
- an agent is asked to implement, debug, or review something

Recommended tool sequence:
1. `get_project_context`
2. `get_canonical_context`
3. `generate_agent_brief`
4. `build_context_bundle` with the task as the query

Expected result:
- The agent starts with trusted docs, current state, and a task-specific brief instead of asking basic orientation questions

### Workflow 2: Investigate A Specific Area
Use when:
- the task is narrow, such as auth, payments, sync, or PDF export

Recommended tool sequence:
1. `build_context_bundle`
2. `search_documents`
3. `read_document` on the most relevant docs
4. `get_recent_changes`

Expected result:
- The agent can form a grounded understanding of the subsystem quickly

### Workflow 3: Draft New Documentation
Use when:
- a feature, spec, or note needs to become a real project document

Recommended tool sequence:
1. `build_context_bundle`
2. `convert_to_spec` if starting from messy notes
3. `write_document`

Expected result:
- The agent creates a useful first draft in the right project location

### Workflow 4: Update Protected Or Canonical Docs Safely
Use when:
- the relevant doc is important and should not be overwritten directly

Recommended tool sequence:
1. `read_document`
2. `build_context_bundle`
3. `propose_doc_update`
4. `summarize_branch_diff`

Expected result:
- The agent proposes a change on a branch and returns a diff for human review

### Workflow 5: Resume Work
Use when:
- the team or agent is returning to a project after time away

Recommended tool sequence:
1. `generate_agent_brief`
2. `get_recent_changes`
3. `detect_stale_docs`

Expected result:
- The agent can answer "what changed, what matters now, and what is likely stale?"

## MCP Setup UX Recommendations

### In-product phrasing
Use:
- Connect Codex or Claude to this vault
- Let your coding agent load trusted project context
- Test agent access

Avoid:
- Start stdio MCP server
- Configure protocol transport
- Expose tool schema

### Setup output the user actually needs
- Copy-paste config for the target agent
- Which vault path is being shared
- Whether the server is read-only or writable
- A one-click test prompt

### Platform-specific command names
macOS installs the MCP server at:

```text
/usr/local/bin/slatevault-mcp
```

macOS users can verify the command with:

```bash
which slatevault-mcp
slatevault-mcp --help
```

Windows installs the MCP sidecar with the app, creates a stable
`slatevault-mcp.exe` alias, and adds the install directory to the current
user's PATH. Windows users may need to open a new terminal or restart their AI
app after installing.

Windows users can verify the command with:

```powershell
where slatevault-mcp.exe
slatevault-mcp.exe --help
```

Claude Code setup:

```bash
claude mcp add -s user slatevault -- slatevault-mcp
```

Claude Code setup on Windows:

```powershell
claude mcp add -s user slatevault -- slatevault-mcp.exe
```

Generic MCP client config on macOS:

```json
{
  "mcpServers": {
    "slatevault": {
      "command": "slatevault-mcp",
      "args": []
    }
  }
}
```

Generic MCP client config on Windows:

```json
{
  "mcpServers": {
    "slatevault": {
      "command": "slatevault-mcp.exe",
      "args": []
    }
  }
}
```

## GitHub Copilot And Augment Setup

### GitHub Copilot in VS Code

GitHub Copilot in VS Code supports local MCP servers through `.vscode/mcp.json`.
Use VS Code 1.99 or later, open Copilot Chat in Agent mode, and make sure MCP is
enabled by organization policy for Copilot Business or Enterprise users.

For macOS:

```json
{
  "servers": {
    "slatevault": {
      "command": "slatevault-mcp",
      "args": []
    }
  }
}
```

For Windows:

```json
{
  "servers": {
    "slatevault": {
      "command": "slatevault-mcp.exe",
      "args": []
    }
  }
}
```

After saving `.vscode/mcp.json`, VS Code should show a Start action above the
server entry. Start the server, open Copilot Chat, switch to Agent mode, and
confirm the slateVault tools appear in the tools list.

### GitHub Copilot CLI

Copilot CLI can add MCP servers interactively with `/mcp add` and manage them
with `/mcp show`, `/mcp edit`, `/mcp disable`, and `/mcp delete`.

Use the same local command name:

```text
slatevault-mcp
```

On Windows:

```text
slatevault-mcp.exe
```

### Augment Code extension

Augment's MCP settings panel asks for a name and command. Use:

```text
Name: slatevault
Command: slatevault-mcp
```

On Windows:

```text
Name: slatevault
Command: slatevault-mcp.exe
```

No environment variables are needed for slateVault. If the command is not found
on Windows, open a fresh terminal or restart the IDE after installing slateVault
so the user PATH update is visible.

Augment also supports importing JSON. For macOS:

```json
{
  "mcpServers": {
    "slatevault": {
      "command": "slatevault-mcp",
      "args": []
    }
  }
}
```

For Windows:

```json
{
  "mcpServers": {
    "slatevault": {
      "command": "slatevault-mcp.exe",
      "args": []
    }
  }
}
```

### Auggie CLI

Auggie can persist MCP servers in `~/.augment/settings.json`, and its CLI can add
stdio servers directly.

For macOS:

```bash
auggie mcp add slatevault -- slatevault-mcp
```

For Windows:

```powershell
auggie mcp add slatevault -- slatevault-mcp.exe
```

Users can verify with:

```bash
auggie mcp list
```

## Recommended Write Safety Model

### Human-safe defaults
- Read-only mode should be easy to enable
- Protected docs should default to proposal-only edits
- Canonical docs should be visually obvious
- Agents should be nudged toward `propose_doc_update` for important docs

### Recommended guardrails
- Warn when an agent tries to overwrite a canonical doc directly
- Show which tool wrote or proposed a document change
- Keep branch-based review the default for high-value docs

## Highest-Value MCP Tools

If you had to feature a smaller set in the UI, lead with:

- `generate_agent_brief`
- `get_canonical_context`
- `build_context_bundle`
- `get_recent_changes`
- `propose_doc_update`

These are the tools that create a "better coding session" experience.

## Features That Would Make MCP Stickier

### 1. Agent presets
Examples:
- Start implementation
- Investigate bug
- Draft feature spec
- Review docs drift
- Prepare handoff

### 2. Task-scoped brief generation
The app should help the user ask:
- "Build context for authentication refactor"
- "Prepare context for release workflow debugging"

### 3. Post-change doc suggestions
After code work, suggest:
- docs likely impacted
- stale docs related to changed areas
- candidate canonical docs to update

### 4. Source-aware context
If a source folder is linked, combine:
- canonical docs
- recent documentation changes
- relevant source files

### 5. Agent activity history
Let users see:
- which docs an agent read
- which docs it updated
- which proposals it opened

## Product Rule

MCP should reduce orientation time and increase documentation quality during coding work. If it does not make an implementation session feel smarter or safer, it is not yet doing enough.
