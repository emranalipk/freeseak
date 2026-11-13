"use client";

import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";
import { CATEGORY_LABEL, TOOLS, type CategoryId } from "@/lib/tools";
import { useToolStore } from "@/lib/tool-store";
import { LogoSlot, Tagline, Wordmark } from "./logo";

const GROUPS: CategoryId[] = ["pdf", "image", "calc", "prod"];

export function SiteFooter() {
  const openTool = useToolStore((s) => s.openTool);

  const openOrSoon = (id: string) => {
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

  const soonPage = (label: string) =>
    toast(`${label} ships with the full launch`, {
      description: "You are looking at the early working build.",
    });

  return (
    <footer className="mt-auto bg-[#173B70] text-white dark:bg-[#0A1220]">
      <div className="mx-auto grid w-full max-w-[1120px] grid-cols-1 gap-9 px-4 py-11 sm:grid-cols-2 sm:px-6 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <div className="mb-3.5">
            <LogoSlot size={40} className="border-white/35" />
          </div>
          <Wordmark className="text-white" />
          <div className="mt-1.5">
            <Tagline className="text-white/60" />
          </div>
          <span className="mt-4 inline-flex items-center gap-2 rounded-full border border-mint/45 px-3 py-1.5 text-[11.5px] font-semibold text-mint">
            <ShieldCheck className="size-3.5" aria-hidden="true" />
            Processed on your device
          </span>
        </div>

        {GROUPS.map((cat) => (
          <nav key={cat} aria-label={CATEGORY_LABEL[cat]}>
            <h4 className="mb-3.5 font-display text-[11px] font-bold uppercase tracking-[0.16em] text-white/55">
              {CATEGORY_LABEL[cat]}
            </h4>
            <ul className="space-y-0.5">
              {TOOLS.filter((t) => t.category === cat).map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => openOrSoon(t.id)}
                    className="rounded px-0 py-1 text-[13px] text-white/80 transition-colors hover:text-white"
                  >
                    {t.name}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex w-full max-w-[1120px] flex-wrap items-center gap-x-3 gap-y-1 px-4 py-4 text-[12.5px] text-white/60 sm:px-6">
          <span>© 2026 FreeSeak</span>
          <span className="opacity-40">·</span>
          <span>Seek &amp; Done</span>
          <span className="opacity-40">·</span>
          <span>Every tool free, every file yours</span>
          <span className="ml-auto hidden gap-3 sm:flex">
            {["About", "Privacy Policy", "Terms", "Disclaimer"].map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => soonPage(p)}
                className="rounded px-0 transition-colors hover:text-white"
              >
                {p}
              </button>
            ))}
          </span>
        </div>
      </div>
    </footer>
  );
}
