"use client";

import { useState } from "react";
import { WorkbenchHero } from "./workbench-hero";
import { TryTools } from "./try-tools";
import { RecentTools } from "./recent-tools";
import { ToolIndex } from "./tool-index";
import { WorkspaceShowcase } from "./workspace-showcase";
import { AdSlot } from "./ad-slot";
import { ManifestoBand } from "./manifesto-band";
import { Faq } from "./faq";
import { TOOLS } from "@/lib/tools";

/**
 * v0.9.1 — the Workbench homepage (concept v4, ported into the app):
 * promise → live proof → try it right here → the full numbered index →
 * the full-screen workspace story → the manifesto + receipt → FAQ.
 *
 * The hero command bar and the index share one query (lifted here), so
 * typing above filters the catalogue below — the search index, the
 * stats and every link are generated from the catalogue in lib/tools,
 * the single source of truth.
 */
export function HomePage() {
  const [query, setQuery] = useState("");

  return (
    <>
      <WorkbenchHero query={query} onQuery={setQuery} />
      <StatsStrip />
      <TryTools />
      <RecentTools />
      <ToolIndex query={query} />
      <WorkspaceShowcase />
      <AdSlot />
      <ManifestoBand />
      <Faq />
      <HomeWordmark />
    </>
  );
}

/* the numbers under the promise — count comes from the catalogue */
function StatsStrip() {
  const stats = [
    { v: String(TOOLS.length), l: "Tools live", zero: false },
    { v: "0", l: "Files uploaded", zero: true },
    { v: "0", l: "Accounts needed", zero: true },
    { v: "$0", l: "Now and forever", zero: false },
  ];

  return (
    <section className="px-4 pt-10 sm:px-6" aria-label="FreeSeak in numbers">
      <div className="mx-auto grid w-full max-w-[1120px] grid-cols-2 overflow-hidden rounded-2xl border border-border bg-card lg:grid-cols-4">
        {stats.map((s, i) => (
          <div
            key={s.l}
            className={`border-border p-6 sm:p-8 lg:p-10 ${
              i % 2 === 1 ? "border-l" : ""
            } ${i === 2 ? "lg:border-l" : ""} ${
              i >= 2 ? "border-t lg:border-t-0" : ""
            }`}
          >
            <p
              className={`font-display text-[clamp(34px,4.5vw,58px)] font-extrabold leading-none tracking-[-0.04em] ${
                s.zero
                  ? "text-mint-deep dark:text-mint"
                  : "text-navy dark:text-[#CFE0FB]"
              }`}
            >
              {s.v}
            </p>
            <p className="mt-2.5 font-mono text-[10.5px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
              {s.l}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* the oversized wordmark that sinks into the footer */
function HomeWordmark() {
  return (
    <section aria-hidden="true" className="overflow-hidden px-4 sm:px-6">
      <div className="mx-auto w-full max-w-[1120px]">
        <p className="translate-y-[22%] select-none whitespace-nowrap text-center font-display text-[clamp(64px,14vw,210px)] font-extrabold leading-[0.8] tracking-[-0.05em] text-navy opacity-90 dark:text-[#2A3B5C]">
          FreeSeak<span className="text-mint">.</span>
        </p>
      </div>
    </section>
  );
}
