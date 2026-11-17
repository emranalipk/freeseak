"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, Download, Loader2, Repeat, Trash2, X } from "lucide-react";
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
  encodeImage,
  formatBytes,
  loadImageFile,
  outputFilename,
  zipAndDownload,
  type OutputMime,
} from "./image-utils";

/**
 * FreeSeak — Image Converter (v0.8.0).
 *
 * Batch-converts JPG, PNG, WebP, GIF and BMP images between formats,
 * entirely in the browser. AVIF appears only when the browser can really
 * encode it (runtime probe), so the option list never lies — and where a
 * browser silently swaps formats (old Safari and WebP), the honest actual
 * format is reported back, not the requested one.
 */

type TargetMime = OutputMime;

const FORMAT_LABELS: Record<TargetMime, string> = {
  "image/jpeg": "JPG — universal, works everywhere",
  "image/png": "PNG — lossless, keeps transparency",
  "image/webp": "WebP — modern, much smaller than JPG",
  "image/avif": "AVIF — newest, smallest of all",
};

const EXT_FOR: Record<TargetMime, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};

/** formats where the quality slider actually does something */
function isLossy(mime: TargetMime): boolean {
  return mime !== "image/png";
}

function qualityHint(q: number): string {
  if (q < 50) return "Small files — visible quality loss";
  if (q < 80) return "Compact — good for the web";
  if (q < 95) return "Balanced — great for photos";
  return "Near-lossless";
}

/** does THIS browser's canvas really encode AVIF? (Chrome/Edge: yes) */
async function detectAvifEncode(): Promise<boolean> {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 2;
    canvas.height = 2;
    return await new Promise<boolean>((resolve) => {
      canvas.toBlob(
        (blob) => resolve(!!blob && blob.type === "image/avif"),
        "image/avif",
        0.8,
      );
    });
  } catch {
    return false;
  }
}

interface ResultItem {
  blob: Blob;
  previewUrl: string;
  name: string;
  size: number;
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

export function ImageConverter() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [zipping, setZipping] = useState(false);
  const [format, setFormat] = useState<TargetMime>("image/webp");
  const [qualityPct, setQualityPct] = useState(90);
  const [avifSupported, setAvifSupported] = useState(false);
  const previewsRef = useRef<string[]>([]);
  const nextIdRef = useRef(1);

