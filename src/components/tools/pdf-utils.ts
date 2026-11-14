"use client";

/**
 * FreeSeak — the shared engine behind the PDF tools.
 *
 * Everything runs client-side (PROJECT_RULES.md rule 5): pdf-lib edits
 * documents, pdf.js renders pages, JSZip bundles multi-file results. The
 * libraries are imported lazily so only the tool page you open ever pays
 * the download cost — the homepage stays light.
 *
 * Import this module ONLY from client components ("use client").
 */

import type { PDFDocument as LibPDFDocument } from "pdf-lib";
import { downloadBlob, formatBytes } from "./image-utils";

/* ------------------------------------------------------------------ */
/* lazy library loading                                                */
/* ------------------------------------------------------------------ */

let pdfLibPromise: Promise<typeof import("pdf-lib")> | null = null;

/** pdf-lib (~350 KB): creates, merges, splits and edits PDFs */
export function loadPdfLib(): Promise<typeof import("pdf-lib")> {
  if (!pdfLibPromise) {
    pdfLibPromise = import("pdf-lib");
  }
  return pdfLibPromise;
}

type JSZipCtor = typeof import("jszip");
let jsZipPromise: Promise<JSZipCtor> | null = null;

/** JSZip — bundles many output files into one .zip download */
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

/* ------------------------------------------------------------------ */
/* loading & inspecting documents                                      */
/* ------------------------------------------------------------------ */

export interface LoadedPdf {
  file: File;
  /** the pdf-lib instance — holds the original bytes */
  doc: LibPDFDocument;
  pageCount: number;
  /** first-page width × height in points (1 pt = 1/72 inch) */
  width: number;
  height: number;
}

export class PasswordRequiredError extends Error {
  constructor() {
    super("password-required");
    this.name = "PasswordRequiredError";
  }
}

export class CorruptPdfError extends Error {
  constructor() {
    super("corrupt-pdf");
    this.name = "CorruptPdfError";
  }
}

/**
 * Open a File with pdf-lib. Encrypted PDFs are rejected early with a
 * dedicated error type — pdf-lib cannot decrypt (and must not pretend).
 */
