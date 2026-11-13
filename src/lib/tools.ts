/**
 * FreeSeak — the tool catalogue.
 *
 * This file is the single source of truth for the whole site:
 * the homepage grid, the search index, the footer links, the related-tools
 * lists, the sitemap and every tool page's SEO (title source, meta
 * description, intro copy, FAQ) are ALL generated from this list.
 *
 * Adding a tool = add one entry here + one component in
 * components/tools + one line in tool-registry. Nothing else.
 *
 * v0.3 SEO notes (see PROJECT_RULES.md rule 4):
 * - `short` doubles as the meta description: keep it 130-155 characters,
 *   lead with the primary keyword, end with the differentiators
 *   (free / no sign-up / nothing uploaded).
 * - `keywords` covers how people actually search: verbs and problems
 *   ("make pdf smaller"), not just tool names.
 * - every live tool carries intro + how-to + 3-4 FAQs (PAA-style
 *   questions) — this is the content depth that earns rankings.
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
    short:
      "Free online QR code generator for links, text and Wi-Fi. Download as PNG or SVG — no sign-up, no watermark, no expiry.",
    category: "prod",
    icon: "qr",
    keywords:
      "qr code generator free qr code generator make a qr code create qr code online qr maker wifi qr code qr code for a link url qr code png svg download no watermark no sign up static qr code qr code for menu business card",
    ready: true,
    intro:
      "Create a free QR code in seconds. Type a link, plain text or Wi-Fi details, watch the QR code build itself live, and download it in print quality as a PNG or a scalable SVG. Everything is generated on your device — no sign-up, no watermark, and no expiry: these are static QR codes, so the data is encoded directly into the image and works forever, even offline.",
    howTo: [
      "Type or paste the link, text or Wi-Fi details you want to encode.",
      "Pick a size and error-correction level, and set your colours — the preview updates as you go.",
      "Download your QR code as a PNG for quick use, or an SVG for perfect print quality at any size.",
    ],
    faq: [
      {
        q: "Is this QR code generator really free?",
        a: "Yes — unlimited codes, unlimited downloads, no account, no watermark. FreeSeak tools run in your browser, so generating a QR code costs nothing to serve.",
      },
      {
        q: "Do the QR codes I create ever expire?",
        a: "Never. These are static QR codes — the content is encoded directly into the image, so there is no server that could go away. A code you print today still works in ten years.",
      },
      {
        q: "What is the difference between static and dynamic QR codes?",
        a: "A static QR code encodes your text or link directly into the image — it works forever but cannot be changed afterwards. A dynamic QR code points at a redirect service that can be updated, but it stops working the day that service shuts down. FreeSeak generates static codes: what you print is what it does, permanently.",
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
    short:
      "Free online word counter — words, characters, sentences and reading time update live as you type. No sign-up, nothing uploaded.",
    category: "prod",
    icon: "type",
    keywords:
      "word counter word count character counter count characters online sentence counter paragraph counter reading time essay word limit twitter character count meta description length blog post length",
    ready: true,
    intro:
      "Paste or type your text and watch words, characters, sentences, paragraphs and reading time update instantly. Handy for essays with word limits, tweets and social posts, meta descriptions, cover letters and articles — and your text is counted entirely in your browser, so it never leaves the page.",
    howTo: [
      "Type or paste your text into the box.",
      "Watch every number update live as you edit — words, characters with and without spaces, sentences, paragraphs and reading time.",
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
      {
        q: "How many characters fit in a tweet or a meta description?",
        a: "A post on X (Twitter) allows 280 characters. A meta description is typically kept to about 150-160 characters before search engines truncate it. The characters-without-spaces counter above helps you fit both.",
      },
    ],
  },
  {
    id: "percentage-calculator",
    name: "Percentage Calculator",
    short:
      "Free percentage calculator: X% of Y, what percent one number is of another, and percentage increase or decrease. Instant, no sign-up.",
    category: "calc",
    icon: "percent",
    keywords:
      "percentage calculator percent of a number what percent of percentage change percentage difference percentage increase decrease calculator percent off discount calculator sale price tip calculator percent formula",
    ready: true,
    intro:
      "The three percentage questions everyone has, answered instantly: what is X% of Y, X is what percent of Y, and how big is the percentage change from X to Y. Discounts, tips, price rises, exam scores, growth figures — type two numbers and read the answer. No formulas to remember, no calculate button.",
    howTo: [
      "Pick the card that matches your question — all three are on the page.",
      "Type your two numbers.",
      "Read the answer — it updates as you type.",
    ],
    faq: [
      {
        q: "How do I calculate a discount or sale price?",
        a: "Use the first card: enter the discount as the percentage and the original price as the number — the result is how much you save. Subtract it from the price for the sale price.",
      },
      {
        q: "How do I calculate percentage change?",
        a: "Percentage change = (new − old) ÷ |old| × 100. The third card does it for you: enter the old value and the new value. A positive result is an increase, a negative one a decrease.",
      },
      {
        q: "What is percentage difference good for?",
        a: "Price rises, salary changes, growth figures, exam score changes — any before/after comparison where you want the size of the change relative to where you started.",
      },
    ],
  },
  {
    id: "age-calculator",
    name: "Age Calculator",
    short:
      "Free online age calculator — your exact age in years, months and days, plus a countdown to your next birthday. No sign-up, private.",
    category: "calc",
    icon: "cake",
    keywords:
      "age calculator how old am i calculate age in months and days age in years months days days until my next birthday birthday countdown date of birth age difference chronological age school admission age exact age",
    ready: true,
    intro:
      "Enter a date of birth and get the exact age in years, months and days — plus a countdown to the next birthday, with the day of the week it falls on. Precise enough for official forms, school admissions and visa applications that ask for exact age, and it handles leap-year birthdays correctly.",
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
      {
        q: "How does it handle February 29 birthdays?",
        a: "In non-leap years the next birthday is counted on February 28, the last day of the birthday month — the convention most official forms use.",
      },
    ],
  },
  {
    id: "compress-pdf",
    name: "Compress PDF",
    short: "Shrink PDF file size right in your browser — no uploads, no limits.",
    category: "pdf",
    icon: "file-down",
    keywords:
      "compress pdf make pdf smaller reduce pdf file size shrink pdf pdf compressor compress pdf online free without losing quality email limit",
    ready: false,
  },
  {
    id: "merge-pdf",
    name: "Merge PDF",
    short: "Combine multiple PDFs into one document — in your browser, free.",
    category: "pdf",
    icon: "file-stack",
    keywords:
      "merge pdf combine pdf join pdf put pdfs together merge pdf online free combine pdf files into one no upload",
    ready: false,
  },
  {
    id: "split-pdf",
    name: "Split PDF",
    short: "Extract the pages you need, or split a PDF into separate files.",
    category: "pdf",
    icon: "scissors",
    keywords:
      "split pdf extract pdf pages remove pages from pdf separate pdf into files pdf page remover",
    ready: false,
  },
  {
    id: "jpg-to-pdf",
    name: "JPG to PDF",
    short: "Turn photos into a single PDF document — no upload, no sign-up.",
    category: "pdf",
    icon: "file-image",
    keywords:
      "jpg to pdf image to pdf photo to pdf png to pdf convert images to pdf pictures into one pdf",
    ready: false,
  },
  {
    id: "pdf-to-jpg",
    name: "PDF to JPG",
    short: "Save PDF pages as JPG images — private, in-browser conversion.",
    category: "pdf",
    icon: "file-output",
    keywords:
      "pdf to jpg pdf to image convert pdf to png save pdf pages as images pdf picture extractor",
    ready: false,
  },
  {
    id: "compress-image",
    name: "Compress Image",
    short:
      "Compress JPG, PNG and WebP images free — pick a quality or an exact target size like 100 KB. No sign-up, nothing uploaded.",
    category: "image",
    icon: "image-down",
    keywords:
      "compress image compress jpg compress png compress webp reduce image file size make image smaller shrink photo image compressor online free compress image to 100kb compress image without losing quality photo compressor for email reduce image size for website upload image too big compress without uploading no sign up",
    ready: true,
    intro:
      "Shrink JPG, PNG and WebP files to the size you actually need. Pick a quality level, set an exact target such as 100 KB and let the compressor find the highest quality that fits, or start from a preset — web & email, high quality, smallest file. You can also cap the longest edge, which is handy for photos from modern phones. Everything runs in your browser: your images are never uploaded to a server, which is also why there are no file-size limits, no queues and no account.",
    howTo: [
      "Drop your images onto the page, click to browse, or paste them from the clipboard.",
      "Choose how much to compress: a quality slider, an exact target size (for example 100 KB), or a preset.",
      "Optionally cap the longest edge or change the output format, then press Compress.",
      "Check the before → after sizes and download your images — one by one or all at once.",
    ],
    faq: [
      {
        q: "How do I compress an image to 100 KB?",
        a: "Switch to Target size, type 100 (or tap the 100 KB chip) and press Compress. The tool tests quality levels automatically and returns the highest quality that fits under 100 KB. If 100 KB is genuinely impossible for an image, you get the closest possible file with an honest note — never an error.",
      },
      {
        q: "Will compressing reduce the quality of my image?",
        a: "JPG and WebP compression discards some detail — at quality 70–90 the difference is usually invisible. PNG is lossless, so it keeps every pixel but shrinks far less; pair it with a size cap for real savings. The quality slider lets you make that trade-off yourself.",
      },
      {
        q: "Are my images uploaded to a server?",
        a: "No. Decoding, resizing and re-encoding all happen inside your browser — the files never leave your device. Close the tab and everything is gone.",
      },
      {
        q: "Why didn't my PNG get smaller?",
        a: "PNG is a lossless format: re-encoding it alone barely changes the size. Set “Resize large images” to cap the longest edge (1920 px, for example), or save as JPG / WebP — those formats compress photos much more effectively.",
      },
    ],
  },
  {
    id: "resize-image",
    name: "Resize Image",
    short:
      "Resize images to exact dimensions, a percentage, or social media sizes like Instagram — and convert JPG, PNG, WebP. Free, private.",
    category: "image",
    icon: "scaling",
    keywords:
      "resize image image resizer change image size resize photo resize png resize jpg resize image online free resize for instagram resize image to 1080x1080 social media image sizes youtube thumbnail size resize without losing quality image dimension converter scale image crop to size resize and convert format webp no sign up",
    ready: true,
    intro:
      "Make any image the exact size you need — no design app required. Scale by percentage, set just the width or height (the other side follows automatically), demand exact dimensions with a centred crop, fit inside a box, or tap a one-click preset for Instagram, YouTube thumbnails, Facebook, X, LinkedIn, Pinterest, Full HD and 4K. Convert between JPG, PNG and WebP in the same step, and decide for yourself whether smaller images may be enlarged. As with every FreeSeak tool, the resizing happens entirely in your browser — nothing is uploaded.",
    howTo: [
      "Drop your images in, browse, or paste them from the clipboard.",
      "Pick a resize mode — percentage, one side, exact size, fit inside, or a social preset.",
      "Optionally convert the format, adjust quality, and set a background colour for transparent areas when saving as JPG.",
      "Press Resize, check the new dimensions, and download — individually or all at once.",
    ],
    faq: [
      {
        q: "How do I resize an image for Instagram or a YouTube thumbnail?",
        a: "Choose the Presets mode and tap the size you need — Instagram post (1080 × 1080), Story (1080 × 1920), YouTube thumbnail (1280 × 720) and more. Your image is scaled and centre-cropped to exactly that size, so nothing is distorted.",
      },
      {
        q: "How do I resize without distorting the picture?",
        a: "Every mode except “Stretch to fill” keeps the original proportions. With exact sizes, the default “Keep aspect ratio” setting trims a little from the edges instead of stretching — the same approach social networks use themselves.",
      },
      {
        q: "Can I make an image bigger?",
        a: "Yes — by default smaller images are kept at their original size instead of being blurred by upscaling. Tick “Allow enlarging” if you genuinely need a larger canvas; some softness in the result is normal.",
      },
      {
        q: "Is my image uploaded anywhere?",
        a: "No. Resizing runs 100% in your browser — the file never leaves your device, and there is no size limit and no sign-up.",
      },
    ],
  },
  {
    id: "invoice-generator",
    name: "Invoice Generator",
    short: "Build a clean, printable invoice in a minute — free, no account.",
    category: "prod",
    icon: "receipt",
    keywords:
      "invoice generator free invoice maker bill generator receipt template quotation create invoice online printable pdf invoice",
    ready: false,
  },
];

export function getTool(id: string): ToolDef | undefined {
  return TOOLS.find((t) => t.id === id);
}

export const READY_TOOLS = TOOLS.filter((t) => t.ready);
