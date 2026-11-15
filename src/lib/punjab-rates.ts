/* ============================================================================
 * PUNJAB REGISTRY ESTIMATOR — RATES & FEES CONFIGURATION
 * ============================================================================
 *
 * THIS IS THE ONLY FILE YOU NEED TO EDIT when the government announces new
 * rates (stamp duty, PLRA fee, FBR taxes, etc.).
 *
 * HOW TO CHANGE A RATE (takes ~1 minute, live on the site ~2 minutes later):
 *   1. Open this file on github.com (works from your phone too)
 *   2. Click the pencil (✏️ Edit) button
 *   3. Change ONLY the number you need — every rate is explained below
 *   4. Scroll down, press "Commit changes"
 *   5. Cloudflare rebuilds the site automatically — done in ~2 minutes
 *
 * RULES OF THUMB
 *   - Percentages are decimals: 1%  = 0.01,  2%  = 0.02,  2.75% = 0.0275
 *   - Flat fees are in whole rupees: 3600 means Rs. 3,600
 *   - After changing rates, ALSO update "ratesEffective" below so visitors
 *     always see which rate set they were estimated with.
 *   - Do not rename the labels on the left of the colons — only the values.
 * ========================================================================== */

export const SR_RATES = {

  /* Shown to visitors under the results ("Rates effective: ...").
   * Update this date whenever you change any rate below. */
  ratesEffective: 'Jul 2026',

  /* ---- STAMP DUTY (32-A Challan) ------------------------------------------
   * URBAN and RURAL are configured separately, because the government can
   * change them independently.
   *
   * For a CONSTRUCTED property, stamp duty is charged in two parts:
   *     constrRateTotal × (land + construction value)
   *   + constrRateLand  × (land value only)
   * For a NON-CONSTRUCTED property it is simply:
   *     nonConstrRateTotal × (land value)
   * On top of that there is always a small base fee:
   *     total ≤ baseThresh  →  baseLow rupees
   *     total >  baseThresh →  baseHigh rupees
   * ---------------------------------------------------------------------- */
  stamp: {
    urban: {
      constrRateTotal: 0.01,    // 1% of total (land + construction)
      constrRateLand: 0.02,     // plus 2% of the land value alone
      nonConstrRateTotal: 0.01, // 1% of total value
      baseThresh: 500000,       // Rs. 500,000 threshold for the base fee
      baseLow: 500,             // base fee when total ≤ threshold
      baseHigh: 1000,           // base fee when total > threshold
    },
    rural: {
      constrRateTotal: 0.01,
      constrRateLand: 0.02,
      nonConstrRateTotal: 0.01,
      baseThresh: 500000,
      baseLow: 500,
      baseHigh: 1000,
    },
    /* Flat stamp duty (rupees) for a GIFT deed to a LEGAL HEIR on RURAL land.
     * This special case replaces the whole calculation above. */
    ruralGiftHeir: 1000,
  },

  /* ---- DISTRICT COUNCIL / COMMITTEE FEE -----------------------------------
   * A percentage of the total property value, different for urban/rural. */
  committee: {
    urbanRate: 0.01, // 1%
    ruralRate: 0.01, // 1%
  },

  /* ---- PLRA FEE (Punjab Land Records Authority) ---------------------------
   * A base fee, plus a small surcharge for valuable properties:
   *   total ≤ thresh                          → base rupees
   *   every full incStep above thresh         → + incAmt rupees
   * Example with current values: Rs. 3,700,000 property →
   *   3600 + ceil((3,700,000 − 3,600,000) / 100,000) × 100 = Rs. 3,700 */
  plra: {
    base: 3600,      // base fee (rupees)
    thresh: 3600000, // surcharge starts above this value
    incAmt: 100,     // rupees added per step
    incStep: 100000, // size of each step (rupees)
  },

  /* ---- SMALL FIXED FEES (rupees) ------------------------------------------
   * Charged on every normal deed. The rural-gift-to-legal-heir special case
   * can zero any of them below. */
  borFee: 100,      // Board of Revenue fee
  mutationFee: 300, // mutation (intqaal) fee
  plraMutation: 200, // PLRA mutation fee

  /* ---- RURAL GIFT TO LEGAL HEIR — FEE OVERRIDES ---------------------------
   * When the deed is a Gift, the location is Rural, AND the receiver is a
   * legal heir, these values replace the normal ones. Currently the
   * government charges only the flat stamp duty + PLRA base fee for this
   * case, so everything else is zero. */
  ruralGiftHeir: {
    borFee: 0,
    mutationFee: 0,
    plraMutation: 0,
    committee: 0,
  },

  /* ---- FBR WITHHOLDING TAXES (applied per person, by their share %) --------
   * Buyer tax = Income Tax Ordinance section 236K.
   * Seller tax = section 236C.
   * "filer" / "non" rates are percentages of the person's share of the
   * total property value. FBR taxes do NOT apply when the deed is a gift
   * to a legal heir. */
  buyerTax: {
    filer: 0.0125, // 1.25%  — filer buyer
    non: 0.105,    // 10.5%  — non-filer buyer
  },
  sellerTax: {
    filer: 0.0275, // 2.75% — filer seller
    non: 0.115,    // 11.5% — non-filer seller
  },

  /* ---- AREA CONVERSIONS (Punjab customary units) --------------------------
   * Used by the built-in area calculator. Standard urban Punjab marla. */
  area: {
    sqftPerMarla: 272,  // square feet in one marla
    marlaPerKanal: 20,  // marlas in one kanal
    kanalPerAcre: 8,    // kanals in one acre
  },
} as const;

/* Type helpers — leave untouched. */
export type SrPartyStatus = keyof typeof SR_RATES.buyerTax; // 'filer' | 'non'
