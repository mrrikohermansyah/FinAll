/* ============================================
   Transaction Module
   Personal Financial Allocation v1.0.0
   ============================================ */

(function() {
  'use strict';

  const State = {
    allTransactions: [],
    filtered: [],
    categories: [],
    adminTransactions: [],
    salaries: [],
    currentSalary: 0,
    view: 'table',
    sort: { field: 'date', dir: 'desc' },
    page: 1,
    perPage: 10,
    filters: {
      search: '',
      month: '',
      year: '',
      status: '',
      color: '',
      category: ''
    },
    editingId: null
  };

  document.addEventListener('DOMContentLoaded', () => {
    const checkInterval = setInterval(() => {
      if (App.ready && App.currentUser) {
        clearInterval(checkInterval);
        initTransactionsPage();
      }
    }, 50);
    setTimeout(() => clearInterval(checkInterval), 5000);
  });

  async function initTransactionsPage() {
    try {
      populateFilterOptions();
      setupViewToggle();
      setupFilterListeners();
      setupAddButton();
      setupModalInputs();
      setupExportAndPrint();
      setupResetFilters();

      await Promise.all([
        loadCategories(),
        loadAdminTransactions(),
        loadSalaries()
      ]);
      populateCategorySelect();
      populateAdminSelect();
      populateFilterCategorySelect();

      await loadAllTransactions();
      applyFilters();
      renderAll();

      // Live updates via onSnapshot (best-effort)
      try {
        DB.onSnapshot(
          'transactions',
          (docs) => {
            State.allTransactions = docs;
            applyFilters();
            renderAll();
          },
          [],
          'date',
          'desc'
        );
      } catch (e) {
        console.warn('Snapshot failed, fallback to manual refresh');
      }
    } catch (e) {
      console.error(e);
      Toast.error('Gagal memuat data transaksi');
    }
  }

  /* ============================================
     Loading Data
     ============================================ */
  async function loadCategories() {
    try {
      State.categories = await DB.getAll('categories', 'name', 'asc');
    } catch (e) { State.categories = Defaults.categories.map(c => ({...c, id: Sanitize.id()})); }
  }
  async function loadAdminTransactions() {
    try {
      const data = await DB.getAll('admin_transactions', 'name', 'asc');
      State.adminTransactions = data.filter(a => a.status !== 'inactive');
    } catch (e) { State.adminTransactions = Defaults.adminTransactions.map(a => ({...a, id: Sanitize.id()})); }
  }
  async function loadSalaries() {
    try {
      State.salaries = await DB.getAll('salary', 'month', 'desc');
      const thisMonth = new Date().toISOString().slice(0,7);
      const cur = State.salaries.find(s => s.month === thisMonth) || State.salaries[0];
      State.currentSalary = cur ? Number(cur.amount) || 0 : 0;
    } catch (e) { State.salaries = []; State.currentSalary = 0; }
  }
  function getSalaryForMonth(ym) {
    const s = State.salaries.find(x => x.month === ym);
    return s ? Number(s.amount) || 0 : State.currentSalary;
  }
  async function loadAllTransactions() {
    try {
      State.allTransactions = await DB.getAll('transactions', 'date', 'desc');
    } catch (e) {
      State.allTransactions = [];
    }
  }

  /* ============================================
     UI Setup
     ============================================ */
  function populateFilterOptions() {
    const now = new Date();
    const months = DateUtils.months();
    const monthSel = document.getElementById('filterMonth');
    if (monthSel) {
      months.forEach((m, i) => {
        const v = String(i+1).padStart(2,'0');
        monthSel.insertAdjacentHTML('beforeend', `<option value="${v}">${Sanitize.string(m)}</option>`);
      });
    }
    const yearSel = document.getElementById('filterYear');
    if (yearSel) {
      DateUtils.years(0, 5).forEach(y => {
        yearSel.insertAdjacentHTML('beforeend', `<option value="${y}">${y}</option>`);
      });
    }
  }

  function populateFilterCategorySelect() {
    const sel = document.getElementById('filterCategory');
    if (!sel) return;
    const current = sel.value;
    sel.innerHTML = '<option value="">Semua Kategori</option>' +
      State.categories.map(c => `<option value="${Sanitize.string(c.id)}">${Sanitize.string(c.name)}</option>`).join('');
    sel.value = current;
  }

  function populateCategorySelect() {
    const sel = document.getElementById('txCategory');
    if (!sel) return;
    sel.innerHTML = '<option value="">Pilih Kategori</option>' +
      State.categories.map(c => `<option value="${Sanitize.string(c.id)}" data-color="${Sanitize.string(c.colorCode || 'sage')}">${Sanitize.string(c.name)}</option>`).join('');
  }

  function populateAdminSelect() {
    const sel = document.getElementById('txAdminSelect');
    if (!sel) return;
    sel.innerHTML = '<option value="">Pilih Admin</option>' +
      State.adminTransactions.map(a => `<option value="${Sanitize.string(a.id)}" data-amount="${Number(a.amount) || 0}">${Sanitize.string(a.name)} - ${IDR.format(a.amount)}</option>`).join('');
  }

  function setupViewToggle() {
    const group = document.getElementById('viewToggle');
    if (!group) return;
    group.querySelectorAll('.toggle-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        group.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const v = btn.getAttribute('data-view');
        State.view = v;
        document.getElementById('tableView').style.display = v === 'table' ? '' : 'none';
        document.getElementById('cardView').style.display = v === 'card' ? '' : 'none';
        State.page = 1;
        renderAll();
      });
    });
  }

  function setupFilterListeners() {
    const ids = ['txSearch', 'filterMonth', 'filterYear', 'filterStatus', 'filterColor', 'filterCategory'];
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('input', onFilterChange);
      el.addEventListener('change', onFilterChange);
    });
    const sInput = document.getElementById('txSearch');
    if (sInput) sInput.addEventListener('keyup', e => { if (e.key === 'Escape') { sInput.value=''; onFilterChange(); }});
  }

  function onFilterChange() {
    State.filters.search = (document.getElementById('txSearch')?.value || '').toLowerCase().trim();
    State.filters.month = document.getElementById('filterMonth')?.value || '';
    State.filters.year = document.getElementById('filterYear')?.value || '';
    State.filters.status = document.getElementById('filterStatus')?.value || '';
    State.filters.color = document.getElementById('filterColor')?.value || '';
    State.filters.category = document.getElementById('filterCategory')?.value || '';
    State.page = 1;
    applyFilters();
    renderAll();
  }

  function setupResetFilters() {
    const btn = document.getElementById('resetFilters');
    if (!btn) return;
    btn.addEventListener('click', () => {
      ['txSearch', 'filterMonth', 'filterYear', 'filterStatus', 'filterColor', 'filterCategory'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
      });
      onFilterChange();
      Toast.info('Filter telah direset');
    });
  }

  function setupAddButton() {
    const fab = document.getElementById('addTxBtn');
    if (fab) fab.addEventListener('click', openTxModal);
  }

  function setupExportAndPrint() {
    const csvBtn = document.getElementById('exportCSV');
    if (csvBtn) csvBtn.addEventListener('click', exportCSV);
    const printBtn = document.getElementById('printBtn');
    if (printBtn) printBtn.addEventListener('click', printTransactions);
  }

  /* ============================================
     Modal: Add / Edit Transaction
     ============================================ */
  function setupModalInputs() {
    const amount = document.getElementById('txAmount');
    if (amount) IDR.maskInput(amount);
    const admAmount = document.getElementById('txAdminAmount');
    if (admAmount) IDR.maskInput(admAmount);
    const txMonth = document.getElementById('txMonth');
    if (txMonth) txMonth.value = new Date().toISOString().slice(0,7);
    const txDate = document.getElementById('txDate');
    if (txDate) txDate.value = DateUtils.ymd(new Date());

    const useAdmin = document.getElementById('txUseAdmin');
    const adminSel = document.getElementById('txAdminSelect');
    const adminAmount = document.getElementById('txAdminAmount');

    if (useAdmin && adminSel) {
      useAdmin.addEventListener('change', () => {
        adminSel.disabled = !useAdmin.checked;
        if (!useAdmin.checked) {
          adminSel.value = '';
          adminAmount.value = '';
        }
        recomputeTotals();
      });
    }
    if (adminSel) {
      adminSel.addEventListener('change', () => {
        const opt = adminSel.selectedOptions[0];
        const amt = opt ? Number(opt.getAttribute('data-amount') || 0) : 0;
        adminAmount.value = amt ? IDR.format(amt) : '';
        recomputeTotals();
      });
    }
    [amount, adminAmount, txMonth].forEach(el => {
      if (el) el.addEventListener('input', recomputeTotals);
      if (el) el.addEventListener('change', recomputeTotals);
    });

    const catSel = document.getElementById('txCategory');
    if (catSel) {
      catSel.addEventListener('change', recomputeTotals);
    }

    const submitBtn = document.getElementById('txSubmitBtn');
    if (submitBtn) submitBtn.addEventListener('click', submitTransaction);
  }

  function recomputeTotals() {
    const amount = IDR.parse(document.getElementById('txAmount')?.value || 0);
    const adminAmt = IDR.parse(document.getElementById('txAdminAmount')?.value || 0);
    const total = amount + adminAmt;
    const ym = document.getElementById('txMonth')?.value;
    const salary = ym ? getSalaryForMonth(ym) : State.currentSalary;
    const pct = salary > 0 ? ((total / salary) * 100).toFixed(2) + '%' : '0%';
    const pctEl = document.getElementById('txPercent');
    if (pctEl) pctEl.value = pct;
    const totalEl = document.getElementById('txTotal');
    if (totalEl) totalEl.value = total > 0 ? IDR.format(total) : '';
  }

  function openTxModal(editData = null) {
    State.editingId = editData ? editData.id : null;
    document.getElementById('txModalTitle').textContent = editData ? 'Edit Transaksi' : 'Tambah Transaksi';
    document.getElementById('txName').value = editData ? editData.name || '' : '';
    document.getElementById('txCategory').value = editData ? (editData.categoryId || '') : '';
    document.getElementById('txDate').value = editData ? DateUtils.ymd(editData.date) : DateUtils.ymd(new Date());
    document.getElementById('txMonth').value = editData ? (editData.month || new Date().toISOString().slice(0,7)) : new Date().toISOString().slice(0,7);
    document.getElementById('txAmount').value = editData && editData.amount ? IDR.format(editData.amount) : '';
    document.getElementById('txUseAdmin').checked = !!(editData && editData.useAdmin);
    document.getElementById('txAdminSelect').disabled = !(editData && editData.useAdmin);
    document.getElementById('txAdminSelect').value = editData ? (editData.adminTransactionId || '') : '';
    document.getElementById('txAdminAmount').value = editData && editData.adminAmount ? IDR.format(editData.adminAmount) : '';
    document.getElementById('txPaid').checked = !!(editData && editData.isPaid);
    document.getElementById('txRemark').value = editData ? (editData.remark || '') : '';
    recomputeTotals();
    const overlay = document.getElementById('txModal');
    if (overlay) overlay.classList.add('show');
  }

  window.closeTxModal = function() {
    const overlay = document.getElementById('txModal');
    if (overlay) overlay.classList.remove('show');
    State.editingId = null;
  };

  async function submitTransaction() {
    const name = Sanitize.string(document.getElementById('txName').value, 100);
    const categoryId = document.getElementById('txCategory').value;
    const dateVal = document.getElementById('txDate').value;
    const month = document.getElementById('txMonth').value;
    const amount = IDR.parse(document.getElementById('txAmount').value);
    const useAdmin = document.getElementById('txUseAdmin').checked;
    const adminTransactionId = document.getElementById('txAdminSelect').value;
    const adminAmount = IDR.parse(document.getElementById('txAdminAmount').value);
    const isPaid = document.getElementById('txPaid').checked;
    const remark = Sanitize.string(document.getElementById('txRemark').value, 300);

    if (!name) return Toast.warning('Nama alokasi diperlukan');
    if (!categoryId) return Toast.warning('Pilih kategori');
    if (!dateVal) return Toast.warning('Pilih tanggal');
    if (!month) return Toast.warning('Pilih bulan');
    if (amount <= 0) return Toast.warning('Nominal harus lebih dari 0');
    if (useAdmin && adminAmount < 0) return Toast.warning('Admin tidak valid');

    const cat = State.categories.find(c => c.id === categoryId) || {};
    const payload = {
      name,
      categoryId,
      categoryName: cat.name || '',
      colorCode: cat.colorCode || 'sage',
      date: new Date(dateVal).toISOString(),
      month,
      amount: Number(amount) || 0,
      useAdmin: !!useAdmin,
      adminTransactionId: useAdmin ? adminTransactionId : '',
      adminAmount: useAdmin ? (Number(adminAmount) || 0) : 0,
      total: (Number(amount) || 0) + (useAdmin ? (Number(adminAmount) || 0) : 0),
      isPaid: !!isPaid,
      remark
    };

    try {
      if (State.editingId) {
        await DB.update('transactions', State.editingId, payload);
        Toast.success('Transaksi berhasil diperbarui');
      } else {
        await DB.add('transactions', payload);
        Toast.success('Transaksi berhasil ditambahkan', 'Berhasil');
      }
      closeTxModal();
      await loadAllTransactions();
      applyFilters();
      renderAll();
    } catch (e) {
      console.error(e);
      Toast.error('Gagal menyimpan transaksi');
    }
  }

  window.editTransaction = function(id) {
    const t = State.allTransactions.find(x => x.id === id);
    if (!t) return Toast.error('Data tidak ditemukan');
    openTxModal(t);
  };

  window.deleteTransaction = function(id) {
    const t = State.allTransactions.find(x => x.id === id);
    if (!t) return;
    Modal.confirm(
      `Hapus transaksi "${Sanitize.string(t.name || '-')}"? Tindakan ini tidak bisa dibatalkan.`,
      async () => {
        try {
          await DB.delete('transactions', id);
          Toast.success('Transaksi berhasil dihapus');
          await loadAllTransactions();
          applyFilters();
          renderAll();
        } catch (e) {
          Toast.error('Gagal menghapus transaksi');
        }
      },
      'Hapus Transaksi'
    );
  };

  window.togglePaid = async function(id) {
    const t = State.allTransactions.find(x => x.id === id);
    if (!t) return;
    try {
      await DB.update('transactions', id, { isPaid: !t.isPaid });
      Toast.success(t.isPaid ? 'Status diubah menjadi Belum Dibayar' : 'Berhasil ditandai Sudah Dibayar');
    } catch (e) {
      Toast.error('Gagal mengubah status');
    }
  };

  /* ============================================
     Filters & Sorting
     ============================================ */
  function applyFilters() {
    let list = [...State.allTransactions];
    const f = State.filters;

    if (f.search) {
      list = list.filter(t =>
        (t.name || '').toLowerCase().includes(f.search) ||
        (t.categoryName || '').toLowerCase().includes(f.search) ||
        (t.remark || '').toLowerCase().includes(f.search)
      );
    }
    list = list.filter(t => {
      const ym = (t.month || '').split('-');
      const monthVal = ym[1] || '';
      const yearVal = ym[0] || '';
      if (f.month && monthVal !== f.month) return false;
      if (f.year && yearVal !== f.year) return false;
      if (f.status === 'paid' && !t.isPaid) return false;
      if (f.status === 'unpaid' && t.isPaid) return false;
      if (f.color && (t.colorCode || 'sage') !== f.color) return false;
      if (f.category && (t.categoryId || '') !== f.category) return false;
      return true;
    });

    const { field, dir } = State.sort;
    const mult = dir === 'asc' ? 1 : -1;
    list.sort((a, b) => {
      let av = a[field], bv = b[field];
      if (field === 'date') { av = new Date(av).getTime(); bv = new Date(bv).getTime(); }
      if (field === 'amount' || field === 'total') { av = Number(av)||0; bv = Number(bv)||0; }
      if (typeof av === 'string') av = av.toLowerCase();
      if (typeof bv === 'string') bv = bv.toLowerCase();
      if (av < bv) return -1 * mult;
      if (av > bv) return 1 * mult;
      return 0;
    });

    State.filtered = list;
  }

  /* ============================================
     Pagination
     ============================================ */
  function getPagedItems() {
    const start = (State.page - 1) * State.perPage;
    return State.filtered.slice(start, start + State.perPage);
  }

  function totalPages() {
    return Math.max(1, Math.ceil(State.filtered.length / State.perPage));
  }

  function renderPagination(infoId, controlId) {
    const infoEl = document.getElementById(infoId);
    const ctlEl = document.getElementById(controlId);
    if (infoEl) {
      const start = State.filtered.length === 0 ? 0 : (State.page - 1) * State.perPage + 1;
      const end = Math.min(State.page * State.perPage, State.filtered.length);
      infoEl.textContent = `Menampilkan ${start} - ${end} dari ${State.filtered.length} data`;
    }
    if (!ctlEl) return;
    const pages = totalPages();
    let html = '';
    html += `<button class="page-btn" ${State.page <= 1 ? 'disabled' : ''} onclick="goToPage(${State.page - 1})">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
    </button>`;
    const maxVisible = 5;
    let from = Math.max(1, State.page - 2);
    let to = Math.min(pages, from + maxVisible - 1);
    from = Math.max(1, to - maxVisible + 1);
    for (let p = from; p <= to; p++) {
      html += `<button class="page-btn ${p === State.page ? 'active' : ''}" onclick="goToPage(${p})">${p}</button>`;
    }
    html += `<button class="page-btn" ${State.page >= pages ? 'disabled' : ''} onclick="goToPage(${State.page + 1})">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
    </button>`;
    ctlEl.innerHTML = html;
  }

  window.goToPage = function(p) {
    const pages = totalPages();
    if (p < 1 || p > pages) return;
    State.page = p;
    renderAll();
  };

  /* ============================================
     Rendering
     ============================================ */
  function renderAll() {
    renderSummary();
    setupSortHeaders();
    renderTable();
    renderCards();
    renderPagination('paginationInfo', 'paginationControls');
    renderPagination('paginationInfo2', 'paginationControls2');
  }

  function renderSummary() {
    const data = State.filtered.length ? State.filtered : State.allTransactions;
    const totalAmt = data.reduce((s,t) => s + (Number(t.amount)||0), 0);
    const totalAdm = data.reduce((s,t) => s + (Number(t.adminAmount)||0), 0);
    const total = totalAmt + totalAdm;
    const totalTx = data.length;
    document.getElementById('summaryTotal').textContent = totalTx;
    document.getElementById('summaryAmount').textContent = IDR.format(totalAmt);
    document.getElementById('summaryAdmin').textContent = IDR.format(totalAdm);
    document.getElementById('summaryGrand').textContent = IDR.format(total);
  }

  function setupSortHeaders() {
    const table = document.getElementById('txTable');
    if (!table) return;
    table.querySelectorAll('th[data-sort]').forEach(th => {
      th.onclick = () => {
        const f = th.getAttribute('data-sort');
        if (State.sort.field === f) {
          State.sort.dir = State.sort.dir === 'asc' ? 'desc' : 'asc';
        } else {
          State.sort.field = f;
          State.sort.dir = 'asc';
        }
        table.querySelectorAll('th[data-sort]').forEach(x => x.classList.remove('sort-asc','sort-desc'));
        th.classList.add(State.sort.dir === 'asc' ? 'sort-asc' : 'sort-desc');
        applyFilters();
        renderAll();
      };
    });
  }

  function getColor(code) { return Defaults.categoryColorMap[code]?.bg || '#5F8D7E'; }
  function colorClass(code) {
    return ({ sage:'badge-sage', orange:'badge-orange', yellow:'badge-yellow' })[code] || 'badge-secondary';
  }
  function colorCardClass(code) {
    return ({ sage:'color-sage', orange:'color-orange', yellow:'color-yellow' })[code] || 'color-default';
  }

  function renderTable() {
    const body = document.getElementById('txTableBody');
    if (!body) return;
    const pageItems = getPagedItems();
    if (!pageItems.length) {
      body.innerHTML = `<tr><td colspan="12">
        <div class="table-empty">
          <div class="table-empty-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
          </div>
          <div class="table-empty-title">${State.allTransactions.length ? 'Tidak ada transaksi sesuai filter' : 'Belum ada transaksi'}</div>
          <div class="table-empty-desc">${State.allTransactions.length ? 'Coba ubah filter Anda' : 'Klik tombol + untuk menambah transaksi pertama'}</div>
        </div>
      </td></tr>`;
      return;
    }
    body.innerHTML = pageItems.map((t, i) => {
      const idx = (State.page - 1) * State.perPage + i + 1;
      const salary = getSalaryForMonth(t.month || new Date().toISOString().slice(0,7));
      const total = (Number(t.amount)||0) + (Number(t.adminAmount)||0);
      const pct = salary > 0 ? ((total/salary)*100).toFixed(2) + '%' : '0%';
      return `
        <tr style="${t.isPaid ? 'background:rgba(82,183,136,0.04);' : ''}">
          <td>${idx}</td>
          <td>${DateUtils.format(t.date, 'short')}</td>
          <td><strong>${Sanitize.string(t.name || '-')}</strong></td>
          <td>
            <span class="badge ${colorClass(t.colorCode)}" style="gap:6px;">
              <span class="color-dot" style="background:${getColor(t.colorCode)};"></span>
              ${Sanitize.string(t.categoryName || '-')}
            </span>
          </td>
          <td>${IDR.format(t.amount)}</td>
          <td>${(t.adminAmount || 0) > 0 ? IDR.format(t.adminAmount) : '-'}</td>
          <td><strong>${IDR.format(total)}</strong></td>
          <td><span class="badge badge-info">${pct}</span></td>
          <td>${t.isPaid
            ? '<span class="badge badge-success">✓ Sudah Dibayar</span>'
            : '<span class="badge badge-warning">⏳ Belum Dibayar</span>'}</td>
          <td><span class="color-dot" style="background:${getColor(t.colorCode)};"></span></td>
          <td style="max-width:120px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${Sanitize.string(t.remark||'')}">${Sanitize.string(t.remark || '-', 25)}</td>
          <td>
            <div class="action-btns">
              <label class="action-btn edit tooltip" onclick="event.stopPropagation();togglePaid('${Sanitize.string(t.id)}');" data-tooltip="${t.isPaid?'Batalkan bayar':'Tandai dibayar'}" style="cursor:pointer;">
                ${t.isPaid
                  ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#52B788" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>'
                  : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>'}
              </label>
              <button class="action-btn edit tooltip" onclick="editTransaction('${Sanitize.string(t.id)}')" data-tooltip="Edit" aria-label="Edit">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
              </button>
              <button class="action-btn delete tooltip" onclick="deleteTransaction('${Sanitize.string(t.id)}')" data-tooltip="Hapus" aria-label="Delete">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  function renderCards() {
    const grid = document.getElementById('txCardGrid');
    if (!grid) return;
    const pageItems = getPagedItems();
    if (!pageItems.length) {
      grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;">
        <div class="empty-state-illustration">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
        </div>
        <div class="empty-state-title">Tidak ada transaksi</div>
        <div class="empty-state-desc">Coba ubah filter atau tambah transaksi baru.</div>
      </div>`;
      return;
    }
    grid.innerHTML = pageItems.map(t => {
      const salary = getSalaryForMonth(t.month || new Date().toISOString().slice(0,7));
      const total = (Number(t.amount)||0) + (Number(t.adminAmount)||0);
      const pct = salary > 0 ? ((total/salary)*100).toFixed(2) : 0;
      const initial = ((t.categoryName || t.name || '?')[0] || '?').toUpperCase();
      const paidCls = t.isPaid ? 'paid' : '';
      const checked = t.isPaid ? 'checked' : '';
      const ccClass = colorCardClass(t.colorCode);
      return `
        <div class="transaction-card ${paidCls} ${ccClass}">
          <div class="transaction-header">
            <div class="transaction-title-wrap">
              <div class="transaction-cat-icon" style="background:${getColor(t.colorCode)};">${Sanitize.string(initial)}</div>
              <div class="transaction-details">
                <div class="transaction-name">${Sanitize.string(t.name || '-')}</div>
                <div class="transaction-meta">
                  <span class="badge ${colorClass(t.colorCode)}" style="padding:2px 8px;">${Sanitize.string(t.categoryName || '-')}</span>
                  <span class="transaction-date">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:2px;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                    ${DateUtils.format(t.date, 'short')}
                  </span>
                </div>
              </div>
            </div>
            <div class="action-btns">
              <button class="action-btn edit" onclick="editTransaction('${Sanitize.string(t.id)}')">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
              </button>
              <button class="action-btn delete" onclick="deleteTransaction('${Sanitize.string(t.id)}')">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
              </button>
            </div>
          </div>
          <div class="transaction-amount-section">
            <div class="amount-row">
              <span class="amount-label">Nominal</span>
              <span class="amount-value">${IDR.format(t.amount)}</span>
            </div>
            ${(t.adminAmount || 0) > 0 ? `
            <div class="amount-row">
              <span class="amount-label">Admin</span>
              <span class="amount-value">+ ${IDR.format(t.adminAmount)}</span>
            </div>` : ''}
            <div class="amount-row">
              <span class="amount-label"><strong>Total</strong></span>
              <span class="amount-value amount-total">${IDR.format(total)}</span>
            </div>
            <div style="margin-top:8px;text-align:right;"><span class="amount-percent">${pct}% dari gaji</span></div>
          </div>
          <div class="transaction-footer">
            <label class="transaction-status ${checked}" onclick="togglePaid('${Sanitize.string(t.id)}')">
              <span class="status-checkbox">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
              </span>
              <span class="status-text">${t.isPaid ? 'Sudah Dibayar' : 'Belum Dibayar'}</span>
            </label>
            ${t.remark ? `<span style="font-size:11px;color:var(--text-muted);max-width:140px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${Sanitize.string(t.remark)}">📝 ${Sanitize.string(t.remark, 18)}</span>` : ''}
          </div>
        </div>
      `;
    }).join('');
  }

  /* ============================================
     Export & Print
     ============================================ */
  function exportCSV() {
    if (!State.filtered.length) return Toast.warning('Tidak ada data untuk diekspor');
    const columns = [
      { key: 'no', label: 'No' },
      { key: 'date', label: 'Tanggal' },
      { key: 'name', label: 'Nama Alokasi' },
      { key: 'categoryName', label: 'Kategori' },
      { key: 'amount', label: 'Nominal' },
      { key: 'adminAmount', label: 'Admin' },
      { key: 'total', label: 'Total' },
      { key: 'percent', label: '% dari Gaji' },
      { key: 'isPaid', label: 'Status' },
      { key: 'remark', label: 'Remark' }
    ];
    const rows = State.filtered.map((t, i) => {
      const sal = getSalaryForMonth(t.month || '');
      const tot = (Number(t.amount)||0)+(Number(t.adminAmount)||0);
      return {
        no: i+1,
        date: DateUtils.format(t.date, 'short'),
        name: t.name || '',
        categoryName: t.categoryName || '',
        amount: IDR.format(t.amount),
        adminAmount: IDR.format(t.adminAmount || 0),
        total: IDR.format(tot),
        percent: sal > 0 ? ((tot/sal)*100).toFixed(2)+'%' : '0%',
        isPaid: t.isPaid ? 'Sudah Dibayar' : 'Belum Dibayar',
        remark: t.remark || ''
      };
    });
    const ym = (new Date()).toISOString().slice(0,10);
    Exporter.toCSV(rows, `transaksi-finall-${ym}.csv`, columns);
  }

  function printTransactions() {
    if (!State.filtered.length) return Toast.warning('Tidak ada data');
    const rowsHtml = State.filtered.map((t, i) => {
      const sal = getSalaryForMonth(t.month || '');
      const tot = (Number(t.amount)||0)+(Number(t.adminAmount)||0);
      const pct = sal > 0 ? ((tot/sal)*100).toFixed(2)+'%' : '0%';
      return `<tr>
        <td>${i+1}</td><td>${DateUtils.format(t.date, 'short')}</td>
        <td><strong>${Sanitize.string(t.name||'')}</strong></td>
        <td>${Sanitize.string(t.categoryName||'')}</td>
        <td>${IDR.format(t.amount)}</td>
        <td>${IDR.format(t.adminAmount||0)}</td>
        <td><strong>${IDR.format(tot)}</strong></td>
        <td>${pct}</td>
        <td>${t.isPaid ? '✓ Sudah' : 'Belum'}</td>
        <td>${Sanitize.string(t.remark||'')}</td>
      </tr>`;
    }).join('');
    const totalA = State.filtered.reduce((s,t)=>s+(Number(t.amount)||0),0);
    const totalAd = State.filtered.reduce((s,t)=>s+(Number(t.adminAmount)||0),0);
    const html = `
      <h1>Laporan Transaksi FinAll</h1>
      <div class="meta">Dicetak: ${DateUtils.format(new Date(), 'full')} · Total Data: ${State.filtered.length}</div>
      <table>
        <thead><tr>
          <th>No</th><th>Tanggal</th><th>Nama</th><th>Kategori</th><th>Nominal</th><th>Admin</th><th>Total</th><th>%</th><th>Status</th><th>Remark</th>
        </tr></thead>
        <tbody>${rowsHtml}</tbody>
        <tfoot><tr style="font-weight:700;background:#f0f5f3;">
          <td colspan="4">TOTAL</td>
          <td>${IDR.format(totalA)}</td>
          <td>${IDR.format(totalAd)}</td>
          <td>${IDR.format(totalA+totalAd)}</td>
          <td colspan="3"></td>
        </tr></tfoot>
      </table>
    `;
    Exporter.print('Laporan Transaksi - FinAll', html);
  }

})();
