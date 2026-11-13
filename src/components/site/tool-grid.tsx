"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { CATEGORIES, TOOLS, type CategoryId } from "@/lib/tools";
import { useToolStore } from "@/lib/tool-store";
import { ToolIcon } from "./tool-icon";

export function ToolGrid() {
  const openTool = useToolStore((s) => s.openTool);
  const [cat, setCat] = useState<CategoryId | "all">("all");

  const visible = TOOLS.filter((t) => cat === "all" || t.category === cat);

  const countFor = (id: CategoryId | "all") =>
    id === "all" ? TOOLS.length : TOOLS.filter((t) => t.category === id).length;

  const openCard = (id: string) => {
    const tool = TOOLS.find((t) => t.id === id);
    if (!tool) return;
    if (tool.ready) {
      openTool(id);
    } else {
      toast(`${tool.name} is in the build queue`, {
        description: "It ships with the next development batch.",
      });
    }
  };

  return (
    <section id="tools" className="scroll-mt-20 px-4 py-8 sm:px-6">
      <div className="mx-auto w-full max-w-[1120px]">
        <div className="mb-4 flex flex-wrap items-end gap-3.5">
          <h2 className="font-display text-[21px] font-extrabold tracking-tight text-navy dark:text-[#CFE0FB]">
            All tools
          </h2>
          <span className="pb-0.5 text-[12.5px] font-semibold text-muted-foreground">
            {TOOLS.length} tools · all free
          </span>
        </div>

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
            <button
              key={t.id}
              type="button"
              onClick={() => openCard(t.id)}
              className={`group flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-navy hover:shadow-md dark:hover:border-[#3E5C96] sm:p-4.5 ${
                t.ready ? "" : "opacity-95"
              }`}
            >
              <span className="flex size-[42px] items-center justify-center rounded-xl bg-secondary">
                <ToolIcon
                  icon={t.icon}
                  className={`size-[22px] ${
                    t.ready ? "text-primary" : "text-muted-foreground"
                  }`}
                />
              </span>
              <span className="flex flex-col gap-1">
                <span className="flex items-center gap-2">
                  <span className="font-display text-[15px] font-bold text-foreground">
                    {t.name}
                  </span>
                  {!t.ready && (
                    <span className="rounded-full bg-muted px-1.5 py-px text-[9.5px] font-bold uppercase tracking-wide text-muted-foreground">
                      Soon
                    </span>
                  )}
                </span>
                <span className="text-[12.5px] leading-snug text-muted-foreground">
                  {t.short}
                </span>
              </span>
              {t.ready && (
                <span className="mt-auto inline-flex translate-x-[-4px] items-center gap-1.5 text-[12px] font-bold text-primary opacity-0 transition group-hover:translate-x-0 group-hover:opacity-100">
                  Open tool
                  <ArrowRight className="size-3" aria-hidden="true" />
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
