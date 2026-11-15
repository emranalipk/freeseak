"use client";

/**
 * Edit PDF — the visual workspace (v0.6.0).
 *
 * pdf.js paints the current page; an HTML/SVG overlay on top holds the
 * annotations in normalised display coordinates, so dragging, resizing
 * and selecting work with plain pointer events at any zoom. The heavy
 * lifting (burning edits into the document, form fields, raster paths,
 * the sample file) lives in pdf-editor-core.ts; OCR lives in
 * ocr-engine.ts. Everything runs on the visitor's device.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Circle,
  Eraser,
  Highlighter,
  ImagePlus,
  Minus,
  MousePointer2,
  Pencil,
  ScanText,
  Signature,
  Square,
  Type,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Copy,
  Lock,
  Loader2,
  FilePlus2,
  FileDown,
  Maximize,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PdfDropZone, ResultsPanel, type OutputFile } from "./pdf-shared";
import { loadPdfLib, pdfErrorMessage } from "./pdf-utils";
import { loadPdfJs, PdfJsPasswordError, renderPdfPage, destroyPdfJsDoc } from "./pdf-render";
import { disposeOcr, ocrPdfPage, type OcrLine, type OcrStatus } from "./ocr-engine";
import {
  DEFAULT_TEXT_SIZE,
  TEXT_LINE_FACTOR,
  buildSamplePdf,
  cssFontFamily,
  ensureNotoFontFace,
  exportEditedPdf,
  readFormFields,
  applyFormValues,
  uid,
  needsUnicodeFont,
  type Annotation,
  type EditorFormField,
  type EditorTool,
  type PageSize,
  type TextFont,
  type TextAnnotation,
  type WhiteoutAnnotation,
  type ShapeAnnotation,
  type LineAnnotation,
  type InkAnnotation,
  type ImageAnnotation,
} from "./pdf-editor-core";

/* ------------------------------------------------------------------ */
/* small building blocks                                               */
/* ------------------------------------------------------------------ */

type Phase =
  | { status: "empty" }
  | { status: "loading"; name: string }
  | { status: "password"; name: string; wrong: boolean }
  | { status: "error"; name: string; error: string }
  | { status: "ready" };

interface StyleDefaults {
  font: TextFont;
  size: number;
  bold: boolean;
  italic: boolean;
  textColor: string;
  stroke: string;
  strokeWidth: number;
  fill: string | null;
  penColor: string;
  penWidth: number;
  highlightColor: string;
  highlightWidth: number;
  whiteoutColor: string;
}

const INITIAL_DEFAULTS: StyleDefaults = {
  font: "Helvetica",
  size: DEFAULT_TEXT_SIZE,
  bold: false,
  italic: false,
  textColor: "#111111",
  stroke: "#c2410c",
  strokeWidth: 2,
  fill: null,
  penColor: "#1d4ed8",
  penWidth: 2,
  highlightColor: "#facc15",
  highlightWidth: 12,
  whiteoutColor: "#ffffff",
};

const TOOL_BUTTONS: { id: EditorTool; label: string; icon: LucideIcon }[] = [
  { id: "select", label: "Select", icon: MousePointer2 },
  { id: "text", label: "Text", icon: Type },
  { id: "whiteout", label: "White-out", icon: Eraser },
  { id: "rect", label: "Rectangle", icon: Square },
  { id: "ellipse", label: "Ellipse", icon: Circle },
  { id: "line", label: "Line", icon: Minus },
  { id: "pen", label: "Draw", icon: Pencil },
  { id: "highlight", label: "Highlight", icon: Highlighter },
  { id: "image", label: "Image", icon: ImagePlus },
  { id: "signature", label: "Sign", icon: Signature },
];

const MIN_BOX = 0.01;

type DragState =
  | { mode: "create-box"; tool: "whiteout" | "rect" | "ellipse"; start: { x: number; y: number }; cur: { x: number; y: number } }
  | { mode: "create-line"; start: { x: number; y: number }; cur: { x: number; y: number } }
  | { mode: "ink"; kind: "pen" | "highlight"; points: { x: number; y: number }[] }
  | { mode: "move"; id: string; grab: { x: number; y: number }; orig: Annotation }
  | { mode: "resize"; id: string; dir: "nw" | "ne" | "sw" | "se"; orig: { x: number; y: number; w: number; h: number } };

function moveAnnotation(anno: Annotation, dx: number, dy: number): Annotation {
  if ("points" in anno) {
    return { ...anno, points: anno.points.map((p) => ({ x: p.x + dx, y: p.y + dy })) };
  }
  if (anno.kind === "line") {
    return { ...anno, x1: anno.x1 + dx, y1: anno.y1 + dy, x2: anno.x2 + dx, y2: anno.y2 + dy };
  }
  return { ...anno, x: anno.x + dx, y: anno.y + dy };
}

function inkBBox(points: { x: number; y: number }[]) {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return { x: minX, y: minY, w: Math.max(...xs) - minX, h: Math.max(...ys) - minY };
}

function shapeBBox(anno: Annotation) {
  if (anno.kind === "line") {
    return {
      x: Math.min(anno.x1, anno.x2),
      y: Math.min(anno.y1, anno.y2),
      w: Math.abs(anno.x2 - anno.x1),
      h: Math.abs(anno.y2 - anno.y1),
    };
  }
  if (anno.kind === "pen" || anno.kind === "highlight") return inkBBox(anno.points);
  /* whatever remains is a box annotation (text / whiteout / shape / image) */
  const box = anno as TextAnnotation | WhiteoutAnnotation | ShapeAnnotation | ImageAnnotation;
  return { x: box.x, y: box.y, w: box.w, h: box.h };
}

/** downscale + re-encode a dropped image so embedded PDFs stay small */
async function processImageFile(file: File): Promise<{
  url: string;
  mime: "image/png" | "image/jpeg";
  bytes: Uint8Array;
  aspect: number;
}> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const mime = file.type === "image/jpeg" ? "image/jpeg" : "image/png";
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode-failed"))), mime, 0.92);
  });
  return {
    url: URL.createObjectURL(blob),
    mime,
    bytes: new Uint8Array(await blob.arrayBuffer()),
    aspect: bitmap.width / bitmap.height,
  };
}

/** a labelled colour swatch — a component, so its onChange is a real event prop */
function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (_v: string) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <Label className="text-[12px]">{label}</Label>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        className="h-7 w-10 cursor-pointer rounded border border-border bg-card"
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* the component                                                       */
/* ------------------------------------------------------------------ */

