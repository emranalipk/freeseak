"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronRight, ShieldCheck } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ToolIcon } from "@/components/site/tool-icon";
import { CATEGORY_LABEL, TOOLS, type ToolDef } from "@/lib/tools";
import {
  OPERATOR_EXPERIENCE,
  OPERATOR_NAME,
  SITE_URL,
} from "@/lib/site";
import { recordVisit } from "@/lib/tool-store";
import { TOOL_COMPONENTS } from "./tool-registry";

/**
 * v0.9.1 — canvas-heavy tools open edge-to-edge (the old 880px cap
 * cramped the editor); every other tool gets a wider 1160px column.
 */
const FULL_BLEED = new Set(["edit-pdf", "organize-pdf-pages", "pdf-to-images"]);

/**
 * The full standalone page for ONE tool — the v0.2 replacement for
 * the popup overlay. Renders the tool itself plus its how-to guide,
 * FAQ and related tools, so every tool has a shareable URL that
 * Google can index (title, description and FAQ come from the
 * catalogue in lib/tools.ts — the single source of truth).
 */
export function ToolPage({ tool }: { tool: ToolDef }) {
  /* record the visit so the homepage "recent tools" chips stay alive */
  useEffect(() => {
    recordVisit(tool.id);
  }, [tool.id]);

  const ToolComponent = TOOL_COMPONENTS[tool.id];

  const related = [
    ...TOOLS.filter(
      (t) => t.id !== tool.id && t.category === tool.category,
    ),
    ...TOOLS.filter(
      (t) => t.id !== tool.id && t.category !== tool.category,
    ),
  ].slice(0, 3);

  /* structured data for Google (v0.3: FAQ + WebApplication + Breadcrumb):
     all of it is generated from the catalogue — the single source of truth */
  const faqJsonLd =
    tool.faq && tool.faq.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: tool.faq.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
          })),
        }
      : null;

  const webAppJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: `${tool.name} — FreeSeak`,
    url: `${SITE_URL}/tools/${tool.id}`,
    applicationCategory: "UtilityApplication",
    operatingSystem: "Any (runs in the browser)",
    description: tool.short,
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    browserRequirements: "Requires JavaScript",
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Tools", item: `${SITE_URL}/tools` },
      {
        "@type": "ListItem",
        position: 3,
        name: tool.name,
        item: `${SITE_URL}/tools/${tool.id}`,
      },
    ],
  };

  const full = FULL_BLEED.has(tool.id);

  return (
    <div
      className={`w-full px-4 py-6 sm:px-6 sm:py-8 ${
        full ? "" : "mx-auto max-w-[1160px]"
      }`}
    >
      {/* v0.9.1: on full-bleed pages the chrome (breadcrumb, header,
          how-to, FAQ) keeps a readable 880px measure; only the tool
          itself spans the screen */}
      <div className={full ? "mx-auto w-full max-w-[880px]" : undefined}>
      {/* breadcrumb */}
      <nav aria-label="Breadcrumb">
        <ol className="flex flex-wrap items-center gap-1.5 text-[12.5px] text-muted-foreground">
          <li className="flex items-center gap-1.5">
            <Link
              href="/"
              className="font-semibold transition-colors hover:text-primary"
            >
              Home
            </Link>
            <ChevronRight className="size-3.5 opacity-50" aria-hidden="true" />
          </li>
          <li className="flex items-center gap-1.5">
            <Link
              href="/#tools"
              className="font-semibold transition-colors hover:text-primary"
            >
              Tools
            </Link>
            <ChevronRight className="size-3.5 opacity-50" aria-hidden="true" />
          </li>
          <li>
            <span aria-current="page" className="font-semibold text-foreground">
              {tool.name}
            </span>
          </li>
        </ol>
      </nav>

      {/* header */}
      <header className="mt-5 flex items-start gap-3.5 rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-secondary">
          <ToolIcon icon={tool.icon} className="size-[22px] text-primary" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
            {CATEGORY_LABEL[tool.category]}
          </p>
          <h1 className="mt-0.5 font-display text-[22px] font-extrabold tracking-tight text-foreground sm:text-[26px]">
            {tool.name}
          </h1>
          {/* v0.9.3: the header keeps only the one-liner — the full
              SEO intro moved below the tool, where reading belongs */}
          {tool.short && (
            <p className="mt-2 max-w-[560px] text-[13.5px] leading-relaxed text-muted-foreground">
              {tool.short}
            </p>
          )}
          <span className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-mint/45 bg-mint/5 px-3 py-1 text-[11.5px] font-semibold text-mint-deep dark:text-mint">
            <ShieldCheck className="size-3.5" aria-hidden="true" />
            Processed on your device — nothing is uploaded
          </span>
        </div>
      </header>
      </div>

      {/* the tool itself */}
      <section className="mt-4 rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
        {ToolComponent ? <ToolComponent /> : null}
      </section>

      <div className={full ? "mx-auto w-full max-w-[880px]" : undefined}>
      {/* about — v0.9.3: the full intro moved below the tool. People
          land here to DO something; the reading material follows the
          doing (same text, same indexability for Google) */}
      {tool.intro && (
        <section className="mt-4 rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
          <h2 className="font-display text-[15px] font-bold text-foreground">
            About the {tool.name}
          </h2>
          <p className="mt-2.5 text-[13px] leading-relaxed text-muted-foreground">
            {tool.intro}
          </p>
        </section>
      )}

      {/* how to use */}
      {tool.howTo && tool.howTo.length > 0 && (
        <section className="mt-4 rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
          <h2 className="font-display text-[15px] font-bold text-foreground">
            How to use the {tool.name}
          </h2>
          <ol className="mt-3 space-y-2">
            {tool.howTo.map((step, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md bg-navy text-[11px] font-bold text-white dark:bg-[#22477F]">
                  {i + 1}
                </span>
                <span className="text-[13px] leading-relaxed text-muted-foreground">
                  {step}
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* FAQ */}
      {tool.faq && tool.faq.length > 0 && (
        <section className="mt-4 rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
          <h2 className="mb-3 font-display text-[15px] font-bold text-foreground">
            Frequently asked questions
          </h2>
          <Accordion type="single" collapsible className="gap-2">
            {tool.faq.map((f, i) => (
              <AccordionItem
                key={f.q}
                value={`tq-${i}`}
                className="rounded-xl border border-border bg-card px-4"
              >
                <AccordionTrigger className="py-3 text-left font-display text-[13px] font-bold hover:no-underline">
                  {f.q}
                </AccordionTrigger>
                <AccordionContent className="pb-3.5 text-[12.5px] leading-relaxed text-muted-foreground">
                  {f.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>
      )}

      {/* related tools */}
      {related.length > 0 && (
        <section className="mt-4 rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
          <h2 className="mb-3 font-display text-[15px] font-bold text-foreground">
            Keep going
          </h2>
          <div className="flex flex-wrap gap-2">
            {related.map((t) => (
              <Link
                key={t.id}
                href={`/tools/${t.id}`}
                className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-2 text-[13px] font-semibold text-foreground transition hover:-translate-y-px hover:border-primary"
              >
                <ToolIcon icon={t.icon} className="size-4 text-primary" />
                {t.name}
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="mt-6 text-center">
        <Link
          href="/#tools"
          className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-[13px] font-bold text-primary transition hover:underline"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to all tools
        </Link>
        {/* v0.4: operator credit near the tool area */}
        <p className="mt-2.5 text-[11.5px] font-semibold text-muted-foreground/70">
          Built by {OPERATOR_NAME} — {OPERATOR_EXPERIENCE}
        </p>
      </div>
      </div>

      {[faqJsonLd, webAppJsonLd, breadcrumbJsonLd].map((ld, i) =>
        ld ? (
          <script
            key={i}
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }}
          />
        ) : null,
      )}
    </div>
  );
}
