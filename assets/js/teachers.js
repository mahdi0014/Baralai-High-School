const TEACHERS_KEY = "bhs_teachers_data";
const STAFF_KEY = "bhs_staff_data";

const STUDENT_KEYS = [
  "baralai_high_school_students",
  "bhs_students_data",
  "bhs_students",
  "studentsData",
  "studentsList",
  "students"
];

let editingTeacherId = null;
let editingStaffId = null;

document.addEventListener("DOMContentLoaded", async () => {
  initTabs();
  initFormToggle();
  initTeacherForm();
  initStaffForm();
  initSearch();
  initActionButtons();
  initImagePreviews();
  initRetiredDateToggle();

  await loadTeacherStaffFromSupabase();

  setNextTeacherId();
  setNextStaffId();
  renderAll();
});

/* =========================
   INIT FUNCTIONS
========================= */

function initTabs() {
  const initialTab = getTeacherTabFromHash() || "teachersSection";
  showTeacherTab(initialTab);

  document.addEventListener("click", (event) => {
    const tabButton = event.target.closest(".tm-tab-btn, [data-teacher-tab]");
    if (!tabButton) return;

    const target = tabButton.dataset.target || tabButton.dataset.teacherTab;
    if (!target) return;

    if (isTeachersPage()) {
      event.preventDefault();
      setTeacherHash(target);
    }

    showTeacherTab(target);
  });

  window.addEventListener("hashchange", () => {
    const target = getTeacherTabFromHash();
    if (target) showTeacherTab(target);
  });
}

function showTeacherTab(target) {
  const tabButtons = document.querySelectorAll(".tm-tab-btn, [data-teacher-tab]");
  const sections = document.querySelectorAll(".tm-section");

  tabButtons.forEach((button) => {
    const buttonTarget = button.dataset.target || button.dataset.teacherTab;
    button.classList.toggle("active", buttonTarget === target);
  });

  sections.forEach((section) => {
    section.classList.toggle("active", section.id === target);
  });
}

function getTeacherTabFromHash() {
  const hash = (window.location.hash || "").replace("#", "");
  const allowedTabs = ["teachersSection", "staffSection"];
  return allowedTabs.includes(hash) ? hash : "";
}

function setTeacherHash(target) {
  if (window.location.hash === "#" + target) return;
  history.pushState(null, "", "#" + target);
  window.dispatchEvent(new Event("hashchange"));
}

function isTeachersPage() {
  return window.location.pathname.toLowerCase().includes("teachers.html");
}

function initFormToggle() {
  const showTeacherFormBtn = document.getElementById("showTeacherFormBtn");
  const closeTeacherFormBtn = document.getElementById("closeTeacherFormBtn");
  const showStaffFormBtn = document.getElementById("showStaffFormBtn");
  const closeStaffFormBtn = document.getElementById("closeStaffFormBtn");

  if (showTeacherFormBtn) {
    showTeacherFormBtn.addEventListener("click", () => {
      resetTeacherForm();
      showTeacherForm();
      scrollToElement("teacherFormCard");
    });
  }

  if (closeTeacherFormBtn) {
    closeTeacherFormBtn.addEventListener("click", hideTeacherForm);
  }

  if (showStaffFormBtn) {
    showStaffFormBtn.addEventListener("click", () => {
      resetStaffForm();
      showStaffForm();
      scrollToElement("staffFormCard");
    });
  }

  if (closeStaffFormBtn) {
    closeStaffFormBtn.addEventListener("click", hideStaffForm);
  }
}

function initRetiredDateToggle() {
  const teacherStatus = document.getElementById("teacherStatus");
  const staffStatus = document.getElementById("staffStatus");

  if (teacherStatus) {
    teacherStatus.addEventListener("change", () => {
      toggleRetiredDateField("teacherStatus", "teacherRetiredDateGroup", "teacherRetiredDate");
    });
  }

  if (staffStatus) {
    staffStatus.addEventListener("change", () => {
      toggleRetiredDateField("staffStatus", "staffRetiredDateGroup", "staffRetiredDate");
    });
  }

  toggleRetiredDateField("teacherStatus", "teacherRetiredDateGroup", "teacherRetiredDate");
  toggleRetiredDateField("staffStatus", "staffRetiredDateGroup", "staffRetiredDate");
}

