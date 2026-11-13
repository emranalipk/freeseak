import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTool, READY_TOOLS } from "@/lib/tools";
import { ToolPage } from "@/components/tools/tool-page";

/**
 * v0.2 — every working tool gets its own page at /tools/<id>.
 * Static export prerenders all of them, so each tool is a real,
 * shareable, Google-indexable URL (instead of the old popup).
 */
export function generateStaticParams() {
  return READY_TOOLS.map((t) => ({ id: t.id }));
}

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const tool = getTool(id);
  if (!tool) return {};
  /* v0.3 SEO: title leads with the tool name (the primary keyword),
     description comes from the catalogue, every tool shares its own
     social preview image. */
  return {
    title: `${tool.name} — Free, No Sign-Up`,
    description: tool.short,
    alternates: { canonical: `/tools/${tool.id}` },
    openGraph: {
      title: `${tool.name} — FreeSeak`,
      description: tool.short,
      url: `/tools/${tool.id}`,
      type: "website",
      images: [
        {
          url: `/og/${tool.id}.png`,
          width: 1200,
          height: 630,
          alt: `${tool.name} — free on FreeSeak`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${tool.name} — FreeSeak`,
      description: tool.short,
      images: [`/og/${tool.id}.png`],
    },
  };
}

export default async function ToolPageRoute({ params }: Params) {
  const { id } = await params;
  const tool = getTool(id);
  /* tools not marked ready simply don't exist as pages yet */
  if (!tool || !tool.ready) notFound();
  return <ToolPage tool={tool} />;
}
