/* =========================================================
   BARALAI HIGH SCHOOL - PUBLIC SUPABASE JS
   Public features:
   01. Mobile menu
   02. Homepage notices from Supabase
   03. Teachers / Staff from Supabase
   04. Published result search from Supabase
   05. localStorage fallback for offline/local testing
========================================================= */

const BHS_PUBLIC_KEYS = {
  results: "bhs_results",
  notices: "bhs_notices",
  teachers: "bhs_teachers_data",
  staff: "bhs_staff_data"
};

const BHS_FINAL_EXAM_NAME = "Final Exam";
const BHS_GENERAL_SECTION = "General";
const BHS_GROUP_CLASSES = new Set(["9", "10"]);
const BHS_GROUP_SECTIONS = ["Science", "Arts", "Commerce"];
let publicShowAllTeachers = false;
let publicShowAllStaff = false;
let homeNoticeShowAll = false;
let publicTeachers = [];
let publicStaff = [];
let homeNotices = [];
let publicResultsCache = [];
let publicResultClassCache = [];

function toggleMenu() {
  const navLinks = document.querySelector(".nav-links");
  if (navLinks) navLinks.classList.toggle("show");
}

window.toggleMenu = toggleMenu;

document.addEventListener("DOMContentLoaded", async function () {
  await initPublicHomeData();
  await initResultChecker();
});

/* =========================================================
   SUPABASE HELPERS
========================================================= */
function hasPublicSupabase() {
  return !!window.bhsSupabase;
}

async function safeSupabaseQuery(label, callback, fallbackValue) {
  if (!hasPublicSupabase()) return fallbackValue;

  try {
    const result = await callback();

    // Supports both standard Supabase responses ({ data, error }) and
    // bhsFetchAllRows() responses (plain arrays) for 1000+ row datasets.
    if (Array.isArray(result)) return result;

    if (result && result.error) {
      console.error(`${label} Supabase error:`, result.error);
      return fallbackValue;
    }
    return result?.data ?? fallbackValue;
  } catch (error) {
    console.error(`${label} failed:`, error);
    return fallbackValue;
  }
}

function readLocalArray(key) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalArray(key, value) {
  const finalValue = Array.isArray(value) ? value : [];
  if (typeof window.bhsSafeSetLocalJSON === "function") {
    window.bhsSafeSetLocalJSON(key, finalValue);
    return;
  }

  try {
    localStorage.setItem(key, JSON.stringify(finalValue));
  } catch {
    // Ignore cache errors in privacy-restricted browsers or full storage.
  }
}

/* =========================================================
   HOMEPAGE: NOTICES + TEACHERS + STAFF
========================================================= */
async function initPublicHomeData() {
  const hasHomeSections =
    document.getElementById("homeNoticeGrid") ||
    document.getElementById("publicTeachersGrid") ||
    document.getElementById("publicStaffGrid");

  if (!hasHomeSections) return;

  initHomeNoticeEvents();
  initPublicPeopleButtons();
  initPublicPeopleModal();

  renderHomeNoticeLoading();
  renderPublicPeopleLoading("publicTeachersGrid", "Loading teachers...");
  renderPublicPeopleLoading("publicStaffGrid", "Loading staff...");

  await Promise.all([
    loadPublicNotices(),
    loadPublicTeachers(),
    loadPublicStaff()
  ]);

  renderHomeNotices();
  renderPublicTeachers();
  renderPublicStaff();
}

async function loadPublicNotices() {
  const fallback = readLocalArray(BHS_PUBLIC_KEYS.notices)
    .filter((notice) => normalizeStatus(notice.status) === "published")
    .map(mapNoticeLocalToPublic);

  const rows = await safeSupabaseQuery(
    "Public notices",
    function () {
      if (typeof window.bhsFetchAllRows === "function") {
        return window.bhsFetchAllRows("notices", "id, title, category, notice_date, status, priority, is_important, description, attachment, created_at, updated_at", [
          { column: "notice_date", options: { ascending: false } },
          { column: "created_at", options: { ascending: false } }
        ], { filters: [{ column: "status", value: "published" }] });
      }
      return window.bhsSupabase
        .from("notices")
        .select("id, title, category, notice_date, status, priority, is_important, description, attachment, created_at, updated_at")
        .eq("status", "published")
        .order("notice_date", { ascending: false })
        .order("created_at", { ascending: false });
    },
    fallback
  );

  homeNotices = (rows || [])
    .map(mapNoticeFromSupabase)
    .filter((notice) => normalizeStatus(notice.status) === "published")
    .sort(sortByNewestDate);

  writeLocalArray(BHS_PUBLIC_KEYS.notices, homeNotices);
}

async function loadPublicTeachers() {
  const fallback = readLocalArray(BHS_PUBLIC_KEYS.teachers)
    .filter((teacher) => normalizePublicStatus(teacher.status) === "Active")
    .map(mapPersonLocalToPublic);

  const rows = await safeSupabaseQuery(
    "Public teachers",
    function () {
      if (typeof window.bhsFetchAllRows === "function") {
        return window.bhsFetchAllRows("teachers", "id, teacher_code, image_data_url, name, phone, email, subject, designation, qualification, joining_date, status, retired_date, address, created_at, updated_at", [
          { column: "joining_date", options: { ascending: false, nullsFirst: false } },
          { column: "created_at", options: { ascending: false } }
        ], { filters: [{ column: "status", value: "Active" }] });
      }
      return window.bhsSupabase
        .from("teachers")
        .select("id, teacher_code, image_data_url, name, phone, email, subject, designation, qualification, joining_date, status, retired_date, address, created_at, updated_at")
        .eq("status", "Active")
        .order("joining_date", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });
    },
    fallback
  );

  publicTeachers = (rows || [])
    .map(mapTeacherFromSupabase)
    .filter((teacher) => normalizePublicStatus(teacher.status) === "Active")
    .sort(sortPublicTeachers);

  writeLocalArray(BHS_PUBLIC_KEYS.teachers, publicTeachers);
}

async function loadPublicStaff() {
  const fallback = readLocalArray(BHS_PUBLIC_KEYS.staff)
    .filter((staff) => normalizePublicStatus(staff.status) === "Active")
    .map(mapPersonLocalToPublic);

  const rows = await safeSupabaseQuery(
    "Public staff",
    function () {
      if (typeof window.bhsFetchAllRows === "function") {
        return window.bhsFetchAllRows("staff", "id, staff_code, image_data_url, name, phone, email, designation, qualification, joining_date, status, retired_date, address, created_at, updated_at", [
          { column: "joining_date", options: { ascending: false, nullsFirst: false } },
          { column: "created_at", options: { ascending: false } }
        ], { filters: [{ column: "status", value: "Active" }] });
      }
      return window.bhsSupabase
        .from("staff")
        .select("id, staff_code, image_data_url, name, phone, email, designation, qualification, joining_date, status, retired_date, address, created_at, updated_at")
        .eq("status", "Active")
        .order("joining_date", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });
    },
    fallback
  );

  publicStaff = (rows || [])
    .map(mapStaffFromSupabase)
    .filter((staff) => normalizePublicStatus(staff.status) === "Active")
    .sort(sortPublicByJoiningDate);

  writeLocalArray(BHS_PUBLIC_KEYS.staff, publicStaff);
}

