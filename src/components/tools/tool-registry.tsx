"use client";

import type { ComponentType } from "react";
import { QrGenerator } from "./qr-generator";
import { WordCounter } from "./word-counter";
import { PercentageCalculator } from "./percentage-calculator";
import { AgeCalculator } from "./age-calculator";
import { ImageCompressor } from "./image-compressor";
import { ImageResizer } from "./image-resizer";

/**
 * The tool registry: one line per working tool.
 * A catalogue entry (lib/tools.ts) with ready: true MUST have a component here.
 */
export const TOOL_COMPONENTS: Record<string, ComponentType> = {
  "qr-generator": QrGenerator,
  "word-counter": WordCounter,
  "percentage-calculator": PercentageCalculator,
  "age-calculator": AgeCalculator,
  "compress-image": ImageCompressor,
  "resize-image": ImageResizer,
};
