/* ============================================
   Authentication Module
   Personal Financial Allocation v1.0.2
   Fixed: iOS/Android redirect with proper auth state handling
   ============================================ */

(function () {
  "use strict";

  const AppUrl = {
    to(page) {
      return new URL(page, window.location.href).toString();
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
      localStorage.removeItem('authRedirect');
      localStorage.removeItem('authTimestamp');
      localStorage.removeItem('pendingGoogleAuth');
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

    async handleGoogleRedirect(returnPage = "dashboard.html") {
      console.log("=== handleGoogleRedirect called ===");
      console.log("Time:", new Date().toISOString());
      console.log("Has App.auth:", !!App.auth);
      console.log("Current user:", App.auth?.currentUser?.email);

      try {
        if (!App.auth) {
          console.error("App.auth not initialized");
          return false;
        }

        // Coba dapatkan redirect result
        const redirectResult = await App.auth.getRedirectResult();
        console.log("Redirect result:", {
          hasUser: !!redirectResult?.user,
          email: redirectResult?.user?.email,
          error: redirectResult?.error?.code
        });

        if (redirectResult?.user) {
          console.log("✅ User found from redirect result");
          this.currentUser = redirectResult.user;
          App.currentUser = redirectResult.user;
          
          // Bersihkan flags
          localStorage.removeItem('authRedirect');
          localStorage.removeItem('authTimestamp');
          localStorage.removeItem('pendingGoogleAuth');
          
          // Redirect ke dashboard
          console.log("Redirecting to:", returnPage);
          window.location.href = AppUrl.to(returnPage); // Gunakan href bukan replace
          return true;
        }

        // Jika tidak ada redirect result, cek currentUser
        const currentUser = App.auth.currentUser;
        if (currentUser) {
          console.log("✅ User found from currentUser");
          this.currentUser = currentUser;
          App.currentUser = currentUser;
          
          localStorage.removeItem('authRedirect');
          localStorage.removeItem('authTimestamp');
          localStorage.removeItem('pendingGoogleAuth');
          
          console.log("Redirecting to:", returnPage);
          window.location.href = AppUrl.to(returnPage);
          return true;
        }

        console.log("❌ No user found in redirect or current state");
        return false;

      } catch (err) {
        console.error("Error in handleGoogleRedirect:", err);
        
        // Fallback: cek currentUser jika getRedirectResult error
        const currentUser = App.auth.currentUser;
        if (currentUser) {
          console.log("✅ User found after error catch");
          this.currentUser = currentUser;
          App.currentUser = currentUser;
          
          localStorage.removeItem('authRedirect');
          localStorage.removeItem('authTimestamp');
          localStorage.removeItem('pendingGoogleAuth');
          
          window.location.href = AppUrl.to(returnPage);
          return true;
        }
        
        return false;
      }
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
        // Selalu gunakan LOCAL persistence
        await App.auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
      } catch (err) {
        console.error("Failed to set persistence:", err);
      }

      // Set flag bahwa kita sedang menunggu Google auth
      localStorage.setItem('pendingGoogleAuth', 'true');
      localStorage.setItem('authTimestamp', Date.now().toString());

      // DI MOBILE, SELALU GUNAKAN REDIRECT
      if (isMobile) {
        console.log("📱 Mobile detected, using redirect method");
        try {
          await App.auth.signInWithRedirect(provider);
          console.log("Redirect initiated, waiting for return...");
          return null; // User akan di-redirect ke Google
        } catch (err) {
          console.error("Google redirect failed:", err);
          localStorage.removeItem('pendingGoogleAuth');
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
        localStorage.removeItem('pendingGoogleAuth');
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
            localStorage.removeItem('pendingGoogleAuth');
            localStorage.removeItem('authTimestamp');
            throw redirectErr;
          }
        }
        
        localStorage.removeItem('pendingGoogleAuth');
        localStorage.removeItem('authTimestamp');
        throw err;
      }
    },

    debugAuthState() {
      const info = {
        hasAuth: !!App.auth,
        currentUser: App.auth?.currentUser?.email,
        currentUserDisplayName: App.auth?.currentUser?.displayName,
        persistence: App.auth?.currentUser ? 'logged in' : 'not logged in',
        platform: navigator.userAgent,
        isMobile: this.isMobileBrowser(),
        pendingGoogleAuth: localStorage.getItem('pendingGoogleAuth'),
        authRedirect: localStorage.getItem('authRedirect'),
        timestamp: new Date().toISOString()
      };
      console.log("🔍 Auth State Debug:", info);
      return info;
    }
  };

  window.Auth = Auth;

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
            // Mobile: sedang redirect
            googleBtn.innerHTML = "Menunggu Google...";
            return;
          }
          
          // Desktop: berhasil
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
                window.location.href = AppUrl.to("login.html");
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
     🔑 MAIN FIX: Auth State Observer
     Ini adalah kunci utama untuk mobile redirect
     ============================================ */
  function initAuthStateObserver() {
    console.log("👁️ Setting up auth state observer...");
    
    if (!App.auth) {
      console.error("Cannot setup observer: App.auth not ready");
      return;
    }

    // Remove any existing observers to avoid duplicates
    if (window._authObserver) {
      window._authObserver();
    }

    // Setup persistent auth state listener
    window._authObserver = App.auth.onAuthStateChanged(async (user) => {
      console.log("🔄 Auth state changed:", {
        user: user?.email,
        timestamp: new Date().toISOString()
      });

      Auth.currentUser = user;
      App.currentUser = user;

      if (user) {
        console.log("✅ User is logged in");
        
        // Cek apakah ini halaman auth (login/register)
        const isAuthPage = document.getElementById("loginForm") || 
                          document.getElementById("registerForm");
        
        if (isAuthPage) {
          console.log("📍 On auth page, checking redirect flags...");
          
          // Cek apakah ada flag pending Google auth
          const pendingGoogle = localStorage.getItem('pendingGoogleAuth');
          const timestamp = localStorage.getItem('authTimestamp');
          
          if (pendingGoogle || timestamp) {
            console.log("🎯 Pending Google auth detected, redirecting to dashboard...");
            
            // Bersihkan flags
            localStorage.removeItem('pendingGoogleAuth');
            localStorage.removeItem('authRedirect');
            localStorage.removeItem('authTimestamp');
            
            // Redirect ke dashboard
            const dashboardUrl = AppUrl.to("dashboard.html");
            console.log("Redirecting to:", dashboardUrl);
            
            // Gunakan setTimeout untuk memastikan state tersimpan
            setTimeout(() => {
              window.location.replace(dashboardUrl);
            }, 500);
          } else {
            console.log("ℹ️ No pending auth flags, staying on auth page");
          }
        } else {
          console.log("📍 On non-auth page, user is logged in");
          // Render user info jika diperlukan
          if (typeof window.renderUserInfo === 'function') {
            window.renderUserInfo();
          }
        }
      } else {
        console.log("❌ No user logged in");
        
        // Jika tidak di halaman auth, redirect ke login
        const isAuthPage = document.getElementById("loginForm") || 
                          document.getElementById("registerForm");
        
        if (!isAuthPage) {
          console.log("🔒 User not authenticated, redirecting to login...");
          window.location.replace(AppUrl.to("login.html"));
        }
      }
    }, (error) => {
      console.error("Auth state observer error:", error);
    });

    console.log("✅ Auth state observer initialized");
  }

  /* ============================================
     Init Function - Runs when DOM is ready
     ============================================ */
  async function initializeAuth() {
    console.log("🚀 Initializing auth module...");
    console.log("Platform:", navigator.userAgent);
    console.log("Current URL:", window.location.href);
    
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

    // Setup auth state observer - THIS IS THE KEY
    initAuthStateObserver();

    // Check for redirect result
    const isAuthPage = document.getElementById("loginForm") || 
                      document.getElementById("registerForm");
    
    if (isAuthPage) {
      console.log("📍 On auth page, checking for redirect result...");
      
      // Try to get redirect result
      try {
        const result = await App.auth.getRedirectResult();
        console.log("Redirect check complete:", {
          hasUser: !!result.user,
          email: result.user?.email
        });
        
        if (result.user) {
          console.log("✅ Redirect user found, observer will handle redirect");
          // Observer akan menangani redirect ini
        }
      } catch (err) {
        console.log("No redirect result found (this is normal for non-redirect visits):", err.code);
      }
      
      // Double check: if user is already logged in and we're on auth page
      if (App.auth.currentUser) {
        console.log("👤 User already logged in on auth page");
        const pendingGoogle = localStorage.getItem('pendingGoogleAuth');
        if (pendingGoogle) {
          console.log("🎯 Pending Google auth flag found, redirecting...");
          localStorage.removeItem('pendingGoogleAuth');
          localStorage.removeItem('authRedirect');
          localStorage.removeItem('authTimestamp');
          setTimeout(() => {
            window.location.replace(AppUrl.to("dashboard.html"));
          }, 500);
        }
      }
    }

    // Call ready callback if exists
    if (typeof onAuthPagesReady === "function") {
      onAuthPagesReady();
    }

    console.log("✅ Auth module initialization complete");
  }

  // Start initialization when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeAuth);
  } else {
    // DOM already loaded
    initializeAuth();
  }

  // Export functions
  window.renderUserInfo = renderUserInfo;
  window.mapAuthError = mapAuthError;
  window.initAuthStateObserver = initAuthStateObserver;
  
})();