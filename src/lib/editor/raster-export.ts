"use client";

/**
 * FreeSeak — the raster export path for password-protected files.
 *
 * pdf-lib cannot rewrite encrypted content, so there is no vector
 * burn for these documents. Instead every page is re-rendered from
 * pdf.js's DECRYPTED view (the same pixels the workspace shows),
 * the annotation objects are composited on top with the canvas 2D
 * API, and the images are assembled into a fresh PDF. The result is
 * visually identical, but no longer text-selectable — the export
 * dialog says so before the visitor saves.
 */

import type { PDFDocumentProxy } from "pdfjs-dist";
import type { EditorObject, PageEntry } from "./types";
import { loadPdfLib, getRenderProxy } from "./engine";
import { fontCss } from "./fonts";

const SCALE = 2.5; // ~180 DPI — matches the flatten-to-image export

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image-load-failed"));
    img.src = src;
  });
}

/** rotate a rendered canvas by q × 90° clockwise (user page rotations) */
function rotateCanvas(
  src: HTMLCanvasElement,
  quarterTurns: number,
): HTMLCanvasElement {
  const q = ((quarterTurns % 4) + 4) % 4;
  if (q === 0) return src;
  const out = document.createElement("canvas");
  const swap = q % 2 === 1;
  out.width = swap ? src.height : src.width;
  out.height = swap ? src.width : src.height;
  const ctx = out.getContext("2d");
  if (!ctx) return src;
  ctx.translate(out.width / 2, out.height / 2);
  ctx.rotate((q * Math.PI) / 2);
  ctx.drawImage(src, -src.width / 2, -src.height / 2);
  return out;
}

