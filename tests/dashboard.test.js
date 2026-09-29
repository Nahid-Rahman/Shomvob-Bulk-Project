/* The post-login Dashboard — end-to-end against the built index.html.
 *
 * Built 2026-09-29, TODO.md's last remaining Tiered Access step. Confirmed
 * content, in order: the Bulk/Settings routing cards (lock icons for
 * whatever the signed-in user's real tier excludes), real per-operation
 * usage — a donut for Bulk runs, real axis bar charts for Entries created
 * and Time saved, each with its own independent time-range filter (revised
 * the same day: an earlier shared single filter + plain data table were
 * both dropped — "every graph e filter lagao," direct request, confirmed
 * to mean one filter per chart, not one filter for the whole section) — a
 * combined estimated-impact comparison (explicitly labelled "Estimated",
 * pinned to All time, no filter of its own — it reads as a cumulative
 * claim), and a low-emphasis "what we offer" service-card strip at the
 * very bottom.
 *
 * A real sign-in with no pending operation now lands here, not on the
 * Welcome page (see back-navigation.test.js/tiered-access.test.js for
 * the knock-on fixes that required).
 *
 * Every assertion maps to a rule in CLAUDE.md; if one fails, check there
 * before changing the test.
 */
const { chromium } = require("playwright");
const { PAGE, makeChecker, report, signIn, mockToolSignIn, watchPageErrors, mockPublicStats } = require("./lib");

const { check, state } = makeChecker();

function mockDashboardStats(page, bulkRows) {
  const sinceTsLog = [];
  return {
    sinceTsLog,
    ready: page.route("**/rest/v1/rpc/dashboard_bulk_stats", (route) => {
      sinceTsLog.push(route.request().postDataJSON().since_ts);
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(bulkRows) });
    }),
  };
}

async function signInToDashboard(page) {
  await page.click("#welcomeLoginBtn");
  await page.waitForSelector("#opGateEmail");
  await page.fill("#opGateEmail", "someone@shomvob.com");
  await page.fill("#opGatePass", "whatever");
  await page.click("#opGateSignInBtn");
  await page.waitForSelector(".dashboard-route-row");
}

