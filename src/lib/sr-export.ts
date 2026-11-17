/* ============================================================================
 * Punjab Registry Estimator — export builders.
 *
 * v0.10.1: the PDF/JPG export no longer uses html2canvas + jsPDF. The
 * branded sheet is now drawn directly on a <canvas> (the browser's own
 * text engine — which is also what gives us correct Urdu/Nastaliq
 * shaping) and the PDF is assembled with pdf-lib — the same library the
 * site's other 11 PDF tools already use in production. No third-party
 * capture scripts, no /vendor/ files, nothing that can break with a
 * browser update; it works identically in light and dark mode.
 *
 * v0.10.1 paper sizes: the tool offers A4 (default, full sheet — exactly
 * the layout below), ½ A4 (148×210mm — the same sheet re-drawn compact at
 * 560px so the print size stays readable, flowing onto extra half pages at
 * section boundaries when a heavy multi-party estimate cannot fit one
 * page) and ¼ Foolscap (108×165mm — a one-page summary slip: value, the
 * three section totals, grand total and filer saving, centred).
 *
 * Every output carries the FreeSeak brand: "Powered by FreeSeak —
 * freeseak.com" on the PDF, image, print sheet, WhatsApp text and
 * clipboard summary.
 * ========================================================================== */

import { SR_RATES } from "./punjab-rates";
import type { SrRegistryResult } from "./punjab-registry-engine";
import { SR_STRINGS, type SrLang } from "./punjab-strings";

export interface SrProfile {
  name: string;
  firm: string;
  phone: string;
  address: string;
}

export const EMPTY_PROFILE: SrProfile = { name: "", firm: "", phone: "", address: "" };

const NAVY = "#173B70";
const INK = "#202938";
const MUTED = "#64748B";
const BORDER = "#E3E9F1";
const MIST = "#F3F6FA";
const MINT_DEEP = "#0E8A73";

export function hasProfile(p: SrProfile): boolean {
  return !!(p.name || p.firm || p.phone || p.address);
}

function t(lang: SrLang, key: keyof typeof SR_STRINGS.en): string {
  return SR_STRINGS[lang][key];
}

function rs(n: number): string {
  return "Rs. " + Math.round(n).toLocaleString("en-PK");
}

/* ---- paper sizes (v0.10.1) ------------------------------------------------
 * sheetW: logical canvas width for that paper (keeps ~the same px→pt scale
 *         as A4, so font sizes in px land at similar sizes on every paper)
 * pdfW/pdfH/pdfM: PDF page size + margin in points (1mm = 2.8346pt).
 * a4 210×297 · a5 148×210 · qf (¼ foolscap) 108×165mm
 * -------------------------------------------------------------------------- */
export type SrPaper = "a4" | "a5" | "qf";

const PAPER: Record<SrPaper, { sheetW: number; pdfW: number; pdfH: number; pdfM: number }> = {
  a4: { sheetW: 794, pdfW: 595.28, pdfH: 841.89, pdfM: 24 },
  a5: { sheetW: 560, pdfW: 419.53, pdfH: 595.28, pdfM: 16 },
  qf: { sheetW: 396, pdfW: 306.14, pdfH: 467.72, pdfM: 16 },
};

