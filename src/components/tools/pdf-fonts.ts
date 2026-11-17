"use client";

/**
 * FreeSeak — the shared Unicode font kit for PDF tools.
 *
 * One family for everything the standard 14 fonts cannot encode:
 * locally-shipped Noto Sans (Latin, Greek, Cyrillic) + the Noto Sans SC
 * pack (Han, Kana, Bopomofo). The CSS faces drive live previews on
 * canvas; the raw TTFs feed pdf-lib embedding via fontkit. Files are
 * fetched once and cached for the page's lifetime (rule 5: local
 * assets only, never a CDN).
 *
 * Split out of pdf-editor-core in v1.0.0 so non-editor tools (watermark,
 * page numbers) can embed Unicode text without dragging the whole
 * editor engine into their chunk.
 */

export type SharedTextFont = "Helvetica" | "Times" | "Courier" | "Noto";

export const NOTO_FONT_NAME = "Noto Sans Editor";
export const NOTO_SC_FONT_NAME = "Noto Sans SC Editor";
export const NOTO_CSS_FAMILY = `'${NOTO_FONT_NAME}', '${NOTO_SC_FONT_NAME}', sans-serif`;

/** true when a string needs the embedded Unicode font (beyond WinAnsi) */
export function needsUnicodeFont(text: string): boolean {
  return /[^\u0000-\u00ff]/.test(text);
}

/** CJK ranges — the SC pack covers Han, Kana and Bopomofo subsets */
export function hasCjk(text: string): boolean {
  return /[\u2e80-\u9fff\u3400-\u4dbf\uf900-\ufaff\u3040-\u30ff]/.test(text);
}

export function cssFontFamily(font: SharedTextFont): string {
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