  /** format or quality changed → finished results are stale, requeue them */
  const requeueDone = useCallback(() => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.status !== "done" || !item.result) return item;
        /* passthrough results share the queue thumbnail's URL — only
           revoke result URLs this tool created itself */
        if (item.result.previewUrl !== item.previewUrl) {
          URL.revokeObjectURL(item.result.previewUrl);
        }
        return { ...item, status: "queued" as const, result: undefined };
      }),
    );
  }, []);

  useEffect(() => {
    detectAvifEncode().then(setAvifSupported);
  }, []);

  useEffect(
    () => () => {
      previewsRef.current.forEach((url) => URL.revokeObjectURL(url));
    },
    [],
  );

  const updateItem = useCallback((id: number, patch: Partial<QueueItem>) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  }, []);

  const addFiles = useCallback(
    async (files: File[]) => {
      const images = files.filter((f) => f.type.startsWith("image/"));
      if (images.length === 0) {
        toast.error("Those files aren't images", {
          description: "JPG, PNG, WebP, GIF, BMP and AVIF images are supported.",
        });
        return;
      }
      const added: QueueItem[] = [];
      for (const file of images) {
        try {
          const loaded = await loadImageFile(file);
          const previewUrl = URL.createObjectURL(file);
          previewsRef.current.push(previewUrl);
          added.push({
            id: nextIdRef.current++,
            file,
            previewUrl,
            width: loaded.width,
            height: loaded.height,
            status: "queued",
          });
        } catch {
          toast.error(`Couldn't read “${file.name}”`, {
            description: "The file may be corrupted or in an unsupported format.",
          });
        }
      }
      if (added.length > 0) setItems((prev) => [...prev, ...added]);
    },
    [],
  );

  const clearAll = useCallback(() => {
    setItems((prev) => {
      prev.forEach((item) => {
        URL.revokeObjectURL(item.previewUrl);
        if (item.result) URL.revokeObjectURL(item.result.previewUrl);
      });
      return [];
    });
  }, []);

  const convertAll = useCallback(async () => {
    const pending = items.filter((item) => item.status !== "done");
    if (pending.length === 0 || busy) return;
    setBusy(true);
    let okCount = 0;
    for (const item of pending) {
      updateItem(item.id, { status: "working" });
      try {
        const gifNote =
          item.file.type === "image/gif"
            ? "Animated GIF: only the first frame is kept (browsers cannot re-encode animation)."
            : undefined;

        if (item.file.type === format) {
          /* same format in and out: re-encoding would only cost quality —
             pass the original through untouched */
          updateItem(item.id, {
            status: "done",
            result: {
              blob: item.file,
              previewUrl: item.previewUrl,
              name: item.file.name,
              size: item.file.size,
              mime: item.file.type,
              note: `Already ${EXT_FOR[format].toUpperCase()} — passed through without re-compressing.`,
            },
          });
          okCount += 1;
          continue;
        }

        const loaded = await loadImageFile(item.file);
        const encoded = await encodeImage(loaded.img, {
          width: loaded.width,
          height: loaded.height,
          fit: "stretch",
          /* JPG has no transparency — matte it so transparent PNGs don't
             turn black when converted */
          ...(format === "image/jpeg" ? { background: "#ffffff" } : {}),
          mime: isLossy(format) ? format : "image/png",
          quality: qualityPct / 100,
        });
        /* old Safari silently hands back a PNG when asked for WebP —
           report the format that actually came out */
        const swapped = encoded.mime !== format;
        const name = outputFilename(item.file.name, "", encoded.mime);
        const previewUrl = URL.createObjectURL(encoded.blob);
        previewsRef.current.push(previewUrl);
        updateItem(item.id, {
          status: "done",
          result: {
            blob: encoded.blob,
            previewUrl,
            name,
            size: encoded.blob.size,
            mime: encoded.mime,
            note:
              [
                swapped
                  ? `This browser can't encode ${EXT_FOR[format].toUpperCase()} — saved as ${EXT_FOR[encoded.mime as TargetMime]?.toUpperCase() ?? encoded.mime.toUpperCase()} instead.`
                  : undefined,
                gifNote,
              ]
                .filter(Boolean)
                .join(" ") || undefined,
          },
        });
        okCount += 1;
      } catch {
        updateItem(item.id, {
          status: "error",
          error: "Couldn't convert this image — try a different format.",
        });
      }
    }
    setBusy(false);
    if (okCount > 0) {
      toast.success(`Converted ${okCount} image${okCount > 1 ? "s" : ""}`, {
        description: "Processed on your device — nothing was uploaded.",
      });
    }
  }, [items, busy, format, qualityPct, updateItem]);

  const done = items.filter((item) => item.status === "done" && item.result);
  const totalBefore = done.reduce((sum, i) => sum + i.file.size, 0);
  const totalAfter = done.reduce((sum, i) => sum + (i.result?.size ?? 0), 0);

  return (
    <div className="flex flex-col gap-4">
      <ImageDropZone onFiles={addFiles} compact={items.length > 0} />

      {items.length > 0 && (
        <section className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5">
          <div className="flex flex-wrap items-end gap-4">
            <div className="w-full max-w-72">
              <Label htmlFor="convert-format">Convert to</Label>
              <Select
                value={format}
                onValueChange={(v) => {
                  setFormat(v as TargetMime);
                  requeueDone();
                }}
              >
                <SelectTrigger id="convert-format" className="mt-1.5 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(FORMAT_LABELS) as TargetMime[])
                    .filter((mime) => mime !== "image/avif" || avifSupported)
                    .map((mime) => (
                      <SelectItem key={mime} value={mime}>
                        {FORMAT_LABELS[mime]}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {isLossy(format) && (
              <div className="min-w-56 flex-1">
                <div className="flex items-center justify-between">
                  <Label htmlFor="convert-quality">Quality</Label>
                  <span className="text-[12.5px] font-bold text-mint-deep dark:text-mint">
                    {qualityPct}
                  </span>
                </div>
                <input
                  id="convert-quality"
                  type="range"
                  min={40}
                  max={100}
                  value={qualityPct}
                  onChange={(e) => {
                    setQualityPct(Number(e.target.value));
                    requeueDone();
                  }}
                  className="mt-3 w-full accent-primary"
                />
                <p className="mt-1 text-[12px] text-muted-foreground">
                  {qualityHint(qualityPct)}
                </p>
              </div>
            )}

            {!isLossy(format) && (
              <p className="max-w-56 pb-2 text-[12.5px] text-muted-foreground">
                PNG is lossless — every pixel of your image is kept exactly.
              </p>
            )}

            <div className="ml-auto flex gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={clearAll}
                disabled={busy}
                className="gap-1.5 text-muted-foreground"
              >
                <Trash2 className="size-4" aria-hidden="true" />
                Start over
              </Button>
              <Button
                type="button"
                onClick={convertAll}
                disabled={busy || items.length === 0}
                className="gap-1.5"
              >
                {busy ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Repeat className="size-4" aria-hidden="true" />
                )}
                Convert {items.length > 0 ? `${items.length} image${items.length > 1 ? "s" : ""}` : ""}
              </Button>
            </div>
          </div>

          {!avifSupported && (
            <p className="text-[12.5px] text-muted-foreground">
              AVIF export needs a Chromium browser (Chrome, Edge, Brave) — this
              browser can't encode it, so the option is hidden rather than
              broken.
            </p>
          )}

          <ul className="flex flex-col gap-2">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5"
              >
                <img
                  src={item.previewUrl}
                  alt=""
                  className="size-11 rounded-lg border border-border object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-medium text-foreground">
                    {item.file.name}
                  </p>
                  <p className="mt-0.5 text-[12px] text-muted-foreground">
                    {item.width} × {item.height} · {formatBytes(item.file.size)}
                    {item.status === "done" && item.result && (
                      <>
                        {" → "}
                        <span className="font-medium text-mint-deep dark:text-mint">
                          {EXT_FOR[item.result.mime as TargetMime]?.toUpperCase() ??
                            item.result.mime.replace("image/", "").toUpperCase()}
                        </span>
                        {" · "}
                        {formatBytes(item.result.size)}
                      </>
                    )}
                    {item.status === "error" && item.error && (
                      <span className="text-red-600 dark:text-red-400">
                        {" "}{item.error}
                      </span>
                    )}
                    {item.result?.note && (
                      <span className="text-amber-600 dark:text-amber-400">
                        {" "}{item.result.note}
                      </span>
                    )}
                  </p>
                </div>
                {item.status === "done" && item.result && (
                  <div className="flex items-center gap-2">
                    <CheckCircle2
                      className="size-4 text-mint-deep dark:text-mint"
                      aria-hidden="true"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        downloadBlob(item.result!.blob, item.result!.name)
                      }
                    >
                      <Download className="size-3.5" aria-hidden="true" />
                      Download
                    </Button>
                  </div>
                )}
                {item.status === "working" && (
                  <Loader2
                    className="size-4 animate-spin text-primary"
                    aria-hidden="true"
                  />
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  aria-label={`Remove ${item.file.name}`}
                  onClick={() => {
                    URL.revokeObjectURL(item.previewUrl);
                    if (item.result) URL.revokeObjectURL(item.result.previewUrl);
                    setItems((prev) => prev.filter((i) => i.id !== item.id));
                  }}
                >
                  <X className="size-4" aria-hidden="true" />
                </Button>
              </li>
            ))}
          </ul>
        </section>
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
                {done.length} image{done.length > 1 ? "s" : ""} converted ·{" "}
                {formatBytes(totalBefore)} → {formatBytes(totalAfter)}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={zipping}
              onClick={async () => {
                if (done.length === 1) {
                  downloadBlob(done[0].result!.blob, done[0].result!.name);
                  return;
                }
                setZipping(true);
                try {
                  await zipAndDownload(
                    done.map((i) => ({
                      blob: i.result!.blob,
                      name: i.result!.name,
                    })),
                    "freeseak-converted-images.zip",
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
        </section>
      )}
    </div>
  );
}
