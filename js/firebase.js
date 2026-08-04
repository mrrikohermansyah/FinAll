/* ============================================
   Firebase Configuration & Initialization
   Personal Financial Allocation v1.0.0
   ============================================ */

// ⚠️ PENTING: Ganti konfigurasi di bawah ini dengan Firebase Project Anda
// Dapatkan dari Firebase Console → Project Settings → Add App
const authDomainByHost = {
  localhost: "localhost",
  "127.0.0.1": "127.0.0.1",
  "192.168.7.144": "192.168.7.144",
  "app.futureproject.my.id": "app.futureproject.my.id",
  "finall.futureproject.my.id": "app.futureproject.my.id",
  "www.futureproject.my.id": "app.futureproject.my.id",
};

const firebaseConfig = {
  apiKey: "AIzaSyCsh9_5bv_U7E9slwxDzAMQRXNiubaMfZw",
  authDomain: "app.futureproject.my.id",
  projectId: "finall-b5c2e",
  storageBucket: "finall-b5c2e.firebasestorage.app",
  messagingSenderId: "813686056225",
  appId: "1:813686056225:web:0731b0d2a34059ed9d0a60",
  measurementId: "G-V5SESD9E4Q",
};

/* ============================================
   Global App State
   ============================================ */
const App = {
  auth: null,
  db: null,
  currentUser: null,
  ready: false,
  theme: localStorage.getItem("theme") || "light",
  currentMonth: new Date().toISOString().slice(0, 7),
  firestoreInitialized: false,
};

/* ============================================
   Service Worker Registration
   ============================================ */
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then((registration) => {
          console.log('[Service Worker] Registered:', registration.scope);
          
          // Check for updates
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // New version available
                Toast.info('Versi baru tersedia. Refresh untuk update.', 'Update Tersedia', 5000);
              }
            });
          });
        })
        .catch((error) => {
          console.error('[Service Worker] Registration failed:', error);
        });
    });

    // Handle service worker messages
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'CACHE_UPDATED') {
        Toast.success('Cache diperbarui. Halaman akan di-refresh.');
        setTimeout(() => window.location.reload(), 2000);
      }
    });
  }
}

/* ============================================
   Initialize Firebase (using CDN global)
   ============================================ */
function initFirebase() {
  try {
    if (typeof firebase === "undefined") {
      console.error("Firebase SDK not loaded. Check your script includes.");
      return false;
    }

    const configuredAuthDomain =
      authDomainByHost[window.location.hostname] || firebaseConfig.authDomain;
    const firebaseAppConfig = {
      ...firebaseConfig,
      authDomain: configuredAuthDomain,
    };

    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseAppConfig);
    } else {
      firebase.app();
    }

    App.auth = firebase.auth();
    App.db = firebase.firestore();
    App.firestoreInitialized = true;

    // ✅ FIX 1: Paksa Persistence LOCAL secara global segera setelah init
    // Safari iOS (ITP) sering memblokir sessionStorage. Memaksa LOCAL (IndexedDB)
    // memastikan session tidak hilang saat navigasi/redirect dari Google.
    App.auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch((e) => {
      console.warn("Failed to set auth persistence:", e);
    });

    return true;
  } catch (e) {
    console.error("Firebase init error:", e);
    return false;
  }
}

/* ============================================
   Utility: Currency Formatting (Indonesia Rupiah)
   ============================================ */
const IDR = {
  format(value) {
    if (isNaN(value) || value === null || value === undefined) value = 0;
    const number = Number(value);
    return "Rp " + Math.round(number).toLocaleString("id-ID");
  },
  formatShort(value) {
    if (isNaN(value)) value = 0;
    const number = Number(value);
    if (number >= 1_000_000_000)
      return "Rp " + (number / 1_000_000_000).toFixed(1) + "M";
    if (number >= 1_000_000)
      return "Rp " + (number / 1_000_000).toFixed(1) + "Jt";
    if (number >= 1_000) return "Rp " + (number / 1_000).toFixed(1) + "Rb";
    return "Rp " + Math.round(number);
  },
  parse(str) {
    if (typeof str === "number") return str;
    const cleaned = String(str)
      .replace(/[^0-9,]/g, "")
      .replace(",", ".");
    return parseFloat(cleaned) || 0;
  },
  maskInput(inputEl) {
    inputEl.addEventListener("input", () => {
      const cursorPos = inputEl.selectionStart;
      const oldValue = inputEl.value;
      const numeric = this.parse(oldValue);
      const formatted =
        numeric === 0 ? "" : Math.round(numeric).toLocaleString("id-ID");
      inputEl.value = formatted ? "Rp " + formatted : "";
      const newPos = cursorPos + (inputEl.value.length - oldValue.length);
      try {
        inputEl.setSelectionRange(Math.max(3, newPos), Math.max(3, newPos));
      } catch (e) { }
    });
    inputEl.addEventListener("blur", () => {
      const numeric = this.parse(inputEl.value);
      inputEl.value = numeric === 0 ? "" : this.format(numeric);
    });
  },
};

