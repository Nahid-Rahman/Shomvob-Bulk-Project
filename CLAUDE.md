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
- **One exception to inlining: `assets/lazy_cat.mp4`**, the video on the
  login card. It is 1.4MB, so a data URI would put ~1.9MB of base64 ahead
  of the login screen and nothing would paint until it all arrived. It is
  referenced by relative path instead, which still works when `index.html`
  is opened straight off disk and lets the video stream and cache on its
  own. So `index.html` plus `assets/` travel together now. The logo stays
  inlined — at 5.5KB it costs nothing.
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

**Appearance picker** — three states in the sidebar footer: Auto, Light,
Dark. It is called *appearance*, not *theme*, because `.theme-card` is
Employee Add's name-theme picker and the two are unrelated; keep the
names apart. Auto means **no `data-theme` attribute at all**, which is
what the `prefers-color-scheme` block expects and is the behaviour the
page had before the control existed — so adding the switch took nothing
away. `wireAppearance()` in `src/app.js` owns it.

Two things about it that look like duplication but are not:

- **A tiny inline script at the very top of `src/part1.html` reads the
  stored value before the stylesheet.** `app.js` runs at the end of the
  body, and by then a stored "light" on a dark-mode machine would have
  painted dark and would visibly flip. That script is the only place in
  the app that repeats a key name (`bulkforge-appearance`); it earns it.
- **This is the one thing the app persists.** The "nothing survives a
  reload" rule is about generated input, which is data; the appearance is
  a display preference. Every `localStorage` access is wrapped in
  `try`/`catch` because a locked-down browser throws rather than
  returning null.

Adding the switch also exposed two controls that had **never been styled
at all** — `input[type="email"]`, `input[type="password"]` (the login
card) and `input[type="file"]` (both upload screens). The selector list
only covered `text`, `number`, `date` and `time`, so those three were the
browser's own white boxes. On the light theme that passed for correct,
which is why it went unnoticed for so long. If you add an input of a new
type, add it to that selector list.

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

- **All UI copy is English**, with a dry, lightly self-deprecating tone
  and the occasional emoji on a toast. The operation pages were originally
  written in Banglish and were converted on 2026-09-08 — don't reintroduce
  it. Banglish stays in conversation with the user, not in the product.
- **Its numbers are real** — card costs come from each operation's own
  limits and the sample account's 110 employees, and the hero's 5h 50m is
  4,200 cells at five seconds each. They live in `OPERATION_BLURBS`
  (`src/app-data.js`) rather than in markup, so keep them honest if a
  limit changes.
- **The `<figure class="meme">` slot is the user's to fill.** What sits
  there now — a drawn spreadsheet window, `employees_FINAL_v7_use_this
  .xlsx`, caret blinking in an empty cell, "4,197 cells to go / 2:14 AM"
  — is a placeholder he intends to replace with his own meme. Don't
  iterate on it unprompted.

  If he supplies an image: the page is self-contained apart from the
  font, so either drop the file in the repo root and reference it
  (fine on Vercel, but `index.html` stops being standalone), or have
  `build.py` inline it as a base64 data URI, which keeps that property.
  Prefer the second.

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