function renderHomeNoticeLoading() {
  const grid = document.getElementById("homeNoticeGrid");
  if (!grid) return;

  grid.innerHTML = `
    <div class="home-notice-empty">
      <i class="fas fa-spinner fa-spin"></i>
      <h3>Loading Notices...</h3>
      <p>Please wait while latest notices are loading.</p>
    </div>
  `;
}

function initHomeNoticeEvents() {
  const homeNoticeGrid = document.getElementById("homeNoticeGrid");
  const showAllBtn = document.getElementById("showAllHomeNoticesBtn");
  const closeModalBtn = document.getElementById("closeHomeNoticeModal");
  const modal = document.getElementById("homeNoticeModal");

  if (homeNoticeGrid) {
    homeNoticeGrid.addEventListener("click", function (event) {
      const card = event.target.closest(".home-notice-card");
      if (!card) return;
      openHomeNoticeModal(card.dataset.id);
    });
  }

  if (showAllBtn) {
    showAllBtn.addEventListener("click", function () {
      homeNoticeShowAll = !homeNoticeShowAll;
      renderHomeNotices();
    });
  }

  if (closeModalBtn) closeModalBtn.addEventListener("click", closeHomeNoticeModal);

  if (modal) {
    modal.addEventListener("click", function (event) {
      if (event.target === modal) closeHomeNoticeModal();
    });
  }
}

function renderHomeNotices() {
  const grid = document.getElementById("homeNoticeGrid");
  const showAllBtn = document.getElementById("showAllHomeNoticesBtn");
  if (!grid) return;

  if (!homeNotices.length) {
    grid.innerHTML = `
      <div class="home-notice-empty">
        <i class="fas fa-bullhorn"></i>
        <h3>No Notice Found</h3>
        <p>No published notice is available right now.</p>
      </div>
    `;
    if (showAllBtn) showAllBtn.style.display = "none";
    return;
  }

  const list = homeNoticeShowAll ? homeNotices : homeNotices.slice(0, 3);
  grid.innerHTML = list.map(createHomeNoticeCard).join("");

  if (showAllBtn) {
    showAllBtn.style.display = homeNotices.length > 3 ? "inline-flex" : "none";
    showAllBtn.textContent = homeNoticeShowAll ? "Show Less" : "See All Notices";
  }
}

function createHomeNoticeCard(notice) {
  return `
    <div class="home-notice-card ${notice.isImportant ? "important" : ""}" data-id="${escapeAttr(notice.id)}">
      <div>
        <i class="fas fa-bullhorn home-notice-icon"></i>
        <h3>${escapeHTML(notice.title)}</h3>
        <div class="home-notice-meta">
          <span class="home-notice-category"><i class="fas fa-folder"></i> ${escapeHTML(notice.category || "General")}</span>
          <span><i class="fas fa-calendar-alt"></i> ${escapeHTML(formatDate(notice.date))}</span>
          ${notice.isImportant ? `<span class="home-notice-important"><i class="fas fa-star"></i> Important</span>` : ""}
        </div>
        <p>${escapeHTML(limitText(notice.description, 95))}</p>
      </div>
      <div class="home-notice-read">View Full Notice <i class="fas fa-arrow-right"></i></div>
    </div>
  `;
}

function openHomeNoticeModal(id) {
  const notice = homeNotices.find((item) => String(item.id) === String(id));
  if (!notice) return;

  setText("homeModalNoticeTitle", notice.title || "Notice");
  setHTML("homeModalNoticeCategory", `<i class="fas fa-folder"></i> ${escapeHTML(notice.category || "General")}`);
  setHTML("homeModalNoticeDate", `<i class="fas fa-calendar-alt"></i> ${escapeHTML(formatDate(notice.date))}`);
  setHTML("homeModalNoticePriority", `<i class="fas fa-star"></i> ${notice.isImportant ? "Important" : "Normal"}`);
  setText("homeModalNoticeDescription", notice.description || "");

  const attachmentBox = document.getElementById("homeModalAttachmentBox");
  const attachmentLink = document.getElementById("homeModalAttachment");
  const attachment = notice.attachment || null;
  const attachmentUrl = attachment?.dataUrl || attachment?.url || attachment?.publicUrl || "";
  const attachmentName = attachment?.name || attachment?.fileName || "Attached File";

  if (attachmentBox && attachmentLink && attachmentUrl) {
    attachmentBox.classList.add("active");
    attachmentLink.href = attachmentUrl;
    attachmentLink.download = attachmentName;
    attachmentLink.innerHTML = `<i class="fas fa-paperclip"></i> ${escapeHTML(attachmentName)}`;
  } else if (attachmentBox && attachmentLink) {
    attachmentBox.classList.remove("active");
    attachmentLink.href = "#";
    attachmentLink.removeAttribute("download");
  }

  const modal = document.getElementById("homeNoticeModal");
  if (modal) modal.classList.add("active");
}

function closeHomeNoticeModal() {
  const modal = document.getElementById("homeNoticeModal");
  if (modal) modal.classList.remove("active");
}

function renderPublicPeopleLoading(gridId, message) {
  const grid = document.getElementById(gridId);
  if (!grid) return;

  grid.innerHTML = `
    <div class="public-people-empty">
      <i class="fas fa-spinner fa-spin"></i>
      <h3>${escapeHTML(message)}</h3>
      <p>Please wait while information is loading.</p>
    </div>
  `;
}

function initPublicPeopleButtons() {
  const teachersBtn = document.getElementById("showAllTeachersBtn");
  const staffBtn = document.getElementById("showAllStaffBtn");

  if (teachersBtn) {
    teachersBtn.addEventListener("click", function () {
      publicShowAllTeachers = !publicShowAllTeachers;
      renderPublicTeachers();
    });
  }

  if (staffBtn) {
    staffBtn.addEventListener("click", function () {
      publicShowAllStaff = !publicShowAllStaff;
      renderPublicStaff();
    });
  }
}

function initPublicPeopleModal() {
  const modal = document.getElementById("publicPeopleModal");
  const closeBtn = document.getElementById("closePublicPeopleModal");

  if (closeBtn) closeBtn.addEventListener("click", closePublicPeopleModal);

  if (modal) {
    modal.addEventListener("click", function (event) {
      if (event.target === modal) closePublicPeopleModal();
    });
  }
}

function renderPublicTeachers() {
  const grid = document.getElementById("publicTeachersGrid");
  const button = document.getElementById("showAllTeachersBtn");
  if (!grid) return;

  if (!publicTeachers.length) {
    grid.innerHTML = `
      <div class="public-people-empty">
        <i class="fas fa-chalkboard-teacher"></i>
        <h3>No Teacher Found</h3>
        <p>No teacher information is available right now.</p>
      </div>
    `;
    if (button) button.style.display = "none";
    return;
  }

  const visible = publicShowAllTeachers ? publicTeachers : publicTeachers.slice(0, 3);
  grid.innerHTML = visible.map(renderPublicTeacherCard).join("");
  if (button) {
    button.style.display = publicTeachers.length > 3 ? "inline-flex" : "none";
    button.textContent = publicShowAllTeachers ? "Show Less Teachers" : "See All Teachers";
  }
  bindPublicPeopleCards("publicTeachersGrid", publicTeachers, openPublicTeacherModal);
}

