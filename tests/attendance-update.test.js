/* Attendance update (Preview) — end-to-end against the built index.html.
 *
 * Every check maps to a rule in SPEC.md → "Attendance update (Preview)",
 * confirmed with the user 2026-10-06. If one fails, check SPEC.md before
 * "fixing" the test.
 *
 * Fixture: 20 IDs, Sep + Oct 2026, Fri/Sat weekend, no holidays, one shift
 * 09:00–18:00, grace 15, late cutoff 09:30, absent after 10:00, half day 4,
 * HH:MM:SS output so band edges are visible to the second.
 */
const { chromium } = require("playwright");
const { PAGE, loadSheetJs, makeChecker, report, freshDownloads, generate, ymd, signIn, mockToolSignIn, watchPageErrors, mockPublicStats } = require("./lib");

const XLSX = loadSheetJs();
const { check, state } = makeChecker();

const IDS = Array.from({ length: 20 }, (_, i) => "ATTX" + String(i + 1).padStart(4, "0"));
const FROM = "2026-09-01";
const TO = "2026-10-31";

/* Working days per month (Fri/Sat weekend, no holidays). */
const WORKING = { "2026-09": [], "2026-10": [] };
for (let d = new Date(2026, 8, 1); d <= new Date(2026, 9, 31); d.setDate(d.getDate() + 1)) {
  if (d.getDay() === 5 || d.getDay() === 6) continue;
  const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  WORKING[ds.slice(0, 7)].push(ds);
}

function toSec(t) {
  const m = /^(\d{2}):(\d{2}):(\d{2})$/.exec(t);
  return m ? +m[1] * 3600 + +m[2] * 60 + +m[3] : null;
}
const S = (hms) => toSec(hms);
/* Band of a check-in second, with the real system's second truncation. */
function band(sec) {
  if (sec <= S("09:15:59")) return "ontime";
  if (sec <= S("09:30:59")) return "late";
  if (sec <= S("10:00:59")) return "cutoff";
  return "absent_after";
}

/* id -> month -> { present: Map(date -> inSec), outs: [] } */
function analyse(rows) {
  const by = new Map();
  rows.forEach(([id, ds, inT, outT]) => {
    if (!by.has(id)) by.set(id, {});
    const m = ds.slice(0, 7);
    const rec = by.get(id);
    if (!rec[m]) rec[m] = { present: new Map(), outs: [] };
    rec[m].present.set(ds, toSec(inT));
    rec[m].outs.push(toSec(outT));
  });
  return by;
}
function monthsOf(by, id) {
  const rec = by.get(id) || {};
  return Object.keys(WORKING).map((m) => ({ m, days: WORKING[m], rec: rec[m] || { present: new Map(), outs: [] } }));
}
/* Lengths of runs of consecutive working days matching `pred`, in order. */
function runs(days, pred) {
  const out = [];
  let cur = 0;
  days.forEach((ds) => {
    if (pred(ds)) cur++;
    else if (cur) {
      out.push(cur);
      cur = 0;
    }
  });
  if (cur) out.push(cur);
  return out;
}

async function openPage(page) {
  await mockPublicStats(page);
  await page.goto(PAGE);
  await signIn(page);
  await mockToolSignIn(page);
  await page.route("**/rest/v1/rpc/is_admin", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "false" }));
  await page.route("**/rest/v1/rpc/my_preview", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "true" }));
  await page.click("#welcomeLoginBtn");
  await page.fill("#opGateEmail", "tester@shomvob.com");
  await page.fill("#opGatePass", "whatever");
  await page.click("#opGateSignInBtn");
  await page.waitForSelector("#previewNav .op-item");
  await page.click('#previewNav .op-item:has-text("Attendance update")');
  await page.waitForSelector("#attxModeSeg");
}

async function fillCommon(page, { cutoff = "09:30", absentAfter = "10:00" } = {}) {
  await page.click('#idModeSeg button[data-mode="paste"]');
  await page.fill("#idPaste", IDS.join("\n"));
  await page.fill("#fromDate", FROM);
  await page.fill("#toDate", TO);
  await page.fill("#shiftCount", "1");
  await page.fill("#graceInput", "15");
  await page.fill('#shiftList input[data-side="in"]', "09:00");
  await page.fill('#shiftList input[data-side="out"]', "18:00");
  await page.fill('#shiftList input[data-side="cutoff"]', cutoff);
  await page.fill('#shiftList input[data-side="absentAfter"]', absentAfter);
  await page.fill('#shiftList input[data-side="halfDay"]', "4");
  await page.click('#holidayChoices input[value="none"]');
  await page.click('#fmtGrid button[data-fmt="h24s"]');
}

