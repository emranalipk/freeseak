"use client";

/**
 * FreeSeak — the Edit PDF engine (v0.6.0).
 *
 * Everything the editor does to the document itself lives here, so the
 * React component (pdf-editor.tsx) stays about interaction: coordinates,
 * history and panels.
 *
 * The model, in one paragraph: annotations are stored in NORMALISED
 * display coordinates (0–1, y growing downwards) — exactly what pdf.js
 * paints and what the overlay divs use. Burning them into the PDF is a
 * conversion problem, solved per page by createPageMapper, which maps
 * display space onto pdf-lib's user space (origin bottom-left, y up)
 * for every page rotation. Two burning paths exist: vector (drawText /
 * drawRectangle / drawImage — text stays selectable) and raster (pages
 * are re-painted from the pdf.js canvas with the annotations composited
 * on top — used for password-protected files, whose content pdf-lib
 * cannot decrypt, and for the "flatten to images" export option).
 *
 * Honest limits, kept visible in the UI: no text reflow (annotations
 * are overlays, never re-typeset body text), OCR is English-only, and
 * password-protected files export through the raster path only.
 */

import type { PDFDocument, PDFFont, PDFPage } from "pdf-lib";
import type { PDFDocumentProxy } from "pdfjs-dist";
import {
  PDFCheckBox,
  PDFDropdown,
  PDFRadioGroup,
  PDFTextField,
  StandardFonts,
  degrees,
  rgb,
  LineCapStyle,
} from "pdf-lib";
import { hexToRgb, loadPdfLib } from "./pdf-utils";
import { loadPdfJs, renderPdfPage, destroyPdfJsDoc } from "./pdf-render";

/* ------------------------------------------------------------------ */
/* types — annotations in normalised display coordinates (y down)      */
/* ------------------------------------------------------------------ */

export type EditorTool =
  | "select"
  | "text"
  | "whiteout"
  | "rect"
  | "ellipse"
  | "line"
  | "pen"
  | "highlight"
  | "image"
  | "signature";

export type TextFont = "Helvetica" | "Times" | "Courier" | "Noto";

interface BaseAnnotation {
  id: string;
  /** 0-based page index the annotation lives on */
  page: number;
}

