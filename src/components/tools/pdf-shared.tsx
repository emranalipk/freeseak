"use client";

/**
 * FreeSeak — the shared UI pieces of the PDF tools.
 *
 * The dropzone, the loaded-file card, the live page-range input, the
 * results panel and the reorderable multi-file queue all live here, so
 * the ten tools below stay thin and consistent (and rule 1 stays true:
 * every export is used by at least two tools).
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  FileText,
  Loader2,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useHandoff } from "@/lib/file-handoff";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  describeIndices,
  downloadBlob,
  formatBytes,
  loadPdf,
  parsePageRange,
  pdfErrorMessage,
  zipAndDownload,
  type LoadedPdf,
} from "./pdf-utils";
import { brandFilename } from "./image-utils";

/* ------------------------------------------------------------------ */
/* dropzone                                                            */
/* ------------------------------------------------------------------ */

export function isPdfFile(file: File): boolean {
  return file.type === "application/pdf" || /\.pdf$/i.test(file.name);
}

/**
 * PDF variant of the image tools' drop surface: drag-and-drop,
 * click-to-browse and clipboard paste, filtering out non-PDFs.
 */
export function PdfDropZone({
  onFiles,
  compact = false,
}: {
  onFiles: (_files: File[]) => void;
  compact?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  /* v0.9.3: a PDF handed over from the homepage router opens here
     automatically — the visitor drops once, never twice */
  useHandoff((f) => {
    if (isPdfFile(f)) onFiles([f]);
  });

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const files = event.clipboardData?.files;
      if (files && files.length > 0) onFiles(Array.from(files));
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [onFiles]);

  const openPicker = useCallback(() => inputRef.current?.click(), []);

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Add PDFs"
      onClick={openPicker}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") openPicker();
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (e.dataTransfer.files.length > 0) onFiles(Array.from(e.dataTransfer.files));
      }}
      className={`flex cursor-pointer select-none flex-col items-center justify-center rounded-2xl border-[1.6px] border-dashed text-center transition-colors ${
        dragging
          ? "border-primary bg-secondary"
          : "border-border bg-card hover:border-primary/60 hover:bg-secondary/40"
      } ${compact ? "gap-1 px-4 py-4" : "gap-2 px-6 py-10"}`}
    >
      <div className="pointer-events-none flex flex-col items-center gap-1.5">
        <FileText
          className={compact ? "size-5 text-primary" : "size-8 text-primary"}
          aria-hidden="true"
        />
        <p className="font-display text-[13.5px] font-bold text-foreground">
          {compact ? "Add more PDFs" : "Drop PDFs here, or click to browse"}
        </p>
        {!compact && (
          <p className="text-[12px] leading-relaxed text-muted-foreground">
            You can also paste from the clipboard (Ctrl / Cmd + V) — PDF files only
          </p>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            onFiles(Array.from(e.target.files));
          }
          e.target.value = "";
        }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* one-PDF-at-a-time tools                                             */
/* ------------------------------------------------------------------ */

export type SinglePdfState =
  | { status: "empty" }
  | { status: "loading"; name: string }
  | { status: "ready"; pdf: LoadedPdf }
  | { status: "error"; name: string; error: string };

/** load one PDF and expose its page count — with honest error states */
export function useSinglePdf() {
  const [state, setState] = useState<SinglePdfState>({ status: "empty" });

  const load = useCallback(async (file: File) => {
    setState({ status: "loading", name: file.name });
    try {
      const pdf = await loadPdf(file);
      setState({ status: "ready", pdf });
    } catch (err) {
      setState({ status: "error", name: file.name, error: pdfErrorMessage(err) });
    }
  }, []);

  const reset = useCallback(() => setState({ status: "empty" }), []);

  return { state, load, reset };
}

