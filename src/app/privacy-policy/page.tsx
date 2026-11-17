import type { Metadata } from "next";
import { PageSection, StaticPage } from "@/components/site/static-page";
import { CONTACT_EMAIL, SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  /* absolute: the title already carries the site + operator names */
  title: { absolute: "Privacy Policy — FreeSeak by Bluefrog" },
  description:
    "FreeSeak privacy policy: every tool runs in your browser. No uploads, no accounts, no tracking cookies. Read exactly what is and is not collected.",
  alternates: { canonical: "/privacy-policy" },
};

export default function PrivacyPolicyPage() {
  return (
    <StaticPage
      title="Privacy Policy"
      updated="14 November 2026"
      intro="The short version: FreeSeak tools run entirely in your browser. Your files and text are never uploaded, and we do not track you across the web."
    >
      <PageSection heading="1. What FreeSeak does not collect">
        <p>
          FreeSeak (freeseak.com) is operated by Bluefrog. The site has no
          accounts, no sign-up forms and no file servers. When you use a tool
          — generating a QR code, counting words, calculating a percentage or
          an age, compressing or resizing an image — the work happens on your
          device, inside your browser. The text you type and the files you
          work on are{" "}
          <strong>never transmitted to us or to any third party</strong>,
          never stored on our servers, and are gone the moment you close the
          tab.
        </p>
      </PageSection>

      <PageSection heading="2. Information stored on your device">
        <p>
          Three small things can be kept in your browser&apos;s local storage —
          all of them stay on your device, never leave it, and can be removed
          at any time by clearing your browser storage for freeseak.com:
        </p>
        <ul className="ml-4 list-disc space-y-1.5">
          <li>
            The list of tools you used recently, so the &quot;pick up where you
            left off&quot; row can show them.
          </li>
          <li>
            The Punjab Registry Estimator&apos;s saved details: your
            My&nbsp;Profile fields (name, firm, phone, address — only if you
            fill them in) and an estimate history that can include the names
            and shares of buyers and sellers you typed. These exist only on
            your device because the estimator runs there; nothing is synced or
            backed up anywhere.
          </li>
          <li>
            The Enhance Image tool&apos;s slider settings, so your preferred
            look is remembered next time.
          </li>
        </ul>
        <p>
          No cookies are set for any of these purposes.
        </p>
      </PageSection>

      <PageSection heading="3. Website analytics">
        <p>
          We may use Cloudflare Web Analytics to understand, in aggregate, how
          the site is used (for example, which pages are visited). Cloudflare
          Web Analytics does not use cookies and does not track, identify or
          profile individual visitors. If we ever change or add a measurement
          system, this policy will be updated first.
        </p>
      </PageSection>

      <PageSection heading="4. Advertising">
        <p>
          FreeSeak may display advertising in the future (for example, via
          Google AdSense) to cover hosting costs while keeping every tool
          free. If and when advertising is enabled:
        </p>
        <ul className="ml-4 list-disc space-y-1.5">
          <li>
            Third-party vendors, including Google, use cookies to serve ads
            based on prior visits to this and other websites.
          </li>
          <li>
            Google&apos;s use of advertising cookies (such as the DoubleClick
            DART cookie) enables it and its partners to serve ads based on
            your visits to this site and/or other sites on the internet.
          </li>
          <li>
            You can opt out of personalised advertising at{" "}
            <a
              href="https://www.google.com/settings/ads"
              className="font-semibold text-primary hover:underline"
            >
              Google Ads Settings
            </a>{" "}
            or via{" "}
            <a
              href="https://www.aboutads.info/choices/"
              className="font-semibold text-primary hover:underline"
            >
              aboutads.info/choices
            </a>
            .
          </li>
        </ul>
        <p>
          Ads will never appear inside a tool, and tool results will never be
          gated behind ads.
        </p>
      </PageSection>

      <PageSection heading="5. Hosting and server logs">
        <p>
          The website itself is served by Cloudflare. As with any web host,
          Cloudflare processes standard technical request data (such as IP
          address and browser type) to deliver pages and to protect against
          abuse. This data is governed by Cloudflare&apos;s own privacy
          policy. FreeSeak does not build user profiles from it.
        </p>
      </PageSection>

      <PageSection heading="6. Children&apos;s privacy">
        <p>
          FreeSeak is a general-audience utility website and does not knowingly
          collect personal information from children. Because we do not
          collect personal information from anyone, no such information is
          stored or shared.
        </p>
      </PageSection>

      <PageSection heading="7. Changes to this policy">
        <p>
          If this policy changes, the new version will be published on this
          page with an updated date. Material changes (for example, enabling
          advertising) will be described in plain language, as above.
        </p>
      </PageSection>

      <PageSection heading="8. Contact">
        <p>
          Questions about this policy:{" "}
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="font-semibold text-primary hover:underline"
          >
            {CONTACT_EMAIL}
          </a>
        </p>
        <p className="text-[12px]">
          {SITE_NAME} · freeseak.com
        </p>
      </PageSection>
    </StaticPage>
  );
}
