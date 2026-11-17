"use client";

/**
 * Edit PDF Metadata — see and change the Title, Author, Subject and
 * Keywords of a PDF, or scrub them all in one click before sharing.
 * pdf-lib rewrites the document info dictionary in the browser.
 */

import { useCallback, useState } from "react";
import { Eraser, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ActionRow,
  LoadedPdfCard,
  PdfDropZone,
  ResultsPanel,
  type OutputFile,
} from "./pdf-shared";
import {
  loadPdf,
  loadPdfLib,
  pdfErrorMessage,
  savePdf,
  type LoadedPdf,
} from "./pdf-utils";
import type { PDFRef } from "pdf-lib";

interface MetaFields {
  title: string;
  author: string;
  subject: string;
  keywords: string;
}

const EMPTY_META: MetaFields = {
  title: "",
  author: "",
  subject: "",
  keywords: "",
};

type MetaState =
  | { status: "empty" }
  | { status: "loading"; name: string }
  | { status: "ready"; pdf: LoadedPdf }
  | { status: "error"; name: string; error: string };

function formatDateTime(d: Date | null): string {
  if (!d) return "not set";
  return d.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function EditPdfMetadata() {
  const [state, setState] = useState<MetaState>({ status: "empty" });
  const [original, setOriginal] = useState<MetaFields>(EMPTY_META);
  const [fields, setFields] = useState<MetaFields>(EMPTY_META);
  const [dates, setDates] = useState<{ created: Date | null; modified: Date | null }>({
    created: null,
    modified: null,
  });
  const [scrubbed, setScrubbed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<OutputFile[]>([]);

  const pdf = state.status === "ready" ? state.pdf : null;

  /* open the file and read its metadata in one pass — no double load */
  const open = useCallback(async (file: File) => {
    setState({ status: "loading", name: file.name });
    try {
      const loaded = await loadPdf(file);
      /* pdf-lib returns undefined for absent fields — normalise to "" */
      const read: MetaFields = {
        title: loaded.doc.getTitle() ?? "",
        author: loaded.doc.getAuthor() ?? "",
        subject: loaded.doc.getSubject() ?? "",
        keywords: loaded.doc.getKeywords() ?? "",
      };
      let created: Date | null = null;
      let modified: Date | null = null;
      try {
        created = loaded.doc.getCreationDate() ?? null;
      } catch { /* absent or malformed — show "not set" */ }
      try {
        modified = loaded.doc.getModificationDate() ?? null;
      } catch { /* absent or malformed */ }
      setOriginal(read);
      setFields(read);
      setDates({ created, modified });
      setScrubbed(false);
      setState({ status: "ready", pdf: loaded });
    } catch (err) {
      setState({ status: "error", name: file.name, error: pdfErrorMessage(err) });
    }
  }, []);

  const restart = () => {
    setState({ status: "empty" });
    setOriginal(EMPTY_META);
    setFields(EMPTY_META);
    setDates({ created: null, modified: null });
    setScrubbed(false);
    setResults([]);
  };

  const dirty =
    scrubbed ||
    fields.title !== original.title ||
    fields.author !== original.author ||
    fields.subject !== original.subject ||
    fields.keywords !== original.keywords;

  const scrub = () => {
    setFields(EMPTY_META);
    setScrubbed(true);
  };

  const run = async () => {
    if (!pdf) return;
    setBusy(true);
    setResults([]);
    try {
      const { PDFName } = await loadPdfLib();
      /* re-load fresh: repeated saves must never stack on edited state */
      const source = await loadPdf(pdf.file);

      source.doc.setTitle(fields.title.trim());
      source.doc.setAuthor(fields.author.trim());
      source.doc.setSubject(fields.subject.trim());
      source.doc.setKeywords(
        fields.keywords
          .split(",")
          .map((k) => k.trim())
          .filter(Boolean),
      );

      /* modern PDFs carry a SECOND metadata copy as an XMP packet on the
         catalog (dc:title, dc:creator, xmp:CreatorTool …) — viewers can
         read it even after the info dictionary is rewritten. Remove the
         reference AND the object, so the saved file carries exactly what
         this form shows and nothing else. */
      const metaObj = source.doc.catalog.get(PDFName.of("Metadata"));
      if (metaObj) {
        if ("objectNumber" in metaObj) {
          source.doc.context.delete(metaObj as PDFRef);
        }
        source.doc.catalog.delete(PDFName.of("Metadata"));
      }

      /* dates: modified = now; a scrubbed file gets a fresh creation date
         so the original document's history is gone */
      const now = new Date();
      source.doc.setModificationDate(now);
      if (scrubbed) {
        try {
          source.doc.setCreationDate(now);
        } catch { /* date library edge case — never block the save */ }
      }

      const blob = await savePdf(source.doc);
      const base = pdf.file.name.replace(/\.pdf$/i, "");
      setResults([
        {
          blob,
          name: `${base}-metadata.pdf`,
          note: dirty
            ? `Metadata updated${scrubbed ? " · dates reset" : ""} · the hidden XMP packet was removed too`
            : "Metadata re-saved unchanged · the hidden XMP packet was removed",
        },
      ]);
      toast.success("Metadata saved", {
        description: "Processed on your device — nothing was uploaded.",
      });
    } catch (err) {
      toast.error(pdfErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const field = (id: keyof MetaFields, label: string, placeholder: string) => (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={`em-${id}`}>{label}</Label>
      <Input
        id={`em-${id}`}
        value={fields[id]}
        onChange={(e) => setFields((prev) => ({ ...prev, [id]: e.target.value }))}
        placeholder={placeholder}
        autoComplete="off"
      />
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      {!pdf && state.status !== "loading" && (
        <PdfDropZone
          onFiles={(files) => {
            const first = files.find(
              (f) => f.type === "application/pdf" || /\.pdf$/i.test(f.name),
            );
            if (first) void open(first);
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
          <PdfDropZone onFiles={(files) => files[0] && void open(files[0])} compact />
        </div>
      )}

      {pdf && (
        <>
          <LoadedPdfCard pdf={pdf} onRemove={restart} />

          <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5">
            <div className="grid gap-3 sm:grid-cols-2">
              {field("title", "Title", "The document's name")}
              {field("author", "Author", "Who wrote it")}
              {field("subject", "Subject", "What it is about")}
              {field("keywords", "Keywords", "comma, separated, search terms")}
            </div>
            <p className="text-[11.5px] leading-relaxed text-muted-foreground">
              Created {formatDateTime(dates.created)} · Modified{" "}
              {formatDateTime(dates.modified)} — the modified date is rewritten
              on every save{scrubbed ? ", and a scrubbed file gets a fresh creation date" : ""}.
            </p>
            <p className="text-[12px] leading-relaxed text-muted-foreground">
              Sharing a PDF? Metadata travels with it — Word &quot;Author&quot; fields
              often leak real names and internal paths. Clear the fields and
              save to send a clean file: the classic fields AND the hidden XMP
              packet are removed. One deliberate leftover: the saved file is
              stamped “FreeSeak (freeseak.com)” as its producer, like every
              file this site generates.
            </p>
            <div className="flex flex-wrap gap-2.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={scrub}
                disabled={busy}
                className="gap-1.5"
              >
                <Eraser className="size-3.5" aria-hidden="true" />
                Clear all fields
              </Button>
            </div>
          </div>

          <ActionRow busy={busy} disabled={false} onRun={run} onClear={restart} clearDisabled={false}>
            <Save className="size-4" aria-hidden="true" />
            Save PDF with this metadata
          </ActionRow>
        </>
      )}

      <ResultsPanel files={results} zipName="freeseak-metadata-pdfs.zip" />
    </div>
  );
}
