# Bulk Forge

QA bulk-upload Excel generator for Shomvob. Runs fully in the browser — no
backend, no database, no login. Currently supports one operation:
**Employee Add**. Four more are planned (Attendance Add, Leave Balance Add,
Payroll Custom Field Add, Assets Add) — see `SPEC.md`.

## Project layout

```
src/
  part1.html      page shell (sidebar, layout, the __APP_CSS__ placeholder)
  app.css         all styling (design tokens, light/dark theme)
  app-data.js     name pools (Bangla + 5 character themes) and default
                  department/designation lists
  app.js          all app logic: state, rendering, data generation, xlsx export
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

No environment variables, no database, no Supabase — everything the app
needs is already inlined in `index.html`.

## Why not deploy the source-split files directly?

Browsers don't resolve the `__APP_CSS__` placeholder or auto-concatenate
`<script>` tags across files the way `build.py` does — `index.html` has to
be the single assembled file for the page to work. Always run `build.py`
after touching anything in `src/` and commit the regenerated `index.html`
alongside your source changes.

## Adding the next operation

See `SPEC.md` for the full column-by-column spec of Employee Add (already
built) as a reference for the pattern to follow: get the real upload
template for the new operation, confirm each column's input/generation
rule, add it to `OPERATIONS` in `src/app-data.js`, then wire its form +
generation logic into `src/app.js` alongside `employeeAddTemplate()` /
`generateWorkbookRows()`.
