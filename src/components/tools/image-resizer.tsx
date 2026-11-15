"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  Crop,
  Download,
  LayoutGrid,
  Loader2,
  Maximize2,
  MoveHorizontal,
  Percent,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  detectWebpEncode,
  downloadBlob,
  encodeImage,
  formatBytes,
  loadImageFile,
  outputFilename,
  resolveMime,
  zipAndDownload,
  FORMAT_OPTIONS,
  type FormatChoice,
} from "./image-utils";

type Mode = "percentage" | "oneSide" | "exact" | "fit" | "preset";

const MODES: { value: Mode; label: string; icon: typeof Crop }[] = [
  { value: "percentage", label: "Percentage", icon: Percent },
  { value: "oneSide", label: "One side", icon: MoveHorizontal },
  { value: "exact", label: "Exact size", icon: Crop },
  { value: "fit", label: "Fit inside", icon: Maximize2 },
  { value: "preset", label: "Presets", icon: LayoutGrid },
];

/** platform-published social sizes — exact crops unless noted */
const SOCIAL_PRESETS = [
  { key: "1080x1080", label: "Instagram post", w: 1080, h: 1080 },
  { key: "1080x1350", label: "Instagram portrait", w: 1080, h: 1350 },
  { key: "1080x1920", label: "Story / Reels", w: 1080, h: 1920 },
  { key: "1280x720", label: "YouTube thumbnail", w: 1280, h: 720 },
  { key: "1200x630", label: "Facebook post", w: 1200, h: 630 },
  { key: "1600x900", label: "X (Twitter) post", w: 1600, h: 900 },
  { key: "1200x627", label: "LinkedIn post", w: 1200, h: 627 },
  { key: "1000x1500", label: "Pinterest pin", w: 1000, h: 1500 },
  { key: "1920x1080", label: "Full HD", w: 1920, h: 1080 },
  { key: "3840x2160", label: "4K", w: 3840, h: 2160 },
];

const PERCENT_CHIPS = [25, 50, 75, 100, 150, 200];

const GIF_NOTE =
  "Animated GIF: only the first frame is kept (browsers cannot re-encode animation).";

interface ResultItem {
  blob: Blob;
  previewUrl: string;
  name: string;
  size: number;
  width: number;
  height: number;
  mime: string;
  note?: string;
}

interface QueueItem {
  id: number;
  file: File;
  previewUrl: string;
  width: number;
  height: number;
  status: "queued" | "working" | "done" | "error";
  result?: ResultItem;
  error?: string;
}

/** what one image's target becomes, derived from the current settings */
interface TargetDims {
  width: number;
  height: number;
  fit: "stretch" | "cover";
  suffix: string;
  note?: string;
  /** true = don't touch the pixels, the image already satisfies the request */
  skip: boolean;
}

