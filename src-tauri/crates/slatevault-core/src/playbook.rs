use serde::{Deserialize, Serialize};
use std::path::Path;

use crate::error::Result;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Playbook {
    pub id: String,
    pub label: String,
    pub description: String,
    /// Prompt template. Use {{project}} for project name, {{folders}} for folder list, {{doc_count}} for doc count.
    pub prompt: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlaybookConfig {
    pub playbooks: Vec<Playbook>,
}

impl PlaybookConfig {
    pub fn built_in() -> Self {
        Self {
            playbooks: vec![
                Playbook {
                    id: "document-as-you-go".to_string(),
                    label: "Document as You Go".to_string(),
                    description: "Continuous documentation during development. AI documents decisions, specs, and changes as you work.".to_string(),
                    prompt: r#"You have access to slateVault via MCP. Use project "{{project}}" as your persistent memory.
{{folders_section}}
## Rules
1. Before writing any doc, call search_documents to check if one already exists — update rather than duplicate
2. Always set ai_tool to your tool name when writing docs
3. For important/existing docs, use propose_doc_update instead of write_document
4. Tag documents appropriately
5. Respect protected and canonical documents

## What to Document
As you work, document these in the appropriate folders:
- **Decisions** → decisions/ (why you chose an approach, trade-offs considered)
- **Specs** → specs/ (what you're building, requirements, design)
- **Changes** → changelog/ (what you did, what changed)
- **Bugs found** → bugs/ (description, repro steps, fix)
- **Ideas/notes** → notes/ (quick captures, things to revisit)

## End of Session
Write a session summary to changelog/ with:
- What was done
- What changed
- What's next
- Any blockers or open questions"#.to_string(),
                },
                Playbook {
                    id: "reverse-engineer".to_string(),
                    label: "Reverse Engineer Project".to_string(),
                    description: "AI analyzes the codebase and creates comprehensive documentation in the vault.".to_string(),
                    prompt: r#"You have access to slateVault via MCP. Your task is to reverse-engineer and document the project "{{project}}" comprehensively.
{{folders_section}}
## Process
1. First call get_project_context to understand what docs already exist
2. Analyze the codebase structure, key files, and architecture
3. Write documentation in this order:

### Architecture (specs/)
- System overview with component diagram
- Data flow and key abstractions
- Tech stack and dependencies

### Features (features/)
- One doc per major feature
- Include: what it does, how it works, key files involved

### Decisions (decisions/)
- Document any architectural decisions you can infer
- Use numbered format: 001-description.md

### Guides (guides/)
- Getting started / setup guide
- Development workflow
- How to add a new feature

4. After writing all docs, call search_documents to verify completeness
5. Mark the architecture overview as the recommended canonical document
6. Write a summary of what was documented and any gaps found"#.to_string(),
                },
                Playbook {
                    id: "resume-session".to_string(),
                    label: "Resume Session".to_string(),
                    description: "Bring an AI agent up to speed on what happened since the last session.".to_string(),
                    prompt: r#"You have access to slateVault via MCP for project "{{project}}".

## Startup
1. Call generate_agent_brief for project "{{project}}" to get full project context
2. Call get_recent_changes to see what happened since last session
3. Review any documents modified in the last few days

## Then
- Summarize what's changed since the last session
- Identify any incomplete work or open items
- Ask me what I'd like to focus on today
- Continue documenting as we work (decisions, specs, changes)"#.to_string(),
                },
                Playbook {
                    id: "code-review-docs".to_string(),
                    label: "Code Review Documentation".to_string(),
                    description: "Document a PR's changes, decisions, and impact in the vault.".to_string(),
                    prompt: r#"You have access to slateVault via MCP for project "{{project}}".

## Task
Document the current code review / PR in the vault.

1. Call summarize_branch_diff to understand what changed
2. Write a document to changelog/ describing:
   - What changed and why
   - Files affected
   - Any architectural implications
3. If any decisions were made, document them in decisions/
4. If any specs need updating based on the changes, use propose_doc_update
5. Flag any concerns or risks you notice

Use search_documents first to check if related docs already exist."#.to_string(),
                },
                Playbook {
                    id: "sprint-release-notes".to_string(),
                    label: "Sprint / Release Notes".to_string(),
                    description: "Generate a changelog and release notes from recent commits and doc changes.".to_string(),
                    prompt: r#"You have access to slateVault via MCP for project "{{project}}".

## Task
Generate release notes from recent work.

1. Call get_recent_changes to see all recent modifications
2. Call search_documents for recent changelog entries
3. Compile a release notes document covering:
   - New features added
   - Bugs fixed
   - Breaking changes
   - Known issues
   - Contributors / AI tools involved
4. Write the release notes to changelog/release-notes-[date].md
5. Tag it with [release, changelog]"#.to_string(),
                },
                Playbook {
                    id: "onboard-team-member".to_string(),
                    label: "Onboard Team Member".to_string(),
                    description: "Generate a comprehensive project walkthrough from existing documentation.".to_string(),
                    prompt: r#"You have access to slateVault via MCP for project "{{project}}".

## Task
Create an onboarding guide for a new team member.

1. Call generate_agent_brief to understand the full project
2. Call get_canonical_context for the source-of-truth docs
3. Call build_context_bundle with query "architecture setup getting started"
4. Write a comprehensive onboarding guide to guides/onboarding.md covering:
   - Project overview and purpose
   - Tech stack and architecture
   - How to set up the development environment
   - Key concepts and terminology
   - Where to find important documentation
   - Common workflows
   - Who to ask for help / key contacts
5. Reference specific docs using their paths so the reader can dig deeper"#.to_string(),
                },
                Playbook {
                    id: "architecture-audit".to_string(),
                    label: "Architecture Audit".to_string(),
                    description: "AI reviews documentation for gaps, inconsistencies, and staleness.".to_string(),
                    prompt: r#"You have access to slateVault via MCP for project "{{project}}".

## Task
Audit the project's documentation for quality and completeness.

1. Call generate_agent_brief to get the full picture
2. Call detect_stale_docs to find outdated documentation
3. Call list_documents to see all docs and their statuses
4. Review canonical documents for accuracy

## Report
Write an audit report to notes/doc-audit-[date].md covering:

### Completeness
- Are all major features documented?
- Is there an architecture overview?
- Are decisions recorded?
- Is there a getting-started guide?

### Quality
- Are docs up to date?
- Are there conflicting statements across docs?
- Are drafts that should be finalized?

### Gaps Found
- Missing documentation areas
- Docs that reference things that no longer exist
- Features without specs

### Recommendations
- Which docs should be promoted to canonical
- Which docs should be protected
- Priority order for fixes

Tag the report with [audit, quality]"#.to_string(),
                },
            ],
        }
    }

    pub fn load(vault_root: &Path) -> Result<Self> {
        let path = vault_root.join("playbooks.json");
        if path.exists() {
            let content = std::fs::read_to_string(&path)?;
            let config: PlaybookConfig =
                serde_json::from_str(&content).unwrap_or_else(|_| Self::built_in());
            Ok(config)
        } else {
            let config = Self::built_in();
            config.save(vault_root)?;
            Ok(config)
        }
    }

    pub fn save(&self, vault_root: &Path) -> Result<()> {
        let path = vault_root.join("playbooks.json");
        let content = serde_json::to_string_pretty(self)
            .map_err(|e| crate::CoreError::Io(std::io::Error::new(std::io::ErrorKind::Other, e)))?;
        std::fs::write(&path, content)?;
        Ok(())
    }
}

/// Render a playbook prompt with project context injected.
pub fn render_prompt(
    playbook: &Playbook,
    project_name: &str,
    folders: &[String],
    doc_count: usize,
    canonical_count: usize,
) -> String {
    let folders_section = if folders.is_empty() {
        String::new()
    } else {
        format!(
            "\nThis project has {} documents across these folders: {}\n",
            doc_count,
            folders.join(", ")
        )
    };

    let mut prompt = playbook.prompt.clone();
    prompt = prompt.replace("{{project}}", project_name);
    prompt = prompt.replace("{{folders_section}}", &folders_section);
    prompt = prompt.replace("{{doc_count}}", &doc_count.to_string());
    prompt = prompt.replace("{{canonical_count}}", &canonical_count.to_string());
    prompt
}
