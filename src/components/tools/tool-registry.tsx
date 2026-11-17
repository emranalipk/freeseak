"use client";

import type { ComponentType } from "react";
import nextDynamic from "next/dynamic";

/**
 * The tool registry: one line per working tool.
 * Every catalogue entry (lib/tools.ts) MUST have a component here.
 *
 * v1.0.0: tool bodies load via next/dynamic — a tool page ships only its
 * own engine instead of one shared chunk containing all 22 (pdf-lib,
 * pdf.js glue, tesseract wiring, qrcode …). The tools are client
 * components with named exports, so each loader re-wraps the module as
 * the default export next/dynamic expects. Static export prerenders the
 * (null) loading shell; hydration pulls the tool's own chunk on demand.
 */

function tool(load: () => Promise<{ default: ComponentType }>): ComponentType {
  return nextDynamic(load, { loading: () => null, ssr: false });
}

export const TOOL_COMPONENTS: Record<string, ComponentType> = {
  "qr-generator": tool(() =>
    import("./qr-generator").then((m) => ({ default: m.QrGenerator })),
  ),
  "word-counter": tool(() =>
    import("./word-counter").then((m) => ({ default: m.WordCounter })),
  ),
  "percentage-calculator": tool(() =>
    import("./percentage-calculator").then((m) => ({ default: m.PercentageCalculator })),
  ),
  "age-calculator": tool(() =>
    import("./age-calculator").then((m) => ({ default: m.AgeCalculator })),
  ),
  "compress-image": tool(() =>
    import("./image-compressor").then((m) => ({ default: m.ImageCompressor })),
  ),
  "resize-image": tool(() =>
    import("./image-resizer").then((m) => ({ default: m.ImageResizer })),
  ),
  "enhance-image": tool(() =>
    import("./enhance-image/enhance-tool").then((m) => ({ default: m.EnhanceTool })),
  ),
  "convert-image": tool(() =>
    import("./convert-image").then((m) => ({ default: m.ImageConverter })),
  ),
  "crop-image": tool(() =>
    import("./crop-image").then((m) => ({ default: m.ImageCropper })),
  ),
  "favicon-generator": tool(() =>
    import("./favicon-generator").then((m) => ({ default: m.FaviconGenerator })),
  ),
  "merge-pdf": tool(() =>
    import("./merge-pdf").then((m) => ({ default: m.MergePdf })),
  ),
  "split-pdf": tool(() =>
    import("./split-pdf").then((m) => ({ default: m.SplitPdf })),
  ),
  "images-to-pdf": tool(() =>
    import("./images-to-pdf").then((m) => ({ default: m.ImagesToPdf })),
  ),
  "pdf-to-images": tool(() =>
    import("./pdf-to-images").then((m) => ({ default: m.PdfToImages })),
  ),
  "organize-pdf-pages": tool(() =>
    import("./organize-pages").then((m) => ({ default: m.OrganizePages })),
  ),
  "add-page-numbers": tool(() =>
    import("./add-page-numbers").then((m) => ({ default: m.AddPageNumbers })),
  ),
  "watermark-pdf": tool(() =>
    import("./watermark-pdf").then((m) => ({ default: m.WatermarkPdf })),
  ),
  "extract-pdf-text": tool(() =>
    import("./extract-pdf-text").then((m) => ({ default: m.ExtractPdfText })),
  ),
  "edit-pdf-metadata": tool(() =>
    import("./edit-pdf-metadata").then((m) => ({ default: m.EditPdfMetadata })),
  ),
  "compress-pdf": tool(() =>
    import("./compress-pdf").then((m) => ({ default: m.CompressPdf })),
  ),
  "edit-pdf": tool(() =>
    import("./pdf-editor").then((m) => ({ default: m.PdfEditor })),
  ),
  "punjab-registry-estimator": tool(() =>
    import("./punjab-registry-estimator").then((m) => ({ default: m.PunjabRegistryEstimator })),
  ),
};
