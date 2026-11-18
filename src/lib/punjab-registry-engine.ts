/* ============================================================================
 * Punjab Registry Estimator — calculation engine (pure functions, no UI)
 * ----------------------------------------------------------------------------
 * Faithful port of the original SmartRegistry calculate() logic:
 *   - same validation rules, in the same order
 *   - same fee formulas (stamp duty, committee, PLRA surcharge, BOR, mutation)
 *   - same FBR withholding rules (236K / 236C, per person, by share %)
 *   - same filer-vs-non-filer savings computation
 * All rates live in punjab-rates.ts — the only file that needs editing when
 * the government changes a rate. Field names mirror the original tool so the
 * two can be compared number-by-number (scripts/sr_compare.ts).
 * ========================================================================== */

import { SR_RATES } from './punjab-rates';

export type SrLocType = 'urban' | 'rural';
export type SrDeedType = 'conveyance' | 'gift';
export type SrPropType = 'c' | 'nc'; // constructed / non-constructed
export type SrYesNo = 'yes' | 'no';

export interface SrParty {
  name: string;
  share: number; // percent, e.g. 60 or 33.33
  status: 'filer' | 'non';
}

export interface SrOtherExpenses {
  reg: number;        // registration fee (user-entered, rupees)
  fard: number;       // fard / moqa (user-entered)
  photo: number;      // photocopies (user-entered)
  misc: number;       // miscellaneous (user-entered)
  stampVendor: number; // stamp vendor / writing charges (user-entered)
}

export interface SrPartyTax extends SrParty {
  tax: number;
}

export interface SrRegistryInput {
  loc: SrLocType;
  deed: SrDeedType;
  propType: SrPropType;
  legalHeir: SrYesNo;
  landValue: number;
  constrValue: number; // ignored (treated as 0) when propType is 'nc'
  buyers: SrParty[];
  sellers: SrParty[];
  buyerTaxOn: boolean; // FBR 236K toggle
  sellerTaxOn: boolean; // FBR 236C toggle
  others: SrOtherExpenses;
}

export interface SrRegistryResult {
  landVal: number;
  constrVal: number;
  total: number;
  urban: boolean;
  loc: SrLocType;
  deed: SrDeedType;
  pt: SrPropType;
  lh: SrYesNo;
  constructed: boolean;
  isGift: boolean;
  gh: boolean; // gift to a legal heir (either location) — reduced-fee case
  rgh: boolean; // rural gift to legal heir — the special reduced-fee case
  stamp: number;
  committee: number;
  plra: number;
  borFee: number;
  mutFee: number;
  plraMut: number;
  c32Tot: number; // 32-A challan sub-total
  btTot: number; // buyer FBR tax total
  btDet: SrPartyTax[]; // per-buyer tax breakdown
  stTot: number; // seller FBR tax total
  stDet: SrPartyTax[]; // per-seller tax breakdown
  fbrTot: number;
  fbrOk: boolean; // FBR taxes applicable at all
  filerSaving: number;
  buyerSaving: number;
  sellerSaving: number;
  oth: SrOtherExpenses;
  othTot: number;
  grand: number;
  allOff: boolean; // both FBR toggles switched off
}

export type SrCalcError =
  | 'missingConstruction' // constructed selected but no construction value
  | 'missingLandValue'
  | 'totalZero'
  | 'buyerShares' // buyer shares do not total 100%
  | 'sellerShares';

export type SrCalcOutcome =
  | { ok: true; result: SrRegistryResult }
  | { ok: false; error: SrCalcError; detail?: string };

const SHARE_TOLERANCE = 0.5; // original allows ±0.5% on party shares

function partySharesSum(parties: SrParty[]): number {
  return parties.reduce((acc, p) => acc + p.share, 0);
}