export function ImageResizer() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [zipping, setZipping] = useState(false);
  const [mode, setMode] = useState<Mode>("percentage");
  const [percent, setPercent] = useState(50);
  const [side, setSide] = useState<"w" | "h">("w");
  const [sidePx, setSidePx] = useState("1080");
  const [exactW, setExactW] = useState("1080");
  const [exactH, setExactH] = useState("1080");
  const [keepAspect, setKeepAspect] = useState(true);
  const [fitW, setFitW] = useState("1920");
  const [fitH, setFitH] = useState("1080");
  const [presetKey, setPresetKey] = useState<string | null>(null);
  const [format, setFormat] = useState<FormatChoice>("keep");
  const [qualityPct, setQualityPct] = useState(90);
  const [matte, setMatte] = useState("#FFFFFF");
  const [allowEnlarging, setAllowEnlarging] = useState(false);
  const [webpOk, setWebpOk] = useState(true);
  const idRef = useRef(0);

  useEffect(() => {
    void detectWebpEncode().then(setWebpOk);
  }, []);

  const updateItem = useCallback((id: number, patch: Partial<QueueItem>) => {
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
          status: "queued" as const,
        })),
      ]);
      images.forEach((file, i) => {
        void loadImageFile(file).then(
          ({ width, height }) => updateItem(startId + i, { width, height }),
          () =>
            updateItem(startId + i, {
              status: "error",
              error:
                file.type === "image/heic" || file.type === "image/heif"
                  ? "HEIC isn't supported by this browser — share the photo as JPEG from your iPhone first."
                  : "This browser couldn't read the image — the file may be damaged.",
            }),
        );
      });
    },
    [updateItem],
  );

  const removeItem = (id: number) => {
    const target = items.find((i) => i.id === id);
    if (target) {
      URL.revokeObjectURL(target.previewUrl);
      if (target.result) URL.revokeObjectURL(target.result.previewUrl);
    }
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const clearAll = () => {
    items.forEach((i) => {
      URL.revokeObjectURL(i.previewUrl);
      if (i.result) URL.revokeObjectURL(i.result.previewUrl);
    });
    setItems([]);
  };

  /* ── settings validation + per-image target maths ── */

  const toPx = (value: string): number => {
    const parsed = parseInt(value, 10);
    return Number.isFinite(parsed) && parsed >= 1 ? parsed : 0;
  };

  const settingsReady =
    mode === "percentage"
      ? true
      : mode === "oneSide"
        ? toPx(sidePx) > 0
        : mode === "exact"
          ? toPx(exactW) > 0 && toPx(exactH) > 0
          : mode === "fit"
            ? toPx(fitW) > 0 && toPx(fitH) > 0
            : presetKey !== null;

  function computeTarget(w: number, h: number): TargetDims {
    if (mode === "percentage") {
      const tw = Math.max(1, Math.round((w * percent) / 100));
      const th = Math.max(1, Math.round((h * percent) / 100));
      const enlarged = tw > w || th > h;
      return {
        width: tw,
        height: th,
        fit: "stretch",
        suffix: `-${percent}pct`,
        skip: enlarged && !allowEnlarging,
        note: enlarged
          ? allowEnlarging
            ? "Enlarged — small images may soften when scaled up."
            : `Already ${w} × ${h} — growing it to ${percent}% needs “Allow enlarging”. Kept the original.`
          : undefined,
      };
    }
    if (mode === "oneSide") {
      const value = toPx(sidePx);
      const tw =
        side === "w" ? value : Math.max(1, Math.round((w * value) / h));
      const th =
        side === "h" ? value : Math.max(1, Math.round((h * value) / w));
      const enlarged = tw > w || th > h;
      return {
        width: tw,
        height: th,
        fit: "stretch",
        suffix: `-${tw}x${th}`,
        skip: enlarged && !allowEnlarging,
        note: enlarged
          ? allowEnlarging
            ? "Enlarged — small images may soften when scaled up."
            : `Already ${w} × ${h} — reaching ${tw} × ${th} needs “Allow enlarging”. Kept the original.`
          : undefined,
      };
    }
    if (mode === "exact") {
      const tw = toPx(exactW);
      const th = toPx(exactH);
      const enlarged = tw > w || th > h;
      return {
        width: tw,
        height: th,
        fit: keepAspect ? "cover" : "stretch",
        suffix: `-${tw}x${th}`,
        skip: enlarged && !allowEnlarging,
        note: enlarged
          ? allowEnlarging
            ? "Enlarged to reach the exact size — quality may soften."
            : `Already ${w} × ${h} — reaching ${tw} × ${th} needs “Allow enlarging”. Kept the original.`
          : keepAspect
            ? "Centred crop — the edge is trimmed to hit the exact size."
            : "Stretched to the exact size — proportions may look distorted.",
      };
    }
    if (mode === "fit") {
      const boxW = toPx(fitW);
      const boxH = toPx(fitH);
      const scale = Math.min(boxW / w, boxH / h);
      const tw = Math.max(1, Math.round(w * scale));
      const th = Math.max(1, Math.round(h * scale));
      const enlarged = tw > w || th > h;
      return {
        width: tw,
        height: th,
        fit: "stretch",
        suffix: `-${tw}x${th}`,
        skip: enlarged && !allowEnlarging,
        note: enlarged
          ? `Already fits inside ${boxW} × ${boxH} — kept the original size.`
          : undefined,
      };
    }
    /* preset: exact social size, centred crop — honour Allow enlarging */
    const preset = SOCIAL_PRESETS.find((p) => p.key === presetKey)!;
    const presetEnlarged = preset.w > w || preset.h > h;
    return {
      width: preset.w,
      height: preset.h,
      fit: "cover",
      suffix: `-${preset.w}x${preset.h}`,
      skip: presetEnlarged && !allowEnlarging,
      note: presetEnlarged
        ? allowEnlarging
          ? "Enlarged to reach the exact size — quality may soften."
          : `Already ${w} × ${h} — reaching ${preset.w} × ${preset.h} needs “Allow enlarging”. Kept the original.`
        : "Centred crop — the edge is trimmed to hit the exact size.",
    };
  }

  const queued = items.filter((i) => i.status === "queued");
  const done = items.filter((i) => i.status === "done" && i.result);

  const run = async () => {
    if (queued.length === 0 || !settingsReady) return;
    setBusy(true);
    let okCount = 0;
    for (const item of queued) {
      updateItem(item.id, { status: "working", result: undefined });
      try {
        const target = computeTarget(item.width, item.height);
        const mime = resolveMime(item.file.type, format);
        const background = mime === "image/jpeg" ? matte : undefined;
        const gif = item.file.type === "image/gif";
        let outcome: Omit<ResultItem, "name">;

        if (target.skip && format === "keep") {
          /* the image already satisfies the request — hand back the original */
          outcome = {
            blob: item.file,
            previewUrl: item.previewUrl,
            size: item.file.size,
            width: item.width,
            height: item.height,
            mime: item.file.type,
            note: target.note,
          };
        } else {
          const width = target.skip ? item.width : target.width;
          const height = target.skip ? item.height : target.height;
          const fit = target.skip ? "stretch" : target.fit;
          const encoded = await encodeImage(
            (await loadImageFile(item.file)).img,
            {
              width,
              height,
              fit,
              background,
              mime,
              quality: qualityPct / 100,
            },
          );
          const keepOriginal =
            format === "keep" &&
            encoded.width === item.width &&
            encoded.height === item.height &&
            encoded.blob.size >= item.file.size;
          outcome = keepOriginal
            ? {
                blob: item.file,
                previewUrl: item.previewUrl,
                size: item.file.size,
                width: item.width,
                height: item.height,
                mime: item.file.type,
                note: target.note ?? "Kept the original — it was already ideal.",
              }
            : {
                blob: encoded.blob,
                previewUrl: URL.createObjectURL(encoded.blob),
                size: encoded.blob.size,
                width: encoded.width,
                height: encoded.height,
                mime: encoded.mime,
                note: [target.note, gif ? GIF_NOTE : undefined]
                  .filter(Boolean)
                  .join(" ") || undefined,
              };
        }
        /* the handed-back original keeps its own name; anything else gets
           a suffix with the new dimensions */
        const name = outputFilename(
          item.file.name,
          outcome.blob === item.file ? "" : target.suffix,
          outcome.mime,
        );
        updateItem(item.id, { status: "done", result: { ...outcome, name } });
        okCount += 1;
      } catch {
        updateItem(item.id, {
          status: "error",
          error: "This image couldn't be processed — the file may be damaged.",
        });
      }
    }
    setBusy(false);
    if (okCount > 0) {
      toast.success(`Resized ${okCount} image${okCount > 1 ? "s" : ""}`, {
        description: "Processed on your device — nothing was uploaded.",
      });
    }
  };

  const showQuality = format !== "image/png";
  const showMatte =
    format === "image/jpeg" ||
    (format === "keep" && queued.some((i) => i.file.type === "image/jpeg"));

  const resultName = (item: QueueItem) => item.result!.name;

  return (
    <div className="flex flex-col gap-4">
      <ImageDropZone onFiles={addFiles} compact={items.length > 0} />

      {items.length > 0 && (
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5"
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
                <p
                  className={`text-[12px] leading-relaxed ${
                    item.status === "error" ? "text-destructive" : "text-muted-foreground"
                  }`}
                >
                  {item.status === "error"
                    ? item.error
                    : item.width > 0
                      ? `${item.width} × ${item.height} · ${formatBytes(item.file.size)}`
                      : "Reading…"}
                </p>
              </div>
              {item.status === "working" && (
                <Loader2 className="size-4 shrink-0 animate-spin text-primary" aria-hidden="true" />
              )}
              {item.status === "done" && (
                <CheckCircle2 className="size-4 shrink-0 text-mint" aria-hidden="true" />
              )}
              <button
                type="button"
                onClick={() => removeItem(item.id)}
                aria-label={`Remove ${item.file.name}`}
                className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {items.length > 0 && (
        <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5">
          {/* sizing mode */}
          <div
            className="grid grid-cols-3 gap-1.5 rounded-xl bg-secondary p-1.5 sm:grid-cols-5"
            role="tablist"
            aria-label="Resize mode"
          >
            {MODES.map((m) => (
              <button
                key={m.value}
                type="button"
                role="tab"
                aria-selected={mode === m.value}
                onClick={() => setMode(m.value)}
                className={`flex items-center justify-center gap-1.5 rounded-lg px-1.5 py-2 text-[12px] font-bold transition-colors ${
                  mode === m.value
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <m.icon className="size-4 shrink-0" aria-hidden="true" />
                {m.label}
              </button>
            ))}
          </div>

          {mode === "percentage" && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="ir-scale">Scale</Label>
                <span className="font-display text-[13px] font-bold text-foreground">
                  {percent}%
                </span>
              </div>
              <input
                id="ir-scale"
                type="range"
                min={10}
                max={400}
                step={5}
                value={percent}
                onChange={(e) => setPercent(parseInt(e.target.value, 10))}
                className="h-2 w-full cursor-pointer accent-primary"
              />
              <div className="flex flex-wrap gap-1.5">
                {PERCENT_CHIPS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPercent(p)}
                    className={`rounded-full border px-3 py-1.5 text-[12px] font-bold transition-colors ${
                      percent === p
                        ? "border-primary bg-secondary text-foreground"
                        : "border-border text-muted-foreground hover:border-primary/60 hover:text-foreground"
                    }`}
                  >
                    {p}%
                  </button>
                ))}
              </div>
            </div>
          )}

          {mode === "oneSide" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ir-side">Set</Label>
                <Select
                  value={side}
                  onValueChange={(v) => setSide(v as "w" | "h")}
                >
                  <SelectTrigger id="ir-side" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="w">Width — height follows</SelectItem>
                    <SelectItem value="h">Height — width follows</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ir-sidepx">
                  {side === "w" ? "Width" : "Height"} (pixels)
                </Label>
                <Input
                  id="ir-sidepx"
                  type="number"
                  min={1}
                  max={20000}
                  value={sidePx}
                  onChange={(e) => setSidePx(e.target.value)}
                />
              </div>
            </div>
          )}

          {mode === "exact" && (
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="ir-exactw">Width (px)</Label>
                  <Input
                    id="ir-exactw"
                    type="number"
                    min={1}
                    max={20000}
                    value={exactW}
                    onChange={(e) => setExactW(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="ir-exacth">Height (px)</Label>
                  <Input
                    id="ir-exacth"
                    type="number"
                    min={1}
                    max={20000}
                    value={exactH}
                    onChange={(e) => setExactH(e.target.value)}
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={() => setKeepAspect((v) => !v)}
                className={`self-start rounded-full border px-3.5 py-1.5 text-[12px] font-bold transition-colors ${
                  keepAspect
                    ? "border-primary bg-secondary text-foreground"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {keepAspect
                  ? "Keep aspect ratio — centred crop (recommended)"
                  : "Stretch to fill — may distort"}
              </button>
            </div>
          )}

          {mode === "fit" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ir-fitw">Box width (px)</Label>
                <Input
                  id="ir-fitw"
                  type="number"
                  min={1}
                  max={20000}
                  value={fitW}
                  onChange={(e) => setFitW(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ir-fith">Box height (px)</Label>
                <Input
                  id="ir-fith"
                  type="number"
                  min={1}
                  max={20000}
                  value={fitH}
                  onChange={(e) => setFitH(e.target.value)}
                />
              </div>
            </div>
          )}

          {mode === "preset" && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {SOCIAL_PRESETS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => setPresetKey(p.key)}
                  className={`rounded-xl border p-3 text-left transition-colors ${
                    presetKey === p.key
                      ? "border-primary bg-secondary"
                      : "border-border hover:border-primary/60"
                  }`}
                >
                  <p className="font-display text-[12.5px] font-bold text-foreground">
                    {p.label}
                  </p>
                  <p className="mt-0.5 text-[11.5px] text-muted-foreground">
                    {p.w} × {p.h}
                  </p>
                </button>
              ))}
            </div>
          )}

          {/* format + quality */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ir-format">Output format</Label>
              <Select value={format} onValueChange={(v) => setFormat(v as FormatChoice)}>
                <SelectTrigger id="ir-format" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FORMAT_OPTIONS.map((f) => (
                    <SelectItem
                      key={f.value}
                      value={f.value}
                      disabled={f.value === "image/webp" && !webpOk}
                    >
                      {f.label}
                      {f.value === "image/webp" && !webpOk
                        ? " (not supported by this browser)"
                        : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {showQuality && (
              <div className="flex flex-col justify-end gap-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="ir-quality">Quality</Label>
                  <span className="font-display text-[13px] font-bold text-foreground">
                    {qualityPct}
                  </span>
                </div>
                <input
                  id="ir-quality"
                  type="range"
                  min={10}
                  max={100}
                  step={1}
                  value={qualityPct}
                  onChange={(e) => setQualityPct(parseInt(e.target.value, 10))}
                  className="h-2 w-full cursor-pointer accent-primary"
                />
              </div>
            )}
          </div>

          {showMatte && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ir-matte">Background for transparent areas</Label>
              <div className="flex items-center gap-2 rounded-lg border border-input px-2.5 py-1.5">
                <input
                  id="ir-matte"
                  type="color"
                  value={matte}
                  onChange={(e) => setMatte(e.target.value)}
                  className="size-7 cursor-pointer rounded-md border-0 bg-transparent p-0"
                  aria-label="Background colour for transparent areas"
                />
                <span className="font-mono text-[12.5px] uppercase text-muted-foreground">
                  {matte}
                </span>
                <span className="text-[11.5px] text-muted-foreground">
                  — used when saving as JPG (JPG has no transparency)
                </span>
              </div>
            </div>
          )}

          <label className="flex cursor-pointer items-center gap-2.5 text-[12.5px] font-medium text-foreground">
            <input
              type="checkbox"
              checked={allowEnlarging}
              onChange={(e) => setAllowEnlarging(e.target.checked)}
              className="size-4 cursor-pointer accent-primary"
            />
            Allow enlarging — upscale smaller images instead of keeping them
          </label>
        </div>
      )}

      {/* actions */}
      <div className="flex flex-wrap items-center gap-2.5">
        <Button
          type="button"
          onClick={run}
          disabled={busy || queued.length === 0 || !settingsReady}
          className="flex-1 sm:flex-none"
        >
          {busy ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Resizing…
            </>
          ) : (
            <>
              Resize {queued.length > 0 ? `${queued.length} image${queued.length > 1 ? "s" : ""}` : "images"}
            </>
          )}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={clearAll}
          disabled={busy || items.length === 0}
          className="gap-1.5 text-muted-foreground"
        >
          <Trash2 className="size-4" aria-hidden="true" />
          Start over
        </Button>
      </div>

      {!settingsReady && items.length > 0 && (
        <p className="text-[12px] font-medium text-destructive">
          {mode === "preset"
            ? "Pick one of the size presets first."
            : "Enter the target size first (whole pixels, 1 or more)."}
        </p>
      )}

      {/* results */}
      {done.length > 0 && (
        <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div>
              <h3 className="font-display text-[15px] font-bold text-foreground">
                Results
              </h3>
              <p className="mt-0.5 text-[12.5px] text-muted-foreground">
                {done.length} image{done.length > 1 ? "s" : ""} resized
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={zipping}
              onClick={async () => {
                if (done.length === 1) {
                  downloadBlob(done[0].result!.blob, resultName(done[0]));
                  return;
                }
                setZipping(true);
                try {
                  await zipAndDownload(
                    done.map((i) => ({
                      blob: i.result!.blob,
                      name: resultName(i),
                    })),
                    "freeseak-resized-images.zip",
                    { store: true },
                  );
                } catch {
                  toast.error(
                    "Couldn't build the zip — download the images one by one.",
                  );
                } finally {
                  setZipping(false);
                }
              }}
            >
              {zipping ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Download className="size-3.5" aria-hidden="true" />
              )}
              {done.length > 1 ? "Download all (.zip)" : "Download"}
            </Button>
          </div>

          <ul className="flex flex-col gap-2">
            {done.map((item) => {
              const result = item.result!;
              const converted = result.mime !== item.file.type;
              return (
                <li
                  key={item.id}
                  className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5"
                >
                  <img
                    src={result.previewUrl}
                    alt=""
                    className="size-11 shrink-0 rounded-lg border border-border object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-foreground">
                      {resultName(item)}
                    </p>
                    <p className="text-[12px] text-muted-foreground">
                      {item.width} × {item.height} → {result.width} × {result.height}
                      {converted && (
                        <span className="ml-1.5 font-bold text-primary">
                          {extFor(item.file.type).toUpperCase()} →{" "}
                          {extFor(result.mime).toUpperCase()}
                        </span>
                      )}
                      {" · "}
                      {formatBytes(result.size)}
                    </p>
                    {result.note && (
                      <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted-foreground">
                        {result.note}
                      </p>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => downloadBlob(result.blob, resultName(item))}
                  >
                    <Download className="size-3.5" aria-hidden="true" />
                    Download
                  </Button>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}

/** short label for the format-change indicator */
function extFor(mime: string): string {
  return mime === "image/jpeg"
    ? "JPG"
    : mime === "image/png"
      ? "PNG"
      : mime === "image/webp"
        ? "WebP"
        : mime === "image/gif"
          ? "GIF"
          : "IMG";
}