/* ---- date with weekday (v0.10.1 fix #2) --------------------------------- */
export function formatSheetDate(lang: SrLang): string {
  const now = new Date();
  try {
    return lang === "ur"
      ? now.toLocaleDateString("ur-PK", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : now.toLocaleDateString("en-GB", {
          weekday: "short",
          day: "2-digit",
          month: "short",
          year: "numeric",
        });
  } catch {
    return now.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  }
}

/* ---- one shared row model: the results card (React), the canvas sheet,
   the print sheet and the plain-text summary all render from this, so
   they can never disagree about a number ---------------------------------- */
export interface SrRow {
  lbl: string;
  val: string;
  strong?: boolean;
  group?: "c32" | "fbr" | "oth";
}

export function buildRows(res: SrRegistryResult, lang: SrLang): SrRow[] {
  const rows: SrRow[] = [];
  rows.push({ lbl: t(lang, "stampDuty"), val: rs(res.stamp), group: "c32" });
  rows.push({ lbl: t(lang, "committeeLabel"), val: rs(res.committee), group: "c32" });
  rows.push({ lbl: t(lang, "plraLabel"), val: rs(res.plra), group: "c32" });
  rows.push({ lbl: t(lang, "borFeeLabel"), val: rs(res.borFee), group: "c32" });
  rows.push({ lbl: t(lang, "mutationFeeLabel"), val: rs(res.mutFee), group: "c32" });
  rows.push({ lbl: t(lang, "plraMutLabel"), val: rs(res.plraMut), group: "c32" });
  rows.push({ lbl: t(lang, "challan32ATotal"), val: rs(res.c32Tot), strong: true, group: "c32" });

  if (res.btDet.length > 1) {
    for (const d of res.btDet) {
      rows.push({
        lbl: `${t(lang, "buyerTaxDetail")} — ${d.name || t(lang, "buyers")} (${d.share}%, ${d.status === "filer" ? t(lang, "filerS") : t(lang, "nonS")})`,
        val: rs(d.tax),
        group: "fbr",
      });
    }
  } else {
    rows.push({ lbl: t(lang, "buyerTaxDetail"), val: rs(res.btTot), group: "fbr" });
  }
  if (res.stDet.length > 1) {
    for (const d of res.stDet) {
      rows.push({
        lbl: `${t(lang, "sellerTaxDetail")} — ${d.name || t(lang, "sellers")} (${d.share}%, ${d.status === "filer" ? t(lang, "filerS") : t(lang, "nonS")})`,
        val: rs(d.tax),
        group: "fbr",
      });
    }
  } else {
    rows.push({ lbl: t(lang, "sellerTaxDetail"), val: rs(res.stTot), group: "fbr" });
  }
  rows.push({ lbl: t(lang, "fbrTotal"), val: rs(res.fbrTot), strong: true, group: "fbr" });

  rows.push({ lbl: t(lang, "regFee"), val: rs(res.oth.reg), group: "oth" });
  rows.push({ lbl: t(lang, "fardMoqa"), val: rs(res.oth.fard), group: "oth" });
  rows.push({ lbl: t(lang, "photoCopy"), val: rs(res.oth.photo), group: "oth" });
  rows.push({ lbl: t(lang, "misc"), val: rs(res.oth.misc), group: "oth" });
  rows.push({ lbl: t(lang, "stampVendor"), val: rs(res.oth.stampVendor), group: "oth" });

  return rows;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/* ==========================================================================
 * Canvas sheet — the single drawing used for BOTH the PDF and the JPG.
 * Drawn at 2x for crisp print quality; logical width 794px (A4 @ 96dpi).
 *
 * opts (v0.10.1 paper sizes):
 *   paper     — "a4" (default) | "a5" (compact 560px re-draw) | "qf" (slip)
 *   groups    — which sections to draw (used when a ½ A4 estimate flows
 *               onto extra pages; default: all three, in canonical order)
 *   slim      — the one-line continuation header for page 2+
 *   foot      — grand total + saving box + footer (default true; false on
 *               non-final pages of a split)
 *   pageLabel — "Page 1 of 2" marker drawn at the foot of the sheet
 * ======================================================================== */

const SHEET_M = 42;
const SHEET_SCALE = 2;

export interface SrSheetOpts {
  paper?: SrPaper;
  groups?: Array<"c32" | "fbr" | "oth">;
  slim?: boolean;
  foot?: boolean;
  pageLabel?: string;
}

interface SheetTheme {
  ur: boolean;
  body: string;
  label: number;
  section: number;
  row: number;
  rowH: number;
  secH: number;
  big: number;
  strip: number;
  stripH: number;
}

function themeFor(ur: boolean, sans: string, compact = false): SheetTheme {
  /* Nastaliq needs ~18% more size and much more line height (v0.10.1 #8) */
  const k = ur ? 1.18 : 1;
  if (compact) {
    /* ½ A4: drawn 560px wide, printed 132mm — keeps ~A4 text size */
    return {
      ur,
      body: ur ? `"Jameel Noori Nastaleeq", ${sans}` : sans,
      label: 11 * k,
      section: 10.5 * k,
      row: 11 * k,
      rowH: ur ? 27 : 21,
      secH: ur ? 34 : 27,
      big: 13 * k,
      strip: 9.5 * k,
      stripH: ur ? 58 : 50,
    };
  }
  return {
    ur,
    body: ur ? `"Jameel Noori Nastaleeq", ${sans}` : sans,
    label: 12.5 * k,
    section: 12 * k,
    row: 12.5 * k,
    rowH: ur ? 34 : 25,
    secH: ur ? 42 : 32,
    big: 15 * k,
    strip: 10.5 * k,
    stripH: ur ? 74 : 62,
  };
}

function rr(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x + w, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxW: number,
): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? cur + " " + w : w;
    if (ctx.measureText(next).width > maxW && cur) {
      lines.push(cur);
      cur = w;
    } else {
      cur = next;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

export async function drawSheet(
  res: SrRegistryResult,
  lang: SrLang,
  profile: SrProfile,
  clientName: string,
  areaName: string,
  opts: SrSheetOpts = {},
): Promise<HTMLCanvasElement> {
  const paper: SrPaper = opts.paper ?? "a4";
  const compact = paper === "a5";
  const slim = !!opts.slim;
  const foot = opts.foot !== false;
  const ur = lang === "ur";
  const sans =
    typeof document !== "undefined"
      ? getComputedStyle(document.body).fontFamily || "Arial, sans-serif"
      : "Arial, sans-serif";
  const th = themeFor(ur, sans, compact);
  const sheetW = PAPER[paper].sheetW;
  const sheetM = compact ? 30 : SHEET_M;

  if (ur) {
    try {
      await document.fonts.load('16px "Jameel Noori Nastaleeq"');
    } catch {
      /* fallback font is acceptable */
    }
  }

  const rows = buildRows(res, lang);
  const byGroup = (g: "c32" | "fbr" | "oth") => rows.filter((r) => r.group === g);
  const groups = opts.groups ?? (["c32", "fbr", "oth"] as const);

  /* --- measure pass: exact height first, then draw. Rows never wrap (they
     are sized to the sheet width), so the height is closed-form --------- */
  const measure = document.createElement("canvas").getContext("2d");
  if (!measure) throw new Error("canvas unavailable");
  const font = (px: number, weight = "") =>
    `${weight ? weight + " " : ""}${px}px ${th.body}`.trim();

  const topPad = compact ? 32 : 40;
  const dateM = compact ? 22 : 26;
  const clientM = clientName || areaName ? (compact ? 24 : 26) : 0;
  const gapM = compact ? 6 : 14;
  const headerM = slim
    ? compact ? (ur ? 48 : 40) : ur ? 56 : 48
    : hasProfile(profile)
      ? compact
        ? profile.address || profile.phone ? 76 : 64
        : profile.address || profile.phone ? 96 : 82
      : compact ? 52 : 72;
  const stripM = slim ? 0 : th.stripH + (compact ? 14 : 18);

  let H = topPad + headerM + dateM + clientM + gapM + stripM;
  for (const g of groups) H += th.secH + byGroup(g).length * th.rowH;
  if (foot) H += 14 + (compact ? (ur ? 52 : 44) : ur ? 62 : 52);
  if (foot && res.fbrTot > 0 && !res.allOff) H += compact ? 22 : 26;
  if (foot && res.filerSaving > 0)
    H += (compact ? (ur ? 70 : 56) : ur ? 84 : 66) + (compact ? 10 : 12);
  /* footer: note (wrapped) + effective + brand — and the page label */
  measure.font = font(ur ? (compact ? 11.5 : 13) : compact ? 10 : 11);
  const noteLines = wrapText(measure, `* ${t(lang, "resultsNote")}`, sheetW - sheetM * 2 - 10);
  if (foot)
    H +=
      noteLines.length * (compact ? (ur ? 22 : 16) : ur ? 26 : 18) +
      (compact ? 40 : 20) + 18 + (compact ? 26 : 34);
  if (opts.pageLabel) H += 26;

  const canvas = document.createElement("canvas");
  canvas.width = sheetW * SHEET_SCALE;
  canvas.height = Math.ceil(H) * SHEET_SCALE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas unavailable");
  ctx.scale(SHEET_SCALE, SHEET_SCALE);
  ctx.textBaseline = "alphabetic";
  if (ur) ctx.direction = "rtl";

  const innerW = sheetW - sheetM * 2;
  const xL = sheetM; /* left edge of content */
  const xR = sheetW - sheetM; /* right edge of content */

  const tx = (
    str: string,
    x: number,
    y: number,
    px: number,
    color: string,
    weight = "",
    align: CanvasTextAlign = "left",
  ) => {
    ctx.font = font(px, weight);
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.fillText(str, x, y);
  };

  /* background */
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, sheetW, H);

  let y = topPad;

  /* --- header --- */
  if (slim) {
    tx(
      profile.firm || profile.name || "PUNJAB REGISTRY ESTIMATOR",
      sheetW / 2,
      y + (compact ? 15 : 18),
      compact ? (ur ? 16 : 14) : ur ? 18 : 16,
      NAVY,
      "bold",
      "center",
    );
    tx(formatSheetDate(lang), sheetW / 2, y + (compact ? 28 : 33), compact ? 9.5 : 10.5, MUTED, "", "center");
    y += headerM;
  } else if (hasProfile(profile)) {
    if (profile.firm) {
      tx(profile.firm, sheetW / 2, y + 20, compact ? (ur ? 19 : 18) : ur ? 22 : 21, NAVY, "bold", "center");
      y += compact ? (ur ? 28 : 24) : ur ? 34 : 28;
    }
    if (profile.name) {
      tx(profile.name, sheetW / 2, y + (compact ? 12 : 14), compact ? (ur ? 13 : 12) : ur ? 15 : 13, INK, "", "center");
      y += compact ? (ur ? 22 : 18) : ur ? 26 : 20;
    }
    if (profile.phone || profile.address) {
      tx(
        [profile.phone, profile.address].filter(Boolean).join(" · "),
        sheetW / 2,
        y + (compact ? 10 : 11),
        compact ? (ur ? 11.5 : 10.5) : ur ? 12.5 : 11,
        MUTED,
        "",
        "center",
      );
      y += compact ? (ur ? 19 : 15) : ur ? 22 : 17;
    }
    tx(
      `${t(lang, "propDeedTitle")} · PUNJAB REGISTRY ESTIMATOR`,
      sheetW / 2,
      y + (compact ? 8 : 10),
      compact ? 8.5 : 10,
      MUTED,
      "",
      "center",
    );
    y += compact ? 16 : 20;
  } else {
    tx("PUNJAB REGISTRY ESTIMATOR", sheetW / 2, y + (compact ? 18 : 24), compact ? (ur ? 18 : 17) : 22, NAVY, "bold", "center");
    tx("PUNJAB, PAKISTAN", sheetW / 2, y + (compact ? 33 : 46), compact ? 9.5 : 11, MUTED, "", "center");
    y += compact ? 46 : 60;
  }

  /* --- date (with weekday, v0.10.1 #2) + client/area line (#3) --- */
  tx(formatSheetDate(lang), sheetW / 2, y + (compact ? 11 : 12), compact ? (ur ? 12 : 10.5) : ur ? 13 : 11, MUTED, "", "center");
  y += compact ? 18 : 22;
  if (clientName || areaName) {
    const bits: string[] = [];
    if (clientName) bits.push(`${t(lang, "client")}: ${clientName}`);
    if (areaName) bits.push(`${t(lang, "areaLbl")}: ${areaName}`);
    tx(bits.join("   ·   "), sheetW / 2, y + (compact ? 12 : 13), compact ? (ur ? 13 : 11.5) : ur ? 14.5 : 12.5, INK, "bold", "center");
    y += compact ? 22 : 26;
  }
  y += compact ? 4 : 6;

  /* --- value strip (mist cells) --- */
  if (!slim) {
    const cells: { lbl: string; val: string; accent?: boolean }[] = [
      { lbl: t(lang, "landValueLabel"), val: rs(res.landVal) },
      ...(res.constrVal > 0
        ? [{ lbl: t(lang, "constrValueLabel"), val: rs(res.constrVal) }]
        : []),
      { lbl: t(lang, "totalValueLabel"), val: rs(res.total), accent: true },
    ];
    const gap = compact ? 8 : 10;
    const cw = (innerW - gap * (cells.length - 1)) / cells.length;
    for (let i = 0; i < cells.length; i++) {
      const cx = xL + i * (cw + gap);
      ctx.fillStyle = cells[i].accent ? "#EEF4FE" : MIST;
      rr(ctx, cx, y, cw, th.stripH, compact ? 8 : 10);
      ctx.fill();
      tx(cells[i].lbl, cx + cw / 2, y + (compact ? (ur ? 26 : 21) : ur ? 30 : 24), th.strip, MUTED, "", "center");
      tx(
        cells[i].val,
        cx + cw / 2,
        y + (compact ? (ur ? 49 : 39) : ur ? 58 : 46),
        compact ? (ur ? 13.5 : 12.5) : ur ? 15.5 : 14,
        cells[i].accent ? NAVY : INK,
        "bold",
        "center",
      );
    }
    y += stripM;
  }

  /* --- sections --- */
  const section = (title: string, list: SrRow[]) => {
    tx(title, ur ? xR : xL, y + (compact ? 14 : 16), th.section, NAVY, "bold", ur ? "right" : "left");
    ctx.strokeStyle = BORDER;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(xL, y + (compact ? (ur ? 24 : 20) : ur ? 28 : 24));
    ctx.lineTo(xR, y + (compact ? (ur ? 24 : 20) : ur ? 28 : 24));
    ctx.stroke();
    y += th.secH;
    for (const r of list) {
      tx(
        r.lbl,
        ur ? xR : xL,
        y + (compact ? 13 : 15),
        th.row,
        r.strong ? INK : "#3D4A5E",
        r.strong ? "bold" : "",
        ur ? "right" : "left",
      );
      tx(r.val, ur ? xL : xR, y + (compact ? 13 : 15), th.row, r.strong ? NAVY : INK, "bold", ur ? "left" : "right");
      if (r.strong) {
        ctx.strokeStyle = BORDER;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(xL, y + th.rowH - (compact ? 5 : 6));
        ctx.lineTo(xR, y + th.rowH - (compact ? 5 : 6));
        ctx.stroke();
        ctx.setLineDash([]);
      }
      y += th.rowH;
    }
  };

  const titles: Record<"c32" | "fbr" | "oth", string> = {
    c32: t(lang, "challan32A"),
    fbr: t(lang, "fbrSection"),
    oth: t(lang, "otherSection"),
  };
  for (const g of groups) section(titles[g], byGroup(g));

  if (foot) {
    /* --- grand total bar --- */
    y += 14;
    const barH = compact ? (ur ? 52 : 44) : ur ? 62 : 52;
    ctx.fillStyle = NAVY;
    rr(ctx, xL, y, innerW, barH, compact ? 10 : 12);
    ctx.fill();
    tx(
      res.allOff ? t(lang, "grandTotalExclFBR") : t(lang, "grandTotal"),
      ur ? xR - (compact ? 16 : 20) : xL + (compact ? 16 : 20),
      y + barH / 2 + (compact ? (ur ? 7 : 5) : ur ? 8 : 6),
      th.big,
      "#FFFFFF",
      "bold",
      ur ? "right" : "left",
    );
    tx(
      rs(res.grand),
      ur ? xL + (compact ? 16 : 20) : xR - (compact ? 16 : 20),
      y + barH / 2 + (compact ? (ur ? 8 : 7) : ur ? 10 : 8),
      compact ? (ur ? 16 : 15) : ur ? 19 : 18,
      "#FFFFFF",
      "bold",
      ur ? "left" : "right",
    );
    y += barH;
    if (res.fbrTot > 0 && !res.allOff) {
      tx(
        `${t(lang, "grandTotalExclFBR")}: ${rs(res.grand - res.fbrTot)}`,
        ur ? xR : xL,
        y + (compact ? 16 : 18),
        compact ? (ur ? 12 : 10.5) : ur ? 13.5 : 12,
        MUTED,
        "bold",
        ur ? "right" : "left",
      );
      y += compact ? 22 : 26;
    }

    /* --- filer saving box --- */
    if (res.filerSaving > 0) {
      y += compact ? 10 : 12;
      const boxH = compact ? (ur ? 70 : 56) : ur ? 84 : 66;
      ctx.fillStyle = "#F0FBF7";
      rr(ctx, xL, y, innerW, boxH, compact ? 8 : 10);
      ctx.fill();
      ctx.strokeStyle = "#BBE7DD";
      ctx.lineWidth = 1.5;
      rr(ctx, xL, y, innerW, boxH, compact ? 8 : 10);
      ctx.stroke();
      tx(
        `${t(lang, "filerSavingTitle")}: ${rs(res.filerSaving)}`,
        ur ? xR - (compact ? 12 : 16) : xL + (compact ? 12 : 16),
        y + (compact ? (ur ? 30 : 22) : ur ? 36 : 26),
        compact ? (ur ? 13 : 11.5) : ur ? 15 : 13,
        MINT_DEEP,
        "bold",
        ur ? "right" : "left",
      );
      let sub = "";
      if (res.buyerSaving > 0 && res.sellerSaving > 0)
        sub = `${t(lang, "buyerSavingLabel")}: ${rs(res.buyerSaving)} · ${t(lang, "sellerSavingLabel")}: ${rs(res.sellerSaving)}`;
      else if (res.buyerSaving > 0) sub = t(lang, "filerSavingSubBuyer");
      else if (res.sellerSaving > 0) sub = t(lang, "filerSavingSubSeller");
      if (sub)
        tx(
          sub,
          ur ? xR - (compact ? 12 : 16) : xL + (compact ? 12 : 16),
          y + (compact ? (ur ? 56 : 42) : ur ? 68 : 48),
          compact ? (ur ? 11.5 : 10) : ur ? 13 : 11.5,
          MUTED,
          "",
          ur ? "right" : "left",
        );
      y += boxH;
    }

    /* --- footer --- */
    y += compact ? 16 : 22;
    ctx.strokeStyle = BORDER;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(xL, y);
    ctx.lineTo(xR, y);
    ctx.stroke();
    y += compact ? 13 : 16;
    for (const line of noteLines) {
      tx(line, sheetW / 2, y + (compact ? (ur ? 14 : 11) : ur ? 16 : 12), compact ? (ur ? 11.5 : 10) : ur ? 13 : 11, MUTED, "", "center");
      y += compact ? (ur ? 22 : 16) : ur ? 26 : 18;
    }
    y += compact ? 4 : 6;
    tx(
      `${t(lang, "ratesEffectiveLabel")} ${SR_RATES.ratesEffective}`,
      sheetW / 2,
      y + 12,
      compact ? (ur ? 11.5 : 10) : ur ? 13 : 11,
      MUTED,
      "",
      "center",
    );
    y += compact ? (ur ? 24 : 18) : ur ? 28 : 22;
    tx("Powered by FreeSeak — freeseak.com", sheetW / 2, y + 13, compact ? (ur ? 13 : 11) : ur ? 15 : 12.5, MINT_DEEP, "bold", "center");
  }

  /* --- page label (continuation pages of a split ½ A4 estimate) --- */
  if (opts.pageLabel) {
    y += 10;
    tx(opts.pageLabel, sheetW / 2, y + 12, compact ? 9.5 : 10, MUTED, "", "center");
  }

  return canvas;
}

/* ==========================================================================
 * ¼ Foolscap summary slip (108×165mm). The full breakdown would need ~5pt
 * text on quarter paper, so this size prints the numbers that matter:
 * property value, the three section totals, grand total, filer saving.
 * Drawn at 396px logical width; comfortably one page, centred on the PDF.
 * ======================================================================== */
export async function drawSlipSheet(
  res: SrRegistryResult,
  lang: SrLang,
  profile: SrProfile,
  clientName: string,
  areaName: string,
): Promise<HTMLCanvasElement> {
  const ur = lang === "ur";
  const sans =
    typeof document !== "undefined"
      ? getComputedStyle(document.body).fontFamily || "Arial, sans-serif"
      : "Arial, sans-serif";
  const body = ur ? `"Jameel Noori Nastaleeq", ${sans}` : sans;
  const sheetW = PAPER.qf.sheetW;
  const sheetM = 26;
  const innerW = sheetW - sheetM * 2;
  const xL = sheetM;
  const xR = sheetW - sheetM;

  if (ur) {
    try {
      await document.fonts.load('16px "Jameel Noori Nastaleeq"');
    } catch {
      /* fallback font is acceptable */
    }
  }

  const othTot = res.oth.reg + res.oth.fard + res.oth.photo + res.oth.misc + res.oth.stampVendor;

  const measure = document.createElement("canvas").getContext("2d");
  if (!measure) throw new Error("canvas unavailable");
  const font = (px: number, weight = "") =>
    `${weight ? weight + " " : ""}${px}px ${body}`.trim();

  const rowH = ur ? 30 : 24;
  const nRows = 1 /* property value */ + 1 /* 32-A */ + (res.fbrTot > 0 ? 1 : 0) + (othTot > 0 ? 1 : 0);
  const headerH = hasProfile(profile) ? (profile.address || profile.phone ? (ur ? 74 : 62) : (ur ? 60 : 50)) : ur ? 58 : 48;
  const barH = ur ? 48 : 42;
  const savingH = res.filerSaving > 0 ? (ur ? 44 : 36) + 10 : 0;
  const exclH = res.fbrTot > 0 && !res.allOff ? 22 : 0;
  measure.font = font(ur ? 12 : 10);
  const noteLines = wrapText(measure, `* ${t(lang, "resultsNote")}`, innerW - 8);
  const footH = 14 + noteLines.length * (ur ? 22 : 15) + (ur ? 22 : 18) + 26 + 18;

  let H = 24 + headerH + 20 + (clientName || areaName ? 24 : 0) + 6 + 22 + nRows * rowH + 12 + barH + exclH + savingH + footH;

  const canvas = document.createElement("canvas");
  canvas.width = sheetW * SHEET_SCALE;
  canvas.height = Math.ceil(H) * SHEET_SCALE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas unavailable");
  ctx.scale(SHEET_SCALE, SHEET_SCALE);
  ctx.textBaseline = "alphabetic";
  if (ur) ctx.direction = "rtl";

  const tx = (
    str: string,
    x: number,
    y: number,
    px: number,
    color: string,
    weight = "",
    align: CanvasTextAlign = "left",
  ) => {
    ctx.font = font(px, weight);
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.fillText(str, x, y);
  };

  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, sheetW, H);
  let y = 24;

  /* --- header --- */
  if (hasProfile(profile)) {
    if (profile.firm) {
      tx(profile.firm, sheetW / 2, y + 16, ur ? 17 : 16, NAVY, "bold", "center");
      y += ur ? 26 : 22;
    }
    if (profile.name) {
      tx(profile.name, sheetW / 2, y + 11, ur ? 13 : 12, INK, "", "center");
      y += ur ? 20 : 16;
    }
    if (profile.phone || profile.address) {
      tx(
        [profile.phone, profile.address].filter(Boolean).join(" · "),
        sheetW / 2,
        y + 10,
        ur ? 11.5 : 10.5,
        MUTED,
        "",
        "center",
      );
      y += ur ? 18 : 15;
    }
    tx(`${t(lang, "propDeedTitle")} · PUNJAB REGISTRY ESTIMATOR`, sheetW / 2, y + 8, 8, MUTED, "", "center");
    y += 14;
  } else {
    tx("PUNJAB REGISTRY ESTIMATOR", sheetW / 2, y + 16, ur ? 17 : 16, NAVY, "bold", "center");
    tx("PUNJAB, PAKISTAN", sheetW / 2, y + 30, 9, MUTED, "", "center");
    y += ur ? 52 : 44;
  }

  /* --- date + client/area --- */
  tx(formatSheetDate(lang), sheetW / 2, y + 10, ur ? 12 : 10, MUTED, "", "center");
  y += 20;
  if (clientName || areaName) {
    const bits: string[] = [];
    if (clientName) bits.push(`${t(lang, "client")}: ${clientName}`);
    if (areaName) bits.push(`${t(lang, "areaLbl")}: ${areaName}`);
    measure.font = font(ur ? 12.5 : 11, "bold");
    const wrapped = wrapText(measure, bits.join("   ·   "), innerW);
    for (const line of wrapped) {
      tx(line, sheetW / 2, y + 11, ur ? 12.5 : 11, INK, "bold", "center");
      y += 16;
    }
    y += 6;
  } else {
    y += 6;
  }

  /* --- summary title --- */
  tx(t(lang, "summaryTitle"), sheetW / 2, y + 10, ur ? 12.5 : 10.5, NAVY, "bold", "center");
  ctx.strokeStyle = BORDER;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(xL, y + (ur ? 18 : 15));
  ctx.lineTo(xR, y + (ur ? 18 : 15));
  ctx.stroke();
  y += 22;

  /* --- summary rows --- */
  const srow = (lbl: string, val: string, accent = false) => {
    tx(lbl, ur ? xR : xL, y + (ur ? 20 : 16), ur ? 14.5 : 12, accent ? NAVY : "#3D4A5E", accent ? "bold" : "", ur ? "right" : "left");
    tx(val, ur ? xL : xR, y + (ur ? 20 : 16), ur ? 14 : 12.5, accent ? NAVY : INK, "bold", ur ? "left" : "right");
    ctx.strokeStyle = BORDER;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(xL, y + rowH - 5);
    ctx.lineTo(xR, y + rowH - 5);
    ctx.stroke();
    y += rowH;
  };

  srow(t(lang, "totalValueLabel"), rs(res.total), true);
  srow(t(lang, "challan32ATotal"), rs(res.c32Tot));
  if (res.fbrTot > 0) srow(t(lang, "fbrTotal"), rs(res.fbrTot));
  if (othTot > 0) srow(t(lang, "otherSection"), rs(othTot));

  /* --- grand total bar --- */
  y += 12;
  ctx.fillStyle = NAVY;
  rr(ctx, xL, y, innerW, barH, 9);
  ctx.fill();
  tx(
    res.allOff ? t(lang, "grandTotalExclFBR") : t(lang, "grandTotal"),
    ur ? xR - 14 : xL + 14,
    y + barH / 2 + (ur ? 7 : 5),
    ur ? 16.5 : 13.5,
    "#FFFFFF",
    "bold",
    ur ? "right" : "left",
  );
  tx(rs(res.grand), ur ? xL + 14 : xR - 14, y + barH / 2 + (ur ? 8 : 6), 18, "#FFFFFF", "bold", ur ? "left" : "right");
  y += barH;
  if (res.fbrTot > 0 && !res.allOff) {
    tx(
      `${t(lang, "grandTotalExclFBR")}: ${rs(res.grand - res.fbrTot)}`,
      ur ? xR : xL,
      y + 16,
      ur ? 12 : 10,
      MUTED,
      "bold",
      ur ? "right" : "left",
    );
    y += 22;
  }

  /* --- filer saving one-liner --- */
  if (res.filerSaving > 0) {
    y += 10;
    ctx.fillStyle = "#F0FBF7";
    rr(ctx, xL, y, innerW, ur ? 44 : 36, 8);
    ctx.fill();
    ctx.strokeStyle = "#BBE7DD";
    ctx.lineWidth = 1.5;
    rr(ctx, xL, y, innerW, ur ? 44 : 36, 8);
    ctx.stroke();
    tx(
      `${t(lang, "filerSavingTitle")}:`,
      ur ? xR - 12 : xL + 12,
      y + (ur ? 28 : 23),
      ur ? 13 : 11,
      MINT_DEEP,
      "bold",
      ur ? "right" : "left",
    );
    tx(rs(res.filerSaving), ur ? xL + 12 : xR - 12, y + (ur ? 28 : 23), 13.5, MINT_DEEP, "bold", ur ? "left" : "right");
    y += ur ? 44 : 36;
  }

  /* --- footer --- */
  y += 14;
  ctx.strokeStyle = BORDER;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(xL, y);
  ctx.lineTo(xR, y);
  ctx.stroke();
  y += 8;
  for (const line of noteLines) {
    tx(line, sheetW / 2, y + (ur ? 14 : 11), ur ? 12 : 10, MUTED, "", "center");
    y += ur ? 22 : 15;
  }
  tx(
    `${t(lang, "ratesEffectiveLabel")} ${SR_RATES.ratesEffective}`,
    sheetW / 2,
    y + 12,
    ur ? 12 : 10,
    MUTED,
    "",
    "center",
  );
  y += ur ? 22 : 18;
  tx("Powered by FreeSeak — freeseak.com", sheetW / 2, y + 12, ur ? 13 : 11, MINT_DEEP, "bold", "center");

  return canvas;
}

/* ==========================================================================
 * Pagination for ½ A4: if the compact sheet fits one page (a plain
 * estimate always does), return it as-is — at most a hair over, which the
 * PDF embed scales down by ≤6% (invisible). Heavy multi-party estimates
 * flow onto extra half pages, breaking ONLY at section boundaries, with a
 * slim header and a "Page i of n" marker on every continuation page and
 * the grand total + saving box always on the last one.
 * ======================================================================== */
export async function drawSheetPages(
  res: SrRegistryResult,
  lang: SrLang,
  profile: SrProfile,
  clientName: string,
  areaName: string,
  paper: SrPaper = "a4",
): Promise<HTMLCanvasElement[]> {
  if (paper === "qf") {
    return [await drawSlipSheet(res, lang, profile, clientName, areaName)];
  }
  if (paper === "a4") {
    return [await drawSheet(res, lang, profile, clientName, areaName)];
  }

  const { pdfW, pdfH, pdfM, sheetW } = PAPER.a5;
  const budget = ((pdfH - pdfM * 2) * sheetW) / (pdfW - pdfM * 2); /* ~814px */

  const full = await drawSheet(res, lang, profile, clientName, areaName, { paper: "a5" });
  if (full.height / SHEET_SCALE <= budget * 1.06) return [full];

  /* greedy fill: biggest prefix of the remaining sections that fits */
  const order: Array<"c32" | "fbr" | "oth"> = ["c32", "fbr", "oth"];
  const slices: Array<{ groups: Array<"c32" | "fbr" | "oth">; slim: boolean }> = [];
  let rest = [...order];
  let first = true;
  let guard = 0;
  while (rest.length > 0 && guard++ < 6) {
    let take = 0;
    for (let i = 1; i <= rest.length; i++) {
      const cv = await drawSheet(res, lang, profile, clientName, areaName, {
        paper: "a5",
        groups: rest.slice(0, i),
        slim: !first,
        foot: i === rest.length,
      });
      if (cv.height / SHEET_SCALE <= budget) {
        take = i;
        if (i === rest.length) break;
      } else {
        break;
      }
    }
    if (take === 0) take = 1; /* a single section always gets its own page */
    slices.push({ groups: rest.slice(0, take), slim: !first });
    rest = rest.slice(take);
    first = false;
  }
  if (rest.length > 0) slices.push({ groups: rest, slim: true }); /* safety */

  const n = slices.length;
  const pages: HTMLCanvasElement[] = [];
  for (let i = 0; i < n; i++) {
    pages.push(
      await drawSheet(res, lang, profile, clientName, areaName, {
        paper: "a5",
        groups: slices[i].groups,
        slim: slices[i].slim,
        foot: i === n - 1,
        pageLabel:
          n > 1
            ? `${t(lang, "pageOfPrefix")} ${i + 1} ${t(lang, "pageOfMid")} ${n}`
            : undefined,
      }),
    );
  }
  return pages;
}

/* ---- PDF via pdf-lib (same library as the site's other PDF tools) ------ */
export async function buildPDFBlob(
  res: SrRegistryResult,
  lang: SrLang,
  profile: SrProfile,
  clientName: string,
  areaName: string,
  paper: SrPaper = "a4",
): Promise<Blob> {
  const canvases = await drawSheetPages(res, lang, profile, clientName, areaName, paper);
  const { PDFDocument } = await import("pdf-lib");
  const pdf = await PDFDocument.create();
  pdf.setTitle(
    paper === "qf"
      ? "Punjab Registry Estimate — Summary Slip"
      : "Punjab Registry Estimate",
  );
  pdf.setProducer("FreeSeak (freeseak.com)");
  pdf.setCreator("FreeSeak (freeseak.com)");
  const { pdfW, pdfH, pdfM } = PAPER[paper];
  for (const canvas of canvases) {
    const img = await pdf.embedJpg(canvas.toDataURL("image/jpeg", 0.94));
    const page = pdf.addPage([pdfW, pdfH]);
    const maxW = pdfW - pdfM * 2;
    const maxH = pdfH - pdfM * 2;
    let w = maxW;
    let h = (canvas.height * w) / canvas.width;
    if (h > maxH) {
      h = maxH;
      w = (canvas.width * h) / canvas.height;
    }
    page.drawImage(img, {
      x: (pdfW - w) / 2,
      y: paper === "qf" ? (pdfH - h) / 2 : pdfH - pdfM - h,
      width: w,
      height: h,
    });
  }
  const bytes = await pdf.save();
  return new Blob([bytes as unknown as BlobPart], { type: "application/pdf" });
}

/* ---- JPG from the same canvas (full sheet on A4/½ A4, slip on ¼) -------- */
export async function buildJPGBlob(
  res: SrRegistryResult,
  lang: SrLang,
  profile: SrProfile,
  clientName: string,
  areaName: string,
  paper: SrPaper = "a4",
): Promise<Blob> {
  const canvas =
    paper === "qf"
      ? await drawSlipSheet(res, lang, profile, clientName, areaName)
      : await drawSheet(res, lang, profile, clientName, areaName, { paper });
  const blob: Blob | null = await new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/jpeg", 0.92),
  );
  if (!blob) throw new Error("encode failed");
  return blob;
}

