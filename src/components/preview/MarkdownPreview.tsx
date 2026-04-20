"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkFrontmatter from "remark-frontmatter";
import { useEditorStore } from "@/stores/editorStore";
import { EmptyState } from "../shared/EmptyState";
import * as commands from "@/lib/commands";
import type { RelatedDocInfo, BacklinkInfo } from "@/types";

export function MarkdownPreview() {
  const content = useEditorStore((s) => s.content);
  const activePath = useEditorStore((s) => s.activePath);
  const frontMatter = useEditorStore((s) => s.frontMatter);
  const activeProject = useEditorStore((s) => s.activeProject);
  const openDocument = useEditorStore((s) => s.openDocument);
  const previewRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const [relatedDocs, setRelatedDocs] = useState<RelatedDocInfo[]>([]);
  const [backlinks, setBacklinks] = useState<BacklinkInfo[]>([]);
  const [copied, setCopied] = useState(false);
  const [briefCopied, setBriefCopied] = useState(false);

  useEffect(() => {
    if (activeProject && activePath) {
      commands
        .getRelatedDocs(activeProject, activePath)
        .then(setRelatedDocs)
        .catch(() => setRelatedDocs([]));
      commands
        .getBacklinks(activeProject, activePath)
        .then(setBacklinks)
        .catch(() => setBacklinks([]));
    } else {
      setRelatedDocs([]);
      setBacklinks([]);
    }
  }, [activeProject, activePath]);

  if (!activePath) {
    return <EmptyState title="Preview" description="Open a document to preview" />;
  }

  const handleCopyAsPrompt = () => {
    // Strip frontmatter, format as agent-ready context
    const lines = content.split("\n");
    let body = content;
    if (lines[0]?.trim() === "---") {
      const endIdx = lines.findIndex((l, i) => i > 0 && l.trim() === "---");
      if (endIdx > 0) {
        body = lines.slice(endIdx + 1).join("\n").trim();
      }
    }

    const prompt = `## ${frontMatter?.title || activePath}\n\n${body}`;
    navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleGenerateBrief = async () => {
    if (!activeProject) return;
    try {
      const brief = await commands.generateProjectBrief(activeProject);
      navigator.clipboard.writeText(brief);
      setBriefCopied(true);
      setTimeout(() => setBriefCopied(false), 2000);
    } catch (e) {
      console.error("Generate brief failed:", e);
    }
  };

  const handleExportPdf = async () => {
    if (!previewRef.current || exporting) return;
    setExporting(true);

    try {
      const html2canvas = (await import("html2canvas")).default;
      const { jsPDF } = await import("jspdf");

      const element = previewRef.current;

      // Create a clone with print-friendly styling, all hex colors (no oklch)
      const clone = element.cloneNode(true) as HTMLElement;
      clone.style.cssText = `
        position: absolute; left: -9999px; top: 0;
        width: 700px; height: auto; overflow: visible;
        background: #ffffff; padding: 40px; color: #1a1a1a;
        font-family: system-ui, -apple-system, sans-serif;
      `;

      // Strip all oklch colors by forcing hex on every element
      const allElements = clone.querySelectorAll("*");
      allElements.forEach((el) => {
        const htmlEl = el as HTMLElement;
        const tag = htmlEl.tagName.toLowerCase();

        // Reset background and border colors to avoid oklch
        htmlEl.style.backgroundColor = "transparent";
        htmlEl.style.borderColor = "#e5e7eb";
        htmlEl.style.color = "#333";

        if (["h1", "h2", "h3", "h4", "h5", "h6"].includes(tag)) {
          htmlEl.style.color = "#111";
          htmlEl.style.borderColor = "#d1d5db";
        } else if (tag === "a") {
          htmlEl.style.color = "#1a56db";
        } else if (tag === "code") {
          htmlEl.style.backgroundColor = "#f3f4f6";
          htmlEl.style.color = "#c7254e";
          htmlEl.style.padding = "1px 4px";
          htmlEl.style.borderRadius = "3px";
        } else if (tag === "pre") {
          htmlEl.style.backgroundColor = "#f3f4f6";
          htmlEl.style.color = "#1a1a1a";
          htmlEl.style.border = "1px solid #e5e7eb";
          htmlEl.style.borderRadius = "6px";
          htmlEl.style.padding = "12px";
        } else if (tag === "blockquote") {
          htmlEl.style.borderLeftColor = "#d1d5db";
          htmlEl.style.color = "#555";
          htmlEl.style.backgroundColor = "transparent";
        } else if (tag === "strong" || tag === "b") {
          htmlEl.style.color = "#111";
        } else if (tag === "table") {
          htmlEl.style.borderColor = "#d1d5db";
        } else if (tag === "th") {
          htmlEl.style.backgroundColor = "#f9fafb";
          htmlEl.style.color = "#111";
          htmlEl.style.borderColor = "#d1d5db";
        } else if (tag === "td") {
          htmlEl.style.borderColor = "#e5e7eb";
          htmlEl.style.color = "#333";
        } else if (tag === "hr") {
          htmlEl.style.borderColor = "#e5e7eb";
          htmlEl.style.backgroundColor = "#e5e7eb";
        }
      });

      // Replace checkbox inputs with text symbols
      clone.querySelectorAll('input[type="checkbox"]').forEach((el) => {
        const checkbox = el as HTMLInputElement;
        const span = document.createElement("span");
        span.textContent = checkbox.checked ? "\u2611 " : "\u2610 ";
        span.style.fontSize = "14px";
        span.style.color = "#333";
        span.style.verticalAlign = "middle";
        span.style.marginRight = "4px";
        checkbox.replaceWith(span);
      });

      clone.querySelectorAll("li").forEach((el) => {
        const li = el as HTMLElement;
        li.style.display = "flex";
        li.style.alignItems = "baseline";
        li.style.gap = "2px";
      });

      document.body.appendChild(clone);

      const canvas = await html2canvas(clone, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        width: 700,
        windowWidth: 700,
      });

      document.body.removeChild(clone);

      const imgWidth = 190; // A4 width minus margins (mm)
      const pageHeight = 277; // A4 height minus margins (mm)
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      const pdf = new jsPDF("p", "mm", "a4");
      let heightLeft = imgHeight;
      let position = 10; // top margin

      pdf.addImage(
        canvas.toDataURL("image/png"),
        "PNG",
        10, // left margin
        position,
        imgWidth,
        imgHeight
      );
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight + 10;
        pdf.addPage();
        pdf.addImage(
          canvas.toDataURL("image/png"),
          "PNG",
          10,
          position,
          imgWidth,
          imgHeight
        );
        heightLeft -= pageHeight;
      }

      const filename = (frontMatter?.title || activePath || "document")
        .replace(/[^a-zA-Z0-9-_ ]/g, "")
        .replace(/\s+/g, "-")
        .toLowerCase();

      const { save } = await import("@tauri-apps/plugin-dialog");
      const pdfBytes = pdf.output("arraybuffer");

      const savePath = await save({
        defaultPath: `${filename}.pdf`,
        filters: [{ name: "PDF", extensions: ["pdf"] }],
      });

      if (savePath) {
        const { invoke } = await import("@tauri-apps/api/core");
        const bytes = new Uint8Array(pdfBytes);
        let binary = "";
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const dataBase64 = btoa(binary);
        await invoke("write_binary_file", { path: savePath, dataBase64 });
      }
    } catch (e) {
      console.error("PDF export failed:", e);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-neutral-950">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-1.5 border-b border-neutral-800 flex-shrink-0">
        <span className="text-[10px] text-neutral-500 truncate">
          {frontMatter?.title || activePath}
        </span>
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleCopyAsPrompt}
            className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] text-neutral-400 hover:text-neutral-200 bg-neutral-800 hover:bg-neutral-700 rounded transition-colors"
            title="Copy as agent prompt"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9.75a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184" />
            </svg>
            {copied ? "Copied!" : "Copy as Prompt"}
          </button>
          <button
            onClick={handleGenerateBrief}
            className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] text-neutral-400 hover:text-neutral-200 bg-neutral-800 hover:bg-neutral-700 rounded transition-colors"
            title="Generate project brief and copy to clipboard"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
            </svg>
            {briefCopied ? "Brief Copied!" : "Agent Brief"}
          </button>
          <button
            onClick={handleExportPdf}
            disabled={exporting}
            className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] text-neutral-400 hover:text-neutral-200 bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 rounded transition-colors"
            title="Export to PDF"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            {exporting ? "Exporting..." : "Export PDF"}
          </button>
        </div>
      </div>

      {/* Preview content */}
      <div ref={previewRef} id="print-preview" className="flex-1 overflow-y-auto p-6">
        {activePath?.endsWith(".json") ? (
          <pre className="rounded-xl bg-neutral-900 p-4 text-xs leading-relaxed text-emerald-300 overflow-auto whitespace-pre-wrap break-words">
            <code>{(() => { try { return JSON.stringify(JSON.parse(content), null, 2); } catch { return content; } })()}</code>
          </pre>
        ) : (
        <article className="prose prose-invert prose-sm max-w-none prose-headings:text-neutral-100 prose-p:text-neutral-300 prose-a:text-blue-400 prose-code:text-emerald-400 prose-code:bg-neutral-800 prose-code:px-1 prose-code:rounded prose-pre:bg-neutral-900 prose-strong:text-neutral-200">
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkFrontmatter]}
          >
            {content}
          </ReactMarkdown>
        </article>
        )}

        {/* Related docs & backlinks */}
        {(relatedDocs.length > 0 || backlinks.length > 0) && (
          <div className="mt-6 pt-4 border-t border-neutral-800">
            {backlinks.length > 0 && (
              <div className="mb-4">
                <h4 className="text-[10px] text-neutral-500 uppercase tracking-wider mb-2">
                  Linked From
                </h4>
                <div className="space-y-1">
                  {backlinks.map((bl) => (
                    <button
                      key={bl.path}
                      onClick={() => openDocument(bl.project, bl.path)}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-neutral-800 text-left transition-colors"
                    >
                      <svg className="w-3 h-3 text-blue-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m9.86-2.04a4.5 4.5 0 0 0-1.242-7.244l4.5-4.5a4.5 4.5 0 1 1 6.364 6.364l-1.757 1.757" />
                      </svg>
                      <span className="text-xs text-neutral-300 truncate flex-1">
                        {bl.title}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {relatedDocs.length > 0 && (
              <div>
                <h4 className="text-[10px] text-neutral-500 uppercase tracking-wider mb-2">
                  Related Documents
                </h4>
                <div className="space-y-1">
                  {relatedDocs.map((rd) => (
                    <button
                      key={rd.path}
                      onClick={() => openDocument(rd.project, rd.path)}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-neutral-800 text-left transition-colors"
                    >
                      <span className="text-xs text-neutral-300 truncate flex-1">
                        {rd.title}
                      </span>
                      <div className="flex gap-1 flex-shrink-0">
                        {rd.shared_tags.slice(0, 2).map((tag) => (
                          <span
                            key={tag}
                            className="px-1 rounded bg-neutral-800 text-neutral-500 text-[9px]"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
