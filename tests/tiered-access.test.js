/* Tiered Access — end-to-end against the built index.html.
 *
 * Started 2026-09-25, step 2 of the journey dictated in TODO.md: every
 * operation now needs the same real Bulk Forge sign-in Company Setup's
 * own step one already used, not just the joke gate. A dedicated file
 * rather than bolting this onto employee.test.js or company-setup.test.js,
 * since this feature is being built step by step over several days (see
 * TODO.md) and will keep growing — tier enforcement, the Welcome/tier
 * page, Admin Panel.
 *
 * Rewritten the same day, right after the Dashboard redesign (also
 * 2026-09-25, round two): the whole sidebar (.sidebar) is now hidden
 * entirely until a real tool sign-in happens, on direct user feedback
 * ("side bar shorao... side bar e ekta logout ase eta wrong. amra to
 * sign in o kori nai" — remove the sidebar, it has a Log out in it and
 * nothing's been signed in yet). That means an operation item can no
 * longer be clicked pre-signin to trigger the inline gate — the
 * Dashboard's own sticky #welcomeLoginBtn is the one way in now. The
 * gate itself (operationsGateTemplate()) is unchanged underneath; only
 * how a visitor reaches it changed, so these blocks now start from that
 * button instead of a direct operation click.
 *
 * Every assertion maps to a rule in TODO.md/CLAUDE.md; if one fails,
 * check those before changing the test.
 */
const { chromium } = require("playwright");
const { PAGE, makeChecker, report, signIn, watchPageErrors } = require("./lib");

const { check, state } = makeChecker();

function mockAuthOk(page) {
  return page.route("**/auth/v1/token**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ access_token: "fake-tool-token", refresh_token: "fake-refresh", user: { id: "u1" } }),
    })
  );
}
function mockAuthFail(page) {
  return page.route("**/auth/v1/token**", (route) =>
    route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ error_description: "Invalid login credentials" }) })
  );
}
/* Real tier enforcement (2026-09-26) — refreshMyTier() fires on the
   same real sign-in refreshAdminNav() already did, so every sign-in in
   this file needs this mocked too. Defaults to "both" unless a block
   registers its own narrower override first. */
function mockTier(page, tier) {
  return page.route("**/rest/v1/rpc/my_tier", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(tier) }));
}