/* ==========================================================================
 * Print sheet (hidden same-origin iframe — no popups, works everywhere).
 * Same content as the canvas sheet, in HTML. Paper sizes: A4 as before;
 * ½ A4 prints compact at 148×210 (the browser flows extra pages itself,
 * section rows never split); ¼ Foolscap prints the summary slip.
 * ======================================================================== */
export function buildExportHTML(
  res: SrRegistryResult,
  lang: SrLang,
  profile: SrProfile,
  clientName: string,
  areaName: string,
  paper: SrPaper = "a4",
): string {
  if (paper === "qf") {
    return buildSlipHTML(res, lang, profile, clientName, areaName);
  }
  const compact = paper === "a5";
  const ur = lang === "ur";
  const rows = buildRows(res, lang);
  const W = compact ? 640 : 742;
  const fRow = compact ? 11 : 12.5;
  const fSec = compact ? 10.5 : 12;
  const fGrand = compact ? 13 : 15;

  let header: string;
  if (hasProfile(profile)) {
    header =
      `<div style="text-align:center;color:${INK};">` +
      (profile.firm ? `<div style="font-size:${compact ? 17 : 20}px;font-weight:800;color:${NAVY};">${esc(profile.firm)}</div>` : "") +
      (profile.name ? `<div style="font-size:${compact ? 12 : 13}px;color:${INK};">${esc(profile.name)}</div>` : "") +
      (profile.phone || profile.address
        ? `<div style="font-size:${compact ? 10 : 11}px;color:${MUTED};">${esc([profile.phone, profile.address].filter(Boolean).join(" · "))}</div>`
        : "") +
      `<div style="font-size:${compact ? 8.5 : 10}px;color:${MUTED};letter-spacing:.12em;margin-top:4px;">${esc(t(lang, "propDeedTitle")).toUpperCase()} · PUNJAB REGISTRY ESTIMATOR</div>` +
      `</div>`;
  } else {
    header =
      `<div style="text-align:center;color:${INK};">` +
      `<div style="font-size:${compact ? 17 : 21}px;font-weight:800;color:${NAVY};">PUNJAB REGISTRY ESTIMATOR</div>` +
      `<div style="font-size:${compact ? 9.5 : 11}px;color:${MUTED};letter-spacing:.14em;">PUNJAB, PAKISTAN</div>` +
      `</div>`;
  }

  const section = (title: string, bodyRows: SrRow[]) =>
    `<tr><td colspan="2" style="padding:${compact ? 7 : 10}px 0 ${compact ? 3 : 4}px;font-size:${fSec}px;font-weight:800;color:${NAVY};border-bottom:1px solid ${BORDER};">${esc(title)}</td></tr>` +
    bodyRows
      .map(
        (r) =>
          `<tr><td style="padding:${compact ? 3 : 4}px 0;font-size:${fRow}px;color:${INK};${r.strong ? "font-weight:700;" : ""}">${esc(r.lbl)}</td>` +
          `<td style="padding:${compact ? 3 : 4}px 0;font-size:${fRow}px;text-align:${ur ? "left" : "right"};font-weight:700;color:${r.strong ? NAVY : INK};white-space:nowrap;">${esc(r.val)}</td></tr>`,
      )
      .join("");

  const valueStrip =
    `<table style="width:100%;border-collapse:collapse;margin:${compact ? 7 : 10}px 0 ${compact ? 2 : 4}px;">` +
    `<tr>` +
    `<td style="width:33%;padding:${compact ? 6 : 8}px;background:${MIST};border-radius:8px;text-align:center;"><div style="font-size:${compact ? 9 : 10}px;color:${MUTED};">${esc(t(lang, "landValueLabel"))}</div><div style="font-size:${compact ? 12 : 13.5}px;font-weight:800;color:${INK};">${esc(rs(res.landVal))}</div></td>` +
    (res.constrVal > 0
      ? `<td style="width:33%;padding:${compact ? 6 : 8}px;background:${MIST};border-radius:8px;text-align:center;"><div style="font-size:${compact ? 9 : 10}px;color:${MUTED};">${esc(t(lang, "constrValueLabel"))}</div><div style="font-size:${compact ? 12 : 13.5}px;font-weight:800;color:${INK};">${esc(rs(res.constrVal))}</div></td>`
      : "") +
    `<td style="padding:${compact ? 6 : 8}px;background:#EEF4FE;border-radius:8px;text-align:center;"><div style="font-size:${compact ? 9 : 10}px;color:${MUTED};">${esc(t(lang, "totalValueLabel"))}</div><div style="font-size:${compact ? 12 : 13.5}px;font-weight:800;color:${NAVY};">${esc(rs(res.total))}</div></td>` +
    `</tr></table>`;

  const clientBits: string[] = [];
  if (clientName) clientBits.push(`${esc(t(lang, "client"))}: <b>${esc(clientName)}</b>`);
  if (areaName) clientBits.push(`${esc(t(lang, "areaLbl"))}: <b>${esc(areaName)}</b>`);
  const clientLine = clientBits.length
    ? `<div style="margin-top:6px;font-size:${compact ? 11 : 12.5}px;color:${INK};text-align:center;">${clientBits.join(" &nbsp;·&nbsp; ")}</div>`
    : "";

  const savingBox =
    res.filerSaving > 0
      ? `<div style="margin-top:${compact ? 7 : 10}px;padding:${compact ? 7 : 10}px ${compact ? 9 : 12}px;border:1px solid #BBE7DD;border-radius:10px;background:#F0FBF7;">` +
        `<div style="font-size:${compact ? 11 : 12}px;font-weight:800;color:${MINT_DEEP};">${esc(t(lang, "filerSavingTitle"))}: ${esc(rs(res.filerSaving))}</div>` +
        (res.buyerSaving > 0 && res.sellerSaving > 0
          ? `<div style="font-size:${compact ? 10 : 11}px;color:${MUTED};margin-top:2px;">${esc(t(lang, "buyerSavingLabel"))}: ${esc(rs(res.buyerSaving))} · ${esc(t(lang, "sellerSavingLabel"))}: ${esc(rs(res.sellerSaving))}</div>`
          : res.buyerSaving > 0
            ? `<div style="font-size:${compact ? 10 : 11}px;color:${MUTED};margin-top:2px;">${esc(t(lang, "filerSavingSubBuyer"))}</div>`
            : res.sellerSaving > 0
              ? `<div style="font-size:${compact ? 10 : 11}px;color:${MUTED};margin-top:2px;">${esc(t(lang, "filerSavingSubSeller"))}</div>`
              : "") +
        `</div>`
      : "";

  return (
    `<div style="background:#fff;color:${INK};padding:${compact ? "16px 18px" : "22px 26px"};font-family:${ur ? "'Jameel Noori Nastaleeq'" : "'Inter','Segoe UI',Arial,sans-serif"};width:${W}px;box-sizing:border-box;${ur ? "direction:rtl;" : ""}">` +
    header +
    `<div style="margin-top:10px;font-size:${compact ? 9.5 : 10.5}px;color:${MUTED};text-align:center;">${esc(formatSheetDate(lang))}</div>` +
    clientLine +
    valueStrip +
    `<table style="width:100%;border-collapse:collapse;margin-top:4px;">` +
    section(t(lang, "challan32A"), rows.filter((r) => r.group === "c32")) +
    section(t(lang, "fbrSection"), rows.filter((r) => r.group === "fbr")) +
    section(t(lang, "otherSection"), rows.filter((r) => r.group === "oth")) +
    `</table>` +
    `<table style="width:100%;border-collapse:collapse;margin-top:12px;">` +
    `<tr><td style="padding:${compact ? 9 : 12}px ${compact ? 11 : 14}px;background:${NAVY};border-radius:10px;font-size:${fGrand}px;font-weight:800;color:#fff;">${esc(res.allOff ? t(lang, "grandTotalExclFBR") : t(lang, "grandTotal"))}</td>` +
    `<td style="padding:${compact ? 9 : 12}px ${compact ? 11 : 14}px;background:${NAVY};border-radius:10px;font-size:${compact ? 15 : 18}px;font-weight:800;color:#fff;text-align:${ur ? "left" : "right"};white-space:nowrap;">${esc(rs(res.grand))}</td></tr>` +
    (res.fbrTot > 0 && !res.allOff
      ? `<tr><td colspan="2" style="padding:8px 14px 0;font-size:${compact ? 10.5 : 12}px;font-weight:700;color:${MUTED};">${esc(t(lang, "grandTotalExclFBR"))}: ${esc(rs(res.grand - res.fbrTot))}</td></tr>`
      : "") +
    `</table>` +
    savingBox +
    `<div style="text-align:center;color:${MUTED};margin-top:14px;padding-top:8px;border-top:1px solid ${BORDER};font-size:${compact ? 10 : 11}px;line-height:1.4;">` +
    `${esc(t(lang, "resultsNote"))} &nbsp;·&nbsp; ${esc(t(lang, "ratesEffectiveLabel"))} ${esc(SR_RATES.ratesEffective)}` +
    `<div style="margin-top:4px;font-weight:700;color:${MINT_DEEP};">Powered by FreeSeak — freeseak.com</div>` +
    `</div>` +
    `</div>`
  );
}