**Nothing the user configured may be quietly skipped.** This is the rule
the whole app is now held to, not just one screen: if a choice cannot be
honoured, generating is blocked and the reason names what is wrong. It
started on the card-based screens (Employee Add's departments, Assets
Add's types), where **a ticked card with nothing selected inside it** was
dropped from the output silently — you could tick three departments, get
one in the file, and never learn why. `departmentState()` and
`assetTypeState()` split the configured cards into `final` and
`incomplete`, and the warning names the incomplete ones. Blank custom
rows are filtered out rather than counted, since an empty "Add
designation" row was putting an empty string into a required column.

An audit on 2026-09-09 found three more of the same class in Attendance
Add, all now blocked with a named reason (see that section). When adding
an operation, assume this class of bug is present until you have checked
for it: for every input the user can fill, ask what happens if it is
half-filled, and make sure the answer is a message rather than a smaller
file.

Each of those screens also has bulk shortcuts — a labelled strip above the
list for the whole section, and a per-card button beside the mode toggle.
They are deliberately a different shape from the controls they act on so
they don't read as one more option.

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
- **An employee left off every shift is an error, not a dropped row.**
  With more than one shift you could paste 20 IDs, assign 3, and get a
  3-employee file with no warning. Likewise a shift with nobody on it, and
  a range whose every day is a weekend or holiday with overtime off —
  which used to pass the gate and fail on a toast after the click.
  `attendanceProblems()` catches all three; `rangeDayCounts()` is the
  shared helper that says how many days of a range could yield a row at
  all, and `renderRangeTally()` reads the same numbers so the tally and
  the gate can never disagree.
- `BD_HOLIDAYS` in `app-data.js` is **2026 only, and read off Shomvob's
  own HR system** (Holiday Management → 2026 → All → Active) — not a
  government gazette, because the company's calendar is what the test data
  has to match. Nothing in it is a guess. The draft it replaced had the
  Eid ranges too short and was missing Election Day, Shab e-Barat,
  Muharram, Chaitra Sankranti and Student-People Uprising Day outright.
  Adding a year is one more key; a range in a year with no key gets no
  holidays and the UI says so.

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

## Per-operation media rail

An operation page can carry a video in a sticky right-hand rail: the form
scrolls on the left at ~65% of the width, the clip holds the middle of the
viewport on the right. Wired through `OPERATION_MEDIA` in `src/app-data.js` — one entry per
operation id, and **an operation with no entry gets no rail and keeps its
full 760px form**, so a page can be left without one and nothing else
changes. `paintOperation()` in `src/app.js` decides which shell to render.
All five are filled: `assets/op_<operation_id>.mp4`, the user's own clips.

Clip shape does not matter — the frame takes the rail's width and its
height follows the video's aspect, so portrait (720x1280) and landscape
(848x642) both sit centred with nothing cropped or stretched. Name files
without `#` or spaces: `#` starts a URL fragment and would silently
truncate the `src`.

Three things it is easy to break:

- **The rail must be shorter than the box it sits in.** At the very end of
  a scroll a sticky element gets lifted by its own containing block; the
  slack between `.op-media`'s height and `.op-media-frame`'s
  `max-height` is what stops the clip being cut off when that happens.
  Verified at 1440x900, 1280x900 and 1366x768 — 0px clipped at every
  scroll position.
- **Below 1100px the split collapses** back to a single 760px column with
  the clip beneath, because the form needs its width back before the video
  does.
- Videos are separate files in `assets/`, never data URIs, and they honour
  `prefers-reduced-motion` the same way the login clip does.

## The login gate is a joke, not a control

`#loginGate` in `src/part1.html` covers the app on load and clears when the
form is submitted with the credentials in `DEMO_LOGIN`
(`src/app-data.js`) — which are printed on the card, pre-filled into the
inputs, and readable in the page source. That is the gag: the app is about
not doing tedious things, so it does the typing for you.

**Never present it as security, and never put anything behind it that
would matter if bypassed.** It gates nothing: every file the app makes is
random test data generated in the visitor's own browser. The card says so
in its own footnote — keep that line.

The card sits on the left with the user's own cat video
(`assets/lazy_cat.mp4`) on the right; they stack under 860px. The video is
muted, looping and autoplaying, except under
`prefers-reduced-motion: reduce`, where it holds the first frame and gains
controls so playing it stays the visitor's choice.

Nothing is persisted, so a reload asks again; one click clears it. (The
appearance choice is the sole exception, and it is not behind the gate.)
Tests call `signIn(page)` from `tests/lib.js` straight after `page.goto`.

**`#loginPass` has the same show/hide toggle as Company Setup's password
fields** (2026-09-10, `pwFieldMarkup()`'s markup hand-written into
`part1.html` since the gate is static shell, not JS-templated; wired via
`wirePasswordToggles(gate)` in `wireLogin()`). Consistency rather than
necessity — the credential is already printed in plain text a few lines
down in `#gateCreds`. Tested in `tests/gate.test.js`, the one suite that
inspects the gate's own DOM before signing in.

There is deliberately **no appearance picker on the gate itself** — it
lives in the sidebar, one click away, and a second copy on a card whose
whole point is that it barely gates anything would be clutter.

The **Log out** button in the sidebar footer is `location.reload()`. That
is the honest implementation given nothing is persisted: it clears every
pasted list, upload and shift assignment and the gate comes back on its
own, rather than hiding the app over live state.

## Guarding work in progress

**Switching operations loses nothing.** Each operation's state lives in a
module-level object (`att`, `leave`, `payroll`, `assets`, `departments`)
and the form is rebuilt from it, so a pasted ID list, an uploaded file and
every shift assignment all survive a round trip — verified by test. So
there is deliberately **no** warning when navigating between pages; it
would be a false alarm.

What does throw work away is a reload or closing the tab, since nothing is
persisted apart from the appearance choice. Two guards, both keyed on
`hasUnsavedWork()`:

- **Log out** opens the "Hey Lazy!" dialog (`#discardModal`) when there is
  work. The safe button takes focus and Escape backs out, so a stray
  keypress cannot cost anything. `leavingOnPurpose` is set before the
  reload so the unload guard doesn't ask a second time.
- **Reload / tab close** goes through `beforeunload`. **The browser shows
  its own wording there and will not accept ours** — that is a deliberate
  anti-phishing restriction, so "Hey Lazy!" cannot appear on that one. All
  we control is whether it asks at all.

## Sidebar branding

The Shomvob HR logo appears in two places: the sidebar head (logo tile,
then **Bulk Forge** / "for Shomvob HRIS") and the login card (tile beside
"**Bulk Forge** for Shomvob HRIS"). The sidebar shape follows Shomvob's
own admin sidebar, which is what the user asked for. It briefly lived on
the dashboard body too; that was removed, because two copies of one logo
within a few hundred pixels read as duplication rather than design.

`assets/shomvob_hr_logo.png` is **unmodified artwork** — the user's own
file, trimmed of its blank canvas and quantised, nothing else. Two things
follow from what it is:

- It came as a **JPG with a white ground and no alpha**, so it sits on a
  white tile rather than being keyed transparent. Keying would eat the
  white gaps inside the mark and halo the thin wordmark. On the dark
  sidebar the tile reads as deliberate; on the white login card it gets a
  border so it still reads as a tile.
- The source held only **95x88 px of actual mark** inside a 200x200
  canvas, so it is shown at 92px. Much smaller and its built-in "Shomvob
  HR" wordmark turns to mush. If a higher-resolution or SVG version turns
  up, swapping the file is the whole job.

The "Lazy" stamp is a separate CSS layer hanging off the tile's corner,
never burned into the image.

`build.py` inlines the PNG as a base64 data URI through the
`__SHOMVOB_LOGO__` token. That is the mechanism to reuse for any future
binary asset: add it to `INLINE_ASSETS` in `build.py` and reference the
token from the sources. `index.html` stays self-contained that way.

## Sidebar icons

Each operation carries a line icon matching the equivalent item in
Shomvob's own admin sidebar: a grid for the dashboard, two people for
employees, a clock for attendance, a calendar for leave, a dollar sign for
payroll, a monitor for assets. They live in `OP_ICONS` (`src/app.js`) as
raw SVG path data, drawn by hand rather than pulled from an icon library —
the page ships no external assets. `opIcon(id)` falls back to the old
`.op-dot` when an id has no icon, so a new operation renders sensibly
before you draw one for it.

## Deployment

**Live at https://shomvob-bulk-project.vercel.app** — Vercel project
`nahidsmrahman/shomvob-bulk-project`, connected to this GitHub repo, so
**every push to `main` deploys to production automatically** (verified: a
push produced a new Production deployment ~35s later). Nothing needs
running by hand.

It is a plain static site: framework preset "Other", no build command,
output directory `.`. `index.html` is already built and self-contained, so
there is nothing to compile — this is why there must never be a
`package.json` at the repo root (Vercel would try to build it). The test
tooling keeps its own `package.json` inside `tests/` for exactly that
reason. **Do remember to run `python build.py` before pushing**, since it
is `index.html` that ships, not `src/`.

Two Vercel quirks worth knowing. The clean production domain is public,
but per-deployment URLs (`...-<hash>-nahidsmrahman.vercel.app`) sit behind
Vercel Authentication and 302 to an SSO page — that is the default
protection, not a misconfiguration. And `vercel link` writes a
`.env.local` containing a `VERCEL_OIDC_TOKEN`; `.gitignore` covers it via
`.env*`, and it must stay that way.

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

Eight suites, 436 checks. `appearance.test.js` is the odd one: it opens two
contexts, one per OS colour scheme, because "auto follows the OS" cannot
be checked from a single one. Its colour assertions read the computed
background's average channel rather than an exact hex, so a palette tweak
does not fail a test about the switch working. `company-setup.test.js`
mocks every network call (`page.route()`) rather than touching the real
Supabase project or either Shomvob environment. `gate.test.js` is the
only suite that inspects the login gate's own DOM before signing in —
every other suite clears it immediately via `signIn(page)`.

Each assertion maps to a rule in `SPEC.md`; if one fails, check `SPEC.md`
before changing the test.

`watchPageErrors(page)` in `tests/lib.js` collects console and request
failures for the "no page errors" check. It ignores failures of the Google
Fonts stylesheet — the page's one external dependency, which has failed a
whole suite on a network hiccup — while still failing on a broken local
asset, since resource failures are judged by URL. Don't widen that filter
to cover `assets/`. The test tooling lives entirely inside `tests/`,
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

## Where this stands — phase 1 complete (2026-09-09)

All five operations are built, tested and pushed — 224 browser checks
across six suites. The app is feature-complete against the five templates
the user supplied.

The holiday table is the user's own HR calendar rather than our draft, so
nothing in the app is knowingly guessed.

**The generated files have been uploaded into the real Shomvob HRIS and
the importer accepted them** — the user did that himself on 2026-09-09 and
reported no errors. That was the project's largest unknown for its whole
life: every rule here was inferred from a template and confirmed in
conversation, and the test suite could only ever prove a file matched its
template's *shape*, never that the importer would take it. It now has.

So the rules in `SPEC.md` are no longer only "what the user told us" —
they are what the system actually accepts. Treat that as the strongest
evidence in the repo, and don't relitigate a rule against a fresh reading
of a template. If a real upload ever does fail, fix against that error's
actual text rather than re-deriving from the template.

Phase 1 is closed. Phase 2 — Company Setup — started 2026-09-09; see its
own section below. Its scope came from a separate conversation with the
user; don't assume the rest of it from what phase 1 contained.

## Phase 2 — Company Setup (started 2026-09-09)

Phase 1 generates files for a human to upload by hand. Phase 2 is a
different kind of thing: a sidebar page, under **Setup** rather than
**Operations**, that calls a real Shomvob environment's own API directly
and writes into a real test company — departments, designations,
branches, leave types, payroll configuration, and eventually the rest of
what a fresh company needs before anyone can use it. `currentOp ===
"company_setup"`, routed in `renderMain()` like any other page, but nothing
else about it is like the other five.

**This is the one part of the app that is not risk-free**, and every
decision below follows from that one fact.

### Two logins, not one

The section is gated twice, and the two gates are not the same kind of
thing:

1. **Bulk Forge's own sign-in** — email + password, checked against
   Supabase Auth (`supabaseSignIn()`). This is what decides *who may open
   this section at all*, and it also fixes which environment the rest of
   the session talks to (picked in the same form, via the `.seg` control
   also used for e.g. the ID-source picker elsewhere). Sign-up is switched
   off on the Supabase project (`Authentication → Sign In / Providers →
   Allow new users to sign up`, unchecked), so passing this gate really
   means "someone added this email in the Supabase dashboard by hand" —
   nothing in this repo controls that list, and nothing here should try
   to.
2. **The real company login** — once step one passes, a second form asks
   for a company-admin email + password, checked by the actual Shomvob
   dev or staging server (`companySignIn()`, `POST {apiBase}/auth/login`).
   This is what decides *what the section can actually do*: there is no
   separate permission model layered on top of it. Whatever that account
   can do through the real HRIS is exactly what this page can do on its
   behalf, no more — the page inherits the account's permissions rather
   than asserting any of its own.

Both tokens live only in the module-level `setup` object and are **never
written to storage** — no `localStorage`, no cookie. A reload clears them
exactly like every pasted ID list and shift assignment elsewhere in the
app; there was never a decision to make about "should this survive a
reload" the way there was for the appearance choice, because a token is
not a preference. Signing out (`#setupSignOutBtn`, always visible once
signed in) clears both. Disconnecting (`#setupDisconnectBtn`, only once a
company is signed in) clears only the company token, keeping the tool
sign-in and environment, so switching to a different test company doesn't
mean signing into Bulk Forge itself again.

### Two servers, fixed at build time, never a text field

`ENVIRONMENTS` in `src/app-data.js` is the complete list — `dev` and
`staging`, each with its own `apiBase`. **There is no third option and no
field anywhere to type a URL into.** Adding an environment, or ever
pointing this at production, means editing that file and running
`python build.py`, not something that can happen by clicking around the
page. This is deliberate: a tool whose whole second half is "write data
into a real company" should not have a path from "I mistyped a URL" to
"I just flooded production."

The environment picked in step one is shown for the rest of the session
in a persistent strip above the page body (`#setupStatusBar`,
`setupStatusBarHtml()`) — an `.env-badge`, coloured by environment (`--env-
dev` / `--env-staging` tokens in `src/app.css`, blue and purple). Those
are new hues, not reused from the existing palette: not the app's one
green (reserved for accent/success), not the warning gold, not the danger
red — an environment is an identity, not a verdict, and needed to read as
clearly different from all three of those as it does from the other
environment. The strip is meant to answer "which server am I about to
touch" without having to scroll up, which is the whole reason it lives
outside `#setupBody` and survives every step past the first.

### The Supabase project itself

Project `Shomvob Bulk Generation`, org `Shomvob SQA` (a shared team
account, not any one person's). `SUPABASE_URL` and `SUPABASE_ANON_KEY` in
`src/app-data.js` are the **publishable** key — safe in a public page by
design, since it identifies the project rather than authorizing anything
by itself. The `service_role` key must never appear anywhere in this
repo; it bypasses the row-level security this project doesn't even need
yet, since there are no tables — this integration only ever uses the Auth
service.

The project has no tables and doesn't need any: the "allowlist" *is* the
Supabase user list. Anyone the user adds by hand in the dashboard
(Authentication → Users) can sign in; nobody else can, because sign-up is
off. If an audit log of who ran what against which environment is ever
wanted, that would need a table and RLS — deliberately not built yet,
since nothing past step one currently needs one.

### CORS

Supabase's Auth endpoint sends its own CORS headers for every project, so
step one works from the deployed Vercel origin with nothing extra. Step
two does not: `dev.api-hr.shomvob.com` and `staging.api-hr.shomvob.com`
each need to answer the page's origin's requests, which is a change on
their side, not this repo's. `companySignIn()` cannot tell an actual
network failure apart from a CORS rejection — `fetch` throws the same
generic error for both — so it assumes CORS, since that is the likelier
story for a server that already answers Postman fine, and says so rather
than showing a bare "network error".

### Navigation model for the settings modules (confirmed & built 2026-09-09)

Settled before any module was built, because it changes what "add a
module" means: **the ~20 settings modules are a free-pick grouped grid
in the main content area, never a sidebar submenu and never a numbered
wizard.** Two levels, both implemented:

- **The sidebar stays exactly one line — "Company Setup" — forever.**
  Nesting ~20 items under it (mirroring the Postman collection's own
  `00_/01_/02_.../03_...` folder numbering) was the instinctive first
  idea and was rejected: it would make Setup's sidebar footprint dwarf
  every one of the five Operations, and it breaks the one rule the
  sidebar has held since phase 1 — it switches top-level pages, never a
  page's internal workflow.
- **Level 1 — the group grid.** Once connected, `setupConnectedTemplate()`
  renders one card per entry in `SETTINGS_GROUPS`
  (`src/app-data.js`) — Company Settings, Employee Settings, Leave,
  Payroll, Attendance — each showing an `n/total done` count for the
  session (`groupDoneCount()`), and always laid out in a single row
  (`grid-template-columns: repeat(SETTINGS_GROUPS.length, 1fr)`, set
  inline rather than a fixed number, so it stays one row whatever the
  count is — falls back to wrapping under 900px, where equal-width
  columns stop being legible). **Clicking a card opens that group**;
  there is no enforced order between groups. (Offboarding filled this
  slot in the first draft and was wrong — it isn't one of the real
  Settings groups in the Postman collection; Attendance Settings is, and
  had been missed entirely. Corrected 2026-09-09.)
- **Level 2 — a group's own tabbed page**, added the same day after
  comparing two real screenshots of the actual HRIS admin (its "Company
  Settings" and "Org Structure" pages both use exactly this pattern —
  recreated from that source, not invented): `setupGroupPageTemplate()`
  shows a `.settings-tabs` strip of every module in the group, and
  `wireSetupGroupPage()` switches between them on click with no
  requirement to visit them in any order. A tab whose module was saved
  this session carries a small green dot. Modules with no code behind
  them yet render `settingsComingSoonHtml()` — the same honest
  placeholder unbuilt operations get in `renderMain()`, just scoped to
  one tab instead of a whole page.
- **Only a genuine data dependency blocks a module, and only that one
  module** — checked live against the real company (e.g. Designation
  needs a Department to exist, Leave Policy needs a Leave Type), never
  by position in a list. A blocked module shows one line naming what's
  missing plus a shortcut straight to that specific module, not a tour
  of unrelated ones. Most of the ~20 modules have no dependency at all
  and simply open. (Not yet needed by Company Profile, which has none —
  first real use will be whichever module needs it first.)
- The mockup that settled level 1 (three states of the grid plus an
  explicitly-rejected linear-wizard alternative, shown side by side) is
  worth keeping as a reference if this gets relitigated:
  https://claude.ai/code/artifact/192ba11b-5e7c-43ce-99a1-f0550e8a09bc

**Company Setup gets a wider content column than the five generators**
(`.main-inner.wide`, 1100px vs. the default 760px) — its field-rows,
textareas and tab strip actually use the room; the generators keep the
narrower column they were designed for readability at. `renderMain()`
adds the `wide` class only on the `company_setup` branch and every other
branch removes it (`paintOperation()` removes it for the five
operations, the welcome and coming-soon branches remove it directly), so
it can never leak onto another page.

**Every button in this section that makes a real network call** —
sign in, the company login, Company Profile's Save — shows a spinner
plus one line from `BUSY_MESSAGES` (`app-data.js`), picked at random via
`setBtnBusy()`/`clearBtnBusy()` in `app.js`, so a real wait always gets
a moment of the app's own voice instead of a bare disabled button. Kept
mostly English per the "no Banglish in the product" rule, except one
entry kept verbatim as a deliberate wink rather than dropped outright.
Regenerate has no real wait (it's synchronous, no network call) and
deliberately doesn't get a fake spinner — the busy state is reserved for
places with an actual delay to fill.

**Colour pass (2026-09-09):** the first build of this section leaned on
plain white/grey/black and read as flat next to the rest of the app.
Fixed by reusing existing tokens and patterns rather than inventing
new ones — `SETTINGS_GROUP_ICONS`/`settingsGroupIcon()` draws one accent-
green line icon per group card (Leave and Payroll reuse their operation
icons outright); each card's done count is the app's existing `.tally`
component (`.tally.ok` once every module in the group is done) instead
of plain grey text; the "Connected" banner reuses the same success-soft
treatment `.tally.ok`/`.validation-banner` already use for status
elsewhere, rather than a plain white `.section`; and the active tab's
label is accent-coloured. Deliberately did *not* add a left-border
accent stripe on the cards — that's the one AI-slop container pattern
this app's own design guidance calls out to avoid.

A same-day follow-up: the shared `.page-desc`/`.section-note`/`.tally`
classes read noticeably lighter here than the rest of Company Setup
warranted. Sizes and weights are bumped via `.wide .page-desc` /
`.wide .section-note` / `.wide .tally` / `.wide .settings-card-name` /
`.wide .settings-tab` — scoped to the `wide` class so the five
generators, which share those same base classes, keep the weights they
were designed at. `.wide` only ever applies to Company Setup, so this
can't leak.

**Per-module icon (2026-09-10, revised same day):** each of the 21
settings modules carries its own small icon at the right end of its
content card's own header row (`SETTINGS_MODULE_ICONS`/
`settingsModuleIconHtml()` in `app.js`) — a bank icon for Bank Info, a
map pin for Locations, a percent sign for Tax, and so on, one distinct
glyph per module rather than reusing its group's icon. Injected **once,
centrally**, in `setupGroupPageTemplate()`: every module template's
returned HTML, whichever of its own states
(ready/loading/error/blocked-on-dependency) is currently rendering, ends
its section-head with the same literal `</h2></div>`, so a single
`body.replace("</h2></div>", ...)` right after `handler.template()` runs
plants the right module's icon as the header's second flex child —
`.section-head`'s own `justify-content: space-between` puts it at the
far right for free — without editing all 21 templates individually.
Themeable for free — the SVG uses `stroke="currentColor"` with no fill,
`.module-icon` sets `color: var(--accent)` at a low opacity, so it reads
correctly in light, dark and auto without a single hex value; verified
with Playwright screenshots in both `colorScheme: "light"` and `"dark"`
contexts.

**First attempt, dropped the same day:** the very first version was a
large, low-opacity watermark absolutely positioned in the card's
bottom-right corner. Two things about it didn't hold up once actually
looked at: bottom-anchoring put it below the fold on every card taller
than one screen (most of them), so it was essentially never seen, and
`overflow: hidden` on the card sliced a visible chunk off it on cards
where it wasn't. The header-row icon fixes both by construction — a
normal flex child has nothing to clip and can't end up below the fold,
since the header is the first thing rendered when a tab opens. Worth
remembering if a "watermark" idea comes up again for this app: a large
decorative background mark and "always inside a scrollable, variable-
height card" don't mix well.

### Company Profile — first settings module (built 2026-09-09)

Lives at Company Settings → Company Profile, the group's default tab.
`PATCH {apiBase}/company-profile` with `Authorization: Bearer
{setup.companyToken}` — the first real write this app has ever made
into an actual company. Every field is generated, none typed by hand;
the generation logic is the Postman collection's own pre-request
script, ported field-for-field rather than redesigned (`app-data.js`
holds the pools verbatim: `COMPANY_LEGAL_SUFFIXES`,
`COMPANY_INDUSTRY_PAIRS`, `COMPANY_DOMAIN_EXTENSIONS`,
`COMPANY_DESCRIPTION_TEMPLATES`, `COMPANY_MISSION_TEMPLATES`,
`COMPANY_VISION_TEMPLATES`; `generateCompanyProfileFields()` in
`app.js` is the port).

- **`legalName` comes from the real connected company's own name**
  (`setup.companyName`, from the company login response) plus a random
  suffix — never a value the visitor typed, same principle as the
  company login itself deciding which company this is.
- **`tegNo`'s real meaning is unknown to everyone who has touched
  it** — the Postman script's own author admitted as much in its
  comments, and the user doesn't know either. A real staging company
  was found holding free text there (`NOMUGGLESALLOWED`), so the field
  isn't validated as numeric server-side; the 13-digit dummy pattern is
  kept anyway because it reads as a plausible registration number for
  QA data, which a joke string doesn't.
- **`industry`/`businessType` are a paired pool**, so a generated
  company never lands on an incoherent combination — the same
  defensive shape as Employee Add's gender matching its picked name.
- **Fields stay editable after generating.** Regenerate re-rolls
  everything; nothing stops fixing one field by hand before Save
  (verified by test: whatever is in the inputs at Save time is what
  gets sent, not the last-generated object).
- **Company Logo is deliberately left out**, on the user's call
  (2026-09-09) — it is a multipart file upload (`PUT
  {apiBase}/company/profile-picture`), not generated data, and doesn't
  fit this module's shape. Revisit later; don't build it as a side
  effect of touching this module again.
- Success is the server's own `"Company profile saved successfully"`;
  failure shows the server's own `message` verbatim, same discipline as
  the two logins.

**Module dispatch is a lookup table, not a growing ternary chain**
(added alongside the second module): `SETTINGS_MODULE_HANDLERS` in
`app.js` maps a module id to its `{template, wire}` pair;
`setupGroupPageTemplate()`/`wireSetupGroupPage()` fall through to
`settingsComingSoonHtml()` for any id with no entry. Adding a module
means adding one entry here, not another branch.

### Bank Info — second settings module (built 2026-09-10)

Company Settings → Bank Info. `POST {apiBase}/company-bank-informations/save`,
same shape as Company Profile — ported verbatim from the Postman
collection's pre-request script (`BANK_NAMES`, `BANK_SHORT_CODE_MAP`,
`MFS_CODES` in `app-data.js`; `generateBankInfoFields()` in `app.js`).
Two things this endpoint does differently from Company Profile, both
confirmed against the collection rather than assumed:

- **Success is `201`, not `200`.** `saveBankInfo()` checks
  `res.status !== 201` explicitly rather than `!res.ok` — a real `200`
  here would mean something changed upstream and should fail loudly, not
  be treated as success by accident. Tested: a mocked `200` is treated as
  a rejection.
- **`accountNumber` goes over the wire as a JSON number, not a string** —
  the collection's own request body has it unquoted. Kept as a string in
  the form (so it edits like every other field) and converted with
  `Number()` only inside `saveBankInfo()` at send time. Tested: the
  request actually sent carries a JS `number`, not a numeric string.

`npsbCode`/`beftnCode` are derived from the same bank via
`bankShortCodeFor()` (`{shortCode}ACT` / `{shortCode}BFT`), so they never
disagree about which bank they belong to — same paired-field discipline
as Company Profile's industry/businessType. The map's codes are the
Postman script's own, not always the bank's real published abbreviation
(`"Agrani Bank"` → `"AGRANI"`, not any official short form) — kept as-is,
since matching the script matters more than matching the bank.

### Fixed the same day: per-module state was never cleared on Sign out/Disconnect

Found while adding the third module. `companyProfile.fields` (and
`bankInfo.fields`) are only ever (re)generated when null — so
disconnecting from company A and connecting to company B left company
A's generated values sitting in the form, unregenerated, until someone
happened to click Regenerate. `resetModuleState()` now wipes every
module's cache (fields, fetched dependency data, in-flight error/ok
text) from both `#setupSignOutBtn` and `#setupDisconnectBtn`. **A new
module's state object goes on this list — it's easy to forget precisely
because the bug it causes is silent.** Tested: disconnecting Hogwarts
and connecting Wayne Enterprises regenerates a fresh, correctly-prefixed
`legalName` rather than keeping Hogwarts's.

