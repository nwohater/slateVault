use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::Path;

use crate::error::Result;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Playbook {
    pub id: String,
    pub label: String,
    pub description: String,
    /// Prompt template. Use {{project}} for project name, {{doc_count}} for doc count.
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
                    prompt: r#"You have access to SlateVault via MCP. Use project "{{project}}" as the primary documentation context.
{{folders_section}}
## Rules
1. Before writing any doc, call search_documents to check if one already exists - update instead of creating duplicates
2. Set ai_tool to your tool name when the MCP tool supports it
3. Use propose_doc_update for canonical, protected, or important existing docs instead of overwriting them directly
4. Apply appropriate tags when creating or updating docs
5. Respect protected and canonical documents

## What to Document
{{documentation_section}}

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
                    prompt: r#"You have access to SlateVault via MCP. Review and extend documentation for project "{{project}}" based on the codebase and existing vault docs.
{{folders_section}}
## Process
1. First call get_project_context and search_documents to understand what docs already exist
2. Analyze the codebase structure, key files, architecture, data flow, and platform integrations
3. Prefer updating or extending existing docs before creating new structure

## Documentation Priorities
{{reverse_engineer_section}}

## Finish
1. After documenting, call search_documents to verify completeness
2. Summarize what existing docs were updated
3. Summarize what new docs were added
4. Note any documentation gaps that still remain
5. Recommend which doc should become canonical next"#.to_string(),
                },
                Playbook {
                    id: "resume-session".to_string(),
                    label: "Resume Session".to_string(),
                    description: "Bring an AI agent up to speed on what happened since the last session.".to_string(),
                    prompt: r#"You have access to SlateVault via MCP for project "{{project}}".
{{folders_section}}
## Startup
1. Call generate_agent_brief for project "{{project}}" to get full project context
2. Call get_recent_changes to see what happened since the last session
3. Review any recently modified documents that seem relevant

## Focus
{{resume_section}}

## Then
- Summarize what changed since the last session
- Identify incomplete work or open items
- Ask what to focus on next
- Continue documenting as work progresses"#.to_string(),
                },
                Playbook {
                    id: "code-review-docs".to_string(),
                    label: "Code Review Documentation".to_string(),
                    description: "Document a PR's changes, decisions, and impact in the vault.".to_string(),
                    prompt: r#"You have access to SlateVault via MCP for project "{{project}}".
{{folders_section}}
## Task
Document the current code review or PR in the vault.

## Process
1. Call summarize_branch_diff to understand what changed
2. Call search_documents before creating any new review summary
3. Write or update review-related documentation in the most appropriate existing folder

{{code_review_section}}

## Include
- What changed and why
- Files or areas affected
- Architectural implications
- Risks, concerns, or follow-up items"#.to_string(),
                },
                Playbook {
                    id: "sprint-release-notes".to_string(),
                    label: "Sprint / Release Notes".to_string(),
                    description: "Generate a changelog and release notes from recent commits and doc changes.".to_string(),
                    prompt: r#"You have access to SlateVault via MCP for project "{{project}}".
{{folders_section}}
## Task
Generate release notes from recent work.

## Process
1. Call get_recent_changes to see recent modifications
2. Call search_documents for recent changelog or release-note entries
3. Compile a release summary that covers:
   - New features added
   - Bugs fixed
   - Breaking changes
   - Known issues
   - Contributors or AI tools involved

{{release_notes_section}}"#.to_string(),
                },
                Playbook {
                    id: "onboard-team-member".to_string(),
                    label: "Onboard Team Member".to_string(),
                    description: "Generate a comprehensive project walkthrough from existing documentation.".to_string(),
                    prompt: r#"You have access to SlateVault via MCP for project "{{project}}".
{{folders_section}}
## Task
Create or improve onboarding documentation for a new team member.

## Process
1. Call generate_agent_brief to understand the current project state
2. Call get_canonical_context for source-of-truth docs
3. Call build_context_bundle with query "architecture setup getting started"

{{onboarding_section}}

## Cover
- Project overview and purpose
- Tech stack and architecture
- Setup or environment expectations
- Key concepts and terminology
- Where to find important docs
- Common workflows"#.to_string(),
                },
                Playbook {
                    id: "architecture-audit".to_string(),
                    label: "Architecture Audit".to_string(),
                    description: "AI reviews documentation for gaps, inconsistencies, and staleness.".to_string(),
                    prompt: r#"You have access to SlateVault via MCP for project "{{project}}".
{{folders_section}}
## Task
Audit the project's documentation for quality, completeness, and staleness.

## Process
1. Call generate_agent_brief to get the full picture
2. Call detect_stale_docs to find outdated documentation
3. Call list_documents to see all docs and their statuses
4. Review canonical documents for accuracy

{{audit_section}}

## Report
Write an audit report that covers:
- Documentation completeness
- Documentation quality
- Gaps or inconsistencies found
- Recommendations for canonical docs, protection, and next fixes"#.to_string(),
                },
            ],
        }
    }

    pub fn load(vault_root: &Path) -> Result<Self> {
        let path = vault_root.join("playbooks.json");
        if path.exists() {
            let content = std::fs::read_to_string(&path)?;
            let saved_config: PlaybookConfig =
                serde_json::from_str(&content).unwrap_or_else(|_| Self::built_in());
            let merged = Self::merge_with_built_in(saved_config);
            merged.save(vault_root)?;
            Ok(merged)
        } else {
            let config = Self::built_in();
            config.save(vault_root)?;
            Ok(config)
        }
    }

    pub fn save(&self, vault_root: &Path) -> Result<()> {
        let path = vault_root.join("playbooks.json");
        let content = serde_json::to_string_pretty(self).map_err(|e| {
            crate::CoreError::Io(std::io::Error::new(std::io::ErrorKind::Other, e))
        })?;
        std::fs::write(&path, content)?;
        Ok(())
    }

    fn merge_with_built_in(saved: Self) -> Self {
        let built_in = Self::built_in();
        let mut saved_by_id: HashMap<String, Playbook> = saved
            .playbooks
            .into_iter()
            .map(|playbook| (playbook.id.clone(), playbook))
            .collect();

        let mut merged_playbooks = Vec::new();

        for built_in_playbook in built_in.playbooks {
            let merged = if let Some(saved_playbook) = saved_by_id.remove(&built_in_playbook.id) {
                if saved_playbook.label == built_in_playbook.label
                    || saved_playbook.description == built_in_playbook.description
                {
                    built_in_playbook
                } else {
                    saved_playbook
                }
            } else {
                built_in_playbook
            };
            merged_playbooks.push(merged);
        }

        let mut remaining_custom: Vec<_> = saved_by_id.into_values().collect();
        remaining_custom.sort_by(|a, b| a.label.cmp(&b.label));
        merged_playbooks.extend(remaining_custom);

        Self {
            playbooks: merged_playbooks,
        }
    }
}

