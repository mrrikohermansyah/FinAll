# 🌿 FinAll - Personal Financial Allocation

Aplikasi **Personal Financial Allocation** (Alokasi Keuangan Pribadi) modern, elegan, dan siap produksi untuk membantu Anda mengelola gaji bulanan, alokasi pengeluaran, tabungan, dan laporan keuangan. Dibuat tanpa framework — pure **HTML5 + CSS3 + Vanilla JavaScript ES6** — dengan integrasi **Firebase Authentication** dan **Cloud Firestore**.

---

## ✨ Fitur Utama

### 🔐 Authentication (Firebase Auth)

- Register akun baru dengan Email & Password
- Login / Logout dengan **Remember Me** (session persistence)
- Forgot Password (reset link via email)
- Route Protection — halaman dashboard hanya dapat diakses user yang login
- Setiap user **hanya melihat data miliknya sendiri** (terisolasi per UID)

### 📊 Dashboard

- **4 Ringkasan Utama**: Total Gaji, Total Dialokasikan, Sisa Gaji, Persentase Terpakai
- **Progress Bar** + **Circular Progress** indikator penggunaan
- **Pie Chart** komposisi per kategori
- **Bar Chart** nominal per kategori (urutan terbesar)
- **Line Chart** trend kumulatif (6 bulan)
- **Input Gaji** per bulan dengan history 12 bulan tersimpan
- **Status Pembayaran**: Sudah Dibayar / Belum Dibayar + Progress %
- Daftar Transaksi Terbaru (clickable)

### ⚙️ Settings (Master Data)

- **Master Kategori Transaksi**: Tambah / Edit / Hapus kategori dengan **Color Code**
  - 🟢 Hijau Sage = Pengeluaran berubah tiap bulan (Listrik, Air, Belanja)
  - 🟠 Orange Soft = Pengeluaran tetap (Cicilan, BPJS, Internet, Netflix)
  - 🟡 Kuning = Prioritas Tinggi (Tabungan, Investasi, Dana Darurat)
- **Master Admin Transaction**: Daftar biaya admin (Transfer Bank 6.500, dll) yang bisa dipilih saat input transaksi
- **Preferensi**: Dark Mode / Light Mode toggle, Shortcut info
- **Profil**: Edit nama, ganti password, info akun

### 💰 Transaksi

- CRUD lengkap transaksi dengan field: Nama Alokasi, Nominal, Kategori, Tanggal, Admin Transaction, Status Pembayaran, Remark
- **Perhitungan Otomatis Real-time**:
  - Total = Nominal + Admin (jika pilih "Ya")
  - Persentase terhadap gaji bulan terpilih
  - Sisa gaji otomatis
- **Color Code Badge** tampil pada card & tabel
- **Status Pembayaran Checklist** — centang → card berwarna hijau
- **Tabel Transaksi Lengkap**:
  - Search, Sorting (setiap kolom), Pagination
  - Filter: Bulan, Tahun, Status, Warna, Kategori
  - Toggle View: **Tabel** ↔ **Kartu (Grid)**
  - Export **CSV**, Print
- Floating Add Button, Success Animation, Delete Confirmation

### 📈 Reports (Laporan)

- 6 Ringkasan: Gaji, Alokasi, Sisa, Pengeluaran Tetap, Pengeluaran Berubah, Total Tabungan
- 4 Info Tambahan: Total Admin, Dibayar %, Belum Dibayar, Kategori Terbesar
- **Pie Chart** + **Bar Chart** + **Line Chart (6 bulan trend)**
- Tabel Detail per periode dengan Footer TOTAL
- Export CSV, Print dengan layout rapi

### 🎨 UI / UX Premium

