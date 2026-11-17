# FreeSeak — Seek & Done

Free online tools that run entirely in your browser. No sign-up, no uploads —
your files never leave your device.

**22 tools live:** PDF suite (Edit PDF · Merge · Split · Images to PDF ·
PDF to Images · Organize Pages · Page Numbers · Watermark · Extract Text ·
Metadata · Compress) · Image tools (Compress · Resize · Enhance · Convert ·
Crop & Rotate · Favicon) · Punjab Registry Estimator (English & اردو) ·
QR Code Generator · Word Counter · Percentage Calculator · Age Calculator

Built with Next.js (static export), Tailwind CSS and shadcn/ui, deployed on
Cloudflare Workers. See [CHANGELOG.md](CHANGELOG.md) for what shipped and
[PROJECT_RULES.md](PROJECT_RULES.md) for the rules every update follows.

## Site configuration

No environment variables are required. All site config lives in two files:

- `src/lib/site.ts` — domain (`SITE_URL`), site name, operator (Bluefrog),
  contact email, analytics token, ad-slot flag.
- `src/lib/version.ts` — the deployed version shown in the footer badge
  (keep in sync with `version` in `package.json`, per Rule 6).

## Deploying an update

1. Unzip the delivery zip (Rule 2 — a complete project copy).
2. Open the folder, select **all** contents — **including dotfiles** like
   `.gitignore` and `.node-version` — and upload them via GitHub →
   *Add file → Upload files* → **Commit changes**. Existing files are
   overwritten automatically. GitHub's web upload accepts up to **100
   files per drag** — with the v0.5 PDF suite the project is larger, so
   if the upload is refused, drag in two batches (everything inside
   `src/` first, then the rest).
3. If the delivery lists files to delete (a removed feature), delete each
   one in the GitHub web UI — an upload cannot delete files.
4. Cloudflare Workers picks up the push and builds automatically:
   `npm run build` → static export to `out/` → served via the assets
   binding in `wrangler.json`. Node 22 is pinned via `.node-version`.
   New npm dependencies (v0.5: `pdf-lib`, `pdfjs-dist`, `jszip`) are
   installed by the build from `package.json` / `package-lock.json` —
   `node_modules` is never uploaded.
5. Verify after deploy: the footer version badge matches
   `src/lib/version.ts`, and `https://freeseak.com/sitemap.xml` loads.
   For the PDF tools also spot-check that
   `https://freeseak.com/pdf.worker.min.mjs` returns the worker file
   (it lives in `public/` and ships as a static asset).