interface BoxAnnotation extends BaseAnnotation {
  /** top-left corner and size, each 0–1 of the displayed page */
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface TextAnnotation extends BoxAnnotation {
  kind: "text";
  text: string;
  font: TextFont;
  bold: boolean;
  italic: boolean;
  /** font size in PDF points */
  size: number;
  color: string;
  /** degrees, counter-clockwise, like PDF itself */
  rotation: number;
}

export interface WhiteoutAnnotation extends BoxAnnotation {
  kind: "whiteout";
  color: string;
}

export interface ShapeAnnotation extends BoxAnnotation {
  kind: "rect" | "ellipse";
  stroke: string;
  strokeWidth: number;
  /** null = no fill */
  fill: string | null;
}

export interface LineAnnotation extends BaseAnnotation {
  kind: "line";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  stroke: string;
  strokeWidth: number;
}

export interface InkAnnotation extends BaseAnnotation {
  kind: "pen" | "highlight";
  points: { x: number; y: number }[];
  color: string;
  /** stroke width in PDF points */
  width: number;
}

export interface ImageAnnotation extends BoxAnnotation {
  kind: "image" | "signature";
  /** object URL for the preview <img> */
  url: string;
  mime: "image/png" | "image/jpeg";
  bytes: Uint8Array;
}

export type Annotation =
  | TextAnnotation
  | WhiteoutAnnotation
  | ShapeAnnotation
  | LineAnnotation
  | InkAnnotation
  | ImageAnnotation;

export interface PageSize {
  w: number;
  h: number;
}

export type FormFieldKind = "text" | "checkbox" | "dropdown" | "radio" | "other";

export interface EditorFormField {
  name: string;
  kind: FormFieldKind;
  value: string | boolean;
  options?: string[];
}

/* ------------------------------------------------------------------ */
/* defaults & small helpers                                            */
/* ------------------------------------------------------------------ */

export const DEFAULT_TEXT_SIZE = 14;
export const TEXT_LINE_FACTOR = 1.3;
/** where the baseline sits inside one line box (CSS parity) */
export const BASELINE_FACTOR = 0.95;

export function uid(): string {
  return `a${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export function cssFontFamily(font: TextFont): string {
  switch (font) {
    case "Times":
      return "'Times New Roman', Times, serif";
    case "Courier":
      return "'Courier New', Courier, monospace";
    case "Noto":
      return NOTO_CSS_FAMILY;
    default:
      return "Helvetica, Arial, sans-serif";
  }
}

/** true when a string needs the embedded Unicode font (beyond WinAnsi) */
export function needsUnicodeFont(text: string): boolean {
  return /[^\u0000-\u00ff]/.test(text);
}

/* ------------------------------------------------------------------ */
/* the Noto font — one family, shipped locally, lazy-loaded            */
/* ------------------------------------------------------------------ */

export const NOTO_FONT_NAME = "Noto Sans Editor";
export const NOTO_SC_FONT_NAME = "Noto Sans SC Editor";
export const NOTO_CSS_FAMILY = `'${NOTO_FONT_NAME}', '${NOTO_SC_FONT_NAME}', sans-serif`;

let notoFacesAdded = false;

/** register the shipped Noto files as CSS font faces (for the overlay) */
export async function ensureNotoFontFace(): Promise<void> {
  if (notoFacesAdded) return;
  notoFacesAdded = true;
  const faces = [
    new FontFace(NOTO_FONT_NAME, "url(/fonts/NotoSans-Regular.ttf)"),
    new FontFace(NOTO_FONT_NAME, "url(/fonts/NotoSans-Bold.ttf)", { weight: "700" }),
    new FontFace(NOTO_SC_FONT_NAME, "url(/fonts/NotoSansSC-Regular.ttf)"),
  ];
  const loaded = await Promise.all(faces.map((face) => face.load()));
  loaded.forEach((face) => document.fonts.add(face));
}

let notoBytesCache: Record<string, Promise<ArrayBuffer>> = {};

/** the raw TTFs for pdf-lib embedding — fetched once, then cached */
export function loadNotoBytes(variant: "regular" | "bold" | "sc"): Promise<ArrayBuffer> {
  if (!notoBytesCache[variant]) {
    const file =
      variant === "bold"
        ? "/fonts/NotoSans-Bold.ttf"
        : variant === "sc"
          ? "/fonts/NotoSansSC-Regular.ttf"
          : "/fonts/NotoSans-Regular.ttf";
    notoBytesCache[variant] = fetch(file).then((r) => r.arrayBuffer());
  }
  return notoBytesCache[variant];
}

/** CJK ranges — the SC pack covers Han, Kana and Bopomofo subsets */
function hasCjk(text: string): boolean {
  return /[\u2e80-\u9fff\u3400-\u4dbf\uf900-\ufaff\u3040-\u30ff]/.test(text);
}

/* ------------------------------------------------------------------ */
/* display space → PDF user space (any page rotation)                  */
/* ------------------------------------------------------------------ */

export interface PageMapper {
  displayW: number;
  displayH: number;
  /** normalised display point → user-space point */
  point: (_nx: number, _ny: number) => { x: number; y: number };
  /** display rotation → user-space text rotation */
  textRotation: (_displayRotation: number) => number;
}

export function createPageMapper(page: PDFPage): PageMapper {
  const rotation = ((page.getRotation().angle % 360) + 360) % 360;
  const { width: uw, height: uh } = page.getSize();
  const swapped = rotation === 90 || rotation === 270;
  const displayW = swapped ? uh : uw;
  const displayH = swapped ? uw : uh;

  const point = (nx: number, ny: number) => {
    const dx = nx * displayW;
    const dy = ny * displayH;
    switch (rotation) {
      case 90:
        /* display x = user y, display y = user x */
        return { x: dy, y: dx };
      case 180:
        return { x: uw - dx, y: uh - dy };
      case 270:
        return { x: uw - dy, y: uh - dx };
      default:
        return { x: dx, y: uh - dy };
    }
  };

  const textRotation = (displayRotation: number) =>
    (((displayRotation - rotation) % 360) + 360) % 360;

  return { displayW, displayH, point, textRotation };
}

/* ------------------------------------------------------------------ */
/* burning annotations into a pdf-lib document (vector path)           */
/* ------------------------------------------------------------------ */

const STANDARD_FONTS: Record<
  TextFont,
  { regular: StandardFonts; bold: StandardFonts; italic: StandardFonts; boldItalic: StandardFonts }
> = {
  Helvetica: {
    regular: StandardFonts.Helvetica,
    bold: StandardFonts.HelveticaBold,
    italic: StandardFonts.HelveticaOblique,
    boldItalic: StandardFonts.HelveticaBoldOblique,
  },
  Times: {
    regular: StandardFonts.TimesRoman,
    bold: StandardFonts.TimesRomanBold,
    italic: StandardFonts.TimesRomanItalic,
    boldItalic: StandardFonts.TimesRomanBoldItalic,
  },
  Courier: {
    regular: StandardFonts.Courier,
    bold: StandardFonts.CourierBold,
    italic: StandardFonts.CourierOblique,
    boldItalic: StandardFonts.CourierBoldOblique,
  },
  /* Noto is resolved separately — embedded from the shipped TTFs */
  Noto: {
    regular: StandardFonts.Helvetica,
    bold: StandardFonts.HelveticaBold,
    italic: StandardFonts.HelveticaOblique,
    boldItalic: StandardFonts.HelveticaBoldOblique,
  },
};

type FontCache = Map<string, PDFFont>;

async function resolveFont(
  doc: PDFDocument,
  cache: FontCache,
  font: TextFont,
  bold: boolean,
  italic: boolean,
  text: string,
): Promise<PDFFont> {
  if (font === "Noto") {
    /* one visible font family for the visitor, two files underneath:
       Noto Sans for Latin/Greek/Cyrillic, the SC pack for CJK glyphs.
       The SC pack ships regular only, so bold CJK falls back to it. */
    const variant = hasCjk(text) ? "sc" : bold ? "bold" : "regular";
    const key = `noto-${variant}`;
    const hit = cache.get(key);
    if (hit) return hit;
    const bytes = await loadNotoBytes(variant);
    doc.registerFontkit((await import("@pdf-lib/fontkit")).default);
    let embedded: PDFFont;
    try {
      embedded = await doc.embedFont(bytes, { subset: true });
    } catch {
      embedded = await doc.embedFont(bytes, { subset: false });
    }
    cache.set(key, embedded);
    return embedded;
  }
  const spec = STANDARD_FONTS[font];
  const standard =
    bold && italic ? spec.boldItalic : bold ? spec.bold : italic ? spec.italic : spec.regular;
  const key = `std-${standard}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const embedded = await doc.embedFont(standard);
  cache.set(key, embedded);
  return embedded;
}

function asColor(hex: string) {
  const c = hexToRgb(hex);
  return c ? rgb(c.r, c.g, c.b) : rgb(0, 0, 0);
}

async function drawTextAnnotation(
  doc: PDFDocument,
  cache: FontCache,
  page: PDFPage,
  mapper: PageMapper,
  anno: TextAnnotation,
  onNote: (_note: string) => void,
): Promise<void> {
  const ph = mapper.displayH;
  const lines = anno.text.split("\n");
  const lineHeight = anno.size * TEXT_LINE_FACTOR;

  const drawWith = async (useFont: TextFont) => {
    const rot = mapper.textRotation(anno.rotation);
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].length === 0) continue;
      const font = await resolveFont(doc, cache, useFont, anno.bold, anno.italic, lines[i]);
      const baselineNy = (anno.y * ph + i * lineHeight + anno.size * BASELINE_FACTOR) / ph;
      const p = mapper.point(anno.x, baselineNy);
      page.drawText(lines[i], {
        x: p.x,
        y: p.y,
        size: anno.size,
        font,
        color: asColor(anno.color),
        rotate: degrees(rot),
      });
    }
  };

  try {
    await drawWith(anno.font);
  } catch {
    /* standard fonts can only encode WinAnsi — fall back to Noto */
    if (anno.font === "Noto") {
      onNote(`Some text could not be encoded: "${anno.text.slice(0, 40)}" was skipped.`);
      return;
    }
    try {
      await drawWith("Noto");
      onNote(
        "Some text contained characters the standard fonts can't encode — it was burned with the built-in Noto Sans instead.",
      );
    } catch {
      onNote(`Some text could not be encoded: "${anno.text.slice(0, 40)}" was skipped.`);
    }
  }
}

