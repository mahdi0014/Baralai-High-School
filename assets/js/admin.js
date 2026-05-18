(function () {
    const AUTH_KEY = "bhs_admin_auth";
    const LEGACY_LOGIN_KEY = "userLoggedIn";
    const USER_INFO_KEY = "userInfo";
    const REMEMBER_EMAIL_KEY = "bhs_remembered_email";

    document.addEventListener("DOMContentLoaded", async function () {
        await initAuthSystem();
    });

    async function initAuthSystem() {
        const path = window.location.pathname.toLowerCase();

        const isAdminPage = path.includes("/admin/");
        const isLoginPage =
            path.includes("/admin/login.html") ||
            path.endsWith("/admin/login.html");

        if (!isAdminPage) return;

        if (!window.bhsSupabase) {
            console.error("Supabase connection not found.");
            if (!isLoginPage) {
                clearLocalAuth();
                window.location.replace("login.html");
            }
            return;
        }

        if (isLoginPage) {
            await redirectLoginPageIfSessionExists();
            initAdminLogin();
            return;
        }

        await protectAdminPage();
    }

    async function redirectLoginPageIfSessionExists() {
        const { data } = await window.bhsSupabase.auth.getSession();

        if (data && data.session && data.session.user) {
            const profile = await getAdminProfile(data.session.user.id);

            if (profile && profile.status === "active") {
                syncLocalAuth(data.session.user, profile);
                localStorage.removeItem("bhs_dashboard_active_tab");
                sessionStorage.setItem("bhs_login_default_dashboard", "1");
                window.location.href = "dashboard.html#dashboard";
            }
        }
    }

    async function protectAdminPage() {
        const { data, error } = await window.bhsSupabase.auth.getSession();

        if (error || !data.session || !data.session.user) {
            clearLocalAuth();
            window.location.replace("login.html");
            return;
        }

        const profile = await getAdminProfile(data.session.user.id);

        if (!profile || profile.status !== "active") {
            await window.bhsSupabase.auth.signOut();
            clearLocalAuth();
            window.location.replace("login.html");
            return;
        }

        syncLocalAuth(data.session.user, profile);
    }

    function initAdminLogin() {
        initPasswordToggle();
        initRememberedEmail();
        initLoginForm();
    }

    function initLoginForm() {
        const loginForm = document.getElementById("loginForm");
        const usernameInput = document.getElementById("username");
        const passwordInput = document.getElementById("password");
        const rememberInput = document.getElementById("remember");
        const loginBtn = document.getElementById("loginBtn");

        if (!loginForm || !usernameInput || !passwordInput) return;

        loginForm.addEventListener("submit", async function (event) {
            event.preventDefault();

            const inputEmail = usernameInput.value.trim();
            const inputPassword = passwordInput.value.trim();

            clearMessage();

            if (!inputEmail || !inputPassword) {
                showMessage("Please enter both email and password.", "error");
                return;
            }

            setButtonLoading(loginBtn, true);

            const { data, error } = await window.bhsSupabase.auth.signInWithPassword({
                email: inputEmail,
                password: inputPassword
            });

            if (error || !data.user) {
                setButtonLoading(loginBtn, false);
                showMessage("Invalid email or password.", "error");
                return;
            }

            const profile = await getAdminProfile(data.user.id);

            if (!profile || profile.status !== "active") {
                await window.bhsSupabase.auth.signOut();
                clearLocalAuth();
                setButtonLoading(loginBtn, false);
                showMessage("This admin account is not active.", "error");
                return;
            }

            syncLocalAuth(data.user, profile);

            if (rememberInput && rememberInput.checked) {
                try { localStorage.setItem(REMEMBER_EMAIL_KEY, inputEmail); } catch (_) {}
            } else {
                localStorage.removeItem(REMEMBER_EMAIL_KEY);
            }

            showMessage("Login successful. Redirecting...", "success");

            setTimeout(function () {
                window.location.href = "dashboard.html";
            }, 500);
        });
    }

    async function getAdminProfile(userId) {
        const { data, error } = await window.bhsSupabase
            .from("admin_profiles")
            .select("id, full_name, email, designation, role, status")
            .eq("id", userId)
            .single();

        if (error) {
            console.error("Admin profile error:", error);
            return null;
        }

        return data;
    }

    function syncLocalAuth(user, profile) {
        const userInfo = {
            id: user.id,
            name: profile.full_name || "Admin User",
            email: profile.email || user.email,
            designation: profile.designation || "Administrator",
            role: profile.role || "admin",
            loginTime: new Date().toISOString()
        };

        try {
            localStorage.setItem(AUTH_KEY, "true");
            localStorage.setItem(LEGACY_LOGIN_KEY, "true");
            if (typeof window.bhsSafeSetLocalJSON === "function") window.bhsSafeSetLocalJSON(USER_INFO_KEY, userInfo);
            else localStorage.setItem(USER_INFO_KEY, JSON.stringify(userInfo));
        } catch (_) {}
    }

    function initPasswordToggle() {
        const togglePassword = document.getElementById("togglePassword");
        const passwordInput = document.getElementById("password");

        if (!togglePassword || !passwordInput) return;

        togglePassword.addEventListener("click", function () {
            const isPassword = passwordInput.type === "password";
            passwordInput.type = isPassword ? "text" : "password";

            togglePassword.classList.toggle("fa-eye", !isPassword);
            togglePassword.classList.toggle("fa-eye-slash", isPassword);
        });
    }

    function initRememberedEmail() {
        const usernameInput = document.getElementById("username");
        const rememberInput = document.getElementById("remember");

        if (!usernameInput || !rememberInput) return;

        const rememberedEmail = localStorage.getItem(REMEMBER_EMAIL_KEY);

        if (rememberedEmail) {
            usernameInput.value = rememberedEmail;
            rememberInput.checked = true;
        }
    }

    function setButtonLoading(button, isLoading) {
        if (!button) return;

        if (isLoading) {
            button.disabled = true;
            button.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Logging in...`;
        } else {
            button.disabled = false;
            button.innerHTML = `<i class="fa-solid fa-right-to-bracket"></i> Login`;
        }
    }

    function clearMessage() {
        const message = document.getElementById("message");
        if (!message) return;

        message.textContent = "";
        message.className = "";
        message.removeAttribute("style");
    }

    function clearLocalAuth() {
        localStorage.removeItem(AUTH_KEY);
        localStorage.removeItem(LEGACY_LOGIN_KEY);
        localStorage.removeItem(USER_INFO_KEY);
    }

    window.showMessage = function (text, type) {
        const message = document.getElementById("message");

        if (!message) {
            alert(text);
            return;
        }

        message.textContent = text;
        message.className = "login-message " + type;

        if (type === "success") {
            message.style.color = "#166534";
            message.style.background = "#dcfce7";
            message.style.border = "1px solid #86efac";
        } else if (type === "info") {
            message.style.color = "#1e40af";
            message.style.background = "#dbeafe";
            message.style.border = "1px solid #93c5fd";
        } else {
            message.style.color = "#991b1b";
            message.style.background = "#fee2e2";
            message.style.border = "1px solid #fecaca";
        }

        message.style.marginTop = "14px";
        message.style.padding = "12px 14px";
        message.style.borderRadius = "12px";
        message.style.fontWeight = "700";
        message.style.textAlign = "center";
    };

    window.logoutAdmin = async function () {
        if (window.bhsSupabase) {
            await window.bhsSupabase.auth.signOut();
        }

        clearLocalAuth();
        window.location.href = "login.html";
    };
})();