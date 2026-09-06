# Tests

These drive the built `index.html` in a real Chromium, fill the form the
way a QA engineer would, download the generated `.xlsx` and assert on its
contents. They read the file back with the same vendored SheetJS the page
ships, so a parser quirk can't make a broken file look fine.

Every assertion maps to a rule confirmed with the user in `SPEC.md`. If one
fails, check `SPEC.md` before changing the test — the test may be right and
the code may have drifted.

## Running

```
cd tests
npm run setup      # once — installs playwright + chromium
npm test
```

Run `python build.py` first if you have edited anything under `src/`; the
tests exercise the built `index.html`, not the sources.

## Why this lives in tests/ and not the repo root

The project deploys to Vercel as a plain static site — framework preset
"Other", no build command, output directory `.`. A `package.json` at the
repo root would make Vercel try to build it. Keeping the test tooling in
this folder avoids that entirely.
