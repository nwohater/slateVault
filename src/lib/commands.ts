import { invoke } from "@tauri-apps/api/core";
import type {
  ProjectInfo,
  DocumentInfo,
  SearchResultInfo,
  FileStatus,
  CommitInfo,
  RemoteConfig,
  VaultSettings,
  VaultStatsInfo,
  McpServerStatus,
  BranchInfo,
  FileDiff,
  PrCreateResponse,
  CredentialsMasked,
  TemplateInfo,
  ProjectExport,
  RelatedDocInfo,
  BacklinkInfo,
  RecentChange,
  PlaybookInfo,
  AiChatMessage,
  AiChatResult,
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
  tags?: string[],
  template?: string
): Promise<string> {
  return invoke("create_project", { name, description, tags, template });
}

export async function aiChat(
  message: string,
  project: string,
  includeContext: boolean,
  includeSource: boolean,
  history: AiChatMessage[]
): Promise<AiChatResult> {
  return invoke("ai_chat", {
    args: {
      message,
      project,
      include_context: includeContext,
      include_source: includeSource,
      history,
    },
  });
}

export async function aiTestTools(): Promise<boolean> {
  return invoke("ai_test_tools");
}

export async function aiListModels(): Promise<string[]> {
  return invoke("ai_list_models");
}

export async function setProjectSourceFolder(
  project: string,
  sourceFolder: string | null
): Promise<string> {
  return invoke("set_project_source_folder", { project, sourceFolder });
}

export async function getProjectSourceFolder(
  project: string
): Promise<string | null> {
  return invoke("get_project_source_folder", { project });
}

export async function listPlaybooks(): Promise<PlaybookInfo[]> {
  return invoke("list_playbooks");
}

export async function getPlaybookPrompt(
  playbookId: string,
  project: string
): Promise<string> {
  return invoke("get_playbook_prompt", { playbookId, project });
}

export async function backupVault(destPath: string): Promise<string> {
  return invoke("backup_vault", { destPath });
}

export async function restoreVault(
  zipPath: string,
  destPath: string
): Promise<string> {
  return invoke("restore_vault", { zipPath, destPath });
}

export async function importMarkdownFolder(
  project: string,
  sourcePath: string
): Promise<string> {
  return invoke("import_markdown_folder", { project, sourcePath });
}

export async function getBacklinks(
  project: string,
  path: string
): Promise<BacklinkInfo[]> {
  return invoke("get_backlinks", { project, path });
}

export async function getRecentChanges(
  limit?: number
): Promise<RecentChange[]> {
  return invoke("get_recent_changes", { limit });
}

export async function generateProjectBrief(
  project: string
): Promise<string> {
  return invoke("generate_project_brief", { project });
}

export async function getRelatedDocs(
  project: string,
  path: string
): Promise<RelatedDocInfo[]> {
  return invoke("get_related_docs", { project, path });
}

export async function exportProjectDocs(
  project: string
): Promise<ProjectExport> {
  return invoke("export_project_docs", { project });
}

export async function readVaultFile(path: string): Promise<string> {
  return invoke("read_vault_file", { path });
}

export async function writeVaultFile(
  path: string,
  content: string
): Promise<string> {
  return invoke("write_vault_file", { path, content });
}

export async function listTemplates(): Promise<TemplateInfo[]> {
  return invoke("list_templates");
}

export async function getTemplatesConfig(): Promise<string> {
  return invoke("get_templates_config");
}

