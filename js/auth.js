/* ============================================
   Authentication Module
   Personal Financial Allocation v1.0.3
   Fixed: iOS/Android redirect + Root domain routing
   ============================================ */

(function () {
  "use strict";

  const AppUrl = {
    to(page) {
      // Dapatkan base URL dari current location
      const baseUrl = window.location.origin + window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/') + 1);
      return new URL(page, baseUrl).toString();
    },
  };

  const Auth = {
    currentUser: null,

    async register(email, password, displayName = null) {
      const cleanEmail = Sanitize.email(email);
      if (!cleanEmail) throw new Error("Email tidak valid");
      if (!password || password.length < 6)
        throw new Error("Password minimal 6 karakter");

      const userCred = await App.auth.createUserWithEmailAndPassword(
        cleanEmail,
        password,
      );
      this.currentUser = userCred.user;

      if (displayName) {
        const cleanName = Sanitize.string(displayName, 50);
        if (cleanName) {
          await this.currentUser.updateProfile({ displayName: cleanName });
        }
      }

      await this._sendWelcomeEmail();
      return this.currentUser;
    },

    async login(email, password, remember = false) {
      const cleanEmail = Sanitize.email(email);
      if (!cleanEmail) throw new Error("Email tidak valid");
      if (!password) throw new Error("Password diperlukan");

      const persistence = remember || this.isMobileBrowser()
        ? firebase.auth.Auth.Persistence.LOCAL
        : firebase.auth.Auth.Persistence.SESSION;

      await App.auth.setPersistence(persistence);
      const userCred = await App.auth.signInWithEmailAndPassword(
        cleanEmail,
        password,
      );
      this.currentUser = userCred.user;
      return this.currentUser;
    },

    async logout() {
      await App.auth.signOut();
      this.currentUser = null;
      // Bersihkan semua localStorage terkait auth
      localStorage.removeItem('authRedirect');
      localStorage.removeItem('authTimestamp');
      localStorage.removeItem('pendingGoogleAuth');
      localStorage.removeItem('googleRedirectInProgress');
    },

    async forgotPassword(email) {
      const cleanEmail = Sanitize.email(email);
      if (!cleanEmail) throw new Error("Email tidak valid");
      await App.auth.sendPasswordResetEmail(cleanEmail, {
        url: AppUrl.to("login.html"),
        handleCodeInApp: false,
      });
    },

    async _sendWelcomeEmail() {
      try {
        if (this.currentUser && !this.currentUser.emailVerified) {
          await this.currentUser.sendEmailVerification({
            url: AppUrl.to("dashboard.html"),
          });
        }
      } catch (e) {
        console.warn("Email verification not sent:", e);
      }
    },

    guard(page = "dashboard") {
      const user = App.currentUser || App.auth?.currentUser;
      if (!user) {
        window.location.replace(AppUrl.to("login.html"));
        return false;
      }
      return true;
    },

    onAuthChange(callback) {
      App.auth.onAuthStateChanged((user) => {
        this.currentUser = user;
        if (callback) callback(user);
      });
    },

    passwordStrength(password) {
      if (!password) return { score: 0, label: "" };
      let score = 0;
      if (password.length >= 6) score++;
      if (password.length >= 10) score++;
      if (/[A-Z]/.test(password)) score++;
      if (/[0-9]/.test(password)) score++;
      if (/[^A-Za-z0-9]/.test(password)) score++;

      const labels = [
        "Sangat Lemah",
        "Lemah",
        "Cukup",
        "Baik",
        "Sangat Baik",
        "Kuat",
      ];
      return {
        score: Math.min(score, 5),
        label: labels[score] || "",
        class:
          score <= 1
            ? "weak"
            : score === 2
              ? "fair"
              : score === 3
                ? "good"
                : "strong",
      };
    },

    isMobileBrowser() {
      return (
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
          navigator.userAgent,
        ) ||
        (window.matchMedia &&
          window.matchMedia("(pointer: coarse)").matches)
      );
    },

    async loginWithGoogle(useRedirect = false) {
      if (!firebase.auth?.GoogleAuthProvider) {
        throw new Error(
          "GoogleAuthProvider tidak tersedia. Pastikan Firebase Auth SDK sudah dimuat.",
        );
      }
      
      const provider = new firebase.auth.GoogleAuthProvider();
      provider.addScope("profile");
      provider.addScope("email");

      const isMobile = this.isMobileBrowser();
      
      // Set parameters
      provider.setCustomParameters({ 
        prompt: "select_account"
      });

      try {
        // SELALU gunakan LOCAL persistence
        await App.auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
      } catch (err) {
        console.error("Failed to set persistence:", err);
      }

      // Set flag bahwa kita sedang dalam proses Google redirect
      localStorage.setItem('googleRedirectInProgress', 'true');
      localStorage.setItem('authTimestamp', Date.now().toString());

      // DI MOBILE, SELALU GUNAKAN REDIRECT
      if (isMobile) {
        console.log("📱 Mobile detected, using redirect method");
        try {
          await App.auth.signInWithRedirect(provider);
          console.log("Redirect to Google initiated...");
          return null; // User akan di-redirect ke Google
        } catch (err) {
          console.error("Google redirect failed:", err);
          localStorage.removeItem('googleRedirectInProgress');
          localStorage.removeItem('authTimestamp');
          throw err;
        }
      }

      // DESKTOP: Coba popup dulu
      console.log("💻 Desktop detected, trying popup method");
      try {
        const result = await App.auth.signInWithPopup(provider);
        this.currentUser = result.user;
        App.currentUser = result.user;
        localStorage.removeItem('googleRedirectInProgress');
        localStorage.removeItem('authTimestamp');
        console.log("✅ Popup login successful");
        return this.currentUser;
      } catch (err) {
        console.warn("Popup failed, falling back to redirect:", err.code);
        
        // Jika popup gagal, fallback ke redirect
        if (err.code === 'auth/popup-blocked' || 
            err.code === 'auth/popup-closed-by-user' ||
            err.code === 'auth/cancelled-popup-request') {
          try {
            await App.auth.signInWithRedirect(provider);
            return null;
          } catch (redirectErr) {
            localStorage.removeItem('googleRedirectInProgress');
            localStorage.removeItem('authTimestamp');
            throw redirectErr;
          }
        }
        
        localStorage.removeItem('googleRedirectInProgress');
        localStorage.removeItem('authTimestamp');
        throw err;
      }
    },

    debugAuthState() {
      const info = {
        hasAuth: !!App.auth,
        currentUser: App.auth?.currentUser?.email,
        currentUserDisplayName: App.auth?.currentUser?.displayName,
        isLoggedIn: !!App.auth?.currentUser,
        platform: navigator.userAgent,
        isMobile: this.isMobileBrowser(),
        googleRedirectInProgress: localStorage.getItem('googleRedirectInProgress'),
        pendingGoogleAuth: localStorage.getItem('pendingGoogleAuth'),
        authRedirect: localStorage.getItem('authRedirect'),
        timestamp: new Date().toISOString(),
        currentUrl: window.location.href
      };
      console.log("🔍 Auth State Debug:", info);
      return info;
    }
  };

  window.Auth = Auth;

  /* ============================================
     🔑 ROOT DOMAIN HANDLER
     Redirect ke index.html jika user mengakses root domain
     ============================================ */
  function handleRootDomain() {
    const currentPath = window.location.pathname;
    const currentUrl = window.location.href;
    
    console.log("📍 Current URL:", currentUrl);
    console.log("📍 Current path:", currentPath);
    
    // Cek apakah user mengakses root domain atau "/"
    const isRootDomain = currentPath === '/' || 
                        currentPath === '' || 
                        currentPath === '/index.html' ||
                        currentPath.endsWith('/');
    
    // Cek apakah ada parameter atau hash
    const hasParams = window.location.search || window.location.hash;
    
    // Cek apakah ini dari Google OAuth redirect
    const isGoogleCallback = window.location.search.includes('oauth') || 
                            window.location.search.includes('code=') ||
                            window.location.search.includes('state=');
    
    // Jika root domain dan bukan Google callback, redirect ke index.html
    if (isRootDomain && !isGoogleCallback && !hasParams) {
      console.log("🏠 Root domain detected, redirecting to index.html");
      window.location.replace(AppUrl.to("index.html"));
      return true;
    }
    
    return false;
  }

  /* ============================================
     Login Page Logic
     ============================================ */
  function initLoginPage() {
    const loginForm = document.getElementById("loginForm");
    if (!loginForm) return;

    const submitBtn = loginForm.querySelector('[type="submit"]');
    const originalText = submitBtn.innerHTML;

    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = loginForm.querySelector("#email").value;
      const password = loginForm.querySelector("#password").value;
      const remember = loginForm.querySelector("#remember")?.checked || false;

      if (!email || !password) {
        Toast.warning("Harap isi email dan password");
        return;
      }

      submitBtn.disabled = true;
      submitBtn.innerHTML = `<svg class="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;animation:spin 0.8s linear infinite;"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg> Masuk...`;

      try {
        await Auth.login(email, password, remember);
        Toast.success("Login berhasil! Mengarahkan ke dashboard...");
        setTimeout(() => {
          window.location.href = AppUrl.to("dashboard.html");
        }, 800);
      } catch (err) {
        const msg = mapAuthError(err);
        Toast.error(msg, "Gagal Login");
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
      }
    });

    const forgotBtn = document.getElementById("forgotPasswordBtn");
    if (forgotBtn) {
      forgotBtn.addEventListener("click", showForgotPasswordModal);
    }

    const googleBtn = document.getElementById("googleLoginBtn");
    if (googleBtn) {
      googleBtn.addEventListener("click", async (e) => {
        e.preventDefault();
        const prev = googleBtn.innerHTML;
        googleBtn.disabled = true;
        googleBtn.innerHTML = `<svg class="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;animation:spin 0.8s linear infinite;"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg> Menghubungkan ke Google...`;
        
        try {
          const result = await Auth.loginWithGoogle(false);
          
          if (!result) {
            // Mobile: sedang redirect ke Google
            googleBtn.innerHTML = "Menunggu Google...";
            // Jangan reset button, biarkan user tahu sedang proses
            return;
          }
          
          // Desktop: berhasil login
          Toast.success("Login dengan Google berhasil! Mengarahkan ke dashboard...");
          setTimeout(() => {
            window.location.href = AppUrl.to("dashboard.html");
          }, 800);
        } catch (err) {
          Toast.error(mapAuthError(err), "Gagal Login Google");
          googleBtn.disabled = false;
          googleBtn.innerHTML = prev;
        }
      });
    }
  }

  /* ============================================
     Register Page Logic
     ============================================ */
  function initRegisterPage() {
    const form = document.getElementById("registerForm");
    if (!form) return;

    const submitBtn = form.querySelector('[type="submit"]');
    const originalText = submitBtn.innerHTML;

    const passwordInput = form.querySelector("#password");
    const strengthBox = document.getElementById("passwordStrength");
    if (passwordInput && strengthBox) {
      passwordInput.addEventListener("input", () => {
        const s = Auth.passwordStrength(passwordInput.value);
        strengthBox.className = "password-strength";
        if (passwordInput.value)
          strengthBox.classList.add("strength-" + s.class);
        strengthBox.querySelector(".password-strength-text").textContent =
          passwordInput.value ? `Kekuatan: ${s.label}` : "";
      });
    }

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = form.querySelector("#name").value;
      const email = form.querySelector("#email").value;
      const password = form.querySelector("#password").value;
      const confirm = form.querySelector("#confirmPassword").value;

      if (!name || !email || !password) {
        Toast.warning("Harap lengkapi semua field");
        return;
      }
      if (password !== confirm) {
        Toast.error("Password dan konfirmasi tidak cocok");
        return;
      }
      if (password.length < 6) {
        Toast.warning("Password minimal 6 karakter");
        return;
      }

      submitBtn.disabled = true;
      submitBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;animation:spin 0.8s linear infinite;"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg> Mendaftarkan...`;

      try {
        await Auth.register(email, password, name);
        Toast.success("Akun berhasil dibuat! Mengarahkan ke dashboard...");
        setTimeout(() => {
          window.location.href = AppUrl.to("dashboard.html");
        }, 1200);
      } catch (err) {
        const msg = mapAuthError(err);
        Toast.error(msg, "Gagal Daftar");
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
      }
    });

    const googleBtn = document.getElementById("googleRegisterBtn");
    if (googleBtn) {
      googleBtn.addEventListener("click", async (e) => {
        e.preventDefault();
        const prev = googleBtn.innerHTML;
        googleBtn.disabled = true;
        googleBtn.innerHTML = `<svg class="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;animation:spin 0.8s linear infinite;"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg> Menghubungkan ke Google...`;
        
        try {
          const result = await Auth.loginWithGoogle(false);
          
          if (!result) {
            googleBtn.innerHTML = "Menunggu Google...";
            return;
          }
          
          Toast.success("Daftar dengan Google berhasil! Mengarahkan ke dashboard...");
          setTimeout(() => {
            window.location.href = AppUrl.to("dashboard.html");
          }, 1200);
        } catch (err) {
          Toast.error(mapAuthError(err), "Gagal Daftar Google");
          googleBtn.disabled = false;
          googleBtn.innerHTML = prev;
        }
      });
    }
  }

  /* ============================================
     Forgot Password
     ============================================ */
  function showForgotPasswordModal() {
    const { modal, close } = Modal.create({
      title: "Lupa Password",
      content: `
        <p style="margin-bottom:16px;color:var(--text-secondary);font-size:13px;">
          Masukkan email Anda, kami akan mengirimkan link untuk mereset password.
        </p>
        <div class="form-group" style="margin-bottom:0;">
          <label class="form-label">Email <span class="required">*</span></label>
          <input type="email" id="resetEmail" class="form-control" placeholder="email@contoh.com">
        </div>
      `,
      footer: `
        <button class="btn btn-secondary" data-action="cancel">Batal</button>
        <button class="btn btn-primary" data-action="reset">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4v5h.582m15.356 2A8.001 8.001 0 0 0 4.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 0 1-15.357-2m15.357 2H15"></path></svg>
          Kirim Link
        </button>
      `,
    });

    modal
      .querySelector('[data-action="cancel"]')
      .addEventListener("click", close);
    modal
      .querySelector('[data-action="reset"]')
      .addEventListener("click", async () => {
        const email = modal.querySelector("#resetEmail").value;
        if (!Sanitize.email(email)) {
          Toast.warning("Harap masukkan email yang valid");
          return;
        }
        try {
          await Auth.forgotPassword(email);
          close();
          Toast.success("Link reset password telah dikirim ke email Anda");
        } catch (err) {
          Toast.error(mapAuthError(err));
        }
      });
  }

  /* ============================================
     Logout Button
     ============================================ */
  function initLogoutButtons() {
    document.querySelectorAll("[data-logout]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        Modal.confirm(
          "Apakah Anda yakin ingin keluar dari akun ini?",
          async () => {
            try {
              await Auth.logout();
              Toast.success("Anda berhasil keluar");
              setTimeout(() => {
                window.location.href = AppUrl.to("index.html"); // Redirect ke index, bukan login
              }, 500);
            } catch (err) {
              Toast.error("Gagal logout");
            }
          },
          "Konfirmasi Keluar",
        );
      });
    });
  }

  /* ============================================
     Sidebar User Info Render
     ============================================ */
  function renderUserInfo() {
    const user = App.auth.currentUser;
    if (!user) return;

    const initials =
      (user.displayName || user.email || "?")
        .toString()
        .split(/[.\s_-]/)
        .filter(Boolean)
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase())
        .join("") || "?";

    document.querySelectorAll("[data-user-name]").forEach((el) => {
      el.textContent = user.displayName || user.email || "User";
    });
    document.querySelectorAll("[data-user-email]").forEach((el) => {
      el.textContent = user.email || "";
    });
    document.querySelectorAll("[data-user-avatar]").forEach((el) => {
      if (user.photoURL) {
        el.innerHTML = `<img src="${user.photoURL}" alt="" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`;
      } else {
        el.textContent = initials;
      }
    });
  }

  /* ============================================
     Auth Error Mapper
     ============================================ */
  function mapAuthError(err) {
    const code = err?.code || "";
    const msg = err?.message || "";
    const messages = {
      "auth/user-not-found":
        "Akun tidak ditemukan. Periksa email atau daftar dulu.",
      "auth/wrong-password": "Password salah. Coba lagi atau reset password.",
      "auth/invalid-email": "Format email tidak valid.",
      "auth/email-already-in-use": "Email ini sudah terdaftar. Silakan login.",
      "auth/weak-password":
        "Password terlalu lemah. Gunakan minimal 6 karakter.",
      "auth/network-request-failed":
        "Koneksi gagal. Periksa jaringan internet Anda.",
      "auth/too-many-requests":
        "Terlalu banyak percobaan. Coba lagi beberapa saat.",
      "auth/user-disabled": "Akun ini telah dinonaktifkan.",
      "auth/popup-closed-by-user": "Popup ditutup sebelum proses selesai.",
      "auth/popup-blocked":
        "Popup diblokir oleh browser. Izinkan popup untuk situs ini.",
      "auth/cancelled-popup-request": "Permintaan login dibatalkan.",
      "auth/account-exists-with-different-credential":
        "Email ini sudah terdaftar dengan metode login lain. Gunakan metode login yang sama.",
      "auth/credential-already-in-use":
        "Kredensial ini sudah terhubung ke akun lain.",
      "auth/operation-not-allowed":
        "Provider login belum diaktifkan. Aktifkan di Firebase Console.",
      "auth/invalid-credential": "Kredensial tidak valid. Coba lagi.",
      "auth/invalid-verification-code": "Kode verifikasi tidak valid.",
      "auth/quota-exceeded": "Kuota terlampaui. Coba lagi nanti.",
      "auth/unauthorized-domain":
        "Domain ini tidak diotorisasi. Tambahkan domain di Firebase Console → Authentication → Settings → Authorized domains.",
    };
    return messages[code] || msg || "Terjadi kesalahan, coba lagi.";
  }

  /* ============================================
     🔑 GOOGLE REDIRECT HANDLER - Mobile Fix
     ============================================ */
  async function handleGoogleRedirectCallback() {
    console.log("🔍 Checking for Google OAuth callback...");
    console.log("Current URL:", window.location.href);
    
    // Cek apakah URL mengandung parameter OAuth dari Google
    const hasOAuthParams = window.location.search.includes('code=') || 
                          window.location.search.includes('state=') ||
                          window.location.search.includes('oauth');
    
    if (!hasOAuthParams) {
      console.log("Not a Google OAuth callback, skipping");
      return false;
    }

    console.log("✅ Google OAuth callback detected!");

    // Tunggu App.auth siap
    let attempts = 0;
    while (!window.App?.auth && attempts < 100) {
      await new Promise(r => setTimeout(r, 100));
      attempts++;
    }

    if (!window.App?.auth) {
      console.error("❌ App.auth not ready for redirect handling");
      return false;
    }

    try {
      // Ambil redirect result
      const result = await App.auth.getRedirectResult();
      console.log("Redirect result:", result);
      
      if (result.user) {
        console.log("✅ User authenticated via Google redirect:", result.user.email);
        
        // Set current user
        Auth.currentUser = result.user;
        App.currentUser = result.user;
        
        // Bersihkan flags
        localStorage.removeItem('googleRedirectInProgress');
        localStorage.removeItem('pendingGoogleAuth');
        localStorage.removeItem('authRedirect');
        localStorage.removeItem('authTimestamp');
        
        // Redirect ke dashboard
        console.log("Redirecting to dashboard...");
        setTimeout(() => {
          window.location.replace(AppUrl.to("dashboard.html"));
        }, 300);
        
        return true;
      } else {
        console.log("No user in redirect result");
        return false;
      }
    } catch (err) {
      console.error("Error handling Google redirect:", err);
      
      // Fallback: cek currentUser
      const currentUser = App.auth.currentUser;
      if (currentUser) {
        console.log("✅ Fallback: User found in currentUser");
        Auth.currentUser = currentUser;
        App.currentUser = currentUser;
        
        localStorage.removeItem('googleRedirectInProgress');
        localStorage.removeItem('pendingGoogleAuth');
        localStorage.removeItem('authRedirect');
        localStorage.removeItem('authTimestamp');
        
        setTimeout(() => {
          window.location.replace(AppUrl.to("dashboard.html"));
        }, 300);
        
        return true;
      }
      
      return false;
    }
  }

  /* ============================================
     🔑 AUTH STATE OBSERVER
     ============================================ */
  function initAuthStateObserver() {
    console.log("👁️ Setting up auth state observer...");
    
    if (!App.auth) {
      console.error("Cannot setup observer: App.auth not ready");
      return;
    }

    // Remove existing observer
    if (window._authObserver) {
      window._authObserver();
    }

    window._authObserver = App.auth.onAuthStateChanged((user) => {
      console.log("🔄 Auth state changed:", {
        user: user?.email,
        isLoggedIn: !!user,
        timestamp: new Date().toISOString(),
        currentPath: window.location.pathname
      });

      Auth.currentUser = user;
      App.currentUser = user;

      if (user) {
        console.log("✅ User is logged in");
        
        // Cek apakah di halaman auth (login/register)
        const isAuthPage = document.getElementById("loginForm") || 
                          document.getElementById("registerForm");
        
        // Cek apakah ada Google redirect in progress
        const googleRedirectInProgress = localStorage.getItem('googleRedirectInProgress');
        
        if (isAuthPage && googleRedirectInProgress) {
          console.log("🎯 Google redirect completed, redirecting to dashboard...");
          
          // Bersihkan flags
          localStorage.removeItem('googleRedirectInProgress');
          localStorage.removeItem('pendingGoogleAuth');
          localStorage.removeItem('authRedirect');
          localStorage.removeItem('authTimestamp');
          
          // Redirect ke dashboard
          setTimeout(() => {
            window.location.replace(AppUrl.to("dashboard.html"));
          }, 500);
        } else if (isAuthPage) {
          console.log("ℹ️ On auth page, user logged in but no redirect flag");
        }
        
        // Render user info
        if (typeof window.renderUserInfo === 'function') {
          window.renderUserInfo();
        }
      } else {
        console.log("❌ No user logged in");
        
        // Jika di halaman yang perlu auth (dashboard), redirect ke login
        const isProtectedPage = window.location.pathname.includes('dashboard') ||
                               window.location.pathname.includes('transactions') ||
                               window.location.pathname.includes('budget') ||
                               window.location.pathname.includes('goals');
        
        const isAuthPage = document.getElementById("loginForm") || 
                          document.getElementById("registerForm");
        
        if (isProtectedPage && !isAuthPage) {
          console.log("🔒 Protected page detected, redirecting to login...");
          window.location.replace(AppUrl.to("login.html"));
        }
      }
    }, (error) => {
      console.error("Auth state observer error:", error);
    });

    console.log("✅ Auth state observer initialized");
  }

  /* ============================================
     INITIALIZATION
     ============================================ */
  async function initializeAuth() {
    console.log("🚀 Initializing auth module...");
    console.log("Platform:", navigator.userAgent);
    console.log("Current URL:", window.location.href);
    console.log("Path:", window.location.pathname);
    
    // 🔑 Handle root domain dulu
    const isRootRedirected = handleRootDomain();
    if (isRootRedirected) {
      console.log("Redirected from root, stopping further initialization");
      return;
    }
    
    // 🔑 Handle Google OAuth callback
    const isGoogleCallback = await handleGoogleRedirectCallback();
    if (isGoogleCallback) {
      console.log("Google callback handled, stopping further initialization");
      return;
    }
    
    // Wait for App.auth to be ready
    let attempts = 0;
    while (!window.App?.auth && attempts < 100) {
      await new Promise(r => setTimeout(r, 100));
      attempts++;
    }

    if (!window.App?.auth) {
      console.error("❌ App.auth failed to initialize after 10 seconds");
      return;
    }

    console.log("✅ App.auth ready after", attempts * 100, "ms");

    // Debug current state
    Auth.debugAuthState();

    // Initialize UI components
    initLoginPage();
    initRegisterPage();
    initLogoutButtons();

    // Setup auth state observer
    initAuthStateObserver();

    // Check if user is already logged in
    const currentUser = App.auth.currentUser;
    const isAuthPage = document.getElementById("loginForm") || 
                      document.getElementById("registerForm");
    
    if (currentUser && isAuthPage) {
      console.log("👤 User already logged in on auth page");
      
      // Cek flag Google redirect
      const googleRedirectInProgress = localStorage.getItem('googleRedirectInProgress');
      
      if (googleRedirectInProgress) {
        console.log("🎯 Google redirect flag found, redirecting to dashboard...");
        localStorage.removeItem('googleRedirectInProgress');
        localStorage.removeItem('pendingGoogleAuth');
        localStorage.removeItem('authRedirect');
        localStorage.removeItem('authTimestamp');
        
        setTimeout(() => {
          window.location.replace(AppUrl.to("dashboard.html"));
        }, 500);
      }
    }

    // Call ready callback if exists
    if (typeof onAuthPagesReady === "function") {
      onAuthPagesReady();
    }

    console.log("✅ Auth module initialization complete");
  }

  // Start initialization
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeAuth);
  } else {
    initializeAuth();
  }

  // Export functions
  window.renderUserInfo = renderUserInfo;
  window.mapAuthError = mapAuthError;
  window.handleRootDomain = handleRootDomain;
  window.handleGoogleRedirectCallback = handleGoogleRedirectCallback;
  
})();