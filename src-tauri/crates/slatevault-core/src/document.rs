use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FrontMatter {
    pub id: Uuid,
    pub title: String,
    #[serde(default = "default_author")]
    pub author: Author,
    #[serde(default)]
    pub tags: Vec<String>,
    pub created: DateTime<Utc>,
    pub modified: DateTime<Utc>,
    pub project: String,
    #[serde(default = "default_status")]
    pub status: DocStatus,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ai_tool: Option<String>,
    #[serde(default)]
    pub canonical: bool,
    #[serde(default)]
    pub protected: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum Author {
    Human,
    Ai,
    Both,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum DocStatus {
    Draft,
    Review,
    Final,
}

#[derive(Debug, Clone)]
pub struct Document {
    pub front_matter: FrontMatter,
    pub content: String,
    pub path: String,
}

impl Document {
    pub fn parse(raw: &str, path: &str) -> crate::error::Result<Self> {
        let (fm_str, content) = split_front_matter(raw)?;
        let front_matter: FrontMatter = serde_yaml::from_str(fm_str)?;
        Ok(Self {
            front_matter,
            content: content.to_string(),
            path: path.to_string(),
        })
    }

    pub fn to_string(&self) -> crate::error::Result<String> {
        let fm = serde_yaml::to_string(&self.front_matter)?;
        Ok(format!("---\n{}---\n\n{}", fm, self.content))
    }

    pub fn new(
        title: String,
        content: String,
        project: String,
        path: String,
        tags: Vec<String>,
        ai_tool: Option<String>,
    ) -> Self {
        let now = Utc::now();
        let author = if ai_tool.is_some() {
            Author::Ai
        } else {
            Author::Human
        };
        Self {
            front_matter: FrontMatter {
                id: Uuid::new_v4(),
                title,
                author,
                tags,
                created: now,
                modified: now,
                project,
                status: DocStatus::Draft,
                ai_tool,
                canonical: false,
                protected: false,
            },
            content,
            path,
        }
    }
}

fn split_front_matter(raw: &str) -> crate::error::Result<(&str, &str)> {
    let trimmed = raw.trim_start();
    if !trimmed.starts_with("---") {
        return Err(crate::CoreError::InvalidFrontMatter(
            "Document must start with ---".to_string(),
        ));
    }
    let after_first = &trimmed[3..];
    let end = after_first
        .find("\n---")
        .ok_or_else(|| {
            crate::CoreError::InvalidFrontMatter("No closing --- found".to_string())
        })?;
    let fm = &after_first[..end];
    let content = &after_first[end + 4..];
    let content = content.strip_prefix('\n').unwrap_or(content);
    Ok((fm.trim(), content))
}

fn default_author() -> Author {
    Author::Human
}

fn default_status() -> DocStatus {
    DocStatus::Draft
}
