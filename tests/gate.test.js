/* The joke login gate's own small UI mechanics — separate from
 * appearance.test.js (which checks the gate's inputs only for whether
 * they take the dark theme) and from every other suite's signIn(), which
 * clears the gate immediately without ever inspecting it.
 *
 * Every assertion maps to a rule in SPEC.md; if one fails, check SPEC.md
 * before changing the test.
 */
const { chromium } = require("playwright");
const { PAGE, loadAppData, makeChecker, report, watchPageErrors, mockPublicStats } = require("./lib");

const { check, state } = makeChecker();
const { DEMO_LOGIN } = loadAppData(["DEMO_LOGIN"]);

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newContext().then((c) => c.newPage());
  const errs = watchPageErrors(page);
  await mockPublicStats(page);
  await page.goto(PAGE);

  /* Starts visible as plain text, not masked, 2026-10-05 — direct
     feedback ("eta visible kore deyar kotha chilo as dummy pass" — this
     was supposed to show as visible, since it's a dummy password):
     there's nothing to hide here, the same credential is already
     printed below in plain text (#gateCreds), so masking it by default
     only added a pointless extra click. The show/hide toggle still
     exists (consistency with Company Setup's own password fields), just
     starts in its "already shown" state — click it to mask, not reveal. */
  check("starts visible as plain text, not masked", (await page.getAttribute("#loginPass", "type")) === "text");
  check("the pre-filled value is the real demo password", (await page.inputValue("#loginPass")) === DEMO_LOGIN.password);
  check("the toggle starts offering to hide it",
    (await page.getAttribute('.pw-toggle[data-target="loginPass"]', "aria-label")) === "Hide password");

  /* Locked, 2026-10-05 — direct feedback, real people were typing their
     own real credentials into this gate hoping it's an actual login.
     readonly, not disabled, so both fields stay fully legible rather
     than reading greyed-out. */
  check("email is locked against editing", (await page.getAttribute("#loginEmail", "readonly")) !== null);
  check("password is locked against editing", (await page.getAttribute("#loginPass", "readonly")) !== null);
  check("the pre-filled email is the real demo email", (await page.inputValue("#loginEmail")) === DEMO_LOGIN.email);

  await page.click('.pw-toggle[data-target="loginPass"]');
  check("one click masks it", (await page.getAttribute("#loginPass", "type")) === "password");
  check("the value survives the switch", (await page.inputValue("#loginPass")) === DEMO_LOGIN.password);
  check("it matches the plain-text credential printed on the card", (await page.textContent("#gateCreds")).includes(DEMO_LOGIN.password));
  check("the toggle now offers to show it", (await page.getAttribute('.pw-toggle[data-target="loginPass"]', "aria-label")) === "Show password");

  await page.click('.pw-toggle[data-target="loginPass"]');
  check("a second click reveals it again", (await page.getAttribute("#loginPass", "type")) === "text");

  check("no page errors", errs.length === 0, errs.join(" | "));

  await browser.close();
  report("Gate", state, []);
})();
