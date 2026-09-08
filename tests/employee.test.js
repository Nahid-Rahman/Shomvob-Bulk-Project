/* Employee Add — regression guard.
 *
 * Employee Add was built and signed off first. It now shares the action bar
 * and the summary/generate dispatchers with Attendance, so this exists to
 * catch anything that breaks it while a later operation is being added.
 */
const { chromium } = require("playwright");
const { PAGE, loadSheetJs, makeChecker, report, freshDownloads, generate, signIn, watchPageErrors } = require("./lib");

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
  await page.click('.op-item:has-text("Employee Add")');
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

  /* the dashboard cards must route to their operation */
  await page.click('.op-item:has-text("Dashboard")');
  await page.waitForSelector(".op-card-grid");
  await page.click('.op-card[data-op="assets_add"]');
  await page.waitForSelector("#assetCount");
  check("dashboard card routes to its operation", await page.isVisible("#assetCount"));

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
    ["Dashboard", ".op-card-grid"],
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
  await page.waitForSelector(".op-card-grid");
  await scrollTo(500);
  await page.click('.op-card[data-op="assets_add"]');
  await page.waitForSelector("#assetCount");
  check("a dashboard card lands at the top", (await scrollNow()) === 0, String(await scrollNow()));

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
  await page.click('.op-item:has-text("Employee Add")');
  await page.waitForSelector("#countInput");
  check("discarding cleared the form", (await page.inputValue("#countInput")) !== "77",
    await page.inputValue("#countInput"));
  check("with nothing entered, reload is not guarded", !(await unloadArmed()));

  check("no page errors", pageErrors.length === 0, pageErrors.join(" | "));

  await browser.close();
  report("Employee Add regression", state, pageErrors);
})();
