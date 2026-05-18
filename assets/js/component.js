function loadComponent(url, containerId) {
    return fetch(url)
        .then(response => response.text())
        .then(data => {
            const container = document.getElementById(containerId);
            if (container) container.innerHTML = data;
        })
        .catch(error => {
            console.error("Error loading component:", error);
        });
}

function loadComponents() {
    const currentPage = window.location.pathname;
    const isAdminPage = currentPage.includes("/admin/");
    const isLoginPage = currentPage.includes("/admin/login.html");

    if (isLoginPage) {
        return;
    }

    if (isAdminPage) {
        loadComponent("../Components/admin/sidebar.html", "sidebar-container")
            .then(() => {
                initSidebarSystem();

                if (typeof window.bhsUpdateSidebarActiveState === "function") {
                    window.bhsUpdateSidebarActiveState();
                }

                initHeaderHandlers();
            });

        loadComponent("../Components/admin/header.html", "admin-header-container")
            .then(() => {
                populateExamYearDropdown();
                setPageTitle();
                initAdminPopup();
                initLogoutButton();
                loadStoredUserInfo();
            });

        loadComponent("../Components/Public/footer.html", "footer-container");
    } else {
        loadComponent("Components/Public/header.html", "public-header-container");
        loadComponent("Components/Public/footer.html", "footer-container");
    }
}

function populateExamYearDropdown() {
    const currentYear = new Date().getFullYear();
    const startYear = 2026;
    const selectElement = document.getElementById('examYear');

    if (!selectElement) return;

    const savedYear = localStorage.getItem("bhs_selected_exam_year") || selectElement.value || String(currentYear);
    selectElement.innerHTML = "";

    for (let year = startYear; year <= currentYear; year++) {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = `Exam Year ${year}`;
        selectElement.appendChild(option);
    }

    const nextYear = currentYear + 1;
    const nextYearOption = document.createElement('option');
    nextYearOption.value = nextYear;
    nextYearOption.textContent = `Exam Year ${nextYear}`;
    selectElement.appendChild(nextYearOption);

    const availableValues = Array.from(selectElement.options).map((option) => String(option.value));
    selectElement.value = availableValues.includes(String(savedYear)) ? String(savedYear) : String(currentYear);
}

document.addEventListener("DOMContentLoaded", () => {
    loadComponents();
});

let sidebarSystemInitialized = false;

function initSidebarSystem() {
    if (sidebarSystemInitialized) return;
    sidebarSystemInitialized = true;

    const sidebar = document.getElementById("mainSidebar");
    const toggleBtn = document.getElementById("toggleSidebarBtn");
    const toggleIcon = document.getElementById("toggleIcon");
    const mobileOverlay = document.getElementById("mobileOverlay");

    if (!sidebar) return;

    function isSmallScreen() { return window.innerWidth <= 900; }

    function updateToggleIcon() {
        if (!toggleIcon) return;
        if (isSmallScreen()) {
            const isVisible = document.body.classList.contains("mobile-sidebar-visible");
            toggleIcon.className = isVisible ? "fas fa-times" : "fas fa-bars";
        }
    }

    function updateMobileOverlay() {
        if (!mobileOverlay) return;
        if (isSmallScreen() && document.body.classList.contains("mobile-sidebar-visible")) {
            mobileOverlay.style.display = "block";
        } else {
            mobileOverlay.style.display = "none";
        }
    }

    function closeMobileSidebar() {
        if (document.body.classList.contains("mobile-sidebar-visible")) {
            document.body.classList.remove("mobile-sidebar-visible");
            updateMobileOverlay();
            updateToggleIcon();
            document.body.style.overflow = "";
        }
    }

    function toggleSidebar() {
        if (!isSmallScreen()) return;
        const isVisible = document.body.classList.contains("mobile-sidebar-visible");
        if (isVisible) {
            document.body.classList.remove("mobile-sidebar-visible");
            document.body.style.overflow = "";
        } else {
            document.body.classList.add("mobile-sidebar-visible");
            document.body.style.overflow = "hidden";
        }
        updateMobileOverlay();
        updateToggleIcon();
    }

    function initSidebarState() {
        document.body.classList.remove("mobile-sidebar-visible");
        updateMobileOverlay();
        updateToggleIcon();
        document.body.style.overflow = "";
    }

    function handleEscKey(event) {
        if (event.key === "Escape") {
            closeMobileSidebar();
            closeAdminPopup();
        }
    }

    function handleTouchStart(event) {
        if (!isSmallScreen()) return;
        window._swipeStartX = event.touches[0].clientX;
        window._swipeStartY = event.touches[0].clientY;
        window._swiping = true;
    }

    function handleTouchEnd(event) {
        if (!isSmallScreen() || !window._swiping) return;
        window._swiping = false;
        const endX = event.changedTouches[0].clientX;
        const endY = event.changedTouches[0].clientY;
        const deltaX = endX - window._swipeStartX;
        const deltaY = endY - window._swipeStartY;
        if (Math.abs(deltaY) > Math.abs(deltaX) * 2) return;
        const isOpen = document.body.classList.contains("mobile-sidebar-visible");
        if (!isOpen && window._swipeStartX < 40 && deltaX > 60) {
            document.body.classList.add("mobile-sidebar-visible");
            document.body.style.overflow = "hidden";
            updateMobileOverlay();
            updateToggleIcon();
        }
        if (isOpen && deltaX < -60) {
            closeMobileSidebar();
        }
    }

    window.addEventListener("resize", initSidebarState);
    if (toggleBtn) toggleBtn.addEventListener("click", toggleSidebar);
    if (mobileOverlay) mobileOverlay.addEventListener("click", closeMobileSidebar);
    document.addEventListener("keydown", handleEscKey);
    document.addEventListener("touchstart", handleTouchStart, { passive: true });
    document.addEventListener("touchend", handleTouchEnd, { passive: true });
    initSidebarState();
}



