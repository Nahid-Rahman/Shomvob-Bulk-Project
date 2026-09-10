/* The joke login gate's own small UI mechanics — separate from
 * appearance.test.js (which checks the gate's inputs only for whether
 * they take the dark theme) and from every other suite's signIn(), which
 * clears the gate immediately without ever inspecting it.
 *
 * Every assertion maps to a rule in SPEC.md; if one fails, check SPEC.md
 * before changing the test.
 */
const { chromium } = require("playwright");
const { PAGE, loadAppData, makeChecker, report, watchPageErrors } = require("./lib");

const { check, state } = makeChecker();
const { DEMO_LOGIN } = loadAppData(["DEMO_LOGIN"]);

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newContext().then((c) => c.newPage());
  const errs = watchPageErrors(page);
  await page.goto(PAGE);

  /* Same show/hide toggle as Company Setup's password fields — added here
     too for consistency, even though the credential is already printed in
     plain text a few lines below (#gateCreds); that's the joke gate's
     whole point, so the toggle is convenience, not necessity. */
  check("starts masked", (await page.getAttribute("#loginPass", "type")) === "password");
  check("the pre-filled value is the real demo password", (await page.inputValue("#loginPass")) === DEMO_LOGIN.password);

  await page.click('.pw-toggle[data-target="loginPass"]');
  check("one click reveals it", (await page.getAttribute("#loginPass", "type")) === "text");
  check("the value survives the switch", (await page.inputValue("#loginPass")) === DEMO_LOGIN.password);
  check("it matches the plain-text credential printed on the card", (await page.textContent("#gateCreds")).includes(DEMO_LOGIN.password));
  check("the toggle now offers to hide it", (await page.getAttribute('.pw-toggle[data-target="loginPass"]', "aria-label")) === "Hide password");

  await page.click('.pw-toggle[data-target="loginPass"]');
  check("a second click re-masks it", (await page.getAttribute("#loginPass", "type")) === "password");

  check("no page errors", errs.length === 0, errs.join(" | "));

  await browser.close();
  report("Gate", state, []);
})();
