"use client";

import { ShieldCheck } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { DialogTitle } from "@/components/ui/dialog";
import { CATEGORY_LABEL, READY_TOOLS, type ToolDef } from "@/lib/tools";
import { useToolStore } from "@/lib/tool-store";
import { ToolIcon } from "@/components/site/tool-icon";

export function ToolShell({
  tool,
  children,
}: {
  tool: ToolDef;
  children: React.ReactNode;
}) {
  const openTool = useToolStore((s) => s.openTool);

  const related = [
    ...READY_TOOLS.filter((t) => t.id !== tool.id && t.category === tool.category),
    ...READY_TOOLS.filter((t) => t.id !== tool.id && t.category !== tool.category),
  ].slice(0, 3);

  return (
    <div className="flex flex-col">
      {/* header */}
      <div className="flex items-start gap-3.5 border-b border-border px-5 py-5 sm:px-7">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-secondary">
          <ToolIcon icon={tool.icon} className="size-[22px] text-primary" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
            {CATEGORY_LABEL[tool.category]}
          </p>
          <DialogTitle className="mt-0.5 font-display text-[20px] font-extrabold tracking-tight text-foreground">
            {tool.name}
          </DialogTitle>
          {tool.intro && (
            <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
              {tool.intro}
            </p>
          )}
          <span className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-mint/45 bg-mint/5 px-3 py-1 text-[11.5px] font-semibold text-mint-deep dark:text-mint">
            <ShieldCheck className="size-3.5" aria-hidden="true" />
            Processed on your device — nothing is uploaded
          </span>
        </div>
      </div>

      {/* the tool itself */}
      <div className="px-5 py-6 sm:px-7">{children}</div>

      {/* how to use */}
      {tool.howTo && tool.howTo.length > 0 && (
        <div className="border-t border-border bg-muted/30 px-5 py-6 sm:px-7">
          <h3 className="font-display text-[14px] font-bold text-foreground">
            How to use the {tool.name}
          </h3>
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
        </div>
      )}

      {/* FAQ */}
      {tool.faq && tool.faq.length > 0 && (
        <div className="border-t border-border px-5 py-6 sm:px-7">
          <h3 className="mb-3 font-display text-[14px] font-bold text-foreground">
            Frequently asked questions
          </h3>
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
        </div>
      )}

      {/* related */}
      {related.length > 0 && (
        <div className="border-t border-border px-5 py-6 sm:px-7">
          <h3 className="mb-3 font-display text-[14px] font-bold text-foreground">
            Keep going
          </h3>
          <div className="flex flex-wrap gap-2">
            {related.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => openTool(t.id)}
                className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-2 text-[13px] font-semibold text-foreground transition hover:-translate-y-px hover:border-primary"
              >
                <ToolIcon icon={t.icon} className="size-4 text-primary" />
                {t.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