- **Modern + Minimalis + Elegan** — terinspirasi Money Lover, Wallet, Spendee, YNAB, Mint
- **Glassmorphism ringan** + **Soft Shadow** + **Rounded Card**
- **Dark Mode & Light Mode** dengan localStorage persistence
- **Responsive Mobile First** (Mobile, Tablet, Desktop)
- **Smooth Animation**: Fade In, Bounce, Hover state, Card flip, Ripple Effect
- **Loading Screen + Skeleton Loader** saat ambil data
- **Toast Notification** (Success / Error / Warning / Info)
- **Auto Currency Format Indonesia** (Rp 8.500.000) dengan input masking
- **Keyboard Shortcut**:
  - `Ctrl + K` → Focus Search
  - `Ctrl + N` → Tambah Transaksi Baru
  - `Ctrl + D` → Toggle Dark Mode
  - `Esc` → Tutup Modal
- **Empty State** + **No Data Illustration** SVG
- **Release Notes** halaman timeline changelog
- **Version System** dengan popup update otomatis saat versi baru tersedia

### 🔒 Keamanan

- **Firebase Security Rules** ketat: user hanya bisa akses data dengan `userId` sama dengan `request.auth.uid`
- Validasi seluruh input (max length, tipe data, email format, range angka)
- Sanitasi data (escape HTML untuk mencegah XSS)
- Route Protection dashboard — redirect ke login jika belum autentikasi
- **Tidak ada hardcode password** di manapun

---

## 📁 Struktur Folder Final

```
Gaji/
│
├── 📄 index.html              # Halaman Landing (Hero, Features, CTA)
├── 📄 login.html              # Halaman Login
├── 📄 register.html           # Halaman Register
├── 📄 dashboard.html          # Dashboard Utama (ringkasan + chart)
├── 📄 transaction.html        # Halaman Transaksi (CRUD + tabel)
├── 📄 settings.html           # Pengaturan (Kategori, Admin, Profil)
├── 📄 reports.html            # Laporan (summary + chart)
├── 📄 release-notes.html      # Changelog / Release Notes
│
├── 📂 css/
│   ├── 🎨 style.css           # Global style, tokens, komponen UI (~1700 baris)
│   ├── 🎨 login.css           # Halaman auth (split layout, hero, strength meter)
│   └── 🎨 dashboard.css       # Dashboard, transaksi, laporan, card styling
│
├── 📂 js/
│   ├── 🔥 firebase.js         # Foundation: Firebase init, DB helpers, Theme,
│   │                         #   Toast, Modal, IDR formatter, Sanitize, Loader,
│   │                         #   Shortcuts, Version Check, Route Guard
│   ├── 🔐 auth.js             # Authentication logic (register/login/logout/forgot)
│   ├── 📊 dashboard.js        # Dashboard state, Chart.js, salary input
│   ├── 💰 transaction.js      # Transaction CRUD, filter, sort, pagination, export
│   ├── ⚙️ settings.js         # Kategori + Admin master CRUD, profile, preferences
│   └── 📈 report.js           # Laporan, 3 chart, summary, export/print
│
├── 📂 assets/
│   ├── 🌿 logo.svg            # Brand logo (sage gradient + F letter + coin)
│   ├── 📂 icons/
│   │   ├── favicon.svg
│   │   ├── star.svg
│   │   └── check.svg
│   └── 📂 images/
│       ├── empty-state.svg    # Ilustrasi empty state (bar chart + check)
│       └── no-data.svg        # Ilustrasi no transaction (wallet + calendar)
│
├── ⚙️ version.json            # Versioning system (untuk popup update otomatis)
├── ⚙️ firebase.json           # Firebase Hosting config (rewrites, headers, cache)
├── ⚙️ firestore.rules         # Firebase Firestore Security Rules
├── ⚙️ .firebaserc             # Firebase project ID placeholder
└── 📖 README.md               # Dokumentasi ini
```

---

## 🎨 Design System (Warna & Tipografi)

### Warna Dominan

| Nama               | HEX       | Digunakan Untuk                            |
| ------------------ | --------- | ------------------------------------------ |
| **Primary (Sage)** | `#5F8D7E` | Brand utama, tombol, link, heading         |
| **Secondary**      | `#A7C4A0` | Background subtle, hover state sage        |
| **Background**     | `#F8F9FA` | Background halaman light mode              |
| **Accent**         | `#F4A261` | CTA, tag penting, indikator alokasi        |
| **Warning**        | `#FFD166` | Prioritas tinggi (saving), badge warning   |
| **Success**        | `#52B788` | Status lunas, sisa gaji, indikator positif |
| **Danger**         | `#E76F51` | Hapus, error, indikator kritis             |

