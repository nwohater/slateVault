"use client";

import { useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkFrontmatter from "remark-frontmatter";
import { useEditorStore } from "@/stores/editorStore";
import { EmptyState } from "../shared/EmptyState";

export function MarkdownPreview() {
  const content = useEditorStore((s) => s.content);
  const activePath = useEditorStore((s) => s.activePath);
  const frontMatter = useEditorStore((s) => s.frontMatter);
  const previewRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);

  if (!activePath) {
    return <EmptyState title="Preview" description="Open a document to preview" />;
  }

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

      {/* Preview content */}
      <div ref={previewRef} id="print-preview" className="flex-1 overflow-y-auto p-6">
        <article className="prose prose-invert prose-sm max-w-none prose-headings:text-neutral-100 prose-p:text-neutral-300 prose-a:text-blue-400 prose-code:text-emerald-400 prose-code:bg-neutral-800 prose-code:px-1 prose-code:rounded prose-pre:bg-neutral-900 prose-strong:text-neutral-200">
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkFrontmatter]}
          >
            {content}
          </ReactMarkdown>
        </article>
      </div>
    </div>
  );
}
