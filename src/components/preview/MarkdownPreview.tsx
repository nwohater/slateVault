"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkFrontmatter from "remark-frontmatter";
import { useEditorStore } from "@/stores/editorStore";
import { EmptyState } from "../shared/EmptyState";
import * as commands from "@/lib/commands";
import { copyToClipboard } from "@/lib/clipboard";
import type { RelatedDocInfo, BacklinkInfo, FileHistoryEntry } from "@/types";

function formatHistoryDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function normalizeHeading(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function stripMatchingLeadingHeading(body: string, title: string): string {
  const lines = body.split("\n");
  const firstContentIndex = lines.findIndex((line) => line.trim().length > 0);
  if (firstContentIndex === -1) return body.trim();

  const firstLine = lines[firstContentIndex].trim();
  const match = firstLine.match(/^#\s+(.+)$/);
  if (!match) return body.trim();

  if (normalizeHeading(match[1]) !== normalizeHeading(title)) {
    return body.trim();
  }

  return lines
    .slice(0, firstContentIndex)
    .concat(lines.slice(firstContentIndex + 1))
    .join("\n")
    .trim();
}

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
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<FileHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

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

  useEffect(() => {
    setShowHistory(false);
    setHistory([]);
    setHistoryError(null);
  }, [activeProject, activePath]);

  if (!activePath) {
    return <EmptyState title="Preview" description="Open a document to preview" />;
  }

  const handleCopyAsPrompt = async () => {
    // Strip frontmatter, format as agent-ready context
    const lines = content.split("\n");
    let body = content;
    if (lines[0]?.trim() === "---") {
      const endIdx = lines.findIndex((l, i) => i > 0 && l.trim() === "---");
      if (endIdx > 0) {
        body = lines.slice(endIdx + 1).join("\n").trim();
      }
    }

    const title = frontMatter?.title || activePath;
    const prompt = `## ${title}\n\n${stripMatchingLeadingHeading(body, title)}`;
    await copyToClipboard(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleGenerateBrief = async () => {
    if (!activeProject) return;
    try {
      const brief = await commands.generateProjectBrief(activeProject);
      await copyToClipboard(brief);
      setBriefCopied(true);
      setTimeout(() => setBriefCopied(false), 2000);
    } catch (e) {
      console.error("Generate brief failed:", e);
    }
  };

  const handleToggleHistory = async () => {
    const nextVisible = !showHistory;
    setShowHistory(nextVisible);
    if (!nextVisible || !activeProject || history.length > 0 || historyLoading) return;

    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const entries = await commands.gitFileHistory(activeProject, activePath, 25);
      setHistory(entries);
    } catch (e) {
      setHistoryError(`Could not load history: ${e}`);
    } finally {
      setHistoryLoading(false);
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
    <div className="h-full flex flex-col" style={{ background: "var(--bg-app)" }}>
      {/* Toolbar — icon-only actions, tooltips on hover */}
      <div className="flex items-center justify-end gap-0.5 px-2 py-1 flex-shrink-0" style={{ borderBottom: "1px solid var(--border)", minHeight: 36 }}>
          <button
            onClick={handleCopyAsPrompt}
            className="icon-btn"
            title={copied ? "Copied!" : "Copy as agent prompt"}
          >
            {copied ? (
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
            ) : (
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9.75a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184" />
              </svg>
            )}
          </button>
          <button
            onClick={handleGenerateBrief}
            className="icon-btn"
            title={briefCopied ? "Copied!" : "Generate agent brief"}
          >
            {briefCopied ? (
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
            ) : (
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
              </svg>
            )}
          </button>
          {activeProject && (
            <button
              onClick={handleToggleHistory}
              className="icon-btn"
              style={showHistory ? { background: "var(--info-soft)", color: "var(--info)" } : undefined}
              title="File history"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l3.75 2.25M21 12a9 9 0 1 1-2.64-6.36" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 3v5h-5" />
              </svg>
            </button>
          )}
          <button
            onClick={handleExportPdf}
            disabled={exporting}
            className="icon-btn"
            title="Export to PDF"
            style={exporting ? { opacity: 0.5 } : undefined}
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
          </button>
      </div>

      {showHistory && (
        <div className="flex-shrink-0 px-4 py-3" style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-panel)" }}>
          <div className="mb-2 flex items-center justify-between">
            <div>
              <div className="text-[10px] font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)", letterSpacing: "0.05em" }}>
                File History
              </div>
              <div className="mt-0.5 text-[10px]" style={{ color: "var(--text-faint)", fontFamily: "var(--font-mono)" }}>
                {activeProject}/{activePath}
              </div>
            </div>
            <button onClick={() => setShowHistory(false)} className="btn sm" style={{ fontSize: 10 }}>
              Close
            </button>
          </div>
          {historyLoading ? (
            <div className="rounded px-3 py-2 text-xs" style={{ border: "1px solid var(--border)", color: "var(--text-muted)" }}>
              Loading history...
            </div>
          ) : historyError ? (
            <div className="rounded px-3 py-2 text-xs" style={{ background: "var(--danger-soft)", border: "1px solid var(--danger)", color: "var(--danger)" }}>
              {historyError}
            </div>
          ) : history.length === 0 ? (
            <div className="rounded px-3 py-2 text-xs" style={{ border: "1px solid var(--border)", color: "var(--text-muted)" }}>
              No commit history yet.
            </div>
          ) : (
            <div className="max-h-56 overflow-y-auto rounded" style={{ border: "1px solid var(--border)" }}>
              {history.map((entry) => (
                <div
                  key={entry.full_oid}
                  style={{ borderBottom: "1px solid var(--border-subtle)", padding: "8px 12px" }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs" style={{ color: "var(--text)" }}>
                        {entry.message || "(no commit message)"}
                      </div>
                      <div className="mt-1 text-[10px]" style={{ color: "var(--text-faint)" }}>
                        {entry.author}
                        {entry.email ? ` <${entry.email}>` : ""} · {formatHistoryDate(entry.date)}
                      </div>
                    </div>
                    <code className="rounded px-1.5 py-0.5 text-[10px]" style={{ background: "var(--bg-code)", color: "var(--accent)" }}>
                      {entry.oid}
                    </code>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Preview content */}
      <div ref={previewRef} id="print-preview" className="flex-1 overflow-y-auto p-6">
        {activePath?.endsWith(".json") ? (
          <pre className="rounded-xl p-4 text-xs leading-relaxed overflow-auto whitespace-pre-wrap break-words" style={{ background: "var(--bg-code)", color: "var(--success)" }}>
            <code>{(() => { try { return JSON.stringify(JSON.parse(content), null, 2); } catch { return content; } })()}</code>
          </pre>
        ) : (
        <article className="prose prose-sm max-w-none [&_h1]:text-[color:var(--text)] [&_h2]:text-[color:var(--text)] [&_h3]:text-[color:var(--text)] [&_p]:text-[color:var(--text-muted)] [&_a]:text-[color:var(--info)] [&_code]:text-[color:var(--accent)] [&_code]:bg-[var(--bg-code)] [&_code]:px-1 [&_code]:rounded [&_pre]:bg-[var(--bg-code)] [&_strong]:text-[color:var(--text)]">
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkFrontmatter]}
          >
            {content}
          </ReactMarkdown>
        </article>
        )}

        {/* Related docs & backlinks */}
        {(relatedDocs.length > 0 || backlinks.length > 0) && (
          <div className="mt-6 pt-4" style={{ borderTop: "1px solid var(--border-subtle)" }}>
            {backlinks.length > 0 && (
              <div className="mb-4">
                <h4 className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>
                  Linked From
                </h4>
                <div className="space-y-1">
                  {backlinks.map((bl) => (
                    <button
                      key={bl.path}
                      onClick={() => openDocument(bl.project, bl.path)}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-left transition-colors"
                      onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-subtle)")}
                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                    >
                      <svg className="w-3 h-3 flex-shrink-0" style={{ color: "var(--info)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m9.86-2.04a4.5 4.5 0 0 0-1.242-7.244l4.5-4.5a4.5 4.5 0 1 1 6.364 6.364l-1.757 1.757" />
                      </svg>
                      <span className="text-xs truncate flex-1" style={{ color: "var(--text-muted)" }}>
                        {bl.title}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {relatedDocs.length > 0 && (
              <div>
                <h4 className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>
                  Related Documents
                </h4>
                <div className="space-y-1">
                  {relatedDocs.map((rd) => (
                    <button
                      key={rd.path}
                      onClick={() => openDocument(rd.project, rd.path)}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-left transition-colors"
                      onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-subtle)")}
                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                    >
                      <span className="text-xs truncate flex-1" style={{ color: "var(--text-muted)" }}>
                        {rd.title}
                      </span>
                      <div className="flex gap-1 flex-shrink-0">
                        {rd.shared_tags.slice(0, 2).map((tag) => (
                          <span key={tag} className="chip" style={{ fontSize: 9 }}>{tag}</span>
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
