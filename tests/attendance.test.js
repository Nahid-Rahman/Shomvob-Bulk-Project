/* Employee Attendance Add — end-to-end against the built index.html.
 *
 * Every check here corresponds to a rule confirmed with the user and
 * written down in SPEC.md. If one fails, either the code drifted or the
 * spec changed — check SPEC.md before "fixing" the test.
 */
const { chromium } = require("playwright");
const { PAGE, loadSheetJs, makeChecker, report, freshDownloads, generate, toMin, ymd, signIn, watchPageErrors } = require("./lib");

const XLSX = loadSheetJs();
const { check, state } = makeChecker();

const HEADER = ["Employee ID*", "Date*", "In Time*", "Out Time*"];

async function gotoAttendance(page) {
  await page.goto(PAGE);
  await signIn(page);
  await page.click('.op-item:has-text("Employee Attendance Add")');
  await page.waitForSelector("#idModeSeg");
}

/* Fills the whole form to a known baseline; each test overrides what it cares about. */
async function fillCommon(page, opts) {
  await page.click('#idModeSeg button[data-mode="paste"]');
  await page.fill("#idPaste", opts.ids.join("\n"));
  await page.fill("#fromDate", opts.from);
  await page.fill("#toDate", opts.to);
  await page.fill("#shiftCount", String(opts.shifts || 1));
  await page.fill("#graceInput", String(opts.grace == null ? 15 : opts.grace));
  await page.click(`#holidayChoices input[value="${opts.holiday || "none"}"]`);
  await page.click(`#otSeg button[data-ot="${opts.ot ? "yes" : "no"}"]`);
  await page.fill("#latePct", String(opts.latePct == null ? 0 : opts.latePct));
  await page.fill("#absentPct", String(opts.absentPct == null ? 0 : opts.absentPct));
  await page.click(`#fmtGrid button[data-fmt="${opts.fmt || "h24"}"]`);
}

