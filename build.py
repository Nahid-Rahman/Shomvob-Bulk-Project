#!/usr/bin/env python3
"""Assemble src/ + vendor/ into a single self-contained index.html.

Run this after editing anything in src/app.css, src/app-data.js,
src/app.js, or src/part1.html.

    python3 build.py
"""
import pathlib

ROOT = pathlib.Path(__file__).parent
SRC = ROOT / "src"
VENDOR = ROOT / "vendor"


def read(path):
    return path.read_text(encoding="utf-8")


def main():
    part1 = read(SRC / "part1.html")
    css = read(SRC / "app.css")
    part1 = part1.replace("__APP_CSS__", css)

    xlsx_lib = read(VENDOR / "xlsx.mini.min.js")
    data_js = read(SRC / "app-data.js")
    app_js = read(SRC / "app.js")

    out = [
        part1,
        f"<script>\n{xlsx_lib}\n</script>\n",
        f"<script>\n{data_js}\n</script>\n",
        f"<script>\n{app_js}\n</script>\n",
    ]
    final = "".join(out)

    out_path = ROOT / "index.html"
    # newline="\n" so a Windows run doesn't rewrite every line ending to CRLF.
    out_path.write_text(final, encoding="utf-8", newline="\n")
    print(f"wrote {out_path} ({len(final.encode('utf-8')):,} bytes)")


if __name__ == "__main__":
    main()
