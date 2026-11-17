import type { MetadataRoute } from "next";
import { TOOLS } from "@/lib/tools";
import { SITE_URL } from "@/lib/site";

/**
 * v0.3 — the sitemap Google reads to discover every FreeSeak page.
 * Generated from the tool catalogue at build time, so a new tool page
 * appears in the sitemap the moment its entry is added. Static pages
 * (/tools, /guides, legal pages) are listed here too. v1.0.0 adds
 * build-time lastModified dates.
 */
export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    {
      url: SITE_URL,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${SITE_URL}/tools`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    ...TOOLS.map((t) => ({
      url: `${SITE_URL}/tools/${t.id}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
    ...[
      "guides",
      "guides/compress-images-without-uploading",
    ].map((p) => ({
      url: `${SITE_URL}/${p}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    ...["about", "privacy-policy", "terms", "disclaimer"].map((p) => ({
      url: `${SITE_URL}/${p}`,
      lastModified: now,
      changeFrequency: "yearly" as const,
      priority: 0.3,
    })),
  ];
}
