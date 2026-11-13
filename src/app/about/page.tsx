import type { Metadata } from "next";
import { PageSection, StaticPage } from "@/components/site/static-page";
import { CONTACT_EMAIL } from "@/lib/site";

export const metadata: Metadata = {
  title: "About FreeSeak — Free Tools, Zero Nonsense",
  description:
    "FreeSeak is a growing collection of free online tools that run entirely in your browser. No accounts, no uploads, no paywalls — Seek & Done.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <StaticPage
      title="About FreeSeak"
      intro="FreeSeak is a growing collection of free online tools that finish the job in your browser — no accounts, no uploads, no paywalls."
    >
      <PageSection heading="Why FreeSeak exists">
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
          on your machine. The only thing that travels over the internet is
          the page itself. The one thing stored is your &quot;recent
          tools&quot; row, which lives in your own browser storage and never
          leaves it.
        </p>
      </PageSection>

      <PageSection heading="The roadmap">
        <p>
          Four tools are live today: the QR Code Generator, Word Counter,
          Percentage Calculator and Age Calculator. Next in the build queue
          are the PDF suite (compress, merge, split, JPG↔PDF), the image tools
          (compress, resize) and a free invoice generator — every one built
          the same way: instant, private, free.
        </p>
        <p>
          Missing a tool you need?{" "}
          <a
            href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
              "FreeSeak tool request",
            )}`}
            className="font-semibold text-primary hover:underline"
          >
            Request it
          </a>{" "}
          — requests help decide what gets built first.
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
    </StaticPage>
  );
}
