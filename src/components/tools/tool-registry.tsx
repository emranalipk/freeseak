"use client";

import type { ComponentType } from "react";
import { QrGenerator } from "./qr-generator";
import { WordCounter } from "./word-counter";
import { PercentageCalculator } from "./percentage-calculator";
import { AgeCalculator } from "./age-calculator";
import { ImageCompressor } from "./image-compressor";
import { ImageResizer } from "./image-resizer";
import { EnhanceTool } from "./enhance-image/enhance-tool";
import { ImageConverter } from "./convert-image";
import { ImageCropper } from "./crop-image";
import { FaviconGenerator } from "./favicon-generator";
import { MergePdf } from "./merge-pdf";
import { SplitPdf } from "./split-pdf";
import { ImagesToPdf } from "./images-to-pdf";
import { PdfToImages } from "./pdf-to-images";
import { OrganizePages } from "./organize-pages";
import { AddPageNumbers } from "./add-page-numbers";
import { WatermarkPdf } from "./watermark-pdf";
import { ExtractPdfText } from "./extract-pdf-text";
import { EditPdfMetadata } from "./edit-pdf-metadata";
import { CompressPdf } from "./compress-pdf";

/**
 * The tool registry: one line per working tool.
 * Every catalogue entry (lib/tools.ts) MUST have a component here.
 */
export const TOOL_COMPONENTS: Record<string, ComponentType> = {
  "qr-generator": QrGenerator,
  "word-counter": WordCounter,
  "percentage-calculator": PercentageCalculator,
  "age-calculator": AgeCalculator,
  "compress-image": ImageCompressor,
  "resize-image": ImageResizer,
  "enhance-image": EnhanceTool,
  "convert-image": ImageConverter,
  "crop-image": ImageCropper,
  "favicon-generator": FaviconGenerator,
  "merge-pdf": MergePdf,
  "split-pdf": SplitPdf,
  "images-to-pdf": ImagesToPdf,
  "pdf-to-images": PdfToImages,
  "organize-pdf-pages": OrganizePages,
  "add-page-numbers": AddPageNumbers,
  "watermark-pdf": WatermarkPdf,
  "extract-pdf-text": ExtractPdfText,
  "edit-pdf-metadata": EditPdfMetadata,
  "compress-pdf": CompressPdf,
};