fn has_folder(folders: &[String], folder: &str) -> bool {
    folders.iter().any(|candidate| candidate == folder)
}

fn build_documentation_section(folders: &[String]) -> String {
    let mut lines = Vec::new();
    lines.push("Prefer these destinations in this project today:".to_string());

    if has_folder(folders, "changelog") {
        lines.push("- Changes -> `changelog/` (what you did, what changed)".to_string());
    }
    if has_folder(folders, "bugs") {
        lines.push("- Bugs found -> `bugs/` (description, repro steps, fix)".to_string());
    }
    if has_folder(folders, "prd") {
        lines.push(
            "- Product or feature planning -> `prd/` (requirements, scope, feature direction)"
                .to_string(),
        );
    }
    if has_folder(folders, "context") {
        lines.push(
            "- Project context -> `context/` (architecture notes, implementation context, constraints)"
                .to_string(),
        );
    }
    if has_folder(folders, "ideas") {
        lines.push("- Follow-up ideas -> `ideas/` (quick captures, things to revisit)".to_string());
    }
    if has_folder(folders, "notes") {
        lines.push(
            "- Working notes -> `notes/` (quick captures, scratch notes, follow-ups)".to_string(),
        );
    }
    if has_folder(folders, "decisions") {
        lines.push(
            "- Decisions -> `decisions/` (why an approach was chosen, trade-offs considered)"
                .to_string(),
        );
    }
    if has_folder(folders, "specs") {
        lines.push("- Specs -> `specs/` (what is being built, requirements, design)".to_string());
    }

    if lines.len() == 1 {
        lines.push(
            "- Use the most appropriate existing project folder for changes, planning, context, bugs, and follow-up ideas."
                .to_string(),
        );
    }

    if !has_folder(folders, "decisions")
        || !has_folder(folders, "specs")
        || !has_folder(folders, "notes")
    {
        lines.push(String::new());
        lines.push(
            "If the work clearly needs new structure such as `decisions/`, `specs/`, or `notes/`, check for existing related docs first and then create that structure intentionally."
                .to_string(),
        );
    }

    lines.join("\n")
}

