use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::Path;

use crate::document::DocStatus;
use crate::error::Result;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectTemplate {
    pub label: String,
    pub folders: Vec<String>,
    #[serde(default)]
    pub files: HashMap<String, String>,
    #[serde(default, skip_serializing_if = "HashMap::is_empty")]
    pub file_metadata: HashMap<String, TemplateFileMetadata>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn apply_template_uses_file_metadata_for_frontmatter() {
        let docs_dir =
            std::env::temp_dir().join(format!("slatevault-template-test-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&docs_dir).expect("create temp docs dir");

        let mut files = HashMap::new();
        files.insert(
            "overview/agent-project-guide.md".to_string(),
            "Guide body".to_string(),
        );

        let mut file_metadata = HashMap::new();
        file_metadata.insert(
            "overview/agent-project-guide.md".to_string(),
            TemplateFileMetadata {
                canonical: true,
                protected: true,
                tags: vec!["project-management".to_string(), "canonical".to_string()],
                status: Some(DocStatus::Final),
            },
        );

        let template = ProjectTemplate {
            label: "Project Management".to_string(),
            folders: vec!["overview".to_string()],
            files,
            file_metadata,
        };

        let created = apply_template(&docs_dir, "Project Mgmt", &template).expect("apply template");
        assert_eq!(created, vec!["overview/agent-project-guide.md".to_string()]);

        let raw = std::fs::read_to_string(docs_dir.join("overview/agent-project-guide.md"))
            .expect("read generated doc");
        let doc = crate::document::Document::parse(&raw, "overview/agent-project-guide.md")
            .expect("parse generated doc");

        assert!(doc.front_matter.canonical);
        assert!(doc.front_matter.protected);
        assert_eq!(doc.front_matter.project, "Project Mgmt");
        assert_eq!(doc.front_matter.status, DocStatus::Final);
        assert_eq!(
            doc.front_matter.tags,
            vec!["project-management".to_string(), "canonical".to_string()]
        );

        std::fs::remove_dir_all(&docs_dir).ok();
    }
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct TemplateFileMetadata {
    #[serde(default)]
    pub canonical: bool,
    #[serde(default)]
    pub protected: bool,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub status: Option<DocStatus>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TemplateConfig {
    pub default: String,
    pub templates: HashMap<String, ProjectTemplate>,
}

impl TemplateConfig {
    /// Returns the built-in default templates.
    pub fn built_in() -> Self {
        let mut templates = HashMap::new();

        let mut software_files = HashMap::new();
        software_files.insert(
            "specs/_about.md".to_string(),
            "Technical specifications and design documents for this project.".to_string(),
        );
        software_files.insert(
            "features/_about.md".to_string(),
            "Feature documentation — requirements, acceptance criteria, and implementation notes."
                .to_string(),
        );
        software_files.insert(
            "decisions/_about.md".to_string(),
            "Architecture Decision Records (ADRs). Use numbered prefixes: `001-use-postgres.md`."
                .to_string(),
        );
        software_files.insert(
            "guides/_about.md".to_string(),
            "How-to guides, tutorials, and walkthroughs for the team.".to_string(),
        );
        software_files.insert(
            "runbooks/_about.md".to_string(),
            "Operational procedures for deployments, incidents, and maintenance.".to_string(),
        );
        software_files.insert(
            "notes/_about.md".to_string(),
            "Scratch space for meeting notes, brainstorms, and quick captures.".to_string(),
        );

        templates.insert(
            "software-dev".to_string(),
            ProjectTemplate {
                label: "Software Development".to_string(),
                folders: vec![
                    "specs".to_string(),
                    "features".to_string(),
                    "decisions".to_string(),
                    "guides".to_string(),
                    "runbooks".to_string(),
                    "notes".to_string(),
                ],
                files: software_files,
                file_metadata: HashMap::new(),
            },
        );

        let mut agile_files = HashMap::new();
        agile_files.insert(
            "backlog/_about.md".to_string(),
            "Product backlog — user stories, epics, and prioritized work items.".to_string(),
        );
        agile_files.insert(
            "sprints/_about.md".to_string(),
            "Sprint documentation — goals, plans, and commitments for each sprint.".to_string(),
        );
        agile_files.insert(
            "retrospectives/_about.md".to_string(),
            "Sprint retrospectives — what went well, what to improve, action items.".to_string(),
        );
        agile_files.insert(
            "ceremonies/_about.md".to_string(),
            "Ceremony guides — standup, planning, review, and retro formats and agendas."
                .to_string(),
        );
        agile_files.insert(
            "epics/_about.md".to_string(),
            "Epic documentation — high-level features broken into user stories with acceptance criteria.".to_string(),
        );
        agile_files.insert(
            "definitions/_definition-of-done.md".to_string(),
            "The team's Definition of Done (DoD) — criteria that must be met before work is considered complete.\n\n## Definition of Done\n\n- [ ] Code reviewed and approved\n- [ ] Unit tests written and passing\n- [ ] Integration tests passing\n- [ ] Documentation updated\n- [ ] No known defects\n- [ ] Deployed to staging and verified".to_string(),
        );
        agile_files.insert(
            "definitions/_definition-of-ready.md".to_string(),
            "The team's Definition of Ready (DoR) — criteria a story must meet before it enters a sprint.\n\n## Definition of Ready\n\n- [ ] User story follows INVEST criteria\n- [ ] Acceptance criteria defined\n- [ ] Dependencies identified\n- [ ] Estimated by the team\n- [ ] Small enough to complete in one sprint".to_string(),
        );

        templates.insert(
            "agile".to_string(),
            ProjectTemplate {
                label: "Agile Development".to_string(),
                folders: vec![
                    "backlog".to_string(),
                    "sprints".to_string(),
                    "retrospectives".to_string(),
                    "ceremonies".to_string(),
                    "epics".to_string(),
                    "definitions".to_string(),
                ],
                files: agile_files,
                file_metadata: HashMap::new(),
            },
        );

        let mut vibe_files = HashMap::new();
        vibe_files.insert(
            "prd/_about.md".to_string(),
            "Product Requirements Documents — describe what you want to build, the problem it solves, and success criteria.".to_string(),
        );
        vibe_files.insert(
            "todo/_about.md".to_string(),
            "Task lists and work tracking — what needs to be done, what's in progress, what's blocked.".to_string(),
        );
        vibe_files.insert(
            "prompts/_about.md".to_string(),
            "AI prompts and instructions — system prompts, CLAUDE.md files, and reusable prompt templates for your AI coding sessions.".to_string(),
        );
        vibe_files.insert(
            "context/_about.md".to_string(),
            "Project context files — architecture notes, tech stack decisions, and background info to feed AI tools.".to_string(),
        );
        vibe_files.insert(
            "changelog/_about.md".to_string(),
            "Session logs and changelogs — what was built, changed, or fixed in each coding session.".to_string(),
        );
        vibe_files.insert(
            "bugs/_about.md".to_string(),
            "Bug reports and issues — describe the problem, steps to reproduce, expected vs actual behavior.".to_string(),
        );
        vibe_files.insert(
            "ideas/_about.md".to_string(),
            "Feature ideas and brainstorms — capture ideas before they're lost, refine them into PRDs later.".to_string(),
        );

        templates.insert(
            "vibe-coding".to_string(),
            ProjectTemplate {
                label: "Vibe Coding".to_string(),
                folders: vec![
                    "prd".to_string(),
                    "todo".to_string(),
                    "prompts".to_string(),
                    "context".to_string(),
                    "changelog".to_string(),
                    "bugs".to_string(),
                    "ideas".to_string(),
                ],
                files: vibe_files,
                file_metadata: HashMap::new(),
            },
        );

        let mut research_files = HashMap::new();
        research_files.insert(
            "research/_about.md".to_string(),
            "Research briefs — define the question, scope, constraints, and success criteria for an investigation.".to_string(),
        );
        research_files.insert(
            "findings/_about.md".to_string(),
            "Distilled findings — summarize what was learned, why it matters, and what is still uncertain.".to_string(),
        );
        research_files.insert(
            "sources/_about.md".to_string(),
            "Sources — links, references, docs, papers, repositories, and notes about source credibility.".to_string(),
        );
        research_files.insert(
            "experiments/_about.md".to_string(),
            "Experiments — spikes, prototypes, test results, benchmarks, and reproduction notes."
                .to_string(),
        );
        research_files.insert(
            "decisions/_about.md".to_string(),
            "Decisions — recommendations, tradeoffs, final choices, and reasoning from the research.".to_string(),
        );
        research_files.insert(
            "notes/_about.md".to_string(),
            "Notes — scratchpad captures, open questions, meeting notes, and rough thinking while investigating.".to_string(),
        );

        templates.insert(
            "research".to_string(),
            ProjectTemplate {
                label: "Research".to_string(),
                folders: vec![
                    "research".to_string(),
                    "findings".to_string(),
                    "sources".to_string(),
                    "experiments".to_string(),
                    "decisions".to_string(),
                    "notes".to_string(),
                ],
                files: research_files,
                file_metadata: HashMap::new(),
            },
        );

        let mut project_management_files = HashMap::new();
        project_management_files.insert(
            "overview/_about.md".to_string(),
            "Project overview — summary, stakeholders, goals, success metrics, and current ownership.".to_string(),
        );
        project_management_files.insert(
            "overview/project-summary.md".to_string(),
            "# Project Summary\n\n## Purpose\n\nDescribe what this project is, why it exists, and what outcome it should create.\n\n## Current State\n\n- \n\n## Success Metrics\n\n- \n\n## Owners\n\n- \n".to_string(),
        );
        project_management_files.insert(
            "overview/agent-project-guide.md".to_string(),
            "# Agent Project Guide\n\nUse this project as project-management memory. Read this guide before creating, updating, or reorganizing project-management docs.\n\n## Folder Map\n\n- `overview/` holds the project summary, stakeholders, goals, success metrics, and current ownership.\n- `planning/` holds milestones, timelines, scope, roadmap, and sequencing.\n- `requirements/` holds user needs, business rules, acceptance criteria, constraints, and must-haves.\n- `meetings/raw-notes/` holds messy transcripts, copied chat notes, and unprocessed notes when preserving the original input is useful.\n- `meetings/notes/` holds cleaned, dated meeting notes.\n- `meetings/action-items.md` holds the rolling action list.\n- `meetings/decisions-from-meetings.md` holds decisions captured during meetings before durable items are promoted.\n- `meetings/follow-ups.md` holds people-specific and date-specific follow-ups.\n- `decisions/decision-log.md` holds durable decisions that affect direction, scope, ownership, timeline, or risk.\n- `risks/risk-register.md` holds blockers, dependencies, assumptions, escalations, and mitigation plans.\n- `delivery/` holds status reports, launch plans, handoffs, retrospectives, and outcome tracking.\n- `resources/` holds links, assets, screenshots, source material, and external references.\n\n## Agent Workflow\n\nWhen the user provides meeting notes or project updates:\n\n1. Preserve raw notes in `meetings/raw-notes/` when useful.\n2. Create or update a dated clean note in `meetings/notes/`.\n3. Extract open actions into `meetings/action-items.md`.\n4. Add meeting decisions to `meetings/decisions-from-meetings.md`.\n5. Promote durable decisions into `decisions/decision-log.md`.\n6. Update `risks/risk-register.md` when blockers, dependencies, or assumptions change.\n7. Update `planning/milestones.md` when dates, sequencing, or delivery state changes.\n8. Update `overview/project-summary.md` only when purpose, scope, owners, success metrics, or current state materially changes.\n\nPrefer appending dated updates over rewriting history. Keep raw notes separate from synthesized project memory. Do not overwrite canonical docs casually; propose or summarize significant changes for human review when possible.\n".to_string(),
        );
        project_management_files.insert(
            "planning/_about.md".to_string(),
            "Planning — roadmap, milestones, timeline, scope, sequencing, and delivery assumptions.".to_string(),
        );
        project_management_files.insert(
            "planning/milestones.md".to_string(),
            "# Milestones\n\n## Current Milestone\n\n- \n\n## Upcoming\n\n- \n\n## Completed\n\n- \n".to_string(),
        );
        project_management_files.insert(
            "requirements/_about.md".to_string(),
            "Requirements — user needs, business rules, acceptance criteria, constraints, and must-haves.".to_string(),
        );
        project_management_files.insert(
            "meetings/_about.md".to_string(),
            "Meetings — raw notes, cleaned meeting notes, extracted action items, decisions, and follow-ups.\n\n## Agent Note Workflow\n\nWhen the user provides meeting notes through an AI agent:\n\n1. Preserve raw notes in `meetings/raw-notes/` when useful.\n2. Create or update a dated clean note in `meetings/notes/`.\n3. Extract open actions into `meetings/action-items.md`.\n4. Add meeting decisions to `meetings/decisions-from-meetings.md`.\n5. Add people/date follow-ups to `meetings/follow-ups.md`.\n6. Promote durable decisions into `decisions/decision-log.md` when they affect project direction, scope, ownership, timeline, or risk.".to_string(),
        );
        project_management_files.insert(
            "meetings/action-items.md".to_string(),
            "# Action Items\n\n## Open\n\n- [ ] \n\n## Waiting On\n\n- [ ] \n\n## Completed\n\n- [x] \n".to_string(),
        );
        project_management_files.insert(
            "meetings/decisions-from-meetings.md".to_string(),
            "# Decisions From Meetings\n\nCapture decisions made during meetings before promoting durable items into the main decision log.\n\n## Decisions\n\n- \n".to_string(),
        );
        project_management_files.insert(
            "meetings/follow-ups.md".to_string(),
            "# Follow-Ups\n\n## By Person\n\n- \n\n## By Date\n\n- \n".to_string(),
        );
        project_management_files.insert(
            "decisions/_about.md".to_string(),
            "Decisions — decision log, open questions, tradeoffs, approvals, and rationale."
                .to_string(),
        );
        project_management_files.insert(
            "decisions/decision-log.md".to_string(),
            "# Decision Log\n\n| Date | Decision | Owner | Rationale | Follow-Up |\n| --- | --- | --- | --- | --- |\n|  |  |  |  |  |\n".to_string(),
        );
        project_management_files.insert(
            "risks/_about.md".to_string(),
            "Risks — blockers, dependencies, assumptions, escalations, and mitigation plans."
                .to_string(),
        );
        project_management_files.insert(
            "risks/risk-register.md".to_string(),
            "# Risk Register\n\n| Risk | Impact | Likelihood | Owner | Mitigation | Status |\n| --- | --- | --- | --- | --- | --- |\n|  |  |  |  |  |  |\n".to_string(),
        );
        project_management_files.insert(
            "delivery/_about.md".to_string(),
            "Delivery — status reports, launch plans, handoff notes, retrospectives, and outcome tracking.".to_string(),
        );
        project_management_files.insert(
            "resources/_about.md".to_string(),
            "Resources — links, assets, reference material, vendor docs, screenshots, and supporting files.".to_string(),
        );
        let mut project_management_file_metadata = HashMap::new();
        for path in [
            "overview/project-summary.md",
            "overview/agent-project-guide.md",
            "planning/milestones.md",
            "meetings/action-items.md",
            "decisions/decision-log.md",
            "risks/risk-register.md",
        ] {
            project_management_file_metadata.insert(
                path.to_string(),
                TemplateFileMetadata {
                    canonical: true,
                    tags: vec!["project-management".to_string(), "canonical".to_string()],
                    ..Default::default()
                },
            );
        }

        templates.insert(
            "project-management".to_string(),
            ProjectTemplate {
                label: "Project Management".to_string(),
                folders: vec![
                    "overview".to_string(),
                    "planning".to_string(),
                    "requirements".to_string(),
                    "meetings".to_string(),
                    "meetings/raw-notes".to_string(),
                    "meetings/notes".to_string(),
                    "decisions".to_string(),
                    "risks".to_string(),
                    "delivery".to_string(),
                    "resources".to_string(),
                ],
                files: project_management_files,
                file_metadata: project_management_file_metadata,
            },
        );

        templates.insert(
            "minimal".to_string(),
            ProjectTemplate {
                label: "Blank".to_string(),
                folders: vec![],
                files: HashMap::new(),
                file_metadata: HashMap::new(),
            },
        );

        Self {
            default: "software-dev".to_string(),
            templates,
        }
    }

    /// Load templates from vault root, falling back to built-in defaults.
    pub fn load(vault_root: &Path) -> Result<Self> {
        let path = vault_root.join("templates.json");
        if path.exists() {
            let content = std::fs::read_to_string(&path)?;
            let config: TemplateConfig =
                serde_json::from_str(&content).unwrap_or_else(|_| Self::built_in());
            Ok(config)
        } else {
            let config = Self::built_in();
            config.save(vault_root)?;
            Ok(config)
        }
    }

    /// Save templates to vault root.
    pub fn save(&self, vault_root: &Path) -> Result<()> {
        let path = vault_root.join("templates.json");
        let content = serde_json::to_string_pretty(self)
            .map_err(|e| crate::CoreError::Io(std::io::Error::new(std::io::ErrorKind::Other, e)))?;
        std::fs::write(&path, content)?;
        Ok(())
    }

    /// Get a template by name, falling back to the default.
    pub fn get(&self, name: Option<&str>) -> Option<&ProjectTemplate> {
        let key = name.unwrap_or(&self.default);
        self.templates.get(key)
    }

    /// List template names and labels.
    pub fn list(&self) -> Vec<TemplateInfo> {
        let mut list: Vec<TemplateInfo> = self
            .templates
            .iter()
            .map(|(name, t)| TemplateInfo {
                name: name.clone(),
                label: t.label.clone(),
                is_default: name == &self.default,
            })
            .collect();
        list.sort_by(|a, b| a.label.cmp(&b.label));
        list
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct TemplateInfo {
    pub name: String,
    pub label: String,
    pub is_default: bool,
}

/// Apply a template to a project's docs directory.
/// File values in the template are treated as the markdown body content.
/// Proper YAML frontmatter is always generated automatically.
/// Returns the list of created file paths (for use as ai_context_files).
pub fn apply_template(
    docs_dir: &Path,
    project_name: &str,
    template: &ProjectTemplate,
) -> Result<Vec<String>> {
    let mut created_files = Vec::new();
    // Create folders
    for folder in &template.folders {
        std::fs::create_dir_all(docs_dir.join(folder))?;
    }

    // Write starter files with proper frontmatter
    for (path, body) in &template.files {
        let file_path = docs_dir.join(path);
        if let Some(parent) = file_path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        if !file_path.exists() {
            // Derive title from filename
            let title = path
                .split('/')
                .last()
                .unwrap_or(path)
                .trim_start_matches('_')
                .trim_end_matches(".md")
                .replace(['-', '_'], " ");
            let title = title
                .split_whitespace()
                .map(|w| {
                    let mut c = w.chars();
                    match c.next() {
                        None => String::new(),
                        Some(f) => f.to_uppercase().to_string() + c.as_str(),
                    }
                })
                .collect::<Vec<_>>()
                .join(" ");

            let doc = crate::document::Document::new(
                title,
                body.clone(),
                project_name.to_string(),
                path.clone(),
                template
                    .file_metadata
                    .get(path)
                    .map(|metadata| metadata.tags.clone())
                    .unwrap_or_default(),
                None,
            );
            let mut doc = doc;
            if let Some(metadata) = template.file_metadata.get(path) {
                doc.front_matter.canonical = metadata.canonical;
                doc.front_matter.protected = metadata.protected;
                if let Some(status) = &metadata.status {
                    doc.front_matter.status = status.clone();
                }
            }
            if let Ok(content) = doc.to_string() {
                std::fs::write(&file_path, content)?;
                created_files.push(path.clone());
            }
        }
    }

    Ok(created_files)
}