export async function loadPdf(file: File): Promise<LoadedPdf> {
  const { PDFDocument } = await loadPdfLib();
  let doc: LibPDFDocument;
  try {
    doc = await PDFDocument.load(await file.arrayBuffer(), {
      ignoreEncryption: false,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/encrypt/i.test(msg)) throw new PasswordRequiredError();
    throw new CorruptPdfError();
  }
  const first = doc.getPage(0);
  const { width, height } = first.getSize();
  return { doc, file, pageCount: doc.getPageCount(), width, height };
}

/** friendly, actionable error copy for PDF failures */
export function pdfErrorMessage(err: unknown): string {
  if (err instanceof PasswordRequiredError) {
    return "This PDF is password-protected — remove the protection first (it must open without a password to be processed).";
  }
  if (err instanceof CorruptPdfError) {
    return "This PDF couldn't be opened — the file may be damaged or not a PDF at all.";
  }
  return "Something went wrong while processing this PDF.";
}

/* ------------------------------------------------------------------ */
/* page ranges — "1-3, 5, 8-10"                                        */
/* ------------------------------------------------------------------ */

export interface RangeParseResult {
  /** 0-based page indices, de-duplicated, sorted ascending */
  pages: number[];
  /** false when any token failed to parse or exceeds the page count */
  valid: boolean;
  /** the tokens the user has to fix, as typed */
  invalidTokens: string[];
}

/**
 * Parse "1-3, 5, 8-10" against a page count. Every token must resolve to
 * at least one existing page or it is reported invalid — the caller
 * decides whether to block the action or just warn.
 */
export function parsePageRange(
  input: string,
  pageCount: number,
): RangeParseResult {
  const tokens = input
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
  if (tokens.length === 0) {
    return { pages: [], valid: true, invalidTokens: [] };
  }
  const pages = new Set<number>();
  const invalidTokens: string[] = [];
  for (const token of tokens) {
    const m = /^(\d+)(?:\s*-\s*(\d+))?$/.exec(token);
    if (!m) {
      invalidTokens.push(token);
      continue;
    }
    const a = parseInt(m[1], 10);
    const b = m[2] === undefined ? a : parseInt(m[2], 10);
    if (a < 1 || a > pageCount || b < a || b > pageCount) {
      invalidTokens.push(token);
      continue;
    }
    for (let p = a; p <= b; p++) pages.add(p - 1);
  }
  return {
    pages: [...pages].sort((x, y) => x - y),
    valid: invalidTokens.length === 0,
    invalidTokens,
  };
}

/** turn 0-based page indices back into "1, 3–5" display copy */
export function describeIndices(indices: number[]): string {
  if (indices.length === 0) return "none";
  const sorted = [...indices].sort((a, b) => a - b);
  const parts: string[] = [];
  let start = sorted[0];
  let prev = sorted[0];
  for (let i = 1; i <= sorted.length; i++) {
    const cur = sorted[i];
    if (cur === prev + 1) {
      prev = cur;
      continue;
    }
    parts.push(start === prev ? `${start + 1}` : `${start + 1}–${prev + 1}`);
    start = cur;
    prev = cur;
  }
  return parts.join(", ");
}

/* ------------------------------------------------------------------ */
/* saving & downloading                                                */
/* ------------------------------------------------------------------ */

/** standard save — object streams keep the file small */
export async function savePdf(doc: LibPDFDocument): Promise<Blob> {
  const bytes = await doc.save({ useObjectStreams: true });
  /* pdf-lib hands back an exact-size Uint8Array; TS's newer BlobPart
     wants an ArrayBuffer-backed view, hence the assertion */
  return new Blob([bytes as BlobPart], { type: "application/pdf" });
}

/** merge many output files into a single .zip download */
export async function zipAndDownload(
  items: { blob: Blob; name: string }[],
  zipName: string,
): Promise<void> {
  const JSZip = await loadJsZip();
  const zip = new JSZip();
  for (const item of items) zip.file(item.name, item.blob);
  const zipped = await zip.generateAsync({ type: "blob" });
  downloadBlob(zipped, zipName);
}

/* ------------------------------------------------------------------ */
/* anchors — shared by Page Numbers and Watermark                      */
/* ------------------------------------------------------------------ */

export type Anchor =
  | "top-left"
  | "top-center"
  | "top-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

export const ANCHOR_OPTIONS: { value: Anchor; label: string }[] = [
  { value: "top-left", label: "Top left" },
  { value: "top-center", label: "Top centre" },
  { value: "top-right", label: "Top right" },
  { value: "bottom-left", label: "Bottom left" },
  { value: "bottom-center", label: "Bottom centre" },
  { value: "bottom-right", label: "Bottom right" },
];

/**
 * Map an anchor + margin onto the x/y of a box of boxW × boxH on a page
 * of w × h (pdf-lib coordinates: origin bottom-left, y grows upwards).
 */
export function anchorPosition(
  anchor: Anchor,
  w: number,
  h: number,
  margin: number,
  boxW: number,
  boxH: number,
): { x: number; y: number } {
  const left = margin;
  const centerX = (w - boxW) / 2;
  const right = w - margin - boxW;
  const top = h - margin - boxH;
  const bottom = margin;
  switch (anchor) {
    case "top-left":
      return { x: left, y: top };
    case "top-center":
      return { x: centerX, y: top };
    case "top-right":
      return { x: right, y: top };
    case "bottom-left":
      return { x: left, y: bottom };
    case "bottom-center":
      return { x: centerX, y: bottom };
    default:
      return { x: right, y: bottom };
  }
}

/** "#336699" → { r, g, b } floats in 0–1, ready for pdf-lib's rgb() */
export function hexToRgb(
  hex: string,
): { r: number; g: number; b: number } | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return {
    r: ((n >> 16) & 255) / 255,
    g: ((n >> 8) & 255) / 255,
    b: (n & 255) / 255,
  };
}

export { formatBytes, downloadBlob };
