import type { MetadataRoute } from "next";
import { READY_TOOLS } from "@/lib/tools";
import { SITE_URL } from "@/lib/site";

/**
 * v0.2 — the sitemap Google reads to discover every FreeSeak page.
 * Generated from the tool catalogue at build time, so a new tool page
 * appears in the sitemap automatically the moment it is marked ready.
 */
export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: SITE_URL,
      changeFrequency: "weekly",
      priority: 1,
    },
    ...READY_TOOLS.map((t) => ({
      url: `${SITE_URL}/tools/${t.id}`,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
  ];
}
