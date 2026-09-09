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
    check("D status bar adds the company name and user type",
      (await statusbar(page)) === "Staging mahmudur@shomvob.com Sports Academy (company_admin) Sign out");
    check("D the connected copy names the company, env and role",
      (await page.textContent("#setupBody")).replace(/\s+/g, " ").includes("Signed in to Sports Academy on Staging, as company_admin"));

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

    /* free pick: jump straight to a module with no dependency on any other,
       and back again, in whatever order — nothing about this is a wizard */
    await page.click('.settings-tab[data-module="departments"]');
    await page.waitForTimeout(80);
    check("I an unbuilt module shows the honest placeholder, not a broken page",
      (await page.textContent("#setupBody")).includes("Not built yet"));
    await page.click('.settings-tab[data-module="company_profile"]');
    await page.waitForTimeout(80);
    check("I jumping back to Company Profile still works", (await page.locator("#cpSaveBtn").count()) === 1);

    await page.click("#setupBackToModules");
    await page.waitForTimeout(80);
    check("I back link returns to the 5-card grid, not signed out", (await page.locator(".settings-card").count()) === 5);
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

  await browser.close();
  report("Company Setup", state, []);
})();