function safeGet(id) {
    return document.getElementById(id);
}

function safeAddClickListener(id, callback, options = {}) {
    const element = safeGet(id);
    if (!element) {
        return;
    }

    element.addEventListener("click", function (event) {
        if (options.preventDefault) {
            event.preventDefault();
        }
        callback(event);
    });
}

const pageMeta = {
    "dashboard.html": { title: "Dashboard", icon: "fa-tachometer-alt" },
    "students.html": { title: "Manage Students", icon: "fa-user-graduate" },
    "results.html": { title: "Manage Results", icon: "fa-chart-bar" },
    "teachers.html": { title: "Manage Teachers", icon: "fa-chalkboard-teacher" },
    "staff.html": { title: "Manage Staffs", icon: "fa-users" },
    "notices.html": { title: "Manage Notices", icon: "fa-bullhorn" },
    "messages.html": { title: "See Messages", icon: "fa-envelope" },
    "login.html": { title: "Admin Login", icon: "fa-shield-halved" }
};

function setPageTitle() {
    const path = window.location.pathname;
    const fileName = path.substring(path.lastIndexOf("/") + 1) || "dashboard.html";
    const meta = pageMeta[fileName] || { title: "Dashboard", icon: "fa-tachometer-alt" };
    const headerTitle = safeGet("headerTitle");
    const headerIcon = safeGet("headerIcon");
    if (headerTitle) headerTitle.textContent = meta.title;
    if (headerIcon) {
        headerIcon.className = "fas " + meta.icon;
    }
}

function initHeaderHandlers() {
    setPageTitle();
}

function toggleAdminPopup() {
    const adminPopup = safeGet("adminPopup");
    if (!adminPopup) {
        return;
    }

    adminPopup.classList.toggle("show");
}

function closeAdminPopup() {
    const adminPopup = safeGet("adminPopup");
    if (adminPopup) {
        adminPopup.classList.remove("show");
    }
}

function initAdminPopup() {
    const adminProfileBtn = safeGet("adminProfileBtn");
    const adminPopup = safeGet("adminPopup");

    if (!adminProfileBtn || !adminPopup) {
        return;
    }

    adminProfileBtn.addEventListener("click", function (event) {
        event.stopPropagation();
        toggleAdminPopup();
    });

    adminPopup.addEventListener("click", function (event) {
        event.stopPropagation();
    });

    document.addEventListener("click", function () {
        closeAdminPopup();
    });
}