/* ---- ¼ Foolscap print: the summary slip in HTML (mirrors drawSlipSheet) -- */
function buildSlipHTML(
  res: SrRegistryResult,
  lang: SrLang,
  profile: SrProfile,
  clientName: string,
  areaName: string,
): string {
  const ur = lang === "ur";
  const othTot = res.oth.reg + res.oth.fard + res.oth.photo + res.oth.misc + res.oth.stampVendor;

  let header: string;
  if (hasProfile(profile)) {
    header =
      `<div style="text-align:center;color:${INK};">` +
      (profile.firm ? `<div style="font-size:16px;font-weight:800;color:${NAVY};">${esc(profile.firm)}</div>` : "") +
      (profile.name ? `<div style="font-size:12px;color:${INK};">${esc(profile.name)}</div>` : "") +
      (profile.phone || profile.address
        ? `<div style="font-size:10px;color:${MUTED};">${esc([profile.phone, profile.address].filter(Boolean).join(" · "))}</div>`
        : "") +
      `<div style="font-size:8.5px;color:${MUTED};letter-spacing:.12em;margin-top:3px;">${esc(t(lang, "propDeedTitle")).toUpperCase()} · PUNJAB REGISTRY ESTIMATOR</div>` +
      `</div>`;
  } else {
    header =
      `<div style="text-align:center;color:${INK};">` +
      `<div style="font-size:16px;font-weight:800;color:${NAVY};">PUNJAB REGISTRY ESTIMATOR</div>` +
      `<div style="font-size:9px;color:${MUTED};letter-spacing:.14em;">PUNJAB, PAKISTAN</div>` +
      `</div>`;
  }

  const clientBits: string[] = [];
  if (clientName) clientBits.push(`${esc(t(lang, "client"))}: <b>${esc(clientName)}</b>`);
  if (areaName) clientBits.push(`${esc(t(lang, "areaLbl"))}: <b>${esc(areaName)}</b>`);
  const clientLine = clientBits.length
    ? `<div style="margin-top:5px;font-size:11px;color:${INK};text-align:center;">${clientBits.join(" &nbsp;·&nbsp; ")}</div>`
    : "";

  const srow = (lbl: string, val: string, accent = false) =>
    `<tr><td style="padding:5px 0;font-size:12px;color:${accent ? NAVY : "#3D4A5E"};${accent ? "font-weight:700;" : ""}border-bottom:1px solid ${BORDER};">${esc(lbl)}</td>` +
    `<td style="padding:5px 0;font-size:12.5px;font-weight:700;color:${accent ? NAVY : INK};text-align:${ur ? "left" : "right"};white-space:nowrap;border-bottom:1px solid ${BORDER};">${esc(val)}</td></tr>`;

  const rows =
    `<tr><td colspan="2" style="padding:9px 0 3px;font-size:10.5px;font-weight:800;color:${NAVY};border-bottom:1px solid ${BORDER};text-align:center;letter-spacing:.08em;">${esc(t(lang, "summaryTitle")).toUpperCase()}</td></tr>` +
    srow(t(lang, "totalValueLabel"), rs(res.total), true) +
    srow(t(lang, "challan32ATotal"), rs(res.c32Tot)) +
    (res.fbrTot > 0 ? srow(t(lang, "fbrTotal"), rs(res.fbrTot)) : "") +
    (othTot > 0 ? srow(t(lang, "otherSection"), rs(othTot)) : "");

  return (
    `<div style="background:#fff;color:${INK};padding:18px 20px;font-family:${ur ? "'Jameel Noori Nastaleeq'" : "'Inter','Segoe UI',Arial,sans-serif"};width:340px;box-sizing:border-box;${ur ? "direction:rtl;" : ""}">` +
    header +
    `<div style="margin-top:6px;font-size:10px;color:${MUTED};text-align:center;">${esc(formatSheetDate(lang))}</div>` +
    clientLine +
    `<table style="width:100%;border-collapse:collapse;margin-top:4px;">` +
    rows +
    `</table>` +
    `<table style="width:100%;border-collapse:collapse;margin-top:10px;">` +
    `<tr><td style="padding:10px 12px;background:${NAVY};border-radius:9px;font-size:13.5px;font-weight:800;color:#fff;">${esc(res.allOff ? t(lang, "grandTotalExclFBR") : t(lang, "grandTotal"))}</td>` +
    `<td style="padding:10px 12px;background:${NAVY};border-radius:9px;font-size:16px;font-weight:800;color:#fff;text-align:${ur ? "left" : "right"};white-space:nowrap;">${esc(rs(res.grand))}</td></tr>` +
    (res.fbrTot > 0 && !res.allOff
      ? `<tr><td colspan="2" style="padding:6px 12px 0;font-size:10px;font-weight:700;color:${MUTED};">${esc(t(lang, "grandTotalExclFBR"))}: ${esc(rs(res.grand - res.fbrTot))}</td></tr>`
      : "") +
    `</table>` +
    (res.filerSaving > 0
      ? `<div style="margin-top:8px;padding:8px 11px;border:1px solid #BBE7DD;border-radius:8px;background:#F0FBF7;font-size:11px;font-weight:800;color:${MINT_DEEP};display:flex;justify-content:space-between;gap:8px;"><span>${esc(t(lang, "filerSavingTitle"))}:</span><span>${esc(rs(res.filerSaving))}</span></div>`
      : "") +
    `<div style="text-align:center;color:${MUTED};margin-top:11px;padding-top:7px;border-top:1px solid ${BORDER};font-size:9.5px;line-height:1.45;">` +
    `${esc(t(lang, "resultsNote"))} &nbsp;·&nbsp; ${esc(t(lang, "ratesEffectiveLabel"))} ${esc(SR_RATES.ratesEffective)}` +
    `<div style="margin-top:3px;font-weight:700;color:${MINT_DEEP};">Powered by FreeSeak — freeseak.com</div>` +
    `</div>` +
    `</div>`
  );
}