async function burnAnnotation(
  doc: PDFDocument,
  cache: FontCache,
  imageCache: Map<string, Awaited<ReturnType<PDFDocument["embedPng"]>>>,
  page: PDFPage,
  mapper: PageMapper,
  anno: Annotation,
  onNote: (_note: string) => void,
): Promise<void> {
  switch (anno.kind) {
    case "text":
      await drawTextAnnotation(doc, cache, page, mapper, anno, onNote);
      return;

    case "whiteout": {
      const p1 = mapper.point(anno.x, anno.y);
      const p2 = mapper.point(anno.x + anno.w, anno.y + anno.h);
      page.drawRectangle({
        x: Math.min(p1.x, p2.x),
        y: Math.min(p1.y, p2.y),
        width: Math.abs(p2.x - p1.x),
        height: Math.abs(p2.y - p1.y),
        color: asColor(anno.color),
        borderWidth: 0,
      });
      return;
    }

    case "rect":
    case "ellipse": {
      const p1 = mapper.point(anno.x, anno.y);
      const p2 = mapper.point(anno.x + anno.w, anno.y + anno.h);
      const x = Math.min(p1.x, p2.x);
      const y = Math.min(p1.y, p2.y);
      const width = Math.abs(p2.x - p1.x);
      const height = Math.abs(p2.y - p1.y);
      /* pdf-lib fills shapes black when no colour is given, so a
         stroke-only shape gets an explicit invisible fill instead */
      const common = {
        borderColor: asColor(anno.stroke),
        borderWidth: anno.strokeWidth,
        ...(anno.fill
          ? { color: asColor(anno.fill), opacity: 1 }
          : { color: rgb(0, 0, 0), opacity: 0 }),
      };
      if (anno.kind === "rect") {
        page.drawRectangle({ x, y, width, height, ...common });
      } else {
        page.drawEllipse({
          x: x + width / 2,
          y: y + height / 2,
          xScale: width / 2,
          yScale: height / 2,
          ...common,
        });
      }
      return;
    }

    case "line": {
      const a = mapper.point(anno.x1, anno.y1);
      const b = mapper.point(anno.x2, anno.y2);
      page.drawLine({
        start: a,
        end: b,
        thickness: anno.strokeWidth,
        color: asColor(anno.stroke),
        lineCap: LineCapStyle.Round,
      });
      return;
    }

    case "pen":
    case "highlight": {
      const isHighlight = anno.kind === "highlight";
      for (let i = 1; i < anno.points.length; i++) {
        const a = mapper.point(anno.points[i - 1].x, anno.points[i - 1].y);
        const b = mapper.point(anno.points[i].x, anno.points[i].y);
        page.drawLine({
          start: a,
          end: b,
          thickness: anno.width,
          color: asColor(anno.color),
          ...(isHighlight ? { opacity: 0.35 } : {}),
          lineCap: LineCapStyle.Round,
        });
      }
      return;
    }

    case "image":
    case "signature": {
      let image = imageCache.get(anno.id);
      if (!image) {
        image =
          anno.mime === "image/jpeg"
            ? await doc.embedJpg(anno.bytes)
            : await doc.embedPng(anno.bytes);
        imageCache.set(anno.id, image);
      }
      const p1 = mapper.point(anno.x, anno.y);
      const p2 = mapper.point(anno.x + anno.w, anno.y + anno.h);
      page.drawImage(image, {
        x: Math.min(p1.x, p2.x),
        y: Math.min(p1.y, p2.y),
        width: Math.abs(p2.x - p1.x),
        height: Math.abs(p2.y - p1.y),
      });
      return;
    }
  }
}

