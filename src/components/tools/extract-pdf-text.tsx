"use client";

/**
 * Extract Text — pull the text layer out of any PDF into plain .txt.
 * pdf.js reads the characters on the visitor's device; scanned PDFs
 * (images without a text layer) get an honest message, not fake output.
 */

import { useState } from "react";
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
import { parsePageRange, pdfErrorMessage } from "./pdf-utils";
import { extractPageText, openWithPdfJs } from "./pdf-render";

interface Extraction {
  text: string;
  pages: number;
  words: number;
  chars: number;
}

export function ExtractPdfText() {
  const { state, load, reset } = useSinglePdf();
  const [range, setRange] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [extraction, setExtraction] = useState<Extraction | null>(null);
  const [results, setResults] = useState<OutputFile[]>([]);

  const pdf = state.status === "ready" ? state.pdf : null;
  const parsed = pdf ? parsePageRange(range, pdf.pageCount) : null;
  const canRun =
    pdf !== null && parsed !== null && parsed.valid && parsed.pages.length > 0;

  const run = async () => {
    if (!pdf || !parsed || !canRun) return;
    setBusy(true);
    setExtraction(null);
    setResults([]);
    setProgress({ done: 0, total: parsed.pages.length });
    try {
      const bytes = new Uint8Array(await pdf.file.arrayBuffer());
      const doc = await openWithPdfJs(bytes);
      const chunks: string[] = [];
      for (let i = 0; i < parsed.pages.length; i++) {
        const pageText = await extractPageText(doc, parsed.pages[i] + 1);
        chunks.push(pageText.trim());
        setProgress({ done: i + 1, total: parsed.pages.length });
        await new Promise((r) => setTimeout(r, 0));
      }
      await doc.cleanup();

      const text = chunks.join("\n\n");
      const words = text.split(/\s+/).filter(Boolean).length;

      if (text.trim().length === 0) {
        toast.info("No text found", {
          description:
            "This PDF has no text layer — it is most likely a scan (images of pages). Extracting text from scans needs OCR, which this tool doesn't do.",
        });
        setExtraction({ text: "", pages: parsed.pages.length, words: 0, chars: 0 });
      } else {
        setExtraction({
          text,
          pages: parsed.pages.length,
          words,
          chars: text.length,
        });
        const base = pdf.file.name.replace(/\.pdf$/i, "");
        const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
        setResults([{ blob, name: `${base}-text.txt`, note: "Plain text, UTF-8" }]);
        toast.success("Text extracted", {
          description: "Processed on your device — nothing was uploaded.",
        });
      }
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
            const first = files.find(
              (f) => f.type === "application/pdf" || /\.pdf$/i.test(f.name),
            );
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

          <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5">
            <PageRangeInput
              id="ett-range"
              value={range}
              onChange={setRange}
              pageCount={pdf.pageCount}
              label="Pages to read"
            />
            <p className="text-[12px] leading-relaxed text-muted-foreground">
              Works on PDFs with a real text layer — exports from Word, LaTeX,
              browsers and most apps. Scanned documents are images and need
              OCR (not supported here — honestly, rather than pretending).
            </p>
          </div>

          {busy && (
            <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{
                    width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%`,
                  }}
                />
              </div>
              <span className="shrink-0 text-[12px] font-semibold text-muted-foreground">
                {progress.done}/{progress.total}
              </span>
            </div>
          )}

          {extraction && (
            <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5">
              <div className="flex flex-wrap gap-x-5 gap-y-1">
                <span className="text-[12.5px] text-muted-foreground">
                  <span className="font-bold text-foreground">{extraction.pages}</span>{" "}
                  pages read
                </span>
                <span className="text-[12.5px] text-muted-foreground">
                  <span className="font-bold text-foreground">
                    {extraction.words.toLocaleString()}
                  </span>{" "}
                  words
                </span>
                <span className="text-[12.5px] text-muted-foreground">
                  <span className="font-bold text-foreground">
                    {extraction.chars.toLocaleString()}
                  </span>{" "}
                  characters
                </span>
              </div>
              {extraction.text.length > 0 ? (
                <textarea
                  readOnly
                  value={extraction.text.slice(0, 5000)}
                  rows={8}
                  aria-label="Extracted text preview"
                  className="w-full resize-y rounded-xl border border-border bg-secondary/40 p-3 font-mono text-[12px] leading-relaxed text-foreground"
                />
              ) : (
                <p className="rounded-xl border border-border bg-secondary/40 p-3 text-[12.5px] leading-relaxed text-muted-foreground">
                  No text layer found — this PDF is most likely a scan. The pages
                  are images, so there are no characters to extract.
                </p>
              )}
              {extraction.text.length > 5000 && (
                <p className="text-[11.5px] text-muted-foreground">
                  Preview shows the first 5,000 characters — the download
                  contains everything ({extraction.chars.toLocaleString()}).
                </p>
              )}
            </div>
          )}

          <ActionRow
            busy={busy}
            disabled={!canRun}
            onRun={run}
            onClear={() => {
              reset();
              setRange("");
              setExtraction(null);
              setResults([]);
            }}
            clearDisabled={false}
          >
            Extract text
          </ActionRow>
        </>
      )}

      <ResultsPanel files={results} zipName="extracted-text.zip" />
    </div>
  );
}