/* ============================================
   Utility: Sanitize & Validate Input
   ============================================ */
const Sanitize = {
  string(value, max = 200) {
    if (value === null || value === undefined) return "";
    let str = String(value).trim();
    
    // Remove all HTML tags
    str = str.replace(/<[^>]*>/g, "");
    
    // Remove dangerous JavaScript patterns
    str = str.replace(/javascript:/gi, "");
    str = str.replace(/on\w+\s*=/gi, ""); // Remove event handlers like onclick=
    str = str.replace(/data:\w+\/\w+;base64/gi, ""); // Remove data URIs
    
    // Handle encoded characters
    str = str.replace(/&#(\d+);/g, (match, dec) => {
      const num = parseInt(dec, 10);
      // Only allow safe characters (printable ASCII excluding control chars)
      return (num >= 32 && num <= 126) ? String.fromCharCode(num) : "";
    });
    
    str = str.replace(/&#[xX]([0-9a-fA-F]+);/g, (match, hex) => {
      const num = parseInt(hex, 16);
      return (num >= 32 && num <= 126) ? String.fromCharCode(num) : "";
    });
    
    // Escape HTML special characters
    str = str.replace(
      /[<>\"'&]/g,
      (c) =>
        ({
          "<": "&lt;",
          ">": "&gt;",
          '\"': "&quot;",
          "'": "&#39;",
          "&": "&amp;",
        })[c],
    );
    
    // Remove any remaining potentially dangerous patterns
    str = str.replace(/eval\(/gi, "");
    str = str.replace(/expression\(/gi, "");
    str = str.replace(/vbscript:/gi, "");
    str = str.replace(/@import/gi, "");
    
    return str.slice(0, max);
  },
  
  html(value, max = 2000) {
    // For fields that allow some HTML (like remarks), use stricter sanitization
    if (value === null || value === undefined) return "";
    let str = String(value).trim();
    
    // Allow only safe HTML tags
    const allowedTags = ['<b>', '</b>', '<i>', '</i>', '<u>', '</u>', '<strong>', '</strong>', '<em>', '</em>', '<br>', '<br/>', '<p>', '</p>'];
    const tagRegex = /<\/?[\w\s="'-]+>/g;
    
    str = str.replace(tagRegex, (tag) => {
      const normalizedTag = tag.toLowerCase().replace(/\s+/g, '');
      return allowedTags.includes(normalizedTag) ? tag : '';
    });
    
    // Remove all event handlers and dangerous attributes
    str = str.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, "");
    str = str.replace(/\s*on\w+\s*=\s*[^\s>]*/gi, "");
    str = str.replace(/\s*href\s*=\s*["']javascript:[^"']*["']/gi, 'href="#"');
    str = str.replace(/\s*src\s*=\s*["']javascript:[^"']*["']/gi, 'src=""');
    
    return str.slice(0, max);
  },
  
  number(value, min = 0, max = Number.MAX_SAFE_INTEGER) {
    const n = Number(value);
    if (isNaN(n)) return 0;
    return Math.min(Math.max(n, min), max);
  },
  
  email(value) {
    if (!value) return "";
    const str = String(value).trim().toLowerCase();
    // More strict email validation
    const regex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return regex.test(str) ? str : "";
  },
  
  date(value) {
    const d = value ? new Date(value) : new Date();
    if (isNaN(d.getTime())) return new Date().toISOString();
    return d.toISOString();
  },
  
  url(value) {
    if (!value) return "";
    const str = String(value).trim();
    // Basic URL validation
    try {
      const url = new URL(str);
      // Only allow http/https protocols
      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        return "";
      }
      return url.toString();
    } catch (e) {
      return "";
    }
  },
  
  id() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
  },
  
  // Sanitize object properties recursively
  object(obj, schema = {}) {
    if (!obj || typeof obj !== 'object') return obj;
    
    const sanitized = Array.isArray(obj) ? [] : {};
    
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const value = obj[key];
        const sanitizer = schema[key];
        
        if (sanitizer && typeof sanitizer === 'function') {
          sanitized[key] = sanitizer(value);
        } else if (typeof value === 'string') {
          sanitized[key] = this.string(value);
        } else if (typeof value === 'number') {
          sanitized[key] = this.number(value);
        } else if (typeof value === 'object' && value !== null) {
          sanitized[key] = this.object(value, schema);
        } else {
          sanitized[key] = value;
        }
      }
    }
    
    return sanitized;
  }
};