/** draw one object onto a page canvas (coords are display points × SCALE) */
async function drawObject(
  ctx: CanvasRenderingContext2D,
  obj: EditorObject,
): Promise<void> {
  const k = SCALE;
  switch (obj.type) {
    case "text": {
      const css = fontCss(obj.fontKey);
      ctx.font = `${css.fontStyle} ${css.fontWeight} ${obj.fontSize * k}px ${css.fontFamily}`;
      ctx.fillStyle = obj.color;
      ctx.textBaseline = "alphabetic";
      /* make sure an extra family's @font-face is actually loaded
         before the canvas measures and paints with it */
      try {
        await document.fonts.load(ctx.font, obj.text);
      } catch {
        /* fallback stack still renders sensibly */
      }
      const ascent = obj.fontSize * 0.75;
      const lineH = obj.fontSize * 1.3;
      const maxW = Math.max(obj.w, obj.fontSize * 0.5) * k;
      let i = 0;
      for (const raw of obj.text.split("\n")) {
        let line = "";
        for (const word of raw.split(/(\s+)/)) {
          if (ctx.measureText(line + word).width <= maxW || !line) {
            line += word;
          } else {
            ctx.fillText(line, obj.x * k, (obj.y + ascent + i * lineH) * k);
            i += 1;
            line = word.replace(/^\s+/, "");
          }
        }
        if (line) {
          ctx.fillText(line, obj.x * k, (obj.y + ascent + i * lineH) * k);
        }
        i += 1;
      }
      break;
    }

    case "whiteout":
    case "rect":
    case "highlight": {
      ctx.globalAlpha = obj.opacity;
      if (obj.fillColor !== "none") {
        ctx.fillStyle = obj.fillColor;
        ctx.fillRect(obj.x * k, obj.y * k, obj.w * k, obj.h * k);
      }
      if (obj.strokeColor) {
        ctx.strokeStyle = obj.strokeColor;
        ctx.lineWidth = obj.strokeWidth * k;
        ctx.strokeRect(obj.x * k, obj.y * k, obj.w * k, obj.h * k);
      }
      ctx.globalAlpha = 1;
      break;
    }

    case "ellipse": {
      ctx.globalAlpha = obj.opacity;
      ctx.beginPath();
      ctx.ellipse(
        (obj.x + obj.w / 2) * k,
        (obj.y + obj.h / 2) * k,
        (obj.w / 2) * k,
        (obj.h / 2) * k,
        0,
        0,
        Math.PI * 2,
      );
      if (obj.fillColor !== "none") {
        ctx.fillStyle = obj.fillColor;
        ctx.fill();
      }
      if (obj.strokeColor) {
        ctx.strokeStyle = obj.strokeColor;
        ctx.lineWidth = obj.strokeWidth * k;
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      break;
    }

    case "line": {
      ctx.strokeStyle = obj.strokeColor;
      ctx.lineWidth = obj.strokeWidth * k;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(obj.x1 * k, obj.y1 * k);
      ctx.lineTo(obj.x2 * k, obj.y2 * k);
      ctx.stroke();
      break;
    }

    case "pen": {
      ctx.globalAlpha = obj.opacity;
      ctx.strokeStyle = obj.strokeColor;
      ctx.lineWidth = obj.strokeWidth * k;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      obj.points.forEach((p, idx) => {
        const px = (obj.x + p.x) * k;
        const py = (obj.y + p.y) * k;
        if (idx === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.stroke();
      ctx.globalAlpha = 1;
      break;
    }

    case "image":
    case "signature": {
      if (obj.w < 0.5 || obj.h < 0.5) break;
      try {
        const img = await loadImage(obj.src);
        ctx.drawImage(img, obj.x * k, obj.y * k, obj.w * k, obj.h * k);
      } catch {
        /* a broken stamp must not kill the whole export */
      }
      break;
    }
  }
}

/**
 * Build the export PDF: render each page from the decrypted pdf.js
 * view, composite that page's objects on top, embed as a PNG page.
 */
export async function rasterExportDocument(
  pages: PageEntry[],
  objects: EditorObject[],
): Promise<Uint8Array> {
  const proxy: PDFDocumentProxy | null = getRenderProxy();
  if (!proxy) throw new Error("no-document");
  const lib = await loadPdfLib();
  const out = await lib.PDFDocument.create();

  const byPage = new Map<string, EditorObject[]>();
  for (const obj of objects) {
    const list = byPage.get(obj.pageId) ?? [];
    list.push(obj);
    byPage.set(obj.pageId, list);
  }

  for (const p of pages) {
    /* 1. paint the page (original render + any user rotation) */
    let canvas: HTMLCanvasElement;
    if (p.srcIndex !== null) {
      const page = await proxy.getPage(p.srcIndex + 1);
      const viewport = page.getViewport({ scale: SCALE });
      const raw = document.createElement("canvas");
      raw.width = Math.max(1, Math.floor(viewport.width));
      raw.height = Math.max(1, Math.floor(viewport.height));
      await page.render({ canvas: raw, viewport }).promise;
      const userTurns =
        Math.round(((((p.rotation - page.rotate) % 360) + 360) / 90)) % 4;
      canvas = rotateCanvas(raw, userTurns);
      page.cleanup();
    } else {
      canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(p.width * SCALE));
      canvas.height = Math.max(1, Math.round(p.height * SCALE));
      const cctx = canvas.getContext("2d");
      if (cctx) {
        cctx.fillStyle = "#ffffff";
        cctx.fillRect(0, 0, canvas.width, canvas.height);
      }
    }

    /* 2. composite this page's objects on top, in z-order */
    const ctx = canvas.getContext("2d");
    const list = byPage.get(p.id) ?? [];
    if (ctx) {
      for (const obj of list) {
        await drawObject(ctx, obj);
      }
    }

    /* 3. embed as a PNG page sized in points */
    const blob = await new Promise<Blob | null>((res) =>
      canvas.toBlob(res, "image/png"),
    );
    if (blob) {
      const image = await out.embedPng(
        new Uint8Array(await blob.arrayBuffer()),
      );
      const w = canvas.width / SCALE;
      const h = canvas.height / SCALE;
      out.addPage([w, h]).drawImage(image, { x: 0, y: 0, width: w, height: h });
    }
    canvas.width = 0;
    canvas.height = 0;
  }
  return out.save({ useObjectStreams: true });
}
