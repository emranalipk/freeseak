/*
 * Shared types, presets and helpers for the client-side enhancement engine.
 * Nothing here touches a server: images are decoded, processed and encoded
 * entirely in the user's browser.
 */

export type Scale = 1 | 2 | 4;

export interface EnhanceSettings {
  scale: Scale;
  /** 0 - 100 */
  denoise: number;
  /** 0 - 100 */
  sharpen: number;
  /** 0 - 100 (local contrast) */
  clarity: number;
  /** -50 - 50 */
  brightness: number;
  /** -50 - 50 */
  contrast: number;
  /** -50 - 50 */
  saturation: number;
  /** -50 - 50, + = warmer */
  temperature: number;
  /** -50 - 50, + = magenta, - = green */
  tint: number;
  autoLevels: boolean;
}

export const PRESETS: Record<'auto' | 'photo' | 'portrait' | 'text', EnhanceSettings> = {
  auto: {
    scale: 1, denoise: 20, sharpen: 45, clarity: 10, brightness: 3, contrast: 10,
    saturation: 10, temperature: 0, tint: 0, autoLevels: true,
  },
  photo: {
    scale: 1, denoise: 30, sharpen: 55, clarity: 14, brightness: 2, contrast: 12,
    saturation: 14, temperature: 0, tint: 0, autoLevels: true,
  },
  portrait: {
    scale: 1, denoise: 45, sharpen: 28, clarity: 6, brightness: 4, contrast: 6,
    saturation: 8, temperature: 4, tint: 0, autoLevels: true,
  },
  text: {
    scale: 1, denoise: 8, sharpen: 85, clarity: 18, brightness: 6, contrast: 25,
    saturation: -25, temperature: 0, tint: 0, autoLevels: false,
  },
};

export const PREVIEW_MAX_DIM = 1000;
export const FULL_MAX_PIXELS = 16_000_000;
export const MAX_OUTPUT_PIXELS = 25_000_000;
export const MAX_FILE_BYTES = 30 * 1024 * 1024;

export type PresetKey = keyof typeof PRESETS | 'custom';
export type OutputFormat = 'jpeg' | 'png' | 'webp';

export const FORMAT_META: Record<OutputFormat, { mime: string; ext: string; lossy: boolean }> = {
  jpeg: { mime: 'image/jpeg', ext: 'jpg', lossy: true },
  png: { mime: 'image/png', ext: 'png', lossy: false },
  webp: { mime: 'image/webp', ext: 'webp', lossy: true },
};

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function clampNum(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

/* ------------------------------------------------------------------ */
/* Image analysis -> automatic settings ("Scan & Auto-tune")           */
/* ------------------------------------------------------------------ */

export interface ImageMetrics {
  meanLum: number;
  p1: number;
  p99: number;
  lapVar: number;
  noise: number;
  satMean: number;
  avgR: number;
  avgG: number;
  avgB: number;
}

export function autoSettingsFromMetrics(m: ImageMetrics): Partial<EnhanceSettings> {
  const brightness = clampNum(Math.round((118 - m.meanLum) * 0.25), -25, 30);
  const range = m.p99 - m.p1;
  const contrast = clampNum(Math.round((195 - range) * 0.18), 0, 30);
  const denoise = clampNum(Math.round((m.noise - 2.2) * 9), 0, 70);
  const blurScore = Math.log10(Math.max(1, m.lapVar)); // ~0 (very blurry) .. 3 (very sharp)
  const sharpen = clampNum(Math.round(32 + (1.55 - blurScore) * 26), 18, 92);
  const saturation = clampNum(Math.round((0.34 - m.satMean) * 95), -10, 28);
  const temperature = clampNum(Math.round((m.avgB - m.avgR) * 0.45), -30, 30);
  const tint = clampNum(Math.round((m.avgG - (m.avgR + m.avgB) / 2) * -0.45), -25, 25);
  const clarity = blurScore < 1.9 ? 14 : 8;
  return { brightness, contrast, denoise, sharpen, saturation, temperature, tint, clarity, autoLevels: true };
}

/* ------------------------------------------------------------------ */
/* Image decoding and preparation                                      */
/* ------------------------------------------------------------------ */

type Decoded = { bitmap: ImageBitmap | HTMLImageElement; width: number; height: number };

async function decodeFile(file: File): Promise<Decoded> {
  if (typeof createImageBitmap === 'function') {
    try {
      // 'from-image' honors EXIF orientation so phone photos render upright
      const b = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return { bitmap: b, width: b.width, height: b.height };
    } catch {
      // fall through to <img> decoding
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('This file could not be decoded as an image.'));
      img.src = url;
    });
    return { bitmap: img, width: img.naturalWidth, height: img.naturalHeight };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function canvas2d(w: number, h: number): CanvasRenderingContext2D {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas 2D is not available in this browser.');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  return ctx;
}

function drawImageData(src: ImageBitmap | HTMLImageElement, w: number, h: number): ImageData {
  const ctx = canvas2d(w, h);
  ctx.drawImage(src as CanvasImageSource, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h);
}

export function imageDataToCanvas(data: ImageData): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = data.width;
  canvas.height = data.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D is not available.');
  ctx.putImageData(data, 0, 0);
  return canvas;
}

