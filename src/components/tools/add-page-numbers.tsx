"use client";

/**
 * Add Page Numbers — stamp "1", "1 / 12", "Page 3 of 12" or "- 3 -" onto
 * a PDF, in any corner, with a configurable start number and a skip for
 * cover pages. pdf-lib draws the text onto fresh copies (re-loaded from
 * the File every run, so repeated runs never double-stamp).
 */

import { useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ActionRow,
  LoadedPdfCard,
  PdfDropZone,
  ResultsPanel,
  useSinglePdf,
  type OutputFile,
} from "./pdf-shared";
import {
  anchorPosition,
  hexToRgb,
  loadPdf,
  loadPdfLib,
  pdfErrorMessage,
  savePdf,
  ANCHOR_OPTIONS,
  type Anchor,
} from "./pdf-utils";

type NumFormat = "plain" | "slash" | "of" | "dash";

const FORMAT_OPTIONS: { value: NumFormat; label: string; example: string }[] = [
  { value: "plain", label: "Plain number", example: "3" },
  { value: "slash", label: "Number / total", example: "3 / 12" },
  { value: "of", label: "Page X of Y", example: "Page 3 of 12" },
  { value: "dash", label: "Dashes", example: "- 3 -" },
];

function labelFor(format: NumFormat, n: number, total: number): string {
  switch (format) {
    case "plain":
      return `${n}`;
    case "slash":
      return `${n} / ${total}`;
    case "of":
      return `Page ${n} of ${total}`;
    default:
      return `- ${n} -`;
  }
}

export function AddPageNumbers() {
  const { state, load, reset } = useSinglePdf();
  const [format, setFormat] = useState<NumFormat>("slash");
  const [anchor, setAnchor] = useState<Anchor>("bottom-center");
  const [start, setStart] = useState(1);
  const [size, setSize] = useState(11);
  const [margin, setMargin] = useState(28);
  const [skipFirst, setSkipFirst] = useState(false);
  const [color, setColor] = useState("#374151");
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<OutputFile[]>([]);

  const pdf = state.status === "ready" ? state.pdf : null;

  const run = async () => {
    if (!pdf) return;
    setBusy(true);
    setResults([]);
    try {
      const { StandardFonts, rgb } = await loadPdfLib();
      const source = await loadPdf(pdf.file);
      const font = await source.doc.embedFont(StandardFonts.Helvetica);
      const rgbColor = hexToRgb(color) ?? { r: 0.2, g: 0.25, b: 0.3 };

      const numbered = skipFirst
        ? source.doc.getPages().slice(1)
        : source.doc.getPages();
      const total = numbered.length;

      numbered.forEach((page, i) => {
        const label = labelFor(format, start + i, total);
        const { width, height } = page.getSize();
        const textWidth = font.widthOfTextAtSize(label, size);
        const pos = anchorPosition(anchor, width, height, margin, textWidth, size);
        /* small optical lift: pdf-lib's y is the text baseline */
        page.drawText(label, {
          x: pos.x,
          y: pos.y + 2,
          size,
          font,
          color: rgb(rgbColor.r, rgbColor.g, rgbColor.b),
        });
      });

      const blob = await savePdf(source.doc);
      const base = pdf.file.name.replace(/\.pdf$/i, "");
      setResults([
        {
          blob,
          name: `${base}-numbered.pdf`,
          note: `${total} page${total > 1 ? "s" : ""} numbered, starting at ${start}${
            skipFirst ? " (cover page left untouched)" : ""
          }`,
        },
      ]);
      toast.success("Page numbers added", {
        description: "Processed on your device — nothing was uploaded.",
      });
    } catch (err) {
      toast.error(pdfErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {!pdf && state.status !== "loading" && (
        <PdfDropZone
          onFiles={(files) => {
            const first = files.find(
              (f) => f.type === "application/pdf" || /\.pdf$/i.test(f.name),
            );
            if (first) void load(first);
          }}
        />
      )}

      {state.status === "loading" && (
        <p className="text-center text-[13px] text-muted-foreground">
          Reading {state.name}…
        </p>
      )}

      {state.status === "error" && (
        <div className="flex flex-col gap-3 rounded-xl border border-destructive/40 bg-destructive/5 p-4">
          <p className="text-[13px] font-semibold text-destructive">
            {state.name}: {state.error}
          </p>
          <PdfDropZone onFiles={(files) => files[0] && void load(files[0])} compact />
        </div>
      )}

      {pdf && (
        <>
          <LoadedPdfCard pdf={pdf} onRemove={reset} />

          <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="apn-format">Number format</Label>
                <Select value={format} onValueChange={(v) => setFormat(v as NumFormat)}>
                  <SelectTrigger id="apn-format" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FORMAT_OPTIONS.map((f) => (
                      <SelectItem key={f.value} value={f.value}>
                        {f.label} — {f.example}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="apn-position">Position</Label>
                <Select value={anchor} onValueChange={(v) => setAnchor(v as Anchor)}>
                  <SelectTrigger id="apn-position" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ANCHOR_OPTIONS.map((a) => (
                      <SelectItem key={a.value} value={a.value}>
                        {a.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="apn-start">Start numbering at</Label>
                <Input
                  id="apn-start"
                  type="number"
                  min={0}
                  max={9999}
                  value={start}
                  onChange={(e) =>
                    setStart(
                      Math.max(0, Math.min(9999, parseInt(e.target.value, 10) || 0)),
                    )
                  }
                  className="w-28"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="apn-size">Font size</Label>
                <Input
                  id="apn-size"
                  type="number"
                  min={6}
                  max={48}
                  value={size}
                  onChange={(e) =>
                    setSize(
                      Math.max(6, Math.min(48, parseInt(e.target.value, 10) || 11)),
                    )
                  }
                  className="w-28"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="apn-margin">Distance from edge</Label>
                <Input
                  id="apn-margin"
                  type="number"
                  min={8}
                  max={120}
                  value={margin}
                  onChange={(e) =>
                    setMargin(
                      Math.max(8, Math.min(120, parseInt(e.target.value, 10) || 28)),
                    )
                  }
                  className="w-28"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="apn-color">Colour</Label>
                <div className="flex items-center gap-2 rounded-lg border border-input px-2.5 py-1.5">
                  <input
                    id="apn-color"
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="size-7 cursor-pointer rounded-md border-0 bg-transparent p-0"
                    aria-label="Page number colour"
                  />
                  <span className="font-mono text-[12.5px] uppercase text-muted-foreground">
                    {color}
                  </span>
                </div>
              </div>
            </div>

            <label className="flex cursor-pointer items-center gap-2.5">
              <input
                type="checkbox"
                checked={skipFirst}
                onChange={(e) => setSkipFirst(e.target.checked)}
                className="size-4 cursor-pointer accent-primary"
              />
              <span className="text-[13px] font-semibold text-foreground">
                Leave the first page unnumbered
                <span className="font-normal text-muted-foreground">
                  {" "}
                  — for covers and title pages
                </span>
              </span>
            </label>

            <p className="text-[12px] leading-relaxed text-muted-foreground">
              Preview: page 3 of a 12-page document reads{" "}
              <span className="font-semibold text-foreground">
                {labelFor(format, 3, 12)}
              </span>
              . Numbering runs over every page in the document.
            </p>
          </div>

          <ActionRow
            busy={busy}
            disabled={false}
            onRun={run}
            onClear={() => {
              reset();
              setResults([]);
            }}
            clearDisabled={false}
          >
            Add page numbers
          </ActionRow>
        </>
      )}

      <ResultsPanel files={results} zipName="numbered.pdf" />
    </div>
  );
}
