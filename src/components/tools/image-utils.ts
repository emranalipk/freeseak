/**
 * FreeSeak — the shared engine behind the image tools.
 *
 * Decode → canvas → re-encode, entirely in the browser: no file is ever
 * uploaded (PROJECT_RULES.md rule 5). Every tool that hands files back
 * to the user — images and PDFs alike — downloads through this module,
 * so the brand marker and the zip bundler live here exactly once.
 */

/** AVIF is encode-optional (Chromium only) — tools probe for it first */
export type OutputMime = "image/jpeg" | "image/png" | "image/webp" | "image/avif";

export type FormatChoice = "keep" | OutputMime;

/** options shared by both tools' format <Select> */
export const FORMAT_OPTIONS: { value: FormatChoice; label: string }[] = [
  { value: "keep", label: "Keep original format" },
  { value: "image/jpeg", label: "JPG — universal, small photos" },
  { value: "image/webp", label: "WebP — modern, very small" },
  { value: "image/png", label: "PNG — lossless, transparent" },
];

/** iOS Safari refuses canvases above ~16.7M pixels — stay safely under. */
const MAX_CANVAS_PIXELS = 16_777_216;

export interface LoadedImage {
  img: HTMLImageElement;
  width: number;
  height: number;
}

/** decode a File into an <img> (object URL is revoked after decoding) */
export function loadImageFile(file: File): Promise<LoadedImage> {
  const url = URL.createObjectURL(file);
  return new Promise<LoadedImage>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ img, width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("decode-failed"));
    };
    img.src = url;
  });
}

/** map "keep original" onto a format canvas can actually re-encode */
export function resolveMime(originalType: string, choice: FormatChoice): OutputMime {
  if (choice !== "keep") return choice;
  if (originalType === "image/png") return "image/png";
  if (originalType === "image/webp") return "image/webp";
  return "image/jpeg"; // jpg, gif, bmp, avif, …
}

export type FitMode = "stretch" | "contain" | "cover";

export interface DrawOptions {
  width: number;
  height: number;
  fit: FitMode;
  /** matte behind transparent areas — pass only for formats without alpha
   *  (JPEG) or letterboxing (contain), otherwise transparency is kept */
  background?: string;
}

export interface EncodedImage {
  blob: Blob;
  /** the ACTUAL mime — Safari can silently swap WebP for PNG */
  mime: string;
  width: number;
  height: number;
}

/** shrink w×h proportionally so the canvas stays browser-safe */
function capArea(width: number, height: number): { width: number; height: number } {
  const area = width * height;
  if (area <= MAX_CANVAS_PIXELS) return { width, height };
  const scale = Math.sqrt(MAX_CANVAS_PIXELS / area);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/** halve the source in steps for clean-looking large downscales */
function stepDown(
  source: HTMLImageElement,
  targetWidth: number,
  targetHeight: number,
): { source: CanvasImageSource; width: number; height: number } {
  let current: CanvasImageSource = source;
  let width = source.naturalWidth;
  let height = source.naturalHeight;
  while (
    width / 2 >= targetWidth &&
    height / 2 >= targetHeight &&
    width * height > 1_000_000
  ) {
    const half = document.createElement("canvas");
    half.width = Math.round(width / 2);
    half.height = Math.round(height / 2);
    const ctx = half.getContext("2d");
    if (!ctx) break;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(current, 0, 0, half.width, half.height);
    current = half;
    width = half.width;
    height = half.height;
  }
  return { source: current, width, height };
}

function drawToCanvas(source: HTMLImageElement, opts: DrawOptions): HTMLCanvasElement {
  const target = capArea(opts.width, opts.height);
  const stepped = stepDown(source, target.width, target.height);
  const canvas = document.createElement("canvas");
  canvas.width = target.width;
  canvas.height = target.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas-unsupported");
  if (opts.background) {
    ctx.fillStyle = opts.background;
    ctx.fillRect(0, 0, target.width, target.height);
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  let sx = 0;
  let sy = 0;
  let sw = stepped.width;
  let sh = stepped.height;
  let dx = 0;
  let dy = 0;
  let dw = target.width;
  let dh = target.height;
  if (opts.fit === "cover") {
    /* crop the source (centred) to the target aspect, then fill the canvas */
    const sourceRatio = sw / sh;
    const targetRatio = target.width / target.height;
    if (sourceRatio > targetRatio) {
      const cropped = sh * targetRatio;
      sx = (sw - cropped) / 2;
      sw = cropped;
    } else {
      const cropped = sw / targetRatio;
      sy = (sh - cropped) / 2;
      sh = cropped;
    }
  } else if (opts.fit === "contain") {
    /* fit inside the box, centred — the background (if any) shows as padding */
    const scale = Math.min(target.width / sw, target.height / sh);
    dw = Math.max(1, Math.round(sw * scale));
    dh = Math.max(1, Math.round(sh * scale));
    dx = Math.round((target.width - dw) / 2);
    dy = Math.round((target.height - dh) / 2);
  }
  ctx.drawImage(stepped.source, sx, sy, sw, sh, dx, dy, dw, dh);
  return canvas;
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  mime: OutputMime,
  quality: number,
): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("encode-failed"))),
      mime,
      quality,
    );
  });
}

