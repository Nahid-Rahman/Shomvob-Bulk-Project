/* Preview access — end-to-end against the built index.html.
 *
 * Built 2026-10-06, direct request: a "work in progress" access level so
 * unfinished features (Attendance update, Report) can be tested live
 * without everyone seeing them. Testing-only: the code ships to every
 * browser, this just keeps the nav and routes hidden unless an admin
 * ticked Preview for the account (`user_access.preview`, read through the
 * my_preview() RPC, failing CLOSED).
 *
 * Every assertion maps to a rule in CLAUDE.md; if one fails, check
 * there before changing the test.
 */
const { chromium } = require("playwright");
const { PAGE, makeChecker, report, signIn, watchPageErrors, mockToolSignIn, mockPublicStats } = require("./lib");

const { check, state } = makeChecker();

async function signInForReal(page, email) {
  await page.click("#welcomeLoginBtn");
  await page.waitForSelector("#opGateEmail");
  await page.fill("#opGateEmail", email);
  await page.fill("#opGatePass", "whatever");
  await page.click("#opGateSignInBtn");
  await page.waitForSelector(".sidebar");
  await page.waitForTimeout(250);
}

async function freshPage(browser, { previewResponse }) {
  const page = await browser.newContext().then((c) => c.newPage());
  const errs = watchPageErrors(page);
  await mockPublicStats(page);
  await page.goto(PAGE);
  await signIn(page);
  await mockToolSignIn(page);
  await page.route("**/rest/v1/rpc/is_admin", (route) => route.fulfill({ status: 200, contentType: "application/json", body: "false" }));
  // Registered after mockToolSignIn()'s default, so this one wins.
  await page.route("**/rest/v1/rpc/my_preview", (route) => route.fulfill(previewResponse));
  return { page, errs };
}

const YES = { status: 200, contentType: "application/json", body: "true" };
const NO = { status: 200, contentType: "application/json", body: "false" };
const BROKEN = { status: 404, contentType: "application/json", body: JSON.stringify({ message: "function not found" }) };

(async () => {
  const browser = await chromium.launch();

  {
    // A — an account without the flag never sees Preview at all
    const { page, errs } = await freshPage(browser, { previewResponse: NO });
    await signInForReal(page, "someone@shomvob.com");
    check("A the Preview nav label is hidden", !(await page.isVisible("#previewNavLabel")));
    check("A no Preview nav items exist", (await page.locator("#previewNav .op-item").count()) === 0);
    check("A no page errors", errs.length === 0, errs.join(" | "));
    await page.close();
  }

  {
    // A2 — if my_preview() fails (RPC missing, network), Preview stays
    // hidden: fail closed, unlike my_tier()'s fail-open
    const { page, errs } = await freshPage(browser, { previewResponse: BROKEN });
    await signInForReal(page, "someone@shomvob.com");
    check("A2 a failing my_preview() hides Preview", (await page.locator("#previewNav .op-item").count()) === 0);
    check("A2 no page errors", errs.length === 0, errs.join(" | "));
    await page.close();
  }

  {
    // B — an account with the flag sees both entries, each tagged WIP,
    // and each opens its own placeholder page
    const { page, errs } = await freshPage(browser, { previewResponse: YES });
    await signInForReal(page, "tester@shomvob.com");
    check("B the Preview nav label shows", await page.isVisible("#previewNavLabel"));
    const labels = await page.locator("#previewNav .op-item").allTextContents();
    check("B both entries are listed, Attendance update then Report",
      labels.length === 2 && labels[0].includes("Attendance update") && labels[1].includes("Report"), JSON.stringify(labels));
    check("B each entry carries a WIP pill", (await page.locator("#previewNav .pill-soon:has-text('WIP')").count()) === 2);

    await page.click('#previewNav .op-item:has-text("Report")');
    await page.waitForSelector(".page-eyebrow");
    check("B Report opens a Preview page titled Report",
      (await page.textContent(".page-eyebrow")).trim() === "Preview" && (await page.textContent(".page-title")).trim() === "Report");
    check("B the sticky generate bar is hidden on a Preview page", !(await page.isVisible("#actionBar")));
    check("B the clicked entry is the current nav item",
      (await page.getAttribute('#previewNav .op-item:has-text("Report")', "aria-current")) === "true");

    await page.click('#previewNav .op-item:has-text("Attendance update")');
    await page.waitForTimeout(100);
    check("B Attendance update opens its own page", (await page.textContent(".page-title")).trim() === "Attendance update");

    // Back/Forward still works between Preview pages
    await page.goBack();
    await page.waitForTimeout(100);
    check("B Back returns to the Report page", (await page.textContent(".page-title")).trim() === "Report");
    check("B no page errors", errs.length === 0, errs.join(" | "));
    await page.close();
  }

  {
    // C — a stale history entry pointing at a Preview page must not land
    // there for an account without the flag
    const { page, errs } = await freshPage(browser, { previewResponse: NO });
    await signInForReal(page, "someone@shomvob.com");
    await page.evaluate(() => {
      history.pushState({ op: "preview_report" }, "", location.href);
      history.pushState({ op: "dashboard" }, "", location.href);
      history.back();
    });
    await page.waitForTimeout(200);
    check("C Back onto a Preview entry without the flag shows no Preview page",
      !(await page.locator("#mainContent:has-text('Work in progress')").count()));
    check("C it lands on the Dashboard instead", (await page.locator("#mainContent:has-text('Get started')").count()) > 0);
    check("C no page errors", errs.length === 0, errs.join(" | "));
    await page.close();
  }

  await browser.close();
  report("Preview access", state, []);
})();
