"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkFrontmatter from "remark-frontmatter";
import { useEditorStore } from "@/stores/editorStore";
import { EmptyState } from "../shared/EmptyState";

export function MarkdownPreview() {
  const content = useEditorStore((s) => s.content);
  const activePath = useEditorStore((s) => s.activePath);

  if (!activePath) {
    return <EmptyState title="Preview" description="Open a document to preview" />;
  }

  return (
    <div className="h-full overflow-y-auto bg-neutral-950 p-6">
      <article className="prose prose-invert prose-sm max-w-none prose-headings:text-neutral-100 prose-p:text-neutral-300 prose-a:text-blue-400 prose-code:text-emerald-400 prose-code:bg-neutral-800 prose-code:px-1 prose-code:rounded prose-pre:bg-neutral-900 prose-strong:text-neutral-200">
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkFrontmatter]}
        >
          {content}
        </ReactMarkdown>
      </article>
    </div>
  );
}
