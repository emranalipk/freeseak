import type { Metadata } from "next";
import { PageSection, StaticPage } from "@/components/site/static-page";
import { CONTACT_EMAIL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Disclaimer",
  description:
    "FreeSeak tools are provided as-is for general use. Read what they are — and are not — intended for.",
  alternates: { canonical: "/disclaimer" },
};

export default function DisclaimerPage() {
  return (
    <StaticPage
      title="Disclaimer"
      updated="13 November 2026"
      intro="FreeSeak tools are built to be accurate and dependable, but a few honest boundaries apply."
    >
      <PageSection heading="General information only">
        <p>
          The tools on freeseak.com are provided for general informational and
          practical use. While every tool is built and tested with care,
          results should be independently verified before being relied upon
          for legal, financial, medical, academic or other official purposes.
        </p>
      </PageSection>

      <PageSection heading="Not professional advice">
        <p>
          Nothing on FreeSeak constitutes professional advice. In particular:
          the Percentage Calculator results are mathematics, not financial
          advice; the Age Calculator output is a calendar computation, not a
          legal determination; and the upcoming Invoice Generator produces a
          document, not legal or tax advice. For decisions with consequences,
          consult a qualified professional.
        </p>
      </PageSection>

      <PageSection heading="Accuracy and availability">
        <p>
          Tools may contain errors or omissions, and the website may be
          unavailable at times. FreeSeak is not responsible for losses
          resulting from tool output, site downtime or data that was never
          uploaded in the first place (your work lives only on your device —
          keep your own copies of anything important).
        </p>
      </PageSection>

      <PageSection heading="External links">
        <p>
          Where the site links to third-party resources (for example, ad
          opt-out pages), those sites have their own policies and practices.
          FreeSeak is not responsible for their content.
        </p>
      </PageSection>

      <PageSection heading="Contact">
        <p>
          Questions about this disclaimer:{" "}
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
