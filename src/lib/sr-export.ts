/* ============================================================================
 * Punjab Registry Estimator — export builders.
 *
 * v0.10.1: the PDF/JPG export no longer uses html2canvas + jsPDF. The
 * branded sheet is drawn directly on a <canvas> (the browser's own text
 * engine — which is also what gives us correct Urdu/Nastaliq shaping) and
 * the PDF is assembled with pdf-lib — the same library the site's other 11
 * PDF tools already use in production. No third-party capture scripts.
 *
 * v1.0.1 print overhaul (user-reported print issues):
 *   1. ¼ Foolscap now prints the FULL detailed sheet — the old
 *      one-page summary slip is deleted (Rule 1). Every paper size
 *      carries the same sections, the same rows and the same footer;
 *      ¼ Foolscap just draws them smaller, and a heavy multi-party
 *      estimate flows onto extra pages exactly like ½ A4.
 *   2. Urdu headings no longer fake-bold. Jameel Noori Nastaleeq ships
 *      only weight 400; asking it for bold makes the browser smear the
 *      glyphs, which reads as a different font. Every Urdu-script
 *      string now renders at its real regular weight (emphasis comes
 *      from size and colour); Latin text and digits keep real bold.
 *   3. Margins are exactly 0.25 in (6.35 mm) on all four sides of every
 *      output — never edge-to-edge, never wider. Sheet width = paper
 *      width − 2 × 6.35 mm, drawn 1:1 (≈0.75 pt per px) so nothing is
 *      shrunk by the printer and no dead border is left around the
 *      content.
 *
 * Paper sizes: A4 210×297 · ½ A4 148×210 · ¼ Foolscap 108×165 mm.
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

/* ---- paper sizes (v1.0.1) --------------------------------------------------
 * sheetW: logical canvas/print width = paper width − 2 × 6.35 mm, in CSS px
 *         (96 dpi). At that width every paper prints at ≈0.75 pt per px, so
 *         px font sizes land at the same physical size on all three papers.
 * pdfW/pdfH: PDF page size in points (1 mm = 2.8346 pt). pdfM: the fixed
 *         0.25 in (6.35 mm = 18 pt) margin on every side of the PDF page.
 * a4 210×297 · a5 148×210 · qf (¼ foolscap) 108×165 mm
 * -------------------------------------------------------------------------- */
export type SrPaper = "a4" | "a5" | "qf";

const PAPER: Record<SrPaper, { sheetW: number; pdfW: number; pdfH: number; pdfM: number }> = {
  a4: { sheetW: 746, pdfW: 595.28, pdfH: 841.89, pdfM: 18 },
  a5: { sheetW: 511, pdfW: 419.53, pdfH: 595.28, pdfM: 18 },
  qf: { sheetW: 360, pdfW: 306.14, pdfH: 467.72, pdfM: 18 },
};

/* physical paper size per choice, for the print iframe's @page rule */
export const SR_PAPER_MM: Record<SrPaper, string> = {
  a4: "210mm 297mm",
  a5: "148mm 210mm",
  qf: "108mm 165mm",
};

/* v1.0.2: print always fills the REAL page. Chrome draws a smaller @page box
   centered on the loaded paper instead of switching paper, so the sheet is
   printed on one A4 page box (the user's actual paper) and zoomed up to fill
   it — content stays edge-to-edge with the same 0.25 in margin on all four
   sides. zoom = A4 printable width / sheet logical width. */
export const SR_PRINT_ZOOM: Record<SrPaper, number> = {
  a4: 1,
  a5: PAPER.a4.sheetW / PAPER.a5.sheetW,
  qf: PAPER.a4.sheetW / PAPER.qf.sheetW,
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

/* Arabic-script detection (v1.0.1 #2): Urdu strings must never be drawn in
   a bold weight — Jameel Noori Nastaleeq has only weight 400, so the
   browser would synthesize a smear that reads as a different font. */
const ARABIC = /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/;

/* ==========================================================================
 * Canvas sheet — the single drawing used for BOTH the PDF and the JPG.
 * Drawn at 2x for crisp print quality; logical width = the printable width
 * of the chosen paper (746 / 511 / 360 px), which prints ≈0.75 pt per px.
 *
 * opts (v1.0.1):
 *   paper     — "a4" (default) | "a5" | "qf" — same full sheet, three sizes
 *   groups    — which sections to draw (used when a page flows onto extra
 *               pages; default: all three, in canonical order)
 *   slim      — the one-line continuation header for page 2+
 *   foot      — grand total + saving box + footer (default true; false on
 *               non-final pages of a split)
 *   pageLabel — "Page 1 of 2" marker drawn at the foot of the sheet
 * ======================================================================== */

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
  stripVal: number;
  firm: number;
  name: number;
  contact: number;
  brand: number;
  plainTitle: number;
  plainSub: number;
  date: number;
  client: number;
  grandVal: number;
  excl: number;
  save: number;
  saveSub: number;
  note: number;
  rates: number;
  footBrand: number;
}