(async () => {
  const browser = await chromium.launch();

  {
    // A — a real sign-in with no pending operation lands here; both
    // routing cards render enabled for a "both"-tier account, and the
    // three charts show real per-operation numbers, computed from the
    // dictated per-50-entries basis scaled to the real entry count.
    const page = await browser.newContext().then((c) => c.newPage());
    const errs = watchPageErrors(page);
    await mockPublicStats(page);
    await page.goto(PAGE);
    await signIn(page);
    await mockToolSignIn(page);
    const { ready } = mockDashboardStats(page, [
      { module_id: "employee_add", generate_count: 4, total_entries: 100 },
      { module_id: "assets_add", generate_count: 1, total_entries: 25 },
    ]);
    await ready;

    await signInToDashboard(page);
    await page.waitForSelector(".dashboard-donut-legend-row");
    check("A both routing cards render, neither locked",
      (await page.locator(".dashboard-route-card").count()) === 2 &&
      (await page.locator(".dashboard-route-card .dashboard-locked-pill").count()) === 0);

    check("A no table left in Real usage — replaced by charts", (await page.locator(".preview-table").count()) === 0);
    check("A three chart cards render", (await page.locator(".dashboard-chart-card").count()) === 3);
    check("A one donut + two bar charts render", (await page.locator(".dashboard-donut-body").count()) === 1 && (await page.locator(".dashboard-bar-chart").count()) === 2);

    const donutText = await page.locator(".dashboard-chart-card").first().textContent();
    check("A donut shows the real total runs (5)", donutText.includes("5"));
    check("A donut legend names Employee Add", donutText.includes("Employee Add"));

    const entriesCardText = await page.locator(".dashboard-chart-card").nth(1).textContent();
    check("A entries chart's axis/values show the real max (100)", entriesCardText.includes("100"));

    check("A the estimated-impact box is labelled as an estimate",
      (await page.textContent(".numbers-addup-title")) === "Estimated impact so far");
    check("A the impact box is scoped to all time, no filter of its own", (await page.locator(".numbers-addup-box select").count()) === 0);
    check("A no page errors", errs.length === 0, errs.join(" | "));
    await page.close();
  }

  {
    // B — a "company"-tier account sees the Bulk card locked; clicking
    // Settings still navigates to Company Setup directly.
    const page = await browser.newContext().then((c) => c.newPage());
    const errs = watchPageErrors(page);
    await mockPublicStats(page);
    await page.goto(PAGE);
    await signIn(page);
    await mockToolSignIn(page);
    await page.route("**/rest/v1/rpc/my_tier", (route) => route.fulfill({ status: 200, contentType: "application/json", body: '"company"' }));
    mockDashboardStats(page, []);

    await signInToDashboard(page);
    check("B Bulk card is locked", await page.locator('.dashboard-route-card[data-target="bulk"]').isDisabled());
    check("B Bulk card names why it's locked",
      (await page.locator('.dashboard-route-card[data-target="bulk"] .dashboard-locked-pill').textContent()).trim() === "Locked");
    check("B Settings card stays enabled", !(await page.locator('.dashboard-route-card[data-target="settings"]').isDisabled()));

    await page.click('.dashboard-route-card[data-target="settings"]');
    await page.waitForSelector('.section-title:has-text("Sign in as the company")');
    check("B Settings card routes straight to Company Setup", (await page.locator('.section-title:has-text("Sign in as the company")').count()) === 1);
    check("B no page errors", errs.length === 0, errs.join(" | "));
    await page.close();
  }

  {
    // C — a "bulk"-tier account sees Settings locked; the Bulk card
    // routes to the first real operation.
    const page = await browser.newContext().then((c) => c.newPage());
    const errs = watchPageErrors(page);
    await mockPublicStats(page);
    await page.goto(PAGE);
    await signIn(page);
    await mockToolSignIn(page);
    await page.route("**/rest/v1/rpc/my_tier", (route) => route.fulfill({ status: 200, contentType: "application/json", body: '"bulk"' }));
    mockDashboardStats(page, []);

    await signInToDashboard(page);
    check("C Settings card is locked", await page.locator('.dashboard-route-card[data-target="settings"]').isDisabled());
    check("C Bulk card stays enabled", !(await page.locator('.dashboard-route-card[data-target="bulk"]').isDisabled()));

    await page.click('.dashboard-route-card[data-target="bulk"]');
    await page.waitForSelector("#countInput");
    check("C Bulk card routes to the first real operation (Employee Add)", (await page.locator("#countInput").count()) === 1);
    check("C no page errors", errs.length === 0, errs.join(" | "));
    await page.close();
  }

  {
    // D — every chart's own filter is independent: each defaults to
    // "All time", and changing just one chart's own select re-fetches
    // only that chart, with a different since_ts, leaving the others'
    // last-sent since_ts untouched.
    const page = await browser.newContext().then((c) => c.newPage());
    const errs = watchPageErrors(page);
    await mockPublicStats(page);
    await page.goto(PAGE);
    await signIn(page);
    await mockToolSignIn(page);
    const { sinceTsLog } = mockDashboardStats(page, []);

    await signInToDashboard(page);
    await page.waitForSelector(".dashboard-chart-range");
    await page.waitForTimeout(300); // let all 4 initial-load requests (3 charts + impact) settle
    const selects = page.locator(".dashboard-chart-range");
    check("D three independent filters, one per chart", (await selects.count()) === 3);
    const values = await selects.evaluateAll((els) => els.map((el) => el.value));
    check("D every chart defaults to All time", values.every((v) => v === "all"), values.join(","));

    const beforeCount = sinceTsLog.length;
    check("D four requests fire on initial load (3 charts + the impact box)", beforeCount === 4, String(beforeCount));

    // Change only the "entries" chart's own filter.
    const entriesSelect = page.locator('.dashboard-chart-range[data-chart-key="entries"]');
    await entriesSelect.selectOption("week");
    await page.waitForTimeout(300);
    check("D exactly one new request fired for the changed chart", sinceTsLog.length === beforeCount + 1, String(sinceTsLog.length));
    const daysAgo = (Date.now() - new Date(sinceTsLog[sinceTsLog.length - 1]).getTime()) / (24 * 3600 * 1000);
    check("D that request's since_ts is ~7 days old, not the epoch", daysAgo > 6 && daysAgo < 8, String(daysAgo));
    check("D no page errors", errs.length === 0, errs.join(" | "));
    await page.close();
  }

  {
    // E — the "what we offer & FAQ" strip lists every real Bulk operation
    // plus one combined Settings card (not one per settings group), and
    // sits after the real-usage charts, not before it.
    const page = await browser.newContext().then((c) => c.newPage());
    const errs = watchPageErrors(page);
    await mockPublicStats(page);
    await page.goto(PAGE);
    await signIn(page);
    await mockToolSignIn(page);
    mockDashboardStats(page, []);

    await signInToDashboard(page);
    await page.waitForSelector(".dashboard-service-card");
    check("E lists 5 Bulk operations + 1 combined Settings card (6 total)", (await page.locator(".dashboard-service-card").count()) === 6);
    const order = await page.evaluate(() => {
      const usage = document.querySelector(".dashboard-chart-row");
      const strip = document.querySelector(".dashboard-service-strip");
      return usage.compareDocumentPosition(strip) & Node.DOCUMENT_POSITION_FOLLOWING ? "after" : "before";
    });
    check("E the service strip sits after the charts, not before them", order === "after");
    check("E no page errors", errs.length === 0, errs.join(" | "));
    await page.close();
  }

  await browser.close();
  report("Dashboard", state, []);
})();
