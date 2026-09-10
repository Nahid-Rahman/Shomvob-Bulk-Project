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
      <div class="page-head">
        <span class="page-eyebrow">Phase 2 · Setup</span>
        <h1 class="page-title">Company Setup</h1>
        <p class="page-desc">Sign in here first, then sign in again as the company you want to configure. The rest of this section does nothing until both have happened.</p>
      </div>
      <div id="setupStatusBar"></div>
      <div id="setupBody"></div>
    `;
  }

  /* A persistent strip once step one is done — which environment, which
     tool account, and which company (once step two is done too). The
     point of it living outside #setupBody is that it stays on screen
     through every step past the first, so "which server am I about to
     touch" is never something you have to scroll up to check. */
  function setupStatusBarHtml() {
    if (!setup.toolToken) return "";
    const env = ENVIRONMENTS[setup.env];
    /* The literal space between the two spans matters even though the
       flex gap already separates them visually — without it, selecting or
       copying this line (or a screen reader reading it) glues the company
       name straight onto the parenthetical. */
    const company = setup.companyName
      ? ` <span class="setup-who">${setup.companyName}</span> <span class="hint">(${setup.companyUserType || "unknown type"})</span>`
      : "";
    return `
      <div class="setup-statusbar">
        <span class="env-badge env-${env.id}">${env.label}</span>
        <span class="setup-who">${setup.toolEmail}</span>${company}
        <button type="button" class="tiny-btn" id="setupSignOutBtn">Sign out</button>
      </div>
    `;
  }

  function renderSetupBody() {
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
    return `
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

  function setupConnectedTemplate() {
    const env = ENVIRONMENTS[setup.env];
    const cards = SETTINGS_GROUPS.map((g) => {
      const done = groupDoneCount(g);
      const all = done === g.modules.length;
      return `
        <button type="button" class="settings-card" data-group="${g.id}">
          <div class="settings-card-icon">${settingsGroupIcon(g.id)}</div>
          <div class="settings-card-name">${g.label}</div>
          <span class="tally${all ? " ok" : ""}">${done}/${g.modules.length} <strong>done</strong></span>
        </button>
      `;
    }).join("");
    return `
      <div class="setup-connected-banner">
        <div class="section-head"><h2 class="section-title">${iconCheck()}Connected</h2></div>
        <p class="section-note">Signed in to <strong>${setup.companyName}</strong> on ${env.label}, as <strong>${setup.companyUserType || "unknown type"}</strong>.</p>
        <button type="button" class="tiny-btn" id="setupDisconnectBtn">Disconnect this company</button>
      </div>
      <p class="setup-hint-line">Pick any card below — nothing here has to be done in order, and nothing else is touched until you open it.</p>
      <div class="settings-grid" style="grid-template-columns:repeat(${SETTINGS_GROUPS.length}, 1fr)">${cards}</div>
    `;
  }

  function wireSetupConnected() {
    $("#setupDisconnectBtn").addEventListener("click", () => {
      setup.companyToken = null;
      setup.companyRefresh = null;
      setup.companyName = null;
      setup.companyUserType = null;
      setup.activeGroup = null;
      setup.activeModule = null;
      setup.doneModules = new Set();
      renderSetupBody();
    });
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
        <p class="section-note">Not built yet. Each module gets added once its real request shape is confirmed against the Postman collection and, where one exists, the live admin screen.</p>
      </div>
    `;
  }

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
    const body = mod.id === "company_profile" ? companyProfileTemplate() : settingsComingSoonHtml(mod);
    return `
      <a href="#" id="setupBackToModules" style="display:inline-flex; align-items:center; gap:6px; font-size:13px; font-weight:600;">← Back to Company Setup</a>
      <h2 style="font-size:19px; margin:14px 0 0;">${group.label}</h2>
      <div class="settings-tabs" role="tablist">${tabs}</div>
      <div style="margin-top:16px">${body}</div>
    `;
  }

  function wireSetupGroupPage() {
    $("#setupBackToModules").addEventListener("click", (e) => {
      e.preventDefault();
      setup.activeGroup = null;
      setup.activeModule = null;
      renderSetupBody();
    });
    $all(".settings-tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        setup.activeModule = tab.dataset.module;
        renderSetupBody();
      });
    });
    if (setup.activeModule === "company_profile") wireCompanyProfileEvents();
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
        <p class="section-note">Generated from ${setup.companyName}'s own name plus the Postman collection's own pools. Regenerate re-rolls everything; any field can still be edited by hand before saving.</p>
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
