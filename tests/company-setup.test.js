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
const { CUSTOM_FIELD_PRESETS, REQUIRED_DOCUMENT_NAMES } = loadAppData(["CUSTOM_FIELD_PRESETS", "REQUIRED_DOCUMENT_NAMES"]);
const { LEAVE_TYPE_KINDS } = loadAppData(["LEAVE_TYPE_KINDS"]);
const { DEFAULT_DEPARTMENTS } = loadAppData(["DEFAULT_DEPARTMENTS"]);

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
      bannerRows[2].includes("Role") && bannerRows[2].includes("company_admin"),
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
    check("H one card per settings group", (await page.locator(".settings-card").count()) === 5);
    check("H group labels match SETTINGS_GROUPS",
      JSON.stringify(await page.locator(".settings-card-name").allTextContents()) ===
        JSON.stringify(["Company Settings", "Employee Settings", "Leave", "Payroll", "Attendance"]));
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
    check("I all five of the group's tabs are present",
      JSON.stringify(await page.locator(".settings-tab").allTextContents().then((a) => a.map((t) => t.trim()))) ===
        JSON.stringify(["Company Profile", "Bank Info", "Locations", "Department Management", "Designation Management"]));

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
    check("I back link returns to the 5-card grid, not signed out", (await page.locator(".settings-card").count()) === 5);

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
    await page.waitForTimeout(80);
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
    check("J the group card's count updates to 1/5",
      (await page.textContent(".settings-card:has-text('Company Settings') .tally")).trim() === "1/5 done");

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
    await page.waitForTimeout(80);
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
    check("N the group card's count updates to 1/5",
      (await page.textContent(".settings-card:has-text('Company Settings') .tally")).trim() === "1/5 done");
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

  /* ---------- P. Locations (Branch Management) ---------- */
  {
    const page = await browser.newContext().then((c) => c.newPage());
    const errs = watchPageErrors(page);
    await toGrid(page);
    await page.click(".settings-card:has-text('Company Settings')");
    await page.waitForTimeout(100);
    await page.click('.settings-tab[data-module="branches"]');
    await page.waitForTimeout(80);

    const officeName = await page.inputValue("#brOfficeName");
    check("P the generated office name is one of the real ones", OFFICE_NAMES.includes(officeName), officeName);

    const geoOn = (await page.getAttribute('#brGeoSeg button[data-geo="yes"]', "aria-pressed")) === "true";
    check("P geo fields are present exactly when geolocation is on", (await page.locator("#brLat").count()) === (geoOn ? 1 : 0));

    // force geolocation off, confirm fields disappear and stay null on save
    if (geoOn) await page.click('#brGeoSeg button[data-geo="no"]');
    else await page.click('#brGeoSeg button[data-geo="yes"]').then(() => page.click('#brGeoSeg button[data-geo="no"]'));
    await page.waitForTimeout(60);
    check("P turning geolocation off removes the geo fields", (await page.locator("#brLat").count()) === 0);

    let sentOff = null;
    await page.route("**/api/v1/company/branches", (route) => {
      sentOff = route.request().postDataJSON();
      route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ status: "success", message: "Branch created successfully" }) });
    });
    await page.click("#brSaveBtn");
    await page.waitForTimeout(150);
    check("P geolocation-off sends null lat/lng/radius, not zero or omitted",
      sentOff && sentOff.latitude === null && sentOff.longitude === null && sentOff.radiusInMeters === null, JSON.stringify(sentOff));
    check("P the real API's field is `name`, not `officeName` — confirmed live against staging 2026-09-10",
      sentOff && sentOff.name === officeName && !("officeName" in sentOff), JSON.stringify(sentOff));
    check("P the tab picks up a done marker", (await page.locator('.settings-tab[data-module="branches"] .op-dot').count()) === 1);
    check("P no page errors", errs.length === 0, errs.join(" | "));
    await page.close();
  }
  {
    // geolocation on: confirm real numbers get sent, not null
    const page = await browser.newContext().then((c) => c.newPage());
    await toGrid(page);
    await page.click(".settings-card:has-text('Company Settings')");
    await page.waitForTimeout(100);
    await page.click('.settings-tab[data-module="branches"]');
    await page.waitForTimeout(80);
    const alreadyOn = (await page.getAttribute('#brGeoSeg button[data-geo="yes"]', "aria-pressed")) === "true";
    if (!alreadyOn) await page.click('#brGeoSeg button[data-geo="yes"]');
    await page.waitForTimeout(60);
    let sentOn = null;
    await page.route("**/api/v1/company/branches", (route) => {
      sentOn = route.request().postDataJSON();
      route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ status: "success" }) });
    });
    await page.click("#brSaveBtn");
    await page.waitForTimeout(150);
    check("P geolocation-on sends real numbers for lat/lng/radius",
      sentOn && typeof sentOn.latitude === "number" && typeof sentOn.longitude === "number" && typeof sentOn.radiusInMeters === "number",
      JSON.stringify(sentOn));
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

  /* ---------- T. Custom Fields ---------- */
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

    if (preset.type === "checkbox" || preset.type === "enum") {
      check("T enableFilter is a real toggle for checkbox/enum types", (await page.locator("#cfFilterSeg").count()) === 1);
    }
    check("T choices only appear for an enum-type field", (await page.locator("#cfChoices").count()) === (preset.type === "enum" ? 1 : 0));

    let sent = null;
    await page.route("**/api/v1/company-settings/employee-custom-fields", (route) => {
      sent = route.request().postDataJSON();
      route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ status: "success", message: "Custom field created successfully" }) });
    });
    await page.click("#cfSaveBtn");
    await page.waitForTimeout(150);
    if (preset.type !== "enum") {
      check("T a non-enum field sends no options key at all", sent && !("options" in sent), JSON.stringify(sent));
    } else {
      check("T an enum field sends options.choices from its own pool",
        sent && Array.isArray(sent.options && sent.options.choices) && sent.options.choices.every((c) => preset.choicePool.includes(c)),
        JSON.stringify(sent));
    }
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

    // force a known combination so the payload is fully predictable
    await page.click('#rdTypeSeg button[data-val="file"]');
    await page.click('#rdStatusSeg button[data-val="active"]');
    await page.click('#rdRequiredSeg button[data-val="yes"]');

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
    check("U the tab picks up a done marker", (await page.locator('.settings-tab[data-module="required_documents"] .op-dot').count()) === 1);
    check("U no page errors", errs.length === 0, errs.join(" | "));
    await page.close();
  }

  /* ---------- V. Leave Types — normal and special-entitlement kinds ---------- */
  {
    const page = await browser.newContext().then((c) => c.newPage());
    const errs = watchPageErrors(page);
    await toGrid(page);
    await page.click(".settings-card:has-text('Leave')");
    await page.waitForTimeout(100);

    check("V opens on Annual Leave with the normal-leave toggles", (await page.locator("#ltConsecutiveSeg").count()) === 1);
    check("V special-entitlement fields are absent for a normal kind", (await page.locator("#ltInstancesSeg").count()) === 0);

    await page.selectOption("#ltKind", "paternity");
    await page.waitForTimeout(60);
    check("V switching to a special-entitlement kind swaps the fields", (await page.locator("#ltInstancesSeg").count()) === 1);
    check("V and the normal-leave toggles are gone", (await page.locator("#ltConsecutiveSeg").count()) === 0);

    let sent = null;
    await page.route("**/api/v1/leave-types", (route) => {
      sent = route.request().postDataJSON();
      route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ status: "success", message: "Leave type created successfully" }) });
    });
    await page.click("#ltSaveBtn");
    await page.waitForTimeout(150);
    const kind = LEAVE_TYPE_KINDS.find((k) => k.id === "paternity");
    check("V paternity sends the fixed gender/marital eligibility", sent && sent.genderEligibility === "male" && sent.maritalStatusEligibility === "married");
    check("V paternity sends its fixed per-instance day count", sent && sent.seMaxDaysPerInstance === kind.seMaxDaysPerInstance, JSON.stringify(sent));
    check("V normal-leave fields are all forced off for a special-entitlement kind",
      sent && sent.consecutiveLimit === false && sent.monthlyLimit === false && sent.sandwichRuleEnabled === false && sent.isBridge === false && sent.isLeaveReset === false);
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
      } else route.continue();
    });
    await page.click("#ltSaveBtn");
    await page.waitForTimeout(150);

    await page.unroute("**/api/v1/leave-types");
    await page.route("**/api/v1/leave-types", (route) => {
      if (route.request().method() !== "GET") return route.continue();
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
    check("W at least 3 (or however many exist) leave types are included",
      (await page.locator(".tally").count()) >= 3);

    let sent = null;
    await page.route("**/api/v1/leave-policies", (route) => {
      sent = route.request().postDataJSON();
      route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ status: "success", message: "Leave policy created successfully" }) });
    });
    await page.click("#lpSaveBtn");
    await page.waitForTimeout(150);
    check("W the special-entitlement leave type is forced into the Special category with its fixed days",
      sent && sent.leaveTypes.some((lt) => lt.leaveTypeId === "lt3" && lt.category === "Special" && lt.days === 120), JSON.stringify(sent));
    check("W departmentIds is empty — company-wide by default", sent && Array.isArray(sent.departmentIds) && sent.departmentIds.length === 0);
    check("W the tab picks up a done marker", (await page.locator('.settings-tab[data-module="leave_policy"] .op-dot').count()) === 1);
    check("W no page errors through the whole flow", errs.length === 0, errs.join(" | "));
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
    await page.click("#apRegenerateBtn");
    await page.waitForTimeout(60);
    const titleAfter = await page.inputValue("#apTitle");
    check("X regenerate re-rolls the title (policy number changes)", titleBefore !== titleAfter);

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

    await page.click('#pgCycleSeg button[data-val="fixed_date"]');
    await page.waitForTimeout(60);
    check("Y switching to fixed_date shows a fixed start day chip", (await page.textContent("#setupBody")).includes("Fixed start day"));

    await page.click('#pgCycleSeg button[data-val="bi_weekly"]');
    await page.waitForTimeout(60);
    check("Y switching to bi_weekly shows a bi-weekly start date chip, no threshold", (await page.textContent("#setupBody")).includes("Bi-weekly start"));

    let sent = null;
    await page.route("**/api/v1/payroll/configuration/payroll-cycle", (route) => {
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

    await page.route("**/api/v1/payroll/configuration/salary-components?status=Active&limit=100", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success", data: [{ id: "sc-1", name: "Medical Allowance", status: "Active" }] }) })
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
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success", data: [
        { id: "sc-1", name: "Medical Allowance", status: "Active" },
        { id: "sc-2", name: "House Rent Allowance", status: "Active" },
      ] }) })
    );
    await page.click('.settings-tab[data-module="configure_salary_components"]');
    await page.waitForSelector(".settings-tabs", { timeout: 5000 });
    await page.waitForFunction(() => document.querySelector("#setupBody").textContent.includes("Basic"), { timeout: 5000 });
    check("AA saving the prerequisite invalidates the cache — the split now appears", (await page.textContent("#setupBody")).includes("House Rent Allowance"));

    let sent = null;
    await page.route("**/api/v1/payroll/configuration/non-paygrade-structure", (route) => {
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

    let laSent = null;
    await page.route("**/api/v1/payroll/configuration/deduction-settings", (route) => {
      laSent = route.request().postDataJSON();
      route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ status: "success", message: "Deduction settings updated successfully" }) });
    });
    await page.click("#laSaveBtn");
    await page.waitForTimeout(150);
    check("AB exactly one of the two late-penalty flags is true", laSent && (laSent.latePenaltyEnabled !== laSent.repeatedLatePenaltyEnabled));
    check("AB the internal leave-type-name field never reaches the request", laSent && laSent._leaveTypeName === undefined);
    check("AB latePenaltyLeaveType carries the real leave type id", laSent && laSent.latePenaltyLeaveType === "lt1");

    await page.click('.settings-tab[data-module="absent_deduction"]');
    await page.waitForFunction(() => document.querySelector("#setupBody").textContent.includes("Rule based on"), { timeout: 5000 });
    let adSent = null;
    await page.route("**/api/v1/payroll/configuration/absent-deduction-settings", (route) => {
      adSent = route.request().postDataJSON();
      route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ status: "success", message: "Absent deduction settings updated successfully" }) });
    });
    await page.click("#adSaveBtn");
    await page.waitForTimeout(150);
    check("AB Absent Deduction resolves the dependency independently of Late Arrival", adSent && adSent.absentDeductionLeaveType === "lt1");
    check("AB ruleBasedOn matches the real script's two values", adSent && ["consecutive_absent_days", "total_absent_days"].includes(adSent.ruleBasedOn));
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
      if (route.request().method() !== "POST") return route.continue();
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
      } else route.continue();
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

  /* ---------- AE. Payroll: Overtime ---------- */
  {
    const page = await browser.newContext().then((c) => c.newPage());
    const errs = watchPageErrors(page);
    await toGrid(page);
    await page.click(".settings-card:has-text('Payroll')");
    await page.click('.settings-tab[data-module="overtime"]');
    await page.waitForSelector("#otSaveBtn", { timeout: 5000 });

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
    let sent = null;
    await page.route("**/api/v1/payroll/configuration/custom-fields", (route) => {
      sent = route.request().postDataJSON();
      route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ status: "success", message: "Resource created successfully" }) });
    });
    await page.click("#cadSaveBtn");
    await page.waitForTimeout(150);
    check("AG the hand-typed name, not a pool one, is what's sent", sent && sent.name === "Custom Hand-Typed Deduction" && sent.type === "Deduction");
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

  /* ---------- AI. a reload always drops both logins — on purpose, for real this time ----------

     sessionStorage token persistence was tried, then reverted the same
     day: the joke gate is exactly that, a joke, and letting the two
     *real* logins survive a reload would quietly make "is the tab still
     open" this section's whole security boundary. What's kept instead —
     in a separate, token-free key — is which company/env was last
     connected and which modules were saved there, so reconnecting isn't
     a totally blank slate even though it does require both real logins
     again, unconditionally, every time. */
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
    check("AI both real logins are required again — a reload never skips them", (await page.locator("#setupSignInBtn").count()) === 1);
    check("AI a notice names the company that was connected before the reload",
      (await page.textContent(".validation-banner")).includes("Nexa Technologies"));

    await mockSupabaseOk(page);
    await page.fill("#setupEmail", "mahmudur@shomvob.com");
    await page.fill("#setupPass", "whatever");
    await page.click("#setupSignInBtn");
    await page.waitForTimeout(150);
    await mockCompanyOk(page, "Nexa Technologies", "company_admin");
    await page.fill("#setupCoEmail", "a@b.com");
    await page.fill("#setupCoPass", "whatever");
    await page.click("#setupCoBtn");
    await page.waitForTimeout(150);
    check("AI reconnecting to the same company restores its done-dots from before the reload",
      (await page.textContent(".settings-card:has-text('Company Settings') .tally")).includes("1/5"));

    await page.click("#setupDisconnectBtn");
    await page.waitForTimeout(80);
    await mockCompanyOk(page, "A Totally Different Company", "company_admin");
    await page.fill("#setupCoEmail", "x@y.com");
    await page.fill("#setupCoPass", "whatever");
    await page.click("#setupCoBtn");
    await page.waitForTimeout(150);
    check("AI a different company gets a clean slate, not the previous company's done-dots",
      (await page.textContent(".settings-card:has-text('Company Settings') .tally")).includes("0/5"));
    check("AI no page errors across the whole flow", errs.length === 0, errs.join(" | "));

    await page.click("#setupSignOutBtn");
    await page.waitForTimeout(100);
    await page.reload();
    await page.waitForTimeout(150);
    await signIn(page);
    await page.click('.op-item:has-text("Company Setup")');
    await page.waitForTimeout(100);
    check("AI Sign out clears the last-session notice too — nothing lingers to greet the next person",
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

  /* ---------- AK. Designation Management — bulk mode skips departments that don't exist, keeps going ---------- */
  {
    const page = await browser.newContext().then((c) => c.newPage());
    const errs = watchPageErrors(page);
    await toGrid(page, "Nexa Technologies");

    // pre-seed 5 of the 6 real departments — Sales & Business deliberately missing
    const seeded = DEFAULT_DEPARTMENTS.filter((d) => d.name !== "Sales & Business").map((d, i) => ({ id: "rd" + i, name: d.name }));
    await page.route("**/api/v1/departments/active", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success", data: seeded }) })
    );
    await page.click(".settings-card:has-text('Company Settings')");
    await page.waitForTimeout(100);
    await page.click('.settings-tab[data-module="designations"]');
    await page.waitForFunction(() => document.querySelector("#setupBody").textContent.includes("Designation"), { timeout: 5000 });
    await page.waitForTimeout(100);

    await page.click("#desigBulkEnterLink");
    await page.waitForTimeout(80);
    check("AK shows all 24 rows (6 departments x 4), not just the 20 creatable ones", (await page.locator(".bulk-row").count()) === 24);
    check("AK the 4 rows under the missing department are named 'skipped', not silently dropped",
      (await page.locator(".bulk-row:has-text('skipped')").count()) === 4);
    check("AK those 4 are unselected and their checkbox is disabled",
      await page.locator(".bulk-row:has-text('skipped') input").evaluateAll((els) => els.every((el) => el.disabled && !el.checked)));
    check("AK the create count already excludes the 4 unreachable ones", (await page.textContent("#desigBulkCreateBtn")).includes("(20)"));
    check("AK rows are grouped under their department's name as a heading", (await page.locator(".bulk-group-label").count()) === 6);

    let sent = [];
    await page.route("**/api/v1/designations", (route) => {
      if (route.request().method() !== "POST") return route.continue();
      const body = route.request().postDataJSON();
      sent.push(body);
      route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ status: "success", message: "Designation created successfully" }) });
    });
    await page.click("#desigBulkCreateBtn");
    await page.waitForFunction(() => !document.querySelector("#desigBulkStopBtn"), { timeout: 10000 });
    check("AK exactly 20 designations were sent, none for the missing department", sent.length === 20, String(sent.length));
    check("AK each sent designation carries the real department id it belongs to, not a name",
      sent.every((s) => seeded.some((d) => d.id === s.departmentIds[0])));
    check("AK the tab picks up a done marker", (await page.locator('.settings-tab[data-module="designations"] .op-dot').count()) === 1);
    check("AK no page errors through the whole dependency + bulk flow", errs.length === 0, errs.join(" | "));
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
    check("AO a fresh card has one dot per module, none done", (await companyCard.locator(".settings-card-dot").count()) === 5);
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
    check("AO exactly one dot turns green after saving one of the five", (await companyCard.locator(".settings-card-dot.done").count()) === 1);
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
    check("AP nothing shown before any save", (await page.locator(".bulk-list, :text('Created this session')").count()) === 0);

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
    await page.waitForTimeout(60);
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

  await browser.close();
  report("Company Setup", state, []);
})();
