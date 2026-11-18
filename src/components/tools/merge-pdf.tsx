"use client";

/**
 * Merge PDF — combine multiple PDFs into one, in the order shown.
 * Each file can contribute all pages or a selected range; the picked pages
 * are stacked sequentially or woven together one page at a time (interleaved
 * — handy for rejoining an odd-pages scan with an even-pages scan).
 * pdf-lib copies the pages across inside the browser (rule 5).
 */

import { useState } from "react";
import { toast } from "sonner";
import type { PDFPage } from "pdf-lib";
import {
  ActionRow,
  PdfDropZone,
  PdfQueueList,
  ResultsPanel,
  usePdfQueue,
  type OutputFile,
} from "./pdf-shared";
import {
  describeIndices,
  loadPdf,
  loadPdfLib,
  parsePageRange,
  pdfErrorMessage,
  savePdf,
} from "./pdf-utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type MergeMode = "sequential" | "interleaved";

export function MergePdf() {
  const { items, addFiles, remove, move, clear } = usePdfQueue();
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<OutputFile[]>([]);
  const [mode, setMode] = useState<MergeMode>("sequential");
  const [ranges, setRanges] = useState<Record<number, string>>({});
  const ready = items.filter((i) => i.status === "ready");
  const blocked = items.some((i) => i.status === "error");

  /* every ready file must carry a valid range (or none = all pages) */
  const rangeProblem = ready.find((item) => {
    const parsed = parsePageRange(ranges[item.id] ?? "", item.pageCount ?? 0);
    return !parsed.valid;
  });

  const run = async () => {
    if (ready.length < 2 || rangeProblem) return;
    setBusy(true);
    setResults([]);
    try {
      const { PDFDocument } = await loadPdfLib();
      const out = await PDFDocument.create();

      /* load each file once and copy its picked pages (empty range = all) */
      const docs: { copied: PDFPage[]; count: number }[] = [];
      let totalPages = 0;
      for (const item of ready) {
        const pdf = await loadPdf(item.file);
        const parsed = parsePageRange(ranges[item.id] ?? "", pdf.pageCount);
        const indices =
          parsed.pages.length > 0 ? parsed.pages : pdf.doc.getPageIndices();
        const copied = await out.copyPages(pdf.doc, indices);
        docs.push({ copied, count: indices.length });
        totalPages += indices.length;
      }

      if (mode === "sequential") {
        for (const d of docs) d.copied.forEach((page) => out.addPage(page));
      } else {
        /* interleaved: one page from each file in turn; longer files keep
           contributing after the shorter ones run out */
        const cursors = docs.map(() => 0);
        let left = totalPages;
        while (left > 0) {
          for (let i = 0; i < docs.length; i++) {
            if (cursors[i] < docs[i].count) {
              out.addPage(docs[i].copied[cursors[i]]);
              cursors[i]++;
              left--;
            }
          }
        }
      }

      const blob = await savePdf(out);
      const base = ready[0].file.name.replace(/\.pdf$/i, "");
      setResults([
        {
          blob,
          name: `${base}-merged.pdf`,
          note: `${ready.length} documents · ${totalPages} pages in total${
            mode === "interleaved" ? " · interleaved" : ""
          }`,
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

  /* per-file pages box, shown under each ready row */
  const detail = (item: (typeof ready)[number]) => {
    if (item.status !== "ready" || !item.pageCount) return null;
    const parsed = parsePageRange(ranges[item.id] ?? "", item.pageCount);
    return (
      <div className="mt-2 border-t border-border/60 pt-2">
        <Input
          id={`merge-range-${item.id}`}
          value={ranges[item.id] ?? ""}
          onChange={(e) =>
            setRanges((prev) => ({ ...prev, [item.id]: e.target.value }))
          }
          placeholder={`All ${item.pageCount} pages — or e.g. 1-3, 5`}
          className="h-8 text-[12.5px]"
          autoComplete="off"
          aria-label={`Pages to take from ${item.file.name}`}
        />
        <p
          className={`mt-1 text-[11.5px] leading-relaxed ${
            parsed.valid ? "text-muted-foreground" : "text-destructive"
          }`}
          aria-live="polite"
        >
          {!parsed.valid
            ? `Check ${parsed.invalidTokens.join(", ")} — use single pages (7) and ranges (1-3).`
            : parsed.pages.length === 0
              ? `All ${item.pageCount} pages.`
              : `${parsed.pages.length} page${parsed.pages.length > 1 ? "s" : ""}: ${describeIndices(parsed.pages)}`}
        </p>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <PdfDropZone onFiles={addFiles} compact={items.length > 0} />

      {items.length > 0 && (
        <>
          <PdfQueueList
            items={items}
            onRemove={remove}
            onMove={move}
            detail={detail}
          />

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="merge-mode">Page order</Label>
            <Select
              value={mode}
              onValueChange={(v) => setMode(v as MergeMode)}
            >
              <SelectTrigger id="merge-mode" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sequential">
                  Sequential — each file after the previous one
                </SelectItem>
                <SelectItem value="interleaved">
                  Interleaved — one page from each file in turn
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <p className="text-[12px] leading-relaxed text-muted-foreground">
            Files merge from top to bottom — use the arrows to set the order.
            Each file&apos;s pages box takes single pages and ranges like
            1-3, 5; leave it empty for the whole file. Interleaved weaves the
            picked pages together — point it at an odd-pages scan and an
            even-pages scan to rebuild one document; longer files keep
            contributing at the end.
            {blocked && " Remove the file marked in red before merging."}
          </p>

          {rangeProblem && (
            <p className="text-[12.5px] font-medium text-destructive">
              Check the pages box for “{rangeProblem.file.name}” — some entries
              don&apos;t match that file.
            </p>
          )}

          <ActionRow
            busy={busy}
            disabled={ready.length < 2 || blocked || !!rangeProblem}
            onRun={run}
            onClear={() => {
              clear();
              setResults([]);
              setRanges({});
            }}
            clearDisabled={items.length === 0}
          >
            Merge {ready.length >= 2 ? `${ready.length} PDFs` : "PDFs"}
          </ActionRow>
        </>
      )}

      <ResultsPanel files={results} zipName="freeseak-merged-pdfs.zip" />
    </div>
  );
}
