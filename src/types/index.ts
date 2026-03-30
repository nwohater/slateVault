export interface ProjectInfo {
  name: string;
  description: string;
  tags: string[];
}

export interface DocumentInfo {
  title: string;
  path: string;
  author: string;
  status: string;
  tags: string[];
  created: string;
  modified: string;
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
}
