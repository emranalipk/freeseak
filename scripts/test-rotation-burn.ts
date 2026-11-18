/* Empirical validation of the editor burn paths on every page rotation.
 * For /Rotate 0/90/180/270:
 *   1. white 300×400 pt page, burn a text annotation via the REAL engine
 *      — vector path (Helvetica) and raster path (font=Jameel divert)
 *   2. render with pdf.js (applies /Rotate exactly like a viewer)
 *   3. pixel-check: dark ink sits near the annotation's display origin,
 *      the word is horizontal in display space, and the mirrored quadrant
 *      of the page stays clean.
 * Run with: bun scripts/test-rotation-burn.ts
 */
import { degrees } from "pdf-lib";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import { createCanvas, Path2D, DOMMatrix } from "@napi-rs/canvas";
import {
  burnAnnotations,
  type TextAnnotation,
} from "../src/components/tools/pdf-editor-core";

/* --- node shims so pdf.js + the raster path run under bun -------------- */
(globalThis as any).Path2D ??= Path2D;
(globalThis as any).DOMMatrix ??= DOMMatrix;
(globalThis as any).document ??= {};
(globalThis as any).document.createElement = (tag: string) => {
  if (tag !== "canvas") throw new Error(`shim: only canvas, got ${tag}`);
  return createCanvas(1, 1);
};
(globalThis as any).document.fonts = { load: async () => [] };

const STANDARD_FONTS_URL = new URL(
  "../node_modules/pdfjs-dist/standard_fonts/",
  import.meta.url,
).href;

const PW = 300;
const PH = 400;

type TextFont2 = "Helvetica" | "Times" | "Courier" | "Noto" | "Jameel";

function makeAnno(font: TextFont2, text: string): TextAnnotation {
  return {
    id: "t1",
    page: 0,
    kind: "text",
    x: 0.1,
    y: 0.1,
    w: 0.2,
    h: 0.06,
    text,
    font,
    bold: false,
    italic: false,
    size: 24,
    color: "#000000",
    rotation: 0,
  };
}

async function buildAndBurn(
  rotation: number,
  anno: TextAnnotation,
): Promise<Uint8Array> {
  const { PDFDocument: PD, rgb: RGB } = await import("pdf-lib");
  const doc = await PD.create();
  const page = doc.addPage([PW, PH]);
  page.setRotation(degrees(rotation));
  page.drawRectangle({ x: 0, y: 0, width: PW, height: PH, color: RGB(1, 1, 1) });
  await burnAnnotations(doc, [anno], () => {});
  return doc.save();
}

async function renderToPixels(
  bytes: Uint8Array,
): Promise<{ data: Uint8ClampedArray; w: number; h: number }> {
  const pdf = await pdfjsLib.getDocument({
    data: bytes,
    disableFontFace: true,
    useSystemFonts: false,
    standardFontDataUrl: STANDARD_FONTS_URL,
  } as any).promise;
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 1 });
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport, background: "#ffffff" } as any).promise;
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return { data: image.data, w: canvas.width, h: canvas.height };
}

interface Box { x0: number; y0: number; x1: number; y1: number; count: number }
type Window = Omit<Box, "count">;

function darkBox(
  { data, w, h }: { data: Uint8ClampedArray; w: number; h: number },
  win: Window,
): Box {
  let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1, count = 0;
  for (let y = Math.max(0, Math.floor(win.y0)); y < Math.min(h, Math.ceil(win.y1)); y++) {
    for (let x = Math.max(0, Math.floor(win.x0)); x < Math.min(w, Math.ceil(win.x1)); x++) {
      const i = (y * w + x) * 4;
      if (data[i] < 120) {
        count++;
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  return x1 < 0 ? { x0: 0, y0: 0, x1: 0, y1: 0, count: 0 } : { x0, y0, x1, y1, count };
}

let failures = 0;
function check(label: string, ok: boolean, detail = "") {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  ${detail}` : ""}`);
}

async function main() {
  for (const rotation of [0, 90, 180, 270]) {
    for (const [kind, font, text] of [
      ["vector", "Helvetica", "HELLO"],
      ["raster", "Jameel", "HELLO"],
    ] as const) {
      const anno = makeAnno(font as TextFont2, text);
      const bytes = await buildAndBurn(rotation, anno);
      const px = await renderToPixels(bytes);
      /* the annotation's display-space neighbourhood */
      const win: Window = {
        x0: 0.05 * px.w, y0: 0.04 * px.h,
        x1: 0.55 * px.w, y1: 0.3 * px.h,
      };
      const box = darkBox(px, win);
      const clean = darkBox(px, {
        x0: 0.62 * px.w, y0: 0.55 * px.h,
        x1: 0.97 * px.w, y1: 0.95 * px.h,
      });
      const label = `rot${rotation} ${kind}`;
      check(`${label}: ink present near origin`, box.count > 40, `count=${box.count}`);
      check(
        `${label}: horizontal in display space`,
        box.count > 40 && box.x1 - box.x0 > box.y1 - box.y0,
        `bbox ${box.x1 - box.x0}×${box.y1 - box.y0}`,
      );
      check(`${label}: mirrored quadrant clean`, clean.count === 0, `count=${clean.count}`);
    }
  }
  console.log(failures === 0 ? "\nALL ROTATION BURN TESTS PASSED" : `\n${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

void main();
export {};
