use serde::{Deserialize, Serialize};

use crate::credentials::Credentials;
use crate::error::Result;

#[derive(Debug, Clone, Serialize)]
pub struct PrCreateResponse {
    pub url: String,
    pub number: u64,
    pub platform: String,
}

#[derive(Debug, Clone)]
pub struct PrCreateRequest {
    pub title: String,
    pub description: String,
    pub source_branch: String,
    pub target_branch: String,
}

pub fn detect_platform(remote_url: &str) -> Option<String> {
    let url = remote_url.to_lowercase();
    if url.contains("github.com") {
        Some("github".to_string())
    } else if url.contains("dev.azure.com") || url.contains("visualstudio.com") {
        Some("azure_devops".to_string())
    } else {
        None
    }
}

/// Parse owner/repo from a GitHub remote URL (HTTPS or SSH)
pub fn parse_github_remote(url: &str) -> Option<(String, String)> {
    // SSH: git@github.com:owner/repo.git
    // HTTPS: https://github.com/owner/repo.git
    let cleaned = url.trim_end_matches(".git");

    if cleaned.contains("github.com:") {
        // SSH format
        let parts: Vec<&str> = cleaned.split("github.com:").collect();
        if parts.len() == 2 {
            let path_parts: Vec<&str> = parts[1].split('/').collect();
            if path_parts.len() >= 2 {
                return Some((path_parts[0].to_string(), path_parts[1].to_string()));
            }
        }
    } else if cleaned.contains("github.com/") {
        // HTTPS format
        let parts: Vec<&str> = cleaned.split("github.com/").collect();
        if parts.len() == 2 {
            let path_parts: Vec<&str> = parts[1].split('/').collect();
            if path_parts.len() >= 2 {
                return Some((path_parts[0].to_string(), path_parts[1].to_string()));
            }
        }
    }

    None
}

/// Parse org/project/repo from an Azure DevOps remote URL
pub fn parse_ado_remote(url: &str) -> Option<(String, String, String)> {
    let cleaned = url.trim_end_matches(".git");

    // HTTPS: https://dev.azure.com/{org}/{project}/_git/{repo}
    if cleaned.contains("dev.azure.com/") {
        let parts: Vec<&str> = cleaned.split("dev.azure.com/").collect();
        if parts.len() == 2 {
            let segments: Vec<&str> = parts[1].split('/').collect();
            // org/project/_git/repo
            if segments.len() >= 4 && segments[2] == "_git" {
                return Some((
                    segments[0].to_string(),
                    segments[1].to_string(),
                    segments[3].to_string(),
                ));
            }
        }
    }

    // SSH: git@ssh.dev.azure.com:v3/{org}/{project}/{repo}
    if cleaned.contains("ssh.dev.azure.com") {
        let parts: Vec<&str> = cleaned.split("v3/").collect();
        if parts.len() == 2 {
            let segments: Vec<&str> = parts[1].split('/').collect();
            if segments.len() >= 3 {
                return Some((
                    segments[0].to_string(),
                    segments[1].to_string(),
                    segments[2].to_string(),
                ));
            }
        }
    }

    None
}

pub fn create_github_pr(
    owner: &str,
    repo: &str,
    pat: &str,
    request: &PrCreateRequest,
) -> Result<PrCreateResponse> {
    let url = format!(
        "https://api.github.com/repos/{}/{}/pulls",
        owner, repo
    );

    let body = serde_json::json!({
        "title": request.title,
        "body": request.description,
        "head": request.source_branch,
        "base": request.target_branch,
    });

    let client = reqwest::blocking::Client::new();
    let resp = client
        .post(&url)
        .header("Authorization", format!("Bearer {}", pat))
        .header("User-Agent", "slateVault")
        .header("Accept", "application/vnd.github+json")
        .json(&body)
        .send()
        .map_err(|e| crate::CoreError::Http(e.to_string()))?;

    let status = resp.status();
    let text = resp
        .text()
        .map_err(|e| crate::CoreError::Http(e.to_string()))?;

    if !status.is_success() {
        return Err(crate::CoreError::PullRequest(format!(
            "GitHub API error ({}): {}",
            status, text
        )));
    }

    let json: serde_json::Value =
        serde_json::from_str(&text).map_err(|e| crate::CoreError::Http(e.to_string()))?;

    Ok(PrCreateResponse {
        url: json["html_url"]
            .as_str()
            .unwrap_or("")
            .to_string(),
        number: json["number"].as_u64().unwrap_or(0),
        platform: "github".to_string(),
    })
}