function renderPublicStaff() {
  const grid = document.getElementById("publicStaffGrid");
  const button = document.getElementById("showAllStaffBtn");
  if (!grid) return;

  if (!publicStaff.length) {
    grid.innerHTML = `
      <div class="public-people-empty">
        <i class="fas fa-users"></i>
        <h3>No Staff Found</h3>
        <p>No staff information is available right now.</p>
      </div>
    `;
    if (button) button.style.display = "none";
    return;
  }

  const visible = publicShowAllStaff ? publicStaff : publicStaff.slice(0, 3);
  grid.innerHTML = visible.map(renderPublicStaffCard).join("");
  if (button) {
    button.style.display = publicStaff.length > 3 ? "inline-flex" : "none";
    button.textContent = publicShowAllStaff ? "Show Less Staff" : "See All Staff";
  }
  bindPublicPeopleCards("publicStaffGrid", publicStaff, openPublicStaffModal);
}

function renderPublicTeacherCard(teacher) {
  return `
    <div class="public-people-card" data-id="${escapeAttr(teacher.id)}">
      ${renderPublicPeoplePhoto(teacher.image, teacher.name)}
      <h3>${escapeHTML(teacher.name || "No Name")}</h3>
      <div class="public-people-badges">
        <span><i class="fas fa-user-tie"></i> ${escapeHTML(teacher.designation || "Teacher")}</span>
        <span><i class="fas fa-book"></i> ${escapeHTML(teacher.subject || "Subject")}</span>
      </div>
      <div class="public-people-info">
        <p><strong>Phone:</strong> ${escapeHTML(teacher.phone || "-")}</p>
      </div>
      <div class="public-people-view">View Details <i class="fas fa-arrow-right"></i></div>
    </div>
  `;
}

function renderPublicStaffCard(staff) {
  return `
    <div class="public-people-card" data-id="${escapeAttr(staff.id)}">
      ${renderPublicPeoplePhoto(staff.image, staff.name)}
      <h3>${escapeHTML(staff.name || "No Name")}</h3>
      <div class="public-people-badges">
        <span><i class="fas fa-user-tie"></i> ${escapeHTML(staff.designation || "Staff")}</span>
        <span><i class="fas fa-briefcase"></i> Staff</span>
      </div>
      <div class="public-people-info">
        <p><strong>Phone:</strong> ${escapeHTML(staff.phone || "-")}</p>
      </div>
      <div class="public-people-view">View Details <i class="fas fa-arrow-right"></i></div>
    </div>
  `;
}

function bindPublicPeopleCards(gridId, dataList, openHandler) {
  const cards = document.querySelectorAll(`#${gridId} .public-people-card`);
  cards.forEach((card) => {
    card.addEventListener("click", function () {
      const person = dataList.find((item) => String(item.id) === String(card.dataset.id));
      if (person) openHandler(person);
    });
  });
}

function openPublicTeacherModal(teacher) {
  openPublicPeopleModal("Teacher Details", teacher, [
    ["Teacher ID", teacher.code || teacher.id || "-"],
    ["Name", teacher.name || "-"],
    ["Designation", teacher.designation || "-"],
    ["Subject", teacher.subject || "-"],
    ["Phone", teacher.phone || "-"],
    ["Email", teacher.email || "-"],
    ["Qualification", teacher.qualification || "-"],
    ["Joining Date", formatDate(teacher.joiningDate)],
    ["Address", teacher.address || "-"]
  ]);
}

function openPublicStaffModal(staff) {
  openPublicPeopleModal("Staff Details", staff, [
    ["Staff ID", staff.code || staff.id || "-"],
    ["Name", staff.name || "-"],
    ["Designation", staff.designation || "-"],
    ["Phone", staff.phone || "-"],
    ["Email", staff.email || "-"],
    ["Qualification", staff.qualification || "-"],
    ["Joining Date", formatDate(staff.joiningDate)],
    ["Address", staff.address || "-"]
  ]);
}

function openPublicPeopleModal(title, person, details) {
  const modal = document.getElementById("publicPeopleModal");
  const titleEl = document.getElementById("publicPeopleModalTitle");
  const body = document.getElementById("publicPeopleModalBody");
  if (!modal || !body) return;

  if (titleEl) titleEl.textContent = title;

  body.innerHTML = `
    <div class="public-people-modal-profile">
      ${renderPublicPeoplePhoto(person.image, person.name)}
      <h4>${escapeHTML(person.name || "No Name")}</h4>
      <p>${escapeHTML(person.designation || "")}</p>
    </div>
    <div class="public-people-details">
      ${details
        .map(([label, value]) => `
          <div class="public-people-detail-row">
            <span>${escapeHTML(label)}</span>
            <strong>${escapeHTML(value || "-")}</strong>
          </div>
        `)
        .join("")}
    </div>
  `;

  modal.classList.add("show");
}

function closePublicPeopleModal() {
  const modal = document.getElementById("publicPeopleModal");
  if (modal) modal.classList.remove("show");
}

function renderPublicPeoplePhoto(image, name) {
  if (image) {
    return `<img class="public-people-photo" src="${escapeAttr(image)}" alt="${escapeAttr(name || "Person")}" />`;
  }
  return `<div class="public-people-placeholder">${escapeHTML(getInitial(name))}</div>`;
}

/* =========================================================
   RESULT CHECKER
========================================================= */
async function initResultChecker() {
  const resultYear = document.getElementById("resultYear");
  const resultClass = document.getElementById("resultClass");
  const resultSection = document.getElementById("resultSection");
  const rollNumber = document.getElementById("rollNumber");

  if (!resultYear || !resultClass) return;

  await loadPublicResultYears();
  await loadPublicResultClasses();
  updatePublicSectionVisibility();

  resultYear.addEventListener("change", async function () {
    clearResultView();
    await loadPublicResultClasses();
    await loadPublicResultSections();
  });

  resultClass.addEventListener("change", async function () {
    clearResultView();
    await loadPublicResultSections();
  });

  resultSection?.addEventListener("change", clearResultView);

  if (rollNumber) {
    rollNumber.addEventListener("keydown", function (event) {
      if (event.key === "Enter") searchResult();
    });
  }
}

async function loadPublicResultYears() {
  const resultYear = document.getElementById("resultYear");
  if (!resultYear) return;

  resultYear.innerHTML = `<option value="">Loading years...</option>`;

  const fallback = readLocalArray(BHS_PUBLIC_KEYS.results)
    .filter(isPublishedResult)
    .map(mapResultLocalToPublic);

  const rows = await safeSupabaseQuery(
    "Public result years",
    function () {
      if (typeof window.bhsFetchAllRows === "function") {
        return window.bhsFetchAllRows("results", "academic_year", [
          { column: "academic_year", options: { ascending: false } }
        ], {
          filters: [
            { column: "publish_status", value: "published" },
            { column: "is_published", value: true }
          ]
        });
      }
      return window.bhsSupabase
        .from("results")
        .select("academic_year")
        .eq("publish_status", "published")
        .eq("is_published", true)
        .order("academic_year", { ascending: false });
    },
    fallback.map((item) => ({ academic_year: item.year }))
  );

  const years = uniqueStrings((rows || []).map((row) => row.academic_year || row.year)).sort((a, b) => Number(b) - Number(a));

  resultYear.innerHTML = `<option value="">Select Year</option>`;

  if (!years.length) {
    const currentYear = String(new Date().getFullYear());
    resultYear.innerHTML += `<option value="${currentYear}">Exam Year ${currentYear}</option>`;
    return;
  }

  years.forEach((year) => {
    resultYear.innerHTML += `<option value="${escapeAttr(year)}">Exam Year ${escapeHTML(year)}</option>`;
  });
}

