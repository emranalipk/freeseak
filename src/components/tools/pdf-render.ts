"use client";

/**
 * FreeSeak — the pdf.js side of the PDF tools.
 *
 * pdf.js renders pages onto canvases (thumbnails, PDF→images, previews)
 * and reads the text layer. The two worker files ship as static assets
 * (public/pdf.worker.min.mjs + pdf.renderer.min.mjs) so no CDN is ever
 * contacted — the whole library runs on the visitor's device (rule 5).
 *
 * Browser-only APIs live here, separate from pdf-utils.ts, so tools that
 * never render anything (merge, split, …) never load this module.
 */

import type { PDFDocumentProxy } from "pdfjs-dist";

let pdfJsPromise: Promise<typeof import("pdfjs-dist")> | null = null;

/** pdf.js (v6: split workers — workerSrc parses, rendererSrc renders) */
export function loadPdfJs(): Promise<typeof import("pdfjs-dist")> {
  if (!pdfJsPromise) {
    pdfJsPromise = import("pdfjs-dist").then((m) => {
      m.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      m.GlobalWorkerOptions.rendererSrc = "/pdf.renderer.min.mjs";
      return m;
    });
  }
  return pdfJsPromise;
}

export class PdfJsPasswordError extends Error {
  constructor() {
    super("password-required");
    this.name = "PdfJsPasswordError";
  }
}

/**
 * Open raw bytes with pdf.js. IMPORTANT: pdf.js transfers (detaches) the
 * buffer it is handed, so every call gets a fresh copy — the caller's
 * bytes stay valid for pdf-lib work afterwards.
 *
 * cMaps + standard-font data ship as local assets (public/pdfjs/) so PDFs
 * with unembedded standard-14 fonts and CJK text render correctly — the
 * same rule as everything else here: local files, never a CDN.
 */
export async function openWithPdfJs(bytes: Uint8Array): Promise<PDFDocumentProxy> {
  const pdfjs = await loadPdfJs();
  const copy = new Uint8Array(bytes); // pdf.js detaches what it receives
  try {
    return await pdfjs.getDocument({
      data: copy,
      cMapUrl: "/pdfjs/cmaps/",
      cMapPacked: true,
      standardFontDataUrl: "/pdfjs/standard_fonts/",
    }).promise;
  } catch (err) {
    const name = String((err as { name?: string })?.name ?? "");
    if (name.includes("PasswordException")) throw new PdfJsPasswordError();
    throw err;
  }
}

export interface RenderedPage {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
}

/**
 * Tear down a document proxy. pdf.js v6's typings expose `destroy()` on
 * the loading task rather than the proxy, so this calls it defensively —
 * releasing the worker's memory matters in a long-lived editor tab.
 */
export function destroyPdfJsDoc(doc: PDFDocumentProxy): Promise<void> {
  const maybe = (doc as unknown as { destroy?: () => Promise<void> }).destroy;
  return maybe ? maybe.call(doc) : Promise.resolve();
}

/** iOS Safari silently fails (or returns black output) above ~16.7M px */
const MAX_RENDER_PIXELS = 16_777_216;

/**
 * Render one page at `scale` (1 = 72 DPI, 2 = 144 DPI …). The canvas is
 * freshly created each time — the caller owns it (and its object URL).
 * A pixel ceiling auto-scales oversized pages (A2+ at 3× would otherwise
 * blow past the mobile canvas limit and export blank).
 */
export async function renderPdfPage(
  pdf: PDFDocumentProxy,
  pageNumber: number, // 1-based, as in every PDF viewer
  scale: number,
): Promise<RenderedPage> {
  const page = await pdf.getPage(pageNumber);
  let viewport = page.getViewport({ scale });
  const pixels = viewport.width * viewport.height;
  if (pixels > MAX_RENDER_PIXELS) {
    viewport = page.getViewport({ scale: scale * Math.sqrt(MAX_RENDER_PIXELS / pixels) });
  }
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.floor(viewport.width));
  canvas.height = Math.max(1, Math.floor(viewport.height));
  await page.render({ canvas, viewport }).promise;
  page.cleanup();
  return { canvas, width: canvas.width, height: canvas.height };
}

/** the text of one page, joined the way a reader expects */
export async function extractPageText(
  pdf: PDFDocumentProxy,
  pageNumber: number,
): Promise<string> {
  const page = await pdf.getPage(pageNumber);
  const content = await page.getTextContent();
  let text = "";
  for (const item of content.items) {
    if ("str" in item) {
      text += item.str;
      if (item.hasEOL) text += "\n";
    }
  }
  return text;
}

/** canvas → Blob, Promise-wrapped (toBlob is callback-based) */
export function canvasToBlob(
  canvas: HTMLCanvasElement,
  mime: string,
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
