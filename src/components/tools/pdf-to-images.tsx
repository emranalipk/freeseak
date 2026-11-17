"use client";

/**
 * PDF → Images — every selected page becomes a PNG or JPG.
 * pdf.js rasterises the pages on the visitor's device (rule 5); the scale
 * slider trades file size against sharpness (2× ≈ 144 DPI print-safe).
 */

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  parsePageRange,
  pdfErrorMessage,
} from "./pdf-utils";
import {
  canvasToBlob,
  destroyPdfJsDoc,
  openWithPdfJs,
  renderPdfPage,
} from "./pdf-render";

type Fmt = "image/png" | "image/jpeg";

const FORMAT_OPTIONS: { value: Fmt; label: string }[] = [
  { value: "image/png", label: "PNG — lossless, sharp text" },
  { value: "image/jpeg", label: "JPG — smaller, photos" },
];

const SCALES = [
  { value: "1", label: "72 DPI — screen" },
  { value: "1.5", label: "108 DPI — sharp screen" },
  { value: "2", label: "144 DPI — print-safe" },
  { value: "3", label: "216 DPI — near-print" },
  { value: "4.1667", label: "300 DPI — true print quality" },
];

export function PdfToImages() {
  const { state, load, reset } = useSinglePdf();
  const [range, setRange] = useState("");
  const [scale, setScale] = useState("2");
  const [format, setFormat] = useState<Fmt>("image/png");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [results, setResults] = useState<OutputFile[]>([]);

  const pdf = state.status === "ready" ? state.pdf : null;
  const parsed = pdf ? parsePageRange(range, pdf.pageCount) : null;
  const canRun =
    pdf !== null && parsed !== null && parsed.valid && parsed.pages.length > 0;

  /* preview object URLs of the previous run — revoked when a new run or a
     reset replaces them, so a 500-page re-run never leaks thumbnails */
  const previewsRef = useRef<string[]>([]);
  const revokePreviews = () => {
    previewsRef.current.forEach((url) => URL.revokeObjectURL(url));
    previewsRef.current = [];
  };

  const run = async () => {
    if (!pdf || !parsed || !canRun) return;
    setBusy(true);
    setResults([]);
    revokePreviews();
    const pages =
      parsed.pages.length > 0 ? parsed.pages : Array.from({ length: pdf.pageCount }, (_, i) => i);
    setProgress({ done: 0, total: pages.length });
    try {
      /* pdf.js needs its own copy — pdf-lib owns the File's bytes */
      const bytes = new Uint8Array(await pdf.file.arrayBuffer());
      const doc = await openWithPdfJs(bytes);
      const ext = format === "image/png" ? "png" : "jpg";
      const base = pdf.file.name.replace(/\.pdf$/i, "");
      /* pad page numbers to the document's real digit count so file
         managers sort them in order (page-100 after page-99, not page-20) */
      const pad = String(pdf.pageCount).length;
      const files: OutputFile[] = [];
      for (let i = 0; i < pages.length; i++) {
        const pageIndex = pages[i];
        const rendered = await renderPdfPage(doc, pageIndex + 1, parseFloat(scale));
        const blob = await canvasToBlob(rendered.canvas, format, 0.92);
        rendered.canvas.width = 0;
        rendered.canvas.height = 0;
        files.push({
          blob,
          name: `${base}-page-${String(pageIndex + 1).padStart(pad, "0")}.${ext}`,
          previewUrl: URL.createObjectURL(blob),
          note: `${rendered.width} × ${rendered.height} px`,
        });
        setProgress({ done: i + 1, total: pages.length });
        /* keep the UI responsive between pages */
        await new Promise((r) => setTimeout(r, 0));
      }
      await destroyPdfJsDoc(doc);
      previewsRef.current = files.map((f) => f.previewUrl as string);
      setResults(files);
      toast.success(`${files.length} image${files.length > 1 ? "s" : ""} created`, {
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
            <PageRangeInput
              id="pti-range"
              value={range}
              onChange={setRange}
              pageCount={pdf.pageCount}
              label="Pages to convert"
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="pti-scale">Image quality</Label>
                <Select value={scale} onValueChange={setScale}>
                  <SelectTrigger id="pti-scale" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SCALES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="pti-format">Format</Label>
                <Select value={format} onValueChange={(v) => setFormat(v as Fmt)}>
                  <SelectTrigger id="pti-format" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FORMAT_OPTIONS.map((f) => (
                      <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <p className="text-[12px] leading-relaxed text-muted-foreground">
              Each page is rasterised into a standalone image at the DPI you
              pick. 144 DPI is sharp enough for printing and most uses; 300 DPI
              is true print quality for fine detail. Very large pages are kept
              inside the browser-safe canvas automatically. Multiple images
              download together as a single .zip.
            </p>
          </div>

          {busy && (
            <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }}
                />
              </div>
              <span className="shrink-0 text-[12px] font-semibold text-muted-foreground">
                {progress.done}/{progress.total}
              </span>
            </div>
          )}

          <ActionRow
            busy={busy}
            disabled={!canRun}
            onRun={run}
            onClear={() => {
              reset();
              setRange("");
              revokePreviews();
              setResults([]);
            }}
            clearDisabled={false}
          >
            Convert to images
          </ActionRow>
        </>
      )}

      <ResultsPanel
        files={results}
        zipName={`freeseak-${pdf ? pdf.file.name.replace(/\.pdf$/i, "") : "pdf"}-images.zip`}
      />
    </div>
  );
}