fn build_reverse_engineer_section(folders: &[String], canonical_count: usize) -> String {
    let mut lines = vec!["Prefer these documentation targets:".to_string()];

    if has_folder(folders, "context") {
        lines.push(
            "- Start with `context/` for architecture, app structure, services, integrations, and implementation notes."
                .to_string(),
        );
    }
    if has_folder(folders, "prd") {
        lines.push(
            "- Review `prd/` before inventing feature descriptions so built behavior stays aligned with product intent."
                .to_string(),
        );
    }
    if has_folder(folders, "ideas") {
        lines.push(
            "- Treat `ideas/` as aspirational and distinguish clearly between built behavior and future ideas."
                .to_string(),
        );
    }
    if has_folder(folders, "changelog") {
        lines.push(
            "- Use `changelog/` for a summary of what documentation was added or updated during the reverse-engineering pass."
                .to_string(),
        );
    }
    if has_folder(folders, "specs") || has_folder(folders, "features") {
        lines.push(
            "- Extend existing `specs/` or `features/` docs before creating new parallel docs."
                .to_string(),
        );
    } else {
        lines.push(
            "- If the codebase reveals missing feature or architecture docs, create `specs/` or `features/` intentionally rather than assuming they already exist."
                .to_string(),
        );
    }
    if has_folder(folders, "decisions") {
        lines.push(
            "- Record inferred technical decisions in `decisions/` only when the trade-off is clear from code or existing docs."
                .to_string(),
        );
    } else {
        lines.push(
            "- If important architectural trade-offs are evident but undocumented, create `decisions/` intentionally after checking for existing related material."
                .to_string(),
        );
    }
    if has_folder(folders, "guides") {
        lines.push("- Improve `guides/` if setup or workflow docs are missing or stale.".to_string());
    } else {
        lines.push(
            "- Only create `guides/` if the project clearly needs setup or workflow documentation that does not already exist elsewhere."
                .to_string(),
        );
    }

    lines.push(String::new());
    if canonical_count > 0 {
        lines.push(
            "This project already has canonical docs, so do not assume a new architecture overview should replace them; recommend canonicals carefully."
                .to_string(),
        );
    } else {
        lines.push(
            "If you find a clear source-of-truth architecture or overview doc, recommend it as a candidate for canonical status."
                .to_string(),
        );
    }

    lines.join("\n")
}

fn build_resume_section(folders: &[String]) -> String {
    let mut lines = vec![];
    if has_folder(folders, "changelog") {
        lines.push("- Check `changelog/` first for the quickest session-level history.".to_string());
    }
    if has_folder(folders, "todo") {
        lines.push("- Review `todo/` for incomplete work, planned tasks, or blocked items.".to_string());
    }
    if has_folder(folders, "ideas") {
        lines.push("- Distinguish unfinished implementation from future ideas captured in `ideas/`.".to_string());
    }
    if has_folder(folders, "context") || has_folder(folders, "prd") {
        lines.push(
            "- Re-anchor on `context/` and `prd/` before deciding what is still active versus aspirational."
                .to_string(),
        );
    }
    if lines.is_empty() {
        lines.push(
            "- Use the existing project docs to separate current state, unfinished work, and future ideas."
                .to_string(),
        );
    }
    lines.join("\n")
}

fn build_code_review_section(folders: &[String]) -> String {
    let mut lines = vec![];
    if has_folder(folders, "changelog") {
        lines.push("- Prefer `changelog/` for PR or review summaries if that is where the project already records change history.".to_string());
    }
    if has_folder(folders, "decisions") {
        lines.push("- If the review introduces a clear architectural decision, update or add a doc in `decisions/`.".to_string());
    } else {
        lines.push("- If the review surfaces a meaningful architectural decision, create `decisions/` intentionally only after checking for related docs.".to_string());
    }
    if has_folder(folders, "specs") || has_folder(folders, "prd") || has_folder(folders, "context") {
        lines.push("- If code changes alter expected behavior, update the most relevant existing spec, PRD, or context doc instead of creating duplicates.".to_string());
    }
    if lines.is_empty() {
        lines.push("- Place review documentation in the most appropriate existing project folder and avoid creating duplicate summary docs.".to_string());
    }
    lines.join("\n")
}

