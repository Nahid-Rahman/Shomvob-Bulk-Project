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

## Design system (in src/app.css)

**Shomvob brand palette.** The tokens are the values Shomvob's own site
ships: brand green `#28a143` (with `#208136` / `#186129` for hover and
text-on-light), gold `#edb713`, ink `#262823`, canvas `#f7faf8`, pill
`#eff7f1`, destructive `#dc2626`.

The app originally used a burnt-copper palette chosen *specifically to
avoid green*, so that the accent could never be mistaken for a semantic
success colour. Since the brand is green, that separation is impossible,
and it is resolved the other way: **there is exactly one green.** Accent
and success both come from the brand family, gold carries warning, red
carries danger. In this app "ok" only ever means "input accepted", so
brand green reads correctly there. Don't reintroduce a second green.

Shomvob's site is light-only, so the dark-theme values are derived — a
brighter brand green (`#3dbf5a`) on a green-leaning near-black. Full
light/dark support via CSS custom properties (`:root`,
`prefers-color-scheme: dark`, and `[data-theme]` overrides); every colour
lives in those three token blocks, so a rebrand is one edit. The only
hard-coded colour outside them is `#fff` on the error toast.

Typography: IBM Plex Sans (headings/body) + IBM Plex Mono (data/IDs/
code-like values) — unchanged, and not matched to Shomvob's own fonts.

Layout: fixed dark sidebar (operation switcher) + scrollable main panel
with card sections + sticky bottom action bar. Keep new operations
visually consistent — reuse the existing `.section`, `.field`, `.chip`,
`.dept-card`, `.seg`, `.tally`, `.preview-table` patterns rather than
inventing new component styles per operation.

## Operations — all 5 built

The app opens on a **Dashboard**, not on an operation: a deliberately
tongue-in-cheek landing view ("this exists for people who cannot face
typing 4,200 cells — i.e. everyone") with a two-panel meme, three stat
tiles and a clickable card per operation. It is `currentOp === "welcome"`,
rendered by `welcomeTemplate()`, with the action bar hidden; its sidebar
entry lives in `#homeNav`, above the "Operations" label, and is wired in
`renderSidebar()`.

Two things about it worth keeping:

- **The Dashboard is the one screen in English.** Every operation's own
  copy stays in Banglish; don't "fix" either to match the other.
- **Its numbers are real** — card costs come from each operation's own
  limits and the sample account's 110 employees, and the hero's 5h 50m is
  4,200 cells at five seconds each. They live in `OPERATION_BLURBS`
  (`src/app-data.js`) rather than in markup, so keep them honest if a
  limit changes.
- The meme is a drawn spreadsheet — a fake `employees_FINAL_v7_use_this
  .xlsx` window with a blinking caret in an empty cell and "4,197 cells to
  go / 2:14 AM" along the bottom, i.e. the thing this app exists to
  prevent. It is built from styled divs, a table and one emoji, not an
  image: the page ships no external assets beyond the font, and a real
  meme picture would be someone else's to licence. Its caret blink is
  covered by the global `prefers-reduced-motion` rule.

All five operations in the sidebar (`OPERATIONS` in `src/app-data.js`) are
implemented and tested. `renderMain()` in `src/app.js` routes each one; the
"Coming soon" placeholder it still contains is now unreachable, kept for
whenever a sixth operation is added.

Two of the five build a file from scratch against a blank template
(Employee Add, Attendance Add, Assets Add); two fill values into the
system's own export and must not disturb anything else (Leave Balance,
Payroll Custom Field). Knowing which kind you are looking at matters more
than anything else in this codebase.

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

### Employee Attendance Add — built, tested, do not change without asking

Four required columns (`Employee ID*`, `Date*`, `In Time*`, `Out Time*`)
on a sheet named `Attendance_Bulk_Import`. Full rules live in `SPEC.md`;
the parts that are easy to get wrong:

- **Overtime is not a column.** The file only carries In and Out, so
  overtime is what pushes Out Time past the shift's end.
- **Absence and weekends are expressed as no row**, never a blank one —
  which also keeps all four required columns filled on every row written.
- **Weekends and holidays produce nothing** unless overtime is on and the
  employee falls in that day type's overtime percentage; then the whole
  attendance is overtime, In at shift start and Out at start + overtime.
- **Lateness is measured from the end of the grace period**, not the shift
  start.
- **A shift may cross midnight**; it stays one row, dated by the day it
  started, and its Out Time reads earlier than its In Time.
- `BD_HOLIDAYS` in `app-data.js` covers 2025 and 2026 only. Its lunar
  dates are a draft the user has not yet verified — the UI renders them as
  dashed removable chips for that reason. Adding a year is one more key.

### Assets Add — built, tested, do not change without asking

Blank template, so rows are generated. Sheet `Assets_List_Upload`, seven
columns of which three are required. Full rules in `SPEC.md`; the traps:

- **Asset Type is a free category, not derived from the name.** The
  template's own example rows deliberately mismatch the two (a monitor
  typed as `Printers`), which is how we know.
- **Asset Image is always blank** — a placeholder URL would only put a
  broken image link into the system.
- **Descriptions are paired with names** in `DEFAULT_ASSET_TYPES`, so the
  two columns always agree. A user's custom name gets no description
  rather than an invented one.
- **Employee IDs are optional here.** Both assignment columns are optional
  in the template, so with no IDs every asset comes out unassigned.
