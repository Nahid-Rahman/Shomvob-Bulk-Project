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

const DEFAULT_AUDIT_ROWS = [{ id: "1", created_at: new Date().toISOString(), user_email: "mahmudur@shomvob.com", event_type: "login", company_name: null, module_id: null, detail: "signed in" }];

async function mockAdminBackend(page, { isAdmin, auditRows }) {
  await page.route("**/rest/v1/rpc/is_admin", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: String(isAdmin) })
  );
  /* Real tier enforcement (2026-09-26) — refreshMyTier() fires on the
     same real sign-in refreshAdminNav() already did. Default "both"
     (unlocked) since these blocks are testing the Admin Panel, not
     Operations/Company Setup access. */
  await page.route("**/rest/v1/rpc/my_tier", (route) => route.fulfill({ status: 200, contentType: "application/json", body: '"both"' }));
  await page.route("**/rest/v1/audit_log**", (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(auditRows || DEFAULT_AUDIT_ROWS),
      });
    }
    return route.fulfill({ status: 201, contentType: "application/json", body: "[]" });
  });
  const calls = { create: null, delete: null, reset_password: null };
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
    if (body.action === "reset_password") {
      calls.reset_password = body;
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

    // A proper success modal, not silence (2026-09-26, direct request:
    // "kisu change korle ba update korle ekta proper success modal
    // dekhao with proper msg").
    check("C a success modal appears naming the real change",
      (await page.isVisible("#successModal")) &&
      (await page.textContent("#successTitle")).trim() === "Access updated" &&
      (await page.textContent("#successBody")).includes("tamjida@shomvob.com") &&
      (await page.textContent("#successBody")).includes("Bulk Operations only") &&
      (await page.textContent("#successBody")).includes("Admin"));
    await page.click("#successOkBtn");
    check("C the modal closes on Got it", !(await page.isVisible("#successModal")));

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

    check("D Admin defaults unchecked (No)", !(await page.isChecked("#adminNewAdminCb")));
    check("D Bulk/Company Operations both default checked (Both)",
      (await page.isChecked("#adminNewBulkCb")) && (await page.isChecked("#adminNewCompanyCb")));

    await page.fill("#adminNewEmail", "newperson@shomvob.com");
    await page.fill("#adminNewPass", "whatever123");
    await page.uncheck("#adminNewBulkCb");
    await page.check("#adminNewAdminCb");
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

  {
    // G — Reset password (2026-09-26, direct request: "1 e koro" — the
    // admin-resets-it-manually option, not a self-service emailed reset
    // link, since total user is only 25 real accounts). A plain
    // window.prompt() for the new password, same risk tolerance as
    // Remove's own window.confirm.
    const page = await browser.newContext().then((c) => c.newPage());
    const errs = watchPageErrors(page);
    let promptMessage = null;
    page.on("dialog", (d) => {
      promptMessage = d.message();
      d.accept("newpassword123");
    });
    await page.goto(PAGE);
    await signIn(page);
    await mockAuthOk(page);
    const { calls } = await mockAdminBackend(page, { isAdmin: true });

    await signInForReal(page, "mahmudur@shomvob.com");
    await page.click('.op-item:has-text("Users")');
    await page.waitForSelector(".preview-table");

    await page.click('tr[data-email="tamjida@shomvob.com"] .admin-reset-btn');
    await page.waitForTimeout(400);

    check("G the prompt names the account being reset", promptMessage && promptMessage.includes("tamjida@shomvob.com"), promptMessage);
    check("G the reset_password call carries the real user id, email and new password",
      calls.reset_password && calls.reset_password.userId === "u2" && calls.reset_password.email === "tamjida@shomvob.com" &&
      calls.reset_password.password === "newpassword123",
      JSON.stringify(calls.reset_password));
    check("G a success toast confirms the reset", (await page.textContent("#toast")).includes("tamjida@shomvob.com"));
    check("G no page errors", errs.length === 0, errs.join(" | "));
    await page.close();
  }

  {
    // H — Audit Log filters (2026-09-26, direct request: "audit e duita
    // filter ano. User ar date"), plain client-side filtering over the
    // already-loaded rows.
    const page = await browser.newContext().then((c) => c.newPage());
    const errs = watchPageErrors(page);
    await page.goto(PAGE);
    await signIn(page);
    await mockAuthOk(page);
    const auditRows = [
      { id: "1", created_at: "2026-09-26T10:00:00.000Z", user_email: "mahmudur@shomvob.com", event_type: "login", company_name: null, module_id: null, detail: "signed in" },
      { id: "2", created_at: "2026-09-26T11:00:00.000Z", user_email: "tamjida@shomvob.com", event_type: "settings_save", company_name: "Shark Pond", module_id: "company_profile", detail: "saved" },
      { id: "3", created_at: "2026-09-20T09:00:00.000Z", user_email: "mahmudur@shomvob.com", event_type: "bulk_generate", company_name: null, module_id: "employee_add", detail: "generated" },
    ];
    await mockAdminBackend(page, { isAdmin: true, auditRows });

    await signInForReal(page, "mahmudur@shomvob.com");
    await page.click('.op-item:has-text("Audit Log")');
    await page.waitForSelector(".preview-table");

    check("H all 3 rows show with no filter applied", (await page.locator(".preview-table tbody tr").count()) === 3);
    check("H no 'Clear filters' button with no filter applied", (await page.locator("#adminAuditClearFilterBtn").count()) === 0);

    await page.selectOption("#adminAuditUserFilter", "mahmudur@shomvob.com");
    await page.waitForTimeout(150);
    check("H filtering by user shows only that user's 2 rows",
      (await page.locator(".preview-table tbody tr").count()) === 2 &&
      (await page.locator(".preview-table tbody").textContent()).includes("tamjida@shomvob.com") === false);
    check("H the filter count line names both numbers", (await page.textContent("#adminAuditFilterCount")).trim() === "Showing 2 of 3 events.");

    await page.fill("#adminAuditDateFilter", "2026-09-26");
    await page.waitForTimeout(150);
    check("H combining the date filter narrows to the single matching row",
      (await page.locator(".preview-table tbody tr").count()) === 1 &&
      (await page.textContent(".preview-table tbody")).includes("login"));

    await page.click("#adminAuditClearFilterBtn");
    await page.waitForTimeout(150);
    check("H Clear filters restores all 3 rows and both controls reset",
      (await page.locator(".preview-table tbody tr").count()) === 3 &&
      (await page.inputValue("#adminAuditUserFilter")) === "" &&
      (await page.inputValue("#adminAuditDateFilter")) === "");

    await page.selectOption("#adminAuditUserFilter", "tamjida@shomvob.com");
    await page.fill("#adminAuditDateFilter", "2026-09-20");
    await page.waitForTimeout(150);
    check("H a combination matching nothing shows the 'no events match' message",
      (await page.textContent(".preview-table tbody")).includes("No events match these filters."));

    check("H no page errors", errs.length === 0, errs.join(" | "));
    await page.close();
  }

  {
    // I — pagination (50/page) and the Settings Group column
    // (2026-09-26, direct request: "ekhane 50 ta entry rakho per page...
    // ar module e bank info asche properly but eta kon settings er
    // moddhe etao ekta column e dekhao er pashe").
    const page = await browser.newContext().then((c) => c.newPage());
    const errs = watchPageErrors(page);
    await page.goto(PAGE);
    await signIn(page);
    await mockAuthOk(page);
    const bigAuditRows = [];
    for (let i = 0; i < 62; i++) {
      bigAuditRows.push({
        id: String(i),
        created_at: new Date(Date.now() - i * 3600000).toISOString(),
        user_email: "mahmudur@shomvob.com",
        event_type: i % 2 === 0 ? "settings_save" : "bulk_generate",
        company_name: i % 2 === 0 ? "Nexa Technologies" : null,
        module_id: i % 2 === 0 ? "bank_info" : "employee_add",
        detail: i % 2 === 0 ? "Saved Bank Info" : "Employee Add file is ready!",
      });
    }
    await mockAdminBackend(page, { isAdmin: true, auditRows: bigAuditRows });

    await signInForReal(page, "mahmudur@shomvob.com");
    await page.click('.op-item:has-text("Audit Log")');
    await page.waitForSelector(".preview-table");

    check("I the Settings Group column names bank_info's real group", (await page.textContent(".preview-table thead")).includes("Settings Group"));
    check("I a settings module's row names its own group", (await page.locator(".preview-table tbody tr:has-text('bank_info')").first().textContent()).includes("Company Settings"));
    check("I a non-settings module (employee_add) shows a dash, not a group", (await page.locator(".preview-table tbody tr:has-text('employee_add')").first().textContent()).includes("—"));

    check("I only the first 50 rows show on page 1", (await page.locator(".preview-table tbody tr").count()) === 50);
    check("I the pagination reads 'Page 1 of 2'", (await page.textContent(".audit-pagination-label")).trim() === "Page 1 of 2");
    check("I Previous is disabled on page 1", await page.isDisabled("#adminAuditPrevBtn"));
    check("I Next is enabled on page 1", !(await page.isDisabled("#adminAuditNextBtn")));

    await page.click("#adminAuditNextBtn");
    await page.waitForTimeout(150);
    check("I page 2 shows exactly the remaining 12 rows", (await page.locator(".preview-table tbody tr").count()) === 12);
    check("I the pagination reads 'Page 2 of 2'", (await page.textContent(".audit-pagination-label")).trim() === "Page 2 of 2");
    check("I Next is disabled on the last page", await page.isDisabled("#adminAuditNextBtn"));

    await page.click("#adminAuditPrevBtn");
    await page.waitForTimeout(150);
    check("I Previous returns to page 1's own 50 rows", (await page.locator(".preview-table tbody tr").count()) === 50);

    check("I no page errors", errs.length === 0, errs.join(" | "));
    await page.close();
  }

  await browser.close();
  report("Admin Panel", state, []);
})();
