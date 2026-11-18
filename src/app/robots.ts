import type { MetadataRoute } from "next";
import { IS_PREVIEW, SITE_URL } from "@/lib/site";

/**
 * v1.0.3 — mode-aware robots.txt, generated from the SITE_URL single source
 * (Rule 3). Replaces the old static public/robots.txt, which could not vary
 * between the preview and production modes and was already advertising a
 * sitemap on a domain that does not resolve yet.
 *
 * preview (default): allow crawling — blocking would hide the noindex
 *   signals from Google — but withhold the sitemap line, so search engines
 *   never see a map of URLs on a domain that does not exist.
 * production: full robots.txt with the sitemap reference.
 *
 * Staging is ALSO protected by X-Robots-Tag headers (scripts/seo-mode.mjs +
 * src/worker.ts) and the layout noindex meta, so crawl-blocking is never
 * the mechanism that keeps the site un-indexed.
 */
export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  const rules = { userAgent: "*", allow: "/" };
  return IS_PREVIEW ? { rules } : { rules, sitemap: `${SITE_URL}/sitemap.xml` };
}