/** the card that shows the loaded PDF (name · pages · size · remove) */
export function LoadedPdfCard({
  pdf,
  onRemove,
}: {
  pdf: LoadedPdf;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-border bg-secondary">
        <FileText className="size-5 text-primary" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-semibold text-foreground">
          {pdf.file.name}
        </p>
        <p className="text-[12px] text-muted-foreground">
          {pdf.pageCount} page{pdf.pageCount > 1 ? "s" : ""} ·{" "}
          {formatBytes(pdf.file.size)} · {Math.round(pdf.width)} ×{" "}
          {Math.round(pdf.height)} pt
        </p>
      </div>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${pdf.file.name}`}
        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* page range input                                                    */
/* ------------------------------------------------------------------ */

/** text input + live "3 pages selected: 1–3, 5" feedback */
export function PageRangeInput({
  id,
  value,
  onChange,
  pageCount,
  label = "Pages",
}: {
  id: string;
  value: string;
  onChange: (_value: string) => void;
  pageCount: number;
  label?: string;
}) {
  const parsed = parsePageRange(value, pageCount);
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={`e.g. 1-3, 5 — leave empty for all ${pageCount} pages`}
        autoComplete="off"
        aria-describedby={`${id}-feedback`}
      />
      <p
        id={`${id}-feedback`}
        aria-live="polite"
        className={`text-[12px] leading-relaxed ${
          parsed.valid ? "text-muted-foreground" : "text-destructive"
        }`}
      >
        {!parsed.valid
          ? `Check ${parsed.invalidTokens.join(", ")} — use single pages (7) and ranges (1-3).`
          : parsed.pages.length === 0
            ? `All ${pageCount} page${pageCount > 1 ? "s" : ""} selected.`
            : `${parsed.pages.length} page${parsed.pages.length > 1 ? "s" : ""} selected: ${describeIndices(parsed.pages)}`}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* results                                                             */
/* ------------------------------------------------------------------ */

export interface OutputFile {
  blob: Blob;
  name: string;
  note?: string;
  /** image outputs (PDF→Images) show a thumbnail instead of the file icon */
  previewUrl?: string;
}

/** finished files: per-item download + one .zip for everything at once */
export function ResultsPanel({
  files,
  zipName = "freeseak-output.zip",
  intro,
}: {
  files: OutputFile[];
  zipName?: string;
  intro?: string;
}) {
  const [zipping, setZipping] = useState(false);
  if (files.length === 0) return null;

  const total = files.reduce((sum, f) => sum + f.blob.size, 0);

  const downloadAll = async () => {
    if (files.length === 1) {
      downloadBlob(files[0].blob, files[0].name);
      return;
    }
    setZipping(true);
    try {
      /* store:true — PDFs/JPEGs are already compressed; bundling is
         container work, and DEFLATE over them is just slow */
      await zipAndDownload(files, zipName, { store: true });
    } catch {
      toast.error("Couldn't build the zip file — download the files one by one.");
    } finally {
      setZipping(false);
    }
  };

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div>
          <h3 className="font-display text-[15px] font-bold text-foreground">
            Results
          </h3>
          <p className="mt-0.5 text-[12.5px] text-muted-foreground">
            {files.length} file{files.length > 1 ? "s" : ""} · {formatBytes(total)}
            {intro ? ` · ${intro}` : ""}
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={downloadAll}>
          {zipping ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <Download className="size-3.5" aria-hidden="true" />
          )}
          {files.length > 1 ? "Download all (.zip)" : "Download"}
        </Button>
      </div>

      <ul className="flex flex-col gap-2">
        {files.map((f, index) => (
          <li
            key={`${f.name}-${index}`}
            className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5"
          >
            {f.previewUrl ? (
              <img
                src={f.previewUrl}
                alt=""
                className="size-11 shrink-0 rounded-lg border border-border object-cover"
              />
            ) : (
              <span className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-border bg-secondary">
                <FileText className="size-5 text-primary" aria-hidden="true" />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold text-foreground">
                {brandFilename(f.name)}
              </p>
              <p className="text-[12px] text-muted-foreground">
                {formatBytes(f.blob.size)}
              </p>
              {f.note && (
                <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted-foreground">
                  {f.note}
                </p>
              )}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => downloadBlob(f.blob, f.name)}
            >
              <Download className="size-3.5" aria-hidden="true" />
              Download
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* multi-file queue (Merge PDF, Compress PDF)                          */
/* ------------------------------------------------------------------ */

export interface QueueItem {
  id: number;
  file: File;
  pageCount: number | null;
  status: "loading" | "ready" | "error";
  error?: string;
}

/**
 * Reorderable queue of PDFs: files are validated and page-counted the
 * moment they arrive, so broken or password-protected PDFs surface
 * immediately instead of failing mid-job.
 */
export function usePdfQueue() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const idRef = useRef(0);

  const addFiles = useCallback((incoming: File[]) => {
    const pdfs = incoming.filter(isPdfFile);
    const skipped = incoming.length - pdfs.length;
    if (skipped > 0) {
      toast.error(
        `${skipped} file${skipped > 1 ? "s were" : " was"} skipped — not a PDF.`,
      );
    }
    if (pdfs.length === 0) return;
    const startId = idRef.current;
    idRef.current += pdfs.length;
    setItems((prev) => [
      ...prev,
      ...pdfs.map((file, i) => ({
        id: startId + i,
        file,
        pageCount: null,
        status: "loading" as const,
      })),
    ]);
    pdfs.forEach((file, i) => {
      void loadPdf(file).then(
        (pdf) =>
          setItems((prev) =>
            prev.map((it) =>
              it.id === startId + i
                ? { ...it, pageCount: pdf.pageCount, status: "ready" as const }
                : it,
            ),
          ),
        (err) =>
          setItems((prev) =>
            prev.map((it) =>
              it.id === startId + i
                ? { ...it, status: "error" as const, error: pdfErrorMessage(err) }
                : it,
            ),
          ),
      );
    });
  }, []);

  const remove = useCallback((id: number) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  }, []);

  const move = useCallback((id: number, dir: -1 | 1) => {
    setItems((prev) => {
      const index = prev.findIndex((it) => it.id === id);
      const target = index + dir;
      if (index < 0 || target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }, []);

  const clear = useCallback(() => setItems([]), []);

  return { items, addFiles, remove, move, clear };
}

/** queue rows with reorder arrows — order = processing order */
export function PdfQueueList({
  items,
  onRemove,
  onMove,
  detail,
}: {
  items: QueueItem[];
  onRemove: (_id: number) => void;
  onMove: (_id: number, _dir: -1 | 1) => void;
  /** optional per-row content rendered under the status line (merge: page ranges) */
  detail?: (_item: QueueItem) => ReactNode;
}) {
  return (
    <ul className="flex flex-col gap-2">
      {items.map((item, index) => (
        <li
          key={item.id}
          className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-secondary text-[11.5px] font-bold text-muted-foreground">
            {index + 1}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold text-foreground">
              {item.file.name}
            </p>
            <p
              className={`text-[12px] leading-relaxed ${
                item.status === "error" ? "text-destructive" : "text-muted-foreground"
              }`}
            >
              {item.status === "error"
                ? item.error
                : item.status === "loading"
                  ? "Reading…"
                  : `${item.pageCount} page${item.pageCount === 1 ? "" : "s"} · ${formatBytes(item.file.size)}`}
            </p>
            {detail ? detail(item) : null}
          </div>
          {item.status === "loading" && (
            <Loader2 className="size-4 shrink-0 animate-spin text-primary" aria-hidden="true" />
          )}
          {item.status === "ready" && (
            <CheckCircle2 className="size-4 shrink-0 text-mint" aria-hidden="true" />
          )}
          <div className="flex shrink-0 items-center">
            <button
              type="button"
              onClick={() => onMove(item.id, -1)}
              disabled={index === 0}
              aria-label={`Move ${item.file.name} up`}
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-30"
            >
              <ChevronUp className="size-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => onMove(item.id, 1)}
              disabled={index === items.length - 1}
              aria-label={`Move ${item.file.name} down`}
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-30"
            >
              <ChevronDown className="size-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => onRemove(item.id)}
              aria-label={`Remove ${item.file.name}`}
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** the shared action row: primary button + "start over" */
export function ActionRow({
  busy,
  disabled,
  onRun,
  onClear,
  clearDisabled,
  children,
}: {
  busy: boolean;
  disabled: boolean;
  onRun: () => void;
  onClear: () => void;
  clearDisabled: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <Button
        type="button"
        onClick={onRun}
        disabled={busy || disabled}
        className="flex-1 sm:flex-none"
      >
        {busy ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Working…
          </>
        ) : (
          children
        )}
      </Button>
      <Button
        type="button"
        variant="ghost"
        onClick={onClear}
        disabled={busy || clearDisabled}
        className="gap-1.5 text-muted-foreground"
      >
        <Trash2 className="size-4" aria-hidden="true" />
        Start over
      </Button>
    </div>
  );
}
