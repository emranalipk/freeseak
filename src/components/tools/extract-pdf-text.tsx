"use client";

/**
 * Extract Text — pull the text layer out of any PDF into plain .txt.
 * pdf.js reads the characters on the visitor's device; scanned PDFs
 * (images without a text layer) get the on-device OCR rescue path
 * instead of a dead end.
 */

import { useState } from "react";
import { Copy, ScanText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import {
  destroyPdfJsDoc,
  extractPageText,
  openWithPdfJs,
  renderPdfPage,
} from "./pdf-render";
import { ocrCanvas } from "./ocr-engine";

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
  const [ocrBusy, setOcrBusy] = useState<{ done: number; total: number } | null>(null);

  const pdf = state.status === "ready" ? state.pdf : null;
  const parsed = pdf ? parsePageRange(range, pdf.pageCount) : null;
  /* an empty range means every page — that is what the placeholder promises */
  const canRun = pdf !== null && parsed !== null && parsed.valid;
  const selectedPages =
    pdf && parsed && parsed.pages.length > 0 ? parsed.pages : pdf ? Array.from({ length: pdf.pageCount }, (_, i) => i) : [];

  const run = async () => {
    if (!pdf || !parsed || !canRun) return;
    setBusy(true);
    setExtraction(null);
    setResults([]);
    setProgress({ done: 0, total: selectedPages.length });
    try {
      const bytes = new Uint8Array(await pdf.file.arrayBuffer());
      const doc = await openWithPdfJs(bytes);
      const chunks: string[] = [];
      for (let i = 0; i < selectedPages.length; i++) {
        const pageText = await extractPageText(doc, selectedPages[i] + 1);
        chunks.push(pageText.trim());
        setProgress({ done: i + 1, total: selectedPages.length });
        await new Promise((r) => setTimeout(r, 0));
      }
      await destroyPdfJsDoc(doc);

      /* form-feed page breaks (the pdftotext convention) so page
         boundaries stay visible in the deliverable */
      const text = chunks.join("\n\f\n");
      const words = text.split(/\s+/).filter(Boolean).length;

      if (text.trim().length === 0) {
        setExtraction({ text: "", pages: selectedPages.length, words: 0, chars: 0 });
        toast.info("No text layer — this looks like a scan", {
          description: "Pages made of images have no characters to extract. Run OCR below to read printed English text on your device.",
        });
      } else {
        setExtraction({
          text,
          pages: parsed.pages.length,
          words,
          chars: text.length,
        });
        const base = pdf.file.name.replace(/\.pdf$/i, "");
        const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
        setResults([
          {
            blob,
            name: `${base}-text.txt`,
            note: "Plain text, UTF-8 · pages separated by form-feed breaks",
          },
        ]);
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

  /**
   * The scan rescue path: OCR the selected pages locally (Tesseract.js,
   * assets served from /ocr — never a CDN) and hand back plain text.
   */
  const runOcr = async () => {
    if (!pdf || !parsed || !parsed.valid || ocrBusy) return;
    setOcrBusy({ done: 0, total: selectedPages.length });
    setExtraction(null);
    setResults([]);
    try {
      const bytes = new Uint8Array(await pdf.file.arrayBuffer());
      const doc = await openWithPdfJs(bytes);
      const chunks: string[] = [];
      let emptyPages = 0;
      for (let i = 0; i < selectedPages.length; i++) {
        const rendered = await renderPdfPage(doc, selectedPages[i] + 1, 2);
        const result = await ocrCanvas(rendered.canvas);
        if (result.text.length > 0) {
          chunks.push(result.text);
        } else {
          emptyPages += 1;
        }
        setOcrBusy({ done: i + 1, total: selectedPages.length });
      }
      await destroyPdfJsDoc(doc);
      /* only real recognised text ships — empty pages are reported in the
         note, never injected into the .txt as placeholder lines */
      const text = chunks.join("\n\f\n");
      const words = text.split(/\s+/).filter(Boolean).length;
      setExtraction({ text, pages: selectedPages.length, words, chars: text.length });
      const base = pdf.file.name.replace(/\.pdf$/i, "");
      const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
      setResults([
        {
          blob,
          name: `${base}-ocr.txt`,
          note:
            "Recognised by on-device OCR (English) · pages separated by form-feed breaks" +
            (emptyPages > 0
              ? ` · ${emptyPages} page${emptyPages === 1 ? "" : "s"} had no readable text`
              : ""),
        },
      ]);
      toast.success("OCR finished", {
        description: "Processed on your device — nothing was uploaded.",
      });
    } catch {
      toast.error("OCR failed — the recognition engine couldn't be loaded on this device.");
    } finally {
      setOcrBusy(null);
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
              browsers and most apps. Scanned documents get the OCR path below:
              recognition runs on your device, in English.
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
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1" aria-live="polite">
                <span className="text-[12.5px] text-muted-foreground">
                  <span className="font-bold text-foreground">{extraction.pages}</span>{" "}
                  page{extraction.pages === 1 ? "" : "s"} read
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
                {extraction.text.length > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="ml-auto gap-1.5"
                    onClick={() => {
                      void navigator.clipboard.writeText(extraction.text);
                      toast.success("All extracted text copied to the clipboard.");
                    }}
                  >
                    <Copy className="size-3.5" aria-hidden="true" />
                    Copy all
                  </Button>
                )}
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
                <div className="flex flex-col gap-2.5 rounded-xl border border-border bg-secondary/40 p-3">
                  <p className="text-[12.5px] leading-relaxed text-muted-foreground">
                    No text layer found — this PDF is most likely a scan: its pages are images, so there are no
                    characters to extract.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="self-start"
                    disabled={busy || ocrBusy !== null}
                    onClick={() => void runOcr()}
                  >
                    <ScanText className="size-3.5" aria-hidden="true" />
                    Run OCR instead (English, on-device)
                  </Button>
                  {ocrBusy && (
                    <p className="text-[11.5px] text-muted-foreground">
                      {ocrBusy.done === 0
                        ? "Loading the recognition engine (first run only, ~15 MB)…"
                        : `Reading pages… ${ocrBusy.done}/${ocrBusy.total}`}
                    </p>
                  )}
                </div>
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
              setOcrBusy(null);
            }}
            clearDisabled={false}
          >
            Extract text
          </ActionRow>
        </>
      )}

      <ResultsPanel files={results} zipName="freeseak-extracted-text.zip" />
    </div>
  );
}
