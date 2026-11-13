"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, Search } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { searchTools } from "@/lib/search";
import { CATEGORY_LABEL, READY_TOOLS, TOOLS, type ToolDef } from "@/lib/tools";
import { Button } from "@/components/ui/button";

const QUICK = ["Compress PDF", "QR Code", "Word Counter", "Percentage", "Age"];

const TRUST = ["100% free", "No account", "Files never uploaded"];

export function Hero() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  const { results, close } = searchTools(query.trim());

  /* "/" anywhere focuses the search */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (
        e.key === "/" &&
        tag !== "INPUT" &&
        tag !== "TEXTAREA" &&
        tag !== "SELECT"
      ) {
        e.preventDefault();
        inputRef.current?.focus();
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* close on outside click */
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, []);

  const choose = (tool: ToolDef) => {
    setOpen(false);
    setQuery("");
    if (tool.ready) {
      router.push(`/tools/${tool.id}`);
    } else {
      toast(`${tool.name} is in the build queue`, {
        description: "It ships with the next development batch.",
      });
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      choose(results[Math.max(activeIdx, 0)]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <section className="px-4 pb-10 pt-14 sm:px-6 sm:pt-16">
      <div className="mx-auto max-w-[760px] text-center">
        <p className="inline-flex items-center gap-2.5 text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
          Free online tools
          <i className="h-1 w-1 rounded-full bg-mint" aria-hidden="true" />
          No sign-up
          <i className="h-1 w-1 rounded-full bg-mint" aria-hidden="true" />
          Nothing uploaded
        </p>

        <h1 className="mt-4 font-display text-[clamp(30px,5vw,46px)] font-extrabold leading-[1.12] tracking-tight text-navy dark:text-[#CFE0FB]">
          What do you need to do today?
        </h1>

        <p className="mx-auto mt-3 max-w-[520px] text-[15.5px] text-muted-foreground">
          Smart, free tools that finish the job in your browser — your files
          never leave your device.
        </p>

        {/* search */}
        <div ref={boxRef} className="relative mx-auto mt-7 max-w-[620px]">
          <div className="flex items-center gap-2 rounded-[15px] border-[1.5px] border-border bg-card py-1.5 pl-4 pr-1.5 shadow-sm transition focus-within:border-primary focus-within:shadow-[0_0_0_4px_rgba(57,121,232,0.13)] dark:focus-within:shadow-[0_0_0_4px_rgba(91,154,245,0.16)]">
            <Search
              className="size-[19px] shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setOpen(true);
                setActiveIdx(-1);
              }}
              onFocus={() => query.trim() && setOpen(true)}
              onKeyDown={onKeyDown}
              type="text"
              role="combobox"
              aria-expanded={open}
              aria-controls="hero-suggestions"
              aria-label="Search FreeSeak tools"
              placeholder='Try "compress a PDF"…'
              autoComplete="off"
              spellCheck={false}
              className="min-w-0 flex-1 bg-transparent py-2.5 text-[15px] font-medium text-foreground outline-none placeholder:text-muted-foreground/70"
            />
            <kbd className="hidden shrink-0 rounded-md border border-border border-b-2 bg-card px-2 py-0.5 text-[11px] font-semibold text-muted-foreground sm:block">
              /
            </kbd>
            <Button
              type="button"
              onClick={() =>
                results.length > 0
                  ? choose(results[0])
                  : query.trim() && setOpen(true)
              }
              className="shrink-0 rounded-xl px-6 py-2.5 font-display"
            >
              Seek
              <ArrowRight className="size-4" aria-hidden="true" />
            </Button>
          </div>

          {/* suggestions */}
          {open && query.trim() && (
            <div
              id="hero-suggestions"
              role="listbox"
              className="absolute inset-x-0 top-[calc(100%+10px)] z-30 overflow-hidden rounded-2xl border border-border bg-card text-left shadow-lg"
            >
              {results.length === 0 ? (
                <div className="px-4 py-5 text-center">
                  <p className="text-[13.5px] font-bold text-foreground">
                    No tool for “{query.trim()}” yet
                  </p>
                  <p className="mt-0.5 text-[12.5px] text-muted-foreground">
                    It might be on the roadmap — requests decide what gets
                    built next.
                  </p>
                </div>
              ) : (
                <>
                  {close && (
                    <p className="border-b border-border/60 px-4 py-2 text-[12px] text-muted-foreground">
                      No exact match — closest tools:
                    </p>
                  )}
                  <ul className="max-h-[330px] overflow-y-auto thin-scroll">
                    {results.map((t, i) => (
                      <li key={t.id}>
                        <button
                          type="button"
                          role="option"
                          aria-selected={i === activeIdx}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => choose(t)}
                          onMouseEnter={() => setActiveIdx(i)}
                          className={`flex w-full items-center gap-3 border-b border-border/50 px-4 py-3 text-left last:border-0 ${
                            i === activeIdx ? "bg-secondary" : ""
                          }`}
                        >
                          <span className="size-2 shrink-0 rounded-[3px] bg-primary" />
                          <span className="flex-1 text-[14px] font-semibold text-foreground">
                            {t.name}
                          </span>
                          <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
                            {CATEGORY_LABEL[t.category]}
                          </span>
                          {t.ready ? (
                            <Check
                              className="size-3.5 shrink-0 text-mint"
                              aria-hidden="true"
                            />
                          ) : (
                            <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-secondary-foreground">
                              Soon
                            </span>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              <div className="border-t border-border bg-muted/40 px-4 py-2.5 text-[12px] text-muted-foreground">
                Can’t find it?{" "}
                <button
                  type="button"
                  className="font-semibold text-primary hover:underline"
                  onClick={() => {
                    setOpen(false);
                    toast("Noted — requests shape the roadmap", {
                      description:
                        "The request-a-tool form ships with the full launch.",
                    });
                  }}
                >
                  Request a tool
                </button>
              </div>
            </div>
          )}
        </div>

        {/* quick chips */}
        <div className="mt-4.5 flex flex-wrap justify-center gap-2">
          {QUICK.map((label) => {
            const tool = TOOLS.find(
              (t) => t.name === label || t.name.startsWith(label),
            );
            if (!tool) return null;
            return (
              <button
                key={tool.id}
                type="button"
                onClick={() => choose(tool)}
                className="rounded-full border border-border bg-card px-4 py-2 text-[13px] font-semibold text-muted-foreground transition hover:-translate-y-px hover:border-primary hover:text-primary"
              >
                {tool.name}
              </button>
            );
          })}
        </div>

        {/* trust line */}
        <div className="mt-6.5 flex flex-wrap justify-center gap-x-6 gap-y-2">
          {TRUST.map((t) => (
            <span
              key={t}
              className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-muted-foreground"
            >
              <Check className="size-[15px] text-mint" aria-hidden="true" />
              {t}
            </span>
          ))}
        </div>

        {/* ready count is honest: only working tools count */}
        <p className="mt-5 text-[12px] text-muted-foreground/80">
          {READY_TOOLS.length} tools live and working now ·{" "}
          {TOOLS.length - READY_TOOLS.length} more in the build queue
        </p>
      </div>
    </section>
  );
}