fn build_release_notes_section(folders: &[String]) -> String {
    let mut lines = vec![];
    if has_folder(folders, "changelog") {
        lines.push("- Write release notes into `changelog/` because this project already tracks changes there.".to_string());
    } else {
        lines.push("- If no changelog structure exists, create release notes intentionally in a consistent location.".to_string());
    }
    if has_folder(folders, "bugs") {
        lines.push("- Cross-check `bugs/` so known issues and fixes are represented accurately.".to_string());
    }
    if has_folder(folders, "prd") || has_folder(folders, "ideas") {
        lines.push("- Distinguish shipped work from planned work by checking `prd/` and `ideas/` before listing features.".to_string());
    }
    lines.push("- Prefer updating an existing release-note doc for the same release window rather than duplicating it.".to_string());
    lines.join("\n")
}

fn build_onboarding_section(folders: &[String], canonical_count: usize) -> String {
    let mut lines = vec![];
    if has_folder(folders, "guides") {
        lines.push("- Improve or extend `guides/` if onboarding material already exists.".to_string());
    } else {
        lines.push("- If no `guides/` folder exists, create onboarding structure intentionally only after checking `context/`, `prd/`, and existing prompts/docs.".to_string());
    }
    if has_folder(folders, "context") {
        lines.push("- Use `context/` as the main source for architecture, services, and implementation details.".to_string());
    }
    if has_folder(folders, "prd") {
        lines.push("- Use `prd/` to explain product purpose, scope, and current shipped behavior.".to_string());
    }
    if canonical_count > 0 {
        lines.push("- Treat canonical docs as the source of truth and link out to them instead of rephrasing them loosely.".to_string());
    }
    if lines.is_empty() {
        lines.push("- Build onboarding from the most authoritative existing docs before introducing new guide structure.".to_string());
    }
    lines.join("\n")
}

fn build_audit_section(folders: &[String], canonical_count: usize) -> String {
    let mut lines = vec![];
    if has_folder(folders, "context") {
        lines.push("- Check whether `context/` still matches the current code structure and integrations.".to_string());
    }
    if has_folder(folders, "prd") {
        lines.push("- Check whether `prd/` still reflects what is actually built and shipped.".to_string());
    }
    if has_folder(folders, "ideas") {
        lines.push("- Watch for idea docs being mistaken for current functionality.".to_string());
    }
    if canonical_count > 0 {
        lines.push("- Pay special attention to whether canonical docs are still accurate and complete.".to_string());
    } else {
        lines.push("- Identify which existing docs are strongest candidates for canonical status.".to_string());
    }
    if has_folder(folders, "notes") {
        lines.push("- Write the audit report to `notes/` if that folder already exists.".to_string());
    } else {
        lines.push("- If `notes/` does not exist, choose the most sensible existing location or create `notes/` intentionally for the audit report.".to_string());
    }
    lines.join("\n")
}

fn render_playbook_specific_section(
    playbook_id: &str,
    folders: &[String],
    canonical_count: usize,
) -> Vec<(&'static str, String)> {
    match playbook_id {
        "document-as-you-go" => vec![(
            "{{documentation_section}}",
            build_documentation_section(folders),
        )],
        "reverse-engineer" => vec![(
            "{{reverse_engineer_section}}",
            build_reverse_engineer_section(folders, canonical_count),
        )],
        "resume-session" => vec![("{{resume_section}}", build_resume_section(folders))],
        "code-review-docs" => {
            vec![("{{code_review_section}}", build_code_review_section(folders))]
        }
        "sprint-release-notes" => vec![(
            "{{release_notes_section}}",
            build_release_notes_section(folders),
        )],
        "onboard-team-member" => vec![(
            "{{onboarding_section}}",
            build_onboarding_section(folders, canonical_count),
        )],
        "architecture-audit" => {
            vec![("{{audit_section}}", build_audit_section(folders, canonical_count))]
        }
        _ => Vec::new(),
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

    for (placeholder, rendered) in render_playbook_specific_section(
        &playbook.id,
        folders,
        canonical_count,
    ) {
        prompt = prompt.replace(placeholder, &rendered);
    }

    prompt
}
