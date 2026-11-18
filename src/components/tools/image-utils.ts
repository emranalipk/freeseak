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
export const MAX_CANVAS_PIXELS = 16_777_216;

export interface LoadedImage {
  img: HTMLImageElement;
  width: number;
  height: number;
}

/** decode a File into an <img> (object URL is revoked after decoding) */
function imageFromBlob(blob: Blob): Promise<LoadedImage> {
  const url = URL.createObjectURL(blob);
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

/**
 * decode a File into an <img>. HEIC/HEIF (iPhone photos) get a second
 * chance: Safari decodes them natively; other browsers sniff the bytes and
 * fall back to the libheif wasm decoder (lazy ~2 MB, bundled with the app —
 * still nothing uploaded, still works offline once it has loaded once).
 */
export async function loadImageFile(file: File): Promise<LoadedImage> {
  try {
    return await imageFromBlob(file);
  } catch (err) {
    const head = new Uint8Array(await file.slice(0, 32).arrayBuffer());
    if (looksLikeHeic(head)) {
      return decodeHeicImage(file); // throws honest HEIC-specific errors
    }
    throw err;
  }
}

/** map "keep original" onto a format canvas can actually re-encode */
export function resolveMime(originalType: string, choice: FormatChoice): OutputMime {
  if (choice !== "keep") return choice;
  if (originalType === "image/png") return "image/png";
  if (originalType === "image/webp") return "image/webp";
  return "image/jpeg"; // jpg, gif, bmp, avif, …
}

/**
 * EXIF orientation (1–8) of a JPEG byte stream, from the TIFF IFD0 tag.
 * Phone photos carry 3–8 when the sensor was rotated; browsers honour it
 * when drawing to a canvas, but raw byte embedding (PDF) does not.
 * Returns 1 when no orientation tag is present (or the parse fails).
 */
export function readJpegOrientation(bytes: Uint8Array): number {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return 1;
  const len = Math.min(bytes.length, 128 * 1024); // EXIF lives in the first APP1
  let off = 2;
  while (off + 4 <= len) {
    if (bytes[off] !== 0xff) {
      off += 1;
      continue;
    }
    const marker = bytes[off + 1];
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      off += 2; // standalone markers carry no length
      continue;
    }
    if (marker === 0xda || marker === 0xd9) break; // scan data reached — no EXIF
    const segLen = (bytes[off + 2] << 8) | bytes[off + 3];
    const isExif =
      marker === 0xe1 &&
      off + 10 <= len &&
      bytes[off + 4] === 0x45 && // "E"
      bytes[off + 5] === 0x78 && // "x"
      bytes[off + 6] === 0x69 && // "i"
      bytes[off + 7] === 0x66 && // "f"
      bytes[off + 8] === 0x00 &&
      bytes[off + 9] === 0x00;
    if (isExif) {
      return orientationFromTiff(bytes, off + 10, len);
    }
    off += 2 + segLen;
  }
  return 1;
}

/** orientation (1–8) from the TIFF IFD0 that starts at byte `t`; 1 when
 * absent or unparsable — shared by the JPEG and HEIC readers */
function orientationFromTiff(bytes: Uint8Array, t: number, len: number): number {
  if (t + 8 > len) return 1;
  const little = bytes[t] === 0x49 && bytes[t + 1] === 0x49;
  const read16 = (p: number) =>
    little ? bytes[p] | (bytes[p + 1] << 8) : (bytes[p] << 8) | bytes[p + 1];
  const read32 = (p: number) =>
    little
      ? (bytes[p] | (bytes[p + 1] << 8) | (bytes[p + 2] << 16) | (bytes[p + 3] << 24)) >>> 0
      : ((bytes[p] << 24) | (bytes[p + 1] << 16) | (bytes[p + 2] << 8) | bytes[p + 3]) >>> 0;
  const ifd = t + read32(t + 4);
  if (ifd + 2 > len) return 1;
  const count = read16(ifd);
  for (let i = 0; i < count; i++) {
    const e = ifd + 2 + i * 12;
    if (e + 12 > len) break;
    if (read16(e) === 0x0112) {
      const val = read16(e + 8);
      return val >= 1 && val <= 8 ? val : 1;
    }
  }
  return 1;
}

/* ---- HEIC / HEIF intake (iPhone photos) ---------------------------------- */

/** byte-level sniff: an ftyp box with a HEIF-family brand — extensions lie */
function looksLikeHeic(bytes: Uint8Array): boolean {
  if (bytes.length < 32) return false;
  const text = new TextDecoder("latin1").decode(bytes.subarray(4, 32));
  return (
    text.startsWith("ftyp") && /heic|heix|hevc|hevx|mif1|msf1|heif/.test(text)
  );
}

