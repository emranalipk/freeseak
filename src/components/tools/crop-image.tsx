"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Crop as CropIcon,
  Download,
  FlipHorizontal,
  FlipVertical,
  Loader2,
  RotateCcw,
  RotateCw,
  Scan,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ImageDropZone } from "./image-drop";
import {
  downloadBlob,
  extForMime,
  formatBytes,
  loadImageFile,
  resolveMime,
  FORMAT_OPTIONS,
  type FormatChoice,
} from "./image-utils";

/**
 * FreeSeak — Crop & Rotate Image (v0.8.0).
 *
 * A canvas-drawn preview (rotation and flips are really rendered, not a
 * CSS trick) with a draggable, resizable crop box, aspect presets and
 * JPG/PNG/WebP export. The crop box works in natural pixels of the
 * rotated image, so the download is always full-resolution — the preview
 * is scaled, the output is not.
 */

type Rotation = 0 | 90 | 180 | 270;

interface CropRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const ASPECTS: { label: string; value: number | null }[] = [
  { label: "Free", value: null },
  { label: "1:1", value: 1 },
  { label: "4:3", value: 4 / 3 },
  { label: "3:4", value: 3 / 4 },
  { label: "16:9", value: 16 / 9 },
  { label: "9:16", value: 9 / 16 },
  { label: "3:2", value: 3 / 2 },
  { label: "2:3", value: 2 / 3 },
];

/** iOS Safari refuses canvases above ~16.7M pixels */
const MAX_OUTPUT_PIXELS = 16_777_216;
const MIN_CROP = 16;
const PREVIEW_MAX_EDGE = 1100;

interface LoadedImageState {
  file: File;
  img: HTMLImageElement;
  width: number;
  height: number;
  url: string;
}

type DragMode = "move" | "nw" | "ne" | "sw" | "se";

