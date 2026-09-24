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
 * 2026-09-25): the sidebar's Operations section is now hidden entirely
 * (#gatedNav) until a real tool sign-in happens, on direct user feedback
 * ("landing dashboard e ei side bar dekhabona"). That means an operation
 * item can no longer be clicked pre-signin to trigger the inline gate —
 * the Dashboard's own sticky #welcomeLoginBtn is the one way in now.
 * The gate itself (operationsGateTemplate()) is unchanged underneath;
 * only how a visitor reaches it changed, so these blocks now start from
 * that button instead of a direct operation click.
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
    // A — the Dashboard itself needs no real sign-in, and Operations stays hidden in the sidebar until one happens
    const page = await browser.newContext().then((c) => c.newPage());
    const errs = watchPageErrors(page);
    await page.goto(PAGE);
    await signIn(page);

    check("A Dashboard itself needs no real sign-in", await page.isVisible(".welcome-title"));
    check("A Operations section is hidden in the sidebar pre-signin", !(await page.isVisible("#gatedNav")));
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
    check("B still on the gate, Operations still hidden", (await page.locator("#opGateSignInBtn").count()) === 1 && !(await page.isVisible("#gatedNav")));
    check("B no page errors", errs.length === 0, errs.join(" | "));
    await page.close();
  }

  {
    // C — a successful sign-in reveals Operations and logs it; picking one then works directly, and a later switch skips any further gate
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

    await page.click("#welcomeLoginBtn");
    await page.waitForSelector("#opGateSignInBtn");
    await page.fill("#opGateEmail", "someone@shomvob.com");
    await page.fill("#opGatePass", "whatever");
    await page.click("#opGateSignInBtn");
    await page.waitForSelector("#gatedNav");
    check("C signing in reveals Operations in the sidebar", await page.isVisible("#gatedNav"));
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
    // D — Company Setup's own sign-in also counts, revealing Operations too — same one real account
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
    check("D signing in via Company Setup also reveals Operations in the sidebar", await page.isVisible("#gatedNav"));

    await page.click('.op-item:has-text("Employee Add")');
    check("D and Operations works directly — same one real account", (await page.locator("#countInput").count()) === 1);
    check("D no page errors", errs.length === 0, errs.join(" | "));
    await page.close();
  }

  await browser.close();
  report("Tiered Access", state, []);
})();
