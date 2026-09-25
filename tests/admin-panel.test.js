/* Admin Panel — end-to-end against the built index.html.
 *
 * Built 2026-09-25, direct request: view the audit log, manage an
 * existing account's tier/admin flag, and add/remove a real account.
 * Tier/admin-flag writes go straight to `user_access` under RLS
 * (user_access_write_admins is FOR ALL, gated by is_admin()); adding or
 * removing a real Supabase Auth user goes through the `admin-users`
 * Edge Function (deployed separately, not part of this repo's build) —
 * the one place this app's client code is allowed to ask for something
 * that needs the service_role key, since the function itself holds
 * that key server-side and re-checks is_admin before doing anything.
 *
 * Every assertion maps to a rule in CLAUDE.md; if one fails, check
 * there before changing the test.
 */
const { chromium } = require("playwright");
const { PAGE, makeChecker, report, signIn, watchPageErrors } = require("./lib");

const { check, state } = makeChecker();

function mockAuthOk(page) {
  return page.route("**/auth/v1/token**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ access_token: "fake-tool-token", refresh_token: "fake-refresh", user: { id: "u1" }, expires_at: Math.floor(Date.now() / 1000) + 3600 }),
    })
  );
}

const SAMPLE_USERS = [
  { id: "u1", email: "mahmudur@shomvob.com", created_at: "2026-01-01", last_sign_in_at: "2026-09-25", tier: "both", is_admin: true },
  { id: "u2", email: "tamjida@shomvob.com", created_at: "2026-01-01", last_sign_in_at: null, tier: "both", is_admin: false },
];

async function mockAdminBackend(page, { isAdmin }) {
  await page.route("**/rest/v1/rpc/is_admin", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: String(isAdmin) })
  );
  await page.route("**/rest/v1/audit_log**", (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([{ id: "1", created_at: new Date().toISOString(), user_email: "mahmudur@shomvob.com", event_type: "login", company_name: null, module_id: null, detail: "signed in" }]),
      });
    }
    return route.fulfill({ status: 201, contentType: "application/json", body: "[]" });
  });
  const calls = { create: null, delete: null };
  await page.route("**/functions/v1/admin-users", async (route) => {
    const body = route.request().postDataJSON();
    if (body.action === "list") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ users: SAMPLE_USERS }) });
    }
    if (body.action === "create") {
      calls.create = body;
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, id: "u3" }) });
    }
    if (body.action === "delete") {
      calls.delete = body;
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
    }
    return route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ error: "unknown action" }) });
  });
  let savedAccessBody = null;
  await page.route("**/rest/v1/user_access**", (route) => {
    savedAccessBody = route.request().postDataJSON();
    return route.fulfill({ status: 201, contentType: "application/json", body: "[]" });
  });
  return { calls, getSavedAccessBody: () => savedAccessBody };
}

async function signInForReal(page, email) {
  await page.click("#welcomeLoginBtn");
  await page.waitForSelector("#opGateEmail");
  await page.fill("#opGateEmail", email);
  await page.fill("#opGatePass", "whatever");
  await page.click("#opGateSignInBtn");
  await page.waitForSelector(".sidebar");
  await page.waitForTimeout(150);
}

