"use client";

/**
 * FreeSeak — the shared OCR engine (v0.6.0).
 *
 * Tesseract.js recognises text on the visitor's device (PROJECT_RULES.md
 * rule 5): the WASM core, the worker script and the English language data
 * all ship as static assets under /ocr, so no CDN is ever contacted.
 * The worker is created lazily on first use, kept as a singleton for the
 * page's lifetime and reused across tools (Edit PDF and Extract PDF Text).
 *
 * English only, by design: every extra language is megabytes of static
 * data this zero-cost site would host forever. The UI says so plainly.
 */

import type { PDFDocumentProxy } from "pdfjs-dist";
import { renderPdfPage } from "./pdf-render";

/** one recognised line of text, positioned on the page it came from */
export interface OcrLine {
  text: string;
  /** 0 (junk) – 100 (certain); shown honestly in the UI */
  confidence: number;
  /** line box, normalised 0–1 against the page, y growing downwards */
  x: number;
  y: number;
  w: number;
  h: number;
}

export type OcrStatus =
  | "loading-engine"
  | "loading-language"
  | "initialising"
  | "recognising";

/* ------------------------------------------------------------------ */
/* lazy singleton worker — local assets only, never a CDN              */
/* ------------------------------------------------------------------ */

interface TesseractWorker {
  recognize: (
    _image: HTMLCanvasElement,
    _options?: object,
    _output?: object,
  ) => Promise<{
    data: {
      text: string;
      blocks: {
        paragraphs: {
          lines: { text: string; confidence: number; bbox: { x0: number; y0: number; x1: number; y1: number } }[];
        }[];
      }[] | null;
    };
  }>;
  terminate: () => Promise<void>;
}

type TesseractModule = {
  createWorker: (
    _langs: string,
    _oem: number,
    _options: Record<string, string | boolean>,
  ) => Promise<TesseractWorker>;
};

let workerPromise: Promise<TesseractWorker> | null = null;

async function getWorker(
  onStatus?: (_status: OcrStatus) => void,
): Promise<TesseractWorker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      onStatus?.("loading-engine");
      const tesseract = (await import("tesseract.js")) as unknown as TesseractModule;
      const worker = await tesseract.createWorker("eng", 1, {
        workerPath: "/ocr/worker.min.js",
        corePath: "/ocr",
        langPath: "/ocr",
      });
      return worker;
    })();
  }
  return workerPromise;
}

/** free the WASM memory — called when a tool unmounts or finishes */
export async function disposeOcr(): Promise<void> {
  if (!workerPromise) return;
  const worker = await workerPromise.catch(() => null);
  workerPromise = null;
  if (worker) await worker.terminate();
}

/* ------------------------------------------------------------------ */
/* recognition                                                         */
/* ------------------------------------------------------------------ */

/** recognise the lines of one already-rendered page canvas */
async function recognizeCanvas(
  canvas: HTMLCanvasElement,
  onStatus?: (_status: OcrStatus) => void,
): Promise<{ lines: OcrLine[]; text: string }> {
  const worker = await getWorker(onStatus);
  onStatus?.("recognising");
  const { data } = await worker.recognize(canvas, {}, { text: true, blocks: true });

  const lines: OcrLine[] = [];
  for (const block of data.blocks ?? []) {
    for (const paragraph of block.paragraphs) {
      for (const line of paragraph.lines) {
        const text = line.text.replace(/\s+$/g, "");
        if (text.trim().length === 0) continue;
        lines.push({
          text,
          confidence: Math.round(line.confidence),
          x: line.bbox.x0 / canvas.width,
          y: line.bbox.y0 / canvas.height,
          w: (line.bbox.x1 - line.bbox.x0) / canvas.width,
          h: (line.bbox.y1 - line.bbox.y0) / canvas.height,
        });
      }
    }
  }
  return { lines, text: data.text.trim() };
}

/**
 * OCR one page of a pdf.js document at 144 DPI (enough for clear scans,
 * cheap enough for phone memory). Lines come back normalised against
 * the page, ready for the editor's overlay coordinates.
 */
export async function ocrPdfPage(
  pdf: PDFDocumentProxy,
  pageNumber: number,
  onStatus?: (_status: OcrStatus) => void,
): Promise<{ lines: OcrLine[]; text: string }> {
  const rendered = await renderPdfPage(pdf, pageNumber, 2);
  try {
    return await recognizeCanvas(rendered.canvas, onStatus);
  } finally {
    rendered.canvas.width = 0;
    rendered.canvas.height = 0;
  }
}

/**
 * OCR an already-rendered canvas — used by Extract PDF Text, which only
 * needs the plain text (Extract PDF Text renders pages itself).
 */
export function ocrCanvas(
  canvas: HTMLCanvasElement,
  onStatus?: (_status: OcrStatus) => void,
): Promise<{ lines: OcrLine[]; text: string }> {
  return recognizeCanvas(canvas, onStatus);
}