async function pickDeduction(page, type, { repeated = false, pct = 50, n, threshold } = {}) {
  await page.click('#attxModeSeg button[data-mode="deduction"]');
  await page.check(`#attxTypeChoices input[value="${type}"]`);
  await page.click(`#attxRepeatSeg button[data-rep="${repeated ? "yes" : "no"}"]`);
  if (threshold != null) await page.fill("#attxThreshold", String(threshold));
  if (n != null) await page.fill("#attxN", String(n));
  await page.fill("#attxPct", String(pct));
}

/* Splits employees by what they did in the generated file. */
function everyoneWorksEveryDay(by) {
  return IDS.every((id) => monthsOf(by, id).every(({ days, rec }) => days.every((ds) => rec.present.has(ds))));
}
function noRowsOffWorkingDays(rows) {
  const all = new Set([...WORKING["2026-09"], ...WORKING["2026-10"]]);
  return rows.every((r) => all.has(r[1]));
}

(async () => {
  freshDownloads();
  const browser = await chromium.launch();
  const page = await browser.newContext({ acceptDownloads: true }).then((c) => c.newPage());
  const errs = watchPageErrors(page);

  /* ---------- A. Standard: today's flow minus overtime ---------- */
  await openPage(page);
  check("A Standard is the default mode", (await page.getAttribute('#attxModeSeg button[data-mode="standard"]', "aria-pressed")) === "true");
  check("A Combination is shown but disabled (later)", await page.isDisabled('#attxModeSeg button[data-mode="combination"]'));
  check("A no overtime section on this page", (await page.locator("#otSeg").count()) === 0);
  check("A shift cards carry late cutoff / absent after / half day", (await page.locator('#shiftList input[data-side="cutoff"]').count()) === 1);
  await fillCommon(page);
  await page.fill("#latePct", "0");
  await page.fill("#absentPct", "0");
  await page.fill("#earlyPct", "0");
  const A = await generate(page, XLSX, "attx-A-standard");
  const byA = analyse(A.rows);
  check("A header is the real template's", JSON.stringify(A.header) === JSON.stringify(["Employee ID*", "Date*", "In Time*", "Out Time*"]));
  check("A filename names the scenario", /^attendance_standard_bulk_upload_\d{8}\.xlsx$/.test(A.suggested), A.suggested);
  check("A nothing on weekends (no overtime any more)", noRowsOffWorkingDays(A.rows));
  check("A 0% late/absent: everyone present every working day, on time", everyoneWorksEveryDay(byA) && A.rows.every((r) => band(toSec(r[2])) === "ontime"));

  /* ---------- B. Late Arrival Penalty, Aggregate, T=2 N=3, 50% ---------- */
  await pickDeduction(page, "late", { threshold: 2, n: 3, pct: 50 });
  check("B rule tally reads 10 violators · 2 boundary · 8 on time",
    /10\s*violators.*2\s*boundary.*8\s*on time/s.test(await page.textContent("#attxRuleTally")), await page.textContent("#attxRuleTally"));
  const B = await generate(page, XLSX, "attx-B-late");
  const byB = analyse(B.rows);
  check("B filename names the scenario", /^attendance_late_bulk_upload_/.test(B.suggested), B.suggested);
  check("B no absences in a deduction scenario", everyoneWorksEveryDay(byB));
  check("B no late check-in reaches the cutoff band", B.rows.every((r) => ["ontime", "late"].includes(band(toSec(r[2])))));
  let bViol = 0, bBound = 0, bClean = 0, bBad = [], bEdge = false;
  IDS.forEach((id) => {
    const lates = monthsOf(byB, id).map(({ rec }) => [...rec.present.values()].filter((s) => band(s) === "late"));
    const counts = lates.map((l) => l.length);
    if (lates.some((l) => l.includes(S("09:16:00")))) bEdge = true;
    if (counts.every((c) => c === 0)) bClean++;
    else if (counts.every((c) => c === 4)) bBound++;
    else if (counts.every((c) => [5, 8, 11].includes(c))) bViol++;
    else bBad.push(`${id}:${counts}`);
  });
  check("B 10 violators, each month 5/8/11 late days (1–3 penalties)", bViol === 10, `violators ${bViol}`);
  check("B 2 boundary employees with exactly T+N−1 = 4 late days every month", bBound === 2, `boundary ${bBound}`);
  check("B the other 8 are never late", bClean === 8, `clean ${bClean}`);
  check("B nobody falls outside those three groups", bBad.length === 0, bBad.join(" "));
  check("B some violator has a late check-in at exactly 09:16:00", bEdge);

  /* ---------- C. Late Arrival Penalty, Repeated, T=2 N=3 ---------- */
  await pickDeduction(page, "late", { repeated: true, threshold: 2, n: 3, pct: 50 });
  const C = await generate(page, XLSX, "attx-C-late-repeated");
  const byC = analyse(C.rows);
  let cViol = 0, cBound = 0, cBad = [];
  IDS.forEach((id) => {
    const shapes = monthsOf(byC, id).map(({ days, rec }) => runs(days, (ds) => band(rec.present.get(ds)) === "late"));
    const isViol = shapes.every((r) => r.length >= 3 && r[0] === 1 && r[1] === 1 && r.slice(2).every((x) => x === 3) && r.length - 2 <= 3);
    const isBound = shapes.every((r) => JSON.stringify(r) === "[1,1,2]");
    const isClean = shapes.every((r) => r.length === 0);
    if (isViol) cViol++;
    else if (isBound) cBound++;
    else if (!isClean) cBad.push(`${id}:${JSON.stringify(shapes)}`);
  });
  check("C 10 violators: 2 forgiven single lates, then 1–3 runs of exactly 3 in a row", cViol === 10, `violators ${cViol} ${cBad.join(" ")}`);
  check("C 2 boundary: 2 forgiven singles then one run of 2 (0 penalties)", cBound === 2, `boundary ${cBound}`);

  /* ---------- D. Absent Deduction, Aggregate, N=3 ---------- */
  await pickDeduction(page, "absent", { n: 3, pct: 50 });
  check("D the approved-leave assumption is stated", (await page.locator("text=Assumes nobody has approved leave").count()) === 1);
  const D = await generate(page, XLSX, "attx-D-absent");
  const byD = analyse(D.rows);
  check("D nobody is late in the absent scenario", D.rows.every((r) => band(toSec(r[2])) === "ontime"));
  let dViol = 0, dBound = 0, dClean = 0;
  IDS.forEach((id) => {
    const absent = monthsOf(byD, id).map(({ days, rec }) => days.filter((ds) => !rec.present.has(ds)).length);
    if (absent.every((c) => c === 0)) dClean++;
    else if (absent.every((c) => c === 2)) dBound++;
    else if (absent.every((c) => [3, 6, 9].includes(c))) dViol++;
  });
  check("D 10 violators with 3/6/9 absent days a month", dViol === 10, `violators ${dViol}`);
  check("D 2 boundary with N−1 = 2 absent days a month", dBound === 2, `boundary ${dBound}`);
  check("D 8 present every working day", dClean === 8, `clean ${dClean}`);

  /* ---------- E. Cutoff Breach, every breach day ---------- */
  await pickDeduction(page, "cutoff", { pct: 50 });
  const E = await generate(page, XLSX, "attx-E-cutoff");
  const byE = analyse(E.rows);
  check("E no absences", everyoneWorksEveryDay(byE));
  check("E nothing reaches the absent-after band", E.rows.every((r) => band(toSec(r[2])) !== "absent_after"));
  let eViol = 0, eBound = 0, eClean = 0, eEdge = false;
  IDS.forEach((id) => {
    const ms = monthsOf(byE, id).map(({ rec }) => [...rec.present.values()]);
    const breach = ms.map((v) => v.filter((s) => band(s) === "cutoff").length);
    const lates = ms.map((v) => v.filter((s) => band(s) === "late"));
    if (ms.some((v) => v.includes(S("09:31:00")))) eEdge = true;
    if (breach.every((c) => c === 0) && lates.every((l) => l.length === 0)) eClean++;
    else if (breach.every((c) => c === 0) && lates.every((l) => l.length === 1 && l[0] === S("09:30:59"))) eBound++;
    else if (breach.every((c) => c === 4 || c === 5) && lates.every((l) => l.length === 0)) eViol++;
  });
  check("E 10 violators with 4–5 breach days a month", eViol === 10, `violators ${eViol}`);
  check("E 2 boundary with exactly one 09:30:59 check-in a month", eBound === 2, `boundary ${eBound}`);
  check("E 8 always on time", eClean === 8, `clean ${eClean}`);
  check("E some breach sits on the exact edge 09:31:00", eEdge);

  /* ---------- F. Cutoff Breach, repeated ---------- */
  await pickDeduction(page, "cutoff", { repeated: true, pct: 50 });
  const F = await generate(page, XLSX, "attx-F-cutoff-repeated");
  const byF = analyse(F.rows);
  let fViol = 0;
  IDS.forEach((id) => {
    const shapes = monthsOf(byF, id).map(({ days, rec }) => runs(days, (ds) => band(rec.present.get(ds)) === "cutoff"));
    if (shapes.every((r) => r.length === 2 && r.every((x) => x >= 2) && [4, 5].includes(r[0] + r[1]))) fViol++;
  });
  check("F 10 violators breach in exactly 2 runs (2+2 / 2+3 / 3+2) a month", fViol === 10, `violators ${fViol}`);

  /* ---------- G. Absent After Breach ---------- */
  await pickDeduction(page, "absent_after", { pct: 50 });
  const G = await generate(page, XLSX, "attx-G-absent-after");
  const byG = analyse(G.rows);
  check("G no absences (absent-after is still present)", everyoneWorksEveryDay(byG));
  check("G no check-in reaches half day (13:00)", G.rows.every((r) => toSec(r[2]) <= S("12:59:59")));
  let gViol = 0, gBound = 0, gEdge = false;
  IDS.forEach((id) => {
    const ms = monthsOf(byG, id).map(({ rec }) => [...rec.present.values()]);
    const breach = ms.map((v) => v.filter((s) => band(s) === "absent_after").length);
    const cut = ms.map((v) => v.filter((s) => band(s) === "cutoff"));
    if (ms.some((v) => v.includes(S("10:01:00")))) gEdge = true;
    if (breach.every((c) => c === 4 || c === 5)) gViol++;
    else if (breach.every((c) => c === 0) && cut.every((l) => l.length === 1 && l[0] === S("10:00:59"))) gBound++;
  });
  check("G 10 violators with 4–5 absent-after breach days a month", gViol === 10, `violators ${gViol}`);
  check("G 2 boundary with exactly one 10:00:59 check-in a month", gBound === 2, `boundary ${gBound}`);
  check("G some breach sits on the exact edge 10:01:00", gEdge);
  check("G out times stay at shift end", G.rows.every((r) => toSec(r[3]) >= S("18:00:00") && toSec(r[3]) <= S("18:10:59")));

  /* ---------- H. Blocking: nothing configured is quietly skipped ---------- */
  await page.fill('#shiftList input[data-side="absentAfter"]', "");
  await page.waitForTimeout(100);
  check("H absent-after scenario without an absent-after time is blocked",
    (await page.isDisabled("#generateBtn")) && /absent-after time/i.test(await page.textContent("#actionSummary")), await page.textContent("#actionSummary"));
  await page.fill('#shiftList input[data-side="absentAfter"]', "10:00");
  await page.fill('#shiftList input[data-side="cutoff"]', "09:10");
  await page.waitForTimeout(100);
  check("H a cutoff inside the grace period is blocked",
    (await page.isDisabled("#generateBtn")) && /after its grace period/i.test(await page.textContent("#actionSummary")), await page.textContent("#actionSummary"));
  await page.fill('#shiftList input[data-side="cutoff"]', "09:30");
  await pickDeduction(page, "late", { threshold: 2, n: 3, pct: 50 });
  await page.fill("#fromDate", "2026-10-01");
  await page.fill("#toDate", "2026-10-04");
  await page.waitForTimeout(100);
  check("H a month too short for one penalty is blocked with the month named",
    (await page.isDisabled("#generateBtn")) && /October 2026 has 2 working days/.test(await page.textContent("#actionSummary")), await page.textContent("#actionSummary"));
  await page.fill("#attxPct", "0");
  await page.fill("#fromDate", FROM);
  await page.fill("#toDate", TO);
  await page.waitForTimeout(100);
  check("H 0% violators is blocked, not a plain file", await page.isDisabled("#generateBtn"));

  /* ---------- I. The live Attendance Add is untouched ---------- */
  await page.click('.op-item:has-text("Employee Attendance Add")');
  await page.waitForSelector("#otSeg");
  check("I live page still has its overtime section", (await page.locator("#otSeg").count()) === 1);
  check("I live page's shift cards have no threshold fields", (await page.locator('#shiftList input[data-side="cutoff"]').count()) === 0);

  check("no page errors", errs.length === 0, errs.join(" | "));
  await browser.close();
  report("Attendance update (Preview)", state, []);
})();
