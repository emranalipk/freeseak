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
 *
 * v0.4: only live tools are listed — upcoming tools are no longer
 * advertised anywhere on the site, so the old `ready` flag is gone
 * (Rule 1: no dead code). A tool ships = its complete entry lands here.
 *
 * v0.5: the PDF suite — ten tools over a shared in-browser engine
 * (pdf-lib edits, pdf.js renders, JSZip bundles). PDFs are the most
 * sensitive files people process, so the "never uploaded" promise is
 * the story of every entry below.
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
  intro?: string;
  howTo?: string[];
  faq?: FaqItem[];
}

export const CATEGORIES: { id: CategoryId | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "pdf", label: "PDF Tools" },
  { id: "image", label: "Image Tools" },
  { id: "calc", label: "Calculators" },
  { id: "prod", label: "Productivity & Business" },
];

export const CATEGORY_LABEL: Record<CategoryId, string> = {
  pdf: "PDF Tools",
  image: "Image Tools",
  calc: "Calculators",
  prod: "Productivity & Business",
};

export const TOOLS: ToolDef[] = [
  {
    id: "merge-pdf",
    name: "Merge PDF",
    short:
      "Merge PDF files free online — combine any number of PDFs into one document, set the order visually, download instantly. No sign-up, nothing uploaded.",
    category: "pdf",
    icon: "merge",
    keywords:
      "merge pdf combine pdf files join pdf pdf merger put pdfs together merge multiple pdfs into one combine pdf documents free merge pdf without uploading no limit no sign up combine scanned pdfs append pdf",
    intro:
      "Combine any number of PDFs into a single document, in exactly the order you want. Contracts, bank statements, scans, CVs — drop them in, arrange them with the arrows, and download one clean file. The merging happens entirely in your browser, which matters here more than anywhere: a merged PDF is often a full financial or legal history, and with FreeSeak it never leaves your device. No page limits, no file-size limits, no daily quota — the usual limits exist because someone else pays the server; there is no server.",
    howTo: [
      "Drop your PDFs onto the page, click to browse, or paste them from the clipboard.",
      "Arrange the order with the up and down arrows — files merge from top to bottom.",
      "Press Merge and download your combined PDF.",
    ],
    faq: [
      {
        q: "How many PDFs can I merge at once?",
        a: "As many as you like — there is no limit. Because the merging runs on your own device, it is bounded only by your browser's memory, not by a server quota or a paywall.",
      },
      {
        q: "Will merging reduce the quality of my PDFs?",
        a: "No. Pages are copied into the new document byte-for-byte — text stays selectable, images keep their resolution, and forms or links keep working.",
      },
      {
        q: "Is it safe to merge confidential documents here?",
        a: "Yes, by architecture: the files are read and combined inside your browser and never uploaded anywhere. Disconnect from the internet mid-job and it still works — that is the honest proof.",
      },
      {
        q: "Can I reorder the files before merging?",
        a: "Yes — the arrows next to each file set the order. The download is named after the first file in the list, with “-merged” added.",
      },
    ],
  },
  {
    id: "split-pdf",
    name: "Split PDF",
    short:
      "Split PDF free online — extract chosen pages into a new PDF, or break a document into separate files per page or range. No sign-up, nothing uploaded.",
    category: "pdf",
    icon: "split",
    keywords:
      "split pdf extract pages from pdf separate pdf pdf splitter pull pages out of pdf save one page of a pdf pdf page extractor cut pdf into parts split pdf into multiple files extract chapter from pdf free no sign up",
    intro:
      "Two ways to take a PDF apart: pull selected pages into one new PDF, or split it into several files at once. Type what you want in plain language — “1-3, 5, 12-20” — and the tool shows you exactly which pages it understood before you commit. Splitting a 40-page report into chapters, saving a single page from a contract, separating a scan batch: all of it happens in your browser, so even sensitive documents never leave your device.",
    howTo: [
      "Drop in your PDF — the tool reads it and shows the page count.",
      "Choose “Extract to one PDF” to pull pages into a single file, or “Separate files” to give every page (or every range) its own PDF.",
      "Type the pages or ranges, check the live summary underneath, and run.",
    ],
    faq: [
      {
        q: "How do I save just one page from a PDF?",
        a: "Choose “Separate files”, type the page number (for example 7), and run — you get exactly that page as its own PDF. “Extract to one PDF” with “7” gives the same result in one step.",
      },
      {
        q: "What does the page-range box understand?",
        a: "Single pages (7), ranges (1-3), and any combination separated by commas (1-3, 5, 12-20). The line under the box always shows how many pages were understood — nothing happens until it matches what you meant.",
      },
      {
        q: "Does splitting affect the original file?",
        a: "No. Your original PDF is never modified — the tool reads it and writes new files. The download keeps the original name with the page range added.",
      },
      {
        q: "Can I split a scanned PDF?",
        a: "Yes. Splitting works on any valid PDF, scanned or not — pages are moved as-is, with no re-processing that could degrade a scan.",
      },
    ],
  },
  {
    id: "images-to-pdf",
    name: "Images to PDF",
    short:
      "Convert JPG and PNG images to one PDF free — drag, drop, reorder, and pick fit-to-image, A4 or Letter pages. No sign-up, nothing uploaded.",
    category: "pdf",
    icon: "file-image",
    keywords:
      "jpg to pdf png to pdf image to pdf convert images to pdf photo to pdf make a pdf from pictures multiple images into one pdf picture to pdf document scan to pdf jpeg to pdf free no watermark no sign up",
    intro:
      "Turn photos and scans into a single, shareable PDF. Drag your JPGs and PNGs in, set the order with the arrows, and choose how they sit on the page: fitted to each image with no borders, or centred on A4 / Letter pages with a margin — handy for printing and for upload portals that demand “a PDF”. JPG and PNG files are embedded without recompression, so quality is exactly what you started with. Everything runs in your browser: your photos never touch a server.",
    howTo: [
      "Drop your images in, browse, or paste them — JPG, PNG, WebP, GIF and more.",
      "Arrange the order; each image becomes one page, in the order shown.",
      "Pick the page style — fit to image, or A4 / Letter with a margin — and press Create PDF.",
    ],
    faq: [
      {
        q: "Will my photos lose quality when converted to PDF?",
        a: "No. JPG and PNG images are embedded into the PDF exactly as they are — no recompression, no resizing. Other formats (WebP, GIF, AVIF) are converted to high-quality JPG first, because the PDF format itself only understands JPG and PNG.",
      },
      {
        q: "How do I get A4 pages instead of image-sized pages?",
        a: "Set “Page size” to A4 (or US Letter). Each image is scaled to fit inside the page with your chosen margin, centred, and the page orientation follows the image. For borderless pages where the PDF page equals the image size, keep “Fit each image”.",
      },
      {
        q: "How many images can I put in one PDF?",
        a: "As many as you like. The PDF is assembled on your device, so the only limit is your browser's memory — there is no server quota.",
      },
      {
        q: "Can I combine images that are already scans of a document?",
        a: "That is one of the most common uses: photograph or scan the pages, drop them in, set the order, and download one PDF — the modern replacement for a scanner's “scan to PDF” button.",
      },
    ],
  },
  {
    id: "pdf-to-images",
    name: "PDF to Images",
    short:
      "Convert PDF pages to PNG or JPG images free — pick the resolution up to print quality, download one page or all. No sign-up, nothing uploaded.",
    category: "pdf",
    icon: "images",
    keywords:
      "pdf to png pdf to jpg convert pdf to image save pdf page as image pdf to picture export pdf pages as photos pdf to image high resolution 300 dpi turn pdf into jpeg screenshot pdf pages free no sign up",
    intro:
      "Turn PDF pages into standalone PNG or JPG images — perfect for slides as social posts, a page for a presentation, or an image a portal insists on. Pick the pages, the format and the resolution: 1.5× looks crisp on screens, 2× (144 DPI) is print-safe, 3× stands up to zooming. Pages are rendered by your own browser, and a progress bar keeps you company on long documents. Multiple pages arrive as a single .zip.",
    howTo: [
      "Drop in your PDF.",
      "Choose the pages, the format (PNG for sharp text, JPG for smaller photo files) and the resolution.",
      "Press Convert — each page becomes an image; download them one by one or all together as a .zip.",
    ],
    faq: [
      {
        q: "What resolution should I pick?",
        a: "1.5× is plenty for screens and email. Choose 2× (144 DPI) when the image will be printed or projected; 3× is for zooming into fine print. Higher resolution means bigger files — the trade-off is yours.",
      },
      {
        q: "PNG or JPG — which one?",
        a: "PNG is lossless and keeps text razor-sharp — best for documents, receipts and anything with writing. JPG makes dramatically smaller files and suits pages that are mostly photos.",
      },
      {
        q: "Can I convert only some of the pages?",
        a: "Yes — the pages box takes single pages and ranges, like 1-3, 7, 12. Leave it empty to convert every page.",
      },
      {
        q: "Why is this better than taking a screenshot of the PDF?",
        a: "A screenshot captures only what is on your screen, at screen resolution, with whatever zoom you happened to have. This tool renders the page itself at the resolution you choose — complete, centred and consistent.",
      },
    ],
  },
  {
    id: "organize-pdf-pages",
    name: "Organize PDF Pages",
    short:
      "Reorder, rotate and delete PDF pages visually — drag live page thumbnails into place and save. Free PDF organizer, no sign-up, nothing uploaded.",
    category: "pdf",
    icon: "layout",
    keywords:
      "reorder pdf pages rearrange pdf pages rotate pdf pages delete pages from pdf organize pdf pages move pages in pdf change page order pdf page organizer fix sideways page pdf page manager free no sign up",
    intro:
      "The visual page manager: every page of your PDF appears as a live thumbnail you can drag into a new position, rotate left or right, or delete — then save the result as a clean new document. It is the fix for the classics: the scan that came in backwards, the page 4 that should be page 12, the three blank pages the scanner sneaked in, and the landscape slide stuck sideways. The whole thing runs in your browser on real page previews — what you arrange is what you get.",
    howTo: [
      "Drop in your PDF and wait a moment while the page thumbnails appear.",
      "Click pages to select them, then rotate or delete with the toolbar — or drag any page to a new position.",
      "Press “Save organized PDF” and download the result.",
    ],
    faq: [
      {
        q: "How do I rotate just one sideways page?",
        a: "Click the page's thumbnail to select it, then press Left or Right in the toolbar. The thumbnail turns immediately, so you can see the result before saving.",
      },
      {
        q: "How do I delete pages from a PDF?",
        a: "Select the pages you want gone (click to select several) and press Delete. The pages disappear from the arrangement immediately; the original file on your disk is untouched.",
      },
      {
        q: "Can I move a page to the start or end?",
        a: "Yes — drag it there, or use the small arrows under each thumbnail to nudge it one position at a time.",
      },
      {
        q: "Does the saved document keep the quality of the original?",
        a: "Yes. Pages are copied as-is; rotation and order are metadata changes. Text, images and forms come through exactly as they were.",
      },
    ],
  },
  {
    id: "add-page-numbers",
    name: "Add Page Numbers",
    short:
      "Add page numbers to a PDF free — any corner, “Page 3 of 12” styles, custom start number, cover-page skip. No sign-up, nothing uploaded.",
    category: "pdf",
    icon: "ordered",
    keywords:
      "add page numbers to pdf number pdf pages pdf page numbering insert page numbers in pdf stamp page numbers on pdf pdf pagination page numbers footer header start numbering from page 2 no watermark free",
    intro:
      "Stamp page numbers onto a PDF that never got them — scans, merged files, exports from tools that forgot. Choose the corner, the format (“3”, “3 / 12”, “Page 3 of 12” or “- 3 -”), where numbering starts (so page 1 of the file can be page 4 of the report), and whether the cover page stays untouched. A live preview line shows exactly what a page will read. The numbers are drawn into a fresh copy of your file in the browser — the original is never modified, and nothing is uploaded.",
    howTo: [
      "Drop in your PDF.",
      "Pick the format, position, font size and colour; set the starting number if the file is part of a larger document.",
      "Tick “leave the first page unnumbered” for covers, then press Add page numbers.",
    ],
    faq: [
      {
        q: "Can I start numbering from a number other than 1?",
        a: "Yes — set “Start numbering at”. If your PDF is chapter 2 starting on page 41, type 41 and the first page is numbered 41, 42, 43…",
      },
      {
        q: "How do I keep the cover page clean?",
        a: "Tick “Leave the first page unnumbered”. Numbering then starts on the second page, and “of N” counts only the numbered pages.",
      },
      {
        q: "Can I put numbers in the header instead of the footer?",
        a: "Yes — the position list covers all six spots: top or bottom, left, centre or right, with a distance-from-edge setting to keep clear of margins and crop marks.",
      },
      {
        q: "Will it number every page of a huge document?",
        a: "Yes — numbering runs over the entire document, however long. It is drawn on your device, so document size only affects how long the save takes, not whether it works.",
      },
    ],
  },
  {
    id: "watermark-pdf",
    name: "Watermark PDF",
    short:
      "Add a text watermark to a PDF free — DRAFT or CONFIDENTIAL at any angle, colour and opacity, with a live preview. No sign-up, nothing uploaded.",
    category: "pdf",
    icon: "stamp",
    keywords:
      "watermark pdf add watermark to pdf confidential stamp draft stamp on pdf text watermark on pdf copy proof watermark stamp every page of a pdf pdf mark confidential free no sign up without uploading",
    intro:
      "Stamp a text watermark across your PDF — DRAFT across a proposal, CONFIDENTIAL across a report, a name or an email address across a portfolio you send out. Set the angle, colour, size and opacity, place it once in the centre or tiled across every page, and watch the live preview: it renders your document's actual first page with the watermark exactly as it will be burned in. Choose the pages to stamp, save, done — all in your browser.",
    howTo: [
      "Drop in your PDF and type the watermark text.",
      "Play with size, angle, colour, opacity and layout (once or tiled) — the preview updates instantly on your real first page.",
      "Press Add watermark and download the stamped PDF.",
    ],
    faq: [
      {
        q: "Can the watermark be removed later?",
        a: "No — it is drawn into the page content itself, not layered on top like a comment. That is the point of a watermark: it travels with every copy, printout and screenshot of the page.",
      },
      {
        q: "What opacity should I use?",
        a: "Around 15–25% keeps the text readable underneath while staying unmistakable. The live preview shows the trade-off on your own document, so adjust until it looks right.",
      },
      {
        q: "Can I watermark only some pages?",
        a: "Yes — the pages box takes single pages and ranges (1-3, 5). Leave it empty to stamp every page.",
      },
      {
        q: "Does the preview show my actual document?",
        a: "Yes — it is not a mock-up. The preview renders page 1 of your PDF with the watermark painted on top, in your browser. What you see is what gets saved.",
      },
    ],
  },
  {
    id: "extract-pdf-text",
    name: "Extract PDF Text",
    short:
      "Extract text from a PDF free — pull the words out of any text-based PDF into a clean .txt file, in your browser. Nothing is uploaded.",
    category: "pdf",
    icon: "scan",
    keywords:
      "extract text from pdf copy text from pdf pdf to text pdf text extractor get words out of pdf save pdf as txt pdf to plain text copy locked pdf text pdf copy paste text select text in pdf free",
    intro:
      "Get the words out of a PDF and into plain text you can paste anywhere — into Word, an email, a translation tool, a search. Pick the pages or take the whole document; you get a word and character count, a preview, and a clean UTF-8 .txt download. This works on PDFs with a real text layer (Word, LaTeX, browser exports — most PDFs in the wild). Scanned documents are images and need OCR; this tool tells you honestly when that is the case instead of handing you an empty file.",
    howTo: [
      "Drop in your PDF.",
      "Choose the pages to read — leave the box empty for the whole document.",
      "Press Extract text, read the preview, and download the .txt file.",
    ],
    faq: [
      {
        q: "Why does my PDF extract no text?",
        a: "The PDF is almost certainly a scan — photographs of pages, with no characters inside. Turning scans into text needs OCR (optical character recognition), which is a different technology; this tool would rather tell you plainly than pretend.",
      },
      {
        q: "Does it keep the formatting of the PDF?",
        a: "No — and that is deliberate. You get clean, continuous text: perfect for searching, translating, quoting and pasting, without the layout fights that PDF-to-Word converters lose. The .txt download is UTF-8 and opens in every editor.",
      },
      {
        q: "Can I extract text from a locked PDF?",
        a: "From PDFs that merely disallow copying: usually yes — the text layer is read directly. PDFs that require a password to open cannot be processed; remove the protection first.",
      },
      {
        q: "Is my document's text sent anywhere?",
        a: "No. The text layer is read and the .txt built entirely in your browser — the same privacy rule as every FreeSeak tool.",
      },
    ],
  },
  {
    id: "edit-pdf-metadata",
    name: "Edit PDF Metadata",
    short:
      "View and edit PDF metadata free — change the title, author, subject and keywords, or scrub them all before sharing. No sign-up, nothing uploaded.",
    category: "pdf",
    icon: "tags",
    keywords:
      "pdf metadata editor change pdf title change pdf author edit pdf properties pdf document information remove pdf metadata strip pdf metadata scrub pdf clean pdf before sharing pdf keywords pdf privacy leak",
    intro:
      "Every PDF carries hidden baggage: title, author, subject, keywords — and the author field quietly leaks real names, usernames and internal paths from the machine that made it. This tool shows you exactly what your PDF says about you, lets you edit any field, and offers a one-click scrub that clears everything before you share the file. Recruiters, clients and strangers receive only what you choose to reveal. The file is rewritten in your browser; nothing is uploaded.",
    howTo: [
      "Drop in your PDF — its current metadata fills the form, so you can see what it leaks.",
      "Edit any field, or press “Clear all fields” to scrub everything.",
      "Save and download the rewritten PDF, ready to share.",
    ],
    faq: [
      {
        q: "What is PDF metadata?",
        a: "Information stored inside the PDF but not visible on its pages: title, author, subject, keywords, creator app and dates. PDF viewers and search engines read it — and so does anyone who opens the file's properties.",
      },
      {
        q: "Why would I want to remove metadata?",
        a: "Because it leaks. Word and Google Docs write your account name into the author field; internal filenames survive in the title. If you are sending a CV, a contract or anything sensitive outside your organisation, scrubbing metadata is basic hygiene.",
      },
      {
        q: "Does editing metadata change the document's pages?",
        a: "No — not a pixel. The pages, text, images and formatting are copied through untouched; only the information dictionary is rewritten.",
      },
      {
        q: "What about the creation and modification dates?",
        a: "They are rewritten with the save, like any PDF editor does. Metadata you cleared stays cleared — the download is your scrubbed copy, and the original file on your disk is never modified.",
      },
    ],
  },
  {
    id: "compress-pdf",
    name: "Compress PDF",
    short:
      "Compress PDF files free — safe lossless mode, or strong mode with honest before/after sizes and no quality surprises. No sign-up, nothing uploaded.",
    category: "pdf",
    icon: "archive",
    keywords:
      "compress pdf reduce pdf file size make pdf smaller pdf compressor shrink pdf compress pdf without losing quality pdf size reducer pdf too big for email compress pdf to 100kb 200kb free no limit batch compress",
    intro:
      "Make PDFs smaller — with the honesty the big tools skip. Safe mode re-packs the file internally: text stays text, quality stays identical, and savings depend on how bloated the original was. Strong mode rebuilds each page as an image at the resolution you choose — the big cuts (often 40–80%) that make email attachments and upload portals happy — and tells you plainly that text stops being selectable. Either way you see before → after sizes per file, and if a file cannot be beaten, you get your original back untouched with a note, never a worse file.",
    howTo: [
      "Drop in one PDF or a whole batch.",
      "Pick a mode — Safe (keep text as text) or Strong (rasterise pages for the biggest cuts), and set the resolution and quality for Strong.",
      "Press Compress and check the before → after sizes, then download.",
    ],
    faq: [
      {
        q: "Which mode should I choose?",
        a: "Try Safe first — it can only help, never harm. If it is not enough and the PDF is for reading (not for text search or forms), go Strong: pick 120 DPI and quality 75 for email-sized files, or 150 DPI if the document will be printed.",
      },
      {
        q: "How much smaller will my PDF get?",
        a: "Safe mode: usually 5–20% on bloated files, sometimes nothing on already-optimized ones — and you are told exactly which. Strong mode: typically 40–80%, because pages become optimized JPEG images. Every result shows its real numbers.",
      },
      {
        q: "Will compressing damage my document?",
        a: "Safe mode cannot — it is lossless. Strong mode changes the document's nature: pages become pictures, so text is no longer selectable or searchable and fine print softens at low DPI. The tool says this before you commit, not after.",
      },
      {
        q: "Is there a file-size or daily limit?",
        a: "No. Compression runs on your device, so there is no server metering your usage — drop a batch, compress them all, come back tomorrow, same story.",
      },
    ],
  },
  {
    id: "qr-generator",
    name: "QR Code Generator",
    short:
      "Free online QR code generator for links, text and Wi-Fi. Download as PNG or SVG in print quality — no sign-up, no watermark, no expiry.",
    category: "prod",
    icon: "qr",
    keywords:
      "qr code generator free qr code generator make a qr code create qr code online qr maker wifi qr code qr code for a link url qr code png svg download no watermark no sign up static qr code qr code for menu business card",
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
      "Free online word counter — words, characters, sentences and reading time update live as you type. No sign-up, no limits, nothing uploaded.",
    category: "prod",
    icon: "type",
    keywords:
      "word counter word count character counter count characters online sentence counter paragraph counter reading time essay word limit twitter character count meta description length blog post length",
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
    id: "compress-image",
    name: "Compress Image",
    short:
      "Compress JPG, PNG and WebP images free — pick a quality or an exact target size like 100 KB. No sign-up, no limits, nothing uploaded.",
    category: "image",
    icon: "image-down",
    keywords:
      "compress image compress jpg compress png compress webp reduce image file size make image smaller shrink photo image compressor online free compress image to 100kb compress image without losing quality photo compressor for email reduce image size for website upload image too big compress without uploading no sign up",
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
];

export function getTool(id: string): ToolDef | undefined {
  return TOOLS.find((t) => t.id === id);
}