function initTeacherForm() {
  const teacherForm = document.getElementById("teacherForm");

  if (!teacherForm) return;

  teacherForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const teachers = getData(TEACHERS_KEY);
    const selectedSubject = getValue("teacherSubjectSelect");
    const manualSubject = getValue("teacherSubjectManual");

    const oldTeacher = editingTeacherId
      ? teachers.find((item) => item.id === editingTeacherId)
      : null;

    const image = await readImageAsBase64("teacherImage", oldTeacher?.image || "");

    if (image === null) return;

    const status = getValue("teacherStatus") || "Active";

    const teacher = {
      id: getValue("teacherId"),
      image,
      name: getValue("teacherName"),
      phone: getValue("teacherPhone"),
      email: getValue("teacherEmail"),
      subject: manualSubject || selectedSubject,
      designation: getValue("teacherDesignation"),
      qualification: getValue("teacherQualification"),
      joiningDate: getValue("teacherJoiningDate"),
      status,
      retiredDate: status === "Retired" ? getValue("teacherRetiredDate") : "",
      address: getValue("teacherAddress"),
      createdAt: editingTeacherId
        ? getExistingCreatedAt(TEACHERS_KEY, editingTeacherId)
        : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (!validateTeacher(teacher, teachers)) return;

    try {
      setFormLoading("saveTeacherBtn", true, editingTeacherId ? "Updating..." : "Saving...");

      if (editingTeacherId) {
        await updateTeacherInSupabase(editingTeacherId, teacher);
        showMessage("Teacher updated successfully", "success");
      } else {
        await addTeacherToSupabase(teacher);
        showMessage("Teacher added successfully", "success");
      }

      await loadTeacherStaffFromSupabase();
      resetTeacherForm();
      hideTeacherForm();
      renderAll();
    } catch (error) {
      console.error("Teacher save error:", error);
      showMessage(getSupabaseErrorMessage(error, "Teacher save failed"), "error");
    } finally {
      setFormLoading("saveTeacherBtn", false);
    }
  });
}
function initStaffForm() {
  const staffForm = document.getElementById("staffForm");

  if (!staffForm) return;

  staffForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const staffList = getData(STAFF_KEY);

    const oldStaff = editingStaffId
      ? staffList.find((item) => item.id === editingStaffId)
      : null;

    const image = await readImageAsBase64("staffImage", oldStaff?.image || "");

    if (image === null) return;

    const status = getValue("staffStatus") || "Active";

    const staff = {
      id: getValue("staffId"),
      image,
      name: getValue("staffName"),
      phone: getValue("staffPhone"),
      email: getValue("staffEmail"),
      designation: getValue("staffDesignation"),
      qualification: getValue("staffQualification"),
      joiningDate: getValue("staffJoiningDate"),
      status,
      retiredDate: status === "Retired" ? getValue("staffRetiredDate") : "",
      address: getValue("staffAddress"),
      createdAt: editingStaffId
        ? getExistingCreatedAt(STAFF_KEY, editingStaffId)
        : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (!validateStaff(staff, staffList)) return;

    try {
      setFormLoading("saveStaffBtn", true, editingStaffId ? "Updating..." : "Saving...");

      if (editingStaffId) {
        await updateStaffInSupabase(editingStaffId, staff);
        showMessage("Staff updated successfully", "success");
      } else {
        await addStaffToSupabase(staff);
        showMessage("Staff added successfully", "success");
      }

      await loadTeacherStaffFromSupabase();
      resetStaffForm();
      hideStaffForm();
      renderAll();
    } catch (error) {
      console.error("Staff save error:", error);
      showMessage(getSupabaseErrorMessage(error, "Staff save failed"), "error");
    } finally {
      setFormLoading("saveStaffBtn", false);
    }
  });
}
function initSearch() {
  const teacherSearch = document.getElementById("teacherSearch");
  const staffSearch = document.getElementById("staffSearch");

  if (teacherSearch) {
    teacherSearch.addEventListener("input", renderTeachers);
  }

  if (staffSearch) {
    staffSearch.addEventListener("input", renderStaff);
  }
}

function initActionButtons() {
  const refreshPageBtn = document.getElementById("refreshPageBtn");
  const resetTeacherBtn = document.getElementById("resetTeacherBtn");
  const resetStaffBtn = document.getElementById("resetStaffBtn");

  const teacherTableBody = document.getElementById("teacherTableBody");
  const staffTableBody = document.getElementById("staffTableBody");
  const retiredTeacherList = document.getElementById("retiredTeacherList");
  const retiredStaffList = document.getElementById("retiredStaffList");

  const popupCloseBtn = document.getElementById("popupCloseBtn");
  const popupCloseActionBtn = document.getElementById("popupCloseActionBtn");
  const personPopup = document.getElementById("personPopup");

  if (refreshPageBtn) {
    refreshPageBtn.addEventListener("click", async () => {
      await loadTeacherStaffFromSupabase();
      renderAll();
      setNextTeacherId();
      setNextStaffId();
      showMessage("Data refreshed", "success");
    });
  }

  if (resetTeacherBtn) {
    resetTeacherBtn.addEventListener("click", resetTeacherForm);
  }

  if (resetStaffBtn) {
    resetStaffBtn.addEventListener("click", resetStaffForm);
  }

  bindCardActions(teacherTableBody, "teacher");
  bindCardActions(staffTableBody, "staff");
  bindCardActions(retiredTeacherList, "teacher");
  bindCardActions(retiredStaffList, "staff");

  if (popupCloseBtn) {
    popupCloseBtn.addEventListener("click", closePersonPopup);
  }

  if (popupCloseActionBtn) {
    popupCloseActionBtn.addEventListener("click", closePersonPopup);
  }

  if (personPopup) {
    personPopup.addEventListener("click", (event) => {
      if (event.target.id === "personPopup") {
        closePersonPopup();
      }
    });
  }
}

function bindCardActions(container, type) {
  if (!container) return;

  container.addEventListener("click", async (event) => {
    const viewBtn = event.target.closest(`.view-${type}`);
    const editBtn = event.target.closest(`.edit-${type}`);
    const deleteBtn = event.target.closest(`.delete-${type}`);

    if (type === "teacher") {
      if (viewBtn) viewTeacher(viewBtn.dataset.id);
      if (editBtn) editTeacher(editBtn.dataset.id);
      if (deleteBtn) await deleteTeacher(deleteBtn.dataset.id);
    }

    if (type === "staff") {
      if (viewBtn) viewStaff(viewBtn.dataset.id);
      if (editBtn) editStaff(editBtn.dataset.id);
      if (deleteBtn) await deleteStaff(deleteBtn.dataset.id);
    }
  });
}

function initImagePreviews() {
  previewImage("teacherImage", "teacherImagePreview");
  previewImage("staffImage", "staffImagePreview");
}

/* =========================
   RENDER FUNCTIONS
========================= */

function renderAll() {
  renderDashboard();
  renderTeachers();
  renderStaff();
  renderRetiredTeachers();
  renderRetiredStaff();
}

