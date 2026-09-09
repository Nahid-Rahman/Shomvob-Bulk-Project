/* Appearance picker — end-to-end against the built index.html.
 *
 * Three states, not two: "auto" leaves data-theme off so the OS setting
 * decides, which is what the page did before the control existed. The
 * choice is the one thing this app persists (localStorage), so a reload
 * has to keep it — and clearing back to auto has to actually clear it.
 *
 * The colour checks are deliberately coarse: they assert the body ground
 * is dark or light, not an exact hex, so a palette tweak doesn't fail a
 * test about the switch working.
 */
const { chromium } = require("playwright");
const { PAGE, makeChecker, report, signIn, watchPageErrors } = require("./lib");

const { check, state } = makeChecker();

const attr = (p) => p.evaluate(() => document.documentElement.getAttribute("data-theme"));
const pressed = (p) =>
  p.evaluate(() =>
    Array.from(document.querySelectorAll("#appearanceSeg button"))
      .filter((b) => b.getAttribute("aria-pressed") === "true")
      .map((b) => b.dataset.appearance)
      .join(","));

/* average channel of a computed rgb(), so "is this dark" needs no hex */
async function lightness(page, sel) {
  const rgb = await page.evaluate(
    (s) => getComputedStyle(document.querySelector(s)).backgroundColor, sel);
  const n = rgb.match(/\d+/g).slice(0, 3).map(Number);
  return (n[0] + n[1] + n[2]) / 3;
}
const isDark = (v) => v < 80;
const isLight = (v) => v > 180;

(async () => {
  const browser = await chromium.launch();

  for (const scheme of ["light", "dark"]) {
    const ctx = await browser.newContext({ colorScheme: scheme });
    const page = await ctx.newPage();
    const errs = watchPageErrors(page);
    const tag = `OS ${scheme}:`;

    await page.goto(PAGE);
    await signIn(page);

    /* auto is the default and must not pin anything */
    check(`${tag} auto is the default`, (await attr(page)) === null, String(await attr(page)));
    check(`${tag} auto is the pressed button`, (await pressed(page)) === "auto", await pressed(page));
    const auto = await lightness(page, "body");
    check(`${tag} auto follows the OS`,
      scheme === "dark" ? isDark(auto) : isLight(auto), String(auto));

    /* dark pins dark whatever the OS says */
    await page.click('#appearanceSeg button[data-appearance="dark"]');
    check(`${tag} dark sets the attribute`, (await attr(page)) === "dark", String(await attr(page)));
    check(`${tag} dark is the only pressed button`, (await pressed(page)) === "dark", await pressed(page));
    check(`${tag} dark paints dark`, isDark(await lightness(page, "body")));

    /* and light pins light, which is the case the OS can't be relied on for */
    await page.click('#appearanceSeg button[data-appearance="light"]');
    check(`${tag} light sets the attribute`, (await attr(page)) === "light", String(await attr(page)));
    check(`${tag} light paints light`, isLight(await lightness(page, "body")));

    /* persistence: unlike every other input in the app, this survives */
    await page.reload();
    check(`${tag} the choice survives a reload`, (await attr(page)) === "light", String(await attr(page)));
    check(`${tag} and before the gate is dismissed`, isLight(await lightness(page, "body")));
    await signIn(page);
    check(`${tag} and the button still reads back`, (await pressed(page)) === "light", await pressed(page));

    /* auto has to genuinely clear it, not store "auto" */
    await page.click('#appearanceSeg button[data-appearance="auto"]');
    check(`${tag} auto removes the attribute`, (await attr(page)) === null, String(await attr(page)));
    check(`${tag} auto stores nothing`,
      (await page.evaluate(() => localStorage.getItem("bulkforge-appearance"))) === null);
    await page.reload();
    await signIn(page);
    check(`${tag} auto is back to following the OS after a reload`,
      (await attr(page)) === null &&
        (scheme === "dark" ? isDark(await lightness(page, "body")) : isLight(await lightness(page, "body"))));

    check(`${tag} no page errors`, errs.length === 0, errs.join(" | "));
    await ctx.close();
  }

  /* The login card's own inputs and the file picker were the browser's
     unstyled controls for a long time — white boxes, invisible on a dark
     card, and only noticed once dark mode had a switch. Assert they take
     the theme rather than the UA default. */
  const ctx = await browser.newContext({ colorScheme: "light" });
  const page = await ctx.newPage();
  await page.goto(PAGE);
  await page.evaluate(() => localStorage.setItem("bulkforge-appearance", "dark"));
  await page.reload();

  check("the login email field takes the dark theme",
    isDark(await lightness(page, "#loginEmail")), String(await lightness(page, "#loginEmail")));
  check("so does the password field",
    isDark(await lightness(page, "#loginPass")), String(await lightness(page, "#loginPass")));

  await signIn(page);
  await page.click('.op-item:has-text("Leave Balance")');
  await page.waitForSelector('input[type="file"]');
  check("and the file picker",
    isDark(await lightness(page, 'input[type="file"]')),
    String(await lightness(page, 'input[type="file"]')));

  await ctx.close();
  await browser.close();
  report("Appearance", state, []);
})();
