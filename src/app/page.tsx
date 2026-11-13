import { HomePage } from "@/components/site/home-page";
import { SITE_NAME, SITE_URL } from "@/lib/site";

/* v0.3: site-wide structured data — WebSite + Organization in one graph */
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
      name: SITE_NAME,
      url: SITE_URL,
      logo: `${SITE_URL}/logo-mark.svg`,
      slogan: "Seek & Done",
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
