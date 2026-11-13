/**
 * FreeSeak — the tool catalogue.
 *
 * This file is the single source of truth for the whole site:
 * the homepage grid, the search index, the footer links, the
 * related-tools lists and (once deployed with per-tool pages)
 * the sitemap are ALL generated from this list.
 *
 * Adding a tool = add one entry here + one component in
 * components/tools + one line in tool-registry. Nothing else.
 */

export type CategoryId = "pdf" | "image" | "calc" | "prod";

export interface FaqItem {
  q: string;
  a: string;
}

export interface ToolDef {
  id: string;
  name: string;
  short: string;
  category: CategoryId;
  /** lucide icon key, see components/site/tool-icon.tsx */
  icon: string;
  /** synonym map for search — people search in verbs and problems */
  keywords: string;
  /** a working component exists in tool-registry */
  ready: boolean;
  intro?: string;
  howTo?: string[];
  faq?: FaqItem[];
}

export const CATEGORIES: { id: CategoryId | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "pdf", label: "PDF & Documents" },
  { id: "image", label: "Image Tools" },
  { id: "calc", label: "Calculators" },
  { id: "prod", label: "Productivity & Business" },
];

export const CATEGORY_LABEL: Record<CategoryId, string> = {
  pdf: "PDF & Documents",
  image: "Image Tools",
  calc: "Calculators",
  prod: "Productivity & Business",
};

