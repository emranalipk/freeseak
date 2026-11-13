# FreeSeak — Seek & Done

Free online tools that run entirely in your browser. No sign-up, no uploads —
your files never leave your device.

**4 tools live** (QR Code Generator, Word Counter, Percentage Calculator,
Age Calculator), 8 more in the build queue (PDF suite, image tools, invoice
generator). Live at **https://freeseak.com**.

> Read **PROJECT_RULES.md** first — it locks the rules for every future
> update: dead code is always deleted, every delivery is a full zip for
> drag-and-drop upload, and the domain lives in one place only.

## Update the site (the normal workflow)

Every update arrives as a **full project zip**:

1. Unzip it.
2. Go to the GitHub repository → **Add file → Upload files**.
3. Drag **all** contents of the unzipped folder into the upload area
   (including dotfiles like `.gitignore` and `.github`).
4. If the update lists files to **delete** (GitHub upload cannot delete),
   open each listed file in the repo → trash icon → commit.
5. Click **Commit changes**. Deployment happens automatically (see below).

## One-time setup (v0.3)

### 1. The domain — freeseak.com

The site already points at `https://freeseak.com` (in `src/lib/site.ts`).
Connect it in Cloudflare:

1. Buy `freeseak.com` (Cloudflare Registrar sells at cost; any registrar works).
2. Cloudflare dashboard → **Add a domain** → enter `freeseak.com` → follow the
   nameserver steps.
3. **Workers & Pages** → your `freeseak` worker → **Settings → Domains &
   Routes** → **Add → Custom domain** → `freeseak.com`.
4. On the same settings page, **disable the `workers.dev` route** so only
   freeseak.com serves the site (no duplicate content).

⚠️ Do this before (or immediately after) uploading v0.3 — the canonical URLs
now point at freeseak.com, and the domain must resolve for them to be valid.

### 2. Deploy on push

Connect the repo so every upload deploys itself:

- Cloudflare dashboard → **Workers & Pages** → your worker →
  **Settings → Build** → **Connect to Git** → pick this repository.
  Build command: `npm run build` — deploy comes from `wrangler.json` (assets
  in `./out`).

`.github/workflows/ci.yml` additionally lints and builds every push — a red ✗
means dead code or a broken build (see PROJECT_RULES.md rule 1).
`.github/workflows/deploy.yml` is an optional manual deploy (needs
`CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` repo secrets).

### 3. Tell Google the site exists

1. [Google Search Console](https://search.google.com/search-console) →
   **Add property → Domain** → `freeseak.com` → verify with the DNS TXT
   record it shows (paste it into Cloudflare DNS).
2. **Sitemaps** → submit `https://freeseak.com/sitemap.xml`.
3. Optional: do the same at [Bing Webmaster Tools](https://www.bing.com/webmasters).

### 4. Analytics (optional, cookieless)

Cloudflare dashboard → **Web Analytics** → Add site → `freeseak.com` → copy
the **token** → paste it into `CF_ANALYTICS_TOKEN` in `src/lib/site.ts` →
commit. No cookie banner needed (fits the privacy promise).

### 5. Ads (later, when there is traffic)

AdSense requires: real content, a Privacy Policy (shipped in v0.3, includes
the Google ad-cookie clause), Terms, About, and a working site. When
approved, create the ad unit and set `ADS_ENABLED = true` in
`src/lib/site.ts`.

## The factory — how this project is organised

Everything is generated from a few small pieces. **You never edit 30 files.**

```
src/
  lib/
    tools.ts        ← THE catalogue: every tool, its text, keywords, status
    search.ts       ← the synonym search engine (reads tools.ts)
    tool-store.ts   ← command palette state + "recent tools" memory
    site.ts         ← domain + site config (the ONLY place the domain lives)
  components/
    site/           ← homepage pieces (header, hero, grid, footer, palette)
    tools/
      tool-page.tsx    ← the tool page template (SEO copy comes from tools.ts)
      tool-registry.tsx ← one line per working tool
      qr-generator.tsx, word-counter.tsx, ... ← the tool engines
  app/
    layout.tsx        ← fonts, brand theme, site-wide SEO metadata
    page.tsx          ← the homepage
    tools/page.tsx    ← the all-tools index page
    tools/[id]/page.tsx ← one static page per tool (generated)
    about|privacy-policy|terms|disclaimer/page.tsx ← trust pages
    sitemap.ts        ← auto-generated from the catalogue
```

### How to add tool #13 (the 3-step recipe)

1. Add one entry to `src/lib/tools.ts` (name, description, keywords,
   `ready: true` + intro, howTo, FAQ — see rule 4 in PROJECT_RULES.md).
2. Create `src/components/tools/your-tool.tsx` — copy `word-counter.tsx`
   as a starting point.
3. Add one line to `src/components/tools/tool-registry.tsx`.

That's it — the homepage card, /tools index, search, footer link,
recent-tools row, sitemap entry, per-tool page, FAQ structured data and
related-tools links all pick it up automatically. Also add a
`public/og/<tool-id>.png` (1200×630) social preview image.

## Run it on your own computer (optional)

Requires Node.js 20+:

```bash
npm install
npm run dev      # local preview at http://localhost:3000
npm run lint     # dead code fails here — keep it green
npm run build    # static export into ./out
```

## Changelog

| Version | Date | What changed |
| --- | --- | --- |
| 0.3.0 | 2026-11-13 | Domain fixed to freeseak.com; dead code removed (overlay system, zod); brand logo integrated + full favicon set + OG images; About / Privacy / Terms / Disclaimer / Tools index pages; per-tool WebApplication + Breadcrumb structured data; SEO copy across the catalogue; mobile "Tools" nav; request-a-tool mailto; ad slot hidden by default; immutable asset caching (`public/_headers`); CI + deploy workflows; PROJECT_RULES.md lock |
| 0.2.0 | 2026-11-13 | Per-tool pages at /tools/<id>, sitemap, robots.txt, 404 page, shared header/footer/palette |
| 0.1.0 | 2026-11-13 | First working build: 4 tools, search, command palette, dark mode |
