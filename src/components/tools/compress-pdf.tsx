"use client";

/**
 * Compress PDF — two honest modes:
 *  - Safe: re-saves the document with object streams. Text stays text,
 *    quality untouched; savings are usually modest.
 *  - Strong: rasterises every page to a JPEG at the chosen DPI and
 *    rebuilds the PDF — big savings, but text becomes images.
 * Whatever the outcome, the numbers are shown before/after, and if the
 * "compressed" file would be BIGGER, the original is handed back with a
 * note instead (the image tools' never-worse philosophy).
 */

import { useState } from "react";
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
  PdfDropZone,
  PdfQueueList,
  ResultsPanel,
  usePdfQueue,
  type OutputFile,
} from "./pdf-shared";
import {
  formatBytes,
  loadPdf,
  loadPdfLib,
  pdfErrorMessage,
  savePdf,
} from "./pdf-utils";
import { canvasToBlob, openWithPdfJs, renderPdfPage } from "./pdf-render";

type Mode = "safe" | "strong";

const MODES: { value: Mode; label: string }[] = [
  { value: "safe", label: "Safe — keep text as text" },
  { value: "strong", label: "Strong — rasterise pages" },
];

const DPIS = [
  { value: "96", label: "96 DPI — screen quality" },
  { value: "120", label: "120 DPI — balanced" },
  { value: "150", label: "150 DPI — near-print" },
];

export function CompressPdf() {
  const { items, addFiles, remove, move, clear } = usePdfQueue();
  const [mode, setMode] = useState<Mode>("safe");
  const [dpi, setDpi] = useState("120");
  const [quality, setQuality] = useState(75);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ label: "", done: 0, total: 0 });
  const [results, setResults] = useState<OutputFile[]>([]);

  const ready = items.filter((i) => i.status === "ready");
  const blocked = items.some((i) => i.status === "error");

  const run = async () => {
    if (ready.length === 0) return;
    setBusy(true);
    setResults([]);
    setProgress({ label: ready[0].file.name, done: 0, total: ready.length });
    const outFiles: OutputFile[] = [];

    try {
      for (let f = 0; f < ready.length; f++) {
        const item = ready[f];
        setProgress({ label: item.file.name, done: f, total: ready.length });
        const base = item.file.name.replace(/\.pdf$/i, "");

        if (mode === "safe") {
          const source = await loadPdf(item.file);
          const blob = await savePdf(source.doc);
          if (blob.size < item.file.size) {
            const pct = Math.round((1 - blob.size / item.file.size) * 100);
            outFiles.push({
              blob,
              name: `${base}-compressed.pdf`,
              note: `${formatBytes(item.file.size)} → ${formatBytes(blob.size)} · ${pct}% smaller · text stays text`,
            });
          } else {
            outFiles.push({
              blob: item.file,
              name: item.file.name,
              note: `Already well optimized — re-saving wouldn't shrink it (${formatBytes(blob.size)} vs ${formatBytes(item.file.size)}), so the original is kept untouched.`,
            });
          }
        } else {
          const bytes = new Uint8Array(await item.file.arrayBuffer());
          const doc = await openWithPdfJs(bytes);
          const pageCount = (item.pageCount ?? doc.numPages) || doc.numPages;
          const scale = parseInt(dpi, 10) / 72;
          const { PDFDocument } = await loadPdfLib();
          const out = await PDFDocument.create();
          for (let p = 1; p <= pageCount; p++) {
            const rendered = await renderPdfPage(doc, p, scale);
            const jpeg = await canvasToBlob(rendered.canvas, "image/jpeg", quality / 100);
            const jpg = await out.embedJpg(new Uint8Array(await jpeg.arrayBuffer()));
            /* px → pt keeps the exact original page size */
            const page = out.addPage([
              (jpg.width * 72) / parseInt(dpi, 10),
              (jpg.height * 72) / parseInt(dpi, 10),
            ]);
            page.drawImage(jpg, {
              x: 0,
              y: 0,
              width: page.getWidth(),
              height: page.getHeight(),
            });
            setProgress({ label: item.file.name, done: f, total: ready.length });
            await new Promise((r) => setTimeout(r, 0));
          }
          await doc.cleanup();
          const blob = await savePdf(out);
          if (blob.size < item.file.size) {
            const pct = Math.round((1 - blob.size / item.file.size) * 100);
            outFiles.push({
              blob,
              name: `${base}-compressed.pdf`,
              note: `${formatBytes(item.file.size)} → ${formatBytes(blob.size)} · ${pct}% smaller · pages are now images (text not selectable)`,
            });
          } else {
            outFiles.push({
              blob: item.file,
              name: item.file.name,
              note: `Strong mode couldn't beat the original (${formatBytes(blob.size)} vs ${formatBytes(item.file.size)}) — the untouched original is kept.`,
            });
          }
        }
      }

      setResults(outFiles);
      const improved = outFiles.filter(
        (o, i) => o.blob !== ready[i]?.file && o.name.endsWith("-compressed.pdf"),
      ).length;
      if (improved > 0) {
        toast.success(`Compressed ${improved} file${improved > 1 ? "s" : ""}`, {
          description: "Processed on your device — nothing was uploaded.",
        });
      } else {
        toast.info("Nothing to shrink", {
          description: "Your PDFs are already about as small as they get.",
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
      <PdfDropZone onFiles={addFiles} compact={items.length > 0} />

      {items.length > 0 && (
        <>
          <PdfQueueList items={items} onRemove={remove} onMove={move} />

          <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cp-mode">Compression mode</Label>
              <Select value={mode} onValueChange={(v) => setMode(v as Mode)}>
                <SelectTrigger id="cp-mode" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MODES.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {mode === "strong" && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="cp-dpi">Page resolution</Label>
                  <Select value={dpi} onValueChange={setDpi}>
                    <SelectTrigger id="cp-dpi" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DPIS.map((d) => (
                        <SelectItem key={d.value} value={d.value}>
                          {d.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="cp-quality">JPEG quality</Label>
                    <span className="font-display text-[13px] font-bold text-foreground">
                      {quality}
                    </span>
                  </div>
                  <input
                    id="cp-quality"
                    type="range"
                    min={40}
                    max={95}
                    step={1}
                    value={quality}
                    onChange={(e) => setQuality(parseInt(e.target.value, 10))}
                    className="h-2 w-full cursor-pointer accent-primary"
                  />
                </div>
              </div>
            )}

            <p className="text-[12px] leading-relaxed text-muted-foreground">
              {mode === "safe"
                ? "Safe mode re-packs the file internally — text stays selectable and quality is untouched. Savings depend on how the PDF was made; already-optimized files come back untouched."
                : "Strong mode rebuilds every page as an image — usually 40–80% smaller, but text stops being selectable and quality follows the settings above. Perfect for sharing by email or chat; avoid it when text search matters."}
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
              <span className="max-w-[45%] truncate text-[12px] font-semibold text-muted-foreground">
                {progress.label}
              </span>
            </div>
          )}

          <ActionRow
            busy={busy}
            disabled={ready.length === 0 || blocked}
            onRun={run}
            onClear={() => {
              clear();
              setResults([]);
            }}
            clearDisabled={items.length === 0}
          >
            Compress {ready.length > 0 ? `${ready.length} PDF${ready.length > 1 ? "s" : ""}` : "PDFs"}
          </ActionRow>
        </>
      )}

      <ResultsPanel files={results} zipName="compressed-pdfs.zip" />
    </div>
  );
}
