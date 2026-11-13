"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  Download,
  Loader2,
  SlidersHorizontal,
  Target,
  Trash2,
  Wand2,
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
  dimsForMaxDim,
  downloadAllBlobs,
  downloadBlob,
  encodeImage,
  encodeToTarget,
  formatBytes,
  loadImageFile,
  outputFilename,
  resolveMime,
  FORMAT_OPTIONS,
  type FormatChoice,
} from "./image-utils";

type Mode = "quality" | "target" | "preset";
type PresetKey = "web" | "high" | "smallest";

const MODES: { value: Mode; label: string; icon: typeof Target }[] = [
  { value: "quality", label: "Quality", icon: SlidersHorizontal },
  { value: "target", label: "Target size", icon: Target },
  { value: "preset", label: "Presets", icon: Wand2 },
];

const PRESETS: Record<
  PresetKey,
  { label: string; blurb: string; quality: number; maxDim: number | null }
> = {
  web: {
    label: "Web & email",
    blurb: "1920 px max · strong compression — websites and attachments",
    quality: 0.78,
    maxDim: 1920,
  },
  high: {
    label: "High quality",
    blurb: "Full resolution · light compression — photos keep their shine",
    quality: 0.92,
    maxDim: null,
  },
  smallest: {
    label: "Smallest file",
    blurb: "1280 px max · heavy compression — strict size limits",
    quality: 0.55,
    maxDim: 1280,
  },
};

const SIZE_CAPS = [
  { value: "0", label: "Original size" },
  { value: "2560", label: "Max 2560 px" },
  { value: "1920", label: "Max 1920 px" },
  { value: "1280", label: "Max 1280 px" },
  { value: "1024", label: "Max 1024 px" },
  { value: "800", label: "Max 800 px" },
  { value: "640", label: "Max 640 px" },
];

const TARGET_CHIPS = [
  { kb: 50, label: "50 KB" },
  { kb: 100, label: "100 KB" },
  { kb: 200, label: "200 KB" },
  { kb: 500, label: "500 KB" },
  { kb: 1024, label: "1 MB" },
];

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

function qualityHint(q: number): string {
  if (q < 40) return "Tiny files — some visible quality loss";
  if (q < 70) return "Compact — good for previews and thumbnails";
  if (q < 90) return "Balanced — great for web and email";
  return "Near-original quality";
}

