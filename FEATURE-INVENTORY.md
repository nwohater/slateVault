# slateVault Feature Inventory & Review Checklist

## Product Summary
slateVault is a local-first, AI-native markdown document vault for dev teams. It combines structured documentation, git version control, and an MCP server that lets AI coding agents read, write, search, and assemble context from the vault.

**Target users:** Dev teams, AI-assisted developers, technical writers
**Price:** $29.99 one-time license
**Platforms:** Windows, macOS, Linux (Tauri desktop app)

---

## Core Features

### Document Management
- Create, read, update, delete markdown documents
- YAML frontmatter: id, title, author (human/ai/both), status (draft/review/final), tags, created, modified, ai_tool attribution
- `canonical` flag — marks source-of-truth docs (gold star in UI, prioritized in AI context bundles)
- `protected` flag — blocks AI tools from overwriting (humans can still edit)
- Plain `.md` files on disk (portable, no lock-in)
- Rename documents (updates frontmatter title)

### Project Organization
- Group documents into projects with metadata (name, description, tags)
- Folder management: create, delete, nested folders
- Folder tree rendering with expandable/collapsible hierarchy
- Drag-and-drop files between folders (auto-stages move in git)
- Template-defined folder ordering (persisted in project.toml)
- AI context files: pin key docs per project so AI tools always have context

### Project Templates
- Template selection on project creation (radio buttons in sidebar + onboarding)
- 4 built-in templates: Software Development, Agile Development, Vibe Coding, Minimal
- Customizable templates via `templates.json` (editable in-app via Settings → Edit Project Templates)
- Templates define: folders, starter files with frontmatter, folder sort order
- Starter `_about.md` files explain each folder's purpose
- Template files auto-pinned as AI context files

### Editor
- CodeMirror 6 markdown editor with syntax highlighting
- One Dark theme with custom overrides
- Split pane: editor + live markdown preview
- Resizable panes (sidebar, editor, preview)
- FrontMatterBar showing title, status badge, author, tags, canonical/protected indicators
- Ctrl+S to save
- Raw vault file editing (e.g. templates.json opens in editor with save button)
- Auto-save on document switch
- Secret detection: warns on API keys, tokens, private keys, AWS credentials in editor

### Markdown Preview
- React-Markdown with GitHub Flavored Markdown (GFM) support
- Remark plugins: remark-gfm, remark-frontmatter
- Tailwind Typography styling (dark theme)
- "Copy as Prompt" button — strips frontmatter, copies clean markdown to clipboard formatted for AI agents
- "Export PDF" button — single document PDF export
- Related documents section — shows tag-based suggestions at bottom of preview, clickable to open

### Search
- SQLite FTS5 full-text search engine with Porter stemming
- Search across all documents or scoped to a project
- Search by title, content, tags, metadata
- Filtered search: filter by author (human/ai/both), status (draft/review/final), canonical-only
- Ranked results with snippet previews
- Debounced search bar (300ms) with dropdown results
- Rebuild index command (auto-migrates old schema)

### Git Version Control
- Built-in git integration (git2 crate for local, CLI for network ops)
- Stage / unstage individual files
- Stage all unstaged files
- Commit with message (Ctrl+Enter shortcut)
- View commit history (50 commits, time-sorted)
- Push / pull from remote
- Clone repositories
- Remote configuration: URL, branch, SSH key path
- Auto-pull on vault open (configurable)
- Auto-push on app close (configurable)
- Auto-stage AI-written documents

### Branch Management
- Create, switch, list, delete branches
- BranchSelector dropdown in Git panel
- Switch refuses on dirty worktree (safety)
- Dynamic branch display in status bar
- Push specific branch to remote

### Diff Viewer
- File diffs (staged and unstaged) via git2 Patch API
- Branch-to-branch diffs
- Inline diff view with line numbers, green/red highlighting, hunk headers
- Click any file in Changes tab to view diff

### Pull Request Workflow
- PR creation for GitHub (REST API, Bearer PAT)
- PR creation for Azure DevOps (REST API, Basic auth PAT)
- Auto-detect platform from remote URL
- PR tab in Git panel: title, description, source/target branch, diff summary
- Auto-generated PR description from branch diff (file list with +/- stats)
- "Push & Create PR" single action button
- Opens PR URL in browser after creation
- Credential storage in `~/.slatevault/credentials.toml` (outside git-tracked vault)
- Credentials section in Settings with masked display

### PDF Export
- Single document export to PDF (Export PDF button in preview toolbar)
- Full project export to PDF (right-click project → Export to PDF)
- Project PDF: sections per folder, folder-order respected, `_about.md` files excluded
- Progress indicator modal during project export
- Print-friendly styling: white background, proper typography, hex colors (no oklch)
- Checkbox rendering: Unicode ballot box characters for clean PDF output
- Native Save dialog via Tauri
- Base64 IPC transfer, JPEG compression (85%) for manageable file sizes

