"use client";

/**
 * Watermark PDF — stamp text across every page: once, centred, or tiled
 * over the whole page, at any angle and opacity. The preview shows the
 * REAL first page (rendered by pdf.js) with the watermark painted on
 * top, so what you see is what you get.
 */

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
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
  hexToRgb,
  loadPdf,
  loadPdfLib,
  parsePageRange,
  pdfErrorMessage,
  savePdf,
} from "./pdf-utils";
import { openWithPdfJs, renderPdfPage } from "./pdf-render";

type Layout = "once" | "tile";

const LAYOUTS: { value: Layout; label: string }[] = [
  { value: "once", label: "Once, centred on the page" },
  { value: "tile", label: "Tiled across the whole page" },
];

const ANGLES = ["0", "30", "45", "60", "90"];

export function WatermarkPdf() {
  const { state, load, reset } = useSinglePdf();
  const [text, setText] = useState("CONFIDENTIAL");
  const [size, setSize] = useState(48);
  const [color, setColor] = useState("#9CA3AF");
  const [opacity, setOpacity] = useState(15);
  const [angle, setAngle] = useState("45");
  const [layout, setLayout] = useState<Layout>("once");
  const [range, setRange] = useState("");
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<OutputFile[]>([]);

  const pdf = state.status === "ready" ? state.pdf : null;
  const parsed = pdf ? parsePageRange(range, pdf.pageCount) : null;
  const canRun =
    pdf !== null &&
    parsed !== null &&
    parsed.valid &&
    parsed.pages.length > 0 &&
    text.trim().length > 0;

  /* ---------- live preview: real page 1 + the watermark on top ---------- */

  const pageCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewRef = useRef<HTMLCanvasElement | null>(null);
  /* bumps when page 1 has been rendered — refs alone don't re-render */
  const [page1Ready, setPage1Ready] = useState(0);

  useEffect(() => {
    if (state.status !== "ready") {
      pageCanvasRef.current = null;
      return;
    }
    const loaded = state.pdf;
    let cancelled = false;
    (async () => {
      try {
        const bytes = new Uint8Array(await loaded.file.arrayBuffer());
        const doc = await openWithPdfJs(bytes);
        const rendered = await renderPdfPage(doc, 1, 0.55);
        await doc.cleanup();
        if (!cancelled) {
          pageCanvasRef.current = rendered.canvas;
          setPage1Ready((n) => n + 1);
        }
      } catch {
        pageCanvasRef.current = null;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [state]);

  useEffect(() => {
    const page = pageCanvasRef.current;
    const preview = previewRef.current;
    if (!page || !preview) return;
    const ctx = preview.getContext("2d");
    if (!ctx) return;

    /* the preview canvas mirrors the page 1:1 */
    preview.width = page.width;
    preview.height = page.height;
    ctx.drawImage(page, 0, 0);

    /* map PDF points to preview pixels */
    const scale = page.width / (pdf?.width ?? 1);
    const fontPx = Math.max(8, size * scale);
    const label = text.trim() || " ";
    ctx.save();
    ctx.globalAlpha = opacity / 100;
    ctx.fillStyle = color;
    ctx.font = `bold ${fontPx}px Helvetica, Arial, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const theta = (-parseInt(angle, 10) * Math.PI) / 180; /* canvas y is flipped */
    const textW = ctx.measureText(label).width;

    if (layout === "once") {
      ctx.translate(preview.width / 2, preview.height / 2);
      ctx.rotate(theta);
      ctx.fillText(label, 0, 0);
    } else {
      const stepX = textW + fontPx * 4;
      const stepY = fontPx * 5;
      for (let y = stepY / 2; y < preview.height + stepY; y += stepY) {
        for (let x = stepX / 2; x < preview.width + stepX; x += stepX) {
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(theta);
          ctx.fillText(label, 0, 0);
          ctx.restore();
        }
      }
    }
    ctx.restore();
  }, [text, size, color, opacity, angle, layout, pdf, page1Ready]);

  /* ---------- the real thing: stamp with pdf-lib ---------- */

  const run = async () => {
    if (!pdf || !parsed || !canRun) return;
    setBusy(true);
    setResults([]);
    try {
      const { StandardFonts, rgb, degrees } = await loadPdfLib();
      const source = await loadPdf(pdf.file);
      const font = await source.doc.embedFont(StandardFonts.HelveticaBold);
      const tint = hexToRgb(color) ?? { r: 0.6, g: 0.64, b: 0.69 };
      const label = text.trim();
      const textW = font.widthOfTextAtSize(label, size);
      const theta = (parseInt(angle, 10) * Math.PI) / 180;

      for (const pageIndex of parsed.pages) {
        const page = source.doc.getPage(pageIndex);
        const { width, height } = page.getSize();

        /* pdf-lib rotates around the text origin, so place the start of
           the baseline such that the text's midpoint lands on target */
        const stamp = (cx: number, cy: number) => {
          page.drawText(label, {
            x: cx - Math.cos(theta) * (textW / 2),
            y: cy - Math.sin(theta) * (textW / 2),
            size,
            font,
            color: rgb(tint.r, tint.g, tint.b),
            opacity: opacity / 100,
            rotate: degrees(parseInt(angle, 10)),
          });
        };

        if (layout === "once") {
          stamp(width / 2, height / 2);
        } else {
          const stepX = textW + size * 4;
          const stepY = size * 5;
          for (let y = stepY / 2; y < height + stepY; y += stepY) {
            for (let x = stepX / 2; x < width + stepX; x += stepX) {
              stamp(x, y);
            }
          }
        }
      }

      const blob = await savePdf(source.doc);
      const base = pdf.file.name.replace(/\.pdf$/i, "");
      setResults([
        {
          blob,
          name: `${base}-watermarked.pdf`,
          note: `${parsed.pages.length} page${parsed.pages.length > 1 ? "s" : ""} watermarked with “${label}”`,
        },
      ]);
      toast.success("Watermark added", {
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
          <LoadedPdfCard pdf={pdf} onRemove={reset} />

          <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
            {/* settings */}
            <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="wm-text">Watermark text</Label>
                <Input
                  id="wm-text"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="e.g. CONFIDENTIAL, DRAFT, name@example.com"
                  autoComplete="off"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="wm-size">Font size</Label>
                  <Input
                    id="wm-size"
                    type="number"
                    min={8}
                    max={200}
                    value={size}
                    onChange={(e) =>
                      setSize(
                        Math.max(8, Math.min(200, parseInt(e.target.value, 10) || 48)),
                      )
                    }
                    className="w-28"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="wm-angle">Angle</Label>
                  <Select value={angle} onValueChange={setAngle}>
                    <SelectTrigger id="wm-angle" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ANGLES.map((a) => (
                        <SelectItem key={a} value={a}>
                          {a}°
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="wm-color">Colour</Label>
                  <div className="flex items-center gap-2 rounded-lg border border-input px-2.5 py-1.5">
                    <input
                      id="wm-color"
                      type="color"
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                      className="size-7 cursor-pointer rounded-md border-0 bg-transparent p-0"
                      aria-label="Watermark colour"
                    />
                    <span className="font-mono text-[12.5px] uppercase text-muted-foreground">
                      {color}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="wm-opacity">
                    Opacity — {opacity}%
                  </Label>
                  <input
                    id="wm-opacity"
                    type="range"
                    min={3}
                    max={100}
                    step={1}
                    value={opacity}
                    onChange={(e) => setOpacity(parseInt(e.target.value, 10))}
                    className="mt-2.5 h-2 w-full cursor-pointer accent-primary"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="wm-layout">Layout</Label>
                <Select value={layout} onValueChange={(v) => setLayout(v as Layout)}>
                  <SelectTrigger id="wm-layout" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LAYOUTS.map((l) => (
                      <SelectItem key={l.value} value={l.value}>
                        {l.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <PageRangeInput
                id="wm-range"
                value={range}
                onChange={setRange}
                pageCount={pdf.pageCount}
                label="Pages to watermark"
              />
            </div>

            {/* live preview */}
            <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-5">
              <p className="font-display text-[13px] font-bold text-foreground">
                Live preview — page 1
              </p>
              <div className="flex flex-1 items-center justify-center overflow-hidden rounded-xl border border-border bg-secondary/50 p-3">
                <canvas
                  ref={previewRef}
                  className="max-h-[340px] w-auto max-w-full rounded-lg shadow-sm"
                  aria-label="Watermark preview on the first page"
                />
              </div>
              <p className="text-[12px] leading-relaxed text-muted-foreground">
                The preview shows your document's real first page with the
                watermark exactly as it will be stamped.
              </p>
            </div>
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
            Add watermark
          </ActionRow>
        </>
      )}

      <ResultsPanel files={results} zipName="freeseak-watermarked-pdfs.zip" />
    </div>
  );
}