(async () => {
  const browser = await chromium.launch();

  {
    // A — a signed-in non-admin never sees the Admin nav item at all
    const page = await browser.newContext().then((c) => c.newPage());
    const errs = watchPageErrors(page);
    await page.goto(PAGE);
    await signIn(page);
    await mockAuthOk(page);
    await mockAdminBackend(page, { isAdmin: false });

    await signInForReal(page, "someone@shomvob.com");
    check("A no Admin Panel nav item for a non-admin", (await page.locator('.op-item:has-text("Users")').count()) === 0);
    check("A no page errors", errs.length === 0, errs.join(" | "));
    await page.close();
  }

  {
    // B — an admin sees both nav items (Users, Audit Log — real
    // individual pages, not one long scrolling page), Users first/
    // default, and each page shows the real data it's meant to
    const page = await browser.newContext().then((c) => c.newPage());
    const errs = watchPageErrors(page);
    await page.goto(PAGE);
    await signIn(page);
    await mockAuthOk(page);
    await mockAdminBackend(page, { isAdmin: true });

    await signInForReal(page, "mahmudur@shomvob.com");
    check("B both Admin nav items shown for an admin",
      (await page.locator('.op-item:has-text("Users")').count()) === 1 &&
      (await page.locator('.op-item:has-text("Audit Log")').count()) === 1);
    const adminNavLabels = await page.locator("#adminNav .op-item").allTextContents();
    check("B Users is listed before Audit Log (the default page)",
      adminNavLabels[0].includes("Users") && adminNavLabels[1].includes("Audit Log"),
      JSON.stringify(adminNavLabels));

    await page.click('.op-item:has-text("Users")');
    await page.waitForSelector(".preview-table");
    await page.waitForTimeout(150);

    check("B the Users page shows both real users, not the audit log",
      (await page.locator("tr[data-email]").count()) === 2 && (await page.locator(".preview-table td.strong").count()) === 0);
    check("B the signed-in admin's own Remove is disabled (no self-lockout)",
      await page.isDisabled('tr[data-email="mahmudur@shomvob.com"] .admin-remove-btn'));
    check("B another account's Remove stays enabled",
      !(await page.isDisabled('tr[data-email="tamjida@shomvob.com"] .admin-remove-btn')));

    // Manage Users and Create new user are two real tabs, not stacked
    // on the same page -- direct correction: "manage ar user create
    // kora alada rakhar kotha chilo. 1 page e na"
    check("B Manage Users is the default active tab",
      (await page.textContent('.settings-tab[aria-current="true"]')).trim() === "Manage Users");
    check("B the Create new user form is not shown on the Manage Users tab",
      (await page.locator("#adminNewEmail").count()) === 0);

    await page.click('.settings-tab:has-text("Create new user")');
    await page.waitForSelector("#adminNewEmail");
    check("B switching tabs shows the create form and hides the users table",
      (await page.locator("#adminNewEmail").count()) === 1 && (await page.locator("tr[data-email]").count()) === 0);

    await page.click('.op-item:has-text("Audit Log")');
    await page.waitForTimeout(150);
    check("B the Audit Log page shows the real event, not the users table",
      (await page.locator(".preview-table td.strong:has-text('login')").count()) > 0 && (await page.locator("tr[data-email]").count()) === 0);
    check("B no page errors", errs.length === 0, errs.join(" | "));
    await page.close();
  }

  {
    // C — changing an existing account's tier/admin flag writes straight
    // to user_access (no Edge Function involved) and logs the change
    const page = await browser.newContext().then((c) => c.newPage());
    const errs = watchPageErrors(page);
    await page.goto(PAGE);
    await signIn(page);
    await mockAuthOk(page);
    const { getSavedAccessBody } = await mockAdminBackend(page, { isAdmin: true });

    await signInForReal(page, "mahmudur@shomvob.com");
    await page.click('.op-item:has-text("Users")');
    await page.waitForSelector(".preview-table");

    // tamjida starts at "both" (both boxes checked) -- unchecking Company
    // alone should leave just Bulk checked
    await page.uncheck('tr[data-email="tamjida@shomvob.com"] .admin-company-checkbox');
    await page.click('tr[data-email="tamjida@shomvob.com"] .admin-flag-checkbox');
    await page.click('tr[data-email="tamjida@shomvob.com"] .admin-save-btn');
    await page.waitForTimeout(250);

    const saved = getSavedAccessBody();
    check("C the tier/admin change is sent as a direct user_access write",
      saved && saved.email === "tamjida@shomvob.com" && saved.tier === "bulk" && saved.is_admin === true,
      JSON.stringify(saved));
    check("C no error shown after a successful save", (await page.textContent("#adminUsersError")).trim() === "");

    // C2 -- can't uncheck both Bulk and Company down to zero (a no-op,
    // same "can't configure your way to nothing" discipline as Employee
    // Add's own theme picker)
    await page.click('tr[data-email="tamjida@shomvob.com"] .admin-bulk-checkbox');
    check("C2 unchecking the last operations checkbox is a no-op",
      await page.isChecked('tr[data-email="tamjida@shomvob.com"] .admin-bulk-checkbox'));
    check("C no page errors", errs.length === 0, errs.join(" | "));
    await page.close();
  }

  {
    // D — adding a user calls the Edge Function's "create" action with
    // the real fields, not a direct auth write from the client
    const page = await browser.newContext().then((c) => c.newPage());
    const errs = watchPageErrors(page);
    await page.goto(PAGE);
    await signIn(page);
    await mockAuthOk(page);
    const { calls } = await mockAdminBackend(page, { isAdmin: true });

    await signInForReal(page, "mahmudur@shomvob.com");
    await page.click('.op-item:has-text("Users")');
    await page.waitForSelector(".preview-table");
    await page.click('.settings-tab:has-text("Create new user")');
    await page.waitForSelector("#adminNewEmail");

    await page.fill("#adminNewEmail", "newperson@shomvob.com");
    await page.fill("#adminNewPass", "whatever123");
    await page.selectOption("#adminNewTier", "company");
    await page.click('#adminNewAdminSeg button[data-val="yes"]');
    await page.click("#adminCreateBtn");
    await page.waitForTimeout(400);

    check("D the create call carries the real form values",
      calls.create && calls.create.email === "newperson@shomvob.com" && calls.create.password === "whatever123" &&
      calls.create.tier === "company" && calls.create.is_admin === true,
      JSON.stringify(calls.create));
    check("D switches back to Manage Users after a successful create",
      (await page.textContent('.settings-tab[aria-current="true"]')).trim() === "Manage Users");
    check("D no page errors", errs.length === 0, errs.join(" | "));
    await page.close();
  }

  {
    // E — removing another account confirms first, then calls the Edge
    // Function's "delete" action with that user's real id and email
    const page = await browser.newContext().then((c) => c.newPage());
    const errs = watchPageErrors(page);
    page.on("dialog", (d) => d.accept());
    await page.goto(PAGE);
    await signIn(page);
    await mockAuthOk(page);
    const { calls } = await mockAdminBackend(page, { isAdmin: true });

    await signInForReal(page, "mahmudur@shomvob.com");
    await page.click('.op-item:has-text("Users")');
    await page.waitForSelector(".preview-table");

    await page.click('tr[data-email="tamjida@shomvob.com"] .admin-remove-btn');
    await page.waitForTimeout(400);

    check("E the delete call carries the removed user's real id and email",
      calls.delete && calls.delete.userId === "u2" && calls.delete.email === "tamjida@shomvob.com",
      JSON.stringify(calls.delete));
    check("E no page errors", errs.length === 0, errs.join(" | "));
    await page.close();
  }

  {
    // F — a real, confirmed bug, found live 2026-09-26: refreshAdminNav()
    // only ever ran from the two real sign-in *success handlers*, so a
    // session restored on a hard refresh (setup.toolToken set directly
    // from sessionStorage, skipping both handlers) left isAdminUser
    // false even for a genuine admin, and the sidebar's whole "ADMIN"
    // section silently disappeared on every reload.
    const page = await browser.newContext().then((c) => c.newPage());
    const errs = watchPageErrors(page);
    await page.goto(PAGE);
    await signIn(page);
    await mockAuthOk(page);
    await mockAdminBackend(page, { isAdmin: true });

    await signInForReal(page, "mahmudur@shomvob.com");
    check("F Admin section visible right after sign-in", (await page.locator('.op-item:has-text("Users")').count()) === 1);

    await page.reload();
    await page.waitForSelector(".sidebar", { timeout: 5000 });
    await page.waitForTimeout(400);
    check("F still signed in after a hard refresh", await page.isVisible(".sidebar"));
    check("F Admin section still visible after a hard refresh",
      (await page.locator('.op-item:has-text("Users")').count()) === 1);
    check("F no page errors", errs.length === 0, errs.join(" | "));
    await page.close();
  }

  await browser.close();
  report("Admin Panel", state, []);
})();
