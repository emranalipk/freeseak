import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpen } from "lucide-react";
import { StaticPage } from "@/components/site/static-page";

export const metadata: Metadata = {
  title: "Guides — Free, Privacy-First Tutorials",
  description:
    "Plain-English guides from FreeSeak: compress images without uploading them, pick the right quality and format, and keep your files private — free, no sign-up.",
  alternates: { canonical: "/guides" },
};

/* v0.4: the guides section — long-tail content that links to the tools.
   Add a card here when a new guide ships. */
const GUIDES = [
  {
    href: "/guides/compress-images-without-uploading",
    title: "How to Compress Images Without Uploading Them",
    description:
      "Why upload-based compressors are a privacy risk, how in-browser compression actually works, and the fastest way to shrink a photo to exactly the size a form or inbox demands.",
    minutes: 4,
  },
];

export default function GuidesPage() {
  return (
    <StaticPage
      title="Guides"
      intro="Practical, plain-English guides for getting everyday file jobs done — privately, in your browser."
    >
      {GUIDES.map((g) => (
        <Link
          key={g.href}
          href={g.href}
          className="group flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-navy hover:shadow-md dark:hover:border-[#3E5C96] sm:p-6"
        >
          <span className="flex size-[42px] items-center justify-center rounded-xl bg-secondary">
            <BookOpen className="size-[22px] text-primary" aria-hidden="true" />
          </span>
          <span className="font-display text-[16px] font-bold text-foreground">
            {g.title}
          </span>
          <span className="text-[13.5px] leading-relaxed text-muted-foreground">
            {g.description}
          </span>
          <span className="flex items-center gap-3 text-[12.5px] font-semibold text-muted-foreground">
            {g.minutes} min read
            <span className="inline-flex translate-x-[-4px] items-center gap-1.5 text-[12px] font-bold text-primary opacity-0 transition group-hover:translate-x-0 group-hover:opacity-100">
              Read guide
              <ArrowRight className="size-3" aria-hidden="true" />
            </span>
          </span>
        </Link>
      ))}
    </StaticPage>
  );
}
