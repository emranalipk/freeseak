import type { Metadata } from "next";
import Link from "next/link";
import { PageSection, StaticPage } from "@/components/site/static-page";
import { OPERATOR_NAME, SITE_URL } from "@/lib/site";
import { SR_RATES } from "@/lib/punjab-rates";

/**
 * v1.0.3 — the Punjab Registry Costs landing page (SEO brief Task 6a):
 * a full content page that explains what registering property in Punjab
 * actually costs, with a worked example computed by the same engine the
 * estimator runs — not a thin tool wrapper. Every number on this page
 * comes from src/lib/punjab-rates.ts / the engine output; nothing is
 * invented. FAQPage JSON-LD is deliberately absent (deprecated rich
 * result, May 2026) — the FAQs below are visible HTML.
 */

export const metadata: Metadata = {
  title: "Punjab Registry Costs: Stamp Duty, PLRA & FBR Tax",
  description:
    "What property registry really costs in Punjab, Pakistan: stamp duty 1%, district council fee, PLRA fee, mutation, and FBR 236K/236C filer vs non-filer — with a full worked example on a Rs. 50 lakh plot.",
  alternates: { canonical: "/punjab-registry-costs" },
  openGraph: {
    title: "Punjab Registry Costs — Full Fee Breakdown with Worked Example",
    description:
      "Stamp duty, district council fee, PLRA, mutation and FBR 236K/236C explained, with a filer vs non-filer worked example on a Rs. 50 lakh plot. Estimate yours free, no sign-up.",
    url: "/punjab-registry-costs",
    type: "article",
    images: [
      {
        url: "/og/punjab-registry-estimator.png",
        width: 1200,
        height: 630,
        alt: "Punjab Registry Estimator — registry cost breakdown on FreeSeak",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Punjab Registry Costs — Full Fee Breakdown | FreeSeak",
    description:
      "Stamp duty, PLRA, mutation and FBR 236K/236C explained, with a worked example on a Rs. 50 lakh plot.",
    images: ["/og/punjab-registry-estimator.png"],
  },
};

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "FreeSeak", item: SITE_URL },
    { "@type": "ListItem", position: 2, name: "Punjab Registry Costs", item: `${SITE_URL}/punjab-registry-costs` },
  ],
};

/* The worked example below was computed by src/lib/punjab-registry-engine.ts
   (urban conveyance, non-constructed, Rs. 50,00,000 land value, one buyer and
   one seller at 100% share each, no user-entered expenses). If SR_RATES ever
   changes, re-run scripts/v103-punjab-example.ts and update both tables. */
const EXAMPLE = {
  value: "Rs. 50,00,000 (50 lakh)",
  challan: [
    { lbl: "Stamp duty — 1% of value + Rs. 1,000 base fee", filer: "51,000", non: "51,000" },
    { lbl: "District council fee — 1% of value", filer: "50,000", non: "50,000" },
    { lbl: "PLRA fee — Rs. 3,600 base + 14 surcharge steps of Rs. 100", filer: "5,000", non: "5,000" },
    { lbl: "Board of Revenue fee", filer: "100", non: "100" },
    { lbl: "Mutation (intqaal) fee", filer: "300", non: "300" },
    { lbl: "PLRA mutation fee", filer: "200", non: "200" },
  ],
  challanTotal: "106,600",
  fbr: [
    { lbl: "Buyer — 236K (1.25% filer / 10.5% non-filer)", filer: "62,500", non: "525,000" },
    { lbl: "Seller — 236C (2.75% filer / 11.5% non-filer)", filer: "137,500", non: "575,000" },
  ],
  fbrTotal: { filer: "200,000", non: "1,100,000" },
  grand: { filer: "306,600", non: "1,206,600" },
  saving: "900,000",
};

