import type { MetadataRoute } from "next";
import { TOOLS } from "@/lib/tools";
import { ROUTE_DATES } from "@/lib/route-dates";
import { SITE_URL } from "@/lib/site";

/**
 * v0.3 — the sitemap Google reads to discover every FreeSeak page.
 * Generated from the tool catalogue at build time, so a new tool page
 * appears in the sitemap the moment its entry is added.
 *
 * v1.0.3 — lastmod now comes from ROUTE_DATES (real content-change dates,
 * maintained per route) instead of the build clock: emitting `new Date()`
 * on every build made Google see the whole site as rewritten daily, which
 * both dilutes the signal and is not true. Tool pages share the catalogue
 * date; static pages carry their own.
 */
export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const page = (path: string, priority: number, freq: "monthly" | "weekly" | "yearly") => ({
    url: path ? `${SITE_URL}/${path}` : SITE_URL,
    lastModified: ROUTE_DATES[path] ?? ROUTE_DATES[""],
    changeFrequency: freq,
    priority,
  });

  return [
    page("", 1, "weekly"),
    page("tools", 0.9, "weekly"),
    page("punjab-registry-costs", 0.9, "monthly"),
    ...TOOLS.map((t) => page(`tools/${t.id}`, 0.8, "monthly" as const)),
    page("guides", 0.7, "monthly"),
    page("guides/compress-images-without-uploading", 0.7, "monthly"),
    ...["about", "privacy-policy", "terms", "disclaimer"].map((p) => page(p, 0.3, "yearly" as const)),
  ];
}
