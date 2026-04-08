"use client";

import { useEffect, useRef, useState } from "react";
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

      // Step 2: Generate PDF using jsPDF text rendering (no html2canvas, no oklch issues)
      setStatus("Generating PDF...");
      setProgress(30);

      const { jsPDF } = await import("jspdf");
      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = 190;
      const pageHeight = 277;
      const marginLeft = 10;
      const marginTop = 15;
      let y = marginTop;

      const addPage = () => {
        pdf.addPage();
        y = marginTop;
      };

      const checkSpace = (needed: number) => {
        if (y + needed > pageHeight) {
          addPage();
        }
      };

      // Sanitize text for jsPDF (only supports basic Latin characters)
      const sanitize = (text: string): string => {
        return text
          .replace(/[\u2018\u2019]/g, "'")   // smart quotes
          .replace(/[\u201C\u201D]/g, '"')   // smart double quotes
          .replace(/\u2013/g, "-")           // en dash
          .replace(/\u2014/g, "--")          // em dash
          .replace(/\u2026/g, "...")         // ellipsis
          .replace(/\u2611/g, "[x]")         // checked box
          .replace(/\u2610/g, "[ ]")         // unchecked box
          .replace(/[\u2022\u2023\u25E6]/g, "-") // bullets
          .replace(/\u2192/g, "->")          // right arrow
          .replace(/\u2190/g, "<-")          // left arrow
          .replace(/[^\x00-\x7F]/g, "");     // strip remaining non-ASCII
      };

      const writeText = (
        text: string,
        size: number,
        style: "normal" | "bold" | "italic" = "normal",
        color: [number, number, number] = [51, 51, 51]
      ) => {
        pdf.setFontSize(size);
        pdf.setFont("helvetica", style);
        pdf.setTextColor(color[0], color[1], color[2]);
        const clean = sanitize(text);
        const lines = pdf.splitTextToSize(clean, pageWidth);
        const lineHeight = size * 0.5;
        for (const line of lines) {
          checkSpace(lineHeight);
          pdf.text(line, marginLeft, y);
          y += lineHeight;
        }
      };

      // Title
      writeText(exportData.project_name, 22, "bold", [17, 17, 17]);
      y += 4;

      // Draw title underline
      pdf.setDrawColor(37, 99, 235);
      pdf.setLineWidth(0.5);
      pdf.line(marginLeft, y, marginLeft + 80, y);
      y += 8;

      let docIndex = 0;

      for (const section of exportData.sections) {
        docIndex++;
        setStatus(`Rendering section ${docIndex}...`);
        setProgress(30 + Math.round((docIndex / exportData.sections.length) * 50));

        // Section header
        checkSpace(15);
        writeText(section.folder, 16, "bold", [17, 17, 17]);
        y += 1;
        pdf.setDrawColor(37, 99, 235);
        pdf.setLineWidth(0.3);
        pdf.line(marginLeft, y, marginLeft + 60, y);
        y += 6;

        for (const doc of section.docs) {
          // Doc title
          checkSpace(12);
          writeText(doc.title, 13, "bold", [34, 34, 34]);
          y += 2;

          // Doc content — render as plain text paragraphs
          const paragraphs = doc.content
            .split(/\n\n+/)
            .map((p) => p.trim())
            .filter((p) => p.length > 0);

          for (const para of paragraphs) {
            // Detect headers
            const headerMatch = para.match(/^(#{1,6})\s+(.+)/);
            if (headerMatch) {
              const level = headerMatch[1].length;
              const headerText = headerMatch[2];
              const sizes = [16, 14, 12, 11, 10, 10];
              checkSpace(8);
              writeText(headerText, sizes[level - 1] || 10, "bold", [17, 17, 17]);
              y += 2;
              continue;
            }

            // Detect code blocks
            if (para.startsWith("```")) {
              const codeContent = para
                .replace(/^```\w*\n?/, "")
                .replace(/\n?```$/, "");
              checkSpace(6);
              // Code background
              const codeLines = pdf.splitTextToSize(codeContent, pageWidth - 8);
              const codeHeight = codeLines.length * 4 + 4;
              checkSpace(codeHeight);
              pdf.setFillColor(243, 244, 246);
              pdf.roundedRect(marginLeft, y - 2, pageWidth, codeHeight, 1, 1, "F");
              pdf.setFontSize(9);
              pdf.setFont("courier", "normal");
              pdf.setTextColor(30, 30, 30);
              for (const line of codeLines) {
                pdf.text(line, marginLeft + 4, y + 2);
                y += 4;
              }
              y += 4;
              continue;
            }

            // Detect tables (lines with | characters)
            if (para.includes("|") && para.split("\n").some((l) => l.trim().startsWith("|"))) {
              const rows = para.split("\n").filter((l) => l.trim().length > 0);
              for (const row of rows) {
                // Skip separator rows (|---|---|)
                if (row.match(/^\|[\s-:|]+\|$/)) continue;
                const cells = row
                  .split("|")
                  .map((c) => c.trim())
                  .filter((c) => c.length > 0);
                const cellText = cells.join("  |  ");
                checkSpace(5);
                writeText(cellText, 9, "normal");
                y += 1;
              }
              y += 3;
              continue;
            }

            // Detect list items
            if (para.match(/^[-*]\s/) || para.match(/^\d+\.\s/)) {
              const items = para.split("\n");
              for (const item of items) {
                const cleaned = item.replace(/^[-*]\s+/, "- ").replace(/^\d+\.\s+/, "");
                checkSpace(5);
                writeText(`  ${cleaned}`, 10, "normal");
                y += 1;
              }
              y += 2;
              continue;
            }

            // Regular paragraph
            // Strip inline markdown formatting for clean text
            const cleanText = para
              .replace(/\*\*(.+?)\*\*/g, "$1")
              .replace(/\*(.+?)\*/g, "$1")
              .replace(/`(.+?)`/g, "$1")
              .replace(/\[(.+?)\]\(.+?\)/g, "$1");

            checkSpace(5);
            writeText(cleanText, 10, "normal");
            y += 3;
          }

          y += 4;
        }

        // Add some space between sections
        y += 6;
      }

      setStatus("Saving PDF...");
      setProgress(85);

      const filename = project
        .replace(/[^a-zA-Z0-9-_ ]/g, "")
        .replace(/\s+/g, "-")
        .toLowerCase();

      const pdfBytes = pdf.output("arraybuffer");

      const { save } = await import("@tauri-apps/plugin-dialog");
      const savePath = await save({
        defaultPath: `${filename}-project.pdf`,
        filters: [{ name: "PDF", extensions: ["pdf"] }],
      });

      if (savePath) {
        const { invoke } = await import("@tauri-apps/api/core");
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
  );
}
