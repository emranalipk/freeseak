/**
 * v1.0.3 — the edge guard: a tiny Worker that runs in front of the static
 * assets (wrangler.json `main` + `run_worker_first`).
 *
 * HOST DETECTION IS THE SAFETY NET, not the primary control (SEO brief,
 * Task 1): the build-time SITE_MODE (scripts/seo-mode.mjs, layout meta)
 * is the primary control. This Worker enforces the same rule at runtime
 * so that a mis-set environment variable can never expose staging to
 * search engines — fail-safe, not fail-open.
 *
 * Behaviour:
 *   - any host that is not freeseak.com (workers.dev, previews, localhost,
 *     unattached domains): the response gets `X-Robots-Tag: noindex, nofollow`
 *     injected at the edge, whatever the build mode says.
 *   - www.freeseak.com → 301 https://freeseak.com (canonical host, Rule 3).
 *   - REDIRECT_STAGING=yes (set on launch day, docs/LAUNCH_CHECKLIST.md
 *     step 5): *.workers.dev → 301 the same path on freeseak.com. OFF by
 *     default — the code path exists and is tested (scripts/test-seo-edge.mjs
 *     evidence in the handoff) but stays disabled until the domain resolves.
 *
 * The domain comes from src/lib/site.ts — the single source (Rule 3).
 */
import { SITE_URL } from "./lib/site";

type AssetsFetcher = { fetch: (_request: Request) => Promise<Response> };

interface Env {
  ASSETS: AssetsFetcher;
  /** launch day only: "yes" turns the workers.dev → freeseak.com 301 on */
  REDIRECT_STAGING?: string;
}

const PROD_HOST = new URL(SITE_URL).hostname; // freeseak.com

const edgeGuard = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const bare = url.hostname.replace(/^www\./, "");
    try {
      if (bare === PROD_HOST) {
        /* canonical host: www → apex, everything else passes through clean */
        if (url.hostname.startsWith("www.")) {
          return Response.redirect(`${SITE_URL}${url.pathname}${url.search}`, 301);
        }
        return await env.ASSETS.fetch(request);
      }
      /* staged launch-day redirect: off unless explicitly enabled */
      if ((env.REDIRECT_STAGING || "") === "yes" && bare.endsWith(".workers.dev")) {
        return Response.redirect(`${SITE_URL}${url.pathname}${url.search}`, 301);
      }
      /* every other host: serve the asset, but noindex it at the edge */
      const asset = await env.ASSETS.fetch(request);
      const res = new Response(asset.body, asset);
      res.headers.set("X-Robots-Tag", "noindex, nofollow");
      return res;
    } catch {
      /* never let the guard break the site itself */
      return env.ASSETS.fetch(request);
    }
  },
};

export default edgeGuard;
