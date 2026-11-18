/**
 * v1.0.3 — real lastmod dates for the sitemap, one entry per route.
 *
 * Sourced from git history (git log -1 --format=%cs -- <file>) when this
 * file was generated. The rule (SEO brief, Task 3): never emit build time
 * as lastmod — Google ignores sitemaps where every URL changes date on
 * every build, and it is dishonest about which pages actually moved.
 *
 * WHEN TO UPDATE: when a page's content meaningfully changes, update its
 * date here in the same commit. Adding a route = adding a line.
 */
export const ROUTE_DATES: Record<string, string> = {
  "": "2026-11-18", // homepage
  tools: "2026-11-18",
  "punjab-registry-costs": "2026-11-18", // v1.0.3 new landing page
  "guides/compress-images-without-uploading": "2026-11-18",
  about: "2026-11-18",
  "privacy-policy": "2026-11-18",
  terms: "2026-11-18",
  disclaimer: "2026-11-18",
};
