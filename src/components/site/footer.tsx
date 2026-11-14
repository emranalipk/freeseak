"use client";

import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { CATEGORY_LABEL, TOOLS, type CategoryId } from "@/lib/tools";
import { OPERATOR_EXPERIENCE, OPERATOR_NAME } from "@/lib/site";
import { SITE_VERSION } from "@/lib/version";
import { LogoSlot, Tagline, Wordmark } from "./logo";

const GROUPS: CategoryId[] = ["image", "calc", "prod"];

/* v0.3: legal pages are real pages — required for ad-network approval
   and plain good practice for a public site.
   v0.4: + Guides link; the PDF column is gone with the PDF tools (Rule 1). */
const PAGES = [
  { href: "/about", label: "About" },
  { href: "/guides", label: "Guides" },
  { href: "/privacy-policy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms" },
  { href: "/disclaimer", label: "Disclaimer" },
];

export function SiteFooter() {
  return (
    <footer className="mt-auto bg-[#173B70] text-white dark:bg-[#0A1220]">
      <div className="mx-auto grid w-full max-w-[1120px] grid-cols-1 gap-9 px-4 py-11 sm:grid-cols-2 sm:px-6 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <div className="mb-3.5">
            <LogoSlot size={40} />
          </div>
          <Wordmark className="text-white" />
          <div className="mt-1.5">
            <Tagline className="text-white/60" />
          </div>
          <span className="mt-4 inline-flex items-center gap-2 rounded-full border border-mint/45 px-3 py-1.5 text-[11.5px] font-semibold text-mint">
            <ShieldCheck className="size-3.5" aria-hidden="true" />
            Processed on your device
          </span>
          {/* deployed version — matches package.json (Rule 6) */}
          <p className="mt-2.5 text-[11px] font-semibold tracking-wide text-white/40">
            v{SITE_VERSION}
          </p>
        </div>

        {GROUPS.map((cat) => (
          <nav key={cat} aria-label={CATEGORY_LABEL[cat]}>
            <h4 className="mb-3.5 font-display text-[11px] font-bold uppercase tracking-[0.16em] text-white/55">
              {CATEGORY_LABEL[cat]}
            </h4>
            <ul className="space-y-0.5">
              {TOOLS.filter((t) => t.category === cat).map((t) => (
                <li key={t.id}>
                  <Link
                    href={`/tools/${t.id}`}
                    className="rounded px-0 py-1 text-[13px] text-white/80 transition-colors hover:text-white"
                  >
                    {t.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex w-full max-w-[1120px] flex-wrap items-center gap-x-3 gap-y-1 px-4 py-4 text-[12.5px] text-white/60 sm:px-6">
          {/* v0.4: operator credit — Bluefrog, not just the product */}
          <span>
            © 2026 {OPERATOR_NAME} — {OPERATOR_EXPERIENCE}
          </span>
          <span className="opacity-40">·</span>
          <span>Seek &amp; Done</span>
          <span className="opacity-40">·</span>
          <span>Every tool free, every file yours</span>
          <span className="ml-auto hidden gap-3 sm:flex">
            {PAGES.map((p) => (
              <Link
                key={p.href}
                href={p.href}
                className="rounded px-0 transition-colors hover:text-white"
              >
                {p.label}
              </Link>
            ))}
          </span>
        </div>
      </div>
    </footer>
  );
}