function renderDashboard() {
  const teachers = getData(TEACHERS_KEY);
  const staffList = getData(STAFF_KEY);


  const activeTeachers = teachers.filter((item) => normalizeStatus(item.status) === "Active").length;
  const activeStaff = staffList.filter((item) => normalizeStatus(item.status) === "Active").length;
  const retiredTeachers = teachers.filter((item) => normalizeStatus(item.status) === "Retired").length;
  const retiredStaff = staffList.filter((item) => normalizeStatus(item.status) === "Retired").length;


  setText("totalTeachers", activeTeachers);
  setText("totalStaff", activeStaff);
  setText("totalRetired", retiredTeachers + retiredStaff);
}

function renderTeachers() {
  const teachers = getData(TEACHERS_KEY);
  const search = getValue("teacherSearch").toLowerCase();
  const container = document.getElementById("teacherTableBody");

  if (!container) return;

  const activeTeachers = teachers.filter((teacher) => {
    return normalizeStatus(teacher.status) === "Active" && teacherMatchesSearch(teacher, search);
  });

  renderTeacherCards(container, activeTeachers, "No active teacher found");
}

function renderRetiredTeachers() {
  const teachers = getData(TEACHERS_KEY);
  const container = document.getElementById("retiredTeacherList");

  if (!container) return;

  const retiredTeachers = teachers.filter((teacher) => {
    return normalizeStatus(teacher.status) === "Retired";
  });

  renderTeacherCards(container, retiredTeachers, "No retired teacher found");
}

function renderStaff() {
  const staffList = getData(STAFF_KEY);
  const search = getValue("staffSearch").toLowerCase();
  const container = document.getElementById("staffTableBody");

  if (!container) return;

  const activeStaff = staffList.filter((staff) => {
    return normalizeStatus(staff.status) === "Active" && staffMatchesSearch(staff, search);
  });

  renderStaffCards(container, activeStaff, "No active staff found");
}

function renderRetiredStaff() {
  const staffList = getData(STAFF_KEY);
  const container = document.getElementById("retiredStaffList");

  if (!container) return;

  const retiredStaff = staffList.filter((staff) => {
    return normalizeStatus(staff.status) === "Retired";
  });

  renderStaffCards(container, retiredStaff, "No retired staff found");
}

function renderTeacherCards(container, teachers, emptyText) {
  if (teachers.length === 0) {
    container.innerHTML = `<div class="tm-empty-card">${emptyText}</div>`;
    return;
  }

  container.innerHTML = teachers
    .map((teacher) => {
      const status = normalizeStatus(teacher.status);
      const statusClass = status === "Retired" ? "retired" : "active";

      return `
        <div class="tm-person-card">
          <div class="tm-person-left">
            ${renderPersonPhoto(teacher.image, teacher.name)}
            <div class="tm-person-info">
              <h4>${escapeHTML(teacher.name)}</h4>
              <p>${escapeHTML(teacher.designation || "-")}</p>
            </div>
          </div>

          <div class="tm-person-middle">
            <div class="tm-mini-info">
              <span>ID</span>
              <strong>${escapeHTML(teacher.id)}</strong>
            </div>

            <div class="tm-mini-info">
              <span>Subject</span>
              <strong>${escapeHTML(teacher.subject || "-")}</strong>
            </div>

            <div class="tm-mini-info">
              <span>Phone</span>
              <strong>${escapeHTML(teacher.phone || "-")}</strong>
            </div>

            <div class="tm-mini-info">
              <span>Status</span>
              <strong>
                <span class="tm-status ${statusClass}">${status}</span>
              </strong>
            </div>

            ${status === "Retired"
          ? `
                  <div class="tm-mini-info">
                    <span>Retired Date</span>
                    <strong>${escapeHTML(formatDate(teacher.retiredDate))}</strong>
                  </div>
                `
          : ""
        }
          </div>

          <div class="tm-card-actions tm-card-actions-two">
            <button
              type="button"
              class="tm-card-action-btn tm-view view-teacher"
              data-id="${escapeAttr(teacher.id)}"
              title="View"
            >
              <i class="fas fa-eye"></i>
            </button>

            <button
              type="button"
              class="tm-card-action-btn tm-edit edit-teacher"
              data-id="${escapeAttr(teacher.id)}"
              title="Edit"
            >
              <i class="fas fa-edit"></i>
            </button>

            <button
              type="button"
              class="tm-card-action-btn tm-delete delete-teacher"
              data-id="${escapeAttr(teacher.id)}"
              title="Delete"
            >
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>
      `;
    })
    .join("");
}

function renderStaffCards(container, staffList, emptyText) {
  if (staffList.length === 0) {
    container.innerHTML = `<div class="tm-empty-card">${emptyText}</div>`;
    return;
  }

  container.innerHTML = staffList
    .map((staff) => {
      const status = normalizeStatus(staff.status);
      const statusClass = status === "Retired" ? "retired" : "active";

      return `
        <div class="tm-person-card">
          <div class="tm-person-left">
            ${renderPersonPhoto(staff.image, staff.name)}
            <div class="tm-person-info">
              <h4>${escapeHTML(staff.name)}</h4>
              <p>${escapeHTML(staff.designation || "-")}</p>
            </div>
          </div>

          <div class="tm-person-middle">
            <div class="tm-mini-info">
              <span>ID</span>
              <strong>${escapeHTML(staff.id)}</strong>
            </div>

            <div class="tm-mini-info">
              <span>Phone</span>
              <strong>${escapeHTML(staff.phone || "-")}</strong>
            </div>

            <div class="tm-mini-info">
              <span>Joining</span>
              <strong>${escapeHTML(formatDate(staff.joiningDate))}</strong>
            </div>

            <div class="tm-mini-info">
              <span>Status</span>
              <strong>
                <span class="tm-status ${statusClass}">${status}</span>
              </strong>
            </div>

            ${status === "Retired"
          ? `
                  <div class="tm-mini-info">
                    <span>Retired Date</span>
                    <strong>${escapeHTML(formatDate(staff.retiredDate))}</strong>
                  </div>
                `
          : ""
        }
          </div>

          <div class="tm-card-actions tm-card-actions-two">
            <button
              type="button"
              class="tm-card-action-btn tm-view view-staff"
              data-id="${escapeAttr(staff.id)}"
              title="View"
            >
              <i class="fas fa-eye"></i>
            </button>

            <button
              type="button"
              class="tm-card-action-btn tm-edit edit-staff"
              data-id="${escapeAttr(staff.id)}"
              title="Edit"
            >
              <i class="fas fa-edit"></i>
            </button>

            <button
              type="button"
              class="tm-card-action-btn tm-delete delete-staff"
              data-id="${escapeAttr(staff.id)}"
              title="Delete"
            >
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>
      `;
    })
    .join("");
}