export const TOOLS: ToolDef[] = [
  {
    id: "qr-generator",
    name: "QR Code Generator",
    short: "Create QR codes for links, text and Wi-Fi — download as PNG or SVG.",
    category: "prod",
    icon: "qr",
    keywords:
      "qr code generator make qr code create qr barcode scan link wifi text url",
    ready: true,
    intro:
      "Type any link or text, watch the QR code build itself instantly, and download it in print quality. The whole thing happens on your device — nothing is uploaded, nothing expires.",
    howTo: [
      "Type or paste the link or text you want to encode.",
      "Pick a size, error-correction level and colours — the preview updates as you go.",
      "Download your QR code as a PNG for quick use, or an SVG for perfect print quality.",
    ],
    faq: [
      {
        q: "Is this QR code generator really free?",
        a: "Yes — unlimited codes, unlimited downloads, no account, no watermark. FreeSeak tools run in your browser, so generating a QR code costs us nothing to serve.",
      },
      {
        q: "Do the QR codes I create ever expire?",
        a: "Never. These are static QR codes — the content is encoded directly into the image, so there is no server that could go away. A code you print today still works in ten years.",
      },
      {
        q: "Can I use the codes commercially?",
        a: "Yes. QR codes you generate are yours — use them on business cards, menus, packaging or posters with no restrictions.",
      },
    ],
  },
  {
    id: "word-counter",
    name: "Word Counter",
    short: "Count words, characters and sentences live as you type.",
    category: "prod",
    icon: "type",
    keywords:
      "word counter word count character count count words text counter sentences paragraphs reading time",
    ready: true,
    intro:
      "Paste or type your text and see words, characters, sentences and reading time update instantly. Handy for essays, tweets, meta descriptions and job applications — your text never leaves the page.",
    howTo: [
      "Type or paste your text into the box.",
      "Watch every number update live as you edit.",
      "Use Clear to start over — nothing is stored anywhere.",
    ],
    faq: [
      {
        q: "Is my text uploaded anywhere?",
        a: "No. Counting happens in your browser as you type. Close the tab and everything is gone — there is no server copy, ever.",
      },
      {
        q: "How is reading time calculated?",
        a: "At an average silent-reading pace of 200 words per minute, which is the standard used by most publishers.",
      },
    ],
  },
  {
    id: "percentage-calculator",
    name: "Percentage Calculator",
    short: "Percentages of numbers, shares and percentage change — instantly.",
    category: "calc",
    icon: "percent",
    keywords:
      "percentage calculator percent of a number what percent increase decrease discount percent change",
    ready: true,
    intro:
      "The three percentage questions everyone has, answered instantly: what is X% of Y, X is what percent of Y, and how big is the change from X to Y. No formulas to remember.",
    howTo: [
      "Pick the question that matches your problem — all three are on the page.",
      "Type your two numbers.",
      "Read the answer — it updates as you type, no calculate button needed.",
    ],
    faq: [
      {
        q: "How do I calculate a discount?",
        a: "Use the first card: enter the discount as the percentage and the original price as the number — the result is how much you save. Subtract it from the price for the sale price.",
      },
      {
        q: "What is percentage change good for?",
        a: "Price rises, salary changes, growth figures — any before/after comparison. A positive result is an increase, a negative one a decrease.",
      },
    ],
  },
  {
    id: "age-calculator",
    name: "Age Calculator",
    short: "Exact age in years, months and days — plus your next birthday.",
    category: "calc",
    icon: "cake",
    keywords:
      "age calculator how old am i birthday calculator date of birth age in years months days next birthday",
    ready: true,
    intro:
      "Enter a date of birth and get the exact age in years, months and days, plus a countdown to the next birthday. Precise enough for official forms that ask for exact age.",
    howTo: [
      "Pick the date of birth.",
      "Read the exact age in years, months and days.",
      "Check the line below for how long until the next birthday.",
    ],
    faq: [
      {
        q: "Which birthdays does it count correctly?",
        a: "All of them — including leap-year babies: February 29 is handled explicitly, and ages are computed with real calendar month lengths.",
      },
      {
        q: "Why do forms ask for age in years, months and days?",
        a: "School admissions, visas and some medical forms require exact age on a specific date. This calculator gives you that number for today.",
      },
    ],
  },
  {
    id: "compress-pdf",
    name: "Compress PDF",
    short: "Shrink PDF file size right in your browser — no uploads.",
    category: "pdf",
    icon: "file-down",
    keywords: "compress pdf make pdf smaller reduce pdf size shrink pdf",
    ready: false,
  },
  {
    id: "merge-pdf",
    name: "Merge PDF",
    short: "Combine multiple PDFs into one tidy document.",
    category: "pdf",
    icon: "file-stack",
    keywords: "merge pdf combine pdf join pdf put pdfs together",
    ready: false,
  },
  {
    id: "split-pdf",
    name: "Split PDF",
    short: "Extract or remove the pages you don't need.",
    category: "pdf",
    icon: "scissors",
    keywords: "split pdf extract pages remove pages separate pdf",
    ready: false,
  },
  {
    id: "jpg-to-pdf",
    name: "JPG to PDF",
    short: "Turn photos into a single PDF document.",
    category: "pdf",
    icon: "file-image",
    keywords: "jpg to pdf image to pdf photo to pdf png to pdf",
    ready: false,
  },
  {
    id: "pdf-to-jpg",
    name: "PDF to JPG",
    short: "Save PDF pages as image files.",
    category: "pdf",
    icon: "file-output",
    keywords: "pdf to jpg pdf to image save pdf as image",
    ready: false,
  },
  {
    id: "compress-image",
    name: "Compress Image",
    short: "Reduce JPG, PNG and WebP file size instantly.",
    category: "image",
    icon: "image-down",
    keywords: "compress image reduce image size shrink photo compress jpg png webp",
    ready: false,
  },
  {
    id: "resize-image",
    name: "Resize Image",
    short: "Resize and convert images to any dimensions.",
    category: "image",
    icon: "scaling",
    keywords: "resize image change image size photo resizer dimensions",
    ready: false,
  },
  {
    id: "invoice-generator",
    name: "Invoice Generator",
    short: "Build a clean, printable invoice in a minute.",
    category: "prod",
    icon: "receipt",
    keywords: "invoice generator bill receipt quotation make invoice",
    ready: false,
  },
];

export function getTool(id: string): ToolDef | undefined {
  return TOOLS.find((t) => t.id === id);
}

export const READY_TOOLS = TOOLS.filter((t) => t.ready);
