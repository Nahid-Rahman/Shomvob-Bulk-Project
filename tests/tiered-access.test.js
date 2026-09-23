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

(async () => {
  const browser = await chromium.launch();

  {
    // A — clicking an Operation without a real sign-in shows the gate, not the operation
    const page = await browser.newContext().then((c) => c.newPage());
    const errs = watchPageErrors(page);
    await page.goto(PAGE);
    await signIn(page);

    check("Dashboard itself needs no real sign-in", await page.isVisible(".welcome-title"));
    await page.click('.op-item:has-text("Employee Add")');
    check("Employee Add is blocked behind the real-login gate instead", (await page.locator("#opGateSignInBtn").count()) === 1);
    check("the gate names which operation was requested", (await page.textContent(".page-title")).includes("Employee Add"));
    check("the real Employee Add form is not shown yet", (await page.locator("#countInput").count()) === 0);
    check("no page errors", errs.length === 0, errs.join(" | "));
    await page.close();
  }

  {
    // B — a wrong password is refused and stays on the gate
    const page = await browser.newContext().then((c) => c.newPage());
    const errs = watchPageErrors(page);
    await page.goto(PAGE);
    await signIn(page);
    await mockAuthFail(page);

    await page.click('.op-item:has-text("Assets Add")');
    await page.waitForSelector("#opGateSignInBtn");
    await page.fill("#opGateEmail", "someone@shomvob.com");
    await page.fill("#opGatePass", "wrong");
    await page.click("#opGateSignInBtn");
    await page.waitForTimeout(150);
    check("B wrong credentials show an error", (await page.textContent("#opGateError")).length > 0);
    check("B still on the gate, not Assets Add", (await page.locator("#opGateSignInBtn").count()) === 1);
    check("B no page errors", errs.length === 0, errs.join(" | "));
    await page.close();
  }

  {
    // C — real sign-in lands on the originally-requested operation, logs it, and a later operation switch skips the gate
    const page = await browser.newContext().then((c) => c.newPage());
    const errs = watchPageErrors(page);
    let auditBody = null;
    await page.goto(PAGE);
    await signIn(page);
    await mockAuthOk(page);
    await page.route("**/rest/v1/audit_log**", (route) => {
      auditBody = route.request().postDataJSON();
      route.fulfill({ status: 201, contentType: "application/json", body: "[]" });
    });

    await page.click('.op-item:has-text("Employee Add")');
    await page.waitForSelector("#opGateSignInBtn");
    await page.fill("#opGateEmail", "someone@shomvob.com");
    await page.fill("#opGatePass", "whatever");
    await page.click("#opGateSignInBtn");
    await page.waitForSelector("#countInput");
    check("C lands on the exact operation originally requested", (await page.locator("#countInput").count()) === 1);
    check("C logs a real login audit event", auditBody && auditBody.event_type === "login" && auditBody.user_email === "someone@shomvob.com", JSON.stringify(auditBody));

    // Now signed in on this same page — switching to a different operation must not show the gate again.
    await page.click('.op-item:has-text("Assets Add")');
    check("C a later operation switch skips the gate entirely", (await page.locator("#opGateSignInBtn").count()) === 0);
    check("C and lands straight on that operation", (await page.locator("#assetCount").count()) === 1);
    check("C no page errors", errs.length === 0, errs.join(" | "));
    await page.close();
  }

  {
    // D — Company Setup's own sign-in also counts, so an Operation clicked afterward skips the gate too
    const page = await browser.newContext().then((c) => c.newPage());
    const errs = watchPageErrors(page);
    await page.goto(PAGE);
    await signIn(page);
    await mockAuthOk(page);
    await page.route("**/rest/v1/audit_log**", (route) => route.fulfill({ status: 201, contentType: "application/json", body: "[]" }));

    await page.click('.op-item:has-text("Company Setup")');
    await page.fill("#setupEmail", "someone@shomvob.com");
    await page.fill("#setupPass", "whatever");
    await page.click("#setupSignInBtn");
    await page.waitForSelector("#setupCoBtn", { timeout: 5000 });

    await page.click('.op-item:has-text("Employee Add")');
    check("D signing in via Company Setup also unlocks Operations — same one real account", (await page.locator("#countInput").count()) === 1);
    check("D no page errors", errs.length === 0, errs.join(" | "));
    await page.close();
  }

  await browser.close();
  report("Tiered Access", state, []);
})();
