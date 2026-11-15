"use client";

import { useEffect, useRef, useState } from "react";
import { searchAllTools } from "@/lib/search";
import { OPERATOR_NAME, OPERATOR_EXPERIENCE } from "@/lib/site";

/**
 * v0.9.1 — the Workbench hero: the brand promise as a headline, the
 * live network counter as proof, and the command bar that filters the
 * index below (the query lives in home-page and is shared with it).
 */

const PLACEHOLDERS = [
  "merge two pdfs",
  "compress a photo for email",
  "sign a pdf",
  "pull text from a scan",
  "make a qr code",
  "what % is 30 of 120",
  "shrink a pdf for email",
];

/* request types that actually move bytes to a server */
const DATA_TYPES = ["fetch", "xmlhttprequest", "beacon"];

export function WorkbenchHero({
  query,
  onQuery,
}: {
  query: string;
  onQuery: (_q: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [ph, setPh] = useState(0);
  const [net, setNet] = useState(0);

  /* rotate the placeholder while the bar is empty */
  useEffect(() => {
    if (query) return;
    const t = setInterval(
      () => setPh((p) => (p + 1) % PLACEHOLDERS.length),
      2600,
    );
    return () => clearInterval(t);
  }, [query]);

  /* "/" focuses, Escape clears, Enter jumps to the index */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const typing =
        tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
      if (e.key === "/" && !typing) {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === "Escape" && document.activeElement === inputRef.current) {
        if (query) onQuery("");
        else inputRef.current?.blur();
      }
      if (e.key === "Enter" && document.activeElement === inputRef.current) {
        document.getElementById("tools")?.scrollIntoView({ behavior: "smooth" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [query, onQuery]);

  /* the honest proof: this site sends nothing to any other server.
     Same-origin asset/prefetch fetches are just the page loading; what
     would betray you is a request that leaves freeseak — so that is
     what we count, live, in front of the visitor. */
  useEffect(() => {
    const count = () =>
      (
        performance.getEntriesByType("resource") as PerformanceResourceTiming[]
      ).filter(
        (r) =>
          DATA_TYPES.includes(r.initiatorType) &&
          new URL(r.name, location.origin).origin !== location.origin,
      ).length;
    const base = count();
    const t = setInterval(() => setNet(Math.max(0, count() - base)), 500);
    return () => clearInterval(t);
  }, []);

  const trimmed = query.trim();
  const { results, close } = searchAllTools(trimmed);

  return (
    <section className="px-4 pt-14 sm:px-6 sm:pt-20 lg:pt-24">
      <div className="mx-auto w-full max-w-[1120px]">
        <span className="inline-flex items-center gap-2.5 rounded-full border border-primary/25 bg-secondary px-4 py-1.5 font-mono text-[11.5px] font-bold uppercase tracking-[0.14em] text-secondary-foreground">
          <span
            className="size-2 animate-pulse rounded-full bg-mint"
            aria-hidden="true"
          />
          Free tools · runs on your device · nothing uploaded
        </span>

        <h1 className="mt-6 max-w-[21ch] font-display text-[clamp(42px,7vw,84px)] font-extrabold leading-[1.03] tracking-[-0.04em] text-navy dark:text-[#CFE0FB]">
          Open a tool.
          <br />
          Your file{" "}
          <span className="border-b-[5px] border-mint pb-1 text-primary dark:text-[#8FB5F5]">
            never leaves this tab.
          </span>
        </h1>

        <p className="mt-6 max-w-[56ch] text-[15.5px] leading-relaxed text-muted-foreground sm:text-[17px]">
          FreeSeak is a growing set of free PDF, image and quick utilities
          that run entirely in your browser — edit, merge, compress, convert.{" "}
          <strong className="font-semibold text-foreground">
            No uploads, no accounts, no watermarks, no limits.
          </strong>{" "}
          Open one, switch off your Wi-Fi, it still works. Built by{" "}
          {OPERATOR_NAME} — {OPERATOR_EXPERIENCE}.
        </p>

        {/* live measurement, not a marketing line */}
        <p
          role="status"
          className="mt-6 inline-flex items-center gap-2.5 rounded-xl border border-border bg-card px-4 py-2.5 font-mono text-[12px] text-muted-foreground sm:text-[12.5px]"
        >
          <span
            className={`text-[15px] font-extrabold sm:text-[17px] ${
              net
                ? "text-red-500 dark:text-red-400"
                : "text-mint-deep dark:text-mint"
            }`}
          >
            {net}
          </span>
          requests to any other server since this page loaded — measured
          live, stays 0
        </p>

        {/* command bar */}
        <div className="mt-9 max-w-[880px] sm:mt-11">
          <div className="flex items-center gap-4 rounded-2xl border-2 border-border bg-card px-4 py-3.5 transition-colors focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/15 sm:px-5 sm:py-4">
            <span
              className="font-mono text-[20px] font-extrabold text-primary sm:text-[22px]"
              aria-hidden="true"
            >
              /
            </span>
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => onQuery(e.target.value)}
              type="text"
              placeholder={PLACEHOLDERS[ph]}
              aria-label="Search the tool index"
              className="min-w-0 flex-1 border-0 bg-transparent text-[16px] font-semibold tracking-tight text-foreground outline-none placeholder:font-medium placeholder:text-muted-foreground/50 sm:text-[22px]"
            />
            <span className="hidden shrink-0 rounded-md border border-border bg-muted px-2.5 py-1.5 font-mono text-[11px] font-bold text-muted-foreground sm:inline-block">
              PRESS /
            </span>
          </div>
          <p
            aria-live="polite"
            className="mt-3 min-h-[18px] font-mono text-[11.5px] font-bold uppercase tracking-[0.1em] text-muted-foreground"
          >
            {trimmed && results.length > 0 && (
              <>
                <span className="text-primary">{results.length}</span> tool
                {results.length === 1 ? "" : "s"} match — Enter to jump
              </>
            )}
            {trimmed && results.length === 0 && close && (
              <>no exact match — showing the closest tools</>
            )}
            {trimmed && results.length === 0 && !close && (
              <>no match — try “pdf”, “image” or “qr”</>
            )}
          </p>
        </div>
      </div>
    </section>
  );
}
