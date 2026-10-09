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
  check("A Combination is offered", !(await page.isDisabled('#attxModeSeg button[data-mode="combination"]')));
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

  /* ---------- J. Bonus → Overtime (SPEC O1–O15) ----------
     Shift 09:00–18:00 = 9 h, Daily Hour Limit 12 → weekday cap 3 h
     (out 21:00:00). Monthly limit 20 h, Weekend on at 12 h. */
  await page.click('#attxModeSeg button[data-mode="bonus"]');
  await page.check('#attxBonusChoices input[value="overtime"]');
  await page.fill("#otxDaily", "12");
  await page.fill("#otxMonthly", "20");
  await page.fill("#latePct", "10");
  await page.fill("#absentPct", "5");
  check("J tally: 16–17 earners, 3 h cap, monthly boundary named",
    /16–17\s*overtime earners/.test(await page.textContent("#attxRuleTally")) && /3 h past shift end/.test(await page.textContent("#attxRuleTally")) && /exactly on it/.test(await page.textContent("#attxRuleTally")),
    await page.textContent("#attxRuleTally"));
  const J = await generate(page, XLSX, "attx-J-overtime");
  check("J filename names the scenario", /^attendance_overtime_bulk_upload_/.test(J.suggested), J.suggested);
  const workSet = new Set([...WORKING["2026-09"], ...WORKING["2026-10"]]);
  const jWork = J.rows.filter((r) => workSet.has(r[1]));
  const jOff = J.rows.filter((r) => !workSet.has(r[1]));
  const CAP = S("21:00:00");
  check("J weekday Out never before shift end, always on :00", jWork.every((r) => toSec(r[3]) >= S("18:00:00") && r[3].endsWith(":00")));
  check("J weekday overtime never past cap + 45 min", jWork.every((r) => toSec(r[3]) <= S("21:45:00")));
  check("J some weekday overtime lands exactly on the 3 h cap", jWork.some((r) => toSec(r[3]) === CAP));
  check("J some weekday overtime goes a little over the cap", jWork.some((r) => toSec(r[3]) > CAP));
  const jEarners = new Set(jWork.filter((r) => toSec(r[3]) > S("18:00:00")).map((r) => r[0]));
  check("J 80–85% earn overtime (16–17 of 20), the rest leave at 18:00:00", jEarners.size >= 16 && jEarners.size <= 17, `earners ${jEarners.size}`);
  check("J late arrivals are mixed in", jWork.some((r) => band(toSec(r[2])) !== "ontime"));
  check("J absences are mixed in", !everyoneWorksEveryDay(analyse(J.rows)));
  /* Monthly weekday OT as the system counts it: each day clipped at the cap. */
  const L = 20 * 3600;
  ["2026-09", "2026-10"].forEach((m) => {
    const sums = new Map();
    jWork.filter((r) => r[1].startsWith(m)).forEach((r) => {
      const ot = Math.min(toSec(r[3]), CAP) - S("18:00:00");
      sums.set(r[0], (sums.get(r[0]) || 0) + ot);
    });
    const vals = [...sums.values()];
    check(`J ${m}: exactly one earner lands on the 20 h monthly limit`, vals.filter((v) => v === L).length === 1, JSON.stringify(vals));
    check(`J ${m}: exactly one goes over it (by 30–90 min)`, vals.filter((v) => v > L).length === 1 && vals.filter((v) => v > L).every((v) => v <= L + 90 * 60), JSON.stringify(vals));
  });
  check("J weekend rows exist and are all Fri/Sat", jOff.length > 0 && jOff.every((r) => [5, 6].includes(new Date(r[1] + "T00:00:00").getDay())));
  check("J weekend work starts at 09:00:00 and runs 2 h to 12 h 45 min", jOff.every((r) => r[2] === "09:00:00" && toSec(r[3]) >= S("11:00:00") && toSec(r[3]) <= S("21:45:00")));
  check("J some weekend day is exactly the 12 h limit", jOff.some((r) => toSec(r[3]) === S("21:00:00")));
  const jGoers = new Set(jOff.map((r) => r[0]));
  check("J 30–35% of earners (5–6) work weekends, all of them earners", jGoers.size >= 5 && jGoers.size <= 6 && [...jGoers].every((id) => jEarners.has(id)), `goers ${jGoers.size}`);
  check("J each goer works 1–2 weekend days a month",
    [...jGoers].every((id) => ["2026-09", "2026-10"].every((m) => { const n = jOff.filter((r) => r[0] === id && r[1].startsWith(m)).length; return n >= 1 && n <= 2; })));

  /* Weekend toggle off: still comes in, 0 overtime (O5) — a day no longer than the shift. */
  await page.click('#otxWeekendSeg button[data-on="no"]');
  check("J weekend limit input disables with the toggle", await page.isDisabled("#otxWeekendLimit"));
  const J2 = await generate(page, XLSX, "attx-J2-weekend-off");
  const j2Off = J2.rows.filter((r) => !workSet.has(r[1]));
  check("J weekend off: some still come in, 2–9 h", j2Off.length > 0 && j2Off.every((r) => toSec(r[3]) >= S("11:00:00") && toSec(r[3]) <= S("18:00:00")));
  await page.click('#otxWeekendSeg button[data-on="yes"]');

  await page.fill("#otxDaily", "9");
  await page.waitForTimeout(100);
  check("J a Daily Hour Limit no longer than the shift is blocked",
    (await page.isDisabled("#generateBtn")) && /leaves no room for overtime/.test(await page.textContent("#actionSummary")), await page.textContent("#actionSummary"));
  await page.fill("#otxDaily", "12");
  await page.fill("#otxMonthly", "");
  await page.waitForTimeout(100);
  check("J a blank monthly limit is allowed", !(await page.isDisabled("#generateBtn")));

  /* ---------- K. Bonus → Attendance Bonus (SPEC B1–B6) ----------
     Sep 2026 has 22 working days, Oct 21 (Fri/Sat weekend). */
  await page.check('#attxBonusChoices input[value="attendance_bonus"]');
  await page.click('#abxKindSeg button[data-kind="fixed"]');
  await page.fill("#abxN", "18");
  await page.fill("#latePct", "10");
  check("K tally: 2 just make it, 2 miss by one, needed days per month",
    /2\s*just make it.*2\s*miss by one day/s.test(await page.textContent("#attxRuleTally")) && /September 2026: 18 of 22/.test(await page.textContent("#attxRuleTally")),
    await page.textContent("#attxRuleTally"));
  const abCheck = async (name, need) => {
    const K = await generate(page, XLSX, name);
    const byK = analyse(K.rows);
    check(`${name} nothing on weekends`, noRowsOffWorkingDays(K.rows));
    let exact = 0, miss = 0, earn = 0, short = 0, bad = [];
    IDS.forEach((id) => {
      const c = monthsOf(byK, id).map(({ m, rec }) => [rec.present.size, need[m]]);
      if (c.every(([n, R]) => n === R)) exact++;
      else if (c.every(([n, R]) => n === R - 1)) miss++;
      else if (c.every(([n, R]) => n > R)) earn++;
      else if (c.every(([n, R]) => n <= R - 2)) short++;
      else bad.push(`${id}:${JSON.stringify(c)}`);
    });
    check(`${name} 2 employees exactly on the requirement every month`, exact === 2, `exact ${exact}`);
    check(`${name} 2 employees one day short every month`, miss === 2, `miss ${miss}`);
    check(`${name} 12–14 earn it with days to spare`, earn >= 12 && earn <= 14, `earn ${earn}`);
    check(`${name} the rest are well short`, exact + miss + earn + short === 20, bad.join(" "));
    return K;
  };
  const K1 = await abCheck("K-fixed", { "2026-09": 18, "2026-10": 18 });
  check("K filename names the scenario", /^attendance_attendance_bonus_bulk_upload_/.test(K1.suggested), K1.suggested);
  check("K late days are mixed in (they still count as present)", K1.rows.some((r) => band(toSec(r[2])) !== "ontime"));

  /* Percentage of Days, round half up: 22 × 90% = 19.8 → 20, 21 × 90% = 18.9 → 19. */
  await page.click('#abxKindSeg button[data-kind="percent"]');
  await page.fill("#abxN", "90");
  await abCheck("K-percent", { "2026-09": 20, "2026-10": 19 });

  await page.click('#abxKindSeg button[data-kind="fixed"]');
  await page.fill("#abxN", "22");
  await page.waitForTimeout(100);
  check("K a month with fewer working days than needed is blocked and named",
    (await page.isDisabled("#generateBtn")) && /October 2026 has only 21 working days in this range — fewer than 22/.test(await page.textContent("#actionSummary")), await page.textContent("#actionSummary"));
  await page.fill("#abxN", "18");

  /* ---------- L. Combination (SPEC → "Redesign, same day") ----------
     9 test cases, each its own employees: deduction {none, late, cutoff,
     absent after} × overtime {no, yes}, plus plain absence. 95 IDs →
     every case gets the 10-employee cap, 5 left out of the file. */
  const LIDS = Array.from({ length: 95 }, (_, i) => "CMBX" + String(i + 1).padStart(4, "0"));
  await page.click('#attxModeSeg button[data-mode="combination"]');
  await page.waitForSelector("#cbLateN");
  check("L no violator % and no late/absent % on this page",
    (await page.locator("#attxPct").count()) === 0 && (await page.locator("#latePct").count()) === 0 && (await page.locator("#absentPct").count()) === 0);
  await page.fill("#idPaste", LIDS.slice(0, 42).join("\n"));
  await page.waitForTimeout(100);
  check("L 42 IDs is blocked, naming how many more",
    (await page.isDisabled("#generateBtn")) && /needs at least 43 employee IDs .* Add 1 more/.test(await page.textContent("#actionSummary")), await page.textContent("#actionSummary"));
  await page.fill("#idPaste", LIDS.join("\n"));
  await page.click('#cbLateThSeg button[data-th="on"]');
  await page.fill("#cbLateTh", "2");
  await page.click('#cbLateRepSeg button[data-rep="no"]');
  await page.fill("#cbLateN", "3");
  await page.click('#cbAbsentRepSeg button[data-rep="no"]');
  await page.fill("#cbAbsentN", "3");
  await page.click('#cbCutoffRepSeg button[data-rep="no"]');
  await page.click('#cbAaRepSeg button[data-rep="no"]');
  await page.click('#otxWeekendSeg button[data-on="yes"]');
  await page.fill("#otxDaily", "12");
  await page.fill("#otxMonthly", "20");
  await page.waitForTimeout(100);
  const lTally = await page.textContent("#attxRuleTally");
  check("L tally lists 9 cases at 10 each and names the 5 unused IDs",
    (await page.locator("#attxRuleTally tbody tr").count()) === 9 && /5 IDs left unused/.test(lTally), lTally);
  const Lf = await generate(page, XLSX, "attx-L-combination");
  check("L filename names the scenario", /^attendance_combination_bulk_upload_/.test(Lf.suggested), Lf.suggested);
  const lIds = new Set(Lf.rows.map((r) => r[0]));
  check("L 90 employees in the file, the 5 unused left out", lIds.size === 90, `ids ${lIds.size}`);
  const lWorkSet = new Set([...WORKING["2026-09"], ...WORKING["2026-10"]]);
  const lBy = analyse(Lf.rows.filter((r) => lWorkSet.has(r[1])));
  const prof = new Map(); // id -> { bands:Set, missing:{m:n}, ot:bool }
  lIds.forEach((id) => {
    const bands = new Set();
    const missing = {};
    monthsOf(lBy, id).forEach(({ m, days, rec }) => {
      missing[m] = days.filter((ds) => !rec.present.has(ds)).length;
      rec.present.forEach((sec) => {
        const bd = band(sec);
        if (bd !== "ontime") bands.add(bd);
      });
    });
    const ot = Lf.rows.some((r) => r[0] === id && (!lWorkSet.has(r[1]) || toSec(r[3]) > S("18:00:00")));
    prof.set(id, { bands, missing, ot });
  });
  const P = [...prof.values()];
  check("L nobody ever lands in two late bands", P.every((p) => p.bands.size <= 1));
  check("L nobody is both late-banded and absent", P.every((p) => !(p.bands.size && Object.values(p.missing).some((n) => n))));
  const caseOf = (p) => (Object.values(p.missing).some((n) => n) ? "absent" : p.bands.size ? [...p.bands][0] : "none");
  const tally = {};
  P.forEach((p) => {
    const k = `${caseOf(p)}|${p.ot}`;
    tally[k] = (tally[k] || 0) + 1;
  });
  check("L every case has exactly 10 people (none/late/cutoff/absent after × OT, absent without)",
    ["none", "late", "cutoff", "absent_after"].every((d) => tally[`${d}|true`] === 10 && tally[`${d}|false`] === 10) && tally["absent|false"] === 10 && !tally["absent|true"],
    JSON.stringify(tally));
  const lateOk = [...prof].filter(([, p]) => caseOf(p) === "late").every(([id]) =>
    monthsOf(lBy, id).every(({ rec }) => { const late = [...rec.present.values()].filter((v) => band(v) === "late").length; const pen = Math.floor((late - 2) / 3); return pen >= 1 && pen <= 3; }));
  check("L late cases really charge: 1–3 penalties every month (T 2, N 3)", lateOk);
  const breachOk = (bd) => [...prof].filter(([, p]) => caseOf(p) === bd).every(([id]) =>
    monthsOf(lBy, id).every(({ rec }) => { const n = [...rec.present.values()].filter((v) => band(v) === bd).length; return n >= 4 && n <= 5; }));
  check("L cutoff cases breach 4–5 days every month", breachOk("cutoff"));
  check("L absent-after cases breach 4–5 days every month", breachOk("absent_after"));
  check("L absent case misses 3, 6 or 9 working days every month (N 3, 1–3 penalties)",
    P.filter((p) => caseOf(p) === "absent").every((p) => Object.values(p.missing).every((n) => [3, 6, 9].includes(n))));
  const nonOtOut = Lf.rows.filter((r) => !prof.get(r[0]).ot);
  check("L anyone without overtime leaves at 18:00:00 exactly", nonOtOut.every((r) => r[3] === "18:00:00"));
  const ins = new Set(Lf.rows.map((r) => r[2]));
  check("L every band edge is in the file (09:15:59, 09:16:00, 09:30:59, 09:31:00, 10:00:59, 10:01:00)",
    ["09:15:59", "09:16:00", "09:30:59", "09:31:00", "10:00:59", "10:01:00"].every((t) => ins.has(t)), [...ins].filter((t) => /^(09:1[56]|09:3[01]|10:0[01])/.test(t)).join(","));
  check("L weekend rows only for overtime cases", Lf.rows.filter((r) => !lWorkSet.has(r[1])).every((r) => prof.get(r[0]).ot));

  /* ---------- I. The live Attendance Add is untouched ---------- */
  await page.click('.op-item:has-text("Employee Attendance Add")');
  await page.waitForSelector("#otSeg");
  check("I live page still has its overtime section", (await page.locator("#otSeg").count()) === 1);
  check("I live page's shift cards have no threshold fields", (await page.locator('#shiftList input[data-side="cutoff"]').count()) === 0);

  check("no page errors", errs.length === 0, errs.join(" | "));
  await browser.close();
  report("Attendance update (Preview)", state, []);
})();
