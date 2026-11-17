"use client";

import { useState } from "react";
import Link from "next/link";
import { FileUp } from "lucide-react";
import { getTool } from "@/lib/tools";
import { useFileHandoff } from "@/lib/file-handoff";

/**
 * v0.9.1 — "try one right here": the smart file router (name/type/size
 * only — never the contents) plus three real tools running live on the
 * page. Every suggestion is looked up in the catalogue, so a pill can
 * never link to a tool that does not exist.
 *
 * v0.9.3 — the router became a real handoff: the dropped file travels
 * with the pill click, so the tool page opens with it already loaded.
 */

const PDF_PICKS = [
  "merge-pdf",
  "compress-pdf",
  "edit-pdf",
  "split-pdf",
  "organize-pdf-pages",
  "extract-pdf-text",
  "pdf-to-images",
  "watermark-pdf",
  "add-page-numbers",
  "edit-pdf-metadata",
];

/* v0.9.3: the complete image list — the old three entries predated
   Enhance, Convert, Crop & Rotate and Favicon Generator, so half the
   image suite never appeared as a suggestion */
const IMAGE_PICKS = [
  "compress-image",
  "resize-image",
  "enhance-image",
  "convert-image",
  "crop-image",
  "images-to-pdf",
  "favicon-generator",
];

/* a heavy PDF most likely wants compressing first */
function pdfPicks(size: number): string[] {
  return size > 8 * 1024 * 1024
    ? ["compress-pdf", ...PDF_PICKS.filter((id) => id !== "compress-pdf")]
    : PDF_PICKS;
}

