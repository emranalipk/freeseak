"use client";

import { useEffect, useState } from "react";
import { History } from "lucide-react";
import Link from "next/link";
import { getRecent } from "@/lib/tool-store";
import { getTool } from "@/lib/tools";
import { ToolIcon } from "./tool-icon";

/* v0.2: chips are links to the tool's own page */
export function RecentTools() {
  const [ids, setIds] = useState<string[] | null>(null);

  useEffect(() => {
    const update = () => setIds(getRecent());
    /* initial read happens in a task, so the effect body itself
       only subscribes to external updates */
    const t = setTimeout(update, 0);
    window.addEventListener("freeseak:recent", update);
    return () => {
      clearTimeout(t);
      window.removeEventListener("freeseak:recent", update);
    };
  }, []);

  if (ids === null || ids.length === 0) return null;

  const tools = ids
    .map((id) => getTool(id))
    .filter((t): t is NonNullable<typeof t> => !!t && t.ready);

  if (tools.length === 0) return null;

  return (
    <section
      aria-label="Your recent tools"
      className="px-4 pb-2 pt-1 sm:px-6"
    >
      <div className="mx-auto w-full max-w-[1120px]">
        <p className="mb-2.5 inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
          <History className="size-3.5" aria-hidden="true" />
          Pick up where you left off
        </p>
        <div className="flex flex-wrap gap-2">
          {tools.map((t) => (
            <Link
              key={t.id}
              href={`/tools/${t.id}`}
              className="inline-flex items-center gap-2 rounded-full border border-mint/40 bg-card px-3.5 py-2 text-[13px] font-semibold text-foreground transition hover:-translate-y-px hover:border-mint"
            >
              <ToolIcon icon={t.icon} className="size-4 text-mint-deep dark:text-mint" />
              {t.name}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
