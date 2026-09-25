/* Employee Add — regression guard.
 *
 * Employee Add was built and signed off first. It now shares the action bar
 * and the summary/generate dispatchers with Attendance, so this exists to
 * catch anything that breaks it while a later operation is being added.
 */
const { chromium } = require("playwright");
const { PAGE, loadSheetJs, makeChecker, report, freshDownloads, generate, signIn, mockToolSignIn, goToOp, watchPageErrors } = require("./lib");

const XLSX = loadSheetJs();
const { check, state } = makeChecker();

(async () => {
  freshDownloads();
  const browser = await chromium.launch();
  const page = await browser.newContext({ acceptDownloads: true }).then((c) => c.newPage());
  const pageErrors = watchPageErrors(page);

  await page.goto(PAGE);

  /* the gate carries the branding too */
  check("gate shows the logo", await page.isVisible("#loginGate .brand-logo"));
  check("gate names the product",
    /Bulk Forge\s+for Shomvob HRIS/.test(await page.textContent(".gate-product")),
    await page.textContent(".gate-product"));

  /* the video is a separate file, so a wrong path would fail silently —
     wait for it to actually decode a frame */
  await page.waitForFunction(
    () => { const v = document.querySelector("#gateVideo"); return v && v.videoWidth > 0; },
    { timeout: 15000 }
  );
  const vid = await page.evaluate(() => {
    const v = document.querySelector("#gateVideo");
    return { w: v.videoWidth, h: v.videoHeight, src: v.getAttribute("src") };
  });
  check("gate video loaded", vid.w > 0 && vid.h > 0, JSON.stringify(vid));
  check("gate video is a separate asset, not inlined",
    vid.src === "assets/lazy_cat.mp4", vid.src);

  /* the joke gate: a wrong password is refused, the right one is pre-filled */
  await page.fill("#loginPass", "definitely-not-it");
  await page.click("#loginBtn");
  check("gate refuses a wrong password", await page.isVisible("#loginGate"));
  check("gate says so", (await page.textContent("#loginError")).length > 0);
  await page.fill("#loginPass", "amioneklazy");
  await signIn(page);
  check("gate clears with the pre-filled credentials", !(await page.locator("#loginGate").count()));

  /* the Shomvob logo lives in the sidebar and is inlined by build.py —
     check it actually decoded, since a broken data URI still renders as an
     <img> */
  const logo = await page.evaluate(() => {
    const el = document.querySelector(".brand-logo");
    if (!el) return null;
    return { src: el.getAttribute("src").slice(0, 22), w: el.naturalWidth, h: el.naturalHeight };
  });
  check("logo is inlined as a data URI", logo && logo.src === "data:image/png;base64,", logo && logo.src);
  check("logo actually decoded", logo && logo.w > 0 && logo.h > 0, JSON.stringify(logo));
  check("sidebar names the product",
    (await page.textContent(".brand-name")).trim() === "Bulk Forge" &&
      (await page.textContent(".brand-sub")).trim() === "for Shomvob HRIS",
    (await page.textContent(".brand-name")) + " / " + (await page.textContent(".brand-sub")));
  check("the Lazy stamp is there", (await page.textContent(".brand-stamp")).trim() === "Lazy");

  /* the app opens on the dashboard, so pick the operation first */
  check("app opens on the dashboard", await page.isVisible(".welcome-title"));
  /* Tiered Access (2026-09-25) — the first operation click on a fresh
     page now needs a real (mocked) tool sign-in; every switch after
     this one on this same page goes straight through. */
  await mockToolSignIn(page);
  await goToOp(page, "Employee Add");
  await page.waitForSelector("#countInput");
  await page.fill("#countInput", "25");
  await page.fill("#prefixInput", "QATE");
  await page.click('.dept-card:has-text("Engineering/IT") input[type=checkbox]');
  await page.click('.dept-card:has-text("Engineering/IT") .desig-check:has-text("QA Engineer") input');

  const E = await generate(page, XLSX, "employee");

  check("sheet name", E.sheet === "Employees_List_Upload", E.sheet);
  check("14 columns", E.header.length === 14, String(E.header.length));
  check("25 rows", E.rows.length === 25, String(E.rows.length));
  check("IDs sequential from 0001",
    E.rows[0][0] === "QATE0001" && E.rows[24][0] === "QATE0025",
    E.rows[0][0] + ".." + E.rows[24][0]);
  check("emails unique", new Set(E.rows.map((r) => r[8])).size === 25);
  check("phones unique", new Set(E.rows.map((r) => r[9])).size === 25);
  check("only the chosen department and designation",
    E.rows.every((r) => r[12] === "Engineering/IT" && r[13] === "QA Engineer"));
  check("filename", /^QATE_employee_bulk_upload_\d{8}\.xlsx$/.test(E.suggested), E.suggested);

  /* ---------- E2. emails carry a per-run tag, so two separate Generate
     clicks (2026-09-22, direct request — the name pools are finite, so
     the same combo eventually recurs across unrelated files) never
     collide even with the exact same inputs ---------- */
  check("E email format carries a per-run tag",
    E.rows.every((r) => /^[a-z]+\.[a-z]+\.[a-z0-9]{5}@yopmail\.com$/.test(r[8])),
    E.rows[0][8]);
  const E2 = await generate(page, XLSX, "employee-2");
  const emailsE = new Set(E.rows.map((r) => r[8]));
  const overlap = E2.rows.filter((r) => emailsE.has(r[8]));
  check("E2 a second run with identical inputs shares no email with the first",
    overlap.length === 0, `${overlap.length} shared`);

  /* A department ticked with no designation used to be dropped silently —
     you could tick three, get one in the file, and never learn why. */
  const deptWarn = async () =>
    (await page.locator("#deptWarning").getAttribute("class")).includes("hidden")
      ? null
      : (await page.textContent("#deptWarningText")).trim();

  await page.click('.dept-card:has-text("Marketing") .dept-checkbox');
  await page.click('.dept-card:has-text("Finance & Accounts") .dept-checkbox');
  await page.waitForTimeout(150);
  check("a department with no designation blocks generating", await page.isDisabled("#generateBtn"));
  check("and the warning names which ones",
    (await deptWarn()) === "Marketing and Finance & Accounts have no designation picked.",
    await deptWarn());

  /* the per-department shortcut fills one of them in */
  await page.locator('.dept-card:has-text("Marketing") .bulk-btn').click();
  await page.waitForTimeout(150);
  check("the per-department shortcut selects every designation",
    (await deptWarn()) === "Finance & Accounts has no designation picked.",
    await deptWarn());
  check("and flips to clearing",
    (await page.locator('.dept-card:has-text("Marketing") .bulk-btn').textContent()).trim() === "Clear all 4",
    await page.locator('.dept-card:has-text("Marketing") .bulk-btn').textContent());

  /* the section shortcut does the lot */
  await page.click("#deptSelectAll");
  await page.waitForTimeout(200);
  check("the section shortcut selects everything", !(await page.isDisabled("#generateBtn")));
  check("and reports how many are ready",
    (await page.textContent("#deptSelectCount")).trim() === "6 ready",
    await page.textContent("#deptSelectCount"));
  await page.click("#deptSelectAll");
  await page.waitForTimeout(200);
  check("clearing it disables generating again", await page.isDisabled("#generateBtn"));

  /* a blank custom designation row must not pass for one — it would put an
     empty string into a required column */
  await page.click('.dept-card:has-text("HR") .dept-checkbox');
  await page.locator('.dept-card:has-text("HR") .mode-toggle button[data-mode="custom"]').click();
  await page.locator('.dept-card:has-text("HR") .tiny-btn').click();
  await page.waitForTimeout(200);
  check("a blank custom designation does not count", await page.isDisabled("#generateBtn"));
  await page.locator('.dept-card:has-text("HR") .custom-desig-row input').fill("Recruiter");
  await page.waitForTimeout(200);
  check("filling it in unblocks generating", !(await page.isDisabled("#generateBtn")));
  check("the ready count keeps up while typing",
    (await page.textContent("#deptSelectCount")).trim() === "1 ready",
    await page.textContent("#deptSelectCount"));


  /* switching operations must leave both forms usable */
  await page.click('.op-item:has-text("Employee Attendance Add")');
  await page.waitForSelector("#idModeSeg");
  await page.click('.op-item:has-text("Employee Add")');
  await page.waitForSelector("#countInput");
  check("switching back re-renders Employee Add", await page.isVisible("#countInput"));
  /* every navigation must land at the top of the new page — the panel
     scrolls internally, so a retained scrollTop drops you halfway down it */
  const scrollTo = (v) => page.evaluate((x) => { document.querySelector(".main-scroll").scrollTop = x; }, v);
  const scrollNow = () => page.evaluate(() => Math.round(document.querySelector(".main-scroll").scrollTop));
  const hops = [
    ["Employee Attendance Add", "#idModeSeg"],
    ["Assets Add", "#assetCount"],
    ["Dashboard", ".welcome-hero"],
    ["Employee Add", "#countInput"],
  ];
  let landedAtTop = true;
  for (const [label, ready] of hops) {
    await scrollTo(800);
    await page.click(`.op-item:has-text("${label}")`);
    await page.waitForSelector(ready);
    if ((await scrollNow()) !== 0) landedAtTop = false;
  }
  check("switching operations lands at the top", landedAtTop);

  await page.click('.op-item:has-text("Dashboard")');
  await page.waitForSelector(".welcome-hero");
  await scrollTo(500);
  await page.click('.op-item:has-text("Assets Add")');
  await page.waitForSelector("#assetCount");
  check("leaving a scrolled Dashboard lands at the top", (await scrollNow()) === 0, String(await scrollNow()));

  await page.click('.op-item:has-text("Employee Add")');
  await page.waitForSelector("#countInput");

  /* Work in progress is guarded. Nothing is lost by switching operations —
     state outlives the re-render — so only a reload or a tab close can
     throw it away, and Log out is a reload. */
  const modalOpen = () => page.evaluate(() => !document.querySelector("#discardModal").hidden);
  const unloadArmed = () => page.evaluate(() => {
    const e = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(e);
    return e.defaultPrevented;
  });

  await page.fill("#countInput", "77");
  check("reload is guarded while work is in progress", await unloadArmed());

  await page.click("#logoutBtn");
  await page.waitForTimeout(200);
  check("logout asks before discarding", await modalOpen());
  check("the dialog is the Hey Lazy one",
    (await page.textContent("#discardTitle")).trim() === "Hey Lazy!",
    await page.textContent("#discardTitle"));
  check("the safe button has focus",
    (await page.evaluate(() => document.activeElement.id)) === "discardCancel",
    await page.evaluate(() => document.activeElement.id));

  /* backing out keeps everything */
  await page.click("#discardCancel");
  await page.waitForTimeout(150);
  check("backing out closes the dialog", !(await modalOpen()));
  check("backing out stays logged in", (await page.locator("#loginGate").count()) === 0);
  check("backing out keeps the work", (await page.inputValue("#countInput")) === "77");

  /* Escape is the same as backing out */
  await page.click("#logoutBtn");
  await page.waitForTimeout(150);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(150);
  check("Escape keeps the work too",
    !(await modalOpen()) && (await page.locator("#loginGate").count()) === 0);

  /* confirming goes through, and clears everything */
  await page.click("#logoutBtn");
  await page.waitForTimeout(150);
  await page.click("#discardOk");
  await page.waitForSelector("#loginGate");
  check("discarding returns to the login page", await page.isVisible("#loginGate"));
  await signIn(page);
  /* Log out really clears the tool session now (a real bug fixed
     2026-09-25 — "login na kore logout korsi, but still dekhacche log
     in asi": a bare reload never cleared the persisted tool session
     before this fix, so the sidebar looked signed-in right through a
     logout). That means the sidebar is genuinely hidden again after
     this discard, same as any other fresh signed-out page — goToOp()
     signs back in through the real gate rather than assuming the
     sidebar item is already clickable. */
  await goToOp(page, "Employee Add");
  await page.waitForSelector("#countInput");
  check("discarding cleared the form", (await page.inputValue("#countInput")) !== "77",
    await page.inputValue("#countInput"));
  /* Tiered Access (2026-09-25): hasUnsavedWork() already counted a bare
     tool sign-in as "worth warning about" before this — redoing that
     real login is the cost, whether or not any generator field is also
     filled in (see CLAUDE.md → "hasUnsavedWork() didn't know Company
     Setup existed"). Operations now need that same real sign-in too, so
     this reload is armed even with an empty form — not a regression,
     the exact reasoning already documented just now also applies here. */
  check("signed in but nothing entered, reload is still guarded (redoing the real login is the cost)", await unloadArmed());

  /* ---------- Name source can mix more than one theme (2026-09-19) ----------
     Direct request: a big batch drawn from just one small pool (e.g.
     Money Heist's 15 names) starts cycling with a numeric suffix fairly
     quickly; picking more than one theme spreads it across a bigger
     combined pool instead. */
  check("starts on Bangla alone", (await page.locator('.theme-card[aria-pressed="true"]').count()) === 1);
  await page.click('.theme-card:has-text("Money Heist")');
  await page.click('.theme-card:has-text("Squid Game")');
  check("clicking more themes selects them without deselecting the others",
    (await page.locator('.theme-card[aria-pressed="true"]').count()) === 3);
  check("the summary line lists every selected theme",
    (await page.textContent("#actionSummary")).includes("Default (Random Bangla Names) + Money Heist + Squid Game"),
    await page.textContent("#actionSummary"));

  await page.click('.theme-card:has-text("Default (Random Bangla Names)")');
  await page.click('.theme-card:has-text("Money Heist")');
  check("deselecting drops back to 1", (await page.locator('.theme-card[aria-pressed="true"]').count()) === 1);
  check("the one still pressed is Squid Game",
    (await page.locator('.theme-card[aria-pressed="true"] .theme-card-title').textContent()).trim() === "Squid Game");
  await page.click('.theme-card:has-text("Squid Game")');
  check("the last remaining theme can't be clicked off",
    (await page.locator('.theme-card[aria-pressed="true"]').count()) === 1 &&
      (await page.locator('.theme-card[aria-pressed="true"] .theme-card-title').textContent()).trim() === "Squid Game");

  /* Money Heist (15 names) + Stranger Things (20 names) for a 300-row
     batch — neither pool alone could cover this without cycling through
     itself roughly 15-20 times; mixed, the combined 35-name pool cycles
     under 9 times. */
  await page.click('.theme-card:has-text("Money Heist")');
  await page.click('.theme-card:has-text("Stranger Things")');
  await page.fill("#countInput", "300");
  await page.fill("#prefixInput", "MIXX");
  await page.click("#deptSelectAll");
  await page.waitForTimeout(150);
  const M = await generate(page, XLSX, "employee-mixed");
  check("mixed generate still produces the full row count", M.rows.length === 300, String(M.rows.length));
  const lastNames = new Set(M.rows.map((r) => r[3]));
  const moneyHeistHit = ["Marquina", "Oliveira", "Fonollosa", "Murillo"].some((n) => [...lastNames].some((l) => l.startsWith(n)));
  const strangerThingsHit = ["Wheeler", "Byers", "Sinclair", "Hopper"].some((n) => [...lastNames].some((l) => l.startsWith(n)));
  check("both selected themes' names actually appear in the same file", moneyHeistHit && strangerThingsHit);
  check("mixing produced a wider spread of last names than either 15- or 20-name pool alone",
    lastNames.size > 20, String(lastNames.size));

  check("no page errors", pageErrors.length === 0, pageErrors.join(" | "));

  await browser.close();
  report("Employee Add regression", state, pageErrors);
})();
