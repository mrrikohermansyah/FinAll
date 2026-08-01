/* ============================================
   Settings Module
   Personal Financial Allocation v1.0.0
   ============================================ */

(function() {
  'use strict';

  let categories = [];
  let adminTransactions = [];
  let editingCategoryId = null;
  let editingAdminId = null;

  const COLORS = [
    { code: 'sage',   label: 'Sage Green (Berubah)', bg:'#5F8D7E' },
    { code: 'orange', label: 'Orange (Tetap)', bg: '#F4A261' },
    { code: 'yellow', label: 'Kuning (Prioritas)', bg: '#FFD166' },
    { code: 'custom1', label: 'Biru Muda', bg: '#6FA8DC' },
    { code: 'custom2', label: 'Ungu', bg: '#B19CD9' },
    { code: 'custom3', label: 'Pink', bg: '#E78AC3' }
  ];

  document.addEventListener('DOMContentLoaded', () => {
    const checkInterval = setInterval(() => {
      if (App.ready && App.currentUser) {
        clearInterval(checkInterval);
        initSettingsPage();
      }
    }, 50);
    setTimeout(() => clearInterval(checkInterval), 5000);
  });

  async function initSettingsPage() {
    try {
      setupTabs();
      setupColorPicker();
      setupCategoryButtons();
      setupAdminButtons();
      setupProfileForm();
      setupPreferences();
      loadAppVersion();

      await Promise.all([loadCategories(), loadAdminTransactions()]);
      renderCategories();
      renderAdminTable();
      renderProfileInfo();
    } catch (e) {
      console.error(e);
      Toast.error('Gagal memuat pengaturan');
    }
  }

  /* ============================================
     Tabs
     ============================================ */
  function setupTabs() {
    document.querySelectorAll('.settings-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.settings-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const name = tab.getAttribute('data-tab');
        document.querySelectorAll('.settings-section').forEach(s => s.classList.remove('active'));
        const target = document.getElementById('tab-' + name);
        if (target) target.classList.add('active');
      });
    });
  }

  /* ============================================
     Version
     ============================================ */
  function setupPreferences() {
    const darkCheck = document.getElementById('prefDarkMode');
    if (darkCheck) darkCheck.checked = App.theme === 'dark';
  }

  function loadAppVersion() {
    fetch('version.json?_=' + Date.now()).then(r => r.json()).then(d => {
      const v = document.getElementById('appVersion');
      const b = document.getElementById('appBuild');
      if (v) v.textContent = 'v' + d.version;
      if (b) b.textContent = 'Build: ' + d.build;
    }).catch(() => {});
  }

  /* ============================================
     Categories
     ============================================ */
  async function loadCategories() {
    try {
      categories = await DB.getAll('categories', 'name', 'asc');
    } catch (e) {
      categories = Defaults.categories.map(c => ({ ...c, id: Sanitize.id() }));
    }
  }

  function getColorBg(code) {
    return Defaults.categoryColorMap[code]?.bg || '#5F8D7E';
  }

  function renderCategories() {
    const list = document.getElementById('categoriesList');
    if (!list) return;
    if (!categories.length) {
      list.innerHTML = `<div class="table-empty"><div class="table-empty-title">Belum ada kategori</div><div class="table-empty-desc">Tambahkan kategori pertama Anda</div></div>`;
      return;
    }
    const typeLabel = { fixed: 'Tetap', variable: 'Berubah', saving: 'Tabungan / Prioritas' };
    list.innerHTML = categories.map(c => {
      const initial = ((c.name || '?')[0]?.toUpperCase() || '?');
      const colorBg = getColorBg(c.colorCode || 'sage');
      return `
        <div class="category-card animate-fade-up">
          <div class="category-color" style="background:${colorBg};">${Sanitize.string(initial)}</div>
          <div class="category-info">
            <div class="category-name">${Sanitize.string(c.name || '-')}</div>
            <div class="category-type">
              <span class="chip" style="font-size:10px;padding:3px 10px;background:rgba(0,0,0,0.04);">Tipe: ${Sanitize.string(typeLabel[c.type] || c.type || 'Umum')}</span>
              <span style="margin-left:8px;" class="chip" style="font-size:10px;padding:3px 10px;"><span class="color-dot" style="background:${colorBg};"></span> ${Sanitize.string(c.colorCode || 'sage')}</span>
              ${c.default ? '<span class="badge badge-secondary" style="margin-left:8px;padding:3px 8px;">Default</span>' : ''}
            </div>
          </div>
          <div class="category-actions">
            <button class="action-btn edit tooltip" onclick="editCategory('${Sanitize.string(c.id)}')" data-tooltip="Edit">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
            </button>
            <button class="action-btn delete tooltip" onclick="deleteCategory('${Sanitize.string(c.id)}')" data-tooltip="Hapus">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  function setupCategoryButtons() {
    const addBtn = document.getElementById('addCategoryBtn');
    if (addBtn) addBtn.addEventListener('click', () => openCategoryModal());

    const submitBtn = document.getElementById('catSubmitBtn');
    if (submitBtn) submitBtn.addEventListener('click', submitCategory);
  }

  function setupColorPicker() {
    const box = document.getElementById('colorPicker');
    if (!box) return;
    box.innerHTML = COLORS.map(c => `
      <div class="color-option" data-color="${Sanitize.string(c.code)}" style="background:${c.bg};" title="${Sanitize.string(c.label)}"></div>
    `).join('');
    box.querySelectorAll('.color-option').forEach(opt => {
      opt.addEventListener('click', () => {
        box.querySelectorAll('.color-option').forEach(x => x.classList.remove('selected'));
        opt.classList.add('selected');
        document.getElementById('catColor').value = opt.getAttribute('data-color');
      });
    });
    const first = box.querySelector('.color-option');
    if (first) first.classList.add('selected');
  }

  function openCategoryModal(edit = null) {
    editingCategoryId = edit ? edit.id : null;
    document.getElementById('catModalTitle').textContent = edit ? 'Edit Kategori' : 'Tambah Kategori';
    document.getElementById('catName').value = edit ? (edit.name || '') : '';
    document.getElementById('catType').value = edit ? (edit.type || 'variable') : 'variable';
    const color = edit ? (edit.colorCode || 'sage') : 'sage';
    document.getElementById('catColor').value = color;
    const box = document.getElementById('colorPicker');
    if (box) {
      box.querySelectorAll('.color-option').forEach(x => {
        x.classList.toggle('selected', x.getAttribute('data-color') === color);
      });
    }
    const overlay = document.getElementById('categoryModal');
    if (overlay) overlay.classList.add('show');
  }

  window.closeCategoryModal = function() {
    const overlay = document.getElementById('categoryModal');
    if (overlay) overlay.classList.remove('show');
    editingCategoryId = null;
  };

  window.editCategory = function(id) {
    const cat = categories.find(c => c.id === id);
    if (!cat) return Toast.error('Kategori tidak ditemukan');
    openCategoryModal(cat);
  };

  window.deleteCategory = function(id) {
    const cat = categories.find(c => c.id === id);
    if (!cat) return;
    if (cat.default) return Toast.warning('Kategori default tidak bisa dihapus');
    Modal.confirm(
      `Hapus kategori "${Sanitize.string(cat.name || '-')}"? Transaksi yang menggunakan kategori ini tidak akan terpengaruh.`,
      async () => {
        try {
          await DB.delete('categories', id);
          Toast.success('Kategori berhasil dihapus');
          await loadCategories();
          renderCategories();
        } catch (e) { Toast.error('Gagal menghapus kategori'); }
      },
      'Hapus Kategori'
    );
  };

  async function submitCategory() {
    const name = Sanitize.string(document.getElementById('catName').value, 40);
    const type = document.getElementById('catType').value || 'variable';
    const colorCode = document.getElementById('catColor').value || 'sage';

    if (!name) return Toast.warning('Nama kategori diperlukan');

    const payload = { name, type, colorCode };

    try {
      if (editingCategoryId) {
        await DB.update('categories', editingCategoryId, payload);
        Toast.success('Kategori berhasil diperbarui');
      } else {
        await DB.add('categories', { ...payload, default: false });
        Toast.success('Kategori berhasil ditambahkan');
      }
      closeCategoryModal();
      await loadCategories();
      renderCategories();
    } catch (e) {
      console.error(e);
      Toast.error('Gagal menyimpan kategori');
    }
  }

  /* ============================================
     Admin Transactions
     ============================================ */
  async function loadAdminTransactions() {
    try {
      adminTransactions = await DB.getAll('admin_transactions', 'name', 'asc');
    } catch (e) {
      adminTransactions = Defaults.adminTransactions.map(a => ({...a, id: Sanitize.id()}));
    }
  }

  function renderAdminTable() {
    const tbody = document.getElementById('adminTableBody');
    if (!tbody) return;
    if (!adminTransactions.length) {
      tbody.innerHTML = `<tr><td colspan="5"><div class="table-empty"><div class="table-empty-title">Belum ada data</div><div class="table-empty-desc">Tambahkan daftar biaya admin transaksi</div></div></td></tr>`;
      return;
    }
    tbody.innerHTML = adminTransactions.map((a, i) => `
      <tr>
        <td>${i+1}</td>
        <td><strong>${Sanitize.string(a.name || '-')}</strong>
          ${a.default ? '<span class="badge badge-secondary" style="margin-left:8px;">Default</span>' : ''}</td>
        <td><strong>${IDR.format(a.amount || 0)}</strong></td>
        <td>${a.status === 'inactive'
          ? '<span class="badge badge-secondary">Nonaktif</span>'
          : '<span class="badge badge-success">Aktif</span>'}</td>
        <td>
          <div class="action-btns">
            <button class="action-btn edit tooltip" onclick="editAdmin('${Sanitize.string(a.id)}')" data-tooltip="Edit">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
            </button>
            <button class="action-btn delete tooltip" onclick="deleteAdmin('${Sanitize.string(a.id)}')" data-tooltip="Hapus">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  function setupAdminButtons() {
    const addBtn = document.getElementById('addAdminBtn');
    if (addBtn) addBtn.addEventListener('click', () => openAdminModal());

    const amountInput = document.getElementById('admAmount');
    if (amountInput) IDR.maskInput(amountInput);

    const submitBtn = document.getElementById('adminSubmitBtn');
    if (submitBtn) submitBtn.addEventListener('click', submitAdmin);
  }

  function openAdminModal(edit = null) {
    editingAdminId = edit ? edit.id : null;
    document.getElementById('adminModalTitle').textContent = edit ? 'Edit Admin Transaksi' : 'Tambah Admin Transaksi';
    document.getElementById('admName').value = edit ? (edit.name || '') : '';
    document.getElementById('admAmount').value = edit && edit.amount ? IDR.format(edit.amount) : '';
    document.getElementById('admStatus').checked = edit ? (edit.status !== 'inactive') : true;
    const overlay = document.getElementById('adminModal');
    if (overlay) overlay.classList.add('show');
  }

  window.closeAdminModal = function() {
    const overlay = document.getElementById('adminModal');
    if (overlay) overlay.classList.remove('show');
    editingAdminId = null;
  };

  window.editAdmin = function(id) {
    const a = adminTransactions.find(x => x.id === id);
    if (!a) return Toast.error('Data tidak ditemukan');
    openAdminModal(a);
  };

  window.deleteAdmin = function(id) {
    const a = adminTransactions.find(x => x.id === id);
    if (!a) return;
    if (a.default) return Toast.warning('Data default tidak bisa dihapus. Ubah status menjadi Nonaktif saja.');
    Modal.confirm(
      `Hapus admin "${Sanitize.string(a.name || '-')}"?`,
      async () => {
        try {
          await DB.delete('admin_transactions', id);
          Toast.success('Admin transaksi dihapus');
          await loadAdminTransactions();
          renderAdminTable();
        } catch (e) { Toast.error('Gagal menghapus'); }
      },
      'Hapus Admin Transaksi'
    );
  };

  async function submitAdmin() {
    const name = Sanitize.string(document.getElementById('admName').value, 50);
    const amount = IDR.parse(document.getElementById('admAmount').value);
    const active = document.getElementById('admStatus').checked;

    if (!name) return Toast.warning('Nama diperlukan');
    if (amount < 0) return Toast.warning('Nominal tidak valid');

    const payload = { name, amount: Number(amount) || 0, status: active ? 'active' : 'inactive' };
    try {
      if (editingAdminId) {
        await DB.update('admin_transactions', editingAdminId, payload);
        Toast.success('Admin transaksi diperbarui');
      } else {
        await DB.add('admin_transactions', { ...payload, default: false });
        Toast.success('Admin transaksi ditambahkan');
      }
      closeAdminModal();
      await loadAdminTransactions();
      renderAdminTable();
    } catch (e) { Toast.error('Gagal menyimpan'); }
  }

  /* ============================================
     Profile
     ============================================ */
  function renderProfileInfo() {
    const user = App.auth.currentUser;
    if (!user) return;
    const nameDisplay = document.getElementById('profileNameDisplay');
    const emailDisplay = document.getElementById('profileEmailDisplay');
    const joinedDisplay = document.getElementById('profileJoinedDisplay');
    const nameInput = document.getElementById('profileName');
    const emailInput = document.getElementById('profileEmail');

    if (nameDisplay) nameDisplay.textContent = user.displayName || user.email?.split('@')[0] || 'User';
    if (emailDisplay) emailDisplay.textContent = user.email || '';
    if (nameInput) nameInput.value = user.displayName || '';
    if (emailInput) emailInput.value = user.email || '';

    App.db.collection('users').doc(user.uid).get().then(snap => {
      if (snap.exists && joinedDisplay) {
        const data = snap.data();
        const cr = data.createdAt?.toDate ? data.createdAt.toDate() : (user.metadata?.creationTime ? new Date(user.metadata.creationTime) : new Date());
        joinedDisplay.textContent = 'Bergabung sejak: ' + DateUtils.format(cr, 'date');
      } else if (joinedDisplay && user.metadata?.creationTime) {
        joinedDisplay.textContent = 'Bergabung sejak: ' + DateUtils.format(new Date(user.metadata.creationTime), 'date');
      }
    }).catch(() => {});
  }

  function setupProfileForm() {
    const form = document.getElementById('profileForm');
    if (!form) return;
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = Sanitize.string(document.getElementById('profileName').value, 50);
      const pwd = document.getElementById('profilePassword').value;
      const user = App.auth.currentUser;
      if (!user) return;
      try {
        const updates = [];
        if (name && name !== (user.displayName || '')) {
          updates.push(user.updateProfile({ displayName: name }));
          try { await DB.set('users', user.uid, { displayName: name }, true); } catch(e){}
        }
        if (pwd && pwd.length >= 6) {
          updates.push(user.updatePassword(pwd));
        }
        if (!updates.length) {
          return Toast.info('Tidak ada perubahan yang disimpan');
        }
        await Promise.all(updates);
        Toast.success('Profil berhasil diperbarui');
        document.getElementById('profilePassword').value = '';
        renderProfileInfo();
        renderUserInfo();
      } catch (err) {
        Toast.error(mapAuthError(err));
      }
    });
  }

})();
