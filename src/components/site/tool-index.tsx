"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { searchAllTools } from "@/lib/search";
import { CATEGORY_LABEL, TOOLS, type CategoryId } from "@/lib/tools";

/**
 * v0.9.1 — the numbered index: every tool in the catalogue, grouped by
 * category, numbered 01–N in registry order. The command bar in the
 * hero filters it live (the query is shared through home-page). Rows
 * link to the real /tools/<id> pages — the registry is the only source,
 * so the count and the links can never drift apart.
 */

const GROUPS: { id: CategoryId; label: string }[] = [
  { id: "pdf", label: "PDF Tools" },
  { id: "image", label: "Image Tools" },
  { id: "calc", label: "Calculators" },
  { id: "prod", label: "Productivity & Business" },
];

export function ToolIndex({ query }: { query: string }) {
  const trimmed = query.trim();

  const visible = useMemo(() => {
    if (!trimmed) return null; /* null = show everything */
    const { results } = searchAllTools(trimmed);
    return new Set(results.map((t) => t.id));
  }, [trimmed]);

  /* stable numbering in registry order, gaps just hide while filtering */
  const rows = TOOLS.map((t, i) => ({
    tool: t,
    num: String(i + 1).padStart(2, "0"),
  }));

  const total = TOOLS.length;
  const lastNum = String(total).padStart(2, "0");

  return (
    <section id="tools" className="scroll-mt-20 px-4 py-14 sm:px-6">
      <div className="mx-auto w-full max-w-[1120px]">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <span className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
              <span className="mr-2.5 inline-block size-[9px] rounded-[3px] bg-mint align-middle" aria-hidden="true" />
              The catalogue
            </span>
            <h2 className="mt-3.5 font-display text-[clamp(30px,4.2vw,48px)] font-extrabold tracking-[-0.035em] text-navy dark:text-[#CFE0FB]">
              All {total} tools.
            </h2>
          </div>
          <span className="pb-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
            <span className="text-primary">01–{lastNum}</span> · everything
            free · nothing uploaded
          </span>
        </div>

        {visible !== null && visible.size === 0 ? (
          <p className="py-14 text-center font-mono text-[13px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
            No match for “<span className="text-primary">{trimmed}</span>” —
            try “pdf”, “image” or “qr”.
          </p>
        ) : (
          GROUPS.map((g) => {
            const groupRows = rows.filter(
              (r) => r.tool.category === g.id && (!visible || visible.has(r.tool.id)),
            );
            if (groupRows.length === 0) return null;
            return (
              <div key={g.id} className="mt-10 first:mt-9">
                <div className="flex items-baseline justify-between gap-4 border-t-2 border-navy pt-3.5 dark:border-[#22477F]">
                  <h3 className="font-display text-[19px] font-extrabold tracking-[-0.02em] text-navy dark:text-[#CFE0FB] sm:text-[23px]">
                    {g.label}
                    <span className="ml-3 font-mono text-[11.5px] font-bold tracking-[0.08em] text-muted-foreground">
                      {groupRows[0].num}–{groupRows[groupRows.length - 1].num}
                    </span>
                  </h3>
                  <span className="font-mono text-[10.5px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                    {groupRows.length} tool{groupRows.length === 1 ? "" : "s"}
                  </span>
                </div>
                <div>
                  {groupRows.map(({ tool: t, num }) => (
                    <Link
                      key={t.id}
                      href={`/tools/${t.id}`}
                      className="group -mx-3.5 grid grid-cols-[40px_minmax(0,1fr)_26px] items-center gap-3 rounded-xl border-b border-border px-3.5 py-4 transition-colors hover:bg-navy dark:hover:bg-[#1B2A47] sm:grid-cols-[58px_minmax(0,1fr)_auto_36px] sm:gap-4 sm:py-[17px]"
                    >
                      <span className="font-mono text-[12px] font-bold tabular-nums text-muted-foreground group-hover:text-white/80 dark:group-hover:text-[#B9CBE8]">
                        {num}
                      </span>
                      <span className="min-w-0">
                        <span className="block font-display text-[17.5px] font-bold tracking-[-0.02em] text-navy group-hover:text-white dark:text-[#CFE0FB] dark:group-hover:text-white sm:text-[21px]">
                          {t.name}
                        </span>
                        <span className="mt-1 block text-[12.5px] leading-snug text-muted-foreground group-hover:text-white/75 dark:group-hover:text-[#B9CBE8]">
                          {t.tagline ?? t.short}
                        </span>
                      </span>
                      <span className="hidden rounded-full border border-border px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground group-hover:border-white/40 group-hover:text-white/80 dark:group-hover:border-[#B9CBE8]/45 sm:inline-block">
                        {CATEGORY_LABEL[t.category]}
                      </span>
                      <ArrowRight
                        className="size-[18px] text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-mint"
                        aria-hidden="true"
                      />
                    </Link>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