/* =========================
   SEARCH HELPERS
========================= */

function teacherMatchesSearch(teacher, search) {
  const searchableText = [
    teacher.id,
    teacher.name,
    teacher.phone,
    teacher.email,
    teacher.subject,
    teacher.designation,
    teacher.qualification,
    teacher.joiningDate,
    teacher.status,
    teacher.retiredDate,
    teacher.address
  ]
    .join(" ")
    .toLowerCase();

  return searchableText.includes(search);
}

function staffMatchesSearch(staff, search) {
  const searchableText = [
    staff.id,
    staff.name,
    staff.phone,
    staff.email,
    staff.designation,
    staff.qualification,
    staff.joiningDate,
    staff.status,
    staff.retiredDate,
    staff.address
  ]
    .join(" ")
    .toLowerCase();

  return searchableText.includes(search);
}

/* =========================
   EDIT / DELETE / RETIRE
========================= */

function editTeacher(id) {
  const teacher = getData(TEACHERS_KEY).find((item) => item.id === id);

  if (!teacher) {
    showMessage("Teacher not found", "error");
    return;
  }

  editingTeacherId = teacher.id;
  showTeacherForm();

  setValue("teacherId", teacher.id);
  setValue("teacherName", teacher.name);
  setValue("teacherPhone", teacher.phone);
  setValue("teacherEmail", teacher.email || "");
  setTeacherSubjectForEdit(teacher.subject || "");
  setValue("teacherDesignation", teacher.designation || "");
  setValue("teacherQualification", teacher.qualification || "");
  setValue("teacherJoiningDate", teacher.joiningDate || "");
  setValue("teacherStatus", normalizeStatus(teacher.status));
  setValue("teacherRetiredDate", teacher.retiredDate || "");
  setValue("teacherAddress", teacher.address || "");
  setImagePreview("teacherImagePreview", teacher.image || "");
  toggleRetiredDateField("teacherStatus", "teacherRetiredDateGroup", "teacherRetiredDate");

  setText("teacherFormTitle", "Update Teacher");
  document.getElementById("saveTeacherBtn").innerHTML = `<i class="fas fa-save"></i> Update Teacher`;

  clearFileInput("teacherImage");
  scrollToElement("teacherFormCard");
}

function editStaff(id) {
  const staff = getData(STAFF_KEY).find((item) => item.id === id);

  if (!staff) {
    showMessage("Staff not found", "error");
    return;
  }

  editingStaffId = staff.id;
  showStaffForm();

  setValue("staffId", staff.id);
  setValue("staffName", staff.name);
  setValue("staffPhone", staff.phone);
  setValue("staffEmail", staff.email || "");
  setValue("staffDesignation", staff.designation || "");
  setValue("staffQualification", staff.qualification || "");
  setValue("staffJoiningDate", staff.joiningDate || "");
  setValue("staffStatus", normalizeStatus(staff.status));
  setValue("staffRetiredDate", staff.retiredDate || "");
  setValue("staffAddress", staff.address || "");
  setImagePreview("staffImagePreview", staff.image || "");
  toggleRetiredDateField("staffStatus", "staffRetiredDateGroup", "staffRetiredDate");

  setText("staffFormTitle", "Update Staff");
  document.getElementById("saveStaffBtn").innerHTML = `<i class="fas fa-save"></i> Update Staff`;

  clearFileInput("staffImage");
  scrollToElement("staffFormCard");
}

async function deleteTeacher(id) {
  if (!confirm("Are you sure you want to delete this teacher?")) return;

  try {
    await deleteTeacherFromSupabase(id);
    await loadTeacherStaffFromSupabase();

    if (editingTeacherId === id) {
      resetTeacherForm();
      hideTeacherForm();
    }

    renderAll();
    showMessage("Teacher deleted successfully", "success");
  } catch (error) {
    console.error("Teacher delete error:", error);
    showMessage(getSupabaseErrorMessage(error, "Teacher delete failed"), "error");
  }
}

async function deleteStaff(id) {
  if (!confirm("Are you sure you want to delete this staff?")) return;

  try {
    await deleteStaffFromSupabase(id);
    await loadTeacherStaffFromSupabase();

    if (editingStaffId === id) {
      resetStaffForm();
      hideStaffForm();
    }

    renderAll();
    showMessage("Staff deleted successfully", "success");
  } catch (error) {
    console.error("Staff delete error:", error);
    showMessage(getSupabaseErrorMessage(error, "Staff delete failed"), "error");
  }
}

