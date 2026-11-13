import type { Metadata } from "next";
import { ToolGrid } from "@/components/site/tool-grid";
import { CONTACT_EMAIL } from "@/lib/site";

/**
 * v0.3 — the all-tools index page: a real, crawlable directory of every
 * FreeSeak tool (the homepage grid stays too; this adds a dedicated
 * indexable surface with its own copy and internal links).
 */
export const metadata: Metadata = {
  title: "All Free Online Tools — PDF, Image, Calculators & More",
  description:
    "Browse every FreeSeak tool: QR code generator, word counter, percentage calculator, age calculator — plus PDF and image tools in the build queue. All free, no sign-up.",
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
          What is coming next
        </h2>
        <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">
          The PDF suite (compress, merge and split PDF, JPG↔PDF conversion)
          and the image tools (compress and resize) are in the build queue,
          followed by a free invoice generator. Every one of them will work
          the same way: instantly, privately, on your device. Missing
          something?{" "}
          <a
            href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
              "FreeSeak tool request",
            )}`}
            className="font-semibold text-primary hover:underline"
          >
            Request a tool
          </a>{" "}
          — requests help decide what gets built first.
        </p>
      </section>
    </div>
  );
}
