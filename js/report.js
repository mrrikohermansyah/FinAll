(function () {
  "use strict";

  const SAVING_CATEGORY_NAMES = ["Tabungan", "Investasi", "Dana Darurat"];
  const FIXED_COLOR_CODE = "orange";
  const VARIABLE_COLOR_CODE = "sage";

  const ymParts = (
    App.currentMonth || new Date().toISOString().slice(0, 7)
  ).split("-");
  const state = {
    currentMonth: ymParts[1],
    currentYear: ymParts[0],
    salary: null,
    transactions: [],
    categories: [],
    salaries: [],
    charts: {
      pie: null,
      bar: null,
      line: null,
    },
  };

  // Chart cleanup function to prevent memory leaks
  function destroyChart(chartInstance) {
    if (chartInstance) {
      try {
        chartInstance.destroy();
        chartInstance = null;
      } catch (e) {
        console.warn("Error destroying chart:", e);
      }
    }
  }

  function destroyAllCharts() {
    destroyChart(state.charts.pie);
    destroyChart(state.charts.bar);
    destroyChart(state.charts.line);
    state.charts = {
      pie: null,
      bar: null,
      line: null,
    };
  }

  // Clean up charts when page is unloaded
  window.addEventListener('beforeunload', destroyAllCharts);

  function getColorBg(code) {
    const map = Defaults.categoryColorMap || {};
    const val = map[code];
    // Guard against non-string values (objects, undefined, etc.) that would
    // break Chart.js / CanvasGradient color parsing.
    return typeof val === "string" ? val : "var(--primary)";
  }

  function getCategoryById(id) {
    return (
      state.categories.find((c) => c.id === id) || {
        name: "-",
        colorCode: "sage",
        type: "variable",
      }
    );
  }

  function initReportFilters() {
    const monthSel = document.getElementById("reportMonth");
    const yearSel = document.getElementById("reportYear");
    if (!monthSel || !yearSel) return;
    DateUtils.months().forEach((m, i) => {
      const opt = document.createElement("option");
      opt.value = String(i + 1).padStart(2, "0");
      opt.textContent = m;
      if (String(i + 1).padStart(2, "0") === state.currentMonth)
        opt.selected = true;
      monthSel.appendChild(opt);
    });
    DateUtils.years(6).forEach((y) => {
      const opt = document.createElement("option");
      opt.value = String(y);
      opt.textContent = String(y);
      if (String(y) === state.currentYear) opt.selected = true;
      yearSel.appendChild(opt);
    });
    monthSel.addEventListener("change", () => {
      state.currentMonth = monthSel.value;
      updateAll();
    });
    yearSel.addEventListener("change", () => {
      state.currentYear = yearSel.value;
      updateAll();
    });
  }

  async function loadCategories() {
    try {
      state.categories = await DB.getAll("categories");
    } catch (e) {
      state.categories = [];
    }
  }

  async function loadSalaries() {
    try {
      state.salaries = await DB.getAll("salary");
      state.salaries.sort((a, b) =>
        (a.month || "").localeCompare(b.month || ""),
      );
    } catch (e) {
      state.salaries = [];
    }
    const ym = `${state.currentYear}-${state.currentMonth}`;
    state.salary = state.salaries.find((s) => s.month === ym) || null;
  }

  async function loadTransactions() {
    try {
      state.transactions = await DB.getAll("transactions");
    } catch (e) {
      state.transactions = [];
    }
  }

  function transactionsForMonth(ym) {
    return state.transactions.filter((t) => (t.month || "") === ym);
  }

  function computeSummaryForMonth(ym) {
    const list = transactionsForMonth(ym);
    const summary = {
      totalAmount: 0,
      totalAdmin: 0,
      totalGrand: 0,
      paidCount: 0,
      unpaidCount: 0,
      fixedAmount: 0,
      variableAmount: 0,
      savingAmount: 0,
      byCategory: {},
      count: list.length,
    };
    list.forEach((t) => {
      const amt = Number(t.amount || 0);
      const adm = Number(t.adminAmount || 0);
      const total = amt + adm;
      summary.totalAmount += amt;
      summary.totalAdmin += adm;
      summary.totalGrand += total;
      if (t.isPaid) summary.paidCount++;
      else summary.unpaidCount++;
      const cat = getCategoryById(t.categoryId);
      const name = cat.name || "Lainnya";
      if (!summary.byCategory[name])
        summary.byCategory[name] = {
          name,
          amount: 0,
          colorCode: cat.colorCode || "sage",
        };
      summary.byCategory[name].amount += total;
      if (cat.colorCode === FIXED_COLOR_CODE) summary.fixedAmount += total;
      else if (cat.colorCode === VARIABLE_COLOR_CODE)
        summary.variableAmount += total;
      const lowName = (name || "").toLowerCase();
      if (
        SAVING_CATEGORY_NAMES.some((n) => n.toLowerCase() === lowName) ||
        cat.colorCode === "yellow"
      ) {
        summary.savingAmount += total;
      }
    });
    return summary;
  }

  function renderSummary() {
    const ym = `${state.currentYear}-${state.currentMonth}`;
    const salary = state.salary ? Number(state.salary.amount || 0) : 0;
    const s = computeSummaryForMonth(ym);

    const el = (id) => document.getElementById(id);
    if (el("rptSalary")) el("rptSalary").textContent = IDR.format(salary);
    if (el("rptSalaryPeriod"))
      el("rptSalaryPeriod").textContent =
        `${DateUtils.months()[Number(state.currentMonth) - 1]} ${state.currentYear}`;
    if (el("rptAllocated"))
      el("rptAllocated").textContent = IDR.format(s.totalGrand);
    if (el("rptAllocPct"))
      el("rptAllocPct").textContent =
        salary > 0 ? ((s.totalGrand / salary) * 100).toFixed(1) + "%" : "0%";
    const remaining = Math.max(0, salary - s.totalGrand);
    if (el("rptRemaining"))
      el("rptRemaining").textContent = IDR.format(remaining);
    if (el("rptRemPct"))
      el("rptRemPct").textContent =
        salary > 0 ? ((remaining / salary) * 100).toFixed(1) + "%" : "0%";
    if (el("rptFixed")) el("rptFixed").textContent = IDR.format(s.fixedAmount);
    if (el("rptFixedPct"))
      el("rptFixedPct").textContent =
        salary > 0 ? ((s.fixedAmount / salary) * 100).toFixed(1) + "%" : "0%";
    if (el("rptVariable"))
      el("rptVariable").textContent = IDR.format(s.variableAmount);
    if (el("rptVarPct"))
      el("rptVarPct").textContent =
        salary > 0
          ? ((s.variableAmount / salary) * 100).toFixed(1) + "%"
          : "0%";
    if (el("rptSaving"))
      el("rptSaving").textContent = IDR.format(s.savingAmount);
    if (el("rptSavingPct"))
      el("rptSavingPct").textContent =
        salary > 0 ? ((s.savingAmount / salary) * 100).toFixed(1) + "%" : "0%";

    if (el("rptAdmin")) el("rptAdmin").textContent = IDR.format(s.totalAdmin);
    if (el("rptPaid")) el("rptPaid").textContent = s.paidCount;
    const totalP = s.paidCount + s.unpaidCount;
    if (el("rptPaidPct"))
      el("rptPaidPct").textContent =
        totalP > 0 ? ((s.paidCount / totalP) * 100).toFixed(0) + "%" : "0%";
    if (el("rptUnpaid")) el("rptUnpaid").textContent = s.unpaidCount;

    const topCat = Object.values(s.byCategory).sort(
      (a, b) => b.amount - a.amount,
    )[0];
    if (el("rptTopCategory"))
      el("rptTopCategory").textContent = topCat ? topCat.name : "-";
    if (el("rptTopCategoryAmount"))
      el("rptTopCategoryAmount").textContent = topCat
        ? IDR.format(topCat.amount)
        : "Rp 0";
  }

  function renderPieChart(summary) {
    const canvas = document.getElementById("rptPieChart");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const entries = Object.values(summary.byCategory).sort(
      (a, b) => b.amount - a.amount,
    );
    const labels = entries.map((e) => e.name);
    const data = entries.map((e) => e.amount);
    const colors = entries.map((e) => getColorBg(e.colorCode));
    destroyChart(state.charts.pie);
    if (data.length === 0) {
      state.charts.pie = new Chart(ctx, {
        type: "doughnut",
        data: {
          labels: ["Belum ada data"],
          datasets: [
            { data: [1], backgroundColor: ["var(--border)"], borderWidth: 0 },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false }, tooltip: { enabled: false } },
          cutout: "60%",
        },
      });
      return;
    }
    state.charts.pie = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels,
        datasets: [
          {
            data,
            backgroundColor: colors,
            borderColor: "var(--surface)",
            borderWidth: 3,
            hoverOffset: 8,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "60%",
        plugins: {
          legend: {
            position: "bottom",
            labels: {
              boxWidth: 12,
              padding: 10,
              font: { size: 11 },
              color: "var(--text-secondary)",
            },
          },
          tooltip: {
            callbacks: {
              label: (c) =>
                `${c.label}: ${IDR.format(c.parsed)} (${((c.parsed / (data.reduce((a, b) => a + b, 0) || 1)) * 100).toFixed(1)}%)`,
            },
          },
        },
      },
    });
  }

  function renderBarChart(summary) {
    const canvas = document.getElementById("rptBarChart");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const entries = Object.values(summary.byCategory)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10);
    const labels = entries.map((e) => e.name);
    const data = entries.map((e) => e.amount);

    // NOTE: previously there was an unused/broken gradient-building block
    // here that called canvas.getContext('2d').createLinearGradient(...)
    // and passed a possibly-non-string color into addColorStop, which
    // threw "could not be parsed as a color" / "t.toString is not a
    // function". That block was dead code (its result, `colors`, was never
    // used) and has been removed. Only `bgColors` (a plain string array)
    // is actually needed for the chart below.
    const bgColors = entries.map((e) => getColorBg(e.colorCode) + "CC");

    destroyChart(state.charts.bar);
    state.charts.bar = new Chart(ctx, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "Total",
            data,
            backgroundColor: bgColors,
            borderRadius: 8,
            borderSkipped: false,
            maxBarThickness: 36,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (c) => IDR.format(c.parsed.y) } },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: "var(--text-secondary)", font: { size: 10 } },
          },
          y: {
            grid: { color: "var(--border)", drawBorder: false },
            ticks: {
              color: "var(--text-secondary)",
              callback: (v) => IDR.formatShort(v),
            },
          },
        },
      },
    });
  }

  function renderLineChart() {
    const canvas = document.getElementById("rptLineChart");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const ym = `${state.currentYear}-${state.currentMonth}`;
    const [baseYear, baseMonth] = ym.split("-").map(Number);
    const labels = [];
    const salaryArr = [];
    const allocArr = [];
    const remainingArr = [];
    const savingArr = [];
    for (let i = 5; i >= 0; i--) {
      let y = baseYear,
        m = baseMonth - i;
      if (m <= 0) {
        m += 12;
        y -= 1;
      }
      const key = `${y}-${String(m).padStart(2, "0")}`;
      labels.push(`${DateUtils.months()[m - 1].slice(0, 3)} ${y}`);
      const salObj = state.salaries.find((s) => s.month === key);
      const sal = salObj ? Number(salObj.amount || 0) : 0;
      salaryArr.push(sal);
      const s = computeSummaryForMonth(key);
      allocArr.push(s.totalGrand);
      remainingArr.push(Math.max(0, sal - s.totalGrand));
      savingArr.push(s.savingAmount);
    }

    const makeGrad = (c1, c2) => {
      const g = ctx.createLinearGradient(0, 0, 0, 300);
      g.addColorStop(0, c1 + "55");
      g.addColorStop(1, c2 + "00");
      return g;
    };

    destroyChart(state.charts.line);
    state.charts.line = new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Gaji",
            data: salaryArr,
            borderColor: "var(--primary)",
            backgroundColor: makeGrad("#5F8D7E", "#5F8D7E"),
            borderWidth: 2.5,
            tension: 0.4,
            fill: true,
            pointRadius: 3,
            pointHoverRadius: 6,
            pointBackgroundColor: "var(--primary)",
          },
          {
            label: "Alokasi",
            data: allocArr,
            borderColor: "var(--accent)",
            backgroundColor: makeGrad("#F4A261", "#F4A261"),
            borderWidth: 2.5,
            tension: 0.4,
            fill: true,
            pointRadius: 3,
            pointHoverRadius: 6,
            pointBackgroundColor: "var(--accent)",
          },
          {
            label: "Sisa",
            data: remainingArr,
            borderColor: "var(--success)",
            backgroundColor: makeGrad("#52B788", "#52B788"),
            borderWidth: 2.5,
            tension: 0.4,
            fill: true,
            pointRadius: 3,
            pointHoverRadius: 6,
            pointBackgroundColor: "var(--success)",
          },
          {
            label: "Tabungan",
            data: savingArr,
            borderColor: "#C49417",
            backgroundColor: makeGrad("#C49417", "#C49417"),
            borderWidth: 2.5,
            tension: 0.4,
            fill: true,
            pointRadius: 3,
            pointHoverRadius: 6,
            pointBackgroundColor: "#C49417",
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: {
            position: "top",
            align: "end",
            labels: {
              boxWidth: 12,
              padding: 12,
              font: { size: 11 },
              color: "var(--text-secondary)",
              usePointStyle: true,
            },
          },
          tooltip: {
            callbacks: {
              label: (c) => `${c.dataset.label}: ${IDR.format(c.parsed.y)}`,
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: "var(--text-secondary)" },
          },
          y: {
            grid: { color: "var(--border)", drawBorder: false },
            ticks: {
              color: "var(--text-secondary)",
              callback: (v) => IDR.formatShort(v),
            },
          },
        },
      },
    });
  }

  function renderDetailTable() {
    const tbody = document.getElementById("rptTableBody");
    if (!tbody) return;
    const ym = `${state.currentYear}-${state.currentMonth}`;
    const list = transactionsForMonth(ym)
      .slice()
      .sort(
        (a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0),
      );
    const salary = state.salary ? Number(state.salary.amount || 0) : 0;

    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8"><div class="table-empty"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="opacity:.5;margin-bottom:8px;"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg><div>Belum ada transaksi pada periode ini</div><div style="font-size:12px;color:var(--text-muted);margin-top:4px;">Pilih periode lain atau tambahkan transaksi baru</div></div></td></tr>`;
      return;
    }

    let rows = "";
    list.forEach((t) => {
      const cat = getCategoryById(t.categoryId);
      const amt = Number(t.amount || 0);
      const adm = Number(t.adminAmount || 0);
      const total = amt + adm;
      const pct = salary > 0 ? ((total / salary) * 100).toFixed(1) + "%" : "-";
      rows += `<tr>
        <td data-label="Tanggal">${DateUtils.toLocal(t.date)}</td>
        <td data-label="Nama" style="font-weight:600;">${Sanitize.string(t.name, 60)}</td>
        <td data-label="Kategori"><span class="badge badge-${cat.colorCode === "yellow" ? "warning" : cat.colorCode === "orange" ? "accent" : "success"}" style="font-weight:500;">${Sanitize.string(cat.name, 20)}</span></td>
        <td data-label="Nominal" style="text-align:right;">${IDR.format(amt)}</td>
        <td data-label="Admin" style="text-align:right;">${adm > 0 ? IDR.format(adm) : "-"}</td>
        <td data-label="Total" style="text-align:right;font-weight:600;">${IDR.format(total)}</td>
        <td data-label="Persentase"><span class="badge badge-${Number((total / (salary || 1)) * 100) > 30 ? "danger" : Number((total / (salary || 1)) * 100) > 15 ? "warning" : "info"}">${pct}</span></td>
        <td data-label="Status">${t.isPaid ? '<span class="badge badge-success">✓ Dibayar</span>' : '<span class="badge badge-secondary">Belum</span>'}</td>
      </tr>`;
    });
    const totalAmt = list.reduce((s, t) => s + Number(t.amount || 0), 0);
    const totalAdm = list.reduce((s, t) => s + Number(t.adminAmount || 0), 0);
    rows += `<tr style="font-weight:700;background:var(--surface-secondary);">
      <td data-label="Ringkasan" colspan="3" style="text-align:right;">TOTAL</td>
      <td data-label="Nominal" style="text-align:right;">${IDR.format(totalAmt)}</td>
      <td data-label="Admin" style="text-align:right;">${IDR.format(totalAdm)}</td>
      <td data-label="Total" style="text-align:right;color:var(--primary);">${IDR.format(totalAmt + totalAdm)}</td>
      <td data-label="Persentase" colspan="2"></td>
    </tr>`;
    tbody.innerHTML = rows;
  }

  function exportCSV() {
    const ym = `${state.currentYear}-${state.currentMonth}`;
    const list = transactionsForMonth(ym)
      .slice()
      .sort((a, b) => (a.date || "").localeCompare(b.date || ""));
    const headers = [
      "Tanggal",
      "Nama",
      "Kategori",
      "Nominal",
      "Admin",
      "Total",
      "%",
      "Status",
      "Remark",
    ];
    const salary = state.salary ? Number(state.salary.amount || 0) : 0;
    const rows = list.map((t) => {
      const cat = getCategoryById(t.categoryId);
      const amt = Number(t.amount || 0);
      const adm = Number(t.adminAmount || 0);
      const total = amt + adm;
      return [
        DateUtils.toLocal(t.date),
        t.name || "",
        cat.name || "",
        amt,
        adm,
        total,
        salary > 0 ? ((total / salary) * 100).toFixed(2) + "%" : "0%",
        t.isPaid ? "Dibayar" : "Belum Dibayar",
        t.remark || "",
      ];
    });
    rows.push([]);
    rows.push([
      "",
      "",
      "TOTAL",
      list.reduce((s, t) => s + Number(t.amount || 0), 0),
      list.reduce((s, t) => s + Number(t.adminAmount || 0), 0),
      list.reduce(
        (s, t) => s + Number(t.amount || 0) + Number(t.adminAmount || 0),
        0,
      ),
      "",
      "",
      "",
    ]);
    Exporter.toCSV(headers, rows, `laporan-finall-${ym}.csv`);
    Toast.success("Laporan diekspor ke CSV");
  }

  function printReport() {
    const ym = `${state.currentYear}-${state.currentMonth}`;
    const salary = state.salary ? Number(state.salary.amount || 0) : 0;
    const s = computeSummaryForMonth(ym);
    const list = transactionsForMonth(ym)
      .slice()
      .sort((a, b) => (a.date || "").localeCompare(b.date || ""));
    let rows = "";
    list.forEach((t) => {
      const cat = getCategoryById(t.categoryId);
      const amt = Number(t.amount || 0);
      const adm = Number(t.adminAmount || 0);
      const total = amt + adm;
      const pct = salary > 0 ? ((total / salary) * 100).toFixed(1) + "%" : "-";
      rows += `<tr>
        <td>${DateUtils.toLocal(t.date)}</td>
        <td><strong>${Sanitize.string(t.name, 60)}</strong></td>
        <td>${Sanitize.string(cat.name, 20)}</td>
        <td style="text-align:right;">${IDR.format(amt)}</td>
        <td style="text-align:right;">${IDR.format(adm)}</td>
        <td style="text-align:right;"><strong>${IDR.format(total)}</strong></td>
        <td>${pct}</td>
        <td>${t.isPaid ? "Dibayar" : "Belum"}</td>
      </tr>`;
    });
    const totalAmt = list.reduce((ss, t) => ss + Number(t.amount || 0), 0);
    const totalAdm = list.reduce((ss, t) => ss + Number(t.adminAmount || 0), 0);
    const remaining = Math.max(0, salary - s.totalGrand);

    const html = `
<!doctype html>
<html><head><meta charset="utf-8"><title>Laporan FinAll - ${ym}</title>
<style>
body{font-family:Inter,'Segoe UI',sans-serif;color:#1f2937;padding:32px;font-size:13px;}
h1{margin:0 0 4px;color:#5F8D7E;}
.sub{color:#6b7280;margin-bottom:24px;}
.summary{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:24px;}
.sum-card{padding:14px;border:1px solid #e5e7eb;border-radius:8px;}
.sum-card .l{color:#6b7280;font-size:11px;text-transform:uppercase;letter-spacing:.5px;}
.sum-card .v{font-size:18px;font-weight:700;margin-top:4px;}
table{width:100%;border-collapse:collapse;margin-top:16px;}
th,td{padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:left;}
th{background:#F1F5F4;color:#374151;font-weight:600;font-size:12px;text-transform:uppercase;letter-spacing:.5px;}
tr.total{background:#F1F5F4;font-weight:700;}
.footer{margin-top:32px;color:#6b7280;font-size:11px;text-align:right;}
</style></head>
<body>
<h1>Laporan Keuangan FinAll</h1>
<div class="sub">Periode ${DateUtils.months()[Number(state.currentMonth) - 1]} ${state.currentYear} · Dicetak ${DateUtils.today()}</div>
<div class="summary">
  <div class="sum-card"><div class="l">Total Gaji</div><div class="v">${IDR.format(salary)}</div></div>
  <div class="sum-card"><div class="l">Total Alokasi</div><div class="v">${IDR.format(s.totalGrand)}</div></div>
  <div class="sum-card"><div class="l">Sisa Gaji</div><div class="v">${IDR.format(remaining)}</div></div>
  <div class="sum-card"><div class="l">Pengeluaran Tetap</div><div class="v">${IDR.format(s.fixedAmount)}</div></div>
  <div class="sum-card"><div class="l">Pengeluaran Berubah</div><div class="v">${IDR.format(s.variableAmount)}</div></div>
  <div class="sum-card"><div class="l">Total Tabungan</div><div class="v">${IDR.format(s.savingAmount)}</div></div>
</div>
<table>
  <thead><tr><th>Tanggal</th><th>Nama</th><th>Kategori</th><th>Nominal</th><th>Admin</th><th>Total</th><th>%</th><th>Status</th></tr></thead>
  <tbody>
    ${rows}
    <tr class="total"><td colspan="3" style="text-align:right;">TOTAL</td>
    <td style="text-align:right;">${IDR.format(totalAmt)}</td>
    <td style="text-align:right;">${IDR.format(totalAdm)}</td>
    <td style="text-align:right;">${IDR.format(totalAmt + totalAdm)}</td><td colspan="2"></td></tr>
  </tbody>
</table>
<div class="footer">FinAll · Personal Financial Allocation</div>
</body></html>`;
    Exporter.print(html);
  }

  async function updateAll() {
    const ym = `${state.currentYear}-${state.currentMonth}`;
    state.salary = state.salaries.find((s) => s.month === ym) || null;
    const summary = computeSummaryForMonth(ym);
    renderSummary();
    renderPieChart(summary);
    renderBarChart(summary);
    renderLineChart();
    renderDetailTable();
  }

  async function initReport() {
    try {
      initReportFilters();
      await loadCategories();
      await loadSalaries();
      await loadTransactions();
      const csvBtn = document.getElementById("exportReportCSV");
      if (csvBtn) csvBtn.addEventListener("click", exportCSV);
      const printBtn = document.getElementById("printReportBtn");
      if (printBtn) printBtn.addEventListener("click", printReport);
      await updateAll();
      Loader.hide();
    } catch (e) {
      console.error("Report init error:", e);
      Toast.error("Gagal memuat data laporan");
      Loader.hide();
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    const checkInterval = setInterval(() => {
      if (App.ready && App.currentUser) {
        clearInterval(checkInterval);
        initReport();
      }
    }, 50);
    setTimeout(() => clearInterval(checkInterval), 5000);
  });
})();
