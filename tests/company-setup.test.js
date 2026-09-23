/* Company Setup (phase 2) — end-to-end against the built index.html.
 *
 * Unlike the five generators, this page calls real, external servers — its
 * own Supabase project, then one of two real Shomvob environments. Neither
 * is something a test suite should depend on being reachable, so every
 * request here is intercepted with page.route() and answered with a
 * canned response. That mirrors how the other suites read back a
 * generated file rather than trusting that "it downloaded" means "it's
 * right" — same idea, applied to network calls instead of a workbook.
 *
 * A real, unmocked run against the live Supabase project (wrong password,
 * to check the error path) was done by hand while building this and is
 * not repeated here on purpose: a committed test should not depend on a
 * live account or on outbound network being available at all.
 *
 * Every assertion maps to a rule in SPEC.md; if one fails, check SPEC.md
 * before changing the test.
 */
const { chromium } = require("playwright");
const { PAGE, loadAppData, makeChecker, report, signIn, watchPageErrors } = require("./lib");

const { check, state } = makeChecker();
const { BUSY_MESSAGES } = loadAppData(["BUSY_MESSAGES"]);
const { BANK_NAMES, BANK_SHORT_CODE_MAP } = loadAppData(["BANK_NAMES", "BANK_SHORT_CODE_MAP"]);
const { OFFICE_NAMES, DEPARTMENT_NAMES, DESIGNATION_NAMES } = loadAppData(["OFFICE_NAMES", "DEPARTMENT_NAMES", "DESIGNATION_NAMES"]);
const { LOCATION_TYPE_NAMES } = loadAppData(["LOCATION_TYPE_NAMES"]);
const { CUSTOM_FIELD_PRESETS, REQUIRED_DOCUMENT_NAMES } = loadAppData(["CUSTOM_FIELD_PRESETS", "REQUIRED_DOCUMENT_NAMES"]);
const { DEFAULT_DEPARTMENTS } = loadAppData(["DEFAULT_DEPARTMENTS"]);
const { ROSTER_COLORS } = loadAppData(["ROSTER_COLORS"]);

async function gotoSetup(page) {
  await page.goto(PAGE);
  await signIn(page);
  await page.click('.op-item:has-text("Company Setup")');
  await page.waitForSelector("#setupSignInBtn");
}

function mockSupabaseOk(page) {
  return page.route("**/auth/v1/token**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ access_token: "fake-tool-token", refresh_token: "fake-refresh", user: { id: "u1" } }),
    })
  );
}
function mockSupabaseFail(page) {
  return page.route("**/auth/v1/token**", (route) =>
    route.fulfill({
      status: 400,
      contentType: "application/json",
      body: JSON.stringify({ error_description: "Invalid login credentials" }),
    })
  );
}
function mockCompanyOk(page, companyName, userType) {
  return page.route("**/auth/login", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        message: "Welcome back! You've logged in successfully.",
        data: {
          accessToken: "fake-company-token",
          refreshToken: "fake-company-refresh",
          user: { id: "e1", companyId: "c1", companyName, type: userType },
        },
      }),
    })
  );
}
function mockCompanyFail(page) {
  return page.route("**/auth/login", (route) =>
    route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ message: "Wrong email or password." }) })
  );
}
function mockCompanyUnreachable(page) {
  /* What a browser sees when a server hasn't been told to allow this
     origin: fetch throws, indistinguishable from a plain network failure. */
  return page.route("**/auth/login", (route) => route.abort("failed"));
}

const statusbar = (page) => page.textContent("#setupStatusBar").then((t) => t.replace(/\s+/g, " ").trim());

/* Both logins, mocked, landing on the group grid — the starting point for
   every check below the auth flow itself. */
async function toGrid(page, companyName = "Hogwarts") {
  await mockSupabaseOk(page);
  await mockCompanyOk(page, companyName, "company_admin");
  /* Default "nothing exists yet" for the three background/foreground
     existing-checks added 2026-09-12 (Leave Types, Department,
     Designation's own "Create the default(s)" shortcuts) — every test
     block below that cares about a specific existing/duplicate scenario
     registers its own page.route() for these same patterns afterward,
     which Playwright matches before this default. Without this, any
     test that opens one of these three tabs sends a real, unmocked GET
     that a headless browser's CORS policy blocks outright. */
  await page.route("**/api/v1/leave-types", (route) => {
    if (route.request().method() === "GET") route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success", data: [] }) });
    else route.continue();
  });
  await page.route("**/api/v1/departments/active", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success", data: [] }) })
  );
  await page.route("**/api/v1/designations/active**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success", data: [] }) })
  );
  /* Same default for Salary Components' own "Create the default 3"
     existing-check (2026-09-13) — GET with no query string, distinct
     from Configure Salary Components' own "?status=Active&limit=100"
     GET and from the bare POST that saves one. */
  await page.route("**/api/v1/payroll/configuration/salary-components?limit=100", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success", data: [] }) })
  );
  /* Same default for Bonus Types' own "Create the default 2" existing-
     check (2026-09-13) — this endpoint is GET-and-POST on the exact same
     URL, so the default has to branch on method rather than pick a
     distinct query string like Salary Components' does. */
  await page.route("**/api/v1/bonus/configuration/types", (route) => {
    if (route.request().method() === "GET") route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success", data: [] }) });
    else route.continue();
  });
  /* Same default for Company Profile's own "already has values" notice
     (2026-09-15) — every test opening this tab needs a default answer
     for its background GET, same reasoning as the four above; a real,
     unmocked request here is what a headless browser's CORS policy
     blocks outright, hanging the whole run instead of failing fast. */
  await page.route("**/api/v1/company-profile", (route) => {
    if (route.request().method() === "GET") route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success", message: "No company profile found", data: null }) });
    else route.continue();
  });
  /* Same default for Bank Info's own "already has values" notice
     (2026-09-15) — distinct URL from the real POST save
     (.../company-bank-informations/save), so no method branch needed. */
  await page.route("**/api/v1/company-bank-informations", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success", message: "Company bank information retrieved successfully", data: null }) })
  );
  /* Same defaults for Payroll General, Configure Salary Components, Tax
     and Attendance Policy's own "already has values" notices
     (2026-09-15) — each of these four also GETs its own real endpoint
     in the background the moment its tab first opens. */
  await page.route("**/api/v1/payroll/configuration/payroll-cycle", (route) => {
    if (route.request().method() === "GET") route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success", data: null }) });
    else route.continue();
  });
  await page.route("**/api/v1/payroll/configuration/non-paygrade-structure", (route) => {
    if (route.request().method() === "GET") route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success", data: {} }) });
    else route.continue();
  });
  await page.route("**/api/v1/payroll/configuration/tax-rules/list", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success", data: { rules: [], isEnabled: false } }) })
  );
  await page.route("**/api/v1/attendance/policies", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success", data: [] }) })
  );
  /* Same defaults for Location Types and Locations' own "N already
     exist" notices (2026-09-24) — wrapped as data.data.locationTypes/
     data.data.items for real, confirmed live against a real staging
     company, not a flat array (see fetchCompanyResource()'s own comment
     in app.js). Locations also GETs this same-named endpoint as its
     real dependency check on Location Types existing at all. */
  await page.route("**/api/v1/locations/location-types/paginated**", (route) => {
    if (route.request().method() === "GET") route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success", data: { locationTypes: [] } }) });
    else route.continue();
  });
  await page.route("**/api/v1/locations", (route) => {
    if (route.request().method() === "GET") route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success", data: { items: [] } }) });
    else route.continue();
  });
  /* Same defaults for Custom Fields, Required Documents and Custom
     Addition/Deduction's own "N already exist" notices (2026-09-15). */
  await page.route("**/api/v1/company-settings/employee-custom-fields/all", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success", data: [] }) })
  );
  await page.route("**/api/v1/required-documents", (route) => {
    if (route.request().method() === "GET") route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success", data: [] }) });
    else route.continue();
  });
  await page.route("**/api/v1/payroll/configuration/custom-fields/list", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success", data: { customFields: [], total: 0, maxAllowed: 10, remaining: 10 } }) })
  );
  /* Same defaults for Leave Policy and Bonus Policy's own "N already
     exist, named" notices (2026-09-15) — both share their save URL
     with this GET, so branch on method rather than assume nothing else
     ever calls it. */
  await page.route("**/api/v1/leave-policies", (route) => {
    if (route.request().method() === "GET") route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success", data: [] }) });
    else route.continue();
  });
  await page.route("**/api/v1/bonus/configuration/policies", (route) => {
    if (route.request().method() === "GET") route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success", data: { policies: [], total: 0 } }) });
    else route.continue();
  });
  /* Same default for Create Roster's own "N already exist" notice
     (2026-09-22) — GET and the real save (POST) share this exact URL,
     unlike most of the others above, so branch on method the same way
     Locations'/Leave Policy's/Bonus Policy's own defaults do. */
  /* Wrapped as data.data.timeSlots/data.data.patterns for real, not a
     flat data array — confirmed live 2026-09-22 against a real staging
     company that visibly had a pattern while Bulk Forge insisted it had
     no time slots (see fetchCompanyResource()'s own comment in app.js).
     Mocked in this real shape on purpose, not the flatter shape that
     let the original bug slip past every test. */
  await page.route("**/api/v1/workforce/time-slots", (route) => {
    if (route.request().method() === "GET") route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success", data: { timeSlots: [] } }) });
    else route.continue();
  });
  /* Same default for Create Roster Pattern's own dependency check
     (2026-09-23) — blocked (or not) on whether any real time slot
     exists, checked the moment this tab first opens. */
  await page.route("**/api/v1/workforce/patterns", (route) => {
    if (route.request().method() === "GET") route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success", data: { patterns: [] } }) });
    else route.continue();
  });
  await gotoSetup(page);
  await page.fill("#setupEmail", "mahmudur@shomvob.com");
  await page.fill("#setupPass", "whatever");
  await page.click("#setupSignInBtn");
  await page.waitForTimeout(150);
  await page.fill("#setupCoEmail", "someone@company.com");
  await page.fill("#setupCoPass", "whatever");
  await page.click("#setupCoBtn");
  await page.waitForTimeout(150);
}