function human(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(2)} MB`;
}

interface Dropped {
  name: string;
  size: number;
  kind: "pdf" | "image" | "other";
  file: File;
}

function LiveTag() {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.1em] text-mint-deep dark:text-mint">
      <span className="size-1.5 animate-pulse rounded-full bg-mint" aria-hidden="true" />
      live
    </span>
  );
}

function TileHeading({ children, href }: { children: string; href?: string }) {
  return (
    <h3 className="flex items-center justify-between gap-2 font-mono text-[11px] font-bold uppercase tracking-[0.13em] text-muted-foreground">
      {children}
      <span className="flex items-center gap-2">
        <LiveTag />
        {href && (
          <a
            href={href}
            className="normal-case tracking-normal text-primary hover:underline"
          >
            open the full tool →
          </a>
        )}
      </span>
    </h3>
  );
}

/* ------------------------------------------------------------------ */
/* the smart router                                                    */
/* ------------------------------------------------------------------ */

function FileRouter() {
  const [file, setFile] = useState<Dropped | null>(null);
  const [over, setOver] = useState(false);
  const handOff = useFileHandoff((s) => s.handOff);

  const handle = (f: File | null | undefined) => {
    if (!f) return;
    const isPdf =
      f.type === "application/pdf" || /\.pdf$/i.test(f.name);
    const isImg =
      f.type.startsWith("image/") ||
      /\.(png|jpe?g|webp|gif|bmp|avif)$/i.test(f.name);
    setFile({
      name: f.name,
      size: f.size,
      kind: isPdf ? "pdf" : isImg ? "image" : "other",
      file: f,
    });
  };

  const picks = (file?.kind === "pdf" ? pdfPicks(file.size) : IMAGE_PICKS)
    .map((id) => getTool(id))
    .filter((t): t is NonNullable<typeof t> => !!t);

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 sm:p-6 lg:col-span-3">
      <TileHeading>Which tool do I need?</TileHeading>

      {file === null ? (
        <label
          className={`grid flex-1 cursor-pointer place-items-center rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors sm:py-10 ${
            over
              ? "border-primary bg-secondary/70"
              : "border-primary/40 bg-secondary hover:border-primary"
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            handle(e.dataTransfer.files[0]);
          }}
        >
          <FileUp
            className="mx-auto mb-3 size-9 text-primary"
            aria-hidden="true"
          />
          <span className="block text-[18px] font-bold tracking-tight text-navy dark:text-[#CFE0FB]">
            Drop any PDF or image here
          </span>
          <span className="mt-1.5 block text-[13px] text-muted-foreground">
            we read its name, type and size — locally — and point you to the
            right tool, then carry your file along
          </span>
          <input
            type="file"
            accept="application/pdf,image/*"
            className="sr-only"
            onChange={(e) => handle(e.target.files?.[0])}
          />
        </label>
      ) : (
        <div className="flex flex-1 flex-col gap-3.5">
          <p className="font-mono text-[12.5px] break-all text-muted-foreground">
            {file.name} · {human(file.size)}
          </p>
          {picks.length > 0 ? (
            <>
              <p className="text-[19px] font-bold tracking-tight text-navy dark:text-[#CFE0FB]">
                Here’s what you can do with this{" "}
                {file.kind === "pdf" ? "PDF" : "image"}:
              </p>
              <div className="flex flex-wrap gap-2.5">
                {picks.map((t, i) => (
                  <Link
                    key={t.id}
                    href={`/tools/${t.id}`}
                    onClick={() => handOff(file.file, t.id)}
                    className={`rounded-full px-4 py-2.5 text-[13.5px] font-bold transition hover:-translate-y-px ${
                      i === 0
                        ? "bg-primary text-primary-foreground hover:bg-primary/90"
                        : "border-[1.5px] border-border bg-card text-card-foreground hover:border-primary hover:text-primary"
                    }`}
                  >
                    {t.name}
                  </Link>
                ))}
              </div>
              <p className="font-mono text-[12px] text-muted-foreground">
                click a tool and it opens with your file — no second drop
              </p>
            </>
          ) : (
            <p className="text-[19px] font-bold tracking-tight text-navy dark:text-[#CFE0FB]">
              We don’t handle that file type yet — try a PDF or an image.
            </p>
          )}
          <p className="mt-auto font-mono text-[12px] text-mint-deep dark:text-mint">
            ✓ Inspected locally — name, type and size only. 0 bytes sent.{" "}
            <button
              type="button"
              onClick={() => setFile(null)}
              className="text-muted-foreground underline underline-offset-2 hover:text-foreground"
            >
              choose another file
            </button>
          </p>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* the three live tiles                                                */
/* ------------------------------------------------------------------ */

function WordTile() {
  const [text, setText] = useState("");
  const words = (text.trim().match(/\S+/g) ?? []).length;
  const sentences = (text.match(/[^.!?]+[.!?]+/g) ?? []).length;
  const sec = Math.round((words / 200) * 60); /* 200 wpm — same number the tool and its FAQ use */

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 sm:p-6">
      <TileHeading href="/tools/word-counter">Word Counter</TileHeading>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Type or paste anything — it counts as you go, and goes nowhere."
        className="min-h-[104px] flex-1 resize-none rounded-xl border border-border bg-muted px-3.5 py-3 text-[14px] text-foreground outline-none focus:border-primary"
      />
      <div className="grid grid-cols-4 gap-2">
        {[
          { v: words, l: "words" },
          { v: text.length, l: "chars" },
          { v: sentences, l: "sent." },
          { v: sec < 60 ? `${sec}s` : `${Math.round(sec / 60)}m`, l: "to read" },
        ].map((s) => (
          <div key={s.l} className="rounded-lg bg-muted px-1.5 py-2.5 text-center">
            <b className="block text-[18px] font-extrabold tracking-tight text-navy dark:text-[#CFE0FB]">
              {s.v}
            </b>
            <small className="text-[10.5px] text-muted-foreground">{s.l}</small>
          </div>
        ))}
      </div>
    </div>
  );
}

function fmt(v: number): string {
  return isFinite(v) ? String(+v.toFixed(2)) : "—";
}

