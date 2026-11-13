"use client";

import { Hero } from "./hero";
import { RecentTools } from "./recent-tools";
import { ToolGrid } from "./tool-grid";
import { AdSlot } from "./ad-slot";
import { WhyFreeseak } from "./why-freeseak";
import { Faq } from "./faq";

/**
 * v0.2: the homepage is now content-only — the header, footer and
 * command palette live in the root layout so tool pages share them.
 * Clicking a tool card now navigates to that tool's own page
 * (/tools/<id>) instead of opening the old popup.
 */
export function HomePage() {
  return (
    <>
      <Hero />
      <RecentTools />
      <ToolGrid />
      <AdSlot />
      <WhyFreeseak />
      <Faq />
    </>
  );
}