### Color Code Kategori

| Warna         | Arti                       | Contoh Kategori                         |
| ------------- | -------------------------- | --------------------------------------- |
| 🟢 **Sage**   | Nominal berubah tiap bulan | Listrik, Air, Belanja, Makan, Transport |
| 🟠 **Orange** | Nominal tetap              | Cicilan, BPJS, Internet, Netflix, Sewa  |
| 🟡 **Kuning** | Prioritas Tinggi           | Tabungan, Investasi, Dana Darurat       |

### Tipografi

- **Inter** (Google Fonts) dengan weight `400 / 500 / 600 / 700 / 800`
- Clean hierarchy, body size 14px, line height 1.6

---

## 🗄️ Firestore Data Model

Semua data disimpan dalam struktur **sub-collection per user** agar terisolasi dengan baik:

```
/users/{userId}                      ← dokumen user (nama, email, createdAt, dll)
  ├── /categories/{catId}            ← Master Kategori
  │     ├── name: "Tabungan"
  │     ├── colorCode: "yellow"      ← sage / orange / yellow / blue / purple / pink
  │     ├── isDefault: true
  │     └── createdAt: Timestamp
  │
  ├── /admin_transactions/{admId}    ← Master Biaya Admin
  │     ├── name: "Transfer Bank"
  │     ├── amount: 6500
  │     ├── status: "active"         ← active / inactive
  │     ├── isDefault: true
  │     └── createdAt: Timestamp
  │
  ├── /salary/{salId}                ← Data Gaji per Bulan
  │     ├── month: "2026-07"         ← format YYYY-MM
  │     ├── amount: 8500000
  │     └── createdAt: Timestamp
  │
  ├── /transactions/{txId}           ← Transaksi Alokasi
  │     ├── name: "Tabungan Bulanan"
  │     ├── categoryId: "{catId}"
  │     ├── categoryName: "Tabungan"
  │     ├── colorCode: "yellow"
  │     ├── month: "2026-07"
  │     ├── date: "2026-07-05"       ← format YYYY-MM-DD
  │     ├── amount: 2000000
  │     ├── useAdmin: true
  │     ├── adminId: "{admId}"
  │     ├── adminName: "Transfer Bank"
  │     ├── adminAmount: 6500
  │     ├── total: 2006500
  │     ├── percentage: 23.52
  │     ├── isPaid: true
  │     ├── remark: "Transfer ke BCA"
  │     ├── createdAt: Timestamp
  │     └── updatedAt: Timestamp
  │
  └── /settings/{settingId}          ← Preferensi user (opsional)
        ├── theme: "dark"
        └── animEnabled: true
```

---

## 🚀 Langkah Konfigurasi Firebase

### 1. Buat Firebase Project

