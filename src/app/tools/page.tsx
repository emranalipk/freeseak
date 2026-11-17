import type { Metadata } from "next";
import { ToolGrid } from "@/components/site/tool-grid";
import { TOOLS } from "@/lib/tools";
import { CONTACT_EMAIL } from "@/lib/site";

/**
 * v0.3 — the all-tools index page: a real, crawlable directory of every
 * FreeSeak tool (the homepage grid stays too; this adds a dedicated
 * indexable surface with its own copy and internal links).
 */
export const metadata: Metadata = {
  title: "All Free Online Tools — PDF, Image Tools, Calculators & Productivity",
  description: `Browse all ${TOOLS.length} FreeSeak tools: the complete PDF suite (edit, merge, split, organize, compress and more), image tools (compress, resize, enhance and upscale), a bilingual Punjab Registry Estimator, QR code generator, word counter and calculators. All free, no sign-up, nothing uploaded.`,
  alternates: { canonical: "/tools" },
  openGraph: {
    title: "All Free Online Tools — FreeSeak",
    description:
      "Browse every FreeSeak tool. All free, no sign-up, nothing uploaded.",
    url: "/tools",
    type: "website",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "FreeSeak — free online tools" }],
  },
};

export default function ToolsIndexPage() {
  return (
    <div className="mx-auto w-full max-w-[1120px] px-4 py-8 sm:px-6 sm:py-10">
      <h1 className="font-display text-[26px] font-extrabold tracking-tight text-navy dark:text-[#CFE0FB] sm:text-[30px]">
        All free online tools
      </h1>
      <p className="mt-2.5 max-w-[640px] text-[14.5px] leading-relaxed text-muted-foreground">
        Every FreeSeak tool runs entirely in your browser — no sign-up, no
        uploads, no watermarks. Pick a category or search (press the{" "}
        <kbd className="rounded border border-border bg-card px-1 py-px text-[11px] font-semibold">
          /
        </kbd>{" "}
        key anywhere, or Ctrl+K for the command palette).
      </p>

      <div className="mt-6">
        <ToolGrid hideHeading />
      </div>

      <section className="mt-8 rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <h2 className="font-display text-[15px] font-bold text-foreground">
          Missing a tool?
        </h2>
        <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">
          Every FreeSeak tool works the same way: instantly, privately,
          entirely on your device — and new ones ship when they are genuinely
          finished. If a tool you need is missing,{" "}
          <a
            href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
              "FreeSeak tool request",
            )}`}
            className="font-semibold text-primary hover:underline"
          >
            request a tool
          </a>{" "}
          — requests help decide what gets built.
        </p>
      </section>
    </div>
  );
}
