use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::Path;

use crate::error::Result;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectTemplate {
    pub label: String,
    pub folders: Vec<String>,
    #[serde(default)]
    pub files: HashMap<String, String>,
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
            "Feature documentation — requirements, acceptance criteria, and implementation notes.".to_string(),
        );
        software_files.insert(
            "decisions/_about.md".to_string(),
            "Architecture Decision Records (ADRs). Use numbered prefixes: `001-use-postgres.md`.".to_string(),
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
            "Ceremony guides — standup, planning, review, and retro formats and agendas.".to_string(),
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
            },
        );

        templates.insert(
            "minimal".to_string(),
            ProjectTemplate {
                label: "Minimal".to_string(),
                folders: vec![],
                files: HashMap::new(),
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
pub fn apply_template(docs_dir: &Path, template: &ProjectTemplate) -> Result<Vec<String>> {
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
                String::new(),
                path.clone(),
                vec![],
                None,
            );
            if let Ok(content) = doc.to_string() {
                std::fs::write(&file_path, content)?;
                created_files.push(path.clone());
            }
        }
    }

    Ok(created_files)
}
