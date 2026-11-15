import Link from "next/link";
import { ArrowRight } from "lucide-react";

/**
 * v0.9.1 — the full-screen workspace showcase. The cramped 880px tool
 * column is gone (tool-page.tsx now gives canvas tools the whole
 * screen); this is the homepage telling that story with a mock of the
 * real Edit PDF layout: page rail, edge-to-edge canvas, floating tools.
 */

export function WorkspaceShowcase() {
  return (
    <section id="workspace" className="scroll-mt-20 px-4 py-14 sm:px-6">
      <div className="mx-auto w-full max-w-[1120px]">
        <span className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
          <span className="mr-2.5 inline-block size-[9px] rounded-[3px] bg-mint align-middle" aria-hidden="true" />
          New in this version
        </span>
        <h2 className="mt-3.5 font-display text-[clamp(30px,4.2vw,48px)] font-extrabold tracking-[-0.035em] text-navy dark:text-[#CFE0FB]">
          Every tool gets the whole screen.
        </h2>
        <p className="mt-3.5 max-w-[62ch] text-[15.5px] text-muted-foreground">
          Tool pages now use your full screen width — no more squeezing the
          editor into a narrow column. The canvas, the page thumbnails and
          every control get the space your screen actually has.
        </p>

        {/* a mock of Edit PDF's workspace, drawn in CSS */}
        <div
          aria-label="Edit PDF workspace preview"
          className="mt-8 overflow-hidden rounded-2xl border border-border bg-card shadow-[0_22px_60px_-18px_rgba(23,59,112,0.22)] dark:shadow-[0_22px_60px_-18px_rgba(0,0,0,0.6)]"
        >
          {/* window chrome */}
          <div className="flex h-[38px] items-center gap-1.5 border-b border-border px-4">
            <span className="size-2.5 rounded-full bg-[#E5484D]" />
            <span className="size-2.5 rounded-full bg-[#F0B03C]" />
            <span className="size-2.5 rounded-full bg-[#2FBE6B]" />
            <span className="mx-auto flex h-[22px] w-full max-w-[330px] items-center justify-center rounded-lg bg-muted font-mono text-[10.5px] tracking-[0.04em] text-muted-foreground">
              freeseak › tools › edit-pdf
            </span>
          </div>

          {/* the workspace: page rail + edge-to-edge canvas */}
          <div className="relative flex h-[300px] bg-mist dark:bg-[#0A1220] sm:h-[330px]">
            <div className="flex w-[86px] flex-col gap-2 border-r border-border bg-card p-3 sm:w-[112px]">
              <h5 className="mb-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                Pages
              </h5>
              <span className="aspect-[3/4] rounded-md border-[1.5px] border-primary bg-secondary/70" />
              <span className="aspect-[3/4] rounded-md border-[1.5px] border-border bg-muted" />
              <span className="aspect-[3/4] rounded-md border-[1.5px] border-border bg-muted" />
              <span className="hidden aspect-[3/4] rounded-md border-[1.5px] border-border bg-muted sm:block" />
            </div>

            <div className="flex min-w-0 flex-1 p-4 sm:p-[18px]">
              <div className="flex w-full max-w-[760px] flex-col gap-2.5 rounded-lg border border-border bg-card p-5 shadow-[0_10px_26px_-14px_rgba(23,59,112,0.3)] sm:p-6">
                <span className="mb-1 h-[13px] w-[44%] rounded bg-navy/85 dark:bg-[#2A4A82]" />
                <span className="h-2 w-[95%] rounded bg-border" />
                <span className="h-2 w-full rounded bg-border" />
                <span className="h-2 w-[88%] rounded bg-border" />
                <span className="h-2 w-[99%] rounded bg-border" />
                <span className="h-2 w-[64%] rounded bg-border" />
                <span className="h-2 w-[91%] rounded bg-border" />
                <span className="hidden h-2 w-[78%] rounded bg-border sm:block" />
                <span className="hidden h-2 w-[96%] rounded bg-border sm:block" />
              </div>
            </div>

            {/* floating tool dock */}
            <div className="absolute left-1/2 top-[50px] flex -translate-x-1/2 gap-1.5 rounded-xl border border-border bg-card p-1.5 shadow-[0_8px_22px_-8px_rgba(23,59,112,0.3)]">
              <span className="size-[22px] rounded-md bg-muted" />
              <span className="size-[22px] rounded-md bg-primary" />
              <span className="size-[22px] rounded-md bg-muted" />
              <span className="size-[22px] rounded-md bg-muted" />
              <span className="size-[22px] rounded-md bg-muted" />
            </div>

            <span className="absolute bottom-3.5 right-3.5 rounded-full border border-border bg-card px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-mint-deep dark:text-mint">
              edge-to-edge ✓
            </span>
          </div>
        </div>

        <p className="mt-5 max-w-[70ch] text-[14.5px] text-muted-foreground">
          Same screen, same tool, much more workspace — and it’s live
          today, not a mockup of the future.{" "}
          <Link
            href="/tools/edit-pdf"
            className="inline-flex items-center gap-1 font-bold text-primary hover:underline"
          >
            Open Edit PDF
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        </p>
      </div>
    </section>
  );
}
