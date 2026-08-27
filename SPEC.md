# Bulk Forge — spec

Reusable web app (single self-contained HTML file, runs fully in-browser,
no backend). Sidebar lists 5 planned bulk operations; only **Employee Add**
is built so far. Each operation gets its own form section; output is
always an `.xlsx` file matching Shomvob's real upload template for that
operation.

## Employee Add — full spec (confirmed with user)

**Inputs the user provides:**
- Number of employees to generate: integer, min 10, max 300
- Employee ID prefix: 4 letters, auto-uppercased
- Name source: Default (random Bangla names) or a character theme — Game
  of Thrones / Harry Potter / Marvel / DC / Games Character
- Departments: 6 default checkboxes (HR, Engineering/IT, Sales & Business,
  Marketing, Finance & Accounts, Operations) each with 4 default
  designations (toggle default-checkbox mode or custom-add mode), plus
  unlimited custom departments (name + custom designations, add as many
  as needed)

**Generated per row (14 columns, matching the `Employees_List_Upload`
template exactly):**

1. Employee ID* — `PREFIX0001` sequential, always starts at 0001
2. Biometric ID — `PREFIXB0001` (prefix + "B" + same sequence)
3. First Name* / 4. Last Name* — from selected name source; Bangla pool
   built from ~100 male + ~100 female first names × ~110 surnames (huge
   unique combo space, no repeats up to 300); theme pools are curated real
   character full names (~40-46 each), cycled with a numeric suffix on the
   surname if count exceeds pool size
5. Employment Type* — random: Permanent / In Probation / Intern (Part Time
   & Contract intentionally excluded)
6. Probation Period (Months)* — Permanent → 0; In Probation/Intern →
   random 3–6
7. Joining Date* — weighted by year: ~60% previous year, ~25% current year
   (never future), ~15% two years ago
8. Gross Salary* — random ৳20,000–150,000, step 500
9. Email — `firstname.lastname@yopmail.com`, lowercase, deduped with
   numeric suffix if collision
10. Phone* — `880` + `1` + operator digit (3–9) + 8 digits = 13 digits
    total, deduped
11. Gender* — matches the picked name's tagged gender (no "Prefer not to
    say")
12. Date of Birth* — age 18–45 relative to joining year, always before
    Joining Date
13. Department Name* / 14. Designation Name* — one dept picked at random
    from the user's configured set, one designation picked at random from
    that dept's configured list

**Output file:** single sheet named `Employees_List_Upload`, row 1 = exact
template header labels (with `*` on required fields), data starts row 2
(no instruction row — this is a ready-to-upload file, not a blank
template). Filename: `{PREFIX}_employee_bulk_upload_{YYYYMMDD}.xlsx`.

Tested with Playwright: generated 25-row and 300-row batches, validated
uniqueness of IDs/emails/phones, employment-type↔probation linkage,
joining-date↔DOB ordering, salary rounding, department↔designation
consistency — all clean.

## Still to spec (not started)

- Employee Attendance Add
- Leave Balance Add
- Payroll Custom Field Value Add
- Assets Add

Each needs the same treatment as Employee Add: get the real template file,
walk its columns/rules one at a time, then add the operation to the
sidebar and wire it into the same app shell.