function themeFor(ur: boolean, sans: string, paper: SrPaper): SheetTheme {
  /* Nastaliq needs ~18% more size and much more line height (v0.10.1 #8) */
  const k = ur ? 1.18 : 1;
  if (paper === "qf") {
    /* ¼ Foolscap: same full detail, drawn small (95 mm printable width) */
    return {
      ur,
      body: ur ? `"Jameel Noori Nastaleeq", ${sans}` : sans,
      label: 9.5 * k,
      section: 9 * k,
      row: 9.5 * k,
      rowH: ur ? 24 : 17,
      secH: ur ? 28 : 20,
      big: 11 * k,
      strip: 8 * k,
      stripVal: 10 * k,
      stripH: ur ? 46 : 38,
      firm: ur ? 15 : 14.5,
      name: ur ? 11 : 10.5,
      contact: ur ? 9.5 : 9,
      brand: 7.5,
      plainTitle: ur ? 15 : 14,
      plainSub: 8.5,
      date: ur ? 10 : 9,
      client: ur ? 10.5 : 9.5,
      grandVal: ur ? 13.5 : 12.5,
      excl: ur ? 10 : 9,
      save: ur ? 10.5 : 9.5,
      saveSub: ur ? 9.5 : 8.5,
      note: ur ? 9.5 : 8.5,
      rates: ur ? 9.5 : 8.5,
      footBrand: ur ? 10.5 : 9,
    };
  }
  if (paper === "a5") {
    /* ½ A4: drawn 511 px wide, printed 135.3 mm at 1:1 (v1.0.1 #3 — no
       more 640→511 shrink; the spacing below is tightened instead) */
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
      stripVal: 12.5 * k,
      stripH: ur ? 58 : 50,
      firm: ur ? 19 : 18,
      name: ur ? 13 : 12,
      contact: ur ? 11.5 : 10.5,
      brand: 8.5,
      plainTitle: ur ? 18 : 17,
      plainSub: 9.5,
      date: ur ? 12 : 10.5,
      client: ur ? 13 : 11.5,
      grandVal: ur ? 16 : 15,
      excl: ur ? 12 : 10.5,
      save: ur ? 13 : 11.5,
      saveSub: ur ? 11.5 : 10,
      note: ur ? 11.5 : 10,
      rates: ur ? 11.5 : 10,
      footBrand: ur ? 13 : 11,
    };
  }
  return {
    /* A4: the reference layout (unchanged from v0.10.1) */
    ur,
    body: ur ? `"Jameel Noori Nastaleeq", ${sans}` : sans,
    label: 12.5 * k,
    section: 12 * k,
    row: 12.5 * k,
    rowH: ur ? 34 : 25,
    secH: ur ? 42 : 32,
    big: 15 * k,
    strip: 10.5 * k,
    stripVal: ur ? 15.5 : 14,
    stripH: ur ? 74 : 62,
    firm: ur ? 22 : 21,
    name: ur ? 15 : 13,
    contact: ur ? 12.5 : 11,
    brand: 10,
    plainTitle: 22,
    plainSub: 11,
    date: ur ? 13 : 11,
    client: ur ? 14.5 : 12.5,
    grandVal: ur ? 19 : 18,
    excl: ur ? 13.5 : 12,
    save: ur ? 15 : 13,
    saveSub: ur ? 13 : 11.5,
    note: ur ? 13 : 11,
    rates: ur ? 13 : 11,
    footBrand: ur ? 15 : 12.5,
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
  const compact = paper !== "a4";
  const qf = paper === "qf";
  const slim = !!opts.slim;
  const foot = opts.foot !== false;
  const ur = lang === "ur";
  const sans =
    typeof document !== "undefined"
      ? getComputedStyle(document.body).fontFamily || "Arial, sans-serif"
      : "Arial, sans-serif";
  const th = themeFor(ur, sans, paper);
  const sheetW = PAPER[paper].sheetW;
  /* tiny internal breathing inside the image (≤1 mm at print); the real
     0.25 in margin comes from the PDF page placement / @page rule */
  const sheetM = qf ? 3 : compact ? 4 : 6;

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

  /* 3-way metric helper: (¼ foolscap, ½ A4, A4) */
  const m3 = <T,>(q: T, c: T, f: T): T => (qf ? q : compact ? c : f);

  /* --- measure pass: exact height first, then draw. Rows never wrap (they
     are sized to the sheet width), so the height is closed-form --------- */
  const measure = document.createElement("canvas").getContext("2d");
  if (!measure) throw new Error("canvas unavailable");
  const font = (px: number, weight = "") =>
    `${weight ? weight + " " : ""}${px}px ${th.body}`.trim();

  const topPad = m3(14, 18, 22);
  const dateM = m3(16, 20, 24);
  const clientM = clientName || areaName ? m3(18, 22, 26) : 0;
  const gapM = m3(4, 6, 12);
  const slimHeaderM = m3(ur ? 40 : 34, ur ? 48 : 40, ur ? 56 : 48);
  const profContact = profile.address || profile.phone;
  const profIncFirm = profile.firm ? m3(ur ? 22 : 18, ur ? 28 : 24, ur ? 34 : 28) : 0;
  const profIncName = profile.name ? m3(ur ? 17 : 14, ur ? 22 : 18, ur ? 26 : 20) : 0;
  const profIncContact = profContact ? m3(ur ? 15 : 12, ur ? 19 : 15, ur ? 22 : 17) : 0;
  const profIncBrand = m3(12, 16, 20);
  const headerM = slim
    ? slimHeaderM
    : hasProfile(profile)
      ? profIncFirm + profIncName + profIncContact + profIncBrand
      : m3(ur ? 42 : 38, 46, 60);
  const stripM = slim ? 0 : th.stripH + m3(8, 12, 16);

  let H = topPad + headerM + dateM + clientM + gapM + stripM;
  for (const g of groups) H += th.secH + byGroup(g).length * th.rowH;
  if (foot) H += m3(8, 12, 14) + m3(ur ? 40 : 34, ur ? 52 : 44, ur ? 62 : 52);
  if (foot && res.fbrTot > 0 && !res.allOff) H += m3(16, 22, 26);
  if (foot && res.filerSaving > 0)
    H += m3(6, 10, 12) + m3(ur ? 52 : 42, ur ? 70 : 56, ur ? 84 : 66);
  /* footer: note (wrapped) + effective + brand — and the page label */
  measure.font = font(th.note);
  const noteLines = wrapText(measure, `* ${t(lang, "resultsNote")}`, sheetW - sheetM * 2 - 10);
  if (foot)
    H +=
      m3(8, 13, 16) +
      noteLines.length * m3(ur ? 18 : 13, ur ? 22 : 16, ur ? 26 : 18) +
      m3(3, 4, 6) +
      m3(ur ? 20 : 16, ur ? 24 : 18, ur ? 28 : 22) +
      m3(16, 18, 22);
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
    /* v1.0.1 #2: Urdu text is never drawn bold — the shipped Nastaleeq has
       no bold face and synthetic bold reads as a different font */
    ctx.font = font(px, ur && weight === "bold" && ARABIC.test(str) ? "" : weight);
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
      y + m3(12, 15, 18),
      m3(ur ? 14 : 13, ur ? 16 : 14, ur ? 18 : 16),
      NAVY,
      "bold",
      "center",
    );
    tx(formatSheetDate(lang), sheetW / 2, y + m3(22, 28, 33), m3(8.5, 9.5, 10.5), MUTED, "", "center");
    y += slimHeaderM;
  } else if (hasProfile(profile)) {
    if (profile.firm) {
      tx(profile.firm, sheetW / 2, y + m3(14, 16, 20), th.firm, NAVY, "bold", "center");
      y += profIncFirm;
    }
    if (profile.name) {
      tx(profile.name, sheetW / 2, y + m3(10, 12, 14), th.name, INK, "", "center");
      y += profIncName;
    }
    if (profContact) {
      tx(
        [profile.phone, profile.address].filter(Boolean).join(" · "),
        sheetW / 2,
        y + m3(8, 10, 11),
        th.contact,
        MUTED,
        "",
        "center",
      );
      y += profIncContact;
    }
    tx(
      `${t(lang, "propDeedTitle")} · PUNJAB REGISTRY ESTIMATOR`,
      sheetW / 2,
      y + m3(6, 8, 10),
      th.brand,
      MUTED,
      "",
      "center",
    );
    y += profIncBrand;
  } else {
    tx("PUNJAB REGISTRY ESTIMATOR", sheetW / 2, y + m3(16, 18, 24), th.plainTitle, NAVY, "bold", "center");
    tx("PUNJAB, PAKISTAN", sheetW / 2, y + m3(ur ? 28 : 26, 33, 46), th.plainSub, MUTED, "", "center");
    y += headerM;
  }

  /* --- date (with weekday, v0.10.1 #2) + client/area line (#3) --- */
  tx(formatSheetDate(lang), sheetW / 2, y + m3(9, 11, 12), th.date, MUTED, "", "center");
  y += dateM;
  if (clientName || areaName) {
    const bits: string[] = [];
    if (clientName) bits.push(`${t(lang, "client")}: ${clientName}`);
    if (areaName) bits.push(`${t(lang, "areaLbl")}: ${areaName}`);
    tx(bits.join("   ·   "), sheetW / 2, y + m3(10, 12, 13), th.client, INK, "bold", "center");
    y += clientM;
  }
  y += gapM;

  /* --- value strip (mist cells) --- */
  if (!slim) {
    const cells: { lbl: string; val: string; accent?: boolean }[] = [
      { lbl: t(lang, "landValueLabel"), val: rs(res.landVal) },
      ...(res.constrVal > 0
        ? [{ lbl: t(lang, "constrValueLabel"), val: rs(res.constrVal) }]
        : []),
      { lbl: t(lang, "totalValueLabel"), val: rs(res.total), accent: true },
    ];
    const gap = m3(5, 7, 10);
    const cw = (innerW - gap * (cells.length - 1)) / cells.length;
    for (let i = 0; i < cells.length; i++) {
      const cx = xL + i * (cw + gap);
      ctx.fillStyle = cells[i].accent ? "#EEF4FE" : MIST;
      rr(ctx, cx, y, cw, th.stripH, m3(6, 8, 10));
      ctx.fill();
      tx(cells[i].lbl, cx + cw / 2, y + m3(ur ? 18 : 14, ur ? 26 : 21, ur ? 30 : 24), th.strip, MUTED, "", "center");
      tx(
        cells[i].val,
        cx + cw / 2,
        y + m3(ur ? 32 : 26, ur ? 49 : 39, ur ? 58 : 46),
        th.stripVal,
        cells[i].accent ? NAVY : INK,
        "bold",
        "center",
      );
    }
    y += stripM;
  }

  /* --- sections --- */
  const section = (title: string, list: SrRow[]) => {
    tx(title, ur ? xR : xL, y + m3(11, 14, 16), th.section, NAVY, "bold", ur ? "right" : "left");
    ctx.strokeStyle = BORDER;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(xL, y + m3(ur ? 18 : 14, ur ? 24 : 20, ur ? 28 : 24));
    ctx.lineTo(xR, y + m3(ur ? 18 : 14, ur ? 24 : 20, ur ? 28 : 24));
    ctx.stroke();
    y += th.secH;
    for (const r of list) {
      tx(
        r.lbl,
        ur ? xR : xL,
        y + m3(11, 13, 15),
        th.row,
        r.strong ? INK : "#3D4A5E",
        r.strong ? "bold" : "",
        ur ? "right" : "left",
      );
      tx(r.val, ur ? xL : xR, y + m3(11, 13, 15), th.row, r.strong ? NAVY : INK, "bold", ur ? "left" : "right");
      if (r.strong) {
        ctx.strokeStyle = BORDER;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(xL, y + th.rowH - m3(4, 5, 6));
        ctx.lineTo(xR, y + th.rowH - m3(4, 5, 6));
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
    y += m3(8, 12, 14);
    const barH = m3(ur ? 40 : 34, ur ? 52 : 44, ur ? 62 : 52);
    ctx.fillStyle = NAVY;
    rr(ctx, xL, y, innerW, barH, m3(7, 10, 12));
    ctx.fill();
    tx(
      res.allOff ? t(lang, "grandTotalExclFBR") : t(lang, "grandTotal"),
      ur ? xR - m3(12, 16, 20) : xL + m3(12, 16, 20),
      y + barH / 2 + m3(ur ? 6 : 4, ur ? 7 : 5, ur ? 8 : 6),
      th.big,
      "#FFFFFF",
      "bold",
      ur ? "right" : "left",
    );
    tx(
      rs(res.grand),
      ur ? xL + m3(12, 16, 20) : xR - m3(12, 16, 20),
      y + barH / 2 + m3(ur ? 7 : 6, ur ? 8 : 7, ur ? 10 : 8),
      th.grandVal,
      "#FFFFFF",
      "bold",
      ur ? "left" : "right",
    );
    y += barH;
    if (res.fbrTot > 0 && !res.allOff) {
      tx(
        `${t(lang, "grandTotalExclFBR")}: ${rs(res.grand - res.fbrTot)}`,
        ur ? xR : xL,
        y + m3(12, 16, 18),
        th.excl,
        MUTED,
        "bold",
        ur ? "right" : "left",
      );
      y += m3(16, 22, 26);
    }

    /* --- filer saving box --- */
    if (res.filerSaving > 0) {
      y += m3(6, 10, 12);
      const boxH = m3(ur ? 52 : 42, ur ? 70 : 56, ur ? 84 : 66);
      ctx.fillStyle = "#F0FBF7";
      rr(ctx, xL, y, innerW, boxH, m3(6, 8, 10));
      ctx.fill();
      ctx.strokeStyle = "#BBE7DD";
      ctx.lineWidth = 1.5;
      rr(ctx, xL, y, innerW, boxH, m3(6, 8, 10));
      ctx.stroke();
      tx(
        `${t(lang, "filerSavingTitle")}: ${rs(res.filerSaving)}`,
        ur ? xR - m3(9, 12, 16) : xL + m3(9, 12, 16),
        y + m3(ur ? 24 : 19, ur ? 30 : 22, ur ? 36 : 26),
        th.save,
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
          ur ? xR - m3(9, 12, 16) : xL + m3(9, 12, 16),
          y + m3(ur ? 40 : 32, ur ? 56 : 42, ur ? 68 : 48),
          th.saveSub,
          MUTED,
          "",
          ur ? "right" : "left",
        );
      y += boxH;
    }

    /* --- footer --- */
    y += m3(10, 16, 22);
    ctx.strokeStyle = BORDER;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(xL, y);
    ctx.lineTo(xR, y);
    ctx.stroke();
    y += m3(8, 13, 16);
    for (const line of noteLines) {
      tx(line, sheetW / 2, y + m3(ur ? 12 : 9, ur ? 14 : 11, ur ? 16 : 12), th.note, MUTED, "", "center");
      y += m3(ur ? 18 : 13, ur ? 22 : 16, ur ? 26 : 18);
    }
    y += m3(3, 4, 6);
    tx(
      `${t(lang, "ratesEffectiveLabel")} ${SR_RATES.ratesEffective}`,
      sheetW / 2,
      y + 12,
      th.rates,
      MUTED,
      "",
      "center",
    );
    y += m3(ur ? 20 : 16, ur ? 24 : 18, ur ? 28 : 22);
    tx("Powered by FreeSeak — freeseak.com", sheetW / 2, y + m3(10, 12, 13), th.footBrand, MINT_DEEP, "bold", "center");
  }

  /* --- page label (continuation pages of a split estimate) --- */
  if (opts.pageLabel) {
    y += 10;
    tx(opts.pageLabel, sheetW / 2, y + 12, m3(8, 9.5, 10), MUTED, "", "center");
  }

  return canvas;
}

/* ==========================================================================
 * Pagination for ½ A4 and ¼ Foolscap (v1.0.1: the same full-detail sheet on
 * both). If the sheet fits its printable page (printable height in px =
 * (pdfH − 2·pdfM)·sheetW / (pdfW − 2·pdfM)), return it as-is. A heavy
 * multi-party estimate flows onto extra pages, breaking ONLY at section
 * boundaries, with a slim header and a "Page i of n" marker on every
 * continuation page and the grand total + saving box always on the last
 * one. The fit is strict — an oversized page would be scaled down by the
 * PDF embed and grow the margins past 0.25 in.
 * ======================================================================== */
export async function drawSheetPages(
  res: SrRegistryResult,
  lang: SrLang,
  profile: SrProfile,
  clientName: string,
  areaName: string,
  paper: SrPaper = "a4",
): Promise<HTMLCanvasElement[]> {
  if (paper === "a4") {
    return [await drawSheet(res, lang, profile, clientName, areaName)];
  }

  const { pdfW, pdfH, pdfM, sheetW } = PAPER[paper];
  const budget = ((pdfH - pdfM * 2) * sheetW) / (pdfW - pdfM * 2);

  const full = await drawSheet(res, lang, profile, clientName, areaName, { paper });
  if (full.height / SHEET_SCALE <= budget) return [full];

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
        paper,
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
        paper,
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

/* ---- PDF via pdf-lib (same library as the site's other PDF tools) ------
   v1.0.1: every page carries exactly the 0.25 in (18 pt) margin on all four
   sides — the sheet is placed top-centred at pdfM, never scaled below the
   printable size unless a rare one-page A4 overflow forces it. */
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
  pdf.setTitle("Punjab Registry Estimate");
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
      y: pdfH - pdfM - h,
      width: w,
      height: h,
    });
  }
  const bytes = await pdf.save();
  return new Blob([bytes as unknown as BlobPart], { type: "application/pdf" });
}