async function toggleTeacherRetirement(id) {
  const teachers = getData(TEACHERS_KEY);
  const teacher = teachers.find((item) => item.id === id);

  if (!teacher) return;

  if (normalizeStatus(teacher.status) === "Active") {
    const retiredDate = prompt("Enter retired date YYYY-MM-DD:", getTodayDate());

    if (!retiredDate) return;

    teacher.status = "Retired";
    teacher.retiredDate = retiredDate;
  } else {
    teacher.status = "Active";
    teacher.retiredDate = "";
  }

  teacher.updatedAt = new Date().toISOString();

  try {
    await updateTeacherInSupabase(id, teacher);
    await loadTeacherStaffFromSupabase();
    renderAll();
    showMessage("Teacher status updated", "success");
  } catch (error) {
    console.error("Teacher status update error:", error);
    showMessage(getSupabaseErrorMessage(error, "Teacher status update failed"), "error");
  }
}

async function toggleStaffRetirement(id) {
  const staffList = getData(STAFF_KEY);
  const staff = staffList.find((item) => item.id === id);

  if (!staff) return;

  if (normalizeStatus(staff.status) === "Active") {
    const retiredDate = prompt("Enter retired date YYYY-MM-DD:", getTodayDate());

    if (!retiredDate) return;

    staff.status = "Retired";
    staff.retiredDate = retiredDate;
  } else {
    staff.status = "Active";
    staff.retiredDate = "";
  }

  staff.updatedAt = new Date().toISOString();

  try {
    await updateStaffInSupabase(id, staff);
    await loadTeacherStaffFromSupabase();
    renderAll();
    showMessage("Staff status updated", "success");
  } catch (error) {
    console.error("Staff status update error:", error);
    showMessage(getSupabaseErrorMessage(error, "Staff status update failed"), "error");
  }
}

/* =========================
   VIEW POPUP
========================= */

function viewTeacher(id) {
  const teacher = getData(TEACHERS_KEY).find((item) => item.id === id);

  if (!teacher) {
    showMessage("Teacher not found", "error");
    return;
  }

  showPersonPopup("Teacher Details", teacher.designation || "Teacher", [
    ["Photo", renderPersonPhoto(teacher.image, teacher.name)],
    ["Teacher ID", teacher.id],
    ["Name", teacher.name],
    ["Phone", teacher.phone],
    ["Email", teacher.email || "-"],
    ["Subject", teacher.subject || "-"],
    ["Designation", teacher.designation || "-"],
    ["Qualification", teacher.qualification || "-"],
    ["Joining Date", formatDate(teacher.joiningDate)],
    ["Status", normalizeStatus(teacher.status)],
    ["Retired Date", normalizeStatus(teacher.status) === "Retired" ? formatDate(teacher.retiredDate) : "-"],
    ["Address", teacher.address || "-"]
  ]);
}

function viewStaff(id) {
  const staff = getData(STAFF_KEY).find((item) => item.id === id);

  if (!staff) {
    showMessage("Staff not found", "error");
    return;
  }

  showPersonPopup("Staff Details", staff.designation || "Staff", [
    ["Photo", renderPersonPhoto(staff.image, staff.name)],
    ["Staff ID", staff.id],
    ["Name", staff.name],
    ["Phone", staff.phone],
    ["Email", staff.email || "-"],
    ["Designation", staff.designation || "-"],
    ["Qualification", staff.qualification || "-"],
    ["Joining Date", formatDate(staff.joiningDate)],
    ["Status", normalizeStatus(staff.status)],
    ["Retired Date", normalizeStatus(staff.status) === "Retired" ? formatDate(staff.retiredDate) : "-"],
    ["Address", staff.address || "-"]
  ]);
}

function showPersonPopup(title, subtitle, rows) {
  const popup = document.getElementById("personPopup");
  const popupTitle = document.getElementById("popupTitle");
  const popupSubtitle = document.getElementById("popupSubtitle");
  const popupBody = document.getElementById("popupBody");

  if (!popup || !popupTitle || !popupSubtitle || !popupBody) return;

  popupTitle.textContent = title;
  popupSubtitle.textContent = subtitle;

  const photoRow = rows.find((row) => row[0] === "Photo");
  const detailsRows = rows.filter((row) => row[0] !== "Photo");
  const nameRow = detailsRows.find((row) => row[0] === "Name");

  popupBody.innerHTML = `
    <div class="tm-popup-profile">
      ${photoRow ? photoRow[1] : ""}
      <h4>${escapeHTML(nameRow?.[1] || "No Name")}</h4>
      <p>${escapeHTML(subtitle)}</p>
    </div>

    <div class="tm-popup-details">
      ${detailsRows
      .map(
        (row) => `
            <div class="tm-popup-row">
              <span>${escapeHTML(row[0])}</span>
              <strong>${escapeHTML(row[1])}</strong>
            </div>
          `
      )
      .join("")}
    </div>
  `;

  popup.classList.add("show");
}

function closePersonPopup() {
  const popup = document.getElementById("personPopup");

  if (popup) {
    popup.classList.remove("show");
  }
}

/* =========================
   VALIDATION
========================= */

function validateTeacher(teacher, teachers) {
  if (!teacher.id || !teacher.name || !teacher.phone || !teacher.subject || !teacher.designation) {
    showMessage("Please fill all required teacher fields", "error");
    return false;
  }

  if (teacher.status === "Retired" && !teacher.retiredDate) {
    showMessage("Please select teacher retired date", "error");
    return false;
  }

  if (!isValidPhone(teacher.phone)) {
    showMessage("Phone number must be like 01712345678", "error");
    return false;
  }

  if (teacher.email && !isValidEmail(teacher.email)) {
    showMessage("Please enter a valid teacher email", "error");
    return false;
  }

  const duplicateId = teachers.some((item) => {
    return safeLower(item.id) === safeLower(teacher.id) && item.id !== editingTeacherId;
  });

  if (duplicateId) {
    showMessage("This Teacher ID already exists", "error");
    return false;
  }

  const duplicatePhone = teachers.some((item) => {
    return item.phone === teacher.phone && item.id !== editingTeacherId;
  });

  if (duplicatePhone) {
    showMessage("This teacher phone number already exists", "error");
    return false;
  }

  return true;
}