/** orientation (1–8) of a HEIC file: hunt for an embedded Exif TIFF blob.
 * libheif honours the container's irot/imir flags but not EXIF, so phone
 * photos decoded through the wasm path need this or they arrive sideways */
function readHeicOrientation(bytes: Uint8Array): number {
  const limit = Math.min(bytes.length, 4 * 1024 * 1024);
  for (let i = 0; i + 10 <= limit; i++) {
    if (
      bytes[i] === 0x45 && // "E"
      bytes[i + 1] === 0x78 && // "x"
      bytes[i + 2] === 0x69 && // "i"
      bytes[i + 3] === 0x66 && // "f"
      bytes[i + 4] === 0x00 &&
      bytes[i + 5] === 0x00
    ) {
      const t = i + 6;
      // a TIFF header must follow: "II" or "MM"
      if (
        (bytes[t] === 0x49 && bytes[t + 1] === 0x49) ||
        (bytes[t] === 0x4d && bytes[t + 1] === 0x4d)
      ) {
        return orientationFromTiff(bytes, t, limit);
      }
    }
  }
  return 1;
}

/** EXIF orientation → canvas transform (mirror/rotate) so phone photos come
 * out upright, matching what Safari shows for the very same file */
function applyOrientation(source: HTMLCanvasElement, orientation: number): HTMLCanvasElement {
  if (orientation <= 1 || orientation > 8) return source;
  const swap = orientation >= 5; // 5–8 transpose width and height
  const out = document.createElement("canvas");
  out.width = swap ? source.height : source.width;
  out.height = swap ? source.width : source.height;
  const ctx = out.getContext("2d");
  if (!ctx) return source;
  switch (orientation) {
    case 2: ctx.setTransform(-1, 0, 0, 1, out.width, 0); break;
    case 3: ctx.setTransform(-1, 0, 0, -1, out.width, out.height); break;
    case 4: ctx.setTransform(1, 0, 0, -1, 0, out.height); break;
    case 5: ctx.setTransform(0, 1, 1, 0, 0, 0); break;
    case 6: ctx.setTransform(0, 1, -1, 0, out.width, 0); break;
    case 7: ctx.setTransform(0, -1, -1, 0, out.width, out.height); break;
    case 8: ctx.setTransform(0, -1, 1, 0, 0, out.height); break;
  }
  ctx.drawImage(source, 0, 0);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  return out;
}

/** the wasm decoder, loaded on the first HEIC and remembered after that;
 * null once = load failed (offline first visit), don't retry every file */
let heicDecoder:
  | ((_input: { buffer: ArrayBuffer | Uint8Array }) => Promise<
      import("heic-decode").HeicDecodeResult
    >)
  | null
  | undefined;

async function loadHeicDecoder() {
  if (heicDecoder !== undefined) return heicDecoder;
  try {
    const mod = await import("heic-decode");
    heicDecoder = mod.default;
  } catch {
    heicDecoder = null;
  }
  return heicDecoder;
}

/** decode a HEIC/HEIF photo through libheif-wasm, upright per its EXIF */
async function decodeHeicImage(file: File): Promise<LoadedImage> {
  const decode = await loadHeicDecoder();
  if (!decode) throw new Error("heic-decoder-unavailable");
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const handles = await decode({ buffer }).catch(() => {
    throw new Error("heic-decode-failed");
  });
  const first = handles[0];
  if (!first) throw new Error("heic-decode-failed");
  const decoded = await first.decode().catch(() => {
    throw new Error("heic-decode-failed");
  });
  const raw = document.createElement("canvas");
  raw.width = decoded.width;
  raw.height = decoded.height;
  const rctx = raw.getContext("2d");
  if (!rctx) throw new Error("canvas-unsupported");
  rctx.putImageData(
    new ImageData(new Uint8ClampedArray(decoded.data), decoded.width, decoded.height),
    0,
    0,
  );
  const upright = applyOrientation(raw, readHeicOrientation(bytes));
  const blob = await new Promise<Blob>((resolve, reject) =>
    upright.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("encode-failed"))),
      "image/png",
    ),
  );
  return imageFromBlob(blob);
}

/** honest, specific copy for the intake errors tools surface */
export function imageErrorMessage(err: unknown): string {
  const code = err instanceof Error ? err.message : "";
  switch (code) {
    case "heic-decoder-unavailable":
      return "iPhone photos (.heic) need a small one-time decoder that couldn't load — check your connection and try again, or convert the photo to JPG first.";
    case "heic-decode-failed":
      return "That iPhone photo couldn't be decoded — it may be an unsupported HEIF variant. Export it as JPG/PNG from the Photos app and try again.";
    case "canvas-unsupported":
      return "Your browser blocked the image canvas — try a smaller image or another browser.";
    default:
      return "The file may be corrupted or in an unsupported format.";
  }
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