- **70-80% of assets get assigned**, drawn per batch from
  `ASSETS_ASSIGNED_BAND`, with no input to control it. An unassigned row
  leaves *both* the employee ID and the date blank.
- The type/name cards reuse Employee Add's department/designation classes
  on purpose; keep them looking alike.

## Deployment

Vercel, as a plain static site: framework preset "Other", no build
command, output directory `.`. `index.html` is already built and
self-contained, so there is nothing to compile — this is why there must
never be a `package.json` at the repo root (Vercel would try to build
it). The test tooling keeps its own `package.json` inside `tests/` for
exactly that reason.

`.vercelignore` keeps `CLAUDE.md` and `SPEC.md` out of the deployment.
They describe Shomvob's internal template structures, business rules and
test-account data, and a `*.vercel.app` URL is guessable and indexable.
`src/` is deliberately *not* excluded — `index.html` inlines all of it
anyway, so hiding it would achieve nothing.

## Tests

`tests/` holds browser tests that drive the built `index.html` in Chromium,
fill each form, download the generated `.xlsx` and assert on its contents.
Run them after any change under `src/` (build first — they test the built
file, not the sources):

    python build.py
    cd tests && npm run setup   # once
    npm test

Each assertion maps to a rule in `SPEC.md`; if one fails, check `SPEC.md`
before changing the test. The test tooling lives entirely inside `tests/`,
including its `package.json` — a `package.json` at the repo root would make
Vercel try to build what is deliberately a no-build static site.

### Leave Balance Add — built, tested, do not change without asking

The odd one out: it generates almost nothing. The user uploads the
system's own export (sheet `Leave_Balance_Already_Used_Upda` — that name
is truncated at Excel's 31-char limit and must be reproduced as-is), and
every column except `Already Used Leave` is carried through untouched,
row order included. Full rules in `SPEC.md`; the traps:

- **Read, don't invent.** Employee IDs, names, leave types and allocations
  all come from the uploaded sheet. Leave types are configured per company
  — the sample account had one called "Fight With Voldemort" — so they can
  never be hardcoded, and employee IDs follow no single prefix pattern.
- **`Already Used < Total Allocated + Earned Leave`**, strictly. Used
  leave is *not* bounded by earned leave; the real export broke that on
  361 of 550 rows.
- **Values are half steps** (0.5), and are scaled by how far into the
  calendar year today is — January small, October large.
- **An update may only increase.** A row that already carries a value must
  come back larger; a row already at its ceiling comes back untouched and
  is counted in the report rather than clamped.

### Payroll Custom Field Add — built, tested, do not change without asking

Fills in the system's own export, same shape of problem as Leave Balance.
Sheet `Custom Add-Deduct`. Columns A and B are Employee ID and Name;
everything after them is a custom field the company configured. Full rules
in `SPEC.md`; the traps:

- **Field names are read from the header and reproduced verbatim.** The
  real export's names contain typos (`Maintainance`, `Quiditch`) — do not
  hardcode them and do not correct them. The count of fields varies too.
- **The sign is a `(+)`/`(-)` suffix on the header**, so it is parsed for
  display only and written values stay positive. Both signs draw from the
  same user-supplied amount range.
- **Coverage is a percentage applied per cell**, not per employee. That is
  deliberate: it means some employees come out entirely zero, which the
  user explicitly asked for.
- **A cell that already has a value is never touched**, so re-running on a
  partly filled file cannot undo earlier work.
- **The output reuses the uploaded filename** — it carries a company code
  (`H`) that cannot be derived.

## Inspecting a template

`python tools/probe_xlsx.py <template.xlsx>` dumps sheets and visibility,
head cells with number formats, data validations (dropdown sources and
date/number constraints), comments, freeze panes and merged ranges. Needs
openpyxl. Use openpyxl rather than SheetJS for this — SheetJS cannot read
data validations, which is exactly where dropdown option lists live.

## Where this stands (2026-09-07)

All five operations are built, tested and pushed — 142 browser checks
across the five suites. The app is feature-complete against the five
templates the user supplied.

One thing still outstanding, from Attendance: the lunar dates in
`BD_HOLIDAYS` (`src/app-data.js`) are our draft and the user has not
verified them yet. The UI renders them as dashed removable chips so they
can be corrected without a code change. Ask before treating them as
correct.

## Adding a sixth operation

Nothing is outstanding, but if another operation is ever added, the route
that worked five times is: get the real Shomvob template (.xlsx) from the
user, inspect it with `tools/probe_xlsx.py`, confirm every column's rule
with the user before writing code (don't assume), then:

1. Flip its `status` from `"soon"` to `"active"` in `OPERATIONS`
   (`src/app-data.js`)
2. Add its data tables (name pools / option lists / etc.) to
   `src/app-data.js`
3. Add `<operation>Template()` + `wire<Operation>Events()` +
   `generate<Operation>Rows()` in `src/app.js`, following the existing
   five
4. Branch on `currentOp` in `renderMain()`, and add a case to the
   `updateSummary()` / `handleGenerate()` dispatchers
5. If it needs employee IDs, reuse the shared picker — `idSourceMarkup()`,
   `bindIdSource()`, `wireIdSourceSeg()` — rather than writing another one
6. Run `python build.py`, add `tests/<operation>.test.js` following the
   existing five, and check the generated file's sheet name, headers and
   data against the real template
