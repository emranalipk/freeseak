"use client";

/**
 * Split PDF — two modes over the same page-range grammar:
 *  - "Extract": the selected pages become ONE new PDF (re-orderable picks)
 *  - "Separate files": every range (or every single page) becomes its own
 *    PDF, bundled into a .zip when there is more than one.
 */

import { useState } from "react";
import { Scissors, SquareStack } from "lucide-react";
import { toast } from "sonner";
import {
  ActionRow,
  LoadedPdfCard,
  PageRangeInput,
  PdfDropZone,
  ResultsPanel,
  useSinglePdf,
  type OutputFile,
} from "./pdf-shared";
import {
  loadPdf,
  loadPdfLib,
  parsePageRange,
  pdfErrorMessage,
  savePdf,
} from "./pdf-utils";

type Mode = "extract" | "separate";

const MODES: { value: Mode; label: string; icon: typeof Scissors }[] = [
  { value: "extract", label: "Extract to one PDF", icon: SquareStack },
  { value: "separate", label: "Separate files", icon: Scissors },
];

function baseName(file: File): string {
  return file.name.replace(/\.pdf$/i, "");
}

export function SplitPdf() {
  const { state, load, reset } = useSinglePdf();
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<Mode>("extract");
  const [range, setRange] = useState("");
  const [results, setResults] = useState<OutputFile[]>([]);

  const pdf = state.status === "ready" ? state.pdf : null;
  const parsed = pdf ? parsePageRange(range, pdf.pageCount) : null;
  const canRun =
    pdf !== null &&
    parsed !== null &&
    parsed.valid &&
    (mode === "separate" || parsed.pages.length > 0);

  const run = async () => {
    if (!pdf || !parsed || !canRun) return;
    setBusy(true);
    setResults([]);
    try {
      const { PDFDocument } = await loadPdfLib();
      const source = await loadPdf(pdf.file);
      const base = baseName(pdf.file);

      if (mode === "extract") {
        const out = await PDFDocument.create();
        const copied = await out.copyPages(source.doc, parsed.pages);
        copied.forEach((page) => out.addPage(page));
        const blob = await savePdf(out);
        setResults([
          {
            blob,
            name: `${base}-extract.pdf`,
            note: `${parsed.pages.length} page${parsed.pages.length > 1 ? "s" : ""} extracted`,
          },
        ]);
      } else {
        /* every comma token becomes its own file — "1-3, 5" → 2 PDFs.
           Empty input = every page gets its own file. */
        const tokens = range
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean);
        const effective =
          tokens.length > 0
            ? tokens
            : Array.from({ length: pdf.pageCount }, (_, i) => `${i + 1}`);
        const files: OutputFile[] = [];
        for (const token of effective) {
          const tokenPages = parsePageRange(token, pdf.pageCount).pages;
          if (tokenPages.length === 0) continue;
          const out = await PDFDocument.create();
          const copied = await out.copyPages(source.doc, tokenPages);
          copied.forEach((page) => out.addPage(page));
          const label =
            tokenPages.length === 1
              ? `page-${tokenPages[0] + 1}`
              : `pages-${token.replace(/\s+/g, "")}`;
          files.push({
            blob: await savePdf(out),
            name: `${base}-${label}.pdf`,
          });
        }
        setResults(files);
      }
      toast.success(
        mode === "extract" ? "Pages extracted" : "PDF split",
        { description: "Processed on your device — nothing was uploaded." },
      );
    } catch (err) {
      toast.error(pdfErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {!pdf && state.status !== "loading" && (
        <PdfDropZone
          onFiles={(files) => {
            const first = files.find((f) => f.type === "application/pdf" || /\.pdf$/i.test(f.name));
            if (first) void load(first);
          }}
        />
      )}

      {state.status === "loading" && (
        <p className="text-center text-[13px] text-muted-foreground">
          Reading {state.name}…
        </p>
      )}

      {state.status === "error" && (
        <div className="flex flex-col gap-3 rounded-xl border border-destructive/40 bg-destructive/5 p-4">
          <p className="text-[13px] font-semibold text-destructive">
            {state.name}: {state.error}
          </p>
          <PdfDropZone onFiles={(files) => files[0] && void load(files[0])} compact />
        </div>
      )}

      {pdf && (
        <>
          <LoadedPdfCard pdf={pdf} onRemove={reset} />

          <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5">
            <div
              className="grid grid-cols-2 gap-1.5 rounded-xl bg-secondary p-1.5"
              role="tablist"
              aria-label="Split mode"
            >
              {MODES.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  role="tab"
                  aria-selected={mode === m.value}
                  onClick={() => setMode(m.value)}
                  className={`flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-[12.5px] font-bold transition-colors ${
                    mode === m.value
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <m.icon className="size-4" aria-hidden="true" />
                  {m.label}
                </button>
              ))}
            </div>

            <PageRangeInput
              id="split-range"
              value={range}
              onChange={setRange}
              pageCount={pdf.pageCount}
              label={mode === "extract" ? "Pages to extract" : "Ranges (one file per range)"}
            />

            <p className="text-[12px] leading-relaxed text-muted-foreground">
              {mode === "extract"
                ? "The selected pages are pulled into a brand-new PDF, in ascending order — a page listed twice is kept once."
                : "Every range becomes its own PDF — 1-3, 5, 8-10 gives you three files. Leave the box empty to give every page its own file. Multiple results download as a single .zip."}
            </p>
          </div>

          <ActionRow
            busy={busy}
            disabled={!canRun}
            onRun={run}
            onClear={() => {
              reset();
              setRange("");
              setResults([]);
            }}
            clearDisabled={false}
          >
            {mode === "extract" ? "Extract pages" : "Split into files"}
          </ActionRow>
        </>
      )}

      <ResultsPanel files={results} zipName="freeseak-split-pages.zip" />
    </div>
  );
}
