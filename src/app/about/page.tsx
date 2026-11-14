import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PageSection, StaticPage } from "@/components/site/static-page";
import {
  CONTACT_EMAIL,
  OPERATOR_EXPERIENCE,
  OPERATOR_NAME,
} from "@/lib/site";

export const metadata: Metadata = {
  /* absolute: the title already carries the site + operator names */
  title: {
    absolute: "About FreeSeak — Privacy-First Online Tools by Bluefrog",
  },
  description:
    "FreeSeak is a privacy-first collection of free online tools, built and maintained by Bluefrog — a software company with 10+ years of experience. No uploads, no accounts.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <StaticPage
      title="About FreeSeak"
      intro="FreeSeak is a privacy-first collection of free online tools that finish the job in your browser — no accounts, no uploads, no paywalls."
    >
      <PageSection heading="Who builds FreeSeak">
        <p>
          FreeSeak is built and maintained by {OPERATOR_NAME}, a software
          company with {OPERATOR_EXPERIENCE} building reliable software. The
          same engineering care that goes into Bluefrog&apos;s client work
          goes into every tool here: fast pages, honest behaviour, no dark
          patterns — and no tool ships until it genuinely works.
        </p>
      </PageSection>

      <PageSection heading="Why we built this">
        <p>
          Most free-tool websites make you pay in some other way: your files
          get uploaded to a server you know nothing about, a watermark lands
          on your work, or a paywall appears after the second use. FreeSeak
          takes the opposite bet: every tool runs entirely on your device,
          inside your browser. Your files and text are never transmitted,
          stored or seen by anyone — privacy by architecture, not by promise.
        </p>
        <p>
          That architecture also keeps the site free. Browser-side tools cost
          almost nothing to serve, so there is no need for accounts, limits or
          surprise charges. Seek &amp; Done.
        </p>
      </PageSection>

      <PageSection heading="How it works">
        <p>
          When you use a FreeSeak tool, the work happens locally: a QR code is
          drawn by your browser, text is counted as you type, calculations run
          on your machine, images are compressed and resized on the spot. The
          only thing that travels over the internet is the page itself. The
          one thing stored is your &quot;recent tools&quot; row, which lives
          in your own browser storage and never leaves it.
        </p>
      </PageSection>

      <PageSection heading="What's live today">
        <p>
          Six tools are live and working: the QR Code Generator, Word Counter,
          Percentage Calculator, Age Calculator, Image Compressor and Image
          Resizer. Missing a tool you need?{" "}
          <a
            href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
              "FreeSeak tool request",
            )}`}
            className="font-semibold text-primary hover:underline"
          >
            Request it
          </a>{" "}
          — requests help decide what gets built.
        </p>
      </PageSection>

      <PageSection heading="Contact">
        <p>
          Questions, feedback or a tool request:{" "}
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="font-semibold text-primary hover:underline"
          >
            {CONTACT_EMAIL}
          </a>
        </p>
      </PageSection>

      {/* v0.4: clear CTA back to the tools */}
      <div className="rounded-2xl border border-mint/40 bg-mint/5 p-5 text-center sm:p-6">
        <p className="font-display text-[15px] font-bold text-foreground">
          Ready when you are
        </p>
        <p className="mt-1.5 text-[13.5px] text-muted-foreground">
          Six tools, zero uploads, nothing to install.
        </p>
        <Link
          href="/tools"
          className="mt-3.5 inline-flex items-center gap-1.5 rounded-xl bg-navy px-5 py-2.5 text-[13.5px] font-bold text-white transition hover:opacity-90 dark:bg-[#22477F]"
        >
          Browse all tools
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </div>
    </StaticPage>
  );
}
