/* ============================================
   Dashboard Module
   Personal Financial Allocation v1.0.0
   ============================================ */

(function () {
  "use strict";

  let currentMonth = new Date().toISOString().slice(0, 7);
  let currentSalary = 0;
  let transactions = [];
  let categories = [];
  let salaryHistory = [];
  let charts = {};

  const CHART_COLORS = [
    "#5F8D7E",
    "#A7C4A0",
    "#F4A261",
    "#FFD166",
    "#52B788",
    "#E76F51",
    "#6FA8DC",
    "#B19CD9",
    "#E78AC3",
    "#7FA898",
    "#8FC4B4",
    "#D4A017",
  ];

  /* ============================================
     FIXED: Inisialisasi yang benar untuk Mobile
     ============================================ */
  document.addEventListener("DOMContentLoaded", async () => {
    // Step 1: Tunggu Firebase SDK siap
    await waitForFirebaseReady();

    // Step 2: Tunggu status auth yang sebenarnya dari Firebase
    // Ini CRUCIAL untuk iOS/Android karena Firebase butuh waktu untuk
    // memuat data login dari IndexedDB setelah redirect Google
    const user = await waitForAuthState();

    if (!user) {
      console.warn("[Dashboard] Tidak ada user, redirect ke login");
      window.location.replace("login.html");
      return;
    }

    // Pastikan App.currentUser ter-set
    if (window.App) {
      App.currentUser = user;
    }

    // Step 3: Inisialisasi dashboard
    try {
      await initDashboard();
    } catch (e) {
      console.error("Dashboard init error:", e);
      Toast.error("Gagal memuat data dashboard");
    }
  });

  /**
   * Tunggu hingga Firebase SDK selesai inisialisasi
   */
  function waitForFirebaseReady() {
    return new Promise((resolve) => {
      if (window.App?.ready) {
        resolve();
        return;
      }

      const checkInterval = setInterval(() => {
        if (window.App?.ready) {
          clearInterval(checkInterval);
          clearTimeout(timeout);
          resolve();
        }
      }, 50);

      const timeout = setTimeout(() => {
        clearInterval(checkInterval);
        console.warn("[Dashboard] Firebase ready timeout, melanjutkan...");
        resolve(); // Lanjutkan meski timeout
      }, 5000);
    });
  }

  /**
   * Tunggu status auth yang sebenarnya dari Firebase via onAuthStateChanged
   * Ini adalah cara yang PALING RELIABLE untuk mendeteksi user di iOS/Android
   */
  function waitForAuthState() {
    return new Promise((resolve) => {
      if (!window.App?.auth) {
        console.warn("[Dashboard] App.auth tidak tersedia");
        resolve(null);
        return;
      }

      const timeout = setTimeout(() => {
        console.warn("[Dashboard] Auth state timeout");
        unsubscribe();
        resolve(null);
      }, 8000); // Timeout 8 detik untuk mobile yang lambat

      const unsubscribe = App.auth.onAuthStateChanged((user) => {
        clearTimeout(timeout);
        unsubscribe();
        console.log("[Dashboard] Auth state resolved:", user?.email || "null");
        resolve(user);
      });
    });
  }

  async function initDashboard() {
    try {
      setSelectedMonth(currentMonth);
      await Promise.all([loadCategories(), loadSalaryHistory()]);
      await loadTransactions();
      setupSalaryForm();
      setupSearch();
      updateAll();
    } catch (e) {
      console.error("Dashboard init error:", e);
      Toast.error("Gagal memuat data dashboard");
    }
  }

  /* ============================================
     Data Loading
     ============================================ */
  async function loadCategories() {
    try {
      categories = await DB.getAll("categories", "name", "asc");
    } catch (e) {
      console.warn("Load categories error:", e);
      categories = Defaults.categories.map((c) => ({
        ...c,
        id: Sanitize.id(),
      }));
    }
  }

  async function loadSalaryHistory() {
    try {
      salaryHistory = await DB.getAll("salary", "month", "desc");
      renderSalaryHistory();
      const current = salaryHistory.find((s) => s.month === currentMonth);
      if (current) {
        currentSalary = Number(current.amount) || 0;
        updateSalaryDisplay();
      }
    } catch (e) {
      console.warn("Load salary error:", e);
      salaryHistory = [];
    }
  }

  function renderSalaryHistory() {
    const box = document.getElementById("salaryHistory");
    if (!box) return;
    if (!salaryHistory.length) {
      box.innerHTML =
        '<div style="padding:8px 14px;font-size:12px;color:var(--text-muted);">Belum ada history</div>';
      return;
    }
    box.innerHTML = salaryHistory
      .slice(0, 12)
      .map((s) => {
        const active = s.month === currentMonth ? "active" : "";
        const ym = s.month.split("-");
        const label = `${DateUtils.months()[parseInt(ym[1]) - 1]} ${ym[0]}`;
        return `<button type="button" class="salary-history-item ${active}" data-month="${Sanitize.string(s.month)}">${Sanitize.string(label)}</button>`;
      })
      .join("");
    box.querySelectorAll("[data-month]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const m = btn.getAttribute("data-month");
        setSelectedMonth(m);
        updateFromMonthSelect(m);
      });
    });
  }

  async function updateFromMonthSelect(month) {
    currentMonth = month;
    const entry = salaryHistory.find((s) => s.month === month);
    currentSalary = entry ? Number(entry.amount) || 0 : 0;
    updateSalaryDisplay();
    await loadTransactions();
    updateAll();
  }

  function setSelectedMonth(ym) {
    const parts = ym.split("-");
    const label = `${DateUtils.months()[parseInt(parts[1]) - 1]} ${parts[0]}`;
    const el = document.getElementById("breadcrumbMonth");
    if (el) el.textContent = `Periode: ${label}`;
  }

  async function loadTransactions() {
    try {
      transactions = await DB.query(
        "transactions",
        [{ field: "month", op: "==", value: currentMonth }],
        { field: "date", dir: "desc" },
      );
    } catch (e) {
      console.warn("Load transactions error:", e);
      transactions = [];
    }
  }

  /* ============================================
     Salary Form
     ============================================ */
  function setupSalaryForm() {
    const btn = document.getElementById("setSalaryBtn");
    if (btn) btn.addEventListener("click", openSalaryModal);
  }

  function openSalaryModal() {
    const ymParts = currentMonth.split("-");
    const monthLabel = `${DateUtils.months()[parseInt(ymParts[1]) - 1]} ${ymParts[0]}`;
    const { modal, close } = Modal.create({
      title: `Input Gaji - ${monthLabel}`,
      content: `
        <form id="salaryForm">
          <div class="form-group">
            <label class="form-label">Bulan</label>
            <input type="month" id="salaryMonthInput" class="form-control" value="${Sanitize.string(currentMonth)}">
          </div>
          <div class="form-group">
            <label class="form-label">Nominal Gaji <span class="required">*</span></label>
            <input type="text" id="salaryAmountInput" class="form-control" placeholder="Rp 0" value="${currentSalary > 0 ? IDR.format(currentSalary) : ""}">
          </div>
          <div class="alert alert-info">
            <div class="alert-icon">ℹ</div>
            <div>Gaji disimpan per bulan. Data bulan lalu tetap tersimpan dan bisa dipilih di history.</div>
          </div>
        </form>
      `,
      footer: `
        <button class="btn btn-secondary" data-action="cancel">Batal</button>
        <button class="btn btn-primary" data-action="save">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
          Simpan Gaji
        </button>
      `,
      className: "",
    });

    setTimeout(() => {
      const amtEl = modal.querySelector("#salaryAmountInput");
      if (amtEl) IDR.maskInput(amtEl);
    }, 50);

    modal
      .querySelector('[data-action="cancel"]')
      .addEventListener("click", close);
    modal
      .querySelector('[data-action="save"]')
      .addEventListener("click", async () => {
        const month =
          modal.querySelector("#salaryMonthInput").value || currentMonth;
        const amount = IDR.parse(
          modal.querySelector("#salaryAmountInput").value,
        );
        if (amount <= 0) {
          Toast.warning("Harap masukkan nominal gaji yang valid");
          return;
        }
        try {
          const exist = salaryHistory.find((s) => s.month === month);
          if (exist) {
            await DB.update("salary", exist.id, { amount });
          } else {
            await DB.add("salary", { month, amount });
          }
          close();
          Toast.success("Gaji berhasil disimpan");
          currentMonth = month;
          setSelectedMonth(month);
          await loadSalaryHistory();
          const saved = salaryHistory.find((s) => s.month === month) || {
            month,
            amount,
          };
          currentSalary = Number(saved.amount) || amount;
          updateSalaryDisplay();
          await loadTransactions();
          updateAll();
        } catch (e) {
          console.error(e);
          Toast.error("Gagal menyimpan gaji");
        }
      });
  }

  function updateSalaryDisplay() {
    const amountEl = document.getElementById("currentSalaryAmount");
    const monthEl = document.getElementById("currentSalaryMonth");
    const headerEl = document.getElementById("salaryHeaderTitle");
    const ymParts = currentMonth.split("-");
    const label = `${DateUtils.months()[parseInt(ymParts[1]) - 1]} ${ymParts[0]}`;
    if (amountEl)
      amountEl.textContent =
        currentSalary > 0 ? IDR.format(currentSalary) : "Belum Diset";
    if (monthEl) monthEl.textContent = label;
    if (headerEl && currentSalary === 0)
      headerEl.textContent = "Atur Gaji Bulan Ini";
    if (headerEl && currentSalary > 0) headerEl.textContent = `Gaji ${label}`;
  }

  /* ============================================
     Search
     ============================================ */
  function setupSearch() {
    const input = document.getElementById("dashboardSearch");
    if (!input) return;
    input.addEventListener("input", () => {
      const q = input.value.toLowerCase().trim();
      if (!q) {
        renderRecent(transactions);
        return;
      }
      const filtered = transactions.filter(
        (t) =>
          (t.name || "").toLowerCase().includes(q) ||
          (t.categoryName || "").toLowerCase().includes(q) ||
          (t.remark || "").toLowerCase().includes(q),
      );
      renderRecent(filtered);
    });
  }

  /* ============================================
     Calculations & UI Updates
     ============================================ */
  function computeSummary() {
    const totalAmount = transactions.reduce(
      (s, t) => s + (Number(t.amount) || 0),
      0,
    );
    const totalAdmin = transactions.reduce(
      (s, t) => s + (Number(t.adminAmount) || 0),
      0,
    );
    const totalGrand = totalAmount + totalAdmin;
    const paidCount = transactions.filter((t) => t.isPaid).length;
    const unpaidCount = transactions.length - paidCount;
    const usedPct = currentSalary > 0 ? (totalGrand / currentSalary) * 100 : 0;
    const remaining = Math.max(0, currentSalary - totalGrand);
    const remainingPct =
      currentSalary > 0 ? (remaining / currentSalary) * 100 : 0;
    const paymentProgress =
      transactions.length > 0 ? (paidCount / transactions.length) * 100 : 0;

    return {
      totalAmount,
      totalAdmin,
      totalGrand,
      paidCount,
      unpaidCount,
      usedPct,
      remaining,
      remainingPct,
      paymentProgress,
    };
  }

  function updateAll() {
    const sum = computeSummary();
    updateStats(sum);
    updateStatusCards(sum);
    updateCircular(sum);
    renderRecent(transactions);
    renderCharts();
  }

  function updateStats(s) {
    document.getElementById("statSalary").textContent =
      IDR.formatShort(currentSalary);
    document.getElementById("statAllocated").textContent = IDR.formatShort(
      s.totalGrand,
    );
    document.getElementById("statRemaining").textContent = IDR.formatShort(
      s.remaining,
    );
    document.getElementById("statPaymentProgress").textContent =
      Math.round(s.paymentProgress) + "%";

    document.getElementById("statAllocatedPercent").textContent =
      Math.round(s.usedPct) + "%";
    document.getElementById("statRemainingPercent").textContent =
      Math.round(s.remainingPct) + "%";
    document.getElementById("statAllocatedProgress").style.width =
      Math.min(s.usedPct, 100) + "%";
    document.getElementById("statRemainingProgress").style.width =
      Math.min(s.remainingPct, 100) + "%";

    const bar = document.getElementById("statPaymentBar");
    if (bar) {
      bar.style.width = Math.min(s.paymentProgress, 100) + "%";
      bar.className =
        "progress-bar" +
        (s.paymentProgress > 80
          ? " success"
          : s.paymentProgress > 50
            ? " warning"
            : "");
    }

    const chgEl = document.getElementById("statSalaryChange");
    if (chgEl && salaryHistory.length > 1) {
      const sorted = [...salaryHistory].sort((a, b) =>
        (b.month || "").localeCompare(a.month || ""),
      );
      const idx = sorted.findIndex((x) => x.month === currentMonth);
      if (idx >= 0 && idx < sorted.length - 1) {
        const prev = Number(sorted[idx + 1].amount) || 0;
        if (prev > 0 && currentSalary > 0) {
          const diff = ((currentSalary - prev) / prev) * 100;
          chgEl.className =
            "stat-percent " + (diff >= 0 ? "positive" : "negative");
          chgEl.innerHTML = `${diff >= 0 ? "📈" : "📉"} ${Math.abs(diff).toFixed(1)}%`;
        }
      }
    }
  }

  function updateStatusCards(s) {
    document.getElementById("statusPaid").textContent = s.paidCount;
    document.getElementById("statusUnpaid").textContent = s.unpaidCount;
    document.getElementById("statusTotal").textContent = transactions.length;
    document.getElementById("statusPercent").textContent =
      Math.round(s.usedPct) + "%";
  }

  function updateCircular(s) {
    const fill = document.getElementById("circularFill");
    const pctEl = document.getElementById("circularPercent");
    const subEl = document.getElementById("circularSub");
    const CIRCUMFERENCE = 2 * Math.PI * 88;
    const pct = Math.min(s.usedPct, 100);
    const offset = CIRCUMFERENCE * (1 - pct / 100);
    if (fill) fill.setAttribute("stroke-dashoffset", offset);
    if (pctEl) pctEl.textContent = Math.round(pct) + "%";
    if (subEl)
      subEl.textContent = `${IDR.formatShort(s.totalGrand)} / ${IDR.formatShort(currentSalary)}`;
  }

  /* ============================================
     Recent Transactions
     ============================================ */
  function getCategory(id) {
    return categories.find((c) => c.id === id) || null;
  }

  function getColorBg(code) {
    const map = Defaults.categoryColorMap;
    return map[code] ? map[code].bg : "#5F8D7E";
  }

  function getColorBadgeClass(code) {
    const cls = {
      sage: "badge-sage",
      orange: "badge-orange",
      yellow: "badge-yellow",
    };
    return cls[code] || "badge-secondary";
  }

  function renderRecent(list) {
    const wrap = document.getElementById("recentTransactions");
    if (!wrap) return;
    if (!list.length) {
      wrap.innerHTML = `
        <div class="empty-state" style="padding:30px 20px;">
          <div class="empty-state-illustration" style="width:100px;height:100px;margin-bottom:14px;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
          </div>
          <div style="font-size:14px;font-weight:600;">Belum ada transaksi</div>
          <div style="font-size:12px;color:var(--text-muted);margin-top:4px;">Tekan tombol + untuk menambah</div>
        </div>`;
      return;
    }
    const recent = list.slice(0, 6);
    wrap.innerHTML = recent
      .map((t) => {
        const cat = getCategory(t.categoryId);
        const catName = Sanitize.string(
          t.categoryName || (cat ? cat.name : "-"),
        );
        const colorCode = t.colorCode || (cat ? cat.colorCode : "sage");
        const colorBg = getColorBg(colorCode);
        const initial = (catName[0] || t.name[0] || "?").toUpperCase();
        const amount = (Number(t.amount) || 0) + (Number(t.adminAmount) || 0);
        const pct =
          currentSalary > 0 ? ((amount / currentSalary) * 100).toFixed(1) : 0;
        const paidCls = t.isPaid ? "paid" : "";
        return `
        <div class="recent-item ${paidCls}" onclick="window.location.href='transaction.html'">
          <div class="recent-category-icon" style="background:${colorBg};">
            ${Sanitize.string(initial)}
            <span class="color-badge" style="background:${colorBg};"></span>
          </div>
          <div class="recent-info">
            <div class="recent-name">${Sanitize.string(t.name || "-")}</div>
            <div class="recent-meta">
              <span>${DateUtils.format(t.date, "short")}</span>
              <span>·</span>
              <span class="badge ${getColorBadgeClass(colorCode)}" style="padding:2px 8px;">${Sanitize.string(catName)}</span>
            </div>
          </div>
          <div class="recent-amount">
            <div class="recent-nominal">${IDR.format(amount)}</div>
            <div class="recent-percent">${pct}% dari gaji</div>
          </div>
        </div>
      `;
      })
      .join("");
  }

  /* ============================================
     Charts
     ============================================ */
  function _themeChartColors() {
    const isDark = App.theme === "dark";
    return {
      text: isDark ? "#CBD5E1" : "#6C757D",
      grid: isDark ? "#475569" : "#E9ECEF",
      surface: isDark ? "#1E293B" : "#FFFFFF",
    };
  }

  function destroyCharts() {
    Object.values(charts).forEach((c) => {
      try {
        c.destroy();
      } catch (e) {}
    });
    charts = {};
  }

  function computeCategoryTotals() {
    const map = {};
    transactions.forEach((t) => {
      const catId = t.categoryId || "uncategorized";
      if (!map[catId]) {
        map[catId] = {
          id: catId,
          name: t.categoryName || getCategory(catId)?.name || "Lainnya",
          colorCode: t.colorCode || getCategory(catId)?.colorCode || "sage",
          total: 0,
          count: 0,
        };
      }
      map[catId].total +=
        (Number(t.amount) || 0) + (Number(t.adminAmount) || 0);
      map[catId].count++;
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }

  function renderCharts() {
    const tc = _themeChartColors();
    Chart.defaults.color = tc.text;
    Chart.defaults.font.family = "'Inter', sans-serif";
    Chart.defaults.font.size = 12;

    destroyCharts();
    renderBarChart(tc);
    renderPieChart(tc);
    renderLineChart(tc);
    renderCategoryLegend();
  }

  function renderBarChart(tc) {
    const canvas = document.getElementById("barChart");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const byCat = computeCategoryTotals();
    const labels = byCat.map((c) =>
      c.name.length > 10 ? c.name.slice(0, 10) + ".." : c.name,
    );
    const data = byCat.map((c) => c.total);
    const bgColors = byCat.map((c, i) => getColorBg(c.colorCode) + "CC");
    const borderColors = byCat.map((c, i) => getColorBg(c.colorCode));

    charts.bar = new Chart(ctx, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "Total (Rp)",
            data,
            backgroundColor: bgColors,
            borderColor: borderColors,
            borderWidth: 1.5,
            borderRadius: 8,
            borderSkipped: false,
            maxBarThickness: 40,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 800, easing: "easeOutQuart" },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: tc.surface,
            titleColor: tc.text,
            bodyColor: tc.text,
            borderColor: tc.grid,
            borderWidth: 1,
            padding: 12,
            cornerRadius: 8,
            displayColors: false,
            callbacks: {
              label: (ctx) => "Total: " + IDR.format(ctx.raw),
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            border: { color: tc.grid },
          },
          y: {
            grid: { color: tc.grid, drawBorder: false },
            border: { display: false },
            ticks: {
              callback: (v) => IDR.formatShort(v),
            },
          },
        },
      },
    });
  }

  function renderPieChart(tc) {
    const canvas = document.getElementById("pieChart");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const byCat = computeCategoryTotals();
    if (!byCat.length) {
      charts.pie = new Chart(ctx, {
        type: "doughnut",
        data: {
          labels: ["(Belum ada data)"],
          datasets: [
            { data: [1], backgroundColor: ["#E9ECEF"], borderWidth: 0 },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          cutout: "65%",
        },
      });
      return;
    }
    const labels = byCat.map((c) => c.name);
    const data = byCat.map((c) => c.total);
    const bg = byCat.map((c) => getColorBg(c.colorCode));

    charts.pie = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels,
        datasets: [
          {
            data,
            backgroundColor: bg,
            borderColor: tc.surface,
            borderWidth: 3,
            hoverOffset: 8,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "60%",
        animation: { animateRotate: true, animateScale: true, duration: 900 },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: tc.surface,
            titleColor: tc.text,
            bodyColor: tc.text,
            borderColor: tc.grid,
            borderWidth: 1,
            padding: 12,
            cornerRadius: 8,
            callbacks: {
              label: (ctx) => {
                const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                const pct =
                  total > 0 ? ((ctx.raw / total) * 100).toFixed(1) : 0;
                return `${ctx.label}: ${IDR.format(ctx.raw)} (${pct}%)`;
              },
            },
          },
        },
      },
    });
  }

  function renderLineChart(tc) {
    const canvas = document.getElementById("lineChart");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    const daysInMonth = DateUtils.daysInMonth(currentMonth);
    const labels = Array.from({ length: daysInMonth }, (_, i) =>
      (i + 1).toString(),
    );
    let runningPaid = 0;
    let runningUnpaid = 0;
    const paidData = new Array(daysInMonth).fill(0);
    const unpaidData = new Array(daysInMonth).fill(0);

    const txsByDay = {};
    transactions.forEach((t) => {
      const d = new Date(t.date).getDate();
      const total = (Number(t.amount) || 0) + (Number(t.adminAmount) || 0);
      if (!txsByDay[d]) txsByDay[d] = { paid: 0, unpaid: 0 };
      if (t.isPaid) txsByDay[d].paid += total;
      else txsByDay[d].unpaid += total;
    });

    for (let day = 1; day <= daysInMonth; day++) {
      runningPaid += txsByDay[day]?.paid || 0;
      runningUnpaid += txsByDay[day]?.unpaid || 0;
      paidData[day - 1] = runningPaid;
      unpaidData[day - 1] = runningUnpaid;
    }

    const gradient = (chart, colorStart, colorEnd) => {
      const g = chart.ctx.createLinearGradient(0, 0, 0, chart.chartArea.height);
      g.addColorStop(0, colorStart + "55");
      g.addColorStop(1, colorEnd + "00");
      return g;
    };

    charts.line = new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Sudah Dibayar (kumulatif)",
            data: paidData,
            borderColor: "#52B788",
            backgroundColor: (ctx) => {
              const c = ctx.chart;
              if (!c.chartArea) return "rgba(82,183,136,0.15)";
              return gradient(c, "#52B788", "#52B788");
            },
            fill: true,
            tension: 0.4,
            pointRadius: 0,
            pointHoverRadius: 6,
            borderWidth: 2.5,
          },
          {
            label: "Belum Dibayar (kumulatif)",
            data: unpaidData,
            borderColor: "#E76F51",
            backgroundColor: (ctx) => {
              const c = ctx.chart;
              if (!c.chartArea) return "rgba(231,111,81,0.12)";
              return gradient(c, "#E76F51", "#E76F51");
            },
            fill: true,
            tension: 0.4,
            pointRadius: 0,
            pointHoverRadius: 6,
            borderWidth: 2.5,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        animation: { duration: 1000, easing: "easeOutQuart" },
        plugins: {
          legend: {
            position: "bottom",
            labels: { usePointStyle: true, padding: 20, pointStyle: "circle" },
          },
          tooltip: {
            backgroundColor: tc.surface,
            titleColor: tc.text,
            bodyColor: tc.text,
            borderColor: tc.grid,
            borderWidth: 1,
            padding: 12,
            cornerRadius: 8,
            callbacks: {
              label: (ctx) => `${ctx.dataset.label}: ${IDR.format(ctx.raw)}`,
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            border: { color: tc.grid },
            ticks: { autoSkip: true, maxTicksLimit: 10 },
          },
          y: {
            grid: { color: tc.grid, drawBorder: false },
            border: { display: false },
            ticks: { callback: (v) => IDR.formatShort(v) },
          },
        },
      },
    });
  }

  function renderCategoryLegend() {
    const wrap = document.getElementById("categoryLegend");
    if (!wrap) return;
    const byCat = computeCategoryTotals();
    const totalAll = byCat.reduce((s, c) => s + c.total, 0);
    if (!byCat.length) {
      wrap.innerHTML = "";
      return;
    }
    wrap.innerHTML = byCat
      .slice(0, 8)
      .map((c) => {
        const pct = totalAll > 0 ? ((c.total / totalAll) * 100).toFixed(1) : 0;
        return `
        <div class="legend-item">
          <div class="legend-left">
            <span class="legend-color" style="background:${getColorBg(c.colorCode)};"></span>
            <span class="legend-name">${Sanitize.string(c.name)}</span>
          </div>
          <span class="legend-value">${IDR.format(c.total)}</span>
          <span class="legend-percent">${pct}%</span>
        </div>
      `;
      })
      .join("");
  }
})();