function initLogoutButton() {
    const popupLogoutBtn = safeGet("popupLogoutBtn");

    if (!popupLogoutBtn) {
        return;
    }

    popupLogoutBtn.addEventListener("click", async function () {
        if (typeof window.logoutAdmin === "function") {
            await window.logoutAdmin();
            return;
        }

        localStorage.removeItem("bhs_admin_auth");
        localStorage.removeItem("userLoggedIn");
        localStorage.removeItem("userInfo");

        window.location.href = "login.html";
    });
}

function loadStoredUserInfo() {
    let userInfo = {};

    try {
        userInfo = JSON.parse(localStorage.getItem("userInfo") || "{}");
    } catch (_) {
        userInfo = {};
    }

    const popupName = safeGet("popupName");
    const popupEmail = safeGet("popupEmail");
    const popupDesignation = safeGet("popupDesignation");

    if (popupName) popupName.textContent = userInfo.name || userInfo.fullName || "Admin User";
    if (popupEmail) popupEmail.textContent = userInfo.email || "admin@baralaischool.edu";
    if (popupDesignation) popupDesignation.textContent = userInfo.designation || "Administrator";
}

function changeHeader(title) {
    const headerTitle = safeGet("headerTitle");
    if (headerTitle) {
        headerTitle.textContent = title;
    }
}

/* =========================================================
   FLAT SIDEBAR ACTIVE STATE SYSTEM
   Sidebar has only main menu items. No dropdown/submenu logic.
========================================================= */
(function () {
    document.addEventListener("click", function (event) {
        const sidebarLink = event.target.closest(".sidebar-nav a[href]");
        if (!sidebarLink) return;

        closeMobileSidebarAfterNavigation();

        setTimeout(function () {
            updateSidebarActiveState();
        }, 80);
    });

    document.addEventListener("DOMContentLoaded", function () {
        setTimeout(updateSidebarActiveState, 250);
        setTimeout(updateSidebarActiveState, 700);
        setTimeout(updateSidebarActiveState, 1200);
    });

    window.addEventListener("hashchange", updateSidebarActiveState);
    window.bhsUpdateSidebarActiveState = updateSidebarActiveState;

    function updateSidebarActiveState() {
        const currentFile = getCurrentFileName();
        const currentHash = normalizeHash(window.location.hash);

        document.querySelectorAll(".sidebar-flat-link, .sidebar-nav a").forEach(function (link) {
            link.classList.remove("active");
        });

        let activeLink = null;

        if (currentHash) {
            activeLink = document.querySelector(
                '.sidebar-flat-link[data-page="' + currentFile + '"][data-hash="' + currentHash + '"]'
            );
        }

        if (!activeLink) {
            activeLink = document.querySelector(
                '.sidebar-flat-link[data-single-page="' + currentFile + '"]'
            );
        }

        if (!activeLink) {
            activeLink = document.querySelector(
                '.sidebar-flat-link[data-page="' + currentFile + '"]'
            );
        }

        if (activeLink) {
            activeLink.classList.add("active");
        }
    }

    function normalizeHash(hashValue) {
        const hash = (hashValue || "").replace("#", "");

        const hashAliases = {
            "": "dashboard",
            dashboard: "dashboard",
            performance: "performance",
            top10: "top10",
            "add-student": "add-student",
            "manage-students": "manage-students",
            "promote-class": "promote-class",
            addResult: "addResult",
            manageResults: "manageResults",
            manageSubjects: "manageSubjects",
            exportReport: "exportReport",
            teachersSection: "teachersSection",
            staffSection: "staffSection",
        };

        return hashAliases[hash] || hash;
    }

    function getCurrentFileName() {
        const path = window.location.pathname;
        return path.substring(path.lastIndexOf("/") + 1) || "dashboard.html";
    }

    function closeMobileSidebarAfterNavigation() {
        if (window.innerWidth > 900) return;

        document.body.classList.remove("mobile-sidebar-visible");
        document.body.style.overflow = "";

        const overlay = document.getElementById("mobileOverlay");
        if (overlay) overlay.style.display = "none";

        const toggleIcon = document.getElementById("toggleIcon");
        if (toggleIcon) toggleIcon.className = "fas fa-bars";
    }
})();