/* ---- JPG from the same canvas (one tall image on every paper size).
   The image gets a small white matte so it reads as a picture, not a
   print sheet — margins on paper come from the PDF/print paths. -------- */
export async function buildJPGBlob(
  res: SrRegistryResult,
  lang: SrLang,
  profile: SrProfile,
  clientName: string,
  areaName: string,
  paper: SrPaper = "a4",
): Promise<Blob> {
  const sheet = await drawSheet(res, lang, profile, clientName, areaName, { paper });
  const pad = 14;
  const canvas = document.createElement("canvas");
  canvas.width = sheet.width + pad * 2 * SHEET_SCALE;
  canvas.height = sheet.height + pad * 2 * SHEET_SCALE;
  const cctx = canvas.getContext("2d");
  if (!cctx) throw new Error("canvas unavailable");
  cctx.fillStyle = "#FFFFFF";
  cctx.fillRect(0, 0, canvas.width, canvas.height);
  cctx.drawImage(sheet, pad * SHEET_SCALE, pad * SHEET_SCALE);
  const blob: Blob | null = await new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/jpeg", 0.92),
  );
  if (!blob) throw new Error("encode failed");
  return blob;
}

/* ==========================================================================
 * Print sheet (hidden same-origin iframe — no popups, works everywhere).
 * Same content as the canvas sheet, in HTML. v1.0.1: all three paper
 * sizes print the FULL sheet, drawn 1:1 at the printable width (paper −
 * 2 × 6.35 mm) — the @page margin is exactly 0.25 in and the printer
 * never shrinks the content. Rows never split across pages; heavy
 * estimates flow onto extra pages.
 * ======================================================================== */

