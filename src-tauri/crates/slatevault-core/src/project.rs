use std::path::{Path, PathBuf};

use crate::config::{ProjectConfig, ProjectMeta};
use crate::error::Result;

pub struct Project {
    pub config: ProjectConfig,
    pub root: PathBuf,
}

impl Project {
    pub fn create(projects_dir: &Path, name: &str, description: &str, tags: Vec<String>) -> Result<Self> {
        validate_project_name(name)?;
        let root = projects_dir.join(name);
        if root.exists() {
            return Err(crate::CoreError::ProjectAlreadyExists(name.to_string()));
        }

        std::fs::create_dir_all(root.join("docs"))?;

        let config = ProjectConfig {
            project: ProjectMeta {
                name: name.to_string(),
                description: description.to_string(),
                tags,
                ai_context_files: Vec::new(),
                folder_order: Vec::new(),
            },
        };

        let toml_str = toml::to_string_pretty(&config)?;
        std::fs::write(root.join("project.toml"), toml_str)?;

        Ok(Self { config, root })
    }

    pub fn open(projects_dir: &Path, name: &str) -> Result<Self> {
        validate_project_name(name)?;
        let root = projects_dir.join(name);
        if !root.exists() {
            return Err(crate::CoreError::ProjectNotFound(name.to_string()));
        }

        let toml_str = std::fs::read_to_string(root.join("project.toml"))?;
        let config: ProjectConfig = toml::from_str(&toml_str)?;

        Ok(Self { config, root })
    }

    pub fn docs_dir(&self) -> PathBuf {
        self.root.join("docs")
    }

    pub fn list_all(projects_dir: &Path) -> Result<Vec<ProjectConfig>> {
        let mut projects = Vec::new();
        if !projects_dir.exists() {
            return Ok(projects);
        }
        for entry in std::fs::read_dir(projects_dir)? {
            let entry = entry?;
            let path = entry.path();
            if path.is_dir() {
                let toml_path = path.join("project.toml");
                if toml_path.exists() {
                    let toml_str = std::fs::read_to_string(&toml_path)?;
                    if let Ok(config) = toml::from_str::<ProjectConfig>(&toml_str) {
                        projects.push(config);
                    }
                }
            }
        }
        Ok(projects)
    }
}

fn validate_project_name(name: &str) -> Result<()> {
    use std::path::Component;

    let path = Path::new(name);
    let mut components = path.components();
    let first = components.next().ok_or_else(|| {
        crate::CoreError::Io(std::io::Error::new(
            std::io::ErrorKind::InvalidInput,
            "Project name cannot be empty",
        ))
    })?;

    if !matches!(first, Component::Normal(_)) || components.next().is_some() {
        return Err(crate::CoreError::Io(std::io::Error::new(
            std::io::ErrorKind::InvalidInput,
            "Project name must be a single relative path segment",
        )));
    }

    Ok(())
}