async function loadPublicResultClasses() {
  const resultClass = document.getElementById("resultClass");
  const selectedYear = document.getElementById("resultYear")?.value || "";
  if (!resultClass) return;

  resultClass.innerHTML = `<option value="">Loading classes...</option>`;
  publicResultClassCache = [];

  if (!selectedYear) {
    resultClass.innerHTML = `<option value="">Select Class</option>`;
    return;
  }

  const fallback = readLocalArray(BHS_PUBLIC_KEYS.results)
    .map(mapResultLocalToPublic)
    .filter((result) => isPublishedResult(result) && String(result.year) === String(selectedYear));

  const rows = await safeSupabaseQuery(
    "Public result classes",
    function () {
      if (typeof window.bhsFetchAllRows === "function") {
        return window.bhsFetchAllRows("results", "id, student_id, name_snapshot, roll_snapshot, class_name, section_name, academic_year, exam_name, subjects, marks, subject_grades, total_marks, average, gpa, total_point, ranking_score, final_grade, completed_subjects, total_subjects, publish_status, is_published, published_at, created_at, updated_at", [
          { column: "class_name", options: { ascending: true } },
          { column: "roll_snapshot", options: { ascending: true } }
        ], {
          filters: [
            { column: "academic_year", value: selectedYear },
            { column: "publish_status", value: "published" },
            { column: "is_published", value: true }
          ]
        });
      }
      return window.bhsSupabase
        .from("results")
        .select("id, student_id, name_snapshot, roll_snapshot, class_name, section_name, academic_year, exam_name, subjects, marks, subject_grades, total_marks, average, gpa, total_point, ranking_score, final_grade, completed_subjects, total_subjects, publish_status, is_published, published_at, created_at, updated_at")
        .eq("academic_year", selectedYear)
        .eq("publish_status", "published")
        .eq("is_published", true)
        .order("class_name", { ascending: true })
        .order("roll_snapshot", { ascending: true });
    },
    fallback
  );

  publicResultClassCache = (rows || []).map(mapResultFromSupabase).filter(isPublishedResult);
  writeLocalArray(BHS_PUBLIC_KEYS.results, publicResultClassCache);

  const classes = uniqueStrings(publicResultClassCache.map((result) => result.className)).sort((a, b) => Number(a) - Number(b));

  resultClass.innerHTML = `<option value="">Select Class</option>`;
  classes.forEach((className) => {
    resultClass.innerHTML += `<option value="${escapeAttr(className)}">Class ${escapeHTML(className)}</option>`;
  });
}

async function loadPublicResultSections() {
  const resultSection = document.getElementById("resultSection");
  const selectedYear = document.getElementById("resultYear")?.value || "";
  const selectedClass = document.getElementById("resultClass")?.value || "";
  updatePublicSectionVisibility();
  if (!resultSection || !isPublicGroupClass(selectedClass)) return;

  const classResults = publicResultClassCache.filter((result) => {
    return isPublishedResult(result) && String(result.year) === String(selectedYear) && String(result.className) === String(selectedClass);
  });
  const sections = uniqueStrings(classResults.map((result) => normalizePublicSection(selectedClass, result.sectionName))).filter(Boolean);
  const finalSections = sections.length ? sections : BHS_GROUP_SECTIONS;
  resultSection.innerHTML = `<option value="">Select Group / Section</option>`;
  finalSections.forEach((section) => {
    resultSection.innerHTML += `<option value="${escapeAttr(section)}">${escapeHTML(getPublicSectionLabel(section))}</option>`;
  });
}

function updatePublicSectionVisibility() {
  const group = document.getElementById("resultSectionPublicGroup");
  const select = document.getElementById("resultSection");
  const className = document.getElementById("resultClass")?.value || "";
  const show = isPublicGroupClass(className);
  if (group) {
    group.hidden = !show;
    group.style.display = show ? "" : "none";
  }
  if (select && !show) select.value = "";
}

async function searchResult() {
  const year = document.getElementById("resultYear")?.value || "";
  const className = document.getElementById("resultClass")?.value || "";
  const sectionName = normalizePublicSection(className, document.getElementById("resultSection")?.value || "");
  const roll = document.getElementById("rollNumber")?.value.trim() || "";

  clearResultView();

  if (!year || !className || !roll) {
    showResultError("Please select exam year, class and enter roll number.");
    return;
  }

  if (isPublicGroupClass(className) && !sectionName) {
    showResultError("Please select group/section for Class 9 or Class 10.");
    return;
  }

  showPublicLoader();

  try {
    const classResults = await fetchPublishedClassResults(year, className, sectionName);
    const matchedResult = classResults.find((result) => {
      const rollMatches = normalizeRoll(result.roll) === normalizeRoll(roll);
      if (!isPublicGroupClass(className)) return rollMatches;
      return rollMatches && normalizePublicSection(className, result.sectionName) === sectionName;
    });

    if (!matchedResult) {
      showResultError("No published result found. Please check year, class and roll number.");
      return;
    }

    if (!getResultSubjects(matchedResult).length) {
      showResultError("Result found, but subject marks are missing. Please contact school authority.");
      return;
    }

    const rank = getStudentRank(matchedResult, classResults);
    const resultDisplay = document.getElementById("resultDisplay");
    if (resultDisplay) resultDisplay.innerHTML = renderStudentResult(matchedResult, rank);
  } catch (error) {
    console.error("Public result search error:", error);
    showResultError("Something went wrong while loading result. Please try again.");
  } finally {
    hidePublicLoader();
  }
}

window.searchResult = searchResult;

