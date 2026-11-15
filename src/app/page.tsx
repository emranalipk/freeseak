import type { Metadata } from "next";
import { HomePage } from "@/components/site/home-page";
import { OPERATOR_NAME, SITE_NAME, SITE_URL } from "@/lib/site";

/* v0.4: the homepage targets the head keyword directly. No SearchAction
   on purpose — the site has no /search results URL, and structured data
   must never point at a page that does not exist. */
export const metadata: Metadata = {
  /* absolute: the root page shares its segment with the layout, so the
     "%s | FreeSeak" template does not apply here — carry the suffix */
  title: {
    absolute: "Free Private Online Tools — No Uploads, No Sign-Up | FreeSeak",
  },
  description:
    "Free PDF, image and quick tools that run entirely in your browser — edit, merge, split and compress, with no uploads and no account. Built by Bluefrog.",
  alternates: { canonical: "/" },
};

/* v0.3: site-wide structured data — WebSite + Organization in one graph.
   v0.4: the Organization is the operator (Bluefrog), not the site name. */
const siteJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      name: SITE_NAME,
      url: SITE_URL,
      description:
        "Free online tools that run in your browser. No sign-up, no uploads.",
    },
    {
      "@type": "Organization",
      name: OPERATOR_NAME,
      url: SITE_URL,
      logo: `${SITE_URL}/logo-mark.svg`,
      description: `${OPERATOR_NAME} is a software company with 10+ years of experience, behind ${SITE_NAME} — privacy-first online tools.`,
    },
  ],
};

export default function Page() {
  return (
    <>
      <HomePage />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(siteJsonLd) }}
      />
    </>
  );
}