export async function saveTemplatesConfig(json: string): Promise<string> {
  return invoke("save_templates_config", { json });
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
  ai_tool?: string,
  canonical?: boolean,
  isProtected?: boolean
): Promise<string> {
  return invoke("write_document", {
    project,
    path,
    title,
    content,
    tags,
    ai_tool,
    canonical,
    isProtected,
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

export async function gitClone(url: string, path: string): Promise<string> {
  return invoke("git_clone", { url, path });
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

export async function getVaultConfig(): Promise<VaultSettings> {
  return invoke("get_vault_config");
}

export async function setVaultConfig(config: {
  name?: string;
  mcp_enabled?: boolean;
  mcp_port?: number;
  auto_stage_ai_writes?: boolean;
  compress_context?: boolean;
  ssh_key_path?: string;
  ai_enabled?: boolean;
  ai_endpoint_url?: string;
  ai_model?: string;
}): Promise<string> {
  return invoke("set_vault_config", { args: config });
}

export async function spawnTerminal(cwd: string): Promise<string> {
  return invoke("spawn_terminal", { cwd });
}

export async function writeTerminal(data: string): Promise<void> {
  return invoke("write_terminal", { data });
}

export async function resizeTerminal(
  rows: number,
  cols: number
): Promise<void> {
  return invoke("resize_terminal", { rows, cols });
}

export async function closeTerminal(): Promise<string> {
  return invoke("close_terminal");
}

export async function listFolders(project: string): Promise<string[]> {
  return invoke("list_folders", { project });
}

export async function deleteFolder(
  project: string,
  folderPath: string
): Promise<string> {
  return invoke("delete_folder", { project, folderPath });
}

export async function createFolder(
  project: string,
  folderPath: string
): Promise<string> {
  return invoke("create_folder", { project, folderPath });
}

export async function showInFolder(
  project: string,
  path?: string
): Promise<void> {
  return invoke("show_in_folder", { project, path });
}

export async function deleteDocument(
  project: string,
  path: string
): Promise<string> {
  return invoke("delete_document", { project, path });
}

export async function deleteProject(name: string): Promise<string> {
  return invoke("delete_project", { name });
}

export async function renameDocument(
  project: string,
  oldPath: string,
  newPath: string
): Promise<string> {
  return invoke("rename_document", { project, oldPath, newPath });
}

export async function renameProject(
  oldName: string,
  newName: string
): Promise<string> {
  return invoke("rename_project", { oldName, newName });
}

export async function rebuildIndex(): Promise<number> {
  return invoke("rebuild_index");
}

export async function vaultStats(): Promise<VaultStatsInfo> {
  return invoke("vault_stats");
}

export async function startMcpServer(
  vault_path: string,
  port: number
): Promise<string> {
  return invoke("start_mcp_server", { vaultPath: vault_path, port });
}

export async function stopMcpServer(): Promise<string> {
  return invoke("stop_mcp_server");
}

export async function mcpServerStatus(): Promise<McpServerStatus> {
  return invoke("mcp_server_status");
}

// -- Branch commands --

export async function gitCurrentBranch(): Promise<string> {
  return invoke("git_current_branch");
}

export async function gitListBranches(): Promise<BranchInfo[]> {
  return invoke("git_list_branches");
}

export async function gitCreateBranch(name: string): Promise<string> {
  return invoke("git_create_branch", { name });
}

export async function gitSwitchBranch(name: string): Promise<string> {
  return invoke("git_switch_branch", { name });
}

export async function gitDeleteBranch(name: string): Promise<string> {
  return invoke("git_delete_branch", { name });
}

// -- Diff commands --

export async function gitDiffFile(
  path: string,
  staged: boolean
): Promise<FileDiff> {
  return invoke("git_diff_file", { path, staged });
}

export async function gitDiffBranches(
  base: string,
  head: string
): Promise<FileDiff[]> {
  return invoke("git_diff_branches", { base, head });
}

// -- PR commands --

export async function gitPushBranch(branch: string): Promise<string> {
  return invoke("git_push_branch", { branch });
}

export async function gitCreatePr(
  title: string,
  description: string,
  sourceBranch: string,
  targetBranch: string
): Promise<PrCreateResponse> {
  return invoke("git_create_pr", {
    title,
    description,
    sourceBranch,
    targetBranch,
  });
}

export async function gitDetectPlatform(): Promise<string | null> {
  return invoke("git_detect_platform");
}

export async function gitSaveCredentials(creds: {
  github_pat?: string;
  ado_pat?: string;
  ado_organization?: string;
  ado_project?: string;
  ai_api_key?: string;
}): Promise<string> {
  return invoke("git_save_credentials", {
    githubPat: creds.github_pat,
    adoPat: creds.ado_pat,
    adoOrganization: creds.ado_organization,
    adoProject: creds.ado_project,
    aiApiKey: creds.ai_api_key,
  });
}

export async function gitLoadCredentials(): Promise<CredentialsMasked> {
  return invoke("git_load_credentials");
}