async function fetchPublishedClassResults(year, className, sectionName = "") {
  const fallback = readLocalArray(BHS_PUBLIC_KEYS.results)
    .map(mapResultLocalToPublic)
    .filter((result) => {
      return isPublishedResult(result) &&
        String(result.year) === String(year) &&
        String(result.className) === String(className) &&
        (!sectionName || normalizePublicSection(className, result.sectionName) === sectionName);
    });

  const rows = await safeSupabaseQuery(
    "Published class results",
    function () {
      if (typeof window.bhsFetchAllRows === "function") {
        return window.bhsFetchAllRows("results", "id, student_id, name_snapshot, roll_snapshot, class_name, section_name, academic_year, exam_name, subjects, marks, subject_grades, total_marks, average, gpa, total_point, ranking_score, final_grade, completed_subjects, total_subjects, publish_status, is_published, published_at, created_at, updated_at", [
          { column: "section_name", options: { ascending: true } },
          { column: "roll_snapshot", options: { ascending: true } }
        ], {
          filters: [
            { column: "academic_year", value: year },
            { column: "class_name", value: className },
            { column: "exam_name", value: BHS_FINAL_EXAM_NAME },
            { column: "publish_status", value: "published" },
            { column: "is_published", value: true }
          ]
        });
      }
      return window.bhsSupabase
        .from("results")
        .select("id, student_id, name_snapshot, roll_snapshot, class_name, section_name, academic_year, exam_name, subjects, marks, subject_grades, total_marks, average, gpa, total_point, ranking_score, final_grade, completed_subjects, total_subjects, publish_status, is_published, published_at, created_at, updated_at")
        .eq("academic_year", year)
        .eq("class_name", className)
        .eq("exam_name", BHS_FINAL_EXAM_NAME)
        .eq("publish_status", "published")
        .eq("is_published", true)
        .order("section_name", { ascending: true })
        .order("roll_snapshot", { ascending: true });
    },
    fallback
  );

  const results = (rows || []).map(mapResultFromSupabase).filter((result) => {
    return isPublishedResult(result) && (!sectionName || normalizePublicSection(className, result.sectionName) === sectionName);
  });
  publicResultsCache = results;
  writeLocalArray(BHS_PUBLIC_KEYS.results, results);
  return results;
}

function getStudentRank(targetResult, classResults) {
  const sorted = [...(classResults || [])]
    .filter(isPublishedResult)
    .sort(sortResultsForRank);

  let currentRank = 0;
  let previousScore = null;
  let previousTotal = null;

  for (let index = 0; index < sorted.length; index += 1) {
    const item = sorted[index];
    const score = Number(getRankingScore(item));
    const total = Number(getTotalMarks(item));
    const samePosition = previousScore === score && previousTotal === total;
    if (!samePosition) currentRank = index + 1;
    if (String(item.id) === String(targetResult.id)) return currentRank;
    previousScore = score;
    previousTotal = total;
  }

  return "-";
}

function sortResultsForRank(a, b) {
  const scoreDiff = Number(getRankingScore(b)) - Number(getRankingScore(a));
  if (scoreDiff !== 0) return scoreDiff;

  const markDiff = Number(getTotalMarks(b)) - Number(getTotalMarks(a));
  if (markDiff !== 0) return markDiff;

  return getRollNumber(a.roll) - getRollNumber(b.roll);
}

function renderStudentResult(result, rank) {
  const subjects = getResultSubjects(result);
  const totalMarks = getTotalMarks(result);
  const maxMarks = subjects.length * 100;
  const percentage = maxMarks ? ((totalMarks / maxMarks) * 100).toFixed(2) : "0.00";
  const totalPoint = getTotalPoint(result);
  const gpa = formatGpa(result.gpa);
  const grade = result.finalGrade || getFinalGradeFromGpa(gpa);
  const publishedDate = result.publishedAt ? formatDate(result.publishedAt) : "Published";
  const rankDisplay = rank && rank !== "-" ? `#${rank}` : "—";

  const subjectDetails = subjects.map((subject) => {
    const mark = normalizeSubjectMark(result.marks?.[subject]);
    const gradeInfo = getSubjectGradeInfo(mark.total);
    const point = hasValue(mark.point) ? Number(mark.point).toFixed(2) : gradeInfo.point;
    const subjectGrade = mark.grade || result.subjectGrades?.[subject]?.grade || gradeInfo.grade;

    return {
      name: subject,
      mcq: displayPart(mark.mcq),
      written: displayPart(mark.written),
      practical: displayPart(mark.practical),
      total: displayPart(mark.total),
      point,
      grade: subjectGrade
    };
  });

  window.activePublicResultData = {
    id: result.id,
    name: result.name || "Student",
    roll: result.roll || "-",
    className: result.className || "-",
    sectionName: result.sectionName || BHS_GENERAL_SECTION,
    year: result.year || "-",
    examName: result.examName || BHS_FINAL_EXAM_NAME,
    status: "Published",
    publishedDate,
    rank: rankDisplay,
    totalMarks,
    maxMarks,
    percentage,
    totalPoint,
    gpa,
    finalGrade: grade,
    rankingScore: formatGpa(getRankingScore(result)),
    subjects: subjectDetails
  };

  const rows = subjectDetails.map((subject) => {
    return `
      <tr>
        <td style="font-weight:700;">${escapeHTML(subject.name)}</td>
        <td>${escapeHTML(subject.mcq)}</td>
        <td>${escapeHTML(subject.written)}</td>
        <td>${escapeHTML(subject.practical)}</td>
        <td><strong>${escapeHTML(subject.total)}</strong> / 100</td>
        <td>${escapeHTML(subject.point)}</td>
        <td><span class="grade-badge">${escapeHTML(subject.grade)}</span></td>
      </tr>
    `;
  }).join("");

  return `
    <div class="result-card" id="activeResultCard" style="display:block;">
      <div class="student-header">
        <div class="student-info">
          <h3>${escapeHTML(result.name)}</h3>
          <p>
            <i class="fas fa-id-card"></i> Roll: <strong>${escapeHTML(result.roll)}</strong><br>
            <i class="fas fa-graduation-cap"></i> Class: <strong>${escapeHTML(result.className)}</strong><br>
            ${isPublicGroupClass(result.className) ? `<i class="fas fa-layer-group"></i> Group: <strong>${escapeHTML(getPublicSectionLabel(result.sectionName))}</strong><br>` : ""}
            <i class="fas fa-calendar-days"></i> Year: <strong>${escapeHTML(result.year)}</strong><br>
            <i class="fas fa-circle-check"></i> Status: <strong>Published</strong><br>
            <i class="fas fa-clock"></i> Published: <strong>${escapeHTML(publishedDate)}</strong>
          </p>
        </div>
        <div class="rank-pill">
          <i class="fas fa-trophy"></i> ${escapeHTML(rankDisplay)}
          <span>Ranking Score + Total Marks</span>
        </div>
      </div>

      <div class="marks-table-wrapper">
        <table class="marks-table">
          <thead>
            <tr>
              <th>Subject</th>
              <th>MCQ</th>
              <th>Written</th>
              <th>Practical</th>
              <th>Total</th>
              <th>Point</th>
              <th>Grade</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>

      <div class="summary-stats">
        <div class="stat-item"><div class="stat-label">Total Marks</div><div class="stat-value">${escapeHTML(totalMarks)} / ${escapeHTML(maxMarks)}</div></div>
        <div class="stat-item"><div class="stat-label">Percentage</div><div class="stat-value">${escapeHTML(percentage)}%</div></div>
        <div class="stat-item"><div class="stat-label">Total Point</div><div class="stat-value">${escapeHTML(totalPoint)}</div></div>
        <div class="stat-item"><div class="stat-label">GPA</div><div class="stat-value">${escapeHTML(gpa)}</div></div>
        <div class="stat-item"><div class="stat-label">Grade</div><div class="stat-value">${escapeHTML(grade)}</div></div>
        <div class="stat-item"><div class="stat-label">Rank</div><div class="stat-value">${escapeHTML(rankDisplay)}</div></div>
      </div>

      <div class="action-buttons public-result-actions">
        <button type="button" class="btn-pdf" onclick="downloadPublicResultPDF()">
          <i class="fas fa-file-pdf"></i> Download Resultsheet
        </button>
        <button type="button" class="btn-print" onclick="printPublicResult()">
          <i class="fas fa-print"></i> Print Result
        </button>
      </div>
    </div>
  `;
}

