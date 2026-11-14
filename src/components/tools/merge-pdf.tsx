"use client";

/**
 * Merge PDF — combine multiple PDFs into one, in the order shown.
 * pdf-lib copies the pages across inside the browser (rule 5).
 */

import { useState } from "react";
import { toast } from "sonner";
import {
  ActionRow,
  PdfDropZone,
  PdfQueueList,
  ResultsPanel,
  usePdfQueue,
  type OutputFile,
} from "./pdf-shared";
import { loadPdf, loadPdfLib, pdfErrorMessage, savePdf } from "./pdf-utils";

export function MergePdf() {
  const { items, addFiles, remove, move, clear } = usePdfQueue();
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<OutputFile[]>([]);
  const ready = items.filter((i) => i.status === "ready");
  const blocked = items.some((i) => i.status === "error");

  const run = async () => {
    if (ready.length < 2) return;
    setBusy(true);
    setResults([]);
    try {
      const { PDFDocument } = await loadPdfLib();
      const out = await PDFDocument.create();
      let totalPages = 0;
      for (const item of ready) {
        const pdf = await loadPdf(item.file);
        const copied = await out.copyPages(pdf.doc, pdf.doc.getPageIndices());
        copied.forEach((page) => out.addPage(page));
        totalPages += copied.length;
      }
      const blob = await savePdf(out);
      const base = ready[0].file.name.replace(/\.pdf$/i, "");
      setResults([
        {
          blob,
          name: `${base}-merged.pdf`,
          note: `${ready.length} documents · ${totalPages} pages in total`,
        },
      ]);
      toast.success("PDFs merged", {
        description: "Processed on your device — nothing was uploaded.",
      });
    } catch (err) {
      toast.error(pdfErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <PdfDropZone onFiles={addFiles} compact={items.length > 0} />

      {items.length > 0 && (
        <>
          <PdfQueueList items={items} onRemove={remove} onMove={move} />
          <p className="text-[12px] leading-relaxed text-muted-foreground">
            Files merge from top to bottom — use the arrows to set the order.
            {blocked && " Remove the file marked in red before merging."}
          </p>
          <ActionRow
            busy={busy}
            disabled={ready.length < 2 || blocked}
            onRun={run}
            onClear={() => {
              clear();
              setResults([]);
            }}
            clearDisabled={items.length === 0}
          >
            Merge {ready.length >= 2 ? `${ready.length} PDFs` : "PDFs"}
          </ActionRow>
        </>
      )}

      <ResultsPanel files={results} zipName="merged-pdfs.zip" />
    </div>
  );
}