/* ---- plain-text summary (clipboard + WhatsApp) --------------------------- */
export function buildSummaryText(
  res: SrRegistryResult,
  lang: SrLang,
  profile: SrProfile,
  clientName: string,
  areaName: string,
): string {
  const lines: string[] = [];
  if (hasProfile(profile)) {
    if (profile.firm) lines.push(profile.firm);
    if (profile.name) lines.push(profile.name);
    if (profile.phone || profile.address)
      lines.push([profile.phone, profile.address].filter(Boolean).join(" · "));
    lines.push("");
  }
  lines.push("PUNJAB REGISTRY ESTIMATOR");
  lines.push(formatSheetDate(lang));
  if (clientName) lines.push(`${t(lang, "client")}: ${clientName}`);
  if (areaName) lines.push(`${t(lang, "areaLbl")}: ${areaName}`);
  lines.push("");
  lines.push(`${t(lang, "totalValueLabel")}: ${rs(res.total)}`);
  for (const r of buildRows(res, lang)) lines.push(`${r.lbl}: ${r.val}`);
  lines.push("");
  lines.push(`${res.allOff ? t(lang, "grandTotalExclFBR") : t(lang, "grandTotal")}: ${rs(res.grand)}`);
  if (res.fbrTot > 0 && !res.allOff)
    lines.push(`${t(lang, "grandTotalExclFBR")}: ${rs(res.grand - res.fbrTot)}`);
  if (res.filerSaving > 0)
    lines.push(`${t(lang, "filerSavingTitle")}: ${rs(res.filerSaving)}`);
  lines.push("");
  lines.push(`* ${t(lang, "resultsNote")} ${t(lang, "ratesEffectiveLabel")} ${SR_RATES.ratesEffective}`);
  lines.push("Powered by FreeSeak — freeseak.com");
  return lines.join("\n");
}
