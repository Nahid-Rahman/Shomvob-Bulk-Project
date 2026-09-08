/* Payroll Custom Field Add — end-to-end against the built index.html.
 *
 * Like Leave Balance this fills in the system's own export, so the test
 * writes a fixture shaped like a real one — including a company-configured
 * field name with a typo in it, and a cell that already carries a value.
 *
 * Every check maps to a rule in SPEC.md. Read SPEC.md before changing one.
 */
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const { PAGE, DOWNLOADS, loadSheetJs, makeChecker, report, freshDownloads, generate, signIn, watchPageErrors } = require("./lib");

const XLSX = loadSheetJs();
const { check, state } = makeChecker();

const SHEET = "Custom Add-Deduct";
/* "Maintainance" and "Quiditch" are misspelled in the real export. They
   must survive verbatim — we are not in the business of correcting a
   company's own field names. */
const FIELDS = [
  "Helped A Professor (+)",
  "OWL Maintainance (+)",
  "Win Quiditch Match (+)",
  "Helped Harry Potter (+)",
  "Used Spell On Student (-)",
  "Friends With Malfoy (-)",
  "Used Felix Felisis (-)",
  "Using Unforgivable Curses (-)",
];
const HEADER = ["Employee ID", "Employee Name"].concat(FIELDS);

/* 60 employees x 8 fields = 480 cells, enough for coverage to be
   measurable. Employee IDs are deliberately inconsistent, as the real
   export's were. */
const NAMES = ["Harry Potter", "Hermione Granger", "Ron Weasley", "Albus Dumbledore", "Severus Snape"];
const FIXTURE = [];
for (let i = 0; i < 60; i++) {
  const id = i === 0 ? "DEMOC006qer2" : i === 1 ? "E_001" : i === 2 ? "EMP_01" : "HSWW" + String(i).padStart(3, "0");
  FIXTURE.push([id, NAMES[i % NAMES.length], 0, 0, 0, 0, 0, 0, 0, 0]);
}
/* one pre-existing value that must never be disturbed */
const PRESET_ROW = 4;
const PRESET_COL = 3; /* "OWL Maintainance (+)" */
const PRESET_VALUE = 7777;
FIXTURE[PRESET_ROW][PRESET_COL] = PRESET_VALUE;

function writeFixture(file, rows, header, sheet) {
  const ws = XLSX.utils.aoa_to_sheet([header].concat(rows));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheet);
  fs.writeFileSync(file, XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}

const FIELD_COLS = FIELDS.map((_, i) => i + 2);

function cellStats(rows) {
  let filled = 0, zero = 0, allZeroEmployees = 0;
  rows.forEach((r) => {
    let touched = 0;
    FIELD_COLS.forEach((c) => {
      const v = Number(r[c]) || 0;
      if (v !== 0) { filled++; touched++; } else zero++;
    });
    if (!touched) allZeroEmployees++;
  });
  return { filled, zero, allZeroEmployees };
}