/** burn every annotation into the document, grouped by its page */
export async function burnAnnotations(
  doc: PDFDocument,
  annos: Annotation[],
  onNote: (_note: string) => void,
): Promise<void> {
  const cache: FontCache = new Map();
  const imageCache = new Map();
  for (const anno of annos) {
    const page = doc.getPage(anno.page);
    await burnAnnotation(doc, cache, imageCache, page, createPageMapper(page), anno, onNote);
  }
}

/* ------------------------------------------------------------------ */
/* raster path — annotations painted onto the rendered page canvas     */
/* ------------------------------------------------------------------ */

export async function drawAnnotationsOnCanvas(
  ctx: CanvasRenderingContext2D,
  annos: Annotation[],
  width: number,
  height: number,
  pxPerPt: number,
): Promise<void> {
  const imageCache = new Map<string, HTMLImageElement>();
  for (const anno of annos) {
    ctx.save();
    switch (anno.kind) {
      case "whiteout": {
        ctx.fillStyle = anno.color;
        ctx.fillRect(anno.x * width, anno.y * height, anno.w * width, anno.h * height);
        break;
      }
      case "rect": {
        const x = anno.x * width;
        const y = anno.y * height;
        const w = anno.w * width;
        const h = anno.h * height;
        if (anno.fill) {
          ctx.fillStyle = anno.fill;
          ctx.fillRect(x, y, w, h);
        }
        if (anno.strokeWidth > 0) {
          ctx.strokeStyle = anno.stroke;
          ctx.lineWidth = anno.strokeWidth * pxPerPt;
          ctx.strokeRect(x, y, w, h);
        }
        break;
      }
      case "ellipse": {
        ctx.beginPath();
        ctx.ellipse(
          (anno.x + anno.w / 2) * width,
          (anno.y + anno.h / 2) * height,
          (anno.w / 2) * width,
          (anno.h / 2) * height,
          0,
          0,
          Math.PI * 2,
        );
        if (anno.fill) {
          ctx.fillStyle = anno.fill;
          ctx.fill();
        }
        if (anno.strokeWidth > 0) {
          ctx.strokeStyle = anno.stroke;
          ctx.lineWidth = anno.strokeWidth * pxPerPt;
          ctx.stroke();
        }
        break;
      }
      case "line": {
        ctx.beginPath();
        ctx.moveTo(anno.x1 * width, anno.y1 * height);
        ctx.lineTo(anno.x2 * width, anno.y2 * height);
        ctx.strokeStyle = anno.stroke;
        ctx.lineWidth = anno.strokeWidth * pxPerPt;
        ctx.lineCap = "round";
        ctx.stroke();
        break;
      }
      case "pen":
      case "highlight": {
        ctx.beginPath();
        anno.points.forEach((pt, i) => {
          const x = pt.x * width;
          const y = pt.y * height;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.strokeStyle = anno.color;
        ctx.lineWidth = anno.width * pxPerPt;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        if (anno.kind === "highlight") ctx.globalAlpha = 0.35;
        ctx.stroke();
        break;
      }
      case "image":
      case "signature": {
        let img = imageCache.get(anno.url);
        if (!img) {
          img = new Image();
          img.src = anno.url;
          await img.decode();
          imageCache.set(anno.url, img);
        }
        ctx.drawImage(img, anno.x * width, anno.y * height, anno.w * width, anno.h * height);
        break;
      }
      case "text": {
        const lines = anno.text.split("\n");
        const lineHeight = anno.size * TEXT_LINE_FACTOR * pxPerPt;
        const sizePx = anno.size * pxPerPt;
        ctx.fillStyle = anno.color;
        ctx.textBaseline = "alphabetic";
        await ensureNotoFontFace();
        ctx.font = `${anno.italic ? "italic " : ""}${anno.bold ? "700 " : ""}${sizePx}px ${cssFontFamily(anno.font)}`;
        const start = {
          x: anno.x * width,
          y: anno.y * height + anno.size * BASELINE_FACTOR * pxPerPt,
        };
        ctx.translate(start.x, start.y);
        ctx.rotate((-anno.rotation * Math.PI) / 180);
        lines.forEach((line, i) => ctx.fillText(line, 0, i * lineHeight));
        break;
      }
    }
    ctx.restore();
  }
}

/* ------------------------------------------------------------------ */
/* form fields                                                         */
/* ------------------------------------------------------------------ */

/** read the AcroForm of a document — [] when it has no fillable fields */
export async function readFormFields(
  bytes: Uint8Array,
): Promise<EditorFormField[]> {
  const { PDFDocument } = await loadPdfLib();
  const doc = await PDFDocument.load(new Uint8Array(bytes), {
    ignoreEncryption: false,
  });
  const fields = doc.getForm().getFields();
  return fields.map((field) => {
    const name = field.getName();
    if (field instanceof PDFTextField) {
      return { name, kind: "text" as const, value: field.getText() ?? "" };
    }
    if (field instanceof PDFCheckBox) {
      return { name, kind: "checkbox" as const, value: field.isChecked() };
    }
    if (field instanceof PDFDropdown) {
      return {
        name,
        kind: "dropdown" as const,
        value: field.getSelected()[0] ?? "",
        options: field.getOptions(),
      };
    }
    if (field instanceof PDFRadioGroup) {
      return {
        name,
        kind: "radio" as const,
        value: field.getSelected() ?? "",
        options: field.getOptions(),
      };
    }
    return { name, kind: "other" as const, value: "" };
  });
}

export function applyFormValues(
  doc: PDFDocument,
  formValues: Record<string, string | boolean>,
): number {
  const form = doc.getForm();
  let warnings = 0;
  for (const field of form.getFields()) {
    const value = formValues[field.getName()];
    if (value === undefined) continue;
    try {
      if (field instanceof PDFTextField && typeof value === "string") {
        field.setText(value);
      } else if (field instanceof PDFCheckBox && typeof value === "boolean") {
        if (value) field.check();
        else field.uncheck();
      } else if (field instanceof PDFDropdown && typeof value === "string") {
        field.select(value);
      } else if (field instanceof PDFRadioGroup && typeof value === "string") {
        field.select(value);
      }
    } catch {
      warnings += 1;
    }
  }
  return warnings;
}

/* ------------------------------------------------------------------ */
/* export — three honest paths                                         */
/* ------------------------------------------------------------------ */

export interface ExportRequest {
  /** provides clean copies of the original bytes (pdf.js detaches them) */
  freshBytes: () => Uint8Array;
  /** the pdf.js document of the ORIGINAL file (raster paths render it) */
  pdfJsDoc: PDFDocumentProxy;
  pageSizes: PageSize[];
  annos: Annotation[];
  formValues: Record<string, string | boolean>;
  encrypted: boolean;
  flattenForms: boolean;
  rasterizeAll: boolean;
  onProgress: (_step: string) => void;
  onNote: (_note: string) => void;
}

/**
 * Build the edited PDF. Returns the finished blob plus any notes the
 * caller should surface (encoding fallbacks, skipped fields…).
 */
export async function exportEditedPdf(
  request: ExportRequest,
): Promise<{ blob: Blob; notes: string[] }> {
  const notes: string[] = [];
  const { PDFDocument } = await loadPdfLib();
  const { annos, pageSizes } = request;

  const buildVector = async (): Promise<Uint8Array> => {
    request.onProgress("Applying edits…");
    const doc = await PDFDocument.load(request.freshBytes(), {
      ignoreEncryption: false,
    });
    if (Object.keys(request.formValues).length > 0) {
      const warnings = applyFormValues(doc, request.formValues);
      if (warnings > 0) {
        notes.push(
          `${warnings} form field${warnings > 1 ? "s" : ""} kept their old value — the new one used characters the field's font can't encode.`,
        );
      }
    }
    const byPage = new Map<number, Annotation[]>();
    for (const anno of annos) {
      const list = byPage.get(anno.page) ?? [];
      list.push(anno);
      byPage.set(anno.page, list);
    }
    const burnable = [...byPage.entries()].filter(([page]) => page < doc.getPageCount());
    for (const [page, list] of burnable) {
      request.onProgress(`Drawing page ${page + 1}…`);
      await burnAnnotations(doc, list, (note) => notes.push(note));
    }
    if (request.flattenForms) {
      try {
        doc.getForm().flatten();
      } catch {
        notes.push("Form fields could not be flattened — they stay interactive.");
      }
    }
    return doc.save({ useObjectStreams: true });
  };

  const rasterizeDocument = async (
    source: PDFDocumentProxy,
    overlayAnnos: boolean,
  ): Promise<Uint8Array> => {
    const out = await PDFDocument.create();
    for (let i = 0; i < pageSizes.length; i++) {
      request.onProgress(`Rasterising page ${i + 1} of ${pageSizes.length}…`);
      /* ~1600 px wide or 2× points, whichever is smaller — a good
         screen-quality trade-off that keeps memory sane on phones */
      const scale = Math.min(2, 1600 / pageSizes[i].w);
      const rendered = await renderPdfPage(source, i + 1, scale);
      try {
        const ctx = rendered.canvas.getContext("2d");
        if (ctx && overlayAnnos) {
          const pageAnnos = annos.filter((a) => a.page === i);
          await drawAnnotationsOnCanvas(
            ctx,
            pageAnnos,
            rendered.canvas.width,
            rendered.canvas.height,
            rendered.canvas.width / pageSizes[i].w,
          );
        }
        const blob = await new Promise<Blob>((resolve, reject) => {
          rendered.canvas.toBlob(
            (b) => (b ? resolve(b) : reject(new Error("encode-failed"))),
            "image/jpeg",
            0.92,
          );
        });
        const image = await out.embedJpg(new Uint8Array(await blob.arrayBuffer()));
        const page = out.addPage([pageSizes[i].w, pageSizes[i].h]);
        page.drawImage(image, {
          x: 0,
          y: 0,
          width: pageSizes[i].w,
          height: pageSizes[i].h,
        });
      } finally {
        rendered.canvas.width = 0;
        rendered.canvas.height = 0;
      }
    }
    return out.save({ useObjectStreams: true });
  };

  let bytes: Uint8Array;
  if (request.encrypted) {
    request.onProgress("Preparing pages…");
    bytes = await rasterizeDocument(request.pdfJsDoc, true);
  } else if (request.rasterizeAll) {
    const edited = await buildVector();
    request.onProgress("Opening the edited copy…");
    const pdfjs = await loadPdfJs();
    const doc = await pdfjs.getDocument({ data: new Uint8Array(edited) }).promise;
    try {
      bytes = await rasterizeDocument(doc, false);
    } finally {
      await destroyPdfJsDoc(doc);
    }
  } else {
    bytes = await buildVector();
  }

  request.onProgress("Saving…");
  return {
    blob: new Blob([bytes as BlobPart], { type: "application/pdf" }),
    notes,
  };
}

/* ------------------------------------------------------------------ */
/* sample document — so nobody has to hunt for a test file             */
/* ------------------------------------------------------------------ */

export async function buildSamplePdf(): Promise<File> {
  const { PDFDocument } = await loadPdfLib();
  const doc = await PDFDocument.create();
  const helvetica = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const page1 = doc.addPage([595, 842]);
  page1.drawText("FreeSeak Sample Document", {
    x: 55,
    y: 780,
    size: 20,
    font: bold,
    color: rgb(0.06, 0.18, 0.31),
  });
  const paragraphs = [
    "This two-page sample exists so you can try every editing tool right away:",
    "add text with the T tool, white-out a sentence, sign on the dotted line,",
    "highlight anything, stamp an image, draw a shape — and fill the form.",
    "",
    "Everything happens in your browser. Nothing is uploaded anywhere.",
  ];
  paragraphs.forEach((line, i) => {
    page1.drawText(line, { x: 55, y: 740 - i * 18, size: 12, font: helvetica });
  });

  const form = doc.getForm();
  const label = (page: ReturnType<PDFDocument["addPage"]>, text: string, x: number, y: number) =>
    page.drawText(text, { x, y, size: 11, font: bold });

  label(page1, "Name:", 55, 600);
  const nameField = form.createTextField("sample.name");
  nameField.addToPage(page1, { x: 100, y: 594, width: 250, height: 22 });

  label(page1, "Email:", 55, 560);
  const emailField = form.createTextField("sample.email");
  emailField.addToPage(page1, { x: 100, y: 554, width: 250, height: 22 });

  label(page1, "Subscribe to the newsletter:", 55, 520);
  const subscribe = form.createCheckBox("sample.subscribe");
  subscribe.addToPage(page1, { x: 250, y: 515, width: 18, height: 18 });

  label(page1, "Plan:", 55, 480);
  const plan = form.createRadioGroup("sample.plan");
  plan.addOptionToPage("Free", page1, { x: 100, y: 475, width: 90, height: 20 });
  plan.addOptionToPage("Pro", page1, { x: 220, y: 475, width: 90, height: 20 });

  label(page1, "Country:", 55, 440);
  const country = form.createDropdown("sample.country");
  country.addOptions(["United Kingdom", "United States", "Germany", "Pakistan", "Other"]);
  country.addToPage(page1, { x: 120, y: 434, width: 180, height: 22 });

  label(page1, "Signature:", 55, 220);
  page1.drawLine({
    start: { x: 55, y: 200 },
    end: { x: 320, y: 200 },
    thickness: 1,
    color: rgb(0.4, 0.4, 0.4),
  });

  const page2 = doc.addPage([595, 842]);
  page2.drawText("Page 2 — a clean page for trying white-out, shapes and OCR.", {
    x: 55,
    y: 760,
    size: 12,
    font: helvetica,
  });
  for (let i = 0; i < 8; i++) {
    page2.drawText(`Sample sentence ${i + 1}: editable, removable, replaceable.`, {
      x: 55,
      y: 720 - i * 22,
      size: 12,
      font: helvetica,
    });
  }

  const bytes = await doc.save({ useObjectStreams: true });
  return new File([bytes as BlobPart], "freeseak-sample.pdf", { type: "application/pdf" });
}