/* =========================================================
   MAPPERS
========================================================= */
function mapNoticeFromSupabase(row) {
  if (!row) return mapNoticeLocalToPublic({});
  return {
    id: row.id,
    title: row.title || "Untitled Notice",
    category: row.category || "General",
    date: row.notice_date || row.date || row.created_at,
    status: row.status || "published",
    priority: row.priority || "normal",
    isImportant: row.is_important === true || row.isImportant === true || row.priority === "important",
    description: row.description || "",
    attachment: row.attachment || null,
    createdAt: row.created_at || row.createdAt,
    updatedAt: row.updated_at || row.updatedAt
  };
}

function mapNoticeLocalToPublic(row) {
  return {
    id: row.id,
    title: row.title || "Untitled Notice",
    category: row.category || "General",
    date: row.notice_date || row.date || row.createdAt,
    status: row.status || "published",
    priority: row.priority || "normal",
    isImportant: row.is_important === true || row.isImportant === true || row.priority === "important",
    description: row.description || "",
    attachment: row.attachment || null,
    createdAt: row.created_at || row.createdAt,
    updatedAt: row.updated_at || row.updatedAt
  };
}

function mapTeacherFromSupabase(row) {
  return {
    id: row.id,
    code: row.teacher_code || row.id,
    image: row.image_data_url || row.image || "",
    name: row.name || "",
    phone: row.phone || "",
    email: row.email || "",
    subject: row.subject || "",
    designation: row.designation || "Teacher",
    qualification: row.qualification || "",
    joiningDate: row.joining_date || row.joiningDate || "",
    status: row.status || "Active",
    retiredDate: row.retired_date || "",
    address: row.address || "",
    createdAt: row.created_at || row.createdAt,
    updatedAt: row.updated_at || row.updatedAt
  };
}

function mapStaffFromSupabase(row) {
  return {
    id: row.id,
    code: row.staff_code || row.id,
    image: row.image_data_url || row.image || "",
    name: row.name || "",
    phone: row.phone || "",
    email: row.email || "",
    designation: row.designation || "Staff",
    qualification: row.qualification || "",
    joiningDate: row.joining_date || row.joiningDate || "",
    status: row.status || "Active",
    retiredDate: row.retired_date || "",
    address: row.address || "",
    createdAt: row.created_at || row.createdAt,
    updatedAt: row.updated_at || row.updatedAt
  };
}

function mapPersonLocalToPublic(row) {
  return {
    id: row.id,
    code: row.teacher_code || row.staff_code || row.code || row.id,
    image: row.image_data_url || row.image || "",
    name: row.name || "",
    phone: row.phone || "",
    email: row.email || "",
    subject: row.subject || "",
    designation: row.designation || "",
    qualification: row.qualification || "",
    joiningDate: row.joining_date || row.joiningDate || "",
    status: row.status || "Active",
    retiredDate: row.retired_date || row.retiredDate || "",
    address: row.address || "",
    createdAt: row.created_at || row.createdAt,
    updatedAt: row.updated_at || row.updatedAt
  };
}

function mapResultFromSupabase(row) {
  if (!row) return mapResultLocalToPublic({});
  if (row.name && row.className) return mapResultLocalToPublic(row);

  return {
    id: row.id,
    studentId: row.student_id,
    name: row.name_snapshot || row.name || "Student",
    roll: row.roll_snapshot || row.roll || "",
    className: row.class_name || row.className || "",
    sectionName: row.section_name || row.sectionName || BHS_GENERAL_SECTION,
    year: row.academic_year || row.year || "",
    examName: row.exam_name || row.examName || BHS_FINAL_EXAM_NAME,
    subjects: Array.isArray(row.subjects) ? row.subjects : [],
    marks: row.marks && typeof row.marks === "object" ? row.marks : {},
    subjectGrades: row.subject_grades && typeof row.subject_grades === "object" ? row.subject_grades : {},
    totalMarks: Number(row.total_marks ?? row.totalMarks ?? 0),
    average: Number(row.average || 0),
    gpa: formatGpa(row.gpa || 0),
    totalPoint: Number(row.total_point ?? row.totalPoint ?? 0),
    rankingScore: Number(row.ranking_score ?? row.rankingScore ?? row.gpa ?? 0),
    finalGrade: row.final_grade || row.finalGrade || "",
    completedSubjects: Number(row.completed_subjects ?? row.completedSubjects ?? 0),
    totalSubjects: Number(row.total_subjects ?? row.totalSubjects ?? 0),
    publishStatus: row.publish_status || row.publishStatus || "draft",
    isPublished: row.is_published === true || row.isPublished === true,
    publishedAt: row.published_at || row.publishedAt,
    createdAt: row.created_at || row.createdAt,
    updatedAt: row.updated_at || row.updatedAt
  };
}

function mapResultLocalToPublic(row) {
  return {
    id: row.id,
    studentId: row.student_id || row.studentId,
    name: row.name_snapshot || row.name || "Student",
    roll: row.roll_snapshot || row.roll || "",
    className: row.class_name || row.className || "",
    sectionName: row.section_name || row.sectionName || BHS_GENERAL_SECTION,
    year: row.academic_year || row.year || "",
    examName: row.exam_name || row.examName || BHS_FINAL_EXAM_NAME,
    subjects: Array.isArray(row.subjects) ? row.subjects : [],
    marks: row.marks && typeof row.marks === "object" ? row.marks : {},
    subjectGrades: row.subject_grades || row.subjectGrades || {},
    totalMarks: Number(row.total_marks ?? row.totalMarks ?? 0),
    average: Number(row.average || 0),
    gpa: formatGpa(row.gpa || 0),
    totalPoint: Number(row.total_point ?? row.totalPoint ?? 0),
    rankingScore: Number(row.ranking_score ?? row.rankingScore ?? row.gpa ?? 0),
    finalGrade: row.final_grade || row.finalGrade || "",
    completedSubjects: Number(row.completed_subjects ?? row.completedSubjects ?? 0),
    totalSubjects: Number(row.total_subjects ?? row.totalSubjects ?? 0),
    publishStatus: row.publish_status || row.publishStatus || "draft",
    isPublished: row.is_published === true || row.isPublished === true,
    publishedAt: row.published_at || row.publishedAt,
    createdAt: row.created_at || row.createdAt,
    updatedAt: row.updated_at || row.updatedAt
  };
}

/* =========================================================
   PUBLIC SECTION HELPERS
========================================================= */
function isPublicGroupClass(className) {
  return BHS_GROUP_CLASSES.has(String(className));
}

function normalizePublicSection(className, sectionName = "") {
  if (!isPublicGroupClass(className)) return BHS_GENERAL_SECTION;
  const value = String(sectionName || "").trim();
  if (/^(science|sci)$/i.test(value)) return "Science";
  if (/^(arts|humanities|humanity)$/i.test(value)) return "Arts";
  if (/^(commerce|business|business studies)$/i.test(value)) return "Commerce";
  return BHS_GROUP_SECTIONS.includes(value) ? value : "";
}

