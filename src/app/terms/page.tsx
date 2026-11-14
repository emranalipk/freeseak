import type { Metadata } from "next";
import { PageSection, StaticPage } from "@/components/site/static-page";
import { CONTACT_EMAIL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Terms of Use",
  description:
    "The terms for using FreeSeak: tools are provided free and as-is, your inputs and outputs remain yours, and everything runs in your browser.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <StaticPage
      title="Terms of Use"
      updated="14 November 2026"
      intro="By using freeseak.com you agree to these terms. They are deliberately short: the service is simple, so the rules are too."
    >
      <PageSection heading="1. The service">
        <p>
          FreeSeak provides free online tools that run entirely in your
          browser. There are no accounts, no paid tiers and no file uploads.
          Tools and features are added and updated over time.
        </p>
      </PageSection>

      <PageSection heading="2. Your content stays yours">
        <p>
          You retain all rights to anything you create with a FreeSeak tool —
          QR codes, counted text, calculations, images and any other output.
          Because processing happens on your device, we never receive your
          content in the first place and claim no licence over it.
        </p>
      </PageSection>

      <PageSection heading="3. Acceptable use">
        <p>
          You agree not to use FreeSeak to create content that is illegal,
          infringes others&apos; rights, or is designed to deceive (for
          example, malicious QR codes). You also agree not to attempt to
          disrupt, overload or reverse the site&apos;s infrastructure.
        </p>
      </PageSection>

      <PageSection heading="4. No warranty">
        <p>
          The tools are provided &quot;as is&quot; and &quot;as
          available&quot;, without warranties of any kind. While we build them
          carefully, we do not guarantee that results are error-free or that
          the service will be uninterrupted. Always verify important output
          before relying on it.
        </p>
      </PageSection>

      <PageSection heading="5. Limitation of liability">
        <p>
          To the maximum extent permitted by law, FreeSeak is not liable for
          any indirect or consequential damages arising from use of the site
          or its tools.
        </p>
      </PageSection>

      <PageSection heading="6. Changes">
        <p>
          These terms may be updated as the service evolves. Continued use of
          the site after changes are published constitutes acceptance of the
          updated terms.
        </p>
      </PageSection>

      <PageSection heading="7. Contact">
        <p>
          Questions about these terms:{" "}
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