/** Build an ImageData from worker output bytes (portable across TypeScript versions). */
export function toImageData(data: Uint8ClampedArray, width: number, height: number): ImageData {
  const out = new ImageData(width, height);
  out.data.set(data);
  return out;
}

/** Downscale an ImageData so its longest side fits maxDim (high-quality resampling). */
export function scaleImageData(data: ImageData, maxDim: number): ImageData {
  const longest = Math.max(data.width, data.height);
  if (longest <= maxDim) return data;
  const s = maxDim / longest;
  const w = Math.max(1, Math.round(data.width * s));
  const h = Math.max(1, Math.round(data.height * s));
  const ctx = canvas2d(w, h);
  ctx.drawImage(imageDataToCanvas(data) as CanvasImageSource, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h);
}

export async function imageDataToObjectUrl(data: ImageData): Promise<string> {
  const blob = await new Promise<Blob | null>((resolve) => {
    imageDataToCanvas(data).toBlob(resolve, 'image/png');
  });
  if (!blob) throw new Error('Could not encode the image.');
  return URL.createObjectURL(blob);
}

/* ------------------------------------------------------------------ */
/* Rotation / flipping                                                 */
/* ------------------------------------------------------------------ */

/** dir: 1 = 90° clockwise, -1 = 90° counter-clockwise */
export function rotateImageData(data: ImageData, dir: 1 | -1): ImageData {
  const { width: w, height: h } = data;
  const src = data.data;
  const out = new ImageData(h, w);
  const dst = out.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const si = (y * w + x) * 4;
      let di: number;
      if (dir === 1) di = ((w - 1 - x) * h + y) * 4;
      else di = (x * h + (h - 1 - y)) * 4;
      dst[di] = src[si];
      dst[di + 1] = src[si + 1];
      dst[di + 2] = src[si + 2];
      dst[di + 3] = src[si + 3];
    }
  }
  return out;
}

