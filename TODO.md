# To-do

A shared, cross-machine task list — committed and pushed like everything
else, so a note made on one machine is visible on the other. Add an item
here instead of only saying it out loud, and delete it once it's done
(pull the latest before checking — another machine may have finished it,
or added more).

- **Session paused here, 2026-10-06 (end of day)** — "onno machine e
  continue korbo" (continuing on the other machine). Everything below is
  committed and pushed to `main` and live; nothing local, nothing
  uncommitted. **On the other machine:** `git pull`, then `python build.py`
  (only needed after editing `src/`), `cd tests && npm run setup` once if
  Playwright isn't installed there, `npm test` (15 suites, all green at
  push time). Auto-memory does NOT travel between machines — every durable
  rule from it is now in CLAUDE.md → "Working rules".

  **Done this session:**
  1. **Preview access** — a testing-only access level. `user_access.preview`
     (boolean, default false) + SECURITY DEFINER RPC `my_preview()` (the user
     ran the SQL in the Supabase dashboard; the Supabase MCP can't reach the
     org). Sidebar gets a "Preview" section (WIP pills) only for flagged
     accounts; Admin → Users has a Preview checkbox (table + create form).
     Entries: **Attendance update** (built) and **Report** (empty
     placeholder page). CLAUDE.md → "Auth, tiers, admin" has the details.
  2. **Attendance update** (Preview page) — built: "What are we
     generating?" Standard / Deduction / Combination (disabled, later).
     Standard = old flow minus overtime. Deduction = 4 single types (Late
     Arrival, Absent, Cutoff Breach, Absent After Breach), each Aggregate
     or Repeated. Every rule was dictated one by one — SPEC.md →
     "Attendance update (Preview)" has all of them plus the small choices
     Claude made itself (marked "change freely"). `tests/attendance-update.test.js`.
  3. The user's own account has Preview ticked (confirmed 2026-10-06).

  **Next, in this order (re-ordered by the user 2026-10-07 — "age ei
  jorimana ar reward shob sesh kori, taile report er time tomar kase
  ekebare full context thakbe"):**
  1. **Reward scenario** in Attendance update (overtime, attendance bonus)
     — named **Bonus** in the picker. Discussion done 2026-10-07 (SPEC.md →
     Still to discuss → O1–O15, B1–B6; Shift Bonus out of scope). Fully
     decided. NOT built yet — wait for "build".
  2. **Combination** (several deductions/rewards at once) in Attendance
     update — discussion first.
  3. **The Report validator** — nothing dictated yet, start by asking.
     Already decided: it's the TODO's old "Report validation" item; the PDF
     first planned inside the attendance generator moved here ("bulk e only
     bulk er task thakuk") — expected penalties per ID per month,
     late/absent/breach dates with In time, a boundary-check section last
     (SPEC.md keeps those "(For the Report validator)" lines). jsPDF
     (vendored + inlined like SheetJS) was agreed for a PDF, parked until
     then. Open questions: what it takes as input (our generated xlsx? the
     system's own report? both, compared?) and what it outputs.
  4. After that: Attendance update replaces the live Attendance Add — ask
     before swapping.

  **Decided, don't raise again (2026-10-07):** Company Setup will NOT be
  updated for the real Deduction Rules UI's newer parts (deduction source
  order, ordered multi-leave-type list, Cutoff Breach / Absent After Breach,
  the time slot's Late cutoff / Absent after) — "eta common case na, so
  general setup e lagbe na". Those stay a QA-side thing, configured by hand.

  Older: the 2-page CXO impact report (2026-09-30) is at
  https://claude.ai/artifact/TyRNnJUPVJ5BFi8GEwaLJp — if asked again, ask
  whether its real-numbers section needs a refresh rather than redrafting.
- **Future (Attendance update, Absent Deduction):** the generator assumes the
  date range has no approved leave, so the expected absent penalties (in
  the future Report validator) can be off if the test company already has
  approved leave on a generated absent day. Later: let the user upload the
  company's leave export (skip those dates), or fetch leave via the real
  API. User asked for this to be kept on the list (2026-10-06). See SPEC.md
  → "Attendance update (Preview)".
- **Welcome page confirmed 100% done, 2026-09-28** — every open item
  the "Not started" bullet below used to list against the pre-signin
  page is closed; see CLAUDE.md's own long revision history under
  "Welcome page rewritten through discussion..." and "'By the
  numbers' got asked about again..." for the full detail up through
  its 5th revision (real dictated before/after numbers, one unified
  table + Settings row, "Add it all up" folded into the same section
  as a tinted panel, capitalised stat labels/units).
- ✅ **Post-login Dashboard page built 2026-09-29** — the last piece of
  the Tiered Access journey; see the ✅ bullet further down and
  CLAUDE.md → "The post-login Dashboard" for the full build. **Nothing
  from the originally-dictated Tiered Access journey is outstanding
  any more.**
- ✅ **The 2-page CXO impact report, requested by the user's lead
  (2026-09-28) — drafted and published 2026-09-30.** See the top
  "Session paused" bullet above for the link and what it covers; don't
  re-draft from scratch if this comes up again, just ask whether the
  real-numbers section needs a refresh.
- Report validation
- Lead feedback, relayed directly (2026-09-24) — three related asks,
  **all need a real backend + database**, a genuine architecture change
  from this app's current stateless/client-only design:
  - **Audit log** — **fully done** (data capture 2026-09-24, viewing UI
    2026-09-25 as part of the Admin Panel, see CLAUDE.md → Phase 2 →
    "Audit Log" and → "Admin Panel"): login / settings_save /
    bulk_generate / admin_user_create / admin_user_delete /
    admin_access_change events all write to a real Supabase `audit_log`
    table, and an admin can now read the last 200 of them straight from
    the Admin Panel.
  - **Dashboard with a proper overview** — **built 2026-09-25**, see
    CLAUDE.md → Phase 2 → "Dashboard's 'Team activity' section". 4 real
    stat tiles (sign-ins, settings saved, bulk files generated,
    estimated time saved) + 2 breakdowns (bulk generates by operation,
    settings saves by company), gated behind real tool-login +
    `is_admin()` — the Dashboard page itself is still reachable by
    anyone past the joke gate, only this section's data is admin-only.
    Confirmed end-to-end by test (non-admin sees nothing, admin sees
    correct real numbers) and by Playwright screenshot in both themes.
  - **Tiered access / admin panel** — some users get only the bulk
    generators, some get Company Setup, some get both; an admin can
    raise/lower anyone's access level from a real admin panel. **Admin
    Panel v1 is built** (2026-09-25, see CLAUDE.md → Phase 2 → "Admin
    Panel") — view the audit log, change an existing account's tier/
    admin flag, **and add/remove a real account** (a scope addition
    given directly when this was picked up — "user add remove korte
    parbe" — via a new `admin-users` Supabase Edge Function, since that
    needs the `service_role` key this app's client code can never hold).
    **Tier is now enforced too** (2026-09-26, see the ✅ bullet further
    down) — only the dedicated Welcome/tier routing page itself is still
    outstanding, see the bottom of this section.

  **Tiered access — the normal (non-admin) user journey, dictated
  directly (2026-09-24), captured here so it isn't lost between
  machines:**
  1. Joke gate (dummy id/password) as today.
  2. Lands on the **updated Dashboard** (per the item above — real
     stats/graphs once the audit log exists).
  3. ✅ **Built (2026-09-25).** "Auto setup my company and bulk upload"
     on the Dashboard — **a deliberate joke, not a real feature**.
     Clicking it opens a modal: the user's own self-hosted clip
     (`assets/rickroll.mp4`, muted/looping, no controls) on the right,
     dictated real copy on the left ("LMAO you lazy!" + "Did you really
     think it would be this easy? No — it'll make your life easier and
     save you 95% of the time, but you still have to do it yourself.
     Just a few basic inputs, and whatever you actually need is
     ready."). See CLAUDE.md → Phase 2 → "The Rickroll" for the full
     detail, including why a real YouTube embed was flagged and rejected
     (this app's first-ever external dependency) and why Tenor couldn't
     supply the originally-wanted 15–20 second length (short clips only —
     the user supplied their own file instead).
  4. **Real login now gates the whole app, not just Company Setup** —
     confirmed directly: Bulk (the five generators) needs it too now,
     since access-tiering has to apply everywhere, not only Company
     Setup. This is a real change from today's design, where the five
     generators need no real login at all, only the joke gate.
  5. After logging in: a **Dashboard page** (renamed from this step's
     original "Welcome page" — 2026-09-27, direct instruction: the
     pre-signin joke-gate landing is "Welcome," the page a real
     `mahmudur@shomvob.com`-style sign-in lands on is "Dashboard," so
     the two don't collide in conversation any more — see CLAUDE.md →
     "Operations — all 5 built" for the pre-signin rename), showing
     **Bulk**, **Settings**, or **Both** depending on the signed-in
     user's real access tier — optionally broken down further as an
     expandable tree. Whatever a given user's tier doesn't include gets
     a **lock icon** instead of being hidden outright.
  6. Picking Bulk goes to the five generators as they exist today.
     Picking Settings asks for the same company admin credentials
     Company Setup already asks for today — unchanged from the current
     two-step flow, just reached from this new Dashboard instead of
     directly.
  7. **Admin login/panel — proposed by Claude, confirmed directly
     (2026-09-25)**: no separate admin login at all. The one real tool
     sign-in (already built, already gates Company Setup) is the same
     login for everyone; "admin" is just a flag on that same account
     (`user_access.is_admin`, replacing today's standalone `admins`
     table — same mechanism the pre-signin Welcome page's `is_admin()`
     check already uses, just widened to also carry each user's tier).
     An admin sees one extra card on the new Dashboard (step 5):
     **Admin Panel**.
     Admin Panel v1 scope, also confirmed: view the audit log, and
     change an existing real tool user's tier/admin flag. **Adding or
     removing a real Supabase user stays the current Claude+SQL manual
     process** — not built into the UI yet, since that needs the
     `service_role` key, which can never be client-side (this app's own
     hard rule); revisit only if that manual step becomes a real pain
     point.
  8. **Default tier for any real tool account with no `user_access` row
     yet — confirmed directly (2026-09-25): "both"**, not locked-out.
     Covers today's 3 existing accounts (mahmudur, tamjida, tanvir)
     transparently — nobody loses access the moment this ships; an
     admin can then narrow anyone down from the panel.
  9. **This journey is being built step by step, not from one locked
     spec — confirmed directly (2026-09-25)**: "overall journey emne
     msg e ekbare bujhano hard. amra aste aste agabo." Step 2 (Dashboard)
     **is now speced and built** — see CLAUDE.md → Phase 2 → "Dashboard
     redesign — step 2 of the Tiered Access journey": "What it can do"
     (the operation-card grid) is out of the pre-login Dashboard
     entirely, destined for the still-unbuilt Welcome/tier page instead;
     the old 3-tile stat row is replaced by 3 public, no-login-needed
     bar charts; the meme is now a real Hackerman GIF; a sticky bottom
     bar carries a working "Sign in" button (reuses the Operations-gate
     flow) and a disabled "Auto setup my company & bulk upload" button
     (its Rickroll behaviour is still a later step). Today's "Team
     activity" section is untouched by this — still sits below the new
     charts, still admin-only, the "abrupt pop-in" UX complaint that
     flagged it as a stopgap was about *its own* section, not the
     Dashboard as a whole, and hasn't been revisited yet.

  **Progress (2026-09-25), see CLAUDE.md → Phase 2 → "Tiered Access —
  steps 1 and 2" and → "Dashboard redesign" for the full detail:**
  - ✅ **`user_access` table** — replaces `admins` outright (`tier` +
    `is_admin` per real account, default tier `"both"`). `is_admin()`
    redefined in place to read from it; new `my_tier()` sibling.
  - ✅ **Every Operation now needs the same real sign-in** Company Setup's
    own step one always used — `goToOperation()` is the one gate, both
    the sidebar's Operations list and the Dashboard's op-cards route
    through it. At the time this step shipped, tier itself wasn't
    enforced yet — this step only required *a* real sign-in, same as
    Company Setup always did. (Real tier enforcement followed the next
    day — see the ✅ bullet near the bottom of this list.)
  - ✅ **Dashboard redesign** — operation-card grid removed (kept in code
    for the tier page to reuse), 3 public charts replace the old stat
    tiles, real Hackerman meme, sticky Sign in + (disabled) troll button.
  - ✅ **Dashboard redesign, round two** (2026-09-25, same day) — sidebar's
    Operations section now hidden until a real tool sign-in happens
    (Setup/Company Setup deliberately left visible — it already gates
    itself); sticky bar restyled to a stacked note-then-buttons layout
    with both buttons the same size/weight. See CLAUDE.md → Phase 2 →
    "Dashboard redesign, round two" for the full detail, including the
    real staleness bug this surfaced and fixed (Company Setup's own
    sign-in/sign-out not re-rendering the sidebar).
  - ✅ **Dashboard redesign, round three** (2026-09-25, same day, direct
    correction of round two's own scoping) — the **whole sidebar** now
    hides pre-signin, not just Operations ("side bar shorao... eta wrong,
    amra sign in o kori nai" — Log out showing before any real sign-in
    was the specific complaint). Company Setup's own step-one sign-in
    form is now unreachable from the real UI as a direct consequence —
    **confirmed to keep the code as-is for now, move it into the new
    post-login page once that's designed** ("rakho ekhon... oi signup
    page shajanor por oitay transfer kore dilo"), not delete it. Sticky
    bar buttons got a real equal-height fix (`min-height`, not just
    `align-items: stretch`) and "Sign in" was renamed "Sign In for Real"
    (the bare label didn't say what it unlocked). The Appearance picker
    moved out of the sidebar into its own always-visible floating pill —
    flagged before building, since hiding it too would've been pure
    collateral damage, confirmed by `appearance.test.js` failing outright
    when it briefly did. See CLAUDE.md → Phase 2 → "Dashboard redesign,
    round three" for the full detail.
  - ✅ **The Rickroll** — the "Auto setup my company & bulk upload"
    button's own payoff, built 2026-09-25, see step 3 above and CLAUDE.md
    → Phase 2 → "The Rickroll".
  - ✅ **Real browser Back/Forward** (2026-09-25, not one of the
    originally numbered steps — a separate direct request the same day:
    "amader proper back function nai") — see CLAUDE.md → Phase 2 →
    "Real browser Back/Forward". Every top-level page change now goes
    through `navigateTo()`, which pushes real history entries.
  - ✅ **Admin Panel** (2026-09-25) — see CLAUDE.md → Phase 2 → "Admin
    Panel". Audit log viewer, tier/admin-flag management (direct
    `user_access` write under RLS), and add/remove a real account (via
    the new `admin-users` Edge Function). `mahmudur@shomvob.com` is
    still the one seeded admin; more can be added from the panel itself
    now, no SQL needed for that specific step any more.
  - ✅ **Reset password** (2026-09-26, direct follow-up: "keu password
    vule gele ki korbe?" — total user count is 25) — a "Reset password"
    button next to Save/Remove in Manage Users, admin sets a new
    password directly (`admin-users` Edge Function's new
    `reset_password` action, `auth.admin.updateUserById`) rather than a
    self-service emailed reset link — see CLAUDE.md → Phase 2 → "Admin
    Panel" → "Reset password".
  - ✅ **`my_tier()` now actually enforced, plus lock icons** (2026-09-26,
    direct instruction: "2 ar 3 kore felo, duita related" — do these two
    together) — see CLAUDE.md → Phase 2 → "Tiered Access — real
    enforcement + lock icons". A real "company" tier locks the sidebar's
    Operations list, a real "bulk" tier locks Company Setup — disabled +
    a small "Locked" pill, not hidden outright, real enforcement in
    `goToOperation()`/`wirePopstate()` too, not just the disabled button.
    Retrofitted onto today's real nav rather than waiting on the page
    below, since that page will read this same `myTier` state once built.
  - ✅ **The pre-signin Welcome page was fully rewritten through
    discussion, then batch-fixed twice from marked-up screenshots**
    (2026-09-27) — see CLAUDE.md → "Operations — all 5 built" for the
    rename note, and → "Welcome page rewritten through discussion..."
    (Phase 2 section) for the full build/fix history. Summary for
    whoever picks this up next:
    - Three written sections, no literal headers — **Reason** ("Dear
      certified lazy"), **Offer** ("Your prayers, answered (mostly)"),
      **Scope** ("The fine print") — laid out as a zigzag (copy+meme,
      mirrored) with Scope full-width and meme-less on purpose. Text:meme
      columns are a deliberate 70:30 split.
    - A real, public **"So far, for real"** stat section (files
      generated, settings automated, time saved — all three real,
      pulled from `audit_log` via two narrow, `anon`-safe SQL RPCs:
      `public.public_generate_counts()` and
      `public.public_settings_save_count()`, both already applied to the
      live Supabase project) sits below the existing static "By the
      numbers" estimate.
    - Headline is "Welcome to Shomvob Bulk Forge!" with the sidebar's own
      Lazy logo tile beside it; the how-row is plain (not sticky — this
      was tried, then explicitly reversed the same day).
    - **Two real, non-obvious CSS bugs were found and fixed along the
      way** (both documented in full in CLAUDE.md, worth reading before
      touching this page's layout again): (1) a "So far, for real"-driven
      fetch fires unconditionally on page load, before any test's
      `page.route()` mock registered *after* `page.goto()` can catch it
      — every test file's own `page.goto(PAGE)` call now has a
      `mockPublicStats(page)` immediately before it, not after,
      (`tests/lib.js`). (2) `.welcome-bar`'s own `align-items: stretch`
      never actually wins the cascade against a later, equal-specificity
      `.action-bar` rule — worked around locally (an explicit width on
      `.welcome-bar-actions`, fixed button widths) rather than fixed at
      the root, since fixing the cascade itself would also change
      `.welcome-bar-note`'s own layout, never reported as broken.
    - **Left open, on purpose**: Reason's own meme is still a plain,
      labelled placeholder (`.meme-placeholder`) — no real image chosen
      for that slot yet, don't invent one. **"By the numbers"'s own
      content was explicitly left untouched** — "apatoto thak, ami
      chinta kore guchay dibo ki ki rakhba" (leave it for now, I'll work
      out what belongs there myself) — don't redesign it without being
      asked again specifically.
  - ✅ **Built 2026-09-29**: the new post-login **Dashboard** page
    itself (renamed from "Welcome/tier routing page," 2026-09-27 — see
    the naming note on step 5 above; the pre-signin landing keeps the
    name "Welcome" instead — don't confuse the two). See CLAUDE.md →
    "The post-login Dashboard" for the full build: Bulk/Settings
    routing cards with lock icons ("Both" turned out to mean "neither
    locked," not a literal third card), a real per-operation usage
    table (`entry_count`-powered, see the bullet right above this one),
    an "Estimated impact so far" comparison, a This week/month/3-6
    months/All-time filter, and a low-emphasis "what we offer" strip at
    the bottom. **This closes the originally-dictated journey** — every
    numbered step above is now done. `tests/dashboard.test.js` (22
    checks) covers it; full 12-suite run (888 checks) green.
  - ✅ **Dashboard iterated further the same/next day** — the plain data
    table became a real donut + two axis bar charts (each with its own
    independent time-range filter, not one shared filter), the old
    Real usage table is gone entirely, and two more real bugs got
    fixed along the way (a wrong "Time saved" calculation, a clipped
    bar-chart label). See CLAUDE.md's own "Dashboard charts: fix
    clipped labels..." entries for the full detail.
  - ✅ **"What we offer" renamed to "What we offer & FAQ" and made
    real, 2026-09-29** — a card now opens a real page naming that
    operation's actual column-by-column generation logic (Settings is
    one combined card, not six), reachable from its own sidebar item
    too. Same day, the sidebar's own "Welcome" item was removed
    outright — a real loophole, direct feedback ("login korar por
    welcome page ta ar dekhano uchit na. o to login korei felse" —
    the public landing page shouldn't be revisitable once already
    signed in). See CLAUDE.md → "'What we offer & FAQ'" for the full
    build; `tests/faq.test.js` (20 checks) covers it.

  **Whoever picks this up next**: don't restart planning from scratch —
  every numbered decision above is confirmed, not an open question. Ask
  the user what to tackle next rather than assuming the order above is
  also the build order — this is being done step by step on purpose.
  **As of 2026-09-27, the user has said they'll guide this build
  directly, one step at a time** — wait for their concrete instruction
  rather than starting the full page unprompted. **Same discipline now
  also confirmed explicitly for the Welcome page's own screenshot-review
  process** — wait until the user says they're done listing issues
  before fixing any of them, even if an earlier one already looks
  obviously fixable; this was corrected once already the same day.
