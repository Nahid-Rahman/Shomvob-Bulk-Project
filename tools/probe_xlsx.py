#!/usr/bin/env python3
"""Dump everything we need to know about a Shomvob bulk-upload template.

Used to map a real template before implementing its operation: sheet names
and visibility, every non-empty cell in the head of each sheet, number
formats, data validations (dropdown sources, date/number constraints),
merged cells, defined names, cell comments, freeze panes.

    python tools/probe_xlsx.py path/to/template.xlsx

Requires openpyxl (pip install openpyxl). SheetJS is not used here because
it cannot read data validations, which is where the dropdown option lists
and cross-field rules live.
"""
import sys
from openpyxl import load_workbook

HEAD_ROWS = 8       # cells to dump per sheet
REF_ROWS = 15       # values to dump from a lookup/reference sheet
RULE = "=" * 70


def out(text=""):
    """Print without dying on non-cp1252 characters (Bangla, emoji, ৳)."""
    enc = sys.stdout.encoding or "utf-8"
    sys.stdout.write(str(text).encode(enc, "replace").decode(enc) + "\n")


def dump_sheet(wb, ws):
    out(RULE)
    out(f"SHEET {ws.title!r}   dims={ws.dimensions}  "
        f"rows={ws.max_row} cols={ws.max_column}  state={ws.sheet_state}")
    out(RULE)

    out(f"\n-- cells (first {HEAD_ROWS} rows) --")
    for row in ws.iter_rows(min_row=1, max_row=min(HEAD_ROWS, ws.max_row)):
        for c in row:
            if c.value is not None:
                out(f"   {c.coordinate:>6}  fmt={c.number_format!r:<14} "
                    f"type={c.data_type}  {c.value!r}")
        out(f"   -- end row {row[0].row} --")

    # A single-column sheet full of values is a dropdown source; show the
    # shape and the ends rather than all 300 rows.
    if ws.max_column == 1 and ws.max_row > HEAD_ROWS:
        vals = [c.value for (c,) in ws.iter_rows(max_col=1) if c.value is not None]
        out(f"\n-- lookup column: {len(vals)} values --")
        out(f"   first {REF_ROWS}: {vals[:REF_ROWS]}")
        out(f"   last  {REF_ROWS}: {vals[-REF_ROWS:]}")

    out("\n-- data validations --")
    dvs = list(ws.data_validations.dataValidation)
    if not dvs:
        out("   (none)")
    for dv in dvs:
        out(f"   ranges={dv.sqref}")
        out(f"     type={dv.type} operator={dv.operator} "
            f"allow_blank={dv.allow_blank}")
        out(f"     formula1={dv.formula1!r}  formula2={dv.formula2!r}")
        out(f"     prompt={dv.promptTitle!r} / {dv.prompt!r}")
        out(f"     error={dv.errorTitle!r} / {dv.error!r}")

    out("\n-- comments --")
    found = False
    for row in ws.iter_rows(min_row=1, max_row=min(HEAD_ROWS + 4, ws.max_row)):
        for c in row:
            if c.comment:
                out(f"   {c.coordinate}: {c.comment.text}")
                found = True
    if not found:
        out("   (none)")

    out("\n-- layout --")
    out(f"   freeze_panes={ws.freeze_panes}  autofilter={ws.auto_filter.ref}")
    out(f"   merged={ws.merged_cells.ranges or '(none)'}")
    widths = {k: v.width for k, v in sorted(ws.column_dimensions.items())
              if v.width}
    out(f"   col_widths={widths or '(default)'}")
    out()


def main():
    if len(sys.argv) != 2:
        out(__doc__)
        return 1
    path = sys.argv[1]
    wb = load_workbook(path)
    out(f"FILE   {path}")
    out(f"SHEETS {wb.sheetnames}")
    names = dict(wb.defined_names) if wb.defined_names else None
    out(f"NAMES  {names or '(none)'}\n")
    for ws in wb.worksheets:
        dump_sheet(wb, ws)
    return 0


if __name__ == "__main__":
    sys.exit(main())