1. Buka [console.firebase.google.com](https://console.firebase.google.com) → **Add project**
2. Masukkan nama project, misal: `FinAll-App`
3. Nonaktifkan Google Analytics (opsional) → **Create project**

### 2. Enable Authentication

1. Di sidebar kiri → **Build → Authentication** → **Get started**
2. Pilih tab **Sign-in method**
3. Aktifkan **Email/Password** → Save (JANGAN aktifkan Email link)
4. (Opsional) Buka tab **Templates** untuk kostumisasi email reset password

### 3. Buat Firestore Database

1. Sidebar → **Build → Firestore Database** → **Create database**
2. Pilih mode **Start in production mode**
3. Pilih **Cloud Firestore location** terdekat (misal: `asia-southeast1` / Singapore) → Enable
4. Jangan khawatir soal rules — kita akan upload via file `firestore.rules` nanti

### 4. Copy Firebase Config ke App

1. Klik ⚙️ **Project settings** (gambar roda di kiri atas sidebar)
2. Scroll ke bagian **Your apps** → klik **Add app** → pilih **Web app** (logo `</>`)
3. Masukkan nickname app: `FinAll Web` → **Register app** (skip hosting checkbox)
4. Copy blok `firebaseConfig` yang muncul, contoh:
   ```js
   const firebaseConfig = {
     apiKey: "AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
     authDomain: "finall-app-xxxxx.firebaseapp.com",
     projectId: "finall-app-xxxxx",
     storageBucket: "finall-app-xxxxx.appspot.com",
     messagingSenderId: "000000000000",
     appId: "1:000000000000:web:abcdef1234567890",
   };
   ```
5. Buka file **`js/firebase.js`** → cari baris `const firebaseConfig = { ... }` → **replace dengan config Anda**
6. Simpan file tersebut.

### 5. Set Firestore Indexes (Opsional tapi disarankan)

Beberapa query kompleks (filter + sort kombinasi) butuh composite index. Saat pertama kali menjalankan, jika ada error di console browser, Firebase akan memberikan link untuk **auto-create index** — klik saja link tersebut.

---

## 🛡️ Firestore Security Rules

File `firestore.rules` sudah berisi rules **ketat per-UID ownership** — user HANYA bisa baca/tulis data miliknya sendiri:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isAuthenticated() {
      return request.auth != null;
    }

    function isOwner(userId) {
      return isAuthenticated() && request.auth.uid == userId;
    }

    match /users/{userId} {
      allow read, write: if isOwner(userId);

      match /{document=**} {
        allow read, write: if isOwner(userId);
      }
    }

    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

✅ **Cara upload rules ke Firebase:**

- Buka Firebase Console → Firestore Database → tab **Rules** → paste kode di atas → Publish
- ATAU via CLI setelah install `firebase-tools` (lihat bagian hosting): `firebase deploy --only firestore:rules`

---

## 🌐 Deployment — Firebase Hosting (Free Plan)

### Prasyarat

- Node.js terinstall (versi 16+)
- Jalankan di PowerShell (Windows): jalankan perintah `npm.cmd` karena `npm.ps1` bisa diblok execution policy.

### Step by Step

1. **Install Firebase Tools CLI** (global):

   ```powershell
   npm.cmd install -g firebase-tools
   ```

2. **Login ke Firebase CLI**:

   ```powershell
   firebase login
   ```

   → Browser akan terbuka, pilih akun Google yang punya project Firebase tadi.

3. **Hubungkan project lokal dengan Firebase project Anda**:
   - Buka file **`.firebaserc`** di folder project, ganti `YOUR_FIREBASE_PROJECT_ID` dengan Project ID Anda (bisa lihat di Project Settings Firebase Console).
   - ATAU jalankan perintah ini lalu pilih project dari list:
     ```powershell
     firebase use --add
     ```

4. **Deploy SELURUH app + rules + hosting**:

   ```powershell
   firebase deploy
   ```

   → Command ini akan meng-upload: hosting files (HTML/CSS/JS/assets) + firestore.rules.

5. Selesai! Firebase akan memberikan URL seperti:
   ```
   ✔  Deploy complete!
   Hosting URL: https://finall-app-xxxxx.web.app
   Hosting URL: https://finall-app-xxxxx.firebaseapp.com
   ```

✅ **Deploy hanya hosting** (lebih cepat, tanpa rubah rules):

```powershell
firebase deploy --only hosting
```

✅ **Deploy hanya firestore rules**:

```powershell
firebase deploy --only firestore:rules
```

---

## 🐙 Deployment — GitHub Pages

Alternatif gratis tanpa Firebase Hosting:

1. **Init Git Repository** (jika belum):

   ```powershell
   git init
   git add .
   git commit -m "Initial commit FinAll"
   ```

2. **Buat Repository baru di GitHub**:
   - Buka [github.com/new](https://github.com/new), misal nama repo `finall-web`
   - Ikuti instruksi untuk push existing repo:
     ```powershell
     git branch -M main
     git remote add origin https://github.com/USERNAME_ANDA/finall-web.git
     git push -u origin main
     ```

3. **Enable GitHub Pages**:
   - Buka halaman repo di GitHub → tab **Settings** → menu **Pages** di sidebar
   - **Source**: `Deploy from a branch`
   - **Branch**: `main` → folder `/ (root)` → **Save**
   - Tunggu 1-2 menit, URL akan muncul di bagian atas, misal:
     ```
     Your site is live at https://USERNAME_ANDA.github.io/finall-web/
     ```

4. ⚠️ **Penting untuk GitHub Pages**:
   - Karena di-hosting di sub-path (misal `/finall-web/`), Anda **perlu menyesuaikan semua relative link** (href ke CSS, JS, src images) di semua file HTML. Contoh:
     - Sebelum: `<link rel="stylesheet" href="css/style.css">`
     - Sesudah: `<link rel="stylesheet" href="/finall-web/css/style.css">`
   - ATAU gunakan **[GitHub custom domain](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site)** untuk menghindari masalah base URL.

---

## 🔄 Cara Update Aplikasi ke Versi Berikutnya

Sistem versioning berbasis file **`version.json`**. Ketika app dibuka, `firebase.js` akan membandingkan versi online dengan versi terakhir yang disimpan di localStorage. Jika berbeda, akan muncul **popup update otomatis** untuk user.

### Contoh Workflow Rilis v1.0.1

1. Buka file **`version.json`**, edit isinya:

   ```json
   {
     "version": "1.0.1",
     "build": "002",
     "releaseDate": "2026-08-15",
     "releaseNote": "Improvement Release",
     "changes": [
       "Perbaikan chart line laporan",
       "Optimasi load dashboard",
       "Bug fix: input amount negative",
       "Fitur baru: export PDF"
     ]
   }
   ```

2. Buka file **`release-notes.html`**, tambahkan section baru di **PALING ATAS** timeline (sebelum v1.0.0):

   ```html
   <div class="release-item">
     <div class="release-version">v1.0.1</div>
     <div class="release-date">15 Agustus 2026 - Improvement Release</div>
     <ul>
       <li>📊 Perbaikan chart line laporan</li>
       <li>⚡ Optimasi load dashboard</li>
       <li>🐛 Bug fix: input amount negative</li>
       <li>✨ Fitur baru: export PDF</li>
     </ul>
   </div>
   ```

3. Deploy kembali:

   ```powershell
   firebase deploy --only hosting
   ```

4. Selesai! Setiap user yang buka app akan melihat popup "Version 1.0.1 Available" dengan daftar changes dan tombol Refresh Now.

---

## 💾 Cara Backup & Restore Firestore

Untuk **backup** (export) dan **restore** (import) seluruh data Firestore, gunakan **Google Cloud SDK / gcloud CLI**.

### Prasyarat

- Install [Google Cloud SDK](https://cloud.google.com/sdk/docs/install)
- Aktifkan **Cloud Storage** di project Firebase Anda (create bucket untuk export file)
- Setiap kali buka PowerShell baru, pastikan sudah auth:
  ```powershell
  gcloud auth login
  gcloud config set project PROJECT_ID_ANDA
  ```

### 🔹 Backup (Export) Seluruh Database

```powershell
gcloud firestore export gs://NAMA_BUCKET_ANDA/backups/finall-backup-YYYYMMDD
```

- Ganti `NAMA_BUCKET_ANDA` dengan nama bucket storage Anda (bisa lihat di Firebase Console → Storage)
- Ganti `YYYYMMDD` dengan tanggal backup, misal `20260801`

Hasil export akan tersimpan di folder `backups/finall-backup-20260801/` di bucket storage Anda. Anda bisa download manual via **Firebase Console → Storage** sebagai file zip/arsip.

### 🔹 Restore (Import) dari Backup

```powershell
gcloud firestore import gs://NAMA_BUCKET_ANDA/backups/finall-backup-YYYYMMDD
```

⚠️ **PERINGATAN**: Ini akan **menimpa SELURUH data saat ini** di Firestore dengan backup. Pastikan Anda backup versi terbaru DULU sebelum import.

### 🔹 Backup per Collection (Opsional)

Hanya export collection tertentu (misal hanya `transactions` dan `salary` di user tertentu):

```powershell
gcloud firestore export gs://NAMA_BUCKET_ANDA/backups/tx-only \
  --collection-ids="transactions,salary"
```

---

## 🛠️ Troubleshooting

### ❌ `npm.ps1 cannot be loaded because running scripts is disabled on this system`

Penyebab: PowerShell Execution Policy default memblok script `.ps1`.
Solusi: Gunakan `.cmd` version:

```powershell
npm.cmd install -g firebase-tools
firebase.cmd deploy
```

### ❌ `auth/configuration-not-found` saat login

Penyebab: Email/Password sign-in method belum diaktifkan.
Solusi: Firebase Console → Authentication → Sign-in method → aktifkan **Email/Password**.

### ❌ `Missing or insufficient permissions`

Penyebab: Firestore security rules tidak terpasang dengan benar.
Solusi:

1. Buka Console → Firestore → Rules
2. Paste isi `firestore.rules` → klik **Publish**
3. Tunggu 1-2 menit lalu coba lagi.

### ❌ Halaman kosong / loading terus

1. Buka **DevTools (F12)** → tab **Console**, lihat error.
2. Error umum: `firebaseConfig` belum diupdate di `firebase.js` → ikuti **Langkah 4 Konfigurasi Firebase**.
3. Cek tab **Network** apakah ada file 404 (lokasi CSS/JS salah path).

### ❌ Chart.js tidak muncul di mobile

Pastikan parent `<div class="chart-container">` punya **height eksplisit** (sudah diset default di CSS, tapi cek jika Anda merubahnya).

### ❌ Currency format menampilkan Rp dengan koma bukan titik

Pastikan browser setting locale **Indonesia (id-ID)**. `toLocaleString('id-ID')` otomatis menggunakan pemisah ribuan `.` dan desimal `,` untuk locale ID.

---

## ❓ FAQ

**Q: Apakah data saya aman?**
A: Ya. Setiap user terisolasi per UID. Firestore Security Rules memastikan user A tidak dapat membaca/menulis data user B sama sekali.

**Q: Berapa batasan Firebase Free Plan (Spark)?**
A: [Batas resmi](https://firebase.google.com/pricing): Authentication = 50.000 active users / bulan, Firestore = 1 GB storage, 20.000 reads/hari, 5.000 writes/hari. Cukup untuk penggunaan pribadi / 1-20 user.

**Q: Bisa ganti warna tema?**
A: Semua warna disimpan sebagai **CSS Variables** di `style.css` blok `:root { ... }` dan `[data-theme="dark"] { ... }`. Cukup ganti value HEX di 2 blok itu, seluruh app otomatis berubah.

**Q: Bagaimana cara menambah kategori default untuk user baru?**
A: Buka `js/firebase.js` → cari object `Defaults.defaultCategories` → tambah entry baru di array itu. User baru yang register setelahnya akan mendapatkan kategori tambahan tersebut secara otomatis.

**Q: Bisa offline?**
A: Untuk membaca/menulis data, app butuh koneksi internet (Firestore online). Fitur **Firestore offline persistence** dapat diaktifkan dengan menambahkan `firebase.firestore().enablePersistence()` di `firebase.js` — namun fitur ini berbayar di beberapa platform dan untuk kesederhanaan free-tier, tidak diaktifkan default.

---

## 📝 Version & Changelog

Versi saat ini: **v1.0.0** (Initial Release, 1 Agustus 2026)

- Lihat halaman **Release Notes** di app untuk detail lengkap
- Atau buka file **`release-notes.html`** / **`version.json`**

---

**Terima kasih menggunakan FinAll! 🌿**
_Made with 💚 Vanilla JS + Firebase_