(async () => {
  freshDownloads();
  const fixtures = path.join(DOWNLOADS, "fixtures");
  fs.mkdirSync(fixtures, { recursive: true });

  const good = path.join(fixtures, "custom-additions-deductions-H-2026-09.xlsx");
  writeFixture(good, FIXTURE, HEADER, SHEET);

  const wrong = path.join(fixtures, "not_a_payroll_export.xlsx");
  writeFixture(wrong, [["x", 1]], ["Widget", "Count"], "Sheet1");

  const browser = await chromium.launch();
  const page = await browser.newContext({ acceptDownloads: true }).then((c) => c.newPage());
  const pageErrors = watchPageErrors(page);

  await page.goto(PAGE);
  await signIn(page);
  await page.click('.op-item:has-text("Payroll Custom Field Add")');
  await page.waitForSelector("#payrollFile");

  check("generate disabled before upload", await page.isDisabled("#generateBtn"));

  /* ---------- a file without the identity columns is refused ---------- */
  await page.setInputFiles("#payrollFile", wrong);
  await page.waitForSelector(".toast.show");
  check("wrong file rejected", /pawa jayni/.test(await page.textContent(".toast")));
  check("generate still disabled", await page.isDisabled("#generateBtn"));

  /* ---------- the real shape ---------- */
  await page.setInputFiles("#payrollFile", good);
  await page.waitForFunction(() => !document.querySelector("#generateBtn").disabled);

  check("addition/deduction split detected",
    /<strong>4<\/strong> addition · <strong>4<\/strong> deduction/.test(await page.innerHTML("#payrollTally")),
    await page.textContent("#payrollTally"));

  /* ---------- 100% coverage: every zero cell must be filled ---------- */
  await page.selectOption("#payrollCoverage", "100");
  await page.fill("#payrollMin", "500");
  await page.fill("#payrollMax", "10000");
  await page.fill("#payrollStep", "100");
  const full = await generate(page, XLSX, "payroll-100");

  check("sheet name round-trips", full.sheet === SHEET, full.sheet);
  check("header verbatim, typos and signs intact",
    JSON.stringify(full.header) === JSON.stringify(HEADER),
    JSON.stringify(full.header));
  check("filename reuses the upload's own name",
    full.suggested === "custom-additions-deductions-H-2026-09.xlsx", full.suggested);
  check("row count preserved", full.rows.length === FIXTURE.length, `${full.rows.length} vs ${FIXTURE.length}`);

  let identityOk = true, rangeOk = true, stepOk = true;
  FIXTURE.forEach((src, i) => {
    const out = full.rows[i];
    if (out[0] !== src[0] || out[1] !== src[1]) identityOk = false;
    FIELD_COLS.forEach((c) => {
      const v = Number(out[c]);
      if (i === PRESET_ROW && c === PRESET_COL) return; /* checked separately */
      if (v !== 0 && (v < 500 || v > 10000)) rangeOk = false;
      if (v % 100 !== 0) stepOk = false;
    });
  });
  check("employee id and name untouched, order preserved", identityOk);
  check("amounts inside min-max", rangeOk);
  check("amounts land on the step", stepOk);

  const fullStats = cellStats(full.rows);
  check("at 100% every cell carries a value",
    fullStats.zero === 0 && fullStats.filled === FIXTURE.length * FIELDS.length,
    `filled=${fullStats.filled} zero=${fullStats.zero}`);
  check("at 100% no employee left empty", fullStats.allZeroEmployees === 0, String(fullStats.allZeroEmployees));
  check("pre-existing value untouched at 100%",
    Number(full.rows[PRESET_ROW][PRESET_COL]) === PRESET_VALUE,
    String(full.rows[PRESET_ROW][PRESET_COL]));

  /* ---------- 10% coverage: sparse, and some employees fully empty ---------- */
  await page.selectOption("#payrollCoverage", "10");
  const sparse = await generate(page, XLSX, "payroll-10");
  const sparseStats = cellStats(sparse.rows);
  const total = FIXTURE.length * FIELDS.length;

  check("at 10% only a slice of cells filled",
    sparseStats.filled > 5 && sparseStats.filled < total * 0.35,
    `${sparseStats.filled} of ${total}`);
  check("at 10% some employees stay entirely 0",
    sparseStats.allZeroEmployees > 0,
    String(sparseStats.allZeroEmployees));
  check("pre-existing value untouched at 10%",
    Number(sparse.rows[PRESET_ROW][PRESET_COL]) === PRESET_VALUE,
    String(sparse.rows[PRESET_ROW][PRESET_COL]));

  /* ---------- a custom range is honoured ---------- */
  await page.selectOption("#payrollCoverage", "100");
  await page.fill("#payrollMin", "2000");
  await page.fill("#payrollMax", "2500");
  await page.fill("#payrollStep", "500");
  const ranged = await generate(page, XLSX, "payroll-range");
  const vals = [];
  ranged.rows.forEach((r, i) =>
    FIELD_COLS.forEach((c) => {
      if (!(i === PRESET_ROW && c === PRESET_COL)) vals.push(Number(r[c]));
    })
  );
  check("custom range respected", vals.every((v) => v === 2000 || v === 2500),
    "unexpected: " + Array.from(new Set(vals.filter((v) => v !== 2000 && v !== 2500))).slice(0, 5).join(","));

  /* ---------- min above max is refused ---------- */
  await page.fill("#payrollMax", "100");
  check("min above max disables generate", await page.isDisabled("#generateBtn"));
  check("range error shown", (await page.textContent("#payrollRangeError")).length > 0);

  check("no page errors", pageErrors.length === 0, pageErrors.join(" | "));

  await browser.close();
  report("Payroll Custom Field Add", state, pageErrors);
})();