### Locations, Department Management, Designation Management (built 2026-09-10)

All three in Company Settings, all ported verbatim from the Postman
collection. **"Locations" is the real product's own label for this
screen** (2026-09-09 admin screenshot); the Postman folder calls the same
endpoint "Branch Management" — confirmed, not left as a guess.

- **Locations** — `POST /company/branches`. `isGeolocation` is a real
  either/or: off sends `latitude`/`longitude`/`radiusInMeters` as `null`
  (not zero, not omitted), on sends real numbers offset from Baridhara
  DOHS (`BARIDHARA_BASE_LATITUDE`/`_LONGITUDE`, the script's own
  reference point). Toggling it in the UI regenerates or nulls those
  three fields live; tested both directions send the right JS types.
- **Department Management** — `POST /departments`. `code`,
  `parentId`, `businessLineId`, `departmentHeadId` are fixed values the
  script always sends, never generated. The script also de-duplicates
  department names against a per-company tracking list across repeated
  CI runs — that's Postman's own test-fixture bookkeeping and doesn't
  apply to a single generate-one-at-a-time settings module, so it wasn't
  ported.
- **Designation Management — the first module with a real
  dependency.** `POST /designations` needs a department to attach to,
  and the Postman collection enforces exactly this on itself (its own
  "Get Active Departments" script throws "Age Get Active Departments API
  run korte hobe" if none exist) — this app checks the same thing live
  (`fetchCompanyResource("/departments/active")`) rather than assuming.
  Zero departments → `dependencyNoticeHtml()`, a shortcut straight to
  Department Management, nothing else touched. The check result is
  cached for the rest of the company session (`companyDesignation.
  departments`) so reopening the tab doesn't re-fetch every time — and
  `saveDepartmentModule()` explicitly invalidates that cache the moment
  a department is actually saved, so creating one and coming straight
  back to Designation shows the real, current list without a reload.
  Tested end-to-end: empty → shortcut → save a department → cache
  invalidates → real department list appears → pick one → the picked
  department, not the first one, is what's actually sent.

Shared infrastructure added alongside these: `fetchCompanyResource()`
(the GET-with-bearer-token counterpart to every module's save call) and
`dependencyNoticeHtml()` (the calm inline notice + shortcut), used by
Designation today and meant for whichever module needs a dependency
check next (Leave Policy on Leave Type looks like the next one, from the
Postman collection's own shape).

### Custom Fields, Required Documents (built 2026-09-10)

Both Employee Settings, both ported the same way as everything above.

- **Custom Fields** — `POST /company-settings/employee-custom-fields`.
  `fieldName`/`type` are a paired pool (`CUSTOM_FIELD_PRESETS`) so a text
  field is never generated with an enum's shape or vice versa.
  `enableFilter` is only ever sent true for `checkbox`/`enum` — filtering
  a free-text or date field isn't a real product option, so the pool
  doesn't offer it. `options.choices` is only generated (and only sent
  nested under `options`, matching the real body shape) for `enum`,
  drawn via `shuffle()` from each preset's own `choicePool` so choices
  stay thematically consistent with the field name rather than random
  words.
- **Required Documents** — `POST /required-documents`. Nothing unusual
  in the body shape; the one thing confirmed rather than assumed was
  that `status` goes over lowercase (`"active"`/`"inactive"`), unlike
  Custom Fields' status casing — checked against the literal collection
  body rather than copied from the sibling module.

### Leave Types, Leave Policy (built 2026-09-10)

Both in the Leave group. This pair is the most complex port so far, and
came with a deliberate scoping decision, not an oversight:

- **Leave Types** — `POST /leave-types`, one of 6 kinds
  (`LEAVE_TYPE_KINDS`): 4 normal (Annual, Sick, Casual, Unpaid-style) and
  2 special-entitlement (Maternity, Paternity — fixed gender/marital
  eligibility, a fixed per-instance day cap, no sandwich/bridge/reset
  rules at all). The kind picker swaps the whole detail section rather
  than showing every field for every kind, since a special-entitlement
  kind's normal-leave toggles (`consecutiveLimit`, `monthlyLimit`,
  `sandwichRuleEnabled`, `isBridge`, `isLeaveReset`) are always forced
  `false` server-side-equivalent in the script, not user choices.
  **Only headline fields are exposed as editable inputs** — the rest of
  each kind's ~15-field body is still generated correctly per the ported
  script (`generateNormalLeaveTypeBody()`/`generateSpecialLeaveTypeBody()`)
  but not surfaced as its own row. This was a conscious call given how
  large the real body is, not a corner cut by accident — flagged to the
  user as one of the areas most likely to need a rework pass once tested
  against a real environment.
- **Leave Policy** — `POST /leave-policies`, the second real dependency
  (after Designation→Department): needs at least one Leave Type to exist
  (`fetchCompanyResource("/leave-types")`), same
  `dependencyNoticeHtml()`/cache-invalidate-on-save pattern, and
  `saveLeaveType()` nulls `leavePolicy.leaveTypes` on success exactly the
  way `saveDepartmentModule()` nulls `companyDesignation.departments`.
  Every real leave type gets included in the generated policy body, each
  assigned a `category`/`days` pair — a special-entitlement leave type
  (`seMaxDaysPerInstance` set) is always forced into category `"Special"`
  with that type's own fixed day count rather than a random pick, so the
  policy can never contradict the leave type it's describing.
  `departmentIds` is sent empty (company-wide) — there's no per-
  department targeting UI here, matching the "headline fields only"
  scoping above.

### Attendance Policy (built 2026-09-10)

Attendance group's only module. `POST /attendance/policy/create` — and
the one place the collection's own static body tab is actively
misleading: it shows a bare `{}`, with a comment saying to leave it that
way, because a pre-request script calls `pm.request.body.update()` and
overwrites it at request time. The real body — title, description,
1-3 shifts, weekend days, overtime config, early check-in limit, break
config — is ported from that script (`ATTENDANCE_*` pools in
`app-data.js`; `generateAttendancePolicyFields()` in `app.js`), not the
empty object the tab shows. Same "headline fields only" scoping as Leave
Types: title and weekend days are editable, everything else is generated
correctly per the script but not surfaced as its own input row — the
user flagged this module specifically as certain to need rework.

One real bug found and fixed while testing this module: toggling weekend
days re-renders the whole tab body, and the input's `value=` attribute
is sourced from the cached fields object — so a hand-edited title typed
just before a weekend click was silently overwritten by the last-
generated title on re-render. Fixed by having the weekend handler read
`$("#apTitle").value` into the fields object before re-rendering, the
same discipline Save already used. **This same class of bug likely
exists in any other module whose seg-toggle handler re-renders without
first snapshotting sibling text-input values** (e.g. Locations' geo
toggle) — not audited across the whole app, since nothing else surfaced
it under test; worth a pass if it's ever reported.

### Payroll — all 11 modules (built 2026-09-10)

Every module in the Postman collection's own "Payroll Settings" folder,
ported the same way as everything above. Four real dependencies live in
this group alone — more than the rest of the app combined:

- **General** — `POST /payroll/configuration/payroll-cycle`. Cycle is
  weighted (`PAYROLL_CYCLE_OPTIONS`: 55% calendar month, 40% fixed date,
  5% bi-weekly, via the new `weightedChoice()` helper — the app's first,
  ported from the collection's own `pickWeighted()`), with conditional
  threshold/fixed-day/bi-weekly-date fields exactly as the script branches
  on it. No dependency.
- **Salary Components** — `POST /payroll/configuration/salary-components`.
  4 fixed presets (Medical/House Rent/Mobile/Internet Allowance) — the
  collection's own 4 separate requests, not a generated name — with only
  status/tax-countability/pro-rata randomised per the script's own
  weights. No dependency.
- **Configure Salary Components — the third real dependency.**
  `PUT /payroll/configuration/non-paygrade-structure` needs **2** Active
  salary components, not 1 — the collection's own script throws without
  both. `dependencyNoticeHtml("second Active Salary Component", ...)` is
  phrased around the count rather than reused verbatim from the "at
  least one" wording every other dependency notice uses, since "doesn't
  have a X yet" reads wrong when one already exists. Splits always sum to
  100 (`SALARY_STRUCTURE_SPLITS`, the script's own fixed table).
- **Late Arrival, Absent Deduction** — both need ≥1 Leave Type, reusing
  the existing dependency shape but each with its **own** independent
  fetch/cache (`lateArrival`/`absentDeduction`, sharing
  `loadLeaveTypeDependencyInto(state)`) — tested that saving one doesn't
  invalidate or interfere with the other's cache.
- **Bonus Types** — `POST /bonus/configuration/types`. 4 fixed presets
  (Eid/Bangla New Year/Special/Inactive Test Bonus), only icon
  randomised. No dependency.
- **Bonus Policy — the fourth real dependency.** `POST
  /bonus/configuration/policies` needs ≥1 Bonus Type. The collection's
  own fully-specified example hardcodes Eid Ul Fitr's bonus type and a
  fixed 50%/Gross — generalised here to whichever bonus type the company
  actually has (this module lets the visitor's data decide, rather than
  assuming Eid exists), with name and bonus percentage left editable.
- **Overtime** — `POST /payroll/configuration/overtime`. Regular
  overtime is always enabled; weekend and holiday are independently
  rolled (80% enabled each), each with its own Fixed Rate/Multiplier
  choice, ported from the script's own nested `buildSpecialOvertimeBlock()`
  logic. No dependency.
- **Attendance Bonus** — `POST /payroll/configuration/attendance-bonus`.
  One quirk kept deliberately rather than "fixed": the script always
  sends `calculations.enabled: "Disable"` regardless of the outer
  `attendanceBonusEnabled` — the collection's own comment flags this as
  intentional API behaviour, not a script bug, so it's ported as-is. No
  dependency.
- **Custom Addition/Deduction** — `POST /payroll/configuration/custom-fields`.
  Name pools paired by type (`CUSTOM_ADDITION_NAMES`/`CUSTOM_DEDUCTION_NAMES`)
  so an Addition never gets a Deduction-shaped name; switching type
  re-rolls the name from the right pool. No dependency.
- **Tax — the one place the collection genuinely stops short.**
  `PATCH /payroll/configuration/tax-rules/toggle/Enable` is an
  enable/disable toggle, full stop — there is no endpoint anywhere in the
  collection for creating an actual tax bracket or rule. This is exactly
  the "Payroll needs a new API" gap the user predicted before this group
  was built (2026-09-10, ahead of time). Built as exactly what exists,
  with the gap named in the module's own on-page copy rather than an
  invented body papering over it.

`weightedChoice(options)` (`app.js`) is new shared infrastructure — every
Payroll module whose script weights its own random choices uses it
rather than reimplementing the roll.

### What's not built yet

Nothing — every module in every `SETTINGS_GROUPS` group now has a real
handler; `settingsComingSoonHtml()`'s fallback has no reachable gap left
under normal navigation and stays in the code the same way `renderMain()`'s
own "Coming soon" branch did after phase 1's five operations were built.

Two to three of the ~20 modules are expected to need a rework pass once
tried against a real environment — the user's own estimate, given before
this build push started (2026-09-10): Attendance Policy "sure," Payroll's
Tax module confirmed exactly as predicted, and a small chance in Leave
Types/Department/Designation. Treat that as expected, not a sign
something here was rushed carelessly.

**A sanitized copy of the full Postman collection** (passwords and
identifiers in raw request bodies replaced with `REDACTED`; every
endpoint, header, and pre-request/test script left intact) was written to
the user's Desktop on 2026-09-10 (`HRIS_Collection_sanitized_for_other_pc.json`)
so work can continue on a second machine without the original file — it
is not committed here, same as the original never was.

Also not built yet: a run log, a Stop control, and a "Hey Lazy!"-style
guard for leaving mid-run. Company Profile didn't need any of these —
it's a single record, one PATCH, no partial state possible — so its
absence here isn't an oversight. **The real need appears with the first
module that loops writes** (e.g. creating several Leave Types or Bonus
Types one at a time): that is where "some of this already happened on a
real server and leaving now doesn't undo it" first becomes a real risk,
and where `hasUnsavedWork()`/`wireUnloadGuard()` will need extending —
build it alongside whichever module is first to actually loop, not
speculatively before then.

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
