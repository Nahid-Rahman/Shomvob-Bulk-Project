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
  - **Dashboard with a proper overview** — real stats (how many
    companies had settings run, how many bulk creates of what type)
    with appropriate graphs. **Confirmed as the next item to build**
    (2026-09-24) — recommended over starting Tiered access next because
    (a) the data already exists (`audit_log`, below) so no new pipeline
    is needed, just querying it; (b) it's non-disruptive — no login-flow
    change, no existing behaviour breaks; (c) Tiered access is the
    bigger, riskier piece (it means gating Bulk with real login too, plus
    the admin login/panel design the user explicitly left open — "admin
    login ta kemne hobe ota tumi e bolo") and building Dashboard first
    also doubles as a live check that `audit_log` is actually capturing
    correctly, since its numbers will draw straight from that table. Not
    started yet — being picked up on a different machine next.

    **Context for whoever starts this** (so it's readable cold, without
    needing this conversation): `audit_log` is a real Supabase table
    (project `wtlaiidtiugxirqcxjzw`, see CLAUDE.md → Phase 2 → "The
    Supabase project itself" and → "Audit Log") with three event types
    currently written — `login`, `settings_save`, `bulk_generate` — each
    row carrying `event_type`, `detail`, `user_email`, plus `extra` fields
    (`environment`, `company_name`, `module_id` on settings_save events).
    No SELECT policy exists yet (insert-only via the anon/authenticated
    client) — reading real rows for a Dashboard needs either a
    read-enabling RLS policy (scoped sensibly, not wide open — this is
    the same access-control question Tiered access will also need to
    answer, so don't over-decide it here) or a server-side aggregation
    step; **raise this with the user before deciding**, don't assume.
    Exact stats/graphs to show haven't been dictated yet either — ask
    before building, same "confirm rules, never assume" discipline this
    whole project holds itself to.
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
  7. **The admin login/admin-panel flow itself is still undecided** —
     the user explicitly left this to be proposed, not dictated
     ("admin login ta kemne hobe ota tumi e bolo").
