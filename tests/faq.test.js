/* "What we offer & FAQ" — end-to-end against the built index.html.
 *
 * Built 2026-09-29 as a card index + a single detail view per card;
 * redesigned 2026-09-30 into a two-level shell, direct request against
 * an Excel mockup: a Bulk Operation/Settings toggle up top (default
 * Bulk), an individual-item list on the left for whichever category is
 * selected, and the first item's own detail open by default on the
 * right. The Dashboard's own card strip is unchanged — still exactly 6
 * cards (5 Bulk operations + 1 combined Settings) — clicking one still
 * opens the same dedicated page, just landing on this new shell with
 * that card's own category/topic preselected instead of a standalone
 * detail view with its own "<- Back" link.
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
    // A — the sidebar's own "What we offer & FAQ" item opens the shell
    // on Bulk Operation by default, with all 5 real operations listed
    // and the first one's own detail already open.
    const page = await browser.newContext().then((c) => c.newPage());
    const errs = watchPageErrors(page);
    await mockPublicStats(page);
    await page.goto(PAGE);
    await signIn(page);
    await mockToolSignIn(page);

    await goToOp(page, "What we offer & FAQ");
    await page.waitForSelector(".faq-nav-item");
    check("A Bulk Operation is selected by default", await page.locator('#faqCategorySeg button[data-cat="bulk"]').getAttribute("aria-pressed") === "true");
    check("A lists all 5 real Bulk operations", (await page.locator(".faq-nav-item").count()) === 5);
    const labels = await page.locator(".faq-nav-item").allTextContents();
    check("A names every real Bulk operation", ["Employee Add", "Employee Attendance Add", "Leave Balance Add", "Payroll Custom Field Add", "Assets Add"].every((l) => labels.includes(l)));
    check("A the first item is already open by default", (await page.locator(".faq-nav-item.active").textContent()) === "Employee Add");
    const text = await page.textContent("#faqDetailPanel");
    check("A the detail panel shows the first item's real rules without a click", text.includes("PREFIX0001"));
    check("A no page errors", errs.length === 0, errs.join(" | "));
    await page.close();
  }

  {
    // B — clicking another item in the list swaps the detail panel in
    // place, no separate index/back-link round trip.
    const page = await browser.newContext().then((c) => c.newPage());
    const errs = watchPageErrors(page);
    await mockPublicStats(page);
    await page.goto(PAGE);
    await signIn(page);
    await mockToolSignIn(page);

    await goToOp(page, "What we offer & FAQ");
    await page.waitForSelector(".faq-nav-item");
    await page.click('.faq-nav-item[data-faq-topic="assets_add"]');
    const text = await page.textContent("#faqDetailPanel");
    check("B shows the real topic title", text.includes("Assets Add"));
    check("B names a real column rule (Asset Code)", text.includes("Asset Code") && text.includes("0001"));
    check("B renders a real column/rule table, not prose", (await page.locator(".preview-table").count()) === 1);
    check("B the clicked item is now the active one", (await page.locator(".faq-nav-item.active").textContent()) === "Assets Add");
    check("B no page errors", errs.length === 0, errs.join(" | "));
    await page.close();
  }

  {
    // C — switching the toggle to Settings swaps the left list to the
    // real 6 SETTINGS_GROUPS, first one open by default, with a real
    // per-field table (2026-09-30 — Settings got the same field-by-field
    // depth Bulk operations already have, not just module names).
    const page = await browser.newContext().then((c) => c.newPage());
    const errs = watchPageErrors(page);
    await mockPublicStats(page);
    await page.goto(PAGE);
    await signIn(page);
    await mockToolSignIn(page);

    await goToOp(page, "What we offer & FAQ");
    await page.waitForSelector(".faq-nav-item");
    await page.click('#faqCategorySeg button[data-cat="settings"]');
    check("C Settings is now the pressed toggle", await page.locator('#faqCategorySeg button[data-cat="settings"]').getAttribute("aria-pressed") === "true");
    check("C lists all 6 real settings groups", (await page.locator(".faq-nav-item").count()) === 6);
    const labels = await page.locator(".faq-nav-item").allTextContents();
    check("C names every real settings group", ["Company Settings", "Employee Settings", "Attendance Settings", "Schedule Management", "Leave Settings", "Payroll Settings"].every((l) => labels.includes(l)));
    check("C the first group is already open by default", (await page.locator(".faq-nav-item.active").textContent()) === "Company Settings");
    const text = await page.textContent("#faqDetailPanel");
    check("C names that group's own real modules", text.includes("Company Profile") && text.includes("Bank Info"));
    check("C mentions the real Run defaults shortcut", text.includes("Run defaults"));
    check("C now renders a real field table too, not just prose", (await page.locator(".preview-table").count()) === 1);
    check("C the table names a real field (Legal Name)", (await page.locator(".preview-table").textContent()).includes("Legal Name"));
    check("C no page errors", errs.length === 0, errs.join(" | "));
    await page.close();
  }

  {
    // D — clicking a card from the Dashboard's own strip opens the exact
    // same shell, landing on that card's own category/topic preselected.
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
    check("D Dashboard's own strip still shows exactly 6 cards", (await page.locator(".dashboard-service-card").count()) === 6);
    await page.click('.dashboard-service-card[data-faq-id="assets_add"]');
    await page.waitForSelector(".faq-nav-item");
    const text = await page.textContent("#faqDetailPanel");
    check("D the Dashboard's own card opens the real Assets Add topic, preselected", text.includes("Assets Add") && text.includes("Asset Code"));
    check("D lands on the Bulk Operation side", await page.locator('#faqCategorySeg button[data-cat="bulk"]').getAttribute("aria-pressed") === "true");

    await page.click('.op-item:has-text("Dashboard")');
    await page.waitForSelector(".dashboard-service-card");
    await page.click('.dashboard-service-card[data-faq-id="settings"]');
    await page.waitForSelector(".faq-nav-item");
    check("D the Dashboard's Settings card lands on the Settings side, first group preselected", await page.locator('#faqCategorySeg button[data-cat="settings"]').getAttribute("aria-pressed") === "true");
    check("D that first group is Company Settings", (await page.locator(".faq-nav-item.active").textContent()) === "Company Settings");
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
    await page.waitForSelector(".faq-nav-item");

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

  {
    // F — reopening the sidebar item after having drilled into Settings
    // resets back to Bulk Operation, not wherever it was left.
    const page = await browser.newContext().then((c) => c.newPage());
    const errs = watchPageErrors(page);
    await mockPublicStats(page);
    await page.goto(PAGE);
    await signIn(page);
    await mockToolSignIn(page);

    await goToOp(page, "What we offer & FAQ");
    await page.waitForSelector(".faq-nav-item");
    await page.click('#faqCategorySeg button[data-cat="settings"]');
    await page.waitForSelector('.faq-nav-item[data-faq-topic="payroll"]');
    await page.click('.faq-nav-item[data-faq-topic="payroll"]');

    // navigate away, then back to FAQ via the sidebar
    await page.click('.op-item:has-text("Dashboard")');
    await page.waitForSelector(".dashboard-route-row");
    await page.click('#faqNav .op-item');
    await page.waitForSelector(".faq-nav-item");
    check("F reopening resets to Bulk Operation", await page.locator('#faqCategorySeg button[data-cat="bulk"]').getAttribute("aria-pressed") === "true");
    check("F reopening resets to the first Bulk item", (await page.locator(".faq-nav-item.active").textContent()) === "Employee Add");
    check("F no page errors", errs.length === 0, errs.join(" | "));
    await page.close();
  }

  await browser.close();
  report("FAQ", state, []);
})();