/* ============================================
   Error Handling System
   ============================================ */
const ErrorHandler = {
  // Error categories
  ErrorTypes: {
    NETWORK: 'NETWORK_ERROR',
    AUTH: 'AUTH_ERROR',
    DATABASE: 'DATABASE_ERROR',
    VALIDATION: 'VALIDATION_ERROR',
    PERMISSION: 'PERMISSION_ERROR',
    UNKNOWN: 'UNKNOWN_ERROR'
  },

  // Handle Firebase errors with user-friendly messages
  handleFirebaseError(error, context = '') {
    console.error(`[Firebase Error${context ? ` - ${context}` : ''}:`, error);
    
    let message = 'Terjadi kesalahan. Silakan coba lagi.';
    let type = 'error';
    
    if (!error) {
      return { message, type, code: 'UNKNOWN' };
    }

    const code = error.code || error.message || 'UNKNOWN';
    
    // Firebase Auth errors
    if (code.includes('auth/')) {
      switch (code) {
        case 'auth/user-not-found':
          message = 'Email tidak ditemukan. Silakan periksa kembali.';
          break;
        case 'auth/wrong-password':
          message = 'Password salah. Silakan coba lagi.';
          break;
        case 'auth/email-already-in-use':
          message = 'Email sudah terdaftar. Gunakan email lain atau login.';
          break;
        case 'auth/invalid-email':
          message = 'Format email tidak valid.';
          break;
        case 'auth/weak-password':
          message = 'Password terlalu lemah. Gunakan minimal 6 karakter.';
          break;
        case 'auth/too-many-requests':
          message = 'Terlalu banyak percobaan login. Silakan tunggu beberapa saat.';
          break;
        case 'auth/popup-closed-by-user':
          message = 'Login dibatalkan.';
          type = 'warning';
          break;
        case 'auth/popup-blocked':
          message = 'Popup login diblokir browser. Silakan izinkan popup.';
          type = 'warning';
          break;
        case 'auth/cancelled-popup-request':
          message = 'Login dibatalkan.';
          type = 'warning';
          break;
        case 'auth/timeout':
          message = 'Waktu login habis. Silakan coba lagi.';
          break;
        default:
          message = `Error autentikasi: ${code}`;
      }
      return { message, type, code: this.ErrorTypes.AUTH, originalCode: code };
    }
    
    // Firebase Firestore errors
    if (code.includes('firestore/') || code.includes('permission-denied')) {
      switch (code) {
        case 'firestore/permission-denied':
          message = 'Anda tidak memiliki izin untuk mengakses data ini.';
          break;
        case 'firestore/not-found':
          message = 'Data tidak ditemukan.';
          break;
        case 'firestore/already-exists':
          message = 'Data sudah ada.';
          break;
        case 'firestore/failed-precondition':
          message = 'Operasi gagal. Silakan periksa koneksi internet.';
          break;
        case 'firestore/unavailable':
          message = 'Layanan database tidak tersedia. Periksa koneksi internet.';
          break;
        default:
          message = `Error database: ${code}`;
      }
      return { message, type, code: this.ErrorTypes.DATABASE, originalCode: code };
    }
    
    // Network errors
    if (code.includes('network') || code.includes('offline') || code.includes('timeout')) {
      message = 'Koneksi internet bermasalah. Periksa koneksi Anda.';
      return { message, type, code: this.ErrorTypes.NETWORK, originalCode: code };
    }
    
    // Generic error
    return { message, type, code: this.ErrorTypes.UNKNOWN, originalCode: code };
  },

  // Log error with context
  log(error, context = '', level = 'error') {
    const logMethod = level === 'error' ? console.error : 
                     level === 'warn' ? console.warn : 
                     console.log;
    
    logMethod(`[${level.toUpperCase()}${context ? ` - ${context}` : ''}]:`, error);
    
    // In production, you might want to send this to an error tracking service
    // like Sentry, Firebase Crashlytics, etc.
  },

  // Create error boundary wrapper for async functions
  async wrapAsync(asyncFn, context = '') {
    try {
      return await asyncFn();
    } catch (error) {
      const errorInfo = this.handleFirebaseError(error, context);
      Toast.error(errorInfo.message);
      this.log(error, context, 'error');
      throw error; // Re-throw for further handling if needed
    }
  },

  // Validation error handler
  validation(field, value, rules) {
    const errors = [];
    
    for (const rule of rules) {
      if (rule.required && (!value || value.toString().trim() === '')) {
        errors.push(`${field} diperlukan`);
        continue;
      }
      
      if (rule.minLength && value.toString().length < rule.minLength) {
        errors.push(`${field} minimal ${rule.minLength} karakter`);
      }
      
      if (rule.maxLength && value.toString().length > rule.maxLength) {
        errors.push(`${field} maksimal ${rule.maxLength} karakter`);
      }
      
      if (rule.pattern && !rule.pattern.test(value)) {
        errors.push(`${field} format tidak valid`);
      }
      
      if (rule.min && Number(value) < rule.min) {
        errors.push(`${field} minimal ${rule.min}`);
      }
      
      if (rule.max && Number(value) > rule.max) {
        errors.push(`${field} maksimal ${rule.max}`);
      }
      
      if (rule.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        errors.push(`${field} format email tidak valid`);
      }
    }
    
    return errors;
  }
};

