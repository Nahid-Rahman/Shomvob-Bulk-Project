/* Employee Add — regression guard.
 *
 * Employee Add was built and signed off first. It now shares the action bar
 * and the summary/generate dispatchers with Attendance, so this exists to
 * catch anything that breaks it while a later operation is being added.
 */
const { chromium } = require("playwright");
const { PAGE, loadSheetJs, makeChecker, report, freshDownloads, generate } = require("./lib");

const XLSX = loadSheetJs();
const { check, state } = makeChecker();

(async () => {
  freshDownloads();
  const browser = await chromium.launch();
  const page = await browser.newContext({ acceptDownloads: true }).then((c) => c.newPage());
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(String(e)));

  await page.goto(PAGE);
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

  /* switching operations must leave both forms usable */
  await page.click('.op-item:has-text("Employee Attendance Add")');
  await page.waitForSelector("#idModeSeg");
  await page.click('.op-item:has-text("Employee Add")');
  await page.waitForSelector("#countInput");
  check("switching back re-renders Employee Add", await page.isVisible("#countInput"));
  check("no page errors", pageErrors.length === 0, pageErrors.join(" | "));

  await browser.close();
  report("Employee Add regression", state, pageErrors);
})();