const faqs = [
  {
    q: "How much does property registry cost in Punjab (e.g. in Lahore)?",
    a: `For a typical Rs. 50 lakh (5,000,000) urban plot bought and sold by filers, the registry bill works out to about Rs. 306,600: Rs. 106,600 in 32-A challan fees (stamp duty, district council fee, PLRA fee, BOR, mutation) plus Rs. 200,000 in FBR withholding tax. Non-filers pay Rs. 1,206,600 for the same plot. Run your exact case — value, shares, filer status, gift or sale — through the free estimator for a per-line breakdown.`,
  },
  {
    q: "What is the stamp duty rate in Punjab?",
    a: `1% of the property value for non-constructed property, plus a small base fee (Rs. 500 for values up to Rs. 5 lakh, Rs. 1,000 above). For constructed property, stamp duty is 1% of the combined land + construction value plus 2% of the land value alone, plus the same base fee. A gift of rural land to a legal heir is the special case: a flat Rs. 1,000 stamp duty with the mutation-side fees waived.`,
  },
  {
    q: "What is the CVT rate in Punjab — is it included?",
    a: `No — capital value tax / the Punjab urban immovable property taxes are separate levies outside the 32-A challan estimated here, and they depend on federal finance acts and provincial rules that change between budgets, so this page and the estimator do not guess them. The Punjab Excise & Taxation department publishes its own official property tax calculator; check there, and read the "What is NOT included" section below before comparing any online estimate with a real challan.`,
  },
  {
    q: "How much more does a non-filer pay for registry?",
    a: `The 32-A challan fees are the same for filers and non-filers — the difference is entirely the FBR withholding tax: 236K on the buyer jumps from 1.25% to 10.5%, and 236C on the seller from 2.75% to 11.5%. On the Rs. 50 lakh example that turns a Rs. 306,600 bill into Rs. 1,206,600 — Rs. 900,000 more, split roughly evenly between the two sides.`,
  },
  {
    q: "Do I pay these fees on the DC value or the market value?",
    a: `On the DC (district collector) rate — the government's assessed value for your area and property class — which is usually lower than the open market price. The estimator estimates from whatever value you enter, so enter the DC-rate value of your property for a realistic challan estimate. The gap between DC rate and market value is exactly why estimates built on market value can look several times too high.`,
  },
  {
    q: "What is the registry cost for a gift to a legal heir?",
    a: `Far less than a sale. An urban gift to a legal heir pays a flat Rs. 1,000 stamp duty instead of the percentage rates, FBR's 236K/236C withholding does not apply, and a rural gift to a legal heir goes further — the district council, BOR and mutation-side fees are waived entirely, leaving just the flat stamp duty and the PLRA fee. The estimator applies all of these exemptions automatically once you pick Gift + legal heir.`,
  },
  {
    q: "Who charges each fee on the 32-A challan?",
    a: `The stamp duty and BOR fee go to the Board of Revenue via the sub-registrar; the district council fee belongs to your local district council; the PLRA fee and PLRA mutation fee go to the Punjab Land Records Authority for the record-of-rights and intqaal work; the FBR taxes are advance income tax collected at registration under sections 236K and 236C of the Income Tax Ordinance.`,
  },
  {
    q: "Is this page an official government calculator?",
    a: `No. It is an independent guide by ${OPERATOR_NAME}, built on the same rates the FreeSeak estimator uses (with the effective date always shown), and it links the relevant official sources — e-Stamping Punjab, PLRA, the Board of Revenue and FBR — so you can verify every figure yourself. Only the sub-registrar's own challan calculation is final.`,
  },
];

