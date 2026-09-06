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

module.exports = { REPO, PAGE, DOWNLOADS, loadSheetJs, makeChecker, report, freshDownloads, generate, toMin, ymd };
