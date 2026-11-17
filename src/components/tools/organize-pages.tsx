"use client";

/**
 * Organize PDF Pages — the visual page manager: drag pages into a new
 * order, rotate or delete them, watch it happen on live thumbnails.
 * pdf.js paints the previews; pdf-lib writes the reordered document.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  RotateCcw,
  RotateCw,
  Trash2,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  ActionRow,
  PdfDropZone,
  ResultsPanel,
  useSinglePdf,
  type OutputFile,
} from "./pdf-shared";
import {
  loadPdf,
  loadPdfLib,
  pdfErrorMessage,
  savePdf,
} from "./pdf-utils";
import { destroyPdfJsDoc, openWithPdfJs, renderPdfPage } from "./pdf-render";

interface PageEntry {
  key: number;
  /** 0-based page in the ORIGINAL document */
  srcIndex: number;
  /** extra rotation applied on top of the page's own, in degrees */
  rotation: number;
  /** small JPEG data-URL preview */
  thumb: string;
}

export function OrganizePages() {
  const { state, load, reset } = useSinglePdf();
  const [pages, setPages] = useState<PageEntry[]>([]);
  const [thumbsDone, setThumbsDone] = useState(0);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [dragKey, setDragKey] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<OutputFile[]>([]);
  const cancelledRef = useRef(false);
  /* undo history: snapshots of the page arrangement (deletes included) */
  const pagesRef = useRef<PageEntry[]>([]);
  useEffect(() => {
    pagesRef.current = pages;
  }, [pages]);
  const historyRef = useRef<PageEntry[][]>([]);
  const [historyLen, setHistoryLen] = useState(0);

  const pdf = state.status === "ready" ? state.pdf : null;
  const thumbsLoading = pdf !== null && thumbsDone < pdf.pageCount;

  const pushHistory = useCallback(() => {
    historyRef.current = [...historyRef.current.slice(-49), pagesRef.current];
    setHistoryLen(historyRef.current.length);
  }, []);

  const undo = useCallback(() => {
    const prev = historyRef.current.pop();
    if (!prev) return;
    setHistoryLen(historyRef.current.length);
    setPages(prev);
    setSelected(new Set());
  }, []);

  /* paint the thumbnails as soon as a document arrives */
  useEffect(() => {
    cancelledRef.current = false;
    if (state.status !== "ready") return;
    const loaded = state.pdf;
    (async () => {
      try {
        const bytes = new Uint8Array(await loaded.file.arrayBuffer());
        const doc = await openWithPdfJs(bytes);
        const entries: PageEntry[] = [];
        for (let i = 0; i < loaded.pageCount; i++) {
          const rendered = await renderPdfPage(doc, i + 1, 0.22);
          if (cancelledRef.current) {
            rendered.canvas.width = 0;
            rendered.canvas.height = 0;
            break;
          }
          entries.push({
            key: i,
            srcIndex: i,
            rotation: 0,
            thumb: rendered.canvas.toDataURL("image/jpeg", 0.75),
          });
          rendered.canvas.width = 0;
          rendered.canvas.height = 0;
          setPages([...entries]);
          setThumbsDone(i + 1);
          /* yield to the UI so long documents stay responsive */
          await new Promise((r) => setTimeout(r, 0));
        }
        await destroyPdfJsDoc(doc);
      } catch {
        toast.error("Couldn't render the page previews — the PDF may be damaged.");
      }
    })();
    return () => {
      cancelledRef.current = true;
    };
  }, [state]);

  const toggleSelect = (key: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const rotateSelected = (dir: 90 | -90) => {
    if (selected.size === 0) return;
    pushHistory();
    setPages((prev) =>
      prev.map((p) =>
        selected.has(p.key)
          ? { ...p, rotation: (p.rotation + dir + 360) % 360 }
          : p,
      ),
    );
  };

  const deleteSelected = () => {
    if (selected.size === 0) return;
    pushHistory();
    setPages((prev) => prev.filter((p) => !selected.has(p.key)));
    setSelected(new Set());
  };

  const move = useCallback(
    (key: number, dir: -1 | 1) => {
      pushHistory();
      setPages((prev) => {
        const index = prev.findIndex((p) => p.key === key);
        const target = index + dir;
        if (index < 0 || target < 0 || target >= prev.length) return prev;
        const next = [...prev];
        [next[index], next[target]] = [next[target], next[index]];
        return next;
      });
    },
    [pushHistory],
  );

  const dropOn = (targetKey: number) => {
    if (dragKey === null || dragKey === targetKey) return;
    pushHistory();
    setPages((prev) => {
      const from = prev.findIndex((p) => p.key === dragKey);
      const to = prev.findIndex((p) => p.key === targetKey);
      if (from < 0 || to < 0) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
    setDragKey(null);
  };

  const restart = () => {
    reset();
    setPages([]);
    historyRef.current = [];
    setHistoryLen(0);
    setThumbsDone(0);
    setSelected(new Set());
    setResults([]);
  };

  const run = async () => {
    if (!pdf || pages.length === 0) return;
    setBusy(true);
    setResults([]);
    try {
      const { PDFDocument, degrees } = await loadPdfLib();
      const source = await loadPdf(pdf.file);
      const out = await PDFDocument.create();
      const copied = await out.copyPages(
        source.doc,
        pages.map((p) => p.srcIndex),
      );
      copied.forEach((page, i) => {
        const original = page.getRotation().angle ?? 0;
        /* normalise into 0–359: exotic files can store negative angles */
        page.setRotation(degrees((((original + pages[i].rotation) % 360) + 360) % 360));
        out.addPage(page);
      });
      const blob = await savePdf(out);
      const base = pdf.file.name.replace(/\.pdf$/i, "");
      setResults([
        {
          blob,
          name: `${base}-organized.pdf`,
          note: `${pages.length} page${pages.length > 1 ? "s" : ""} · ${
            pdf.pageCount - pages.length === 0
              ? "new order and rotations"
              : `${pdf.pageCount - pages.length} page${pdf.pageCount - pages.length === 1 ? "" : "s"} removed`
          }`,
        },
      ]);
      toast.success("Pages organized", {
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
          {/* toolbar */}
          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-3">
            <span className="mr-auto text-[12.5px] font-semibold text-muted-foreground">
              {thumbsLoading ? (
                <span className="inline-flex items-center gap-1.5">
                  <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                  Loading previews {thumbsDone}/{pdf.pageCount}
                </span>
              ) : (
                <>
                  {pages.length} page{pages.length === 1 ? "" : "s"} ·{" "}
                  {selected.size > 0
                    ? `${selected.size} selected`
                    : "click pages to select · drag to reorder"}
                </>
              )}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={selected.size === 0}
              onClick={() => rotateSelected(-90)}
            >
              <RotateCcw className="size-3.5" aria-hidden="true" />
              Left
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={selected.size === 0}
              onClick={() => rotateSelected(90)}
            >
              <RotateCw className="size-3.5" aria-hidden="true" />
              Right
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={historyLen === 0}
              onClick={undo}
            >
              <Undo2 className="size-3.5" aria-hidden="true" />
              Undo
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={selected.size === 0}
              onClick={deleteSelected}
              className="text-destructive"
            >
              <Trash2 className="size-3.5" aria-hidden="true" />
              Delete
            </Button>
          </div>

          {/* the page grid */}
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
            {pages.map((page, index) => (
              <div
                key={page.key}
                draggable
                onDragStart={() => setDragKey(page.key)}
                onDragEnd={() => setDragKey(null)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => dropOn(page.key)}
                className={`group relative flex cursor-grab flex-col gap-1.5 rounded-xl border p-2 transition-colors ${
                  selected.has(page.key)
                    ? "border-primary bg-secondary"
                    : "border-border bg-card hover:border-primary/50"
                } ${dragKey === page.key ? "opacity-40" : ""}`}
              >
                <button
                  type="button"
                  onClick={() => toggleSelect(page.key)}
                  aria-pressed={selected.has(page.key)}
                  aria-label={`Page ${page.srcIndex + 1}${page.rotation ? `, rotated ${page.rotation} degrees` : ""}`}
                  className="relative overflow-hidden rounded-lg border border-border bg-white"
                >
                  <img
                    src={page.thumb}
                    alt=""
                    className="mx-auto max-h-36 w-auto object-contain"
                    style={{ transform: `rotate(${page.rotation}deg)` }}
                  />
                  <span className="absolute left-1 top-1 rounded bg-navy/85 px-1.5 py-0.5 text-[10px] font-bold text-white">
                    {index + 1}
                  </span>
                  {page.rotation !== 0 && (
                    <span className="absolute right-1 top-1 rounded bg-primary px-1.5 py-0.5 text-[10px] font-bold text-white">
                      {page.rotation}°
                    </span>
                  )}
                </button>
                <div className="flex items-center justify-center">
                  <button
                    type="button"
                    onClick={() => move(page.key, -1)}
                    disabled={index === 0}
                    aria-label="Move page left"
                    className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-30"
                  >
                    <ChevronLeft className="size-3.5" aria-hidden="true" />
                  </button>
                  <span className="px-1 text-[10.5px] text-muted-foreground">
                    from page {page.srcIndex + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => move(page.key, 1)}
                    disabled={index === pages.length - 1}
                    aria-label="Move page right"
                    className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-30"
                  >
                    <ChevronRight className="size-3.5" aria-hidden="true" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <ActionRow
            busy={busy}
            disabled={pages.length === 0}
            onRun={run}
            onClear={restart}
            clearDisabled={false}
          >
            Save organized PDF
          </ActionRow>
        </>
      )}

      <ResultsPanel files={results} zipName="freeseak-organized-pdfs.zip" />
    </div>
  );
}
