/* The post-login Dashboard — end-to-end against the built index.html.
 *
 * Built 2026-09-29, TODO.md's last remaining Tiered Access step. Confirmed
 * content, in order: the Bulk/Settings routing cards (lock icons for
 * whatever the signed-in user's real tier excludes), real per-operation
 * usage (bulk runs/entries created/time saved, pulled from
 * dashboard_bulk_stats()), a combined estimated-impact comparison
 * (explicitly labelled "Estimated" — the per-entry basis is the dictated
 * OPERATION_TIME_COMPARISON figures, not a measured rate), a Settings row
 * that's deliberately just a real count with no time figure, and a
 * low-emphasis "what we offer" service-card strip at the very bottom.
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

function mockDashboardStats(page, bulkRows, settingsCount) {
  return Promise.all([
    page.route("**/rest/v1/rpc/dashboard_bulk_stats", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(bulkRows) })
    ),
    page.route("**/rest/v1/rpc/dashboard_settings_save_count", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(settingsCount) })
    ),
  ]);
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
    // real usage table shows real per-operation numbers, computed from
    // the dictated per-50-entries basis scaled to the real entry count.
    const page = await browser.newContext().then((c) => c.newPage());
    const errs = watchPageErrors(page);
    await mockPublicStats(page);
    await page.goto(PAGE);
    await signIn(page);
    await mockToolSignIn(page);
    await mockDashboardStats(page, [
      { module_id: "employee_add", generate_count: 4, total_entries: 100 },
      { module_id: "assets_add", generate_count: 1, total_entries: 25 },
    ], 7);

    await signInToDashboard(page);
    check("A both routing cards render, neither locked",
      (await page.locator(".dashboard-route-card").count()) === 2 &&
      (await page.locator(".dashboard-route-card .dashboard-locked-pill").count()) === 0);

    await page.waitForSelector(".preview-table td.strong");
    const rowText = await page.locator(".preview-table tbody tr", { hasText: "Employee Add" }).textContent();
    check("A Employee Add's real bulk-run count shows", rowText.includes("4"));
    check("A Employee Add's real entries-created count shows", rowText.includes("100"));

    const settingsRow = await page.locator(".preview-table tbody tr", { hasText: "Settings" }).textContent();
    check("A Settings shows a real count, not a time figure", settingsRow.includes("7") && settingsRow.includes("real saves") && settingsRow.includes("—"));

    check("A the estimated-impact box is labelled as an estimate",
      (await page.textContent(".numbers-addup-title")) === "Estimated impact so far");
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
    await mockDashboardStats(page, [], 0);

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
    await mockDashboardStats(page, [], 0);

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
    // D — the time-range filter re-fetches with a different since_ts,
    // and defaults to "All time" on first load.
    const page = await browser.newContext().then((c) => c.newPage());
    const errs = watchPageErrors(page);
    let lastSinceTs = "unset";
    await mockPublicStats(page);
    await page.goto(PAGE);
    await signIn(page);
    await mockToolSignIn(page);
    await page.route("**/rest/v1/rpc/dashboard_bulk_stats", (route) => {
      lastSinceTs = route.request().postDataJSON().since_ts;
      route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
    });
    await page.route("**/rest/v1/rpc/dashboard_settings_save_count", (route) => route.fulfill({ status: 200, contentType: "application/json", body: "0" }));

    await signInToDashboard(page);
    await page.waitForSelector("#dashRangeSelect");
    check("D defaults to All time", await page.locator("#dashRangeSelect").inputValue() === "all");
    check("D All time sends the epoch as since_ts", lastSinceTs === "1970-01-01T00:00:00.000Z" || lastSinceTs.startsWith("1970-01-01"), lastSinceTs);

    await page.selectOption("#dashRangeSelect", "week");
    await page.waitForTimeout(300);
    const daysAgo = (Date.now() - new Date(lastSinceTs).getTime()) / (24 * 3600 * 1000);
    check("D switching to This week sends a ~7-day-old since_ts, not the epoch", daysAgo > 6 && daysAgo < 8, String(daysAgo));
    check("D no page errors", errs.length === 0, errs.join(" | "));
    await page.close();
  }

  {
    // E — the "what we offer" strip lists every real Bulk operation and
    // Settings group, and sits after the real-usage section, not before it.
    const page = await browser.newContext().then((c) => c.newPage());
    const errs = watchPageErrors(page);
    await mockPublicStats(page);
    await page.goto(PAGE);
    await signIn(page);
    await mockToolSignIn(page);
    await mockDashboardStats(page, [], 0);

    await signInToDashboard(page);
    await page.waitForSelector(".dashboard-service-card");
    check("E lists all 5 Bulk operations + 6 Settings groups", (await page.locator(".dashboard-service-card").count()) === 11);
    const order = await page.evaluate(() => {
      const usage = document.querySelector(".preview-table-wrap");
      const strip = document.querySelector(".dashboard-service-strip");
      return usage.compareDocumentPosition(strip) & Node.DOCUMENT_POSITION_FOLLOWING ? "after" : "before";
    });
    check("E the service strip sits after real usage, not before it", order === "after");
    check("E no page errors", errs.length === 0, errs.join(" | "));
    await page.close();
  }

  await browser.close();
  report("Dashboard", state, []);
})();
