/* ============================================================================
 * Punjab Registry Estimator — export builders (PDF / JPG / print / text).
 *
 * Every output this tool hands back carries the FreeSeak brand:
 * "Powered by FreeSeak — freeseak.com" in the footer of the PDF, image,
 * print sheet, WhatsApp message and clipboard text (the original
 * SmartRegistry branding is fully replaced).
 *
 * The PDF/JPG path renders this HTML with the self-hosted html2canvas
 * (public/vendor/html2canvas.min.js) so Urdu text is shaped by the browser
 * with the real Jameel Noori Nastaleeq font — the same trick the original
 * tool used, minus the third-party CDN.
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

/* ---- one shared row model: the results card (React), the export HTML and
   the plain-text summary all render from this, so the three can never
   disagree about a number ------------------------------------------------- */
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

/* ---- the branded export sheet (PDF capture target + print iframe) ------- */
export function buildExportHTML(res: SrRegistryResult, lang: SrLang, profile: SrProfile): string {
  const ur = lang === "ur";
  const rows = buildRows(res, lang);

  let header: string;
  if (hasProfile(profile)) {
    header =
      `<div style="text-align:center;">` +
      (profile.firm ? `<div style="font-size:20px;font-weight:800;color:${NAVY};">${esc(profile.firm)}</div>` : "") +
      (profile.name ? `<div style="font-size:13px;color:${INK};">${esc(profile.name)}</div>` : "") +
      (profile.phone || profile.address
        ? `<div style="font-size:11px;color:${MUTED};">${esc([profile.phone, profile.address].filter(Boolean).join(" · "))}</div>`
        : "") +
      `<div style="font-size:10px;color:${MUTED};letter-spacing:.12em;margin-top:4px;">${esc(t(lang, "propDeedTitle")).toUpperCase()} · PUNJAB REGISTRY ESTIMATOR</div>` +
      `</div>`;
  } else {
    header =
      `<div style="text-align:center;">` +
      `<div style="font-size:21px;font-weight:800;color:${NAVY};">PUNJAB REGISTRY ESTIMATOR</div>` +
      `<div style="font-size:11px;color:${MUTED};letter-spacing:.14em;">PUNJAB, PAKISTAN</div>` +
      `</div>`;
  }

  const section = (title: string, bodyRows: SrRow[]) =>
    `<tr><td colspan="2" style="padding:10px 0 4px;font-size:12px;font-weight:800;color:${NAVY};border-bottom:1px solid ${BORDER};">${esc(title)}</td></tr>` +
    bodyRows
      .map(
        (r) =>
          `<tr><td style="padding:4px 0;font-size:12.5px;color:${INK};${r.strong ? "font-weight:700;" : ""}">${esc(r.lbl)}</td>` +
          `<td style="padding:4px 0;font-size:12.5px;text-align:${ur ? "left" : "right"};font-weight:700;color:${r.strong ? NAVY : INK};white-space:nowrap;">${esc(r.val)}</td></tr>`,
      )
      .join("");

  const valueStrip =
    `<table style="width:100%;border-collapse:collapse;margin:10px 0 4px;">` +
    `<tr>` +
    `<td style="width:33%;padding:8px;background:#F3F6FA;border-radius:8px;text-align:center;"><div style="font-size:10px;color:${MUTED};">${esc(t(lang, "landValueLabel"))}</div><div style="font-size:13.5px;font-weight:800;color:${INK};">${esc(rs(res.landVal))}</div></td>` +
    (res.constrVal > 0
      ? `<td style="width:33%;padding:8px;background:#F3F6FA;border-radius:8px;text-align:center;"><div style="font-size:10px;color:${MUTED};">${esc(t(lang, "constrValueLabel"))}</div><div style="font-size:13.5px;font-weight:800;color:${INK};">${esc(rs(res.constrVal))}</div></td>`
      : "") +
    `<td style="padding:8px;background:#F3F6FA;border-radius:8px;text-align:center;"><div style="font-size:10px;color:${MUTED};">${esc(t(lang, "totalValueLabel"))}</div><div style="font-size:13.5px;font-weight:800;color:${NAVY};">${esc(rs(res.total))}</div></td>` +
    `</tr></table>`;

  const savingBox =
    res.filerSaving > 0
      ? `<div style="margin-top:10px;padding:10px 12px;border:1px solid #BBE7DD;border-radius:10px;background:#F0FBF7;">` +
        `<div style="font-size:12px;font-weight:800;color:${MINT_DEEP};">${esc(t(lang, "filerSavingTitle"))}: ${esc(rs(res.filerSaving))}</div>` +
        (res.buyerSaving > 0 && res.sellerSaving > 0
          ? `<div style="font-size:11px;color:${MUTED};margin-top:2px;">${esc(t(lang, "buyerSavingLabel"))}: ${esc(rs(res.buyerSaving))} · ${esc(t(lang, "sellerSavingLabel"))}: ${esc(rs(res.sellerSaving))}</div>`
          : res.buyerSaving > 0
            ? `<div style="font-size:11px;color:${MUTED};margin-top:2px;">${esc(t(lang, "filerSavingSubBuyer"))}</div>`
            : res.sellerSaving > 0
              ? `<div style="font-size:11px;color:${MUTED};margin-top:2px;">${esc(t(lang, "filerSavingSubSeller"))}</div>`
              : "") +
        `</div>`
      : "";

  return (
    `<div style="background:#fff;padding:22px 26px;font-family:${ur ? "'Jameel Noori Nastaleeq'" : "'Inter','Segoe UI',Arial,sans-serif"};width:742px;box-sizing:border-box;${ur ? "direction:rtl;" : ""}">` +
    header +
    `<div style="margin-top:10px;font-size:10.5px;color:${MUTED};text-align:center;">${new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</div>` +
    valueStrip +
    `<table style="width:100%;border-collapse:collapse;margin-top:4px;">` +
    section(t(lang, "challan32A"), rows.filter((r) => r.group === "c32")) +
    section(t(lang, "fbrSection"), rows.filter((r) => r.group === "fbr")) +
    section(t(lang, "otherSection"), rows.filter((r) => r.group === "oth")) +
    `</table>` +
    `<table style="width:100%;border-collapse:collapse;margin-top:12px;">` +
    `<tr><td style="padding:12px 14px;background:${NAVY};border-radius:10px;font-size:15px;font-weight:800;color:#fff;">${esc(res.allOff ? t(lang, "grandTotalExclFBR") : t(lang, "grandTotal"))}</td>` +
    `<td style="padding:12px 14px;background:${NAVY};border-radius:10px;font-size:18px;font-weight:800;color:#fff;text-align:${ur ? "left" : "right"};white-space:nowrap;">${esc(rs(res.grand))}</td></tr>` +
    (res.fbrTot > 0 && !res.allOff
      ? `<tr><td colspan="2" style="padding:8px 14px 0;font-size:12px;font-weight:700;color:${MUTED};">${esc(t(lang, "grandTotalExclFBR"))}: ${esc(rs(res.grand - res.fbrTot))}</td></tr>`
      : "") +
    `</table>` +
    savingBox +
    `<div style="text-align:center;color:${MUTED};margin-top:14px;padding-top:8px;border-top:1px solid ${BORDER};font-size:11px;line-height:1.4;">` +
    `${esc(t(lang, "resultsNote"))} &nbsp;·&nbsp; ${esc(t(lang, "ratesEffectiveLabel"))} ${esc(SR_RATES.ratesEffective)}` +
    `<div style="margin-top:4px;font-weight:700;color:${MINT_DEEP};">Powered by FreeSeak — freeseak.com</div>` +
    `</div>` +
    `</div>`
  );
}

/* ---- plain-text summary (clipboard + WhatsApp) --------------------------- */
export function buildSummaryText(res: SrRegistryResult, lang: SrLang, profile: SrProfile): string {
  const lines: string[] = [];
  if (hasProfile(profile)) {
    if (profile.firm) lines.push(profile.firm);
    if (profile.name) lines.push(profile.name);
    if (profile.phone || profile.address)
      lines.push([profile.phone, profile.address].filter(Boolean).join(" · "));
    lines.push("");
  }
  lines.push("PUNJAB REGISTRY ESTIMATOR");
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

/* ---- lazy loader for the vendored capture stack -------------------------- */
const loaded = new Set<string>();

export function loadVendorScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (loaded.has(src)) return resolve();
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = () => {
      loaded.add(src);
      resolve();
    };
    s.onerror = () => reject(new Error(`failed to load ${src}`));
    document.head.appendChild(s);
  });
}