(async () => {
  const browser = await chromium.launch();

  {
    // A — the Dashboard itself needs no real sign-in, and Operations stays hidden in the sidebar until one happens
    const page = await browser.newContext().then((c) => c.newPage());
    const errs = watchPageErrors(page);
    await page.goto(PAGE);
    await signIn(page);

    check("A Dashboard itself needs no real sign-in", await page.isVisible(".welcome-title"));
    check("A the whole sidebar is hidden pre-signin", !(await page.isVisible(".sidebar")));
    check("A the sticky Sign in button is there instead", await page.isVisible("#welcomeLoginBtn"));
    check("A no page errors", errs.length === 0, errs.join(" | "));
    await page.close();
  }

  {
    // B — clicking the sticky Sign in button opens the real gate; a wrong password is refused and stays on it
    const page = await browser.newContext().then((c) => c.newPage());
    const errs = watchPageErrors(page);
    await page.goto(PAGE);
    await signIn(page);
    await mockAuthFail(page);

    await page.click("#welcomeLoginBtn");
    await page.waitForSelector("#opGateSignInBtn");
    await page.fill("#opGateEmail", "someone@shomvob.com");
    await page.fill("#opGatePass", "wrong");
    await page.click("#opGateSignInBtn");
    await page.waitForTimeout(150);
    check("B wrong credentials show an error", (await page.textContent("#opGateError")).length > 0);
    check("B still on the gate, sidebar still hidden", (await page.locator("#opGateSignInBtn").count()) === 1 && !(await page.isVisible(".sidebar")));
    check("B no page errors", errs.length === 0, errs.join(" | "));
    await page.close();
  }

  {
    // C — a successful sign-in reveals the whole sidebar and logs it; picking an operation then works directly, and a later switch skips any further gate
    const page = await browser.newContext().then((c) => c.newPage());
    const errs = watchPageErrors(page);
    let auditBody = null;
    await page.goto(PAGE);
    await signIn(page);
    await mockAuthOk(page);
    await mockTier(page, "both");
    await page.route("**/rest/v1/audit_log**", (route) => {
      auditBody = route.request().postDataJSON();
      route.fulfill({ status: 201, contentType: "application/json", body: "[]" });
    });

    await page.click("#welcomeLoginBtn");
    await page.waitForSelector("#opGateSignInBtn");
    await page.fill("#opGateEmail", "someone@shomvob.com");
    await page.fill("#opGatePass", "whatever");
    await page.click("#opGateSignInBtn");
    await page.waitForSelector(".sidebar");
    check("C signing in reveals the whole sidebar", await page.isVisible(".sidebar"));
    check("C logs a real login audit event", auditBody && auditBody.event_type === "login" && auditBody.user_email === "someone@shomvob.com", JSON.stringify(auditBody));

    await page.click('.op-item:has-text("Employee Add")');
    await page.waitForSelector("#countInput");
    check("C picking an operation now works directly", (await page.locator("#countInput").count()) === 1);

    // Still signed in on this same page — switching to a different operation must not show the gate again.
    await page.click('.op-item:has-text("Assets Add")');
    check("C a later operation switch skips the gate entirely", (await page.locator("#opGateSignInBtn").count()) === 0);
    check("C and lands straight on that operation", (await page.locator("#assetCount").count()) === 1);
    check("C no page errors", errs.length === 0, errs.join(" | "));
    await page.close();
  }

  {
    // D — Company Setup's own step one is skipped once the Dashboard's own sign-in already happened — same one real account
    //
    // Round two of the sidebar-hiding change (above) made Company Setup's
    // own sidebar link unreachable pre-signin too, so this block no longer
    // tests "sign in there first" — that path doesn't exist from the UI
    // any more. What's left to confirm is the reverse: once signed in via
    // the Dashboard, Company Setup's own step-one form (setupSignInTemplate())
    // is skipped straight to step two, since setup.toolToken is already set.
    const page = await browser.newContext().then((c) => c.newPage());
    const errs = watchPageErrors(page);
    await page.goto(PAGE);
    await signIn(page);
    await mockAuthOk(page);
    await mockTier(page, "both");
    await page.route("**/rest/v1/audit_log**", (route) => route.fulfill({ status: 201, contentType: "application/json", body: "[]" }));

    await page.click("#welcomeLoginBtn");
    await page.waitForSelector("#opGateSignInBtn");
    await page.fill("#opGateEmail", "someone@shomvob.com");
    await page.fill("#opGatePass", "whatever");
    await page.click("#opGateSignInBtn");
    await page.waitForSelector(".sidebar");

    await page.click('.op-item:has-text("Company Setup")');
    check("D Company Setup's own step one is skipped — same one real account", (await page.locator("#setupCoBtn").count()) === 1 && (await page.locator("#setupSignInBtn").count()) === 0);
    check("D no page errors", errs.length === 0, errs.join(" | "));
    await page.close();
  }

  {
    // E — a real "company" tier locks Operations: greyed out, a Locked
    // pill, disabled — and a direct click can't reach an operation
    // page even so (goToOperation()'s own real enforcement, not just
    // the disabled button).
    const page = await browser.newContext().then((c) => c.newPage());
    const errs = watchPageErrors(page);
    await page.goto(PAGE);
    await signIn(page);
    await mockAuthOk(page);
    await mockTier(page, "company");
    await page.route("**/rest/v1/audit_log**", (route) => route.fulfill({ status: 201, contentType: "application/json", body: "[]" }));

    await page.click("#welcomeLoginBtn");
    await page.waitForSelector("#opGateSignInBtn");
    await page.fill("#opGateEmail", "someone@shomvob.com");
    await page.fill("#opGatePass", "whatever");
    await page.click("#opGateSignInBtn");
    await page.waitForSelector(".sidebar");
    await page.waitForTimeout(200);

    check("E every Operation is disabled", await page.locator('.op-item:has-text("Employee Add")').isDisabled());
    check("E a Locked pill names why", (await page.locator('.op-item:has-text("Employee Add") .pill-soon').textContent()).trim() === "Locked");
    check("E Company Setup stays enabled", !(await page.locator('.op-item:has-text("Company Setup")').isDisabled()));
    check("E the sticky bar's own note reflects the real tier", (await page.textContent("#welcomeBarNote")).includes("Company Setup is unlocked") && (await page.textContent("#welcomeBarNote")).includes("doesn't include Operations"));
    check("E no page errors", errs.length === 0, errs.join(" | "));
    await page.close();
  }

  {
    // F — a real "bulk" tier locks Company Setup the same way
    const page = await browser.newContext().then((c) => c.newPage());
    const errs = watchPageErrors(page);
    await page.goto(PAGE);
    await signIn(page);
    await mockAuthOk(page);
    await mockTier(page, "bulk");
    await page.route("**/rest/v1/audit_log**", (route) => route.fulfill({ status: 201, contentType: "application/json", body: "[]" }));

    await page.click("#welcomeLoginBtn");
    await page.waitForSelector("#opGateSignInBtn");
    await page.fill("#opGateEmail", "someone@shomvob.com");
    await page.fill("#opGatePass", "whatever");
    await page.click("#opGateSignInBtn");
    await page.waitForSelector(".sidebar");
    await page.waitForTimeout(200);

    check("F Company Setup is disabled", await page.locator('.op-item:has-text("Company Setup")').isDisabled());
    check("F Operations stay enabled", !(await page.locator('.op-item:has-text("Employee Add")').isDisabled()));
    check("F the sticky bar's own note reflects the real tier", (await page.textContent("#welcomeBarNote")).includes("Operations are unlocked") && (await page.textContent("#welcomeBarNote")).includes("doesn't include Company Setup"));

    // Picking an operation still works directly (this tier includes Bulk).
    await page.click('.op-item:has-text("Employee Add")');
    await page.waitForSelector("#countInput");
    check("F Operations remain fully usable under a bulk-only tier", (await page.locator("#countInput").count()) === 1);
    check("F no page errors", errs.length === 0, errs.join(" | "));
    await page.close();
  }

  await browser.close();
  report("Tiered Access", state, []);
})();
