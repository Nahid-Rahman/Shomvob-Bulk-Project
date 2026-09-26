# To-do

A shared, cross-machine task list — committed and pushed like everything
else, so a note made on one machine is visible on the other. Add an item
here instead of only saying it out loud, and delete it once it's done
(pull the latest before checking — another machine may have finished it,
or added more).

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
  5. After logging in: a **Welcome page**, showing **Bulk**, **Settings**,
     or **Both** depending on the signed-in user's real access tier —
     optionally broken down further as an expandable tree. Whatever a
     given user's tier doesn't include gets a **lock icon** instead of
     being hidden outright.
  6. Picking Bulk goes to the five generators as they exist today.
     Picking Settings asks for the same company admin credentials
     Company Setup already asks for today — unchanged from the current
     two-step flow, just reached from this new Welcome page instead of
     directly.
  7. **Admin login/panel — proposed by Claude, confirmed directly
     (2026-09-25)**: no separate admin login at all. The one real tool
     sign-in (already built, already gates Company Setup) is the same
     login for everyone; "admin" is just a flag on that same account
     (`user_access.is_admin`, replacing today's standalone `admins`
     table — same mechanism Dashboard's `is_admin()` already uses,
     just widened to also carry each user's tier). An admin sees one
     extra card on the new Welcome/tier page (step 5): **Admin Panel**.
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
  - **Not started**: the new Welcome/tier routing page itself
    (Bulk/Settings/Both cards + lock icons — this is also where the
    Operations-picking experience now moved off the sidebar is headed,
    and where Company Setup's own step-one sign-in form is meant to
    move to). **This is the last piece of the originally-dictated
    journey left** — enforcement itself is done (above), what's missing
    now is purely the dedicated landing page.

  **Whoever picks this up next**: don't restart planning from scratch —
  every numbered decision above is confirmed, not an open question. Ask
  the user what to tackle next rather than assuming the order above is
  also the build order — this is being done step by step on purpose.
