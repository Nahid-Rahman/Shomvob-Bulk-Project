# Bulk Forge — project context for Claude Code

## What this is
A single-page web app for Shomvob's QA team. It (1) generates QA-ready bulk-upload
Excel (.xlsx) files matching Shomvob's real upload templates, entirely client-side,
and (2) "Company Setup": calls a real Shomvob dev/staging API to configure a test
company's settings. Users are QA engineers (~25 real accounts), mostly on desktop.

Repo: `index.html` is the pre-built, self-contained deployable; `src/` is the editable
source (`app.css`, `app.js`, `app-data.js`, `part1.html`); `vendor/` holds SheetJS;
`build.py` assembles them. **Run `python build.py` after any edit under `src/`** — the
built `index.html` is what ships and what tests run against. `assets/` (videos, GIF,
logo PNGs) travels with `index.html`.

**`TODO.md`** is the shared cross-machine task list: check it at session start, keep it
current, push it. **`SPEC.md`** holds each operation's confirmed generation rules.
**`docs/HISTORY.md`** is the full, unabridged archive of the old CLAUDE.md (every
revision, bug story, live-pass finding, and the reasoning behind decisions). It is NOT
auto-loaded: `grep -n "^##" docs/HISTORY.md` to find a section, or grep a keyword, when
you need the "why" or exact past behaviour. TODO.md still says "CLAUDE.md → <heading>"
in places; those headings now live in `docs/HISTORY.md`. Keep this file short: durable
rules only; put narrative/changelog detail in HISTORY.md (and only if worth keeping).

## Working rules (from the user, durable)
- **Reply to the user in Banglish** (Bengali script doesn't render in their terminal).
  **All product UI copy is English** — dry, lightly self-deprecating tone; never put
  Banglish in the product.
- **Confirm rules, never assume.** The user dictates each operation's generation rules
  and business numbers himself, one at a time. Don't invent business numbers/rules.
- **Wait for the full feedback list.** When the user is marking up screenshots, don't
  start building until they say they're done listing.
- **Push to live:** sole user/tester; after a change is built and tested, commit and
  push to `main` (Vercel auto-deploys). Don't hold work locally. Commit/push only as
  usual per the harness rules; never skip hooks.
- **Check every new UI at a real mobile width (~390px)** with a screenshot, plus light
  and dark. A missing viewport meta once made all mobile breakpoints inert.
  Side-by-side layouts that cause problems should stack top-to-bottom.
- **Hiding UI breaks reachability:** before hiding/removing a nav element, trace what
  becomes unreachable (this bit twice).
- **Nothing the user configured may be quietly skipped.** If a choice can't be
  honoured, block generating with a named reason (never silently output less). For every
  input ask what happens when half-filled; the answer must be a message, not a smaller
  file. (Details: `departmentState()`, `assetTypeState()`, `attendanceProblems()`.)
- A real change with zero visible feedback reads as broken: give buttons a spinner/toast
  (`wireRegenerate()` fakes a 1s wait on purpose; `setBtnBusy()` for real network waits).
- Don't iterate unprompted on the user's-to-fill placeholders or on "By the numbers"
  content; ask first. Don't "fix" the footer's `!Love`/`!promotion` joke.
- **CSS specificity trap:** a mobile `@media` override must match or exceed the
  specificity of the rule it overrides (a media query adds none), else it silently never
  applies — especially for "shared shell class + page-specific modifier" pairs.
- **Test mocks must be registered BEFORE `page.goto(PAGE)`** for any call that fires on
  page load (`mockPublicStats(page)`). Calls fired by clicks can be mocked after.
- Static always-mounted modals live outside `#mainContent`: give their element ids a
  prefix distinct from every settings module's (`cp`, `bi`, `lt`, `lp`, …); `chpw`
  collided once with Company Profile's.
- When a mocked GET and POST share one URL, branch the mock on method (a background GET
  otherwise clobbers a captured POST body, or hangs on `route.continue()`).

## Architecture decisions (already made, don't relitigate)
- **No backend/database for the generators.** Every generation is random, in-memory,
  stateless. Deploy: Vercel static site (preset "Other", no build command, output dir
  `.`). **Never add a `package.json` at repo root** (Vercel would try to build); the
  test tooling's own `package.json` lives in `tests/`.
- **One narrow exception — Supabase** (project `Shomvob Bulk Generation`, ref
  `wtlaiidtiugxirqcxjzw`, org "Shomvob SQA"): Auth for the tool sign-in, plus `audit_log`,
  `user_access`, small SECURITY DEFINER RPCs, and an `admin-users` Edge Function. The
  publishable key in `app-data.js` is safe in public; **the `service_role` key must never
  appear in this repo.** Sign-up is off; accounts are created via the Admin Panel (Edge
  Function) or SQL. The Edge Function is deployed, not committed.
- **SheetJS `xlsx.mini.min.js`** (not full) is vendored and inlined: the full build has
  literal U+FFFD chars that broke Claude Artifacts publishing. Only basic write support
  is used (`aoa_to_sheet`, `book_new`, `book_append_sheet`, `writeFile`).
- **No CDN `<script src>`.** Everything is inlined except the Google Fonts stylesheet
  (IBM Plex Sans / Mono). Videos/GIF in `assets/` are separate files referenced by
  relative path (too big for data URIs; names must have no `#` or spaces). Logo PNGs are
  inlined via `INLINE_ASSETS` tokens in `build.py` (`__SHOMVOB_LOGO__`,
  `__SHOMVOB_LOGO_LAZY__`) — the mechanism for any future small binary asset.
- Downloads use plain `XLSX.writeFile()` (Blob + anchor click); requires a normal
  origin, so keep it; don't add capability-gated download APIs.
- **Deploy:** live at https://shomvob-bulk-project.vercel.app (Vercel project
  `nahidsmrahman/shomvob-bulk-project`); every push to `main` deploys. Per-deployment
  URLs sit behind Vercel SSO (default, not a misconfig). `vercel link` writes
  `.env.local` with an OIDC token — `.gitignore` covers `.env*`; keep it so.
  `.vercelignore` excludes `CLAUDE.md`, `SPEC.md`, `TODO.md`, `docs/`, `tests/` (they
  describe internal templates/business rules). `src/` is deliberately NOT excluded.
