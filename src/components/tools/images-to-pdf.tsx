"use client";

/**
 * Images → PDF — turn JPG / PNG / WebP photos into one PDF.
 * JPG and PNG bytes are embedded untouched (no recompression); other
 * formats are converted to JPG via the shared image engine. Page size:
 * fit to each image, or A4 / Letter with a margin.
 */

import { useCallback, useRef, useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Loader2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ImageDropZone } from "./image-drop";
import { encodeImage, formatBytes, loadImageFile } from "./image-utils";
import { ActionRow, ResultsPanel, type OutputFile } from "./pdf-shared";
import { loadPdfLib, pdfErrorMessage, savePdf } from "./pdf-utils";

type PageSize = "auto" | "a4" | "letter";

const PAGE_SIZES: { value: PageSize; label: string }[] = [
  { value: "auto", label: "Fit each image (no borders)" },
  { value: "a4", label: "A4 — 210 × 297 mm" },
  { value: "letter", label: "US Letter — 8.5 × 11 in" },
];

/** page dimensions in PDF points (1 pt = 1/72 in) */
const FIXED_SIZES: Record<Exclude<PageSize, "auto">, { w: number; h: number }> = {
  a4: { w: 595.28, h: 841.89 },
  letter: { w: 612, h: 792 },
};

const MARGINS = [
  { value: "0", label: "No margin" },
  { value: "18", label: "Small margin" },
  { value: "36", label: "Wide margin" },
];

interface ImageItem {
  id: number;
  file: File;
  previewUrl: string;
  width: number;
  height: number;
  status: "loading" | "ready" | "error";
}

