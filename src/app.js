/* ===== Bulk Forge — app logic ===== */
(function () {
  "use strict";

  /* ---------- state ---------- */
  let currentOp = "employee_add";
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

  function collectFinalDepartments() {
    const out = [];
    for (const d of departments) {
      if (d.isCustom) {
        if (d.name.trim() && d.customDesig.length) out.push({ name: d.name.trim(), designations: d.customDesig.slice() });
      } else if (d.checked) {
        const desigs = d.mode === "default" ? Array.from(d.selectedDesig) : d.customDesig.slice();
        if (desigs.length) out.push({ name: d.name, designations: desigs });
      }
    }
    return out;
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
    const nav = $("#opNav");
    nav.innerHTML = "";
    OPERATIONS.forEach((op) => {
      const btn = document.createElement("button");
      btn.className = "op-item";
      btn.type = "button";
      btn.setAttribute("aria-current", String(op.id === currentOp));
      if (op.status === "soon") btn.disabled = true;
      btn.innerHTML = `<span class="op-item-label"><span class="op-dot"></span>${op.label}</span>${op.status === "soon" ? '<span class="pill-soon">Soon</span>' : ""}`;
      if (op.status !== "soon") {
        btn.addEventListener("click", () => {
          currentOp = op.id;
          renderSidebar();
          renderMain();
        });
      }
      nav.appendChild(btn);
    });
  }

  function renderMain() {
    const root = $("#mainContent");
    if (currentOp !== "employee_add") {
      const op = OPERATIONS.find((o) => o.id === currentOp);
      root.innerHTML = `
        <div class="page-head">
          <span class="page-eyebrow">Bulk operation</span>
          <h1 class="page-title">${op ? op.label : ""}</h1>
          <p class="page-desc">Ei operation ekhono build hoyni. Prottekta operation-er column-wise rule confirm howar por ekta ekta kore add kora hobe.</p>
        </div>
        <div class="placeholder-panel">
          <div class="pp-icon">${iconClock()}</div>
          <h3>Coming soon</h3>
          <p>Ei operation-er jonno template ar rule gula ekhono discuss kora baki. Employee Add operation ta age complete kora hocche.</p>
        </div>`;
      $("#actionBar").style.display = "none";
      return;
    }
    $("#actionBar").style.display = "flex";
    root.innerHTML = employeeAddTemplate();
    wireEmployeeAddEvents();
    renderDepartments();
    updateSummary();
  }

  function iconClock() {
    return `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.2 2"/></svg>`;
  }

  function employeeAddTemplate() {
    return `
      <div class="page-head">
        <span class="page-eyebrow">Bulk operation · 01</span>
        <h1 class="page-title">Employee Add</h1>
        <p class="page-desc">QA-ready employee bulk-upload file generate koro. Batch size ar prefix dile baki shob field template-er rule mene automatically generate hobe.</p>
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
        <p class="section-note">Koyta employee generate hobe ar ID-r prefix ki hobe.</p>
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
        <p class="section-note">Random Bangla naam use korbe, naki ekta theme theke character naam?</p>
        <div class="theme-grid" id="themeGrid"></div>
        <div class="preview-row" id="namePreview"></div>
      </div>

      <div class="section">
        <div class="section-head"><h2 class="section-title"><span class="section-num">3</span>Department &amp; designation</h2></div>
        <p class="section-note">Kokhono department select/add koro, protyekta-r jonno designation set koro. Kom pokkhe 1 ta department-e 1 ta designation lagbe.</p>
        <div class="dept-list" id="deptList"></div>
        <div class="add-dept-row">
          <button type="button" class="tiny-btn" id="addDeptBtn">+ Add custom department</button>
        </div>
        <div class="validation-banner hidden" id="deptWarning">${iconWarn()}<span>Kom pokkhe ekta department-e ekta designation select/add korte hobe.</span></div>
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
      err.textContent = "10 theke 300-er moddhe hote hobe";
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
      err.textContent = "exactly 4 letters lagbe";
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

  function renderDepartments() {
    const list = $("#deptList");
    list.innerHTML = "";
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
      body.appendChild(toggle);

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

  function updateSummary() {
    const countOk = validateCount();
    const prefixOk = validatePrefix();
    const count = parseInt($("#countInput").value, 10);
    const prefix = $("#prefixInput").value;
    const finalDepts = collectFinalDepartments();
    const deptOk = finalDepts.length > 0;

    $("#deptWarning").classList.toggle("hidden", deptOk);

    const summary = $("#actionSummary");
    if (countOk && prefixOk) {
      summary.innerHTML = `<strong>${count}</strong> employees · prefix <strong>${prefix}</strong> · ${NAME_THEME_LABELS[nameTheme]} · <strong>${finalDepts.length}</strong> department${finalDepts.length === 1 ? "" : "s"}`;
    } else {
      summary.textContent = "Batch basics thik koro";
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

  function handleGenerate() {
    if (!validateCount() || !validatePrefix()) {
      showToast("Batch basics-e error ache, check koro.", true);
      return;
    }
    const finalDepts = collectFinalDepartments();
    if (!finalDepts.length) {
      showToast("Kom pokkhe ekta department-e ekta designation lagbe.", true);
      return;
    }
    const count = parseInt($("#countInput").value, 10);
    const prefix = $("#prefixInput").value;
    try {
      const rows = generateWorkbookRows(count, prefix, nameTheme, finalDepts);
      const filename = downloadWorkbook(rows, prefix);
      showToast(`${filename} — ${count} employee row generate hoyeche.`);
    } catch (err) {
      console.error(err);
      showToast("File generate korte somoshya hoyeche. Console check koro.", true);
    }
  }

  function init() {
    renderSidebar();
    renderMain();
    $("#generateBtn").addEventListener("click", handleGenerate);
  }

  document.addEventListener("DOMContentLoaded", init);
})();