(async () => {
  const browser = await chromium.launch();

  /* ---------- A. sidebar entry and the shared action bar ---------- */
  {
    const page = await browser.newContext().then((c) => c.newPage());
    const errs = watchPageErrors(page);
    await gotoSetup(page);
    check("A sidebar has exactly one Company Setup entry", (await page.locator('.op-item:has-text("Company Setup")').count()) === 1);
    check("A the shared Generate bar is hidden on this page", (await page.locator("#actionBar").evaluate((el) => getComputedStyle(el).display)) === "none");
    check("A opens on step one, tool sign-in", (await page.locator("#setupSignInBtn").count()) === 1);
    check("A staging is the default environment", (await page.getAttribute('#setupEnvSeg button[data-env="staging"]', "aria-pressed")) === "true");
    check("A the two environment buttons are equal width",
      (await page.locator('#setupEnvSeg button[data-env="dev"]').boundingBox().then((b) => b.width)) ===
        (await page.locator('#setupEnvSeg button[data-env="staging"]').boundingBox().then((b) => b.width)));
    check("A no page errors yet", errs.length === 0, errs.join(" | "));
    await page.close();
  }

  /* ---------- A2. the password show/hide toggle on step one ---------- */
  {
    const page = await browser.newContext().then((c) => c.newPage());
    await gotoSetup(page);
    await page.fill("#setupPass", "supersecret123");
    check("A2 starts masked", (await page.getAttribute("#setupPass", "type")) === "password");
    await page.click('.pw-toggle[data-target="setupPass"]');
    check("A2 one click reveals it", (await page.getAttribute("#setupPass", "type")) === "text");
    check("A2 the value survives the switch", (await page.inputValue("#setupPass")) === "supersecret123");
    check("A2 the toggle now offers to hide it", (await page.getAttribute('.pw-toggle[data-target="setupPass"]', "aria-label")) === "Hide password");
    await page.click('.pw-toggle[data-target="setupPass"]');
    check("A2 a second click re-masks it", (await page.getAttribute("#setupPass", "type")) === "password");
    await page.close();
  }

  /* ---------- B. environment picker ---------- */
  {
    const page = await browser.newContext().then((c) => c.newPage());
    await gotoSetup(page);
    await page.click('#setupEnvSeg button[data-env="staging"]');
    check("B staging becomes pressed", (await page.getAttribute('#setupEnvSeg button[data-env="staging"]', "aria-pressed")) === "true");
    check("B dev is un-pressed", (await page.getAttribute('#setupEnvSeg button[data-env="dev"]', "aria-pressed")) === "false");
    await page.close();
  }

  /* ---------- C. step one: empty fields, then wrong credentials ---------- */
  {
    const page = await browser.newContext().then((c) => c.newPage());
    await mockSupabaseFail(page);
    await gotoSetup(page);

    await page.click("#setupSignInBtn");
    check("C empty fields are refused before any request", (await page.textContent("#setupError")) === "Both fields are needed.");

    await page.fill("#setupEmail", "someone@shomvob.com");
    await page.fill("#setupPass", "wrong");
    await page.click("#setupSignInBtn");
    await page.waitForTimeout(150);
    check("C a rejected login surfaces the server's own message", (await page.textContent("#setupError")) === "Invalid login credentials");
    check("C the button re-enables so it can be retried", !(await page.isDisabled("#setupSignInBtn")));
    check("C still on step one — no company form appeared", (await page.locator("#setupCoBtn").count()) === 0);
    await page.close();
  }

  /* ---------- D. the full happy path, and what the status bar shows at each step ---------- */
  {
    const page = await browser.newContext().then((c) => c.newPage());
    const errs = watchPageErrors(page);
    await mockSupabaseOk(page);
    await mockCompanyOk(page, "Sports Academy", "company_admin");
    await gotoSetup(page);

    check("D no status bar before signing in", (await statusbar(page)) === "");

    await page.click('#setupEnvSeg button[data-env="staging"]');
    await page.fill("#setupEmail", "mahmudur@shomvob.com");
    await page.fill("#setupPass", "whatever");
    await page.click("#setupSignInBtn");
    await page.waitForTimeout(150);

    check("D step two appears after tool sign-in", (await page.locator("#setupCoBtn").count()) === 1);
    check("D step two's password field also has a show/hide toggle", (await page.locator('.pw-toggle[data-target="setupCoPass"]').count()) === 1);
    check("D status bar shows the chosen env and the tool email", (await statusbar(page)) === "Staging mahmudur@shomvob.com Sign out");
    check("D step two names the same environment", (await page.textContent("#setupBody")).includes("Staging"));

    await page.fill("#setupCoEmail", "sportsacademy@yopmail.com");
    await page.fill("#setupCoPass", "whatever");
    await page.click("#setupCoBtn");
    await page.waitForTimeout(150);

    check("D reaches the connected state", (await page.locator("#setupDisconnectBtn").count()) === 1);
    check("D the persistent strip itself becomes the Connected banner — one reminder, not two",
      (await page.locator("#setupStatusBar .setup-connected-banner").count()) === 1);
    check("D the connected banner lists company, environment and role as separate rows",
      (await page.locator(".setup-connected-banner .rule-row").count()) === 3);
    const bannerRows = await page.locator(".setup-connected-banner .rule-row").allTextContents();
    check("D the connected banner's rows name the right company, env and role",
      bannerRows[0].includes("Company") && bannerRows[0].includes("Sports Academy") &&
      bannerRows[1].includes("Environment") && bannerRows[1].includes("Staging") &&
      bannerRows[2].includes("Role") && bannerRows[2].includes("Company Admin"),
      JSON.stringify(bannerRows));

    check("D no page errors across the happy path", errs.length === 0, errs.join(" | "));
    await page.close();
  }

  /* ---------- E. Disconnect drops the company only; Sign out drops both ---------- */
  {
    const page = await browser.newContext().then((c) => c.newPage());
    await mockSupabaseOk(page);
    await mockCompanyOk(page, "Sports Academy", "company_admin");
    await gotoSetup(page);
    await page.fill("#setupEmail", "mahmudur@shomvob.com");
    await page.fill("#setupPass", "whatever");
    await page.click("#setupSignInBtn");
    await page.waitForTimeout(150);
    await page.fill("#setupCoEmail", "sportsacademy@yopmail.com");
    await page.fill("#setupCoPass", "whatever");
    await page.click("#setupCoBtn");
    await page.waitForTimeout(150);

    await page.click("#setupDisconnectBtn");
    await page.waitForTimeout(100);
    check("E Disconnect returns to step two", (await page.locator("#setupCoBtn").count()) === 1);
    check("E Disconnect keeps the tool sign-in and env", (await statusbar(page)) === "Staging mahmudur@shomvob.com Sign out");

    await page.click("#setupSignOutBtn");
    await page.waitForTimeout(100);
    check("E Sign out returns all the way to step one", (await page.locator("#setupSignInBtn").count()) === 1);
    check("E Sign out clears the status bar entirely", (await statusbar(page)) === "");
    await page.close();
  }

  /* ---------- F. a rejected company login, and an unreachable one ---------- */
  {
    const page = await browser.newContext().then((c) => c.newPage());
    await mockSupabaseOk(page);
    await mockCompanyFail(page);
    await gotoSetup(page);
    await page.fill("#setupEmail", "mahmudur@shomvob.com");
    await page.fill("#setupPass", "whatever");
    await page.click("#setupSignInBtn");
    await page.waitForTimeout(150);

    await page.fill("#setupCoEmail", "wrong@company.com");
    await page.fill("#setupCoPass", "wrong");
    await page.click("#setupCoBtn");
    await page.waitForTimeout(150);
    check("F a rejected company login surfaces its own message", (await page.textContent("#setupCoError")) === "Wrong email or password.");
    check("F the tool sign-in is untouched by a failed company login", (await statusbar(page)) === "Staging mahmudur@shomvob.com Sign out");
    await page.close();
  }
  {
    const page = await browser.newContext().then((c) => c.newPage());
    await mockSupabaseOk(page);
    await mockCompanyUnreachable(page);
    await gotoSetup(page);
    await page.fill("#setupEmail", "mahmudur@shomvob.com");
    await page.fill("#setupPass", "whatever");
    await page.click("#setupSignInBtn");
    await page.waitForTimeout(150);

    await page.fill("#setupCoEmail", "someone@company.com");
    await page.fill("#setupCoPass", "whatever");
    await page.click("#setupCoBtn");
    await page.waitForTimeout(150);
    check("F an unreachable server names itself rather than giving a bare network error",
      (await page.textContent("#setupCoError")).startsWith("Couldn't reach Staging."));
    await page.close();
  }

  /* ---------- G. state survives navigating to another page and back ---------- */
  {
    const page = await browser.newContext().then((c) => c.newPage());
    await mockSupabaseOk(page);
    await gotoSetup(page);
    await page.fill("#setupEmail", "mahmudur@shomvob.com");
    await page.fill("#setupPass", "whatever");
    await page.click("#setupSignInBtn");
    await page.waitForTimeout(150);

    await page.click('.op-item:has-text("Dashboard")');
    await page.waitForTimeout(100);
    await page.click('.op-item:has-text("Company Setup")');
    await page.waitForTimeout(100);
    check("G switching pages and back keeps the tool sign-in", (await page.locator("#setupCoBtn").count()) === 1);
    check("G and the status bar with it", (await statusbar(page)) === "Staging mahmudur@shomvob.com Sign out");
    await page.close();
  }

  /* ---------- H. the group grid (one card per group, never per module) ---------- */
  {
    const page = await browser.newContext({ viewport: { width: 1440, height: 900 } }).then((c) => c.newPage());
    const errs = watchPageErrors(page);
    await toGrid(page);
    check("H one card per settings group", (await page.locator(".settings-card").count()) === 6);
    check("H group labels match SETTINGS_GROUPS",
      JSON.stringify(await page.locator(".settings-card-name").allTextContents()) ===
        JSON.stringify(["Company Settings", "Employee Settings", "Attendance Settings", "Schedule Management", "Leave Settings", "Payroll Settings"]));
    check("H every card starts at 0 done",
      (await page.locator(".tally").allTextContents()).every((t) => /^0\//.test(t.trim())));
    check("H Payroll's count reflects its real 11 modules",
      (await page.locator(".settings-card:has-text('Payroll') .tally").textContent()).trim() === "0/11 done");
    const cardTops = await page.locator(".settings-card").evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().top)));
    check("H all five group cards sit on one row at desktop width", new Set(cardTops).size === 1, JSON.stringify(cardTops));
    check("H no page errors on the grid", errs.length === 0, errs.join(" | "));
    await page.close();
  }

  /* ---------- I. opening a group: tabs, free pick, coming-soon placeholders ---------- */
  {
    const page = await browser.newContext().then((c) => c.newPage());
    await toGrid(page);
    await page.click(".settings-card:has-text('Company Settings')");
    await page.waitForTimeout(100);

    check("I back link returns to the grid", (await page.locator("#setupBackToModules").count()) === 1);
    check("I opens on the group's first module", (await page.getAttribute('.settings-tab[data-module="company_profile"]', "aria-current")) === "true");
    check("I all six of the group's tabs are present",
      JSON.stringify(await page.locator(".settings-tab").allTextContents().then((a) => a.map((t) => t.trim()))) ===
        JSON.stringify(["Company Profile", "Bank Info", "Location Types", "Locations", "Department Management", "Designation Management"]));

    /* free pick: jump straight to another built module and back again, in
       whatever order — nothing about this is a wizard */
    await page.click('.settings-tab[data-module="departments"]');
    await page.waitForTimeout(80);
    check("I jumping straight to another tab works with no forced order", (await page.locator("#deptModSaveBtn").count()) === 1);
    await page.click('.settings-tab[data-module="company_profile"]');
    await page.waitForTimeout(80);
    check("I jumping back to Company Profile still works", (await page.locator("#cpSaveBtn").count()) === 1);

    await page.click("#setupBackToModules");
    await page.waitForTimeout(80);
    check("I back link returns to the 6-card grid, not signed out", (await page.locator(".settings-card").count()) === 6);

    /* Every module in every group is now built (Payroll was the last),
       so settingsComingSoonHtml()'s fallback has no reachable gap left
       to exercise through normal navigation — it stays in the code for
       whenever a 21st module is added, same as renderMain()'s own
       "Coming soon" branch after all five operations were built. */
    await page.close();
  }

  /* ---------- J. Company Profile — generate, edit, regenerate, save, done state ---------- */
  {
    const page = await browser.newContext().then((c) => c.newPage());
    const errs = watchPageErrors(page);
    await toGrid(page, "Hogwarts");
    await page.click(".settings-card:has-text('Company Settings')");
    await page.waitForTimeout(100);

    check("J legalName is generated from the real connected company name, not typed",
      (await page.inputValue("#cpLegalName")).startsWith("Hogwarts "));
    check("J industry and businessType land on a coherent pair", true /* checked structurally below */);
    const industry = await page.inputValue("#cpIndustry");
    const bizType = await page.inputValue("#cpBusinessType");
    const pairsOk = { "HR Technology":"Technology","ERP":"Technology","Software Development":"Technology","E-commerce":"Retail","FinTech":"Financial Services","EdTech":"Education","HealthTech":"Healthcare","Logistics":"Service","Manufacturing":"Manufacturing","Digital Marketing":"Agency","Consultancy":"Professional Services","Real Estate":"Property","Retail":"Trading","Garments":"Manufacturing","Food and Beverage":"Consumer Goods" };
    check("J the generated industry/businessType pair is one of the real ones", pairsOk[industry] === bizType, `${industry} / ${bizType}`);

    const beforeTeg = await page.inputValue("#cpTegNo");
    await page.click("#cpRegenerateBtn");
    await page.waitForTimeout(1200);
    const afterTeg = await page.inputValue("#cpTegNo");
    check("J Regenerate re-rolls the fields", beforeTeg !== afterTeg);
    check("J a fresh tegNo is still a 13-digit number", /^[1-9]\d{12}$/.test(afterTeg), afterTeg);

    /* clear (×) button — lets a QA engineer test whether a required-looking field is actually enforced server-side */
    check("J a clear button sits next to text fields on this module", (await page.locator(".field-clear-btn").count()) >= 5);
    await page.click("#cpTegNo + button.field-clear-btn");
    check("J the clear button empties the field", (await page.inputValue("#cpTegNo")) === "");

    /* a field can still be hand-edited before saving */
    await page.fill("#cpIndustry", "Hand-Edited Industry");

    let sentBody = null;
    await page.route("**/api/v1/company-profile", (route) => {
      /* GET and PATCH share this exact URL — the background "already has
         values" check (2026-09-15) also GETs this path, and would
         otherwise clobber sentBody right after the real PATCH sets it,
         same gotcha as Bonus Types' GET/POST-sharing route above. */
      if (route.request().method() === "GET") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success", data: null }) });
      sentBody = route.request().postDataJSON();
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success", message: "Company profile saved successfully" }) });
    });
    await page.click("#cpSaveBtn");
    await page.waitForTimeout(150);

    check("J the hand-edited value is what actually gets sent", sentBody && sentBody.industry === "Hand-Edited Industry");
    check("J a cleared field is sent as actually empty, not the last-generated value", sentBody && sentBody.tegNo === "");
    check("J save shows a confirmation", (await page.textContent("#cpError")) === "");
    check("J the tab picks up a done marker", (await page.locator('.settings-tab[data-module="company_profile"] .op-dot').count()) === 1);

    await page.click("#setupBackToModules");
    await page.waitForTimeout(80);
    check("J the group card's count updates to 1/6",
      (await page.textContent(".settings-card:has-text('Company Settings') .tally")).trim() === "1/6 done");

    check("J no page errors through generate/edit/regenerate/save", errs.length === 0, errs.join(" | "));
    await page.close();
  }

  /* ---------- K. a rejected save surfaces the server's own message ---------- */
  {
    const page = await browser.newContext().then((c) => c.newPage());
    await toGrid(page);
    await page.click(".settings-card:has-text('Company Settings')");
    await page.waitForTimeout(100);
    await page.route("**/api/v1/company-profile", (route) =>
      route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ message: "Legal name already taken." }) })
    );
    await page.click("#cpSaveBtn");
    await page.waitForTimeout(150);
    check("K the server's rejection message is shown as-is", (await page.textContent("#cpError")) === "Legal name already taken.");
    check("K a rejected save leaves the module undone", (await page.locator('.settings-tab[data-module="company_profile"] .op-dot').count()) === 0);
    await page.close();
  }

  /* ---------- N. Bank Info — generate, edit, regenerate, save, done state ---------- */
  {
    const page = await browser.newContext().then((c) => c.newPage());
    const errs = watchPageErrors(page);
    await toGrid(page, "Hogwarts");
    await page.click(".settings-card:has-text('Company Settings')");
    await page.waitForTimeout(100);
    await page.click('.settings-tab[data-module="bank_info"]');
    await page.waitForTimeout(80);

    const bankName = await page.inputValue("#biBankName");
    check("N the generated bank is one of the real ones", BANK_NAMES.includes(bankName), bankName);
    const acct1 = await page.inputValue("#biAccountNumber");
    check("N accountNumber is 12-15 digits, no leading zero", /^[1-9]\d{11,14}$/.test(acct1), acct1);
    const npsb = await page.inputValue("#biNpsb");
    const beftn = await page.inputValue("#biBeftn");
    const expectedCode = BANK_SHORT_CODE_MAP[bankName];
    check("N npsbCode is the bank's short code + ACT", npsb === `${expectedCode}ACT`, `${npsb} vs ${expectedCode}ACT`);
    check("N beftnCode is the same short code + BFT", beftn === `${expectedCode}BFT`, `${beftn} vs ${expectedCode}BFT`);

    await page.click("#biRegenerateBtn");
    await page.waitForTimeout(1200);
    const acct2 = await page.inputValue("#biAccountNumber");
    check("N Regenerate re-rolls the fields", acct1 !== acct2 || bankName !== (await page.inputValue("#biBankName")));

    await page.fill("#biMfs", "MFSHANDEDITED");
    let sentBody = null;
    await page.route("**/api/v1/company-bank-informations/save", (route) => {
      sentBody = route.request().postDataJSON();
      route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ status: "success", message: "Company bank information updated successfully" }) });
    });
    await page.click("#biSaveBtn");
    await page.waitForTimeout(150);

    check("N the hand-edited value is what actually gets sent", sentBody && sentBody.mfsCode === "MFSHANDEDITED");
    check("N accountNumber is sent as a JSON number, not a string", sentBody && typeof sentBody.accountNumber === "number");
    check("N save shows no error", (await page.textContent("#biError")) === "");
    check("N the tab picks up a done marker", (await page.locator('.settings-tab[data-module="bank_info"] .op-dot').count()) === 1);

    await page.click("#setupBackToModules");
    await page.waitForTimeout(80);
    check("N the group card's count updates to 1/6",
      (await page.textContent(".settings-card:has-text('Company Settings') .tally")).trim() === "1/6 done");
    check("N no page errors through generate/edit/regenerate/save", errs.length === 0, errs.join(" | "));
    await page.close();
  }

  /* ---------- O. Bank Info requires a 201, not just any 2xx ---------- */
  {
    const page = await browser.newContext().then((c) => c.newPage());
    await toGrid(page);
    await page.click(".settings-card:has-text('Company Settings')");
    await page.waitForTimeout(100);
    await page.click('.settings-tab[data-module="bank_info"]');
    await page.waitForTimeout(80);
    await page.route("**/api/v1/company-bank-informations/save", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success", message: "ok" }) })
    );
    await page.click("#biSaveBtn");
    await page.waitForTimeout(150);
    check("O a 200 (not 201) is treated as a rejection", (await page.textContent("#biError")) !== "");
    check("O and the module stays undone", (await page.locator('.settings-tab[data-module="bank_info"] .op-dot').count()) === 0);
    await page.close();
  }

  /* ---------- L. Company Setup gets the wider column, nothing else does ---------- */
  {
    const page = await browser.newContext({ viewport: { width: 1440, height: 900 } }).then((c) => c.newPage());
    await page.goto(PAGE);
    await signIn(page);
    const dashboardWidth = await page.locator("#mainContent").evaluate((el) => el.getBoundingClientRect().width);
    await page.click('.op-item:has-text("Company Setup")');
    await page.waitForTimeout(60);
    const setupWidth = await page.locator("#mainContent").evaluate((el) => el.getBoundingClientRect().width);
    check("L Company Setup is wider than the default column", setupWidth > dashboardWidth, `${setupWidth} vs ${dashboardWidth}`);
    await page.click('.op-item:has-text("Dashboard")');
    await page.waitForTimeout(60);
    const backToDashboard = await page.locator("#mainContent").evaluate((el) => el.getBoundingClientRect().width);
    check("L the wider column doesn't leak onto the page after it", backToDashboard === dashboardWidth, `${backToDashboard} vs ${dashboardWidth}`);
    await page.close();
  }

  /* ---------- M. network-calling buttons show a spinner and a real BUSY_MESSAGES line ---------- */
  {
    const page = await browser.newContext().then((c) => c.newPage());
    await page.route("**/auth/v1/token**", async (route) => {
      await new Promise((r) => setTimeout(r, 400));
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ access_token: "t", refresh_token: "r", user: { id: "u1" } }) });
    });
    await gotoSetup(page);
    await page.fill("#setupEmail", "mahmudur@shomvob.com");
    await page.fill("#setupPass", "whatever");
    const clickDone = page.click("#setupSignInBtn");
    await page.waitForTimeout(150);
    check("M shows a spinner mid-flight", (await page.locator("#setupSignInBtn .spin").count()) === 1);
    check("M the button disables mid-flight", await page.isDisabled("#setupSignInBtn"));
    const label = (await page.textContent("#setupSignInBtn")).trim();
    check("M the label is one of BUSY_MESSAGES, not a placeholder string", BUSY_MESSAGES.includes(label), label);
    await clickDone;
    await page.waitForSelector("#setupCoBtn"); // the mocked 400ms delay hasn't necessarily elapsed yet
    check("M a completed sign-in moves past step one", (await page.locator("#setupCoBtn").count()) === 1);
    await page.close();
  }
  {
    /* a busy button that fails restores its idle label, not a stuck spinner */
    const page = await browser.newContext().then((c) => c.newPage());
    await mockSupabaseFail(page);
    await gotoSetup(page);
    await page.fill("#setupEmail", "mahmudur@shomvob.com");
    await page.fill("#setupPass", "wrong");
    await page.click("#setupSignInBtn");
    await page.waitForTimeout(150);
    check("M a failed call clears the busy state", (await page.locator("#setupSignInBtn .spin").count()) === 0);
    check("M and restores the plain idle label", (await page.textContent("#setupSignInBtn")).trim() === "Sign in");
    check("M and re-enables the button", !(await page.isDisabled("#setupSignInBtn")));
    await page.close();
  }

  /* ---------- P. Location Types (2026-09-24, replaces the old Locations/
     Branch Management module entirely — a different real API the product
     moved to since that module was first built) ---------- */
  {
    const page = await browser.newContext().then((c) => c.newPage());
    const errs = watchPageErrors(page);
    await toGrid(page);
    await page.click(".settings-card:has-text('Company Settings')");
    await page.waitForTimeout(100);
    await page.click('.settings-tab[data-module="location_types"]');
    await page.waitForTimeout(80);

    const typeName = await page.inputValue("#ltyName");
    check("P the generated name is one of the real Dhaka-area ones", LOCATION_TYPE_NAMES.includes(typeName), typeName);
    check("P Can Have Geofence defaults on", (await page.getAttribute('#ltyGeoSeg button[data-geo="yes"]', "aria-pressed")) === "true");

    await page.click('#ltyGeoSeg button[data-geo="no"]');
    await page.waitForTimeout(60);

    let sent = null;
    await page.route("**/api/v1/locations/location-types", (route) => {
      if (route.request().method() !== "POST") return route.continue();
      sent = route.request().postDataJSON();
      route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ status: "success", message: "Location type created successfully" }) });
    });
    await page.click("#ltySaveBtn");
    await page.waitForTimeout(150);
    check("P sends the real fixed shape (code/sortOrder/canHaveEmployees/status/allowedParentLocationTypeId), only name and canHaveGeofence vary",
      sent && sent.name === typeName && sent.code === "" && sent.sortOrder === 1 && sent.canHaveEmployees === true && sent.status === "Active" && sent.allowedParentLocationTypeId === null && sent.canHaveGeofence === false,
      JSON.stringify(sent));
    check("P the tab picks up a done marker", (await page.locator('.settings-tab[data-module="location_types"] .op-dot').count()) === 1);
    check("P no page errors", errs.length === 0, errs.join(" | "));
    await page.close();
  }

  /* ---------- P2. Locations — the real cross-module dependency on Location Types (2026-09-24) ---------- */
  {
    const page = await browser.newContext().then((c) => c.newPage());
    const errs = watchPageErrors(page);
    await toGrid(page);
    await page.click(".settings-card:has-text('Company Settings')");
    await page.waitForTimeout(100);
    await page.click('.settings-tab[data-module="locations"]');
    await page.waitForFunction(() => document.querySelector("#setupBody")?.textContent.includes("doesn't have a Location Type yet"), { timeout: 5000 });
    const shortcut = page.locator(".dep-shortcut");
    check("P2 shortcut names Location Types", (await shortcut.textContent()).includes("Location Type"));
    await shortcut.click();
    await page.waitForSelector("#ltyName");
    check("P2 shortcut lands on Location Types", (await page.locator("#ltyName").count()) === 1);
    check("P2 no page errors on the blocked path", errs.length === 0, errs.join(" | "));
    await page.close();
  }
  {
    const page = await browser.newContext().then((c) => c.newPage());
    const errs = watchPageErrors(page);
    await toGrid(page);
    const realTypes = [{ id: "lt-1", name: "Baridhara" }, { id: "lt-2", name: "Gulshan" }];
    await page.route("**/api/v1/locations/location-types/paginated**", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success", data: { locationTypes: realTypes } }) })
    );
    await page.click(".settings-card:has-text('Company Settings')");
    await page.waitForTimeout(100);
    await page.click('.settings-tab[data-module="locations"]');
    await page.waitForSelector("#locName");

    check("P2 Location Type dropdown lists the real fetched types", (await page.locator("#locType option").count()) === 2);
    check("P2 defaults to the one named Baridhara, matched by name", await page.inputValue("#locType") === "lt-1");
    const generatedName = await page.inputValue("#locName");
    check("P2 the generated name is one of the real office-name pool", OFFICE_NAMES.includes(generatedName), generatedName);

    const geoOn = (await page.getAttribute('#locGeoSeg button[data-geo="yes"]', "aria-pressed")) === "true";
    check("P2 geo fields are present exactly when Has Geofence is on", (await page.locator("#locLat").count()) === (geoOn ? 1 : 0));
    if (!geoOn) await page.click('#locGeoSeg button[data-geo="yes"]');
    await page.waitForTimeout(60);
    check("P2 turning Has Geofence on adds the geo fields", (await page.locator("#locLat").count()) === 1);

    await page.selectOption("#locType", "lt-2");
    await page.click('#locDefaultSeg button[data-default="yes"]');
    await page.waitForTimeout(60);

    let sent = null;
    await page.route("**/api/v1/locations", (route) => {
      if (route.request().method() === "GET") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success", data: { items: [] } }) });
      sent = route.request().postDataJSON();
      route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ status: "success", message: "Location created successfully" }) });
    });
    await page.click("#locSaveBtn");
    await page.waitForTimeout(150);
    check("P2 sends the picked location type, isDefault true, real geofence numbers, and the fixed shape",
      sent && sent.locationTypeId === "lt-2" && sent.isDefault === true && sent.hasGeofence === true && typeof sent.geofence.latitude === "number" &&
        sent.parentId === null && sent.timezone === null && sent.currency === null && sent.locale === "en-BD" && sent.headEmployeeId === null && sent.status === "Active",
      JSON.stringify(sent));
    check("P2 the tab picks up a done marker", (await page.locator('.settings-tab[data-module="locations"] .op-dot').count()) === 1);
    check("P2 no page errors", errs.length === 0, errs.join(" | "));
    await page.close();
  }

  /* ---------- Q. Department Management ---------- */
  {
    const page = await browser.newContext().then((c) => c.newPage());
    const errs = watchPageErrors(page);
    await toGrid(page);
    await page.click(".settings-card:has-text('Company Settings')");
    await page.waitForTimeout(100);
    await page.click('.settings-tab[data-module="departments"]');
    await page.waitForTimeout(80);

    const deptName = await page.inputValue("#deptModName");
    check("Q the generated department is one of the real ones", DEPARTMENT_NAMES.includes(deptName), deptName);

    await page.fill("#deptModName", "Hand-Edited Dept");
    let sent = null;
    await page.route("**/api/v1/departments", (route) => {
      if (route.request().method() !== "POST") return route.continue();
      sent = route.request().postDataJSON();
      route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ status: "success", data: { name: sent.name, status: "Active" } }) });
    });
    await page.click("#deptModSaveBtn");
    await page.waitForTimeout(150);
    check("Q the hand-edited name is what actually gets sent", sent && sent.name === "Hand-Edited Dept");
    check("Q the fixed fields match the Postman body exactly",
      sent && sent.code === "" && sent.status === "Active" && sent.parentId === null && sent.businessLineId === null && sent.departmentHeadId === null,
      JSON.stringify(sent));
    check("Q the tab picks up a done marker", (await page.locator('.settings-tab[data-module="departments"] .op-dot').count()) === 1);
    check("Q no page errors", errs.length === 0, errs.join(" | "));
    await page.close();
  }

  /* ---------- R. Designation Management — the dependency flow ---------- */
  {
    const page = await browser.newContext().then((c) => c.newPage());
    const errs = watchPageErrors(page);
    await toGrid(page);
    await page.click(".settings-card:has-text('Company Settings')");
    await page.waitForTimeout(100);

    // no departments yet
    await page.route("**/api/v1/departments/active", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success", data: [] }) })
    );
    await page.click('.settings-tab[data-module="designations"]');
    await page.waitForTimeout(200);
    check("R blocked with a named, specific reason", (await page.textContent("#setupBody")).includes("doesn't have a Department yet"));
    check("R the shortcut names the one real prerequisite, not a tour", (await page.locator(".dep-shortcut").count()) === 1);

    await page.click(".dep-shortcut");
    await page.waitForTimeout(80);
    check("R the shortcut jumps straight to Department Management", (await page.getAttribute('.settings-tab[aria-current="true"]', "data-module")) === "departments");

    // save a real department — this is what should invalidate the cached "empty" check
    await page.route("**/api/v1/departments", (route) => {
      if (route.request().method() !== "POST") return route.continue();
      route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ status: "success", data: { name: "Engineering", status: "Active" } }) });
    });
    await page.click("#deptModSaveBtn");
    await page.waitForTimeout(150);

    await page.unroute("**/api/v1/departments/active");
    await page.route("**/api/v1/departments/active", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success", data: [{ id: "d1", name: "Engineering" }, { id: "d2", name: "Sales" }] }) })
    );
    await page.click('.settings-tab[data-module="designations"]');
    await page.waitForSelector("#desigName", { timeout: 5000 });
    check("R saving the prerequisite invalidates the cached check — the form appears without a reload", true);

    const desigName = await page.inputValue("#desigName");
    check("R the generated designation is one of the real four", DESIGNATION_NAMES.includes(desigName), desigName);
    check("R the department select lists the real departments",
      JSON.stringify(await page.locator("#desigDept option").allTextContents()) === JSON.stringify(["Engineering", "Sales"]));

    await page.selectOption("#desigDept", { label: "Sales" });
    let sent = null;
    await page.route("**/api/v1/designations", (route) => {
      sent = route.request().postDataJSON();
      route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ status: "success", message: "Designation created successfully" }) });
    });
    await page.click("#desigSaveBtn");
    await page.waitForTimeout(150);
    check("R the picked department is what's actually sent, as departmentIds", sent && JSON.stringify(sent.departmentIds) === '["d2"]', JSON.stringify(sent));
    check("R the tab picks up a done marker", (await page.locator('.settings-tab[data-module="designations"] .op-dot').count()) === 1);
    check("R no page errors through the whole dependency flow", errs.length === 0, errs.join(" | "));
    await page.close();
  }

  /* ---------- S. disconnecting clears every module's cached state, not just tokens ---------- */
  {
    const page = await browser.newContext().then((c) => c.newPage());
    await toGrid(page, "Hogwarts");
    await page.click(".settings-card:has-text('Company Settings')");
    await page.waitForTimeout(100);
    const firstLegalName = await page.inputValue("#cpLegalName"); // generates + caches companyProfile.fields
    check("S sanity: legalName is generated from Hogwarts", firstLegalName.startsWith("Hogwarts "));

    await page.click("#setupBackToModules");
    await page.waitForTimeout(80);
    await page.click("#setupDisconnectBtn");
    await page.waitForTimeout(80);

    // reconnect as a different company
    await mockCompanyOk(page, "Wayne Enterprises", "company_admin");
    await page.fill("#setupCoEmail", "wayne@company.com");
    await page.fill("#setupCoPass", "whatever");
    await page.click("#setupCoBtn");
    await page.waitForTimeout(150);
    await page.click(".settings-card:has-text('Company Settings')");
    await page.waitForTimeout(100);
    const secondLegalName = await page.inputValue("#cpLegalName");
    check("S a new company after Disconnect gets its own generated fields, not the last company's",
      secondLegalName.startsWith("Wayne Enterprises "), secondLegalName);
    await page.close();
  }

  /* ---------- T. Custom Fields — Type is a real dropdown (2026-09-11) ---------- */
  {
    const page = await browser.newContext().then((c) => c.newPage());
    const errs = watchPageErrors(page);
    await toGrid(page);
    await page.click(".settings-card:has-text('Employee Settings')");
    await page.waitForTimeout(100);

    const cfName = await page.inputValue("#cfName");
    const cfType = await page.inputValue("#cfType");
    const preset = CUSTOM_FIELD_PRESETS.find((p) => p.fieldName === cfName);
    check("T the generated field is one of the real presets, with its matching type", preset && preset.type === cfType, `${cfName}/${cfType}`);
    check("T Type is a real dropdown, not free text", (await page.evaluate(() => document.querySelector("#cfType").tagName)) === "SELECT");
    check("T status defaults to Active, not randomised", (await page.getAttribute('#cfStatusSeg button[data-val="Active"]', "aria-pressed")) === "true");
    check("T enableFilter defaults to No, not randomised", (await page.getAttribute('#cfFilterSeg button[data-val="no"]', "aria-pressed")) === "true");

    if (preset.type === "checkbox" || preset.type === "enum") {
      check("T enableFilter is a real toggle for checkbox/enum types", (await page.locator("#cfFilterSeg").count()) === 1);
    }
    check("T choices only appear for an enum-type field", (await page.locator("#cfChoices").count()) === (preset.type === "enum" ? 1 : 0));

    /* Switch Type by hand to a type that supports neither filter nor
       choices — regardless of what was originally generated — and check
       both get force-cleared, plus that a hand-typed name survives the
       re-render this select triggers (same class of bug as Attendance
       Policy's weekend toggle). */
    await page.fill("#cfName", "Hand-Edited Field Name");
    await page.selectOption("#cfType", "long_text");
    await page.waitForTimeout(80);
    check("T hand-edited name survived the type-change re-render", (await page.inputValue("#cfName")) === "Hand-Edited Field Name");
    check("T switching to a type with no choices/filter clears both", (await page.locator("#cfChoices").count()) === 0);

    /* Switch to enum: choices should appear with a sensible default. */
    await page.selectOption("#cfType", "enum");
    await page.waitForTimeout(80);
    check("T switching to enum gives default choices to edit", (await page.inputValue("#cfChoices")) === "Option 1, Option 2, Option 3");
    await page.fill("#cfChoices", "Red, Green, Blue");

    /* A status toggle click re-renders too — hand-edited name AND
       hand-edited choices must both survive it. */
    await page.click('#cfStatusSeg button[data-val="Inactive"]');
    await page.waitForTimeout(80);
    check("T hand-edited name survived a status-toggle re-render", (await page.inputValue("#cfName")) === "Hand-Edited Field Name");
    check("T hand-edited choices survived a status-toggle re-render", (await page.inputValue("#cfChoices")) === "Red, Green, Blue");
    await page.click('#cfStatusSeg button[data-val="Active"]');
    await page.waitForTimeout(80);

    let sent = null;
    await page.route("**/api/v1/company-settings/employee-custom-fields", (route) => {
      sent = route.request().postDataJSON();
      route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ status: "success", message: "Custom field created successfully" }) });
    });
    await page.click("#cfSaveBtn");
    await page.waitForTimeout(150);
    check("T the hand-picked type/name/choices/status are what's actually sent",
      sent && sent.type === "enum" && sent.fieldName === "Hand-Edited Field Name" && sent.status === "Active" && JSON.stringify(sent.options.choices) === JSON.stringify(["Red", "Green", "Blue"]),
      JSON.stringify(sent));
    check("T the tab picks up a done marker", (await page.locator('.settings-tab[data-module="custom_fields"] .op-dot').count()) === 1);
    check("T no page errors", errs.length === 0, errs.join(" | "));
    await page.close();
  }

  /* ---------- U. Required Documents ---------- */
  {
    const page = await browser.newContext().then((c) => c.newPage());
    const errs = watchPageErrors(page);
    await toGrid(page);
    await page.click(".settings-card:has-text('Employee Settings')");
    await page.waitForTimeout(100);
    await page.click('.settings-tab[data-module="required_documents"]');
    await page.waitForTimeout(80);

    const rdName = await page.inputValue("#rdName");
    check("U the generated document is one of the real ones", REQUIRED_DOCUMENT_NAMES.includes(rdName), rdName);
    check("U status defaults to active, not randomised", (await page.getAttribute('#rdStatusSeg button[data-val="active"]', "aria-pressed")) === "true");

    await page.fill("#rdName", "Hand-Edited Document Name");
    // force a known combination so the payload is fully predictable
    await page.click('#rdTypeSeg button[data-val="file"]');
    check("U hand-edited name survived the Type toggle's re-render", (await page.inputValue("#rdName")) === "Hand-Edited Document Name");
    await page.click('#rdStatusSeg button[data-val="active"]');
    await page.click('#rdRequiredSeg button[data-val="yes"]');
    check("U hand-edited name still intact after every toggle click", (await page.inputValue("#rdName")) === "Hand-Edited Document Name");

    let sent = null;
    await page.route("**/api/v1/required-documents", (route) => {
      if (route.request().method() !== "POST") return route.continue();
      sent = route.request().postDataJSON();
      route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ status: "success", message: "Resource created successfully" }) });
    });
    await page.click("#rdSaveBtn");
    await page.waitForTimeout(150);
    check("U status is sent lowercase, this endpoint's own convention", sent && sent.status === "active", JSON.stringify(sent));
    check("U isRequired is sent as a real JSON boolean, not a string", sent && sent.isRequired === true, JSON.stringify(sent));
    check("U type reflects the toggle actually clicked", sent && sent.type === "file");
    check("U the hand-edited name, not a regenerated one, is what's sent", sent && sent.name === "Hand-Edited Document Name", JSON.stringify(sent));
    check("U the tab picks up a done marker", (await page.locator('.settings-tab[data-module="required_documents"] .op-dot').count()) === 1);
    check("U no page errors", errs.length === 0, errs.join(" | "));
    await page.close();
  }

  /* ---------- V. Leave Types — Kind dropdown removed, Name-only form (2026-09-12) ---------- */
  {
    const page = await browser.newContext().then((c) => c.newPage());
    const errs = watchPageErrors(page);
    await toGrid(page);
    await page.click(".settings-card:has-text('Leave')");
    await page.waitForTimeout(100);

    check("V there is no Kind dropdown any more", (await page.locator("#ltKind").count()) === 0);
    check("V just a free-text Name field, plus the sandwich/bridge toggles", (await page.locator("#ltName").count()) === 1 && (await page.locator("#ltSandwichToggle").count()) === 1 && (await page.locator("#ltBridgeToggle").count()) === 1);
    check("V special-entitlement fields don't exist any more", (await page.locator("#ltInstancesSeg").count()) === 0 && (await page.locator("#ltDocSeg").count()) === 0);

    await page.fill("#ltName", "Hand-Typed Leave Name");

    let sent = null;
    await page.route("**/api/v1/leave-types", (route) => {
      /* Saving fires a trailing GET too — 2026-09-12, the "already
         exists" existing-check is invalidated on save and immediately
         re-fetched on the render right after, so this same URL pattern
         sees both requests. Guard on method or that GET's empty body
         (postDataJSON() returns null for it) silently clobbers `sent`. */
      if (route.request().method() !== "POST") return route.fallback();
      sent = route.request().postDataJSON();
      route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ status: "success", message: "Leave type created successfully" }) });
    });
    await page.click("#ltSaveBtn");
    await page.waitForTimeout(150);
    check("V the typed name, not a generated one, is what's sent", sent && sent.name === "Hand-Typed Leave Name", JSON.stringify(sent));
    check("V always sends the normal (non-special) eligibility shape", sent && sent.genderEligibility === "all" && sent.maritalStatusEligibility === "all" && sent.specialEntitlementEnabled === false, JSON.stringify(sent));
    check("V sandwich/bridge default off since neither toggle was touched", sent && sent.sandwichRuleEnabled === false && sent.isBridge === false, JSON.stringify(sent));
    check("V the tab picks up a done marker", (await page.locator('.settings-tab[data-module="leave_types"] .op-dot').count()) === 1);
    check("V no page errors", errs.length === 0, errs.join(" | "));
    await page.close();
  }

  /* ---------- W. Leave Policy — the second real dependency flow ---------- */
  {
    const page = await browser.newContext().then((c) => c.newPage());
    const errs = watchPageErrors(page);
    await toGrid(page);
    await page.click(".settings-card:has-text('Leave')");
    await page.waitForTimeout(100);

    await page.route("**/api/v1/leave-types", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success", data: [] }) })
    );
    await page.click('.settings-tab[data-module="leave_policy"]');
    await page.waitForTimeout(200);
    check("W blocked with a named reason when no leave types exist", (await page.textContent("#setupBody")).includes("doesn't have any yet"));
    check("W the shortcut jumps to Leave Types", (await page.locator(".dep-shortcut").count()) === 1);

    await page.click(".dep-shortcut");
    await page.waitForTimeout(80);
    check("W shortcut lands on the right tab", (await page.getAttribute('.settings-tab[aria-current="true"]', "data-module")) === "leave_types");

    await page.route("**/api/v1/leave-types", (route) => {
      if (route.request().method() === "POST") {
        route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ status: "success", message: "Leave type created successfully" }) });
      } else route.fallback(); // the Save success handler invalidates and immediately re-fetches Leave Types' own existing-check — this pattern now sees that trailing GET too
    });
    await page.click("#ltSaveBtn");
    await page.waitForTimeout(150);

    await page.unroute("**/api/v1/leave-types");
    await page.route("**/api/v1/leave-types", (route) => {
      if (route.request().method() !== "GET") return route.fallback();
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ status: "success", data: [
          { id: "lt1", name: "Annual Leave", seMaxDaysPerInstance: null },
          { id: "lt2", name: "Sick Leave", seMaxDaysPerInstance: null },
          { id: "lt3", name: "Maternity Leave", seMaxDaysPerInstance: 120 },
        ] }),
      });
    });
    await page.click('.settings-tab[data-module="leave_policy"]');
    await page.waitForSelector("#lpName", { timeout: 5000 });
    check("W saving the prerequisite invalidates the cache — the form appears without a reload", true);
    check("W every real leave type this company has is listed, all start checked",
      (await page.locator(".lp-leave-row").count()) === 3 && (await page.locator(".lp-leave-row input[type=checkbox]:checked").count()) === 3);
    check("W every row defaults to 12 days", (await page.locator(".lp-leave-row input[type=number]").evaluateAll((els) => els.every((el) => el.value === "12"))));

    // Exclude the special-entitlement one (Maternity), edit Sick's days.
    await page.uncheck('.lp-leave-row:has-text("Maternity Leave") input[type=checkbox]');
    await page.fill('.lp-leave-row:has-text("Sick Leave") input[type=number]', "20");

    let sent = null;
    await page.route("**/api/v1/leave-policies", (route) => {
      /* GET and POST share this exact URL — Leave Policy's own
         "already has values" background check (2026-09-15) also GETs
         this path and would otherwise clobber sent right after the
         real POST sets it, same gotcha fixed elsewhere in this file. */
      if (route.request().method() === "GET") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success", data: [] }) });
      sent = route.request().postDataJSON();
      route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ status: "success", message: "Leave policy created successfully" }) });
    });
    await page.click("#lpSaveBtn");
    await page.waitForTimeout(150);
    check("W an unchecked leave type is left out entirely", sent && !sent.leaveTypes.some((lt) => lt.leaveTypeId === "lt3"), JSON.stringify(sent));
    check("W an edited day count is what's sent, not the 12-day default", sent && sent.leaveTypes.some((lt) => lt.leaveTypeId === "lt2" && lt.days === 20), JSON.stringify(sent));
    check("W category is always Standard now — no special-entitlement handling any more",
      sent && sent.leaveTypes.every((lt) => lt.category === "Standard"), JSON.stringify(sent));
    check("W departmentIds is empty — company-wide by default", sent && Array.isArray(sent.departmentIds) && sent.departmentIds.length === 0);
    check("W the tab picks up a done marker", (await page.locator('.settings-tab[data-module="leave_policy"] .op-dot').count()) === 1);
    check("W no page errors through the whole flow", errs.length === 0, errs.join(" | "));
    await page.close();
  }

  /* ---------- W1. Leave Policy — a new leave type must actually appear in the list (2026-09-12) ----------
     Real bug, found live: leavePolicy.leaveTypes (the dependency cache) was
     invalidated on a new leave type save, but leavePolicy.fields — the
     already-generated list of rows built from the old leaveTypes — was
     not, so a stale 3-row list kept rendering forever even after a real
     4th leave type existed and the dependency cache itself had correctly
     refetched it. Fixed by nulling leavePolicy.fields alongside
     leavePolicy.leaveTypes at every invalidation site. */
  {
    const page = await browser.newContext().then((c) => c.newPage());
    const errs = watchPageErrors(page);
    await toGrid(page);
    await page.click(".settings-card:has-text('Leave')");
    await page.waitForTimeout(100);

    let leaveTypes = [
      { id: "lt1", name: "Annual Leave", seMaxDaysPerInstance: null },
      { id: "lt2", name: "Casual Leave", seMaxDaysPerInstance: null },
      { id: "lt3", name: "Sick Leave", seMaxDaysPerInstance: null },
    ];
    await page.route("**/api/v1/leave-types", (route) => {
      if (route.request().method() === "GET") {
        route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success", data: leaveTypes }) });
      } else {
        route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ status: "success", message: "ok" }) });
      }
    });

    // Open Leave Policy first, while the company still only has 3 — this is what generates and caches its fields object.
    await page.click('.settings-tab[data-module="leave_policy"]');
    await page.waitForSelector("#lpName", { timeout: 5000 });
    check("W1 starts with the 3 that exist", (await page.locator(".lp-leave-row").count()) === 3);

    // Create a 4th by hand; the server starts returning it too from now on.
    await page.click('.settings-tab[data-module="leave_types"]');
    await page.waitForSelector("#ltName", { timeout: 5000 });
    await page.fill("#ltName", "Senti Leave");
    leaveTypes = [...leaveTypes, { id: "lt4", name: "Senti Leave", seMaxDaysPerInstance: null }];
    await page.click("#ltSaveBtn");
    await page.waitForTimeout(150);

    await page.click('.settings-tab[data-module="leave_policy"]');
    await page.waitForSelector("#lpName", { timeout: 5000 });
    check("W1 the newly created leave type actually appears, not a stale 3-row list",
      (await page.locator(".lp-leave-row").count()) === 4 && (await page.locator(".lp-leave-row:has-text('Senti Leave')").count()) === 1);
    check("W1 no page errors", errs.length === 0, errs.join(" | "));
    await page.close();
  }

  /* ---------- W2. Leave Policy — "Create the default policy" shortcut (2026-09-12) ---------- */
  {
    // Only 2 of the 3 default leave types exist — the shortcut must stay hidden, not partially build a policy.
    const page1 = await browser.newContext().then((c) => c.newPage());
    const errs1 = watchPageErrors(page1);
    await toGrid(page1);
    await page1.click(".settings-card:has-text('Leave')");
    await page1.waitForTimeout(100);
    await page1.route("**/api/v1/leave-types", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success", data: [
        { id: "lt1", name: "Annual Leave", seMaxDaysPerInstance: null },
        { id: "lt2", name: "Casual Leave", seMaxDaysPerInstance: null },
      ] }) })
    );
    await page1.click('.settings-tab[data-module="leave_policy"]');
    await page1.waitForSelector("#lpName", { timeout: 5000 });
    check("W2 the shortcut is hidden when not all 3 default leave types exist yet", (await page1.locator("#lpDefaultBtn").count()) === 0);
    check("W2 no page errors (incomplete case)", errs1.length === 0, errs1.join(" | "));
    await page1.close();

    // All 3 exist now (plus an unrelated 4th) — the shortcut appears and builds the fixed shape.
    const page = await browser.newContext().then((c) => c.newPage());
    const errs = watchPageErrors(page);
    await toGrid(page);
    await page.click(".settings-card:has-text('Leave')");
    await page.waitForTimeout(100);
    await page.route("**/api/v1/leave-types", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success", data: [
        { id: "lt1", name: "Annual Leave", seMaxDaysPerInstance: null },
        { id: "lt2", name: "Casual Leave", seMaxDaysPerInstance: null },
        { id: "lt3", name: "Sick Leave", seMaxDaysPerInstance: null },
        { id: "lt4", name: "Maternity Leave", seMaxDaysPerInstance: 120 },
      ] }) })
    );
    await page.click('.settings-tab[data-module="leave_policy"]');
    await page.waitForSelector("#lpName", { timeout: 5000 });
    check("W2 the shortcut appears once Annual/Casual/Sick all exist", (await page.locator("#lpDefaultBtn").count()) === 1);

    await page.click("#lpDefaultBtn");
    await page.waitForTimeout(80);
    check("W2 clicking it fills Name with the fixed default name", (await page.inputValue("#lpName")) === "Default Leave Policy");

    let sent = null;
    await page.route("**/api/v1/leave-policies", (route) => {
      if (route.request().method() === "GET") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success", data: [] }) });
      sent = route.request().postDataJSON();
      route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ status: "success", message: "Leave policy created successfully" }) });
    });
    await page.click("#lpSaveBtn");
    await page.waitForTimeout(150);
    check("W2 only the 3 default leave types are included, not the unrelated 4th",
      sent && sent.leaveTypes.length === 3 && !sent.leaveTypes.some((lt) => lt.leaveTypeId === "lt4"), JSON.stringify(sent));
    check("W2 every one of them is Standard category, 12 days, no carry-forward",
      sent && sent.leaveTypes.every((lt) => lt.category === "Standard" && lt.days === 12 && lt.carryForward === false), JSON.stringify(sent));
    check("W2 the real ids of Annual/Casual/Sick are what's sent",
      sent && ["lt1", "lt2", "lt3"].every((id) => sent.leaveTypes.some((lt) => lt.leaveTypeId === id)), JSON.stringify(sent));
    check("W2 no page errors", errs.length === 0, errs.join(" | "));
    await page.close();
  }

  /* ---------- X. Attendance Policy — the Attendance group's only module ---------- */
  {
    const page = await browser.newContext().then((c) => c.newPage());
    const errs = watchPageErrors(page);
    await toGrid(page);
    await page.click(".settings-card:has-text('Attendance')");
    await page.waitForSelector("#apTitle", { timeout: 5000 });
    check("X lands directly on the group's only module", (await page.locator('.settings-tab[data-module="attendance_policy"][aria-current="true"]').count()) === 1);
    check("X generated settings chips are shown", (await page.locator(".tally").count()) >= 1);

    const titleBefore = await page.inputValue("#apTitle");
    check("X the default title is the fixed 'Office Standard Policy', no random number (2026-09-14, direct request)", titleBefore === "Office Standard Policy");
    await page.click("#apRegenerateBtn");
    await page.waitForTimeout(1200);
    const titleAfter = await page.inputValue("#apTitle");
    check("X regenerate keeps the same fixed title — nothing left to re-roll", titleAfter === "Office Standard Policy");

    await page.fill("#apTitle", "Hand-Edited Policy Title");

    let sent = null;
    await page.route("**/api/v1/attendance/policy/create", (route) => {
      sent = route.request().postDataJSON();
      route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ status: "success", message: "Company-wide policy created successfully!" }) });
    });
    await page.click("#apSaveBtn");
    await page.waitForTimeout(150);
    check("X the hand-edited title, not a regenerated one, is what's sent", sent && sent.title === "Hand-Edited Policy Title");
    check("X no shifts/weekendDays are sent (real API rejects both)", sent && sent.shifts === undefined && sent.weekendDays === undefined);
    check(
      "X maxCheckOutLimit/fixedBreakSettings carry the real shape",
      sent && typeof sent.maxCheckOutLimit === "number" && typeof sent.fixedBreakSettings === "object" && typeof sent.fixedBreakSettings.fixedBreakEnabled === "boolean"
    );
    check("X overtime/break still carry the generated shape", sent && typeof sent.overtimeConfigs === "object" && typeof sent.breakConfig === "object");
    check(
      "X maxCheckOutLimit is never less than maxOvertimeMinutes when set",
      sent && (!sent.overtimeConfigs.hasMaxOvertime || sent.maxCheckOutLimit >= sent.overtimeConfigs.maxOvertimeMinutes)
    );
    await page.click("#setupBackToModules");
    await page.waitForTimeout(60);
    check("X the group's card shows 1/1 done", (await page.textContent(".settings-card:has-text('Attendance') .tally")).includes("1/1"));
    check("X no page errors", errs.length === 0, errs.join(" | "));
    await page.close();
  }

  /* ---------- Y. Payroll: General — payroll cycle picker ---------- */
  {
    const page = await browser.newContext().then((c) => c.newPage());
    const errs = watchPageErrors(page);
    await toGrid(page);
    await page.click(".settings-card:has-text('Payroll')");
    await page.waitForSelector("#pgCycleSeg", { timeout: 5000 });
    check("Y lands on Payroll's first module", (await page.locator('.settings-tab[data-module="payroll_general"][aria-current="true"]').count()) === 1);
    check("Y no Threshold chip shown by default — thresholdRuleEnabled defaults off, not a coin flip (2026-09-14)", !(await page.textContent("#setupBody")).includes("Threshold"));

    let sentDefault = null;
    await page.route("**/api/v1/payroll/configuration/payroll-cycle", (route) => {
      /* GET and POST share this exact URL — Payroll General's own
         "already has values" background check (2026-09-15) also GETs
         this path, and would otherwise clobber sentDefault/sent right
         after the real POST sets them, same gotcha as Company Profile's
         test J and Bonus Types' GET/POST-sharing route before it. */
      if (route.request().method() === "GET") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success", data: null }) });
      sentDefault = route.request().postDataJSON();
      route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ status: "success", message: "Pay cycle updated. Current period recalculated." }) });
    });
    await page.click("#pgSaveBtn");
    await page.waitForTimeout(150);
    check("Y the default body matches exactly {payrollCycle: calendar_month, thresholdRuleEnabled: false}",
      JSON.stringify(sentDefault) === JSON.stringify({ payrollCycle: "calendar_month", thresholdRuleEnabled: false }), JSON.stringify(sentDefault));
    await page.unroute("**/api/v1/payroll/configuration/payroll-cycle");

    await page.click('#pgCycleSeg button[data-val="fixed_date"]');
    await page.waitForTimeout(60);
    check("Y switching to fixed_date shows a fixed start day chip", (await page.textContent("#setupBody")).includes("Fixed start day"));

    await page.click('#pgCycleSeg button[data-val="bi_weekly"]');
    await page.waitForTimeout(60);
    check("Y switching to bi_weekly shows a bi-weekly start date chip, no threshold", (await page.textContent("#setupBody")).includes("Bi-weekly start"));

    let sent = null;
    await page.route("**/api/v1/payroll/configuration/payroll-cycle", (route) => {
      if (route.request().method() === "GET") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success", data: null }) });
      sent = route.request().postDataJSON();
      route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ status: "success", message: "Pay cycle updated. Current period recalculated." }) });
    });
    await page.click("#pgSaveBtn");
    await page.waitForTimeout(150);
    check("Y bi_weekly sends a biWeeklyStartDate, no threshold fields", sent && sent.payrollCycle === "bi_weekly" && /^\d{4}-\d{2}-01$/.test(sent.biWeeklyStartDate) && sent.thresholdRuleEnabled === undefined, JSON.stringify(sent));
    check("Y the tab picks up a done marker", (await page.locator('.settings-tab[data-module="payroll_general"] .op-dot').count()) === 1);
    check("Y no page errors", errs.length === 0, errs.join(" | "));
    await page.close();
  }

  /* ---------- Z. Payroll: Salary Components — fixed preset pool ---------- */
  {
    const page = await browser.newContext().then((c) => c.newPage());
    const errs = watchPageErrors(page);
    await toGrid(page);
    await page.click(".settings-card:has-text('Payroll')");
    await page.click('.settings-tab[data-module="salary_components"]');
    await page.waitForSelector("#scPreset", { timeout: 5000 });
    check("Z defaults to the first preset (Medical Allowance)", (await page.locator("#scPreset").inputValue()) === "0");
    check("Z shows that preset's real description", (await page.textContent("#setupBody")).includes("medical and healthcare-related expenses"));

    await page.selectOption("#scPreset", "1");
    await page.waitForTimeout(60);
    check("Z switching preset shows House Rent Allowance's description", (await page.textContent("#setupBody")).includes("house rent or accommodation-related expenses"));

    let sent = null;
    await page.route("**/api/v1/payroll/configuration/salary-components", (route) => {
      if (route.request().method() !== "POST") return route.continue();
      sent = route.request().postDataJSON();
      route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ status: "success", message: `Salary component "${sent.name}" created successfully!`, data: { id: "sc-1" } }) });
    });
    await page.click("#scSaveBtn");
    await page.waitForTimeout(150);
    check("Z sends the real fixed name, not a generated one", sent && sent.name === "House Rent Allowance");
    check("Z the tab picks up a done marker", (await page.locator('.settings-tab[data-module="salary_components"] .op-dot').count()) === 1);
    check("Z no page errors", errs.length === 0, errs.join(" | "));
    await page.close();
  }

  /* ---------- AA. Payroll: Configure Salary Components — the third real dependency ---------- */
  {
    const page = await browser.newContext().then((c) => c.newPage());
    const errs = watchPageErrors(page);
    await toGrid(page);
    await page.click(".settings-card:has-text('Payroll')");

    /* The real endpoint is paginated — data.data is { components, metadata },
       not a flat array like every other fetchCompanyResource() caller gets.
       Confirmed genuinely broken against the real API, 2026-09-11: mocking
       this as a flat array (as this test used to) let fetchCompanyResource()'s
       bug — silently returning [] for the wrapped shape — pass unnoticed. */
    await page.route("**/api/v1/payroll/configuration/salary-components?status=Active&limit=100", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ status: "success", data: { components: [{ id: "sc-1", name: "Medical Allowance", status: "Active" }], metadata: { total: 1 } } }),
      })
    );
    await page.click('.settings-tab[data-module="configure_salary_components"]');
    await page.waitForTimeout(200);
    check("AA blocked with a named reason when fewer than 2 active components exist", (await page.textContent("#setupBody")).includes("this company has 1 so far"));
    check("AA the shortcut jumps to Salary Components", (await page.locator(".dep-shortcut").count()) === 1);
    await page.click(".dep-shortcut");
    await page.waitForTimeout(80);
    check("AA shortcut lands on the right tab", (await page.getAttribute('.settings-tab[aria-current="true"]', "data-module")) === "salary_components");

    await page.route("**/api/v1/payroll/configuration/salary-components", (route) => {
      if (route.request().method() === "POST") {
        route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ status: "success", message: "Salary component created successfully!", data: { id: "sc-2" } }) });
      } else route.continue();
    });
    await page.click("#scSaveBtn");
    await page.waitForTimeout(150);

    await page.unroute("**/api/v1/payroll/configuration/salary-components?status=Active&limit=100");
    await page.route("**/api/v1/payroll/configuration/salary-components?status=Active&limit=100", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          status: "success",
          data: {
            components: [
              { id: "sc-1", name: "Medical Allowance", status: "Active" },
              { id: "sc-2", name: "House Rent Allowance", status: "Active" },
            ],
            metadata: { total: 2 },
          },
        }),
      })
    );
    await page.click('.settings-tab[data-module="configure_salary_components"]');
    await page.waitForSelector(".settings-tabs", { timeout: 5000 });
    await page.waitForFunction(() => document.querySelector("#setupBody").textContent.includes("Basic"), { timeout: 5000 });
    check("AA saving the prerequisite invalidates the cache — the split now appears", (await page.textContent("#setupBody")).includes("House Rent Allowance"));

    let sent = null;
    await page.route("**/api/v1/payroll/configuration/non-paygrade-structure", (route) => {
      /* GET and PUT share this exact URL — Configure Salary Components'
         own "already has values" background check (2026-09-15) also
         GETs this path and would otherwise clobber `sent` right after
         the real PUT sets it, same gotcha fixed elsewhere in this file. */
      if (route.request().method() === "GET") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success", data: {} }) });
      sent = route.request().postDataJSON();
      route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ status: "success", message: "Salary structure created successfully" }) });
    });
    await page.click("#ssSaveBtn");
    await page.waitForTimeout(150);
    check("AA the split always sums to 100", sent && sent.basicSalaryPercentage + sent.components[0].percentage + sent.components[1].percentage === 100, JSON.stringify(sent));
    check("AA both real component IDs are used, not invented ones", sent && sent.components.every((c) => ["sc-1", "sc-2"].includes(c.salaryComponentId)));
    check("AA the tab picks up a done marker", (await page.locator('.settings-tab[data-module="configure_salary_components"] .op-dot').count()) === 1);
    check("AA no page errors through the whole flow", errs.length === 0, errs.join(" | "));
    await page.close();
  }

  /* ---------- AA2. Configure Salary Components — the default filler (2026-09-13) ---------- */
  {
    const page = await browser.newContext().then((c) => c.newPage());
    const errs = watchPageErrors(page);
    await toGrid(page);
    await page.click(".settings-card:has-text('Payroll')");

    /* When a company has all 3 of Salary Components' own "Create the
       default 3" (Medical/House Rent/Internet Allowance), Configure
       Salary Components uses exactly those 3 as its default filler
       instead of a random 2 — Basic 60%, two of the three at 15% each,
       the third at 10%. Direct user request. */
    await page.route("**/api/v1/payroll/configuration/salary-components?status=Active&limit=100", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          status: "success",
          data: {
            components: [
              { id: "sc-med", name: "Medical Allowance", status: "Active" },
              { id: "sc-hra", name: "House Rent Allowance", status: "Active" },
              { id: "sc-net", name: "Internet Allowance", status: "Active" },
            ],
            metadata: { total: 3 },
          },
        }),
      })
    );
    await page.click('.settings-tab[data-module="configure_salary_components"]');
    await page.waitForFunction(() => document.querySelector("#setupBody").textContent.includes("Basic"), { timeout: 5000 });
    check("AA2 uses all 3 default components, not just 2", (await page.textContent("#setupBody")).includes("Medical Allowance") && (await page.textContent("#setupBody")).includes("House Rent Allowance") && (await page.textContent("#setupBody")).includes("Internet Allowance"));
    check("AA2 Basic is fixed at 60%", (await page.textContent("#setupBody")).includes("Basic 60%"));

    let sent = null;
    await page.route("**/api/v1/payroll/configuration/non-paygrade-structure", (route) => {
      if (route.request().method() === "GET") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success", data: {} }) });
      sent = route.request().postDataJSON();
      route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ status: "success", message: "Salary structure created successfully" }) });
    });
    await page.click("#ssSaveBtn");
    await page.waitForTimeout(150);
    check("AA2 basic + all 3 components sum to 100", sent && sent.basicSalaryPercentage + sent.components.reduce((s, c) => s + c.percentage, 0) === 100, JSON.stringify(sent));
    check("AA2 the split is 60/15/15/10", sent && sent.basicSalaryPercentage === 60 && sent.components.filter((c) => c.percentage === 15).length === 2 && sent.components.filter((c) => c.percentage === 10).length === 1, JSON.stringify(sent));
    check("AA2 all 3 real component IDs are used, none invented", sent && sent.components.every((c) => ["sc-med", "sc-hra", "sc-net"].includes(c.salaryComponentId)));
    check("AA2 no page errors", errs.length === 0, errs.join(" | "));
    await page.close();
  }

  /* ---------- AB. Payroll: Late Arrival, Absent Deduction — both need a Leave Type ---------- */
  {
    const page = await browser.newContext().then((c) => c.newPage());
    const errs = watchPageErrors(page);
    await toGrid(page);
    await page.click(".settings-card:has-text('Payroll')");

    await page.route("**/api/v1/leave-types", (route) => {
      if (route.request().method() !== "GET") return route.continue();
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success", data: [{ id: "lt1", name: "Annual Leave" }] }) });
    });
    await page.click('.settings-tab[data-module="late_arrival"]');
    await page.waitForFunction(() => document.querySelector("#setupBody").textContent.includes("Monthly late limit"), { timeout: 5000 });
    check("AB Late Arrival resolves its own leave-type dependency", (await page.textContent("#setupBody")).includes("Annual Leave"));

    /* Late Penalty / Repeated Late Penalty used to be an exclusive pair
       (one always true) with no off state. Direct request (2026-09-13):
       both default off and are independent toggles now. */
    check("AB Late Penalty defaults off", (await page.getAttribute('#laPenaltySeg button[data-val="no"]', "aria-pressed")) === "true");
    check("AB Repeated Late Penalty defaults off", (await page.getAttribute('#laRepeatedPenaltySeg button[data-val="no"]', "aria-pressed")) === "true");

    let laSent = null;
    await page.route("**/api/v1/payroll/configuration/deduction-settings", (route) => {
      laSent = route.request().postDataJSON();
      route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ status: "success", message: "Deduction settings updated successfully" }) });
    });
    await page.click("#laSaveBtn");
    await page.waitForTimeout(150);
    check("AB both late-penalty flags are false by default, not forced exclusive", laSent && laSent.latePenaltyEnabled === false && laSent.repeatedLatePenaltyEnabled === false, JSON.stringify(laSent));
    check("AB the internal leave-type-name field never reaches the request", laSent && laSent._leaveTypeName === undefined);
    check("AB latePenaltyLeaveType carries the real leave type id", laSent && laSent.latePenaltyLeaveType === "lt1");

    /* Turning one on leaves the other off — proves they're independent,
       not still secretly negating each other. */
    await page.click('#laPenaltySeg button[data-val="yes"]');
    await page.waitForTimeout(80);
    await page.click("#laSaveBtn");
    await page.waitForTimeout(150);
    check("AB Late Penalty toggles on independently of Repeated Late Penalty", laSent && laSent.latePenaltyEnabled === true && laSent.repeatedLatePenaltyEnabled === false, JSON.stringify(laSent));

    await page.click('.settings-tab[data-module="absent_deduction"]');
    await page.waitForFunction(() => document.querySelector("#setupBody").textContent.includes("Rule based on"), { timeout: 5000 });
    check("AB Repeated Absent Penalty defaults off", (await page.getAttribute('#adRuleSeg button[data-val="no"]', "aria-pressed")) === "true");
    let adSent = null;
    await page.route("**/api/v1/payroll/configuration/absent-deduction-settings", (route) => {
      adSent = route.request().postDataJSON();
      route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ status: "success", message: "Absent deduction settings updated successfully" }) });
    });
    await page.click("#adSaveBtn");
    await page.waitForTimeout(150);
    check("AB Absent Deduction resolves the dependency independently of Late Arrival", adSent && adSent.absentDeductionLeaveType === "lt1");
    check("AB ruleBasedOn defaults to total_absent_days (off)", adSent && adSent.ruleBasedOn === "total_absent_days", adSent && adSent.ruleBasedOn);

    await page.click('#adRuleSeg button[data-val="yes"]');
    await page.waitForTimeout(80);
    await page.click("#adSaveBtn");
    await page.waitForTimeout(150);
    check("AB Repeated Absent Penalty toggles ruleBasedOn to consecutive_absent_days", adSent && adSent.ruleBasedOn === "consecutive_absent_days", adSent && adSent.ruleBasedOn);

    check("AB both tabs picked up done markers", (await page.locator('.settings-tab[data-module="late_arrival"] .op-dot').count()) === 1 && (await page.locator('.settings-tab[data-module="absent_deduction"] .op-dot').count()) === 1);
    check("AB no page errors", errs.length === 0, errs.join(" | "));
    await page.close();
  }

  /* ---------- AC. Payroll: Bonus Types — fixed preset pool ---------- */
  {
    const page = await browser.newContext().then((c) => c.newPage());
    const errs = watchPageErrors(page);
    await toGrid(page);
    await page.click(".settings-card:has-text('Payroll')");
    await page.click('.settings-tab[data-module="bonus_types"]');
    await page.waitForSelector("#btPreset", { timeout: 5000 });
    check("AC defaults to Eid Bonus", (await page.locator("#btPreset").inputValue()) === "0");

    await page.selectOption("#btPreset", "3");
    await page.waitForTimeout(60);
    check("AC the 4th preset (Inactive Test Bonus) shows Inactive status", (await page.textContent("#setupBody")).includes("Inactive"));

    let sent = null;
    await page.route("**/api/v1/bonus/configuration/types", (route) => {
      if (route.request().method() === "GET") {
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success", data: [] }) });
      }
      sent = route.request().postDataJSON();
      route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ status: "success", message: "Bonus type created successfully." }) });
    });
    await page.click("#btSaveBtn");
    await page.waitForTimeout(150);
    check("AC sends the real fixed name and status, not generated ones", sent && sent.typeName === "Inactive Test Bonus" && sent.status === "Inactive");
    check("AC the tab picks up a done marker", (await page.locator('.settings-tab[data-module="bonus_types"] .op-dot').count()) === 1);
    check("AC no page errors", errs.length === 0, errs.join(" | "));
    await page.close();
  }

  /* ---------- AC2. Bonus Types — "Create the default 2" (2026-09-13) ---------- */
  {
    const page = await browser.newContext().then((c) => c.newPage());
    const errs = watchPageErrors(page);
    await toGrid(page);
    await page.click(".settings-card:has-text('Payroll')");
    await page.click('.settings-tab[data-module="bonus_types"]');
    await page.waitForSelector("#btBulkEnterLink", { timeout: 5000 });

    await page.click("#btBulkEnterLink");
    await page.waitForSelector(".bulk-list", { timeout: 5000 });
    const bodyText = await page.textContent("#setupBody");
    check("AC2 offers exactly Eid Bonus and Bangla New Year Bonus", bodyText.includes("Eid Bonus") && bodyText.includes("Bangla New Year Bonus"));
    check("AC2 leaves out Special Bonus and Inactive Test Bonus", !bodyText.includes("Special Bonus") && !bodyText.includes("Inactive Test Bonus"));

    const created = [];
    await page.route("**/api/v1/bonus/configuration/types", (route) => {
      if (route.request().method() === "GET") {
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success", data: [] }) });
      }
      const body = route.request().postDataJSON();
      created.push(body.typeName);
      route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ status: "success", message: "Bonus type created successfully." }) });
    });
    await page.click("#btBulkCreateBtn");
    await page.waitForFunction(() => document.querySelector("#setupBody").textContent.includes("done"), { timeout: 5000 });
    await page.waitForTimeout(150);
    check("AC2 creates exactly Eid Bonus and Bangla New Year Bonus, both real POSTs", created.length === 2 && created.includes("Eid Bonus") && created.includes("Bangla New Year Bonus"));
    check("AC2 the tab picks up a done marker", (await page.locator('.settings-tab[data-module="bonus_types"] .op-dot').count()) === 1);
    check("AC2 no page errors", errs.length === 0, errs.join(" | "));
    await page.close();
  }

  /* ---------- AC3. Bonus Types bulk — an existing name is skipped, not duplicated ---------- */
  {
    const page = await browser.newContext().then((c) => c.newPage());
    const errs = watchPageErrors(page);
    await toGrid(page);
    await page.click(".settings-card:has-text('Payroll')");
    await page.route("**/api/v1/bonus/configuration/types", (route) => {
      if (route.request().method() === "GET") {
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success", data: [{ id: "bt-existing", typeName: "Eid Bonus", status: "Active" }] }) });
      }
      route.continue();
    });
    await page.click('.settings-tab[data-module="bonus_types"]');
    await page.waitForSelector("#btBulkEnterLink", { timeout: 5000 });
    await page.click("#btBulkEnterLink");
    await page.waitForSelector(".bulk-list", { timeout: 5000 });
    check("AC3 an already-existing default is shown skipped, not offered again", (await page.locator('.bulk-row:has-text("Eid Bonus")').textContent()).includes("skipped"));
    check("AC3 Bangla New Year Bonus (the one that doesn't exist yet) is still offered normally", !(await page.locator('.bulk-row:has-text("Bangla New Year Bonus")').textContent()).includes("skipped"));
    await page.close();
  }

  /* ---------- AD. Payroll: Bonus Policy — the fourth real dependency ---------- */
  {
    const page = await browser.newContext().then((c) => c.newPage());
    const errs = watchPageErrors(page);
    await toGrid(page);
    await page.click(".settings-card:has-text('Payroll')");

    await page.route("**/api/v1/bonus/configuration/types", (route) => {
      if (route.request().method() !== "GET") return route.continue();
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success", data: [] }) });
    });
    await page.click('.settings-tab[data-module="bonus_policy"]');
    await page.waitForTimeout(200);
    check("AD blocked with a named reason when no bonus types exist", (await page.textContent("#setupBody")).includes("doesn't have any yet"));
    await page.click(".dep-shortcut");
    await page.waitForTimeout(80);
    check("AD shortcut jumps to Bonus Types", (await page.getAttribute('.settings-tab[aria-current="true"]', "data-module")) === "bonus_types");

    await page.route("**/api/v1/bonus/configuration/types", (route) => {
      if (route.request().method() === "POST") {
        route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ status: "success", message: "Bonus type created successfully." }) });
      } else {
        route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success", data: [] }) });
      }
    });
    await page.click("#btSaveBtn");
    await page.waitForTimeout(150);

    await page.unroute("**/api/v1/bonus/configuration/types");
    await page.route("**/api/v1/bonus/configuration/types", (route) => {
      if (route.request().method() !== "GET") return route.continue();
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success", data: [{ id: "bt-1", typeName: "Eid Bonus", status: "Active" }] }) });
    });
    await page.click('.settings-tab[data-module="bonus_policy"]');
    await page.waitForSelector("#bpName", { timeout: 5000 });
    check("AD saving the prerequisite invalidates the cache — the form appears", (await page.textContent("#setupBody")).includes("Eid Bonus"));

    await page.fill("#bpName", "Hand-Edited Policy Name");
    let sent = null;
    await page.route("**/api/v1/bonus/configuration/policies", (route) => {
      /* GET and POST share this exact URL — Bonus Policy's own
         "already has values" background check (2026-09-15) also GETs
         this path and would otherwise clobber sent right after the
         real POST sets it, same gotcha fixed elsewhere in this file. */
      if (route.request().method() === "GET") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success", data: { policies: [], total: 0 } }) });
      sent = route.request().postDataJSON();
      route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ status: "success", message: "Bonus policy created successfully." }) });
    });
    await page.click("#bpSaveBtn");
    await page.waitForTimeout(150);
    check("AD the hand-edited name, not a generated one, is what's sent", sent && sent.name === "Hand-Edited Policy Name");
    check("AD bonusTypeId is the real fetched id", sent && sent.bonusTypeId === "bt-1");
    check("AD the internal bonus-type-name field never reaches the request", sent && sent._bonusTypeName === undefined);
    check("AD the tab picks up a done marker", (await page.locator('.settings-tab[data-module="bonus_policy"] .op-dot').count()) === 1);
    check("AD no page errors through the whole flow", errs.length === 0, errs.join(" | "));
    await page.close();
  }

  /* ---------- AD2. Bonus Policy — "Create the default 3" (2026-09-13) ---------- */
  {
    const page = await browser.newContext().then((c) => c.newPage());
    const errs = watchPageErrors(page);
    await toGrid(page);
    await page.click(".settings-card:has-text('Payroll')");
    await page.route("**/api/v1/bonus/configuration/types", (route) => {
      if (route.request().method() !== "GET") return route.continue();
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          status: "success",
          data: [
            { id: "bt-eid", typeName: "Eid Bonus", status: "Active" },
            { id: "bt-bny", typeName: "Bangla New Year Bonus", status: "Active" },
          ],
        }),
      });
    });
    await page.click('.settings-tab[data-module="bonus_policy"]');
    await page.waitForSelector("#bpBulkEnterLink", { timeout: 5000 });
    await page.click("#bpBulkEnterLink");
    await page.waitForSelector(".bulk-list", { timeout: 5000 });
    check("AD2 offers all 3 defaults when both real bonus types exist", (await page.textContent("#setupBody")).includes("Eid Ul Fitr Bonus Policy") && (await page.textContent("#setupBody")).includes("Eid Ul Adha Bonus Policy") && (await page.textContent("#setupBody")).includes("Bangla New Year Bonus Policy"));
    check("AD2 nothing is skipped when both bonus types are real", (await page.locator(".bulk-row:has-text('skipped')").count()) === 0);

    const created = [];
    await page.route("**/api/v1/bonus/configuration/policies", (route) => {
      /* Same GET/POST-URL-sharing gotcha as AD above — the bulk run's own
         post-completion existing-check re-fire would otherwise push a
         spurious null entry into `created`. */
      if (route.request().method() === "GET") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success", data: { policies: [], total: 0 } }) });
      created.push(route.request().postDataJSON());
      route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ status: "success", message: "Bonus policy created successfully." }) });
    });
    await page.click("#bpBulkCreateBtn");
    await page.waitForFunction(() => document.querySelector("#setupBody").textContent.includes("created successfully"), { timeout: 5000 });
    check("AD2 creates all 3, both Eid policies pointing at the one real Eid Bonus type",
      created.length === 3 &&
      created.filter((p) => p.bonusTypeId === "bt-eid").length === 2 &&
      created.some((p) => p.bonusTypeId === "bt-bny"));
    check("AD2 the percentages are 40/40/20 as asked", created.find((p) => p.name === "Eid Ul Fitr Bonus Policy")?.bonusPercentage === 40 && created.find((p) => p.name === "Eid Ul Adha Bonus Policy")?.bonusPercentage === 40 && created.find((p) => p.name === "Bangla New Year Bonus Policy")?.bonusPercentage === 20, JSON.stringify(created));
    check("AD2 no page errors", errs.length === 0, errs.join(" | "));
    await page.close();
  }

  /* ---------- AD3. Bonus Policy bulk — a missing bonus type shows skipped, named ---------- */
  {
    const page = await browser.newContext().then((c) => c.newPage());
    const errs = watchPageErrors(page);
    await toGrid(page);
    await page.click(".settings-card:has-text('Payroll')");
    await page.route("**/api/v1/bonus/configuration/types", (route) => {
      if (route.request().method() !== "GET") return route.continue();
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success", data: [{ id: "bt-eid", typeName: "Eid Bonus", status: "Active" }] }) });
    });
    await page.click('.settings-tab[data-module="bonus_policy"]');
    await page.waitForSelector("#bpBulkEnterLink", { timeout: 5000 });
    await page.click("#bpBulkEnterLink");
    await page.waitForSelector(".bulk-list", { timeout: 5000 });
    check("AD3 the two Eid policies still offered normally", !(await page.locator('.bulk-row:has-text("Eid Ul Fitr")').textContent()).includes("skipped") && !(await page.locator('.bulk-row:has-text("Eid Ul Adha")').textContent()).includes("skipped"));
    check("AD3 Bangla New Year is shown skipped, named, not silently dropped", (await page.locator('.bulk-row:has-text("Bangla New Year")').textContent()).includes("skipped"));
    await page.close();
  }

  /* ---------- AE. Payroll: Overtime — the fifth real dependency ---------- */
  {
    const page = await browser.newContext().then((c) => c.newPage());
    const errs = watchPageErrors(page);
    await toGrid(page);
    await page.click(".settings-card:has-text('Payroll')");

    /* GET /attendance/policies is undocumented in the collection — found
       live against the real API. No policy with overtime enabled yet. */
    await page.route("**/api/v1/attendance/policies", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success", data: [{ id: "ap-1", title: "Office Standard Policy", overtimeEnabled: false }] }) })
    );
    await page.click('.settings-tab[data-module="overtime"]');
    await page.waitForTimeout(200);
    check("AE blocked with a named reason when no policy has overtime enabled", (await page.textContent("#setupBody")).includes("doesn't have one yet"));
    check("AE the shortcut jumps to Attendance Policy", (await page.locator(".dep-shortcut").count()) === 1);
    await page.click(".dep-shortcut");
    await page.waitForTimeout(80);
    check("AE shortcut lands on the right tab", (await page.getAttribute('.settings-tab[aria-current="true"]', "data-module")) === "attendance_policy");

    /* Saving an Attendance Policy invalidates Overtime's stale cache, same
       pattern as Department invalidating Designation's. */
    await page.route("**/api/v1/attendance/policy/create", (route) =>
      route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ status: "success", message: "Company-wide policy created successfully!" }) })
    );
    await page.click("#apSaveBtn");
    await page.waitForTimeout(150);

    await page.unroute("**/api/v1/attendance/policies");
    await page.route("**/api/v1/attendance/policies", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success", data: [{ id: "ap-1", title: "Office Standard Policy", overtimeEnabled: true }] }) })
    );
    await page.click("#setupBackToModules");
    await page.waitForTimeout(80);
    await page.click(".settings-card:has-text('Payroll')");
    await page.click('.settings-tab[data-module="overtime"]');
    await page.waitForSelector("#otSaveBtn", { timeout: 5000 });
    check("AE saving the prerequisite invalidates the cache — the form now appears", (await page.locator("#otSaveBtn").count()) === 1);

    let sent = null;
    await page.route("**/api/v1/payroll/configuration/overtime", (route) => {
      sent = route.request().postDataJSON();
      route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ status: "success", message: "Overtime settings configured successfully!" }) });
    });
    await page.click("#otSaveBtn");
    await page.waitForTimeout(150);
    check("AE regular overtime is always enabled", sent && sent.overtimeEnabled === "Enable" && sent.default.dailyHourLimit >= 3 && sent.default.dailyHourLimit <= 5);
    check("AE monthly limit is exactly daily x20", sent && sent.default.monthlyHourLimit === sent.default.dailyHourLimit * 20);
    check("AE weekend/holiday blocks are independently either Enable or Disable",
      sent && ["Enable", "Disable"].includes(sent.weekend.overtimeEnabled) && ["Enable", "Disable"].includes(sent.holiday.overtimeEnabled));
    check("AE the tab picks up a done marker", (await page.locator('.settings-tab[data-module="overtime"] .op-dot').count()) === 1);
    check("AE no page errors", errs.length === 0, errs.join(" | "));
    await page.close();
  }

  /* ---------- AF. Payroll: Attendance Bonus ---------- */
  {
    const page = await browser.newContext().then((c) => c.newPage());
    const errs = watchPageErrors(page);
    await toGrid(page);
    await page.click(".settings-card:has-text('Payroll')");
    await page.click('.settings-tab[data-module="attendance_bonus"]');
    await page.waitForSelector("#abSaveBtn", { timeout: 5000 });

    let sent = null;
    await page.route("**/api/v1/payroll/configuration/attendance-bonus", (route) => {
      sent = route.request().postDataJSON();
      route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ status: "success", message: "Attendance bonus settings configured successfully!" }) });
    });
    await page.click("#abSaveBtn");
    await page.waitForTimeout(150);
    check("AF attendanceBonusEnabled is always Enable", sent && sent.attendanceBonusEnabled === "Enable");
    check("AF calculations.enabled is always Disable, matching the script's own quirk", sent && sent.calculations.enabled === "Disable");
    check("AF exactly one of fixedRate/percentage is set, matching calculationType",
      sent && (sent.calculations.calculationType === "Fixed Rate" ? (sent.calculations.fixedRate !== null && sent.calculations.percentage === null) : (sent.calculations.fixedRate === null && sent.calculations.percentage !== null)));
    check("AF the tab picks up a done marker", (await page.locator('.settings-tab[data-module="attendance_bonus"] .op-dot').count()) === 1);
    check("AF no page errors", errs.length === 0, errs.join(" | "));
    await page.close();
  }

  /* ---------- AG. Payroll: Custom Addition/Deduction — paired name pools ---------- */
  {
    const page = await browser.newContext().then((c) => c.newPage());
    const errs = watchPageErrors(page);
    await toGrid(page);
    await page.click(".settings-card:has-text('Payroll')");
    await page.click('.settings-tab[data-module="custom_addition_deduction"]');
    await page.waitForSelector("#cadSaveBtn", { timeout: 5000 });
    check("AG defaults to Addition with an addition-shaped name",
      ["Mobile Allowance", "Internet Allowance"].includes(await page.inputValue("#cadName")));

    await page.click('#cadTypeSeg button[data-val="Deduction"]');
    await page.waitForTimeout(60);
    check("AG switching to Deduction picks a deduction-shaped name",
      ["Late Fee", "Device Penalty"].includes(await page.inputValue("#cadName")));

    await page.fill("#cadName", "Custom Hand-Typed Deduction");

    /* Carry Forward is a real Yes/No toggle now (2026-09-14, direct
       request), not read-only tally text — and toggling it must not
       lose the hand-typed name sitting in the sibling input. */
    const carryBefore = (await page.getAttribute('#cadCarrySeg button[data-val="yes"]', "aria-pressed")) === "true";
    await page.click(`#cadCarrySeg button[data-val="${carryBefore ? "no" : "yes"}"]`);
    await page.waitForTimeout(60);
    check("AG Carry Forward toggle flips", (await page.getAttribute('#cadCarrySeg button[data-val="yes"]', "aria-pressed")) === String(!carryBefore));
    check("AG toggling Carry Forward doesn't lose the hand-typed name", (await page.inputValue("#cadName")) === "Custom Hand-Typed Deduction");

    let sent = null;
    await page.route("**/api/v1/payroll/configuration/custom-fields", (route) => {
      sent = route.request().postDataJSON();
      route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ status: "success", message: "Resource created successfully" }) });
    });
    await page.click("#cadSaveBtn");
    await page.waitForTimeout(150);
    check("AG the hand-typed name, not a pool one, is what's sent", sent && sent.name === "Custom Hand-Typed Deduction" && sent.type === "Deduction");
    check("AG carryingNext reflects the toggle, not a random roll", sent && sent.carryingNext === !carryBefore);
    check("AG the tab picks up a done marker", (await page.locator('.settings-tab[data-module="custom_addition_deduction"] .op-dot').count()) === 1);
    check("AG no page errors", errs.length === 0, errs.join(" | "));
    await page.close();
  }

  /* ---------- AH. Payroll: Tax — the one place the collection stops short ---------- */
  {
    const page = await browser.newContext().then((c) => c.newPage());
    const errs = watchPageErrors(page);
    await toGrid(page);
    await page.click(".settings-card:has-text('Payroll')");
    await page.click('.settings-tab[data-module="tax"]');
    await page.waitForSelector("#ptSaveBtn", { timeout: 5000 });
    check("AH the scope gap is named in the module's own copy", (await page.textContent("#setupBody")).includes("doesn't have yet"));

    let method = null;
    await page.route("**/api/v1/payroll/configuration/tax-rules/toggle/Enable", (route) => {
      method = route.request().method();
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success", message: "Tax rules action updated successfully" }) });
    });
    await page.click("#ptSaveBtn");
    await page.waitForTimeout(150);
    check("AH calls PATCH, matching the collection's own request", method === "PATCH");
    await page.click("#setupBackToModules");
    await page.waitForTimeout(60);
    check("AH the group's card reflects this session's own single save (each test block is a fresh context)", (await page.textContent(".settings-card:has-text('Payroll') .tally")).includes("1/11"));
    check("AH no page errors", errs.length === 0, errs.join(" | "));
    await page.close();
  }

  /* ---------- AI. a reload keeps the tool sign-in, never the company login ----------

     sessionStorage persistence for BOTH logins was tried, then reverted
     the same day: letting the real company login survive a reload would
     quietly make "is the tab still open" this section's whole security
     boundary. Revisited narrower on 2026-09-11, after "no warning at all
     on reload" was found and fixed and the user asked for this directly:
     the tool sign-in only ever decided who may open this section at
     all, never forwarded to any real Shomvob endpoint, so persisting
     *only* that one doesn't touch the boundary the reversal was
     protecting — the company login is still never restored,
     unconditionally, every time, landing on step 2 fresh. */
  {
    const page = await browser.newContext().then((c) => c.newPage());
    const errs = watchPageErrors(page);
    await toGrid(page, "Nexa Technologies");
    await page.click(".settings-card:has-text('Company Settings')");
    await page.waitForTimeout(100);
    let cpSent = null;
    await page.route("**/api/v1/company-profile", (route) => {
      cpSent = true;
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ message: "Company profile saved successfully" }) });
    });
    await page.click("#cpSaveBtn");
    await page.waitForTimeout(150);
    check("AI sanity: Company Profile actually saved", cpSent === true);

    await page.reload();
    await page.waitForTimeout(150);
    check("AI a bare reload lands back on the joke gate — that part still never persists", (await page.locator("#loginGate").count()) === 1);
    await signIn(page);
    await page.click('.op-item:has-text("Company Setup")');
    await page.waitForTimeout(150);
    check("AI the tool sign-in is remembered — landing straight on step 2, not step 1",
      (await page.locator("#setupCoBtn").count()) === 1 && (await page.locator("#setupSignInBtn").count()) === 0);
    check("AI a notice names the company that was connected before the reload",
      (await page.textContent(".validation-banner")).includes("Nexa Technologies"));

    await mockCompanyOk(page, "Nexa Technologies", "company_admin");
    await page.fill("#setupCoEmail", "a@b.com");
    await page.fill("#setupCoPass", "whatever");
    await page.click("#setupCoBtn");
    await page.waitForTimeout(150);
    check("AI reconnecting to the same company restores its done-dots from before the reload",
      (await page.textContent(".settings-card:has-text('Company Settings') .tally")).includes("1/6"));

    await page.click("#setupDisconnectBtn");
    await page.waitForTimeout(80);
    await mockCompanyOk(page, "A Totally Different Company", "company_admin");
    await page.fill("#setupCoEmail", "x@y.com");
    await page.fill("#setupCoPass", "whatever");
    await page.click("#setupCoBtn");
    await page.waitForTimeout(150);
    check("AI a different company gets a clean slate, not the previous company's done-dots",
      (await page.textContent(".settings-card:has-text('Company Settings') .tally")).includes("0/6"));
    check("AI no page errors across the whole flow", errs.length === 0, errs.join(" | "));

    await page.click("#setupSignOutBtn");
    await page.waitForTimeout(100);
    await page.reload();
    await page.waitForTimeout(150);
    await signIn(page);
    await page.click('.op-item:has-text("Company Setup")');
    await page.waitForTimeout(100);
    check("AI Sign out clears the tool session too — the next reload lands back on step 1", (await page.locator("#setupSignInBtn").count()) === 1);
    check("AI ...and the last-session notice too — nothing lingers to greet the next person",
      (await page.locator(".validation-banner").count()) === 0);
    await page.close();
  }

  /* ---------- AJ. Department Management — "create the 6 defaults" bulk mode ---------- */
  {
    const page = await browser.newContext().then((c) => c.newPage());
    const errs = watchPageErrors(page);
    await toGrid(page, "Nexa Technologies");
    await page.click(".settings-card:has-text('Company Settings')");
    await page.waitForTimeout(100);
    await page.click('.settings-tab[data-module="departments"]');
    await page.waitForTimeout(100);

    await page.click("#deptBulkEnterLink");
    await page.waitForTimeout(80);
    check("AJ shows exactly the 6 real default department names, in order",
      JSON.stringify(await page.locator(".bulk-row-name").allTextContents()) === JSON.stringify(DEFAULT_DEPARTMENTS.map((d) => d.name)));
    check("AJ all 6 start selected", (await page.textContent("#deptBulkCreateBtn")).includes("(6)"));

    await page.click(".bulk-row:nth-child(3) input"); // Sales & Business
    await page.waitForTimeout(60);
    check("AJ unchecking one drops the count to 5", (await page.textContent("#deptBulkCreateBtn")).includes("(5)"));

    let sentNames = [];
    await page.route("**/api/v1/departments", (route) => {
      if (route.request().method() !== "POST") return route.continue();
      const body = route.request().postDataJSON();
      sentNames.push(body.name);
      route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ status: "success", message: "Department created successfully", data: { id: "d" + sentNames.length, name: body.name } }) });
    });
    await page.click("#deptBulkCreateBtn");
    await page.waitForFunction(() => !document.querySelector("#deptBulkStopBtn"), { timeout: 5000 });
    check("AJ exactly the 5 selected departments were actually sent, not the unchecked one",
      JSON.stringify(sentNames) === JSON.stringify(DEFAULT_DEPARTMENTS.map((d) => d.name).filter((n) => n !== "Sales & Business")), JSON.stringify(sentNames));
    check("AJ the unselected row never left its starting state", (await page.locator(".bulk-row:has-text('Sales & Business')").textContent()).includes("not started"));
    check("AJ every created row shows done", (await page.locator(".bulk-row:has-text('done')").count()) === 5);
    check("AJ the tab picks up a done marker from a bulk run, same as a single save", (await page.locator('.settings-tab[data-module="departments"] .op-dot').count()) === 1);

    await page.click("#deptBulkCancelBtn");
    await page.waitForTimeout(80);
    check("AJ Back returns to the single-department form", (await page.locator("#deptModSaveBtn").count()) === 1);
    check("AJ no page errors through the whole bulk flow", errs.length === 0, errs.join(" | "));
    await page.close();
  }

  /* ---------- AJ2. Department Management — already-existing defaults are marked, not re-offered (2026-09-12) ----------

     Real bug, reported step by step by the user: a company that already
     had some of its default departments (created earlier, by hand or by
     an earlier bulk run) still had the bulk shortcut offer all 6 as if
     none existed — clicking through would send a real duplicate-name
     POST. Checked live against `GET /departments/active`, matched by
     name (case-insensitive, trimmed). */
  {
    const page = await browser.newContext().then((c) => c.newPage());
    const errs = watchPageErrors(page);
    await toGrid(page, "Nexa Technologies");
    await page.route("**/api/v1/departments/active", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success", data: [
        { id: "d1", name: "HR" },
        { id: "d2", name: "operations" }, // deliberately different case, to confirm the match is case-insensitive
      ] }) })
    );
    await page.click(".settings-card:has-text('Company Settings')");
    await page.click('.settings-tab[data-module="departments"]');
    await page.waitForSelector("#deptModName", { timeout: 5000 });
    await page.waitForTimeout(200); // the background existing-check
    await page.click("#deptBulkEnterLink");
    await page.waitForTimeout(100);
    check("AJ2 HR is marked already-existing, unchecked and disabled",
      (await page.locator('.bulk-row:has-text("HR")').textContent()).includes("skipped") &&
        !(await page.locator('.bulk-row:has-text("HR") input').isChecked()) &&
        (await page.locator('.bulk-row:has-text("HR") input').isDisabled()));
    check("AJ2 Operations is marked already-existing too, matched case-insensitively",
      (await page.locator('.bulk-row:has-text("Operations")').textContent()).includes("skipped"));
    check("AJ2 the other 4 defaults are still offered normally",
      (await page.locator('.bulk-row:has-text("Engineering/IT") input').isChecked()) &&
        !(await page.locator('.bulk-row:has-text("Engineering/IT") input').isDisabled()));
    check("AJ2 Create selected only counts the 4 that don't already exist", (await page.textContent("#deptBulkCreateBtn")).includes("(4)"));
    check("AJ2 no page errors", errs.length === 0, errs.join(" | "));
    await page.close();
  }

  /* ---------- AK. Designation Management — bulk mode matches this company's *real* departments, whatever they're named (fixed 2026-09-12) ----------

     Confirmed genuinely wrong, found live: this used to walk the fixed
     6-name DEFAULT_DEPARTMENTS list and match each against the real
     company by name, so a company with custom department names (the
     normal case) got a wall of "skipped" rows and none of its actual
     departments got a bulk designation option at all. Now walks the
     real fetched department list itself — a real department matching a
     known default name still gets that default's own curated 4 titles,
     any other real department gets DESIGNATION_NAMES's 4 generic ones. */
  {
    const page = await browser.newContext().then((c) => c.newPage());
    const errs = watchPageErrors(page);
    await toGrid(page, "Nexa Technologies");

    // 3 real departments matching known defaults by name + 1 fully custom one this company actually has
    const seeded = [
      { id: "rd0", name: "HR" },
      { id: "rd1", name: "Engineering/IT" },
      { id: "rd2", name: "Operations" },
      { id: "rd3", name: "Supply Chain" }, // not one of the 6 defaults at all
    ];
    await page.route("**/api/v1/departments/active", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success", data: seeded }) })
    );
    await page.click(".settings-card:has-text('Company Settings')");
    await page.waitForTimeout(100);
    await page.click('.settings-tab[data-module="designations"]');
    await page.waitForFunction(() => document.querySelector("#setupBody").textContent.includes("Designation"), { timeout: 5000 });
    await page.waitForTimeout(100);

    check("AK the shortcut button names this company's real department count, not a fixed 6",
      (await page.textContent("#desigBulkEnterLink")).includes("4 department"));
    await page.click("#desigBulkEnterLink");
    await page.waitForTimeout(80);
    check("AK exactly 16 rows (this company's 4 real departments x 4), not a fixed 24", (await page.locator(".bulk-row").count()) === 16);
    check("AK nothing is skipped — every row is for a department that genuinely exists", (await page.locator(".bulk-row:has-text('skipped')").count()) === 0);
    check("AK every row starts selected and enabled", await page.locator(".bulk-row input").evaluateAll((els) => els.every((el) => el.checked && !el.disabled)));
    check("AK the create count covers all 16", (await page.textContent("#desigBulkCreateBtn")).includes("(16)"));
    check("AK rows are grouped under all 4 real department names as headings", (await page.locator(".bulk-group-label").count()) === 4);
    check("AK a real department matching a known default gets that default's own curated titles",
      (await page.textContent("#setupBody")).includes("HR Business Partner"));
    check("AK a real custom department (not one of the 6 defaults) still gets the generic 4 titles, not skipped",
      (await page.textContent("#setupBody")).includes("Supply Chain") && (await page.textContent("#setupBody")).includes("Assistant Manager"));

    let sent = [];
    await page.route("**/api/v1/designations", (route) => {
      if (route.request().method() !== "POST") return route.continue();
      const body = route.request().postDataJSON();
      sent.push(body);
      route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ status: "success", message: "Designation created successfully" }) });
    });
    await page.click("#desigBulkCreateBtn");
    await page.waitForFunction(() => !document.querySelector("#desigBulkStopBtn"), { timeout: 10000 });
    check("AK all 16 designations were sent, including 4 for the custom department", sent.length === 16, String(sent.length));
    check("AK every sent designation carries one of this company's real department ids",
      sent.every((s) => seeded.some((d) => d.id === s.departmentIds[0])));
    check("AK the custom department's real id was used, same as any other", sent.some((s) => s.departmentIds[0] === "rd3"));
    check("AK the tab picks up a done marker", (await page.locator('.settings-tab[data-module="designations"] .op-dot').count()) === 1);
    check("AK no page errors through the whole dependency + bulk flow", errs.length === 0, errs.join(" | "));
    await page.close();
  }

  /* ---------- AK2. Designation Management — already-existing (name, department) pairs are marked, not re-offered (2026-09-12) ----------

     Same real bug as AJ2's, reported by the user step by step, applied
     here: matched by name *and* department together, since the same
     title can legitimately exist in more than one department — only the
     exact (name, department) pair that already exists should be
     excluded, everything else stays offered normally. */
  {
    const page = await browser.newContext().then((c) => c.newPage());
    const errs = watchPageErrors(page);
    await toGrid(page, "Nexa Technologies");
    await page.route("**/api/v1/departments/active", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success", data: [
        { id: "rd0", name: "HR" },
        { id: "rd1", name: "Engineering/IT" },
      ] }) })
    );
    await page.route("**/api/v1/designations/active**", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success", data: [
        { id: "x1", name: "HR Business Partner", department: { id: "rd0", name: "HR" } },
      ] }) })
    );
    await page.click(".settings-card:has-text('Company Settings')");
    await page.click('.settings-tab[data-module="designations"]');
    await page.waitForSelector("#desigName", { timeout: 5000 });
    await page.click("#desigBulkEnterLink");
    await page.waitForTimeout(80);

    const rows = await page.locator(".bulk-row").evaluateAll((els) =>
      els.map((el) => ({ text: el.querySelector(".bulk-row-name").textContent.trim(), skipped: el.textContent.includes("skipped") }))
    );
    const hrBusinessPartnerRows = rows.filter((r) => r.text === "HR Business Partner");
    check("AK2 exactly one row is named 'HR Business Partner' (HR's own curated title, not duplicated into Engineering/IT)", hrBusinessPartnerRows.length === 1, JSON.stringify(rows));
    check("AK2 that HR Business Partner row is marked already-existing", hrBusinessPartnerRows[0]?.skipped === true, JSON.stringify(rows));
    check("AK2 every other row (including Engineering/IT's own titles) is left alone", rows.filter((r) => r.text !== "HR Business Partner").every((r) => !r.skipped), JSON.stringify(rows));
    check("AK2 no page errors", errs.length === 0, errs.join(" | "));
    await page.close();
  }

  /* ---------- AL. a bulk run in progress blocks navigating away, and Stop halts it between items ---------- */
  {
    const page = await browser.newContext().then((c) => c.newPage());
    const errs = watchPageErrors(page);
    await toGrid(page, "Nexa Technologies");
    await page.click(".settings-card:has-text('Company Settings')");
    await page.waitForTimeout(100);
    await page.click('.settings-tab[data-module="departments"]');
    await page.waitForTimeout(100);
    await page.click("#deptBulkEnterLink");
    await page.waitForTimeout(80);
    await page.route("**/api/v1/departments/active", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success", data: [] }) })
    );

    let created = 0;
    await page.route("**/api/v1/departments", (route) => {
      if (route.request().method() !== "POST") return route.continue();
      created++;
      setTimeout(() => route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ status: "success", message: "Department created successfully", data: { id: "d" + created } }) }), 120);
    });
    await page.click("#deptBulkCreateBtn");
    await page.waitForSelector("#deptBulkStopBtn", { timeout: 5000 });

    await page.click('.settings-tab[data-module="designations"]');
    await page.waitForTimeout(60);
    check("AL clicking another tab mid-run is ignored — still on Department Management",
      (await page.getAttribute('.settings-tab[aria-current="true"]', "data-module")) === "departments");

    await page.click("#deptBulkStopBtn");
    await page.waitForFunction(() => !document.querySelector("#deptBulkStopBtn"), { timeout: 5000 });
    check("AL Stop halted the run before all 6 were created", created > 0 && created < 6, String(created));

    await page.click('.settings-tab[data-module="designations"]');
    await page.waitForTimeout(80);
    check("AL navigation works normally again once the run has actually stopped",
      (await page.getAttribute('.settings-tab[aria-current="true"]', "data-module")) === "designations");
    check("AL no page errors", errs.length === 0, errs.join(" | "));
    await page.close();
  }

  /* ---------- AM. a 401 gets a named "your session expired" message, not a raw server string ----------

     Requested directly after a real staging token expired mid-session
     and every module just showed the server's own "Unauthorized
     access!" behind a "Try again" that could only ever fail again with
     the same stale token. */
  {
    const page = await browser.newContext().then((c) => c.newPage());
    const errs = watchPageErrors(page);
    await toGrid(page, "Nexa Technologies");

    await page.route("**/api/v1/departments/active", (route) =>
      route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ message: "Unauthorized access!" }) })
    );
    await page.click(".settings-card:has-text('Company Settings')");
    await page.waitForTimeout(100);
    await page.click('.settings-tab[data-module="designations"]');
    await page.waitForFunction(() => document.querySelector("#setupBody").textContent.includes("Try again"), { timeout: 5000 });
    check("AM a dependency check's 401 shows the named session-expired message, not the server's raw 'Unauthorized access!'",
      (await page.textContent("#setupBody")).includes("Your session with this company may have expired"));
    check("AM ...and points at the actual control that fixes it", (await page.textContent("#setupBody")).includes("Disconnect this company"));

    await page.route("**/api/v1/company-profile", (route) =>
      route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ message: "Unauthorized access!" }) })
    );
    await page.click('.settings-tab[data-module="company_profile"]');
    await page.waitForTimeout(100);
    await page.click("#cpSaveBtn");
    await page.waitForTimeout(150);
    check("AM a module save's 401 gets the same treatment, not the raw server string",
      (await page.textContent("#cpError")).includes("Your session with this company may have expired"));

    check("AM no page errors", errs.length === 0, errs.join(" | "));
    await page.close();
  }

  /* ---------- AN. the 401 fix wasn't accidentally widened to the logins themselves ---------- */
  {
    const page = await browser.newContext().then((c) => c.newPage());
    await mockSupabaseOk(page);
    await mockCompanyFail(page); // 401, "Wrong email or password."
    await gotoSetup(page);
    await page.fill("#setupEmail", "mahmudur@shomvob.com");
    await page.fill("#setupPass", "whatever");
    await page.click("#setupSignInBtn");
    await page.waitForTimeout(150);
    await page.fill("#setupCoEmail", "wrong@company.com");
    await page.fill("#setupCoPass", "wrong");
    await page.click("#setupCoBtn");
    await page.waitForTimeout(150);
    check("AN a genuinely wrong company password still says so — 401 handling wasn't widened to the login itself",
      (await page.textContent("#setupCoError")) === "Wrong email or password.");
    await page.close();
  }

  /* ---------- AO. group cards show which specific module is done, not just a count ---------- */
  {
    const page = await browser.newContext({ viewport: { width: 1440, height: 900 } }).then((c) => c.newPage());
    const errs = watchPageErrors(page);
    await toGrid(page, "Nexa Technologies");
    const companyCard = page.locator(".settings-card:has-text('Company Settings')");
    check("AO a fresh card has one dot per module, none done", (await companyCard.locator(".settings-card-dot").count()) === 6);
    check("AO ...and none of them are the done colour yet", (await companyCard.locator(".settings-card-dot.done").count()) === 0);
    check("AO Payroll's card has 11 dots — one per module, not one per group", (await page.locator(".settings-card:has-text('Payroll') .settings-card-dot").count()) === 11);

    await page.click(".settings-card:has-text('Company Settings')");
    await page.waitForTimeout(100);
    await page.click('.settings-tab[data-module="departments"]');
    await page.waitForTimeout(100);
    await page.route("**/api/v1/departments", (route) =>
      route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ status: "success", message: "Department created successfully", data: { id: "d1" } }) })
    );
    await page.click("#deptModSaveBtn");
    await page.waitForTimeout(150);
    await page.click("#setupBackToModules");
    await page.waitForTimeout(80);
    check("AO exactly one dot turns green after saving one of the six", (await companyCard.locator(".settings-card-dot.done").count()) === 1);
    check("AO hovering (its title) names the specific module, not just 'done'",
      (await companyCard.locator(".settings-card-dot.done").getAttribute("title")) === "Department Management — done");
    check("AO no page errors", errs.length === 0, errs.join(" | "));
    await page.close();
  }

  /* ---------- AP. a visible "created this session" list for modules where Save makes a new record each time ---------- */
  {
    const page = await browser.newContext().then((c) => c.newPage());
    const errs = watchPageErrors(page);
    await toGrid(page, "Nexa Technologies");
    await page.click(".settings-card:has-text('Company Settings')");
    await page.waitForTimeout(100);
    await page.click('.settings-tab[data-module="departments"]');
    await page.waitForTimeout(100);
    check("AP nothing shown before any save", (await page.locator("#setupBody .bulk-list, :text('Created this session')").count()) === 0);

    let n = 0;
    await page.route("**/api/v1/departments", (route) => {
      n++;
      route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ status: "success", message: "Department created successfully", data: { id: "d" + n } }) });
    });
    const firstName = await page.inputValue("#deptModName");
    await page.click("#deptModSaveBtn");
    await page.waitForTimeout(150);
    check("AP the list appears after the first save, naming it", (await page.textContent("#setupBody")).includes(`Created this session (1)`) && (await page.textContent("#setupBody")).includes(firstName));

    await page.click("#deptModRegenerateBtn");
    await page.waitForTimeout(1200);
    const secondName = await page.inputValue("#deptModName");
    await page.click("#deptModSaveBtn");
    await page.waitForTimeout(150);
    check("AP a second save accumulates, it doesn't replace the first",
      (await page.textContent("#setupBody")).includes("Created this session (2)") &&
      (await page.textContent("#setupBody")).includes(firstName) &&
      (await page.textContent("#setupBody")).includes(secondName));

    // bulk create also feeds the same list
    await page.click("#deptBulkEnterLink");
    await page.waitForTimeout(80);
    await page.click("#deptBulkCreateBtn");
    await page.waitForFunction(() => !document.querySelector("#deptBulkStopBtn"), { timeout: 5000 });
    await page.click("#deptBulkCancelBtn");
    await page.waitForTimeout(80);
    check("AP a bulk run's creates land in the same list as single-form saves",
      (await page.textContent("#setupBody")).includes("Created this session (8)"), await page.textContent("#setupBody"));

    check("AP Disconnect clears the list — it's this company's, not carried to the next",
      await (async () => {
        await page.click("#setupDisconnectBtn");
        await page.waitForTimeout(80);
        await mockCompanyOk(page, "Nexa Technologies");
        await page.fill("#setupCoEmail", "a@b.com");
        await page.fill("#setupCoPass", "whatever");
        await page.click("#setupCoBtn");
        await page.waitForTimeout(150);
        await page.click(".settings-card:has-text('Company Settings')");
        await page.waitForTimeout(100);
        await page.click('.settings-tab[data-module="departments"]');
        await page.waitForTimeout(100);
        return (await page.locator(":text('Created this session')").count()) === 0;
      })());
    check("AP no page errors across the whole flow", errs.length === 0, errs.join(" | "));
    await page.close();
  }

  /* ---------- AQ. Reload/logout guard now covers being signed into Company Setup (2026-09-11) ---------- */
  {
    const page = await browser.newContext().then((c) => c.newPage());
    const errs = watchPageErrors(page);
    const unloadArmed = () =>
      page.evaluate(() => {
        const e = new Event("beforeunload", { cancelable: true });
        window.dispatchEvent(e);
        return e.defaultPrevented;
      });

    await page.goto(PAGE);
    await signIn(page);
    check("AQ reload is NOT guarded before Company Setup is even opened", !(await unloadArmed()));

    await page.click('.op-item:has-text("Company Setup")');
    await page.waitForSelector("#setupSignInBtn", { timeout: 5000 });
    await mockSupabaseOk(page);
    await page.fill("#setupEmail", "a@b.com");
    await page.fill("#setupPass", "x");
    await page.click("#setupSignInBtn");
    await page.waitForSelector("#setupCoBtn", { timeout: 5000 });
    check("AQ reload IS guarded as soon as the tool sign-in succeeds, before any company is even connected", await unloadArmed());

    await page.click("#logoutBtn");
    await page.waitForTimeout(150);
    const modalOpen = () => page.evaluate(() => !document.querySelector("#discardModal").hidden);
    check("AQ Log out asks before discarding a live Company Setup sign-in", await modalOpen());
    check("AQ the message names Company Setup, not the phase-1 generator wording", (await page.textContent("#discardBody")).includes("signed into Company Setup"));

    await page.click("#discardOk");
    await page.waitForSelector("#loginGate");
    check("AQ confirming returns to the joke gate", await page.isVisible("#loginGate"));
    check("AQ no page errors", errs.length === 0, errs.join(" | "));
    await page.close();
  }

  /* ---------- AR. Tool sign-in survives a reload; company login never does (2026-09-11) ---------- */
  {
    const page = await browser.newContext().then((c) => c.newPage());
    const errs = watchPageErrors(page);
    await page.goto(PAGE);
    await signIn(page);
    await page.click('.op-item:has-text("Company Setup")');
    await page.waitForSelector("#setupSignInBtn", { timeout: 5000 });

    await mockSupabaseOk(page);
    await page.fill("#setupEmail", "a@b.com");
    await page.fill("#setupPass", "x");
    await page.click("#setupSignInBtn");
    await page.waitForSelector("#setupCoBtn", { timeout: 5000 });

    await page.reload();
    await signIn(page); // the joke gate itself is never skipped — one click, same as always
    await page.waitForTimeout(300);
    check("AR a reload lands straight on the company-login step, not the dashboard", (await page.locator("#setupCoBtn").count()) === 1);
    check("AR Company Setup is the active sidebar item after the restore", (await page.textContent('.op-item[aria-current="true"]')).includes("Company Setup"));
    check("AR the company login itself is never restored — the fields are empty", (await page.inputValue("#setupCoEmail")) === "");

    /* Signing out clears the tool session too — it shouldn't come back on the next reload */
    await page.click("#setupSignOutBtn");
    await page.waitForTimeout(80);
    await page.reload();
    await signIn(page);
    await page.waitForTimeout(300);
    check("AR signing out clears the tool session — a later reload lands back on the dashboard", (await page.locator("#setupCoBtn, #setupSignInBtn").count()) === 0);
    check("AR no page errors", errs.length === 0, errs.join(" | "));
    await page.close();
  }

  /* ---------- AS. Leave Types — "create the default 3" (Annual/Casual/Sick), a fixed shape, not a random roll (2026-09-12) ---------- */
  {
    const page = await browser.newContext().then((c) => c.newPage());
    const errs = watchPageErrors(page);
    await toGrid(page, "Nexa Technologies");
    await page.click(".settings-card:has-text('Leave')");
    await page.waitForTimeout(100);

    check("AS the shortcut button is offered above the single-item form", (await page.locator("#ltBulkEnterLink").count()) === 1);
    await page.click("#ltBulkEnterLink");
    await page.waitForTimeout(80);
    check("AS exactly 3 rows: Annual, Casual, Sick", (await page.locator(".bulk-row").count()) === 3);
    check("AS Annual Leave is listed", (await page.locator(".bulk-row:has-text('Annual Leave')").count()) === 1);
    check("AS Casual Leave is listed", (await page.locator(".bulk-row:has-text('Casual Leave')").count()) === 1);
    check("AS Sick Leave is listed", (await page.locator(".bulk-row:has-text('Sick Leave')").count()) === 1);
    check("AS all 3 start selected", await page.locator(".bulk-row input").evaluateAll((els) => els.every((el) => el.checked)));

    let sent = [];
    await page.route("**/api/v1/leave-types", (route) => {
      if (route.request().method() !== "POST") return route.fallback(); // a bulk-created leave type invalidates and re-fetches the existing-check too
      sent.push(route.request().postDataJSON());
      route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ status: "success", message: "Leave type created successfully" }) });
    });
    await page.click("#ltBulkCreateBtn");
    await page.waitForFunction(() => !document.querySelector("#ltBulkStopBtn"), { timeout: 10000 });
    check("AS all 3 were sent", sent.length === 3, String(sent.length));
    check("AS names are exactly Annual/Casual/Sick Leave, in order", JSON.stringify(sent.map((s) => s.name)) === JSON.stringify(["Annual Leave", "Casual Leave", "Sick Leave"]));
    check("AS every other field is identical across all 3 — a fixed shape, not a per-item random roll",
      JSON.stringify({ ...sent[0], name: "X" }) === JSON.stringify({ ...sent[1], name: "X" }) && JSON.stringify({ ...sent[1], name: "X" }) === JSON.stringify({ ...sent[2], name: "X" }));
    check("AS the fixed shape matches the real payload confirmed by the user — every optional thing off/default",
      sent[0] &&
        sent[0].consecutiveLimit === false &&
        sent[0].monthlyLimit === false &&
        sent[0].allowBackdatedLeave === false &&
        sent[0].documentRequired === false &&
        sent[0].carryForwardEnabled === false &&
        sent[0].sandwichRuleEnabled === false &&
        sent[0].isBridge === false &&
        sent[0].isLeaveReset === true &&
        sent[0].leaveResetCycle === "calendar_year" &&
        sent[0].prorataCalculation === true,
      JSON.stringify(sent[0]));
    check("AS the tab picks up a done marker", (await page.locator('.settings-tab[data-module="leave_types"] .op-dot').count()) === 1);

    /* Confirmed genuinely broken live, 2026-09-12: Create had no disabled
       state once a run finished, so a second click re-sent duplicate
       real creates for everything already "done." */
    check("AS Create is disabled once every selected item is done — nothing left for it to do", await page.isDisabled("#ltBulkCreateBtn"));
    check("AS a done item's checkbox is disabled too, not just visually finished", await page.locator(".bulk-row input").evaluateAll((els) => els.every((el) => el.disabled)));
    await page.click("#ltBulkCreateBtn", { force: true }).catch(() => {});
    await page.waitForTimeout(150);
    check("AS a forced click on the disabled button sends nothing further", sent.length === 3, String(sent.length));
    // the run finished but stays on the bulk list (showing "done" statuses) until Back is clicked
    await page.click("#ltBulkCancelBtn");
    await page.waitForTimeout(60);
    check("AS Back returns to the single-item form", (await page.locator("#ltSaveBtn").count()) === 1);
    check("AS no page errors through the whole bulk flow", errs.length === 0, errs.join(" | "));
    await page.close();
  }

  /* ---------- AS2. Leave Types — already-existing defaults are marked, not re-offered (2026-09-12) ----------

     Real bug, reported step by step by the user, illustrated with a
     screenshot of a real company: it already had all 3 defaults plus a
     4th, hand-made one — "Create the default 3" still offered all 3 as
     if none existed. Checked live against `GET /leave-types`, matched by
     literal name. */
  {
    const page = await browser.newContext().then((c) => c.newPage());
    const errs = watchPageErrors(page);
    await toGrid(page, "Nexa Technologies");
    await page.route("**/api/v1/leave-types", (route) => {
      if (route.request().method() !== "GET") return route.fallback();
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success", data: [
        { id: "lt1", name: "Annual Leave", seMaxDaysPerInstance: null },
        { id: "lt2", name: "Senti Leave", seMaxDaysPerInstance: null }, // a hand-made 4th, unrelated to the 3 defaults
      ] }) });
    });
    await page.click(".settings-card:has-text('Leave')");
    await page.waitForSelector("#ltName", { timeout: 5000 });
    await page.waitForTimeout(200); // the background existing-check
    await page.click("#ltBulkEnterLink");
    await page.waitForTimeout(100);
    check("AS2 Annual Leave is marked already-existing, unchecked and disabled",
      (await page.locator('.bulk-row:has-text("Annual Leave")').textContent()).includes("skipped") &&
        !(await page.locator('.bulk-row:has-text("Annual Leave") input').isChecked()) &&
        (await page.locator('.bulk-row:has-text("Annual Leave") input').isDisabled()));
    check("AS2 Casual and Sick are still offered normally — only the real match is skipped",
      (await page.locator('.bulk-row:has-text("Casual Leave") input').isChecked()) &&
        !(await page.locator('.bulk-row:has-text("Casual Leave") input').isDisabled()) &&
        (await page.locator('.bulk-row:has-text("Sick Leave") input').isChecked()) &&
        !(await page.locator('.bulk-row:has-text("Sick Leave") input').isDisabled()));
    check("AS2 the hand-made 4th (Senti Leave) doesn't appear in this fixed 3-item list at all",
      (await page.locator('.bulk-row:has-text("Senti Leave")').count()) === 0);
    check("AS2 Create selected only counts the 2 that don't already exist", (await page.textContent("#ltBulkCreateBtn")).includes("(2)"));
    check("AS2 no page errors", errs.length === 0, errs.join(" | "));
    await page.close();
  }

  /* ---------- AT. "Go to next settings" — one tab over within the group, absent on the last (2026-09-12) ---------- */
  {
    const page = await browser.newContext().then((c) => c.newPage());
    const errs = watchPageErrors(page);
    await toGrid(page, "Nexa Technologies");
    await page.route("**/api/v1/departments/active", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success", data: [{ id: "d1", name: "HR" }] }) })
    );
    await page.click(".settings-card:has-text('Company Settings')");
    await page.waitForTimeout(100);

    check("AT present on the first module, naming the second", (await page.textContent("#setupNextModuleBtn")).includes("Bank Info"));
    await page.click("#setupNextModuleBtn");
    await page.waitForTimeout(80);
    check("AT clicking it actually switches to that module", (await page.getAttribute('.settings-tab[aria-current="true"]', "data-module")) === "bank_info");
    check("AT and now names the one after that", (await page.textContent("#setupNextModuleBtn")).includes("Location Types"));

    await page.click('.settings-tab[data-module="designations"]');
    await page.waitForTimeout(80);
    check("AT absent on a group's last module — nothing to go to", (await page.locator("#setupNextModuleBtn").count()) === 0);

    // never crosses into the next group
    await page.click(".settings-tab:has-text('Company Profile')");
    await page.waitForTimeout(80);
    for (let i = 0; i < 5; i++) {
      await page.click("#setupNextModuleBtn");
      await page.waitForTimeout(60);
    }
    check("AT five clicks from the first module lands on the group's own last module, not into another group",
      (await page.getAttribute('.settings-tab[aria-current="true"]', "data-module")) === "designations" && (await page.locator("#setupNextModuleBtn").count()) === 0);

    // blocked the same way every other navigation is mid-bulk-run
    await page.click('.settings-tab[data-module="departments"]');
    await page.waitForTimeout(80);
    await page.click("#deptBulkEnterLink");
    await page.waitForTimeout(80);
    await page.route("**/api/v1/departments", (route) => {
      if (route.request().method() !== "POST") return route.continue();
      setTimeout(() => route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ status: "success", message: "Department created successfully", data: { id: "dx" } }) }), 150);
    });
    await page.click("#deptBulkCreateBtn");
    await page.waitForSelector("#deptBulkStopBtn", { timeout: 5000 });
    const hasNextMidRun = (await page.locator("#setupNextModuleBtn").count()) > 0;
    if (hasNextMidRun) await page.click("#setupNextModuleBtn");
    await page.waitForTimeout(60);
    check("AT mid-bulk-run, Next is either absent or a click on it is ignored — still on Department Management",
      (await page.getAttribute('.settings-tab[aria-current="true"]', "data-module")) === "departments");
    await page.click("#deptBulkStopBtn");
    await page.waitForFunction(() => !document.querySelector("#deptBulkStopBtn"), { timeout: 5000 });

    check("AT no page errors", errs.length === 0, errs.join(" | "));
    await page.close();
  }

  /* ---------- AU. Holiday Calendar — third Leave module, a bare GET trigger (2026-09-12) ---------- */
  {
    const page = await browser.newContext().then((c) => c.newPage());
    const errs = watchPageErrors(page);
    await toGrid(page);
    await page.click(".settings-card:has-text('Leave')");
    await page.waitForTimeout(100);
    check("AU is the third tab in the Leave group", (await page.locator(".settings-tabs .settings-tab").nth(2).textContent()).includes("Holiday Calendar"));

    await page.click('.settings-tab[data-module="holiday_calendar"]');
    await page.waitForTimeout(100);
    check("AU nothing to configure — no field, no Regenerate", (await page.locator("#setupBody input, #setupBody select").count()) === 0);
    check("AU it's the group's last module — no 'Go to next settings'", (await page.locator("#setupNextModuleBtn").count()) === 0);

    let method = null;
    let hitBody = "sent-something";
    await page.route("**/api/v1/leave-management/holidays/public/sync", (route) => {
      method = route.request().method();
      hitBody = route.request().postData();
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success", message: "Holidays synced successfully" }) });
    });
    await page.click("#hcSyncBtn");
    await page.waitForTimeout(150);
    check("AU calls the real endpoint with GET, not POST", method === "GET", String(method));
    check("AU a GET carries no body", hitBody === null || hitBody === undefined, String(hitBody));
    check("AU shows the server's own success text", (await page.textContent("#setupBody")).includes("Synced."));
    check("AU the tab picks up a done marker", (await page.locator('.settings-tab[data-module="holiday_calendar"] .op-dot').count()) === 1);

    // a 401 gets the named session-expired message, same discipline as every other module
    await page.unroute("**/api/v1/leave-management/holidays/public/sync");
    await page.route("**/api/v1/leave-management/holidays/public/sync", (route) =>
      route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ message: "Unauthorized access!" }) })
    );
    await page.click("#hcSyncBtn");
    await page.waitForTimeout(150);
    check("AU a 401 shows the named session-expired message, not the server's raw string",
      (await page.textContent("#hcError")).includes("session with this company may have expired"));
    check("AU no page errors", errs.length === 0, errs.join(" | "));
    await page.close();
  }

  /* ---------- AV. Leave Types — Sandwich/Bridge are real toggles now, Consecutive/Monthly/Carry-Forward are back to internal-only (2026-09-12) ---------- */
  {
    const page = await browser.newContext().then((c) => c.newPage());
    const errs = watchPageErrors(page);
    await toGrid(page);
    await page.click(".settings-card:has-text('Leave')");
    await page.waitForTimeout(100);

    check("AV Consecutive/Monthly/Carry-Forward are no longer exposed as their own fields",
      (await page.locator("#ltConsecutiveSeg, #ltMonthlySeg, #ltCarrySeg").count()) === 0);
    check("AV Sandwich and Bridge are real toggle switches, modeled on the real product's own screens",
      (await page.locator("#ltSandwichToggle").count()) === 1 && (await page.locator("#ltBridgeToggle").count()) === 1);

    // force Sandwich/Bridge off first, regardless of what generated, then flip both on
    if (await page.isChecked("#ltSandwichToggle")) await page.uncheck("#ltSandwichToggle");
    if (await page.isChecked("#ltBridgeToggle")) await page.uncheck("#ltBridgeToggle");
    await page.waitForTimeout(60);
    check("AV Sandwich sub-sections are hidden when off",
      (await page.locator('input[name="ltSandwichMode"], #ltSandwichWeekendCb, #ltSandwichHolidayCb').count()) === 0);
    check("AV Bridge sub-section is hidden when off", (await page.locator('input[name="ltBridgeMode"]').count()) === 0);

    await page.fill("#ltName", "Hand-Edited Leave Name");
    await page.check("#ltSandwichToggle");
    await page.waitForTimeout(60);
    check("AV Sandwich sub-sections appear once turned on",
      (await page.locator('input[name="ltSandwichMode"]').count()) === 2 && (await page.locator("#ltSandwichWeekendCb").count()) === 1 && (await page.locator("#ltSandwichHolidayCb").count()) === 1);
    check("AV hand-edited name survived the Sandwich toggle's re-render", (await page.inputValue("#ltName")) === "Hand-Edited Leave Name");

    await page.check("#ltBridgeToggle");
    await page.waitForTimeout(60);
    check("AV Bridge's policy cards appear once turned on", (await page.locator('input[name="ltBridgeMode"]').count()) === 2);
    check("AV hand-edited name still intact after the Bridge toggle too", (await page.inputValue("#ltName")) === "Hand-Edited Leave Name");

    await page.click('input[name="ltSandwichMode"][value="optional"]');
    await page.uncheck("#ltSandwichWeekendCb");
    await page.uncheck("#ltSandwichHolidayCb");
    await page.click('input[name="ltBridgeMode"][value="direct"]');
    await page.waitForTimeout(60);
    check("AV the selected policy card picks up the 'on' highlight", (await page.getAttribute('label:has(input[name="ltSandwichMode"][value="optional"])', "class") || "").includes("on"));
    check("AV hand-edited name survived every sub-field change too", (await page.inputValue("#ltName")) === "Hand-Edited Leave Name");

    let sent = null;
    await page.route("**/api/v1/leave-types", (route) => {
      if (route.request().method() !== "POST") return route.fallback(); // the Save success handler invalidates and immediately re-fetches the existing-check too
      sent = route.request().postDataJSON();
      route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ status: "success", message: "Leave type created successfully" }) });
    });
    await page.click("#ltSaveBtn");
    await page.waitForTimeout(150);
    check("AV the hand-edited name is what's sent", sent && sent.name === "Hand-Edited Leave Name", JSON.stringify(sent));
    check("AV sandwichRuleEnabled/isBridge reflect the toggles actually clicked", sent && sent.sandwichRuleEnabled === true && sent.isBridge === true);
    check("AV the sub-field choices actually made are what's sent",
      sent && sent.sandwichMode === "optional" && sent.sandwichIncludeWeekend === false && sent.sandwichIncludeHoliday === false && sent.bridgeMode === "direct",
      JSON.stringify(sent));
    check("AV prorataCalculation always defaults true now, not a coin flip", sent && sent.prorataCalculation === true);
    check("AV no page errors", errs.length === 0, errs.join(" | "));
    await page.close();
  }

  /* ---------- AW. "Run every default" — the master orchestration, a curated list (2026-09-14) ----------

     One click runs a curated set of modules — not literally every module
     in every group — direct request, with an explicit list: Company
     Settings (Company Profile, Bank Info, Location Types, Locations —
     replacing the old Locations/Branch Management module entirely,
     2026-09-24 — Department, Designation), Attendance Policy, Schedule
     Management (Create Roster, Create Roster Pattern — added 2026-09-24,
     direct request: "ei schedule management ta Standard setup e add koro
     attendance er pore"), Leave (Leave Types, Leave Policy, Holiday
     Calendar), and 6 of Payroll's 11 (General, Salary Components,
     Configure Salary Components, Bonus Types, Bonus Policy, Tax) —
     Employee Settings and Payroll's Late Arrival/Absent Deduction/
     Overtime/Attendance Bonus/Custom Addition-Deduction are deliberately
     left out (`MASTER_RUN_MODULE_IDS` in app.js). Every real cross-module
     dependency within that list (Location Types→Locations, Department→
     Designation, Create Roster→Create Roster Pattern, Leave Types→
     Leave Policy, Salary Components→Configure Salary Components, Bonus
     Types→Bonus Policy) resolves itself automatically because
     `MASTER_RUN_MODULE_IDS` preserves SETTINGS_GROUPS' own
     dependency-safe order. */
  {
    const page = await browser.newContext().then((c) => c.newPage());
    const errs = watchPageErrors(page);
    const createdDepartments = [];
    const createdDesignations = [];
    const createdLeaveTypes = [];
    const createdSalaryComponents = [];
    const createdBonusTypes = [];
    const createdBonusPolicies = [];
    const realDepartments = [];
    const realDesignations = [];
    const realLeaveTypes = [];
    const realSalaryComponents = [];
    const realBonusTypes = [];
    const realTimeSlots = [];
    const createdTimeSlots = [];
    const createdPatterns = [];
    const realLocationTypes = [];
    const createdLocationTypes = [];
    const createdLocations = [];

    await toGrid(page);

    await page.route("**/api/v1/company-profile", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ message: "ok" }) }));
    await page.route("**/api/v1/company-bank-informations/save", (route) => route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ message: "ok" }) }));

    /* Location Types → Locations, 2026-09-24: a real cross-module
       dependency, same shape as Create Roster → Create Roster Pattern
       just above (Attendance Policy's own routes). */
    await page.route("**/api/v1/locations/location-types/paginated**", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success", data: { locationTypes: realLocationTypes } }) })
    );
    await page.route("**/api/v1/locations/location-types", (route) => {
      if (route.request().method() !== "POST") return route.continue();
      const body = route.request().postDataJSON();
      realLocationTypes.push({ id: "lt-1", name: body.name });
      createdLocationTypes.push(body.name);
      route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ message: "ok" }) });
    });
    await page.route("**/api/v1/locations", (route) => {
      if (route.request().method() === "GET") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success", data: { items: [] } }) });
      const body = route.request().postDataJSON();
      createdLocations.push(body.name);
      route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ message: "ok" }) });
    });

    await page.route("**/api/v1/departments/active", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success", data: realDepartments }) }));
    await page.route("**/api/v1/departments", (route) => {
      if (route.request().method() !== "POST") return route.continue();
      const body = route.request().postDataJSON();
      const id = "dep-" + (realDepartments.length + 1);
      realDepartments.push({ id, name: body.name });
      createdDepartments.push(body.name);
      route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ message: "ok", data: { id } }) });
    });

    await page.route("**/api/v1/designations/active**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success", data: realDesignations }) }));
    await page.route("**/api/v1/designations", (route) => {
      if (route.request().method() !== "POST") return route.continue();
      const body = route.request().postDataJSON();
      realDesignations.push({ id: "des-" + (realDesignations.length + 1), name: body.name, department: { id: body.departmentIds[0] } });
      createdDesignations.push(body.name);
      route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ message: "ok" }) });
    });

    await page.route("**/api/v1/attendance/policy/create", (route) => route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ message: "ok" }) }));
    await page.route("**/api/v1/attendance/policies", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success", data: [] }) }));

    /* Schedule Management, 2026-09-24: Create Roster runs right after
       Attendance Policy, then Create Roster Pattern — the first real
       cross-module dependency this master run exercises outside Company
       Settings' own Department→Designation pair. */
    await page.route("**/api/v1/workforce/time-slots", (route) => {
      if (route.request().method() === "GET") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success", data: { timeSlots: realTimeSlots } }) });
      const body = route.request().postDataJSON()[0];
      realTimeSlots.push({ id: "ts-1", name: body.name });
      createdTimeSlots.push(body.name);
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ message: "ok" }) });
    });
    await page.route("**/api/v1/workforce/patterns", (route) => {
      if (route.request().method() === "GET") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success", data: { patterns: [] } }) });
      const body = route.request().postDataJSON();
      createdPatterns.push(body.name);
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ message: "ok" }) });
    });

    /* 2026-09-15: "Run defaults" now checks each config-type module's own
       real GET before running it, so a fresh company's own 15-run pass
       needs a default "not configured yet" answer for all five — matches
       the real API's own shape, confirmed live against a real disposable
       staging company (curl). */
    await page.route("**/api/v1/company-profile", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success", message: "No company profile found", data: null }) }));
    await page.route("**/api/v1/company-bank-informations", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success", message: "Company bank information retrieved successfully", data: null }) }));

    await page.route("**/api/v1/leave-types", (route) => {
      if (route.request().method() === "GET") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success", data: realLeaveTypes }) });
      const body = route.request().postDataJSON();
      realLeaveTypes.push({ id: "lt-" + (realLeaveTypes.length + 1), name: body.name });
      createdLeaveTypes.push(body.name);
      route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ message: "ok" }) });
    });
    await page.route("**/api/v1/leave-policies", (route) => route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ message: "ok" }) }));
    await page.route("**/api/v1/leave-management/holidays/public/sync", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ message: "ok" }) }));

    let sentPayrollCycle = null;
    await page.route("**/api/v1/payroll/configuration/payroll-cycle", (route) => {
      if (route.request().method() === "GET") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success", message: "Pay cycle has not been configured yet.", data: null }) });
      sentPayrollCycle = route.request().postDataJSON();
      route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ message: "ok" }) });
    });

    await page.route("**/api/v1/payroll/configuration/salary-components?limit=100", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success", data: realSalaryComponents }) }));
    await page.route("**/api/v1/payroll/configuration/salary-components?status=Active&limit=100", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success", data: { components: realSalaryComponents, metadata: { total: realSalaryComponents.length } } }) })
    );
    await page.route("**/api/v1/payroll/configuration/salary-components", (route) => {
      if (route.request().method() !== "POST") return route.continue();
      const body = route.request().postDataJSON();
      realSalaryComponents.push({ id: "sc-" + (realSalaryComponents.length + 1), name: body.name, status: body.status });
      createdSalaryComponents.push(body.name);
      route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ message: "ok", data: { id: "sc-x" } }) });
    });
    let sentSalaryStructure = null;
    await page.route("**/api/v1/payroll/configuration/non-paygrade-structure", (route) => {
      if (route.request().method() === "GET") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success", message: "No salary structure found for this company. Please configure one first.", data: {} }) });
      sentSalaryStructure = route.request().postDataJSON();
      route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ message: "ok" }) });
    });

    await page.route("**/api/v1/bonus/configuration/types", (route) => {
      if (route.request().method() === "GET") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success", data: realBonusTypes }) });
      const body = route.request().postDataJSON();
      realBonusTypes.push({ id: "bt-" + (realBonusTypes.length + 1), typeName: body.typeName });
      createdBonusTypes.push(body.typeName);
      route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ message: "ok" }) });
    });
    await page.route("**/api/v1/bonus/configuration/policies", (route) => {
      if (route.request().method() === "GET") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success", data: { policies: [], total: 0 } }) });
      const body = route.request().postDataJSON();
      createdBonusPolicies.push(body.name);
      route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ message: "ok" }) });
    });

    await page.route("**/api/v1/payroll/configuration/tax-rules/toggle/Enable", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ message: "ok" }) }));
    await page.route("**/api/v1/payroll/configuration/tax-rules/list", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success", data: { rules: [], isEnabled: false } }) }));

    check("AW master run button is on the group grid", (await page.locator("#masterRunEnterBtn").count()) === 1);
    await page.click("#masterRunEnterBtn");
    await page.waitForSelector("#runDefaultsStartBtn", { timeout: 5000 });
    check("AW opens as a modal, not a page swap — the grid is still there behind it", (await page.locator(".settings-card").count()) === 6);
    check("AW modal title names what it's doing", (await page.locator("#runDefaultsTitle").textContent()).includes("standard setup"));
    check("AW master run gets its own quote", (await page.locator("#runDefaultsQuoteText").textContent()).includes("uselessness of today"));
    check("AW lists exactly the curated 18 modules, not every module in every group", (await page.locator("#runDefaultsList .bulk-row").count()) === 18);
    check("AW Employee Settings' modules are not in the list", (await page.locator('#runDefaultsList .bulk-row:has-text("Custom Fields"), #runDefaultsList .bulk-row:has-text("Required Documents")').count()) === 0);
    check("AW excluded Payroll modules are not in the list",
      (await page.locator('#runDefaultsList .bulk-row:has-text("Late Arrival"), #runDefaultsList .bulk-row:has-text("Absent Deduction"), #runDefaultsList .bulk-row:has-text("Overtime"), #runDefaultsList .bulk-row:has-text("Attendance Bonus"), #runDefaultsList .bulk-row:has-text("Custom Addition")').count()) === 0);
    check("AW master run's list is grouped by group label", (await page.locator("#runDefaultsList .bulk-group-label").count()) >= 4);

    await page.click("#runDefaultsStartBtn");
    await page.waitForFunction(() => document.querySelector("#runDefaultsBanner").textContent.includes("Finished"), { timeout: 15000 });
    const finishedText = (await page.locator("#runDefaultsBanner .validation-banner.success").textContent()).trim();
    check("AW finishes with all 18 run, nothing skipped or failed (every dependency in the list resolves itself)", finishedText.includes("18 run") && finishedText.includes("0 skipped") && !finishedText.includes("failed"), finishedText);

    check("AW General defaults to Calendar Month", sentPayrollCycle && sentPayrollCycle.payrollCycle === "calendar_month", JSON.stringify(sentPayrollCycle));
    check("AW Location Types' own default was created", JSON.stringify(createdLocationTypes) === JSON.stringify(["Baridhara"]), JSON.stringify(createdLocationTypes));
    check("AW Locations ran too (dependency on Location Types resolved automatically)", JSON.stringify(createdLocations) === JSON.stringify(["Railgate"]), JSON.stringify(createdLocations));
    check("AW Department's own 6 defaults were created", createdDepartments.length === 6, JSON.stringify(createdDepartments));
    check("AW Designation's own 24 defaults were created (dependency on Department resolved automatically)", createdDesignations.length === 24);
    check("AW Leave Types' own default 3 were created", JSON.stringify(createdLeaveTypes.sort()) === JSON.stringify(["Annual Leave", "Casual Leave", "Sick Leave"].sort()));
    check("AW Leave Policy ran too (dependency on Leave Types resolved automatically)", (await page.locator('#runDefaultsList .bulk-row:has-text("Leave Policy")').textContent()).includes("done"));
    check("AW Salary Components' own default 3 were created", JSON.stringify(createdSalaryComponents.sort()) === JSON.stringify(["Medical Allowance", "House Rent Allowance", "Internet Allowance"].sort()));
    check("AW Configure Salary Components ran with the 60/15/15/10 default filler (dependency resolved automatically)",
      sentSalaryStructure && sentSalaryStructure.basicSalaryPercentage === 60 && sentSalaryStructure.components.filter((c) => c.percentage === 15).length === 2 && sentSalaryStructure.components.filter((c) => c.percentage === 10).length === 1,
      JSON.stringify(sentSalaryStructure));
    check("AW Bonus Types' own default 2 were created", JSON.stringify(createdBonusTypes.sort()) === JSON.stringify(["Eid Bonus", "Bangla New Year Bonus"].sort()));
    check("AW Bonus Policy's default 3 were created, both Eid ones pointing at the one real Eid Bonus type",
      createdBonusPolicies.length === 3 && createdBonusPolicies.includes("Eid Ul Fitr Bonus Policy") && createdBonusPolicies.includes("Eid Ul Adha Bonus Policy") && createdBonusPolicies.includes("Bangla New Year Bonus Policy"));
    check("AW Tax row shows done", (await page.locator('#runDefaultsList .bulk-row:has-text("Tax")').textContent()).includes("done"));
    check("AW Create Roster's own default was created", JSON.stringify(createdTimeSlots) === JSON.stringify(["Default"]), JSON.stringify(createdTimeSlots));
    check("AW Create Roster Pattern ran too (dependency on Create Roster resolved automatically)", JSON.stringify(createdPatterns) === JSON.stringify(["Standard Pattern"]), JSON.stringify(createdPatterns));

    check("AW Close button reads 'Close' once everything is settled", (await page.locator("#runDefaultsCloseBtn").textContent()).trim() === "Close");
    await page.click("#runDefaultsCloseBtn");
    await page.waitForSelector("#runDefaultsModal[hidden]", { state: "attached", timeout: 5000 });
    check("AW every touched group card shows its done count updated after closing", (await page.locator(".settings-card:has-text('Payroll') .tally").textContent()).trim() !== "0/11 done");
    check("AW no page errors through the whole run", errs.length === 0, errs.join(" | "));
    await page.close();
  }

  /* ---------- AX. "Run this group's defaults" — scoped to one group, skip-if-done, Stop/resume (2026-09-14) ---------- */
  {
    const page = await browser.newContext().then((c) => c.newPage());
    const errs = watchPageErrors(page);
    const createdGeneral = [];
    const createdSalaryComponents = [];
    const realSalaryComponents = [];
    let slowGeneral = false;

    await toGrid(page);
    await page.route("**/api/v1/payroll/configuration/payroll-cycle", async (route) => {
      if (route.request().method() === "GET") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success", message: "Pay cycle has not been configured yet.", data: null }) });
      if (slowGeneral) await new Promise((r) => setTimeout(r, 800));
      createdGeneral.push(1);
      route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ message: "ok" }) });
    });
    await page.route("**/api/v1/payroll/configuration/salary-components?limit=100", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success", data: realSalaryComponents }) }));
    await page.route("**/api/v1/payroll/configuration/salary-components?status=Active&limit=100", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success", data: { components: realSalaryComponents, metadata: { total: realSalaryComponents.length } } }) })
    );
    await page.route("**/api/v1/payroll/configuration/salary-components", (route) => {
      if (route.request().method() !== "POST") return route.continue();
      const body = route.request().postDataJSON();
      realSalaryComponents.push({ id: "sc-" + (realSalaryComponents.length + 1), name: body.name, status: body.status });
      createdSalaryComponents.push(body.name);
      route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ message: "ok", data: { id: "sc-x" } }) });
    });
    await page.route("**/api/v1/payroll/configuration/non-paygrade-structure", (route) => {
      if (route.request().method() === "GET") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success", message: "No salary structure found for this company. Please configure one first.", data: {} }) });
      route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ message: "ok" }) });
    });
    await page.route("**/api/v1/payroll/configuration/deduction-settings", (route) => route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ message: "ok" }) }));
    await page.route("**/api/v1/payroll/configuration/absent-deduction-settings", (route) => route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ message: "ok" }) }));
    await page.route("**/api/v1/bonus/configuration/types", (route) => {
      if (route.request().method() === "GET") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success", data: [] }) });
      route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ message: "ok" }) });
    });
    await page.route("**/api/v1/bonus/configuration/policies", (route) => route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ message: "ok" }) }));
    await page.route("**/api/v1/attendance/policies", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success", data: [] }) }));
    await page.route("**/api/v1/payroll/configuration/overtime", (route) => route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ message: "ok" }) }));
    await page.route("**/api/v1/payroll/configuration/attendance-bonus", (route) => route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ message: "ok" }) }));
    await page.route("**/api/v1/payroll/configuration/custom-fields", (route) => route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ message: "ok" }) }));
    await page.route("**/api/v1/payroll/configuration/tax-rules/toggle/Enable", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ message: "ok" }) }));
    await page.route("**/api/v1/payroll/configuration/tax-rules/list", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success", data: { rules: [], isEnabled: false } }) }));

    await page.click(".settings-card:has-text('Payroll')");
    await page.waitForSelector("#groupRunEnterBtn", { timeout: 5000 });
    await page.click("#groupRunEnterBtn");
    await page.waitForSelector("#runDefaultsStartBtn", { timeout: 5000 });
    check("AX opens as a modal, not a page swap — the group's own tabs are still there behind it", (await page.locator(".settings-tab").count()) === 11);
    check("AX modal title names the group", (await page.locator("#runDefaultsTitle").textContent()).includes("Payroll"));
    check("AX per-group run keeps the original quote, distinct from the master run's", (await page.locator("#runDefaultsQuoteText").textContent()).includes("we continue"));
    check("AX group run is scoped to only this group's own 11 modules", (await page.locator("#runDefaultsList .bulk-row").count()) === 11);
    check("AX no group heading shown for a single-group run", (await page.locator("#runDefaultsList .bulk-group-label").count()) === 0);

    await page.click("#runDefaultsCloseBtn");
    await page.waitForSelector("#runDefaultsModal[hidden]", { state: "attached", timeout: 5000 });
    await page.waitForSelector("#pgSaveBtn", { timeout: 5000 });
    await page.click("#pgSaveBtn");
    await page.waitForTimeout(150);
    await page.click("#groupRunEnterBtn");
    await page.waitForSelector("#runDefaultsStartBtn", { timeout: 5000 });
    check("AX a module already done via its own single-item Save is pre-marked skipped", (await page.locator('#runDefaultsList .bulk-row:has-text("General")').textContent()).includes("skipped"));

    slowGeneral = false; // General is already done from above; the slow route only matters for the Stop test below on a fresh page
    await page.click("#runDefaultsCloseBtn");
    await page.close();
  }

  /* ---------- AX2. Stop halts before the next module; resuming doesn't redo the finished one ---------- */
  {
    const page = await browser.newContext().then((c) => c.newPage());
    const errs = watchPageErrors(page);
    const createdGeneral = [];
    const createdSalaryComponents = [];
    const realSalaryComponents = [];

    await toGrid(page);
    await page.route("**/api/v1/payroll/configuration/payroll-cycle", async (route) => {
      if (route.request().method() === "GET") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success", message: "Pay cycle has not been configured yet.", data: null }) });
      await new Promise((r) => setTimeout(r, 800));
      createdGeneral.push(1);
      route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ message: "ok" }) });
    });
    await page.route("**/api/v1/payroll/configuration/salary-components?limit=100", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success", data: realSalaryComponents }) }));
    await page.route("**/api/v1/payroll/configuration/salary-components?status=Active&limit=100", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success", data: { components: realSalaryComponents, metadata: { total: realSalaryComponents.length } } }) })
    );
    await page.route("**/api/v1/payroll/configuration/salary-components", (route) => {
      if (route.request().method() !== "POST") return route.continue();
      const body = route.request().postDataJSON();
      realSalaryComponents.push({ id: "sc-" + (realSalaryComponents.length + 1), name: body.name, status: body.status });
      createdSalaryComponents.push(body.name);
      route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ message: "ok", data: { id: "sc-x" } }) });
    });
    await page.route("**/api/v1/payroll/configuration/non-paygrade-structure", (route) => {
      if (route.request().method() === "GET") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success", message: "No salary structure found for this company. Please configure one first.", data: {} }) });
      route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ message: "ok" }) });
    });
    await page.route("**/api/v1/payroll/configuration/deduction-settings", (route) => route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ message: "ok" }) }));
    await page.route("**/api/v1/payroll/configuration/absent-deduction-settings", (route) => route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ message: "ok" }) }));
    await page.route("**/api/v1/bonus/configuration/types", (route) => {
      if (route.request().method() === "GET") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success", data: [] }) });
      route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ message: "ok" }) });
    });
    await page.route("**/api/v1/bonus/configuration/policies", (route) => route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ message: "ok" }) }));
    await page.route("**/api/v1/attendance/policies", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success", data: [] }) }));
    await page.route("**/api/v1/payroll/configuration/overtime", (route) => route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ message: "ok" }) }));
    await page.route("**/api/v1/payroll/configuration/attendance-bonus", (route) => route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ message: "ok" }) }));
    await page.route("**/api/v1/payroll/configuration/custom-fields", (route) => route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ message: "ok" }) }));
    await page.route("**/api/v1/payroll/configuration/tax-rules/toggle/Enable", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ message: "ok" }) }));
    await page.route("**/api/v1/payroll/configuration/tax-rules/list", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success", data: { rules: [], isEnabled: false } }) }));

    await page.click(".settings-card:has-text('Payroll')");
    await page.waitForSelector("#groupRunEnterBtn", { timeout: 5000 });
    await page.click("#groupRunEnterBtn");
    await page.waitForSelector("#runDefaultsStartBtn", { timeout: 5000 });
    await page.click("#runDefaultsStartBtn");
    await page.waitForSelector("#runDefaultsStopBtn", { timeout: 5000 });
    await page.click("#runDefaultsStopBtn");
    await page.waitForSelector("#runDefaultsStartBtn", { timeout: 5000 });
    const afterStopText = (await page.locator("#runDefaultsList").textContent()).replace(/\s+/g, " ");
    check("AX2 Stop lets the in-flight module finish, then halts before the next", /General\s+done/.test(afterStopText) && !/Salary Components\s+done/.test(afterStopText));
    check("AX2 the module after the stopped one never actually sent a request", createdSalaryComponents.length === 0);
    check("AX2 Back button reads '← Back' while not everything is settled yet", (await page.locator("#runDefaultsCloseBtn").textContent()).trim() === "← Back");

    await page.click("#runDefaultsStartBtn");
    await page.waitForFunction(() => document.querySelector("#runDefaultsBanner").textContent.includes("Finished"), { timeout: 15000 });
    check("AX2 resuming doesn't redo the already-finished module", createdGeneral.length === 1);
    check("AX2 resuming continues the rest", createdSalaryComponents.length >= 1);
    check("AX2 no page errors", errs.length === 0, errs.join(" | "));
    await page.close();
  }

  /* ---------- AY. Company Profile names which real fields already have values (2026-09-15) ---------- */
  {
    const page = await browser.newContext().then((c) => c.newPage());
    const errs = watchPageErrors(page);
    await toGrid(page);
    /* Registered before the tab is ever opened — companyProfile.existing
       is only ever checked once per connection (undefined -> real
       value), so the override has to be in place before that first
       background fetch fires, not after. */
    await page.route("**/api/v1/company-profile", (route) => {
      if (route.request().method() !== "GET") return route.continue();
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          status: "success",
          message: "Company profile found successfully",
          data: { legalName: "Hogwarts School Ltd.", tegNo: "1234567890123", taxId: null, industry: "Education", businessType: null, website: null, description: null, missionStatement: null, visionStatement: null },
        }),
      });
    });
    await page.click(".settings-card:has-text('Company Settings')");
    await page.waitForTimeout(150);
    const noticeText = await page.textContent("#setupBody");
    check("AY names exactly the fields that have real values", noticeText.includes("already has values for: Legal Name, TEG NO, Industry."));
    check("AY warns that saving again overwrites it", noticeText.includes("Saving again will overwrite this real data"));
    check("AY no page errors — confirms the background re-check doesn't loop", errs.length === 0, errs.join(" | "));
    await page.close();
  }

  /* ---------- AZ. ...and shows nothing when the real profile doesn't exist yet ---------- */
  {
    const page = await browser.newContext().then((c) => c.newPage());
    const errs = watchPageErrors(page);
    await toGrid(page); // its own default answers GET /company-profile with data: null
    await page.click(".settings-card:has-text('Company Settings')");
    await page.waitForTimeout(150);
    check("AZ no notice when nothing is configured yet", (await page.textContent("#setupBody")).includes("already has values") === false);
    check("AZ no page errors", errs.length === 0, errs.join(" | "));
    await page.close();
  }

  /* ---------- BA. Bank Info gets the same "already has values" notice (2026-09-15) ---------- */
  {
    const page = await browser.newContext().then((c) => c.newPage());
    const errs = watchPageErrors(page);
    await toGrid(page);
    await page.route("**/api/v1/company-bank-informations", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          status: "success",
          message: "Company bank information retrieved successfully",
          data: { bankName: "Dutch-Bangla Bank", accountNumber: "1234567890", npsbCode: "DBBLACT", beftnCode: "DBBLBFT", mfsCode: null },
        }),
      })
    );
    await page.click(".settings-card:has-text('Company Settings')");
    await page.click('.settings-tab[data-module="bank_info"]');
    await page.waitForTimeout(150);
    const noticeText = await page.textContent("#setupBody");
    check("BA names exactly the fields that have real values", noticeText.includes("already has values for: Bank Name, Account Number, NPSB Code, BEFTN Code."));
    check("BA warns that saving again overwrites it", noticeText.includes("Saving again will overwrite this real data"));
    check("BA no page errors — confirms the background re-check doesn't loop", errs.length === 0, errs.join(" | "));
    await page.close();
  }

  /* ---------- BB. ...and shows nothing when bank info doesn't exist yet ---------- */
  {
    const page = await browser.newContext().then((c) => c.newPage());
    const errs = watchPageErrors(page);
    await toGrid(page); // its own default answers GET /company-bank-informations with data: null
    await page.click(".settings-card:has-text('Company Settings')");
    await page.click('.settings-tab[data-module="bank_info"]');
    await page.waitForTimeout(150);
    check("BB no notice when nothing is configured yet", (await page.textContent("#setupBody")).includes("already has values") === false);
    check("BB no page errors", errs.length === 0, errs.join(" | "));
    await page.close();
  }

  /* ---------- BC. Payroll General / Configure Salary Components / Tax / Attendance Policy get the same treatment (2026-09-15) ---------- */
  {
    const page = await browser.newContext().then((c) => c.newPage());
    const errs = watchPageErrors(page);
    await toGrid(page);
    await page.route("**/api/v1/payroll/configuration/payroll-cycle", (route) => {
      if (route.request().method() !== "GET") return route.continue();
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success", data: { config: { payrollCycle: "fixed_date" } } }) });
    });
    await page.route("**/api/v1/payroll/configuration/tax-rules/list", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success", data: { rules: [], isEnabled: true } }) })
    );
    await page.route("**/api/v1/attendance/policies", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success", data: [{ id: "ap-1", title: "Office Standard Policy", overtimeEnabled: false }] }) })
    );

    await page.click(".settings-card:has-text('Payroll')");
    await page.waitForSelector("#pgCycleSeg", { timeout: 5000 });
    /* The existing-check is a separate background fetch from the form's
       own render — #pgCycleSeg appears first, so waiting on it alone
       races the notice under real system load (the exact class of
       flakiness already found and fixed for Configure Salary
       Components' own notice, above). Wait for the notice's own text. */
    await page.waitForFunction(() => document.querySelector("#setupBody")?.textContent.includes("already configured"), { timeout: 5000 });
    check("BC Payroll General names the already-configured cycle", (await page.textContent("#setupBody")).includes("already configured as Fixed Date"));

    await page.click('.settings-tab[data-module="tax"]');
    await page.waitForFunction(() => document.querySelector("#setupBody")?.textContent.includes("already enabled"), { timeout: 5000 });
    check("BC Tax shows the lighter, success-toned already-enabled confirmation", (await page.textContent("#setupBody")).includes("Tax is already enabled for this company"));

    await page.click("#setupBackToModules");
    await page.click(".settings-card:has-text('Attendance')");
    await page.waitForSelector("#apTitle", { timeout: 5000 });
    await page.waitForFunction(() => document.querySelector("#setupBody")?.textContent.includes("already has an attendance policy"), { timeout: 5000 });
    check("BC Attendance Policy names the already-existing real policy", (await page.textContent("#setupBody")).includes("already has an attendance policy: Office Standard Policy"));

    check("BC no page errors — confirms none of the four background re-checks loop", errs.length === 0, errs.join(" | "));
    await page.close();
  }

  /* ---------- BD. ...and Configure Salary Components names the already-configured Basic % (2026-09-15) ---------- */
  {
    const page = await browser.newContext().then((c) => c.newPage());
    const errs = watchPageErrors(page);
    await toGrid(page);
    await page.route("**/api/v1/payroll/configuration/salary-components?status=Active&limit=100", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ status: "success", data: { components: [{ id: "sc-1", name: "Medical Allowance", status: "Active" }, { id: "sc-2", name: "House Rent Allowance", status: "Active" }], metadata: { total: 2 } } }),
      })
    );
    await page.route("**/api/v1/payroll/configuration/non-paygrade-structure", (route) => {
      if (route.request().method() !== "GET") return route.continue();
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success", data: { id: "struct-1", basicSalaryPercentage: 65 } }) });
    });
    await page.click(".settings-card:has-text('Payroll')");
    await page.click('.settings-tab[data-module="configure_salary_components"]');
    /* Waiting for "Basic" alone is satisfied by the form's own "Basic %"
       label the instant the dependency resolves — before the separate
       background existing-check has necessarily resolved too. Wait for
       the notice's own text specifically instead, so this isn't a race
       against system load (found flaky under the full 8-suite run). */
    await page.waitForFunction(() => document.querySelector("#setupBody").textContent.includes("already configured — Basic"), { timeout: 5000 });
    check("BD names the already-configured Basic %", (await page.textContent("#setupBody")).includes("already configured — Basic 65%"));
    check("BD no page errors", errs.length === 0, errs.join(" | "));
    await page.close();
  }

  /* ---------- BE. Location Types names the real count, plainly, not as a warning (2026-09-24) ---------- */
  {
    const page = await browser.newContext().then((c) => c.newPage());
    const errs = watchPageErrors(page);
    await toGrid(page);
    await page.route("**/api/v1/locations/location-types/paginated**", (route) => {
      if (route.request().method() !== "GET") return route.continue();
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success", data: { locationTypes: [{ id: "lt-1", name: "Baridhara" }, { id: "lt-2", name: "Gulshan" }] } }) });
    });
    await page.click(".settings-card:has-text('Company Settings')");
    await page.click('.settings-tab[data-module="location_types"]');
    await page.waitForTimeout(150);
    check("BE names the real count", (await page.textContent("#setupBody")).includes("already has 2 location types — more can still be added from here"));
    check("BE no page errors", errs.length === 0, errs.join(" | "));
    await page.close();
  }

  /* ---------- BF. ...and singular wording for exactly 1 ---------- */
  {
    const page = await browser.newContext().then((c) => c.newPage());
    const errs = watchPageErrors(page);
    await toGrid(page);
    await page.route("**/api/v1/locations/location-types/paginated**", (route) => {
      if (route.request().method() !== "GET") return route.continue();
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success", data: { locationTypes: [{ id: "lt-1", name: "Baridhara" }] } }) });
    });
    await page.click(".settings-card:has-text('Company Settings')");
    await page.click('.settings-tab[data-module="location_types"]');
    await page.waitForTimeout(150);
    check("BF singular wording for exactly 1", (await page.textContent("#setupBody")).includes("already has 1 location type —"));
    check("BF no page errors", errs.length === 0, errs.join(" | "));
    await page.close();
  }

  /* ---------- BG. ...and nothing when this company has no location types yet ---------- */
  {
    const page = await browser.newContext().then((c) => c.newPage());
    const errs = watchPageErrors(page);
    await toGrid(page); // its own default answers GET .../location-types/paginated with an empty array
    await page.click(".settings-card:has-text('Company Settings')");
    await page.click('.settings-tab[data-module="location_types"]');
    await page.waitForTimeout(150);
    check("BG no notice when there are no location types yet", (await page.textContent("#setupBody")).includes("already has") === false);
    check("BG no page errors", errs.length === 0, errs.join(" | "));
    await page.close();
  }

  /* ---------- BE2. Locations names the real count too, once its own dependency is met (2026-09-24) ---------- */
  {
    const page = await browser.newContext().then((c) => c.newPage());
    const errs = watchPageErrors(page);
    await toGrid(page);
    await page.route("**/api/v1/locations/location-types/paginated**", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success", data: { locationTypes: [{ id: "lt-1", name: "Baridhara" }] } }) })
    );
    await page.route("**/api/v1/locations", (route) => {
      if (route.request().method() !== "GET") return route.continue();
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success", data: { items: [{ id: "loc-1", name: "Railgate" }, { id: "loc-2", name: "Ononna" }] } }) });
    });
    await page.click(".settings-card:has-text('Company Settings')");
    await page.click('.settings-tab[data-module="locations"]');
    await page.waitForTimeout(150);
    check("BE2 names the real count", (await page.textContent("#setupBody")).includes("already has 2 locations — more can still be added from here"));
    check("BE2 no page errors", errs.length === 0, errs.join(" | "));
    await page.close();
  }

  /* ---------- BH. Department/Designation get the same plain count as Locations (2026-09-15) ---------- */
  {
    const page = await browser.newContext().then((c) => c.newPage());
    const errs = watchPageErrors(page);
    await toGrid(page);
    await page.route("**/api/v1/departments/active", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success", data: [{ id: "dep-1", name: "HR" }, { id: "dep-2", name: "Engineering" }] }) })
    );
    await page.route("**/api/v1/designations/active**", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success", data: [{ id: "des-1", name: "Manager", department: { id: "dep-1" } }] }) })
    );
    await page.click(".settings-card:has-text('Company Settings')");
    await page.click('.settings-tab[data-module="departments"]');
    await page.waitForTimeout(150);
    check("BH Department names the real count", (await page.textContent("#setupBody")).includes("already has 2 departments — more can still be added from here"));

    await page.click('.settings-tab[data-module="designations"]');
    await page.waitForFunction(() => document.querySelector("#setupBody").textContent.includes("Or just this one"), { timeout: 5000 });
    check("BH Designation names the real count across departments", (await page.textContent("#setupBody")).includes("already has 1 designation across its departments — more can still be added from here"));
    check("BH no page errors", errs.length === 0, errs.join(" | "));
    await page.close();
  }

  /* ---------- BI. Leave Types gets the same plain count (2026-09-15) ---------- */
  {
    const page = await browser.newContext().then((c) => c.newPage());
    const errs = watchPageErrors(page);
    await toGrid(page);
    await page.route("**/api/v1/leave-types", (route) => {
      if (route.request().method() !== "GET") return route.continue();
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success", data: [{ id: "lt-1", name: "Annual Leave" }, { id: "lt-2", name: "Casual Leave" }, { id: "lt-3", name: "Sick Leave" }] }) });
    });
    await page.click(".settings-card:has-text('Leave')");
    await page.waitForTimeout(150);
    check("BI names the real count", (await page.textContent("#setupBody")).includes("already has 3 leave types — more can still be added from here"));
    check("BI no page errors", errs.length === 0, errs.join(" | "));
    await page.close();
  }

  /* ---------- BJ. Salary Components/Bonus Types/Custom Addition-Deduction get the same treatment (2026-09-15) ---------- */
  {
    const page = await browser.newContext().then((c) => c.newPage());
    const errs = watchPageErrors(page);
    await toGrid(page);
    await page.route("**/api/v1/payroll/configuration/salary-components?limit=100", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success", data: [{ id: "sc-1", name: "Medical Allowance" }] }) })
    );
    await page.route("**/api/v1/bonus/configuration/types", (route) => {
      if (route.request().method() !== "GET") return route.continue();
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success", data: [{ id: "bt-1", typeName: "Eid Bonus" }, { id: "bt-2", typeName: "Bangla New Year Bonus" }] }) });
    });
    await page.route("**/api/v1/payroll/configuration/custom-fields/list", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success", data: { customFields: [{ id: "cad-1" }, { id: "cad-2" }, { id: "cad-3" }], total: 3, maxAllowed: 10, remaining: 7 } }) })
    );
    await page.click(".settings-card:has-text('Payroll')");
    await page.click('.settings-tab[data-module="salary_components"]');
    await page.waitForTimeout(150);
    check("BJ Salary Components names the real count", (await page.textContent("#setupBody")).includes("already has 1 salary component — more can still be added from here"));

    await page.click('.settings-tab[data-module="bonus_types"]');
    await page.waitForTimeout(150);
    check("BJ Bonus Types names the real count", (await page.textContent("#setupBody")).includes("already has 2 bonus types — more can still be added from here"));

    await page.click('.settings-tab[data-module="custom_addition_deduction"]');
    await page.waitForTimeout(150);
    check("BJ Custom Addition/Deduction names the real count and cap", (await page.textContent("#setupBody")).includes("already has 3 of 10 custom addition/deduction fields — more can still be added from here"));
    check("BJ no page errors", errs.length === 0, errs.join(" | "));
    await page.close();
  }

  /* ---------- BK. Custom Fields/Required Documents get the same treatment (2026-09-15) ---------- */
  {
    const page = await browser.newContext().then((c) => c.newPage());
    const errs = watchPageErrors(page);
    await toGrid(page);
    await page.route("**/api/v1/company-settings/employee-custom-fields/all", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success", data: [{ id: "cf-1", fieldName: "Blood Group" }] }) })
    );
    await page.route("**/api/v1/required-documents", (route) => {
      if (route.request().method() !== "GET") return route.continue();
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success", data: [{ id: "rd-1", name: "NID" }, { id: "rd-2", name: "Passport" }] }) });
    });
    await page.click(".settings-card:has-text('Employee')");
    await page.waitForTimeout(150);
    check("BK Custom Fields names the real count", (await page.textContent("#setupBody")).includes("already has 1 custom field — more can still be added from here"));

    await page.click('.settings-tab[data-module="required_documents"]');
    await page.waitForTimeout(150);
    check("BK Required Documents names the real count", (await page.textContent("#setupBody")).includes("already has 2 required documents — more can still be added from here"));
    check("BK no page errors", errs.length === 0, errs.join(" | "));
    await page.close();
  }

  /* ---------- BL. Leave Policy names the real existing policy, offers a new one anyway (2026-09-15) ---------- */
  {
    const page = await browser.newContext().then((c) => c.newPage());
    const errs = watchPageErrors(page);
    await toGrid(page);
    await page.route("**/api/v1/leave-types", (route) => {
      if (route.request().method() !== "GET") return route.continue();
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success", data: [{ id: "lt-1", name: "Annual Leave" }] }) });
    });
    await page.route("**/api/v1/leave-policies", (route) => {
      if (route.request().method() !== "GET") return route.continue();
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success", data: [{ id: "lp-1", name: "Head Office Leave Policy" }] }) });
    });
    await page.click(".settings-card:has-text('Leave')");
    await page.click('.settings-tab[data-module="leave_policy"]');
    await page.waitForTimeout(150);
    const text = await page.textContent("#setupBody");
    check("BL names the real existing policy", text.includes("already has a leave policy: Head Office Leave Policy"));
    check("BL says a new one can still be created", text.includes("A new one can still be created"));
    check("BL Save button is still there — nothing is blocked", (await page.locator("#lpSaveBtn").count()) === 1);
    check("BL no page errors", errs.length === 0, errs.join(" | "));
    await page.close();
  }

  /* ---------- BM. Bonus Policy gets the same treatment (2026-09-15) ---------- */
  {
    const page = await browser.newContext().then((c) => c.newPage());
    const errs = watchPageErrors(page);
    await toGrid(page);
    await page.route("**/api/v1/bonus/configuration/types", (route) => {
      if (route.request().method() !== "GET") return route.continue();
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success", data: [{ id: "bt-1", typeName: "Eid Bonus" }] }) });
    });
    await page.route("**/api/v1/bonus/configuration/policies", (route) => {
      if (route.request().method() !== "GET") return route.continue();
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ status: "success", data: { policies: [{ id: "bp-1", name: "Eid Ul Fitr Bonus Policy" }, { id: "bp-2", name: "Eid Ul Adha Bonus Policy" }], total: 2 } }),
      });
    });
    await page.click(".settings-card:has-text('Payroll')");
    await page.click('.settings-tab[data-module="bonus_policy"]');
    await page.waitForTimeout(150);
    const text = await page.textContent("#setupBody");
    check("BM names both real existing policies", text.includes("already has 2 bonus policies: Eid Ul Fitr Bonus Policy, Eid Ul Adha Bonus Policy"));
    check("BM says a new one can still be created", text.includes("A new one can still be created"));
    check("BM Save button is still there — nothing is blocked", (await page.locator("#bpSaveBtn").count()) === 1);
    check("BM no page errors", errs.length === 0, errs.join(" | "));
    await page.close();
  }

  {
    // BN — Create Roster (Schedule Management), 2026-09-22
    const page = await browser.newContext().then((c) => c.newPage());
    const errs = watchPageErrors(page);
    let sentBody = null;
    await toGrid(page);
    /* Fulfills GET directly too, rather than route.continue()-ing to
       toGrid()'s own earlier default — route.continue() sends straight to
       the real network (Playwright routes are LIFO; it does not fall
       through to an earlier-registered handler), which is exactly the
       CORS-blocked-request gotcha this file has hit before. */
    await page.route("**/api/v1/workforce/time-slots", (route) => {
      if (route.request().method() !== "POST") {
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success", data: { timeSlots: [] } }) });
      }
      sentBody = route.request().postDataJSON();
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ message: "ok" }) });
    });

    await page.click(".settings-card:has-text('Schedule Management')");
    await page.click('.settings-tab[data-module="roster"]');
    await page.waitForSelector("#rstName");

    check("BN Name/Start/End/Grace fields all render", (await page.locator("#rstName, #rstStart, #rstEnd, #rstGrace").count()) === 4);
    check("BN Start At time is a plausible BD 09:00-11:00, 30-min-step value", ["09:00", "09:30", "10:00", "10:30", "11:00"].includes(await page.inputValue("#rstStart")));
    check("BN no per-module 'Create the default' shortcut — 'Run defaults for Schedule Management' above covers it, 2026-09-24 direct request",
      (await page.locator("#rstDefaultBtn").count()) === 0);

    // hand-editing every field to the real default's own shape still saves
    // correctly — the one-click shortcut is gone, editing by hand is not
    await page.fill("#rstName", "Default");
    await page.fill("#rstStart", "09:00");
    await page.fill("#rstEnd", "18:00");
    await page.selectOption("#rstGrace", "15");

    await page.click("#rstSaveBtn");
    await page.waitForTimeout(150);
    check("BN Saved sends an array with exactly one item", Array.isArray(sentBody) && sentBody.length === 1);
    const sent = sentBody[0];
    check("BN Saved body matches the hand-typed default shape — color isn't an editable field, so it's whatever Regenerate last rolled",
      sent.name === "Default" && sent.workStartTime === "09:00" && sent.workEndTime === "18:00" && sent.totalWorkingHours === 9 && sent.halfDayHours === 4 && sent.gracePeriodMinutes === 15 && ROSTER_COLORS.includes(sent.color));
    check("BN Save shows a success confirmation", (await page.textContent("#setupBody")).includes("Saved."));
    check("BN no page errors", errs.length === 0, errs.join(" | "));
    await page.close();
  }

  {
    // BN2 — hand-edited Start/End recomputes totalWorkingHours, and the existing-count notice
    const page = await browser.newContext().then((c) => c.newPage());
    const errs = watchPageErrors(page);
    let sentBody = null;
    await toGrid(page);
    await page.route("**/api/v1/workforce/time-slots", (route) => {
      if (route.request().method() === "GET") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ status: "success", data: { timeSlots: [{ id: "ts-1", name: "Default" }, { id: "ts-2", name: "Evening Shift" }] } }),
        });
      }
      sentBody = route.request().postDataJSON();
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ message: "ok" }) });
    });

    await page.click(".settings-card:has-text('Schedule Management')");
    await page.click('.settings-tab[data-module="roster"]');
    await page.waitForFunction(() => document.querySelector("#setupBody")?.textContent.includes("already has"), { timeout: 5000 });
    check("BN2 names the real count", (await page.textContent("#setupBody")).includes("already has 2 time slots — more can still be added from here"));

    await page.fill("#rstStart", "08:00");
    await page.fill("#rstEnd", "16:30");
    await page.click("#rstSaveBtn");
    await page.waitForTimeout(150);
    check("BN2 totalWorkingHours recomputed from hand-edited Start/End (8.5), not left at whatever was last generated", sentBody[0].totalWorkingHours === 8.5);
    check("BN2 halfDayHours always the fixed 4 regardless of totalWorkingHours", sentBody[0].halfDayHours === 4);
    check("BN2 no page errors", errs.length === 0, errs.join(" | "));
    await page.close();
  }

  {
    // BO — Create Roster Pattern blocked with zero real time slots, 2026-09-23
    const page = await browser.newContext().then((c) => c.newPage());
    const errs = watchPageErrors(page);
    await toGrid(page);
    await page.click(".settings-card:has-text('Schedule Management')");
    await page.click('.settings-tab[data-module="roster_pattern"]');
    await page.waitForFunction(() => document.querySelector("#setupBody")?.textContent.includes("doesn't have a Time Slot yet"), { timeout: 5000 });
    const text = await page.textContent("#setupBody");
    check("BO blocked with a named dependency notice", text.includes("doesn't have a Time Slot yet"));
    check("BO shortcut points at Create Roster", (await page.locator(".dep-shortcut").count()) === 1);
    await page.click(".dep-shortcut");
    await page.waitForSelector("#rstName");
    check("BO shortcut actually lands on Create Roster", (await page.locator("#rstName").count()) === 1);
    check("BO no page errors", errs.length === 0, errs.join(" | "));
    await page.close();
  }

  {
    // BP — Create Roster Pattern, real time slot available: default fill-in, save body, existing count
    const page = await browser.newContext().then((c) => c.newPage());
    const errs = watchPageErrors(page);
    let sentBody = null;
    await toGrid(page);
    await page.route("**/api/v1/workforce/time-slots", (route) => {
      if (route.request().method() !== "GET") return route.continue();
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ status: "success", data: { timeSlots: [{ id: "ts-other", name: "Evening Shift" }, { id: "ts-default", name: "Default" }] } }),
      });
    });
    await page.route("**/api/v1/workforce/patterns", (route) => {
      if (route.request().method() === "GET") {
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success", data: { patterns: [{ id: "p-1", name: "Evening Pattern" }] } }) });
      }
      sentBody = route.request().postDataJSON();
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ message: "ok" }) });
    });

    await page.click(".settings-card:has-text('Schedule Management')");
    await page.click('.settings-tab[data-module="roster_pattern"]');
    await page.waitForSelector("#rpName");

    check("BP names the real count", (await page.textContent("#setupBody")).includes("already has 1 pattern — more can still be added from here"));
    check("BP prefers the real \"Default\" slot over the first one in the list", (await page.textContent("#rpSaveBtn")).includes('"Default"'));
    check("BP Name defaults to Standard Pattern", (await page.inputValue("#rpName")) === "Standard Pattern");

    await page.click("#rpSaveBtn");
    await page.waitForTimeout(150);
    check("BP sends the fixed shape: name/isCustomCycle", sentBody.name === "Standard Pattern" && sentBody.isCustomCycle === false);
    check("BP sends exactly 5 entries, dayIndex 0-4 (Sun-Thu)", Array.isArray(sentBody.entries) && sentBody.entries.length === 5 && sentBody.entries.map((e) => e.dayIndex).join(",") === "0,1,2,3,4");
    check("BP every entry uses the real Default slot's id, not the first one", sentBody.entries.every((e) => e.timeSlotId === "ts-default"));
    check("BP every entry has isWfh: false", sentBody.entries.every((e) => e.isWfh === false));
    check("BP Save shows a success confirmation", (await page.textContent("#setupBody")).includes("Saved."));
    check("BP no page errors", errs.length === 0, errs.join(" | "));
    await page.close();
  }

  {
    // BQ — falls back to the first real time slot when none is named "Default"
    const page = await browser.newContext().then((c) => c.newPage());
    const errs = watchPageErrors(page);
    let sentBody = null;
    await toGrid(page);
    await page.route("**/api/v1/workforce/time-slots", (route) => {
      if (route.request().method() !== "GET") return route.continue();
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success", data: { timeSlots: [{ id: "ts-morning", name: "Morning Shift" }] } }) });
    });
    await page.route("**/api/v1/workforce/patterns", (route) => {
      if (route.request().method() === "GET") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success", data: { patterns: [] } }) });
      sentBody = route.request().postDataJSON();
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ message: "ok" }) });
    });

    await page.click(".settings-card:has-text('Schedule Management')");
    await page.click('.settings-tab[data-module="roster_pattern"]');
    await page.waitForSelector("#rpName");
    check("BQ falls back to the only real slot when none is named Default", (await page.textContent("#rpSaveBtn")).includes('"Morning Shift"'));

    await page.fill("#rpName", "Weekday Pattern");
    await page.click("#rpSaveBtn");
    await page.waitForTimeout(150);
    check("BQ hand-typed Name is what actually gets sent", sentBody.name === "Weekday Pattern");
    check("BQ entries use the fallback slot's real id", sentBody.entries.every((e) => e.timeSlotId === "ts-morning"));
    check("BQ no page errors", errs.length === 0, errs.join(" | "));
    await page.close();
  }

  await browser.close();
  report("Company Setup", state, []);
})();