function PercentTile() {
  const [a, setA] = useState("15");
  const [b, setB] = useState("240");
  const [c, setC] = useState("30");
  const [d, setD] = useState("120");

  const inputCls =
    "w-[70px] rounded-lg border border-border bg-muted px-2.5 py-2 text-[14px] text-foreground outline-none focus:border-primary";
  const big = fmt((Number(a) / 100) * Number(b));

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 sm:p-6">
      <TileHeading href="/tools/percentage-calculator">Percentage</TileHeading>
      <div className="flex flex-wrap items-center gap-2 text-[14px]">
        <span>What is</span>
        <input
          value={a}
          onChange={(e) => setA(e.target.value)}
          type="number"
          aria-label="percent"
          className={inputCls}
        />
        <span>% of</span>
        <input
          value={b}
          onChange={(e) => setB(e.target.value)}
          type="number"
          aria-label="of"
          className={inputCls}
        />
      </div>
      <p className="font-display text-[clamp(28px,3vw,36px)] font-extrabold leading-none tracking-[-0.03em] text-navy dark:text-[#CFE0FB]">
        {big}
      </p>
      <div className="flex flex-wrap items-center gap-2 text-[14px]">
        <input
          value={c}
          onChange={(e) => setC(e.target.value)}
          type="number"
          aria-label="value"
          className={inputCls}
        />
        <span>is what % of</span>
        <input
          value={d}
          onChange={(e) => setD(e.target.value)}
          type="number"
          aria-label="total"
          className={inputCls}
        />
      </div>
      <p className="mt-auto font-mono text-[12.5px] text-mint-deep dark:text-mint">
        = {fmt((Number(c) / Number(d)) * 100)}%
      </p>
    </div>
  );
}

function AgeTile() {
  const [dob, setDob] = useState("1995-06-15");
  const b = new Date(dob);
  const now = new Date();
  const valid = dob && !isNaN(b.getTime()) && b <= now;

  let y = 0;
  let m = 0;
  let d = 0;
  if (valid) {
    y = now.getFullYear() - b.getFullYear();
    m = now.getMonth() - b.getMonth();
    d = now.getDate() - b.getDate();
    if (d < 0) {
      m--;
      d += new Date(now.getFullYear(), now.getMonth(), 0).getDate();
    }
    if (m < 0) {
      y--;
      m += 12;
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 sm:p-6">
      <TileHeading href="/tools/age-calculator">Age Calculator</TileHeading>
      <input
        value={dob}
        onChange={(e) => setDob(e.target.value)}
        type="date"
        aria-label="Date of birth"
        className="w-full rounded-lg border border-border bg-muted px-3 py-2.5 text-[14px] text-foreground outline-none focus:border-primary"
      />
      {valid ? (
        <>
          <p className="font-display text-[clamp(28px,3vw,36px)] font-extrabold leading-none tracking-[-0.03em] text-navy dark:text-[#CFE0FB]">
            {y}
            <small className="ml-2 font-sans text-[13px] font-semibold tracking-normal text-muted-foreground">
              years, {m} months, {d} days
            </small>
          </p>
          <p className="mt-auto font-mono text-[12.5px] text-mint-deep dark:text-mint">
            {Math.floor((now.getTime() - b.getTime()) / 864e5).toLocaleString(
              "en-US",
            )}{" "}
            days alive
          </p>
        </>
      ) : (
        <p className="mt-auto font-mono text-[12.5px] text-muted-foreground">
          that date is in the future
        </p>
      )}
    </div>
  );
}

export function TryTools() {
  return (
    <section className="scroll-mt-20 px-4 py-14 sm:px-6" id="try">
      <div className="mx-auto w-full max-w-[1120px]">
        <span className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
          <span className="mr-2.5 inline-block size-[9px] rounded-[3px] bg-mint align-middle" aria-hidden="true" />
          Show, don’t tell
        </span>
        <h2 className="mt-3.5 font-display text-[clamp(30px,4.2vw,48px)] font-extrabold tracking-[-0.035em] text-navy dark:text-[#CFE0FB]">
          Try one right here.
        </h2>
        <p className="mt-3.5 max-w-[62ch] text-[15.5px] text-muted-foreground">
          These are real tools running live on this page. Drop a file,
          pick a tool and it opens with your file already loaded — or
          just type, calculate, count. Your browser does all the work.
        </p>

        <div className="mt-9 grid gap-4 lg:grid-cols-3">
          <FileRouter />
          <WordTile />
          <PercentTile />
          <AgeTile />
        </div>
      </div>
    </section>
  );
}
