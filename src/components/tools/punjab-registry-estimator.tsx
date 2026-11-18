"use client";

/* ============================================================================
 * Punjab Registry Estimator — tool #22.
 *
 * A bilingual (English / اردو) estimator of Punjab (Pakistan) property
 * registry costs: 32-A challan fees, FBR withholding taxes (236K / 236C),
 * filer-vs-non-filer savings and user-entered expenses. All maths lives in
 * lib/punjab-registry-engine.ts and every rate in lib/punjab-rates.ts —
 * the one file to edit when the government changes a rate.
 *
 * Urdu mode flips the tool content to RTL and renders in the self-hosted
 * Jameel Noori Nastaleeq font (public/fonts, @font-face in globals.css —
 * fetched only when Urdu is actually shown).
 *
 * Export paths (PDF / JPG / print / WhatsApp / clipboard) render a branded
 * sheet via lib/sr-export.ts — "Powered by FreeSeak" on every output.
 * ========================================================================== */

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Calculator,
  Copy,
  FileDown,
  History as HistoryIcon,
  Image as ImageIcon,
  MessageCircle,
  Plus,
  Printer,
  RotateCcw,
  Ruler,
  Trash2,
  UserRound,
} from "lucide-react";
import { SR_RATES } from "@/lib/punjab-rates";
import { SR_STRINGS, type SrLang } from "@/lib/punjab-strings";
import {
  calcArea,
  calculateRegistry,
  type SrRegistryResult,
} from "@/lib/punjab-registry-engine";
import {
  buildExportHTML,
  buildJPGBlob,
  buildPDFBlob,
  buildRows,
  buildSummaryText,
  SR_PRINT_ZOOM,
  EMPTY_PROFILE,
  type SrProfile,
  type SrPaper,
} from "@/lib/sr-export";
import { downloadBlob } from "./image-utils";

/* ---------- local types ---------- */

interface PartyRow {
  id: number;
  name: string;
  share: string;
  status: "filer" | "non";
}

interface HistEntry {
  id: number;
  ts: number;
  res: SrRegistryResult;
  clientName: string;
  areaName: string;
  buyers: PartyRow[];
  sellers: PartyRow[];
  /* v1.0.0: the FBR toggles and "other expenses" are part of the estimate —
     without them, reopening an entry and recalculating produced a
     different grand total than the saved one */
  btOn?: boolean;
  stOn?: boolean;
  othRaw?: { reg: string; fard: string; photo: string; misc: string; stampVendor: string };
}

interface Persisted {
  lang: SrLang;
  paper?: SrPaper;
  profile: SrProfile;
  history: HistEntry[];
}

const STORAGE_KEY = "freeseak.registry.v1";