function validateStaff(staff, staffList) {
  if (!staff.id || !staff.name || !staff.phone || !staff.designation) {
    showMessage("Please fill all required staff fields", "error");
    return false;
  }

  if (staff.status === "Retired" && !staff.retiredDate) {
    showMessage("Please select staff retired date", "error");
    return false;
  }

  if (!isValidPhone(staff.phone)) {
    showMessage("Phone number must be like 01712345678", "error");
    return false;
  }

  if (staff.email && !isValidEmail(staff.email)) {
    showMessage("Please enter a valid staff email", "error");
    return false;
  }

  const duplicateId = staffList.some((item) => {
    return safeLower(item.id) === safeLower(staff.id) && item.id !== editingStaffId;
  });

  if (duplicateId) {
    showMessage("This Staff ID already exists", "error");
    return false;
  }

  const duplicatePhone = staffList.some((item) => {
    return item.phone === staff.phone && item.id !== editingStaffId;
  });

  if (duplicatePhone) {
    showMessage("This staff phone number already exists", "error");
    return false;
  }

  return true;
}

/* =========================
   RESET FORM
========================= */

function resetTeacherForm() {
  editingTeacherId = null;

  const teacherForm = document.getElementById("teacherForm");

  if (teacherForm) {
    teacherForm.reset();
  }

  setText("teacherFormTitle", "Add Teacher");

  const saveTeacherBtn = document.getElementById("saveTeacherBtn");

  if (saveTeacherBtn) {
    saveTeacherBtn.innerHTML = `<i class="fas fa-save"></i> Save Teacher`;
  }

  setNextTeacherId();
  setValue("teacherStatus", "Active");
  setValue("teacherRetiredDate", "");
  setImagePreview("teacherImagePreview", "");
  clearFileInput("teacherImage");
  toggleRetiredDateField("teacherStatus", "teacherRetiredDateGroup", "teacherRetiredDate");
}

function resetStaffForm() {
  editingStaffId = null;

  const staffForm = document.getElementById("staffForm");

  if (staffForm) {
    staffForm.reset();
  }

  setText("staffFormTitle", "Add Staff");

  const saveStaffBtn = document.getElementById("saveStaffBtn");

  if (saveStaffBtn) {
    saveStaffBtn.innerHTML = `<i class="fas fa-save"></i> Save Staff`;
  }

  setNextStaffId();
  setValue("staffStatus", "Active");
  setValue("staffRetiredDate", "");
  setImagePreview("staffImagePreview", "");
  clearFileInput("staffImage");
  toggleRetiredDateField("staffStatus", "staffRetiredDateGroup", "staffRetiredDate");
}

/* =========================
   FORM HELPERS
========================= */

function setNextTeacherId() {
  const teachers = getData(TEACHERS_KEY);

  const maxNumber = teachers.reduce((max, teacher) => {
    const number = extractIdNumber(teacher.id, "T-");
    return number > max ? number : max;
  }, 0);

  setValue("teacherId", `T-${String(maxNumber + 1).padStart(3, "0")}`);
}

function setNextStaffId() {
  const staffList = getData(STAFF_KEY);

  const maxNumber = staffList.reduce((max, staff) => {
    const number = extractIdNumber(staff.id, "S-");
    return number > max ? number : max;
  }, 0);

  setValue("staffId", `S-${String(maxNumber + 1).padStart(3, "0")}`);
}

function setTeacherSubjectForEdit(subject) {
  const select = document.getElementById("teacherSubjectSelect");
  const manual = document.getElementById("teacherSubjectManual");

  if (!select || !manual) return;

  const exists = Array.from(select.options).some((option) => option.value === subject);

  if (exists) {
    select.value = subject;
    manual.value = "";
  } else {
    select.value = "";
    manual.value = subject;
  }
}

function toggleRetiredDateField(statusId, groupId, inputId) {
  const status = getValue(statusId);
  const group = document.getElementById(groupId);
  const input = document.getElementById(inputId);

  if (!group || !input) return;

  if (status === "Retired") {
    group.classList.remove("tm-hidden");
    input.required = true;

    if (!input.value) {
      input.value = getTodayDate();
    }
  } else {
    group.classList.add("tm-hidden");
    input.required = false;
    input.value = "";
  }
}

function showTeacherForm() {
  const teacherFormCard = document.getElementById("teacherFormCard");

  if (teacherFormCard) {
    teacherFormCard.classList.remove("tm-hidden");
  }
}

function hideTeacherForm() {
  const teacherFormCard = document.getElementById("teacherFormCard");

  if (teacherFormCard) {
    teacherFormCard.classList.add("tm-hidden");
  }

  resetTeacherForm();
}

function showStaffForm() {
  const staffFormCard = document.getElementById("staffFormCard");

  if (staffFormCard) {
    staffFormCard.classList.remove("tm-hidden");
  }
}

function hideStaffForm() {
  const staffFormCard = document.getElementById("staffFormCard");

  if (staffFormCard) {
    staffFormCard.classList.add("tm-hidden");
  }

  resetStaffForm();
}

/* =========================
   IMAGE FUNCTIONS
========================= */

