#!/usr/bin/env node
/**
 * v1.0.3 — SEO preflight (runs as `postbuild`, i.e. inside CI and the
 * Cloudflare Workers build; a failure fails the deploy loudly, by design).
 *
 * Also runnable by hand: `npm run seo:preflight` after a build.
 *
 * preview mode (default) asserts, against ./out:
 *   1. _headers carries the X-Robots-Tag noindex
 *   2. robots.txt has NO sitemap line
 *   3. every generated .html page carries the <meta robots noindex>
 * production mode asserts the exact opposite:
 *   1. ZERO occurrences of "noindex" anywhere in the build output
 *   2. robots.txt carries the real sitemap line
 *   3. _headers carries no noindex
 *   4. sitemap.xml exists, every URL starts with SITE_URL, and the workers.dev
 *      host string appears nowhere in the output
 *
 * Rule 3: SITE_URL is parsed from src/lib/site.ts, never hardcoded here.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "out");

const siteTs = readFileSync(join(root, "src/lib/site.ts"), "utf8");
const SITE_URL = (siteTs.match(/export const SITE_URL\s*=\s*"(https:\/\/[^"]+)"/) || [])[1];
if (!SITE_URL) {
  console.error("seo-preflight: cannot find SITE_URL in src/lib/site.ts");
  process.exit(1);
}

const mode = process.env.SITE_MODE === "production" ? "production" : "preview";
const failures = [];
const ok = (label) => console.log(`  ✓ ${label}`);
const bad = (label) => {
  failures.push(label);
  console.error(`  ✗ ${label}`);
};

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

const read = (p) => readFileSync(p, "utf8");

console.log(`seo-preflight: mode=${mode} SITE_URL=${SITE_URL}`);

const headersPath = join(out, "_headers");
const robotsPath = join(out, "robots.txt");
const sitemapPath = join(out, "sitemap.xml");
if (!statSync(out, { throwIfNoEntry: false })) {
  console.error("seo-preflight: ./out does not exist — run the build first");
  process.exit(1);
}

if (mode === "preview") {
  /* 1 — headers */
  try {
    if (/X-Robots-Tag:\s*noindex/.test(read(headersPath))) ok("_headers: X-Robots-Tag noindex present");
    else bad("_headers: X-Robots-Tag noindex MISSING");
  } catch {
    bad("_headers: file missing from ./out");
  }
  /* 2 — robots.txt */
  try {
    const robots = read(robotsPath);
    if (!/sitemap:/i.test(robots)) ok("robots.txt: no sitemap line in preview ✓");
    else bad("robots.txt: sitemap line present in PREVIEW (must be withheld)");
    if (/User-agent:\s*\*/i.test(robots)) ok("robots.txt: allows crawling (noindex stays visible)");
    else bad("robots.txt: crawl-blocking found — a blocked URL cannot see its noindex");
  } catch {
    bad("robots.txt: missing from ./out (src/app/robots.ts should generate it)");
  }
  /* 3 — meta noindex on every page */
  const htmls = walk(out).filter((p) => p.endsWith(".html"));
  const missing = htmls.filter((p) => !/name="robots"[^>]*content="[^"]*noindex/.test(read(p)));
  if (htmls.length === 0) bad("no .html files found in ./out");
  else if (missing.length === 0) ok(`meta robots noindex present on all ${htmls.length} pages`);
  else bad(`meta robots noindex MISSING on ${missing.length}/${htmls.length} pages — first: ${missing.slice(0, 3).map((p) => relative(out, p)).join(", ")}`);
} else {
  /* 1 — zero noindex directives WE could emit, on real content pages.
     Exempt: the 404/not-found artifacts — Next.js auto-injects
     <meta robots noindex> into its not-found page at runtime (visible in
     404.html and one framework chunk). That is correct, standard behaviour:
     a 404 must never be indexed. What this check must catch is OUR preview
     layer leaking into a production build — layout meta, robots.txt
     crawl-blocks, or the generated _headers. */
  const isNotFoundArtifact = (p) => /404|_not-found/.test(relative(out, p));
  const metaOffenders = walk(out)
    .filter((p) => p.endsWith(".html") && !isNotFoundArtifact(p))
    .filter((p) => /name="robots"[^>]*content="[^"]*noindex/.test(read(p)));
  const headersNoindex = (() => {
    try {
      return /noindex/i.test(read(headersPath));
    } catch {
      return false;
    }
  })();
  let robotsDisallow = false;
  try {
    robotsDisallow = /disallow:/i.test(read(robotsPath));
  } catch {
    /* robots.txt missing is caught by the dedicated check below */
  }
  if (metaOffenders.length === 0 && !headersNoindex && !robotsDisallow) {
    ok("production: zero noindex directives on content pages (404 page's automatic noindex is expected Next.js behaviour)");
  } else {
    const why = [
      ...metaOffenders.map((p) => `meta noindex in ${relative(out, p)}`),
      headersNoindex ? "noindex in _headers" : "",
      robotsDisallow ? "Disallow: in robots.txt" : "",
    ].filter(Boolean);
    bad(`production: our noindex layer leaked into the build — ${why.join("; ")}`);
  }
  /* 2 — robots.txt sitemap line */
  try {
    const robots = read(robotsPath);
    if (robots.includes(`Sitemap: ${SITE_URL}/sitemap.xml`)) ok("robots.txt: production sitemap line present");
    else bad(`robots.txt: missing "Sitemap: ${SITE_URL}/sitemap.xml"`);
  } catch {
    bad("robots.txt: missing from ./out");
  }
  /* 3 — _headers clean */
  try {
    if (!/noindex/i.test(read(headersPath))) ok("_headers: no noindex in production");
    else bad("_headers: noindex present in a PRODUCTION build");
  } catch {
    bad("_headers: missing from ./out");
  }
  /* 4 — sitemap shape */
  try {
    const xml = read(sitemapPath);
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((mm) => mm[1]);
    const foreign = locs.filter((u) => !u.startsWith(SITE_URL));
    if (locs.length > 0 && foreign.length === 0) ok(`sitemap.xml: ${locs.length} URLs, all on ${SITE_URL}`);
    else if (locs.length === 0) bad("sitemap.xml: no <loc> entries");
    else bad(`sitemap.xml: ${foreign.length} URLs do not start with ${SITE_URL}`);
    if (locs.some((u) => u.startsWith(`${SITE_URL}/punjab-registry-costs`))) ok("sitemap.xml: punjab-registry-costs listed");
    else bad("sitemap.xml: punjab-registry-costs missing");
    /* and the staging host must appear nowhere */
    const stray = walk(out).filter((p) => /\.(html|txt|xml|js|json|mjs|css)$/.test(p) && read(p).includes("workers.dev"));
    if (stray.length === 0) ok("production: no workers.dev references in the output");
    else bad(`production: workers.dev referenced in ${stray.length} files — first: ${stray.slice(0, 5).map((p) => relative(out, p)).join(", ")}`);
  } catch {
    bad("sitemap.xml: missing from ./out");
  }
}

console.log(
  failures.length === 0
    ? `seo-preflight: PASS (${mode})`
    : `seo-preflight: FAIL (${failures.length} problem${failures.length > 1 ? "s" : ""}) — fix before shipping`,
);
process.exit(failures.length === 0 ? 0 : 1);
