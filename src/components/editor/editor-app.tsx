"use client";

/**
 * FreeSeak — the Edit PDF workspace shell (v0.9.0).
 *
 * Merged into FreeSeak from the PDFDock editor: continuous scrolling
 * pages, double-click-to-retype, variable-width brushes, forms and
 * signatures — plus this family's additions: on-device OCR
 * (Tesseract, self-hosted), password-protected files (opened with
 * the password, exported as high-quality images) and Noto Unicode
 * text. The landing is FreeSeak's own tool page, so the shell starts
 * at a drop zone and takes the width of the content area.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  FileStack,
  FileText,
  Loader2,
  Lock,
  RotateCcw,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { TopBar } from "./top-bar";
import { PageRail } from "./page-rail";
import { ToolDock } from "./tool-dock";
import { PropertiesPanel } from "./properties";
import { Workspace } from "./workspace";
import { SignatureDialog } from "./signature-dialog";
import { ExportDialog } from "./export-dialog";
import { FormsPanel } from "./forms-panel";
import { getRenderProxy, readFormFields } from "@/lib/editor/engine";
import { newId, useEditor } from "@/lib/editor/store";
import type { ImageObject, TextObject } from "@/lib/editor/types";
import { disposeOcr, ocrPdfPage } from "@/components/tools/ocr-engine";

function readImageFile(file: File): Promise<{ src: string; w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read-failed"));
    reader.onload = () => {
      const src = String(reader.result);
      const img = new Image();
      img.onload = () => resolve({ src, w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = () => reject(new Error("decode-failed"));
      img.src = src;
    };
    reader.readAsDataURL(file);
  });
}

export function EditorApp() {
  const status = useEditor((s) => s.status);
  const doc = useEditor((s) => s.doc);
  const loadError = useEditor((s) => s.loadError);
  const needsPassword = useEditor((s) => s.needsPassword);
  const pages = useEditor((s) => s.pages);
  const pageIndex = useEditor((s) => s.pageIndex);
  const addObject = useEditor((s) => s.addObject);

  const [signOpen, setSignOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [formsOpen, setFormsOpen] = useState(false);
  const [formsBusy, setFormsBusy] = useState(false);
  const [railOpen, setRailOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [dragOver, setDragOver] = useState(false);

  /* the file that failed for want of a password — kept for the retry */
  const pendingRef = useRef<{ bytes: Uint8Array; name: string; size: number } | null>(
    null,
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* the OCR engine is shared with Extract PDF Text — free its WASM
     memory when the visitor leaves the page */
  useEffect(() => () => void disposeOcr(), []);

  /* ---------------- opening files ---------------- */

  const openFile = useCallback(async (file: File) => {
    if (!/pdf/i.test(file.type) && !/\.pdf$/i.test(file.name)) {
      toast.error("That's not a PDF — pick a .pdf file to edit.");
      return;
    }
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      pendingRef.current = { bytes, name: file.name, size: file.size };
      setPassword("");
      await useEditor.getState().openBytes(bytes, file.name, file.size);
    } catch {
      toast.error("Couldn't read that file — try again.");
    }
  }, []);

  const unlockWithPassword = useCallback(async () => {
    const pending = pendingRef.current;
    if (!pending || !password) return;
    await useEditor
      .getState()
      .openBytes(pending.bytes, pending.name, pending.size, password);
  }, [password]);

  /* ---------------- OCR ---------------- */

  const onOcr = useCallback(async () => {
    const s = useEditor.getState();
    const page = s.pages[s.pageIndex];
    const proxy = getRenderProxy();
    if (!page || !proxy) return;
    if (page.srcIndex === null) {
      toast.info("This is a blank page — there's nothing to read.");
      return;
    }
    const id = toast.loading(
      "Reading this page on your device… the first run loads the OCR engine (~10 MB, once).",
    );
    try {
      const { lines } = await ocrPdfPage(proxy, page.srcIndex + 1);
      if (lines.length === 0) {
        toast.info(
          "No readable text found — OCR reads printed English only, not handwriting or photos.",
          { id },
        );
        return;
      }
      const objs: TextObject[] = lines.map((ln) => ({
        id: newId("txt"),
        pageId: page.id,
        type: "text",
        text: ln.text,
        fontKey: "helv",
        fontSize: Math.min(72, Math.max(6, Math.round(ln.h * page.height * 0.78))),
        color: "#202938",
        x: ln.x * page.width,
        y: ln.y * page.height,
        w: ln.w * page.width,
        h: ln.h * page.height,
      }));
      useEditor.getState().addObjects(objs, null);
      toast.success(
        `Read ${objs.length} line${objs.length === 1 ? "" : "s"} of text — they're ordinary text boxes now. One undo removes them all.`,
        { id },
      );
    } catch {
      toast.error("OCR couldn't read this page — it stays a picture.", { id });
    }
  }, []);

  /* ---------------- forms & images (dialog flows) ---------------- */

  const onForms = useCallback(async () => {
    setFormsOpen(true);
    const s = useEditor.getState();
    if (!s.doc || s.formFields !== null) return;
    if (s.doc.encrypted) {
      useEditor.getState().setFormFields(null);
      toast.info(
        "Protected files can't expose form fields to the editor — use the Text tool to type in the boxes instead.",
      );
      return;
    }
    setFormsBusy(true);
    try {
      const fields = await readFormFields(s.doc.bytes);
      useEditor.getState().setFormFields(fields);
      if (fields === null) {
        toast.info(
          "This PDF has no fillable form fields — but you can still type anywhere with the Text tool.",
        );
      }
    } catch {
      toast.error("Couldn't read the form fields of this PDF.");
    } finally {
      setFormsBusy(false);
    }
  }, []);

  const onImage = useCallback(
    async (file: File) => {
      try {
        const { src, w, h } = await readImageFile(file);
        const page = pages[pageIndex];
        if (!page) return;
        /* scale to a sane size: cover at most 40% of the page width */
        const targetW = Math.min(page.width * 0.4, 240);
        const targetH = (targetW / w) * h;
        const obj: ImageObject = {
          id: newId("img"),
          pageId: page.id,
          type: "image",
          x: (page.width - targetW) / 2,
          y: (page.height - targetH) / 2,
          w: targetW,
          h: targetH,
          src,
          aspect: w / h,
        };
        addObject(obj);
        toast.success("Image placed — drag to move; hold Ctrl (⌘/Alt) while resizing to keep proportions.");
      } catch {
        toast.error("Couldn't read that image — try a PNG or JPEG.");
      }
    },
    [pages, pageIndex, addObject],
  );

  /* ---------------- workspace shell ---------------- */

  if (status === "ready") {
    return (
      <>
        <div className="flex h-[calc(100dvh-88px)] min-h-[560px] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          {doc?.encrypted ? (
            <div className="flex items-center gap-2 border-b border-border bg-mint/[0.08] px-3.5 py-1.5 text-[11.5px] leading-relaxed text-muted-foreground">
              <Lock
                className="size-3.5 shrink-0 text-mint-deep dark:text-mint"
                aria-hidden="true"
              />
              Protected file — opened with your password. Edits export as
              high-quality images (visually identical, not text-selectable).
            </div>
          ) : null}

          <TopBar
            onExport={() => setExportOpen(true)}
            onForms={() => void onForms()}
          />

          <div className="flex min-h-0 flex-1">
            {/* left: page rail on desktop */}
            <aside className="hidden w-[188px] shrink-0 flex-col border-r border-border bg-card lg:flex">
              <div className="border-b border-border px-3 py-2">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                  Pages
                </p>
              </div>
              <div className="min-h-0 flex-1">
                <PageRail />
              </div>
            </aside>

            <div className="flex min-h-0 min-w-0 flex-1 flex-col sm:flex-row">
              {/* tool dock: strip above the canvas on mobile, slim vertical
                  bar to its left on desktop (orientation flips at sm) */}
              <aside className="flex flex-row items-center gap-1.5 border-b border-border bg-card px-1.5 py-1.5 sm:flex-col sm:gap-1 sm:border-b-0 sm:border-r sm:px-1.5 sm:py-2">
                <Sheet open={railOpen} onOpenChange={setRailOpen}>
                  <SheetTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      aria-label="Open page list"
                      className="gap-1.5 lg:hidden"
                    >
                      <FileStack className="size-4" aria-hidden="true" />
                      Pages
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="left" className="w-[220px] p-0">
                    <SheetHeader className="border-b border-border px-3 py-3">
                      <SheetTitle className="text-[13px] font-display">
                        Pages
                      </SheetTitle>
                      <SheetDescription className="text-[11.5px]">
                        Tap a thumbnail to jump; use the icons to rotate,
                        add or delete.
                      </SheetDescription>
                    </SheetHeader>
                    <div className="thin-scroll h-[calc(100%-96px)] overflow-y-auto">
                      <PageRail onNavigate={() => setRailOpen(false)} />
                    </div>
                  </SheetContent>
                </Sheet>
                <div className="min-w-0 flex-1 sm:flex-none">
                  <ToolDock
                    onSign={() => setSignOpen(true)}
                    onImage={(f) => void onImage(f)}
                    onOcr={() => void onOcr()}
                  />
                </div>
              </aside>

              {/* the canvas */}
              <Workspace />
            </div>

            {/* right: properties on wide screens */}
            <aside className="thin-scroll hidden w-[248px] shrink-0 overflow-y-auto border-l border-border bg-card xl:block">
              <div className="border-b border-border px-3 py-2">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                  Properties
                </p>
              </div>
              <PropertiesPanel />
            </aside>
          </div>

          {/* mobile: collapsible properties strip */}
          <div className="border-t border-border bg-card xl:hidden">
            <details className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground marker:hidden [&::-webkit-details-marker]:hidden">
                Properties
                <span className="text-[10px] font-semibold normal-case tracking-normal text-primary group-open:hidden">
                  tap to open
                </span>
              </summary>
              <div className="thin-scroll max-h-[38vh] overflow-y-auto border-t border-border">
                <PropertiesPanel />
              </div>
            </details>
          </div>
        </div>

        <SignatureDialog open={signOpen} onOpenChange={setSignOpen} />
        <ExportDialog open={exportOpen} onOpenChange={setExportOpen} />
        <FormsPanel open={formsOpen} onOpenChange={setFormsOpen} loading={formsBusy} />
      </>
    );
  }

  /* ---------------- drop zone / loading / password / error ---------------- */

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files?.[0];
        if (file) void openFile(file);
      }}
      className={`flex min-h-[420px] flex-col items-center justify-center gap-5 rounded-2xl border-2 border-dashed px-6 py-14 text-center transition-colors ${
        dragOver
          ? "border-primary bg-primary/[0.06]"
          : "border-border bg-secondary/30"
      }`}
    >
      {status === "loading" ? (
        <>
          <Loader2
            className="size-10 animate-spin text-primary"
            aria-hidden="true"
          />
          <p className="text-[13.5px] font-semibold text-foreground">
            Opening your PDF…
          </p>
          <p className="text-[11.5px] text-muted-foreground">
            Everything happens on this device — nothing is uploaded.
          </p>
        </>
      ) : needsPassword ? (
        <>
          <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10">
            <Lock className="size-7 text-primary" aria-hidden="true" />
          </div>
          <div>
            <p className="font-display text-[17px] font-bold text-foreground">
              {pendingRef.current?.name ?? "This file"} is password-protected
            </p>
            <p className="mx-auto mt-1 max-w-md text-[12.5px] leading-relaxed text-muted-foreground">
              {loadError} The file is decrypted on your device only; exports
              rebuild its pages as high-quality images.
            </p>
          </div>
          <form
            className="flex w-full max-w-sm items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void unlockWithPassword();
            }}
          >
            <div className="flex-1 text-left">
              <Label htmlFor="pdf-password" className="sr-only">
                PDF password
              </Label>
              <Input
                id="pdf-password"
                type="password"
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="PDF password"
              />
            </div>
            <Button type="submit" className="gap-1.5">
              <Lock className="size-3.5" aria-hidden="true" />
              Unlock
            </Button>
          </form>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="text-[11.5px] font-semibold text-primary hover:underline"
          >
            Pick a different file
          </button>
        </>
      ) : status === "error" ? (
        <>
          <div className="flex size-14 items-center justify-center rounded-2xl bg-destructive/10">
            <FileText
              className="size-7 text-destructive"
              aria-hidden="true"
            />
          </div>
          <p className="max-w-md text-[13px] leading-relaxed text-muted-foreground">
            {loadError || "This PDF couldn't be opened."}
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            className="gap-1.5"
          >
            <RotateCcw className="size-3.5" aria-hidden="true" />
            Try another file
          </Button>
        </>
      ) : (
        <>
          <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10">
            <FileText className="size-7 text-primary" aria-hidden="true" />
          </div>
          <div>
            <p className="font-display text-[17px] font-bold text-foreground">
              Drop a PDF here to start editing
            </p>
            <p className="mx-auto mt-1 max-w-lg text-[12.5px] leading-relaxed text-muted-foreground">
              Add real text in any language, sign, white-out, highlight, fill
              forms — or read scanned pages with on-device OCR. Double-click
              existing text to retype it.
            </p>
          </div>
          <Button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="gap-1.5"
          >
            <Upload className="size-4" aria-hidden="true" />
            Choose a PDF
          </Button>
          <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <ShieldCheck
              className="size-3.5 shrink-0 text-mint-deep dark:text-mint"
              aria-hidden="true"
            />
            Password-protected files open with their password · nothing is
            uploaded, ever
          </p>
        </>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void openFile(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}