function readImageAsBase64(inputId, oldImage = "") {
  return new Promise((resolve) => {
    const input = document.getElementById(inputId);

    if (!input || !input.files || input.files.length === 0) {
      resolve(oldImage || "");
      return;
    }

    const file = input.files[0];

    if (!file.type.startsWith("image/")) {
      showMessage("Please select a valid image file", "error");
      resolve(null);
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      showMessage("Image size must be less than 2MB", "error");
      resolve(null);
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      resizeImage(reader.result, 500, 0.8)
        .then((resizedImage) => resolve(resizedImage))
        .catch(() => resolve(reader.result));
    };

    reader.onerror = () => {
      showMessage("Image upload failed", "error");
      resolve(null);
    };

    reader.readAsDataURL(file);
  });
}

function resizeImage(base64, maxWidth = 500, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => {
      const canvas = document.createElement("canvas");
      const ratio = Math.min(maxWidth / image.width, maxWidth / image.height, 1);

      canvas.width = image.width * ratio;
      canvas.height = image.height * ratio;

      const ctx = canvas.getContext("2d");
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

      resolve(canvas.toDataURL("image/jpeg", quality));
    };

    image.onerror = reject;
    image.src = base64;
  });
}

function previewImage(inputId, previewId) {
  const input = document.getElementById(inputId);
  const preview = document.getElementById(previewId);

  if (!input || !preview) return;

  input.addEventListener("change", () => {
    const file = input.files[0];

    if (!file) {
      preview.innerHTML = `<span>No image selected</span>`;
      return;
    }

    if (!file.type.startsWith("image/")) {
      preview.innerHTML = `<span>Invalid image file</span>`;
      input.value = "";
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      preview.innerHTML = `<span>Image must be less than 2MB</span>`;
      input.value = "";
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      preview.innerHTML = `<img src="${reader.result}" alt="Preview" />`;
    };

    reader.readAsDataURL(file);
  });
}

function setImagePreview(previewId, image) {
  const preview = document.getElementById(previewId);

  if (!preview) return;

  if (image && isSafeImageData(image)) {
    preview.innerHTML = `<img src="${image}" alt="Preview" />`;
  } else {
    preview.innerHTML = `<span>No image selected</span>`;
  }
}

function renderPersonPhoto(image, name) {
  if (image && isSafeImageData(image)) {
    return `<img src="${image}" alt="${escapeAttr(name || "User")}" class="tm-person-photo" />`;
  }

  const firstLetter = name ? String(name).charAt(0).toUpperCase() : "?";

  return `<div class="tm-person-placeholder">${escapeHTML(firstLetter)}</div>`;
}

function clearFileInput(inputId) {
  const input = document.getElementById(inputId);

  if (input) {
    input.value = "";
  }
}

function isSafeImageData(image) {
  return typeof image === "string" && image.startsWith("data:image/");
}


/* =========================
   SUPABASE HELPERS
========================= */

async function loadTeacherStaffFromSupabase() {
  if (!ensureSupabaseClient()) {
    showMessage("Supabase connection not found", "error");
    return;
  }

  try {
    const [teachersResult, staffResult] = await Promise.all([
      window.bhsSupabase
        .from("teachers")
        .select("*")
        .order("created_at", { ascending: true }),
      window.bhsSupabase
        .from("staff")
        .select("*")
        .order("created_at", { ascending: true })
    ]);

    if (teachersResult.error) throw teachersResult.error;
    if (staffResult.error) throw staffResult.error;

    const teachers = (teachersResult.data || []).map(mapTeacherFromSupabase);
    const staffList = (staffResult.data || []).map(mapStaffFromSupabase);

    setData(TEACHERS_KEY, teachers);
    setData(STAFF_KEY, staffList);
  } catch (error) {
    console.error("Teacher/Staff load error:", error);
    showMessage(getSupabaseErrorMessage(error, "Teacher and staff data load failed"), "error");
  }
}

async function addTeacherToSupabase(teacher) {
  const payload = mapTeacherToSupabase(teacher);

  const { error } = await window.bhsSupabase
    .from("teachers")
    .insert(payload);

  if (error) throw error;
}

async function updateTeacherInSupabase(oldTeacherCode, teacher) {
  const payload = mapTeacherToSupabase(teacher);

  const { error } = await window.bhsSupabase
    .from("teachers")
    .update(payload)
    .eq("teacher_code", oldTeacherCode);

  if (error) throw error;
}

async function deleteTeacherFromSupabase(teacherCode) {
  const { error } = await window.bhsSupabase
    .from("teachers")
    .delete()
    .eq("teacher_code", teacherCode);

  if (error) throw error;
}

async function addStaffToSupabase(staff) {
  const payload = mapStaffToSupabase(staff);

  const { error } = await window.bhsSupabase
    .from("staff")
    .insert(payload);

  if (error) throw error;
}

async function updateStaffInSupabase(oldStaffCode, staff) {
  const payload = mapStaffToSupabase(staff);

  const { error } = await window.bhsSupabase
    .from("staff")
    .update(payload)
    .eq("staff_code", oldStaffCode);

  if (error) throw error;
}

async function deleteStaffFromSupabase(staffCode) {
  const { error } = await window.bhsSupabase
    .from("staff")
    .delete()
    .eq("staff_code", staffCode);

  if (error) throw error;
}

function mapTeacherFromSupabase(row) {
  return {
    id: row.teacher_code || "",
    image: row.image_data_url || "",
    name: row.name || "",
    phone: row.phone || "",
    email: row.email || "",
    subject: row.subject || "",
    designation: row.designation || "",
    qualification: row.qualification || "",
    joiningDate: row.joining_date || "",
    status: normalizeStatus(row.status),
    retiredDate: row.retired_date || "",
    address: row.address || "",
    createdAt: row.created_at || "",
    updatedAt: row.updated_at || ""
  };
}