(async () => {
  freshDownloads();
  const browser = await chromium.launch();
  const page = await browser.newContext({ acceptDownloads: true }).then((c) => c.newPage());
  const pageErrors = watchPageErrors(page);

  const ids = Array.from({ length: 10 }, (_, i) => "HUIW" + String(101 + i).padStart(4, "0"));
  const isWeekend = (d) => d.getDay() === 5 || d.getDay() === 6; /* Fri + Sat */

  /* September 2026, split into working days and weekend days */
  let working = 0;
  for (let d = 1; d <= 30; d++) if (!isWeekend(new Date(2026, 8, d))) working++;
  const weekendDays = 30 - working;

  /* ---------- A. baseline: one shift, nobody late, absent or on overtime ---------- */
  await gotoAttendance(page);
  await fillCommon(page, { ids, from: "2026-09-01", to: "2026-09-30" });
  const A = await generate(page, XLSX, "A-baseline");

  check("A sheet name", A.sheet === "Attendance_Bulk_Import", A.sheet);
  check("A header exact", JSON.stringify(A.header) === JSON.stringify(HEADER), JSON.stringify(A.header));
  check("A filename", /^attendance_bulk_upload_\d{8}\.xlsx$/.test(A.suggested), A.suggested);
  check("A row count = employees x working days",
    A.rows.length === ids.length * working,
    `${A.rows.length} vs ${ids.length * working}`);
  const idSet = new Set(ids);
  check("A only the supplied IDs", A.rows.every((r) => idSet.has(r[0])));
  check("A no weekend rows", A.rows.every((r) => !isWeekend(ymd(r[1]))));
  check("A dates inside range", A.rows.every((r) => r[1] >= "2026-09-01" && r[1] <= "2026-09-30"));
  check("A 24h format", A.rows.every((r) => /^\d{2}:\d{2}$/.test(r[2]) && /^\d{2}:\d{2}$/.test(r[3])));
  check("A in-time inside [08:50, 09:15]",
    A.rows.every((r) => toMin(r[2]) >= 530 && toMin(r[2]) <= 555),
    "min=" + Math.min(...A.rows.map((r) => toMin(r[2]))) + " max=" + Math.max(...A.rows.map((r) => toMin(r[2]))));
  check("A out-time inside [17:00, 17:10]",
    A.rows.every((r) => toMin(r[3]) >= 1020 && toMin(r[3]) <= 1030),
    "min=" + Math.min(...A.rows.map((r) => toMin(r[3]))) + " max=" + Math.max(...A.rows.map((r) => toMin(r[3]))));
  check("A jitter actually varies", new Set(A.rows.map((r) => r[2])).size > 1);

  /* ---------- B. weekend overtime: the whole day is overtime ---------- */
  await gotoAttendance(page);
  await fillCommon(page, { ids, from: "2026-09-01", to: "2026-09-30", ot: true });
  await page.fill("#otWeekday", "0");
  await page.fill("#otWeekend", "4");
  await page.fill("#otHoliday", "0");
  await page.fill("#otPctWeekday", "0");
  await page.fill("#otPctWeekend", "100");
  await page.fill("#otPctHoliday", "0");
  const B = await generate(page, XLSX, "B-weekend-ot");

  const wRows = B.rows.filter((r) => isWeekend(ymd(r[1])));
  check("B weekend rows appear", wRows.length === ids.length * weekendDays,
    `${wRows.length} vs ${ids.length * weekendDays}`);
  check("B weekend In = shift start", wRows.every((r) => toMin(r[2]) === 540));
  check("B weekend Out inside start+1min .. start+4h",
    wRows.every((r) => toMin(r[3]) > 540 && toMin(r[3]) <= 780),
    "max=" + Math.max(...wRows.map((r) => toMin(r[3]))));

  /* ---------- C. two shifts, assigned explicitly, no employee in both ---------- */
  await gotoAttendance(page);
  await fillCommon(page, {
    ids: ["AAAA0001", "AAAA0002", "AAAA0003", "BBBB0001", "BBBB0002"],
    from: "2026-09-07", to: "2026-09-11", shifts: 2,
  });
  await page.fill('#shiftList input[data-shift="1"][data-side="in"]', "14:00");
  await page.fill('#shiftList input[data-shift="1"][data-side="out"]', "22:00");
  await page.fill('.assign-search input[data-shift="0"]', "AAAA");
  await page.click('button[data-act="all"][data-shift="0"]');
  await page.fill('.assign-search input[data-shift="1"]', "BBBB");
  await page.click('button[data-act="all"][data-shift="1"]');
  const C = await generate(page, XLSX, "C-two-shifts");

  const aRows = C.rows.filter((r) => r[0].startsWith("AAAA"));
  const bRows = C.rows.filter((r) => r[0].startsWith("BBBB"));
  check("C both shifts produced rows", aRows.length > 0 && bRows.length > 0, `A=${aRows.length} B=${bRows.length}`);
  check("C shift 1 employees start near 09:00", aRows.every((r) => toMin(r[2]) >= 530 && toMin(r[2]) <= 555));
  check("C shift 2 employees start near 14:00", bRows.every((r) => toMin(r[2]) >= 830 && toMin(r[2]) <= 855),
    bRows[0] && bRows[0].join(" | "));
  check("C every row belongs to exactly one shift", aRows.length + bRows.length === C.rows.length);

  /* ---------- D. a shift crossing midnight stays one row ---------- */
  await gotoAttendance(page);
  await fillCommon(page, { ids: ["NITE0001"], from: "2026-09-07", to: "2026-09-11" });
  await page.fill('#shiftList input[data-shift="0"][data-side="in"]', "22:00");
  await page.fill('#shiftList input[data-shift="0"][data-side="out"]', "06:00");
  const D = await generate(page, XLSX, "D-night");

  /* 2026-09-11 is a Friday, so Mon-Thu are the working days here */
  check("D one row per working day", D.rows.length === 4, String(D.rows.length));
  check("D dated by the day the shift started",
    D.rows.map((r) => r[1]).join(",") === "2026-09-07,2026-09-08,2026-09-09,2026-09-10",
    D.rows.map((r) => r[1]).join(","));
  check("D in-time near 22:00", D.rows.every((r) => toMin(r[2]) >= 1310 && toMin(r[2]) <= 1335));
  check("D out-time near 06:00 the next morning",
    D.rows.every((r) => toMin(r[3]) >= 360 && toMin(r[3]) <= 370),
    D.rows[0] && D.rows[0].join(" | "));

  /* ---------- E. all four accepted time formats ---------- */
  const patterns = {
    h12: /^\d{2}:\d{2} (AM|PM)$/,
    h24: /^\d{2}:\d{2}$/,
    h24s: /^\d{2}:\d{2}:\d{2}$/,
    h12s: /^\d{2}:\d{2}:\d{2} (AM|PM)$/,
  };
  for (const fmt of Object.keys(patterns)) {
    await gotoAttendance(page);
    await fillCommon(page, { ids: ["FMTX0001"], from: "2026-09-07", to: "2026-09-08", fmt });
    const E = await generate(page, XLSX, "E-" + fmt);
    check("E format " + fmt,
      E.rows.length > 0 && E.rows.every((r) => patterns[fmt].test(r[2]) && patterns[fmt].test(r[3])),
      E.rows[0] && E.rows[0].join(" | "));
  }

  /* ---------- F. government holidays produce nothing ---------- */
  await gotoAttendance(page);
  await fillCommon(page, { ids, from: "2026-12-01", to: "2026-12-31", holiday: "govt" });
  const F = await generate(page, XLSX, "F-holidays");
  const onHolidays = F.rows.filter((r) => r[1] === "2026-12-16" || r[1] === "2026-12-25");
  check("F govt holidays produce no rows", onHolidays.length === 0, String(onHolidays.length));

  /* ---------- G. absence is the absence of a row ---------- */
  await gotoAttendance(page);
  await fillCommon(page, { ids, from: "2026-09-01", to: "2026-09-30", absentPct: 100 });
  const G = await generate(page, XLSX, "G-all-absent").catch(() => null);
  check("G 100% absent yields no data rows", !G || G.rows.length === 0, G ? String(G.rows.length) : "no file");

  /* ---------- H. lateness is measured from the end of grace ---------- */
  await gotoAttendance(page);
  await fillCommon(page, { ids, from: "2026-09-01", to: "2026-09-30", latePct: 100, grace: 15 });
  const H = await generate(page, XLSX, "H-all-late");
  check("H everyone late: in-time inside (09:15, 10:15]",
    H.rows.every((r) => toMin(r[2]) > 555 && toMin(r[2]) <= 615),
    "min=" + Math.min(...H.rows.map((r) => toMin(r[2]))) + " max=" + Math.max(...H.rows.map((r) => toMin(r[2]))));

  await browser.close();
  report("Employee Attendance Add", state, pageErrors);
})();
