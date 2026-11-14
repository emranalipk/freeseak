"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CATEGORIES, TOOLS, type CategoryId } from "@/lib/tools";
import { ToolIcon } from "./tool-icon";

/* v0.2: every card links to the tool's own page.
   v0.3: hideHeading — the /tools index page carries its own h1.
   v0.4: the catalogue holds only live tools, so the coming-soon button
   branch is gone (Rule 1). */
const CARD_CLASS =
  "group flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-navy hover:shadow-md dark:hover:border-[#3E5C96] sm:p-4.5";

export function ToolGrid({ hideHeading = false }: { hideHeading?: boolean }) {
  const [cat, setCat] = useState<CategoryId | "all">("all");

  const visible = TOOLS.filter((t) => cat === "all" || t.category === cat);

  const countFor = (id: CategoryId | "all") =>
    id === "all" ? TOOLS.length : TOOLS.filter((t) => t.category === id).length;

  return (
    <section id="tools" className="scroll-mt-20 px-4 py-8 sm:px-6">
      <div className="mx-auto w-full max-w-[1120px]">
        {!hideHeading && (
          <div className="mb-4 flex flex-wrap items-end gap-3.5">
            <h2 className="font-display text-[21px] font-extrabold tracking-tight text-navy dark:text-[#CFE0FB]">
              All free tools
            </h2>
            <span className="pb-0.5 text-[12.5px] font-semibold text-muted-foreground">
              {TOOLS.length} tools · all free
            </span>
          </div>
        )}

        <div className="mb-4.5 flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCat(c.id)}
              aria-pressed={cat === c.id}
              className={`rounded-full border px-3.5 py-1.5 text-[12.5px] font-semibold transition ${
                cat === c.id
                  ? "border-navy bg-navy text-white dark:border-[#22477F] dark:bg-[#22477F]"
                  : "border-border bg-card text-muted-foreground hover:border-primary hover:text-primary"
              }`}
            >
              {c.label}
              <span className="ml-1 opacity-60">{countFor(c.id)}</span>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3.5 md:grid-cols-3 lg:grid-cols-4">
          {visible.map((t) => (
            <Link key={t.id} href={`/tools/${t.id}`} className={CARD_CLASS}>
              <span className="flex size-[42px] items-center justify-center rounded-xl bg-secondary">
                <ToolIcon icon={t.icon} className="size-[22px] text-primary" />
              </span>
              <span className="flex flex-col gap-1">
                <span className="font-display text-[15px] font-bold text-foreground">
                  {t.name}
                </span>
                <span className="text-[12.5px] leading-snug text-muted-foreground">
                  {t.short}
                </span>
              </span>
              <span className="mt-auto inline-flex translate-x-[-4px] items-center gap-1.5 text-[12px] font-bold text-primary opacity-0 transition group-hover:translate-x-0 group-hover:opacity-100">
                Open tool
                <ArrowRight className="size-3" aria-hidden="true" />
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
