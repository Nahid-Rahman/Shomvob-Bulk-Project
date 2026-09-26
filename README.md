# Bulk Forge

QA tool for Shomvob HRIS, two parts:

- **Phase 1 — Bulk generators (done, all 5).** Client-side, no backend,
  no login beyond a joke gate: pick an operation (Employee Add,
  Attendance Add, Leave Balance Add, Payroll Custom Field Add, Assets
  Add), fill a few fields, get a real bulk-upload `.xlsx` matching
  Shomvob's own template. See `SPEC.md` for the column-by-column rules.
- **Phase 2 — Company Setup + Admin Panel (in progress).** Signs in
  with a real Supabase-backed account and writes directly into a real
  Shomvob dev/staging company through its actual API (~20 settings
  modules — departments, leave types, payroll config, etc.), plus an
  Admin Panel (manage accounts, tier/access, audit log) and a Tiered
  Access system gating who can use Bulk vs. Company Setup. This half
  **does** use a real backend — a dedicated Supabase project (Auth +
  a few tables + one Edge Function) — the "no backend" line above is
  Phase 1 only.

**Read `CLAUDE.md` first if you're picking this project up** — it's
the full, dated history of every decision made and why, kept current
after every change. `TODO.md` is the short version: what's actually
left. As of 2026-09-26, that's just two things: a still-unscoped
"Report validation" item, and the Welcome/tier routing page (the last
piece of the Tiered Access journey — real enforcement is already done,
only the dedicated landing page itself is missing). Everything else in
both phases is built, tested and pushed.

## Project layout

```
src/
  part1.html      page shell (sidebar, layout, every static modal, the
                  __APP_CSS__ placeholder)
  app.css         all styling (design tokens, light/dark theme)
  app-data.js     data tables for both phases — Phase 1's name pools
                  (15 themes) and default department/designation lists,
                  Phase 2's ENVIRONMENTS/SETTINGS_GROUPS/bank names/etc.
  app.js          all app logic for both phases — one large file
                  (11,000+ lines); build.py inlines it as-is, nothing
                  about it requires splitting
vendor/
  xlsx.mini.min.js   SheetJS (MIT licensed), used to build the .xlsx file
                     client-side. The "mini" build is used deliberately —
                     the "full" build embeds legacy codepage tables that
                     contain literal U+FFFD characters, which some strict
                     UTF-8 validators (e.g. Claude Artifacts) reject.
build.py          assembles src/ + vendor/ into the single self-contained
                   index.html that actually gets deployed
index.html        pre-built output — this is what Vercel serves
```

## Editing

Edit files under `src/`, then rebuild:

```
python3 build.py
```

This regenerates `index.html` (everything inlined — CSS, data, app logic,
and the xlsx library — so the deployed page has zero external requests
except Google Fonts for IBM Plex Sans/Mono).

## Deploying to Vercel

No build step is needed on Vercel's side — `index.html` is already the
finished static output.

```
npm i -g vercel     # once
vercel               # first deploy, follow prompts
vercel --prod        # subsequent production deploys
```

Or connect the GitHub repo in the Vercel dashboard and it will redeploy on
every push to `main`. Framework preset: **Other** (no build command, output
directory `.`).

No environment variables and nothing to configure on Vercel's side —
`index.html` is fully self-contained, including Phase 2's Supabase
project URL/publishable key (safe to ship client-side by design, see
`CLAUDE.md` → "The Supabase project itself"). The live deployment is
already connected to that real Supabase project; a fresh clone works
against it immediately, nothing to set up.

## Why not deploy the source-split files directly?

Browsers don't resolve the `__APP_CSS__` placeholder or auto-concatenate
`<script>` tags across files the way `build.py` does — `index.html` has to
be the single assembled file for the page to work. Always run `build.py`
after touching anything in `src/` and commit the regenerated `index.html`
alongside your source changes.

## Adding a sixth Phase 1 operation, or a new Phase 2 settings module

All 5 Phase 1 operations and all ~20 Phase 2 settings modules are built
already — nothing outstanding in either. If a new one is ever asked
for, `CLAUDE.md` has the exact route that worked every time so far:
"Adding a sixth operation" (bottom of the file) for Phase 1, or the
`SETTINGS_MODULE_HANDLERS` lookup-table pattern described throughout
the Phase 2 section for a new settings module.
