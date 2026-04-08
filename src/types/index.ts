export interface ProjectInfo {
  name: string;
  description: string;
  tags: string[];
  folder_order: string[];
}

export interface ExportDoc {
  title: string;
  path: string;
  content: string;
}

export interface ExportSection {
  folder: string;
  docs: ExportDoc[];
}

export interface ProjectExport {
  project_name: string;
  sections: ExportSection[];
}

export interface DocumentInfo {
  title: string;
  path: string;
  author: string;
  status: string;
  tags: string[];
  created: string;
  modified: string;
  canonical: boolean;
  protected: boolean;
}

export interface SearchResultInfo {
  project: string;
  path: string;
  title: string;
  snippet: string;
}

export interface FileStatus {
  path: string;
  status: string; // "staged_new" | "staged_modified" | "staged_deleted" | "new" | "modified" | "deleted"
}

export interface CommitInfo {
  oid: string;
  message: string;
  author: string;
  date: string;
}

export interface RemoteConfig {
  remote_url: string | null;
  remote_branch: string;
  pull_on_open: boolean;
  push_on_close: boolean;
}

export interface VaultSettings {
  name: string;
  path: string;
  mcp_enabled: boolean;
  mcp_port: number;
  auto_stage_ai_writes: boolean;
  compress_context: boolean;
  ssh_key_path: string | null;
  remote_url: string | null;
  remote_branch: string;
  ai_enabled: boolean;
  ai_endpoint_url: string;
  ai_model: string;
}

export interface VaultStatsInfo {
  project_count: number;
  doc_count: number;
  mcp_enabled: boolean;
  mcp_port: number;
  remote_branch: string;
  remote_url: string | null;
}

export interface McpServerStatus {
  running: boolean;
  vault_path: string | null;
  port: number | null;
  binary_found: boolean;
}

export interface BranchInfo {
  name: string;
  is_current: boolean;
}

export interface DiffLine {
  origin: string;
  content: string;
  old_lineno: number | null;
  new_lineno: number | null;
}

export interface DiffHunk {
  header: string;
  lines: DiffLine[];
}

export interface DiffFileStats {
  additions: number;
  deletions: number;
}

export interface FileDiff {
  path: string;
  hunks: DiffHunk[];
  stats: DiffFileStats;
}

export interface PrCreateResponse {
  url: string;
  number: number;
  platform: string;
}

export interface CredentialsMasked {
  github_pat: string | null;
  ado_pat: string | null;
  ado_organization: string | null;
  ado_project: string | null;
  ai_api_key: string | null;
}

export interface TemplateInfo {
  name: string;
  label: string;
  is_default: boolean;
}

export interface AiChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface AiChatResult {
  content: string;
  model: string;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  tool_calls?: { id: string; call_type: string; function: { name: string; arguments: string } }[];
  tools_supported: boolean;
}

export interface PlaybookInfo {
  id: string;
  label: string;
  description: string;
}

export interface BacklinkInfo {
  project: string;
  path: string;
  title: string;
}

export interface RecentChange {
  project: string;
  path: string;
  title: string;
  modified: string;
  author: string;
}

export interface RelatedDocInfo {
  project: string;
  path: string;
  title: string;
  shared_tags: string[];
}

export interface FrontMatter {
  id: string;
  title: string;
  author: "human" | "ai" | "both";
  tags: string[];
  created: string;
  modified: string;
  project: string;
  status: "draft" | "review" | "final";
  ai_tool?: string;
  canonical?: boolean;
  protected?: boolean;
}
