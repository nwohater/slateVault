import { invoke } from "@tauri-apps/api/core";
import type { ProjectInfo, DocumentInfo, SearchResultInfo } from "@/types";

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
