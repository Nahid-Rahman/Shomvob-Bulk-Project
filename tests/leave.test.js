/* Leave Balance Add — end-to-end against the built index.html.
 *
 * This operation reads the system's own export and fills only the
 * "Already Used Leave" column, so the test builds a fixture shaped like a
 * real export (including the awkward rows), uploads it, and checks both
 * what changed and — just as important — what did not.
 *
 * Every check maps to a rule in SPEC.md. If one fails, read SPEC.md before
 * changing the test.
 */
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const { PAGE, DOWNLOADS, loadSheetJs, makeChecker, report, freshDownloads, generate, signIn } = require("./lib");

const XLSX = loadSheetJs();
const { check, state } = makeChecker();

const SHEET = "Leave_Balance_Already_Used_Upda";
const HEADER = ["Employee ID", "Employee Name", "Leave Type Name", "Total Allocated", "Earned Leave", "Already Used Leave"];

/* Total, Earned, and an existing Already Used. Chosen to cover: plenty of
   headroom, half-step allocations, an existing value that must be beaten,
   a row already at its ceiling, and a row with no allocation at all. */
const FIXTURE = [
  ["E_001", "Mini Moo", "Annual Leave", 15, 4, 0],
  ["E_001", "Mini Moo", "Casual Leave", 10, 2, 0],
  ["E_001", "Mini Moo", "Sick Leave", 14, 0, 3],
  ["E_001", "Mini Moo", "Sad Leave", 3, 0, 2.5],
  ["HSWW001", "Harry Potter", "Annual Leave", 12.5, 2.5, 0],
  ["HSWW001", "Harry Potter", "Casual Leave", 6.5, 1, 1],
  ["HSWW001", "Harry Potter", "Fight With Voldemort", 10, 0, 0],
  ["HSWW002", "Hermione Granger", "Annual Leave", 5, 0, 0],
  ["HSWW002", "Hermione Granger", "Sad Leave", 3, 0, 0],
  ["HSWW003", "Ron Weasley", "Annual Leave", 0, 0, 0],
];

const STEP = 0.5;
const roundHalf = (v) => Math.round(v / STEP) * STEP;
const floorHalf = (v) => Math.floor(v / STEP) * STEP;
const ceilingOf = (total, earned) => {
  const cap = total + earned;
  if (!(cap > 0)) return 0;
  const c = floorHalf(cap - STEP);
  return c > 0 ? c : 0;
};

function yearProgress(d) {
  const start = new Date(d.getFullYear(), 0, 1);
  const end = new Date(d.getFullYear() + 1, 0, 1);
  return (d - start) / (end - start);
}

function writeFixture(file, rows, header, sheet) {
  const ws = XLSX.utils.aoa_to_sheet([header].concat(rows));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheet);
  fs.writeFileSync(file, XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}

(async () => {
  freshDownloads();
  const fixtures = path.join(DOWNLOADS, "fixtures");
  fs.mkdirSync(fixtures, { recursive: true });

  const good = path.join(fixtures, "leave_export.xlsx");
  writeFixture(good, FIXTURE, HEADER, SHEET);

  const wrong = path.join(fixtures, "not_a_leave_export.xlsx");
  writeFixture(wrong, [["x", 1]], ["Some Column", "Another"], "Sheet1");

  const browser = await chromium.launch();
  const page = await browser.newContext({ acceptDownloads: true }).then((c) => c.newPage());
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") pageErrors.push("console: " + m.text()); });

  await page.goto(PAGE);
  await signIn(page);
  await page.click('.op-item:has-text("Leave Balance Add")');
  await page.waitForSelector("#leaveFile");

  /* ---------- nothing uploaded yet ---------- */
  check("generate disabled before upload", await page.isDisabled("#generateBtn"));

  /* ---------- a file without the six columns is refused ---------- */
  await page.setInputFiles("#leaveFile", wrong);
  await page.waitForSelector(".toast.show");
  const toast = await page.textContent(".toast");
  check("wrong file rejected", /pawa jayni/.test(toast), toast);
  check("generate still disabled after wrong file", await page.isDisabled("#generateBtn"));

  /* ---------- the real shape ---------- */
  await page.setInputFiles("#leaveFile", good);
  await page.waitForFunction(() => !document.querySelector("#generateBtn").disabled);

  const L = await generate(page, XLSX, "leave");

  check("sheet name round-trips", L.sheet === SHEET, L.sheet);
  check("header unchanged", JSON.stringify(L.header) === JSON.stringify(HEADER), JSON.stringify(L.header));
  check("filename", /^leave_balance_already_used_update_\d{4}-\d{2}-\d{2}\.xlsx$/.test(L.suggested), L.suggested);
  check("row count preserved", L.rows.length === FIXTURE.length, `${L.rows.length} vs ${FIXTURE.length}`);

  const prog = yearProgress(new Date());
  let bandChecked = 0;

  FIXTURE.forEach((src, i) => {
    const out = L.rows[i];
    const [id, name, type, total, earned, existing] = src;
    const label = `${id}/${type}`;

    /* the five carried-through columns must be untouched, order included */
    check(`row ${i} identity preserved (${label})`,
      out[0] === id && out[1] === name && out[2] === type &&
      Number(out[3]) === total && Number(out[4]) === earned,
      JSON.stringify(out.slice(0, 5)));

    const used = Number(out[5]);
    const ceiling = ceilingOf(total, earned);

    check(`row ${i} used is a half step (${label})`, used % STEP === 0, String(used));
    check(`row ${i} used < total + earned (${label})`,
      used < total + earned || (total + earned === 0 && used === 0),
      `${used} vs ${total + earned}`);

    if (ceiling <= 0 || existing >= ceiling) {
      /* no headroom, or already at the ceiling — must come back untouched */
      check(`row ${i} left untouched (${label})`, used === existing, `${used} vs ${existing}`);
    } else if (existing > 0) {
      check(`row ${i} increased past existing (${label})`, used > existing, `${used} vs ${existing}`);
    } else {
      /* fresh row: value should sit in the month-scaled band, allowing for
         half-step rounding at either end */
      const expected = ceiling * prog;
      const lo = roundHalf(expected * 0.6) - STEP;
      const hi = Math.min(ceiling, roundHalf(expected) + STEP);
      check(`row ${i} inside the month-scaled band (${label})`,
        used >= Math.max(0, lo) && used <= hi,
        `${used} not in [${Math.max(0, lo)}, ${hi}] (ceiling=${ceiling}, progress=${prog.toFixed(2)})`);
      bandChecked++;
    }
  });

  check("band actually exercised", bandChecked >= 4, String(bandChecked));

  /* the one-decimal presentation of the export is kept */
  const wb = XLSX.read(fs.readFileSync(path.join(DOWNLOADS, "leave.xlsx")), { type: "buffer", cellNF: true });
  const ws = wb.Sheets[SHEET];
  check("numeric columns keep the #,##0.0 format",
    ws["D2"] && ws["D2"].z === "#,##0.0" && ws["F2"] && ws["F2"].z === "#,##0.0",
    `D2.z=${ws["D2"] && ws["D2"].z} F2.z=${ws["F2"] && ws["F2"].z}`);

  /* regenerating gives different values — this is random data, not a fixture */
  const L2 = await generate(page, XLSX, "leave-again");
  const changed = L.rows.some((r, i) => Number(r[5]) !== Number(L2.rows[i][5]));
  check("re-generating reshuffles the values", changed);

  check("no page errors", pageErrors.length === 0, pageErrors.join(" | "));

  await browser.close();
  report("Leave Balance Add", state, pageErrors);
})();
