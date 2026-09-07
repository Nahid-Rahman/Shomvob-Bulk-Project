/* Assets Add — end-to-end against the built index.html.
 *
 * A blank template like Attendance, so rows are built from scratch. The
 * asset type and name pools are read out of src/app-data.js rather than
 * restated here, so the test checks the app against its own tables.
 *
 * Every check maps to a rule in SPEC.md. Read SPEC.md before changing one.
 */
const { chromium } = require("playwright");
const { PAGE, loadSheetJs, loadAppData, normalizeRow, makeChecker, report, freshDownloads, generate, ymd } = require("./lib");

const XLSX = loadSheetJs();
const DATA = loadAppData([
  "DEFAULT_ASSET_TYPES",
  "ASSETS_HEADER",
  "ASSETS_SHEET",
  "ASSETS_ASSIGNED_BAND",
  "ASSETS_ASSIGNED_WINDOW_DAYS",
]);
const { check, state } = makeChecker();

const W = DATA.ASSETS_HEADER.length;
const COL = { image: 0, code: 1, name: 2, type: 3, desc: 4, empId: 5, date: 6 };

/* name -> { type, description }, straight from the app's own tables */
const NAME_INDEX = new Map();
DATA.DEFAULT_ASSET_TYPES.forEach((t) =>
  t.items.forEach((it) => NAME_INDEX.set(it[0], { type: t.name, desc: it[1] }))
);

async function gotoAssets(page) {
  await page.goto(PAGE);
  await page.click('.op-item:has-text("Assets Add")');
  await page.waitForSelector("#assetCount");
}

/* Compare midnight to midnight. Measuring against `new Date()` counts the
   current time of day as extra elapsed days, which makes a date exactly at
   the edge of the window look a day older than it is. */
function daysAgo(dateStr, fromMidnight) {
  return Math.round((fromMidnight - ymd(dateStr)) / 86400000);
}
function todayMidnight() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