/* per-paper print metrics (px) — W is the printable width, 1:1 on paper */
const PRINT_TIERS: Record<
  SrPaper,
  {
    W: number;
    fFirm: number;
    fName: number;
    fContact: number;
    fBrand: number;
    fTitle: number;
    fSub: number;
    fDate: number;
    fClient: number;
    stripLbl: number;
    stripVal: number;
    stripPad: number;
    stripMt: string;
    fRow: number;
    rowPad: number;
    fSec: number;
    secTop: number;
    secBot: number;
    fGrand: number;
    fGrandVal: number;
    grandPad: number;
    grandMt: number;
    fExcl: number;
    fSave: number;
    fSaveSub: number;
    saveMt: string;
    footMt: number;
    fFoot: number;
    fBrandFoot: number;
  }
> = {
  a4: {
    W: 746,
    fFirm: 20, fName: 13, fContact: 11, fBrand: 10, fTitle: 21, fSub: 11,
    fDate: 10.5, fClient: 12.5,
    stripLbl: 10, stripVal: 13.5, stripPad: 8, stripMt: "10px 0 4px",
    fRow: 12.5, rowPad: 4, fSec: 12, secTop: 10, secBot: 4,
    fGrand: 15, fGrandVal: 18, grandPad: 12, grandMt: 12,
    fExcl: 12, fSave: 12, fSaveSub: 11, saveMt: "10px 0 0",
    footMt: 14, fFoot: 11, fBrandFoot: 11,
  },
  a5: {
    W: 511,
    fFirm: 17, fName: 12, fContact: 10, fBrand: 8.5, fTitle: 16.5, fSub: 9.5,
    fDate: 10, fClient: 11,
    stripLbl: 8.5, stripVal: 11.5, stripPad: 5, stripMt: "7px 0 2px",
    fRow: 10.5, rowPad: 2.5, fSec: 10, secTop: 6, secBot: 3,
    fGrand: 12.5, fGrandVal: 14.5, grandPad: 9, grandMt: 8,
    fExcl: 10, fSave: 10.5, fSaveSub: 9.5, saveMt: "7px 0 0",
    footMt: 10, fFoot: 9.5, fBrandFoot: 9.5,
  },
  qf: {
    W: 360,
    fFirm: 14, fName: 10, fContact: 8.5, fBrand: 7, fTitle: 14, fSub: 8,
    fDate: 8.5, fClient: 9.5,
    stripLbl: 7.5, stripVal: 9.5, stripPad: 4, stripMt: "5px 0 2px",
    fRow: 9, rowPad: 2, fSec: 8.5, secTop: 5, secBot: 2,
    fGrand: 10.5, fGrandVal: 12, grandPad: 7, grandMt: 7,
    fExcl: 8.5, fSave: 9, fSaveSub: 8.5, saveMt: "6px 0 0",
    footMt: 8, fFoot: 8.5, fBrandFoot: 9,
  },
};

