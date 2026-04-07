"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import * as commands from "@/lib/commands";
import type { ProjectExport } from "@/types";

interface ProjectPdfExportProps {
  project: string;
  onClose: () => void;
}

export function ProjectPdfExport({ project, onClose }: ProjectPdfExportProps) {
  const [data, setData] = useState<ProjectExport | null>(null);
  const [status, setStatus] = useState("Loading documents...");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    generatePdf();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const generatePdf = async () => {
    try {
      // Step 1: Load docs
      setStatus("Loading documents...");
      setProgress(10);
      const exportData = await commands.exportProjectDocs(project);
      setData(exportData);

      const totalDocs = exportData.sections.reduce(
        (sum, s) => sum + s.docs.length,
        0
      );
      if (totalDocs === 0) {
        setError("No documents to export.");
        return;
      }

      // Step 2: Wait for React to render the hidden content
      setStatus("Rendering content...");
      setProgress(20);
      await new Promise((r) => setTimeout(r, 500));

      if (!containerRef.current) {
        setError("Failed to render content.");
        return;
      }

      // Step 3: Render to canvas
      setStatus("Generating PDF...");
      setProgress(40);

      const html2canvas = (await import("html2canvas")).default;
      const { jsPDF } = await import("jspdf");

      const pdf = new jsPDF("p", "mm", "a4");
      const imgWidth = 190; // A4 minus margins
      const pageHeight = 277;
      let isFirstPage = true;

      // Inject a style tag that overrides ALL colors to hex — prevents oklch from reaching html2canvas
      const overrideStyle = document.createElement("style");
      overrideStyle.textContent = `
        [data-pdf-export] *, [data-pdf-export] *::before, [data-pdf-export] *::after {
          color: #333 !important;
          background-color: transparent !important;
          border-color: #e5e7eb !important;
          text-decoration-color: #333 !important;
          outline-color: #333 !important;
          caret-color: #333 !important;
          column-rule-color: #333 !important;
          fill: #333 !important;
          stroke: #333 !important;
          accent-color: auto !important;
        }
        [data-pdf-export] h1, [data-pdf-export] h2, [data-pdf-export] h3,
        [data-pdf-export] h4, [data-pdf-export] h5, [data-pdf-export] h6 { color: #111 !important; }
        [data-pdf-export] a { color: #1a56db !important; }
        [data-pdf-export] code { background-color: #f3f4f6 !important; color: #c7254e !important; }
        [data-pdf-export] pre { background-color: #f3f4f6 !important; color: #1a1a1a !important; border: 1px solid #e5e7eb !important; }
        [data-pdf-export] pre code { color: #1a1a1a !important; background-color: transparent !important; }
        [data-pdf-export] blockquote { border-left-color: #d1d5db !important; color: #555 !important; }
        [data-pdf-export] th { background-color: #f9fafb !important; color: #111 !important; }
        [data-pdf-export] strong, [data-pdf-export] b { color: #111 !important; }
        [data-pdf-export] [data-section-header] { color: #111 !important; border-bottom-color: #2563eb !important; }
        [data-pdf-export] [data-project-title] { color: #111 !important; }
      `;
      document.head.appendChild(overrideStyle);

      // Mark container for the override styles
      containerRef.current.setAttribute("data-pdf-export", "");

      // Temporarily disable ALL stylesheets to prevent oklch parsing by html2canvas
      const disabledSheets: { sheet: StyleSheet; disabled: boolean }[] = [];
      for (let i = 0; i < document.styleSheets.length; i++) {
        const sheet = document.styleSheets[i];
        if (sheet !== overrideStyle.sheet) {
          disabledSheets.push({ sheet, disabled: sheet.disabled });
          sheet.disabled = true;
        }
      }

      // Render each doc-block separately to avoid cutting content mid-line
      const blocks = containerRef.current.querySelectorAll("[data-doc-block]");
      const totalBlocks = blocks.length;

      for (let i = 0; i < totalBlocks; i++) {
        setStatus(`Rendering ${i + 1} of ${totalBlocks}...`);
        setProgress(40 + Math.round((i / totalBlocks) * 40));

        const block = blocks[i] as HTMLElement;

        // Clone and style for print
        const clone = block.cloneNode(true) as HTMLElement;
        clone.style.cssText = `
          all: initial;
          position: absolute; left: -9999px; top: 0;
          width: 700px; height: auto; overflow: visible;
          background: #ffffff; padding: 24px 40px; color: #1a1a1a;
          font-family: system-ui, -apple-system, sans-serif;
          font-size: 14px; line-height: 1.6;
        `;

        const allElements = clone.querySelectorAll("*");
        allElements.forEach((el) => {
          const htmlEl = el as HTMLElement;
          const tag = htmlEl.tagName.toLowerCase();
          // Strip all Tailwind classes to prevent oklch color resolution
          htmlEl.className = "";
          htmlEl.style.all = "initial";
          htmlEl.style.display = tag === "div" || tag === "article" || tag === "section" || tag === "ul" || tag === "ol" ? "block" : tag === "li" ? "list-item" : tag === "span" || tag === "code" || tag === "strong" || tag === "em" || tag === "a" ? "inline" : "block";
          htmlEl.style.fontFamily = "inherit";
          htmlEl.style.fontSize = "inherit";
          htmlEl.style.lineHeight = "inherit";
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
          } else if (tag === "strong" || tag === "b") {
            htmlEl.style.color = "#111";
          } else if (tag === "th") {
            htmlEl.style.backgroundColor = "#f9fafb";
            htmlEl.style.color = "#111";
          } else if (tag === "hr") {
            htmlEl.style.borderColor = "#e5e7eb";
            htmlEl.style.backgroundColor = "#e5e7eb";
          }
        });

        // Style section headers and title
        clone.querySelectorAll("[data-section-header]").forEach((el) => {
          const h = el as HTMLElement;
          h.style.color = "#111";
          h.style.fontSize = "20px";
          h.style.fontWeight = "700";
          h.style.borderBottomColor = "#2563eb";
          h.style.borderBottomWidth = "2px";
          h.style.borderBottomStyle = "solid";
          h.style.paddingBottom = "6px";
          h.style.marginBottom = "12px";
        });
        clone.querySelectorAll("[data-project-title]").forEach((el) => {
          const h = el as HTMLElement;
          h.style.color = "#111";
          h.style.fontSize = "28px";
          h.style.fontWeight = "800";
          h.style.marginBottom = "16px";
        });

        // Replace checkbox inputs with text symbols for clean rendering
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

        // Fix list item alignment
        clone.querySelectorAll("li").forEach((el) => {
          const li = el as HTMLElement;
          li.style.display = "flex";
          li.style.alignItems = "baseline";
          li.style.gap = "2px";
        });

        document.body.appendChild(clone);

        const canvas = await html2canvas(clone, {
          scale: 1.5,
          useCORS: true,
          backgroundColor: "#ffffff",
          width: 700,
          windowWidth: 700,
        });

        document.body.removeChild(clone);

        const imgData = canvas.toDataURL("image/jpeg", 0.85);
        const imgHeight = (canvas.height * imgWidth) / canvas.width;

        if (!isFirstPage) {
          pdf.addPage();
        }
        isFirstPage = false;

        if (imgHeight <= pageHeight) {
          pdf.addImage(imgData, "JPEG", 10, 10, imgWidth, imgHeight);
        } else {
          let heightLeft = imgHeight;
          let position = 10;
          pdf.addImage(imgData, "JPEG", 10, position, imgWidth, imgHeight);
          heightLeft -= pageHeight;

          while (heightLeft > 0) {
            position = heightLeft - imgHeight + 10;
            pdf.addPage();
            pdf.addImage(imgData, "JPEG", 10, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;
          }
        }
      }

      // Re-enable all stylesheets
      for (const { sheet, disabled } of disabledSheets) {
        sheet.disabled = disabled;
      }

      // Clean up override styles
      overrideStyle.remove();
      containerRef.current?.removeAttribute("data-pdf-export");

      setStatus("Saving PDF...");
      setProgress(85);

      setProgress(90);

      const filename = project
        .replace(/[^a-zA-Z0-9-_ ]/g, "")
        .replace(/\s+/g, "-")
        .toLowerCase();

      const { save } = await import("@tauri-apps/plugin-dialog");
      const pdfBytes = pdf.output("arraybuffer");

      const savePath = await save({
        defaultPath: `${filename}-project.pdf`,
        filters: [{ name: "PDF", extensions: ["pdf"] }],
      });

      if (savePath) {
        const { invoke } = await import("@tauri-apps/api/core");
        // Convert to base64 in chunks to avoid string length limits
        const bytes = new Uint8Array(pdfBytes);
        const chunkSize = 32768;
        let dataBase64 = "";
        for (let i = 0; i < bytes.length; i += chunkSize) {
          const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
          dataBase64 += String.fromCharCode(...chunk);
        }
        dataBase64 = btoa(dataBase64);
        await invoke("write_binary_file", { path: savePath, dataBase64 });
      }

      setProgress(100);
      setStatus("Done!");
      setTimeout(onClose, 500);
    } catch (e) {
      setError(String(e));
    }
  };

  return (
    <>
      {/* Modal overlay with progress */}
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
        <div className="bg-neutral-800 border border-neutral-700 rounded-xl shadow-2xl p-6 w-80">
          <h3 className="text-sm font-semibold text-neutral-200 mb-3">
            Export Project to PDF
          </h3>
          <p className="text-xs text-neutral-400 mb-1">{project}</p>

          {error ? (
            <>
              <p className="text-xs text-red-400 mt-3">{error}</p>
              <button
                onClick={onClose}
                className="mt-4 w-full px-3 py-1.5 text-xs rounded bg-neutral-700 hover:bg-neutral-600 text-neutral-300"
              >
                Close
              </button>
            </>
          ) : (
            <>
              <div className="mt-3 w-full bg-neutral-700 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-[10px] text-neutral-500 mt-2">{status}</p>
            </>
          )}
        </div>
      </div>

      {/* Hidden render container */}
      {data && (
        <div
          ref={containerRef}
          style={{
            position: "absolute",
            left: "-9999px",
            top: 0,
            width: 700,
            background: "white",
            padding: 40,
            color: "#333",
            fontFamily: "system-ui, -apple-system, sans-serif",
            fontSize: "14px",
            lineHeight: "1.6",
          }}
          className="no-transition"
        >
          {/* Title block */}
          <div data-doc-block>
            <h1
              data-project-title
              style={{ fontSize: "28px", fontWeight: 800, color: "#111", marginBottom: "24px" }}
            >
              {data.project_name}
            </h1>
          </div>

          {data.sections.map((section) => (
            <div key={section.folder}>
              {/* Section header as its own block if it has docs */}
              {section.docs.map((doc) => (
                <div key={doc.path} data-doc-block>
                  {/* Show section header on first doc of each section */}
                  {section.docs[0] === doc && (
                    <h2
                      data-section-header
                      style={{ fontSize: "20px", fontWeight: 700, color: "#111", borderBottom: "2px solid #2563eb", paddingBottom: "6px", marginBottom: "16px" }}
                    >
                      {section.folder}
                    </h2>
                  )}
                  <article className="no-transition" style={{ color: "#333", fontSize: "14px", lineHeight: "1.6" }}>
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {doc.content}
                    </ReactMarkdown>
                  </article>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
