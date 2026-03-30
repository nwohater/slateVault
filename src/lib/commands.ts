import { invoke } from "@tauri-apps/api/core";
import type {
  ProjectInfo,
  DocumentInfo,
  SearchResultInfo,
  FileStatus,
  CommitInfo,
  RemoteConfig,
} from "@/types";

export async function createVault(
  path: string,
  name: string
): Promise<string> {
  return invoke("create_vault", { path, name });
}

export async function openVault(path: string): Promise<string> {
  return invoke("open_vault", { path });
}

export async function createProject(
  name: string,
  description?: string,
  tags?: string[]
): Promise<string> {
  return invoke("create_project", { name, description, tags });
}

export async function listProjects(): Promise<ProjectInfo[]> {
  return invoke("list_projects");
}

export async function writeDocument(
  project: string,
  path: string,
  title: string,
  content: string,
  tags?: string[],
  ai_tool?: string
): Promise<string> {
  return invoke("write_document", {
    project,
    path,
    title,
    content,
    tags,
    ai_tool,
  });
}

export async function readDocument(
  project: string,
  path: string
): Promise<string> {
  return invoke("read_document", { project, path });
}

export async function listDocuments(
  project: string,
  tags?: string[]
): Promise<DocumentInfo[]> {
  return invoke("list_documents", { project, tags });
}

export async function searchDocuments(
  query: string,
  project?: string,
  limit?: number
): Promise<SearchResultInfo[]> {
  return invoke("search_documents", { query, project, limit });
}

export async function getProjectContext(
  project: string
): Promise<[string, string][]> {
  return invoke("get_project_context", { project });
}

export async function gitCommit(message: string): Promise<string> {
  return invoke("git_commit", { message });
}

export async function gitStatus(): Promise<FileStatus[]> {
  return invoke("git_status");
}

export async function gitStage(path: string): Promise<string> {
  return invoke("git_stage", { path });
}

export async function gitUnstage(path: string): Promise<string> {
  return invoke("git_unstage", { path });
}

export async function gitLog(limit?: number): Promise<CommitInfo[]> {
  return invoke("git_log", { limit });
}

export async function gitRemoteConfig(): Promise<RemoteConfig> {
  return invoke("git_remote_config");
}

export async function gitPush(): Promise<string> {
  return invoke("git_push");
}

export async function gitPull(): Promise<string> {
  return invoke("git_pull");
}

export async function gitSetRemoteConfig(config: {
  remote_url?: string;
  remote_branch?: string;
  pull_on_open?: boolean;
  push_on_close?: boolean;
}): Promise<string> {
  return invoke("git_set_remote_config", { args: config });
}