export function flipImageData(data: ImageData): ImageData {
  const { width: w, height: h } = data;
  const out = new ImageData(w, h);
  const dst = out.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const si = (y * w + x) * 4;
      const di = (y * w + (w - 1 - x)) * 4;
      dst[di] = data.data[si];
      dst[di + 1] = data.data[si + 1];
      dst[di + 2] = data.data[si + 2];
      dst[di + 3] = data.data[si + 3];
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Preparation pipeline                                                */
/* ------------------------------------------------------------------ */

export interface PreparedImage {
  name: string;
  fileBytes: number;
  origW: number;
  origH: number;
  /** Processing base: original, or downscaled if above FULL_MAX_PIXELS */
  fullData: ImageData;
  /** Small copy used for live preview */
  previewData: ImageData;
  srcUrl: string;
  downscaled: boolean;
}

export async function prepareImage(file: File): Promise<PreparedImage> {
  const { bitmap, width, height } = await decodeFile(file);
  try {
    const fullPx = width * height;
    let fw = width;
    let fh = height;
    const downscaled = fullPx > FULL_MAX_PIXELS;
    if (downscaled) {
      const s = Math.sqrt(FULL_MAX_PIXELS / fullPx);
      fw = Math.max(1, Math.round(width * s));
      fh = Math.max(1, Math.round(height * s));
    }
    const fullData = drawImageData(bitmap, fw, fh);
    const previewData = scaleImageData(fullData, PREVIEW_MAX_DIM);
    return {
      name: file.name || 'image',
      fileBytes: file.size,
      origW: width,
      origH: height,
      fullData,
      previewData,
      srcUrl: URL.createObjectURL(file),
      downscaled,
    };
  } finally {
    if ('close' in bitmap && typeof bitmap.close === 'function') bitmap.close();
  }
}

/* ------------------------------------------------------------------ */
/* Worker client                                                       */
/* ------------------------------------------------------------------ */

export interface WorkerImage {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

export interface EnhanceResult {
  data: Uint8ClampedArray;
  width: number;
  height: number;
  ms: number;
}

type Pending = {
  resolve: (_r: EnhanceResult) => void;
  reject: (_e: Error) => void;
  onProgress?: (_stage: string) => void;
};

type AnalyzePending = {
  resolve: (_m: ImageMetrics) => void;
  reject: (_e: Error) => void;
};

type WorkerInMsg =
  | { type: 'progress'; id: number; stage: string }
  | { type: 'done'; id: number; width: number; height: number; data: ArrayBuffer; ms: number }
  | { type: 'analyzed'; id: number; metrics: ImageMetrics }
  | { type: 'error'; id: number; code?: string; message: string };

export class EnhanceClient {
  private worker: Worker | null = null;
  private seq = 0;
  private pending = new Map<number, Pending>();
  private analyzePending = new Map<number, AnalyzePending>();

  private ensure(): Worker {
    if (this.worker) return this.worker;
    const w = new Worker('/enhance-worker.js');
    w.onmessage = (ev: MessageEvent<WorkerInMsg>) => {
      const msg = ev.data;
      const entry = this.pending.get(msg.id);
      const aEntry = this.analyzePending.get(msg.id);
      if (!entry && !aEntry) return;
      if (msg.type === 'progress') {
        entry?.onProgress?.(msg.stage);
      } else if (msg.type === 'done') {
        this.pending.delete(msg.id);
        entry?.resolve({ data: new Uint8ClampedArray(msg.data), width: msg.width, height: msg.height, ms: msg.ms });
      } else if (msg.type === 'analyzed') {
        this.analyzePending.delete(msg.id);
        aEntry?.resolve(msg.metrics);
      } else {
        this.pending.delete(msg.id);
        this.analyzePending.delete(msg.id);
        const err = new Error(msg.message);
        entry?.reject(err);
        aEntry?.reject(err);
      }
    };
    w.onerror = () => {
      const err = new Error('The enhancement engine failed to start. Please reload the page.');
      this.pending.forEach((p) => p.reject(err));
      this.analyzePending.forEach((p) => p.reject(err));
      this.pending.clear();
      this.analyzePending.clear();
    };
    this.worker = w;
    return w;
  }

  run(image: WorkerImage, settings: EnhanceSettings, onProgress?: (_stage: string) => void): Promise<EnhanceResult> {
    const worker = this.ensure();
    const id = ++this.seq;
    const copy = new Uint8ClampedArray(image.data);
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject, onProgress });
      worker.postMessage(
        { type: 'enhance', id, image: { data: copy, width: image.width, height: image.height }, settings },
        [copy.buffer]
      );
    });
  }

  analyze(image: WorkerImage): Promise<ImageMetrics> {
    const worker = this.ensure();
    const id = ++this.seq;
    const copy = new Uint8ClampedArray(image.data);
    return new Promise((resolve, reject) => {
      this.analyzePending.set(id, { resolve, reject });
      worker.postMessage(
        { type: 'analyze', id, image: { data: copy, width: image.width, height: image.height } },
        [copy.buffer]
      );
    });
  }

  dispose() {
    this.worker?.terminate();
    this.worker = null;
    this.pending.clear();
    this.analyzePending.clear();
  }
}