#[derive(Deserialize)]
struct AdoPrResponse {
    #[serde(rename = "pullRequestId")]
    pull_request_id: u64,
    repository: AdoRepository,
}

#[derive(Deserialize)]
struct AdoRepository {
    #[serde(rename = "webUrl")]
    web_url: String,
}

pub fn create_ado_pr(
    org: &str,
    project: &str,
    repo: &str,
    pat: &str,
    request: &PrCreateRequest,
) -> Result<PrCreateResponse> {
    let url = format!(
        "https://dev.azure.com/{}/{}/_apis/git/repositories/{}/pullrequests?api-version=7.1",
        org, project, repo
    );

    let body = serde_json::json!({
        "sourceRefName": format!("refs/heads/{}", request.source_branch),
        "targetRefName": format!("refs/heads/{}", request.target_branch),
        "title": request.title,
        "description": request.description,
    });

    let client = reqwest::blocking::Client::new();
    let resp = client
        .post(&url)
        .basic_auth("", Some(pat))
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .map_err(|e| crate::CoreError::Http(e.to_string()))?;

    let status = resp.status();
    let text = resp
        .text()
        .map_err(|e| crate::CoreError::Http(e.to_string()))?;

    if !status.is_success() {
        return Err(crate::CoreError::PullRequest(format!(
            "Azure DevOps API error ({}): {}",
            status, text
        )));
    }

    let pr: AdoPrResponse =
        serde_json::from_str(&text).map_err(|e| crate::CoreError::Http(e.to_string()))?;

    let pr_url = format!(
        "{}/pullrequest/{}",
        pr.repository.web_url, pr.pull_request_id
    );

    Ok(PrCreateResponse {
        url: pr_url,
        number: pr.pull_request_id,
        platform: "azure_devops".to_string(),
    })
}

pub fn create_pull_request(
    remote_url: &str,
    credentials: &Credentials,
    request: &PrCreateRequest,
) -> Result<PrCreateResponse> {
    let platform = detect_platform(remote_url).ok_or_else(|| {
        crate::CoreError::PullRequest(
            "Could not detect platform from remote URL. Supported: GitHub, Azure DevOps"
                .to_string(),
        )
    })?;

    match platform.as_str() {
        "github" => {
            let pat = credentials.github_pat.as_ref().ok_or_else(|| {
                crate::CoreError::CredentialsNotFound(
                    "GitHub Personal Access Token not configured".to_string(),
                )
            })?;
            let (owner, repo) = parse_github_remote(remote_url).ok_or_else(|| {
                crate::CoreError::PullRequest(
                    "Could not parse owner/repo from GitHub remote URL".to_string(),
                )
            })?;
            create_github_pr(&owner, &repo, pat, request)
        }
        "azure_devops" => {
            let pat = credentials.ado_pat.as_ref().ok_or_else(|| {
                crate::CoreError::CredentialsNotFound(
                    "Azure DevOps Personal Access Token not configured".to_string(),
                )
            })?;
            // Try to parse from remote URL first, fall back to stored config
            let (org, project, repo) = parse_ado_remote(remote_url)
                .or_else(|| {
                    let org = credentials.ado_organization.as_ref()?;
                    let proj = credentials.ado_project.as_ref()?;
                    // Extract repo name from URL as best guess
                    let repo = remote_url
                        .split('/')
                        .last()
                        .unwrap_or("repo")
                        .trim_end_matches(".git");
                    Some((org.clone(), proj.clone(), repo.to_string()))
                })
                .ok_or_else(|| {
                    crate::CoreError::PullRequest(
                        "Could not determine Azure DevOps organization/project/repo".to_string(),
                    )
                })?;
            create_ado_pr(&org, &project, &repo, pat, request)
        }
        _ => Err(crate::CoreError::PullRequest(format!(
            "Unsupported platform: {}",
            platform
        ))),
    }
}
