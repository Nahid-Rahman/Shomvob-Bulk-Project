/* ===== Bulk Forge — app logic ===== */
(function () {
  "use strict";

  /* ---------- state ---------- */
  let currentOp = "welcome";
  let nameTheme = "bangla";
  let customDeptCounter = 0;

  const departments = DEFAULT_DEPARTMENTS.map((d) => ({
    id: d.id,
    name: d.name,
    isCustom: false,
    checked: false,
    mode: "default",
    selectedDesig: new Set(),
    customDesig: [],
    defaultDesigOptions: d.designations,
  }));

  /* ---------- helpers ---------- */
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $all = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
  function choice(arr) {
    return arr[randInt(0, arr.length - 1)];
  }
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = randInt(0, i);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  /* options: [{ value, weight }, ...] — ports the Postman collection's own
     pickWeighted() helper, reused by every Payroll module built from a
     script that weights its own random choices. */
  function weightedChoice(options) {
    const total = options.reduce((sum, o) => sum + o.weight, 0);
    let roll = Math.random() * total;
    for (const o of options) {
      if (roll < o.weight) return o.value;
      roll -= o.weight;
    }
    return options[0].value;
  }
  function pad4(n) {
    return String(n).padStart(4, "0");
  }
  function daysInMonth(y, m) {
    return new Date(y, m, 0).getDate();
  }
  function fmtDate(d) {
    const y = d.getFullYear(),
      m = String(d.getMonth() + 1).padStart(2, "0"),
      day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }
  function slug(s) {
    return (s || "").toLowerCase().replace(/[^a-z]/g, "");
  }

  /* ---------- name generation ---------- */
  function generateNames(themeKey, count) {
    const entries = [];
    if (themeKey === "bangla") {
      const used = new Set();
      let guard = 0;
      while (entries.length < count && guard < count * 50) {
        guard++;
        const gender = Math.random() < 0.5 ? "M" : "F";
        const first = choice(gender === "M" ? BANGLA_MALE_FIRST : BANGLA_FEMALE_FIRST);
        const last = choice(BANGLA_LAST);
        const key = first + "|" + last;
        if (used.has(key)) continue;
        used.add(key);
        entries.push({ first, last, gender });
      }
      return entries;
    }
    const pool = THEME_POOLS[themeKey];
    const shuffled = shuffle(pool);
    let idx = 0,
      cycle = 1;
    while (entries.length < count) {
      if (idx >= shuffled.length) {
        idx = 0;
        cycle++;
      }
      const [f, l, g] = shuffled[idx];
      const last = cycle === 1 ? l : `${l} ${cycle}`;
      entries.push({ first: f, last, gender: g });
      idx++;
    }
    return entries;
  }

  function sampleNames(themeKey, n) {
    return generateNames(themeKey, n);
  }

  /* ---------- row-level generation ---------- */
  function pickEmploymentType() {
    return choice(["Permanent", "In Probation", "Intern"]);
  }
  function probationFor(type) {
    return type === "Permanent" ? 0 : randInt(3, 6);
  }

  const today = new Date();
  const curYear = today.getFullYear();

  function randomJoiningDate() {
    const r = Math.random();
    let year;
    if (r < 0.6) year = curYear - 1;
    else if (r < 0.85) year = curYear;
    else year = curYear - 2;

    let month, day;
    if (year === curYear) {
      month = randInt(1, today.getMonth() + 1);
      if (month === today.getMonth() + 1) day = randInt(1, today.getDate());
      else day = randInt(1, daysInMonth(year, month));
    } else {
      month = randInt(1, 12);
      day = randInt(1, daysInMonth(year, month));
    }
    return new Date(year, month - 1, day);
  }

  function randomDOB(joiningDate) {
    const joiningYear = joiningDate.getFullYear();
    const ageAtJoin = randInt(18, 45);
    const dobYear = joiningYear - ageAtJoin;
    const m = randInt(1, 12);
    const d = randInt(1, daysInMonth(dobYear, m));
    return new Date(dobYear, m - 1, d);
  }

  function grossSalary() {
    const steps = Math.floor((150000 - 20000) / 500);
    return 20000 + randInt(0, steps) * 500;
  }

  function makeEmail(first, last, used) {
    const base = `${slug(first)}.${slug(last)}`;
    let email = `${base}@yopmail.com`;
    let n = 2;
    while (used.has(email)) {
      email = `${base}${n}@yopmail.com`;
      n++;
    }
    used.add(email);
    return email;
  }

  function makePhone(used) {
    let phone;
    do {
      const op = choice(["3", "4", "5", "6", "7", "8", "9"]);
      const rest = Array.from({ length: 8 }, () => randInt(0, 9)).join("");
      phone = `8801${op}${rest}`;
    } while (used.has(phone));
    used.add(phone);
    return phone;
  }

  const HEADER = [
    "Employee ID*", "Biometric ID", "First Name*", "Last Name*", "Employment Type*",
    "Probation Period (Months)*", "Joining Date*", "Gross Salary*", "Email", "Phone*",
    "Gender*", "Date of Birth*", "Department Name*", "Designation Name*",
  ];

  /* Splits the configured departments into the ones that are ready to
     generate from and the ones the user has half-filled.

     A department that is ticked but has no designation used to be dropped
     silently — you could tick three, get one in the file, and never learn
     why. It is an error now, named in the warning.

     Blank custom designation rows are dropped rather than counted. An
     empty "Add designation" row was passing the length check and putting
     an empty string into Designation Name, which the template requires. */
  function departmentState() {
    const final = [];
    const incomplete = [];
    for (const d of departments) {
      const custom = d.customDesig.map((v) => String(v).trim()).filter(Boolean);
      if (d.isCustom) {
        const name = d.name.trim();
        /* a freshly added row with nothing in it yet is noise, not an error */
        if (!name && !custom.length) continue;
        if (!name || !custom.length) {
          incomplete.push(name || "your new department");
          continue;
        }
        final.push({ name: name, designations: custom });
      } else if (d.checked) {
        const desigs = d.mode === "default" ? Array.from(d.selectedDesig) : custom;
        if (!desigs.length) {
          incomplete.push(d.name);
          continue;
        }
        final.push({ name: d.name, designations: desigs });
      }
    }
    return { final: final, incomplete: incomplete };
  }

  function collectFinalDepartments() {
    return departmentState().final;
  }

  function generateWorkbookRows(count, prefix, theme, finalDepartments) {
    const names = generateNames(theme, count);
    const usedEmails = new Set();
    const usedPhones = new Set();
    const rows = [HEADER];
    for (let i = 0; i < count; i++) {
      const seq = pad4(i + 1);
      const empId = prefix + seq;
      const bioId = prefix + "B" + seq;
      const name = names[i];
      const employmentType = pickEmploymentType();
      const probation = probationFor(employmentType);
      const joiningDate = randomJoiningDate();
      const dob = randomDOB(joiningDate);
      const gross = grossSalary();
      const email = makeEmail(name.first, name.last, usedEmails);
      const phone = makePhone(usedPhones);
      const dept = choice(finalDepartments);
      const designation = choice(dept.designations);
      rows.push([
        empId, bioId, name.first, name.last, employmentType, probation,
        fmtDate(joiningDate), gross, email, phone,
        name.gender === "M" ? "Male" : "Female", fmtDate(dob), dept.name, designation,
      ]);
    }
    return rows;
  }

  function downloadWorkbook(rows, prefix) {
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [
      { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 15 },
      { wch: 14 }, { wch: 13 }, { wch: 13 }, { wch: 26 }, { wch: 15 },
      { wch: 10 }, { wch: 13 }, { wch: 20 }, { wch: 22 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Employees_List_Upload");
    const stamp = fmtDate(today).replace(/-/g, "");
    const filename = `${prefix}_employee_bulk_upload_${stamp}.xlsx`;
    XLSX.writeFile(wb, filename);
    return filename;
  }

  /* ================= UI ================= */

  function renderSidebar() {
    const home = $("#homeNav");
    home.innerHTML = "";
    const homeBtn = document.createElement("button");
    homeBtn.className = "op-item";
    homeBtn.type = "button";
    homeBtn.setAttribute("aria-current", String(currentOp === "welcome"));
    homeBtn.innerHTML = `<span class="op-item-label">${opIcon("welcome")}Dashboard</span>`;
    homeBtn.addEventListener("click", () => {
      currentOp = "welcome";
      renderSidebar();
      renderMain();
    });
    home.appendChild(homeBtn);

    const nav = $("#opNav");
    nav.innerHTML = "";
    OPERATIONS.forEach((op) => {
      const btn = document.createElement("button");
      btn.className = "op-item";
      btn.type = "button";
      btn.setAttribute("aria-current", String(op.id === currentOp));
      if (op.status === "soon") btn.disabled = true;
      btn.innerHTML = `<span class="op-item-label">${opIcon(op.id)}${op.label}</span>${op.status === "soon" ? '<span class="pill-soon">Soon</span>' : ""}`;
      if (op.status !== "soon") {
        btn.addEventListener("click", () => {
          currentOp = op.id;
          renderSidebar();
          renderMain();
        });
      }
      nav.appendChild(btn);
    });

    const setupNav = $("#setupNav");
    setupNav.innerHTML = "";
    SETUP_TOOLS.forEach((op) => {
      const btn = document.createElement("button");
      btn.className = "op-item";
      btn.type = "button";
      btn.setAttribute("aria-current", String(op.id === currentOp));
      btn.innerHTML = `<span class="op-item-label">${opIcon(op.id)}${op.label}</span>`;
      btn.addEventListener("click", () => {
        currentOp = op.id;
        renderSidebar();
        renderMain();
      });
      setupNav.appendChild(btn);
    });
  }

  /* Wraps an operation's form in the two-column shell when that operation
     has a video, and leaves it full-width when it doesn't — so the rail can
     be filled in one operation at a time. */
  function paintOperation(root, html, opId) {
    const media = OPERATION_MEDIA[opId];
    root.classList.remove("wide"); // only Company Setup gets the wider column
    if (!media) {
      root.classList.remove("has-media");
      root.innerHTML = html;
      return;
    }
    root.classList.add("has-media");
    root.innerHTML =
      `<div class="op-col">${html}</div>` +
      `<aside class="op-media"><figure class="op-media-frame">` +
      `<video src="${media}" loop muted playsinline autoplay preload="metadata"></video>` +
      `</figure></aside>`;
    const vid = $(".op-media video");
    if (vid && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      vid.autoplay = false;
      vid.loop = false;
      vid.controls = true;
      vid.pause();
    }
  }

  function renderMain() {
    const root = $("#mainContent");

    /* Every navigation lands at the top. The panel scrolls internally, so
       without this you arrive halfway down the new page — or wherever the
       previous one's scroll position clamps to. renderMain is only ever
       called to change page, so this is the one place it belongs. */
    const scroller = $(".main-scroll");
    if (scroller) scroller.scrollTop = 0;

    if (currentOp === "welcome") {
      $("#actionBar").style.display = "none";
      root.classList.remove("has-media", "wide");
      root.innerHTML = welcomeTemplate();
      wireWelcomeEvents();
      return;
    }
    if (currentOp === "attendance_add") {
      $("#actionBar").style.display = "flex";
      paintOperation(root, attendanceTemplate(), "attendance_add");
      wireAttendanceEvents();
      updateSummary();
      return;
    }
    if (currentOp === "leave_balance_add") {
      $("#actionBar").style.display = "flex";
      paintOperation(root, leaveTemplate(), "leave_balance_add");
      wireLeaveEvents();
      updateSummary();
      return;
    }
    if (currentOp === "payroll_field_add") {
      $("#actionBar").style.display = "flex";
      paintOperation(root, payrollTemplate(), "payroll_field_add");
      wirePayrollEvents();
      updateSummary();
      return;
    }
    if (currentOp === "assets_add") {
      $("#actionBar").style.display = "flex";
      paintOperation(root, assetsTemplate(), "assets_add");
      wireAssetsEvents();
      updateSummary();
      return;
    }
    if (currentOp === "company_setup") {
      /* This page has no batch to generate and so no use for the shared
         action bar — every button it needs lives inside its own body. */
      $("#actionBar").style.display = "none";
      root.classList.remove("has-media");
      root.classList.add("wide");
      root.innerHTML = companySetupTemplate();
      wireCompanySetupEvents();
      return;
    }
    if (currentOp !== "employee_add") {
      const op = OPERATIONS.find((o) => o.id === currentOp);
      root.classList.remove("has-media", "wide");
      root.innerHTML = `
        <div class="page-head">
          <span class="page-eyebrow">Bulk operation</span>
          <h1 class="page-title">${op ? op.label : ""}</h1>
          <p class="page-desc">This one isn't built yet. Each operation gets added once its column-by-column rules are confirmed.</p>
        </div>
        <div class="placeholder-panel">
          <div class="pp-icon">${iconClock()}</div>
          <h3>Coming soon</h3>
          <p>The template and the rules for this one still need working through.</p>
        </div>`;
      $("#actionBar").style.display = "none";
      return;
    }
    $("#actionBar").style.display = "flex";
    paintOperation(root, employeeAddTemplate(), "employee_add");
    wireEmployeeAddEvents();
    renderDepartments();
    updateSummary();
  }

  /* Line icons matching the ones in Shomvob's own admin sidebar: a grid for
     the dashboard, people for employees, a clock for attendance, a calendar
     for leave, a dollar sign for payroll, a monitor for assets. Drawn here
     rather than pulled from an icon library — the page ships no external
     assets. */
  const OP_ICONS = {
    welcome: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/>',
    employee_add: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    attendance_add: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3.2 1.9"/>',
    leave_balance_add: '<rect x="3" y="4.5" width="18" height="17" rx="2"/><path d="M8 2.5v4M16 2.5v4M3 10.5h18"/><path d="M8 15h.01M12 15h.01M16 15h.01M8 18.5h.01M12 18.5h.01"/>',
    payroll_field_add: '<path d="M12 2.5v19"/><path d="M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
    assets_add: '<rect x="2.5" y="3.5" width="19" height="13.5" rx="2"/><path d="M8.5 21h7M12 17v4"/>',
    company_setup: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  };

  function opIcon(id) {
    const paths = OP_ICONS[id];
    if (!paths) return '<span class="op-dot"></span>';
    return `<svg class="op-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
  }

  /* One per SETTINGS_GROUPS entry, drawn in the same hand as OP_ICONS —
     Leave, Payroll and Attendance reuse their operation icons outright
     since they're the same concept; Company/Employee are new but the
     same stroke weight and grid. Shown in accent green on the group
     cards, the one deliberate splash of colour on an otherwise fairly
     neutral admin-style page. */
  const SETTINGS_GROUP_ICONS = {
    company: '<path d="M5 21V7l7-4 7 4v14"/><path d="M9 21v-6h6v6"/><path d="M9 11h.01M9 14h.01M15 11h.01M15 14h.01"/>',
    employee: '<rect x="4" y="4" width="16" height="16" rx="2.5"/><circle cx="12" cy="10" r="2.5"/><path d="M7.5 17c1-2.5 3-3 4.5-3s3.5.5 4.5 3"/>',
    leave: OP_ICONS.leave_balance_add,
    payroll: OP_ICONS.payroll_field_add,
    attendance: OP_ICONS.attendance_add,
  };
  function settingsGroupIcon(id) {
    const paths = SETTINGS_GROUP_ICONS[id];
    if (!paths) return "";
    return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" style="color:var(--accent)">${paths}</svg>`;
  }

  /* One per settings module — a small icon at the right end of that
     module's own section-head, so each module reads as its own "place"
     rather than an identical grey box with a different label. Drawn in
     the same hand as SETTINGS_GROUP_ICONS but each module gets its own
     glyph rather than reusing its group's. Uses `currentColor` (set to
     var(--accent) at low opacity at render time) rather than a fixed
     hex, so it stays legible in light, dark and auto alike.

     This was a large, low-opacity corner watermark on the card's
     background at first (2026-09-10) — dropped the same day, on sight:
     bottom-anchored meant it sat below the fold on every card taller
     than one screen (most of them) and was basically never seen, and
     when it was, `overflow: hidden` on the card sliced a visible corner
     off it. Living inside `.section-head` instead means it's a normal
     flex child, not an absolutely-positioned one — no clipping is
     possible, and `justify-content: space-between` on that row places
     it at the right end of the title for free, always visible the
     moment a tab opens regardless of how tall the content below turns
     out to be. Injected once, centrally, in setupGroupPageTemplate()
     rather than by editing all 21 module templates individually. */
  const SETTINGS_MODULE_ICONS = {
    company_profile: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2"/><path d="M7 16c.5-1.5 1.5-2 2-2s1.5.5 2 2"/><path d="M14 10h4M14 14h4"/>',
    bank_info: '<path d="M4 10l8-5 8 5"/><path d="M5 10v9M9 10v9M15 10v9M19 10v9"/><path d="M3 19h18"/>',
    branches: '<path d="M12 21s7-6.5 7-11a7 7 0 1 0-14 0c0 4.5 7 11 7 11Z"/><circle cx="12" cy="10" r="2.5"/>',
    departments: '<circle cx="12" cy="5" r="2"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="19" r="2"/><path d="M12 7v4M12 11H6v6M12 11h6v6"/>',
    designations: '<circle cx="12" cy="9" r="5"/><path d="M9 13.5 7 21l5-3 5 3-2-7.5"/>',
    custom_fields: '<path d="M4 7h16M4 12h16M4 17h16"/><circle cx="9" cy="7" r="1.6" fill="currentColor" stroke="none"/><circle cx="16" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="7" cy="17" r="1.6" fill="currentColor" stroke="none"/>',
    required_documents: '<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4"/><path d="M9.5 13.5l2 2 4-4"/>',
    leave_types: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 9h16"/><path d="M9 3v3M15 3v3"/><path d="M9 14l2 2 4-4"/>',
    leave_policy: '<path d="M12 3l7 3v6c0 5-3.5 7.5-7 9-3.5-1.5-7-4-7-9V6l7-3Z"/><path d="M9 12h6M9 15h4"/>',
    payroll_general: '<circle cx="12" cy="12" r="3"/><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8"/>',
    salary_components: '<ellipse cx="12" cy="6" rx="7" ry="2.5"/><path d="M5 6v6c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5V6"/><path d="M5 12v6c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5v-6"/>',
    configure_salary_components: '<circle cx="12" cy="12" r="8"/><path d="M12 4v8l6 4"/>',
    late_arrival: '<circle cx="12" cy="13" r="7"/><path d="M12 9v4l3 2"/><path d="M9 3h6"/>',
    absent_deduction: '<circle cx="10" cy="8" r="3"/><path d="M4 20c0-3.5 2.7-6 6-6s6 2.5 6 6"/><path d="M16 11h5"/>',
    bonus_types: '<rect x="4" y="9" width="16" height="11" rx="1.5"/><path d="M4 9h16M12 9v11"/><path d="M12 9c-1.5 0-3-1-3-2.5S10 4 12 6c0-2 1.5-3.5 3-2.5S13.5 9 12 9Z"/>',
    bonus_policy: '<rect x="4" y="10" width="16" height="10" rx="1.5"/><path d="M4 10h16"/><path d="M9 5c0-1 .8-1.5 1.5-1 .6.4.8 1.3.5 2M15 5c0-1-.8-1.5-1.5-1-.6.4-.8 1.3-.5 2"/><path d="M9 14h6"/>',
    overtime: '<circle cx="11" cy="13" r="7"/><path d="M11 9v4l3 2"/><path d="M18 4v4M16 6h4"/>',
    attendance_bonus: '<circle cx="10" cy="13" r="6.5"/><path d="M10 9.5v3.5l2.5 1.5"/><path d="M17 3.5l1 2 2.2.3-1.6 1.5.4 2.2-2-1-2 1 .4-2.2-1.6-1.5 2.2-.3z"/>',
    custom_addition_deduction: '<circle cx="8" cy="8" r="5"/><path d="M8 5.5v5M5.5 8h5"/><circle cx="16" cy="16" r="5"/><path d="M13.5 16h5"/>',
    tax: '<circle cx="7.5" cy="7.5" r="2.5"/><circle cx="16.5" cy="16.5" r="2.5"/><path d="M18 6 6 18"/>',
    attendance_policy: '<rect x="3" y="5" width="18" height="15" rx="2"/><path d="M3 9h18"/><path d="M8 3v3M16 3v3"/><circle cx="15.5" cy="15" r="3.2"/><path d="M15.5 13.3V15l1.3.9"/>',
  };
  function settingsModuleIconHtml(moduleId) {
    const paths = SETTINGS_MODULE_ICONS[moduleId];
    if (!paths) return "";
    return `<svg class="module-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
  }

  function iconClock() {
    return `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.2 2"/></svg>`;
  }

  function employeeAddTemplate() {
    return `
      <div class="page-head">
        <span class="page-eyebrow">Bulk operation · 01</span>
        <h1 class="page-title">Employee Add</h1>
        <p class="page-desc">Generate a QA-ready employee bulk-upload file. Give it a batch size and a prefix; every other field fills itself in, following the template's rules.</p>
        <details class="rules-card">
          <summary class="rules-summary"><span>Fixed generation rules</span><span class="chev">›</span></summary>
          <div class="rules-body">
            <div class="rule-row"><span class="rule-col">Employment Type</span><span class="rule-val">random — Permanent / In Probation / Intern</span></div>
            <div class="rule-row"><span class="rule-col">Probation Period</span><span class="rule-val">Permanent → 0 · others → random 3–6 months</span></div>
            <div class="rule-row"><span class="rule-col">Joining Date</span><span class="rule-val">~60% ${curYear - 1} · ~25% ${curYear} · ~15% ${curYear - 2}</span></div>
            <div class="rule-row"><span class="rule-col">Date of Birth</span><span class="rule-val">18–45 years old, always before Joining Date</span></div>
            <div class="rule-row"><span class="rule-col">Gross Salary</span><span class="rule-val">৳20,000–150,000, step 500</span></div>
            <div class="rule-row"><span class="rule-col">Email</span><span class="rule-val">firstname.lastname@yopmail.com</span></div>
            <div class="rule-row"><span class="rule-col">Phone</span><span class="rule-val">880 + BD mobile format, 13 digits, unique</span></div>
            <div class="rule-row"><span class="rule-col">Gender</span><span class="rule-val">matches the generated name</span></div>
          </div>
        </details>
      </div>

      <div class="section">
        <div class="section-head"><h2 class="section-title"><span class="section-num">1</span>Batch basics</h2></div>
        <p class="section-note">How many employees, and what their IDs should start with.</p>
        <div class="field-row">
          <div class="field">
            <label for="countInput">Number of employees</label>
            <input type="number" id="countInput" min="10" max="300" value="50" />
            <span class="hint">Min 10, max 300</span>
            <span class="error-text" id="countError"></span>
          </div>
          <div class="field">
            <label for="prefixInput">Employee ID prefix</label>
            <input type="text" id="prefixInput" maxlength="8" placeholder="JHTY" value="JHTY" />
            <span class="hint">4 alphabetic characters — auto-uppercase</span>
            <span class="error-text" id="prefixError"></span>
          </div>
        </div>
        <div class="preview-row" id="idPreview"></div>
      </div>

      <div class="section">
        <div class="section-head"><h2 class="section-title"><span class="section-num">2</span>Name source</h2></div>
        <p class="section-note">Random Bangla names, or a cast of characters?</p>
        <div class="theme-grid" id="themeGrid"></div>
        <div class="preview-row" id="namePreview"></div>
      </div>

      <div class="section">
        <div class="section-head"><h2 class="section-title"><span class="section-num">3</span>Department &amp; designation</h2></div>
        <p class="section-note">Pick or add departments, then set the designations for each. At least one designation in one department is needed.</p>
        <div class="bulk-row">
          <span class="bulk-label">Shortcut</span>
          <button type="button" class="bulk-btn" id="deptSelectAll"></button>
          <span class="bulk-count" id="deptSelectCount"></span>
        </div>
        <div class="dept-list" id="deptList"></div>
        <div class="add-dept-row">
          <button type="button" class="tiny-btn" id="addDeptBtn">+ Add custom department</button>
        </div>
        <div class="validation-banner hidden" id="deptWarning">${iconWarn()}<span id="deptWarningText">Pick at least one designation in at least one department.</span></div>
      </div>
    `;
  }

  function iconWarn() {
    return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0;margin-top:1px"><path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/></svg>`;
  }

  function wireEmployeeAddEvents() {
    const countInput = $("#countInput");
    const prefixInput = $("#prefixInput");

    countInput.addEventListener("input", () => {
      validateCount();
      renderIdPreview();
      updateSummary();
    });
    prefixInput.addEventListener("input", () => {
      const upper = prefixInput.value.toUpperCase().replace(/[^A-Z]/g, "");
      prefixInput.value = upper;
      validatePrefix();
      renderIdPreview();
      updateSummary();
    });

    const themeGrid = $("#themeGrid");
    themeGrid.innerHTML = "";
    Object.keys(NAME_THEME_LABELS).forEach((key) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "theme-card";
      card.setAttribute("aria-pressed", String(key === nameTheme));
      card.innerHTML = `<div class="theme-card-title">${NAME_THEME_LABELS[key]}</div><div class="theme-card-sub">${key === "bangla" ? "Unique pool, no repeats" : "Real character names"}</div>`;
      card.addEventListener("click", () => {
        nameTheme = key;
        $all(".theme-card", themeGrid).forEach((c) => c.setAttribute("aria-pressed", "false"));
        card.setAttribute("aria-pressed", "true");
        renderNamePreview();
        updateSummary();
      });
      themeGrid.appendChild(card);
    });

    $("#deptSelectAll").addEventListener("click", () => {
      const full = allDepartmentsFull();
      departments.forEach((d) => {
        if (d.isCustom) return;
        d.checked = !full;
        d.mode = "default";
        d.selectedDesig = new Set(full ? [] : d.defaultDesigOptions);
      });
      renderDepartments();
      updateSummary();
    });

    $("#addDeptBtn").addEventListener("click", () => {
      customDeptCounter++;
      departments.push({
        id: "custom_" + customDeptCounter,
        name: "",
        isCustom: true,
        checked: true,
        mode: "custom",
        selectedDesig: new Set(),
        customDesig: [],
        defaultDesigOptions: [],
      });
      renderDepartments();
      updateSummary();
    });

    prefixInput.value = prefixInput.value.toUpperCase().replace(/[^A-Z]/g, "");
    validateCount();
    validatePrefix();
    renderIdPreview();
    renderNamePreview();
  }

  function validateCount() {
    const el = $("#countInput");
    const err = $("#countError");
    const v = parseInt(el.value, 10);
    let ok = true;
    if (isNaN(v) || v < 10 || v > 300) {
      ok = false;
      err.textContent = "Somewhere between 10 and 300";
      el.classList.add("invalid");
    } else {
      err.textContent = "";
      el.classList.remove("invalid");
    }
    return ok;
  }

  function validatePrefix() {
    const el = $("#prefixInput");
    const err = $("#prefixError");
    const v = el.value;
    let ok = true;
    if (!/^[A-Z]{4}$/.test(v)) {
      ok = false;
      err.textContent = "Exactly 4 letters, please";
      el.classList.add("invalid");
    } else {
      err.textContent = "";
      el.classList.remove("invalid");
    }
    return ok;
  }

  function renderIdPreview() {
    const prefix = /^[A-Z]{4}$/.test($("#prefixInput").value) ? $("#prefixInput").value : "JHTY";
    const box = $("#idPreview");
    box.innerHTML = "";
    [1, 2, 3].forEach((n) => {
      const chip = document.createElement("span");
      chip.className = "chip accent";
      chip.textContent = `${prefix}${pad4(n)}  /  ${prefix}B${pad4(n)}`;
      box.appendChild(chip);
    });
  }

  function renderNamePreview() {
    const box = $("#namePreview");
    box.innerHTML = "";
    const samples = sampleNames(nameTheme, 3);
    samples.forEach((s) => {
      const chip = document.createElement("span");
      chip.className = "chip";
      chip.textContent = `${s.first} ${s.last} · ${s.gender === "M" ? "Male" : "Female"}`;
      box.appendChild(chip);
    });
  }

  /* Everything ticked AND every designation chosen — the state the
     department-level shortcut toggles to and from. Ticking a department
     without designations would only trip the warning, so the shortcut
     fills them in too. */
  function allDepartmentsFull() {
    return departments
      .filter((d) => !d.isCustom)
      .every((d) => d.checked && d.mode === "default" && d.selectedDesig.size === d.defaultDesigOptions.length);
  }

  function renderDeptShortcut() {
    const btn = $("#deptSelectAll");
    if (!btn) return;
    const defaults = departments.filter((d) => !d.isCustom);
    const full = allDepartmentsFull();
    btn.textContent = full
      ? `Clear all ${defaults.length} departments`
      : `Select all ${defaults.length} departments and their designations`;
    const picked = departmentState().final.length;
    $("#deptSelectCount").textContent = `${picked} ready`;
  }

  function renderDepartments() {
    const list = $("#deptList");
    list.innerHTML = "";
    renderDeptShortcut();
    departments.forEach((d) => {
      const card = document.createElement("div");
      card.className = "dept-card" + (d.checked || d.isCustom ? " checked" : "");

      if (!d.isCustom) {
        const head = document.createElement("div");
        head.className = "dept-head";
        head.innerHTML = `
          <input type="checkbox" ${d.checked ? "checked" : ""} data-dept="${d.id}" class="dept-checkbox" />
          <span class="dept-name">${d.name}</span>`;
        card.appendChild(head);
        head.querySelector(".dept-checkbox").addEventListener("change", (e) => {
          d.checked = e.target.checked;
          renderDepartments();
          updateSummary();
        });

        if (d.checked) {
          card.appendChild(deptBody(d));
        }
      } else {
        const head = document.createElement("div");
        head.className = "dept-head";
        head.innerHTML = `
          <input class="dept-name-input" type="text" placeholder="Department name" value="${escapeHtml(d.name)}" data-dept="${d.id}" />
          <button type="button" class="dept-remove" data-dept="${d.id}" title="Remove">${iconTrash()}</button>`;
        card.appendChild(head);
        head.querySelector(".dept-name-input").addEventListener("input", (e) => {
          d.name = e.target.value;
          updateSummary();
        });
        head.querySelector(".dept-remove").addEventListener("click", () => {
          const idx = departments.indexOf(d);
          if (idx > -1) departments.splice(idx, 1);
          renderDepartments();
          updateSummary();
        });
        card.appendChild(deptBody(d));
      }
      list.appendChild(card);
    });
  }

  function iconTrash() {
    return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6h16Z"/></svg>`;
  }
  function iconPlus() {
    return `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M12 5v14M5 12h14"/></svg>`;
  }
  /* "A", "A and B", "A, B and C" — for naming what the user has to fix */
  function listWords(items) {
    if (items.length <= 1) return items[0] || "";
    if (items.length === 2) return `${items[0]} and ${items[1]}`;
    return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
  }

  function escapeHtml(s) {
    return (s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function deptBody(d) {
    const body = document.createElement("div");
    body.className = "dept-body";

    if (!d.isCustom) {
      const toggle = document.createElement("div");
      toggle.className = "mode-toggle";
      toggle.innerHTML = `
        <button type="button" data-mode="default" aria-pressed="${d.mode === "default"}">Default</button>
        <button type="button" data-mode="custom" aria-pressed="${d.mode === "custom"}">Custom</button>`;
      $all("button", toggle).forEach((btn) => {
        btn.addEventListener("click", () => {
          d.mode = btn.dataset.mode;
          renderDepartments();
          updateSummary();
        });
      });
      /* the mode switch and this department's own shortcut share a row —
         different shapes so it reads as a separate control, not a third mode */
      const head = document.createElement("div");
      head.className = "dept-body-head";
      head.appendChild(toggle);

      if (d.mode === "default") {
        const all = d.selectedDesig.size === d.defaultDesigOptions.length;
        const pick = document.createElement("button");
        pick.type = "button";
        pick.className = "bulk-btn small";
        pick.textContent = all
          ? `Clear all ${d.defaultDesigOptions.length}`
          : `Select all ${d.defaultDesigOptions.length}`;
        pick.addEventListener("click", () => {
          d.selectedDesig = new Set(all ? [] : d.defaultDesigOptions);
          renderDepartments();
          updateSummary();
        });
        head.appendChild(pick);
      }
      body.appendChild(head);

      if (d.mode === "default") {
        const grid = document.createElement("div");
        grid.className = "desig-grid";
        d.defaultDesigOptions.forEach((desig) => {
          const on = d.selectedDesig.has(desig);
          const label = document.createElement("label");
          label.className = "desig-check" + (on ? " on" : "");
          label.innerHTML = `<input type="checkbox" ${on ? "checked" : ""} /> ${desig}`;
          label.querySelector("input").addEventListener("change", (e) => {
            if (e.target.checked) d.selectedDesig.add(desig);
            else d.selectedDesig.delete(desig);
            renderDepartments();
            updateSummary();
          });
          grid.appendChild(label);
        });
        body.appendChild(grid);
        return body;
      }
    }

    /* custom designation list (used by custom depts, and default depts in custom mode) */
    const wrap = document.createElement("div");
    wrap.className = "custom-desig-list";
    d.customDesig.forEach((val, i) => {
      const row = document.createElement("div");
      row.className = "custom-desig-row";
      row.innerHTML = `<input type="text" value="${escapeHtml(val)}" placeholder="Designation name" />
        <button type="button" class="icon-btn" title="Remove">${iconTrash()}</button>`;
      row.querySelector("input").addEventListener("input", (e) => {
        d.customDesig[i] = e.target.value;
        updateSummary();
      });
      row.querySelector("button").addEventListener("click", () => {
        d.customDesig.splice(i, 1);
        renderDepartments();
        updateSummary();
      });
      wrap.appendChild(row);
    });
    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "tiny-btn";
    addBtn.innerHTML = `${iconPlus()} Add designation`;
    addBtn.style.marginTop = d.customDesig.length ? "7px" : "0";
    addBtn.addEventListener("click", () => {
      d.customDesig.push("");
      renderDepartments();
    });
    wrap.appendChild(addBtn);
    body.appendChild(wrap);
    return body;
  }

  function updateEmployeeSummary() {
    const countOk = validateCount();
    const prefixOk = validatePrefix();
    const count = parseInt($("#countInput").value, 10);
    const prefix = $("#prefixInput").value;
    const dept = departmentState();
    const finalDepts = dept.final;
    const deptOk = finalDepts.length > 0 && dept.incomplete.length === 0;

    /* the shortcut's label and its "N ready" count are derived from the
       same state, so refresh them here rather than only on a full
       re-render — typing a custom designation doesn't trigger one */
    renderDeptShortcut();

    const warn = $("#deptWarning");
    warn.classList.toggle("hidden", deptOk);
    if (!deptOk) {
      $("#deptWarningText").textContent = dept.incomplete.length
        ? `${listWords(dept.incomplete)} ${dept.incomplete.length === 1 ? "has" : "have"} no designation picked.`
        : "Pick at least one designation in at least one department.";
    }

    const summary = $("#actionSummary");
    if (countOk && prefixOk) {
      summary.innerHTML = `<strong>${count}</strong> employees · prefix <strong>${prefix}</strong> · ${NAME_THEME_LABELS[nameTheme]} · <strong>${finalDepts.length}</strong> department${finalDepts.length === 1 ? "" : "s"}`;
    } else {
      summary.textContent = "Fix the batch basics first";
    }

    $("#generateBtn").disabled = !(countOk && prefixOk && deptOk);
  }

  function showToast(msg, isError) {
    const t = $("#toast");
    t.textContent = msg;
    t.classList.toggle("error", !!isError);
    t.classList.add("show");
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => t.classList.remove("show"), 4200);
  }

  function handleEmployeeGenerate() {
    if (!validateCount() || !validatePrefix()) {
      showToast("Something's off in the batch basics.", true);
      return;
    }
    const dept = departmentState();
    if (dept.incomplete.length) {
      showToast(`${listWords(dept.incomplete)} still needs a designation.`, true);
      return;
    }
    const finalDepts = dept.final;
    if (!finalDepts.length) {
      showToast("Pick at least one designation in one department.", true);
      return;
    }
    const count = parseInt($("#countInput").value, 10);
    const prefix = $("#prefixInput").value;
    try {
      const rows = generateWorkbookRows(count, prefix, nameTheme, finalDepts);
      const filename = downloadWorkbook(rows, prefix);
      showToast(`${filename} — ${count} employees, and you typed none of them 🎉`);
    } catch (err) {
      console.error(err);
      showToast("Couldn't generate the file. The console has the details.", true);
    }
  }

  /* ================= Attendance Add ================= */

  const att = {
    idMode: "paste",
    pasteText: "",
    genPrefix: "HUIW",
    genStart: 1,
    genCount: 50,
    upload: null, /* { name, options: [{label, values}], pick } */
    ids: [],

    from: "",
    to: "",

    shiftCount: 1,
    shifts: [{ in: "09:00", out: "17:00", ids: [] }],
    grace: 15,
    searchText: [],
    focusSearch: -1,

    weekend: DEFAULT_WEEKEND.slice(),

    holidayMode: "govt",
    customHolidays: [],
    govtRemoved: [],

    otEnabled: false,
    otMax: { weekday: 2, weekend: 4, holiday: 4 },
    otPct: { weekday: 20, weekend: 10, holiday: 5 },

    latePct: 15,
    absentPct: 5,

    timeFormat: "h12",
  };

  /* ---------- attendance helpers ---------- */

  function pctHit(p) {
    return Math.random() * 100 < p;
  }
  function parseHM(s) {
    const parts = String(s || "").split(":");
    const h = parseInt(parts[0], 10),
      m = parseInt(parts[1], 10);
    if (isNaN(h) || isNaN(m)) return null;
    return h * 60 + m;
  }
  function colLetter(i) {
    let s = "";
    i += 1;
    while (i > 0) {
      const r = (i - 1) % 26;
      s = String.fromCharCode(65 + r) + s;
      i = Math.floor((i - 1) / 26);
    }
    return s;
  }

  /* Renders a minute-of-day in whichever of the template's accepted formats
     the user picked. Values past midnight wrap, which is what a shift that
     crosses midnight needs. Seconds are random when the format shows them. */
  function formatTime(min, fmtId) {
    const t = ((Math.round(min) % 1440) + 1440) % 1440;
    const h = Math.floor(t / 60);
    const mm = String(t % 60).padStart(2, "0");
    const ss = String(randInt(0, 59)).padStart(2, "0");
    if (fmtId === "h24") return `${String(h).padStart(2, "0")}:${mm}`;
    if (fmtId === "h24s") return `${String(h).padStart(2, "0")}:${mm}:${ss}`;
    const ap = h < 12 ? "AM" : "PM";
    const hh = String(h % 12 === 0 ? 12 : h % 12).padStart(2, "0");
    if (fmtId === "h12s") return `${hh}:${mm}:${ss} ${ap}`;
    return `${hh}:${mm} ${ap}`;
  }

  function parseDateStr(s) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ""));
    if (!m) return null;
    return new Date(+m[1], +m[2] - 1, +m[3]);
  }

  function eachDate(fromStr, toStr, cb) {
    const start = parseDateStr(fromStr),
      end = parseDateStr(toStr);
    if (!start || !end || start > end) return;
    const d = new Date(start);
    while (d <= end) {
      cb(new Date(d));
      d.setDate(d.getDate() + 1);
    }
  }

  /* Split on any run of whitespace, comma, semicolon, pipe or quote, so a
     column pasted from Excel, a comma list and one-per-line all work. */
  function parseIdList(text) {
    const raw = String(text || "")
      .split(/[\s,;|"']+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const seen = new Set();
    const ids = [];
    raw.forEach((v) => {
      if (seen.has(v)) return;
      seen.add(v);
      ids.push(v);
    });
    return { ids, total: raw.length, dupes: raw.length - ids.length };
  }

  /* ---------- shared employee-ID source ----------

     Attendance and Assets both need the same paste / generate / upload
     picker, so rather than duplicate it the picker is bound to whichever
     state object the operation on screen owns. Only one operation renders
     at a time, so the element ids are safe to share. */

  let idSrc = { state: null, onChange: null };

  function newIdSourceState(defaults) {
    const d = defaults || {};
    return {
      idMode: "paste",
      pasteText: "",
      genPrefix: d.genPrefix || "HUIW",
      genStart: 1,
      genCount: d.genCount || 50,
      upload: null,
      ids: [],
    };
  }

  function bindIdSource(state, onChange) {
    idSrc = { state: state, onChange: onChange };
  }

  function idSourceMarkup(state) {
    return `
      <div class="seg" id="idModeSeg">
        <button type="button" data-mode="paste" aria-pressed="${state.idMode === "paste"}">Paste</button>
        <button type="button" data-mode="generate" aria-pressed="${state.idMode === "generate"}">Generate</button>
        <button type="button" data-mode="upload" aria-pressed="${state.idMode === "upload"}">Upload</button>
      </div>
      <div class="seg-panel" id="idPanel"></div>
      <div id="idTally"></div>`;
  }

  function wireIdSourceSeg() {
    $all("#idModeSeg button").forEach((b) => {
      b.addEventListener("click", () => {
        idSrc.state.idMode = b.dataset.mode;
        $all("#idModeSeg button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
        recomputeIds();
        renderIdPanel();
        if (idSrc.onChange) idSrc.onChange();
      });
    });
  }

  function generatedIds() {
    const s = idSrc.state;
    const out = [];
    if (!s.genPrefix || !(s.genCount > 0)) return out;
    for (let i = 0; i < s.genCount; i++) out.push(s.genPrefix + pad4(s.genStart + i));
    return out;
  }

  /* Resolves whichever mode is active into state.ids. Anything the owning
     operation needs to do afterwards belongs in its onChange. */
  function recomputeIds() {
    const s = idSrc.state;
    let ids = [];
    if (s.idMode === "paste") ids = parseIdList(s.pasteText).ids;
    else if (s.idMode === "generate") ids = generatedIds();
    else if (s.upload && s.upload.pick != null) {
      const opt = s.upload.options[s.upload.pick];
      if (opt) ids = parseIdList(opt.values.join("\n")).ids;
    }
    s.ids = ids;
  }

  function idSourceChanged() {
    recomputeIds();
    renderIdTally();
    if (idSrc.onChange) idSrc.onChange();
  }

  function assignedIdSet() {
    const set = new Set();
    att.shifts.forEach((sh) => sh.ids.forEach((id) => set.add(id)));
    return set;
  }

  function unassignedIds() {
    const taken = assignedIdSet();
    return att.ids.filter((id) => !taken.has(id));
  }

  /* With a single shift there is nothing to decide — everyone is in it. */
  function singleShift() {
    return att.shiftCount === 1;
  }

  function effectiveShifts() {
    if (singleShift()) return [{ in: att.shifts[0].in, out: att.shifts[0].out, ids: att.ids.slice() }];
    return att.shifts.map((sh) => ({ in: sh.in, out: sh.out, ids: sh.ids.slice() }));
  }

  function syncShiftCount() {
    const n = att.shiftCount;
    while (att.shifts.length < n) {
      const prev = att.shifts[att.shifts.length - 1];
      att.shifts.push({ in: prev ? prev.in : "09:00", out: prev ? prev.out : "17:00", ids: [] });
    }
    if (att.shifts.length > n) att.shifts.length = n;
    att.searchText.length = n;
  }

  function govtHolidayList() {
    const out = [];
    Object.keys(BD_HOLIDAYS).forEach((y) => {
      BD_HOLIDAYS[y].forEach((h) => out.push({ date: h[0], name: h[1], approx: !!h[2] }));
    });
    out.sort((a, b) => (a.date < b.date ? -1 : 1));
    return out;
  }

  function activeHolidaySet() {
    const set = new Set();
    if (att.holidayMode === "govt" || att.holidayMode === "govt_custom") {
      govtHolidayList().forEach((h) => {
        if (att.govtRemoved.indexOf(h.date) === -1) set.add(h.date);
      });
    }
    if (att.holidayMode === "custom" || att.holidayMode === "govt_custom") {
      att.customHolidays.forEach((d) => set.add(d));
    }
    return set;
  }

  /* ---------- attendance row generation ---------- */

  function generateAttendanceRows() {
    const rows = [ATTENDANCE_HEADER.slice()];
    const holidays = activeHolidaySet();
    const weekend = new Set(att.weekend);
    const fmt = att.timeFormat;
    const shifts = effectiveShifts();

    eachDate(att.from, att.to, (date) => {
      const ds = fmtDate(date);
      const type = holidays.has(ds) ? "holiday" : weekend.has(date.getDay()) ? "weekend" : "weekday";

      shifts.forEach((sh) => {
        const start = parseHM(sh.in);
        let end = parseHM(sh.out);
        if (start == null || end == null) return;
        if (end <= start) end += 1440; /* shift crosses midnight */

        sh.ids.forEach((id) => {
          let inMin, outMin;

          if (type === "weekday") {
            if (pctHit(att.absentPct)) return; /* absent = no row at all */
            inMin = pctHit(att.latePct)
              ? start + att.grace + randInt(1, 60)
              : start + randInt(-10, att.grace);
            outMin =
              att.otEnabled && att.otMax.weekday > 0 && pctHit(att.otPct.weekday)
                ? end + randInt(1, att.otMax.weekday * 60)
                : end + randInt(0, 10);
          } else {
            /* weekend and holiday produce nothing unless this employee is
               one of the overtime cases — and then the whole attendance is
               overtime, starting at the shift's normal start time. */
            if (!att.otEnabled) return;
            const max = att.otMax[type];
            if (!(max > 0) || !pctHit(att.otPct[type])) return;
            inMin = start;
            outMin = start + randInt(1, max * 60);
          }

          rows.push([id, ds, formatTime(inMin, fmt), formatTime(outMin, fmt)]);
        });
      });
    });

    return rows;
  }

  function downloadAttendanceWorkbook(rows) {
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [{ wch: 16 }, { wch: 13 }, { wch: 14 }, { wch: 14 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, ATTENDANCE_SHEET);
    const stamp = fmtDate(today).replace(/-/g, "");
    const filename = `attendance_bulk_upload_${stamp}.xlsx`;
    XLSX.writeFile(wb, filename);
    return filename;
  }

  /* ---------- attendance UI ---------- */

  function attendanceTemplate() {
    const fmtCards = TIME_FORMATS.map(
      (f) =>
        `<button type="button" class="theme-card" data-fmt="${f.id}" aria-pressed="${f.id === att.timeFormat}">
           <div class="theme-card-title">${f.label}</div><div class="theme-card-sub">${f.sub}</div>
         </button>`
    ).join("");

    return `
      <div class="page-head">
        <span class="page-eyebrow">Bulk operation · 02</span>
        <h1 class="page-title">Employee Attendance Add</h1>
        <p class="page-desc">Give it employee IDs, a date range and your shifts. It works out the rest — weekends, holidays, lateness, absence and overtime.</p>
        <details class="rules-card">
          <summary class="rules-summary"><span>Fixed generation rules</span><span class="chev">›</span></summary>
          <div class="rules-body">
            <div class="rule-row"><span class="rule-col">An ordinary day</span><span class="rule-val">In: 10 min before the shift → end of grace · Out: shift end → +10 min</span></div>
            <div class="rule-row"><span class="rule-col">Late</span><span class="rule-val">1–60 minutes past the end of grace</span></div>
            <div class="rule-row"><span class="rule-col">Absent</span><span class="rule-val">no row at all that day</span></div>
            <div class="rule-row"><span class="rule-col">Weekend / holiday</span><span class="rule-val">nothing, unless it's overtime — then In = shift start, Out = start + OT</span></div>
            <div class="rule-row"><span class="rule-col">Overtime</span><span class="rule-val">not a column — it just pushes Out Time past the shift's end</span></div>
            <div class="rule-row"><span class="rule-col">Shift over midnight</span><span class="rule-val">one shift = one row, dated by the day it started</span></div>
          </div>
        </details>
      </div>

      <div class="section">
        <div class="section-head"><h2 class="section-title"><span class="section-num">1</span>Employee IDs</h2></div>
        <p class="section-note">Whose attendance this is for. Paste them, generate them, or pull them from a file.</p>
        ${idSourceMarkup(att)}
      </div>

      <div class="section">
        <div class="section-head"><h2 class="section-title"><span class="section-num">2</span>Date range</h2></div>
        <p class="section-note">Which days to cover.</p>
        <div class="field-row">
          <div class="field">
            <label for="fromDate">From</label>
            <input type="date" id="fromDate" value="${att.from}" />
          </div>
          <div class="field">
            <label for="toDate">To</label>
            <input type="date" id="toDate" value="${att.to}" />
          </div>
        </div>
        <div id="rangeTally"></div>
      </div>

      <div class="section">
        <div class="section-head"><h2 class="section-title"><span class="section-num">3</span>Shifts</h2></div>
        <p class="section-note">How many shifts there are, and when each one starts and ends.</p>
        <div class="field-grid-2">
          <div class="field">
            <label for="shiftCount">How many shifts</label>
            <input type="number" id="shiftCount" min="1" max="10" value="${att.shiftCount}" />
            <span class="hint">1 to 10</span>
          </div>
          <div class="field">
            <label for="graceInput">Grace period (minutes)</label>
            <input type="number" id="graceInput" min="0" max="120" value="${att.grace}" />
            <span class="hint">Nobody counts as late until this runs out</span>
          </div>
        </div>
        <div class="shift-list" id="shiftList"></div>
      </div>

      <div class="section" id="assignSection">
        <div class="section-head"><h2 class="section-title"><span class="section-num">4</span>Who works which shift</h2></div>
        <p class="section-note">Search and click, or drag them out of the pool into a shift.</p>
        <div id="assignWrap"></div>
      </div>

      <div class="section">
        <div class="section-head"><h2 class="section-title"><span class="section-num">5</span>Weekend</h2></div>
        <p class="section-note">Which days your weekend falls on. Normally nothing is recorded on those.</p>
        <div class="day-row" id="dayRow"></div>
      </div>

      <div class="section">
        <div class="section-head"><h2 class="section-title"><span class="section-num">6</span>Holiday</h2></div>
        <p class="section-note">Whether any holidays fall inside the range.</p>
        <div class="choice-list" id="holidayChoices">
          <label class="choice ${att.holidayMode === "govt" ? "on" : ""}"><input type="radio" name="hmode" value="govt" ${att.holidayMode === "govt" ? "checked" : ""} /><span class="choice-text"><strong>Shomvob HR holidays</strong><span>Built-in list, straight from Shomvob HR</span></span></label>
          <label class="choice ${att.holidayMode === "govt_custom" ? "on" : ""}"><input type="radio" name="hmode" value="govt_custom" ${att.holidayMode === "govt_custom" ? "checked" : ""} /><span class="choice-text"><strong>Shomvob HR holidays + your own dates</strong><span>The built-in list, plus dates of your own</span></span></label>
          <label class="choice ${att.holidayMode === "custom" ? "on" : ""}"><input type="radio" name="hmode" value="custom" ${att.holidayMode === "custom" ? "checked" : ""} /><span class="choice-text"><strong>Custom dates only</strong><span>Only the dates you add</span></span></label>
          <label class="choice ${att.holidayMode === "none" ? "on" : ""}"><input type="radio" name="hmode" value="none" ${att.holidayMode === "none" ? "checked" : ""} /><span class="choice-text"><strong>No holiday</strong><span>Every day is a working day, weekends aside</span></span></label>
        </div>
        <div id="holidayWrap"></div>
      </div>

      <div class="section">
        <div class="section-head"><h2 class="section-title"><span class="section-num">7</span>Overtime</h2></div>
        <p class="section-note">Whether overtime exists here. It isn't a column — it just makes Out Time later.</p>
        <div class="seg" id="otSeg">
          <button type="button" data-ot="no" aria-pressed="${!att.otEnabled}">No</button>
          <button type="button" data-ot="yes" aria-pressed="${att.otEnabled}">Yes</button>
        </div>
        <div id="otWrap"></div>
      </div>

      <div class="section">
        <div class="section-head"><h2 class="section-title"><span class="section-num">8</span>Percentages</h2></div>
        <p class="section-note">What share of people turn up late, don't turn up, and stay on.</p>
        <div class="field-grid-2">
          <div class="field">
            <label for="latePct">Late (%)</label>
            <input type="number" id="latePct" min="0" max="100" value="${att.latePct}" />
          </div>
          <div class="field">
            <label for="absentPct">Absent (%)</label>
            <input type="number" id="absentPct" min="0" max="100" value="${att.absentPct}" />
          </div>
        </div>
        <div id="otPctWrap"></div>
      </div>

      <div class="section">
        <div class="section-head"><h2 class="section-title"><span class="section-num">9</span>Time format</h2></div>
        <p class="section-note">How In/Out Time gets written. The template takes all four.</p>
        <div class="fmt-grid" id="fmtGrid">${fmtCards}</div>
      </div>
    `;
  }

  function renderIdPanel() {
    const st = idSrc.state;
    const box = $("#idPanel");
    if (st.idMode === "paste") {
      box.innerHTML = `
        <div class="field">
          <label for="idPaste">Employee ID list</label>
          <textarea id="idPaste" placeholder="HUIW0101&#10;HUIW0102&#10;HUIW0103">${escapeHtml(st.pasteText)}</textarea>
          <span class="hint">One per line, or comma-separated, or however they came out — duplicates get dropped.</span>
        </div>`;
      $("#idPaste").addEventListener("input", (e) => {
        st.pasteText = e.target.value;
        idSourceChanged();
      });
    } else if (st.idMode === "generate") {
      box.innerHTML = `
        <div class="field-grid-3">
          <div class="field">
            <label for="genPrefix">Prefix</label>
            <input type="text" id="genPrefix" maxlength="8" value="${escapeHtml(st.genPrefix)}" />
            <span class="hint">Auto-uppercase</span>
          </div>
          <div class="field">
            <label for="genStart">Start number</label>
            <input type="number" id="genStart" min="1" value="${st.genStart}" />
            <span class="hint">Real accounts don't always start at 0001</span>
          </div>
          <div class="field">
            <label for="genCount">How many</label>
            <input type="number" id="genCount" min="1" max="2000" value="${st.genCount}" />
          </div>
        </div>
        <div class="preview-row" id="genPreview"></div>`;
      $("#genPrefix").addEventListener("input", (e) => {
        e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
        st.genPrefix = e.target.value;
        renderGenPreview();
        idSourceChanged();
      });
      $("#genStart").addEventListener("input", (e) => {
        st.genStart = Math.max(1, parseInt(e.target.value, 10) || 1);
        renderGenPreview();
        idSourceChanged();
      });
      $("#genCount").addEventListener("input", (e) => {
        st.genCount = Math.max(0, parseInt(e.target.value, 10) || 0);
        renderGenPreview();
        idSourceChanged();
      });
      renderGenPreview();
    } else {
      const up = st.upload;
      let picker = "";
      if (up && up.options.length) {
        picker = `
          <div class="field" style="margin-top:12px">
            <label for="colPick">Which column holds the IDs</label>
            <select id="colPick">
              ${up.options
                .map((o, i) => `<option value="${i}" ${i === up.pick ? "selected" : ""}>${escapeHtml(o.label)} — ${o.values.length} value</option>`)
                .join("")}
            </select>
          </div>`;
      }
      box.innerHTML = `
        <div class="field">
          <label for="idFile">Excel ba CSV file</label>
          <input type="file" id="idFile" accept=".xlsx,.xlsm,.csv,.txt" />
          <span class="hint">${up ? escapeHtml(up.name) : "An Employee Add file works too — it finds the column itself"}</span>
        </div>
        ${picker}`;
      $("#idFile").addEventListener("change", handleIdFile);
      if (up && up.options.length) {
        $("#colPick").addEventListener("change", (e) => {
          st.upload.pick = parseInt(e.target.value, 10);
          idSourceChanged();
        });
      }
    }
    renderIdTally();
  }

  function renderGenPreview() {
    const box = $("#genPreview");
    if (!box) return;
    box.innerHTML = "";
    const ids = generatedIds();
    const show = ids.length > 3 ? [ids[0], ids[1], "…", ids[ids.length - 1]] : ids;
    show.forEach((v) => {
      const chip = document.createElement("span");
      chip.className = "chip accent";
      chip.textContent = v;
      box.appendChild(chip);
    });
  }

  function renderIdTally() {
    const box = $("#idTally");
    if (!box) return;
    const st = idSrc.state;
    const n = st.ids.length;
    let extra = "";
    if (st.idMode === "paste") {
      const p = parseIdList(st.pasteText);
      if (p.dupes) extra = ` · <strong>${p.dupes}</strong> duplicates dropped`;
    }
    box.innerHTML = n
      ? `<span class="tally ok"><strong>${n}</strong> employee IDs ready${extra}</span>`
      : `<span class="tally">No employee IDs yet</span>`;
  }

  /* Turns any uploaded sheet into a list of pickable columns, so "any file"
     genuinely works. A column whose header looks like an ID header is
     auto-selected; a bare single-column sheet (the attendance template's
     ReferenceData) is offered whole. */
  function columnOptions(aoaBySheet) {
    const opts = [];
    Object.keys(aoaBySheet).forEach((name) => {
      const aoa = aoaBySheet[name];
      if (!aoa || !aoa.length) return;
      const width = aoa.reduce((w, r) => Math.max(w, r.length), 0);
      for (let c = 0; c < width; c++) {
        const col = aoa.map((r) => (r[c] == null ? "" : String(r[c]).trim()));
        const head = col[0] || "";
        const isHeader = /[A-Za-z]/.test(head) && /id|name|employee|code/i.test(head);
        const values = (isHeader ? col.slice(1) : col).filter(Boolean);
        if (!values.length) continue;
        opts.push({
          label: isHeader ? `${name} · ${head}` : `${name} · column ${colLetter(c)}`,
          header: isHeader ? head : "",
          values,
        });
      }
    });
    return opts;
  }

  function parseCsv(text) {
    return String(text)
      .split(/\r?\n/)
      .filter((line) => line.trim() !== "")
      .map((line) => line.split(",").map((c) => c.replace(/^\s*"?|"?\s*$/g, "")));
  }

  function handleIdFile(e) {
    const st = idSrc.state;
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    const isText = /\.(csv|txt)$/i.test(file.name);

    reader.onload = () => {
      try {
        const bySheet = {};
        if (isText) {
          bySheet[file.name] = parseCsv(reader.result);
        } else {
          const wb = XLSX.read(new Uint8Array(reader.result), { type: "array" });
          wb.SheetNames.forEach((name) => {
            if (name === "_Metadata") return;
            const aoa = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, blankrows: false });
            if (aoa && aoa.length) bySheet[name] = aoa;
          });
        }
        const options = columnOptions(bySheet);
        if (!options.length) {
          showToast("Couldn't find an ID column in that file.", true);
          return;
        }
        let pick = options.findIndex((o) => /employee\s*id/i.test(o.header));
        if (pick < 0) pick = options.findIndex((o) => /id/i.test(o.header));
        if (pick < 0) pick = 0;
        st.upload = { name: file.name, options, pick };
        recomputeIds();
        renderIdPanel();
        if (idSrc.onChange) idSrc.onChange();
        showToast(`${file.name} — found ${st.ids.length} IDs.`);
      } catch (err) {
        console.error(err);
        showToast("Couldn't read that file.", true);
      }
    };
    reader.onerror = () => showToast("Couldn't read that file.", true);
    if (isText) reader.readAsText(file);
    else reader.readAsArrayBuffer(file);
  }

  /* Splits the chosen range by day type, and works out how many of those
     days could actually yield a row. A weekend or holiday only can when
     overtime is on with both a maximum and a percentage above zero for
     that day type — otherwise those days produce nothing at all. */
  function rangeDayCounts() {
    const from = parseDateStr(att.from),
      to = parseDateStr(att.to);
    if (!from || !to || from > to) return null;

    const holidays = activeHolidaySet();
    const weekend = new Set(att.weekend);
    let days = 0,
      weekendDays = 0,
      holidayDays = 0;
    eachDate(att.from, att.to, (d) => {
      days++;
      const ds = fmtDate(d);
      if (holidays.has(ds)) holidayDays++;
      else if (weekend.has(d.getDay())) weekendDays++;
    });
    const working = days - weekendDays - holidayDays;

    const otOn = (kind) => att.otEnabled && att.otMax[kind] > 0 && att.otPct[kind] > 0;
    const usable = working + (otOn("weekend") ? weekendDays : 0) + (otOn("holiday") ? holidayDays : 0);

    return { days, weekendDays, holidayDays, working, usable };
  }

  function renderRangeTally() {
    const box = $("#rangeTally");
    if (!box) return;
    const from = parseDateStr(att.from),
      to = parseDateStr(att.to);
    if (!from || !to) {
      box.innerHTML = `<span class="tally">Needs both a From and a To</span>`;
      return;
    }
    if (from > to) {
      box.innerHTML = `<span class="tally warn">From is after To</span>`;
      return;
    }
    const counts = rangeDayCounts();
    const days = counts.days,
      weekendDays = counts.weekendDays,
      holidayDays = counts.holidayDays,
      working = counts.working;

    /* The holiday table only covers the years it covers. Saying so beats
       silently generating a month with no holidays in it. */
    let missing = [];
    if (att.holidayMode === "govt" || att.holidayMode === "govt_custom") {
      const years = new Set();
      for (let y = from.getFullYear(); y <= to.getFullYear(); y++) years.add(y);
      missing = Array.from(years).filter((y) => !BD_HOLIDAYS[y]);
    }

    box.innerHTML =
      `<span class="tally ok"><strong>${days}</strong> days · <strong>${working}</strong> working · ${weekendDays} weekend · ${holidayDays} holiday</span>` +
      (missing.length
        ? `<span class="tally warn" style="margin-left:8px">No holiday list for ${missing.join(", ")} — add custom dates</span>`
        : "");
  }

  function shiftSpanText(sh) {
    const start = parseHM(sh.in),
      end = parseHM(sh.out);
    if (start == null || end == null) return "";
    let len = end - start;
    if (len <= 0) len += 1440;
    const h = Math.floor(len / 60),
      m = len % 60;
    return `${h}h${m ? " " + m + "m" : ""}${end <= start ? " · crosses midnight" : ""}`;
  }

  function renderShifts() {
    const list = $("#shiftList");
    if (!list) return;
    list.innerHTML = "";
    att.shifts.forEach((sh, i) => {
      const card = document.createElement("div");
      card.className = "shift-card";
      card.innerHTML = `
        <div class="shift-card-head">
          <span class="shift-badge">Shift ${i + 1}</span>
          <span class="shift-span">${shiftSpanText(sh)}</span>
          <div class="shift-times">
            <label>In</label><input type="time" data-shift="${i}" data-side="in" value="${sh.in}" />
            <label>Out</label><input type="time" data-shift="${i}" data-side="out" value="${sh.out}" />
          </div>
        </div>`;
      $all("input[type=time]", card).forEach((inp) => {
        /* Update the labels in place rather than re-rendering — a re-render
           would rip out the very input being typed into. */
        inp.addEventListener("input", (e) => {
          const idx = +e.target.dataset.shift;
          att.shifts[idx][e.target.dataset.side] = e.target.value;
          const span = $(".shift-span", card);
          if (span) span.textContent = shiftSpanText(att.shifts[idx]);
          const assignSpan = $(`#assignWrap .shift-card:nth-of-type(${idx + 1}) .shift-span`);
          if (assignSpan) {
            const s2 = att.shifts[idx];
            assignSpan.textContent = `${s2.in} – ${s2.out} · ${s2.ids.length} employee`;
          }
          updateSummary();
        });
      });
      list.appendChild(card);
    });
  }

  function renderAssign() {
    const wrap = $("#assignWrap");
    if (!wrap) return;
    wrap.innerHTML = "";

    if (singleShift()) {
      wrap.innerHTML = `<span class="tally"><strong>1</strong> shift — all ${att.ids.length} of them are on it</span>`;
      return;
    }

    const free = unassignedIds();

    const pool = document.createElement("div");
    pool.className = "assign-pool";
    pool.innerHTML = `
      <div class="pool-head">
        <span class="pool-title">Unassigned</span>
        <span class="tally" style="margin:0"><strong>${free.length}</strong> left</span>
      </div>
      <div class="pool-scroll">${
        free.length
          ? free.map((id) => `<span class="pool-chip" draggable="true" data-id="${escapeHtml(id)}">${escapeHtml(id)}</span>`).join("")
          : `<span class="pool-empty">Everyone has a shift.</span>`
      }</div>`;
    $all(".pool-chip", pool).forEach((chip) => {
      chip.addEventListener("dragstart", (e) => {
        e.dataTransfer.setData("text/plain", chip.dataset.id);
        chip.classList.add("dragging");
      });
      chip.addEventListener("dragend", () => chip.classList.remove("dragging"));
    });
    pool.addEventListener("dragover", (e) => {
      e.preventDefault();
      pool.classList.add("drop-hover");
    });
    pool.addEventListener("dragleave", () => pool.classList.remove("drop-hover"));
    pool.addEventListener("drop", (e) => {
      e.preventDefault();
      pool.classList.remove("drop-hover");
      const id = e.dataTransfer.getData("text/plain");
      att.shifts.forEach((sh) => {
        const i = sh.ids.indexOf(id);
        if (i > -1) sh.ids.splice(i, 1);
      });
      renderAssign();
      updateSummary();
    });
    wrap.appendChild(pool);

    att.shifts.forEach((sh, i) => {
      const term = (att.searchText[i] || "").trim();
      const matches = term ? free.filter((id) => id.toLowerCase().indexOf(term.toLowerCase()) > -1) : [];

      const card = document.createElement("div");
      card.className = "shift-card";
      card.style.marginTop = "10px";
      card.innerHTML = `
        <div class="shift-card-head">
          <span class="shift-badge">Shift ${i + 1}</span>
          <span class="shift-span">${sh.in} – ${sh.out} · ${sh.ids.length} employee</span>
        </div>
        <div class="assign-search">
          <input type="text" placeholder="Search an ID — try 059" data-shift="${i}" value="${escapeHtml(att.searchText[i] || "")}" />
          <div class="search-results" data-shift="${i}"></div>
        </div>
        <div class="mini-actions">
          <button type="button" class="tiny-btn" data-act="all" data-shift="${i}">Add all matching${term ? ` (${matches.length})` : ""}</button>
          <button type="button" class="tiny-btn" data-act="rest" data-shift="${i}">Put the rest here (${free.length})</button>
          <button type="button" class="tiny-btn" data-act="clear" data-shift="${i}">Clear</button>
        </div>
        <div class="assigned-row">${sh.ids
          .map(
            (id) =>
              `<span class="chip removable">${escapeHtml(id)}<button type="button" class="chip-x" data-rm="${escapeHtml(id)}" data-shift="${i}" title="Remove">×</button></span>`
          )
          .join("")}</div>`;

      const results = $(".search-results", card);
      const input = $(".assign-search input", card);

      const paint = () => {
        const t = (att.searchText[i] || "").trim();
        if (!t) {
          results.hidden = true;
          return;
        }
        const list = unassignedIds().filter((id) => id.toLowerCase().indexOf(t.toLowerCase()) > -1);
        results.hidden = false;
        results.innerHTML = list.length
          ? list.slice(0, 60).map((id) => `<button type="button" data-add="${escapeHtml(id)}">${escapeHtml(id)}</button>`).join("")
          : `<div class="search-none">Nothing matches</div>`;
        $all("button[data-add]", results).forEach((b) => {
          b.addEventListener("click", () => {
            sh.ids.push(b.dataset.add);
            att.focusSearch = i;
            renderAssign();
            updateSummary();
          });
        });
      };

      input.addEventListener("input", (e) => {
        att.searchText[i] = e.target.value;
        paint();
      });
      input.addEventListener("focus", () => {
        att.focusSearch = i;
        paint();
      });
      paint();

      $all("button[data-act]", card).forEach((b) => {
        b.addEventListener("click", () => {
          const act = b.dataset.act;
          if (act === "clear") sh.ids = [];
          else if (act === "rest") sh.ids = sh.ids.concat(unassignedIds());
          else {
            const t = (att.searchText[i] || "").trim();
            if (!t) return;
            sh.ids = sh.ids.concat(unassignedIds().filter((id) => id.toLowerCase().indexOf(t.toLowerCase()) > -1));
          }
          renderAssign();
          updateSummary();
        });
      });

      $all("button[data-rm]", card).forEach((b) => {
        b.addEventListener("click", () => {
          const idx = sh.ids.indexOf(b.dataset.rm);
          if (idx > -1) sh.ids.splice(idx, 1);
          renderAssign();
          updateSummary();
        });
      });

      card.addEventListener("dragover", (e) => {
        e.preventDefault();
        card.classList.add("drop-hover");
      });
      card.addEventListener("dragleave", () => card.classList.remove("drop-hover"));
      card.addEventListener("drop", (e) => {
        e.preventDefault();
        card.classList.remove("drop-hover");
        const id = e.dataTransfer.getData("text/plain");
        if (!id) return;
        att.shifts.forEach((s) => {
          const k = s.ids.indexOf(id);
          if (k > -1) s.ids.splice(k, 1);
        });
        sh.ids.push(id);
        renderAssign();
        updateSummary();
      });

      wrap.appendChild(card);
    });

    /* keep the caret where the user was typing across a re-render */
    if (att.focusSearch > -1) {
      const back = $(`.assign-search input[data-shift="${att.focusSearch}"]`, wrap);
      if (back) {
        back.focus();
        const v = back.value;
        back.setSelectionRange(v.length, v.length);
      }
    }
  }

  function renderDays() {
    const row = $("#dayRow");
    if (!row) return;
    row.innerHTML = "";
    WEEKDAYS.forEach((d) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "day-toggle";
      btn.textContent = d.label;
      btn.setAttribute("aria-pressed", String(att.weekend.indexOf(d.day) > -1));
      btn.addEventListener("click", () => {
        const i = att.weekend.indexOf(d.day);
        if (i > -1) att.weekend.splice(i, 1);
        else att.weekend.push(d.day);
        renderDays();
        renderRangeTally();
        updateSummary();
      });
      row.appendChild(btn);
    });
  }

  function renderHolidays() {
    const wrap = $("#holidayWrap");
    if (!wrap) return;
    wrap.innerHTML = "";
    if (att.holidayMode === "none") return;

    const showGovt = att.holidayMode === "govt" || att.holidayMode === "govt_custom";
    const showCustom = att.holidayMode === "custom" || att.holidayMode === "govt_custom";

    if (showGovt) {
      const govt = govtHolidayList().filter((h) => att.govtRemoved.indexOf(h.date) === -1);
      const box = document.createElement("div");
      box.innerHTML = `
        <p class="sub-note">Taken from Shomvob HR — <strong>${govt.length}</strong> dates. Don't want one? Hit its ×.</p>
        <div class="preview-row">${govt
          .map(
            (h) =>
              `<span class="chip removable ${h.approx ? "approx" : ""}" title="${escapeHtml(h.name)}">${h.date}<button type="button" class="chip-x" data-govt="${h.date}" title="Remove">×</button></span>`
          )
          .join("")}</div>`;
      $all("button[data-govt]", box).forEach((b) => {
        b.addEventListener("click", () => {
          att.govtRemoved.push(b.dataset.govt);
          renderHolidays();
          renderRangeTally();
          updateSummary();
        });
      });
      wrap.appendChild(box);
    }

    if (showCustom) {
      const box = document.createElement("div");
      box.style.marginTop = showGovt ? "16px" : "14px";
      box.innerHTML = `
        <div class="field-grid-2">
          <div class="field">
            <label for="customHoliday">Custom holiday date</label>
            <input type="date" id="customHoliday" />
          </div>
          <div class="field" style="justify-content:flex-end">
            <button type="button" class="tiny-btn" id="addHolidayBtn">+ Add date</button>
          </div>
        </div>
        <div class="preview-row" id="customHolidayChips"></div>`;
      wrap.appendChild(box);

      const chips = $("#customHolidayChips", box);
      const paintChips = () => {
        chips.innerHTML = att.customHolidays
          .slice()
          .sort()
          .map((d) => `<span class="chip removable accent">${d}<button type="button" class="chip-x" data-ch="${d}" title="Remove">×</button></span>`)
          .join("");
        $all("button[data-ch]", chips).forEach((b) => {
          b.addEventListener("click", () => {
            const i = att.customHolidays.indexOf(b.dataset.ch);
            if (i > -1) att.customHolidays.splice(i, 1);
            paintChips();
            renderRangeTally();
            updateSummary();
          });
        });
      };
      $("#addHolidayBtn", box).addEventListener("click", () => {
        const v = $("#customHoliday", box).value;
        if (!v) return;
        if (att.customHolidays.indexOf(v) === -1) att.customHolidays.push(v);
        $("#customHoliday", box).value = "";
        paintChips();
        renderRangeTally();
        updateSummary();
      });
      paintChips();
    }
  }

  function renderOt() {
    const wrap = $("#otWrap");
    if (!wrap) return;
    wrap.innerHTML = att.otEnabled
      ? `<div class="field-grid-3">
           <div class="field"><label for="otWeekday">Max OT — weekday (hours)</label><input type="number" id="otWeekday" min="0" max="12" value="${att.otMax.weekday}" /></div>
           <div class="field"><label for="otWeekend">Max OT — weekend (hours)</label><input type="number" id="otWeekend" min="0" max="12" value="${att.otMax.weekend}" /></div>
           <div class="field"><label for="otHoliday">Max OT — holiday (hours)</label><input type="number" id="otHoliday" min="0" max="12" value="${att.otMax.holiday}" /></div>
         </div>
         <p class="sub-note">On a weekend or holiday the whole day is overtime — In at shift start, Out at <code>start + OT</code>.</p>`
      : `<p class="sub-note">No overtime — so weekends and holidays produce nothing at all.</p>`;

    if (att.otEnabled) {
      [["otWeekday", "weekday"], ["otWeekend", "weekend"], ["otHoliday", "holiday"]].forEach(([id, key]) => {
        $("#" + id).addEventListener("input", (e) => {
          att.otMax[key] = Math.max(0, parseInt(e.target.value, 10) || 0);
          updateSummary();
        });
      });
    }
    renderOtPct();
  }

  function renderOtPct() {
    const wrap = $("#otPctWrap");
    if (!wrap) return;
    if (!att.otEnabled) {
      wrap.innerHTML = "";
      return;
    }
    wrap.innerHTML = `
      <div class="field-grid-3">
        <div class="field"><label for="otPctWeekday">Overtime — weekday (%)</label><input type="number" id="otPctWeekday" min="0" max="100" value="${att.otPct.weekday}" /></div>
        <div class="field"><label for="otPctWeekend">Overtime — weekend (%)</label><input type="number" id="otPctWeekend" min="0" max="100" value="${att.otPct.weekend}" /></div>
        <div class="field"><label for="otPctHoliday">Overtime — holiday (%)</label><input type="number" id="otPctHoliday" min="0" max="100" value="${att.otPct.holiday}" /></div>
      </div>`;
    [["otPctWeekday", "weekday"], ["otPctWeekend", "weekend"], ["otPctHoliday", "holiday"]].forEach(([id, key]) => {
      $("#" + id).addEventListener("input", (e) => {
        att.otPct[key] = clampPct(e.target.value);
        updateSummary();
      });
    });
  }

  function clampPct(v) {
    const n = parseInt(v, 10);
    if (isNaN(n)) return 0;
    return Math.min(100, Math.max(0, n));
  }

  function wireAttendanceEvents() {
    /* Attendance owns the shift assignments, so its onChange prunes any
       that point at an ID the pool no longer contains. */
    bindIdSource(att, () => {
      const pool = new Set(att.ids);
      att.shifts.forEach((sh) => {
        sh.ids = sh.ids.filter((id) => pool.has(id));
      });
      renderAssign();
      updateSummary();
    });
    wireIdSourceSeg();

    $("#fromDate").addEventListener("input", (e) => {
      att.from = e.target.value;
      renderRangeTally();
      updateSummary();
    });
    $("#toDate").addEventListener("input", (e) => {
      att.to = e.target.value;
      renderRangeTally();
      updateSummary();
    });

    $("#shiftCount").addEventListener("input", (e) => {
      const n = Math.min(10, Math.max(1, parseInt(e.target.value, 10) || 1));
      att.shiftCount = n;
      syncShiftCount();
      renderShifts();
      renderAssign();
      updateSummary();
    });
    $("#graceInput").addEventListener("input", (e) => {
      att.grace = Math.max(0, parseInt(e.target.value, 10) || 0);
      updateSummary();
    });

    $all("#holidayChoices input[name=hmode]").forEach((r) => {
      r.addEventListener("change", () => {
        att.holidayMode = r.value;
        $all("#holidayChoices .choice").forEach((c) => c.classList.toggle("on", c.contains(r) && r.checked));
        renderHolidays();
        renderRangeTally();
        updateSummary();
      });
    });

    $all("#otSeg button").forEach((b) => {
      b.addEventListener("click", () => {
        att.otEnabled = b.dataset.ot === "yes";
        $all("#otSeg button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
        renderOt();
        updateSummary();
      });
    });

    $("#latePct").addEventListener("input", (e) => {
      att.latePct = clampPct(e.target.value);
      updateSummary();
    });
    $("#absentPct").addEventListener("input", (e) => {
      att.absentPct = clampPct(e.target.value);
      updateSummary();
    });

    $all("#fmtGrid button").forEach((b) => {
      b.addEventListener("click", () => {
        att.timeFormat = b.dataset.fmt;
        $all("#fmtGrid button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
        updateSummary();
      });
    });

    renderIdPanel();
    renderRangeTally();
    renderShifts();
    renderAssign();
    renderDays();
    renderHolidays();
    renderOt();
  }

  function attendanceProblems() {
    const out = [];
    if (!att.ids.length) out.push("needs employee IDs");
    const from = parseDateStr(att.from),
      to = parseDateStr(att.to);
    if (!from || !to) out.push("needs a date range");
    else if (from > to) out.push("From is after To");
    if (att.shifts.some((s) => parseHM(s.in) == null || parseHM(s.out) == null)) out.push("needs shift times");

    /* Same rule as a half-configured department: anything the user supplied
       has to be used, not quietly skipped. An ID left out of every shift
       used to vanish from the output without a word — paste 20, assign 3,
       get 3. If you don't want an ID in the file, take it off the list. */
    if (!singleShift() && att.ids.length) {
      const stranded = unassignedIds().length;
      if (stranded === att.ids.length) out.push("nobody is assigned to a shift yet");
      else if (stranded) {
        out.push(`${stranded} employee${stranded === 1 ? " is" : "s are"} not on any shift`);
      }
      const empty = att.shifts
        .map((sh, i) => (sh.ids.length ? null : i + 1))
        .filter((n) => n !== null);
      if (empty.length) {
        out.push(`shift ${listWords(empty.map(String))} ${empty.length === 1 ? "has" : "have"} nobody assigned`);
      }
    }

    if (att.weekend.length === 7) out.push("every day is a weekend — no working days left");
    else {
      /* A range that can't produce a single row used to pass the gate and
         fail on a toast after the click. Say it up front instead. */
      const counts = rangeDayCounts();
      if (counts && counts.days && !counts.usable) {
        out.push(
          counts.working === 0
            ? "every day in this range is a weekend or a holiday, and overtime is off"
            : "nothing in this range can produce a row"
        );
      }
    }
    return out;
  }

  function updateAttendanceSummary() {
    const problems = attendanceProblems();
    const summary = $("#actionSummary");
    const btn = $("#generateBtn");
    if (problems.length) {
      summary.textContent = problems[0];
      btn.disabled = true;
      return;
    }
    const assigned = singleShift() ? att.ids.length : assignedIdSet().size;
    let days = 0;
    eachDate(att.from, att.to, () => days++);
    summary.innerHTML = `<strong>${assigned}</strong> employees · <strong>${days}</strong> days · <strong>${att.shiftCount}</strong> shift · ${att.otEnabled ? "OT on" : "OT off"}`;
    btn.disabled = false;
  }

  function handleAttendanceGenerate() {
    const problems = attendanceProblems();
    if (problems.length) {
      showToast(problems[0], true);
      return;
    }
    try {
      const rows = generateAttendanceRows();
      if (rows.length < 2) {
        showToast("That produced no rows at all — check the percentages and the date range.", true);
        return;
      }
      const filename = downloadAttendanceWorkbook(rows);
      showToast(`${filename} — ${rows.length - 1} attendance rows 🎉`);
    } catch (err) {
      console.error(err);
      showToast("Couldn't generate the file. The console has the details.", true);
    }
  }

  /* ================= Leave Balance Add ================= */

  /* This operation inverts the other two. Nothing is invented: the user
     uploads the system's own export and every column except "Already Used
     Leave" is carried through untouched, row order included. Only that one
     column is filled, and only upward — leave already taken cannot shrink. */

  const leave = {
    fileName: "",
    sheetName: "",
    header: [],
    rows: [], /* raw rows, original order, original values */
    cols: null, /* { id, name, type, total, earned, used } → column indices */
    stats: null,
  };

  function roundHalf(v) {
    return Math.round(v / LEAVE_STEP) * LEAVE_STEP;
  }
  function floorHalf(v) {
    return Math.floor(v / LEAVE_STEP) * LEAVE_STEP;
  }
  function numOf(v) {
    if (typeof v === "number") return v;
    const n = parseFloat(String(v == null ? "" : v).replace(/,/g, ""));
    return isNaN(n) ? 0 : n;
  }

  /* Fraction of the calendar year elapsed. Drives how much leave looks
     plausibly used: a file made in January shows little, one made in
     October shows a lot. */
  function yearProgress(when) {
    const d = when || today;
    const start = new Date(d.getFullYear(), 0, 1);
    const end = new Date(d.getFullYear() + 1, 0, 1);
    return (d - start) / (end - start);
  }

  /* Largest half-step value strictly below Total + Earned, which is the
     bound the user specified: Already Used < Total Allocated + Earned. */
  function usedCeiling(total, earned) {
    const cap = numOf(total) + numOf(earned);
    if (!(cap > 0)) return 0;
    const c = floorHalf(cap - LEAVE_STEP);
    return c > 0 ? c : 0;
  }

  function findLeaveColumns(header) {
    const norm = header.map((h) => String(h == null ? "" : h).trim().toLowerCase());
    const cols = {};
    for (const key of Object.keys(LEAVE_COLUMNS)) {
      const idx = norm.indexOf(LEAVE_COLUMNS[key].toLowerCase());
      if (idx < 0) return null;
      cols[key] = idx;
    }
    return cols;
  }

  function leaveStats() {
    const { rows, cols } = leave;
    if (!cols) return null;
    const emps = new Set();
    const types = new Map();
    let withExisting = 0;
    rows.forEach((r) => {
      emps.add(String(r[cols.id]));
      const t = String(r[cols.type] == null ? "" : r[cols.type]).trim();
      if (t) types.set(t, (types.get(t) || 0) + 1);
      if (numOf(r[cols.used]) > 0) withExisting++;
    });
    return { rowCount: rows.length, employees: emps.size, types, withExisting };
  }

  /* ---------- generation ---------- */

  function generateLeaveRows() {
    const { rows, cols } = leave;
    const prog = yearProgress();
    const out = [leave.header.slice()];
    let filled = 0;
    let unchanged = 0;

    rows.forEach((r) => {
      const row = r.slice();
      const ceiling = usedCeiling(row[cols.total], row[cols.earned]);
      const existing = numOf(row[cols.used]);

      /* No headroom at all, or the row already sits at the ceiling — leave
         it exactly as it came in and count it. */
      if (ceiling <= 0 || existing >= ceiling) {
        unchanged++;
        out.push(row);
        return;
      }

      const expected = ceiling * prog;
      const band = LEAVE_BAND.low + Math.random() * (LEAVE_BAND.high - LEAVE_BAND.low);
      let v = roundHalf(expected * band);
      if (v < 0) v = 0;
      if (v > ceiling) v = ceiling;

      /* An update may only increase leave already taken. */
      if (existing > 0 && v <= existing) {
        const room = ceiling - existing;
        v = roundHalf(existing + LEAVE_STEP + Math.random() * Math.max(0, room - LEAVE_STEP));
        if (v <= existing) v = existing + LEAVE_STEP;
        if (v > ceiling) v = ceiling;
      }

      row[cols.used] = v;
      filled++;
      out.push(row);
    });

    return { rows: out, filled, unchanged, progress: prog };
  }

  function downloadLeaveWorkbook(rows) {
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const cols = leave.cols;

    /* keep the export's one-decimal presentation on the three numeric columns */
    for (let i = 1; i < rows.length; i++) {
      [cols.total, cols.earned, cols.used].forEach((c) => {
        const addr = XLSX.utils.encode_cell({ r: i, c: c });
        if (ws[addr] && ws[addr].t === "n") ws[addr].z = "#,##0.0";
      });
    }
    ws["!cols"] = [{ wch: 16 }, { wch: 22 }, { wch: 24 }, { wch: 19 }, { wch: 25 }, { wch: 22 }];
    ws["!freeze"] = { xSplit: 0, ySplit: 1 };

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, leave.sheetName || LEAVE_SHEET_FALLBACK);
    const filename = `leave_balance_already_used_update_${fmtDate(today)}.xlsx`;
    XLSX.writeFile(wb, filename);
    return filename;
  }

  /* ---------- UI ---------- */

  function leaveTemplate() {
    const prog = Math.round(yearProgress() * 100);
    return `
      <div class="page-head">
        <span class="page-eyebrow">Bulk operation · 03</span>
        <h1 class="page-title">Leave Balance Add</h1>
        <p class="page-desc">Upload the leave balance file the system exported. Employees, leave types and allocations all come from it — the only column being filled in is <strong>Already Used Leave</strong>.</p>
        <details class="rules-card">
          <summary class="rules-summary"><span>Fixed generation rules</span><span class="chev">›</span></summary>
          <div class="rules-body">
            <div class="rule-row"><span class="rule-col">Read from the file</span><span class="rule-val">Employee ID · Name · Leave Type · Total Allocated · Earned Leave</span></div>
            <div class="rule-row"><span class="rule-col">Filled in</span><span class="rule-val">Already Used Leave, and nothing else</span></div>
            <div class="rule-row"><span class="rule-col">Upper bound</span><span class="rule-val">Already Used &lt; Total Allocated + Earned Leave</span></div>
            <div class="rule-row"><span class="rule-col">Step</span><span class="rule-val">0.5 — half-day leave (4, 4.5, 5, 5.5 …)</span></div>
            <div class="rule-row"><span class="rule-col">Scaled to the date</span><span class="rule-val">${prog}% of the year gone — so ${Math.round(LEAVE_BAND.low * 100)}–${Math.round(LEAVE_BAND.high * 100)}% of ceiling × ${prog}%</span></div>
            <div class="rule-row"><span class="rule-col">Already has a value</span><span class="rule-val">the new one is larger — leave taken never shrinks</span></div>
            <div class="rule-row"><span class="rule-col">Row order</span><span class="rule-val">exactly as uploaded — no row is dropped</span></div>
          </div>
        </details>
      </div>

      <div class="section">
        <div class="section-head"><h2 class="section-title"><span class="section-num">1</span>Exported file</h2></div>
        <p class="section-note">Hand over the <code>leave_balance_already_used_update_*.xlsx</code> you downloaded from Shomvob.</p>
        <div class="field">
          <label for="leaveFile">Excel file</label>
          <input type="file" id="leaveFile" accept=".xlsx,.xlsm" />
          <span class="hint">${leave.fileName ? escapeHtml(leave.fileName) : "Needs its six columns — Employee ID, Employee Name, Leave Type Name, Total Allocated, Earned Leave, Already Used Leave"}</span>
        </div>
        <div id="leaveTally"></div>
        <div class="preview-row" id="leaveTypes"></div>
      </div>

      <div class="section">
        <div class="section-head"><h2 class="section-title"><span class="section-num">2</span>Preview</h2></div>
        <p class="section-note">See what lands where before you generate. Every run comes out different — it's random.</p>
        <div id="leavePreview"></div>
      </div>
    `;
  }

  function renderLeaveTally() {
    const box = $("#leaveTally");
    if (!box) return;
    const st = leave.stats;
    if (!st) {
      box.innerHTML = `<span class="tally">Upload the file</span>`;
      return;
    }
    const prog = Math.round(yearProgress() * 100);
    box.innerHTML =
      `<span class="tally ok"><strong>${st.rowCount}</strong> row · <strong>${st.employees}</strong> employee · <strong>${st.types.size}</strong> leave type</span>` +
      `<span class="tally" style="margin-left:8px">as of <strong>${fmtDate(today)}</strong> — <strong>${prog}%</strong> of the year gone</span>` +
      (st.withExisting
        ? `<span class="tally warn" style="margin-left:8px"><strong>${st.withExisting}</strong> rows already carry a value</span>`
        : "");
  }

  function renderLeaveTypes() {
    const box = $("#leaveTypes");
    if (!box) return;
    box.innerHTML = "";
    if (!leave.stats) return;
    Array.from(leave.stats.types.entries())
      .sort((a, b) => b[1] - a[1])
      .forEach(([name, n]) => {
        const chip = document.createElement("span");
        chip.className = "chip";
        chip.textContent = `${name} · ${n}`;
        box.appendChild(chip);
      });
  }

  function renderLeavePreview() {
    const box = $("#leavePreview");
    if (!box) return;
    if (!leave.cols || !leave.rows.length) {
      box.innerHTML = `<span class="tally">Upload a file and the preview shows up</span>`;
      return;
    }
    const { rows, filled, unchanged } = generateLeaveRows();
    const cols = leave.cols;
    const sample = rows.slice(1, 9);

    box.innerHTML = `
      <div class="preview-table-wrap">
        <table class="preview-table">
          <thead><tr>
            <th>Employee ID</th><th>Leave Type</th>
            <th class="num">Total</th><th class="num">Earned</th>
            <th class="num">Ceiling</th><th class="num">Already Used</th>
          </tr></thead>
          <tbody>
            ${sample
              .map((r) => {
                const ceiling = usedCeiling(r[cols.total], r[cols.earned]);
                return `<tr>
                  <td>${escapeHtml(String(r[cols.id]))}</td>
                  <td>${escapeHtml(String(r[cols.type]))}</td>
                  <td class="num">${numOf(r[cols.total]).toFixed(1)}</td>
                  <td class="num">${numOf(r[cols.earned]).toFixed(1)}</td>
                  <td class="num faint">&lt; ${(ceiling + LEAVE_STEP).toFixed(1)}</td>
                  <td class="num strong">${numOf(r[cols.used]).toFixed(1)}</td>
                </tr>`;
              })
              .join("")}
          </tbody>
        </table>
      </div>
      <span class="tally ok"><strong>${filled}</strong> rows will be filled</span>
      ${unchanged ? `<span class="tally warn" style="margin-left:8px"><strong>${unchanged}</strong> rows stay as they are — already at the ceiling</span>` : ""}`;
  }

  function handleLeaveFile(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const wb = XLSX.read(new Uint8Array(reader.result), { type: "array" });
        let found = null;
        for (const name of wb.SheetNames) {
          const aoa = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, blankrows: false });
          if (!aoa.length) continue;
          const cols = findLeaveColumns(aoa[0]);
          if (cols) {
            found = { name, header: aoa[0], rows: aoa.slice(1), cols };
            break;
          }
        }
        if (!found) {
          showToast("That file doesn't have the six leave balance columns.", true);
          return;
        }
        /* drop trailing blank rows the export sometimes carries */
        found.rows = found.rows.filter((r) =>
          r.some((c) => c != null && String(c).trim() !== "")
        );

        leave.fileName = file.name;
        leave.sheetName = found.name;
        leave.header = found.header;
        leave.rows = found.rows;
        leave.cols = found.cols;
        leave.stats = leaveStats();

        renderLeaveTally();
        renderLeaveTypes();
        renderLeavePreview();
        updateSummary();
        showToast(`${file.name} — read ${leave.rows.length} rows.`);
      } catch (err) {
        console.error(err);
        showToast("Couldn't read that file.", true);
      }
    };
    reader.onerror = () => showToast("Couldn't read that file.", true);
    reader.readAsArrayBuffer(file);
  }

  function wireLeaveEvents() {
    $("#leaveFile").addEventListener("change", handleLeaveFile);
    renderLeaveTally();
    renderLeaveTypes();
    renderLeavePreview();
  }

  function leaveProblems() {
    if (!leave.cols || !leave.rows.length) return ["upload the exported file"];
    return [];
  }

  function updateLeaveSummary() {
    const problems = leaveProblems();
    const summary = $("#actionSummary");
    const btn = $("#generateBtn");
    if (problems.length) {
      summary.textContent = problems[0];
      btn.disabled = true;
      return;
    }
    const st = leave.stats;
    summary.innerHTML = `<strong>${st.rowCount}</strong> row · <strong>${st.employees}</strong> employee · <strong>${st.types.size}</strong> leave type`;
    btn.disabled = false;
  }

  function handleLeaveGenerate() {
    const problems = leaveProblems();
    if (problems.length) {
      showToast(problems[0], true);
      return;
    }
    try {
      const result = generateLeaveRows();
      const filename = downloadLeaveWorkbook(result.rows);
      const tail = result.unchanged ? ` (${result.unchanged} left untouched)` : "";
      showToast(`${filename} — filled ${result.filled} rows${tail} 🎉`);
      renderLeavePreview();
    } catch (err) {
      console.error(err);
      showToast("Couldn't generate the file. The console has the details.", true);
    }
  }

  /* ================= Payroll Custom Field Value Add ================= */

  /* Like Leave Balance, this fills in the system's own export. The identity
     columns pass through untouched; every column after them is a custom
     addition or deduction the company configured, read from the header —
     names, signs and typos included. A cell that already carries a value is
     left alone, so re-running never undoes earlier work. */

  const payroll = {
    fileName: "",
    sheetName: "",
    header: [],
    rows: [],
    idCol: -1,
    nameCol: -1,
    fields: [], /* [{ index, label, name, sign }] */
    coverage: PAYROLL_DEFAULTS.coverage,
    min: PAYROLL_DEFAULTS.min,
    max: PAYROLL_DEFAULTS.max,
    step: PAYROLL_DEFAULTS.step,
  };

  function findPayrollColumns(header) {
    const norm = header.map((h) => String(h == null ? "" : h).trim().toLowerCase());
    const idCol = norm.indexOf(PAYROLL_COLUMNS.id.toLowerCase());
    const nameCol = norm.indexOf(PAYROLL_COLUMNS.name.toLowerCase());
    if (idCol < 0 || nameCol < 0) return null;

    const fields = [];
    header.forEach((h, i) => {
      if (i === idCol || i === nameCol) return;
      const label = String(h == null ? "" : h).trim();
      if (!label) return;
      const m = PAYROLL_SIGN_RE.exec(label);
      fields.push({
        index: i,
        label: label,
        name: m ? m[1] : label,
        sign: m ? m[2] : "",
      });
    });
    if (!fields.length) return null;
    return { idCol, nameCol, fields };
  }

  function payrollAmount() {
    const min = payroll.min;
    const max = payroll.max;
    const step = payroll.step > 0 ? payroll.step : 1;
    if (max <= min) return min;
    const steps = Math.floor((max - min) / step);
    return min + randInt(0, steps) * step;
  }

  function generatePayrollRows() {
    const out = [payroll.header.slice()];
    let filled = 0,
      kept = 0,
      untouchedEmployees = 0;

    payroll.rows.forEach((r) => {
      const row = r.slice();
      let touched = 0;
      payroll.fields.forEach((f) => {
        const existing = numOf(row[f.index]);
        if (existing !== 0) {
          /* the user asked that an existing value never be disturbed */
          kept++;
          touched++;
          return;
        }
        if (Math.random() * 100 < payroll.coverage) {
          row[f.index] = payrollAmount();
          filled++;
          touched++;
        } else {
          row[f.index] = 0;
        }
      });
      if (!touched) untouchedEmployees++;
      out.push(row);
    });

    return { rows: out, filled, kept, untouchedEmployees };
  }

  function downloadPayrollWorkbook(rows) {
    const ws = XLSX.utils.aoa_to_sheet(rows);
    /* the export leaves these as General-format plain numbers, so nothing
       to set per cell here — unlike Leave Balance's #,##0.0 */
    ws["!cols"] = [{ wch: 22 }, { wch: 22 }].concat(
      payroll.fields.map((f) => ({ wch: Math.max(14, Math.min(32, f.label.length + 2)) }))
    );
    ws["!freeze"] = { xSplit: 0, ySplit: 1 };

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, payroll.sheetName || "Custom Add-Deduct");
    /* reuse the uploaded file's own name: it carries a company code we have
       no way to derive */
    const filename = payroll.fileName || `custom-additions-deductions-${fmtDate(today)}.xlsx`;
    XLSX.writeFile(wb, filename);
    return filename;
  }

  /* ---------- UI ---------- */

  function payrollTemplate() {
    return `
      <div class="page-head">
        <span class="page-eyebrow">Bulk operation · 04</span>
        <h1 class="page-title">Payroll Custom Field Add</h1>
        <p class="page-desc">Upload the custom addition/deduction file the system exported. Employees and field names all come from it — only the amounts get filled in.</p>
        <details class="rules-card">
          <summary class="rules-summary"><span>Fixed generation rules</span><span class="chev">›</span></summary>
          <div class="rules-body">
            <div class="rule-row"><span class="rule-col">Read from the file</span><span class="rule-val">Employee ID · Employee Name · every custom field name</span></div>
            <div class="rule-row"><span class="rule-col">Filled in</span><span class="rule-val">the amounts, and nothing else</span></div>
            <div class="rule-row"><span class="rule-col">Sign</span><span class="rule-val">(+) and (-) draw from one range — the header already says which way, so values stay positive</span></div>
            <div class="rule-row"><span class="rule-col">Coverage</span><span class="rule-val">applied per cell, so some people come out entirely zero</span></div>
            <div class="rule-row"><span class="rule-col">Already has a value</span><span class="rule-val">left alone, untouched</span></div>
            <div class="rule-row"><span class="rule-col">Row order</span><span class="rule-val">exactly as uploaded</span></div>
          </div>
        </details>
      </div>

      <div class="section">
        <div class="section-head"><h2 class="section-title"><span class="section-num">1</span>Exported file</h2></div>
        <p class="section-note">Hand over the <code>custom-additions-deductions-*.xlsx</code> you downloaded from Shomvob.</p>
        <div class="field">
          <label for="payrollFile">Excel file</label>
          <input type="file" id="payrollFile" accept=".xlsx,.xlsm" />
          <span class="hint">${payroll.fileName ? escapeHtml(payroll.fileName) : "Needs an Employee ID and Employee Name column, then however many custom fields you have"}</span>
        </div>
        <div id="payrollTally"></div>
        <div class="preview-row" id="payrollFields"></div>
      </div>

      <div class="section">
        <div class="section-head"><h2 class="section-title"><span class="section-num">2</span>Coverage &amp; amount</h2></div>
        <p class="section-note">How many cells get an amount, and how big it is.</p>
        <div class="field-grid-2">
          <div class="field">
            <label for="payrollCoverage">Coverage</label>
            <select id="payrollCoverage">
              ${PAYROLL_COVERAGE_OPTIONS.map(
                (v) => `<option value="${v}" ${v === payroll.coverage ? "selected" : ""}>${v}%</option>`
              ).join("")}
            </select>
            <span class="hint">The chance for each cell — at 100% the whole grid fills</span>
          </div>
          <div class="field">
            <label for="payrollStep">Step</label>
            <input type="number" id="payrollStep" min="1" value="${payroll.step}" />
            <span class="hint">Amounts land on multiples of this</span>
          </div>
        </div>
        <div class="field-grid-2">
          <div class="field">
            <label for="payrollMin">Min amount</label>
            <input type="number" id="payrollMin" min="0" value="${payroll.min}" />
          </div>
          <div class="field">
            <label for="payrollMax">Max amount</label>
            <input type="number" id="payrollMax" min="0" value="${payroll.max}" />
            <span class="error-text" id="payrollRangeError"></span>
          </div>
        </div>
      </div>

      <div class="section">
        <div class="section-head"><h2 class="section-title"><span class="section-num">3</span>Preview</h2></div>
        <p class="section-note">Have a look before you generate. Every run comes out different — it's random.</p>
        <div id="payrollPreview"></div>
      </div>
    `;
  }

  function renderPayrollTally() {
    const box = $("#payrollTally");
    if (!box) return;
    if (!payroll.fields.length) {
      box.innerHTML = `<span class="tally">Upload the file</span>`;
      return;
    }
    const cells = payroll.rows.length * payroll.fields.length;
    const plus = payroll.fields.filter((f) => f.sign === "+").length;
    const minus = payroll.fields.filter((f) => f.sign === "-").length;
    box.innerHTML =
      `<span class="tally ok"><strong>${payroll.rows.length}</strong> employee · <strong>${payroll.fields.length}</strong> field · <strong>${cells}</strong> cell</span>` +
      `<span class="tally" style="margin-left:8px"><strong>${plus}</strong> addition · <strong>${minus}</strong> deduction</span>`;
  }

  function renderPayrollFields() {
    const box = $("#payrollFields");
    if (!box) return;
    box.innerHTML = "";
    payroll.fields.forEach((f) => {
      const chip = document.createElement("span");
      chip.className = "chip" + (f.sign === "+" ? " accent" : "");
      chip.textContent = f.label;
      box.appendChild(chip);
    });
  }

  function renderPayrollPreview() {
    const box = $("#payrollPreview");
    if (!box) return;
    if (!payroll.fields.length || !payroll.rows.length) {
      box.innerHTML = `<span class="tally">Upload a file and the preview shows up</span>`;
      return;
    }
    if (payrollProblems().length) {
      box.innerHTML = `<span class="tally warn">${payrollProblems()[0]}</span>`;
      return;
    }
    const result = generatePayrollRows();
    const sample = result.rows.slice(1, 9);
    const cells = payroll.rows.length * payroll.fields.length;

    box.innerHTML = `
      <div class="preview-table-wrap">
        <table class="preview-table">
          <thead><tr>
            <th>Employee ID</th>
            ${payroll.fields.map((f) => `<th class="num">${escapeHtml(f.name)} <span class="faint">(${f.sign || "?"})</span></th>`).join("")}
          </tr></thead>
          <tbody>
            ${sample
              .map(
                (r) => `<tr>
                  <td>${escapeHtml(String(r[payroll.idCol]))}</td>
                  ${payroll.fields
                    .map((f) => {
                      const v = numOf(r[f.index]);
                      return `<td class="num ${v ? "strong" : "faint"}">${v ? v.toLocaleString("en-US") : "0"}</td>`;
                    })
                    .join("")}
                </tr>`
              )
              .join("")}
          </tbody>
        </table>
      </div>
      <span class="tally ok"><strong>${result.filled}</strong> of ${cells} cells will be filled</span>
      ${result.kept ? `<span class="tally warn" style="margin-left:8px"><strong>${result.kept}</strong> cells already have a value — left alone</span>` : ""}
      ${result.untouchedEmployees ? `<span class="tally" style="margin-left:8px"><strong>${result.untouchedEmployees}</strong> people come out entirely zero</span>` : ""}`;
  }

  function handlePayrollFile(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const wb = XLSX.read(new Uint8Array(reader.result), { type: "array" });
        let found = null;
        for (const name of wb.SheetNames) {
          const aoa = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, blankrows: false });
          if (!aoa.length) continue;
          const cols = findPayrollColumns(aoa[0]);
          if (cols) {
            found = { name, header: aoa[0], rows: aoa.slice(1), cols };
            break;
          }
        }
        if (!found) {
          showToast("That file has no Employee ID / Name and custom field columns.", true);
          return;
        }
        found.rows = found.rows.filter((r) => r.some((c) => c != null && String(c).trim() !== ""));

        payroll.fileName = file.name;
        payroll.sheetName = found.name;
        payroll.header = found.header;
        payroll.rows = found.rows;
        payroll.idCol = found.cols.idCol;
        payroll.nameCol = found.cols.nameCol;
        payroll.fields = found.cols.fields;

        renderPayrollTally();
        renderPayrollFields();
        renderPayrollPreview();
        updateSummary();
        showToast(`${file.name} — ${payroll.rows.length} employees, ${payroll.fields.length} fields.`);
      } catch (err) {
        console.error(err);
        showToast("Couldn't read that file.", true);
      }
    };
    reader.onerror = () => showToast("Couldn't read that file.", true);
    reader.readAsArrayBuffer(file);
  }

  function wirePayrollEvents() {
    $("#payrollFile").addEventListener("change", handlePayrollFile);

    $("#payrollCoverage").addEventListener("change", (e) => {
      payroll.coverage = parseInt(e.target.value, 10) || 0;
      renderPayrollPreview();
      updateSummary();
    });
    const numFields = [
      ["#payrollMin", "min"],
      ["#payrollMax", "max"],
      ["#payrollStep", "step"],
    ];
    numFields.forEach(([sel, key]) => {
      $(sel).addEventListener("input", (e) => {
        payroll[key] = Math.max(key === "step" ? 1 : 0, parseInt(e.target.value, 10) || 0);
        validatePayrollRange();
        renderPayrollPreview();
        updateSummary();
      });
    });

    validatePayrollRange();
    renderPayrollTally();
    renderPayrollFields();
    renderPayrollPreview();
  }

  function validatePayrollRange() {
    const err = $("#payrollRangeError");
    const maxEl = $("#payrollMax");
    if (!err || !maxEl) return true;
    const ok = payroll.max >= payroll.min;
    err.textContent = ok ? "" : "Max can't be below min";
    maxEl.classList.toggle("invalid", !ok);
    return ok;
  }

  function payrollProblems() {
    if (!payroll.fields.length || !payroll.rows.length) return ["upload the exported file"];
    if (payroll.max < payroll.min) return ["max amount is below min"];
    if (!(payroll.step > 0)) return ["step has to be 1 or more"];
    return [];
  }

  function updatePayrollSummary() {
    const problems = payrollProblems();
    const summary = $("#actionSummary");
    const btn = $("#generateBtn");
    if (problems.length) {
      summary.textContent = problems[0];
      btn.disabled = true;
      return;
    }
    const cells = payroll.rows.length * payroll.fields.length;
    summary.innerHTML = `<strong>${payroll.rows.length}</strong> employee · <strong>${payroll.fields.length}</strong> field · <strong>${payroll.coverage}%</strong> of ${cells} cell`;
    btn.disabled = false;
  }

  function handlePayrollGenerate() {
    const problems = payrollProblems();
    if (problems.length) {
      showToast(problems[0], true);
      return;
    }
    try {
      const result = generatePayrollRows();
      const filename = downloadPayrollWorkbook(result.rows);
      const tail = result.kept ? `, ${result.kept} left untouched` : "";
      showToast(`${filename} — filled ${result.filled} cells${tail} 🎉`);
      renderPayrollPreview();
    } catch (err) {
      console.error(err);
      showToast("Couldn't generate the file. The console has the details.", true);
    }
  }

  /* ================= Dashboard ================= */

  /* The landing view, and the only screen written in English — every
     operation's own copy stays in Banglish. It is a joke at the visitor's
     expense, which is the point, but every number on it is real, pulled
     from the operations' own limits rather than invented for the gag. */

  function welcomeTemplate() {
    const seconds = WELCOME_BIGGEST_BATCH * WELCOME_SECONDS_PER_CELL;
    const hours = Math.floor(seconds / 3600);
    const mins = Math.round((seconds % 3600) / 60);

    const cards = OPERATIONS.filter((op) => op.status === "active")
      .map((op, i) => {
        const b = OPERATION_BLURBS[op.id] || { blurb: "", cost: "" };
        return `
          <button type="button" class="op-card" data-op="${op.id}">
            <span class="op-card-num">${String(i + 1).padStart(2, "0")}</span>
            <span class="op-card-body">
              <span class="op-card-title">${escapeHtml(op.label)}</span>
              <span class="op-card-blurb">${escapeHtml(b.blurb)}</span>
              <span class="op-card-cost">by hand: ${escapeHtml(b.cost)}</span>
            </span>
            <span class="op-card-go" aria-hidden="true">&rsaquo;</span>
          </button>`;
      })
      .join("");

    return `
      <div class="welcome-hero">
        <div class="welcome-intro">
          <span class="welcome-badge">Dear certified lazy</span>
          <h1 class="welcome-title">This one is for you.</h1>
          <p class="welcome-lede">
            Bulk Forge exists for people who cannot face typing out 300
            employees' worth of data by hand. Which is to say:
            <em>everyone</em>. QA needs test data, and nobody wants to spend
            an afternoon filling 4,200 cells to get some. So now you don't.
          </p>
          <div class="how-row">
            <span class="how-step"><b>1</b> Pick an operation</span>
            <span class="how-step"><b>2</b> Fill in a few fields</span>
            <span class="how-step"><b>3</b> Hit Generate. That's it.</span>
          </div>
        </div>

        <figure class="meme" aria-label="A spreadsheet being filled in by hand at two in the morning, with 4,197 cells left to go">
          <div class="meme-win">
            <div class="meme-bar">
              <span class="meme-dots" aria-hidden="true"><i></i><i></i><i></i></span>
              <span class="meme-file">employees_FINAL_v7_use_this.xlsx</span>
            </div>
            <table class="meme-sheet">
              <tr><th></th><th>A</th><th>B</th><th>C</th></tr>
              <tr><th>1</th><td class="hd">Emp ID</td><td class="hd">First Name</td><td class="hd">Phone</td></tr>
              <tr><th>2</th><td>JHTY0001</td><td>Rahim</td><td>8801712&hellip;</td></tr>
              <tr><th>3</th><td>JHTY0002</td><td>Karim</td><td>8801913&hellip;</td></tr>
              <tr><th>4</th><td>JHTY0003</td><td class="sel"><span class="caret"></span></td><td></td></tr>
            </table>
            <div class="meme-status">
              <span>4,197 cells to go</span>
              <span class="meme-time">2:14 AM &#128565;</span>
            </div>
          </div>
        </figure>
      </div>

      <div class="stat-row">
        <div class="stat-tile">
          <span class="stat-value">5</span>
          <span class="stat-label">operations, each matching a real Shomvob upload template</span>
        </div>
        <div class="stat-tile">
          <span class="stat-value">${WELCOME_BIGGEST_BATCH.toLocaleString("en-US")}</span>
          <span class="stat-label">cells in one 300-employee batch, none of which you will type</span>
        </div>
        <div class="stat-tile">
          <span class="stat-value">${hours}h ${mins}m</span>
          <span class="stat-label">that would take by hand, at five seconds a cell. Here it takes two</span>
        </div>
      </div>

      <div class="section">
        <div class="section-head"><h2 class="section-title"><span class="section-num">&middot;</span>What it can do</h2></div>
        <p class="section-note">Click any of them to jump straight in.</p>
        <div class="op-card-grid">${cards}</div>
      </div>

      <p class="welcome-foot">
        No backend, no database, nothing sent anywhere — the whole thing runs
        in your browser. The file is generated, it downloads, and that is the
        end of it. Your laziness remains entirely your own.
      </p>
    `;
  }

  function wireWelcomeEvents() {
    $all(".op-card").forEach((card) => {
      card.addEventListener("click", () => {
        currentOp = card.dataset.op;
        renderSidebar();
        renderMain();
      });
    });
  }

  /* Every operation shares the one action bar, so these dispatch on the
     operation currently on screen. */
  /* ================= Assets Add ================= */

  /* A blank template again, like Attendance — so this one builds rows from
     scratch. Employee IDs are optional here: the two assignment columns are
     optional in the template, so with no IDs supplied every asset simply
     comes out unassigned. */

  const assets = {
    count: 50,
    prefix: "AST",
    idSrc: newIdSourceState({ genPrefix: "HUIW", genCount: 50 }),
    customTypeCounter: 0,
  };

  /* Same card/checkbox/mode shape as Employee Add's departments, but
     pre-selected so the operation works without setup. */
  const assetTypes = DEFAULT_ASSET_TYPES.map((t) => ({
    id: t.id,
    name: t.name,
    isCustom: false,
    checked: true,
    mode: "default",
    selectedItems: new Set(t.items.map((it) => it[0])),
    customItems: [],
    defaultItems: t.items,
  }));

  /* Same split as departmentState(), for the same reason: a type that is
     ticked but has no name picked used to be dropped without a word. */
  function assetTypeState() {
    const final = [];
    const incomplete = [];
    for (const t of assetTypes) {
      const custom = t.customItems.map((n) => String(n).trim()).filter(Boolean).map((n) => [n, ""]);
      if (t.isCustom) {
        const name = t.name.trim();
        if (!name && !custom.length) continue;
        if (!name || !custom.length) {
          incomplete.push(name || "your new type");
          continue;
        }
        final.push({ name: name, items: custom });
      } else if (t.checked) {
        const items =
          t.mode === "default"
            ? t.defaultItems.filter((it) => t.selectedItems.has(it[0]))
            : custom;
        if (!items.length) {
          incomplete.push(t.name);
          continue;
        }
        final.push({ name: t.name, items: items });
      }
    }
    return { final: final, incomplete: incomplete };
  }

  function collectAssetTypes() {
    return assetTypeState().final;
  }

  /* Somewhere in the last year, never in the future. */
  function randomAssignedDate() {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    d.setDate(d.getDate() - randInt(0, ASSETS_ASSIGNED_WINDOW_DAYS));
    return d;
  }

  function generateAssetRows() {
    const types = collectAssetTypes();
    const ids = assets.idSrc.ids;
    const rows = [ASSETS_HEADER.slice()];
    /* one coverage figure for the whole batch, drawn from the band */
    const assignPct = randInt(ASSETS_ASSIGNED_BAND.low, ASSETS_ASSIGNED_BAND.high);
    let assigned = 0;

    for (let i = 0; i < assets.count; i++) {
      const type = choice(types);
      const item = choice(type.items);
      let empId = "";
      let date = "";
      if (ids.length && pctHit(assignPct)) {
        empId = choice(ids);
        date = fmtDate(randomAssignedDate());
        assigned++;
      }
      rows.push([
        "", /* Asset Image stays blank — a fake URL would only create a broken link */
        assets.prefix + pad4(i + 1),
        item[0],
        type.name,
        item[1] || "",
        empId,
        date,
      ]);
    }
    return { rows: rows, assigned: assigned, assignPct: assignPct };
  }

  function downloadAssetsWorkbook(rows) {
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [
      { wch: 28 }, { wch: 14 }, { wch: 26 }, { wch: 20 },
      { wch: 42 }, { wch: 20 }, { wch: 14 },
    ];
    ws["!freeze"] = { xSplit: 0, ySplit: 1 };
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, ASSETS_SHEET);
    const stamp = fmtDate(today).replace(/-/g, "");
    const filename = `${assets.prefix}_assets_bulk_upload_${stamp}.xlsx`;
    XLSX.writeFile(wb, filename);
    return filename;
  }

  /* ---------- UI ---------- */

  function assetsTemplate() {
    return `
      <div class="page-head">
        <span class="page-eyebrow">Bulk operation · 05</span>
        <h1 class="page-title">Assets Add</h1>
        <p class="page-desc">Generate a QA-ready asset bulk-upload file. Give it a count and a code prefix; types and names come from the list you set up below.</p>
        <details class="rules-card">
          <summary class="rules-summary"><span>Fixed generation rules</span><span class="chev">›</span></summary>
          <div class="rules-body">
            <div class="rule-row"><span class="rule-col">Asset Code</span><span class="rule-val">PREFIX0001 sequential — unique</span></div>
            <div class="rule-row"><span class="rule-col">Asset Name / Type</span><span class="rule-val">a type you picked, and a name from that type's own pool</span></div>
            <div class="rule-row"><span class="rule-col">Asset Description</span><span class="rule-val">paired with the name — blank for names you type yourself</span></div>
            <div class="rule-row"><span class="rule-col">Asset Image</span><span class="rule-val">left blank — a made-up URL would only be a broken link</span></div>
            <div class="rule-row"><span class="rule-col">Assignment</span><span class="rule-val">${ASSETS_ASSIGNED_BAND.low}–${ASSETS_ASSIGNED_BAND.high}% get an owner, the rest stay blank</span></div>
            <div class="rule-row"><span class="rule-col">Assigned Date</span><span class="rule-val">somewhere in the last year — never in the future</span></div>
          </div>
        </details>
      </div>

      <div class="section">
        <div class="section-head"><h2 class="section-title"><span class="section-num">1</span>Batch basics</h2></div>
        <p class="section-note">How many assets, and what their codes should start with.</p>
        <div class="field-row">
          <div class="field">
            <label for="assetCount">Number of assets</label>
            <input type="number" id="assetCount" min="1" max="5000" value="${assets.count}" />
            <span class="hint">1 to 5000</span>
            <span class="error-text" id="assetCountError"></span>
          </div>
          <div class="field">
            <label for="assetPrefix">Asset code prefix</label>
            <input type="text" id="assetPrefix" maxlength="6" value="${escapeHtml(assets.prefix)}" />
            <span class="hint">2–6 alphabetic characters — auto-uppercase</span>
            <span class="error-text" id="assetPrefixError"></span>
          </div>
        </div>
        <div class="preview-row" id="assetCodePreview"></div>
      </div>

      <div class="section">
        <div class="section-head"><h2 class="section-title"><span class="section-num">2</span>Asset type &amp; name</h2></div>
        <p class="section-note">Which kinds of asset to make, and which names in each. At least one name in one type is needed.</p>
        <div class="dept-list" id="assetTypeList"></div>
        <div class="add-dept-row">
          <button type="button" class="tiny-btn" id="addAssetTypeBtn">+ Add custom type</button>
        </div>
        <div class="validation-banner hidden" id="assetTypeWarning">${iconWarn()}<span id="assetTypeWarningText">Pick at least one asset name in at least one type.</span></div>
      </div>

      <div class="section">
        <div class="section-head"><h2 class="section-title"><span class="section-num">3</span>Assigned employee IDs</h2></div>
        <p class="section-note">Who gets the assets. Optional — with no IDs everything comes out unassigned, which the template allows.</p>
        ${idSourceMarkup(assets.idSrc)}
        <div id="assetAssignNote"></div>
      </div>
    `;
  }

  function renderAssetCodePreview() {
    const box = $("#assetCodePreview");
    if (!box) return;
    box.innerHTML = "";
    const prefix = /^[A-Z]{2,6}$/.test(assets.prefix) ? assets.prefix : "AST";
    const last = assets.count > 0 ? assets.count : 1;
    const show = last > 3 ? [1, 2, null, last] : [1, 2, 3].slice(0, last);
    show.forEach((n) => {
      const chip = document.createElement("span");
      chip.className = "chip accent";
      chip.textContent = n === null ? "…" : prefix + pad4(n);
      box.appendChild(chip);
    });
  }

  function renderAssetAssignNote() {
    const box = $("#assetAssignNote");
    if (!box) return;
    const n = assets.idSrc.ids.length;
    box.innerHTML = n
      ? `<span class="tally ok">${ASSETS_ASSIGNED_BAND.low}–${ASSETS_ASSIGNED_BAND.high}% of them shared among <strong>${n}</strong> people</span>`
      : `<span class="tally">No IDs — everything comes out unassigned</span>`;
  }

  function validateAssetCount() {
    const el = $("#assetCount");
    const err = $("#assetCountError");
    if (!el) return true;
    const ok = assets.count >= 1 && assets.count <= 5000;
    err.textContent = ok ? "" : "Somewhere between 1 and 5000";
    el.classList.toggle("invalid", !ok);
    return ok;
  }

  function validateAssetPrefix() {
    const el = $("#assetPrefix");
    const err = $("#assetPrefixError");
    if (!el) return true;
    const ok = /^[A-Z]{2,6}$/.test(assets.prefix);
    err.textContent = ok ? "" : "2 to 6 letters";
    el.classList.toggle("invalid", !ok);
    return ok;
  }

  /* Mirrors Employee Add's department cards — same classes, same
     default/custom mode toggle — so the two operations look alike. */
  function renderAssetTypes() {
    const list = $("#assetTypeList");
    if (!list) return;
    list.innerHTML = "";

    assetTypes.forEach((t) => {
      const card = document.createElement("div");
      card.className = "dept-card" + (t.checked || t.isCustom ? " checked" : "");
      const head = document.createElement("div");
      head.className = "dept-head";

      if (!t.isCustom) {
        head.innerHTML = `
          <input type="checkbox" ${t.checked ? "checked" : ""} class="dept-checkbox" />
          <span class="dept-name">${escapeHtml(t.name)}</span>`;
        card.appendChild(head);
        $(".dept-checkbox", head).addEventListener("change", (e) => {
          t.checked = e.target.checked;
          renderAssetTypes();
          updateSummary();
        });
        if (t.checked) card.appendChild(assetTypeBody(t));
      } else {
        head.innerHTML = `
          <input class="dept-name-input" type="text" placeholder="Asset type name" value="${escapeHtml(t.name)}" />
          <button type="button" class="dept-remove" title="Remove">${iconTrash()}</button>`;
        card.appendChild(head);
        $(".dept-name-input", head).addEventListener("input", (e) => {
          t.name = e.target.value;
          updateSummary();
        });
        $(".dept-remove", head).addEventListener("click", () => {
          const i = assetTypes.indexOf(t);
          if (i > -1) assetTypes.splice(i, 1);
          renderAssetTypes();
          updateSummary();
        });
        card.appendChild(assetTypeBody(t));
      }
      list.appendChild(card);
    });
  }

  function assetTypeBody(t) {
    const body = document.createElement("div");
    body.className = "dept-body";

    if (!t.isCustom) {
      const toggle = document.createElement("div");
      toggle.className = "mode-toggle";
      toggle.innerHTML = `
        <button type="button" data-mode="default" aria-pressed="${t.mode === "default"}">Default</button>
        <button type="button" data-mode="custom" aria-pressed="${t.mode === "custom"}">Custom</button>`;
      $all("button", toggle).forEach((btn) => {
        btn.addEventListener("click", () => {
          t.mode = btn.dataset.mode;
          renderAssetTypes();
          updateSummary();
        });
      });
      body.appendChild(toggle);

      if (t.mode === "default") {
        const grid = document.createElement("div");
        grid.className = "desig-grid";
        t.defaultItems.forEach((it) => {
          const on = t.selectedItems.has(it[0]);
          const label = document.createElement("label");
          label.className = "desig-check" + (on ? " on" : "");
          label.title = it[1] || "";
          label.innerHTML = `<input type="checkbox" ${on ? "checked" : ""} /> ${escapeHtml(it[0])}`;
          $("input", label).addEventListener("change", (e) => {
            if (e.target.checked) t.selectedItems.add(it[0]);
            else t.selectedItems.delete(it[0]);
            renderAssetTypes();
            updateSummary();
          });
          grid.appendChild(label);
        });
        body.appendChild(grid);
        return body;
      }
    }

    const wrap = document.createElement("div");
    wrap.className = "custom-desig-list";
    t.customItems.forEach((val, i) => {
      const row = document.createElement("div");
      row.className = "custom-desig-row";
      row.innerHTML = `<input type="text" value="${escapeHtml(val)}" placeholder="Asset name" />
        <button type="button" class="icon-btn" title="Remove">${iconTrash()}</button>`;
      $("input", row).addEventListener("input", (e) => {
        t.customItems[i] = e.target.value;
        updateSummary();
      });
      $("button", row).addEventListener("click", () => {
        t.customItems.splice(i, 1);
        renderAssetTypes();
        updateSummary();
      });
      wrap.appendChild(row);
    });
    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "tiny-btn";
    addBtn.innerHTML = `${iconPlus()} Add asset name`;
    addBtn.style.marginTop = t.customItems.length ? "7px" : "0";
    addBtn.addEventListener("click", () => {
      t.customItems.push("");
      renderAssetTypes();
    });
    wrap.appendChild(addBtn);
    body.appendChild(wrap);
    return body;
  }

  function wireAssetsEvents() {
    $("#assetCount").addEventListener("input", (e) => {
      assets.count = parseInt(e.target.value, 10) || 0;
      validateAssetCount();
      renderAssetCodePreview();
      updateSummary();
    });
    $("#assetPrefix").addEventListener("input", (e) => {
      e.target.value = e.target.value.toUpperCase().replace(/[^A-Z]/g, "");
      assets.prefix = e.target.value;
      validateAssetPrefix();
      renderAssetCodePreview();
      updateSummary();
    });

    $("#addAssetTypeBtn").addEventListener("click", () => {
      assets.customTypeCounter++;
      assetTypes.push({
        id: "custom_type_" + assets.customTypeCounter,
        name: "",
        isCustom: true,
        checked: true,
        mode: "custom",
        selectedItems: new Set(),
        customItems: [],
        defaultItems: [],
      });
      renderAssetTypes();
      updateSummary();
    });

    bindIdSource(assets.idSrc, () => {
      renderAssetAssignNote();
      updateSummary();
    });
    wireIdSourceSeg();

    validateAssetCount();
    validateAssetPrefix();
    renderAssetCodePreview();
    renderAssetTypes();
    renderIdPanel();
    renderAssetAssignNote();
  }

  function assetsProblems() {
    const out = [];
    if (!(assets.count >= 1 && assets.count <= 5000)) out.push("asset count has to be 1–5000");
    if (!/^[A-Z]{2,6}$/.test(assets.prefix)) out.push("asset code prefix has to be 2–6 letters");
    const types = assetTypeState();
    if (types.incomplete.length) {
      out.push(`${listWords(types.incomplete)} ${types.incomplete.length === 1 ? "has" : "have"} no asset name picked`);
    } else if (!types.final.length) {
      out.push("needs at least one asset name in one type");
    }
    return out;
  }

  function updateAssetsSummary() {
    const state = assetTypeState();
    const types = state.final;
    const warn = $("#assetTypeWarning");
    const typesOk = types.length > 0 && state.incomplete.length === 0;
    if (warn) {
      warn.classList.toggle("hidden", typesOk);
      if (!typesOk) {
        $("#assetTypeWarningText").textContent = state.incomplete.length
          ? `${listWords(state.incomplete)} ${state.incomplete.length === 1 ? "has" : "have"} no asset name picked.`
          : "Pick at least one asset name in at least one type.";
      }
    }

    const problems = assetsProblems();
    const summary = $("#actionSummary");
    const btn = $("#generateBtn");
    if (problems.length) {
      summary.textContent = problems[0];
      btn.disabled = true;
      return;
    }
    const names = types.reduce((n, t) => n + t.items.length, 0);
    const ids = assets.idSrc.ids.length;
    summary.innerHTML = `<strong>${assets.count}</strong> assets · prefix <strong>${assets.prefix}</strong> · <strong>${types.length}</strong> type / <strong>${names}</strong> name · ${
      ids ? `<strong>${ids}</strong> employee` : "unassigned"
    }`;
    btn.disabled = false;
  }

  function handleAssetsGenerate() {
    const problems = assetsProblems();
    if (problems.length) {
      showToast(problems[0], true);
      return;
    }
    try {
      const result = generateAssetRows();
      const filename = downloadAssetsWorkbook(result.rows);
      const tail = assets.idSrc.ids.length
        ? ` — ${result.assigned} assigned (${result.assignPct}%)`
        : " — all unassigned";
      showToast(`${filename} — ${assets.count} assets${tail} 🎉`);
    } catch (err) {
      console.error(err);
      showToast("Couldn't generate the file. The console has the details.", true);
    }
  }

  function updateSummary() {
    if (currentOp === "attendance_add") return updateAttendanceSummary();
    if (currentOp === "leave_balance_add") return updateLeaveSummary();
    if (currentOp === "payroll_field_add") return updatePayrollSummary();
    if (currentOp === "assets_add") return updateAssetsSummary();
    return updateEmployeeSummary();
  }

  function handleGenerate() {
    if (currentOp === "attendance_add") return handleAttendanceGenerate();
    if (currentOp === "leave_balance_add") return handleLeaveGenerate();
    if (currentOp === "payroll_field_add") return handlePayrollGenerate();
    if (currentOp === "assets_add") return handleAssetsGenerate();
    return handleEmployeeGenerate();
  }

  /* ================= Company Setup (phase 2) ================= */

  /* Two logins, never one, and they are not the same kind of thing.

     The first — "the tool" below — gates the whole section before any
     real credential is ever asked for. It is Bulk Forge's own sign-in,
     checked against Supabase Auth, and it also fixes which environment
     the rest of this section talks to. Sign-up is switched off on that
     project, so passing this gate really means "someone added your email
     in the Supabase dashboard," nothing this file decides on its own.

     The second — "the company" — is the real Shomvob company-admin login,
     checked by the actual dev or staging server, and it is what decides
     what the rest of this section can actually do. There is no separate
     permission model layered on top of it: whatever that account can do
     through the real HRIS is exactly what this page can do on its
     behalf, no more.

     Neither token is ever written to storage. Both live only in this
     object, so a reload clears them exactly like every pasted ID list
     and shift assignment elsewhere in the app. */
  const setup = {
    toolEmail: null,
    toolToken: null, // Supabase access token
    env: "staging", // "dev" | "staging" — picked alongside the tool login, then fixed
    companyToken: null,
    companyRefresh: null,
    companyName: null,
    companyUserType: null,
    busy: false,
    activeGroup: null, // a SETTINGS_GROUPS id, or null to show the group grid
    activeModule: null, // a module id within activeGroup's tab strip
    doneModules: new Set(), // module ids saved for real this session — resets on sign-out/reload like everything else here
  };

  /* Reload used to wipe both logins unconditionally — flagged as a real
     workflow cost (2026-09-10), fixed that same day by persisting both
     tokens to sessionStorage. Reverted the same day, on further
     reflection: this is the one part of the app that writes into a real
     company, and the joke gate in front of it is exactly that, a joke —
     one click, credentials printed on the card. If the two *real* logins
     survive a reload too, the whole security boundary of this section
     quietly becomes "is the tab still open," which is not a boundary
     Bulk Forge should be deciding on the user's behalf. Both logins are
     back to living only in memory, gone on any reload, on purpose, same
     as before sessionStorage was ever added here.

     What's kept, deliberately, in a *separate*, token-free key: which
     company/environment was last connected and which modules were
     actually saved there. Restoring that isn't restoring access — it's
     answering "what did I already do" for whoever signs back in next,
     which is a real, separate problem (raised 2026-09-10 right after the
     token-persistence idea was reverted): someone who got disconnected
     by a reload, a crash, or just closing the wrong thing has no way to
     know which of a batch of real writes already landed. */
  const SETUP_LAST_SESSION_KEY = "bulkforge-setup-last-session";
  function loadLastSetupSession() {
    try {
      const raw = sessionStorage.getItem(SETUP_LAST_SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }
  function saveLastSetupSession() {
    try {
      if (!setup.companyToken) return;
      sessionStorage.setItem(
        SETUP_LAST_SESSION_KEY,
        JSON.stringify({ companyName: setup.companyName, env: setup.env, doneModules: Array.from(setup.doneModules) })
      );
    } catch (e) {
      /* a locked-down browser throws rather than persisting — fine, this just means no "welcome back" next time */
    }
  }
  function clearLastSetupSession() {
    try {
      sessionStorage.removeItem(SETUP_LAST_SESSION_KEY);
    } catch (e) {
      /* nothing to do — it wasn't going to be read again anyway */
    }
  }

  function iconCheck() {
    return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0"><path d="M20 6 9 17l-5-5"/></svg>`;
  }

  function iconSpinner() {
    return `<svg class="spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" style="flex-shrink:0"><path d="M12 3a9 9 0 1 0 9 9"/></svg>`;
  }

  /* Every button in Company Setup that makes a real network call goes
     through this pair — a spinner plus one of BUSY_MESSAGES, so a real
     wait always gets a moment of the app's own voice instead of a bare
     disabled button. The idle label is stashed on the element itself, so
     clearBtnBusy needs nothing passed back in — whichever branch called
     setBtnBusy is the only thing that has to remember to call it back. */
  function setBtnBusy(btn) {
    if (btn.dataset.idleHtml == null) btn.dataset.idleHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `${iconSpinner()}<span>${choice(BUSY_MESSAGES)}</span>`;
  }
  function clearBtnBusy(btn) {
    btn.disabled = false;
    if (btn.dataset.idleHtml != null) btn.innerHTML = btn.dataset.idleHtml;
    delete btn.dataset.idleHtml;
  }

  /* `open` is a bool: the eye when the password is hidden (click to
     reveal), the slashed eye once it's shown (click to hide again) — the
     icon always names the action a click will take, not the current
     state, matching how every other icon-only control in this app reads. */
  function iconEye(open) {
    if (open) {
      return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z"/><circle cx="12" cy="12" r="3"/></svg>`;
    }
    return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M9.9 4.24A10.9 10.9 0 0 1 12 4c7 0 11 7 11 7a18.4 18.4 0 0 1-2.35 3.35M6.5 6.65C3.6 8.4 1 12 1 12s4 7 11 7a10.9 10.9 0 0 0 5.3-1.4M14.1 14.1a3 3 0 1 1-4.2-4.2"/><path d="M1 1l22 22"/></svg>`;
  }

  /* A password field with a show/hide toggle — used for Company Setup's
     two password inputs, both of which sit in front of a real login and
     are worth being able to double-check before submitting, unlike the
     joke gate's password, which is already printed on the card in plain
     text. */
  function pwFieldMarkup(id, label) {
    return `
      <div class="field">
        <label for="${id}">${label}</label>
        <div class="pw-wrap">
          <input type="password" id="${id}" autocomplete="off" />
          <button type="button" class="pw-toggle" data-target="${id}" aria-label="Show password" title="Show password">${iconEye(true)}</button>
        </div>
      </div>
    `;
  }

  function wirePasswordToggles(root) {
    $all(".pw-toggle", root).forEach((btn) => {
      btn.addEventListener("click", () => {
        const input = $("#" + btn.dataset.target);
        const willShow = input.type === "password";
        input.type = willShow ? "text" : "password";
        btn.innerHTML = iconEye(!willShow);
        const label = willShow ? "Hide password" : "Show password";
        btn.setAttribute("aria-label", label);
        btn.title = label;
      });
    });
  }

  /* Supabase's password grant. Supabase's Auth service sends its own CORS
     headers for every project, so — unlike the company login below —
     this one needs nothing from anyone else to work from a Vercel origin. */
  async function supabaseSignIn(email, password) {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error_description || data.msg || "Wrong email or password.");
    }
    return data;
  }

  /* The real Shomvob login, against whichever of the two fixed hosts was
     picked in step one — never a third, and never a typed-in URL. */
  async function companySignIn(envId, identifier, password) {
    const env = ENVIRONMENTS[envId];
    let res;
    try {
      res = await fetch(`${env.apiBase}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      });
    } catch (err) {
      /* fetch throws the same generic error for "offline" and "the server
         refused this origin," with no way to tell them apart from here.
         CORS is the likelier story for a server that answers Postman fine,
         so say that rather than a bare "network error". */
      throw new Error(
        `Couldn't reach ${env.label}. If this is the first attempt since setting this up, its CORS allowance may not be live yet.`
      );
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || "Wrong email or password.");
    }
    return data.data;
  }

  function companySetupTemplate() {
    return `
      <div id="setupPageHead">${setupPageHeadHtml()}</div>
      <div id="setupStatusBar"></div>
      <div id="setupBody"></div>
    `;
  }

  /* The eyebrow/title/instructional paragraph only earn their place
     before anyone has signed in — once connected, "Sign in here first,
     then sign in again..." is stale instructions for a step already
     done, and it was sitting above the statusbar (which already says
     exactly who's connected to what) every single screen past login.
     Re-rendered alongside the statusbar in renderSetupBody() so it
     reacts immediately to sign-in/sign-out without a page navigation. */
  function setupPageHeadHtml() {
    if (setup.toolToken) return "";
    return `
      <div class="page-head">
        <span class="page-eyebrow">Phase 2 · Setup</span>
        <h1 class="page-title">Company Setup</h1>
        <p class="page-desc">Sign in here first, then sign in again as the company you want to configure. The rest of this section does nothing until both have happened.</p>
      </div>
    `;
  }

  /* A persistent strip once step one is done, living outside #setupBody
     so it stays on screen through every step past the first — including
     every group and module page, not just the group grid — so "which
     company/server am I about to touch" is never something you have to
     navigate back to check.

     Two shapes, and only two: before a company is connected, a plain
     line (environment + tool email + Sign out) — there's nothing to
     confirm yet. Once connected, the fuller "Connected" banner takes
     over entirely (env/company/role as a row list, Disconnect next to
     Sign out). These used to be two separate, simultaneously-visible
     things — this one-line strip *and* a second "Connected" banner
     repeating the same facts at the top of the group grid specifically.
     Merged into one on user feedback (2026-09-10): the grid's own copy
     was pure duplication of what this strip already said, and asking
     for the reminder to persist past the grid (into every module page)
     is what the strip was already built to do — it just didn't yet
     carry the fuller, connected-state content. */
  function setupStatusBarHtml() {
    if (!setup.toolToken) return "";
    const env = ENVIRONMENTS[setup.env];
    if (!setup.companyToken) {
      return `
        <div class="setup-statusbar">
          <span class="env-badge env-${env.id}">${env.label}</span>
          <span class="setup-statusbar-spacer"></span>
          <span class="setup-email">${setup.toolEmail}</span>
          <button type="button" class="tiny-btn" id="setupSignOutBtn">Sign out</button>
        </div>
      `;
    }
    return `
      <div class="setup-connected-banner">
        <div class="section-head"><h2 class="section-title">${iconCheck()}Connected</h2></div>
        <div class="rules-body" style="border-top:none; padding:0; margin-top:10px;">
          <div class="rule-row"><span class="rule-col">Company</span><span class="rule-val">${setup.companyName}</span></div>
          <div class="rule-row"><span class="rule-col">Environment</span><span class="rule-val">${env.label}</span></div>
          <div class="rule-row"><span class="rule-col">Role</span><span class="rule-val">${setup.companyUserType || "unknown type"}</span></div>
        </div>
        <div class="setup-connected-actions">
          <button type="button" class="disconnect-btn" id="setupDisconnectBtn">Disconnect this company</button>
          <button type="button" class="tiny-btn" id="setupSignOutBtn">Sign out</button>
        </div>
      </div>
    `;
  }

  function renderSetupBody() {
    saveLastSetupSession();
    $("#setupPageHead").innerHTML = setupPageHeadHtml();
    $("#setupStatusBar").innerHTML = setupStatusBarHtml();
    const signOutBtn = $("#setupSignOutBtn");
    if (signOutBtn) {
      signOutBtn.addEventListener("click", () => {
        setup.toolEmail = null;
        setup.toolToken = null;
        setup.companyToken = null;
        setup.companyRefresh = null;
        setup.companyName = null;
        setup.companyUserType = null;
        setup.activeGroup = null;
        setup.activeModule = null;
        setup.doneModules = new Set();
        resetModuleState();
        clearLastSetupSession();
        renderSetupBody();
      });
    }
    /* Lives in the persistent strip now, alongside Sign out, rather than
       only in the group grid's own body — see setupStatusBarHtml(). */
    const disconnectBtn = $("#setupDisconnectBtn");
    if (disconnectBtn) {
      disconnectBtn.addEventListener("click", () => {
        setup.companyToken = null;
        setup.companyRefresh = null;
        setup.companyName = null;
        setup.companyUserType = null;
        setup.activeGroup = null;
        setup.activeModule = null;
        setup.doneModules = new Set();
        resetModuleState();
        clearLastSetupSession();
        renderSetupBody();
      });
    }

    const box = $("#setupBody");
    if (!setup.toolToken) {
      box.innerHTML = setupSignInTemplate();
      wireSetupSignIn();
      return;
    }
    if (!setup.companyToken) {
      box.innerHTML = setupCompanyLoginTemplate();
      wireSetupCompanyLogin();
      return;
    }
    if (!setup.activeGroup) {
      box.innerHTML = setupConnectedTemplate();
      wireSetupConnected();
      return;
    }
    box.innerHTML = setupGroupPageTemplate();
    wireSetupGroupPage();
  }

  function setupSignInTemplate() {
    const last = loadLastSetupSession();
    const lastSessionNotice = last
      ? `
        <div class="validation-banner" style="margin-top:0; margin-bottom:16px;">
          ${iconWarn()}
          <div>You were connected to <strong>${last.companyName}</strong> on ${ENVIRONMENTS[last.env] ? ENVIRONMENTS[last.env].label : last.env} before this reload — both logins are required again on purpose, every time. Sign back in with the same company to pick up where you left off.</div>
        </div>
      `
      : "";
    return `
      ${lastSessionNotice}
      <div class="section">
        <div class="section-head"><h2 class="section-title"><span class="section-num">1</span>Sign in to Bulk Forge</h2></div>
        <p class="section-note">Your own Bulk Forge account — separate from your Shomvob login, and separate again from the company you'll sign into next.</p>
        <div class="field-row">
          <div class="field">
            <label for="setupEmail">Email</label>
            <input type="email" id="setupEmail" autocomplete="off" spellcheck="false" />
          </div>
          ${pwFieldMarkup("setupPass", "Password")}
        </div>
        <div class="field" style="margin-top:14px">
          <label>Environment</label>
          <div class="seg" id="setupEnvSeg" role="group" aria-label="Environment">
            <button type="button" data-env="dev" aria-pressed="${setup.env === "dev"}">Dev</button>
            <button type="button" data-env="staging" aria-pressed="${setup.env === "staging"}">Staging</button>
          </div>
          <span class="hint">Everything past this point runs against this server for the rest of this session. There's no third option, and no field to type a URL into — on purpose.</span>
        </div>
        <div class="setup-actions">
          <span class="error-text" id="setupError"></span>
          <button type="button" class="generate-btn" id="setupSignInBtn">Sign in</button>
        </div>
      </div>
    `;
  }

  function wireSetupSignIn() {
    wirePasswordToggles($("#setupBody"));

    const seg = $("#setupEnvSeg");
    $all("button", seg).forEach((btn) => {
      btn.addEventListener("click", () => {
        setup.env = btn.dataset.env;
        $all("button", seg).forEach((b) => b.setAttribute("aria-pressed", String(b === btn)));
      });
    });

    const btn = $("#setupSignInBtn");
    const err = $("#setupError");
    btn.addEventListener("click", async () => {
      const email = $("#setupEmail").value.trim();
      const pass = $("#setupPass").value;
      err.textContent = "";
      if (!email || !pass) {
        err.textContent = "Both fields are needed.";
        return;
      }
      setBtnBusy(btn);
      try {
        const data = await supabaseSignIn(email, pass);
        setup.toolEmail = email;
        setup.toolToken = data.access_token;
        renderSetupBody();
      } catch (e) {
        err.textContent = e.message;
        clearBtnBusy(btn);
      }
    });
  }

  function setupCompanyLoginTemplate() {
    const env = ENVIRONMENTS[setup.env];
    return `
      <div class="section">
        <div class="section-head"><h2 class="section-title"><span class="section-num">2</span>Sign in as the company</h2></div>
        <p class="section-note">The company-admin login for the ${env.label} company you want to configure. This is checked by the real Shomvob ${env.label} server, and it decides everything past this point.</p>
        <div class="field-row">
          <div class="field">
            <label for="setupCoEmail">Email</label>
            <input type="email" id="setupCoEmail" autocomplete="off" spellcheck="false" />
          </div>
          ${pwFieldMarkup("setupCoPass", "Password")}
        </div>
        <div class="setup-actions">
          <span class="error-text" id="setupCoError"></span>
          <button type="button" class="generate-btn" id="setupCoBtn">Continue</button>
        </div>
      </div>
    `;
  }

  function wireSetupCompanyLogin() {
    wirePasswordToggles($("#setupBody"));

    const btn = $("#setupCoBtn");
    const err = $("#setupCoError");
    btn.addEventListener("click", async () => {
      const identifier = $("#setupCoEmail").value.trim();
      const pass = $("#setupCoPass").value;
      err.textContent = "";
      if (!identifier || !pass) {
        err.textContent = "Both fields are needed.";
        return;
      }
      setBtnBusy(btn);
      try {
        const data = await companySignIn(setup.env, identifier, pass);
        setup.companyToken = data.accessToken;
        setup.companyRefresh = data.refreshToken;
        setup.companyName = data.user.companyName;
        setup.companyUserType = data.user.type;
        /* Reconnecting to the exact same company on the exact same
           environment — not a different one — picks up where a reload or
           a Sign out left off: the done-dots reappear so a real batch of
           writes doesn't quietly lose its own progress indicator, even
           though re-authenticating for real is still required every time. */
        const last = loadLastSetupSession();
        if (last && last.companyName === setup.companyName && last.env === setup.env) {
          setup.doneModules = new Set(last.doneModules);
        }
        renderSetupBody();
      } catch (e) {
        err.textContent = e.message;
        clearBtnBusy(btn);
      }
    });
  }

  /* How many of a group's modules were actually saved this session — not
     persisted, same as everything else in this section, so it resets to
     0/N on reload, sign-out or disconnecting the company. */
  function groupDoneCount(group) {
    return group.modules.filter((m) => setup.doneModules.has(m.id)).length;
  }

  /* The "Connected" banner used to live here, at the top of the group
     grid specifically — moved into the persistent strip
     (setupStatusBarHtml()) on user feedback (2026-09-10), since a second
     copy of the same three facts sitting directly under the first one
     was pure duplication, and the whole point of asking for a persistent
     reminder is that it follows you into a module page, not just the
     grid. This template is now just the hint line and the cards. */
  function setupConnectedTemplate() {
    const cards = SETTINGS_GROUPS.map((g) => {
      const done = groupDoneCount(g);
      const all = done === g.modules.length;
      const dots = g.modules
        .map((m) => {
          const isDone = setup.doneModules.has(m.id);
          return `<span class="settings-card-dot${isDone ? " done" : ""}" title="${m.label}${isDone ? " — done" : ""}"></span>`;
        })
        .join("");
      return `
        <button type="button" class="settings-card" data-group="${g.id}">
          <div class="settings-card-icon">${settingsGroupIcon(g.id)}</div>
          <div class="settings-card-name">${g.label}</div>
          <div class="settings-card-dots">${dots}</div>
          <span class="tally${all ? " ok" : ""}">${done}/${g.modules.length} <strong>done</strong></span>
        </button>
      `;
    }).join("");
    return `
      <p class="setup-hint-line">Pick any card below — nothing here has to be done in order, and nothing else is touched until you open it.</p>
      <div class="settings-grid" style="grid-template-columns:repeat(${SETTINGS_GROUPS.length}, 1fr)">${cards}</div>
    `;
  }

  function wireSetupConnected() {
    $all(".settings-card").forEach((card) => {
      card.addEventListener("click", () => {
        const group = SETTINGS_GROUPS.find((g) => g.id === card.dataset.group);
        setup.activeGroup = group.id;
        setup.activeModule = group.modules[0].id;
        renderSetupBody();
      });
    });
  }

  /* ---------- a settings group's own tabbed page ---------- */

  /* Modules with no wiring yet all get this — the same "not built yet"
     honesty as the Coming Soon placeholder unbuilt operations get in
     renderMain(), just scoped to one tab instead of a whole page. */
  function settingsComingSoonHtml(mod) {
    return `
      <div class="section">
        <div class="section-head"><h2 class="section-title">${mod.label}</h2></div>
        <p class="section-note">Not built yet. Each module gets added once its real request shape is confirmed against the muggle-friendly magic scroll and, where one exists, the live admin screen.</p>
      </div>
    `;
  }

  /* One entry per wired module — the lookup a new module joins instead of
     growing a chain of ternaries. A module id with no entry here falls
     through to settingsComingSoonHtml(). */
  const SETTINGS_MODULE_HANDLERS = {
    company_profile: { template: companyProfileTemplate, wire: wireCompanyProfileEvents },
    bank_info: { template: bankInfoTemplate, wire: wireBankInfoEvents },
    branches: { template: branchTemplate, wire: wireBranchEvents },
    departments: { template: departmentModuleTemplate, wire: wireDepartmentModuleEvents },
    designations: { template: designationTemplate, wire: wireDesignationEvents },
    custom_fields: { template: customFieldTemplate, wire: wireCustomFieldEvents },
    required_documents: { template: requiredDocumentTemplate, wire: wireRequiredDocumentEvents },
    leave_types: { template: leaveTypeTemplate, wire: wireLeaveTypeEvents },
    leave_policy: { template: leavePolicyTemplate, wire: wireLeavePolicyEvents },
    payroll_general: { template: payrollGeneralTemplate, wire: wirePayrollGeneralEvents },
    salary_components: { template: salaryComponentTemplate, wire: wireSalaryComponentEvents },
    configure_salary_components: { template: salaryStructureTemplate, wire: wireSalaryStructureEvents },
    late_arrival: { template: lateArrivalTemplate, wire: wireLateArrivalEvents },
    absent_deduction: { template: absentDeductionTemplate, wire: wireAbsentDeductionEvents },
    bonus_types: { template: bonusTypeTemplate, wire: wireBonusTypeEvents },
    bonus_policy: { template: bonusPolicyTemplate, wire: wireBonusPolicyEvents },
    overtime: { template: overtimeTemplate, wire: wireOvertimeEvents },
    attendance_bonus: { template: attendanceBonusTemplate, wire: wireAttendanceBonusEvents },
    custom_addition_deduction: { template: customAdditionDeductionTemplate, wire: wireCustomAdditionDeductionEvents },
    tax: { template: payrollTaxTemplate, wire: wirePayrollTaxEvents },
    attendance_policy: { template: attendancePolicyTemplate, wire: wireAttendancePolicyEvents },
  };

  function setupGroupPageTemplate() {
    const group = SETTINGS_GROUPS.find((g) => g.id === setup.activeGroup);
    const tabs = group.modules
      .map(
        (m) => `
        <button type="button" class="settings-tab" data-module="${m.id}" aria-current="${m.id === setup.activeModule}">
          ${setup.doneModules.has(m.id) ? '<span class="op-dot" style="background:var(--success)"></span>' : ""}${m.label}
        </button>`
      )
      .join("");
    const mod = group.modules.find((m) => m.id === setup.activeModule);
    const handler = SETTINGS_MODULE_HANDLERS[mod.id];
    let body = handler ? handler.template() : settingsComingSoonHtml(mod);
    /* Every module template's returned HTML ends its section-head with
       the same literal `</h2></div>`, whichever of its own states
       (ready, loading, error, blocked-on-dependency) is currently
       rendering — so the module's icon can be injected once, centrally,
       right here, as the header row's second flex child, rather than
       editing all 21 templates to carry it themselves. */
    if (handler) {
      body = body.replace("</h2></div>", `</h2>${settingsModuleIconHtml(mod.id)}</div>`);
    }
    return `
      <a href="#" id="setupBackToModules" style="display:inline-flex; align-items:center; gap:6px; font-size:13px; font-weight:600;">← Back to Company Setup</a>
      <h2 style="font-size:19px; margin:14px 0 0;">${group.label}</h2>
      <div class="settings-tabs" role="tablist">${tabs}</div>
      <div style="margin-top:16px">${body}</div>
    `;
  }

  function wireSetupGroupPage() {
    /* Every module's own save handler re-renders by calling this function
       directly, not renderSetupBody() — so this, not that, is the one
       place guaranteed to run after doneModules actually changes, and is
       where the "what did I already do" marker needs to be kept current. */
    saveLastSetupSession();
    /* A bulk "create the defaults" run (Department/Designation) updates
       its own list by re-rendering whichever module is currently active
       — navigating to a different tab mid-run would point those updates
       at the wrong module instead of the running one, and the list *is*
       the run log, so losing sight of it isn't harmless the way jumping
       between two idle tabs is. Blocked here, centrally, rather than
       disabling every tab/link individually. */
    $("#setupBackToModules").addEventListener("click", (e) => {
      e.preventDefault();
      if (isBulkRunActive()) return;
      setup.activeGroup = null;
      setup.activeModule = null;
      renderSetupBody();
    });
    $all(".settings-tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        if (isBulkRunActive()) return;
        setup.activeModule = tab.dataset.module;
        renderSetupBody();
      });
    });
    /* Wired once here rather than per module — any module's dependency
       notice can point at any other module without its own wiring. */
    $all(".dep-shortcut").forEach((link) => {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        if (isBulkRunActive()) return;
        setup.activeGroup = link.dataset.group;
        setup.activeModule = link.dataset.module;
        renderSetupBody();
      });
    });
    const activeHandler = SETTINGS_MODULE_HANDLERS[setup.activeModule];
    if (activeHandler) activeHandler.wire();
  }

  /* ---------- Company Profile — first settings module ----------

     PATCH /company-profile. Every field is generated, none typed by
     hand — legalName from the connected company's own real name (the
     Login response's companyName, never a text field the visitor
     controls), the rest from the Postman collection's own pools,
     ported verbatim. Fields stay editable after generating: Regenerate
     re-rolls everything, but nothing stops fixing one field by hand
     before Save. */
  const companyProfile = {
    fields: null, // { legalName, tegNo, taxId, industry, businessType, website, description, missionStatement, visionStatement }
    busy: false,
    error: "",
    ok: "",
  };

  function generateCompanyProfileFields() {
    const suffix = choice(COMPANY_LEGAL_SUFFIXES);
    const legalName = `${setup.companyName} ${suffix}`;

    const tegNo = String(randInt(1, 9)) + Array.from({ length: 12 }, () => randInt(0, 9)).join("");
    const taxId = String(randInt(1, 9)) + Array.from({ length: 11 }, () => randInt(0, 9)).join("");

    const pair = choice(COMPANY_INDUSTRY_PAIRS);
    const website =
      (
        setup.companyName
          .toLowerCase()
          .replace(/&/g, " and ")
          .replace(/\band\b/g, "and")
          .replace(/[^a-z0-9]/g, "") || "dummycompany"
      ) + choice(COMPANY_DOMAIN_EXTENSIONS);

    const fill = (tpl) => tpl.replace(/\{industry\}/g, pair.industry).replace(/\{businessType\}/g, pair.businessType);

    return {
      legalName,
      tegNo,
      taxId,
      industry: pair.industry,
      businessType: pair.businessType,
      website,
      description: fill(choice(COMPANY_DESCRIPTION_TEMPLATES)),
      missionStatement: fill(choice(COMPANY_MISSION_TEMPLATES)),
      visionStatement: fill(choice(COMPANY_VISION_TEMPLATES)),
    };
  }

  function companyProfileTemplate() {
    if (!companyProfile.fields) companyProfile.fields = generateCompanyProfileFields();
    const f = companyProfile.fields;
    return `
      <div class="section">
        <div class="section-head"><h2 class="section-title"><span class="section-num">1</span>Company Profile</h2></div>
        <p class="section-note">Generated from ${setup.companyName}'s own name plus the muggle-friendly magic scroll's own pools. Regenerate re-rolls everything; any field can still be edited by hand before saving.</p>
        <div class="field-row">
          <div class="field"><label for="cpLegalName">Legal Name</label><input type="text" id="cpLegalName" value="${f.legalName}" /></div>
          <div class="field"><label for="cpTegNo">TEG NO</label><input type="text" id="cpTegNo" value="${f.tegNo}" /></div>
        </div>
        <div class="field-row" style="margin-top:14px">
          <div class="field"><label for="cpTaxId">Tax ID</label><input type="text" id="cpTaxId" value="${f.taxId}" /></div>
          <div class="field"><label for="cpIndustry">Industry</label><input type="text" id="cpIndustry" value="${f.industry}" /></div>
        </div>
        <div class="field-row" style="margin-top:14px">
          <div class="field"><label for="cpBusinessType">Business Type</label><input type="text" id="cpBusinessType" value="${f.businessType}" /></div>
          <div class="field"><label for="cpWebsite">Website</label><input type="text" id="cpWebsite" value="${f.website}" /></div>
        </div>
        <div class="field" style="margin-top:14px"><label for="cpDescription">Description</label><textarea id="cpDescription">${f.description}</textarea></div>
        <div class="field" style="margin-top:14px"><label for="cpMission">Mission Statement</label><textarea id="cpMission">${f.missionStatement}</textarea></div>
        <div class="field" style="margin-top:14px"><label for="cpVision">Vision Statement</label><textarea id="cpVision">${f.visionStatement}</textarea></div>

        <div class="setup-actions" style="flex-direction:row; align-items:center;">
          <button type="button" class="tiny-btn" id="cpRegenerateBtn">↻ Regenerate</button>
          <button type="button" class="generate-btn" id="cpSaveBtn">Save to ${ENVIRONMENTS[setup.env].label}</button>
        </div>
        <span class="error-text" id="cpError">${companyProfile.error}</span>
        ${companyProfile.ok ? `<div style="display:flex; gap:9px; align-items:center; margin-top:10px; color:var(--success); font-size:13px; font-weight:600;">${iconCheck()}${companyProfile.ok}</div>` : ""}
      </div>
    `;
  }

  function readCompanyProfileForm() {
    return {
      legalName: $("#cpLegalName").value,
      tegNo: $("#cpTegNo").value,
      taxId: $("#cpTaxId").value,
      industry: $("#cpIndustry").value,
      businessType: $("#cpBusinessType").value,
      website: $("#cpWebsite").value,
      description: $("#cpDescription").value,
      missionStatement: $("#cpMission").value,
      visionStatement: $("#cpVision").value,
    };
  }

  async function saveCompanyProfile(fields) {
    const env = ENVIRONMENTS[setup.env];
    let res;
    try {
      res = await fetch(`${env.apiBase}/company-profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${setup.companyToken}` },
        body: JSON.stringify(fields),
      });
    } catch (e) {
      throw new Error(`Couldn't reach ${env.label}.`);
    }
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) throw new Error('Your session with this company may have expired — use "Disconnect this company" above and sign in again.');
    if (!res.ok) throw new Error(data.message || "The server rejected this.");
    return data;
  }

  function wireCompanyProfileEvents() {
    $("#cpRegenerateBtn").addEventListener("click", () => {
      companyProfile.fields = generateCompanyProfileFields();
      companyProfile.error = "";
      companyProfile.ok = "";
      $("#setupBody").innerHTML = setupGroupPageTemplate();
      wireSetupGroupPage();
    });

    const btn = $("#cpSaveBtn");
    btn.addEventListener("click", async () => {
      companyProfile.error = "";
      companyProfile.ok = "";
      const fields = readCompanyProfileForm();
      setBtnBusy(btn);
      try {
        await saveCompanyProfile(fields);
        companyProfile.fields = fields;
        companyProfile.ok = "Saved.";
        setup.doneModules.add("company_profile");
      } catch (e) {
        companyProfile.error = e.message;
      }
      $("#setupBody").innerHTML = setupGroupPageTemplate();
      wireSetupGroupPage();
    });
  }

  /* ---------- Bank Info — second settings module ----------

     POST /company-bank-informations/save. Same shape as Company Profile —
     every field generated, all editable, Regenerate re-rolls, Save sends
     whatever the inputs actually hold. Two things this endpoint does
     differently, both confirmed against the Postman collection rather
     than assumed:
       - success is 201, not 200 (checked on the response status, not just
         parsed — a 200 here would mean something changed upstream);
       - accountNumber goes over the wire as a JSON NUMBER, not a string
         (the collection's own body has it unquoted) — kept as a string in
         the form for editing, converted with Number() only at send time. */
  const bankInfo = { fields: null, busy: false, error: "", ok: "" };

  function bankShortCodeFor(bankName) {
    const mapped = BANK_SHORT_CODE_MAP[bankName];
    if (mapped) return mapped;
    // Fallback for a bank not in the map — ported as-is, even though every
    // name in BANK_NAMES already has a mapping and this never actually runs.
    return bankName
      .replace(/Ltd\.?/gi, "")
      .replace(/Limited/gi, "")
      .replace(/Bank/gi, "")
      .replace(/Bangladesh/gi, "")
      .trim()
      .split(/\s+/)[0]
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");
  }

  function generateBankInfoFields() {
    const bankName = choice(BANK_NAMES);
    const len = randInt(12, 15);
    const accountNumber = String(randInt(1, 9)) + Array.from({ length: len - 1 }, () => randInt(0, 9)).join("");
    const shortCode = bankShortCodeFor(bankName);
    return {
      bankName,
      accountNumber,
      npsbCode: `${shortCode}ACT`,
      beftnCode: `${shortCode}BFT`,
      mfsCode: choice(MFS_CODES),
    };
  }

  function bankInfoTemplate() {
    if (!bankInfo.fields) bankInfo.fields = generateBankInfoFields();
    const f = bankInfo.fields;
    return `
      <div class="section">
        <div class="section-head"><h2 class="section-title"><span class="section-num">2</span>Bank Info</h2></div>
        <p class="section-note">Generated from the muggle-friendly magic scroll's own bank list and short-code map. Regenerate re-rolls everything; any field can still be edited by hand before saving.</p>
        <div class="field-row">
          <div class="field"><label for="biBankName">Bank Name</label><input type="text" id="biBankName" value="${f.bankName}" /></div>
          <div class="field"><label for="biAccountNumber">Account Number</label><input type="text" id="biAccountNumber" value="${f.accountNumber}" /></div>
        </div>
        <div class="field-row" style="margin-top:14px">
          <div class="field"><label for="biNpsb">NPSB Code</label><input type="text" id="biNpsb" value="${f.npsbCode}" /></div>
          <div class="field"><label for="biBeftn">BEFTN Code</label><input type="text" id="biBeftn" value="${f.beftnCode}" /></div>
        </div>
        <div class="field" style="margin-top:14px; max-width:calc(50% - 8px)"><label for="biMfs">MFS Code</label><input type="text" id="biMfs" value="${f.mfsCode}" /></div>

        <div class="setup-actions" style="flex-direction:row; align-items:center;">
          <button type="button" class="tiny-btn" id="biRegenerateBtn">↻ Regenerate</button>
          <button type="button" class="generate-btn" id="biSaveBtn">Save to ${ENVIRONMENTS[setup.env].label}</button>
        </div>
        <span class="error-text" id="biError">${bankInfo.error}</span>
        ${bankInfo.ok ? `<div style="display:flex; gap:9px; align-items:center; margin-top:10px; color:var(--success); font-size:13px; font-weight:600;">${iconCheck()}${bankInfo.ok}</div>` : ""}
      </div>
    `;
  }

  function readBankInfoForm() {
    return {
      bankName: $("#biBankName").value,
      accountNumber: $("#biAccountNumber").value,
      npsbCode: $("#biNpsb").value,
      beftnCode: $("#biBeftn").value,
      mfsCode: $("#biMfs").value,
    };
  }

  async function saveBankInfo(fields) {
    const env = ENVIRONMENTS[setup.env];
    const payload = {
      bankName: fields.bankName,
      accountNumber: Number(fields.accountNumber), // the real API takes this unquoted — a JSON number
      npsbCode: fields.npsbCode,
      beftnCode: fields.beftnCode,
      mfsCode: fields.mfsCode,
    };
    let res;
    try {
      res = await fetch(`${env.apiBase}/company-bank-informations/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${setup.companyToken}` },
        body: JSON.stringify(payload),
      });
    } catch (e) {
      throw new Error(`Couldn't reach ${env.label}.`);
    }
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) throw new Error('Your session with this company may have expired — use "Disconnect this company" above and sign in again.');
    if (res.status !== 201) throw new Error(data.message || "The server rejected this.");
    return data;
  }

  function wireBankInfoEvents() {
    $("#biRegenerateBtn").addEventListener("click", () => {
      bankInfo.fields = generateBankInfoFields();
      bankInfo.error = "";
      bankInfo.ok = "";
      $("#setupBody").innerHTML = setupGroupPageTemplate();
      wireSetupGroupPage();
    });

    const btn = $("#biSaveBtn");
    btn.addEventListener("click", async () => {
      bankInfo.error = "";
      bankInfo.ok = "";
      const fields = readBankInfoForm();
      setBtnBusy(btn);
      try {
        await saveBankInfo(fields);
        bankInfo.fields = fields;
        bankInfo.ok = "Saved.";
        setup.doneModules.add("bank_info");
      } catch (e) {
        bankInfo.error = e.message;
      }
      $("#setupBody").innerHTML = setupGroupPageTemplate();
      wireSetupGroupPage();
    });
  }

  /* ---------- Locations (Postman: "Branch Management") — third module ----------

     POST /company/branches. Same generate/edit/regenerate/save shape.
     isGeolocation is a real either/or — off means latitude, longitude and
     radiusInMeters travel as null, not as zeroes or omitted keys, exactly
     as the Postman script sends them. Toggling it regenerates or clears
     the three geo fields; nothing else about the form changes. */
  const companyBranch = { fields: null, error: "", ok: "", createdNames: [] };

  function randomBaridharaOffset() {
    return {
      latitude: Number((BARIDHARA_BASE_LATITUDE + (Math.random() - 0.5) * 0.006).toFixed(15)),
      longitude: Number((BARIDHARA_BASE_LONGITUDE + (Math.random() - 0.5) * 0.006).toFixed(15)),
      radiusInMeters: choice(BRANCH_RADIUS_OPTIONS),
    };
  }

  function generateBranchFields() {
    const loc = choice(BD_LOCATION_PRESETS);
    const isGeolocation = Math.random() < 0.5;
    const geo = isGeolocation ? randomBaridharaOffset() : { latitude: null, longitude: null, radiusInMeters: null };
    return {
      officeName: choice(OFFICE_NAMES),
      district: loc.district,
      city: loc.city,
      address: loc.address,
      zipCode: loc.zipCode,
      isGeolocation,
      ...geo,
    };
  }

  function branchTemplate() {
    if (!companyBranch.fields) companyBranch.fields = generateBranchFields();
    const f = companyBranch.fields;
    const geoFieldsHtml = f.isGeolocation
      ? `
        <div class="field-row" style="margin-top:14px">
          <div class="field"><label for="brLat">Latitude</label><input type="text" id="brLat" value="${f.latitude}" /></div>
          <div class="field"><label for="brLng">Longitude</label><input type="text" id="brLng" value="${f.longitude}" /></div>
        </div>
        <div class="field" style="margin-top:14px; max-width:calc(50% - 8px)"><label for="brRadius">Radius (meters)</label><input type="text" id="brRadius" value="${f.radiusInMeters}" /></div>
      `
      : "";
    return `
      <div class="section">
        <div class="section-head"><h2 class="section-title"><span class="section-num">3</span>Locations</h2></div>
        <p class="section-note">Generated from the muggle-friendly magic scroll's own office-name and BD-location pools. Regenerate re-rolls everything; any field can still be edited by hand before saving.</p>
        <div class="field-row">
          <div class="field"><label for="brOfficeName">Office Name</label><input type="text" id="brOfficeName" value="${f.officeName}" /></div>
          <div class="field"><label for="brDistrict">District</label><input type="text" id="brDistrict" value="${f.district}" /></div>
        </div>
        <div class="field-row" style="margin-top:14px">
          <div class="field"><label for="brCity">City</label><input type="text" id="brCity" value="${f.city}" /></div>
          <div class="field"><label for="brZip">Zip Code</label><input type="text" id="brZip" value="${f.zipCode}" /></div>
        </div>
        <div class="field" style="margin-top:14px"><label for="brAddress">Address</label><input type="text" id="brAddress" value="${f.address}" /></div>
        <div class="field" style="margin-top:14px">
          <label>Has Geolocation</label>
          <div class="seg" id="brGeoSeg" role="group" aria-label="Has geolocation">
            <button type="button" data-geo="yes" aria-pressed="${f.isGeolocation}">Yes</button>
            <button type="button" data-geo="no" aria-pressed="${!f.isGeolocation}">No</button>
          </div>
        </div>
        ${geoFieldsHtml}

        <div class="setup-actions" style="flex-direction:row; align-items:center;">
          <button type="button" class="tiny-btn" id="brRegenerateBtn">↻ Regenerate</button>
          <button type="button" class="generate-btn" id="brSaveBtn">Save to ${ENVIRONMENTS[setup.env].label}</button>
        </div>
        <span class="error-text" id="brError">${companyBranch.error}</span>
        ${companyBranch.ok ? `<div style="display:flex; gap:9px; align-items:center; margin-top:10px; color:var(--success); font-size:13px; font-weight:600;">${iconCheck()}${companyBranch.ok}</div>` : ""}
        ${createdListHtml(companyBranch.createdNames)}
      </div>
    `;
  }

  function readBranchForm() {
    const isGeolocation = companyBranch.fields.isGeolocation;
    return {
      officeName: $("#brOfficeName").value,
      district: $("#brDistrict").value,
      city: $("#brCity").value,
      zipCode: $("#brZip").value,
      address: $("#brAddress").value,
      isGeolocation,
      latitude: isGeolocation ? Number($("#brLat").value) : null,
      longitude: isGeolocation ? Number($("#brLng").value) : null,
      radiusInMeters: isGeolocation ? Number($("#brRadius").value) : null,
    };
  }

  async function saveBranch(fields) {
    const env = ENVIRONMENTS[setup.env];
    let res;
    try {
      res = await fetch(`${env.apiBase}/company/branches`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${setup.companyToken}` },
        body: JSON.stringify(fields),
      });
    } catch (e) {
      throw new Error(`Couldn't reach ${env.label}.`);
    }
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) throw new Error('Your session with this company may have expired — use "Disconnect this company" above and sign in again.');
    if (res.status !== 201) throw new Error(data.message || "The server rejected this.");
    return data;
  }

  function wireBranchEvents() {
    $all("#brGeoSeg button").forEach((btn) => {
      btn.addEventListener("click", () => {
        const wantsGeo = btn.dataset.geo === "yes";
        companyBranch.fields.isGeolocation = wantsGeo;
        Object.assign(companyBranch.fields, wantsGeo ? randomBaridharaOffset() : { latitude: null, longitude: null, radiusInMeters: null });
        $("#setupBody").innerHTML = setupGroupPageTemplate();
        wireSetupGroupPage();
      });
    });

    $("#brRegenerateBtn").addEventListener("click", () => {
      companyBranch.fields = generateBranchFields();
      companyBranch.error = "";
      companyBranch.ok = "";
      $("#setupBody").innerHTML = setupGroupPageTemplate();
      wireSetupGroupPage();
    });

    const btn = $("#brSaveBtn");
    btn.addEventListener("click", async () => {
      companyBranch.error = "";
      companyBranch.ok = "";
      const fields = readBranchForm();
      setBtnBusy(btn);
      try {
        await saveBranch(fields);
        companyBranch.fields = fields;
        companyBranch.ok = "Saved.";
        companyBranch.createdNames.push(fields.officeName);
        setup.doneModules.add("branches");
      } catch (e) {
        companyBranch.error = e.message;
      }
      $("#setupBody").innerHTML = setupGroupPageTemplate();
      wireSetupGroupPage();
    });
  }

  /* ---------- Department Management — fourth module ----------

     POST /departments. code/parentId/businessLineId/departmentHeadId are
     always the fixed values the Postman body sends — nothing generates
     them, since the script never varies them either. The script also
     tracks already-used names per company to avoid duplicates across
     repeated CI runs; that's Postman's own test-fixture bookkeeping and
     doesn't apply here — one generated department at a time, same as
     every other module, no dedup list to maintain. */
  const companyDepartment = { fields: null, error: "", ok: "", bulk: null, createdNames: [] };

  function generateDepartmentFields() {
    return {
      name: choice(DEPARTMENT_NAMES),
      code: "",
      status: "Active",
      parentId: null,
      businessLineId: null,
      departmentHeadId: null,
    };
  }

  /* "Create the defaults" — the same 6 department names (and, in
     Designation below, the same 4-per-department designations) Employee
     Add uses, created for real via the same one-at-a-time POST every
     other module here uses. Requested 2026-09-10: a QA engineer setting
     up a fresh test company was recreating this exact structure by hand,
     department by department. `bulk` is null in normal single-department
     mode; entering bulk mode swaps the whole template, it doesn't sit
     alongside it. */
  function departmentDefaultBulkItems() {
    return DEFAULT_DEPARTMENTS.map((d) => ({ name: d.name, selected: true, status: "pending", message: "" }));
  }

  function departmentModuleTemplate() {
    const head = `<div class="section-head"><h2 class="section-title"><span class="section-num">4</span>Department Management</h2></div>`;
    if (companyDepartment.bulk) return bulkListTemplate(head, companyDepartment.bulk, "deptBulk");
    if (!companyDepartment.fields) companyDepartment.fields = generateDepartmentFields();
    const f = companyDepartment.fields;
    return `
      <div class="section">
        ${head}
        <p class="section-note">Generated from the muggle-friendly magic scroll's own department-name pool. Regenerate re-rolls it; the name can still be edited by hand before saving.</p>
        <div class="field"><label for="deptModName">Department Name</label><input type="text" id="deptModName" value="${f.name}" /></div>
        <div class="setup-actions" style="flex-direction:row; align-items:center;">
          <button type="button" class="tiny-btn" id="deptModRegenerateBtn">↻ Regenerate</button>
          <button type="button" class="generate-btn" id="deptModSaveBtn">Save to ${ENVIRONMENTS[setup.env].label}</button>
        </div>
        <span class="error-text" id="deptModError">${companyDepartment.error}</span>
        ${companyDepartment.ok ? `<div style="display:flex; gap:9px; align-items:center; margin-top:10px; color:var(--success); font-size:13px; font-weight:600;">${iconCheck()}${companyDepartment.ok}</div>` : ""}
        ${createdListHtml(companyDepartment.createdNames)}
        <p style="margin-top:14px"><a href="#" id="deptBulkEnterLink" style="font-size:12.5px; font-weight:600;">Or create the 6 default departments at once →</a></p>
      </div>
    `;
  }

  function readDepartmentModuleForm() {
    return { ...companyDepartment.fields, name: $("#deptModName").value };
  }

  async function saveDepartmentModule(fields) {
    const env = ENVIRONMENTS[setup.env];
    let res;
    try {
      res = await fetch(`${env.apiBase}/departments`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${setup.companyToken}` },
        body: JSON.stringify(fields),
      });
    } catch (e) {
      throw new Error(`Couldn't reach ${env.label}.`);
    }
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) throw new Error('Your session with this company may have expired — use "Disconnect this company" above and sign in again.');
    if (res.status !== 201) throw new Error(data.message || "The server rejected this.");
    return data;
  }

  /* ---------- shared: "create the defaults" bulk lists ----------

     Department's 6 defaults and Designation's 24 (4 per department) both
     need the same shape of thing: a reviewable list of real, individually
     creatable items, created one at a time — never all at once — so each
     one's real server response is seen rather than assumed, and a
     mid-list failure (a duplicate name, most likely) doesn't stop the
     rest. This is the first place in Company Setup that loops writes,
     which is exactly the risk flagged when Company Profile was built and
     deferred until a module actually needed it: some of a bulk run can
     already be real by the time one item fails or someone stops it, so
     the list itself — pending/creating/done/failed per row — doubles as
     the run log, and a Stop button (checked between items, never
     mid-request) is the closest thing to a cancel this needs. */
  function isBulkRunActive() {
    return !!(companyDepartment.bulk && companyDepartment.bulk.running) || !!(companyDesignation.bulk && companyDesignation.bulk.running);
  }

  async function runBulkSequential(bulk, createFn, rerender) {
    bulk.running = true;
    bulk.stopRequested = false;
    rerender();
    for (const item of bulk.items) {
      if (bulk.stopRequested) break;
      if (!item.selected) continue;
      item.status = "creating";
      rerender();
      try {
        await createFn(item);
        item.status = "done";
      } catch (e) {
        item.status = "failed";
        item.message = e.message;
      }
      rerender();
    }
    bulk.running = false;
    rerender();
  }

  function bulkStatusHtml(item) {
    if (item.status === "creating") return `<span style="color:var(--text-faint)">${iconSpinner()} creating…</span>`;
    if (item.status === "done") return `<span style="color:var(--success); font-weight:600;">${iconCheck()} done</span>`;
    if (item.status === "failed") return `<span class="error-text" style="margin:0" title="${item.message}">failed — ${item.message}</span>`;
    if (item.status === "skipped") return `<span style="color:var(--text-faint)" title="${item.message}">skipped</span>`;
    return `<span style="color:var(--text-faint)">not started</span>`;
  }

  /* For every module where Save creates a brand-new named record rather
     than updating one in place — a company can end up with several
     Departments, Leave Types, Custom Fields and so on, and "the tab has
     a done dot" doesn't say which ones actually exist. Each such
     module's state carries its own `createdNames` array (pushed to on a
     successful save, both the single-item form and a bulk run), and
     this renders it as a plain, visible list — no guessing, no needing
     to re-check the real company to remember what you already made. */
  function createdListHtml(createdNames) {
    if (!createdNames || createdNames.length === 0) return "";
    return `
      <div style="margin-top:14px;">
        <label style="font-size:11.5px; font-weight:600; color:var(--text-faint); text-transform:uppercase; letter-spacing:0.03em; display:block; margin-bottom:6px;">Created this session (${createdNames.length})</label>
        <div style="display:flex; flex-wrap:wrap; gap:6px;">${createdNames.map((n) => `<span class="tally">${n}</span>`).join("")}</div>
      </div>
    `;
  }

  /* One shared renderer for both bulk lists — `group` is only set for
     Designation, where rows are grouped by department; Department's own
     6 rows render flat. `prefix` namespaces the element ids so both can
     be wired independently without colliding. */
  function bulkListTemplate(head, bulk, prefix, groupLabelFor) {
    const selectableCount = bulk.items.filter((it) => it.status !== "skipped").length;
    const selectedCount = bulk.items.filter((it) => it.selected).length;
    const allSelected = selectableCount > 0 && selectedCount === selectableCount;
    let lastGroup = null;
    const rows = bulk.items
      .map((it, i) => {
        const groupLabel = groupLabelFor ? groupLabelFor(it) : null;
        const groupHeading = groupLabel !== null && groupLabel !== lastGroup ? ((lastGroup = groupLabel), `<div class="bulk-group-label">${groupLabel}</div>`) : "";
        return `
          ${groupHeading}
          <label class="bulk-row">
            <input type="checkbox" data-idx="${i}" ${it.selected ? "checked" : ""} ${it.status === "skipped" || bulk.running ? "disabled" : ""} />
            <span class="bulk-row-name">${it.name}</span>
            ${bulkStatusHtml(it)}
          </label>
        `;
      })
      .join("");
    return `
      <div class="section">
        ${head}
        <div class="setup-actions" style="flex-direction:row; align-items:center; margin-bottom:4px;">
          <button type="button" class="tiny-btn" id="${prefix}SelectAllBtn" ${bulk.running ? "disabled" : ""}>${allSelected ? "Deselect all" : "Select all"}</button>
        </div>
        <div class="bulk-list">${rows}</div>
        <div class="setup-actions" style="flex-direction:row; align-items:center;">
          ${
            bulk.running
              ? `<button type="button" class="tiny-btn" id="${prefix}StopBtn">Stop</button>`
              : `<button type="button" class="tiny-btn" id="${prefix}CancelBtn">← Back</button>
                 <button type="button" class="generate-btn" id="${prefix}CreateBtn">Create selected (${selectedCount})</button>`
          }
        </div>
      </div>
    `;
  }

  function wireDepartmentModuleEvents() {
    if (companyDepartment.bulk) {
      const bulk = companyDepartment.bulk;
      const rerender = () => {
        $("#setupBody").innerHTML = setupGroupPageTemplate();
        wireSetupGroupPage();
      };
      $all(".bulk-list input[type=checkbox]").forEach((cb) =>
        cb.addEventListener("change", (e) => {
          bulk.items[Number(e.target.dataset.idx)].selected = e.target.checked;
          rerender();
        })
      );
      $("#deptBulkSelectAllBtn")?.addEventListener("click", () => {
        const selectable = bulk.items.filter((it) => it.status !== "skipped");
        const allSelected = selectable.length > 0 && selectable.every((it) => it.selected);
        selectable.forEach((it) => (it.selected = !allSelected));
        rerender();
      });
      $("#deptBulkCancelBtn")?.addEventListener("click", () => {
        companyDepartment.bulk = null;
        rerender();
      });
      $("#deptBulkStopBtn")?.addEventListener("click", () => {
        bulk.stopRequested = true;
      });
      $("#deptBulkCreateBtn")?.addEventListener("click", async () => {
        await runBulkSequential(
          bulk,
          async (item) => {
            await saveDepartmentModule({ name: item.name, code: "", status: "Active", parentId: null, businessLineId: null, departmentHeadId: null });
            companyDepartment.createdNames.push(item.name);
          },
          rerender
        );
        companyDesignation.departments = null; // a real department may now exist — invalidate Designation's stale "none yet" cache
        if (bulk.items.some((it) => it.status === "done")) setup.doneModules.add("departments");
        rerender(); // the done dot itself needs one more render — runBulkSequential's own last one fired before doneModules was touched
      });
      return;
    }
    $("#deptBulkEnterLink")?.addEventListener("click", (e) => {
      e.preventDefault();
      companyDepartment.bulk = { items: departmentDefaultBulkItems(), running: false, stopRequested: false };
      $("#setupBody").innerHTML = setupGroupPageTemplate();
      wireSetupGroupPage();
    });
    $("#deptModRegenerateBtn").addEventListener("click", () => {
      companyDepartment.fields = generateDepartmentFields();
      companyDepartment.error = "";
      companyDepartment.ok = "";
      $("#setupBody").innerHTML = setupGroupPageTemplate();
      wireSetupGroupPage();
    });

    const btn = $("#deptModSaveBtn");
    btn.addEventListener("click", async () => {
      companyDepartment.error = "";
      companyDepartment.ok = "";
      const fields = readDepartmentModuleForm();
      setBtnBusy(btn);
      try {
        await saveDepartmentModule(fields);
        companyDepartment.fields = fields;
        companyDepartment.ok = "Saved.";
        companyDepartment.createdNames.push(fields.name);
        setup.doneModules.add("departments");
        /* A department just came into existence for real, so Designation's
           cached "does this company have any" check (if it ran already)
           is stale — clear it so the next visit re-checks live instead of
           still reporting zero. */
        companyDesignation.departments = null;
      } catch (e) {
        companyDepartment.error = e.message;
      }
      $("#setupBody").innerHTML = setupGroupPageTemplate();
      wireSetupGroupPage();
    });
  }

  /* ---------- shared: modules with a real dependency on another one ----------

     Only a genuine data dependency ever blocks a module, and only that
     one — never a fixed order. Designation is the first: the Postman
     collection encodes the exact same rule itself (its own script
     throws "Age Get Active Departments API run korte hobe" if the
     queue it depends on was never built), so this isn't a rule we're
     inventing, it's one the real API already enforces implicitly. */

  /* GET helper for "does the company have any of X" checks — same
     Authorization/error shape as every write here, just no body. */
  async function fetchCompanyResource(path) {
    const env = ENVIRONMENTS[setup.env];
    let res;
    try {
      res = await fetch(`${env.apiBase}${path}`, {
        headers: { Authorization: `Bearer ${setup.companyToken}` },
      });
    } catch (e) {
      throw new Error(`Couldn't reach ${env.label}.`);
    }
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) throw new Error('Your session with this company may have expired — use "Disconnect this company" above and sign in again.');
    if (!res.ok) throw new Error(data.message || "The server rejected this.");
    return Array.isArray(data.data) ? data.data : [];
  }

  /* The calm inline notice a blocked module shows — one named prerequisite
     and a shortcut straight to it, never a tour of unrelated modules.
     `.dep-shortcut` clicks are wired once, centrally, in
     wireSetupGroupPage() rather than per module. */
  function dependencyNoticeHtml(missingLabel, groupId, moduleId) {
    return `
      <div style="display:flex; gap:9px; align-items:flex-start; border-radius:6px; padding:12px 14px; font-size:13px; border:1px solid var(--warning); background:var(--warning-soft); color:var(--warning);">
        ${iconWarn()}
        <div>
          <div style="font-weight:600;">This company doesn't have a ${missingLabel} yet.</div>
          <a href="#" class="dep-shortcut" data-group="${groupId}" data-module="${moduleId}" style="display:inline-block; margin-top:8px; font-weight:600; font-size:13px;">Add a ${missingLabel} first →</a>
        </div>
      </div>
    `;
  }

  /* ---------- Designation Management — fifth module, the first with a real dependency ----------

     POST /designations. Checks GET /departments/active live before
     showing a form at all — the exact same rule the Postman collection's
     own script enforces on itself. `departments` is null until checked
     once (then cached for the rest of this company session — see
     saveDepartmentModule() for the one place that invalidates it), an
     empty array once checked with genuinely none, or the real list. */
  const companyDesignation = { departments: null, loadError: "", fields: null, error: "", ok: "", bulk: null, createdNames: [] };

  function generateDesignationFields(depts) {
    return { name: choice(DESIGNATION_NAMES), departmentId: depts[0].id, status: "Active" };
  }

  /* "Create the defaults" for Designation — the 4 designations Employee
     Add pairs with each of its 6 default departments, matched here
     against this company's *real* departments by name. A default whose
     department was never created (bulk-created or otherwise) has no
     real id to attach to, so it's shown, disabled, rather than quietly
     left out — "This company's data can't be quietly incomplete" is the
     rule the rest of the app already holds itself to (Employee Add's
     card-based screens), not a new one invented for this. */
  function designationDefaultBulkItems(depts) {
    const items = [];
    DEFAULT_DEPARTMENTS.forEach((d) => {
      const real = depts.find((rd) => rd.name.trim().toLowerCase() === d.name.trim().toLowerCase());
      d.designations.forEach((desigName) => {
        items.push({
          name: desigName,
          departmentName: d.name,
          departmentId: real ? real.id : null,
          selected: !!real,
          status: real ? "pending" : "skipped",
          message: real ? "" : `no department named "${d.name}" exists yet`,
        });
      });
    });
    return items;
  }

  async function loadDesignationDependency() {
    try {
      companyDesignation.departments = await fetchCompanyResource("/departments/active");
    } catch (e) {
      companyDesignation.departments = null;
      companyDesignation.loadError = e.message;
    }
  }

  function designationTemplate() {
    const head = `<div class="section-head"><h2 class="section-title"><span class="section-num">5</span>Designation Management</h2></div>`;
    if (companyDesignation.loadError) {
      return `
        <div class="section">
          ${head}
          <span class="error-text">${companyDesignation.loadError}</span>
          <div class="setup-actions" style="margin-top:10px"><button type="button" class="tiny-btn" id="desigRetryBtn">Try again</button></div>
        </div>
      `;
    }
    if (companyDesignation.departments === null) {
      return `<div class="section">${head}<p class="section-note">Checking this company's departments…</p></div>`;
    }
    if (companyDesignation.departments.length === 0) {
      return `
        <div class="section">
          ${head}
          <p class="section-note">A designation attaches to a department — this company doesn't have one yet.</p>
          ${dependencyNoticeHtml("Department", "company", "departments")}
        </div>
      `;
    }
    const depts = companyDesignation.departments;
    if (companyDesignation.bulk) return bulkListTemplate(head, companyDesignation.bulk, "desigBulk", (it) => it.departmentName);
    if (!companyDesignation.fields || !depts.some((d) => d.id === companyDesignation.fields.departmentId)) {
      companyDesignation.fields = generateDesignationFields(depts);
    }
    const f = companyDesignation.fields;
    const options = depts.map((d) => `<option value="${d.id}" ${d.id === f.departmentId ? "selected" : ""}>${d.name}</option>`).join("");
    return `
      <div class="section">
        ${head}
        <p class="section-note">Generated from the muggle-friendly magic scroll's own designation-name pool, attached to a real department from this company. Regenerate re-rolls the name; any field can still be edited by hand before saving.</p>
        <div class="field-row">
          <div class="field"><label for="desigName">Designation Name</label><input type="text" id="desigName" value="${f.name}" /></div>
          <div class="field"><label for="desigDept">Department</label><select id="desigDept">${options}</select></div>
        </div>
        <div class="setup-actions" style="flex-direction:row; align-items:center;">
          <button type="button" class="tiny-btn" id="desigRegenerateBtn">↻ Regenerate</button>
          <button type="button" class="generate-btn" id="desigSaveBtn">Save to ${ENVIRONMENTS[setup.env].label}</button>
        </div>
        <span class="error-text" id="desigError">${companyDesignation.error}</span>
        ${companyDesignation.ok ? `<div style="display:flex; gap:9px; align-items:center; margin-top:10px; color:var(--success); font-size:13px; font-weight:600;">${iconCheck()}${companyDesignation.ok}</div>` : ""}
        ${createdListHtml(companyDesignation.createdNames)}
        <p style="margin-top:14px"><a href="#" id="desigBulkEnterLink" style="font-size:12.5px; font-weight:600;">Or create the 4 default designations for each department at once →</a></p>
      </div>
    `;
  }

  function readDesignationForm() {
    return { name: $("#desigName").value, departmentIds: [$("#desigDept").value], status: "Active" };
  }

  async function saveDesignation(fields) {
    const env = ENVIRONMENTS[setup.env];
    let res;
    try {
      res = await fetch(`${env.apiBase}/designations`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${setup.companyToken}` },
        body: JSON.stringify(fields),
      });
    } catch (e) {
      throw new Error(`Couldn't reach ${env.label}.`);
    }
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) throw new Error('Your session with this company may have expired — use "Disconnect this company" above and sign in again.');
    if (res.status !== 201) throw new Error(data.message || "The server rejected this.");
    return data;
  }

  function wireDesignationEvents() {
    if (companyDesignation.departments === null && !companyDesignation.loadError) {
      loadDesignationDependency().then(() => {
        $("#setupBody").innerHTML = setupGroupPageTemplate();
        wireSetupGroupPage();
      });
      return;
    }
    const retryBtn = $("#desigRetryBtn");
    if (retryBtn) {
      retryBtn.addEventListener("click", () => {
        companyDesignation.loadError = "";
        companyDesignation.departments = null;
        $("#setupBody").innerHTML = setupGroupPageTemplate();
        wireSetupGroupPage();
      });
      return;
    }
    if (!companyDesignation.departments || companyDesignation.departments.length === 0) return; // .dep-shortcut is wired centrally

    if (companyDesignation.bulk) {
      const bulk = companyDesignation.bulk;
      const rerender = () => {
        $("#setupBody").innerHTML = setupGroupPageTemplate();
        wireSetupGroupPage();
      };
      $all(".bulk-list input[type=checkbox]").forEach((cb) =>
        cb.addEventListener("change", (e) => {
          bulk.items[Number(e.target.dataset.idx)].selected = e.target.checked;
          rerender();
        })
      );
      $("#desigBulkSelectAllBtn")?.addEventListener("click", () => {
        const selectable = bulk.items.filter((it) => it.status !== "skipped");
        const allSelected = selectable.length > 0 && selectable.every((it) => it.selected);
        selectable.forEach((it) => (it.selected = !allSelected));
        rerender();
      });
      $("#desigBulkCancelBtn")?.addEventListener("click", () => {
        companyDesignation.bulk = null;
        rerender();
      });
      $("#desigBulkStopBtn")?.addEventListener("click", () => {
        bulk.stopRequested = true;
      });
      $("#desigBulkCreateBtn")?.addEventListener("click", async () => {
        await runBulkSequential(
          bulk,
          async (item) => {
            await saveDesignation({ name: item.name, departmentIds: [item.departmentId], status: "Active" });
            companyDesignation.createdNames.push(item.name);
          },
          rerender
        );
        if (bulk.items.some((it) => it.status === "done")) setup.doneModules.add("designations");
        rerender(); // the done dot itself needs one more render — same reason as Department's bulk create
      });
      return;
    }
    $("#desigBulkEnterLink")?.addEventListener("click", (e) => {
      e.preventDefault();
      companyDesignation.bulk = { items: designationDefaultBulkItems(companyDesignation.departments), running: false, stopRequested: false };
      $("#setupBody").innerHTML = setupGroupPageTemplate();
      wireSetupGroupPage();
    });

    $("#desigDept").addEventListener("change", (e) => {
      companyDesignation.fields.departmentId = e.target.value;
    });
    $("#desigRegenerateBtn").addEventListener("click", () => {
      companyDesignation.fields = generateDesignationFields(companyDesignation.departments);
      companyDesignation.error = "";
      companyDesignation.ok = "";
      $("#setupBody").innerHTML = setupGroupPageTemplate();
      wireSetupGroupPage();
    });

    const btn = $("#desigSaveBtn");
    btn.addEventListener("click", async () => {
      companyDesignation.error = "";
      companyDesignation.ok = "";
      const fields = readDesignationForm();
      setBtnBusy(btn);
      try {
        await saveDesignation(fields);
        companyDesignation.fields = { name: fields.name, departmentId: fields.departmentIds[0], status: fields.status };
        companyDesignation.ok = "Saved.";
        companyDesignation.createdNames.push(fields.name);
        setup.doneModules.add("designations");
      } catch (e) {
        companyDesignation.error = e.message;
      }
      $("#setupBody").innerHTML = setupGroupPageTemplate();
      wireSetupGroupPage();
    });
  }

  /* ---------- Custom Fields — sixth module ----------

     POST /company-settings/employee-custom-fields. fieldName/type are a
     paired preset (a "Blood Group" field is never typed "number"), same
     discipline as Bank Info's short codes. enableFilter only ever
     applies to checkbox/enum in the real API, so it's forced false for
     every other type rather than randomised across the board; choices
     only exists at all for type "enum". */
  const customField = { fields: null, error: "", ok: "", createdNames: [] };

  function generateCustomFieldFields() {
    const preset = choice(CUSTOM_FIELD_PRESETS);
    const fields = {
      fieldName: preset.fieldName,
      type: preset.type,
      enableFilter: preset.type === "checkbox" || preset.type === "enum" ? Math.random() < 0.5 : false,
      shownAsColumn: Math.random() < 0.5,
      status: choice(CUSTOM_FIELD_STATUSES),
    };
    if (preset.type === "enum") {
      fields.choices = shuffle(preset.choicePool).slice(0, randInt(3, Math.min(5, preset.choicePool.length)));
    }
    return fields;
  }

  function customFieldTemplate() {
    if (!customField.fields) customField.fields = generateCustomFieldFields();
    const f = customField.fields;
    const choicesHtml = f.choices
      ? `<div class="field" style="margin-top:14px"><label for="cfChoices">Choices (comma-separated)</label><input type="text" id="cfChoices" value="${f.choices.join(", ")}" /></div>`
      : "";
    return `
      <div class="section">
        <div class="section-head"><h2 class="section-title"><span class="section-num">1</span>Custom Fields</h2></div>
        <p class="section-note">Generated from the muggle-friendly magic scroll's own field-type pool. Regenerate re-rolls everything; any field can still be edited by hand before saving.</p>
        <div class="field-row">
          <div class="field"><label for="cfName">Field Name</label><input type="text" id="cfName" value="${f.fieldName}" /></div>
          <div class="field"><label for="cfType">Type</label><input type="text" id="cfType" value="${f.type}" /></div>
        </div>
        ${choicesHtml}
        <div class="field-row" style="margin-top:14px">
          <div class="field">
            <label>Enable Filter</label>
            <div class="seg" id="cfFilterSeg" role="group" aria-label="Enable filter">
              <button type="button" data-val="yes" aria-pressed="${f.enableFilter}">Yes</button>
              <button type="button" data-val="no" aria-pressed="${!f.enableFilter}">No</button>
            </div>
          </div>
          <div class="field">
            <label>Shown As Column</label>
            <div class="seg" id="cfColumnSeg" role="group" aria-label="Shown as column">
              <button type="button" data-val="yes" aria-pressed="${f.shownAsColumn}">Yes</button>
              <button type="button" data-val="no" aria-pressed="${!f.shownAsColumn}">No</button>
            </div>
          </div>
        </div>
        <div class="field" style="margin-top:14px; max-width:calc(50% - 8px)">
          <label>Status</label>
          <div class="seg" id="cfStatusSeg" role="group" aria-label="Status">
            <button type="button" data-val="Active" aria-pressed="${f.status === "Active"}">Active</button>
            <button type="button" data-val="Inactive" aria-pressed="${f.status === "Inactive"}">Inactive</button>
          </div>
        </div>

        <div class="setup-actions" style="flex-direction:row; align-items:center;">
          <button type="button" class="tiny-btn" id="cfRegenerateBtn">↻ Regenerate</button>
          <button type="button" class="generate-btn" id="cfSaveBtn">Save to ${ENVIRONMENTS[setup.env].label}</button>
        </div>
        <span class="error-text" id="cfError">${customField.error}</span>
        ${customField.ok ? `<div style="display:flex; gap:9px; align-items:center; margin-top:10px; color:var(--success); font-size:13px; font-weight:600;">${iconCheck()}${customField.ok}</div>` : ""}
        ${createdListHtml(customField.createdNames)}
      </div>
    `;
  }

  function readCustomFieldForm() {
    const body = {
      fieldName: $("#cfName").value,
      type: $("#cfType").value,
      enableFilter: customField.fields.enableFilter,
      shownAsColumn: customField.fields.shownAsColumn,
      status: customField.fields.status,
    };
    if (customField.fields.choices) {
      body.options = { choices: $("#cfChoices").value.split(",").map((s) => s.trim()).filter(Boolean) };
    }
    return body;
  }

  async function saveCustomField(body) {
    const env = ENVIRONMENTS[setup.env];
    let res;
    try {
      res = await fetch(`${env.apiBase}/company-settings/employee-custom-fields`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${setup.companyToken}` },
        body: JSON.stringify(body),
      });
    } catch (e) {
      throw new Error(`Couldn't reach ${env.label}.`);
    }
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) throw new Error('Your session with this company may have expired — use "Disconnect this company" above and sign in again.');
    if (res.status !== 201) throw new Error(data.message || "The server rejected this.");
    return data;
  }

  function wireCustomFieldEvents() {
    const rerender = () => {
      $("#setupBody").innerHTML = setupGroupPageTemplate();
      wireSetupGroupPage();
    };
    $all("#cfFilterSeg button").forEach((btn) => btn.addEventListener("click", () => { customField.fields.enableFilter = btn.dataset.val === "yes"; rerender(); }));
    $all("#cfColumnSeg button").forEach((btn) => btn.addEventListener("click", () => { customField.fields.shownAsColumn = btn.dataset.val === "yes"; rerender(); }));
    $all("#cfStatusSeg button").forEach((btn) => btn.addEventListener("click", () => { customField.fields.status = btn.dataset.val; rerender(); }));

    $("#cfRegenerateBtn").addEventListener("click", () => {
      customField.fields = generateCustomFieldFields();
      customField.error = "";
      customField.ok = "";
      rerender();
    });

    const btn = $("#cfSaveBtn");
    btn.addEventListener("click", async () => {
      customField.error = "";
      customField.ok = "";
      const body = readCustomFieldForm();
      setBtnBusy(btn);
      try {
        await saveCustomField(body);
        customField.fields.fieldName = body.fieldName;
        customField.fields.type = body.type;
        if (body.options) customField.fields.choices = body.options.choices;
        customField.ok = "Saved.";
        customField.createdNames.push(body.fieldName);
        setup.doneModules.add("custom_fields");
      } catch (e) {
        customField.error = e.message;
      }
      rerender();
    });
  }

  /* ---------- Required Documents — seventh module ----------

     POST /required-documents. Note the lowercase status values
     ("active"/"inactive") — this endpoint's own convention, kept exactly
     as the Postman body sends it rather than normalised to match every
     other module's capitalised Active/Inactive. */
  const requiredDocument = { fields: null, error: "", ok: "", createdNames: [] };

  function generateRequiredDocumentFields() {
    return {
      name: choice(REQUIRED_DOCUMENT_NAMES),
      type: choice(REQUIRED_DOCUMENT_TYPES),
      status: choice(REQUIRED_DOCUMENT_STATUSES),
      isRequired: Math.random() < 0.5,
    };
  }

  function requiredDocumentTemplate() {
    if (!requiredDocument.fields) requiredDocument.fields = generateRequiredDocumentFields();
    const f = requiredDocument.fields;
    return `
      <div class="section">
        <div class="section-head"><h2 class="section-title"><span class="section-num">2</span>Required Documents</h2></div>
        <p class="section-note">Generated from the muggle-friendly magic scroll's own document-name pool. Regenerate re-rolls everything; any field can still be edited by hand before saving.</p>
        <div class="field-row">
          <div class="field"><label for="rdName">Document Name</label><input type="text" id="rdName" value="${f.name}" /></div>
          <div class="field">
            <label>Type</label>
            <div class="seg" id="rdTypeSeg" role="group" aria-label="Type">
              <button type="button" data-val="file" aria-pressed="${f.type === "file"}">File</button>
              <button type="button" data-val="text" aria-pressed="${f.type === "text"}">Text</button>
            </div>
          </div>
        </div>
        <div class="field-row" style="margin-top:14px">
          <div class="field">
            <label>Status</label>
            <div class="seg" id="rdStatusSeg" role="group" aria-label="Status">
              <button type="button" data-val="active" aria-pressed="${f.status === "active"}">Active</button>
              <button type="button" data-val="inactive" aria-pressed="${f.status === "inactive"}">Inactive</button>
            </div>
          </div>
          <div class="field">
            <label>Is Required</label>
            <div class="seg" id="rdRequiredSeg" role="group" aria-label="Is required">
              <button type="button" data-val="yes" aria-pressed="${f.isRequired}">Yes</button>
              <button type="button" data-val="no" aria-pressed="${!f.isRequired}">No</button>
            </div>
          </div>
        </div>

        <div class="setup-actions" style="flex-direction:row; align-items:center;">
          <button type="button" class="tiny-btn" id="rdRegenerateBtn">↻ Regenerate</button>
          <button type="button" class="generate-btn" id="rdSaveBtn">Save to ${ENVIRONMENTS[setup.env].label}</button>
        </div>
        <span class="error-text" id="rdError">${requiredDocument.error}</span>
        ${requiredDocument.ok ? `<div style="display:flex; gap:9px; align-items:center; margin-top:10px; color:var(--success); font-size:13px; font-weight:600;">${iconCheck()}${requiredDocument.ok}</div>` : ""}
        ${createdListHtml(requiredDocument.createdNames)}
      </div>
    `;
  }

  function readRequiredDocumentForm() {
    return {
      name: $("#rdName").value,
      type: requiredDocument.fields.type,
      status: requiredDocument.fields.status,
      isRequired: requiredDocument.fields.isRequired,
    };
  }

  async function saveRequiredDocument(fields) {
    const env = ENVIRONMENTS[setup.env];
    let res;
    try {
      res = await fetch(`${env.apiBase}/required-documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${setup.companyToken}` },
        body: JSON.stringify(fields),
      });
    } catch (e) {
      throw new Error(`Couldn't reach ${env.label}.`);
    }
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) throw new Error('Your session with this company may have expired — use "Disconnect this company" above and sign in again.');
    if (res.status !== 201) throw new Error(data.message || "The server rejected this.");
    return data;
  }

  function wireRequiredDocumentEvents() {
    const rerender = () => {
      $("#setupBody").innerHTML = setupGroupPageTemplate();
      wireSetupGroupPage();
    };
    $all("#rdTypeSeg button").forEach((btn) => btn.addEventListener("click", () => { requiredDocument.fields.type = btn.dataset.val; rerender(); }));
    $all("#rdStatusSeg button").forEach((btn) => btn.addEventListener("click", () => { requiredDocument.fields.status = btn.dataset.val; rerender(); }));
    $all("#rdRequiredSeg button").forEach((btn) => btn.addEventListener("click", () => { requiredDocument.fields.isRequired = btn.dataset.val === "yes"; rerender(); }));

    $("#rdRegenerateBtn").addEventListener("click", () => {
      requiredDocument.fields = generateRequiredDocumentFields();
      requiredDocument.error = "";
      requiredDocument.ok = "";
      rerender();
    });

    const btn = $("#rdSaveBtn");
    btn.addEventListener("click", async () => {
      requiredDocument.error = "";
      requiredDocument.ok = "";
      const fields = readRequiredDocumentForm();
      setBtnBusy(btn);
      try {
        await saveRequiredDocument(fields);
        requiredDocument.fields.name = fields.name;
        requiredDocument.ok = "Saved.";
        requiredDocument.createdNames.push(fields.name);
        setup.doneModules.add("required_documents");
      } catch (e) {
        requiredDocument.error = e.message;
      }
      rerender();
    });
  }

  /* ---------- Leave Types — eighth module ----------

     POST /leave-types. Four kinds ("normal" leave) share one large rule
     set ported verbatim from the Postman collection's own script; two
     ("special entitlement" leave — Maternity, Paternity) use a much
     smaller, mostly-fixed body. Only name and the three headline limits
     (consecutive/monthly/carry-forward, each with a day count) are
     exposed as editable fields for normal leave — everything else is
     still generated per the script's own conditional logic, just not
     surfaced as its own input row. See the note in app-data.js. */
  const leaveType = { kindId: "annual", fields: null, error: "", ok: "", createdNames: [] };

  function generateNormalLeaveTypeBody(kind) {
    const consecutiveLimit = Math.random() < 0.5;
    const monthlyLimit = Math.random() < 0.5;
    const allowBackdatedLeave = Math.random() < 0.5;
    const documentRequired = Math.random() < 0.5;
    const carryForwardEnabled = Math.random() < 0.5;
    const carryForwardIsExpiry = carryForwardEnabled ? Math.random() < 0.5 : false;
    const sandwichRuleEnabled = Math.random() < 0.5;
    const isBridge = Math.random() < 0.5;
    const leaveResetCycle = choice(["calendar_year", "employee_anniversary", "custom_date"]);
    return {
      name: kind.name,
      genderEligibility: kind.genderEligibility,
      maritalStatusEligibility: kind.maritalStatusEligibility,
      consecutiveLimit,
      consecutiveDays: consecutiveLimit ? randInt(5, 10) : 5,
      monthlyLimit,
      monthlyLimitDays: monthlyLimit ? randInt(7, 12) : 7,
      prorataCalculation: Math.random() < 0.5,
      accrualStartType: choice(["joining_date", "confirmation_date", "custom"]),
      accrualStartMonths: randInt(3, 5),
      allowBackdatedLeave,
      backdatedLeaveDays: allowBackdatedLeave ? choice([30, 60, 90]) : 30,
      documentRequired,
      documentThresholdDays: documentRequired ? randInt(3, 6) : 2,
      carryForwardEnabled,
      maxCarryForwardDays: carryForwardEnabled ? randInt(5, 15) : 10,
      carryForwardIsExpiry,
      carryForwardExpiryDays: carryForwardIsExpiry ? randInt(90, 120) : 12,
      sandwichRuleEnabled,
      sandwichMode: sandwichRuleEnabled ? choice(["optional", "direct_cut"]) : "direct_cut",
      sandwichIncludeWeekend: sandwichRuleEnabled ? Math.random() < 0.5 : true,
      sandwichIncludeHoliday: sandwichRuleEnabled ? Math.random() < 0.5 : true,
      sandwichIncludeCompanyEvent: false,
      isBridge,
      bridgeMode: isBridge ? choice(["direct", "optional"]) : "direct",
      isLeaveReset: true,
      leaveResetCycle,
      fiscalYearStartMonth: leaveResetCycle === "calendar_year" ? 4 : null,
      customResetMonth: leaveResetCycle === "custom_date" ? randInt(1, 12) : null,
      customResetDay: leaveResetCycle === "custom_date" ? 1 : null,
      specialEntitlementEnabled: false,
      deductionPriority: [{ sourceKind: "requested" }],
      isUnpaid: false,
    };
  }

  function generateSpecialLeaveTypeBody(kind) {
    const seMaxInstances = choice([2, 3]);
    return {
      name: kind.name,
      genderEligibility: kind.genderEligibility,
      maritalStatusEligibility: kind.maritalStatusEligibility,
      consecutiveLimit: false,
      consecutiveDays: 5,
      monthlyLimit: false,
      monthlyLimitDays: 7,
      prorataCalculation: false,
      accrualStartType: "joining_date",
      accrualStartMonths: 3,
      allowBackdatedLeave: false,
      backdatedLeaveDays: 30,
      documentRequired: false,
      documentThresholdDays: 2,
      carryForwardEnabled: false,
      maxCarryForwardDays: 10,
      carryForwardIsExpiry: false,
      carryForwardExpiryDays: 12,
      sandwichRuleEnabled: false,
      sandwichMode: "direct_cut",
      sandwichIncludeWeekend: true,
      sandwichIncludeHoliday: true,
      sandwichIncludeCompanyEvent: false,
      isBridge: false,
      bridgeMode: "direct",
      isLeaveReset: false,
      specialEntitlementEnabled: true,
      seMaxInstances,
      seMaxDaysPerInstance: kind.seMaxDaysPerInstance,
      seMaxTotalDays: seMaxInstances * kind.seMaxDaysPerInstance,
      seRequireDocument: Math.random() < 0.5,
      deductionPriority: [{ sourceKind: "requested" }],
      isUnpaid: false,
    };
  }

  function generateLeaveTypeBody(kindId) {
    const kind = LEAVE_TYPE_KINDS.find((k) => k.id === kindId);
    return kind.special ? generateSpecialLeaveTypeBody(kind) : generateNormalLeaveTypeBody(kind);
  }

  function leaveTypeTemplate() {
    if (!leaveType.fields) leaveType.fields = generateLeaveTypeBody(leaveType.kindId);
    const f = leaveType.fields;
    const kindOptions = LEAVE_TYPE_KINDS.map((k) => `<option value="${k.id}" ${k.id === leaveType.kindId ? "selected" : ""}>${k.name}</option>`).join("");

    let detailsHtml;
    if (f.specialEntitlementEnabled) {
      detailsHtml = `
        <div class="field-row" style="margin-top:14px">
          <div class="field">
            <label>Instances Per Year</label>
            <div class="seg" id="ltInstancesSeg" role="group" aria-label="Instances per year">
              <button type="button" data-val="2" aria-pressed="${f.seMaxInstances === 2}">2</button>
              <button type="button" data-val="3" aria-pressed="${f.seMaxInstances === 3}">3</button>
            </div>
          </div>
          <div class="field">
            <label>Require Document</label>
            <div class="seg" id="ltDocSeg" role="group" aria-label="Require document">
              <button type="button" data-val="yes" aria-pressed="${f.seRequireDocument}">Yes</button>
              <button type="button" data-val="no" aria-pressed="${!f.seRequireDocument}">No</button>
            </div>
          </div>
        </div>
        <p class="section-note" style="margin-top:10px">${f.seMaxDaysPerInstance} days per instance, ${f.seMaxTotalDays} total across ${f.seMaxInstances} instances a year — fixed for this leave type.</p>
      `;
    } else {
      detailsHtml = `
        <div class="field-row" style="margin-top:14px">
          <div class="field">
            <label>Consecutive Day Limit</label>
            <div class="seg" id="ltConsecutiveSeg" role="group" aria-label="Consecutive day limit">
              <button type="button" data-val="yes" aria-pressed="${f.consecutiveLimit}">Yes</button>
              <button type="button" data-val="no" aria-pressed="${!f.consecutiveLimit}">No</button>
            </div>
          </div>
          ${f.consecutiveLimit ? `<div class="field"><label for="ltConsecutiveDays">Max Consecutive Days</label><input type="text" id="ltConsecutiveDays" value="${f.consecutiveDays}" /></div>` : ""}
        </div>
        <div class="field-row" style="margin-top:14px">
          <div class="field">
            <label>Monthly Limit</label>
            <div class="seg" id="ltMonthlySeg" role="group" aria-label="Monthly limit">
              <button type="button" data-val="yes" aria-pressed="${f.monthlyLimit}">Yes</button>
              <button type="button" data-val="no" aria-pressed="${!f.monthlyLimit}">No</button>
            </div>
          </div>
          ${f.monthlyLimit ? `<div class="field"><label for="ltMonthlyDays">Max Days Per Month</label><input type="text" id="ltMonthlyDays" value="${f.monthlyLimitDays}" /></div>` : ""}
        </div>
        <div class="field-row" style="margin-top:14px">
          <div class="field">
            <label>Carry Forward</label>
            <div class="seg" id="ltCarrySeg" role="group" aria-label="Carry forward">
              <button type="button" data-val="yes" aria-pressed="${f.carryForwardEnabled}">Yes</button>
              <button type="button" data-val="no" aria-pressed="${!f.carryForwardEnabled}">No</button>
            </div>
          </div>
          ${f.carryForwardEnabled ? `<div class="field"><label for="ltCarryDays">Max Carry-Forward Days</label><input type="text" id="ltCarryDays" value="${f.maxCarryForwardDays}" /></div>` : ""}
        </div>
        <p class="section-note" style="margin-top:10px">Prorata, accrual, backdating, document requirement, sandwich/bridge rules and the reset cycle are generated the same way the muggle-friendly magic scroll does it — Regenerate re-rolls them, they're just not each their own field here.</p>
      `;
    }

    return `
      <div class="section">
        <div class="section-head"><h2 class="section-title"><span class="section-num">1</span>Leave Types</h2></div>
        <p class="section-note">Generated from the muggle-friendly magic scroll's own leave-type rules. Pick a kind, then Regenerate re-rolls its details; name and the headline limits can still be edited by hand before saving.</p>
        <div class="field-row">
          <div class="field"><label for="ltKind">Kind</label><select id="ltKind">${kindOptions}</select></div>
          <div class="field"><label for="ltName">Name</label><input type="text" id="ltName" value="${f.name}" /></div>
        </div>
        ${detailsHtml}

        <div class="setup-actions" style="flex-direction:row; align-items:center;">
          <button type="button" class="tiny-btn" id="ltRegenerateBtn">↻ Regenerate</button>
          <button type="button" class="generate-btn" id="ltSaveBtn">Save to ${ENVIRONMENTS[setup.env].label}</button>
        </div>
        <span class="error-text" id="ltError">${leaveType.error}</span>
        ${leaveType.ok ? `<div style="display:flex; gap:9px; align-items:center; margin-top:10px; color:var(--success); font-size:13px; font-weight:600;">${iconCheck()}${leaveType.ok}</div>` : ""}
        ${createdListHtml(leaveType.createdNames)}
      </div>
    `;
  }

  function readLeaveTypeForm() {
    const f = { ...leaveType.fields, name: $("#ltName").value };
    if (!f.specialEntitlementEnabled) {
      if (f.consecutiveLimit) f.consecutiveDays = Number($("#ltConsecutiveDays").value);
      if (f.monthlyLimit) f.monthlyLimitDays = Number($("#ltMonthlyDays").value);
      if (f.carryForwardEnabled) f.maxCarryForwardDays = Number($("#ltCarryDays").value);
    }
    return f;
  }

  async function saveLeaveType(fields) {
    const env = ENVIRONMENTS[setup.env];
    let res;
    try {
      res = await fetch(`${env.apiBase}/leave-types`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${setup.companyToken}` },
        body: JSON.stringify(fields),
      });
    } catch (e) {
      throw new Error(`Couldn't reach ${env.label}.`);
    }
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) throw new Error('Your session with this company may have expired — use "Disconnect this company" above and sign in again.');
    if (res.status !== 201) throw new Error(data.message || "The server rejected this.");
    return data;
  }

  function wireLeaveTypeEvents() {
    const rerender = () => {
      $("#setupBody").innerHTML = setupGroupPageTemplate();
      wireSetupGroupPage();
    };

    $("#ltKind").addEventListener("change", (e) => {
      leaveType.kindId = e.target.value;
      leaveType.fields = generateLeaveTypeBody(leaveType.kindId);
      leaveType.error = "";
      leaveType.ok = "";
      rerender();
    });

    const consecutiveSeg = $("#ltConsecutiveSeg");
    if (consecutiveSeg) $all("button", consecutiveSeg).forEach((btn) => btn.addEventListener("click", () => { leaveType.fields.consecutiveLimit = btn.dataset.val === "yes"; rerender(); }));
    const monthlySeg = $("#ltMonthlySeg");
    if (monthlySeg) $all("button", monthlySeg).forEach((btn) => btn.addEventListener("click", () => { leaveType.fields.monthlyLimit = btn.dataset.val === "yes"; rerender(); }));
    const carrySeg = $("#ltCarrySeg");
    if (carrySeg) {
      $all("button", carrySeg).forEach((btn) =>
        btn.addEventListener("click", () => {
          leaveType.fields.carryForwardEnabled = btn.dataset.val === "yes";
          if (!leaveType.fields.carryForwardEnabled) leaveType.fields.carryForwardIsExpiry = false;
          rerender();
        })
      );
    }
    const instancesSeg = $("#ltInstancesSeg");
    if (instancesSeg) {
      $all("button", instancesSeg).forEach((btn) =>
        btn.addEventListener("click", () => {
          leaveType.fields.seMaxInstances = Number(btn.dataset.val);
          leaveType.fields.seMaxTotalDays = leaveType.fields.seMaxInstances * leaveType.fields.seMaxDaysPerInstance;
          rerender();
        })
      );
    }
    const docSeg = $("#ltDocSeg");
    if (docSeg) $all("button", docSeg).forEach((btn) => btn.addEventListener("click", () => { leaveType.fields.seRequireDocument = btn.dataset.val === "yes"; rerender(); }));

    $("#ltRegenerateBtn").addEventListener("click", () => {
      leaveType.fields = generateLeaveTypeBody(leaveType.kindId);
      leaveType.error = "";
      leaveType.ok = "";
      rerender();
    });

    const btn = $("#ltSaveBtn");
    btn.addEventListener("click", async () => {
      leaveType.error = "";
      leaveType.ok = "";
      const fields = readLeaveTypeForm();
      setBtnBusy(btn);
      try {
        await saveLeaveType(fields);
        leaveType.fields = fields;
        leaveType.ok = "Saved.";
        leaveType.createdNames.push(fields.name);
        setup.doneModules.add("leave_types");
        /* A leave type now exists for real — Leave Policy's cached
           dependency check (if it ran already) is stale. */
        leavePolicy.leaveTypes = null;
      } catch (e) {
        leaveType.error = e.message;
      }
      rerender();
    });
  }

  /* ---------- Leave Policy — ninth module, the second with a real dependency ----------

     POST /leave-policies needs at least one leave type to attach — same
     shape of rule as Designation needing a Department, and the Postman
     script enforces it on itself the same way ("leaveTypesAll not
     found... run GET all leave types API first"). Which leave types get
     included, and their category/days, are auto-selected the way the
     script does (a random subset, minimum 3 or however many exist) —
     Regenerate re-rolls the selection; name and status are the exposed
     editable fields. */
  const leavePolicy = { leaveTypes: null, loadError: "", fields: null, error: "", ok: "", createdNames: [] };

  async function loadLeavePolicyDependency() {
    try {
      leavePolicy.leaveTypes = await fetchCompanyResource("/leave-types");
    } catch (e) {
      leavePolicy.leaveTypes = null;
      leavePolicy.loadError = e.message;
    }
  }

  function generateLeavePolicyFields(leaveTypes) {
    const minCount = Math.min(3, leaveTypes.length);
    const count = randInt(minCount, leaveTypes.length);
    const selected = shuffle(leaveTypes).slice(0, count);
    const leaveTypesBody = selected.map((lt) => {
      const hasSpecialDays = lt.seMaxDaysPerInstance !== null && lt.seMaxDaysPerInstance !== undefined;
      return {
        leaveTypeId: lt.id,
        category: hasSpecialDays ? "Special" : choice(LEAVE_POLICY_CATEGORIES),
        days: hasSpecialDays ? Number(lt.seMaxDaysPerInstance) : choice(LEAVE_POLICY_STANDARD_DAYS),
        carryForward: false,
      };
    });
    return {
      name: choice(LEAVE_POLICY_NAMES),
      description: LEAVE_POLICY_DESCRIPTION,
      departmentIds: [],
      employeeTypes: LEAVE_POLICY_EMPLOYEE_TYPES,
      status: "Active",
      leaveTypes: leaveTypesBody,
    };
  }

  function leavePolicyTemplate() {
    const head = `<div class="section-head"><h2 class="section-title"><span class="section-num">2</span>Leave Policy</h2></div>`;
    if (leavePolicy.loadError) {
      return `
        <div class="section">
          ${head}
          <span class="error-text">${leavePolicy.loadError}</span>
          <div class="setup-actions" style="margin-top:10px"><button type="button" class="tiny-btn" id="lpRetryBtn">Try again</button></div>
        </div>
      `;
    }
    if (leavePolicy.leaveTypes === null) {
      return `<div class="section">${head}<p class="section-note">Checking this company's leave types…</p></div>`;
    }
    if (leavePolicy.leaveTypes.length === 0) {
      return `
        <div class="section">
          ${head}
          <p class="section-note">A policy attaches to leave types — this company doesn't have any yet.</p>
          ${dependencyNoticeHtml("Leave Type", "leave", "leave_types")}
        </div>
      `;
    }
    if (!leavePolicy.fields) leavePolicy.fields = generateLeavePolicyFields(leavePolicy.leaveTypes);
    const f = leavePolicy.fields;
    const rows = f.leaveTypes
      .map((lt) => {
        const src = leavePolicy.leaveTypes.find((x) => x.id === lt.leaveTypeId);
        return `<span class="tally" style="margin-top:6px; margin-right:6px">${src ? src.name : lt.leaveTypeId} <strong>${lt.category} · ${lt.days}d</strong></span>`;
      })
      .join("");
    return `
      <div class="section">
        ${head}
        <p class="section-note">Generated from the muggle-friendly magic scroll's own policy-composition rule, drawing on this company's real leave types. Regenerate re-rolls which leave types are included and their category/days; name and status can still be edited by hand before saving.</p>
        <div class="field-row">
          <div class="field"><label for="lpName">Name</label><input type="text" id="lpName" value="${f.name}" /></div>
          <div class="field">
            <label>Status</label>
            <div class="seg" id="lpStatusSeg" role="group" aria-label="Status">
              <button type="button" data-val="Active" aria-pressed="${f.status === "Active"}">Active</button>
              <button type="button" data-val="Inactive" aria-pressed="${f.status === "Inactive"}">Inactive</button>
            </div>
          </div>
        </div>
        <div style="margin-top:14px">
          <label style="font-size:12.5px; font-weight:600; color:var(--text); display:block; margin-bottom:8px;">Included Leave Types (${f.leaveTypes.length} of ${leavePolicy.leaveTypes.length})</label>
          <div style="display:flex; flex-wrap:wrap;">${rows}</div>
        </div>

        <div class="setup-actions" style="flex-direction:row; align-items:center;">
          <button type="button" class="tiny-btn" id="lpRegenerateBtn">↻ Regenerate</button>
          <button type="button" class="generate-btn" id="lpSaveBtn">Save to ${ENVIRONMENTS[setup.env].label}</button>
        </div>
        <span class="error-text" id="lpError">${leavePolicy.error}</span>
        ${leavePolicy.ok ? `<div style="display:flex; gap:9px; align-items:center; margin-top:10px; color:var(--success); font-size:13px; font-weight:600;">${iconCheck()}${leavePolicy.ok}</div>` : ""}
        ${createdListHtml(leavePolicy.createdNames)}
      </div>
    `;
  }

  function readLeavePolicyForm() {
    return { ...leavePolicy.fields, name: $("#lpName").value };
  }

  async function saveLeavePolicy(fields) {
    const env = ENVIRONMENTS[setup.env];
    let res;
    try {
      res = await fetch(`${env.apiBase}/leave-policies`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${setup.companyToken}` },
        body: JSON.stringify(fields),
      });
    } catch (e) {
      throw new Error(`Couldn't reach ${env.label}.`);
    }
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) throw new Error('Your session with this company may have expired — use "Disconnect this company" above and sign in again.');
    if (res.status !== 201) throw new Error(data.message || "The server rejected this.");
    return data;
  }

  function wireLeavePolicyEvents() {
    if (leavePolicy.leaveTypes === null && !leavePolicy.loadError) {
      loadLeavePolicyDependency().then(() => {
        $("#setupBody").innerHTML = setupGroupPageTemplate();
        wireSetupGroupPage();
      });
      return;
    }
    const retryBtn = $("#lpRetryBtn");
    if (retryBtn) {
      retryBtn.addEventListener("click", () => {
        leavePolicy.loadError = "";
        leavePolicy.leaveTypes = null;
        $("#setupBody").innerHTML = setupGroupPageTemplate();
        wireSetupGroupPage();
      });
      return;
    }
    if (!leavePolicy.leaveTypes || leavePolicy.leaveTypes.length === 0) return; // .dep-shortcut is wired centrally

    $all("#lpStatusSeg button").forEach((btn) =>
      btn.addEventListener("click", () => {
        leavePolicy.fields.status = btn.dataset.val;
        $("#setupBody").innerHTML = setupGroupPageTemplate();
        wireSetupGroupPage();
      })
    );

    $("#lpRegenerateBtn").addEventListener("click", () => {
      leavePolicy.fields = generateLeavePolicyFields(leavePolicy.leaveTypes);
      leavePolicy.error = "";
      leavePolicy.ok = "";
      $("#setupBody").innerHTML = setupGroupPageTemplate();
      wireSetupGroupPage();
    });

    const btn = $("#lpSaveBtn");
    btn.addEventListener("click", async () => {
      leavePolicy.error = "";
      leavePolicy.ok = "";
      const fields = readLeavePolicyForm();
      setBtnBusy(btn);
      try {
        await saveLeavePolicy(fields);
        leavePolicy.fields = fields;
        leavePolicy.ok = "Saved.";
        leavePolicy.createdNames.push(fields.name);
        setup.doneModules.add("leave_policy");
      } catch (e) {
        leavePolicy.error = e.message;
      }
      $("#setupBody").innerHTML = setupGroupPageTemplate();
      wireSetupGroupPage();
    });
  }

  /* ===================================================================
     Payroll — 11 modules ported from the Postman collection's own
     "Payroll Settings" folder. Three real dependencies live here:
     Configure Salary Components needs ≥2 Active salary components, Late
     Arrival and Absent Deduction each need ≥1 Leave Type (reusing the
     existing dependency infra and, for the latter, the existing
     `/leave-types` fetch). Every module follows the same generate/edit/
     regenerate/save shape as the rest of the app. Tax is the one place
     the collection itself stops short — see the note in app-data.js.
     =================================================================== */

  /* ---------- General — POST /payroll/configuration/payroll-cycle ---------- */
  const payrollGeneral = { fields: null, error: "", ok: "" };

  function generatePayrollGeneralFields() {
    const payrollCycle = weightedChoice(PAYROLL_CYCLE_OPTIONS);
    const body = { payrollCycle };
    function addThresholdRules() {
      body.thresholdRuleEnabled = Math.random() < 0.5;
      if (body.thresholdRuleEnabled) {
        body.thresholdDays = randInt(5, 10);
        body.thresholdNotifyEmployee = Math.random() < 0.5;
        body.thresholdNotifyHr = Math.random() < 0.5;
        body.thresholdLogDecisions = Math.random() < 0.5;
      }
    }
    if (payrollCycle === "calendar_month") addThresholdRules();
    if (payrollCycle === "fixed_date") {
      body.fixedStartDay = randInt(1, 28);
      addThresholdRules();
    }
    if (payrollCycle === "bi_weekly") {
      const now = new Date();
      body.biWeeklyStartDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    }
    return body;
  }

  function payrollGeneralTemplate() {
    const head = `<div class="section-head"><h2 class="section-title"><span class="section-num">1</span>General</h2></div>`;
    if (!payrollGeneral.fields) payrollGeneral.fields = generatePayrollGeneralFields();
    const f = payrollGeneral.fields;
    return `
      <div class="section">
        ${head}
        <p class="section-note">Generated from the muggle-friendly magic scroll's own pay-cycle picker — calendar month is most common, fixed date next, bi-weekly rare. Regenerate re-rolls which cycle and its conditional fields.</p>
        <div class="field-row">
          <div class="field">
            <label>Payroll Cycle</label>
            <div class="seg" id="pgCycleSeg" role="group" aria-label="Payroll cycle">
              <button type="button" data-val="calendar_month" aria-pressed="${f.payrollCycle === "calendar_month"}">Calendar Month</button>
              <button type="button" data-val="fixed_date" aria-pressed="${f.payrollCycle === "fixed_date"}">Fixed Date</button>
              <button type="button" data-val="bi_weekly" aria-pressed="${f.payrollCycle === "bi_weekly"}">Bi-weekly</button>
            </div>
          </div>
        </div>
        <div style="margin-top:12px; display:flex; flex-wrap:wrap; gap:6px;">
          ${f.fixedStartDay ? `<span class="tally">Fixed start day <strong>${f.fixedStartDay}</strong></span>` : ""}
          ${f.biWeeklyStartDate ? `<span class="tally">Bi-weekly start <strong>${f.biWeeklyStartDate}</strong></span>` : ""}
          ${f.thresholdRuleEnabled ? `<span class="tally">Threshold <strong>${f.thresholdDays} days</strong></span>` : ""}
        </div>

        <div class="setup-actions" style="flex-direction:row; align-items:center;">
          <button type="button" class="tiny-btn" id="pgRegenerateBtn">↻ Regenerate</button>
          <button type="button" class="generate-btn" id="pgSaveBtn">Save to ${ENVIRONMENTS[setup.env].label}</button>
        </div>
        <span class="error-text" id="pgError">${payrollGeneral.error}</span>
        ${payrollGeneral.ok ? `<div style="display:flex; gap:9px; align-items:center; margin-top:10px; color:var(--success); font-size:13px; font-weight:600;">${iconCheck()}${payrollGeneral.ok}</div>` : ""}
      </div>
    `;
  }

  async function savePayrollGeneral(fields) {
    const env = ENVIRONMENTS[setup.env];
    let res;
    try {
      res = await fetch(`${env.apiBase}/payroll/configuration/payroll-cycle`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${setup.companyToken}` },
        body: JSON.stringify(fields),
      });
    } catch (e) {
      throw new Error(`Couldn't reach ${env.label}.`);
    }
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) throw new Error('Your session with this company may have expired — use "Disconnect this company" above and sign in again.');
    if (res.status !== 201) throw new Error(data.message || "The server rejected this.");
    return data;
  }

  function wirePayrollGeneralEvents() {
    $all("#pgCycleSeg button").forEach((btn) =>
      btn.addEventListener("click", () => {
        const payrollCycle = btn.dataset.val;
        payrollGeneral.fields = { payrollCycle };
        if (payrollCycle === "calendar_month" || payrollCycle === "fixed_date") {
          if (payrollCycle === "fixed_date") payrollGeneral.fields.fixedStartDay = randInt(1, 28);
          payrollGeneral.fields.thresholdRuleEnabled = Math.random() < 0.5;
          if (payrollGeneral.fields.thresholdRuleEnabled) {
            payrollGeneral.fields.thresholdDays = randInt(5, 10);
            payrollGeneral.fields.thresholdNotifyEmployee = Math.random() < 0.5;
            payrollGeneral.fields.thresholdNotifyHr = Math.random() < 0.5;
            payrollGeneral.fields.thresholdLogDecisions = Math.random() < 0.5;
          }
        } else {
          const now = new Date();
          payrollGeneral.fields.biWeeklyStartDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
        }
        $("#setupBody").innerHTML = setupGroupPageTemplate();
        wireSetupGroupPage();
      })
    );

    $("#pgRegenerateBtn").addEventListener("click", () => {
      payrollGeneral.fields = generatePayrollGeneralFields();
      payrollGeneral.error = "";
      payrollGeneral.ok = "";
      $("#setupBody").innerHTML = setupGroupPageTemplate();
      wireSetupGroupPage();
    });

    const btn = $("#pgSaveBtn");
    btn.addEventListener("click", async () => {
      payrollGeneral.error = "";
      payrollGeneral.ok = "";
      setBtnBusy(btn);
      try {
        await savePayrollGeneral(payrollGeneral.fields);
        payrollGeneral.ok = "Saved.";
        setup.doneModules.add("payroll_general");
      } catch (e) {
        payrollGeneral.error = e.message;
      }
      $("#setupBody").innerHTML = setupGroupPageTemplate();
      wireSetupGroupPage();
    });
  }

  /* ---------- Salary Components — POST /payroll/configuration/salary-components ---------- */
  const salaryComponent = { presetIdx: 0, fields: null, error: "", ok: "", createdNames: [] };

  function generateSalaryComponentFields(presetIdx) {
    const preset = SALARY_COMPONENT_PRESETS[presetIdx];
    return {
      name: preset.name,
      description: preset.description,
      status: Math.random() < 0.9 ? "Active" : "Inactive",
      countableAsTaxComponent: Math.random() < 0.1,
      proRataEnabled: Math.random() < 0.9,
    };
  }

  function salaryComponentTemplate() {
    const head = `<div class="section-head"><h2 class="section-title"><span class="section-num">2</span>Salary Components</h2></div>`;
    if (!salaryComponent.fields) salaryComponent.fields = generateSalaryComponentFields(salaryComponent.presetIdx);
    const f = salaryComponent.fields;
    const options = SALARY_COMPONENT_PRESETS.map((p, i) => `<option value="${i}" ${i === salaryComponent.presetIdx ? "selected" : ""}>${p.name}</option>`).join("");
    return `
      <div class="section">
        ${head}
        <p class="section-note">The muggle-friendly magic scroll's own 4 fixed components, one request each — status, tax-countability and pro-rata are the only randomised fields.</p>
        <div class="field-row">
          <div class="field">
            <label for="scPreset">Component</label>
            <select id="scPreset">${options}</select>
          </div>
          <div class="field">
            <label>Status</label>
            <div class="seg" id="scStatusSeg" role="group" aria-label="Status">
              <button type="button" data-val="Active" aria-pressed="${f.status === "Active"}">Active</button>
              <button type="button" data-val="Inactive" aria-pressed="${f.status === "Inactive"}">Inactive</button>
            </div>
          </div>
        </div>
        <p class="section-note" style="margin-top:8px">${f.description}</p>
        <div style="display:flex; gap:6px; margin-top:8px;">
          <span class="tally">Countable as tax component <strong>${f.countableAsTaxComponent ? "yes" : "no"}</strong></span>
          <span class="tally">Pro-rata <strong>${f.proRataEnabled ? "yes" : "no"}</strong></span>
        </div>

        <div class="setup-actions" style="flex-direction:row; align-items:center;">
          <button type="button" class="tiny-btn" id="scRegenerateBtn">↻ Regenerate</button>
          <button type="button" class="generate-btn" id="scSaveBtn">Save to ${ENVIRONMENTS[setup.env].label}</button>
        </div>
        <span class="error-text" id="scError">${salaryComponent.error}</span>
        ${salaryComponent.ok ? `<div style="display:flex; gap:9px; align-items:center; margin-top:10px; color:var(--success); font-size:13px; font-weight:600;">${iconCheck()}${salaryComponent.ok}</div>` : ""}
        ${createdListHtml(salaryComponent.createdNames)}
      </div>
    `;
  }

  async function saveSalaryComponent(fields) {
    const env = ENVIRONMENTS[setup.env];
    let res;
    try {
      res = await fetch(`${env.apiBase}/payroll/configuration/salary-components`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${setup.companyToken}` },
        body: JSON.stringify(fields),
      });
    } catch (e) {
      throw new Error(`Couldn't reach ${env.label}.`);
    }
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) throw new Error('Your session with this company may have expired — use "Disconnect this company" above and sign in again.');
    if (res.status !== 201) throw new Error(data.message || "The server rejected this.");
    return data;
  }

  function wireSalaryComponentEvents() {
    $("#scPreset").addEventListener("change", (e) => {
      salaryComponent.presetIdx = Number(e.target.value);
      salaryComponent.fields = generateSalaryComponentFields(salaryComponent.presetIdx);
      $("#setupBody").innerHTML = setupGroupPageTemplate();
      wireSetupGroupPage();
    });

    $all("#scStatusSeg button").forEach((btn) =>
      btn.addEventListener("click", () => {
        salaryComponent.fields.status = btn.dataset.val;
        $("#setupBody").innerHTML = setupGroupPageTemplate();
        wireSetupGroupPage();
      })
    );

    $("#scRegenerateBtn").addEventListener("click", () => {
      salaryComponent.fields = generateSalaryComponentFields(salaryComponent.presetIdx);
      salaryComponent.error = "";
      salaryComponent.ok = "";
      $("#setupBody").innerHTML = setupGroupPageTemplate();
      wireSetupGroupPage();
    });

    const btn = $("#scSaveBtn");
    btn.addEventListener("click", async () => {
      salaryComponent.error = "";
      salaryComponent.ok = "";
      setBtnBusy(btn);
      try {
        await saveSalaryComponent(salaryComponent.fields);
        salaryComponent.ok = "Saved.";
        salaryComponent.createdNames.push(salaryComponent.fields.name);
        setup.doneModules.add("salary_components");
        companySalaryStructure.components = null;
      } catch (e) {
        salaryComponent.error = e.message;
      }
      $("#setupBody").innerHTML = setupGroupPageTemplate();
      wireSetupGroupPage();
    });
  }

  /* ---------- Configure Salary Components — PUT /payroll/configuration/non-paygrade-structure ----------
     The third real dependency: needs at least 2 Active salary components,
     same "throw without it" rule the collection enforces on itself. */
  const companySalaryStructure = { components: null, loadError: "", fields: null, error: "", ok: "" };

  async function loadSalaryStructureDependency() {
    try {
      const all = await fetchCompanyResource("/payroll/configuration/salary-components?status=Active&limit=100");
      companySalaryStructure.components = (all || []).filter((c) => c.status === "Active");
    } catch (e) {
      companySalaryStructure.components = null;
      companySalaryStructure.loadError = e.message;
    }
  }

  function generateSalaryStructureFields(components) {
    const split = choice(SALARY_STRUCTURE_SPLITS);
    const picked = shuffle(components).slice(0, 2);
    return {
      basicSalaryPercentage: split.basic,
      proRataEnabled: true,
      components: [
        { salaryComponentId: picked[0].id, percentage: split.c1 },
        { salaryComponentId: picked[1].id, percentage: split.c2 },
      ],
      deletedComponentIds: [],
    };
  }

  function salaryStructureTemplate() {
    const head = `<div class="section-head"><h2 class="section-title"><span class="section-num">3</span>Configure Salary Components</h2></div>`;
    if (companySalaryStructure.loadError) {
      return `
        <div class="section">
          ${head}
          <span class="error-text">${companySalaryStructure.loadError}</span>
          <div class="setup-actions" style="margin-top:10px"><button type="button" class="tiny-btn" id="ssRetryBtn">Try again</button></div>
        </div>
      `;
    }
    if (companySalaryStructure.components === null) {
      return `<div class="section">${head}<p class="section-note">Checking this company's salary components…</p></div>`;
    }
    if (companySalaryStructure.components.length < 2) {
      return `
        <div class="section">
          ${head}
          <p class="section-note">A non-paygrade structure splits basic salary across at least 2 active salary components — this company has ${companySalaryStructure.components.length} so far.</p>
          ${dependencyNoticeHtml("second Active Salary Component", "payroll", "salary_components")}
        </div>
      `;
    }
    if (!companySalaryStructure.fields) companySalaryStructure.fields = generateSalaryStructureFields(companySalaryStructure.components);
    const f = companySalaryStructure.fields;
    const nameFor = (id) => (companySalaryStructure.components.find((c) => c.id === id) || {}).name || id;
    return `
      <div class="section">
        ${head}
        <p class="section-note">Generated from the muggle-friendly magic scroll's own split table — basic and the two components always sum to 100%. Regenerate re-rolls the split and which two components are used.</p>
        <div style="display:flex; flex-wrap:wrap; gap:6px;">
          <span class="tally">Basic <strong>${f.basicSalaryPercentage}%</strong></span>
          <span class="tally">${nameFor(f.components[0].salaryComponentId)} <strong>${f.components[0].percentage}%</strong></span>
          <span class="tally">${nameFor(f.components[1].salaryComponentId)} <strong>${f.components[1].percentage}%</strong></span>
        </div>

        <div class="setup-actions" style="flex-direction:row; align-items:center;">
          <button type="button" class="tiny-btn" id="ssRegenerateBtn">↻ Regenerate</button>
          <button type="button" class="generate-btn" id="ssSaveBtn">Save to ${ENVIRONMENTS[setup.env].label}</button>
        </div>
        <span class="error-text" id="ssError">${companySalaryStructure.error}</span>
        ${companySalaryStructure.ok ? `<div style="display:flex; gap:9px; align-items:center; margin-top:10px; color:var(--success); font-size:13px; font-weight:600;">${iconCheck()}${companySalaryStructure.ok}</div>` : ""}
      </div>
    `;
  }

  async function saveSalaryStructure(fields) {
    const env = ENVIRONMENTS[setup.env];
    let res;
    try {
      res = await fetch(`${env.apiBase}/payroll/configuration/non-paygrade-structure`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${setup.companyToken}` },
        body: JSON.stringify(fields),
      });
    } catch (e) {
      throw new Error(`Couldn't reach ${env.label}.`);
    }
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) throw new Error('Your session with this company may have expired — use "Disconnect this company" above and sign in again.');
    if (res.status !== 200 && res.status !== 201) throw new Error(data.message || "The server rejected this.");
    return data;
  }

  function wireSalaryStructureEvents() {
    if (companySalaryStructure.components === null && !companySalaryStructure.loadError) {
      loadSalaryStructureDependency().then(() => {
        $("#setupBody").innerHTML = setupGroupPageTemplate();
        wireSetupGroupPage();
      });
      return;
    }
    const retryBtn = $("#ssRetryBtn");
    if (retryBtn) {
      retryBtn.addEventListener("click", () => {
        companySalaryStructure.loadError = "";
        companySalaryStructure.components = null;
        $("#setupBody").innerHTML = setupGroupPageTemplate();
        wireSetupGroupPage();
      });
      return;
    }
    if (!companySalaryStructure.components || companySalaryStructure.components.length < 2) return; // .dep-shortcut wired centrally

    $("#ssRegenerateBtn").addEventListener("click", () => {
      companySalaryStructure.fields = generateSalaryStructureFields(companySalaryStructure.components);
      companySalaryStructure.error = "";
      companySalaryStructure.ok = "";
      $("#setupBody").innerHTML = setupGroupPageTemplate();
      wireSetupGroupPage();
    });

    const btn = $("#ssSaveBtn");
    btn.addEventListener("click", async () => {
      companySalaryStructure.error = "";
      companySalaryStructure.ok = "";
      setBtnBusy(btn);
      try {
        await saveSalaryStructure(companySalaryStructure.fields);
        companySalaryStructure.ok = "Saved.";
        setup.doneModules.add("configure_salary_components");
      } catch (e) {
        companySalaryStructure.error = e.message;
      }
      $("#setupBody").innerHTML = setupGroupPageTemplate();
      wireSetupGroupPage();
    });
  }

  /* ---------- Late Arrival, Absent Deduction — both need ≥1 Leave Type ---------- */
  const lateArrival = { leaveTypes: null, loadError: "", fields: null, error: "", ok: "" };
  const absentDeduction = { leaveTypes: null, loadError: "", fields: null, error: "", ok: "" };

  function generateLateArrivalFields(leaveTypes) {
    const lt = choice(leaveTypes);
    const latePenaltyEnabled = Math.random() < 0.5;
    return {
      lateThresholdEnabled: true,
      monthlyLateLimit: randInt(3, 7),
      latePenaltyEnabled,
      repeatedLatePenaltyEnabled: !latePenaltyEnabled,
      latePenaltyThresholdDays: randInt(2, 5),
      latePenaltyDeductionType: choice(["Salary", "Leave"]),
      latePenaltyLeaveType: lt.id,
      latePenaltySalaryType: choice(PAYROLL_SALARY_BASIS_OPTIONS),
      _leaveTypeName: lt.name,
    };
  }

  function lateArrivalTemplate() {
    const head = `<div class="section-head"><h2 class="section-title"><span class="section-num">4</span>Late Arrival</h2></div>`;
    if (lateArrival.loadError) {
      return `<div class="section">${head}<span class="error-text">${lateArrival.loadError}</span><div class="setup-actions" style="margin-top:10px"><button type="button" class="tiny-btn" id="laRetryBtn">Try again</button></div></div>`;
    }
    if (lateArrival.leaveTypes === null) {
      return `<div class="section">${head}<p class="section-note">Checking this company's leave types…</p></div>`;
    }
    if (lateArrival.leaveTypes.length === 0) {
      return `<div class="section">${head}<p class="section-note">Late arrival can deduct from a leave type — this company doesn't have any yet.</p>${dependencyNoticeHtml("Leave Type", "leave", "leave_types")}</div>`;
    }
    if (!lateArrival.fields) lateArrival.fields = generateLateArrivalFields(lateArrival.leaveTypes);
    const f = lateArrival.fields;
    return `
      <div class="section">
        ${head}
        <p class="section-note">Generated from the muggle-friendly magic scroll's own late-arrival rule — deduction type, its two enable flags and the deduction basis all follow the scroll's own logic.</p>
        <div style="display:flex; flex-wrap:wrap; gap:6px;">
          <span class="tally">Monthly late limit <strong>${f.monthlyLateLimit}</strong></span>
          <span class="tally">${f.latePenaltyEnabled ? "Late penalty" : "Repeated late penalty"} <strong>enabled</strong></span>
          <span class="tally">Threshold <strong>${f.latePenaltyThresholdDays} days</strong></span>
          <span class="tally">Deduction type <strong>${f.latePenaltyDeductionType}</strong></span>
          <span class="tally">Leave type <strong>${f._leaveTypeName}</strong></span>
        </div>

        <div class="setup-actions" style="flex-direction:row; align-items:center;">
          <button type="button" class="tiny-btn" id="laRegenerateBtn">↻ Regenerate</button>
          <button type="button" class="generate-btn" id="laSaveBtn">Save to ${ENVIRONMENTS[setup.env].label}</button>
        </div>
        <span class="error-text" id="laError">${lateArrival.error}</span>
        ${lateArrival.ok ? `<div style="display:flex; gap:9px; align-items:center; margin-top:10px; color:var(--success); font-size:13px; font-weight:600;">${iconCheck()}${lateArrival.ok}</div>` : ""}
      </div>
    `;
  }

  async function saveLateArrival(fields) {
    const env = ENVIRONMENTS[setup.env];
    const { _leaveTypeName, ...body } = fields;
    let res;
    try {
      res = await fetch(`${env.apiBase}/payroll/configuration/deduction-settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${setup.companyToken}` },
        body: JSON.stringify(body),
      });
    } catch (e) {
      throw new Error(`Couldn't reach ${env.label}.`);
    }
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) throw new Error('Your session with this company may have expired — use "Disconnect this company" above and sign in again.');
    if (res.status !== 201) throw new Error(data.message || "The server rejected this.");
    return data;
  }

  function wireLateArrivalEvents() {
    if (lateArrival.leaveTypes === null && !lateArrival.loadError) {
      loadLeaveTypeDependencyInto(lateArrival).then(() => {
        $("#setupBody").innerHTML = setupGroupPageTemplate();
        wireSetupGroupPage();
      });
      return;
    }
    const retryBtn = $("#laRetryBtn");
    if (retryBtn) {
      retryBtn.addEventListener("click", () => {
        lateArrival.loadError = "";
        lateArrival.leaveTypes = null;
        $("#setupBody").innerHTML = setupGroupPageTemplate();
        wireSetupGroupPage();
      });
      return;
    }
    if (!lateArrival.leaveTypes || lateArrival.leaveTypes.length === 0) return;

    $("#laRegenerateBtn").addEventListener("click", () => {
      lateArrival.fields = generateLateArrivalFields(lateArrival.leaveTypes);
      lateArrival.error = "";
      lateArrival.ok = "";
      $("#setupBody").innerHTML = setupGroupPageTemplate();
      wireSetupGroupPage();
    });

    const btn = $("#laSaveBtn");
    btn.addEventListener("click", async () => {
      lateArrival.error = "";
      lateArrival.ok = "";
      setBtnBusy(btn);
      try {
        await saveLateArrival(lateArrival.fields);
        lateArrival.ok = "Saved.";
        setup.doneModules.add("late_arrival");
      } catch (e) {
        lateArrival.error = e.message;
      }
      $("#setupBody").innerHTML = setupGroupPageTemplate();
      wireSetupGroupPage();
    });
  }

  /* Shared by Late Arrival and Absent Deduction — both need the same
     "at least one leave type exists" check, fetched independently so
     each module's cache invalidates on its own schedule. */
  async function loadLeaveTypeDependencyInto(state) {
    try {
      state.leaveTypes = await fetchCompanyResource("/leave-types");
    } catch (e) {
      state.leaveTypes = null;
      state.loadError = e.message;
    }
  }

  function generateAbsentDeductionFields(leaveTypes) {
    const lt = choice(leaveTypes);
    const repeatedAbsentPenaltyEnabled = Math.random() < 0.5;
    return {
      enabled: true,
      ruleBasedOn: repeatedAbsentPenaltyEnabled ? "consecutive_absent_days" : "total_absent_days",
      thresholdDays: randInt(2, 5),
      absentDeductionType: choice(["salary_deduction", "leave_deduction"]),
      absentDeductionSalaryBasis: choice(PAYROLL_SALARY_BASIS_OPTIONS),
      absentDeductionLeaveType: lt.id,
      _leaveTypeName: lt.name,
    };
  }

  function absentDeductionTemplate() {
    const head = `<div class="section-head"><h2 class="section-title"><span class="section-num">5</span>Absent Deduction</h2></div>`;
    if (absentDeduction.loadError) {
      return `<div class="section">${head}<span class="error-text">${absentDeduction.loadError}</span><div class="setup-actions" style="margin-top:10px"><button type="button" class="tiny-btn" id="adRetryBtn">Try again</button></div></div>`;
    }
    if (absentDeduction.leaveTypes === null) {
      return `<div class="section">${head}<p class="section-note">Checking this company's leave types…</p></div>`;
    }
    if (absentDeduction.leaveTypes.length === 0) {
      return `<div class="section">${head}<p class="section-note">Absent deduction can deduct from a leave type — this company doesn't have any yet.</p>${dependencyNoticeHtml("Leave Type", "leave", "leave_types")}</div>`;
    }
    if (!absentDeduction.fields) absentDeduction.fields = generateAbsentDeductionFields(absentDeduction.leaveTypes);
    const f = absentDeduction.fields;
    return `
      <div class="section">
        ${head}
        <p class="section-note">Generated from the muggle-friendly magic scroll's own absent-deduction rule.</p>
        <div style="display:flex; flex-wrap:wrap; gap:6px;">
          <span class="tally">Rule based on <strong>${f.ruleBasedOn.replace(/_/g, " ")}</strong></span>
          <span class="tally">Threshold <strong>${f.thresholdDays} days</strong></span>
          <span class="tally">Deduction type <strong>${f.absentDeductionType.replace(/_/g, " ")}</strong></span>
          <span class="tally">Leave type <strong>${f._leaveTypeName}</strong></span>
        </div>

        <div class="setup-actions" style="flex-direction:row; align-items:center;">
          <button type="button" class="tiny-btn" id="adRegenerateBtn">↻ Regenerate</button>
          <button type="button" class="generate-btn" id="adSaveBtn">Save to ${ENVIRONMENTS[setup.env].label}</button>
        </div>
        <span class="error-text" id="adError">${absentDeduction.error}</span>
        ${absentDeduction.ok ? `<div style="display:flex; gap:9px; align-items:center; margin-top:10px; color:var(--success); font-size:13px; font-weight:600;">${iconCheck()}${absentDeduction.ok}</div>` : ""}
      </div>
    `;
  }

  async function saveAbsentDeduction(fields) {
    const env = ENVIRONMENTS[setup.env];
    const { _leaveTypeName, ...body } = fields;
    let res;
    try {
      res = await fetch(`${env.apiBase}/payroll/configuration/absent-deduction-settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${setup.companyToken}` },
        body: JSON.stringify(body),
      });
    } catch (e) {
      throw new Error(`Couldn't reach ${env.label}.`);
    }
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) throw new Error('Your session with this company may have expired — use "Disconnect this company" above and sign in again.');
    if (res.status !== 201) throw new Error(data.message || "The server rejected this.");
    return data;
  }

  function wireAbsentDeductionEvents() {
    if (absentDeduction.leaveTypes === null && !absentDeduction.loadError) {
      loadLeaveTypeDependencyInto(absentDeduction).then(() => {
        $("#setupBody").innerHTML = setupGroupPageTemplate();
        wireSetupGroupPage();
      });
      return;
    }
    const retryBtn = $("#adRetryBtn");
    if (retryBtn) {
      retryBtn.addEventListener("click", () => {
        absentDeduction.loadError = "";
        absentDeduction.leaveTypes = null;
        $("#setupBody").innerHTML = setupGroupPageTemplate();
        wireSetupGroupPage();
      });
      return;
    }
    if (!absentDeduction.leaveTypes || absentDeduction.leaveTypes.length === 0) return;

    $("#adRegenerateBtn").addEventListener("click", () => {
      absentDeduction.fields = generateAbsentDeductionFields(absentDeduction.leaveTypes);
      absentDeduction.error = "";
      absentDeduction.ok = "";
      $("#setupBody").innerHTML = setupGroupPageTemplate();
      wireSetupGroupPage();
    });

    const btn = $("#adSaveBtn");
    btn.addEventListener("click", async () => {
      absentDeduction.error = "";
      absentDeduction.ok = "";
      setBtnBusy(btn);
      try {
        await saveAbsentDeduction(absentDeduction.fields);
        absentDeduction.ok = "Saved.";
        setup.doneModules.add("absent_deduction");
      } catch (e) {
        absentDeduction.error = e.message;
      }
      $("#setupBody").innerHTML = setupGroupPageTemplate();
      wireSetupGroupPage();
    });
  }

  /* ---------- Bonus Types — POST /bonus/configuration/types ---------- */
  const bonusType = { presetIdx: 0, fields: null, error: "", ok: "", createdNames: [] };

  function generateBonusTypeFields(presetIdx) {
    const preset = BONUS_TYPE_PRESETS[presetIdx];
    return { typeName: preset.typeName, status: preset.status, icon: choice(BONUS_TYPE_ICON_OPTIONS), description: preset.description };
  }

  function bonusTypeTemplate() {
    const head = `<div class="section-head"><h2 class="section-title"><span class="section-num">6</span>Bonus Types</h2></div>`;
    if (!bonusType.fields) bonusType.fields = generateBonusTypeFields(bonusType.presetIdx);
    const f = bonusType.fields;
    const options = BONUS_TYPE_PRESETS.map((p, i) => `<option value="${i}" ${i === bonusType.presetIdx ? "selected" : ""}>${p.typeName}</option>`).join("");
    return `
      <div class="section">
        ${head}
        <p class="section-note">The muggle-friendly magic scroll's own 4 fixed bonus types, one request each — only the icon is randomised.</p>
        <div class="field-row">
          <div class="field"><label for="btPreset">Bonus Type</label><select id="btPreset">${options}</select></div>
        </div>
        <p class="section-note" style="margin-top:8px">${f.description}</p>
        <div style="display:flex; gap:6px; margin-top:8px;">
          <span class="tally">Status <strong>${f.status}</strong></span>
          <span class="tally">Icon <strong>${f.icon}</strong></span>
        </div>

        <div class="setup-actions" style="flex-direction:row; align-items:center;">
          <button type="button" class="tiny-btn" id="btRegenerateBtn">↻ Regenerate</button>
          <button type="button" class="generate-btn" id="btSaveBtn">Save to ${ENVIRONMENTS[setup.env].label}</button>
        </div>
        <span class="error-text" id="btError">${bonusType.error}</span>
        ${bonusType.ok ? `<div style="display:flex; gap:9px; align-items:center; margin-top:10px; color:var(--success); font-size:13px; font-weight:600;">${iconCheck()}${bonusType.ok}</div>` : ""}
        ${createdListHtml(bonusType.createdNames)}
      </div>
    `;
  }

  async function saveBonusType(fields) {
    const env = ENVIRONMENTS[setup.env];
    let res;
    try {
      res = await fetch(`${env.apiBase}/bonus/configuration/types`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${setup.companyToken}` },
        body: JSON.stringify(fields),
      });
    } catch (e) {
      throw new Error(`Couldn't reach ${env.label}.`);
    }
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) throw new Error('Your session with this company may have expired — use "Disconnect this company" above and sign in again.');
    if (res.status !== 201) throw new Error(data.message || "The server rejected this.");
    return data;
  }

  function wireBonusTypeEvents() {
    $("#btPreset").addEventListener("change", (e) => {
      bonusType.presetIdx = Number(e.target.value);
      bonusType.fields = generateBonusTypeFields(bonusType.presetIdx);
      $("#setupBody").innerHTML = setupGroupPageTemplate();
      wireSetupGroupPage();
    });

    $("#btRegenerateBtn").addEventListener("click", () => {
      bonusType.fields = generateBonusTypeFields(bonusType.presetIdx);
      bonusType.error = "";
      bonusType.ok = "";
      $("#setupBody").innerHTML = setupGroupPageTemplate();
      wireSetupGroupPage();
    });

    const btn = $("#btSaveBtn");
    btn.addEventListener("click", async () => {
      bonusType.error = "";
      bonusType.ok = "";
      setBtnBusy(btn);
      try {
        await saveBonusType(bonusType.fields);
        bonusType.ok = "Saved.";
        bonusType.createdNames.push(bonusType.fields.typeName);
        setup.doneModules.add("bonus_types");
        bonusPolicy.bonusTypes = null;
      } catch (e) {
        bonusType.error = e.message;
      }
      $("#setupBody").innerHTML = setupGroupPageTemplate();
      wireSetupGroupPage();
    });
  }

  /* ---------- Bonus Policy — POST /bonus/configuration/policies ----------
     The fourth real dependency: needs at least one Bonus Type. */
  const bonusPolicy = { bonusTypes: null, loadError: "", fields: null, error: "", ok: "", createdNames: [] };

  async function loadBonusPolicyDependency() {
    try {
      bonusPolicy.bonusTypes = await fetchCompanyResource("/bonus/configuration/types");
    } catch (e) {
      bonusPolicy.bonusTypes = null;
      bonusPolicy.loadError = e.message;
    }
  }

  function generateBonusPolicyFields(bonusTypes) {
    const bt = choice(bonusTypes);
    const tenureEnabled = weightedChoice(BONUS_POLICY_TENURE_ENABLED);
    const f = {
      name: choice(BONUS_POLICY_NAMES),
      bonusTypeId: bt.id,
      calculationBasis: "Gross",
      bonusPercentage: choice([25, 50, 100]),
      paymentMethod: weightedChoice(BONUS_POLICY_PAYMENT_METHODS),
      departmentIds: [],
      employmentStatuses: [],
      tenureEnabled,
      gradeLevelEnabled: false,
      _bonusTypeName: bt.typeName,
    };
    if (tenureEnabled) {
      const unit = weightedChoice(BONUS_POLICY_TENURE_UNITS);
      f.minimumTenureUnit = unit;
      f.minimumTenureValue = unit === "months" ? choice([3, 6]) : unit === "days" ? choice([90, 180]) : 1;
    }
    return f;
  }

  function bonusPolicyTemplate() {
    const head = `<div class="section-head"><h2 class="section-title"><span class="section-num">7</span>Bonus Policy</h2></div>`;
    if (bonusPolicy.loadError) {
      return `<div class="section">${head}<span class="error-text">${bonusPolicy.loadError}</span><div class="setup-actions" style="margin-top:10px"><button type="button" class="tiny-btn" id="bpRetryBtn">Try again</button></div></div>`;
    }
    if (bonusPolicy.bonusTypes === null) {
      return `<div class="section">${head}<p class="section-note">Checking this company's bonus types…</p></div>`;
    }
    if (bonusPolicy.bonusTypes.length === 0) {
      return `<div class="section">${head}<p class="section-note">A policy attaches to a bonus type — this company doesn't have any yet.</p>${dependencyNoticeHtml("Bonus Type", "payroll", "bonus_types")}</div>`;
    }
    if (!bonusPolicy.fields) bonusPolicy.fields = generateBonusPolicyFields(bonusPolicy.bonusTypes);
    const f = bonusPolicy.fields;
    return `
      <div class="section">
        ${head}
        <p class="section-note">Generated from the muggle-friendly magic scroll's own policy rule, drawing on this company's real bonus types. Name and bonus percentage can still be edited by hand before saving.</p>
        <div class="field-row">
          <div class="field"><label for="bpName">Name</label><input type="text" id="bpName" value="${f.name}" /></div>
          <div class="field"><label for="bpPercentage">Bonus %</label><input type="number" id="bpPercentage" value="${f.bonusPercentage}" min="1" max="200" /></div>
        </div>
        <div style="display:flex; flex-wrap:wrap; gap:6px; margin-top:8px;">
          <span class="tally">Bonus type <strong>${f._bonusTypeName}</strong></span>
          <span class="tally">Basis <strong>${f.calculationBasis}</strong></span>
          <span class="tally">Payment method <strong>${f.paymentMethod.replace(/_/g, " ")}</strong></span>
          ${f.tenureEnabled ? `<span class="tally">Min. tenure <strong>${f.minimumTenureValue} ${f.minimumTenureUnit}</strong></span>` : ""}
        </div>

        <div class="setup-actions" style="flex-direction:row; align-items:center;">
          <button type="button" class="tiny-btn" id="bpRegenerateBtn">↻ Regenerate</button>
          <button type="button" class="generate-btn" id="bpSaveBtn">Save to ${ENVIRONMENTS[setup.env].label}</button>
        </div>
        <span class="error-text" id="bpError">${bonusPolicy.error}</span>
        ${bonusPolicy.ok ? `<div style="display:flex; gap:9px; align-items:center; margin-top:10px; color:var(--success); font-size:13px; font-weight:600;">${iconCheck()}${bonusPolicy.ok}</div>` : ""}
        ${createdListHtml(bonusPolicy.createdNames)}
      </div>
    `;
  }

  function readBonusPolicyForm() {
    const { _bonusTypeName, ...rest } = bonusPolicy.fields;
    return { ...rest, name: $("#bpName").value, bonusPercentage: Number($("#bpPercentage").value) };
  }

  async function saveBonusPolicy(fields) {
    const env = ENVIRONMENTS[setup.env];
    let res;
    try {
      res = await fetch(`${env.apiBase}/bonus/configuration/policies`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${setup.companyToken}` },
        body: JSON.stringify(fields),
      });
    } catch (e) {
      throw new Error(`Couldn't reach ${env.label}.`);
    }
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) throw new Error('Your session with this company may have expired — use "Disconnect this company" above and sign in again.');
    if (res.status !== 201) throw new Error(data.message || "The server rejected this.");
    return data;
  }

  function wireBonusPolicyEvents() {
    if (bonusPolicy.bonusTypes === null && !bonusPolicy.loadError) {
      loadBonusPolicyDependency().then(() => {
        $("#setupBody").innerHTML = setupGroupPageTemplate();
        wireSetupGroupPage();
      });
      return;
    }
    const retryBtn = $("#bpRetryBtn");
    if (retryBtn) {
      retryBtn.addEventListener("click", () => {
        bonusPolicy.loadError = "";
        bonusPolicy.bonusTypes = null;
        $("#setupBody").innerHTML = setupGroupPageTemplate();
        wireSetupGroupPage();
      });
      return;
    }
    if (!bonusPolicy.bonusTypes || bonusPolicy.bonusTypes.length === 0) return;

    $("#bpRegenerateBtn").addEventListener("click", () => {
      bonusPolicy.fields = generateBonusPolicyFields(bonusPolicy.bonusTypes);
      bonusPolicy.error = "";
      bonusPolicy.ok = "";
      $("#setupBody").innerHTML = setupGroupPageTemplate();
      wireSetupGroupPage();
    });

    const btn = $("#bpSaveBtn");
    btn.addEventListener("click", async () => {
      bonusPolicy.error = "";
      bonusPolicy.ok = "";
      const fields = readBonusPolicyForm();
      setBtnBusy(btn);
      try {
        await saveBonusPolicy(fields);
        bonusPolicy.fields = { ...fields, _bonusTypeName: bonusPolicy.fields._bonusTypeName };
        bonusPolicy.ok = "Saved.";
        bonusPolicy.createdNames.push(fields.name);
        setup.doneModules.add("bonus_policy");
      } catch (e) {
        bonusPolicy.error = e.message;
      }
      $("#setupBody").innerHTML = setupGroupPageTemplate();
      wireSetupGroupPage();
    });
  }

  /* ---------- Overtime — POST /payroll/configuration/overtime ---------- */
  const overtime = { fields: null, error: "", ok: "" };

  function buildOvertimeCalcFields(target, rateType) {
    const calculationType = weightedChoice(OVERTIME_CALCULATION_TYPES);
    target.calculationType = calculationType;
    if (calculationType === "Fixed Rate") {
      target.fixedRate = choice(OVERTIME_FIXED_RATE_RANGES[rateType]);
    } else {
      target.multiplier = choice(OVERTIME_MULTIPLIERS);
      target.basedOn = choice(OVERTIME_BASED_ON);
    }
  }

  function buildSpecialOvertimeBlock(rateType) {
    const overtimeEnabled = weightedChoice(OVERTIME_SPECIAL_ENABLED);
    if (overtimeEnabled === "Disable") return { overtimeEnabled: "Disable" };
    const block = { overtimeEnabled: "Enable", dailyHourLimit: choice([6, 8]) };
    buildOvertimeCalcFields(block, rateType);
    return block;
  }

  function generateOvertimeFields() {
    const regularDailyHourLimit = choice([3, 4, 5]);
    const defaultBlock = { dailyHourLimit: regularDailyHourLimit, monthlyHourLimit: regularDailyHourLimit * 20 };
    buildOvertimeCalcFields(defaultBlock, "regular");
    return {
      overtimeEnabled: "Enable",
      default: defaultBlock,
      weekend: buildSpecialOvertimeBlock("weekend"),
      holiday: buildSpecialOvertimeBlock("holiday"),
    };
  }

  function overtimeSummaryChip(label, block) {
    if (block.overtimeEnabled === "Disable") return `<span class="tally">${label} <strong>Disabled</strong></span>`;
    const rate = block.calculationType === "Fixed Rate" ? `৳${block.fixedRate}/hr` : `${block.multiplier}x ${block.basedOn}`;
    return `<span class="tally">${label} <strong>${rate}</strong></span>`;
  }

  function overtimeTemplate() {
    const head = `<div class="section-head"><h2 class="section-title"><span class="section-num">8</span>Overtime</h2></div>`;
    if (!overtime.fields) overtime.fields = generateOvertimeFields();
    const f = overtime.fields;
    return `
      <div class="section">
        ${head}
        <p class="section-note">Generated from the muggle-friendly magic scroll's own overtime rules — regular overtime is always on; weekend and holiday are independently randomised, each 80% likely enabled.</p>
        <div style="display:flex; flex-wrap:wrap; gap:6px;">
          ${overtimeSummaryChip("Regular", f.default)}
          ${overtimeSummaryChip("Weekend", f.weekend)}
          ${overtimeSummaryChip("Holiday", f.holiday)}
        </div>

        <div class="setup-actions" style="flex-direction:row; align-items:center;">
          <button type="button" class="tiny-btn" id="otRegenerateBtn">↻ Regenerate</button>
          <button type="button" class="generate-btn" id="otSaveBtn">Save to ${ENVIRONMENTS[setup.env].label}</button>
        </div>
        <span class="error-text" id="otError">${overtime.error}</span>
        ${overtime.ok ? `<div style="display:flex; gap:9px; align-items:center; margin-top:10px; color:var(--success); font-size:13px; font-weight:600;">${iconCheck()}${overtime.ok}</div>` : ""}
      </div>
    `;
  }

  async function saveOvertime(fields) {
    const env = ENVIRONMENTS[setup.env];
    let res;
    try {
      res = await fetch(`${env.apiBase}/payroll/configuration/overtime`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${setup.companyToken}` },
        body: JSON.stringify(fields),
      });
    } catch (e) {
      throw new Error(`Couldn't reach ${env.label}.`);
    }
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) throw new Error('Your session with this company may have expired — use "Disconnect this company" above and sign in again.');
    if (res.status !== 201) throw new Error(data.message || "The server rejected this.");
    return data;
  }

  function wireOvertimeEvents() {
    $("#otRegenerateBtn").addEventListener("click", () => {
      overtime.fields = generateOvertimeFields();
      overtime.error = "";
      overtime.ok = "";
      $("#setupBody").innerHTML = setupGroupPageTemplate();
      wireSetupGroupPage();
    });

    const btn = $("#otSaveBtn");
    btn.addEventListener("click", async () => {
      overtime.error = "";
      overtime.ok = "";
      setBtnBusy(btn);
      try {
        await saveOvertime(overtime.fields);
        overtime.ok = "Saved.";
        setup.doneModules.add("overtime");
      } catch (e) {
        overtime.error = e.message;
      }
      $("#setupBody").innerHTML = setupGroupPageTemplate();
      wireSetupGroupPage();
    });
  }

  /* ---------- Attendance Bonus — POST /payroll/configuration/attendance-bonus ---------- */
  const attendanceBonusCfg = { fields: null, error: "", ok: "" };

  function generateAttendanceBonusFields() {
    const bonusCountOnType = weightedChoice(ATTENDANCE_BONUS_COUNT_ON_TYPES);
    const bonusCountOnValue = bonusCountOnType === "Percentage" ? choice(ATTENDANCE_BONUS_PERCENTAGE_VALUES) : choice(ATTENDANCE_BONUS_DAYS_VALUES);
    const calculationType = weightedChoice(ATTENDANCE_BONUS_CALCULATION_TYPES);
    const calculations = { enabled: "Disable", calculationType };
    if (calculationType === "Fixed Rate") {
      calculations.fixedRate = choice(ATTENDANCE_BONUS_FIXED_RATES);
      calculations.percentage = null;
      calculations.basedOn = null;
    } else {
      calculations.fixedRate = null;
      calculations.percentage = choice(ATTENDANCE_BONUS_PERCENTAGES);
      calculations.basedOn = choice(OVERTIME_BASED_ON);
    }
    return { attendanceBonusEnabled: "Enable", bonusCountOn: { type: bonusCountOnType, value: bonusCountOnValue }, calculations };
  }

  function attendanceBonusTemplate() {
    const head = `<div class="section-head"><h2 class="section-title"><span class="section-num">9</span>Attendance Bonus</h2></div>`;
    if (!attendanceBonusCfg.fields) attendanceBonusCfg.fields = generateAttendanceBonusFields();
    const f = attendanceBonusCfg.fields;
    const calcSummary = f.calculations.calculationType === "Fixed Rate" ? `৳${f.calculations.fixedRate}` : `${f.calculations.percentage}% of ${f.calculations.basedOn}`;
    return `
      <div class="section">
        ${head}
        <p class="section-note">Generated from the muggle-friendly magic scroll's own attendance-bonus rules. Note: the scroll itself always sends the calculation block's own "enabled" flag as Disable regardless of the outer toggle — kept as-is rather than corrected, since matching the scroll matters more than assuming it's a typo.</p>
        <div style="display:flex; flex-wrap:wrap; gap:6px;">
          <span class="tally">Counted on <strong>${f.bonusCountOn.type} · ${f.bonusCountOn.value}${f.bonusCountOn.type === "Percentage" ? "%" : " days"}</strong></span>
          <span class="tally">Calculation <strong>${calcSummary}</strong></span>
        </div>

        <div class="setup-actions" style="flex-direction:row; align-items:center;">
          <button type="button" class="tiny-btn" id="abRegenerateBtn">↻ Regenerate</button>
          <button type="button" class="generate-btn" id="abSaveBtn">Save to ${ENVIRONMENTS[setup.env].label}</button>
        </div>
        <span class="error-text" id="abError">${attendanceBonusCfg.error}</span>
        ${attendanceBonusCfg.ok ? `<div style="display:flex; gap:9px; align-items:center; margin-top:10px; color:var(--success); font-size:13px; font-weight:600;">${iconCheck()}${attendanceBonusCfg.ok}</div>` : ""}
      </div>
    `;
  }

  async function saveAttendanceBonus(fields) {
    const env = ENVIRONMENTS[setup.env];
    let res;
    try {
      res = await fetch(`${env.apiBase}/payroll/configuration/attendance-bonus`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${setup.companyToken}` },
        body: JSON.stringify(fields),
      });
    } catch (e) {
      throw new Error(`Couldn't reach ${env.label}.`);
    }
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) throw new Error('Your session with this company may have expired — use "Disconnect this company" above and sign in again.');
    if (res.status !== 201) throw new Error(data.message || "The server rejected this.");
    return data;
  }

  function wireAttendanceBonusEvents() {
    $("#abRegenerateBtn").addEventListener("click", () => {
      attendanceBonusCfg.fields = generateAttendanceBonusFields();
      attendanceBonusCfg.error = "";
      attendanceBonusCfg.ok = "";
      $("#setupBody").innerHTML = setupGroupPageTemplate();
      wireSetupGroupPage();
    });

    const btn = $("#abSaveBtn");
    btn.addEventListener("click", async () => {
      attendanceBonusCfg.error = "";
      attendanceBonusCfg.ok = "";
      setBtnBusy(btn);
      try {
        await saveAttendanceBonus(attendanceBonusCfg.fields);
        attendanceBonusCfg.ok = "Saved.";
        setup.doneModules.add("attendance_bonus");
      } catch (e) {
        attendanceBonusCfg.error = e.message;
      }
      $("#setupBody").innerHTML = setupGroupPageTemplate();
      wireSetupGroupPage();
    });
  }

  /* ---------- Custom Addition/Deduction — POST /payroll/configuration/custom-fields ---------- */
  const customAdditionDeduction = { type: "Addition", fields: null, error: "", ok: "", createdNames: [] };

  function generateCustomAdditionDeductionFields(type) {
    const name = choice(type === "Addition" ? CUSTOM_ADDITION_NAMES : CUSTOM_DEDUCTION_NAMES);
    return { name, type, carryingNext: Math.random() < 0.5 };
  }

  function customAdditionDeductionTemplate() {
    const head = `<div class="section-head"><h2 class="section-title"><span class="section-num">10</span>Custom Addition/Deduction</h2></div>`;
    if (!customAdditionDeduction.fields) customAdditionDeduction.fields = generateCustomAdditionDeductionFields(customAdditionDeduction.type);
    const f = customAdditionDeduction.fields;
    return `
      <div class="section">
        ${head}
        <p class="section-note">The muggle-friendly magic scroll's own fixed names, paired by type.</p>
        <div class="field-row">
          <div class="field">
            <label>Type</label>
            <div class="seg" id="cadTypeSeg" role="group" aria-label="Type">
              <button type="button" data-val="Addition" aria-pressed="${f.type === "Addition"}">Addition</button>
              <button type="button" data-val="Deduction" aria-pressed="${f.type === "Deduction"}">Deduction</button>
            </div>
          </div>
          <div class="field"><label for="cadName">Name</label><input type="text" id="cadName" value="${f.name}" /></div>
        </div>
        <span class="tally" style="margin-top:8px">Carry forward <strong>${f.carryingNext ? "yes" : "no"}</strong></span>

        <div class="setup-actions" style="flex-direction:row; align-items:center;">
          <button type="button" class="tiny-btn" id="cadRegenerateBtn">↻ Regenerate</button>
          <button type="button" class="generate-btn" id="cadSaveBtn">Save to ${ENVIRONMENTS[setup.env].label}</button>
        </div>
        <span class="error-text" id="cadError">${customAdditionDeduction.error}</span>
        ${customAdditionDeduction.ok ? `<div style="display:flex; gap:9px; align-items:center; margin-top:10px; color:var(--success); font-size:13px; font-weight:600;">${iconCheck()}${customAdditionDeduction.ok}</div>` : ""}
        ${createdListHtml(customAdditionDeduction.createdNames)}
      </div>
    `;
  }

  function readCustomAdditionDeductionForm() {
    return { ...customAdditionDeduction.fields, name: $("#cadName").value };
  }

  async function saveCustomAdditionDeduction(fields) {
    const env = ENVIRONMENTS[setup.env];
    let res;
    try {
      res = await fetch(`${env.apiBase}/payroll/configuration/custom-fields`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${setup.companyToken}` },
        body: JSON.stringify(fields),
      });
    } catch (e) {
      throw new Error(`Couldn't reach ${env.label}.`);
    }
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) throw new Error('Your session with this company may have expired — use "Disconnect this company" above and sign in again.');
    if (res.status !== 201) throw new Error(data.message || "The server rejected this.");
    return data;
  }

  function wireCustomAdditionDeductionEvents() {
    $all("#cadTypeSeg button").forEach((btn) =>
      btn.addEventListener("click", () => {
        customAdditionDeduction.fields.name = $("#cadName").value;
        customAdditionDeduction.type = btn.dataset.val;
        customAdditionDeduction.fields = generateCustomAdditionDeductionFields(customAdditionDeduction.type);
        $("#setupBody").innerHTML = setupGroupPageTemplate();
        wireSetupGroupPage();
      })
    );

    $("#cadRegenerateBtn").addEventListener("click", () => {
      customAdditionDeduction.fields = generateCustomAdditionDeductionFields(customAdditionDeduction.type);
      customAdditionDeduction.error = "";
      customAdditionDeduction.ok = "";
      $("#setupBody").innerHTML = setupGroupPageTemplate();
      wireSetupGroupPage();
    });

    const btn = $("#cadSaveBtn");
    btn.addEventListener("click", async () => {
      customAdditionDeduction.error = "";
      customAdditionDeduction.ok = "";
      const fields = readCustomAdditionDeductionForm();
      setBtnBusy(btn);
      try {
        await saveCustomAdditionDeduction(fields);
        customAdditionDeduction.fields = fields;
        customAdditionDeduction.ok = "Saved.";
        customAdditionDeduction.createdNames.push(`${fields.name} (${fields.type})`);
        setup.doneModules.add("custom_addition_deduction");
      } catch (e) {
        customAdditionDeduction.error = e.message;
      }
      $("#setupBody").innerHTML = setupGroupPageTemplate();
      wireSetupGroupPage();
    });
  }

  /* ---------- Tax — PATCH /payroll/configuration/tax-rules/toggle/Enable ----------
     The Postman collection has no endpoint anywhere for creating an actual
     tax bracket or rule — only this enable/disable toggle. Built as
     exactly what exists; the module says so rather than inventing a body
     for an endpoint that isn't in the collection. This is the "Payroll
     needs a new API" gap the user predicted before this group was built. */
  const payrollTax = { error: "", ok: "" };

  function payrollTaxTemplate() {
    const head = `<div class="section-head"><h2 class="section-title"><span class="section-num">11</span>Tax</h2></div>`;
    return `
      <div class="section">
        ${head}
        <p class="section-note"><strong>Scope note:</strong> the muggle-friendly magic scroll only has an enable/disable toggle for tax rules — there's no endpoint anywhere in it for actually creating a tax bracket or rule. This button calls exactly what exists; configuring real tax brackets needs an API this scroll doesn't have yet.</p>

        <div class="setup-actions" style="flex-direction:row; align-items:center;">
          <button type="button" class="generate-btn" id="ptSaveBtn">Enable Tax on ${ENVIRONMENTS[setup.env].label}</button>
        </div>
        <span class="error-text" id="ptError">${payrollTax.error}</span>
        ${payrollTax.ok ? `<div style="display:flex; gap:9px; align-items:center; margin-top:10px; color:var(--success); font-size:13px; font-weight:600;">${iconCheck()}${payrollTax.ok}</div>` : ""}
      </div>
    `;
  }

  async function savePayrollTax() {
    const env = ENVIRONMENTS[setup.env];
    let res;
    try {
      res = await fetch(`${env.apiBase}/payroll/configuration/tax-rules/toggle/Enable`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${setup.companyToken}` },
      });
    } catch (e) {
      throw new Error(`Couldn't reach ${env.label}.`);
    }
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) throw new Error('Your session with this company may have expired — use "Disconnect this company" above and sign in again.');
    if (res.status !== 200) throw new Error(data.message || "The server rejected this.");
    return data;
  }

  function wirePayrollTaxEvents() {
    const btn = $("#ptSaveBtn");
    btn.addEventListener("click", async () => {
      payrollTax.error = "";
      payrollTax.ok = "";
      setBtnBusy(btn);
      try {
        await savePayrollTax();
        payrollTax.ok = "Saved.";
        setup.doneModules.add("tax");
      } catch (e) {
        payrollTax.error = e.message;
      }
      $("#setupBody").innerHTML = setupGroupPageTemplate();
      wireSetupGroupPage();
    });
  }

  /* ===== Attendance Policy — the Attendance group's only module ===== */
  const attendancePolicy = { fields: null, error: "", ok: "" };

  function generateShiftTime() {
    const startHour = choice(ATTENDANCE_SHIFT_START_HOURS);
    const totalWorkingHours = choice(ATTENDANCE_SHIFT_WORK_HOURS);
    const endHour = startHour + totalWorkingHours;
    const pad2 = (n) => String(n).padStart(2, "0");
    return { workStartTime: `${pad2(startHour)}:00`, workEndTime: `${pad2(endHour)}:00`, totalWorkingHours };
  }

  function generateAttendancePolicyFields() {
    const policyNumber = String(Date.now()).slice(-5);
    const shiftCount = randInt(1, 3);
    const shifts = [];
    for (let i = 0; i < shiftCount; i++) {
      const t = generateShiftTime();
      shifts.push({
        name: `${choice(ATTENDANCE_SHIFT_NAME_OPTIONS)} ${i + 1}`,
        workStartTime: t.workStartTime,
        workEndTime: t.workEndTime,
        gracePeriodMinutes: choice(ATTENDANCE_GRACE_MINUTES),
        totalWorkingHours: t.totalWorkingHours,
        halfDayHours: Math.ceil(t.totalWorkingHours / 2),
        isDefault: i === 0,
      });
    }

    const overtimeEnabled = Math.random() < 0.5;
    const overtimeConfigs = { isEnabled: overtimeEnabled };
    if (overtimeEnabled) {
      overtimeConfigs.hasMaxOvertime = Math.random() < 0.5;
      if (overtimeConfigs.hasMaxOvertime) overtimeConfigs.maxOvertimeMinutes = choice(ATTENDANCE_OVERTIME_MAX_MINUTES);
      overtimeConfigs.hasCooldown = Math.random() < 0.5;
      if (overtimeConfigs.hasCooldown) overtimeConfigs.cooldownMinutes = choice(ATTENDANCE_OVERTIME_COOLDOWN_MINUTES);
      overtimeConfigs.hasSlotDuration = Math.random() < 0.5;
      if (overtimeConfigs.hasSlotDuration) overtimeConfigs.slotDurationMinutes = choice(ATTENDANCE_OVERTIME_SLOT_MINUTES);
    }

    const breakEnabled = Math.random() < 0.5;
    const breakConfig = { breakEnabled };
    if (breakEnabled) {
      breakConfig.maxDurationMinutes = randInt(1, 480);
      breakConfig.breakStartAfterMinutes = randInt(0, 720);
      breakConfig.allowMultipleBreaks = Math.random() < 0.5;
      breakConfig.maxBreakPerDay = randInt(1, 10);
    } else {
      breakConfig.allowMultipleBreaks = true;
      breakConfig.maxBreakPerDay = 5;
    }

    return {
      title: `Office Standard Policy ${policyNumber}`,
      description: `Default attendance policy for standard working hours and weekends ${policyNumber}`,
      shifts,
      weekendDays: choice(ATTENDANCE_WEEKEND_OPTIONS),
      overtimeConfigs,
      earlyCheckInLimit: choice(ATTENDANCE_EARLY_CHECKIN_LIMITS),
      breakConfig,
    };
  }

  function attendancePolicyTemplate() {
    const head = `<div class="section-head"><h2 class="section-title"><span class="section-num">1</span>Attendance Policy</h2></div>`;
    if (!attendancePolicy.fields) attendancePolicy.fields = generateAttendancePolicyFields();
    const f = attendancePolicy.fields;
    const shiftRows = f.shifts
      .map((s) => `<span class="tally" style="margin-top:6px; margin-right:6px">${s.name}${s.isDefault ? " · default" : ""} <strong>${s.workStartTime}–${s.workEndTime}</strong></span>`)
      .join("");
    const weekendKey = JSON.stringify(f.weekendDays);
    return `
      <div class="section">
        ${head}
        <p class="section-note">Generated the same way QA's own test script rolls it — shifts, overtime and break rules are rolled per its logic. Only the title and weekend days are exposed here for hand-editing; regenerate to re-roll everything else.</p>
        <div class="field-row">
          <div class="field"><label for="apTitle">Title</label><input type="text" id="apTitle" value="${f.title}" /></div>
          <div class="field">
            <label>Weekend Days</label>
            <div class="seg" id="apWeekendSeg" role="group" aria-label="Weekend days">
              <button type="button" data-val='["FRI"]' aria-pressed="${weekendKey === '["FRI"]'}">Friday</button>
              <button type="button" data-val='["SAT"]' aria-pressed="${weekendKey === '["SAT"]'}">Saturday</button>
              <button type="button" data-val='["FRI","SAT"]' aria-pressed="${weekendKey === '["FRI","SAT"]'}">Fri + Sat</button>
            </div>
          </div>
        </div>
        <div style="margin-top:14px">
          <label style="font-size:12.5px; font-weight:600; color:var(--text); display:block; margin-bottom:8px;">Shifts (${f.shifts.length})</label>
          <div style="display:flex; flex-wrap:wrap;">${shiftRows}</div>
        </div>

        <div class="setup-actions" style="flex-direction:row; align-items:center;">
          <button type="button" class="tiny-btn" id="apRegenerateBtn">↻ Regenerate</button>
          <button type="button" class="generate-btn" id="apSaveBtn">Save to ${ENVIRONMENTS[setup.env].label}</button>
        </div>
        <span class="error-text" id="apError">${attendancePolicy.error}</span>
        ${attendancePolicy.ok ? `<div style="display:flex; gap:9px; align-items:center; margin-top:10px; color:var(--success); font-size:13px; font-weight:600;">${iconCheck()}${attendancePolicy.ok}</div>` : ""}
      </div>
    `;
  }

  function readAttendancePolicyForm() {
    return { ...attendancePolicy.fields, title: $("#apTitle").value };
  }

  async function saveAttendancePolicy(fields) {
    const env = ENVIRONMENTS[setup.env];
    let res;
    try {
      res = await fetch(`${env.apiBase}/attendance/policy/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${setup.companyToken}` },
        body: JSON.stringify(fields),
      });
    } catch (e) {
      throw new Error(`Couldn't reach ${env.label}.`);
    }
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) throw new Error('Your session with this company may have expired — use "Disconnect this company" above and sign in again.');
    if (res.status !== 201) throw new Error(data.message || "The server rejected this.");
    return data;
  }

  function wireAttendancePolicyEvents() {
    $all("#apWeekendSeg button").forEach((btn) =>
      btn.addEventListener("click", () => {
        attendancePolicy.fields.title = $("#apTitle").value;
        attendancePolicy.fields.weekendDays = JSON.parse(btn.dataset.val);
        $("#setupBody").innerHTML = setupGroupPageTemplate();
        wireSetupGroupPage();
      })
    );

    $("#apRegenerateBtn").addEventListener("click", () => {
      attendancePolicy.fields = generateAttendancePolicyFields();
      attendancePolicy.error = "";
      attendancePolicy.ok = "";
      $("#setupBody").innerHTML = setupGroupPageTemplate();
      wireSetupGroupPage();
    });

    const btn = $("#apSaveBtn");
    btn.addEventListener("click", async () => {
      attendancePolicy.error = "";
      attendancePolicy.ok = "";
      const fields = readAttendancePolicyForm();
      setBtnBusy(btn);
      try {
        await saveAttendancePolicy(fields);
        attendancePolicy.fields = fields;
        attendancePolicy.ok = "Saved.";
        setup.doneModules.add("attendance_policy");
      } catch (e) {
        attendancePolicy.error = e.message;
      }
      $("#setupBody").innerHTML = setupGroupPageTemplate();
      wireSetupGroupPage();
    });
  }

  /* Every per-module cache (generated fields, fetched dependency data,
     in-flight error/ok text) gets wiped here — called on both Sign out
     and Disconnect. Without it, a module's last-generated values from
     company A would still be sitting there, unregenerated, the moment
     you connect to company B; `companyProfile.fields` is only ever
     (re)built when it's null, so nothing would prompt a fresh generate.
     A new module's state object gets added to this list, not left out
     of it — the bug it fixes is silent by nature, so there's no test
     that catches forgetting a line here except one written on purpose. */
  function resetModuleState() {
    companyProfile.fields = null;
    companyProfile.error = "";
    companyProfile.ok = "";
    bankInfo.fields = null;
    bankInfo.error = "";
    bankInfo.ok = "";
    companyBranch.fields = null;
    companyBranch.error = "";
    companyBranch.ok = "";
    companyBranch.createdNames = [];
    companyDepartment.fields = null;
    companyDepartment.error = "";
    companyDepartment.ok = "";
    companyDepartment.bulk = null;
    companyDepartment.createdNames = [];
    companyDesignation.departments = null;
    companyDesignation.loadError = "";
    companyDesignation.fields = null;
    companyDesignation.error = "";
    companyDesignation.ok = "";
    companyDesignation.bulk = null;
    companyDesignation.createdNames = [];
    customField.fields = null;
    customField.error = "";
    customField.ok = "";
    customField.createdNames = [];
    requiredDocument.fields = null;
    requiredDocument.error = "";
    requiredDocument.ok = "";
    requiredDocument.createdNames = [];
    leaveType.kindId = "annual";
    leaveType.fields = null;
    leaveType.error = "";
    leaveType.ok = "";
    leaveType.createdNames = [];
    leavePolicy.leaveTypes = null;
    leavePolicy.loadError = "";
    leavePolicy.fields = null;
    leavePolicy.error = "";
    leavePolicy.ok = "";
    leavePolicy.createdNames = [];
    attendancePolicy.fields = null;
    attendancePolicy.error = "";
    attendancePolicy.ok = "";
    payrollGeneral.fields = null;
    payrollGeneral.error = "";
    payrollGeneral.ok = "";
    salaryComponent.presetIdx = 0;
    salaryComponent.fields = null;
    salaryComponent.error = "";
    salaryComponent.ok = "";
    salaryComponent.createdNames = [];
    companySalaryStructure.components = null;
    companySalaryStructure.loadError = "";
    companySalaryStructure.fields = null;
    companySalaryStructure.error = "";
    companySalaryStructure.ok = "";
    lateArrival.leaveTypes = null;
    lateArrival.loadError = "";
    lateArrival.fields = null;
    lateArrival.error = "";
    lateArrival.ok = "";
    absentDeduction.leaveTypes = null;
    absentDeduction.loadError = "";
    absentDeduction.fields = null;
    absentDeduction.error = "";
    absentDeduction.ok = "";
    bonusType.presetIdx = 0;
    bonusType.fields = null;
    bonusType.error = "";
    bonusType.ok = "";
    bonusType.createdNames = [];
    bonusPolicy.bonusTypes = null;
    bonusPolicy.loadError = "";
    bonusPolicy.fields = null;
    bonusPolicy.error = "";
    bonusPolicy.ok = "";
    bonusPolicy.createdNames = [];
    overtime.fields = null;
    overtime.error = "";
    overtime.ok = "";
    attendanceBonusCfg.fields = null;
    attendanceBonusCfg.error = "";
    attendanceBonusCfg.ok = "";
    customAdditionDeduction.type = "Addition";
    customAdditionDeduction.fields = null;
    customAdditionDeduction.error = "";
    customAdditionDeduction.ok = "";
    customAdditionDeduction.createdNames = [];
    payrollTax.error = "";
    payrollTax.ok = "";
  }

  function wireCompanySetupEvents() {
    renderSetupBody();
  }

  /* ================= The joke gate ================= */

  function wireLogin() {
    const gate = $("#loginGate");
    const form = $("#loginForm");
    const email = $("#loginEmail");
    const pass = $("#loginPass");
    const err = $("#loginError");

    /* Same toggle as Company Setup's two password fields — the credential
       is already printed in plain text a few lines down (#gateCreds), so
       this is consistency more than necessity, but it's the one password
       field on the page that never got it. */
    wirePasswordToggles(gate);

    /* pre-filled, because making you type them would rather miss the point */
    email.value = DEMO_LOGIN.email;
    pass.value = DEMO_LOGIN.password;

    $("#gateCreds").innerHTML =
      `<span class="gate-cred"><b>email</b>${DEMO_LOGIN.email}</span>` +
      `<span class="gate-cred"><b>password</b>${DEMO_LOGIN.password}</span>`;

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const ok =
        email.value.trim().toLowerCase() === DEMO_LOGIN.email &&
        pass.value === DEMO_LOGIN.password;
      if (!ok) {
        err.textContent = "Wrong — and they were written down for you. 🙃";
        email.classList.toggle("invalid", email.value.trim().toLowerCase() !== DEMO_LOGIN.email);
        pass.classList.toggle("invalid", pass.value !== DEMO_LOGIN.password);
        return;
      }
      err.textContent = "";
      gate.classList.add("gone");
      /* removed rather than just hidden, so it can never trap focus */
      setTimeout(() => gate.remove(), 200);
    });

    [email, pass].forEach((el) => {
      el.addEventListener("input", () => {
        err.textContent = "";
        el.classList.remove("invalid");
      });
    });

    /* A looping video is motion nobody asked for. If the visitor has said
       they don't want it, hold the first frame and give them controls so
       playing it stays their choice. */
    const video = $("#gateVideo");
    if (video && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      video.autoplay = false;
      video.loop = false;
      video.controls = true;
      video.pause();
    }
  }

  /* ---------- guarding work in progress ----------

     Switching operations loses nothing — every operation's state lives in
     a module-level object and the form is rebuilt from it, verified by
     test. What does lose everything is a reload or closing the tab, since
     nothing is persisted anywhere. So the guard is on exactly those, plus
     the Log out button, which is itself a reload. */

  function hasUnsavedWork() {
    if (leave.rows.length || payroll.rows.length) return true;
    if (att.ids.length || att.customHolidays.length) return true;
    if (att.shifts.some((sh) => sh.ids.length)) return true;
    if (assets.idSrc.ids.length || assetTypes.some((t) => t.isCustom)) return true;
    if (departments.some((d) => d.checked || d.isCustom)) return true;
    return false;
  }

  /* Set while we are deliberately reloading, so the beforeunload guard
     doesn't ask a second time on top of our own dialog. */
  let leavingOnPurpose = false;

  function askDiscard(body, confirmLabel, onConfirm) {
    const modal = $("#discardModal");
    const ok = $("#discardOk");
    const cancel = $("#discardCancel");
    $("#discardBody").textContent = body;
    ok.textContent = confirmLabel;

    const close = () => {
      modal.hidden = true;
      document.removeEventListener("keydown", onKey);
    };
    const onKey = (e) => {
      if (e.key === "Escape") close();
    };
    /* replaceWith(cloneNode) drops every previously bound handler, so
       reopening the dialog cannot stack them up */
    const freshOk = ok.cloneNode(true);
    const freshCancel = cancel.cloneNode(true);
    ok.replaceWith(freshOk);
    cancel.replaceWith(freshCancel);
    freshOk.addEventListener("click", () => {
      close();
      onConfirm();
    });
    freshCancel.addEventListener("click", close);
    document.addEventListener("keydown", onKey);

    modal.hidden = false;
    /* the safe option takes focus, so a stray Enter keeps the work */
    freshCancel.focus();
  }

  function wireLogout() {
    $("#logoutBtn").addEventListener("click", () => {
      if (!hasUnsavedWork()) {
        leavingOnPurpose = true;
        window.location.reload();
        return;
      }
      askDiscard(
        "There's work here — an ID list, an uploaded file, shift assignments. Logging out throws all of it away, because nothing is saved anywhere.",
        "Discard and log out",
        () => {
          leavingOnPurpose = true;
          window.location.reload();
        }
      );
    });
  }

  /* Reload and tab-close. The browser shows its own wording here and will
     not take ours — that is deliberate on their part, so a page cannot
     dress up a fake message. All we control is whether it asks at all. */
  function wireUnloadGuard() {
    window.addEventListener("beforeunload", (e) => {
      if (leavingOnPurpose || !hasUnsavedWork()) return;
      e.preventDefault();
      e.returnValue = "";
    });
  }

  /* ---------- appearance ----------

     "auto" means no data-theme attribute at all, leaving the
     prefers-color-scheme block in app.css to decide — the behaviour the
     page had before there was a control. "light" and "dark" pin it.

     This is the one thing the app persists, and deliberately so: it is a
     display preference, not data, so the "nothing survives a reload" rule
     that governs generated input does not apply to it. Every access is
     wrapped because a locked-down browser throws on localStorage rather
     than returning null. */
  const APPEARANCE_KEY = "bulkforge-appearance";

  function storedAppearance() {
    try {
      const v = window.localStorage.getItem(APPEARANCE_KEY);
      return v === "light" || v === "dark" ? v : "auto";
    } catch (e) {
      return "auto";
    }
  }

  function applyAppearance(mode) {
    if (mode === "auto") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", mode);
    $all("#appearanceSeg button").forEach((b) =>
      b.setAttribute("aria-pressed", String(b.dataset.appearance === mode))
    );
  }

  function wireAppearance() {
    applyAppearance(storedAppearance());
    $all("#appearanceSeg button").forEach((btn) => {
      btn.addEventListener("click", () => {
        const mode = btn.dataset.appearance;
        try {
          if (mode === "auto") window.localStorage.removeItem(APPEARANCE_KEY);
          else window.localStorage.setItem(APPEARANCE_KEY, mode);
        } catch (e) {
          /* a browser refusing to store it is not worth interrupting for;
             the choice still applies for this visit */
        }
        applyAppearance(mode);
      });
    });
  }

  function init() {
    wireAppearance();
    wireLogin();
    wireLogout();
    wireUnloadGuard();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    att.from = fmtDate(monthStart);
    att.to = fmtDate(today);
    renderSidebar();
    renderMain();
    $("#generateBtn").addEventListener("click", handleGenerate);
  }

  document.addEventListener("DOMContentLoaded", init);
})();
