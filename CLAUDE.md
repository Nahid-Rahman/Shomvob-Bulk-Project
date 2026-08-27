# Bulk Forge — project context for Claude Code

## What this is
A reusable, single-page web app for Shomvob's QA team. It generates
QA-ready bulk-upload Excel (.xlsx) files for various company operations.
The user (QA engineer) picks an operation, fills a few input fields, and
the app generates a valid .xlsx matching Shomvob's real upload template
for that operation — entirely client-side, in the browser.

Repo layout: `index.html` is the pre-built, self-contained deployable
file; `src/` holds the editable source (`app.css`, `app.js`,
`app-data.js`, `part1.html`); `vendor/` holds the SheetJS library;
`build.py` assembles `src/` + `vendor/` into `index.html`. Run
`python3 build.py` after any edit under `src/`.

## Architecture decisions (already made, don't relitigate)
- **No backend, no database, no Supabase.** Every generation is random,
  in-memory, stateless — nothing needs to persist across sessions or be
  shared between users. Deploy target is Vercel as a plain static site
  (framework preset "Other", no build command, output directory `.`).
- **SheetJS `xlsx.mini.min.js`** (not `xlsx.full.min.js`) is vendored and
  inlined into `index.html` via `<script>`. The full build embeds legacy
  codepage tables containing literal U+FFFD characters that some strict
  UTF-8 validators reject (this broke publishing to Claude Artifacts) —
  mini avoids that and is 1/4 the size. Only basic write support
  (`aoa_to_sheet`, `book_new`, `book_append_sheet`, `writeFile`) is
  needed, which mini fully supports.
- **No `<script src="https://cdn...">` for anything** — everything is
  inlined so the page has zero external dependencies except the Google
  Fonts stylesheet link (IBM Plex Sans / IBM Plex Mono).
- File download works via plain `XLSX.writeFile()` (creates a Blob +
  triggers an anchor click) — this only works because the page is served
  from a normal origin (Vercel), not inside a sandboxed iframe. Keep it
  this way; don't add any capability-gated download API.

## Design system already in place (in src/app.css)
"Forge / anvil" visual identity — warm stone neutrals with a burnt-copper
/ ember-orange accent (not green, to stay distinct from semantic
success-green). Typography: IBM Plex Sans (headings/body) + IBM Plex Mono
(data/IDs/code-like values). Full light/dark theme support via CSS custom
properties (`:root`, `prefers-color-scheme: dark`, and `[data-theme]`
overrides). Layout: fixed dark sidebar (operation switcher) + scrollable
main panel with card sections + sticky bottom action bar. Keep new
operations visually consistent with this system — reuse the existing
`.section`, `.field`, `.chip`, `.dept-card`-style patterns rather than
inventing new component styles per operation.

## Operations — 1 of 5 built

The sidebar (`OPERATIONS` in `src/app-data.js`) lists 5 planned bulk
operations. Only **Employee Add** is implemented. The other 4 currently
render a "Coming soon" placeholder (see `renderMain()` in `src/app.js`).

### Employee Add — full spec (built, tested, do not change without asking)

**User inputs:**
- Number of employees: integer, min 10, max 300
- Employee ID prefix: exactly 4 letters, auto-uppercased on input
- Name source: Default (random Bangla names) or a character theme — Game
  of Thrones / Harry Potter / Marvel / DC / Games Character (picked via
  `THEME_POOLS` in `src/app-data.js`)
- Departments: 6 defaults (HR, Engineering/IT, Sales & Business,
  Marketing, Finance & Accounts, Operations) each with 4 default
  designations, toggleable per-department between "use these defaults"
  and "custom list"; plus unlimited custom departments (free-text name +
  free-text designation list, add/remove rows)

**Generated per row — 14 columns, must exactly match the
`Employees_List_Upload` sheet/header format of Shomvob's real template:**

| # | Column | Rule |
|---|--------|------|
| 1 | Employee ID* | `PREFIX0001` sequential, always starts at 0001 |
| 2 | Biometric ID | `PREFIXB0001` (prefix + "B" + same sequence) |
| 3–4 | First/Last Name* | from selected name source (Bangla pool = large first×last combo space, no repeats up to 300; theme pools = curated real character names, cycled with a numeric suffix on the surname past pool size) |
| 5 | Employment Type* | random: Permanent / In Probation / Intern only (Part Time, Contract deliberately excluded) |
| 6 | Probation Period (Months)* | Permanent → 0; others → random 3–6 |
| 7 | Joining Date* | weighted by year: ~60% previous year, ~25% current year (never future), ~15% two years ago |
| 8 | Gross Salary* | random ৳20,000–150,000, step 500 |
| 9 | Email | `firstname.lastname@yopmail.com`, lowercase, numeric-suffix deduped |
| 10 | Phone* | `880` + `1` + operator digit (3–9) + 8 digits = 13 digits, deduped |
| 11 | Gender* | matches the picked name's tagged gender (no "Prefer not to say") |
| 12 | Date of Birth* | age 18–45 relative to joining year, always before Joining Date |
| 13–14 | Department/Designation* | one dept picked at random from the user's configured set, one designation from that dept's list |

Output: single sheet `Employees_List_Upload`, row 1 = exact template
header labels (with `*` on required columns), data from row 2 (no
instruction/placeholder row — this is a ready-to-upload file). Filename:
`{PREFIX}_employee_bulk_upload_{YYYYMMDD}.xlsx`.

Already validated (Playwright, 25-row and 300-row batches): ID/email/
phone uniqueness, employment-type↔probation linkage, joining-date↔DOB
ordering, salary rounding, department↔designation consistency.

## Inspecting a template

`python tools/probe_xlsx.py <template.xlsx>` dumps sheets and visibility,
head cells with number formats, data validations (dropdown sources and
date/number constraints), comments, freeze panes and merged ranges. Needs
openpyxl. Use openpyxl rather than SheetJS for this — SheetJS cannot read
data validations, which is exactly where dropdown option lists live.

## Next work: the remaining 4 operations

- **Employee Attendance Add** — template inspected, some inputs confirmed,
  time-generation rules still being dictated by the user. See
  "Employee Attendance Add — spec IN PROGRESS" in `SPEC.md` and finish
  gathering those rules before writing any code.
- Leave Balance Add
- Payroll Custom Field Value Add
- Assets Add

For each: get the real Shomvob upload template (.xlsx) from the user,
inspect it with `tools/probe_xlsx.py`, confirm column-by-column
input/generation rules with the user (don't assume), then:
1. Flip its `status` from `"soon"` to `"active"` in `OPERATIONS`
   (`src/app-data.js`)
2. Add its data tables (name pools / option lists / etc. as needed) to
   `src/app-data.js`
3. Add a `<operation>Template()` render function + `wire<Operation>Events()`
   + `generate<Operation>Rows()` in `src/app.js`, following the pattern of
   `employeeAddTemplate()` / `wireEmployeeAddEvents()` /
   `generateWorkbookRows()`
4. Branch on `currentOp` in `renderMain()` to route to the new operation
5. Run `python3 build.py`, then sanity-test (Playwright or manual) that
   the generated file's headers/data match the real template exactly