export function PdfEditor() {
  /* document state */
  const [phase, setPhase] = useState<Phase>({ status: "empty" });
  const [pageCount, setPageCount] = useState(0);
  const [page, setPage] = useState(0);
  const [pageSizes, setPageSizes] = useState<PageSize[]>([]);
  const [docName, setDocName] = useState("");
  const [encrypted, setEncrypted] = useState(false);
  const [formFields, setFormFields] = useState<EditorFormField[]>([]);
  const [formValues, setFormValues] = useState<Record<string, string | boolean>>({});
  const [previewUpdating, setPreviewUpdating] = useState(false);
  const [renderTick, setRenderTick] = useState(0);

  const pdfDocRef = useRef<import("pdfjs-dist").PDFDocumentProxy | null>(null);
  const originalBytesRef = useRef<Uint8Array | null>(null);
  const pendingBytesRef = useRef<Uint8Array | null>(null);
  const [password, setPassword] = useState("");

  /* annotations, selection, tools */
  const [annos, setAnnosState] = useState<Annotation[]>([]);
  const annosRef = useRef<Annotation[]>([]);
  const pastRef = useRef<Annotation[][]>([]);
  const futureRef = useRef<Annotation[][]>([]);
  const [histLen, setHistLen] = useState({ past: 0, future: 0 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tool, setTool] = useState<EditorTool>("select");
  const [drag, setDrag] = useState<DragState | null>(null);
  const [defaults, setDefaults] = useState<StyleDefaults>(INITIAL_DEFAULTS);

  /* view state */
  const [zoom, setZoom] = useState<number | null>(null);
  const [cssSize, setCssSize] = useState({ w: 0, h: 0 });
  const [containerWidth, setContainerWidth] = useState(0);
  const [rendering, setRendering] = useState(false);

  /* panels */
  const [tab, setTab] = useState<"props" | "form" | "ocr">("props");
  const [sigOpen, setSigOpen] = useState(false);
  const [ocrRun, setOcrRun] = useState<{ status: OcrStatus; done: number; total: number } | null>(null);
  const [ocrResults, setOcrResults] = useState<Record<number, OcrLine[]>>({});

  /* export state */
  const [exporting, setExporting] = useState(false);
  const [exportStep, setExportStep] = useState("");
  const [flattenForms, setFlattenForms] = useState(false);
  const [rasterizeAll, setRasterizeAll] = useState(false);
  const [fileName, setFileName] = useState("");
  const [results, setResults] = useState<OutputFile[]>([]);

  /* refs for the stage */
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasHostRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const sigCanvasRef = useRef<HTMLCanvasElement>(null);
  const sigDrawingRef = useRef(false);
  const formDirtyRef = useRef(false);
  const previewGenRef = useRef(0);

  const pageSize = pageSizes[page];
  const fitScale = useMemo(() => {
    if (!pageSize || containerWidth === 0) return 1;
    return Math.min(3, Math.max(0.2, (containerWidth - 24) / pageSize.w));
  }, [pageSize, containerWidth]);
  const scale = zoom ?? fitScale;

  const selected = annos.find((a) => a.id === selectedId) ?? null;

  const setAnnos = useCallback((next: Annotation[], record = true) => {
    if (record) {
      pastRef.current = [...pastRef.current.slice(-99), annosRef.current];
      futureRef.current = [];
    }
    annosRef.current = next;
    setAnnosState(next);
    if (record) {
      setHistLen({ past: pastRef.current.length, future: 0 });
    }
  }, []);

  const pushHistory = useCallback(() => {
    pastRef.current = [...pastRef.current.slice(-99), annosRef.current];
    futureRef.current = [];
    setHistLen({ past: pastRef.current.length, future: 0 });
  }, []);

  const undo = useCallback(() => {
    const past = pastRef.current;
    if (past.length === 0) return;
    const prev = past[past.length - 1];
    pastRef.current = past.slice(0, -1);
    futureRef.current = [...futureRef.current, annosRef.current];
    annosRef.current = prev;
    setAnnosState(prev);
    setSelectedId(null);
    setEditingId(null);
    setHistLen({ past: pastRef.current.length, future: futureRef.current.length });
  }, []);

  const redo = useCallback(() => {
    const future = futureRef.current;
    if (future.length === 0) return;
    const next = future[future.length - 1];
    futureRef.current = future.slice(0, -1);
    pastRef.current = [...pastRef.current, annosRef.current];
    annosRef.current = next;
    setAnnosState(next);
    setSelectedId(null);
    setEditingId(null);
    setHistLen({ past: pastRef.current.length, future: futureRef.current.length });
  }, []);

  /* ---------------- loading ---------------- */

  const finishLoad = useCallback(
    async (doc: import("pdfjs-dist").PDFDocumentProxy, name: string) => {
      const sizes: PageSize[] = [];
      for (let i = 0; i < doc.numPages; i++) {
        const p = await doc.getPage(i + 1);
        const viewport = p.getViewport({ scale: 1 });
        sizes.push({ w: viewport.width, h: viewport.height });
        p.cleanup();
      }
      pdfDocRef.current = doc;
      setPageSizes(sizes);
      setDocName(name);
      setPageCount(doc.numPages);
      setPage(0);
      setSelectedId(null);
      setEditingId(null);
      setTool("select");
      setOcrResults({});
      pastRef.current = [];
      futureRef.current = [];
      annosRef.current = [];
      setAnnosState([]);
      setResults([]);

      /* pdf-lib probe: editable copy + form fields? */
      let fields: EditorFormField[] = [];
      let libOk = false;
      if (originalBytesRef.current) {
        try {
          fields = await readFormFields(originalBytesRef.current);
          libOk = true;
        } catch {
          libOk = false;
        }
      }
      const firstValues: Record<string, string | boolean> = {};
      for (const f of fields) {
        if (f.kind === "text" && typeof f.value === "string") firstValues[f.name] = f.value;
        else if (f.kind === "checkbox") firstValues[f.name] = f.value === true;
        else if ((f.kind === "dropdown" || f.kind === "radio") && typeof f.value === "string") firstValues[f.name] = f.value;
      }
      formDirtyRef.current = false;
      setEncrypted(!libOk);
      setFormFields(fields);
      setFormValues(firstValues);
      setFileName(`${name.replace(/\.pdf$/i, "")}-edited.pdf`);
      setPhase({ status: "ready" });
      setRenderTick((t) => t + 1);
    },
    [],
  );

  const openPdfJsDoc = useCallback(async (bytes: Uint8Array, password?: string) => {
    const pdfjs = await loadPdfJs();
    try {
      return await pdfjs.getDocument({
        data: new Uint8Array(bytes),
        ...(password ? { password } : {}),
      }).promise;
    } catch (err) {
      const name = String((err as { name?: string })?.name ?? "");
      if (name.includes("PasswordException")) throw new PdfJsPasswordError();
      if (name.includes("InvalidPDFException")) {
        throw new Error(
          "This PDF couldn't be opened — the file may be damaged or not a PDF at all.",
        );
      }
      throw err;
    }
  }, []);

  const openFile = useCallback(
    async (file: File) => {
      if (file.size > 150 * 1024 * 1024) {
        toast.error("That file is very large", {
          description:
            "FreeSeak edits PDFs in your browser's memory — files over ~150 MB can exhaust it. Please use a smaller file.",
        });
        return;
      }
      setPhase({ status: "loading", name: file.name });
      try {
        const bytes = new Uint8Array(await file.arrayBuffer());
        originalBytesRef.current = bytes;
        pendingBytesRef.current = bytes;
        setPassword("");
        const doc = await openPdfJsDoc(bytes);
        await finishLoad(doc, file.name);
      } catch (err) {
        if (err instanceof PdfJsPasswordError) {
          setPhase({ status: "password", name: file.name, wrong: false });
          return;
        }
        originalBytesRef.current = null;
        setPhase({
          status: "error",
          name: file.name,
          error: err instanceof Error && err.message.includes("couldn't be opened")
            ? err.message
            : pdfErrorMessage(err),
        });
      }
    },
    [finishLoad, openPdfJsDoc],
  );

  const submitPassword = useCallback(async () => {
    const bytes = pendingBytesRef.current;
    const name = docName || "document.pdf";
    if (!bytes) return;
    setPhase({ status: "loading", name });
    try {
      const doc = await openPdfJsDoc(bytes, password);
      await finishLoad(doc, name);
    } catch (err) {
      if (err instanceof PdfJsPasswordError) {
        setPhase({ status: "password", name, wrong: true });
      } else {
        setPhase({ status: "error", name, error: pdfErrorMessage(err) });
      }
    }
  }, [finishLoad, openPdfJsDoc, password, docName]);

  const loadSample = useCallback(async () => {
    setPhase({ status: "loading", name: "freeseak-sample.pdf" });
    try {
      const file = await buildSamplePdf();
      await openFile(file);
    } catch {
      setPhase({ status: "empty" });
      toast.error("Couldn't build the sample file.");
    }
  }, [openFile]);

  const reset = useCallback(() => {
    const doc = pdfDocRef.current;
    pdfDocRef.current = null;
    originalBytesRef.current = null;
    pendingBytesRef.current = null;
    setPageSizes([]);
    setDocName("");
    if (doc) void destroyPdfJsDoc(doc);
    setPhase({ status: "empty" });
    setFormFields([]);
    setFormValues({});
    setOcrResults({});
    setResults([]);
    setSelectedId(null);
    setEditingId(null);
    setZoom(null);
  }, []);

  /* ---------------- canvas rendering ---------------- */

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const observer = new ResizeObserver((entries) => {
      setContainerWidth(entries[0]?.contentRect.width ?? 0);
    });
    observer.observe(stage);
    return () => observer.disconnect();
  }, [phase.status]);

  useEffect(() => {
    const doc = pdfDocRef.current;
    const sizes = pageSizes;
    if (phase.status !== "ready" || !doc || !sizes[page]) return;
    let cancelled = false;
    setRendering(true);
    (async () => {
      try {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const rendered = await renderPdfPage(doc, page + 1, scale * dpr);
        if (cancelled) {
          rendered.canvas.width = 0;
          rendered.canvas.height = 0;
          return;
        }
        const host = canvasHostRef.current;
        if (host) {
          rendered.canvas.style.width = `${sizes[page].w * scale}px`;
          rendered.canvas.style.height = `${sizes[page].h * scale}px`;
          rendered.canvas.style.display = "block";
          host.replaceChildren(rendered.canvas);
        }
        setCssSize({ w: sizes[page].w * scale, h: sizes[page].h * scale });
      } catch {
        /* leave the previous page painted */
      } finally {
        if (!cancelled) setRendering(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [phase, page, scale, renderTick, pageSizes]);

  /* ---------------- form values → live preview ---------------- */

  const rebuildPreview = useCallback(async () => {
    const bytes = originalBytesRef.current;
    if (!bytes || encrypted || Object.keys(formValues).length === 0) return;
    const gen = ++previewGenRef.current;
    setPreviewUpdating(true);
    try {
      const { PDFDocument } = await loadPdfLib();
      const doc = await PDFDocument.load(new Uint8Array(bytes), { ignoreEncryption: false });
      applyFormValues(doc, formValues);
      const edited = await doc.save({ useObjectStreams: true });
      if (gen !== previewGenRef.current) return;
      const pdfjs = await loadPdfJs();
      const newDoc = await pdfjs.getDocument({ data: new Uint8Array(edited) }).promise;
      const old = pdfDocRef.current;
      pdfDocRef.current = newDoc;
      setRenderTick((t) => t + 1);
      if (old) void destroyPdfJsDoc(old);
    } catch {
      /* preview is best-effort — export still tries */
    } finally {
      if (gen === previewGenRef.current) setPreviewUpdating(false);
    }
  }, [encrypted, formValues]);

  useEffect(() => {
    if (!formDirtyRef.current) return;
    const timer = window.setTimeout(() => void rebuildPreview(), 700);
    return () => window.clearTimeout(timer);
  }, [formValues, rebuildPreview]);

  const setFormValue = (name: string, value: string | boolean) => {
    formDirtyRef.current = true;
    setFormValues((prev) => ({ ...prev, [name]: value }));
  };

  /* ---------------- OCR ---------------- */

  const runOcr = useCallback(
    async (mode: "page" | "all") => {
      const doc = pdfDocRef.current;
      if (!doc || ocrRun) return;
      const pages = mode === "page" ? [page] : Array.from({ length: pageCount }, (_, i) => i);
      setOcrRun({ status: "loading-engine", done: 0, total: pages.length });
      try {
        for (let i = 0; i < pages.length; i++) {
          const target = pages[i];
          const { lines } = await ocrPdfPage(doc, target + 1, (status) =>
            setOcrRun((s) => (s ? { ...s, status } : s)),
          );
          setOcrResults((prev) => ({ ...prev, [target]: lines }));
          setOcrRun((s) => (s ? { ...s, done: i + 1 } : s));
        }
        toast.success("OCR finished", {
          description: "Recognised lines are listed in the OCR panel — click Replace to make one editable.",
        });
      } catch (err) {
        toast.error(`OCR failed — ${err instanceof Error ? err.message : "unknown error"}`);
      } finally {
        setOcrRun(null);
      }
    },
    [ocrRun, page, pageCount],
  );

  useEffect(() => () => void disposeOcr(), []);
  useEffect(
    () => () => {
      const doc = pdfDocRef.current;
      if (doc) void destroyPdfJsDoc(doc);
    },
    [],
  );

  const replaceOcrLine = (linePage: number, line: OcrLine) => {
    const size = pageSizes[linePage];
    if (!size) return;
    pushHistory();
    const sizePt = Math.max(6, line.h * size.h * 0.85);
    const whiteout: Annotation = {
      id: uid(),
      page: linePage,
      kind: "whiteout",
      x: line.x,
      y: line.y,
      w: line.w,
      h: line.h,
      color: "#ffffff",
    };
    const text: Annotation = {
      id: uid(),
      page: linePage,
      kind: "text",
      x: line.x,
      y: line.y,
      w: Math.min(0.96, line.w + 0.02),
      h: line.h,
      text: line.text,
      font: "Helvetica",
      bold: false,
      italic: false,
      size: sizePt,
      color: "#111111",
      rotation: 0,
    };
    const next = [...annosRef.current, whiteout, text];
    annosRef.current = next;
    setAnnosState(next);
    setSelectedId(text.id);
    setTool("select");
    setPage(linePage);
  };

  /* ---------------- creation & pointer handling ---------------- */

  const toNorm = (e: React.PointerEvent) => {
    const rect = overlayRef.current!.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)),
    };
  };

  const placeText = (p: { x: number; y: number }) => {
    const size = pageSizes[page];
    if (!size) return;
    const h = Math.max(0.02, (defaults.size * TEXT_LINE_FACTOR) / size.h);
    const anno: Annotation = {
      id: uid(),
      page,
      kind: "text",
      x: p.x,
      y: p.y,
      w: 0.45,
      h,
      text: "",
      font: defaults.font,
      bold: defaults.bold,
      italic: defaults.italic,
      size: defaults.size,
      color: defaults.textColor,
      rotation: 0,
    };
    pushHistory();
    const next = [...annosRef.current, anno];
    annosRef.current = next;
    setAnnosState(next);
    setSelectedId(anno.id);
    setEditingId(anno.id);
    setTool("select");
    if (anno.font === "Noto") void ensureNotoFontFace();
  };

  const onOverlayPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    if (tool === "select" || tool === "image" || tool === "signature") {
      setSelectedId(null);
      setEditingId(null);
      return;
    }
    const p = toNorm(e);
    overlayRef.current?.setPointerCapture(e.pointerId);
    if (tool === "text") {
      placeText(p);
      return;
    }
    if (tool === "pen" || tool === "highlight") {
      setDrag({ mode: "ink", kind: tool, points: [p, p] });
    } else if (tool === "line") {
      setDrag({ mode: "create-line", start: p, cur: p });
    } else {
      setDrag({ mode: "create-box", tool, start: p, cur: p });
    }
  };

  const onOverlayPointerMove = (e: React.PointerEvent) => {
    if (!drag) return;
    const p = toNorm(e);
    if (drag.mode === "ink") {
      const last = drag.points[drag.points.length - 1];
      if (Math.hypot(p.x - last.x, p.y - last.y) < 0.003) return;
      setDrag({ ...drag, points: [...drag.points, p] });
      return;
    }
    if (drag.mode === "create-box" || drag.mode === "create-line") {
      setDrag({ ...drag, cur: p });
      return;
    }
    if (drag.mode === "move") {
      const dx = p.x - drag.grab.x;
      const dy = p.y - drag.grab.y;
      setAnnos(
        annosRef.current.map((a) => (a.id === drag.id ? moveAnnotation(drag.orig, dx, dy) : a)),
        false,
      );
      return;
    }
    /* resize */
    const o = drag.orig;
    let { x, y, w, h } = o;
    if (drag.dir.includes("w")) {
      x = Math.min(p.x, o.x + o.w - MIN_BOX);
      w = o.x + o.w - x;
    }
    if (drag.dir.includes("e")) w = Math.max(MIN_BOX, p.x - o.x);
    if (drag.dir.includes("n")) {
      y = Math.min(p.y, o.y + o.h - MIN_BOX);
      h = o.y + o.h - y;
    }
    if (drag.dir.includes("s")) h = Math.max(MIN_BOX, p.y - o.y);
    setAnnos(
      annosRef.current.map((a) => (a.id === drag.id ? ({ ...a, x, y, w, h } as Annotation) : a)),
      false,
    );
  };

  const onOverlayPointerUp = () => {
    if (!drag) return;
    if (drag.mode === "create-box") {
      const x = Math.min(drag.start.x, drag.cur.x);
      const y = Math.min(drag.start.y, drag.cur.y);
      const w = Math.abs(drag.cur.x - drag.start.x);
      const h = Math.abs(drag.cur.y - drag.start.y);
      if (w >= MIN_BOX && h >= MIN_BOX) {
        const base = { id: uid(), page, x, y, w, h };
        const anno: Annotation =
          drag.tool === "whiteout"
            ? { ...base, kind: "whiteout", color: defaults.whiteoutColor }
            : drag.tool === "rect"
              ? {
                  ...base,
                  kind: "rect",
                  stroke: defaults.stroke,
                  strokeWidth: defaults.strokeWidth,
                  fill: defaults.fill,
                }
              : {
                  ...base,
                  kind: "ellipse",
                  stroke: defaults.stroke,
                  strokeWidth: defaults.strokeWidth,
                  fill: defaults.fill,
                };
        setAnnos([...annosRef.current, anno]);
        setSelectedId(anno.id);
        setTool("select");
      }
    } else if (drag.mode === "create-line") {
      const length = Math.hypot(drag.cur.x - drag.start.x, drag.cur.y - drag.start.y);
      if (length >= MIN_BOX) {
        const anno: Annotation = {
          id: uid(),
          page,
          kind: "line",
          x1: drag.start.x,
          y1: drag.start.y,
          x2: drag.cur.x,
          y2: drag.cur.y,
          stroke: defaults.stroke,
          strokeWidth: defaults.strokeWidth,
        };
        setAnnos([...annosRef.current, anno]);
        setSelectedId(anno.id);
        setTool("select");
      }
    } else if (drag.mode === "ink") {
      if (drag.points.length >= 2) {
        const anno: Annotation =
          drag.kind === "pen"
            ? {
                id: uid(),
                page,
                kind: "pen",
                points: drag.points,
                color: defaults.penColor,
                width: defaults.penWidth,
              }
            : {
                id: uid(),
                page,
                kind: "highlight",
                points: drag.points,
                color: defaults.highlightColor,
                width: defaults.highlightWidth,
              };
        setAnnos([...annosRef.current, anno]);
        setSelectedId(anno.id);
        if (drag.kind === "pen") setTool("pen");
        else setTool("highlight");
      }
    }
    setDrag(null);
  };

  const beginAnnoDrag = (e: React.PointerEvent, anno: Annotation) => {
    if (tool !== "select") return; /* let creation tools draw through */
    e.stopPropagation();
    setSelectedId(anno.id);
    pushHistory();
    overlayRef.current?.setPointerCapture(e.pointerId);
    setDrag({ mode: "move", id: anno.id, grab: toNorm(e), orig: anno });
  };

  const beginResize = (e: React.PointerEvent, dir: "nw" | "ne" | "sw" | "se") => {
    if (!selected) return;
    e.stopPropagation();
    if (!("w" in selected)) return;
    pushHistory();
    overlayRef.current?.setPointerCapture(e.pointerId);
    setDrag({ mode: "resize", id: selected.id, dir, orig: { x: selected.x, y: selected.y, w: selected.w, h: selected.h } });
  };

  /* ---------------- annotation helpers ---------------- */

  const deleteSelected = useCallback(() => {
    if (!selectedId) return;
    pushHistory();
    setAnnos(annosRef.current.filter((a) => a.id !== selectedId), false);
    setSelectedId(null);
    setEditingId(null);
  }, [selectedId, pushHistory, setAnnos]);

  const duplicateSelected = () => {
    if (!selected) return;
    const clone = structuredClone(selected);
    clone.id = uid();
    if ("x" in clone) {
      clone.x = Math.min(0.98, clone.x + 0.02);
      clone.y = Math.min(0.98, clone.y + 0.02);
    } else if (clone.kind === "line") {
      clone.x1 += 0.02;
      clone.y1 += 0.02;
      clone.x2 += 0.02;
      clone.y2 += 0.02;
    } else {
      clone.points = clone.points.map((p) => ({ x: p.x + 0.02, y: p.y + 0.02 }));
    }
    setAnnos([...annosRef.current, clone]);
    setSelectedId(clone.id);
  };

  const patchSelected = (patch: Record<string, unknown>) => {
    if (!selected) return;
    setAnnos(annos.map((a) => (a.id === selected.id ? ({ ...a, ...patch } as Annotation) : a)), false);
  };

  const patchDefaults = (patch: Partial<StyleDefaults>) => setDefaults((d) => ({ ...d, ...patch }));

  /* ---------------- image & signature placement ---------------- */

  const placeImage = (
    item: { url: string; mime: "image/png" | "image/jpeg"; bytes: Uint8Array; aspect: number },
    kind: "image" | "signature",
  ) => {
    const size = pageSizes[page];
    if (!size) return;
    const w = 0.4;
    const h = (w * size.w * (1 / item.aspect)) / size.h;
    const anno: Annotation = {
      id: uid(),
      page,
      kind,
      x: (1 - w) / 2,
      y: Math.max(0.05, 0.4 - h / 2),
      w,
      h,
      url: item.url,
      mime: item.mime,
      bytes: item.bytes,
    };
    setAnnos([...annosRef.current, anno]);
    setSelectedId(anno.id);
    setTool("select");
  };

  const onImagePicked = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    try {
      const item = await processImageFile(file);
      placeImage(item, "image");
    } catch {
      toast.error("Couldn't read that image — try a PNG or JPG.");
    }
  };

  /* signature pad drawing */
  useEffect(() => {
    if (!sigOpen) return;
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }, [sigOpen]);

  const sigPointer = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = sigCanvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const sigDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const ctx = sigCanvasRef.current?.getContext("2d");
    if (!ctx) return;
    sigDrawingRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = sigPointer(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#1e3a8a";
    ctx.lineWidth = 3;
  };

  const sigMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!sigDrawingRef.current) return;
    const ctx = sigCanvasRef.current?.getContext("2d");
    if (!ctx) return;
    const p = sigPointer(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  };

  const sigUp = () => {
    sigDrawingRef.current = false;
  };

  const insertSignature = () => {
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const item = {
        url: URL.createObjectURL(blob),
        mime: "image/png" as const,
        bytes: new Uint8Array(await blob.arrayBuffer()),
        aspect: canvas.width / canvas.height,
      };
      placeImage(item, "signature");
      setSigOpen(false);
    }, "image/png");
  };

  /* ---------------- keyboard ---------------- */

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (phase.status !== "ready") return;
      const target = e.target as HTMLElement | null;
      const typing =
        !!target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "z" && !typing) {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (mod && e.key.toLowerCase() === "y" && !typing) {
        e.preventDefault();
        redo();
        return;
      }
      if (typing) return;
      if ((e.key === "Delete" || e.key === "Backspace") && selectedId) {
        e.preventDefault();
        deleteSelected();
      } else if (e.key === "Escape") {
        setSelectedId(null);
        setEditingId(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, selectedId, undo, redo, deleteSelected]);

  /* ---------------- export ---------------- */

  const runExport = async () => {
    const doc = pdfDocRef.current;
    const bytes = originalBytesRef.current;
    if (!doc || !bytes || exporting) return;
    setExporting(true);
    setExportStep("Preparing…");
    setResults([]);
    try {
      const { blob } = await exportEditedPdf({
        freshBytes: () => new Uint8Array(bytes),
        pdfJsDoc: doc,
        pageSizes: pageSizes,
        annos: annosRef.current,
        formValues,
        encrypted,
        flattenForms,
        rasterizeAll: rasterizeAll || encrypted,
        onProgress: setExportStep,
        onNote: (note) => toast.info(note),
      });
      const name = fileName.trim() || "edited.pdf";
      setResults([
        {
          blob,
          name,
          note: encrypted
            ? "Password-protected original — pages were rasterised with your edits burned in"
            : rasterizeAll
              ? "Every page flattened to an image — nothing left to tamper with"
              : "Text, shapes and images burned in as real PDF content — text stays selectable",
        },
      ]);
      toast.success("PDF ready", {
        description: "Edited entirely on your device — nothing was uploaded.",
      });
    } catch (err) {
      toast.error(pdfErrorMessage(err));
    } finally {
      setExporting(false);
      setExportStep("");
    }
  };

  /* ---------------- derived helpers for the render ---------------- */

  const pageHpt = pageSize?.h ?? 842;
  const textBoxH = (anno: { text: string; size: number }) =>
    Math.max(0.02, (anno.text.split("\n").length * TEXT_LINE_FACTOR * anno.size) / pageHpt);

  const bboxOf = (anno: Annotation) => shapeBBox(anno);
  const selBBox = selected ? bboxOf(selected) : null;

  const needsNoto = useMemo(
    () =>
      annos.some((a) => a.kind === "text" && (a.font === "Noto" || needsUnicodeFont(a.text))),
    [annos],
  );
  useEffect(() => {
    if (needsNoto) void ensureNotoFontFace();
  }, [needsNoto]);

  /* what the properties panel edits: selection or defaults */
  const isSel = (kind: Annotation["kind"]) => selected?.kind === kind;
  const textSrc = isSel("text") && selected?.kind === "text" ? selected : null;

  /* ---------------- phase guards ---------------- */

  if (phase.status !== "ready") {
    return (
      <div className="flex flex-col gap-4">
        {phase.status === "empty" && (
          <>
            <PdfDropZone
              onFiles={(files) => {
                const first = files.find(
                  (f) => f.type === "application/pdf" || /\.pdf$/i.test(f.name),
                );
                if (first) void openFile(first);
              }}
            />
            <div className="flex flex-col items-center gap-1.5">
              <Button type="button" variant="ghost" size="sm" onClick={() => void loadSample()}>
                <FilePlus2 className="size-3.5" aria-hidden="true" />
                No file handy? Try a two-page sample
              </Button>
              <p className="text-[11.5px] text-muted-foreground">
                The editor works fully offline in your browser — fonts, OCR engine and all.
              </p>
            </div>
          </>
        )}

        {phase.status === "loading" && (
          <p className="flex items-center justify-center gap-2 py-8 text-[13px] text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Opening {phase.name}…
          </p>
        )}

        {phase.status === "password" && (
          <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
            <p className="flex items-center gap-2 text-[13px] font-semibold text-foreground">
              <Lock className="size-4 text-primary" aria-hidden="true" />
              This PDF is password-protected
            </p>
            {phase.wrong && (
              <p className="text-[12px] text-destructive">
                That password didn&apos;t open it — try again.
              </p>
            )}
            <p className="text-[12px] leading-relaxed text-muted-foreground">
              Enter the password to view and edit on top of it. The export of a protected file
              rebuilds each page as a high-quality image with your edits burned in (the
              password-protected content itself cannot be rewritten).
            </p>
            <div className="flex gap-2">
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void submitPassword()}
                placeholder="PDF password"
                aria-label="PDF password"
                autoComplete="off"
              />
              <Button type="button" onClick={() => void submitPassword()}>
                Open
              </Button>
            </div>
          </div>
        )}

        {phase.status === "error" && (
          <div className="flex flex-col gap-3 rounded-xl border border-destructive/40 bg-destructive/5 p-4">
            <p className="text-[13px] font-semibold text-destructive">
              {phase.name}: {phase.error}
            </p>
            <PdfDropZone
              onFiles={(files) => files[0] && void openFile(files[0])}
              compact
            />
          </div>
        )}
      </div>
    );
  }

  /* ---------------- ready: the workspace ---------------- */

  const pageAnnos = annos.filter((a) => a.page === page);
  const draftBox =
    drag?.mode === "create-box"
      ? {
          x: Math.min(drag.start.x, drag.cur.x),
          y: Math.min(drag.start.y, drag.cur.y),
          w: Math.abs(drag.cur.x - drag.start.x),
          h: Math.abs(drag.cur.y - drag.start.y),
        }
      : null;

  return (
    <div className="flex flex-col gap-4">
      {/* file chip + remove */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5">
        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-foreground">
          {docName}
        </span>
        {encrypted && (
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-400">
            <Lock className="size-3" aria-hidden="true" />
            Protected file
          </span>
        )}
        <span className="text-[12px] text-muted-foreground">{pageCount} page{pageCount > 1 ? "s" : ""}</span>
        <Button type="button" variant="ghost" size="sm" onClick={reset} className="gap-1.5 text-muted-foreground">
          <Trash2 className="size-3.5" aria-hidden="true" />
          Start over
        </Button>
      </div>

      {/* toolbar */}
      <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-3">
        <div className="flex gap-1.5 overflow-x-auto pb-0.5 sm:flex-wrap sm:overflow-visible">
          {TOOL_BUTTONS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setTool(t.id);
                if (t.id === "image") imageInputRef.current?.click();
                if (t.id === "signature") setSigOpen(true);
              }}
              aria-pressed={tool === t.id}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12px] font-semibold transition-colors ${
                tool === t.id
                  ? "border-primary bg-secondary text-foreground"
                  : "border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              <t.icon className="size-3.5" aria-hidden="true" />
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-2">
          <Button type="button" variant="outline" size="sm" onClick={undo} disabled={histLen.past === 0} aria-label="Undo">
            <Undo2 className="size-3.5" aria-hidden="true" />
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={redo} disabled={histLen.future === 0} aria-label="Redo">
            <Redo2 className="size-3.5" aria-hidden="true" />
          </Button>
          <span className="mx-1 h-5 w-px bg-border" aria-hidden="true" />
          <Button type="button" variant="outline" size="sm" onClick={() => setZoom(Math.max(0.2, scale / 1.25))} aria-label="Zoom out">
            <ZoomOut className="size-3.5" aria-hidden="true" />
          </Button>
          <span className="min-w-[3.2rem] text-center text-[12px] font-semibold text-muted-foreground">
            {Math.round(scale * 100)}%
          </span>
          <Button type="button" variant="outline" size="sm" onClick={() => setZoom(Math.min(4, scale * 1.25))} aria-label="Zoom in">
            <ZoomIn className="size-3.5" aria-hidden="true" />
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setZoom(null)}>
            <Maximize className="size-3.5" aria-hidden="true" />
            Fit
          </Button>
          <span className="mx-1 h-5 w-px bg-border" aria-hidden="true" />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            aria-label="Previous page"
          >
            <ChevronLeft className="size-3.5" aria-hidden="true" />
          </Button>
          <Input
            type="number"
            min={1}
            max={pageCount}
            value={page + 1}
            onChange={(e) => {
              const v = parseInt(e.target.value, 10);
              if (!Number.isNaN(v)) setPage(Math.min(pageCount - 1, Math.max(0, v - 1)));
            }}
            className="w-16 text-center"
            aria-label="Page number"
          />
          <span className="text-[12px] text-muted-foreground">of {pageCount}</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            disabled={page >= pageCount - 1}
            aria-label="Next page"
          >
            <ChevronRight className="size-3.5" aria-hidden="true" />
          </Button>
          {rendering && (
            <Loader2 className="size-3.5 animate-spin text-muted-foreground" aria-hidden="true" />
          )}
        </div>
      </div>

      {/* stage + side panels */}
      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="min-w-0 flex-1">
          <div
            ref={stageRef}
            className="max-h-[72vh] overflow-auto rounded-2xl border border-border bg-secondary/30 p-3"
          >
            <div className="mx-auto" style={{ width: cssSize.w || undefined }}>
              <div
                className="relative bg-white shadow-md"
                style={{ width: cssSize.w || 600, height: cssSize.h || 800 }}
              >
                <div ref={canvasHostRef} />
                <div
                  ref={overlayRef}
                  className="absolute inset-0 touch-none"
                  onPointerDown={onOverlayPointerDown}
                  onPointerMove={onOverlayPointerMove}
                  onPointerUp={onOverlayPointerUp}
                >
                  {/* svg shapes: rect / ellipse / line / ink */}
                  <svg
                    width="100%"
                    height="100%"
                    className="pointer-events-none absolute inset-0"
                    style={{ width: cssSize.w, height: cssSize.h }}
                  >
                    {pageAnnos
                      .filter((a): a is ShapeAnnotation => a.kind === "rect" || a.kind === "ellipse")
                      .map((a) =>
                        a.kind === "rect" ? (
                          <rect
                            key={a.id}
                            x={a.x * cssSize.w}
                            y={a.y * cssSize.h}
                            width={a.w * cssSize.w}
                            height={a.h * cssSize.h}
                            fill={a.fill ?? "none"}
                            stroke={a.stroke}
                            strokeWidth={a.strokeWidth * scale}
                            className="pointer-events-auto"
                            onPointerDown={(e) => beginAnnoDrag(e, a)}
                          />
                        ) : (
                          <ellipse
                            key={a.id}
                            cx={(a.x + a.w / 2) * cssSize.w}
                            cy={(a.y + a.h / 2) * cssSize.h}
                            rx={(a.w / 2) * cssSize.w}
                            ry={(a.h / 2) * cssSize.h}
                            fill={a.fill ?? "none"}
                            stroke={a.stroke}
                            strokeWidth={a.strokeWidth * scale}
                            className="pointer-events-auto"
                            onPointerDown={(e) => beginAnnoDrag(e, a)}
                          />
                        ),
                      )}
                    {pageAnnos
                      .filter((a): a is LineAnnotation => a.kind === "line")
                      .map((a) => (
                        <line
                          key={a.id}
                          x1={a.x1 * cssSize.w}
                          y1={a.y1 * cssSize.h}
                          x2={a.x2 * cssSize.w}
                          y2={a.y2 * cssSize.h}
                          stroke={a.stroke}
                          strokeWidth={Math.max(4, a.strokeWidth * scale)}
                          strokeLinecap="round"
                          strokeOpacity={0.01}
                          className="pointer-events-auto cursor-move"
                          onPointerDown={(e) => beginAnnoDrag(e, a)}
                        />
                      ))}
                    {pageAnnos
                      .filter((a): a is InkAnnotation => a.kind === "pen" || a.kind === "highlight")
                      .map((a) => (
                        <polyline
                          key={a.id}
                          points={a.points.map((p) => `${p.x * cssSize.w},${p.y * cssSize.h}`).join(" ")}
                          fill="none"
                          stroke={a.color}
                          strokeWidth={a.width * scale}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          opacity={a.kind === "highlight" ? 0.35 : 1}
                          className="pointer-events-auto"
                          onPointerDown={(e) => beginAnnoDrag(e, a)}
                        />
                      ))}
                    {/* invisible fat hit-lines for thin strokes */}
                    {pageAnnos
                      .filter((a): a is LineAnnotation | InkAnnotation => a.kind === "line" || a.kind === "pen")
                      .map((a) => {
                        const pts =
                          a.kind === "line"
                            ? [[a.x1, a.y1], [a.x2, a.y2]]
                            : a.points.map((p) => [p.x, p.y]);
                        return (
                          <polyline
                            key={`${a.id}-hit`}
                            points={pts.map(([x, y]) => `${x * cssSize.w},${y * cssSize.h}`).join(" ")}
                            fill="none"
                            stroke="transparent"
                            strokeWidth={14}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="pointer-events-auto cursor-move"
                            onPointerDown={(e) => beginAnnoDrag(e, a)}
                          />
                        );
                      })}
                  </svg>

                  {/* div annotations: text / whiteout / images */}
                  {pageAnnos
                    .filter((a): a is WhiteoutAnnotation => a.kind === "whiteout")
                    .map((a) => (
                      <div
                        key={a.id}
                        onPointerDown={(e) => beginAnnoDrag(e, a)}
                        className="absolute cursor-move"
                        style={{
                          left: a.x * cssSize.w,
                          top: a.y * cssSize.h,
                          width: a.w * cssSize.w,
                          height: a.h * cssSize.h,
                          backgroundColor: a.color,
                          outline: "1px dashed rgba(100,116,139,0.6)",
                        }}
                      />
                    ))}
                  {pageAnnos
                    .filter((a): a is ImageAnnotation => a.kind === "image" || a.kind === "signature")
                    .map((a) => (
                      <img
                        key={a.id}
                        src={a.url}
                        alt=""
                        draggable={false}
                        onPointerDown={(e) => beginAnnoDrag(e, a)}
                        className="absolute cursor-move"
                        style={{
                          left: a.x * cssSize.w,
                          top: a.y * cssSize.h,
                          width: a.w * cssSize.w,
                          height: a.h * cssSize.h,
                        }}
                      />
                    ))}
                  {pageAnnos
                    .filter((a): a is TextAnnotation => a.kind === "text")
                    .map((a) => {
                      const height = textBoxH(a) * cssSize.h;
                      return (
                        <textarea
                          key={a.id}
                          value={a.text}
                          readOnly={editingId !== a.id}
                          spellCheck={false}
                          wrap="off"
                          onChange={(e) => {
                            const text = e.target.value;
                            patchSelected({
                              text,
                              h: Math.max(0.02, (text.split("\n").length * TEXT_LINE_FACTOR * a.size) / pageHpt),
                            });
                          }}
                          onDoubleClick={() => {
                            setEditingId(a.id);
                            setSelectedId(a.id);
                          }}
                          onPointerDown={(e) => {
                            if (editingId === a.id) e.stopPropagation();
                            else beginAnnoDrag(e, a);
                          }}
                          onBlur={() => setEditingId((cur) => (cur === a.id ? null : cur))}
                          placeholder={editingId === a.id ? "Type…" : undefined}
                          className="absolute cursor-move overflow-hidden whitespace-pre bg-transparent"
                          style={{
                            left: a.x * cssSize.w,
                            top: a.y * cssSize.h,
                            width: a.w * cssSize.w,
                            height,
                            padding: 0,
                            border: "none",
                            outline: "none",
                            resize: "none",
                            fontSize: a.size * scale,
                            lineHeight: TEXT_LINE_FACTOR,
                            fontFamily: cssFontFamily(a.font),
                            fontWeight: a.bold ? 700 : 400,
                            fontStyle: a.italic ? "italic" : "normal",
                            color: a.color,
                            transform: `rotate(${-a.rotation}deg)`,
                            transformOrigin: "0 0",
                            pointerEvents: editingId === a.id ? "auto" : "none",
                          }}
                        />
                      );
                    })}

                  {/* creation preview */}
                  {draftBox &&
                    (drag?.mode === "create-box" && drag.tool === "whiteout" ? (
                      <div
                        className="absolute bg-white"
                        style={{
                          left: draftBox.x * cssSize.w,
                          top: draftBox.y * cssSize.h,
                          width: draftBox.w * cssSize.w,
                          height: draftBox.h * cssSize.h,
                          outline: "1px dashed rgba(100,116,139,0.6)",
                        }}
                      />
                    ) : (
                      <svg className="pointer-events-none absolute inset-0" style={{ width: cssSize.w, height: cssSize.h }}>
                        {drag?.mode === "create-box" && drag.tool === "rect" && (
                          <rect
                            x={draftBox.x * cssSize.w}
                            y={draftBox.y * cssSize.h}
                            width={draftBox.w * cssSize.w}
                            height={draftBox.h * cssSize.h}
                            fill={defaults.fill ?? "none"}
                            stroke={defaults.stroke}
                            strokeWidth={defaults.strokeWidth * scale}
                          />
                        )}
                        {drag?.mode === "create-box" && drag.tool === "ellipse" && (
                          <ellipse
                            cx={(draftBox.x + draftBox.w / 2) * cssSize.w}
                            cy={(draftBox.y + draftBox.h / 2) * cssSize.h}
                            rx={(draftBox.w / 2) * cssSize.w}
                            ry={(draftBox.h / 2) * cssSize.h}
                            fill={defaults.fill ?? "none"}
                            stroke={defaults.stroke}
                            strokeWidth={defaults.strokeWidth * scale}
                          />
                        )}
                        {drag?.mode === "create-line" && (
                          <line
                            x1={drag.start.x * cssSize.w}
                            y1={drag.start.y * cssSize.h}
                            x2={drag.cur.x * cssSize.w}
                            y2={drag.cur.y * cssSize.h}
                            stroke={defaults.stroke}
                            strokeWidth={defaults.strokeWidth * scale}
                            strokeLinecap="round"
                          />
                        )}
                      </svg>
                    ))}
                  {drag?.mode === "ink" && (
                    <svg className="pointer-events-none absolute inset-0" style={{ width: cssSize.w, height: cssSize.h }}>
                      <polyline
                        points={drag.points.map((p) => `${p.x * cssSize.w},${p.y * cssSize.h}`).join(" ")}
                        fill="none"
                        stroke={drag.kind === "pen" ? defaults.penColor : defaults.highlightColor}
                        strokeWidth={(drag.kind === "pen" ? defaults.penWidth : defaults.highlightWidth) * scale}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        opacity={drag.kind === "highlight" ? 0.35 : 1}
                      />
                    </svg>
                  )}

                  {/* selection outline + handles */}
                  {selected && selBBox && (
                    <>
                      <div
                        className="pointer-events-none absolute border-2 border-primary/80"
                        style={{
                          left: selBBox.x * cssSize.w - 2,
                          top: selBBox.y * cssSize.h - 2,
                          width: selBBox.w * cssSize.w + 4,
                          height: selBBox.h * cssSize.h + 4,
                        }}
                      />
                      {"w" in selected && (
                        <>
                          {(["nw", "ne", "sw", "se"] as const).map((dir) => (
                            <button
                              key={dir}
                              type="button"
                              aria-label={`Resize ${dir}`}
                              onPointerDown={(e) => beginResize(e, dir)}
                              className="absolute size-3 rounded-full border-2 border-primary bg-card"
                              style={{
                                left: (dir.includes("w") ? selBBox.x : selBBox.x + selBBox.w) * cssSize.w - 6,
                                top: (dir.includes("n") ? selBBox.y : selBBox.y + selBBox.h) * cssSize.h - 6,
                                cursor: `${dir}-resize`,
                              }}
                            />
                          ))}
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* side panels */}
        <aside className="w-full shrink-0 lg:w-[300px]">
          <div className="mb-2 flex gap-1">
            {(
              [
                { id: "props", label: "Style", show: true },
                { id: "form", label: `Form fields${formFields.length ? ` (${formFields.length})` : ""}`, show: formFields.length > 0 },
                { id: "ocr", label: "OCR", show: true },
              ] as const
            )
              .filter((t) => t.show)
              .map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  aria-pressed={tab === t.id}
                  className={`rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                    tab === t.id
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t.label}
                </button>
              ))}
          </div>

          {tab === "props" && (
            <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
              <p className="text-[12px] font-bold text-foreground">
                {selected
                  ? `Selected: ${TOOL_BUTTONS.find((t) => t.id === (selected.kind === "signature" ? "signature" : selected.kind))?.label ?? selected.kind}`
                  : `Defaults: ${TOOL_BUTTONS.find((t) => t.id === tool)?.label ?? tool}`}
              </p>

              {selected && (
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={duplicateSelected}>
                    <Copy className="size-3.5" aria-hidden="true" />
                    Duplicate
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={deleteSelected} className="text-destructive">
                    <Trash2 className="size-3.5" aria-hidden="true" />
                    Delete
                  </Button>
                </div>
              )}

              {(isSel("text") || (!selected && tool === "text")) && (
                <>
                    <div className="flex items-center justify-between gap-2">
                      <Label htmlFor="pe-font" className="text-[12px]">Font</Label>
                      <select
                        id="pe-font"
                        value={textSrc?.font ?? defaults.font}
                        onChange={(e) => {
                          const font = e.target.value as TextFont;
                          if (textSrc) patchSelected({ font, italic: false });
                          patchDefaults({ font, italic: false });
                        }}
                        className="h-8 rounded-md border border-border bg-card px-2 text-[12px]"
                      >
                        <option value="Helvetica">Helvetica</option>
                        <option value="Times">Times</option>
                        <option value="Courier">Courier</option>
                        <option value="Noto">Noto Sans (world scripts)</option>
                      </select>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <Label htmlFor="pe-size" className="text-[12px]">Size: {textSrc?.size ?? defaults.size} pt</Label>
                      <input
                        id="pe-size"
                        type="range"
                        min={6}
                        max={72}
                        value={textSrc?.size ?? defaults.size}
                        onChange={(e) => {
                          const size = parseInt(e.target.value, 10);
                          if (textSrc) {
                            patchSelected({ size, h: Math.max(0.02, (textSrc.text.split("\n").length * TEXT_LINE_FACTOR * size) / pageHpt) });
                          }
                          patchDefaults({ size });
                        }}
                        className="w-28"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant={((textSrc?.bold ?? defaults.bold) ? "default" : "outline")}
                        size="sm"
                        onClick={() => {
                          const bold = !(textSrc?.bold ?? defaults.bold);
                          if (textSrc) patchSelected({ bold });
                          patchDefaults({ bold });
                        }}
                        className="h-8 flex-1 font-bold"
                      >
                        B
                      </Button>
                      <Button
                        type="button"
                        variant={((textSrc?.italic ?? defaults.italic) ? "default" : "outline")}
                        size="sm"
                        onClick={() => {
                          const italic = !(textSrc?.italic ?? defaults.italic);
                          if (textSrc) patchSelected({ italic });
                          patchDefaults({ italic });
                        }}
                        disabled={(textSrc?.font ?? defaults.font) === "Noto"}
                        className="h-8 flex-1 italic"
                      >
                        I
                      </Button>
                      <ColorField
                        label="Colour"
                        value={textSrc?.color ?? defaults.textColor}
                        onChange={(v) => {
                          if (textSrc) patchSelected({ color: v });
                          patchDefaults({ textColor: v });
                        }}
                      />
                    </div>
                    <p className="text-[11px] leading-relaxed text-muted-foreground">
                      Double-click the text to edit it. Lines don&apos;t reflow — press Enter
                      for a new line, exactly what gets burned in.
                    </p>
                  </>
              )}

              {(isSel("whiteout") || (!selected && tool === "whiteout")) && (
                <ColorField
                  label="Cover colour"
                  value={isSel("whiteout") && selected?.kind === "whiteout" ? selected.color : defaults.whiteoutColor}
                  onChange={(v) => {
                    if (isSel("whiteout")) patchSelected({ color: v });
                    patchDefaults({ whiteoutColor: v });
                  }}
                />
              )}

              {(isSel("rect") || isSel("ellipse") || isSel("line") || (!selected && (tool === "rect" || tool === "ellipse" || tool === "line"))) && (
                <>
                  <ColorField
                    label="Stroke"
                    value={selected && "stroke" in selected ? selected.stroke : defaults.stroke}
                    onChange={(v) => {
                      if (selected && "stroke" in selected) patchSelected({ stroke: v });
                      patchDefaults({ stroke: v });
                    }}
                  />
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="pe-sw" className="text-[12px]">Width: {selected && "strokeWidth" in selected ? selected.strokeWidth : defaults.strokeWidth} pt</Label>
                    <input
                      id="pe-sw"
                      type="range"
                      min={0.5}
                      max={12}
                      step={0.5}
                      value={selected && "strokeWidth" in selected ? selected.strokeWidth : defaults.strokeWidth}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value);
                        if (selected && "strokeWidth" in selected) patchSelected({ strokeWidth: v });
                        patchDefaults({ strokeWidth: v });
                      }}
                      className="w-28"
                    />
                  </div>
                  {(isSel("rect") || isSel("ellipse") || (!selected && (tool === "rect" || tool === "ellipse"))) && (
                    <div className="flex items-center justify-between gap-2">
                      <Label htmlFor="pe-fill" className="text-[12px]">Fill</Label>
                      <div className="flex items-center gap-1.5">
                        <input
                          id="pe-fill"
                          type="checkbox"
                          checked={selected && "fill" in selected ? selected.fill !== null : defaults.fill !== null}
                          onChange={(e) => {
                            const on = e.target.checked;
                            const value = on ? "#fde68a" : null;
                            if (selected && "fill" in selected) patchSelected({ fill: value });
                            patchDefaults({ fill: value });
                          }}
                          className="size-4"
                        />
                        <input
                          type="color"
                          value={selected && "fill" in selected && selected.fill ? selected.fill : "#fde68a"}
                          onChange={(e) => {
                            if (selected && "fill" in selected) patchSelected({ fill: e.target.value });
                            patchDefaults({ fill: e.target.value });
                          }}
                          aria-label="Fill colour"
                          className="h-7 w-10 cursor-pointer rounded border border-border bg-card"
                        />
                      </div>
                    </div>
                  )}
                </>
              )}

              {(isSel("pen") || (!selected && tool === "pen")) && (
                <ColorField
                  label="Ink"
                  value={isSel("pen") && selected?.kind === "pen" ? selected.color : defaults.penColor}
                  onChange={(v) => {
                    if (isSel("pen")) patchSelected({ color: v });
                    patchDefaults({ penColor: v });
                  }}
                />
              )}

              {(isSel("highlight") || (!selected && tool === "highlight")) && (
                <ColorField
                  label="Highlighter"
                  value={isSel("highlight") && selected?.kind === "highlight" ? selected.color : defaults.highlightColor}
                  onChange={(v) => {
                    if (isSel("highlight")) patchSelected({ color: v });
                    patchDefaults({ highlightColor: v });
                  }}
                />
              )}

              {!selected && tool === "select" && (
                <p className="text-[12px] leading-relaxed text-muted-foreground">
                  Click any annotation to select it — drag to move, corner dots to resize.
                  Delete key removes it; Ctrl/Cmd+Z is undo.
                </p>
              )}
            </div>
          )}

          {tab === "form" && (
            <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
              <p className="text-[12px] font-bold text-foreground">Fillable form fields</p>
              {previewUpdating && (
                <p className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
                  <Loader2 className="size-3 animate-spin" aria-hidden="true" />
                  Updating the live preview…
                </p>
              )}
              {formFields.map((f) => (
                <div key={f.name} className="flex flex-col gap-1">
                  {f.kind === "text" && (
                    <>
                      <Label htmlFor={`ff-${f.name}`} className="truncate text-[11.5px] text-muted-foreground">{f.name}</Label>
                      <Input
                        id={`ff-${f.name}`}
                        value={typeof formValues[f.name] === "string" ? (formValues[f.name] as string) : ""}
                        onChange={(e) => setFormValue(f.name, e.target.value)}
                        className="h-8"
                      />
                    </>
                  )}
                  {f.kind === "checkbox" && (
                    <label className="flex items-center gap-2 text-[12px] text-foreground">
                      <input
                        type="checkbox"
                        checked={formValues[f.name] === true}
                        onChange={(e) => setFormValue(f.name, e.target.checked)}
                        className="size-4"
                      />
                      <span className="truncate">{f.name}</span>
                    </label>
                  )}
                  {(f.kind === "dropdown" || f.kind === "radio") && (
                    <>
                      <Label htmlFor={`ff-${f.name}`} className="truncate text-[11.5px] text-muted-foreground">{f.name}</Label>
                      <select
                        id={`ff-${f.name}`}
                        value={typeof formValues[f.name] === "string" ? (formValues[f.name] as string) : ""}
                        onChange={(e) => setFormValue(f.name, e.target.value)}
                        className="h-8 rounded-md border border-border bg-card px-2 text-[12px]"
                      >
                        <option value="">—</option>
                        {(f.options ?? []).map((o) => (
                          <option key={o} value={o}>{o}</option>
                        ))}
                      </select>
                    </>
                  )}
                  {f.kind === "other" && (
                    <p className="text-[11.5px] text-muted-foreground">{f.name} (not fillable here)</p>
                  )}
                </div>
              ))}
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Values go straight into the real form fields on export. Tick “flatten form
                fields” below to make the answers permanent text.
              </p>
            </div>
          )}

          {tab === "ocr" && (
            <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
              <p className="text-[12px] font-bold text-foreground">OCR — read scanned pages</p>
              <p className="text-[11.5px] leading-relaxed text-muted-foreground">
                English recognition, running entirely on your device. The engine (~10 MB)
                is part of this site and cached after the first use — no CDN, no upload.
              </p>
              {ocrRun ? (
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
                    <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                    {ocrRun.status === "loading-engine"
                      ? "Loading the OCR engine…"
                      : ocrRun.status === "loading-language"
                        ? "Loading the language data…"
                        : ocrRun.status === "initialising"
                          ? "Starting up…"
                          : `Recognising page ${ocrRun.done + 1}…`}{" "}
                    ({ocrRun.done}/{ocrRun.total})
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${ocrRun.total ? (ocrRun.done / ocrRun.total) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => void runOcr("page")}>
                    <ScanText className="size-3.5" aria-hidden="true" />
                    OCR page {page + 1}
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => void runOcr("all")} disabled={pageCount < 2}>
                    <ScanText className="size-3.5" aria-hidden="true" />
                    All pages
                  </Button>
                </div>
              )}
              {Object.keys(ocrResults).length > 0 && (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-[12px] font-bold text-foreground">Recognised lines</p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const text = Object.keys(ocrResults)
                          .sort((a, b) => Number(a) - Number(b))
                          .map((p) => ocrResults[Number(p)].map((l) => l.text).join("\n"))
                          .join("\n\n");
                        void navigator.clipboard.writeText(text);
                        toast.success("All recognised text copied to the clipboard.");
                      }}
                    >
                      Copy all
                    </Button>
                  </div>
                  <div className="flex max-h-[300px] flex-col gap-1.5 overflow-y-auto">
                    {Object.keys(ocrResults)
                      .sort((a, b) => Number(a) - Number(b))
                      .flatMap((p) => {
                        const lines = ocrResults[Number(p)];
                        return lines.length === 0
                          ? [
                              <p key={`p${p}`} className="text-[11.5px] text-muted-foreground">
                                Page {Number(p) + 1}: nothing recognised.
                              </p>,
                            ]
                          : lines.map((line, i) => (
                              <div
                                key={`p${p}l${i}`}
                                className="flex items-start gap-2 rounded-lg border border-border px-2 py-1.5"
                              >
                                <span
                                  className={`mt-0.5 shrink-0 rounded px-1 py-0.5 text-[10px] font-bold ${
                                    line.confidence >= 85
                                      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                                      : line.confidence >= 60
                                        ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                                        : "bg-destructive/15 text-destructive"
                                  }`}
                                >
                                  {line.confidence}
                                </span>
                                <span className="min-w-0 flex-1 text-[11.5px] leading-relaxed text-foreground">
                                  <span className="mr-1 text-[10px] font-semibold text-muted-foreground">
                                    p{Number(p) + 1}
                                  </span>
                                  {line.text}
                                </span>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 shrink-0 px-2 text-[11px]"
                                  onClick={() => replaceOcrLine(Number(p), line)}
                                >
                                  Replace
                                </Button>
                              </div>
                            ));
                      })}
                  </div>
                </>
              )}
            </div>
          )}
        </aside>
      </div>

      {/* export panel */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
        <p className="text-[12px] font-bold text-foreground">Export</p>
        {encrypted && (
          <p className="flex items-start gap-1.5 text-[11.5px] leading-relaxed text-amber-700 dark:text-amber-400">
            <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            This file is password-protected, so the export rebuilds every page as a
            high-quality image with your edits burned in — visually identical, text no
            longer selectable.
          </p>
        )}
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-[12px] text-foreground">
            <input
              type="checkbox"
              checked={flattenForms}
              onChange={(e) => setFlattenForms(e.target.checked)}
              disabled={encrypted || formFields.length === 0}
              className="size-4"
            />
            Flatten form fields into the page
          </label>
          <label className="flex items-center gap-2 text-[12px] text-foreground">
            <input
              type="checkbox"
              checked={rasterizeAll || encrypted}
              onChange={(e) => setRasterizeAll(e.target.checked)}
              disabled={encrypted}
              className="size-4"
            />
            Flatten every page to an image (tamper-proof)
          </label>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[220px] flex-1">
            <Label htmlFor="pe-filename">File name</Label>
            <Input id="pe-filename" value={fileName} onChange={(e) => setFileName(e.target.value)} className="mt-1" />
          </div>
          <Button type="button" onClick={() => void runExport()} disabled={exporting}>
            {exporting ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                {exportStep || "Working…"}
              </>
            ) : (
              <>
                <FileDown className="size-4" aria-hidden="true" />
                Export edited PDF
              </>
            )}
          </Button>
        </div>
      </div>

      <ResultsPanel files={results} zipName="edited-pdf.zip" />

      {results.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[12px] font-semibold text-muted-foreground">Next steps:</span>
          {[
            { id: "split-pdf", label: "Split it" },
            { id: "compress-pdf", label: "Compress it" },
            { id: "merge-pdf", label: "Merge more files" },
            { id: "extract-pdf-text", label: "Copy its text" },
          ].map((t) => (
            <Link
              key={t.id}
              href={`/tools/${t.id}`}
              className="rounded-full border border-border bg-card px-3 py-1.5 text-[12px] font-semibold text-foreground transition hover:border-primary"
            >
              {t.label}
            </Link>
          ))}
        </div>
      )}

      {/* image picker (hidden) */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/png,image/jpeg"
        className="hidden"
        onChange={(e) => {
          void onImagePicked(e.target.files);
          e.target.value = "";
        }}
      />

      {/* signature pad */}
      {sigOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setSigOpen(false)}
        >
          <div
            className="w-full max-w-[540px] rounded-2xl border border-border bg-card p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display text-[15px] font-bold text-foreground">Draw your signature</h3>
            <canvas
              ref={sigCanvasRef}
              width={960}
              height={400}
              onPointerDown={sigDown}
              onPointerMove={sigMove}
              onPointerUp={sigUp}
              className="mt-3 w-full cursor-crosshair rounded-xl border border-border bg-white"
              style={{ touchAction: "none" }}
            />
            <p className="mt-2 text-[11.5px] leading-relaxed text-muted-foreground">
              Draw with mouse, pen or finger. The signature is placed as a transparent image
              you can drag, resize and delete. Prefer a scanned signature? Use the Image tool.
            </p>
            <div className="mt-3 flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setSigOpen(false)}>
                Cancel
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => {
                const ctx = sigCanvasRef.current?.getContext("2d");
                const canvas = sigCanvasRef.current;
                if (ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height);
              }}>
                Clear
              </Button>
              <Button type="button" onClick={insertSignature}>
                Insert signature
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