/* ============================================
   Toast Notification System
   ============================================ */
const Toast = {
  container: null,
  _init() {
    if (!this.container) {
      this.container = document.createElement("div");
      this.container.className = "toast-container";
      document.body.appendChild(this.container);
    }
  },
  show(message, type = "info", title = null, duration = 4000) {
    this._init();
    const titles = {
      success: title || "Berhasil",
      error: title || "Error",
      warning: title || "Perhatian",
      info: title || "Informasi",
    };
    const icons = {
      success: "✓",
      error: "✕",
      warning: "!",
      info: "ℹ",
    };
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <div class="toast-icon">${icons[type]}</div>
      <div class="toast-content">
        <div class="toast-title">${titles[type]}</div>
        <div class="toast-message">${Sanitize.string(message, 200)}</div>
      </div>
      <button class="toast-close" aria-label="Close">×</button>
    `;
    this.container.appendChild(toast);
    setTimeout(() => toast.classList.add("show"), 10);
    toast
      .querySelector(".toast-close")
      .addEventListener("click", () => this._remove(toast));
    setTimeout(() => this._remove(toast), duration);
  },
  _remove(toast) {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 400);
  },
  success(msg, title, dur) {
    this.show(msg, "success", title, dur);
  },
  error(msg, title, dur) {
    this.show(msg, "error", title, dur);
  },
  warning(msg, title, dur) {
    this.show(msg, "warning", title, dur);
  },
  info(msg, title, dur) {
    this.show(msg, "info", title, dur);
  },
};

/* ============================================
   Modal System
   ============================================ */
const Modal = {
  create(options = {}) {
    const {
      title = "",
      content = "",
      footer = "",
      size = "md",
      onClose = null,
      className = "",
    } = options;

    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.innerHTML = `
      <div class="modal ${size === "lg" ? "modal-lg" : ""} ${className}">
        <div class="modal-header">
          <h3 class="modal-title">${title}</h3>
          <button class="modal-close" aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
        <div class="modal-body">${content}</div>
        ${footer ? `<div class="modal-footer">${footer}</div>` : ""}
      </div>
    `;

    document.body.appendChild(overlay);
    const modal = overlay.querySelector(".modal");

    const close = () => {
      overlay.classList.remove("show");
      setTimeout(() => {
        overlay.remove();
        if (onClose) onClose();
      }, 300);
    };

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) close();
    });

    modal.querySelector(".modal-close").addEventListener("click", close);
    modal.close = close;

    setTimeout(() => overlay.classList.add("show"), 10);

    return { overlay, modal, close };
  },

  confirm(message, onConfirm, title = "Konfirmasi") {
    const { modal, close } = this.create({
      title,
      className: "confirm-dialog",
      content: `
        <div class="confirm-icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
        </div>
        <div class="confirm-title">${title}</div>
        <div class="confirm-desc">${Sanitize.string(message, 300)}</div>
      `,
      footer: `
        <button class="btn btn-secondary" data-action="cancel">Batal</button>
        <button class="btn btn-danger" data-action="confirm">Ya, Keluar</button>
      `,
    });

    modal
      .querySelector('[data-action="cancel"]')
      .addEventListener("click", close);
    modal
      .querySelector('[data-action="confirm"]')
      .addEventListener("click", () => {
        close();
        if (onConfirm) onConfirm();
      });
  },

  alert(message, type = "info", title = "Informasi", onClose = null) {
    const buttonText = type === "success" ? "Tutup" : "OK";
    const btnClass =
      type === "danger"
        ? "btn-danger"
        : type === "success"
          ? "btn-success"
          : "btn-primary";
    const { modal, close } = this.create({
      title,
      content: `<div class="alert alert-${type}"><div class="alert-icon">ℹ</div><div>${Sanitize.string(message, 500)}</div></div>`,
      footer: `<button class="btn ${btnClass}" data-action="close">${buttonText}</button>`,
      onClose,
    });
    modal
      .querySelector('[data-action="close"]')
      .addEventListener("click", close);
  },

  versionPopup(versionData) {
    const changes = (versionData.changes || [])
      .map((c) => `<li>${Sanitize.string(c)}</li>`)
      .join("");
    const { modal, close } = this.create({
      title: "Pembaruan Tersedia!",
      size: "md",
      className: "version-popup",
      content: `
        <div class="version-badge animate-bounce-in">Version ${Sanitize.string(versionData.version)}</div>
        <h3>Ada Versi Baru!</h3>
        <div class="version-date">Build ${Sanitize.string(versionData.build)} · ${Sanitize.string(versionData.releaseDate)}</div>
        <div class="changelog-title">What's New:</div>
        <ul class="changelog-list">${changes || `<li>Perbaikan dan peningkatan performa</li>`}</ul>
      `,
      footer: `
        <button class="btn btn-secondary" data-action="later">Nanti Saja</button>
        <button class="btn btn-primary" data-action="refresh">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
          Refresh Now
        </button>
      `,
    });
    modal
      .querySelector('[data-action="later"]')
      .addEventListener("click", close);
    modal
      .querySelector('[data-action="refresh"]')
      .addEventListener("click", () => {
        localStorage.setItem("app_version", versionData.version);
        location.reload(true);
      });
  },
};

/* ============================================
   Theme Management (Dark / Light Mode)
   ============================================ */
const Theme = {
  init() {
    this.apply(App.theme);
    this.setupToggle();
  },
  apply(theme) {
    App.theme = theme;
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
    document.querySelectorAll("[data-theme-toggle]").forEach((btn) => {
      this.updateIcon(btn, theme);
    });
  },
  toggle() {
    this.apply(App.theme === "dark" ? "light" : "dark");
  },
  updateIcon(btn, theme) {
    if (!btn) return;
    btn.innerHTML =
      theme === "dark"
        ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`
        : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`;
  },
  setupToggle() {
    document.querySelectorAll("[data-theme-toggle]").forEach((btn) => {
      this.updateIcon(btn, App.theme);
      btn.addEventListener("click", () => this.toggle());
    });
  },
};

/* ============================================
   Version System
   ============================================ */
const VersionCheck = {
  async check() {
    try {
      const response = await fetch("version.json?_=" + Date.now());
      if (!response.ok) return;
      const data = await response.json();
      const savedVersion = localStorage.getItem("app_version");
      if (!savedVersion) {
        localStorage.setItem("app_version", data.version);
        return;
      }
      if (savedVersion !== data.version) {
        Modal.versionPopup(data);
      }
    } catch (e) {
      console.warn("Version check failed:", e);
    }
  },
};

/* ============================================
   Firestore Database Helpers
   ============================================ */
const DB = {
  get uid() {
    return App.currentUser ? App.currentUser.uid : null;
  },

  collection(path) {
    return App.db.collection(path);
  },

  userCollection(collectionName) {
    if (!this.uid) throw new Error("User not authenticated");
    return App.db.collection("users").doc(this.uid).collection(collectionName);
  },

  async get(collectionName, id) {
    const snap = await this.userCollection(collectionName).doc(id).get();
    return snap.exists ? { id: snap.id, ...snap.data() } : null;
  },

  async getAll(collectionName, orderBy = "createdAt", direction = "desc") {
    const snap = await this.userCollection(collectionName)
      .orderBy(orderBy, direction)
      .get();
    return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  },

  async query(collectionName, conditions = [], orderBy = null, limit = null) {
    let ref = this.userCollection(collectionName);
    conditions.forEach((cond) => {
      ref = ref.where(cond.field, cond.op || "==", cond.value);
    });
    if (orderBy) {
      ref = ref.orderBy(orderBy.field, orderBy.dir || "desc");
    }
    if (limit) ref = ref.limit(limit);
    const snap = await ref.get();
    return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  },

  async add(collectionName, data) {
    const payload = {
      ...data,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    };
    const ref = await this.userCollection(collectionName).add(payload);
    return { id: ref.id, ...payload };
  },

  async set(collectionName, id, data, merge = false) {
    const payload = {
      ...data,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    };
    if (!merge)
      payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
    await this.userCollection(collectionName).doc(id).set(payload, { merge });
    return { id, ...payload };
  },

  async update(collectionName, id, data) {
    const payload = {
      ...data,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    };
    await this.userCollection(collectionName).doc(id).update(payload);
    return { id, ...payload };
  },

  async delete(collectionName, id) {
    await this.userCollection(collectionName).doc(id).delete();
    return true;
  },

  onSnapshot(
    collectionName,
    callback,
    conditions = [],
    orderBy = "createdAt",
    dir = "desc",
  ) {
    let ref = this.userCollection(collectionName);
    conditions.forEach((cond) => {
      ref = ref.where(cond.field, cond.op || "==", cond.value);
    });
    ref = ref.orderBy(orderBy, dir);
    return ref.onSnapshot((snap) => {
      const docs = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      callback(docs, snap);
    });
  },
};

/* ============================================
   Date Utilities (Indonesian locale) - Enhanced
   ============================================ */
const DateUtils = {
  // Enhanced format function with consistent date handling
  format(date, type = "full") {
    const d = date ? new Date(date) : new Date();
    if (isNaN(d.getTime())) return "-";
    const months = [
      "Januari",
      "Februari",
      "Maret",
      "April",
      "Mei",
      "Juni",
      "Juli",
      "Agustus",
      "September",
      "Oktober",
      "November",
      "Desember",
    ];
    const days = [
      "Minggu",
      "Senin",
      "Selasa",
      "Rabu",
      "Kamis",
      "Jumat",
      "Sabtu",
    ];
    switch (type) {
      case "full":
        return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
      case "date":
        return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
      case "short":
        return `${d.getDate()}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
      case "monthYear":
        return `${months[d.getMonth()]} ${d.getFullYear()}`;
      case "month":
        return months[d.getMonth()];
      case "ymd":
        return d.toISOString().slice(0, 10);
      case "ym":
        return d.toISOString().slice(0, 7);
      default:
        return d.toLocaleDateString("id-ID");
    }
  },
  
  // Format date to YYYY-MM string (month format)
  toYearMonth(date) {
    const d = date ? new Date(date) : new Date();
    if (isNaN(d.getTime())) return new Date().toISOString().slice(0, 7);
    return d.toISOString().slice(0, 7);
  },

  // Format date to YYYY-MM-DD string
  toISODate(date) {
    const d = date ? new Date(date) : new Date();
    if (isNaN(d.getTime())) return new Date().toISOString().slice(0, 10);
    return d.toISOString().slice(0, 10);
  },

  // Parse date string to Date object
  parse(dateStr) {
    if (!dateStr) return new Date();
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? new Date() : d;
  },

  // Get month name in Indonesian
  getMonthName(monthIndex) {
    const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 
                    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    return months[monthIndex] || '';
  },

  getMonthYear(date = new Date()) {
    return new Date(date).toISOString().slice(0, 7);
  },
  
  months() {
    return [
      "Januari",
      "Februari",
      "Maret",
      "April",
      "Mei",
      "Juni",
      "Juli",
      "Agustus",
      "September",
      "Oktober",
      "November",
      "Desember",
    ];
  },
  
  years(startOffset = 0, count = 10) {
    const y = new Date().getFullYear() + startOffset;
    return Array.from({ length: count }, (_, i) => y - i);
  },
  
  daysInMonth(ym) {
    const [y, m] = ym.split("-").map(Number);
    return new Date(y, m, 0).getDate();
  },
  
  ymd(date = new Date()) {
    const d = new Date(date);
    if (isNaN(d.getTime())) return "";
    return d.toISOString().slice(0, 10);
  },
  
  toLocal(date) {
    const d = new Date(date);
    if (isNaN(d.getTime())) return "-";
    return `${d.getDate()}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  },
  
  today() {
    return DateUtils.format(new Date(), "full");
  },

  // Check if date is valid
  isValid(date) {
    const d = new Date(date);
    return !isNaN(d.getTime());
  },

  // Get start of month
  startOfMonth(date) {
    const d = this.parse(date);
    return new Date(d.getFullYear(), d.getMonth(), 1);
  },

  // Get end of month
  endOfMonth(date) {
    const d = this.parse(date);
    return new Date(d.getFullYear(), d.getMonth() + 1, 0);
  },

  // Add days to date
  addDays(date, days) {
    const d = this.parse(date);
    d.setDate(d.getDate() + days);
    return d;
  },

  // Add months to date
  addMonths(date, months) {
    const d = this.parse(date);
    d.setMonth(d.getMonth() + months);
    return d;
  },

  // Get difference in days between two dates
  diffDays(date1, date2) {
    const d1 = this.parse(date1);
    const d2 = this.parse(date2);
    const diffTime = Math.abs(d2 - d1);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }
};

/* ============================================
   Export: Excel / CSV
   ============================================ */
const Exporter = {
  toCSV(data, filename = "export.csv", columns = []) {
    if (!data || !data.length) {
      Toast.warning("Tidak ada data untuk diekspor");
      return;
    }
    const keys = columns.length
      ? columns.map((c) => c.key)
      : Object.keys(data[0]);
    const labels = columns.length ? columns.map((c) => c.label) : keys;
    const csv = [
      labels.map((l) => `"${String(l).replace(/"/g, '""')}"`).join(","),
      ...data.map((row) =>
        keys
          .map((k) => `"${String(row[k] ?? "").replace(/"/g, '""')}"`)
          .join(","),
      ),
    ].join("\n");
    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;",
    });
    this._download(blob, filename);
    Toast.success("CSV berhasil diekspor");
  },

  print(title, htmlContent) {
    const w = window.open("", "_blank");
    w.document.write(`<!DOCTYPE html><html><head><title>${title}</title>
      <style>
        body{font-family:Arial,sans-serif;padding:40px;color:#333;}
        h1{color:#5F8D7E;border-bottom:2px solid #5F8D7E;padding-bottom:10px;}
        table{width:100%;border-collapse:collapse;margin-top:20px;}
        th,td{padding:10px;text-align:left;border-bottom:1px solid #ddd;font-size:13px;}
        th{background:#f0f5f3;color:#5F8D7E;font-weight:600;}
        .meta{color:#666;font-size:12px;margin-bottom:20px;}
      </style></head><body>${htmlContent}</body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 500);
  },

  _download(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
};

/* ============================================
   Loading Screen
   ============================================ */
const Loader = {
  show() {
    let el = document.querySelector(".loading-screen");
    if (!el) {
      el = document.createElement("div");
      el.className = "loading-screen";
      el.innerHTML = `<div class="loader"><div class="loader-spinner"></div><div class="loader-logo">FinAll</div></div>`;
      document.body.appendChild(el);
    }
    el.classList.remove("hidden");
  },
  hide(delay = 300) {
    const el = document.querySelector(".loading-screen");
    if (el) {
      setTimeout(() => el.classList.add("hidden"), delay);
    }
  },
};

/* ============================================
   Default Categories & Admin Transaction Templates
   ============================================ */
const Defaults = {
  categories: [
    { name: "Tabungan", type: "saving", colorCode: "yellow", default: true },
    { name: "Investasi", type: "saving", colorCode: "yellow", default: true },
    {
      name: "Dana Darurat",
      type: "saving",
      colorCode: "yellow",
      default: true,
    },
    { name: "Cicilan", type: "fixed", colorCode: "orange", default: true },
    { name: "BPJS", type: "fixed", colorCode: "orange", default: true },
    { name: "Internet", type: "fixed", colorCode: "orange", default: true },
    { name: "Langganan", type: "fixed", colorCode: "orange", default: true },
    { name: "Listrik", type: "variable", colorCode: "sage", default: true },
    { name: "Air", type: "variable", colorCode: "sage", default: true },
    { name: "Makan", type: "variable", colorCode: "sage", default: true },
    { name: "Transport", type: "variable", colorCode: "sage", default: true },
    { name: "Hiburan", type: "variable", colorCode: "sage", default: true },
    { name: "Lainnya", type: "variable", colorCode: "sage", default: true },
  ],
  adminTransactions: [
    { name: "Transfer Bank", amount: 6500, status: "active", default: true },
    { name: "ATM Tarik Tunai", amount: 5000, status: "active", default: true },
    { name: "E-Wallet Topup", amount: 1000, status: "active", default: true },
    { name: "Admin Fee", amount: 2500, status: "active", default: true },
  ],
  categoryColorMap: {
    sage: { bg: "#5F8D7E", label: "Perubahan" },
    orange: { bg: "#F4A261", label: "Tetap" },
    yellow: { bg: "#FFD166", label: "Prioritas" },
    custom1: { bg: "#6FA8DC", label: "Custom 1" },
    custom2: { bg: "#B19CD9", label: "Custom 2" },
    custom3: { bg: "#E78AC3", label: "Custom 3" },
  },
};

/* ============================================
   Sidebar Toggle (Mobile)
   ============================================ */
function setupSidebar() {
  const sidebar = document.querySelector(".sidebar");
  const toggle = document.querySelector("[data-sidebar-toggle]");
  if (!sidebar || !toggle) return;

  let overlay = document.querySelector(".sidebar-overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.className = "sidebar-overlay";
    document.body.appendChild(overlay);
  }

  const open = () => {
    sidebar.classList.add("open");
    overlay.classList.add("show");
  };
  const close = () => {
    sidebar.classList.remove("open");
    overlay.classList.remove("show");
  };

  toggle.addEventListener("click", () => {
    sidebar.classList.contains("open") ? close() : open();
  });
  overlay.addEventListener("click", close);

  sidebar.querySelectorAll(".nav-item").forEach((item) => {
    item.addEventListener("click", () => close());
  });
}

/* ============================================
   Keyboard Shortcuts
   ============================================ */
const Shortcuts = {
  init(map = {}) {
    document.addEventListener("keydown", (e) => {
      if (
        e.target.tagName === "INPUT" ||
        e.target.tagName === "TEXTAREA" ||
        e.target.tagName === "SELECT"
      ) {
        if (e.key === "Escape") e.target.blur();
        return;
      }
      const ctrl = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      if (e.key === "Escape") {
        document.querySelectorAll(".modal-overlay.show").forEach((o) => {
          const close = o.querySelector(".modal-close");
          if (close) close.click();
        });
      }
      if (ctrl && key === "k") {
        e.preventDefault();
        const search = document.querySelector("[data-global-search]");
        if (search) search.focus();
      }
      if (ctrl && key === "n") {
        e.preventDefault();
        const addBtn =
          document.querySelector("[data-add-btn]") ||
          document.querySelector(".fab");
        if (addBtn) addBtn.click();
      }
      if (ctrl && key === "d") {
        e.preventDefault();
        Theme.toggle();
      }

      if (map[key]) {
        e.preventDefault();
        map[key]();
      }
    });
  },
};

/* ============================================
   Bootstrap: Init Firebase, Theme, etc.
   ============================================ */
function bootstrapApp(needsAuth = false) {
  Loader.show();
  Theme.init();
  registerServiceWorker(); // Register service worker for offline support
  if (!initFirebase()) {
    setTimeout(() => {
      Loader.hide();
      Modal.alert(
        "Firebase SDK gagal dimuat. Pastikan Anda memiliki koneksi internet dan konfigurasi Firebase di js/firebase.js sudah benar.",
        "error",
        "Koneksi Diperlukan",
      );
    }, 500);
    return;
  }
  VersionCheck.check();

  let authRedirectTimer = null;
  let authRedirectScheduled = false;

  App.auth.onAuthStateChanged((user) => {
    App.currentUser = user;
    App.ready = true;

    if (needsAuth) {
      if (user) {
        authRedirectScheduled = false;
        if (authRedirectTimer) {
          clearTimeout(authRedirectTimer);
          authRedirectTimer = null;
        }
        _ensureUserSetup();
      } else if (!authRedirectScheduled) {
        authRedirectScheduled = true;
        
        // ✅ FIX 2: Timeout dinamis berdasarkan device
        // 1200ms terlalu cepat untuk HP (iOS/Android) memuat session dari IndexedDB.
        // Ini yang menyebabkan infinite loop (ditendang ke login -> balik ke dashboard -> ditendang lagi).
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
                         (window.matchMedia && window.matchMedia("(pointer: coarse)").matches);
        const delay = isMobile ? 5000 : 1500;

        authRedirectTimer = setTimeout(() => {
          if (!App.currentUser && !App.auth?.currentUser) {
            window.location.replace("login.html");
          }
        }, delay);
      }
    }

    if (typeof onAppReady === "function") onAppReady();
    Loader.hide(400);
  });
}

async function _ensureUserSetup() {
  try {
    const uid = DB.uid;
    if (!uid) return;
    const userRef = App.db.collection("users").doc(uid);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      await userRef.set({
        email: App.currentUser.email || "",
        displayName:
          App.currentUser.displayName ||
          App.currentUser.email?.split("@")[0] ||
          "User",
        photoURL: App.currentUser.photoURL || "",
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        lastLogin: firebase.firestore.FieldValue.serverTimestamp(),
        defaultColor: "sage",
      });

      for (const cat of Defaults.categories) {
        await DB.add("categories", cat);
      }
      for (const admin of Defaults.adminTransactions) {
        await DB.add("admin_transactions", admin);
      }
    } else {
      await userRef.update({
        lastLogin: firebase.firestore.FieldValue.serverTimestamp(),
      });
    }
  } catch (e) {
    console.warn("User setup error:", e);
  }
}

window.App = App;
window.IDR = IDR;
window.Sanitize = Sanitize;
window.Toast = Toast;
window.Modal = Modal;
window.Theme = Theme;
window.DB = DB;
window.DateUtils = DateUtils;
window.Exporter = Exporter;
window.Loader = Loader;
window.Defaults = Defaults;
window.Shortcuts = Shortcuts;
window.VersionCheck = VersionCheck;
window.setupSidebar = setupSidebar;
window.bootstrapApp = bootstrapApp;