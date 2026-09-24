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
  - **Audit log** — **data capture is built** (2026-09-24, see CLAUDE.md
    → Phase 2 → "Audit Log"): login / settings_save / bulk_generate
    events now write to a real Supabase `audit_log` table. **Still open:
    a viewing UI** — deliberately deferred, confirmed this belongs to
    the future admin panel below, not this phase ("eta kintu admin panel
    er part hobar kotha. je admin dhuke dekhbe ke ki korse").
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
    raise/lower anyone's access level from a real admin panel. Not
    started, intentionally after Dashboard (see above). This is also
    where the audit log's own viewing UI belongs.

  **Tiered access — the normal (non-admin) user journey, dictated
  directly (2026-09-24), captured here so it isn't lost between
  machines:**
  1. Joke gate (dummy id/password) as today.
  2. Lands on the **updated Dashboard** (per the item above — real
     stats/graphs once the audit log exists).
  3. A new "Auto setup my company and bulk upload" button on the
     Dashboard — **a deliberate joke, not a real feature** (this isn't
     something Bulk Forge can actually do end-to-end). Clicking it
     plays a Rickroll video on the right; the left side says "no, log
     in first" — a troll, same dry self-deprecating tone as the login
     gate/footer jokes elsewhere in this app.
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
    through it. Tier itself is **not enforced yet** — this step only
    requires *a* real sign-in, same as Company Setup always did.
  - ✅ **Dashboard redesign** — operation-card grid removed (kept in code
    for the tier page to reuse), 3 public charts replace the old stat
    tiles, real Hackerman meme, sticky Sign in + (disabled) troll button.
  - **Not started**: the troll button's actual Rickroll behaviour, the
    new Welcome/tier routing page itself (Bulk/Settings/Both cards +
    lock icons), actually reading `my_tier()` to enforce anything, and
    Admin Panel UI.

  **Whoever picks this up next**: don't restart planning from scratch —
  every numbered decision above is confirmed, not an open question. Ask
  the user what to tackle next rather than assuming the order above is
  also the build order — this is being done step by step on purpose.
