/* "What we offer & FAQ" — end-to-end against the built index.html.
 *
 * Built 2026-09-29, direct request: the Dashboard's own low-emphasis
 * "What we offer" strip is renamed and its cards become real links — a
 * click opens a new page naming that operation's actual, real generation
 * logic (every column's own rule), or, for Settings, a combined overview
 * covering all six real groups at once rather than one card per group.
 * The page is also reachable from its own sidebar item, sitting below
 * every other section and above Log out.
 *
 * Every assertion maps to a rule in CLAUDE.md; if one fails, check there
 * before changing the test.
 */
const { chromium } = require("playwright");
const { PAGE, makeChecker, report, signIn, mockToolSignIn, watchPageErrors, mockPublicStats, goToOp } = require("./lib");

const { check, state } = makeChecker();

(async () => {
  const browser = await chromium.launch();

  {
    // A — the sidebar's own "What we offer & FAQ" item opens the card
    // index: 5 real Bulk operations + exactly one combined Settings card.
    const page = await browser.newContext().then((c) => c.newPage());
    const errs = watchPageErrors(page);
    await mockPublicStats(page);
    await page.goto(PAGE);
    await signIn(page);
    await mockToolSignIn(page);

    await goToOp(page, "What we offer & FAQ");
    await page.waitForSelector(".dashboard-service-card");
    check("A shows exactly 6 cards (5 operations + 1 combined Settings)", (await page.locator(".dashboard-service-card").count()) === 6);
    const labels = await page.locator(".dashboard-service-title").allTextContents();
    check("A names every real Bulk operation", ["Employee Add", "Employee Attendance Add", "Leave Balance Add", "Payroll Custom Field Add", "Assets Add"].every((l) => labels.includes(l)));
    check("A Settings is one combined card, not six", labels.filter((l) => l === "Settings").length === 1 && !labels.some((l) => l.includes("Company Settings") || l.includes("Payroll Settings")));
    check("A no page errors", errs.length === 0, errs.join(" | "));
    await page.close();
  }

  {
    // B — clicking a real operation's card shows its own real column
    // rules, and "<- Back" returns to the index.
    const page = await browser.newContext().then((c) => c.newPage());
    const errs = watchPageErrors(page);
    await mockPublicStats(page);
    await page.goto(PAGE);
    await signIn(page);
    await mockToolSignIn(page);

    await goToOp(page, "What we offer & FAQ");
    await page.waitForSelector(".dashboard-service-card");
    await page.click('.dashboard-service-card[data-faq-id="employee_add"]');
    await page.waitForSelector("#faqBackLink");
    const text = await page.textContent("#mainContent");
    check("B shows the real topic title", text.includes("Employee Add"));
    check("B names a real column rule (Employee ID)", text.includes("PREFIX0001"));
    check("B names another real column rule (Joining Date weighting)", text.includes("60%") && text.includes("previous year"));
    check("B renders a real column/rule table, not prose", (await page.locator(".preview-table").count()) === 1);

    await page.click("#faqBackLink");
    await page.waitForSelector(".dashboard-service-card");
    check("B Back returns to the 6-card index", (await page.locator(".dashboard-service-card").count()) === 6);
    check("B no page errors", errs.length === 0, errs.join(" | "));
    await page.close();
  }

  {
    // C — the combined Settings card shows a real overview, not a table
    // (Settings has no per-column rules the way an operation does).
    const page = await browser.newContext().then((c) => c.newPage());
    const errs = watchPageErrors(page);
    await mockPublicStats(page);
    await page.goto(PAGE);
    await signIn(page);
    await mockToolSignIn(page);

    await goToOp(page, "What we offer & FAQ");
    await page.waitForSelector(".dashboard-service-card");
    await page.click('.dashboard-service-card[data-faq-id="settings"]');
    await page.waitForSelector("#faqBackLink");
    const text = await page.textContent("#mainContent");
    check("C shows the real topic title", text.includes("Settings"));
    check("C mentions the real six settings groups", text.includes("Schedule Management") && text.includes("Payroll"));
    check("C mentions the real Run defaults shortcut", text.includes("Run defaults"));
    check("C renders prose, not a column/rule table", (await page.locator(".preview-table").count()) === 0);
    check("C no page errors", errs.length === 0, errs.join(" | "));
    await page.close();
  }

  {
    // D — clicking a card from the Dashboard's own strip opens the exact
    // same FAQ page and topic, not a separate content system.
    const page = await browser.newContext().then((c) => c.newPage());
    const errs = watchPageErrors(page);
    await mockPublicStats(page);
    await page.goto(PAGE);
    await signIn(page);
    await mockToolSignIn(page);
    await page.route("**/rest/v1/rpc/dashboard_bulk_stats", (route) => route.fulfill({ status: 200, contentType: "application/json", body: "[]" }));

    await page.click("#welcomeLoginBtn");
    await page.fill("#opGateEmail", "test@example.com");
    await page.fill("#opGatePass", "whatever");
    await page.click("#opGateSignInBtn");
    await page.waitForSelector(".dashboard-route-row");
    await page.waitForSelector(".dashboard-service-card");
    await page.click('.dashboard-service-card[data-faq-id="assets_add"]');
    await page.waitForSelector("#faqBackLink");
    const text = await page.textContent("#mainContent");
    check("D the Dashboard's own card opens the real Assets Add topic", text.includes("Assets Add") && text.includes("Asset Code"));
    check("D no page errors", errs.length === 0, errs.join(" | "));
    await page.close();
  }

  {
    // E — the sidebar item sits on its own, below every other nav
    // section and above Log out, not inside the scrollable Operations
    // list.
    const page = await browser.newContext().then((c) => c.newPage());
    const errs = watchPageErrors(page);
    await mockPublicStats(page);
    await page.goto(PAGE);
    await signIn(page);
    await mockToolSignIn(page);
    await goToOp(page, "What we offer & FAQ");
    await page.waitForSelector(".dashboard-service-card");

    const order = await page.evaluate(() => {
      const nav = document.getElementById("opNav");
      const faqNav = document.getElementById("faqNav");
      const foot = document.querySelector(".sidebar-foot");
      const navBeforeFaq = nav.compareDocumentPosition(faqNav) & Node.DOCUMENT_POSITION_FOLLOWING;
      const faqBeforeFoot = faqNav.compareDocumentPosition(foot) & Node.DOCUMENT_POSITION_FOLLOWING;
      return !!navBeforeFaq && !!faqBeforeFoot;
    });
    check("E FAQ's sidebar item sits after Operations and before Log out", order);
    check("E the sidebar shows a plain 'What we offer & FAQ' item", (await page.locator("#faqNav .op-item").count()) === 1);
    check("E no page errors", errs.length === 0, errs.join(" | "));
    await page.close();
  }

  await browser.close();
  report("FAQ", state, []);
})();