(async () => {
  freshDownloads();
  const browser = await chromium.launch();
  const page = await browser.newContext({ acceptDownloads: true }).then((c) => c.newPage());
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") pageErrors.push("console: " + m.text()); });

  /* ---------- A. defaults, no employee IDs: everything unassigned ---------- */
  await gotoAssets(page);
  check("generate enabled out of the box", !(await page.isDisabled("#generateBtn")));

  await page.fill("#assetCount", "40");
  await page.fill("#assetPrefix", "AST");
  const A = await generate(page, XLSX, "assets-unassigned");
  const aRows = A.rows.map((r) => normalizeRow(r, W));

  check("A sheet name", A.sheet === DATA.ASSETS_SHEET, A.sheet);
  check("A header exact",
    JSON.stringify(A.header) === JSON.stringify(DATA.ASSETS_HEADER),
    JSON.stringify(A.header));
  check("A filename", /^AST_assets_bulk_upload_\d{8}\.xlsx$/.test(A.suggested), A.suggested);
  check("A row count", aRows.length === 40, String(aRows.length));

  check("A codes sequential and unique",
    aRows.every((r, i) => r[COL.code] === "AST" + String(i + 1).padStart(4, "0")),
    aRows[0][COL.code] + " .. " + aRows[39][COL.code]);
  check("A asset image always blank", aRows.every((r) => r[COL.image] === ""));
  check("A required columns never blank",
    aRows.every((r) => r[COL.code] && r[COL.name] && r[COL.type]));

  check("A name belongs to its own type, with the matching description",
    aRows.every((r) => {
      const hit = NAME_INDEX.get(r[COL.name]);
      return hit && hit.type === r[COL.type] && hit.desc === r[COL.desc];
    }),
    aRows.map((r) => r[COL.name] + "/" + r[COL.type]).find((s) => {
      const [n, t] = s.split("/");
      const hit = NAME_INDEX.get(n);
      return !hit || hit.type !== t;
    }) || "");

  check("A with no employee IDs nothing is assigned",
    aRows.every((r) => r[COL.empId] === "" && r[COL.date] === ""),
    JSON.stringify(aRows.find((r) => r[COL.empId] || r[COL.date]) || []));

  /* ---------- B. with an ID pool: 70-80% assigned ---------- */
  const ids = Array.from({ length: 12 }, (_, i) => "HSWW" + String(i + 1).padStart(3, "0"));
  await gotoAssets(page);
  await page.fill("#assetCount", "200");
  await page.fill("#assetPrefix", "LAPT");
  await page.click('#idModeSeg button[data-mode="paste"]');
  await page.fill("#idPaste", ids.join("\n"));
  const B = await generate(page, XLSX, "assets-assigned");
  const bRows = B.rows.map((r) => normalizeRow(r, W));

  check("B prefix honoured", bRows[0][COL.code] === "LAPT0001", bRows[0][COL.code]);

  const assignedRows = bRows.filter((r) => r[COL.empId] !== "");
  const share = assignedRows.length / bRows.length;
  const band = DATA.ASSETS_ASSIGNED_BAND;
  check(`B assigned share near ${band.low}-${band.high}%`,
    share >= 0.6 && share <= 0.9,
    `${(share * 100).toFixed(1)}% (${assignedRows.length}/${bRows.length})`);

  const idSet = new Set(ids);
  check("B assigned IDs come from the pool",
    assignedRows.every((r) => idSet.has(r[COL.empId])),
    assignedRows.map((r) => r[COL.empId]).find((v) => !idSet.has(v)) || "");
  check("B every assigned row also carries a date",
    assignedRows.every((r) => /^\d{4}-\d{2}-\d{2}$/.test(r[COL.date])),
    JSON.stringify(assignedRows.find((r) => !/^\d{4}-\d{2}-\d{2}$/.test(r[COL.date])) || []));
  check("B unassigned rows leave both columns blank",
    bRows.filter((r) => r[COL.empId] === "").every((r) => r[COL.date] === ""));

  const midnight = todayMidnight();
  const ages = assignedRows.map((r) => daysAgo(r[COL.date], midnight));
  check("B assigned dates inside the last year, never future",
    ages.every((d) => d >= 0 && d <= DATA.ASSETS_ASSIGNED_WINDOW_DAYS),
    `min=${Math.min(...ages)} max=${Math.max(...ages)}`);
  check("B dates actually spread out", new Set(assignedRows.map((r) => r[COL.date])).size > 5);
  check("B more than one employee used", new Set(assignedRows.map((r) => r[COL.empId])).size > 1);

  /* ---------- C. narrowing the type list narrows the output ---------- */
  await gotoAssets(page);
  await page.fill("#assetCount", "30");
  const cards = page.locator("#assetTypeList .dept-card");
  const cardCount = await cards.count();
  check("C one card per default type", cardCount === DATA.DEFAULT_ASSET_TYPES.length, String(cardCount));

  /* leave only the first type checked */
  for (let i = cardCount - 1; i >= 1; i--) {
    await page.locator("#assetTypeList .dept-card").nth(i).locator(".dept-checkbox").uncheck();
  }
  const onlyType = DATA.DEFAULT_ASSET_TYPES[0];
  const C = await generate(page, XLSX, "assets-one-type");
  const cRows = C.rows.map((r) => normalizeRow(r, W));
  check("C only the checked type appears",
    cRows.every((r) => r[COL.type] === onlyType.name),
    Array.from(new Set(cRows.map((r) => r[COL.type]))).join(","));
  const poolNames = new Set(onlyType.items.map((it) => it[0]));
  check("C names come only from that type's pool",
    cRows.every((r) => poolNames.has(r[COL.name])));

  /* unchecking everything must block generation */
  await page.locator("#assetTypeList .dept-card").nth(0).locator(".dept-checkbox").uncheck();
  check("C no type selected disables generate", await page.isDisabled("#generateBtn"));
  check("C warning banner shown",
    !(await page.locator("#assetTypeWarning").getAttribute("class")).includes("hidden"));

  /* ---------- D. a custom type with a custom name ---------- */
  await gotoAssets(page);
  await page.fill("#assetCount", "25");
  for (let i = (await page.locator("#assetTypeList .dept-card").count()) - 1; i >= 0; i--) {
    await page.locator("#assetTypeList .dept-card").nth(i).locator(".dept-checkbox").uncheck();
  }
  await page.click("#addAssetTypeBtn");
  const customCard = page.locator("#assetTypeList .dept-card").last();
  await customCard.locator(".dept-name-input").fill("Safety Gear");
  await customCard.locator(".tiny-btn").click();
  await page.locator("#assetTypeList .dept-card").last().locator('input[placeholder="Asset name"]').fill("Fire Extinguisher 5kg");
  const D = await generate(page, XLSX, "assets-custom-type");
  const dRows = D.rows.map((r) => normalizeRow(r, W));

  check("D custom type used",
    dRows.every((r) => r[COL.type] === "Safety Gear" && r[COL.name] === "Fire Extinguisher 5kg"),
    JSON.stringify(dRows[0]));
  check("D custom names carry no invented description",
    dRows.every((r) => r[COL.desc] === ""),
    dRows[0][COL.desc]);

  /* ---------- E. input validation ---------- */
  await gotoAssets(page);
  await page.fill("#assetPrefix", "A");
  check("E one-letter prefix rejected", await page.isDisabled("#generateBtn"));
  check("E prefix error shown", (await page.textContent("#assetPrefixError")).length > 0);
  await page.fill("#assetPrefix", "AST");
  await page.fill("#assetCount", "0");
  check("E zero count rejected", await page.isDisabled("#generateBtn"));
  await page.fill("#assetCount", "6000");
  check("E count above 5000 rejected", await page.isDisabled("#generateBtn"));
  await page.fill("#assetCount", "10");
  check("E valid input re-enables generate", !(await page.isDisabled("#generateBtn")));

  check("no page errors", pageErrors.length === 0, pageErrors.join(" | "));

  await browser.close();
  report("Assets Add", state, pageErrors);
})();