- `vercel.json` sets response headers only (CSP, `X-Frame-Options: DENY`, nosniff,
  referrer policy, permissions policy). The CSP needs `script-src 'unsafe-inline'`
  (one inlined script), so it does NOT stop injected scripts; its real value is
  `connect-src` locked to dev/staging Shomvob API hosts + this Supabase project
  (blocks exfiltration) and `frame-ancestors 'none'`. A new external host needs a CSP edit.
- **Security: always `escapeHtml()` at render time** (never at value-construction time —
  that would corrupt what's sent to the API) for every user/file/API-supplied string put
  in `innerHTML`: input `value=`, `.error`/`.ok` lines, created-name lists, notices
  naming fetched records, derived strings like `formatRoleLabel()`. Company Setup once
  shipped with none of it (stored-XSS via department/leave-type names read back from the
  real API). `escapeHtml` tolerates numbers/null.
- `ENVIRONMENTS` (`app-data.js`) lists only `dev` and `staging`. **No production URL
  exists in the code and no field to type a URL** — that is what keeps a compromise from
  reaching prod. Adding one means editing that file + rebuild, deliberately.

## Design system (src/app.css)
- **Shomvob brand palette, one green only:** brand green `#28a143` (hover `#208136`,
  text-on-light `#186129`), gold `#edb713` (warning), ink `#262823`, canvas `#f7faf8`,
  pill `#eff7f1`, red `#dc2626` (danger). Accent and success are the same green. Don't
  reintroduce a second green. Dark theme is derived (`#3dbf5a` on green-leaning
  near-black). Every colour lives in the three token blocks (`:root`,
  `prefers-color-scheme: dark`, `[data-theme]`); only `#fff` on the error toast is
  hard-coded. Env badges use dedicated `--env-dev`/`--env-staging` hues (identity, not
  verdict); donut charts use `DASHBOARD_CHART_COLORS` (5 distinct hues avoiding all
  semantic colours). Typography: IBM Plex Sans + Mono.
- **Appearance picker** (Auto/Light/Dark; called *appearance*, not *theme* — `.theme-card`
  is Employee Add's name-theme picker). Auto = no `data-theme` attribute. Owned by
  `wireAppearance()`. A tiny inline script at the very top of `src/part1.html` reads the
  stored value (`bulkforge-appearance`) before the stylesheet to avoid a flash — the only
  place repeating that key. It's the one persisted display preference; every
  `localStorage` access is in try/catch. It lives in a floating pill (`#appearanceFloat`,
  fixed top-right on desktop, `position: static` in flow below 860px).
- Any new input type must be added to the input selector list in CSS (email, password,
  file were once unstyled). One global rule styles `<a>` (`color: var(--accent)`); don't
  colour anchors individually.
- Layout: dark sidebar + scrollable main + sticky bottom action bar. Reuse `.section`,
  `.field`, `.chip`, `.dept-card`, `.seg` (`.seg-fill` to fill width), `.tally`,
  `.preview-table`, `.switch`, `.rule-card`, `.stat-tile`, `.bulk-shortcut-btn`,
  `.existing-count-notice` instead of inventing components. `.main-inner.wide` (1100px)
  for Company Setup/Admin; `.welcome-wide` (1320), `.faq-wide` (1400) are distinct
  classes because tests assert exact widths — don't raise `.wide`.
- A standalone single section shouldn't carry a `.section-num` badge.
- Sticky footer (`#appFooter`, "© year Mahmudur Rahman Nahid — Made with !Love, not for
  !promotion.") via `.main-scroll` flex column.
- Responsive breakpoints in use: 1100 (media rail/Rickroll collapse), 900, 860 (sidebar
  stacks), 759, 640. Wide tables (Manage Users, Audit Log) deliberately stay
  horizontal-scroll on mobile.

## Page/state model
- `currentOp` selects the page: `welcome` (pre-signin landing), `dashboard`
  (post-login, default after sign-in), `faq`, an operation id, `operations_gate`,
  `company_setup`, `admin_users`, `admin_audit`, `rickroll`. `renderMain()` routes;
  `navigateTo(opId, {replace})` is the ONE place top-level navigation + History API
  happens (`replace:true` when landing is the completion of a step, e.g. gate sign-in).
  `wirePopstate()` handles Back/Forward: re-checks the operations gate, tier lock, and
  blocks during a bulk run (undoes by re-pushing). URL is never changed. Company Setup's
  internal drill-down is not in history.
- `goToOperation(opId)` is the single gate for operations (needs real tool sign-in, tier
  check); stashes `pendingOperation`.
- **Sidebar is hidden entirely until real tool sign-in** (`$(".sidebar").style.display`
  from `renderSidebar()`), so signed-out the Dashboard/Welcome + sticky bar are the only
  way. A consequence: Company Setup's own step-one sign-in is currently unreachable from
  the UI (kept intact; tests force the sidebar visible with a `page.evaluate` poke).
  Sidebar: Dashboard, Operations (5), Setup (Company Setup), Admin (Users, Audit Log;
  admins only), then "What we offer & FAQ" pinned above Log out, plus a "Signed in as"
  card (`#sidebarUserCard`, email-based avatar; usernames are a planned later idea) and
  Change password link. There is NO "Welcome" sidebar item (loophole, removed); Back can
  still reach it. Tests reach Welcome via `page.goBack()`.
- Per-operation state lives in module-level objects (`att`, `leave`, `payroll`, `assets`,
  `departments`) so switching operations loses nothing — hence NO navigation warning.
  Reload/tab-close does lose work: `hasUnsavedWork()` = `hasGeneratorWork() ||
  !!setup.toolToken` arms Log out's "Hey Lazy!" dialog (`#discardModal`) and
  `beforeunload` (the browser's own text can't be customized).
- **Log out** must call `clearToolSession()` + `clearLastSetupSession()` before
  `location.reload()` (reload doesn't clear `sessionStorage`).
- Generate opens `#generateCompleteModal` (via `openGenerateCompleteModal(title, body,
  wb, filename)`) and only its **Download Now** button calls `XLSX.writeFile()`. Each
  `downloadXWorkbook()` builds and returns `{wb, filename}`. Closing without download
  discards. The shared test helper `generate()` in `tests/lib.js` clicks through it.
  `openSuccessModal(title, body)` is the reusable "this real change went through" modal.
- Appearance/`localStorage` is the only persistence besides `sessionStorage` tool
  session (see below) and the token-free last-company marker.

## Auth, tiers, admin
- **Login gate (`#loginGate`) is a joke, not a control**: DEMO_LOGIN credentials are
  printed on the card, pre-filled, readonly (`readonly`, not `disabled`), password shown
  as plain text. Never present it as security or put anything behind it that matters.
  Keep its footnote. No appearance picker on it. Its cat video always plays (no
  reduced-motion handling — reversed on purpose, same for all operation-page videos).
- **Real tool sign-in** = Supabase Auth (`supabaseSignIn()`); needed for Operations,
  Dashboard, Company Setup, Admin. Persisted in `sessionStorage` (`TOOL_SESSION_KEY`:
  email/token/env/expiresAt, checked on restore; cleared only by real Sign out/Log out).
  **Company token (real Shomvob company-admin login) is memory-only, never stored.**
  `SETUP_LAST_SESSION_KEY` keeps a token-free marker (company, env, `doneModules`) used
  for the "you were connected to X" notice and restoring done-dots when reconnecting to
  the same company/env.
- **Tiers:** `user_access(email PK, tier 'bulk'|'company'|'both' default 'both',
  is_admin default false)`. RPCs: `is_admin()`, `my_tier()` (missing row → 'both'/false;
  `SECURITY DEFINER`; `user_access` itself is admin-only via RLS). `checkIsAdmin()` is
  always a live RPC call (never cached as a flag for gated data; `isAdminUser` only
  drives nav visibility); `checkMyTier()` fails open to `"both"` (client nav
  convenience; RLS/RPC are the real boundary). Tier lock: 'company' locks Operations,
  'bulk' locks Company Setup (disabled + "Locked" pill, plus enforced in
  `goToOperation()`/`wirePopstate()`). Re-render the Dashboard when `myTier` resolves
  (race). `refreshAdminNav()`/`refreshMyTier()` are called from both sign-in handlers
  AND `init()`'s session restore.
- **Admin Panel**: Users (default tab; tabs Manage Users / Create new user) and Audit
  Log (filters: user + date, 50 rows/page over a 200-row fetch, Settings Group column).
  Users table: Bulk/Company/Admin checkboxes map onto `tier` (`checksToTier()`; can't
  uncheck both operations), Save writes `user_access` directly (RLS `FOR ALL` for
  admins), Reset password, Remove (confirm; never self). `admin-users` Edge Function
  (`verify_jwt: true`, re-checks `is_admin` itself): `list`, `create`, `delete` (refuses
  self-delete), `reset_password`. Both pages share `loadAdminPanelData()`; non-admin
  reaching them sees "Admins only".
- **Preview access (2026-10-06):** a fourth, testing-only flag, `user_access.preview`
  (boolean, default false), read via the SECURITY DEFINER RPC `my_preview()`; `checkMyPreview()`
  **fails closed** (unlike `my_tier()`), `refreshMyTier()` fetches both. Work-in-progress pages
  live in `PREVIEW_TOOLS` (`app-data.js`: Attendance update, Report), shown in a sidebar
  "Preview" section (WIP pills) only when `myPreview`; hidden, not locked. Gated by
  `goToPreview()` + `wirePopstate()`. The code is NOT secret (ships to every browser, user
  confirmed that's fine); real data for a preview feature should still sit behind RPC/RLS.
  Admin Users has a Preview checkbox (table + create form); the flag is read straight from
  `user_access` (`fetchPreviewFlags()`), not the Edge Function's `list` (not in repo, may not
  return it). A feature graduates by leaving `PREVIEW_TOOLS`. Admins do not auto-get Preview.
- **Audit log** (`logAudit(eventType, detail, extra)`, fire-and-forget, failure swallowed):
  events `login`, `settings_save`, `bulk_generate` (+ `entry_count` read from the sheet
  range), `admin_user_create`, `admin_user_delete`, `admin_access_change`,
  `admin_password_reset` (the `event_type` CHECK constraint must be widened for any new
  kind). `settings_save` is logged automatically because `setup.doneModules` is built by
  `makeDoneModulesSet()` whose `.add()` logs. SELECT only for admins
  (`audit_log_select_admins`). `entry_count` only exists for rows after 2026-09-29.
- RPCs for aggregates (all aggregate-only, no emails/company names):
  `public_generate_counts()` and `public_settings_save_count()` (anon-safe, for the
  public Welcome stats), `dashboard_bulk_stats(since_ts)` and
  `dashboard_settings_save_count(since_ts)` (authenticated only).
- Supabase gotchas: PostgREST once failed with `pg_pgrst_no_exposed_schemas`; fixed via
  `ALTER ROLE authenticator SET pgrst.db_schemas = 'public, extensions'` + `NOTIFY pgrst,
  'reload config'`. Users created via SQL need `email_confirmed_at` set; reset a password
  with `extensions.crypt(pw, extensions.gen_salt('bf'))`. The Supabase MCP in some
  sessions doesn't reach the Shomvob SQA org — then the user runs SQL in the dashboard.

## Welcome page (pre-signin) and Dashboard (post-login)
- **Welcome** (`welcomeTemplate()`): headline "Welcome to Shomvob Bulk Forge!" with logo
  tile; 3-step how-row (not sticky; step 1 text matches the button "Sign in to Bulk
  Forge"); three sections Reason / Offer / Scope (zigzag `.welcome-row` as `.section`
  cards, 70:30 text:meme; Scope full-width checklist, no meme); "By the numbers" (one
  table of dictated By-hand / With-AI / Bulk-Forge times per 50 entries —
  `OPERATION_TIME_COMPARISON`, `SETTINGS_TIME_COMPARISON` (37 min vs ~1), fixed
  `WELCOME_OPERATION_ORDER`; "Add it all up" box: live vs-manual total, and flat
  `WELCOME_VS_AI_SAVED_MIN = 55`); "So far, for real" (public real counts, 3 tiles);
  admin-only "Team activity" (gated at the network level: only fetched when
  `setup.toolToken` set and `is_admin()` true; renders nothing otherwise). Sticky bar
  `#welcomeBar` (static markup, handlers via `.onclick =` or wired once in `init()` to
  avoid stacking): "Auto setup company and bulk data" (opens the Rickroll page) and
  "Sign In to Bulk Forge" (gate with `pendingOperation = null`). Memes: Reason =
  `assets/crying_cat_ok.mp4`, Offer = `assets/hackerman.mp4` (user's own face). All
  videos `loop muted playsinline autoplay`.
- **Rickroll page** (`currentOp = "rickroll"`): joke "LMAO you lazy!" + `assets/rickroll.mp4`
  reusing the media-rail shell with `.rickroll-layout` modifier (copy centred vs video;
  its mobile collapse needs the 3-class override). Exit button "Login to Bulk Forge"
  opens the real gate.
- **Dashboard** (post-login, no admin gate; no page-head): sections in order — User
  Statistics (impact box "Estimated impact so far", pinned All time, labelled Estimated;
  then three charts, each with its OWN independent range filter via
  `dashboardChartStats[key]` with keys `bulk_runs` (donut), `entries` (axis bar),
  `time_saved` (axis bar, plots manual − bulkForge = actual saving), `impact`),
  "What we offer & FAQ" 3-column card strip (6 cards, `FAQ_TOPICS`), then "Get started"
  (Bulk / Settings routing cards with tier lock pills). Re-render `#mainContent`
  directly (not `renderMain()`, which resets scroll) when background data resolves,
  guarded by `currentOp`. Charts are hand-rolled SVG/CSS (`donutChartHtml`,
  `axisBarChartHtml`, `barListHtml`) — no chart library. The time numbers are estimates
  from dictated figures, labelled as such.
- **FAQ page** ("What we offer & FAQ"): Bulk Operation / Settings toggle (Bulk default),
  left item list, first item open by default; Settings lists the 6 real
  `SETTINGS_GROUPS` with real per-field narrative tables (`FAQ_SETTINGS_GROUP_DETAILS`);
  Bulk topics from `FAQ_TOPICS` columns. Plain-English narrative for every field is the
  required style (what it is, why, real default, concrete example). Scoped CSS
  (`#faqDetailPanel .preview-table`) lets cells wrap; don't change the shared
  `.preview-table` nowrap. `openFaqTopic(id)` is the single entry shared with the
  Dashboard strip. Not in browser history within the page.

## The five operations (rules in SPEC.md; all built, tested, don't change without asking)
Sidebar `OPERATIONS` in `app-data.js`; `renderMain()`/`paintOperation()` route them.
**Two kinds:** build-from-blank-template (Employee Add, Attendance Add, Assets Add) vs
fill-into-the-system's-own-export, leaving everything else untouched (Leave Balance,
Payroll Custom Field). Knowing which you're looking at matters more than anything.
The importer accepted generated files (2026-09-09), so SPEC.md rules = what the system
accepts; if a real upload fails, fix against that error's actual text.

- **Employee Add** — sheet `Employees_List_Upload`, row 1 header (`*` on required),
  16 columns: Employee ID `PREFIX0001` (4-letter auto-uppercased prefix; **Starting
  number** field default 1 so regenerating for an existing company doesn't collide),
  Biometric ID `PREFIXB0001`, First/Last Name, Employment Type (Permanent / In
  Probation / Intern only), Probation Months (Permanent 0, else 3–6), Joining Date
  (~60% prev year, ~25% current never future, ~15% two years ago), **Pay Type**
  (Monthly default / Hourly / Mixed with % ratio default 50; always the literal word),
  Gross Salary ৳20,000–150,000 step 500 (Monthly rows only), **Hourly Rate** ৳100–500
  step 50 (Hourly rows only; blank otherwise — exact mirror), Email
  `first.last.xxxxx@yopmail.com` (per-run random 5-char tag so separate runs never
  collide; numeric dedup within a run), Phone `880`+`1`+operator 3–9+8 digits deduped,
  Gender (matches name), DOB (age 18–45 at joining, before it), Department/Designation.
  Count 10–300. Filename `{PREFIX}_employee_bulk_upload_{YYYYMMDD}.xlsx`. Departments:
  6 defaults × 4 designations, toggle defaults/custom, unlimited custom; a ticked card
  with nothing inside is blocked with a named reason. **Name source is multi-select**
  (`nameThemes` Set, at least one stays selected): Bangla (unique combos, no repeats) or
  15 character pools in `THEME_POOLS` (GoT, HP, Marvel, DC, Games, Squid Game, Stranger
  Things, Money Heist, Breaking Bad, Anime, Cricketers, Footballers, WWE/UFC, Friends…),
  merged and shuffle-cycled; past pool size a repeat keeps its first name but borrows a
  different last name from the pool (no numeric suffixes). Bangla movie/DCU pools were
  deliberately not added (risk of wrong local names / duplicates).
- **Attendance Add** — sheet `Attendance_Bulk_Import`, 4 required columns (Employee ID,
  Date, In Time, Out Time). Overtime isn't a column (it's Out Time past shift end).
  Absence/weekends = no row, never a blank one. Early check-out % (default 5) is
  mutually exclusive with overtime; weekday OT floor 45 min; **weekend/holiday OT row
  floor 2h** (importer rejects <15 min). Lateness measured from end of grace. Shift may
  cross midnight (one row dated by start day). Employee left off every shift, empty
  shift, and ranges with no usable days are errors (`attendanceProblems()`,
  `rangeDayCounts()` shared with the tally). `BD_HOLIDAYS` is 2026 only, read off
  Shomvob's own HR calendar; the holiday chip list is scoped to the chosen date range
  (display-only; generation was always range-bound).
- **Assets Add** — sheet `Assets_List_Upload`, 7 columns (3 required). Asset Type is a
  free category, not derived from name; Asset Image always blank; descriptions paired
  with names in `DEFAULT_ASSET_TYPES` (custom names get none); employee IDs optional;
  70–80% assigned (`ASSETS_ASSIGNED_BAND`); unassigned rows blank both assignment cols.
  Type/name cards reuse Employee Add's department classes.
- **Leave Balance Add** — upload the system's export; sheet `Leave_Balance_Already_Used_Upda`
  (31-char truncation, reproduce as-is); only `Already Used Leave` changes, row order
  kept. Read IDs/leave types/allocations from the sheet (never hardcode). `Already Used
  < Total Allocated + Earned Leave` strictly; half steps (0.5); scaled by how far into
  the year today is; updates may only increase; a row at its ceiling is untouched and
  counted in the report.
- **Payroll Custom Field Add** — sheet `Custom Add-Deduct`; A/B = ID/Name, rest are
  company-configured fields. Header names reproduced verbatim (typos like `Maintainance`
  included); `(+)`/`(-)` suffix parsed for display only, values stay positive; coverage %
  is per cell (some employees all-zero, intended); cells with values never touched;
  output reuses the uploaded filename.
- **Media rail:** `OPERATION_MEDIA` in `app-data.js`, one entry per op id
  (`assets/op_<operation_id>.mp4`); no entry = no rail, full 760px form. Rail must be
  shorter than its container (slack stops sticky clipping); collapses below 1100px.
- Op costs/blurbs live in `OPERATION_BLURBS`/`OPERATION_CELL_ESTIMATE` (keep honest if a
  limit changes). Employee Add's "14 columns × 300 = 4200 cells" figures were NOT
  updated for the 16-column change (user hasn't confirmed; don't change silently).
- Adding a sixth operation: get the real template, inspect with
  `python tools/probe_xlsx.py <file>` (openpyxl; SheetJS can't read data validations),
  confirm every column's rule with the user, flip `status` to `"active"` in
  `OPERATIONS`, add data to `app-data.js`, add `<op>Template()` / `wire<Op>Events()` /
  `generate<Op>Rows()` in `app.js`, branch `renderMain()` and the `updateSummary()` /
  `handleGenerate()` dispatchers, reuse the shared ID picker (`idSourceMarkup()`,
  `bindIdSource()`, `wireIdSourceSeg()`), build, add `tests/<op>.test.js`, verify sheet
  name/headers against the template.

## Company Setup (Phase 2) — the one part that isn't risk-free
Calls a real Shomvob dev/staging API and writes into a real test company.
`currentOp === "company_setup"`.
- **Two gates:** (1) tool sign-in (Supabase), then (2) company-admin login
  (`companySignIn()`, `POST {apiBase}/auth/login`) which also picks Dev/Staging (the
  `#setupCoEnvSeg` below Email/Password). The page inherits that account's permissions.
  A persistent strip (`setupStatusBarHtml()`, `#setupStatusBar`) shows env badge, company,
  role, Disconnect/Sign out on every screen; it's one strip, not duplicated banners.
  401 on any call *using* a company token shows a named "session may have expired —
  Disconnect and sign in again" message (not applied to the two login calls).
- CORS: Shomvob API hosts must allow the page origin (their side); `companySignIn()`
  assumes CORS on a bare fetch failure and says so.
- **Navigation:** sidebar stays one line "Company Setup". Level 1 = group grid
  (`SETTINGS_GROUPS`, array order = left-to-right order and the dependency-safe run
  order; labels match Postman: Company/Employee/Attendance/Schedule Management/Leave/
  Payroll Settings; 6 groups); Level 2 = a group's tabbed page (`.settings-tabs`; green
  dot when saved this session). No enforced order; only a genuine data dependency blocks
  a module (checked live, shows `dependencyNoticeHtml()` + shortcut to that module).
  "Go to next settings" (`#setupNextModuleBtn`) goes one tab within the group only.
  Mid-bulk-run navigation is blocked centrally (`isBulkRunActive()`).
- **Dispatch:** `SETTINGS_MODULE_HANDLERS` (module id → `{template, wire}`), fallback
  `settingsComingSoonHtml()` (currently unreachable). Icons injected centrally via
  `settingsModuleIconHtml()`; field clear-× buttons via `wireFieldClearButtons()`
  (UI-only: it just empties the input; send-time behaviour is each module's own).
- **Per-module cache rule:** a new module's state goes into `resetModuleState()`
  (Sign out/Disconnect) — forgetting it is silent. Dependency caches are nulled on the
  save that changes them; **also null any derived `fields` built from that cache**
  (Leave Policy stale list bug). `existing: undefined` = "not yet checked" sentinel where
  `null` is a meaningful answer (Company Profile etc.); `fetchCompanyConfig()` must
  normalize a missing `data` to `null`.
- **Snapshot-before-rerender rule:** any toggle/seg/background-`.then()` that re-renders a
  tab must first read hand-typed inputs back into the cached fields object, and guard
  that the element still exists (`if ($("#x"))`) — the user may have switched tabs.
- **Bulk "create the defaults"** (Department, Designation, Leave Types, Salary
  Components, Bonus Types, Bonus Policy): review list = run log, `runBulkSequential()`
  one at a time, per-item toggles, Stop checked between items, items already `"done"`
  can't be re-run (duplicate-POST guard), existing real records marked skipped
  ("Already exists", matched by name; Designation by name+department), success banner
  only when no failures. Designation's list is built from the company's REAL departments
  (known defaults get curated titles, others generic). Single-item forms show a plain
  `.existing-count-notice` count for list-type modules; single-record modules show a
  warning-boxed "fields already have values" notice (Tax uses a plain success tone).
  Created names shown via `createdListHtml()` for modules that create named records.
- **"Run defaults"**: `MODULE_DEFAULT_RUNNERS` (one runner per module, same side effects
  as the module's own save), `runDefaultsSequential()` skips anything already in
  `doneModules`, never parallel, Stop/resume. Two triggers: per-group "Run defaults for
  <Group>" and master "Set up a fresh company →" (`MASTER_RUN_MODULE_IDS`, curated 18:
  Company Profile, Bank Info, Location Types, Locations, Department, Designation,
  Attendance Policy, Roster, Roster Pattern, Leave Types, Leave Policy, Holiday
  Calendar, Payroll General, Salary Components, Configure Salary Components, Bonus
  Types, Bonus Policy, Tax — Employee Settings and Payroll's Late Arrival / Absent
  Deduction / Overtime / Attendance Bonus / Custom Addition-Deduction are per-group
  only). Runners first GET the real company and skip if already configured
  (Company Profile `/company-profile`, Bank Info, Payroll General, Configure Salary
  Components `data.data.id`, Attendance Policy, Tax `isEnabled`). Shown in
  `#runDefaultsModal` (`.modal-card-split`, quote panel with different quotes per
  trigger via `RUN_MODAL_QUOTES`), not a page swap.
- **`fetchCompanyResource(path)`** assumes a flat array at `data.data` but falls back to
  wrapper keys `components`, `policies`, `timeSlots`, `patterns`, `locationTypes`,
  `items`. **Verify the wrapper key against the real response for every new endpoint** —
  this silently returned `[]` three times. Mocks in tests must use the real wrapped shape.
- **Verified-against-real-API facts (don't redo):** Bank Info success is `201`;
  `accountNumber` goes as a JSON number (convert at send); Late Arrival / Absent
  Deduction use `latePenaltyLeaveTypeIds` / `absentDeductionLeaveTypeIds` (arrays) and
  Late Arrival needs EXACTLY ONE of late/repeated-late penalty (radio-pair
  `#laPenaltyTypeSeg`, default late); Location Types `sortOrder` = current count + 1
  (fetched fresh at save); Roster `totalWorkingHours` recomputed at save, `halfDayHours`
  fixed 4; Roster Pattern `dayIndex` 0–4 = Sun–Thu, uses time slot named "Default" else
  first; Locations `locationTypeId` references a real type (prefers "Baridhara"); Attendance
  Policy has `maxCheckOutLimit` and `fixedBreakSettings` (no shifts/weekendDays) with
  Overtime defaults off; Overtime has a real cross-group dependency on an Attendance
  Policy with overtime enabled (`GET /attendance/policies`); Configure Salary Components
  needs ≥2 Active salary components (default filler Basic 60 / 15 / 15 / 10 when the 3
  default components exist); the real API rejects duplicate Location Type names itself.
  Employee Settings Custom Fields' `enableFilter` only valid for checkbox/enum types.
  No create-bracket endpoint exists for Tax (enable/disable only; the page says so).
  Late Arrival, Absent Deduction, Overtime, Attendance Bonus have no known GET and are
  deliberately excluded from the "already has values" feature.
- **Module facts (defaults the user dictated):** Company Profile (`PATCH /company-profile`,
  legalName from the connected company's name + suffix, Company Logo deliberately
  excluded); Leave Types form has only Name + Sandwich Rule + Bridge toggles (everything
  else fixed to the "default 3" payload: Annual/Casual/Sick, accrual from joining date,
  calendar-year reset; Maternity/Paternity unreachable by design); Leave Policy lists
  ALL real leave types each with checkbox (default checked) + Days (default 12), Category
  always "Standard", default option only when all 3 default names exist; Salary
  Components Status defaults Active (Mobile Allowance not in the default 3); Bonus Policy
  default 3 (Eid Ul Fitr 40%, Eid Ul Adha 40%, Bangla New Year 20%; no duplicate check —
  no known GET at the time); Payroll General first load = Calendar Month,
  `thresholdRuleEnabled` false; Attendance Policy title fixed "Office Standard Policy";
  Location Types first load = "Baridhara", Location default "Railgate" (`isDefault` true
  only for Run defaults); Holiday Calendar is a bare GET sync button; Create Roster
  Pattern is one action (only Name editable, "Standard Pattern"; per-day/slot assignment
  is a deferred phase two); Create Roster has no per-module Default button (group Run
  defaults covers it).
- Postman sanitized collection copy lives on the user's Desktop
  (`HRIS_Collection_sanitized_for_other_pc.json`), not committed.
- **Live verification discipline:** real company credentials are used in-memory in
  throwaway scripts only, never written to any file or committed; scratch files deleted.

## Tests
`tests/` runs browser tests (Playwright/Chromium) against the BUILT `index.html`:

    python build.py
    cd tests && npm run setup   # once
    npm test

14 suites, ~980 checks (a drifting snapshot): employee, attendance, assets, leave,
payroll, appearance (two colour-scheme contexts; reads computed background channels, not
hexes), company-setup (mocks every network call via `page.route()`), gate (only suite
inspecting the gate DOM), back-navigation, tiered-access, admin-panel, preview, dashboard, faq.
Rules: assertions map to SPEC.md — check SPEC.md before changing a test; `signIn(page)`
clears the joke gate; `goToOp()`/`mockToolSignIn()` (tests/lib.js) do the real sign-in
(mocking `audit_log`, `my_tier()`, `is_admin()`); `mockPublicStats(page)` before every
`page.goto(PAGE)`; `watchPageErrors(page)` ignores Google Fonts failures but must keep
failing on broken local `assets/` (don't widen); a new backend call needs mocks added
everywhere sign-in can happen. Under full-suite load some Company Setup tests that do a
blind `waitForTimeout` before an "already has values" assertion can flake — fix by
`waitForFunction` on the notice text, not a fixed delay. When a change makes a test
selector disappear, update the test like-for-like rather than loosening it.

## Where this stands
Phase 1 (5 operations) complete and accepted by the real importer. Phase 2 (Company
Setup, all 6 groups / ~24 modules incl. Schedule Management) complete and verified live
against real staging companies. Phase 3 (Tiered Access: audit log, admin panel, tiers,
Dashboard, FAQ, Back/Forward, Change Password) complete. A CXO impact-report artifact was
drafted (see TODO.md). Next work is user-directed; check `TODO.md`.
Features of note not described above: self-service **Change Password**
(`changeMyPassword()` → Supabase `PUT /auth/v1/user` with the user's own token, modal
`#chpw*`, min 6 chars, confirm match, success via `#successModal`; no Edge Function).
For the history/rationale of anything above, grep `docs/HISTORY.md`.
