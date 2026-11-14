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
