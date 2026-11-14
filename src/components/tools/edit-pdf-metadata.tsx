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
  pdfErrorMessage,
  savePdf,
  type LoadedPdf,
} from "./pdf-utils";

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

export function EditPdfMetadata() {
  const [state, setState] = useState<MetaState>({ status: "empty" });
  const [original, setOriginal] = useState<MetaFields>(EMPTY_META);
  const [fields, setFields] = useState<MetaFields>(EMPTY_META);
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
      setOriginal(read);
      setFields(read);
      setState({ status: "ready", pdf: loaded });
    } catch (err) {
      setState({ status: "error", name: file.name, error: pdfErrorMessage(err) });
    }
  }, []);

  const restart = () => {
    setState({ status: "empty" });
    setOriginal(EMPTY_META);
    setFields(EMPTY_META);
    setResults([]);
  };

  const dirty =
    fields.title !== original.title ||
    fields.author !== original.author ||
    fields.subject !== original.subject ||
    fields.keywords !== original.keywords;

  const scrub = () => setFields(EMPTY_META);

  const run = async () => {
    if (!pdf) return;
    setBusy(true);
    setResults([]);
    try {
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

      const blob = await savePdf(source.doc);
      const base = pdf.file.name.replace(/\.pdf$/i, "");
      setResults([
        {
          blob,
          name: `${base}-metadata.pdf`,
          note: dirty ? "Metadata updated" : "Metadata re-saved unchanged",
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
            <p className="text-[12px] leading-relaxed text-muted-foreground">
              Sharing a PDF? Metadata travels with it — Word "Author" fields
              often leak real names and internal paths. Clear the fields and
              save to send a clean file.
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

      <ResultsPanel files={results} zipName="metadata.pdf" />
    </div>
  );
}