export function ImageCompressor() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<Mode>("quality");
  const [qualityPct, setQualityPct] = useState(80);
  const [targetKB, setTargetKB] = useState(100);
  const [preset, setPreset] = useState<PresetKey>("web");
  const [format, setFormat] = useState<FormatChoice>("keep");
  const [sizeCap, setSizeCap] = useState("0");
  const [matte, setMatte] = useState("#FFFFFF");
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
      /* read dimensions up front — and surface unreadable files immediately */
      images.forEach((file, i) => {
        void loadImageFile(file).then(
          ({ width, height }) =>
            updateItem(startId + i, { width, height }),
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

  const queued = items.filter((i) => i.status === "queued");
  const done = items.filter((i) => i.status === "done" && i.result);
  const totalBefore = done.reduce((sum, i) => sum + i.file.size, 0);
  const totalAfter = done.reduce((sum, i) => sum + (i.result?.size ?? 0), 0);
  const savedPct =
    totalBefore > 0 ? Math.round((1 - totalAfter / totalBefore) * 100) : 0;

  const run = async () => {
    if (queued.length === 0) return;
    setBusy(true);
    let okCount = 0;
    const suffix =
      mode === "target"
        ? `-${targetKB}kb`
        : mode === "preset"
          ? `-${preset}`
          : "-compressed";
    for (const item of queued) {
      updateItem(item.id, { status: "working", result: undefined });
      try {
        const { img } = await loadImageFile(item.file);
        const mime = resolveMime(item.file.type, format);
        const background = mime === "image/jpeg" ? matte : undefined;
        const gif = item.file.type === "image/gif";
        let outcome: Omit<ResultItem, "name">;

        if (
          mode === "target" &&
          format === "keep" &&
          item.file.size <= targetKB * 1024
        ) {
          /* the original already fits the budget — never hand back a worse file */
          outcome = {
            blob: item.file,
            previewUrl: item.previewUrl,
            size: item.file.size,
            width: item.width,
            height: item.height,
            mime: item.file.type,
            note: `Already ${formatBytes(item.file.size)} — under your ${targetKB} KB target, so the original is kept untouched.`,
          };
        } else if (mode === "target") {
          const attempt = await encodeToTarget(img, {
            targetBytes: targetKB * 1024,
            mime,
            maxDim: sizeCap !== "0" ? parseInt(sizeCap, 10) : undefined,
            background,
          });
          outcome = {
            blob: attempt.image.blob,
            previewUrl: URL.createObjectURL(attempt.image.blob),
            size: attempt.image.blob.size,
            width: attempt.image.width,
            height: attempt.image.height,
            mime: attempt.image.mime,
            note:
              [
                attempt.hitTarget
                  ? undefined
                  : `Couldn't reach ${targetKB} KB exactly — ${formatBytes(attempt.image.blob.size)} is the closest possible. Try WebP, or set a size cap below.`,
                gif ? GIF_NOTE : undefined,
              ]
                .filter(Boolean)
                .join(" ") || undefined,
          };
        } else {
          const settings =
            mode === "preset"
              ? { quality: PRESETS[preset].quality, maxDim: PRESETS[preset].maxDim }
              : { quality: qualityPct / 100, maxDim: sizeCap !== "0" ? parseInt(sizeCap, 10) : null };
          const dims = dimsForMaxDim(item.width, item.height, settings.maxDim);
          const encoded = await encodeImage(img, {
            width: dims.width,
            height: dims.height,
            fit: "stretch",
            background,
            mime,
            quality: settings.quality,
          });
          /* never leave empty-handed: if nothing changed and re-encoding
             made it bigger, hand back the original file */
          const keepOriginal =
            format === "keep" &&
            dims.width === item.width &&
            dims.height === item.height &&
            encoded.blob.size >= item.file.size;
          outcome = keepOriginal
            ? {
                blob: item.file,
                previewUrl: item.previewUrl,
                size: item.file.size,
                width: item.width,
                height: item.height,
                mime: item.file.type,
                note: "Already well optimized — your original is the smallest version, so it's kept untouched.",
              }
            : {
                blob: encoded.blob,
                previewUrl: URL.createObjectURL(encoded.blob),
                size: encoded.blob.size,
                width: encoded.width,
                height: encoded.height,
                mime: encoded.mime,
                note: gif ? GIF_NOTE : undefined,
              };
        }
        /* the handed-back original keeps its own name; anything else gets
           a suffix describing the settings it was compressed with */
        const name = outputFilename(
          item.file.name,
          outcome.blob === item.file ? "" : suffix,
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
      toast.success(`Compressed ${okCount} image${okCount > 1 ? "s" : ""}`, {
        description: "Processed on your device — nothing was uploaded.",
      });
    }
  };

  const pngQueued =
    format === "image/png" ||
    (format === "keep" && queued.some((i) => i.file.type === "image/png"));
  const showMatte =
    format === "image/jpeg" ||
    (format === "keep" && queued.some((i) => i.file.type === "image/jpeg"));

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
          {/* compression mode */}
          <div
            className="grid grid-cols-3 gap-1.5 rounded-xl bg-secondary p-1.5"
            role="tablist"
            aria-label="Compression mode"
          >
            {MODES.map((m) => (
              <button
                key={m.value}
                type="button"
                role="tab"
                aria-selected={mode === m.value}
                onClick={() => setMode(m.value)}
                className={`flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-[12.5px] font-bold transition-colors ${
                  mode === m.value
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <m.icon className="size-4" aria-hidden="true" />
                {m.label}
              </button>
            ))}
          </div>

          {mode === "quality" && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="ic-quality">Quality</Label>
                <span className="font-display text-[13px] font-bold text-foreground">
                  {qualityPct}
                </span>
              </div>
              <input
                id="ic-quality"
                type="range"
                min={10}
                max={100}
                step={1}
                value={qualityPct}
                onChange={(e) => setQualityPct(parseInt(e.target.value, 10))}
                className="h-2 w-full cursor-pointer accent-primary"
              />
              <p className="text-[12px] text-muted-foreground">
                {qualityHint(qualityPct)}
              </p>
            </div>
          )}

          {mode === "target" && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="ic-target">Target file size</Label>
              <div className="flex items-center gap-2.5">
                <Input
                  id="ic-target"
                  type="number"
                  min={5}
                  max={100000}
                  value={targetKB}
                  onChange={(e) =>
                    setTargetKB(
                      Math.max(5, Math.min(100000, parseInt(e.target.value, 10) || 5)),
                    )
                  }
                  className="w-28"
                />
                <span className="text-[13px] font-semibold text-muted-foreground">KB</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {TARGET_CHIPS.map((c) => (
                  <button
                    key={c.kb}
                    type="button"
                    onClick={() => setTargetKB(c.kb)}
                    className={`rounded-full border px-3 py-1.5 text-[12px] font-bold transition-colors ${
                      targetKB === c.kb
                        ? "border-primary bg-secondary text-foreground"
                        : "border-border text-muted-foreground hover:border-primary/60 hover:text-foreground"
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
              <p className="text-[12px] leading-relaxed text-muted-foreground">
                We find the highest quality that fits your size — perfect for
                upload limits and email attachments. If the target is impossible,
                you get the closest possible file, never an error.
              </p>
            </div>
          )}

          {mode === "preset" && (
            <div className="grid gap-2 sm:grid-cols-3">
              {(Object.keys(PRESETS) as PresetKey[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setPreset(key)}
                  className={`rounded-xl border p-3.5 text-left transition-colors ${
                    preset === key
                      ? "border-primary bg-secondary"
                      : "border-border hover:border-primary/60"
                  }`}
                >
                  <p className="font-display text-[13px] font-bold text-foreground">
                    {PRESETS[key].label}
                  </p>
                  <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">
                    {PRESETS[key].blurb}
                  </p>
                </button>
              ))}
            </div>
          )}

          {/* format + size cap */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ic-format">Output format</Label>
              <Select value={format} onValueChange={(v) => setFormat(v as FormatChoice)}>
                <SelectTrigger id="ic-format" className="w-full">
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
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ic-cap">Resize large images</Label>
              <Select value={sizeCap} onValueChange={setSizeCap}>
                <SelectTrigger id="ic-cap" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SIZE_CAPS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {pngQueued && (
            <p className="text-[12px] leading-relaxed text-muted-foreground">
              PNG is lossless — re-encoding alone barely shrinks it. Pick a size
              cap above or choose JPG / WebP for real savings.
            </p>
          )}

          {showMatte && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ic-matte">Background for transparent areas</Label>
              <div className="flex items-center gap-2 rounded-lg border border-input px-2.5 py-1.5">
                <input
                  id="ic-matte"
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
        </div>
      )}

      {/* actions */}
      <div className="flex flex-wrap items-center gap-2.5">
        <Button
          type="button"
          onClick={run}
          disabled={busy || queued.length === 0}
          className="flex-1 sm:flex-none"
        >
          {busy ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Compressing…
            </>
          ) : (
            <>Compress {queued.length > 0 ? `${queued.length} image${queued.length > 1 ? "s" : ""}` : "images"}</>
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

      {/* results */}
      {done.length > 0 && (
        <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div>
              <h3 className="font-display text-[15px] font-bold text-foreground">
                Results
              </h3>
              <p className="mt-0.5 text-[12.5px] text-muted-foreground">
                {done.length} image{done.length > 1 ? "s" : ""} ·{" "}
                {formatBytes(totalBefore)} → {formatBytes(totalAfter)}{" "}
                {savedPct > 0 && (
                  <span className="font-bold text-mint-deep dark:text-mint">
                    · {savedPct}% smaller
                  </span>
                )}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                downloadAllBlobs(
                  done.map((i) => ({
                    blob: i.result!.blob,
                    name: i.result!.name,
                  })),
                )
              }
            >
              <Download className="size-3.5" aria-hidden="true" />
              Download all
            </Button>
          </div>

          <ul className="flex flex-col gap-2">
            {done.map((item) => {
              const result = item.result!;
              const smaller = result.size < item.file.size;
              const pct = smaller
                ? Math.round((1 - result.size / item.file.size) * 100)
                : 0;
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
                      {result.name}
                    </p>
                    <p className="text-[12px] text-muted-foreground">
                      {formatBytes(item.file.size)} → {formatBytes(result.size)}
                      {result.width !== item.width && (
                        <> · {result.width} × {result.height}</>
                      )}
                      {smaller && (
                        <span className="ml-1.5 font-bold text-mint-deep dark:text-mint">
                          −{pct}%
                        </span>
                      )}
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
                    onClick={() =>
                      downloadBlob(result.blob, result.name)
                    }
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
