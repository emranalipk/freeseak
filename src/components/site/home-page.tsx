"use client";

import { SiteHeader } from "./header";
import { Hero } from "./hero";
import { RecentTools } from "./recent-tools";
import { ToolGrid } from "./tool-grid";
import { AdSlot } from "./ad-slot";
import { WhyFreeseak } from "./why-freeseak";
import { Faq } from "./faq";
import { SiteFooter } from "./footer";
import { CommandPalette } from "./command-palette";
import { ToolOverlay } from "@/components/tools/tool-overlay";

export function HomePage() {
  return (
    <div id="top" className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <Hero />
        <RecentTools />
        <ToolGrid />
        <AdSlot />
        <WhyFreeseak />
        <Faq />
      </main>
      <SiteFooter />
      <CommandPalette />
      <ToolOverlay />
    </div>
  );
}
