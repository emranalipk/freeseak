# FreeSeak — Project Rules (locked)

These rules are permanent. They apply to every update, by anyone (human or
AI assistant), forever. Breaking a rule is a bug, not a preference.

---

## Rule 1 — Dead code is deleted in every update

Every update MUST end with zero dead code:

- No unused files, components, exports, imports, variables or dependencies.
- When a feature is replaced, the old files are **deleted from the repo** in
  the same update — not left behind "just in case".
- `package.json` may not contain a dependency that nothing imports.

**Enforcement (automatic):** `@typescript-eslint/no-unused-vars` and
`no-unused-vars` are set to `"error"` in `eslint.config.mjs`, and the GitHub
Actions CI (`.github/workflows/ci.yml`) runs `npm run lint && npm run build`
on every push. A pull request that parks dead code fails CI and cannot ship.

---

## Rule 2 — Delivery format: one full zip, drag-and-drop to GitHub

Every delivered update is a **complete project zip** (this whole folder
minus `node_modules/`, `.next/` and `out/`):

1. Unzip it.
2. Open the folder, select **all** contents (including dotfiles like
   `.gitignore`).
3. Drag them into the GitHub repository page → *Add file → Upload files* →
   **Commit changes**. Existing files are overwritten automatically.
4. **Deleted files:** GitHub's upload cannot delete files. Every delivery
   comes with a "DELETE THESE FILES" list — delete each one in the GitHub
   web UI (open the file → trash icon → commit) before or right after the
   upload. Skip this and the old code stays in the repo (it will not break
   the build, but it violates Rule 1).

---

## Rule 3 — The domain lives in exactly one place

`src/lib/site.ts` → `SITE_URL = "https://freeseak.com"` is the **only**
place the public address is written. Everything else (sitemap, canonical
URLs, Open Graph, robots.txt) derives from it.

- `public/robots.txt` must match it (it is plain text and cannot import).
- Never hardcode the domain in any other file.
- History: v0.2 shipped with a `freespeak` typo in this constant and it
  silently de-indexed the whole site. Never again.

---

## Rule 4 — Every tool ships with its full SEO set

A tool is not "done" until it has all of this (the catalogue in
`src/lib/tools.ts` is the single source of truth):

1. A catalogue entry with a researched `name`, `short` (title-tag-quality
   description), `keywords` (including how people actually search: verbs,
   problems, "free", "no sign up"), `intro`, `howTo` (3+ steps) and `faq`
   (3+ real questions).
2. A working component in `src/components/tools/` + one line in
   `tool-registry.tsx`.
3. An Open Graph image at `public/og/<tool-id>.png` (1200 x 630), referenced
   in `src/app/tools/[id]/page.tsx`.
4. A smoke test that the tool still works before the update ships.

Titles follow the pattern: `Tool Name — Free Online, No Sign-Up | FreeSeak`.

---

## Rule 5 — Everything runs client-side

Every tool must work 100% in the browser. No uploads, no server-side
processing, no accounts. "Privacy by architecture" is the brand promise
stated on every page — it must stay literally true.

---

## Rule 6 — Version and changelog

Every update bumps `version` in `package.json` and adds a line to the
changelog table in `CHANGELOG.md`.

---

## Quick reference — how the site is built

| What | Where |
| --- | --- |
| Tool catalogue (single source of truth) | `src/lib/tools.ts` |
| Domain + site config | `src/lib/site.ts` |
| Tool pages | `src/app/tools/[id]/page.tsx` |
| Sitemap (auto-generated) | `src/app/sitemap.ts` |
| Add a tool | catalogue entry + component + registry line (see README) |
| Deploy | Cloudflare Workers static assets (`wrangler.json` → `./out`) |
