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
  return {
    title: `${tool.name} — Free, No Sign-Up`,
    description: tool.short,
    alternates: { canonical: `/tools/${tool.id}` },
    openGraph: {
      title: `${tool.name} — FreeSeak`,
      description: tool.short,
      url: `/tools/${tool.id}`,
      type: "website",
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