function mapTeacherToSupabase(teacher) {
  return {
    teacher_code: teacher.id,
    image_data_url: teacher.image || "",
    name: teacher.name,
    phone: teacher.phone,
    email: teacher.email || null,
    subject: teacher.subject,
    designation: teacher.designation,
    qualification: teacher.qualification || null,
    joining_date: emptyToNull(teacher.joiningDate),
    status: normalizeStatus(teacher.status),
    retired_date: normalizeStatus(teacher.status) === "Retired" ? emptyToNull(teacher.retiredDate) : null,
    address: teacher.address || null
  };
}

function mapStaffFromSupabase(row) {
  return {
    id: row.staff_code || "",
    image: row.image_data_url || "",
    name: row.name || "",
    phone: row.phone || "",
    email: row.email || "",
    designation: row.designation || "",
    qualification: row.qualification || "",
    joiningDate: row.joining_date || "",
    status: normalizeStatus(row.status),
    retiredDate: row.retired_date || "",
    address: row.address || "",
    createdAt: row.created_at || "",
    updatedAt: row.updated_at || ""
  };
}

function mapStaffToSupabase(staff) {
  return {
    staff_code: staff.id,
    image_data_url: staff.image || "",
    name: staff.name,
    phone: staff.phone,
    email: staff.email || null,
    designation: staff.designation,
    qualification: staff.qualification || null,
    joining_date: emptyToNull(staff.joiningDate),
    status: normalizeStatus(staff.status),
    retired_date: normalizeStatus(staff.status) === "Retired" ? emptyToNull(staff.retiredDate) : null,
    address: staff.address || null
  };
}

function ensureSupabaseClient() {
  return Boolean(window.bhsSupabase);
}

function emptyToNull(value) {
  return value ? value : null;
}

function getSupabaseErrorMessage(error, fallback) {
  if (!error) return fallback;

  const message = error.message || String(error);

  if (message.includes("duplicate key") || error.code === "23505") {
    return "Duplicate data found. Please check ID, phone or email.";
  }

  if (message.includes("row-level security")) {
    return "Permission denied by Supabase RLS policy.";
  }

  return message || fallback;
}

function setFormLoading(buttonId, isLoading, loadingText = "Saving...") {
  const button = document.getElementById(buttonId);

  if (!button) return;

  if (isLoading) {
    button.disabled = true;
    button.dataset.originalText = button.innerHTML;
    button.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${loadingText}`;
    return;
  }

  button.disabled = false;

  if (button.dataset.originalText) {
    button.innerHTML = button.dataset.originalText;
    delete button.dataset.originalText;
  }
}

/* =========================
   STORAGE HELPERS
========================= */

function getData(key) {
  try {
    const data = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(data) ? data : [];
  } catch (error) {
    return [];
  }
}

function setData(key, data) {
  if (typeof window.bhsSafeSetLocalJSON === "function") {
    window.bhsSafeSetLocalJSON(key, data);
    return;
  }
  try { localStorage.setItem(key, JSON.stringify(data)); }
  catch (error) { console.warn(`Storage write skipped for ${key}:`, error); }
}

function getStudentsData() {
  for (const key of STUDENT_KEYS) {
    try {
      const data = JSON.parse(localStorage.getItem(key) || "[]");

      if (Array.isArray(data) && data.length > 0) {
        return data;
      }

      if (data && typeof data === "object" && !Array.isArray(data)) {
        const values = Object.values(data);

        if (values.every((item) => Array.isArray(item))) {
          return values.flat();
        }

        if (values.length > 0) {
          return values;
        }
      }
    } catch (error) {
      continue;
    }
  }

  return [];
}

function getExistingCreatedAt(key, id) {
  const data = getData(key);
  const item = data.find((entry) => entry.id === id);
  return item?.createdAt || new Date().toISOString();
}

/* =========================
   SMALL HELPERS
========================= */

function getValue(id) {
  const element = document.getElementById(id);
  return element ? element.value.trim() : "";
}

function setValue(id, value) {
  const element = document.getElementById(id);

  if (element) {
    element.value = value;
  }
}

function setText(id, value) {
  const element = document.getElementById(id);

  if (element) {
    element.textContent = value;
  }
}

function getTodayDate() {
  return new Date().toISOString().split("T")[0];
}

function isValidPhone(phone) {
  return /^01[0-9]{9}$/.test(phone);
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function normalizeStatus(status) {
  return status === "Retired" ? "Retired" : "Active";
}

function safeLower(value) {
  return String(value || "").toLowerCase();
}

function extractIdNumber(id, prefix) {
  const text = String(id || "").replace(prefix, "");
  const number = parseInt(text, 10);
  return Number.isNaN(number) ? 0 : number;
}

function formatDate(dateValue) {
  if (!dateValue) return "-";

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return dateValue;
  }

  return date.toLocaleDateString("en-GB");
}

function escapeHTML(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHTML(value);
}

function scrollToElement(id) {
  const element = document.getElementById(id);

  if (element) {
    element.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }
}

function showMessage(message, type) {
  const oldMessage = document.querySelector(".tm-message");

  if (oldMessage) {
    oldMessage.remove();
  }

  const messageBox = document.createElement("div");
  messageBox.className = `tm-message ${type}`;
  messageBox.textContent = message;

  document.body.appendChild(messageBox);

  setTimeout(() => {
    messageBox.classList.add("show");
  }, 100);

  setTimeout(() => {
    messageBox.classList.remove("show");

    setTimeout(() => {
      messageBox.remove();
    }, 300);
  }, 2500);
}