function getPublicSectionLabel(sectionName) {
  if (sectionName === "Arts") return "Arts / Humanities";
  if (sectionName === "Commerce") return "Commerce / Business Studies";
  return sectionName || BHS_GENERAL_SECTION;
}

/* =========================================================
   RESULT CALC HELPERS
========================================================= */
function isPublishedResult(result) {
  return result?.publishStatus === "published" || result?.publish_status === "published" || result?.isPublished === true || result?.is_published === true;
}

function getResultSubjects(result) {
  if (Array.isArray(result?.subjects) && result.subjects.length) return result.subjects;
  if (result?.marks && typeof result.marks === "object") return Object.keys(result.marks);
  return [];
}

function normalizeSubjectMark(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const mcq = hasValue(value.mcq) ? Number(value.mcq) : "";
    const written = hasValue(value.written) ? Number(value.written) : "";
    const practical = hasValue(value.practical) ? Number(value.practical) : 0;
    const total = hasValue(value.total)
      ? Number(value.total)
      : Number((Number(mcq || 0) + Number(written || 0) + Number(practical || 0)).toFixed(2));
    const gradeInfo = getSubjectGradeInfo(total);
    return {
      mcq,
      written,
      practical,
      total,
      point: hasValue(value.point) ? Number(value.point) : Number(gradeInfo.point),
      grade: value.grade || gradeInfo.grade
    };
  }

  if (hasValue(value) && !Number.isNaN(Number(value))) {
    const total = Number(value);
    const gradeInfo = getSubjectGradeInfo(total);
    return { mcq: "", written: total, practical: 0, total, point: Number(gradeInfo.point), grade: gradeInfo.grade };
  }

  return { mcq: "", written: "", practical: "", total: "", point: "", grade: "" };
}

function getSubjectGradeInfo(total) {
  const mark = Number(total || 0);
  if (mark >= 80) return { grade: "A+", point: "5.00" };
  if (mark >= 70) return { grade: "A", point: "4.00" };
  if (mark >= 60) return { grade: "A-", point: "3.50" };
  if (mark >= 50) return { grade: "B", point: "3.00" };
  if (mark >= 40) return { grade: "C", point: "2.00" };
  if (mark >= 33) return { grade: "D", point: "1.00" };
  return { grade: "F", point: "0.00" };
}

function getFinalGradeFromGpa(gpaValue) {
  const gpa = Number(gpaValue || 0);
  if (gpa >= 5) return "A+";
  if (gpa >= 4) return "A";
  if (gpa >= 3.5) return "A-";
  if (gpa >= 3) return "B";
  if (gpa >= 2) return "C";
  if (gpa >= 1) return "D";
  return "F";
}

function getTotalMarks(result) {
  if (hasValue(result?.totalMarks)) return Number(result.totalMarks);
  return getResultSubjects(result).reduce((sum, subject) => sum + Number(normalizeSubjectMark(result.marks?.[subject]).total || 0), 0);
}

function getTotalPoint(result) {
  if (hasValue(result?.totalPoint)) return Number(result.totalPoint).toFixed(2);
  const total = getResultSubjects(result).reduce((sum, subject) => sum + Number(normalizeSubjectMark(result.marks?.[subject]).point || 0), 0);
  return Number(total).toFixed(2);
}

function getRankingScore(result) {
  return Number(result?.rankingScore ?? result?.ranking_score ?? result?.gpa ?? 0);
}

function displayPart(value) {
  return hasValue(value) ? escapeHTML(formatNumber(value)) : "-";
}


/* =========================================================
   PUBLIC RESULT DOWNLOAD / PRINT
========================================================= */
function buildPrintableResultHTML() {
  const data = window.activePublicResultData;
  if (!data) return "";

  const rows = (data.subjects || []).map((subject) => {
    return `
      <tr>
        <td>${escapeHTML(subject.name)}</td>
        <td>${escapeHTML(subject.mcq)}</td>
        <td>${escapeHTML(subject.written)}</td>
        <td>${escapeHTML(subject.practical)}</td>
        <td>${escapeHTML(subject.total)}</td>
        <td>${escapeHTML(subject.point)}</td>
        <td>${escapeHTML(subject.grade)}</td>
      </tr>
    `;
  }).join("");

  return `
    <div class="print-result-sheet">
      <div class="print-header">
        <h1>Baralai High School</h1>
        <h3>Official Student Result Sheet</h3>
        <p>Computer generated published result</p>
      </div>

      <div class="print-info">
        <p><strong>Student Name:</strong> ${escapeHTML(data.name)}</p>
        <p><strong>Roll:</strong> ${escapeHTML(data.roll)}</p>
        <p><strong>Class:</strong> ${escapeHTML(data.className)}</p>
        <p><strong>Group/Section:</strong> ${escapeHTML(data.sectionName || BHS_GENERAL_SECTION)}</p>
        <p><strong>Exam Year:</strong> ${escapeHTML(data.year)}</p>
        <p><strong>Exam:</strong> ${escapeHTML(data.examName)}</p>
        <p><strong>Rank:</strong> ${escapeHTML(data.rank)}</p>
        <p><strong>Status:</strong> ${escapeHTML(data.status)}</p>
        <p><strong>Published:</strong> ${escapeHTML(data.publishedDate)}</p>
      </div>

      <table class="print-table">
        <thead>
          <tr>
            <th>Subject</th>
            <th>MCQ</th>
            <th>Written</th>
            <th>Practical</th>
            <th>Total</th>
            <th>Point</th>
            <th>Grade</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>

      <div class="print-summary">
        <div><strong>Total Marks</strong><br>${escapeHTML(data.totalMarks)} / ${escapeHTML(data.maxMarks)}</div>
        <div><strong>Percentage</strong><br>${escapeHTML(data.percentage)}%</div>
        <div><strong>Total Point</strong><br>${escapeHTML(data.totalPoint)}</div>
        <div><strong>GPA</strong><br>${escapeHTML(data.gpa)}</div>
        <div><strong>Grade</strong><br>${escapeHTML(data.finalGrade)}</div>
        <div><strong>Rank</strong><br>${escapeHTML(data.rank)}</div>
      </div>

      <div class="print-signature-row">
        <div>Class Teacher</div>
        <div>Exam Controller</div>
        <div>Headmaster</div>
      </div>

      <div class="print-footer">
        <p>© Baralai High School - Official Result | This is a computer-generated result sheet.</p>
      </div>
    </div>
  `;
}