export function ImageCropper() {
  const [loaded, setLoaded] = useState<LoadedImageState | null>(null);
  const [rotation, setRotation] = useState<Rotation>(0);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [aspect, setAspect] = useState<number | null>(null);
  const [crop, setCrop] = useState<CropRect | null>(null);
  const [format, setFormat] = useState<FormatChoice>("keep");
  const [qualityPct, setQualityPct] = useState(90);
  const [saving, setSaving] = useState(false);
  const [previewDims, setPreviewDims] = useState<{ w: number; h: number } | null>(
    null,
  );

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<{
    mode: DragMode;
    startX: number;
    startY: number;
    orig: CropRect;
  } | null>(null);

  /* rotated natural dimensions */
  const rw = loaded ? (rotation === 90 || rotation === 270 ? loaded.height : loaded.width) : 0;
  const rh = loaded ? (rotation === 90 || rotation === 270 ? loaded.width : loaded.height) : 0;

  const addFile = useCallback(async (files: File[]) => {
    const file = files.find((f) => f.type.startsWith("image/"));
    if (!file) {
      toast.error("That file isn't an image", {
        description: "JPG, PNG, WebP, GIF and BMP images are supported.",
      });
      return;
    }
    try {
      const res = await loadImageFile(file);
      setLoaded({ file, img: res.img, width: res.width, height: res.height, url: "" });
      setRotation(0);
      setFlipH(false);
      setFlipV(false);
      setAspect(null);
      setCrop({ x: 0, y: 0, w: res.width, h: res.height });
    } catch {
      toast.error(`Couldn't read “${file.name}”`, {
        description: "The file may be corrupted or in an unsupported format.",
      });
    }
  }, []);

  /* ---- preview: draw the rotated + flipped image on a canvas ---------- */
  useEffect(() => {
    if (!loaded || rw === 0 || rh === 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const scale = Math.min(1, PREVIEW_MAX_EDGE / Math.max(rw, rh));
    canvas.width = Math.max(1, Math.round(rw * scale));
    canvas.height = Math.max(1, Math.round(rh * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
    const dw = rotation === 90 || rotation === 270 ? canvas.height : canvas.width;
    const dh = rotation === 90 || rotation === 270 ? canvas.width : canvas.height;
    ctx.drawImage(loaded.img, -dw / 2, -dh / 2, dw, dh);
    ctx.restore();
    setPreviewDims({ w: canvas.width, h: canvas.height });
  }, [loaded, rotation, flipH, flipV, rw, rh]);

  const previewScale = previewDims && rw > 0 ? previewDims.w / rw : 1;

  /* ---- crop helpers ---------------------------------------------------- */

  /** apply an aspect to the current box: biggest centred box that fits */
  const applyAspect = useCallback(
    (value: number | null) => {
      setAspect(value);
      if (value == null || rw === 0) return;
      let w = rw;
      let h = w / value;
      if (h > rh) {
        h = rh;
        w = h * value;
      }
      setCrop({
        x: (rw - w) / 2,
        y: (rh - h) / 2,
        w,
        h,
      });
    },
    [rw, rh],
  );

  /** rotate 90° steps — dims swap, so the box resets to the new full image */
  const rotateBy = useCallback(
    (delta: 90 | -90) => {
      if (!loaded) return;
      const nr = (((rotation + delta) % 360 + 360) % 360) as Rotation;
      setRotation(nr);
      const nrw = nr === 90 || nr === 270 ? loaded.height : loaded.width;
      const nrh = nr === 90 || nr === 270 ? loaded.width : loaded.height;
      setCrop({ x: 0, y: 0, w: nrw, h: nrh });
    },
    [loaded, rotation],
  );

  /** flips don't change the dimensions — just reset the box to full */
  const resetCrop = useCallback(() => {
    if (rw > 0 && rh > 0) setCrop({ x: 0, y: 0, w: rw, h: rh });
  }, [rw, rh]);

  const startDrag = useCallback(
    (e: React.PointerEvent, mode: DragMode) => {
      if (!crop) return;
      e.preventDefault();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      dragRef.current = {
        mode,
        startX: e.clientX,
        startY: e.clientY,
        orig: { ...crop },
      };
    },
    [crop],
  );

  const onPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag || !crop || previewScale <= 0) return;
    const dx = (e.clientX - drag.startX) / previewScale;
    const dy = (e.clientY - drag.startY) / previewScale;
    const orig = drag.orig;

    if (drag.mode === "move") {
      setCrop({
        ...orig,
        x: Math.min(Math.max(0, orig.x + dx), rw - orig.w),
        y: Math.min(Math.max(0, orig.y + dy), rh - orig.h),
      });
      return;
    }

    /* corner resize: the opposite corner stays fixed */
    let x1 = orig.x;
    let y1 = orig.y;
    let x2 = orig.x + orig.w;
    let y2 = orig.y + orig.h;
    if (drag.mode === "nw") {
      x1 = Math.min(Math.max(0, orig.x + dx), x2 - MIN_CROP);
      y1 = Math.min(Math.max(0, orig.y + dy), y2 - MIN_CROP);
    } else if (drag.mode === "ne") {
      x2 = Math.max(Math.min(rw, orig.x + orig.w + dx), x1 + MIN_CROP);
      y1 = Math.min(Math.max(0, orig.y + dy), y2 - MIN_CROP);
    } else if (drag.mode === "sw") {
      x1 = Math.min(Math.max(0, orig.x + dx), x2 - MIN_CROP);
      y2 = Math.max(Math.min(rh, orig.y + orig.h + dy), y1 + MIN_CROP);
    } else {
      /* se */
      x2 = Math.max(Math.min(rw, orig.x + orig.w + dx), x1 + MIN_CROP);
      y2 = Math.max(Math.min(rh, orig.y + orig.h + dy), y1 + MIN_CROP);
    }

    let w = x2 - x1;
    let h = y2 - y1;

    if (aspect != null) {
      /* keep the aspect: derive height from width, then re-clamp */
      h = w / aspect;
      if (drag.mode === "nw" || drag.mode === "ne") {
        if (y1 + h > rh) {
          h = rh - y1;
          w = h * aspect;
        }
      } else if (y2 - h < 0) {
        h = y2;
        w = h * aspect;
      }
      if (x1 + w > rw) {
        w = rw - x1;
        h = w / aspect;
      }
      if (w < MIN_CROP || h < MIN_CROP) return;
      setCrop({ x: x1, y: y1, w, h });
      return;
    }
    setCrop({ x: x1, y: y1, w, h });
  };

  const onPointerUp = () => {
    dragRef.current = null;
  };

  /* ---- download -------------------------------------------------------- */

  const download = useCallback(async () => {
    if (!loaded || !crop || saving) return;
    setSaving(true);
    try {
      /* 1. rotated + flipped full image (capped to a browser-safe area) */
      const area = rw * rh;
      const scale = area > MAX_OUTPUT_PIXELS ? Math.sqrt(MAX_OUTPUT_PIXELS / area) : 1;
      const full = document.createElement("canvas");
      full.width = Math.max(1, Math.round(rw * scale));
      full.height = Math.max(1, Math.round(rh * scale));
      const fctx = full.getContext("2d");
      if (!fctx) throw new Error("canvas-unsupported");
      fctx.translate(full.width / 2, full.height / 2);
      fctx.rotate((rotation * Math.PI) / 180);
      fctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
      const dw = rotation === 90 || rotation === 270 ? full.height : full.width;
      const dh = rotation === 90 || rotation === 270 ? full.width : full.height;
      fctx.drawImage(loaded.img, -dw / 2, -dh / 2, dw, dh);

      /* 2. crop the selection out of it */
      const cx = crop.x * scale;
      const cy = crop.y * scale;
      const cw = Math.max(1, Math.round(crop.w * scale));
      const ch = Math.max(1, Math.round(crop.h * scale));
      const out = document.createElement("canvas");
      out.width = cw;
      out.height = ch;
      const octx = out.getContext("2d");
      if (!octx) throw new Error("canvas-unsupported");
      const mime = resolveMime(loaded.file.type, format);
      if (mime === "image/jpeg") {
        octx.fillStyle = "#ffffff";
        octx.fillRect(0, 0, cw, ch);
      }
      octx.drawImage(full, cx, cy, crop.w * scale, crop.h * scale, 0, 0, cw, ch);

      const blob = await new Promise<Blob>((resolve, reject) =>
        out.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("encode-failed"))),
          mime,
          mime === "image/png" ? 1 : qualityPct / 100,
        ),
      );

      const cropped =
        crop.w < rw - 0.5 || crop.h < rh - 0.5 || crop.x > 0.5 || crop.y > 0.5;
      const transformed = rotation !== 0 || flipH || flipV;
      const suffix = cropped ? "-cropped" : transformed ? "-rotated" : "-edited";
      const base = loaded.file.name.replace(/\.[^.]+$/, "") || "image";
      downloadBlob(blob, `${base}${suffix}.${extForMime(mime)}`);
      toast.success("Saved to your device", {
        description:
          `${cw} × ${ch} px · ${formatBytes(blob.size)} — processed on your device.` +
          (scale < 1
            ? ` Scaled to the browser's ~${Math.round(MAX_OUTPUT_PIXELS / 1_000_000)} MP canvas cap — the selection above it can't be delivered at full size.`
            : ""),
      });
    } catch (err) {
      toast.error("Couldn't save the image", {
        description:
          err instanceof Error && err.message === "canvas-unsupported"
            ? "Your browser blocked the canvas — try a smaller image."
            : "Try a different format or a smaller crop.",
      });
    } finally {
      setSaving(false);
    }
  }, [loaded, crop, saving, rw, rh, rotation, flipH, flipV, format, qualityPct]);

  const lossy = loaded ? resolveMime(loaded.file.type, format) !== "image/png" : true;
  const dispBox = crop && previewScale
    ? {
        left: crop.x * previewScale,
        top: crop.y * previewScale,
        width: crop.w * previewScale,
        height: crop.h * previewScale,
      }
    : null;

  return (
    <div className="flex flex-col gap-4">
      <ImageDropZone onFiles={addFile} compact={!!loaded} />

      {loaded && crop && dispBox && (
        <section className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5">
          {/* preview + crop overlay */}
          <div
            className="flex justify-center overflow-auto rounded-xl p-3"
            style={{
              backgroundImage:
                "repeating-conic-gradient(rgba(148,163,184,.16) 0% 25%, transparent 0% 50%)",
              backgroundSize: "20px 20px",
            }}
          >
            <div className="relative">
              <canvas
                ref={canvasRef}
                className="block h-auto max-w-full select-none"
                style={{ width: previewDims ? `${previewDims.w}px` : undefined }}
              />
              {/* dim everything outside the crop */}
              <div
                className="absolute inset-0 bg-black/45"
                style={{
                  clipPath: `polygon(0 0, 100% 0, 100% 100%, 0 100%, 0 0, ${dispBox.left}px ${dispBox.top}px, ${dispBox.left}px ${dispBox.top + dispBox.height}px, ${dispBox.left + dispBox.width}px ${dispBox.top + dispBox.height}px, ${dispBox.left + dispBox.width}px ${dispBox.top}px, ${dispBox.left}px ${dispBox.top}px)`,
                }}
              />
              <div
                className="absolute cursor-move outline-2 outline-mint"
                style={dispBox}
                onPointerDown={(e) => startDrag(e, "move")}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
              >
                {(["nw", "ne", "sw", "se"] as DragMode[]).map((corner) => (
                  <span
                    key={corner}
                    onPointerDown={(e) => startDrag(e, corner)}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                    className={`absolute size-4 rounded-sm border-2 border-mint bg-white ${
                                      corner === "nw"
                                        ? "-left-2 -top-2 cursor-nwse-resize"
                                        : corner === "ne"
                                          ? "-right-2 -top-2 cursor-nesw-resize"
                                          : corner === "sw"
                                            ? "-bottom-2 -left-2 cursor-nesw-resize"
                                            : "-bottom-2 -right-2 cursor-nwse-resize"
                                    }`}
                    role="presentation"
                  />
                ))}
              </div>
            </div>
          </div>

          {/* transform toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => rotateBy(-90)} className="gap-1.5">
              <RotateCcw className="size-3.5" aria-hidden="true" />
              Rotate left
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => rotateBy(90)} className="gap-1.5">
              <RotateCw className="size-3.5" aria-hidden="true" />
              Rotate right
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setFlipH((f) => !f);
                resetCrop();
              }}
              aria-pressed={flipH}
              className="gap-1.5"
            >
              <FlipHorizontal className="size-3.5" aria-hidden="true" />
              Flip H
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setFlipV((f) => !f);
                resetCrop();
              }}
              aria-pressed={flipV}
              className="gap-1.5"
            >
              <FlipVertical className="size-3.5" aria-hidden="true" />
              Flip V
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={resetCrop} className="gap-1.5 text-muted-foreground">
              <Scan className="size-3.5" aria-hidden="true" />
              Full image
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setLoaded(null);
                setCrop(null);
              }}
              className="ml-auto gap-1.5 text-muted-foreground"
            >
              <Trash2 className="size-3.5" aria-hidden="true" />
              Start over
            </Button>
          </div>

          {/* aspect presets */}
          <div>
            <p className="text-[12.5px] font-medium text-muted-foreground">
              Aspect ratio
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {ASPECTS.map((a) => (
                <Button
                  key={a.label}
                  type="button"
                  variant={aspect === a.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => applyAspect(a.value)}
                  aria-pressed={aspect === a.value}
                >
                  {a.label}
                </Button>
              ))}
            </div>
          </div>

          {/* output settings */}
          <div className="flex flex-wrap items-end gap-4">
            <div className="w-full max-w-64">
              <Label htmlFor="crop-format">Save as</Label>
              <Select value={format} onValueChange={(v) => setFormat(v as FormatChoice)}>
                <SelectTrigger id="crop-format" className="mt-1.5 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FORMAT_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {lossy && (
              <div className="min-w-56 flex-1">
                <div className="flex items-center justify-between">
                  <Label htmlFor="crop-quality">Quality</Label>
                  <span className="text-[12.5px] font-bold text-mint-deep dark:text-mint">
                    {qualityPct}
                  </span>
                </div>
                <input
                  id="crop-quality"
                  type="range"
                  min={40}
                  max={100}
                  value={qualityPct}
                  onChange={(e) => setQualityPct(Number(e.target.value))}
                  className="mt-3 w-full accent-primary"
                />
              </div>
            )}

            <Button
              type="button"
              onClick={download}
              disabled={saving}
              className="ml-auto gap-1.5"
            >
              {saving ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Download className="size-4" aria-hidden="true" />
              )}
              Download
            </Button>
          </div>

          <p className="text-[12.5px] text-muted-foreground">
            <CropIcon className="mr-1 inline size-3.5" aria-hidden="true" />
            Selection: {Math.round(crop.w)} × {Math.round(crop.h)} px of{" "}
            {rw} × {rh} px —{" "}
            {rw * rh > MAX_OUTPUT_PIXELS ? (
              <span className="font-medium text-amber-700 dark:text-amber-400">
                this image exceeds the browser&apos;s ~
                {Math.round(MAX_OUTPUT_PIXELS / 1_000_000)} MP canvas cap, so the
                download is scaled to the largest browser-safe size.
              </span>
            ) : (
              "the download comes out at the full resolution of your selection."
            )}
          </p>
        </section>
      )}
    </div>
  );
}
