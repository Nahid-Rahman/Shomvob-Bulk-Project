/* Shared plumbing for the browser tests.
 *
 * The tests drive the built `index.html` in a real browser rather than
 * importing the source, because the app is an IIFE with no exports — the
 * only honest way to check it is to use it. Generated files are read back
 * with the very same vendored SheetJS the page ships, so a parser quirk
 * cannot make a broken file look fine.
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const REPO = path.resolve(__dirname, "..");
const PAGE = "file:///" + REPO.replace(/\\/g, "/") + "/index.html";
const DOWNLOADS = path.join(__dirname, "downloads");

function loadSheetJs() {
  const ctx = {
    console, Date, Math, JSON, Uint8Array, ArrayBuffer, Buffer, TextDecoder,
    TextEncoder, RegExp, Error, parseInt, parseFloat, isNaN, String, Number,
    Array, Object, Boolean, Map, Set, Symbol, Promise,
    decodeURIComponent, encodeURIComponent,
  };
  ctx.global = ctx;
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(REPO, "vendor/xlsx.mini.min.js"), "utf8"), ctx);
  return ctx.XLSX;
}

/* Reads the data tables out of src/app-data.js so a test can assert against
   the same pools the app generates from, instead of restating them. The
   file declares everything with `const`, which never lands on a vm
   context, so the names are handed back by a trailing expression. */
function loadAppData(names) {
  const ctx = {
    console, Math, Date, JSON, String, Number, Array, Object, RegExp, Set, Map,
    parseInt, parseFloat, isNaN, Boolean,
  };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  const src = fs.readFileSync(path.join(REPO, "src/app-data.js"), "utf8");
  const expr = ";({" + names.map((n) => n + ": " + n).join(", ") + "})";
  return vm.runInContext(src + expr, ctx);
}

/* sheet_to_json omits empty cells, so a row can come back short or with
   holes. Normalise to a fixed-width array of strings. */
function normalizeRow(row, width) {
  const out = [];
  for (let i = 0; i < width; i++) out.push(row[i] == null ? "" : String(row[i]));
  return out;
}

/* Collects anything the page complains about, minus one class of noise.
   The Google Fonts stylesheet is the page's only external dependency, and
   a network hiccup fetching it has failed whole suites before while saying
   nothing about the app. Resource failures are judged by URL through
   `requestfailed`, so a broken local asset — the logo, a video — is still
   a real failure; the console's own "Failed to load resource" line carries
   no URL and cannot be judged, so it is dropped in favour of that. */
function watchPageErrors(page) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const text = m.text();
    if (/Failed to load resource/.test(text)) return;
    errors.push("console: " + text);
  });
  page.on("requestfailed", (r) => {
    const url = r.url();
    if (/fonts\.googleapis\.com|fonts\.gstatic\.com/.test(url)) return;
    const f = r.failure();
    errors.push("request failed: " + url + (f ? " — " + f.errorText : ""));
  });
  return errors;
}

function makeChecker() {
  const state = { pass: 0, failures: [] };
  const check = (name, cond, detail) => {
    if (cond) state.pass++;
    else state.failures.push(name + (detail ? "  → " + detail : ""));
  };
  return { check, state };
}

function report(title, state, pageErrors) {
  console.log("\n=== " + title + " ===");
  console.log("passed: " + state.pass);
  if (pageErrors && pageErrors.length) {
    console.log("\nPAGE ERRORS:");
    pageErrors.slice(0, 10).forEach((e) => console.log("  " + e));
  }
  if (state.failures.length) {
    console.log("\nFAILED (" + state.failures.length + "):");
    state.failures.forEach((f) => console.log("  ✗ " + f));
    process.exit(1);
  }
  console.log("all checks passed");
}

function freshDownloads() {
  fs.rmSync(DOWNLOADS, { recursive: true, force: true });
  fs.mkdirSync(DOWNLOADS, { recursive: true });
}

/* Clears the joke login gate. The credentials are pre-filled, so this only
   has to submit the form. Every test needs it before touching the app. */
async function signIn(page) {
  const gate = page.locator("#loginGate");
  if (!(await gate.count())) return;
  await page.click("#loginBtn");
  await gate.waitFor({ state: "detached" });
}

/* Clicks Generate, waits for the download, saves it and parses it. */
async function generate(page, XLSX, tag) {
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.click("#generateBtn"),
  ]);
  const file = path.join(DOWNLOADS, tag + ".xlsx");
  await download.saveAs(file);
  const wb = XLSX.read(fs.readFileSync(file), { type: "buffer" });
  const sheet = wb.SheetNames[0];
  const aoa = XLSX.utils.sheet_to_json(wb.Sheets[sheet], { header: 1, blankrows: false });
  return {
    wb,
    sheet,
    header: aoa[0],
    rows: aoa.slice(1),
    suggested: download.suggestedFilename(),
  };
}

/* "09:00 AM" / "17:05" / "09:15:45 AM" → minutes past midnight */
function toMin(t) {
  const m = /^(\d{2}):(\d{2})(?::(\d{2}))?(?:\s(AM|PM))?$/.exec(t);
  if (!m) return null;
  let h = +m[1];
  if (m[4] === "PM" && h !== 12) h += 12;
  if (m[4] === "AM" && h === 12) h = 0;
  return h * 60 + +m[2];
}

function ymd(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
}

module.exports = { REPO, PAGE, DOWNLOADS, loadSheetJs, loadAppData, normalizeRow, makeChecker, watchPageErrors, report, freshDownloads, signIn, generate, toMin, ymd };
