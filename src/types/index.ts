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
