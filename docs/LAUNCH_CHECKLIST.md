# FreeSeak — LAUNCH CHECKLIST (domain day runbook)

Everything is pre-built. Launch day = the ordered steps below, in order.
**No code changes are needed at any point.** If a step seems to need one,
stop and re-read — it means an earlier step was skipped.

The one rule: **do not flip `SITE_MODE` before step 4 is fully done.**

---

## 1. Buy the domain (any time before launch day)

- Buy `freeseak.com` (add the `.com` misspelling? optional — skip for now).
- Add the domain to Cloudflare (Free plan is fine), accept the nameserver
  change at the registrar, wait for the "Active" green light.
- Nothing about the site changes yet — the Worker still serves only the
  workers.dev address, still noindexed.

## 2. DNS records (verify while waiting for propagation)

Cloudflare dashboard → freeseak.com → DNS. The Workers custom-domain step
(3) creates its own record, so you only need to pre-stage verification TXT
records:

- **Google Search Console:** create a *Domain* property for freeseak.com →
  it shows a TXT record like `google-site-verification=<code>` → add it as
  a TXT record on `@`. (Create the property NOW, keep the code.)
- **Bing Webmaster Tools:** import sites from GSC (easiest) or add the
  site and get its own TXT/CNAME record → add it too.
- Confirm after propagation:
  `nslookup -type=TXT freeseak.com` shows both verification strings.

## 3. Attach the domain to the Worker

- Cloudflare dashboard → Workers & Pages → **freeseak** → Settings →
  Domains & Routes → **Add → Custom domain** → `freeseak.com`.
- Wait for the certificate to show **Active** (automatic, ~minutes).
- Check now (BEFORE flipping the mode):
  `curl -sI https://freeseak.com/ | grep -i x-robots`
  → **must still show `X-Robots-Tag: noindex, nofollow`.** The edge guard
  (src/worker.ts) noindexes any host that isn't in production mode — the
  fail-safe is already protecting your new domain. ✔ safe to proceed.

## 4. Flip to production mode (the one config change)

- Cloudflare dashboard → Workers & Pages → freeseak → Settings →
  **Build & Deploy → Build variables** (or the environment variables
  section of your Workers Builds pipeline):
  add `SITE_MODE` = `production`.
- Push an empty commit (or re-run the latest deployment) so the build runs
  with the variable set.
- Verify with curl — ALL of these must be true:
  ```bash
  curl -s https://freeseak.com/robots.txt            # → Sitemap: https://freeseak.com/sitemap.xml
  curl -sI https://freeseak.com/ | grep -i x-robots  # → (no header at all)
  curl -s https://freeseak.com/ | grep -io 'noindex' # → (no output)
  curl -s https://freeseak.com/sitemap.xml | head    # → 31 URLs, all on freeseak.com
  ```
  The build itself also ran `seo-preflight` — a wrong flip fails the deploy
  instead of shipping.

## 5. Enable the staged redirects

- In the same Build variables place, add `REDIRECT_STAGING` = `yes` and
  redeploy. Now `https://freeseak.emranali3813.workers.dev/<anything>`
  301s to `https://freeseak.com/<anything>` (verified in testing — the
  path is preserved). Any visitor or crawler who ever saved the old
  address lands on the real domain.
- Check: `curl -sI https://freeseak.emranali3813.workers.dev/ | grep -i location`
  → `location: https://freeseak.com/`

## 6. Search engines

- Google Search Console: verify the Domain property (step 2 TXT), then
  **submit `https://freeseak.com/sitemap.xml`** under Sitemaps.
- Use URL Inspection → "Request indexing" on: the homepage,
  `/punjab-registry-costs`, `/tools/compress-image`, `/tools/edit-pdf`,
  `/tools/merge-pdf`, `/tools/punjab-registry-estimator`.
- Bing Webmaster Tools: verify (step 2), submit the same sitemap.
- IndexNow (Bing/Yandex — **Google does not use IndexNow**): the key file
  is already deployed at `https://freeseak.com/74c8def3f8ce494f2b22fc03550c633b.txt`
  → submit with:
  `curl -s "https://api.indexnow.org/indexnow?url=https%3A%2F%2Ffreeseak.com%2F&key=74c8def3f8ce494f2b22fc03550c633b"`
  (repeat per launch URL, or POST a URL list). Expect 200/202.

## 7. Do not block the bots

- Cloudflare dashboard → Security → Bots: leave **Bot Fight Mode OFF** for
  the freeseak zone (it can challenge verified Googlebot/Bingbot). If you
  ever enable a WAF rule, exempt verified bots.

## 8. Final curl matrix (all must pass)

```bash
for p in / /tools /punjab-registry-costs /tools/edit-pdf /tools/merge-pdf \
         /tools/compress-image /tools/punjab-registry-estimator /guides \
         /about /privacy-policy; do
  code=$(curl -s -o /dev/null -w '%{http_code}' "https://freeseak.com$p")
  echo "$code $p"
done            # every line: 200
curl -s -o /dev/null -w '%{http_code}\n' https://freeseak.com/nope   # → 404
curl -s https://freeseak.com/ | grep -c 'rel="canonical"'            # → 1
curl -s https://freeseak.com/punjab-registry-costs/ | grep -c FAQPage # → 0
```

- The workers.dev address keeps serving noindexed + redirecting forever —
  it never needs de-indexing (nothing was ever indexed there).

## Deferred (nothing to do today)

- Lighthouse re-run after launch (mobile, homepage + 3 tool pages).
- Content phases 2b/2c (guides + tool-page upgrades) — ship as normal
  updates to the live site; no launch dependency.