export function ImagesToPdf() {
  const [items, setItems] = useState<ImageItem[]>([]);
  const [pageSize, setPageSize] = useState<PageSize>("auto");
  const [margin, setMargin] = useState("18");
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<OutputFile[]>([]);
  const idRef = useRef(0);

  const updateItem = useCallback((id: number, patch: Partial<ImageItem>) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }, []);

  const addFiles = useCallback(
    (incoming: File[]) => {
      const images = incoming.filter((f) => f.type.startsWith("image/"));
      const skipped = incoming.length - images.length;
      if (skipped > 0) {
        toast.error(
          `${skipped} file${skipped > 1 ? "s were" : " was"} skipped — not an image.`,
        );
      }
      if (images.length === 0) return;
      const startId = idRef.current;
      idRef.current += images.length;
      setItems((prev) => [
        ...prev,
        ...images.map((file, i) => ({
          id: startId + i,
          file,
          previewUrl: URL.createObjectURL(file),
          width: 0,
          height: 0,
          status: "loading" as const,
        })),
      ]);
      images.forEach((file, i) => {
        void loadImageFile(file).then(
          ({ width, height }) => updateItem(startId + i, { width, height, status: "ready" }),
          () =>
            updateItem(startId + i, {
              status: "error",
            }),
        );
      });
    },
    [updateItem],
  );

  const remove = (id: number) => {
    const target = items.find((i) => i.id === id);
    if (target) URL.revokeObjectURL(target.previewUrl);
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const move = (id: number, dir: -1 | 1) => {
    setItems((prev) => {
      const index = prev.findIndex((i) => i.id === id);
      const target = index + dir;
      if (index < 0 || target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const clearAll = () => {
    items.forEach((i) => URL.revokeObjectURL(i.previewUrl));
    setItems([]);
    setResults([]);
  };

  const ready = items.filter((i) => i.status === "ready");

  const run = async () => {
    if (ready.length === 0) return;
    setBusy(true);
    setResults([]);
    try {
      const { PDFDocument, rgb } = await loadPdfLib();
      const out = await PDFDocument.create();
      const marginPt = parseInt(margin, 10);

      for (const item of ready) {
        const { img } = await loadImageFile(item.file);
        let jpgBytes: Uint8Array | null = null;
        let pngBytes: Uint8Array | null = null;

        if (item.file.type === "image/jpeg") {
          jpgBytes = new Uint8Array(await item.file.arrayBuffer());
        } else if (item.file.type === "image/png") {
          pngBytes = new Uint8Array(await item.file.arrayBuffer());
        } else {
          /* WebP, GIF, AVIF … — the browser can decode them, pdf-lib can't */
          const encoded = await encodeImage(img, {
            width: item.width,
            height: item.height,
            fit: "stretch",
            background: "#FFFFFF",
            mime: "image/jpeg",
            quality: 0.92,
          });
          jpgBytes = new Uint8Array(await encoded.blob.arrayBuffer());
        }

        const embedded = jpgBytes
          ? await out.embedJpg(jpgBytes)
          : await out.embedPng(pngBytes as Uint8Array);

        if (pageSize === "auto") {
          /* one page per image, image size = page size (px treated as pt) */
          const page = out.addPage([embedded.width, embedded.height]);
          page.drawImage(embedded, {
            x: 0,
            y: 0,
            width: embedded.width,
            height: embedded.height,
          });
        } else {
          const base = FIXED_SIZES[pageSize];
          /* portrait or landscape to match the image */
          const landscape =
            embedded.width > embedded.height && base.h > base.w;
          const w = landscape ? base.h : base.w;
          const h = landscape ? base.w : base.h;
          const page = out.addPage([w, h]);
          page.drawRectangle({ x: 0, y: 0, width: w, height: h, color: rgb(1, 1, 1) });
          const scale = Math.min(
            (w - marginPt * 2) / embedded.width,
            (h - marginPt * 2) / embedded.height,
          );
          const drawW = embedded.width * scale;
          const drawH = embedded.height * scale;
          page.drawImage(embedded, {
            x: (w - drawW) / 2,
            y: (h - drawH) / 2,
            width: drawW,
            height: drawH,
          });
        }
      }

      const blob = await savePdf(out);
      const base = ready[0].file.name.replace(/\.[^.]+$/, "");
      setResults([
        {
          blob,
          name: `${base}${ready.length > 1 ? `-images` : ""}.pdf`,
          note: `${ready.length} image${ready.length > 1 ? "s" : ""} · JPG/PNG embedded without recompression`,
        },
      ]);
      toast.success("PDF created", {
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
      <ImageDropZone onFiles={addFiles} compact={items.length > 0} />

      {items.length > 0 && (
        <>
          <ul className="flex flex-col gap-2">
            {items.map((item, index) => (
              <li
                key={item.id}
                className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5"
              >
                <img
                  src={item.previewUrl}
                  alt=""
                  className="size-11 shrink-0 rounded-lg border border-border object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-foreground">
                    {item.file.name}
                  </p>
                  <p className="text-[12px] text-muted-foreground">
                    {item.status === "loading"
                      ? "Reading…"
                      : item.status === "error"
                        ? "Couldn't read this image"
                        : `${item.width} × ${item.height} · ${formatBytes(item.file.size)}`}
                  </p>
                </div>
                {item.status === "loading" && (
                  <Loader2 className="size-4 shrink-0 animate-spin text-primary" aria-hidden="true" />
                )}
                {item.status === "ready" && (
                  <CheckCircle2 className="size-4 shrink-0 text-mint" aria-hidden="true" />
                )}
                <div className="flex shrink-0 items-center">
                  <button type="button" onClick={() => move(item.id, -1)} disabled={index === 0}
                    aria-label={`Move ${item.file.name} up`}
                    className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-30">
                    <ChevronUp className="size-4" aria-hidden="true" />
                  </button>
                  <button type="button" onClick={() => move(item.id, 1)} disabled={index === items.length - 1}
                    aria-label={`Move ${item.file.name} down`}
                    className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-30">
                    <ChevronDown className="size-4" aria-hidden="true" />
                  </button>
                  <button type="button" onClick={() => remove(item.id)}
                    aria-label={`Remove ${item.file.name}`}
                    className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
                    <X className="size-4" aria-hidden="true" />
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <div className="grid gap-3 rounded-2xl border border-border bg-card p-5 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="itp-size">Page size</Label>
              <Select value={pageSize} onValueChange={(v) => setPageSize(v as PageSize)}>
                <SelectTrigger id="itp-size" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="itp-margin">Page margin</Label>
              <Select value={margin} onValueChange={setMargin} disabled={pageSize === "auto"}>
                <SelectTrigger id="itp-margin" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MARGINS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-[12px] leading-relaxed text-muted-foreground sm:col-span-2">
              Images are placed in the order listed — the arrows set which page
              each one becomes. JPG and PNG files are embedded as-is (no quality
              loss, no recompression); other formats are converted to JPG first.
              With A4 / Letter pages, the orientation follows each image.
            </p>
          </div>

          <ActionRow busy={busy} disabled={ready.length === 0} onRun={run}
            onClear={clearAll} clearDisabled={items.length === 0}>
            Create PDF
          </ActionRow>
        </>
      )}

      <ResultsPanel files={results} zipName="images.pdf" />
    </div>
  );
}