function getPrintableResultStyles() {
  return `
    .print-result-sheet { width: 760px; background: #fff; padding: 24px; font-family: Segoe UI, Arial, sans-serif; color: #1f2937; }
    .print-header { text-align: center; border-bottom: 3px solid #1e3c72; margin-bottom: 18px; padding-bottom: 14px; }
    .print-header h1 { color: #1e3c72; margin: 0 0 6px; font-size: 30px; }
    .print-header h3 { color: #2a5298; margin: 0 0 6px; }
    .print-header p { margin: 0; color: #64748b; }
    .print-info { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px 18px; background: #f0f4fa; padding: 14px; border-radius: 10px; margin-bottom: 18px; }
    .print-info p { margin: 0; font-size: 14px; }
    .print-table { width: 100%; border-collapse: collapse; margin-bottom: 18px; }
    .print-table th { background: #1e3c72; color: #fff; padding: 10px; border: 1px solid #2a5298; text-align: left; }
    .print-table td { border: 1px solid #cbd5e1; padding: 10px; }
    .print-table th:not(:first-child), .print-table td:not(:first-child) { text-align: center; }
    .print-summary { background: #eef2ff; padding: 14px; border-radius: 10px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 26px; }
    .print-summary div { text-align: center; font-size: 13px; }
    .print-signature-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 28px; margin: 42px 0 20px; }
    .print-signature-row div { border-top: 1px solid #334155; padding-top: 8px; text-align: center; font-size: 12px; color: #334155; }
    .print-footer { text-align: center; border-top: 1px solid #e5e7eb; padding-top: 10px; font-size: 11px; color: #64748b; }
  `;
}

async function downloadPublicResultPDF() {
  if (!window.activePublicResultData) {
    alert("No result loaded. Please search for a result first.");
    return;
  }

  if (!window.html2canvas || !window.jspdf) {
    alert("PDF library is not loaded. Please check your internet connection and try again.");
    return;
  }

  const loader = document.getElementById("loadingSpinner");
  let container = document.getElementById("pdfExportContainer");

  if (!container) {
    container = document.createElement("div");
    container.id = "pdfExportContainer";
    document.body.appendChild(container);
  }

  if (loader) {
    loader.style.display = "block";
    loader.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating PDF, please wait...';
  }

  try {
    container.innerHTML = `
      <style>${getPrintableResultStyles()}</style>
      ${buildPrintableResultHTML()}
    `;
    container.style.left = "0";
    container.style.top = "0";
    container.style.zIndex = "9999";
    container.style.position = "fixed";

    await new Promise((resolve) => setTimeout(resolve, 250));

    const element = container.querySelector(".print-result-sheet");
    const canvas = await html2canvas(element, {
      scale: 2,
      backgroundColor: "#ffffff",
      logging: false,
      useCORS: true
    });

    const imgData = canvas.toDataURL("image/png");
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    if (imgHeight <= pageHeight) {
      pdf.addImage(imgData, "PNG", 0, 0, imgWidth, imgHeight);
    } else {
      let position = 0;
      let heightLeft = imgHeight;
      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
      while (heightLeft > 0) {
        position -= pageHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }
    }

    const fileName = `Baralai_High_School_Result_Class_${safeFileName(window.activePublicResultData.className)}_Roll_${safeFileName(window.activePublicResultData.roll)}.pdf`;
    pdf.save(fileName);
  } catch (error) {
    console.error("PDF generation error:", error);
    alert("PDF generation failed. Please try the Print option instead.");
  } finally {
    container.innerHTML = "";
    container.style.left = "-9999px";
    container.style.zIndex = "-1";

    if (loader) {
      loader.style.display = "none";
      loader.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Fetching your result...';
    }
  }
}

function printPublicResult() {
  if (!window.activePublicResultData) {
    alert("No result loaded. Please search for a result first.");
    return;
  }

  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    alert("Popup blocked. Please allow popups and try again.");
    return;
  }

  printWindow.document.write(`
    <!doctype html>
    <html>
      <head>
        <meta charset="UTF-8" />
        <title>Baralai High School - Result Sheet</title>
        <style>
          body { margin: 0; padding: 28px; font-family: Segoe UI, Arial, sans-serif; color: #1f2937; background: #fff; }
          ${getPrintableResultStyles()}
          .print-result-sheet { max-width: 850px; width: auto; margin: 0 auto; }
          @media print { body { padding: 18px; } }
        </style>
      </head>
      <body>
        ${buildPrintableResultHTML()}
        <script>window.onload = function () { window.print(); };<\/script>
      </body>
    </html>
  `);

  printWindow.document.close();
}

function safeFileName(value) {
  return String(value || "result").replace(/[^a-z0-9_-]+/gi, "_").replace(/^_+|_+$/g, "");
}

window.downloadPublicResultPDF = downloadPublicResultPDF;
window.printPublicResult = printPublicResult;

/* =========================================================
   GENERAL HELPERS
========================================================= */
function clearResultView() {
  window.activePublicResultData = null;
  hidePublicLoader();
  const errorMessage = document.getElementById("errorMessage");
  const resultDisplay = document.getElementById("resultDisplay");
  if (errorMessage) {
    errorMessage.textContent = "";
    errorMessage.style.display = "none";
  }
  if (resultDisplay) resultDisplay.innerHTML = "";
}

function showPublicLoader() {
  const loader = document.getElementById("loadingSpinner");
  if (loader) loader.style.display = "block";
}

function hidePublicLoader() {
  const loader = document.getElementById("loadingSpinner");
  if (loader) loader.style.display = "none";
}

function showResultError(message) {
  hidePublicLoader();
  const errorMessage = document.getElementById("errorMessage");
  if (errorMessage) {
    errorMessage.textContent = message;
    errorMessage.style.display = "block";
  }
}

function sortByNewestDate(a, b) {
  return new Date(b.updatedAt || b.createdAt || b.date || 0) - new Date(a.updatedAt || a.createdAt || a.date || 0);
}

function sortPublicTeachers(a, b) {
  const subjectCompare = String(a.subject || "").localeCompare(String(b.subject || ""));
  if (subjectCompare !== 0) return subjectCompare;
  return sortPublicByJoiningDate(a, b);
}

function sortPublicByJoiningDate(a, b) {
  return new Date(b.joiningDate || b.createdAt || 0) - new Date(a.joiningDate || a.createdAt || 0);
}

function normalizeStatus(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizePublicStatus(value) {
  const status = String(value || "Active").trim().toLowerCase();
  return status === "active" ? "Active" : value;
}

function uniqueStrings(values) {
  return [...new Set((values || []).map((value) => String(value || "").trim()).filter(Boolean))];
}

function normalizeRoll(value) {
  return String(value ?? "").trim().toLowerCase().replace(/^0+/, "") || String(value ?? "").trim().toLowerCase();
}

function getRollNumber(value) {
  const number = Number(String(value || "").replace(/[^0-9.]/g, ""));
  return Number.isNaN(number) ? 999999 : number;
}

function getInitial(name) {
  return String(name || "?").trim().charAt(0).toUpperCase() || "?";
}

function formatDate(value) {
  if (!value) return "No Date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function formatGpa(value) {
  const number = Number(value || 0);
  return Number.isNaN(number) ? "0.00" : number.toFixed(2);
}

function formatNumber(value) {
  const number = Number(value);
  if (Number.isNaN(number)) return String(value ?? "-");
  return Number.isInteger(number) ? String(number) : number.toFixed(2);
}

function limitText(text, limit) {
  const value = String(text || "");
  if (value.length <= limit) return value;
  return value.substring(0, limit).trim() + "...";
}

function hasValue(value) {
  return value !== undefined && value !== null && value !== "";
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function setHTML(id, value) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = value;
}

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHTML(value);
}