export function buildExportHTML(
  res: SrRegistryResult,
  lang: SrLang,
  profile: SrProfile,
  clientName: string,
  areaName: string,
  paper: SrPaper = "a4",
): string {
  const T = PRINT_TIERS[paper];
  const ur = lang === "ur";
  const rows = buildRows(res, lang);

  /* Urdu script never gets a bold weight (v1.0.1 #2) */
  const bw = (s: string, w: number) => (ur && w > 400 && ARABIC.test(s) ? 400 : w);

  let header: string;
  if (hasProfile(profile)) {
    header =
      `<div style="text-align:center;color:${INK};">` +
      (profile.firm
        ? `<div style="font-size:${T.fFirm}px;font-weight:${bw(profile.firm, 800)};color:${NAVY};">${esc(profile.firm)}</div>`
        : "") +
      (profile.name ? `<div style="font-size:${T.fName}px;color:${INK};">${esc(profile.name)}</div>` : "") +
      (profile.phone || profile.address
        ? `<div style="font-size:${T.fContact}px;color:${MUTED};">${esc([profile.phone, profile.address].filter(Boolean).join(" · "))}</div>`
        : "") +
      `<div style="font-size:${T.fBrand}px;color:${MUTED};letter-spacing:.12em;margin-top:4px;">${esc(t(lang, "propDeedTitle")).toUpperCase()} · PUNJAB REGISTRY ESTIMATOR</div>` +
      `</div>`;
  } else {
    header =
      `<div style="text-align:center;color:${INK};">` +
      `<div style="font-size:${T.fTitle}px;font-weight:800;color:${NAVY};">PUNJAB REGISTRY ESTIMATOR</div>` +
      `<div style="font-size:${T.fSub}px;color:${MUTED};letter-spacing:.14em;">PUNJAB, PAKISTAN</div>` +
      `</div>`;
  }

  const section = (title: string, bodyRows: SrRow[]) =>
    `<tr><td colspan="2" style="padding:${T.secTop}px 0 ${T.secBot}px;font-size:${T.fSec}px;font-weight:${bw(title, 800)};color:${NAVY};border-bottom:1px solid ${BORDER};">${esc(title)}</td></tr>` +
    bodyRows
      .map(
        (r) =>
          `<tr><td style="padding:${T.rowPad}px 0;font-size:${T.fRow}px;color:${INK};${r.strong ? `font-weight:${bw(r.lbl, 700)};` : ""}">${esc(r.lbl)}</td>` +
          `<td style="padding:${T.rowPad}px 0;font-size:${T.fRow}px;text-align:${ur ? "left" : "right"};font-weight:700;color:${r.strong ? NAVY : INK};white-space:nowrap;">${esc(r.val)}</td></tr>`,
      )
      .join("");

  const valueStrip =
    `<table style="width:100%;border-collapse:collapse;margin:${T.stripMt};">` +
    `<tr>` +
    `<td style="width:33%;padding:${T.stripPad}px;background:${MIST};border-radius:8px;text-align:center;"><div style="font-size:${T.stripLbl}px;color:${MUTED};">${esc(t(lang, "landValueLabel"))}</div><div style="font-size:${T.stripVal}px;font-weight:800;color:${INK};">${esc(rs(res.landVal))}</div></td>` +
    (res.constrVal > 0
      ? `<td style="width:33%;padding:${T.stripPad}px;background:${MIST};border-radius:8px;text-align:center;"><div style="font-size:${T.stripLbl}px;color:${MUTED};">${esc(t(lang, "constrValueLabel"))}</div><div style="font-size:${T.stripVal}px;font-weight:800;color:${INK};">${esc(rs(res.constrVal))}</div></td>`
      : "") +
    `<td style="padding:${T.stripPad}px;background:#EEF4FE;border-radius:8px;text-align:center;"><div style="font-size:${T.stripLbl}px;color:${MUTED};">${esc(t(lang, "totalValueLabel"))}</div><div style="font-size:${T.stripVal}px;font-weight:800;color:${NAVY};">${esc(rs(res.total))}</div></td>` +
    `</tr></table>`;

  const clientBits: string[] = [];
  if (clientName)
    clientBits.push(`${esc(t(lang, "client"))}: <b style="font-weight:${bw(clientName, 700)};">${esc(clientName)}</b>`);
  if (areaName)
    clientBits.push(`${esc(t(lang, "areaLbl"))}: <b style="font-weight:${bw(areaName, 700)};">${esc(areaName)}</b>`);
  const clientLine = clientBits.length
    ? `<div style="margin-top:6px;font-size:${T.fClient}px;color:${INK};text-align:center;">${clientBits.join(" &nbsp;·&nbsp; ")}</div>`
    : "";

  const savingBox =
    res.filerSaving > 0
      ? `<div style="margin:${T.saveMt};padding:${T.secTop + 2}px ${T.grandPad - 2}px;border:1px solid #BBE7DD;border-radius:10px;background:#F0FBF7;">` +
        `<div style="font-size:${T.fSave}px;font-weight:${bw(t(lang, "filerSavingTitle"), 800)};color:${MINT_DEEP};">${esc(t(lang, "filerSavingTitle"))}: ${esc(rs(res.filerSaving))}</div>` +
        (res.buyerSaving > 0 && res.sellerSaving > 0
          ? `<div style="font-size:${T.fSaveSub}px;color:${MUTED};margin-top:2px;">${esc(t(lang, "buyerSavingLabel"))}: ${esc(rs(res.buyerSaving))} · ${esc(t(lang, "sellerSavingLabel"))}: ${esc(rs(res.sellerSaving))}</div>`
          : res.buyerSaving > 0
            ? `<div style="font-size:${T.fSaveSub}px;color:${MUTED};margin-top:2px;">${esc(t(lang, "filerSavingSubBuyer"))}</div>`
            : res.sellerSaving > 0
              ? `<div style="font-size:${T.fSaveSub}px;color:${MUTED};margin-top:2px;">${esc(t(lang, "filerSavingSubSeller"))}</div>`
              : "") +
        `</div>`
      : "";

  return (
    `<div style="background:#fff;color:${INK};padding:0;font-family:${ur ? "'Jameel Noori Nastaleeq'" : "'Inter','Segoe UI',Arial,sans-serif"};width:${T.W}px;box-sizing:border-box;line-height:${ur ? 1.9 : 1.45};${ur ? "direction:rtl;" : ""}">` +
    header +
    `<div style="margin-top:${T.footMt - 4}px;font-size:${T.fDate}px;color:${MUTED};text-align:center;">${esc(formatSheetDate(lang))}</div>` +
    clientLine +
    valueStrip +
    `<table style="width:100%;border-collapse:collapse;margin-top:4px;">` +
    section(t(lang, "challan32A"), rows.filter((r) => r.group === "c32")) +
    section(t(lang, "fbrSection"), rows.filter((r) => r.group === "fbr")) +
    section(t(lang, "otherSection"), rows.filter((r) => r.group === "oth")) +
    `</table>` +
    `<table style="width:100%;border-collapse:collapse;margin-top:${T.grandMt}px;">` +
    `<tr><td style="padding:${T.grandPad}px ${T.grandPad + 2}px;background:${NAVY};border-radius:10px;font-size:${T.fGrand}px;font-weight:${bw(t(lang, "grandTotal"), 800)};color:#fff;">${esc(res.allOff ? t(lang, "grandTotalExclFBR") : t(lang, "grandTotal"))}</td>` +
    `<td style="padding:${T.grandPad}px ${T.grandPad + 2}px;background:${NAVY};border-radius:10px;font-size:${T.fGrandVal}px;font-weight:800;color:#fff;text-align:${ur ? "left" : "right"};white-space:nowrap;">${esc(rs(res.grand))}</td></tr>` +
    (res.fbrTot > 0 && !res.allOff
      ? `<tr><td colspan="2" style="padding:6px ${T.grandPad + 2}px 0;font-size:${T.fExcl}px;font-weight:${bw(t(lang, "grandTotalExclFBR"), 700)};color:${MUTED};">${esc(t(lang, "grandTotalExclFBR"))}: ${esc(rs(res.grand - res.fbrTot))}</td></tr>`
      : "") +
    `</table>` +
    savingBox +
    `<div style="text-align:center;color:${MUTED};margin-top:${T.footMt}px;padding-top:8px;border-top:1px solid ${BORDER};font-size:${T.fFoot}px;line-height:1.4;">` +
    `${esc(t(lang, "resultsNote"))} &nbsp;·&nbsp; ${esc(t(lang, "ratesEffectiveLabel"))} ${esc(SR_RATES.ratesEffective)}` +
    `<div style="margin-top:4px;font-weight:700;color:${MINT_DEEP};">Powered by FreeSeak — freeseak.com</div>` +
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