function pf(v: string): number {
  /* Pakistan-standard comma grouping: "1,200,000" must parse as 1200000,
     never as 1 — strip commas and spaces before parseFloat */
  const n = parseFloat(String(v).replace(/[, \u00A0]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function fmtRs(n: number): string {
  return "Rs. " + Math.round(n).toLocaleString("en-PK");
}

let partySeq = 1;
function newParty(): PartyRow {
  return { id: partySeq++, name: "", share: "100", status: "filer" };
}

let histSeq = 1;

/* ---------- small UI helpers ---------- */

function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (_v: T) => void;
  options: { v: T; label: string }[];
}) {
  return (
    <div className="inline-flex rounded-xl border border-border bg-muted/60 p-0.5">
      {options.map((o) => (
        <button
          key={o.v}
          type="button"
          onClick={() => onChange(o.v)}
          className={`rounded-[9px] px-3.5 py-2 text-[12.5px] font-bold transition ${
            value === o.v
              ? "border border-border bg-card text-foreground shadow-sm"
              : "border border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-[12.5px] font-semibold text-foreground">{label}</Label>
      {children}
      {hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function CardTitle({ children }: { children: React.ReactNode }) {
  return (
    <p data-sr-title className="font-display text-[13.5px] font-bold text-foreground">{children}</p>
  );
}

/* ========================================================================== */

export function PunjabRegistryEstimator() {
  const [lang, setLang] = useState<SrLang>("en");
  /* paper size for exports (v0.10.1): a4 default | a5 = ½ A4 148×210 | qf = ¼ foolscap 108×165 */
  const [paper, setPaper] = useState<SrPaper>("a4");
  const [hydrated, setHydrated] = useState(false);
  const [profile, setProfile] = useState<SrProfile>(EMPTY_PROFILE);

  const [loc, setLoc] = useState<"urban" | "rural">("urban");
  const [deed, setDeed] = useState<"conveyance" | "gift">("conveyance");
  const [propType, setPropType] = useState<"c" | "nc">("c");
  const [legalHeir, setLegalHeir] = useState<"yes" | "no">("no");
  const [clientName, setClientName] = useState("");
  const [areaName, setAreaName] = useState("");
  const [landVal, setLandVal] = useState("");
  const [constrVal, setConstrVal] = useState("");

  const [buyers, setBuyers] = useState<PartyRow[]>(() => [newParty()]);
  const [sellers, setSellers] = useState<PartyRow[]>(() => [newParty()]);
  const [btOn, setBtOn] = useState(true);
  const [stOn, setStOn] = useState(true);

  const [oReg, setOReg] = useState("");
  const [oFard, setOFard] = useState("");
  const [oPhoto, setOPhoto] = useState("");
  const [oMisc, setOMisc] = useState("");
  const [oStamp, setOStamp] = useState("");

  const [result, setResult] = useState<SrRegistryResult | null>(null);
  const [busy, setBusy] = useState(false);

  const [history, setHistory] = useState<HistEntry[]>([]);
  const [showProfile, setShowProfile] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showArea, setShowArea] = useState(false);
  const [showConstr, setShowConstr] = useState(false);

  /* area calculator state */
  const [acAcre, setAcAcre] = useState("");
  const [acKanal, setAcKanal] = useState("");
  const [acMarla, setAcMarla] = useState("");
  const [acSqft, setAcSqft] = useState("");
  const [rateMarla, setRateMarla] = useState("");
  const [rateAcre, setRateAcre] = useState("");

  /* construction calculator state */
  const [csSqft, setCsSqft] = useState("");
  const [csRate, setCsRate] = useState("");

  /* profile modal drafts */
  const [profDraft, setProfDraft] = useState<SrProfile>(EMPTY_PROFILE);

  const resultsRef = useRef<HTMLDivElement | null>(null);
  const ur = lang === "ur";
  const t = useMemo(
    () => (key: keyof typeof SR_STRINGS.en) => SR_STRINGS[lang][key],
    [lang],
  );

  /* ---------- persistence ---------- */
  useEffect(() => {
    /* restore one tick late (same pattern as enhance-tool.tsx) so the
       first paint matches the server-rendered defaults and hydration
       stays clean */
    const restore = () => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const p = JSON.parse(raw) as Persisted;
          if (p.lang === "ur" || p.lang === "en") setLang(p.lang);
          if (p.paper === "a5" || p.paper === "qf") setPaper(p.paper);
          if (p.profile) setProfile({ ...EMPTY_PROFILE, ...p.profile });
          if (Array.isArray(p.history)) setHistory(p.history.slice(0, 20));
        }
      } catch {
        /* private mode — run without persistence */
      }
      setHydrated(true);
    };
    const t = setTimeout(restore, 0);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      const p: Persisted = { lang, paper, profile, history };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
    } catch {
      /* ignore */
    }
  }, [hydrated, lang, paper, profile, history]);

  /* ---------- derived ---------- */
  const buyerSum = buyers.reduce((a, p) => a + pf(p.share), 0);
  const sellerSum = sellers.reduce((a, p) => a + pf(p.share), 0);

  const area = useMemo(
    () => calcArea(pf(acAcre), pf(acKanal), pf(acMarla), pf(acSqft)),
    [acAcre, acKanal, acMarla, acSqft],
  );
  const areaLandValue = pf(rateMarla) > 0 ? area.marla * pf(rateMarla) : area.acre * pf(rateAcre);
  const constrValue = pf(csSqft) * pf(csRate);

  /* ---------- parties ---------- */
  function updateParty(
    side: "b" | "s",
    id: number,
    patch: Partial<PartyRow>,
  ) {
    const setter = side === "b" ? setBuyers : setSellers;
    setter((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function removeParty(side: "b" | "s", id: number) {
    const setter = side === "b" ? setBuyers : setSellers;
    setter((rows) => (rows.length > 1 ? rows.filter((r) => r.id !== id) : rows));
  }

  /* split 100% evenly across the party rows — the last row absorbs the
     rounding remainder so the sum is exactly 100 */
  function splitEven(side: "b" | "s") {
    const rows = side === "b" ? buyers : sellers;
    if (rows.length === 0) return;
    const each = Math.floor((10000 / rows.length)) / 100;
    const last = Math.round((100 - each * (rows.length - 1)) * 100) / 100;
    const next = rows.map((r, i) => ({
      ...r,
      share: String(i === rows.length - 1 ? last : each),
    }));
    (side === "b" ? setBuyers : setSellers)(next);
  }

  /* ---------- calculate ---------- */
  function handleCalculate() {
    const outcome = calculateRegistry({
      loc,
      deed,
      propType,
      legalHeir,
      landValue: pf(landVal),
      constrValue: pf(constrVal),
      buyers: buyers.map((p) => ({ name: p.name, share: pf(p.share), status: p.status })),
      sellers: sellers.map((p) => ({ name: p.name, share: pf(p.share), status: p.status })),
      buyerTaxOn: btOn,
      sellerTaxOn: stOn,
      others: {
        reg: pf(oReg),
        fard: pf(oFard),
        photo: pf(oPhoto),
        misc: pf(oMisc),
        stampVendor: pf(oStamp),
      },
    });

    if (!outcome.ok) {
      const msgs: Record<string, string> = {
        missingConstruction: `${t("constrErrTitle")} — ${t("constrErrMsg").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()}`,
        missingLandValue: ur ? "زمین کی قیمت درج کریں" : "Please enter Land Value.",
        totalZero: "Property value must be > 0.",
        buyerShares: `${ur ? "خریداروں کے حصص کا مجموعہ 100% ہونا چاہیے" : "Buyers' shares must total 100%"} (${outcome.detail ?? ""}).`,
        sellerShares: `${ur ? "فروخت کنندگان کے حصص کا مجموعہ 100% ہونا چاہیے" : "Sellers' shares must total 100%"} (${outcome.detail ?? ""}).`,
      };
      toast.error(msgs[outcome.error] ?? "Check your inputs.");
      return;
    }

    setResult(outcome.result);
    /* warm the PDF engine in the background (pdf-lib is already in the
       bundle for the site's other PDF tools) so the first export is quick */
    void import("pdf-lib").catch(() => {});
    setHistory((h) =>
      [
        {
          id: histSeq++,
          ts: Date.now(),
          res: outcome.result,
          clientName,
          areaName,
          buyers: buyers.map((p) => ({ ...p })),
          sellers: sellers.map((p) => ({ ...p })),
          btOn,
          stOn,
          othRaw: { reg: oReg, fard: oFard, photo: oPhoto, misc: oMisc, stampVendor: oStamp },
        },
        ...h,
      ].slice(0, 20),
    );
    setTimeout(() => {
      resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 120);
  }

  function handleReset() {
    setLoc("urban");
    setDeed("conveyance");
    setPropType("c");
    setLegalHeir("no");
    setClientName("");
    setAreaName("");
    setLandVal("");
    setConstrVal("");
    setBuyers([newParty()]);
    setSellers([newParty()]);
    setBtOn(true);
    setStOn(true);
    setOReg("");
    setOFard("");
    setOPhoto("");
    setOMisc("");
    setOStamp("");
    setResult(null);
    toast.success(t("resetDone"));
  }

  /* ---------- exports (v0.10.1: canvas + pdf-lib — see lib/sr-export.ts) ---------- */

  async function exportPDF() {
    if (!result || busy) return;
    setBusy(true);
    try {
      const blob = await buildPDFBlob(result, lang, profile, clientName, areaName, paper);
      downloadBlob(
        blob,
        paper === "a4"
          ? "punjab-registry-estimate.pdf"
          : paper === "a5"
            ? "punjab-registry-estimate-a5.pdf"
            : "punjab-registry-estimate-qf.pdf",
      );
      toast.success(lang === "ur" ? "پی ڈی ایف تیار ہے" : "PDF downloaded");
    } catch (err) {
      console.error("registry PDF export failed:", err);
      toast.error(
        lang === "ur"
          ? "پی ڈی ایف نہیں بن سکی — دوبارہ کوشش کریں"
          : "PDF export failed — please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function exportJPG() {
    if (!result || busy) return;
    setBusy(true);
    try {
      const blob = await buildJPGBlob(result, lang, profile, clientName, areaName, paper);
      downloadBlob(
        blob,
        paper === "a4"
          ? "punjab-registry-estimate.jpg"
          : paper === "a5"
            ? "punjab-registry-estimate-a5.jpg"
            : "punjab-registry-estimate-qf.jpg",
      );
      toast.success(lang === "ur" ? "تصویر تیار ہے" : "Image downloaded");
    } catch (err) {
      console.error("registry image export failed:", err);
      toast.error("Image export failed — please try again.");
    } finally {
      setBusy(false);
    }
  }

  function printSheet() {
    if (!result) return;
    const frame = document.createElement("iframe");
    frame.style.cssText = "position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;opacity:0;";
    document.body.appendChild(frame);
    const doc = frame.contentDocument;
    if (!doc) return;
    doc.open();
    doc.write(
      `<!doctype html><html><head><meta charset="utf-8"><style>` +
        `@font-face{font-family:'Jameel Noori Nastaleeq';src:url('${location.origin}/fonts/JameelNooriNastaleeq.woff2') format('woff2');font-display:block;}` +
        /* v1.0.2: print always fills the printer's REAL page. Chrome draws a
           smaller @page box centered on the loaded paper instead of switching
           paper (that was the v1.0.1 bug), so we declare one A4 box — the
           user's actual paper — and zoom the sheet up to fill it, keeping
           the exact 0.25 in margin on all four sides */
        `@page{size:210mm 297mm;margin:6.35mm;}tr{page-break-inside:avoid;}` +
        `html,body{margin:0;padding:0;background:#fff;}` +
        `</style></head><body><div style="zoom:${SR_PRINT_ZOOM[paper]};">${buildExportHTML(result, lang, profile, clientName, areaName, paper)}</div></body></html>`,
    );
    doc.close();
    const go = async () => {
      try {
        if (ur) await doc.fonts.load('16px "Jameel Noori Nastaleeq"');
      } catch {
        /* best effort */
      }
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
      setTimeout(() => frame.remove(), 5000);
    };
    if (doc.readyState === "complete") setTimeout(go, 150);
    else frame.onload = () => setTimeout(go, 150);
  }

  async function copySummary() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(buildSummaryText(result, lang, profile, clientName, areaName));
      toast.success(ur ? "نقل ہو گیا" : "Copied to clipboard");
    } catch {
      toast.error("Copy failed.");
    }
  }

  function shareWhatsApp() {
    if (!result) return;
    window.open(
      "https://wa.me/?text=" + encodeURIComponent(buildSummaryText(result, lang, profile, clientName, areaName)),
      "_blank",
      "noopener",
    );
  }

  /* ---------- history ---------- */
  function reopenEntry(e: HistEntry) {
    setLoc(e.res.loc);
    setDeed(e.res.deed);
    setPropType(e.res.pt);
    setLegalHeir(e.res.lh);
    setClientName(e.clientName ?? "");
    setAreaName(e.areaName ?? "");
    setLandVal(String(e.res.landVal || ""));
    setConstrVal(String(e.res.constrVal || ""));
    setBuyers(e.buyers.map((p) => ({ ...p, id: partySeq++ })));
    setSellers(e.sellers.map((p) => ({ ...p, id: partySeq++ })));
    /* restore the FBR toggles and other expenses so recalculation gives
       exactly the saved grand total (older entries default gracefully) */
    setBtOn(e.btOn ?? true);
    setStOn(e.stOn ?? true);
    setOReg(e.othRaw?.reg ?? "");
    setOFard(e.othRaw?.fard ?? "");
    setOPhoto(e.othRaw?.photo ?? "");
    setOMisc(e.othRaw?.misc ?? "");
    setOStamp(e.othRaw?.stampVendor ?? "");
    setResult(e.res);
    setShowHistory(false);
    toast.success(t("reopened"));
  }

  /* ---------- render ---------- */

  const partySide = (
    side: "b" | "s",
    rows: PartyRow[],
    sum: number,
    label: string,
  ) => {
    const sumOk = Math.abs(sum - 100) <= 0.5;
    return (
      <div className="flex-1 rounded-xl border border-border bg-muted/30 p-3.5">
        <div className="mb-2.5 flex items-center justify-between gap-2">
          <CardTitle>{label}</CardTitle>
          <div className="flex items-center gap-2">
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                sumOk
                  ? "bg-mint/10 text-mint-deep dark:text-mint"
                  : "bg-destructive/10 text-destructive"
              }`}
            >
              {sum.toFixed(1)}%
            </span>
            {rows.length > 1 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-[11.5px]"
                onClick={() => splitEven(side)}
                aria-label="Split the shares equally"
              >
                Split equally
              </Button>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          {rows.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center gap-1.5">
              <Input
                value={p.name}
                onChange={(e) => updateParty(side, p.id, { name: e.target.value })}
                placeholder={t("namePh")}
                className="h-9 min-w-0 flex-1 text-[13px]"
              />
              <div className="flex items-center gap-1">
                <Input
                  value={p.share}
                  onChange={(e) => updateParty(side, p.id, { share: e.target.value })}
                  type="number"
                  inputMode="decimal"
                  min={0}
                  max={100}
                  step={0.01}
                  aria-label="Share %"
                  className="h-9 w-[74px] text-right text-[13px]"
                />
                <span className="text-[13px] font-bold text-muted-foreground">%</span>
              </div>
              <Select
                value={p.status}
                onValueChange={(v) =>
                  updateParty(side, p.id, { status: v as "filer" | "non" })
                }
              >
                <SelectTrigger className="h-9 w-[118px] text-[12.5px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="filer">{t("filerS")}</SelectItem>
                  <SelectItem value="non">{t("nonS")}</SelectItem>
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground hover:text-destructive"
                onClick={() => removeParty(side, p.id)}
                disabled={rows.length <= 1}
                aria-label="Remove"
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-2.5 h-8 text-[12px]"
          onClick={() => (side === "b" ? setBuyers : setSellers)((r) => [...r, newParty()])}
        >
          <Plus className="size-3.5" /> {t("add")}
        </Button>
      </div>
    );
  };

  const rows = result ? buildRows(result, lang) : [];

  return (
    <div
      dir={ur ? "rtl" : "ltr"}
      className={ur ? "sr-urdu sr-font leading-[2.1]" : undefined}
    >
      {/* top bar: language · rates effective · profile · history */}
      <div dir="ltr" className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            value={lang}
            onChange={(v) => setLang(v)}
            options={[
              { v: "en" as SrLang, label: "English" },
              { v: "ur" as SrLang, label: "اردو" },
            ]}
          />
          <span className="rounded-full border border-border bg-muted/50 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
            {t("ratesEffectiveLabel")} {SR_RATES.ratesEffective}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 text-[12px]"
            onClick={() => {
              setProfDraft(profile);
              setShowProfile(true);
            }}
          >
            <UserRound className="size-3.5" /> {t("myProfile")}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 text-[12px]"
            onClick={() => setShowHistory(true)}
          >
            <HistoryIcon className="size-3.5" /> {t("historyTitle")}
            {history.length > 0 ? (
              <span className="ml-1 rounded-full bg-primary px-1.5 text-[10px] font-bold text-white">
                {history.length}
              </span>
            ) : null}
          </Button>
        </div>
      </div>

      {/* property & deed */}
      <div className="rounded-2xl border border-border bg-card p-4">
        <CardTitle>{t("propDeedTitle")}</CardTitle>
        <div className="mt-3 grid gap-3.5 sm:grid-cols-2">
          <Field label={t("clientName")}>
            <Input
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              aria-label={t("clientName")}
              className="text-[13px]"
            />
          </Field>
          <Field label={t("areaName")}>
            <Input
              value={areaName}
              onChange={(e) => setAreaName(e.target.value)}
              aria-label={t("areaName")}
              className="text-[13px]"
            />
          </Field>
        </div>
        <div className="mt-3.5 grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          <Field label={t("locationType")}>
            <Segmented
              value={loc}
              onChange={setLoc}
              options={[
                { v: "urban" as const, label: t("urban") },
                { v: "rural" as const, label: t("rural") },
              ]}
            />
          </Field>
          <Field label={t("deedType")}>
            <Segmented
              value={deed}
              onChange={setDeed}
              options={[
                { v: "conveyance" as const, label: t("conveyance") },
                { v: "gift" as const, label: t("gift") },
              ]}
            />
          </Field>
          <Field label={t("propertyType")}>
            <Segmented
              value={propType}
              onChange={setPropType}
              options={[
                { v: "c" as const, label: t("constructed") },
                { v: "nc" as const, label: t("nonConstructed") },
              ]}
            />
          </Field>
          {deed === "gift" ? (
            <Field label={t("legalHeir")}>
              <Segmented
                value={legalHeir}
                onChange={setLegalHeir}
                options={[
                  { v: "yes" as const, label: t("yes") },
                  { v: "no" as const, label: t("no") },
                ]}
              />
            </Field>
          ) : null}
          <Field label={t("landValue")}>
            <div className="flex items-center gap-1.5">
              <Input
                value={landVal}
                onChange={(e) => setLandVal(e.target.value)}
                type="number"
                inputMode="decimal"
                min={0}
                placeholder="0.00"
                className="text-[14px] font-semibold"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-9 shrink-0"
                onClick={() => setShowArea(true)}
                aria-label={t("areaCalcTitle")}
                title={t("areaCalcTitle")}
              >
                <Ruler className="size-4" />
              </Button>
            </div>
          </Field>
          <Field label={t("constrValue")}>
            <div className="flex items-center gap-1.5">
              <Input
                value={constrVal}
                onChange={(e) => setConstrVal(e.target.value)}
                type="number"
                inputMode="decimal"
                min={0}
                placeholder="0.00"
                disabled={propType !== "c"}
                className="text-[14px] font-semibold disabled:opacity-50"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-9 shrink-0"
                onClick={() => setShowConstr(true)}
                disabled={propType !== "c"}
                aria-label={t("constrCalcTitle")}
                title={t("constrCalcTitle")}
              >
                <Calculator className="size-4" />
              </Button>
            </div>
          </Field>
        </div>
      </div>

      {/* buyers & sellers */}
      <div className="mt-4 rounded-2xl border border-border bg-card p-4">
        <CardTitle>
          {t("buyerSellerTitle")}
          {deed === "gift" ? "" : ""}
        </CardTitle>
        <div className="mt-3 flex flex-col gap-3 lg:flex-row">
          {partySide("b", buyers, buyerSum, deed === "gift" ? t("donee") : t("buyers"))}
          {partySide("s", sellers, sellerSum, deed === "gift" ? t("donor") : t("sellers"))}
        </div>

        {/* FBR applicability */}
        <div className="mt-3 rounded-xl border border-border bg-muted/30 p-3.5">
          <CardTitle>{t("fbrTaxes")}</CardTitle>
          <div className="mt-2.5 flex flex-wrap gap-x-8 gap-y-2.5">
            <div className="flex items-center gap-2.5">
              <span className="text-[12.5px] font-semibold text-foreground">
                {t("buyerTaxLabel")} (236K)
              </span>
              <Segmented
                value={btOn ? "y" : "n"}
                onChange={(v) => setBtOn(v === "y")}
                options={[
                  { v: "y" as const, label: t("yes") },
                  { v: "n" as const, label: t("no") },
                ]}
              />
            </div>
            <div className="flex items-center gap-2.5">
              <span className="text-[12.5px] font-semibold text-foreground">
                {t("sellerTaxLabel")} (236C)
              </span>
              <Segmented
                value={stOn ? "y" : "n"}
                onChange={(v) => setStOn(v === "y")}
                options={[
                  { v: "y" as const, label: t("yes") },
                  { v: "n" as const, label: t("no") },
                ]}
              />
            </div>
          </div>
        </div>
      </div>

      {/* other expenses */}
      <div className="mt-4 rounded-2xl border border-border bg-card p-4">
        <CardTitle>{t("otherExpenses")}</CardTitle>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Field label={t("regFee")}>
            <Input value={oReg} onChange={(e) => setOReg(e.target.value)} type="number" inputMode="decimal" min={0} placeholder="0" className="text-[13px]" />
          </Field>
          <Field label={t("fardMoqa")}>
            <Input value={oFard} onChange={(e) => setOFard(e.target.value)} type="number" inputMode="decimal" min={0} placeholder="0" className="text-[13px]" />
          </Field>
          <Field label={t("photoCopy")}>
            <Input value={oPhoto} onChange={(e) => setOPhoto(e.target.value)} type="number" inputMode="decimal" min={0} placeholder="0" className="text-[13px]" />
          </Field>
          <Field label={t("misc")}>
            <Input value={oMisc} onChange={(e) => setOMisc(e.target.value)} type="number" inputMode="decimal" min={0} placeholder="0" className="text-[13px]" />
          </Field>
          <Field label={t("stampVendor")}>
            <Input value={oStamp} onChange={(e) => setOStamp(e.target.value)} type="number" inputMode="decimal" min={0} placeholder="0" className="text-[13px]" />
          </Field>
        </div>
      </div>

      {/* actions */}
      <div className="mt-4 flex flex-wrap items-center gap-2.5">
        <Button type="button" size="lg" className="flex-1 text-[14px]" onClick={handleCalculate}>
          <Calculator className="size-4" />
          {t("calculateBtn")}
        </Button>
        <Button type="button" variant="outline" size="lg" className="text-[13px]" onClick={handleReset}>
          <RotateCcw className="size-4" /> {t("reset")}
        </Button>
      </div>

      {/* results */}
      {result ? (
      <div ref={resultsRef} className="mt-4 scroll-mt-20 rounded-2xl border border-border bg-card p-4 sm:p-5" aria-live="polite">
        <div className="mb-3 flex items-center justify-between gap-2">
          <CardTitle>{t("resultsTitle")}</CardTitle>
            <span className="text-[11px] font-semibold text-muted-foreground">
              {t("ratesEffectiveLabel")} {SR_RATES.ratesEffective}
            </span>
          </div>

          {/* value strip */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-muted/60 p-2.5 text-center">
              <p className="text-[10.5px] font-semibold text-muted-foreground">{t("landValueLabel")}</p>
              <p className="mt-0.5 text-[13px] font-extrabold text-foreground">{fmtRs(result.landVal)}</p>
            </div>
            {result.constrVal > 0 ? (
              <div className="rounded-xl bg-muted/60 p-2.5 text-center">
                <p className="text-[10.5px] font-semibold text-muted-foreground">{t("constrValueLabel")}</p>
                <p className="mt-0.5 text-[13px] font-extrabold text-foreground">{fmtRs(result.constrVal)}</p>
              </div>
            ) : (
              <div className="rounded-xl bg-muted/60 p-2.5 text-center opacity-60">
                <p className="text-[10.5px] font-semibold text-muted-foreground">{t("constrValueLabel")}</p>
                <p className="mt-0.5 text-[13px] font-extrabold text-foreground">—</p>
              </div>
            )}
            <div className="rounded-xl bg-secondary p-2.5 text-center">
              <p className="text-[10.5px] font-semibold text-muted-foreground">{t("totalValueLabel")}</p>
              <p className="mt-0.5 text-[13px] font-extrabold text-navy dark:text-mint">{fmtRs(result.total)}</p>
            </div>
          </div>

          {/* breakdown groups */}
          {(
            [
              { key: "c32", title: t("challan32A") },
              { key: "fbr", title: t("fbrSection") },
            ] as const
          ).map((g) => (
            <div key={g.key} className="mt-3">
              <p data-sr-title className="border-b border-border pb-1.5 text-[12px] font-extrabold text-navy dark:text-mint">
                {g.title}
              </p>
              {rows
                .filter((r) => r.group === g.key)
                .map((r) => (
                  <div
                    key={r.lbl}
                    className={`flex items-center justify-between gap-3 py-1.5 ${
                      r.strong ? "border-b border-dashed border-border" : ""
                    }`}
                  >
                    <span className={`text-[12.5px] ${r.strong ? (ur ? "font-normal text-foreground" : "font-bold text-foreground") : "text-muted-foreground"}`}>
                      {r.lbl}
                    </span>
                    <span className={`whitespace-nowrap text-[12.5px] font-bold ${r.strong ? "text-foreground" : "text-foreground/90"}`}>
                      {r.val}
                    </span>
                  </div>
                ))}
            </div>
          ))}
          <div className="mt-3">
            <p className="border-b border-border pb-1.5 text-[12px] font-extrabold text-navy dark:text-mint">
              {t("otherSection")}
            </p>
            {(
              [
                [t("regFee"), result.oth.reg],
                [t("fardMoqa"), result.oth.fard],
                [t("photoCopy"), result.oth.photo],
                [t("misc"), result.oth.misc],
                [t("stampVendor"), result.oth.stampVendor],
              ] as const
            ).map(([lbl, val]) => (
              <div key={lbl} className="flex items-center justify-between gap-3 py-1.5">
                <span className="text-[12.5px] text-muted-foreground">{lbl}</span>
                <span className="whitespace-nowrap text-[12.5px] font-bold text-foreground/90">{fmtRs(val)}</span>
              </div>
            ))}
          </div>

          {/* grand total */}
          <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-navy px-4 py-3 dark:bg-[#22477F]">
            <span className={`text-[13.5px] ${ur ? "font-normal" : "font-extrabold"} text-white`}>
              {result.allOff ? t("grandTotalExclFBR") : t("grandTotal")}
            </span>
            <span className="text-[17px] font-extrabold text-white">{fmtRs(result.grand)}</span>
          </div>
          {result.fbrTot > 0 && !result.allOff ? (
            <p className={`mt-2 text-[12px] ${ur ? "font-normal" : "font-bold"} text-muted-foreground`}>
              {t("grandTotalExclFBR")}: {fmtRs(result.grand - result.fbrTot)}
            </p>
          ) : null}

          {/* filer saving */}
          {result.filerSaving > 0 ? (
            <div className="mt-3 rounded-xl border border-mint/45 bg-mint/5 p-3">
              <p className={`text-[12.5px] ${ur ? "font-normal" : "font-extrabold"} text-mint-deep dark:text-mint`}>
                {t("filerSavingTitle")}: {fmtRs(result.filerSaving)}
              </p>
              {result.buyerSaving > 0 && result.sellerSaving > 0 ? (
                <p className="mt-1 text-[11.5px] text-muted-foreground">
                  {t("buyerSavingLabel")}: {fmtRs(result.buyerSaving)} · {t("sellerSavingLabel")}: {fmtRs(result.sellerSaving)}
                </p>
              ) : result.buyerSaving > 0 ? (
                <p className="mt-1 text-[11.5px] text-muted-foreground">{t("filerSavingSubBuyer")}</p>
              ) : result.sellerSaving > 0 ? (
                <p className="mt-1 text-[11.5px] text-muted-foreground">{t("filerSavingSubSeller")}</p>
              ) : null}
            </div>
          ) : null}

          {/* paper size (v0.10.1): drives the PDF · JPG · print sheet */}
          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-border bg-muted/40 px-3 py-2">
            <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              {t("paperLabel")}
            </span>
            <Segmented
              value={paper}
              onChange={(v) => setPaper(v)}
              options={[
                { v: "a4" as SrPaper, label: t("paperA4") },
                { v: "a5" as SrPaper, label: t("paperA5") },
                { v: "qf" as SrPaper, label: t("paperQF") },
              ]}
            />
            <span className="text-[11px] text-muted-foreground">{t("paperHint")}</span>
          </div>

          {/* export actions */}
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" className="h-9 text-[12.5px]" onClick={exportPDF} disabled={busy}>
              <FileDown className="size-4" /> {t("downloadPDF")}
            </Button>
            <Button type="button" variant="outline" size="sm" className="h-9 text-[12.5px]" onClick={exportJPG} disabled={busy}>
              <ImageIcon className="size-4" /> {t("downloadImg")}
            </Button>
            <Button type="button" variant="outline" size="sm" className="h-9 text-[12.5px]" onClick={copySummary}>
              <Copy className="size-4" /> {t("copyResults")}
            </Button>
            <Button type="button" variant="outline" size="sm" className="h-9 text-[12.5px]" onClick={printSheet}>
              <Printer className="size-4" /> {t("print")}
            </Button>
            <Button type="button" variant="outline" size="sm" className="h-9 text-[12.5px]" onClick={shareWhatsApp}>
              <MessageCircle className="size-4" /> {t("shareWA")}
            </Button>
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground">* {t("resultsNote")}</p>
        </div>
      ) : null}

      {/* ---------- area calculator modal ---------- */}
      <Dialog open={showArea} onOpenChange={setShowArea}>
        <DialogContent
          dir={ur ? "rtl" : "ltr"}
          className={ur ? "max-w-md sr-urdu sr-font" : "max-w-md"}
        >
          <DialogHeader>
            <DialogTitle data-sr-title className="flex items-center gap-2 font-display">
              <Ruler className="size-4 text-primary" /> {t("areaCalcTitle")}
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("acres")}>
              <Input value={acAcre} onChange={(e) => setAcAcre(e.target.value)} type="number" inputMode="decimal" placeholder="0" />
            </Field>
            <Field label={t("kanal")}>
              <Input value={acKanal} onChange={(e) => setAcKanal(e.target.value)} type="number" inputMode="decimal" placeholder="0" />
            </Field>
            <Field label={t("marla")}>
              <Input value={acMarla} onChange={(e) => setAcMarla(e.target.value)} type="number" inputMode="decimal" placeholder="0" />
            </Field>
            <Field label={t("sqft")}>
              <Input value={acSqft} onChange={(e) => setAcSqft(e.target.value)} type="number" inputMode="decimal" placeholder="0" />
            </Field>
          </div>
          <div className="mt-2 rounded-xl bg-muted/60 p-3 text-[12.5px]">
            <div className="flex justify-between py-0.5">
              <span className="text-muted-foreground">{t("marla")}</span>
              <span className="font-bold">{area.marla.toFixed(2)}</span>
            </div>
            <div className="flex justify-between py-0.5">
              <span className="text-muted-foreground">{t("kanal")}</span>
              <span className="font-bold">{area.kanal.toFixed(3)}</span>
            </div>
            <div className="flex justify-between py-0.5">
              <span className="text-muted-foreground">{t("acres")}</span>
              <span className="font-bold">{area.acre.toFixed(4)}</span>
            </div>
            <div className="flex justify-between py-0.5">
              <span className="text-muted-foreground">{t("sqft")}</span>
              <span className="font-bold">{Math.round(area.sqft).toLocaleString("en-PK")}</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("ratePerMarla")}>
              <Input value={rateMarla} onChange={(e) => setRateMarla(e.target.value)} type="number" inputMode="decimal" placeholder="0" />
            </Field>
            <Field label={t("ratePerAcre")}>
              <Input value={rateAcre} onChange={(e) => setRateAcre(e.target.value)} type="number" inputMode="decimal" placeholder="0" />
            </Field>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[13px] font-extrabold text-foreground">
              {t("applyToLand")}: {areaLandValue > 0 ? fmtRs(areaLandValue) : "—"}
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 text-[12.5px]"
                onClick={() => {
                  navigator.clipboard
                    .writeText(`${area.marla.toFixed(2)} ${t("marla")} (${Math.round(area.sqft).toLocaleString("en-PK")} ${t("sqft")})`)
                    .then(() => toast.success(ur ? "نقل ہو گیا" : "Copied"))
                    .catch(() => toast.error("Copy failed."));
                }}
              >
                <Copy className="size-4" /> {t("copyArea")}
              </Button>
              <Button
                type="button"
                size="sm"
                className="h-9 text-[12.5px]"
                disabled={areaLandValue <= 0}
                onClick={() => {
                  setLandVal(String(Math.round(areaLandValue)));
                  setShowArea(false);
                  toast.success(t("applyToLand"));
                }}
              >
                {t("applyToLand")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ---------- construction calculator modal ---------- */}
      <Dialog open={showConstr} onOpenChange={setShowConstr}>
        <DialogContent
          dir={ur ? "rtl" : "ltr"}
          className={ur ? "max-w-md sr-urdu sr-font" : "max-w-md"}
        >
          <DialogHeader>
            <DialogTitle data-sr-title className="flex items-center gap-2 font-display">
              <Calculator className="size-4 text-primary" /> {t("constrCalcTitle")}
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("sqftArea")}>
              <Input value={csSqft} onChange={(e) => setCsSqft(e.target.value)} type="number" inputMode="decimal" placeholder="0" />
            </Field>
            <Field label={t("ratePerSqft")}>
              <Input value={csRate} onChange={(e) => setCsRate(e.target.value)} type="number" inputMode="decimal" placeholder="0" />
            </Field>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[13px] font-extrabold text-foreground">
              {t("applyConstr")}: {constrValue > 0 ? fmtRs(constrValue) : "—"}
            </p>
            <Button
              type="button"
              size="sm"
              className="h-9 text-[12.5px]"
              disabled={constrValue <= 0}
              onClick={() => {
                setConstrVal(String(Math.round(constrValue)));
                setShowConstr(false);
                toast.success(t("applyConstr"));
              }}
            >
              {t("applyConstr")}
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">{t("enterConstrHint")}</p>
        </DialogContent>
      </Dialog>

      {/* ---------- profile modal ---------- */}
      <Dialog open={showProfile} onOpenChange={setShowProfile}>
        <DialogContent
          dir={ur ? "rtl" : "ltr"}
          className={ur ? "max-w-md sr-urdu sr-font" : "max-w-md"}
        >
          <DialogHeader>
            <DialogTitle data-sr-title className="flex items-center gap-2 font-display">
              <UserRound className="size-4 text-primary" /> {t("myProfile")}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <Field label={t("profName")}>
              <Input value={profDraft.name} onChange={(e) => setProfDraft({ ...profDraft, name: e.target.value })} />
            </Field>
            <Field label={t("profFirm")}>
              <Input value={profDraft.firm} onChange={(e) => setProfDraft({ ...profDraft, firm: e.target.value })} />
            </Field>
            <Field label={t("profPhone")}>
              <Input value={profDraft.phone} onChange={(e) => setProfDraft({ ...profDraft, phone: e.target.value })} />
            </Field>
            <Field label={t("profAddress")}>
              <Input value={profDraft.address} onChange={(e) => setProfDraft({ ...profDraft, address: e.target.value })} />
            </Field>
          </div>
          <p className="text-[11px] leading-relaxed text-muted-foreground">{t("profHint")}</p>
          <Button
            type="button"
            className="w-full"
            onClick={() => {
              setProfile(profDraft);
              setShowProfile(false);
              toast.success(t("profSaved"));
            }}
          >
            {t("save")}
          </Button>
        </DialogContent>
      </Dialog>

      {/* ---------- history modal ---------- */}
      <Dialog open={showHistory} onOpenChange={setShowHistory}>
        <DialogContent
          dir={ur ? "rtl" : "ltr"}
          className={ur ? "max-w-lg sr-urdu sr-font" : "max-w-lg"}
        >
          <DialogHeader>
            <DialogTitle data-sr-title className="flex items-center gap-2 font-display">
              <HistoryIcon className="size-4 text-primary" /> {t("historyTitle")}
            </DialogTitle>
          </DialogHeader>
          {history.length === 0 ? (
            <p className="text-[12.5px] leading-relaxed text-muted-foreground">{t("historyEmpty")}</p>
          ) : (
            <div className="max-h-[55vh] overflow-y-auto pr-1">
              <div className="flex flex-col gap-2">
                {history.map((e) => (
                  <div
                    key={e.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-muted/30 p-2.5"
                  >
                    <div className="min-w-0">
                      <p className="text-[12.5px] font-bold text-foreground">
                        {e.clientName ? `${e.clientName} · ` : ""}{fmtRs(e.res.grand)}
                        <span className="ml-2 font-medium text-muted-foreground">
                          {e.res.urban ? t("urban") : t("rural")} ·{" "}
                          {e.res.isGift ? t("gift") : t("conveyance")}
                          {e.res.gh ? ` · ${t("legalHeir")}: ${t("yes")}` : ""}
                        </span>
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {new Date(e.ts).toLocaleString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1.5">
                      <Button type="button" variant="outline" size="sm" className="h-8 text-[12px]" onClick={() => reopenEntry(e)}>
                        <RotateCcw className="size-3.5" /> {t("edit")}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8 text-muted-foreground hover:text-destructive"
                        onClick={() => {
                          setHistory((h) => h.filter((x) => x.id !== e.id));
                          toast.success(t("deleted"));
                        }}
                        aria-label="Delete"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {history.length > 0 ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 text-[12.5px]"
              onClick={() => {
                setHistory([]);
                toast.success(t("historyCleared"));
              }}
            >
              <Trash2 className="size-3.5" /> {t("clearAll")}
            </Button>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