### MCP Server (17 tools)

**Project & Document CRUD:**
- `create_project` — create new project (respects read-only mode)
- `list_projects` — list all projects with metadata
- `get_project_context` — load pinned AI context files
- `write_document` — create/overwrite docs (blocked on protected docs for AI, respects read-only)
- `read_document` — read document with frontmatter
- `list_documents` — list docs with optional tag filter
- `append_to_doc` — append content without overwriting (respects protection + read-only)

**Search & Context:**
- `search_documents` — full-text search with filters (author, status, canonical_only)
- `build_context_bundle` — search + rank + concatenate docs into AI briefing (canonical docs first)
- `get_canonical_context` — fast-path: returns only canonical docs for a project

**Safe Collaboration:**
- `propose_doc_update` — write update on a new branch, return diff for human review
- `convert_to_spec` — read scratchpad/note, return content with structured spec template

**Git & Maintenance:**
- `detect_stale_docs` — flag docs not updated within threshold days
- `summarize_branch_diff` — structured diff between branches for PR descriptions

**Configuration:**
- `mcp.read_only` config option — disables all MCP write operations when true
- Server instructions guide agents on proper usage, safety, and best practices

### Onboarding
- 3-step guided flow for new vaults: Welcome → Create Project (with template picker) → MCP Setup
- Feature highlights: Documents, Git, MCP
- Template selection with radio buttons
- MCP setup command with copy-to-clipboard
- "How it works" explanation and key tools listing

### UI & UX
- SVG icon library: file/folder icons, git status icons, action icons, tab icons
- 4 themes: Dark (default), Light, Olive, Deep Blue
- Status bar: vault name, project/doc counts, MCP status indicator, current branch
- Integrated terminal (xterm.js with PTY)
- Keyboard shortcuts: Ctrl+Shift+F (search), Ctrl+T (terminal), Ctrl+S (save)
- Context menus: project (new folder, export PDF, rename, show in explorer, delete), folder (new folder, show in explorer, delete), document (rename, show in explorer, delete)
- Vault picker on startup (create, open, or clone vault)

### Desktop App
- Tauri 2 native desktop app
- Windows, macOS, Linux support
- NSIS and MSI installers for Windows
- MCP binary bundled as sidecar (externalBin)
- App icon (vicon.png shield design)
- Window icon set programmatically

### Product Website (slatevault.dev)
- Next.js marketing site on Vercel
- Hero, features grid, MCP section, tech stack, pricing ($29.99)
- Dark theme with cyan glow effects

---

## What's NOT Built (Potential Gaps)

### Agent & AI
- Agents cannot set canonical/protected flags (human-only by design)
- No auto-session summaries (agent can build manually with existing tools)
- No infer_doc_type (auto-detect document type from content)

### Search
- No search result explanations (why did this match?)
- No semantic/embedding-based search

### Collaboration & Teams
- No user authentication or accounts
- No role-based access (admin/editor/viewer)
- No SSO/SAML
- No vault encryption at rest
- No team vault server (shared hosting)
- No webhooks (notify Slack/Teams on doc changes)
- No real-time co-editing (CRDTs)
- No comments or annotations on documents
- No approval gates (require sign-off before status change)

### Content Quality
- No drift detection (references to removed files, outdated terms)
- No link validation (detect broken internal doc links)
- No word count / reading time estimates
- No spell check integration
- No document review reminders

### Import/Export
- No import from Confluence, Notion, or other wikis
- No export to DOCX or HTML
- No bulk import from markdown folder
- No backup/restore vault functionality

### Developer Experience
- No plugin/extension system
- No REST API (only MCP stdio)
- No doc-to-code linking (reference source files)
- No semantic diff viewer
- No context compression (summarize large docs for smaller prompts)

### Licensing & Distribution
- No license key validation / paywall (Lemon Squeezy integration planned)
- No auto-update mechanism
- No telemetry or analytics
- No crash reporting

---

## Review Prompt

```
Review the slateVault feature inventory above. The product is a local-first, AI-native markdown document vault for dev teams, priced at $29.99 one-time.

Analyze:
1. What critical features are missing for the $29.99 price point?
2. What from the "Not Built" section should be prioritized for v1.0 launch?
3. What features do competing products (Obsidian, Notion, Confluence) have that would be expected at this price?
4. What features would justify a Team/Enterprise tier ($12-15/user/mo)?
5. Any UX gaps that would cause friction for new users?
6. What would make the MCP server more valuable for AI workflows?
7. Security concerns for dev team documentation?
```
