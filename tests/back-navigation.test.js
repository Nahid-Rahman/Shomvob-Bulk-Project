/* Browser Back/Forward — end-to-end against the built index.html.
 *
 * Added 2026-09-25, direct request: "amader proper back function nai.
 * kono page e gele je arek jaygay properly back korbo eta nai" (there's
 * no proper way to go back to where you were). This app never touched
 * the History API before — every top-level page swap was pure in-memory
 * state (currentOp), so the browser's own Back button had nothing to go
 * back to. navigateTo() (app.js) is now the one place every top-level
 * page change goes through; see its own comment for the full mechanism.
 *
 * Every assertion maps to a rule in CLAUDE.md; if one fails, check there
 * before changing the test.
 */
const { chromium } = require("playwright");
const { PAGE, makeChecker, report, signIn, mockToolSignIn, goToOp, watchPageErrors } = require("./lib");

const { check, state } = makeChecker();

(async () => {
  const browser = await chromium.launch();

  {
    // A — Back/Forward moves between real pages, not just to the joke gate or nowhere
    const page = await browser.newContext().then((c) => c.newPage());
    const errs = watchPageErrors(page);
    await page.goto(PAGE);
    await signIn(page);
    await mockToolSignIn(page);

    await goToOp(page, "Employee Add");
    check("A on Employee Add", (await page.locator("#countInput").count()) === 1);

    await page.click('.op-item:has-text("Employee Attendance Add")');
    await page.waitForSelector("#fromDate");
    check("A on Attendance Add", (await page.locator("#fromDate").count()) === 1);

    await page.goBack();
    await page.waitForTimeout(200);
    check("A Back returns to Employee Add", (await page.locator("#countInput").count()) === 1);

    await page.goForward();
    await page.waitForSelector("#fromDate");
    check("A Forward returns to Attendance Add", (await page.locator("#fromDate").count()) === 1);
    check("A no page errors", errs.length === 0, errs.join(" | "));
    await page.close();
  }

  {
    // B — signing in through the operations gate replaces that history entry,
    // so Back from the requested operation skips the gate and lands on
    // whatever page was open before the gate interrupted it
    const page = await browser.newContext().then((c) => c.newPage());
    const errs = watchPageErrors(page);
    await page.goto(PAGE);
    await signIn(page);
    await mockToolSignIn(page);

    check("B starts on the Dashboard", await page.isVisible(".welcome-title"));
    // sidebar is hidden pre-signin -- go through the sticky bar's own gate
    await page.click("#welcomeLoginBtn");
    await page.waitForSelector("#opGateEmail");
    await page.fill("#opGateEmail", "someone@shomvob.com");
    await page.fill("#opGatePass", "whatever");
    await page.click("#opGateSignInBtn");
    await page.waitForSelector(".sidebar");
    check("B sign-in with no pending operation lands back on the Dashboard", await page.isVisible(".welcome-title"));

    await page.click('.op-item:has-text("Employee Add")');
    await page.waitForSelector("#countInput");

    await page.goBack();
    await page.waitForTimeout(200);
    check("B Back skips the (replaced) gate entry and lands on the Dashboard directly",
      await page.isVisible(".welcome-title") && (await page.locator("#opGateSignInBtn").count()) === 0);
    check("B no page errors", errs.length === 0, errs.join(" | "));
    await page.close();
  }

  {
    // C — Back into a stale "already signed in" history entry, after a real
    // sign-out, re-shows the real sign-in gate rather than the operation
    // itself -- a popstate can't be allowed to bypass goToOperation()'s own
    // gate check just because an old history entry predates the sign-out
    const page = await browser.newContext().then((c) => c.newPage());
    const errs = watchPageErrors(page);
    await page.goto(PAGE);
    await signIn(page);
    await mockToolSignIn(page);

    await goToOp(page, "Employee Add");
    await page.click('.op-item:has-text("Employee Attendance Add")');
    await page.waitForTimeout(150);

    // a real sign-out clears the persisted session and reloads
    await page.evaluate(() => sessionStorage.clear());
    await page.reload();
    await signIn(page);

    await page.goBack();
    await page.waitForTimeout(250);
    check("C Back into a stale signed-in operation entry re-shows the real gate",
      (await page.locator("#opGateSignInBtn").count()) === 1);
    check("C the operation's own form is not shown directly", (await page.locator("#countInput").count()) === 0);
    check("C no page errors", errs.length === 0, errs.join(" | "));
    await page.close();
  }

  await browser.close();
  report("Back Navigation", state, []);
})();