export function calculateRegistry(input: SrRegistryInput): SrCalcOutcome {
  const R = SR_RATES;
  const loc = input.loc;
  const deed = input.deed;
  const pt = input.propType;
  const lhVal = input.legalHeir;
  const landVal = input.landValue;
  const constrVal = pt === 'c' ? input.constrValue : 0;
  const total = landVal + constrVal;
  const urban = loc === 'urban';
  const constructed = pt === 'c';
  const isGift = deed === 'gift';
  const gh = isGift && lhVal === 'yes'; // gift to a legal heir (either location)
  const rgh = gh && !urban; // rural gift to legal heir

  // --- validation (same order as the original tool) ---
  if (constructed && constrVal <= 0) return { ok: false, error: 'missingConstruction' };
  if (landVal <= 0) return { ok: false, error: 'missingLandValue' };
  if (total <= 0) return { ok: false, error: 'totalZero' };
  // Shares affect no fee on a gift-to-legal-heir deed (FBR is off), so the
  // original tool skipped validation for the rural case; that now covers the
  // urban case too.
  if (!gh) {
    const bs = partySharesSum(input.buyers);
    const ss = partySharesSum(input.sellers);
    if (Math.abs(bs - 100) > SHARE_TOLERANCE)
      return { ok: false, error: 'buyerShares', detail: bs.toFixed(1) + '%' };
    if (Math.abs(ss - 100) > SHARE_TOLERANCE)
      return { ok: false, error: 'sellerShares', detail: ss.toFixed(1) + '%' };
  }
  const buyers = input.buyers;
  const sellers = input.sellers;

  // --- 32-A challan fees ---
  let stamp: number;
  if (rgh) {
    stamp = R.stamp.ruralGiftHeir;
  } else if (gh) {
    // Urban gift to legal heir: flat stamp duty, no constructed addition.
    stamp = R.stamp.urbanGiftHeir;
  } else {
    const cfg = urban ? R.stamp.urban : R.stamp.rural;
    stamp = constructed
      ? cfg.constrRateTotal * total + cfg.constrRateLand * landVal
      : cfg.nonConstrRateTotal * total;
    stamp += total <= cfg.baseThresh ? cfg.baseLow : cfg.baseHigh;
  }

  const committee = rgh
    ? R.ruralGiftHeir.committee
    : urban
      ? R.committee.urbanRate * total
      : R.committee.ruralRate * total;

  const plra = rgh
    ? R.plra.base
    : total <= R.plra.thresh
      ? R.plra.base
      : R.plra.base + Math.ceil((total - R.plra.thresh) / R.plra.incStep) * R.plra.incAmt;

  const borFee = rgh ? R.ruralGiftHeir.borFee : R.borFee;
  const mutFee = rgh ? R.ruralGiftHeir.mutationFee : R.mutationFee;
  const plraMut = rgh ? R.ruralGiftHeir.plraMutation : R.plraMutation;

  // --- FBR withholding (per person, by share) ---
  // Applies to conveyance deeds, and to gifts ONLY when the receiver is NOT
  // a legal heir. Never applies to a gift-to-legal-heir deed (either location).
  const fbrOk = !rgh && (deed === 'conveyance' || (isGift && lhVal === 'no'));

  let btTot = 0;
  const btDet: SrPartyTax[] = [];
  if (fbrOk && input.buyerTaxOn) {
    for (const b of buyers) {
      const tax = total * (b.share / 100) * R.buyerTax[b.status];
      btTot += tax;
      btDet.push({ ...b, tax });
    }
  }

  let stTot = 0;
  const stDet: SrPartyTax[] = [];
  if (fbrOk && input.sellerTaxOn) {
    for (const s of sellers) {
      const tax = total * (s.share / 100) * R.sellerTax[s.status];
      stTot += tax;
      stDet.push({ ...s, tax });
    }
  }

  // --- filer vs non-filer savings (same calc with everyone as filer) ---
  let btFiler = 0;
  let stFiler = 0;
  if (fbrOk && input.buyerTaxOn)
    for (const b of buyers) btFiler += total * (b.share / 100) * R.buyerTax.filer;
  if (fbrOk && input.sellerTaxOn)
    for (const s of sellers) stFiler += total * (s.share / 100) * R.sellerTax.filer;
  const buyerSaving = fbrOk && input.buyerTaxOn ? Math.max(0, btTot - btFiler) : 0;
  const sellerSaving = fbrOk && input.sellerTaxOn ? Math.max(0, stTot - stFiler) : 0;
  const filerSaving = buyerSaving + sellerSaving;

  // --- user-entered other expenses ---
  const oth = input.others;
  const othTot = oth.reg + oth.fard + oth.photo + oth.misc + oth.stampVendor;

  const c32Tot = stamp + committee + plra + borFee + mutFee + plraMut;
  const fbrTot = btTot + stTot;
  const grand = c32Tot + fbrTot + othTot;
  const allOff = !input.buyerTaxOn && !input.sellerTaxOn;

  return {
    ok: true,
    result: {
      landVal, constrVal, total, urban, loc, deed, pt, lh: lhVal, constructed, isGift, gh, rgh,
      stamp, committee, plra, borFee, mutFee, plraMut, c32Tot,
      btTot, btDet, stTot, stDet, fbrTot, fbrOk,
      filerSaving, buyerSaving, sellerSaving,
      oth, othTot, grand, allOff,
    },
  };
}

/* ---- Area calculator (Punjab customary units) ---------------------------
 * Converts between acres / kanals / marlas / square feet using the
 * conversion constants in punjab-rates.ts. Returns everything the UI needs. */
export interface SrAreaBreakdown {
  marla: number;
  acre: number;
  kanal: number;
  sqft: number;
}

export function calcArea(
  acres: number,
  kanal: number,
  marla: number,
  sqft: number,
): SrAreaBreakdown {
  const { sqftPerMarla, marlaPerKanal, kanalPerAcre } = SR_RATES.area;
  const totalMarla =
    acres * kanalPerAcre * marlaPerKanal + kanal * marlaPerKanal + marla + sqft / sqftPerMarla;
  return {
    marla: totalMarla,
    acre: totalMarla / (kanalPerAcre * marlaPerKanal),
    kanal: totalMarla / marlaPerKanal,
    sqft: totalMarla * sqftPerMarla,
  };
}

/* Construction value helper: covered area × rate per sq. ft. */
export function calcConstruction(sqft: number, ratePerSqft: number): number {
  return sqft * ratePerSqft;
}