/** decode → draw → re-encode in one call */
export async function encodeImage(
  source: HTMLImageElement,
  opts: DrawOptions & { mime: OutputMime; quality: number },
): Promise<EncodedImage> {
  const canvas = drawToCanvas(source, opts);
  const blob = await canvasToBlob(canvas, opts.mime, opts.quality);
  return {
    blob,
    mime: blob.type || opts.mime,
    width: canvas.width,
    height: canvas.height,
  };
}

/** dimensions after applying an optional "no longer than X px" cap */
export function dimsForMaxDim(
  width: number,
  height: number,
  maxDim: number | null,
): { width: number; height: number } {
  if (!maxDim) return { width, height };
  const long = Math.max(width, height);
  if (long <= maxDim) return { width, height };
  const scale = maxDim / long;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export interface TargetResult {
  image: EncodedImage;
  hitTarget: boolean;
}

/**
 * Hit an exact byte budget: binary-search the JPEG/WebP quality, and if even
 * the floor quality is too big, shrink the dimensions until it fits (or a
 * 240 px long-side floor is reached — then return the smallest achieved, so
 * the user always leaves with the best possible file).
 */
export async function encodeToTarget(
  source: HTMLImageElement,
  opts: {
    targetBytes: number;
    mime: OutputMime;
    maxDim?: number;
    background?: string;
  },
): Promise<TargetResult> {
  const naturalLong = Math.max(source.naturalWidth, source.naturalHeight);
  let scale = opts.maxDim ? Math.min(1, opts.maxDim / naturalLong) : 1;
  let smallest: EncodedImage | null = null;

  for (;;) {
    const width = Math.max(16, Math.round(source.naturalWidth * scale));
    const height = Math.max(16, Math.round(source.naturalHeight * scale));
    const draw = {
      width,
      height,
      fit: "stretch" as FitMode,
      background: opts.background,
    };

    let result: EncodedImage;
    let hit: boolean;

    if (opts.mime === "image/png") {
      /* PNG ignores quality — only dimensions change the size */
      result = await encodeImage(source, { ...draw, mime: "image/png", quality: 1 });
      hit = result.blob.size <= opts.targetBytes;
    } else {
      let low = 0.03;
      let high = 0.95;
      let bestUnder: { image: EncodedImage; quality: number } | null = null;
      for (let i = 0; i < 7; i++) {
        const quality = (low + high) / 2;
        const encoded = await encodeImage(source, {
          ...draw,
          mime: opts.mime,
          quality,
        });
        if (encoded.blob.size <= opts.targetBytes) {
          bestUnder = { image: encoded, quality };
          low = quality;
        } else {
          high = quality;
        }
      }
      if (bestUnder) {
        /* squeeze the last bit of quality out of the known-good range */
        result =
          bestUnder.quality < low
            ? await encodeImage(source, { ...draw, mime: opts.mime, quality: low })
            : bestUnder.image;
        if (result.blob.size > opts.targetBytes) result = bestUnder.image;
        hit = true;
      } else {
        result = await encodeImage(source, {
          ...draw,
          mime: opts.mime,
          quality: 0.03,
        });
        hit = result.blob.size <= opts.targetBytes;
      }
    }

    if (!smallest || result.blob.size < smallest.blob.size) smallest = result;
    if (hit) return { image: result, hitTarget: true };
    const longSide = Math.max(width, height);
    if (longSide <= 240 || scale <= 0.05) {
      return { image: smallest as EncodedImage, hitTarget: false };
    }
    scale = Math.max(0.05, (longSide * 0.8) / naturalLong);
  }
}

/** can this browser ENCODE WebP? (old Safari says no) */
export function detectWebpEncode(): Promise<boolean> {
  if (typeof document === "undefined") return Promise.resolve(false);
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  return new Promise<boolean>((resolve) => {
    canvas.toBlob(
      (blob) => resolve(!!blob && blob.type === "image/webp"),
      "image/webp",
      0.8,
    );
  });
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(bytes < 10_240 ? 1 : 0)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function extForMime(mime: string): string {
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "image/gif") return "gif";
  if (mime === "image/bmp") return "bmp";
  if (mime === "image/avif") return "avif";
  return "img";
}

/** "holiday photo.jpeg" + "-100kb" + "image/jpeg" → "holiday photo-100kb.jpg" */
export function outputFilename(original: string, suffix: string, mime: string): string {
  const base = original.replace(/\.[^.]+$/, "") || "image";
  return `${base}${suffix}.${extForMime(mime)}`;
}

/* ------------------------------------------------------------------ */
/* downloads — every file FreeSeak hands back carries the brand        */
/* ------------------------------------------------------------------ */

/**
 * Suffix-style brand marker on every downloaded filename (v0.7.0):
 * "beach-compressed.jpg" → "beach-compressed-freeseak.jpg".
 *
 * Names that already carry the brand are returned unchanged, whatever
 * their style — "freeseak-qr-code.png" (generated files keep the prefix
 * form) and "freeseak-images.zip" (containers) stay as they are, and
 * re-processing a downloaded file never stacks a second marker.
 */
export function brandFilename(name: string): string {
  const dot = name.lastIndexOf(".");
  const ext = dot > 0 ? name.slice(dot) : "";
  let base = (dot > 0 ? name.slice(0, dot) : name).trim();
  if (!base) base = "file";
  /* already branded? leave prefix-style names alone, rebuild the rest */
  if (/(^|[\s_-])freeseak([\s_-]|$)/i.test(base)) {
    if (/^freeseak[\s_-]/i.test(base)) return name;
    base = base
      .replace(/(^|[\s_-])freeseak([\s_-]|$)/gi, "$1")
      .replace(/[\s_-]+$/, "")
      .trim();
    return `${base || "file"}-freeseak${ext}`;
  }
  /* filesystem-illegal characters out, length capped for old filesystems */
  base = base.replace(/[\\/:*?"<>|\x00-\x1f]/g, "").trim() || "file";
  if (base.length > 100) base = base.slice(0, 100).trimEnd();
  return `${base}-freeseak${ext}`;
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = brandFilename(filename);
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

type JSZipCtor = typeof import("jszip");
let jsZipPromise: Promise<JSZipCtor> | null = null;

/** JSZip (~100 KB, lazy) — bundles many output files into one .zip */
export function loadJsZip(): Promise<JSZipCtor> {
  if (!jsZipPromise) {
    /* jszip types use `export =`, but the bundler hands dynamic imports
       a namespace whose constructor sits on .default — bridge both */
    jsZipPromise = import("jszip").then(
      (m) =>
        (m as unknown as { default?: JSZipCtor }).default ??
        (m as unknown as JSZipCtor),
    );
  }
  return jsZipPromise;
}

/**
 * Merge many output files into a single branded .zip download. Inner
 * names are branded too, and duplicates get "-2", "-3" … so two
 * "photo.jpg" results can never silently overwrite each other inside
 * the archive.
 *
 * `store: true` skips re-compression — photos and PDFs are already
 * compressed, so bundling them is pure container work and much faster.
 */
export async function zipAndDownload(
  items: { blob: Blob; name: string }[],
  zipName: string,
  opts?: { store?: boolean },
): Promise<void> {
  const JSZip = await loadJsZip();
  const zip = new JSZip();
  const used = new Set<string>();
  for (const item of items) {
    let name = brandFilename(item.name);
    if (used.has(name)) {
      const dot = name.lastIndexOf(".");
      const stem = dot > 0 ? name.slice(0, dot) : name;
      const ext = dot > 0 ? name.slice(dot) : "";
      let n = 2;
      while (used.has(`${stem}-${n}${ext}`)) n += 1;
      name = `${stem}-${n}${ext}`;
    }
    used.add(name);
    zip.file(name, item.blob);
  }
  const zipped = await zip.generateAsync(
    opts?.store ? { type: "blob", compression: "STORE" } : { type: "blob" },
  );
  downloadBlob(zipped, zipName);
}
