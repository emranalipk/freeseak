/**
 * FreeSeak — the one place your public web address lives.
 *
 * v0.3: the site's permanent home is https://freeseak.com (the custom
 * domain on Cloudflare). The old workers.dev address and the earlier
 * "freespeak" typo are gone for good.
 *
 * RULE (see PROJECT_RULES.md): this file is the ONLY place the domain
 * is written. robots.txt must match it. Never hardcode the address
 * anywhere else.
 */
export const SITE_URL = "https://freeseak.com";

export const SITE_NAME = "FreeSeak";

/**
 * v1.0.3 — the two-mode SEO switch (see docs/LAUNCH_CHECKLIST.md).
 *
 * preview (default, fail-safe): the site is not launched — every page
 *   carries <meta robots noindex> and the edge Worker sends an
 *   X-Robots-Tag header; robots.txt has no sitemap line. This is the mode
 *   for workers.dev / localhost / any non-production host.
 * production: set the SITE_MODE=production environment variable in the
 *   Cloudflare Workers build settings on launch day, only AFTER freeseak.com
 *   is attached to the Worker. All noindex signals disappear and robots.txt
 *   gains the sitemap line. The edge Worker (src/worker.ts) stays as the
 *   safety net: any host other than freeseak.com is noindexed at the edge
 *   regardless of this build-time mode — fail-safe, never fail-open.
 */
export type SiteMode = "preview" | "production";
/* The typeof guard matters: this module is ALSO bundled into the edge
   Worker (src/worker.ts), which runs in Cloudflare workerd where `process`
   does not exist. In the Next.js build (Node) the env variable is read
   normally; in workerd the guard short-circuits to the safe default. */
export const SITE_MODE: SiteMode =
  (typeof process !== "undefined" && process.env?.SITE_MODE) === "production"
    ? "production"
    : "preview";
export const IS_PREVIEW = SITE_MODE === "preview";

/**
 * v0.4: the company behind FreeSeak — the trust line shown in the hero
 * subline, the footer copyright, tool pages and the Organization schema.
 * One place, so the wording never drifts.
 */
export const OPERATOR_NAME = "Bluefrog";
export const OPERATOR_EXPERIENCE = "10+ years of software experience";

/** shown in the footer, the About page and the request-a-tool mailto */
export const CONTACT_EMAIL = "hello@freeseak.com";

/**
 * Cloudflare Web Analytics beacon token (cookieless, privacy-friendly).
 * Paste the token from dash.cloudflare.com → Web Analytics → your site.
 * Empty string = the beacon script is not rendered at all.
 */
export const CF_ANALYTICS_TOKEN = "";

/**
 * Show the reserved homepage ad slot? Keep false until an ad network
 * (e.g. AdSense) has actually approved the site — visitors should never
 * see an empty placeholder.
 */
export const ADS_ENABLED = false;