export default function Page() {
  return (
    <>
      <StaticPage
        title="Punjab Property Registry Costs — the Complete Fee Breakdown"
        updated={`Rates last verified: ${SR_RATES.ratesEffective}`}
        intro="What you actually pay to register a property transfer in Punjab, Pakistan — every line of the 32-A challan and the FBR withholding taxes, explained in plain words and shown on a fully worked example, all computed by the same engine that powers the free FreeSeak estimator. Nothing on this page is guessed: every rate matches the estimator's effective date, and the official sources are linked at the bottom."
      >
        <PageSection heading="What registry costs consist of">
          <p>
            Registering a property transfer in Punjab means paying two distinct stacks of money at
            the sub-registrar's counter: the <strong>32-A challan</strong> (the provincial fees that
            legally complete the transfer) and the <strong>FBR withholding taxes</strong> (federal
            advance income tax, collected at the same counter). On top of both come your own
            practical expenses — stamp paper, the fard/moqa record, photocopies, and any stamp
            vendor or document-writer charges.
          </p>
          <ul className="ml-4 list-disc space-y-1.5">
            <li>
              <strong>Stamp duty</strong> — 1% of the property value for non-constructed property;
              for constructed property it is 1% of the combined value <em>plus</em> 2% of the land
              value alone. A small base fee applies to every deed: Rs. 500 for values up to Rs. 5
              lakh, Rs. 1,000 above.
            </li>
            <li>
              <strong>District council fee</strong> — 1% of the value, paid to your local district
              council.
            </li>
            <li>
              <strong>PLRA fee</strong> — Rs. 3,600 base, plus Rs. 100 for every full Rs. 100,000 of
              value above Rs. 36 lakh. A Rs. 50 lakh plot therefore pays Rs. 5,000.
            </li>
            <li>
              <strong>Board of Revenue fee</strong> — a flat Rs. 100 on every normal deed.
            </li>
            <li>
              <strong>Mutation fees</strong> — Rs. 300 mutation fee plus a Rs. 200 PLRA mutation
              charge, covering the intqaal (change of ownership in the land records).
            </li>
            <li>
              <strong>FBR 236K (buyer)</strong> — advance income tax on the buyer's share: 1.25% for
              filers, 10.5% for non-filers.
            </li>
            <li>
              <strong>FBR 236C (seller)</strong> — advance income tax on the seller's share: 2.75%
              for filers, 11.5% for non-filers.
            </li>
          </ul>
          <p>
            Gifts are treated differently: an urban gift to a legal heir pays a flat Rs. 1,000
            stamp duty and skips the FBR taxes entirely, and a rural gift to a legal heir is
            reduced further — the council, BOR and mutation-side fees are waived. The estimator
            applies every one of these special cases automatically.
          </p>
        </PageSection>

        <PageSection heading="A fully worked example — Rs. 50 lakh urban plot, sale deed">
          <p>
            One buyer (100% share) and one seller (100% share), urban, non-constructed, DC value Rs.
            50,00,000, no user-entered expenses. These numbers were produced by the estimator's
            own engine — run the same case yourself and you will get exactly this:
          </p>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[12.5px]">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="py-2 pr-3 font-semibold">Fee line</th>
                  <th className="py-2 pr-3 text-right font-semibold">Filer</th>
                  <th className="py-2 text-right font-semibold">Non-filer</th>
                </tr>
              </thead>
              <tbody className="text-muted-foreground">
                {EXAMPLE.challan.map((r) => (
                  <tr key={r.lbl} className="border-b border-border/60">
                    <td className="py-1.5 pr-3">{r.lbl}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">{r.filer}</td>
                    <td className="py-1.5 text-right tabular-nums">{r.non}</td>
                  </tr>
                ))}
                <tr className="font-semibold text-foreground">
                  <td className="py-1.5 pr-3">32-A challan subtotal</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{EXAMPLE.challanTotal}</td>
                  <td className="py-1.5 text-right tabular-nums">{EXAMPLE.challanTotal}</td>
                </tr>
                {EXAMPLE.fbr.map((r) => (
                  <tr key={r.lbl} className="border-b border-border/60">
                    <td className="py-1.5 pr-3">{r.lbl}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">{r.filer}</td>
                    <td className="py-1.5 text-right tabular-nums">{r.non}</td>
                  </tr>
                ))}
                <tr className="border-b border-border/60 font-semibold text-foreground">
                  <td className="py-1.5 pr-3">FBR withholding subtotal</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{EXAMPLE.fbrTotal.filer}</td>
                  <td className="py-1.5 text-right tabular-nums">{EXAMPLE.fbrTotal.non}</td>
                </tr>
                <tr className="font-bold text-navy dark:text-[#CFE0FB]">
                  <td className="py-2 pr-3">Total payable at registration</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{EXAMPLE.grand.filer}</td>
                  <td className="py-2 text-right tabular-nums">{EXAMPLE.grand.non}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p>
            All amounts in rupees. The only difference between the two columns is filer status —
            the provincial challan does not care, the FBR withholding does. Becoming a filer saves
            the two sides Rs. {EXAMPLE.saving} on this single transaction, which is why the
            estimator shows a filer-vs-non-filer saving line with every result.
          </p>
        </PageSection>

        <PageSection heading="What this estimate does NOT include">
          <p>
            An estimate that hides its blind spots is worse than no estimate. These are the real
            gaps, stated plainly:
          </p>
          <ul className="ml-4 list-disc space-y-1.5">
            <li>
              <strong>Capital value tax / UIPT</strong> — provincial and federal property taxes
              outside the 32-A challan that change with finance acts and budgets. Check the official
              Punjab Excise calculator linked below rather than trusting any one-page figure.
            </li>
            <li>
              <strong>DC-rate vs market value</strong> — the challan is computed on the DC (district
              collector) value, usually well below the market price. Enter the DC value in the
              estimator, not the market price, or the estimate will read too high.
            </li>
            <li>
              <strong>Professional fees</strong> — document writers, stamp vendors, lawyers and
              agents are paid at whatever you negotiate; only the ones you enter yourself appear in
              the result.
            </li>
            <li>
              <strong>District variations and counter rounding</strong> — some district councils
              surcharge differently, and the counter rounds; the final challan is always the
              sub-registrar's own math, not any website's.
            </li>
            <li>
              <strong>Court fees and litigation costs</strong> — if the transfer is under dispute,
              inheritance partition or auction, separate processes apply entirely.
            </li>
          </ul>
        </PageSection>

        <PageSection heading="Frequently asked questions">
          <div className="flex flex-col gap-4">
            {faqs.map((f) => (
              <div key={f.q}>
                <h3 className="text-[13.5px] font-bold text-foreground">{f.q}</h3>
                <p className="mt-1">{f.a}</p>
              </div>
            ))}
          </div>
        </PageSection>

        <PageSection heading="Official sources — verify every number yourself">
          <p>
            Rates last verified {SR_RATES.ratesEffective} — the same effective date the estimator
            prints under every result. When a budget or notification changes the rates, this page
            and the estimator are updated together from one rates file.
          </p>
          <ul className="ml-4 list-disc space-y-1.5">
            <li>
              <a className="font-semibold text-navy underline dark:text-[#CFE0FB]" href="https://estamp.punjab.gov.pk" target="_blank" rel="noopener noreferrer">
                e-Stamping Punjab
              </a>{" "}
              — the official e-stamp portal: calculate and verify stamp paper for any deed.
            </li>
            <li>
              <a className="font-semibold text-navy underline dark:text-[#CFE0FB]" href="https://plra.punjab.gov.pk" target="_blank" rel="noopener noreferrer">
                Punjab Land Records Authority (PLRA)
              </a>{" "}
              — fard, registry record and the mutation (intqaal) process.
            </li>
            <li>
              <a className="font-semibold text-navy underline dark:text-[#CFE0FB]" href="https://bor.punjab.gov.pk" target="_blank" rel="noopener noreferrer">
                Board of Revenue Punjab
              </a>{" "}
              — the department behind stamp duty and the sub-registrar offices.
            </li>
            <li>
              <a className="font-semibold text-navy underline dark:text-[#CFE0FB]" href="https://www.fbr.gov.pk" target="_blank" rel="noopener noreferrer">
                Federal Board of Revenue (FBR)
              </a>{" "}
              — sections 236K/236C withholding rules and filer status (Active Taxpayer List).
            </li>
            <li>
              <a className="font-semibold text-navy underline dark:text-[#CFE0FB]" href="https://excise.punjab.gov.pk/upit-property-tax-calculator" target="_blank" rel="noopener noreferrer">
                Punjab Excise &amp; Taxation — property tax calculator
              </a>{" "}
              — the official tool for the urban immovable property taxes that sit outside this
              estimate.
            </li>
          </ul>
        </PageSection>

        <PageSection heading="Estimate your own registry bill — free, private, in Urdu too">
          <p>
            Reading about rates is one thing; seeing your own numbers is another. The{" "}
            <Link className="font-semibold text-navy underline dark:text-[#CFE0FB]" href="/tools/punjab-registry-estimator">
              Punjab Registry Estimator
            </Link>{" "}
            runs entirely in your browser — enter the value, pick sale or gift, list every buyer
            and seller with their share and filer status, and get the complete per-line breakdown
            in English or اردو. Export it as a PDF, image or print sheet for your
            document-writer, or send it straight to WhatsApp. Nothing is uploaded, no account is
            needed, and like every FreeSeak tool it works offline once loaded. You can also{" "}
            <Link className="font-semibold text-navy underline dark:text-[#CFE0FB]" href="/tools">
              browse all 22 free tools
            </Link>{" "}
            — every one of them processes files on your device only.
          </p>
          <p className="text-[12px] italic">
            Disclaimer: this page and the estimator provide an informational estimate only — they
            are not legal, tax or financial advice, and they are not affiliated with any
            government department. Only the sub-registrar's official challan is final; confirm
            every figure there before you transact.
          </p>
        </PageSection>
      </StaticPage>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
    </>
  );
}
