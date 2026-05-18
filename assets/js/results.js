/* =========================================================
   RESULT MANAGEMENT SYSTEM - BARALAI HIGH SCHOOL
   Class/Group-wise subjects + component-wise marking
   Class 6-8: General
   Class 9-10: Science / Arts / Commerce
========================================================= */

document.addEventListener("DOMContentLoaded", async () => {
  const STUDENTS_KEY = "bhs_students";
  const RESULTS_KEY = "bhs_results";
  const SUBJECTS_KEY = "bhs_subjects";
  const YEAR_STORAGE_KEY = "bhs_selected_exam_year";
  const FINAL_EXAM_NAME = "Final Exam";

  const GENERAL_SECTION = "General";
  const GROUP_CLASSES = new Set(["9", "10"]);
  const GROUP_SECTIONS = ["Science", "Arts", "Commerce"];

  const elements = {
    resultYearSubtitle: document.getElementById("resultYearSubtitle"),
    tabButtons: document.querySelectorAll(".result-tab-btn, [data-result-tab]"),
    tabContents: document.querySelectorAll(".result-tab-content"),

    resultClass: document.getElementById("resultClass"),
    resultSectionGroup: document.getElementById("resultSectionGroup"),
    resultSection: document.getElementById("resultSection"),
    resultSubject: document.getElementById("resultSubject"),
    loadStudentsForResultBtn: document.getElementById("loadStudentsForResultBtn"),
    clearMarksBtn: document.getElementById("clearMarksBtn"),
    saveResultsBtn: document.getElementById("saveResultsBtn"),
    resultEntryHead: document.getElementById("resultEntryHead"),
    resultEntryBody: document.getElementById("resultEntryBody"),
    resultStatus: document.getElementById("resultStatus"),

    manageResultSearch: document.getElementById("manageResultSearch"),
    manageClassFilter: document.getElementById("manageClassFilter"),
    manageSectionFilterGroup: document.getElementById("manageSectionFilterGroup"),
    manageSectionFilter: document.getElementById("manageSectionFilter"),
    manageResultsBody: document.getElementById("manageResultsBody"),
    manageResultSubtitle: document.getElementById("manageResultSubtitle"),
    manageResultTableWrap: document.getElementById("manageResultTableWrap") || document.querySelector("#manageResultsTab .table-responsive"),
    manageResultHead: document.querySelector(".result-manage-table thead"),

    subjectClass: document.getElementById("subjectClass"),
    subjectSectionGroup: document.getElementById("subjectSectionGroup"),
    subjectSection: document.getElementById("subjectSection"),
    newSubjectName: document.getElementById("newSubjectName"),
    newSubjectCode: document.getElementById("newSubjectCode"),
    newSubjectType: document.getElementById("newSubjectType"),
    addSubjectBtn: document.getElementById("addSubjectBtn"),
    subjectsList: document.getElementById("subjectsList"),
    subjectsStatus: document.getElementById("subjectsStatus"),

    exportClass: document.getElementById("exportClass"),
    exportSectionGroup: document.getElementById("exportSectionGroup"),
    exportSection: document.getElementById("exportSection"),
    previewReportBtn: document.getElementById("previewReportBtn"),
    downloadReportPdfBtn: document.getElementById("downloadReportPdfBtn"),
    downloadReportExcelBtn: document.getElementById("downloadReportExcelBtn"),
    publishClassResultBtn: document.getElementById("publishClassResultBtn"),
    editClassResultBtn: document.getElementById("editClassResultBtn"),
    unpublishClassResultBtn: document.getElementById("unpublishClassResultBtn"),
    exportStatus: document.getElementById("exportStatus"),
    reportPreview: document.getElementById("reportPreview"),

    resultModal: document.getElementById("resultModal"),
    closeResultModal: document.getElementById("closeResultModal"),
    resultModalOkBtn: document.getElementById("resultModalOkBtn"),
    resultModalTitle: document.getElementById("resultModalTitle"),
    resultModalBasic: document.getElementById("resultModalBasic"),
    resultModalMarks: document.getElementById("resultModalMarks")
  };

  let students = loadFromStorage(STUDENTS_KEY, []);
  let results = loadFromStorage(RESULTS_KEY, []);
  let subjectsByClass = loadSubjects();
  let currentLoadedStudents = [];

  await init();

  async function init() {
    await loadSupabaseInitialData();
    syncCache();
    bindEvents();
    bindExamYearSelectWhenReady();
    updateYearTexts();
    initSectionControls();
    populateSubjectDropdown();
    setupManageResultTableHead();
    renderManageResults();
    renderSubjects();
    updatePublishButtonState(false);
    showTab(getResultTabFromHash() || "addResult");
  }

  function bindEvents() {
    document.addEventListener("click", (event) => {
      const tabButton = event.target.closest(".result-tab-btn, [data-result-tab]");
      if (!tabButton) return;
      const tabName = tabButton.dataset.tab || tabButton.dataset.resultTab;
      if (!tabName) return;
      if (isResultsPage()) {
        event.preventDefault();
        setResultHash(tabName);
      }
      showTab(tabName);
    });

    window.addEventListener("hashchange", () => {
      const tabName = getResultTabFromHash();
      if (tabName) showTab(tabName);
    });

    elements.resultClass?.addEventListener("change", () => {
      updateSectionControl(elements.resultClass, elements.resultSectionGroup, elements.resultSection, false);
      populateSubjectDropdown();
      renderEmptyEntryTable("Select class/group and subject to load students.");
    });
    elements.resultSection?.addEventListener("change", () => {
      populateSubjectDropdown();
      renderEmptyEntryTable("Select subject and load students.");
    });
    elements.resultSubject?.addEventListener("change", () => loadStudentsForResult(false));
    elements.loadStudentsForResultBtn?.addEventListener("click", () => loadStudentsForResult(true));
    elements.clearMarksBtn?.addEventListener("click", clearMarks);
    elements.saveResultsBtn?.addEventListener("click", () => saveSubjectMarks());

    elements.manageResultSearch?.addEventListener("input", renderManageResults);
    elements.manageClassFilter?.addEventListener("change", () => {
      updateSectionControl(elements.manageClassFilter, elements.manageSectionFilterGroup, elements.manageSectionFilter, true);
      renderManageResults();
    });
    elements.manageSectionFilter?.addEventListener("change", renderManageResults);

    elements.subjectClass?.addEventListener("change", () => {
      updateSectionControl(elements.subjectClass, elements.subjectSectionGroup, elements.subjectSection, false);
      renderSubjects();
    });
    elements.subjectSection?.addEventListener("change", renderSubjects);
    elements.addSubjectBtn?.addEventListener("click", () => addSubject());
    [elements.newSubjectName, elements.newSubjectCode].forEach((input) => {
      input?.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          addSubject();
        }
      });
    });

    elements.exportClass?.addEventListener("change", () => {
      updateSectionControl(elements.exportClass, elements.exportSectionGroup, elements.exportSection, false);
      resetExportPreview();
    });
    elements.exportSection?.addEventListener("change", resetExportPreview);
    elements.previewReportBtn?.addEventListener("click", () => previewReport(true));
    elements.downloadReportPdfBtn?.addEventListener("click", downloadReportPDF);
    elements.downloadReportExcelBtn?.addEventListener("click", downloadReportExcel);
    elements.publishClassResultBtn?.addEventListener("click", () => publishClassResults());
    elements.editClassResultBtn?.addEventListener("click", () => startWholeClassEdit());
    elements.unpublishClassResultBtn?.addEventListener("click", () => unpublishClassResults());

    elements.manageResultsBody?.addEventListener("click", handleManageResultActions);
    elements.subjectsList?.addEventListener("click", handleSubjectActions);
    elements.resultEntryBody?.addEventListener("input", handleMarkInputChange);

    elements.closeResultModal?.addEventListener("click", hideResultModal);
    elements.resultModalOkBtn?.addEventListener("click", hideResultModal);
    elements.resultModal?.addEventListener("click", (event) => {
      if (event.target === elements.resultModal) hideResultModal();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") hideResultModal();
    });

    window.addEventListener("bhsExamYearReady", handleYearChange);
    window.addEventListener("bhsExamYearChanged", handleYearChange);
  }

  function initSectionControls() {
    updateSectionControl(elements.resultClass, elements.resultSectionGroup, elements.resultSection, false);
    updateSectionControl(elements.manageClassFilter, elements.manageSectionFilterGroup, elements.manageSectionFilter, true);
    updateSectionControl(elements.subjectClass, elements.subjectSectionGroup, elements.subjectSection, false);
    updateSectionControl(elements.exportClass, elements.exportSectionGroup, elements.exportSection, false);
  }

  function updateSectionControl(classSelect, groupEl, sectionSelect, allowAll = false) {
    if (!classSelect || !groupEl || !sectionSelect) return;
    const className = classSelect.value || "";
    const needsGroup = isGroupClass(className);
    groupEl.hidden = !needsGroup;
    groupEl.style.display = needsGroup ? "" : "none";

    if (!needsGroup) {
      sectionSelect.value = allowAll ? "" : GENERAL_SECTION;
      return;
    }

    const current = sectionSelect.value;
    const allOption = allowAll ? `<option value="">All Groups</option>` : `<option value="">Select Group / Section</option>`;
    sectionSelect.innerHTML = `${allOption}${GROUP_SECTIONS.map((item) => `<option value="${escapeAttr(item)}">${escapeHTML(getSectionLabel(item))}</option>`).join("")}`;
    if (current && (allowAll || GROUP_SECTIONS.includes(current))) sectionSelect.value = current;
    else sectionSelect.value = allowAll ? "" : GROUP_SECTIONS[0];
  }

  function showTab(tabName) {
    document.querySelectorAll(".result-tab-btn, [data-result-tab]").forEach((button) => {
      const buttonTab = button.dataset.tab || button.dataset.resultTab;
      button.classList.toggle("active", buttonTab === tabName);
    });
    elements.tabContents.forEach((content) => content.classList.toggle("active", content.id === `${tabName}Tab`));
    if (tabName === "manageResults") {
      setupManageResultTableHead();
      renderManageResults();
    }
    if (tabName === "manageSubjects") renderSubjects();
    if (tabName === "exportReport") updatePublishButtonState(false);
  }

  function getResultTabFromHash() {
    const hash = (window.location.hash || "").replace("#", "");
    const allowedTabs = ["addResult", "manageResults", "manageSubjects", "exportReport"];
    return allowedTabs.includes(hash) ? hash : "";
  }

  function setResultHash(tabName) {
    if (window.location.hash === `#${tabName}`) return;
    history.pushState(null, "", `#${tabName}`);
    window.dispatchEvent(new Event("hashchange"));
  }

  function isResultsPage() {
    return window.location.pathname.toLowerCase().includes("results.html");
  }

  function getExamYearSelect() {
    return document.getElementById("examYear") || document.getElementById("examYearSelect") || document.getElementById("yearSelect") || document.querySelector(".exam-year-select select") || document.querySelector(".year-dropdown");
  }

  function getSelectedExamYear() {
    const examYearSelect = getExamYearSelect();
    if (examYearSelect && examYearSelect.value) return String(examYearSelect.value);
    const storedYear = localStorage.getItem(YEAR_STORAGE_KEY);
    if (storedYear) return String(storedYear);
    return String(new Date().getFullYear());
  }

  function bindExamYearSelectWhenReady() {
    const examYearSelect = getExamYearSelect();
    if (examYearSelect) {
      examYearSelect.addEventListener("change", handleYearChange);
      return;
    }
    const headerContainer = document.getElementById("admin-header-container");
    if (!headerContainer) return;
    const observer = new MutationObserver(() => {
      const select = getExamYearSelect();
      if (!select) return;
      select.addEventListener("change", handleYearChange);
      observer.disconnect();
    });
    observer.observe(headerContainer, { childList: true, subtree: true });
  }

  function handleYearChange() {
    updateYearTexts();
    loadStudentsForResult(false);
    renderManageResults();
    resetExportPreview();
  }

  function updateYearTexts() {
    const year = getSelectedExamYear();
    if (elements.resultYearSubtitle) {
      elements.resultYearSubtitle.textContent = `Final Exam result management for Exam Year ${year}. Class/group subjects, component marks and GPA ranking.`;
    }
  }

  /* =========================================================
     SUBJECTS
  ========================================================= */

  function populateSubjectDropdown() {
    if (!elements.resultSubject) return;
    const selectedClass = elements.resultClass?.value || "";
    const selectedSection = getSelectedSectionFor("result");
    const subjects = getSubjectsForClassSection(selectedClass, selectedSection);

    elements.resultSubject.innerHTML = `<option value="">Select Subject</option>`;
    subjects.forEach((subject) => {
      const option = document.createElement("option");
      option.value = subject.name;
      option.textContent = buildSubjectLabel(subject);
      elements.resultSubject.appendChild(option);
    });

    if (selectedClass && isGroupClass(selectedClass) && !selectedSection) {
      renderEmptyEntryTable("Please select group/section first.");
      return;
    }
    if (selectedClass && !subjects.length) {
      renderEmptyEntryTable("No subject found. Go to Manage Subjects and add class/group-wise subjects first.");
    }
  }

  function renderSubjects() {
    const selectedClass = elements.subjectClass?.value || "";
    const selectedSection = getSelectedSectionFor("subject");
    if (!selectedClass) {
      elements.subjectsList.innerHTML = `<p class="empty-table-message">Select a class to manage subjects.</p>`;
      return;
    }
    if (isGroupClass(selectedClass) && !selectedSection) {
      elements.subjectsList.innerHTML = `<p class="empty-table-message">Select a group/section to manage subjects.</p>`;
      return;
    }

    const subjects = getSubjectsForClassSection(selectedClass, selectedSection);
    const title = `Class ${selectedClass} ${isGroupClass(selectedClass) ? getSectionLabel(selectedSection) : GENERAL_SECTION}`;

    if (!subjects.length) {
      elements.subjectsList.innerHTML = `
        <div class="subject-empty-panel">
          <i class="fas fa-book-open"></i>
          <strong>No subject added for ${escapeHTML(title)}.</strong>
          <span>Add subjects with code and type. Result input will be generated from this list.</span>
        </div>
      `;
      return;
    }

    elements.subjectsList.innerHTML = subjects.map((subject) => `
      <div class="subject-chip subject-chip-detailed">
        <span>
          <strong>${escapeHTML(subject.name)}</strong>
          <small>${escapeHTML(subject.code ? `Code: ${subject.code}` : "No code")} • ${escapeHTML(formatSubjectType(subject.type))}</small>
        </span>
        <button type="button" data-subject="${escapeAttr(subject.name)}" title="Remove subject">
          <i class="fas fa-times"></i>
        </button>
      </div>
    `).join("");
  }

  async function addSubject() {
    const selectedClass = elements.subjectClass?.value || "";
    const selectedSection = getSelectedSectionFor("subject");
    const subjectName = elements.newSubjectName?.value.trim() || "";
    const subjectCode = elements.newSubjectCode?.value.trim() || "";
    const subjectType = elements.newSubjectType?.value || "compulsory";

    if (!selectedClass) return showSubjectStatus("Please select a class first.", "error");
    if (isGroupClass(selectedClass) && !selectedSection) return showSubjectStatus("Please select group/section first.", "error");
    if (!subjectName) return showSubjectStatus("Please enter a subject name.", "error");

    const subjects = getSubjectsForClassSection(selectedClass, selectedSection);
    const alreadyExists = subjects.some((subject) => subject.name.toLowerCase() === subjectName.toLowerCase());
    if (alreadyExists) return showSubjectStatus("This subject already exists for selected class/group.", "error");

    const newSubject = {
      name: subjectName,
      code: subjectCode,
      type: subjectType,
      sortOrder: subjects.length + 1,
      isActive: true
    };

    if (hasSupabaseClient()) {
      const { error } = await window.bhsSupabase.from("subjects").upsert({
        class_name: selectedClass,
        section_name: normalizeSectionForClass(selectedClass, selectedSection),
        subject_name: subjectName,
        subject_code: subjectCode || null,
        subject_type: subjectType,
        sort_order: subjects.length + 1,
        is_active: true
      }, { onConflict: "class_name,section_name,subject_name" });

      if (error) {
        console.error("Supabase subject add error:", error);
        showSubjectStatus(error.message || "Failed to add subject.", "error");
        return;
      }
      await reloadSubjectsFromSupabase();
    } else {
      setSubjectsForClassSection(selectedClass, selectedSection, [...subjects, newSubject]);
      saveToStorage(SUBJECTS_KEY, subjectsByClass);
    }

    if (elements.newSubjectName) elements.newSubjectName.value = "";
    if (elements.newSubjectCode) elements.newSubjectCode.value = "";
    renderSubjects();
    populateSubjectDropdown();
    showSubjectStatus("Subject added successfully.", "success");
  }

  async function removeSubject(subjectName) {
    const selectedClass = elements.subjectClass?.value || "";
    const selectedSection = getSelectedSectionFor("subject");
    if (!selectedClass) return;

    const confirmRemove = confirm(`Permanently delete subject: ${subjectName}?\n\nFuture calculation/ranking will use the remaining subjects for this class/group.`);
    if (!confirmRemove) return;

    if (hasSupabaseClient()) {
      const normalizedSection = normalizeSectionForClass(selectedClass, selectedSection);
      let deleteError = null;

      // Preferred path: database RPC deletes the subject and removes stale subject
      // keys from existing result JSON fields in one safe transaction.
      const rpcResponse = await window.bhsSupabase.rpc("delete_subject_and_cleanup_results", {
        p_class_name: selectedClass,
        p_section_name: normalizedSection,
        p_subject_name: subjectName
      });

      if (rpcResponse.error) {
        console.warn("Subject cleanup RPC unavailable or failed; falling back to subject-table delete only:", rpcResponse.error);
        const fallbackResponse = await window.bhsSupabase
          .from("subjects")
          .delete()
          .eq("class_name", selectedClass)
          .eq("section_name", normalizedSection)
          .eq("subject_name", subjectName);
        deleteError = fallbackResponse.error;
      }

      if (deleteError) {
        console.error("Supabase subject delete error:", deleteError);
        showSubjectStatus(deleteError.message || "Failed to delete subject.", "error");
        return;
      }
      await reloadSubjectsFromSupabase();
      await reloadResultsFromSupabase();
    } else {
      const remaining = getSubjectsForClassSection(selectedClass, selectedSection).filter((subject) => subject.name !== subjectName);
      setSubjectsForClassSection(selectedClass, selectedSection, remaining);
      saveToStorage(SUBJECTS_KEY, subjectsByClass);
    }

    renderSubjects();
    populateSubjectDropdown();
    renderManageResults();
    resetExportPreview();
    showSubjectStatus("Subject deleted permanently.", "success");
  }

  function handleSubjectActions(event) {
    const button = event.target.closest("button[data-subject]");
    if (!button) return;
    removeSubject(button.dataset.subject);
  }

  function normalizeReligion(value) {
    const text = String(value || "").trim().toLowerCase();
    if (text.includes("hindu")) return "Hindu";
    return "Islam";
  }

  function getSubjectByName(subjects, subjectName) {
    return normalizeSubjectArray(subjects).find((subject) => String(subject.name) === String(subjectName)) || null;
  }

  function subjectMatchesStudentReligion(student, subject) {
    const religion = normalizeReligion(student?.religion);
    const label = `${subject?.name || ""} ${subject?.code || ""}`.toLowerCase();
    if (religion === "Hindu") return label.includes("hindu") || label.includes("112");
    return label.includes("islam") || label.includes("111");
  }

  function subjectMatchesStudentOptional(student, subject) {
    const selectedName = String(student?.optionalSubjectName || "").trim().toLowerCase();
    const selectedCode = String(student?.optionalSubjectCode || "").trim().toLowerCase();
    const subjectName = String(subject?.name || "").trim().toLowerCase();
    const subjectCode = String(subject?.code || "").trim().toLowerCase();
    if (!selectedName && !selectedCode) return false;
    return (selectedName && selectedName === subjectName) || (selectedCode && selectedCode === subjectCode);
  }

  function isSubjectApplicableToStudent(student, subject) {
    const item = normalizeSubjectItem(subject);
    if (!item.name) return false;
    if (item.type === "religion") return subjectMatchesStudentReligion(student, item);
    if (item.type === "optional_4th") return subjectMatchesStudentOptional(student, item);
    return true;
  }

  function getApplicableSubjectsForStudent(student, subjectObjects) {
    return normalizeSubjectArray(subjectObjects).filter((subject) => isSubjectApplicableToStudent(student, subject));
  }

  function getResultSubjectObjects(result, subjectObjects) {
    const allSubjects = normalizeSubjectArray(subjectObjects);
    if (Array.isArray(result?.subjects) && result.subjects.length) {
      const resultNames = new Set(result.subjects.map((name) => String(name)));
      return allSubjects.filter((subject) => resultNames.has(subject.name));
    }
    return allSubjects;
  }

  /* =========================================================
     MARK ENTRY
  ========================================================= */

  function loadStudentsForResult(showMessage = true) {
    refreshData();
    const selectedClass = elements.resultClass?.value || "";
    const selectedSection = getSelectedSectionFor("result");
    const selectedSubject = elements.resultSubject?.value || "";
    const selectedYear = getSelectedExamYear();

    if (!selectedClass) {
      renderEmptyEntryTable("Please select a class first.");
      if (showMessage) showStatus("Please select a class first.", "error");
      return;
    }
    if (isGroupClass(selectedClass) && !selectedSection) {
      renderEmptyEntryTable("Please select group/section first.");
      if (showMessage) showStatus("Please select group/section first.", "error");
      return;
    }
    if (!selectedSubject) {
      renderEmptyEntryTable("Please select a subject first.");
      if (showMessage) showStatus("Please select a subject first.", "error");
      return;
    }

    const subjectObjects = getSubjectsForClassSection(selectedClass, selectedSection);
    const selectedSubjectObject = getSubjectByName(subjectObjects, selectedSubject);
    currentLoadedStudents = getClassStudents(selectedClass, selectedYear, selectedSection)
      .filter((student) => !selectedSubjectObject || isSubjectApplicableToStudent(student, selectedSubjectObject));

    if (!currentLoadedStudents.length) {
      renderEmptyEntryTable(`No students found for Class ${selectedClass}${getSectionSuffix(selectedClass, selectedSection)}, Exam Year ${selectedYear} with selected subject.`);
      if (showMessage) showStatus("No students found for selected class/year/group/subject.", "error");
      return;
    }

    renderSubjectMarkEntryTable(selectedClass, selectedSection, selectedSubject);
    if (showMessage) showStatus(`${currentLoadedStudents.length} student(s) loaded.`, "success");
  }

  function renderEmptyEntryTable(message) {
    if (elements.resultEntryHead) elements.resultEntryHead.innerHTML = "";
    if (elements.resultEntryBody) {
      elements.resultEntryBody.innerHTML = `<tr><td colspan="11" class="empty-table-message">${escapeHTML(message)}</td></tr>`;
    }
  }

  function renderSubjectMarkEntryTable(className, sectionName, subjectName) {
    const selectedYear = getSelectedExamYear();
    elements.resultEntryHead.innerHTML = `
      <tr>
        <th>SL</th>
        <th>Name</th>
        <th>Roll</th>
        ${isGroupClass(className) ? "<th>Group</th>" : ""}
        <th>MCQ</th>
        <th>Written</th>
        <th>Practical<br><small>Optional</small></th>
        <th>Total</th>
        <th>Point</th>
        <th>Grade</th>
        <th>Status</th>
      </tr>
    `;

    elements.resultEntryBody.innerHTML = currentLoadedStudents.map((student, index) => {
      const savedResult = findResult(student.id, className, selectedYear, sectionName);
      const savedSubjectMark = normalizeSubjectMark(savedResult?.marks?.[subjectName]);
      const hasSavedMark = isCompleteSubjectMark(savedSubjectMark);
      const gradeInfo = hasSavedMark ? getSubjectGradeInfo(savedSubjectMark.total) : { grade: "-", point: "-" };
      return `
        <tr data-student-id="${escapeAttr(student.id)}" data-subject="${escapeAttr(subjectName)}">
          <td>${index + 1}</td>
          <td>${escapeHTML(student.name)}</td>
          <td>${escapeHTML(student.roll)}</td>
          ${isGroupClass(className) ? `<td><span class="section-pill">${escapeHTML(getStudentSection(student))}</span></td>` : ""}
          <td><input type="number" min="0" max="100" step="0.01" class="mark-input part-input" data-part="mcq" value="${hasValue(savedSubjectMark.mcq) ? escapeAttr(savedSubjectMark.mcq) : ""}" placeholder="0" /></td>
          <td><input type="number" min="0" max="100" step="0.01" class="mark-input part-input" data-part="written" value="${hasValue(savedSubjectMark.written) ? escapeAttr(savedSubjectMark.written) : ""}" placeholder="0" /></td>
          <td><input type="number" min="0" max="100" step="0.01" class="mark-input part-input" data-part="practical" value="${hasValue(savedSubjectMark.practical) && Number(savedSubjectMark.practical) !== 0 ? escapeAttr(savedSubjectMark.practical) : ""}" placeholder="Optional" /></td>
          <td class="subject-total-cell">${hasSavedMark ? escapeHTML(formatNumber(savedSubjectMark.total)) : "-"}</td>
          <td class="subject-point-cell">${hasSavedMark ? escapeHTML(gradeInfo.point) : "-"}</td>
          <td class="subject-grade-cell">${hasSavedMark ? escapeHTML(gradeInfo.grade) : "-"}</td>
          <td><span class="mark-status ${hasSavedMark ? "saved" : "pending"}">${hasSavedMark ? "Saved" : "Pending"}</span></td>
        </tr>
      `;
    }).join("");
  }

  function handleMarkInputChange(event) {
    const input = event.target.closest(".part-input");
    if (!input) return;
    const row = input.closest("tr[data-student-id]");
    if (row) updateEntryRowCalculation(row);
  }

  function updateEntryRowCalculation(row) {
    const mark = readSubjectMarkFromRow(row);
    const statusCell = row.querySelector(".mark-status");
    const totalCell = row.querySelector(".subject-total-cell");
    const pointCell = row.querySelector(".subject-point-cell");
    const gradeCell = row.querySelector(".subject-grade-cell");
    const hasAny = hasAnySubjectInput(mark);

    if (!hasAny) {
      totalCell.textContent = "-";
      pointCell.textContent = "-";
      gradeCell.textContent = "-";
      setRowStatus(statusCell, "Pending", "pending");
      return;
    }
    if (!isValidRequiredMark(mark.mcq) || !isValidRequiredMark(mark.written)) {
      totalCell.textContent = "-";
      pointCell.textContent = "-";
      gradeCell.textContent = "-";
      setRowStatus(statusCell, "MCQ + Written required", "error");
      return;
    }
    if (!isValidOptionalMark(mark.practical)) {
      totalCell.textContent = "-";
      pointCell.textContent = "-";
      gradeCell.textContent = "-";
      setRowStatus(statusCell, "Invalid", "error");
      return;
    }

    const completed = buildCompletedSubjectMark(mark);
    if (completed.total > 100) {
      totalCell.textContent = formatNumber(completed.total);
      pointCell.textContent = "-";
      gradeCell.textContent = "-";
      setRowStatus(statusCell, "Total > 100", "error");
      return;
    }

    totalCell.textContent = formatNumber(completed.total);
    pointCell.textContent = completed.point;
    gradeCell.textContent = completed.grade;
    setRowStatus(statusCell, "Ready", "ready");
  }

  async function saveSubjectMarks() {
    const selectedClass = elements.resultClass?.value || "";
    const selectedSection = getSelectedSectionFor("result");
    const selectedSubject = elements.resultSubject?.value || "";
    const selectedYear = getSelectedExamYear();

    if (!selectedClass || !selectedSubject) return showStatus("Please select class/group and subject first.", "error");
    if (isGroupClass(selectedClass) && !selectedSection) return showStatus("Please select group/section first.", "error");
    if (!currentLoadedStudents.length) return showStatus("No students loaded to save marks.", "error");

    const subjectObjects = getSubjectsForClassSection(selectedClass, selectedSection);
    const rows = elements.resultEntryBody.querySelectorAll("tr[data-student-id]");

    let savedCount = 0;
    let invalidCount = 0;
    let editedPublishedCount = 0;
    const localUpdates = [];
    const supabasePayloads = [];
    const now = new Date().toISOString();

    rows.forEach((row) => {
      const studentId = row.dataset.studentId;
      const student = currentLoadedStudents.find((item) => String(item.id) === String(studentId));
      if (!student) return;
      const rawMark = readSubjectMarkFromRow(row);
      if (!hasAnySubjectInput(rawMark)) return;
      if (!canSaveSubjectMark(rawMark)) {
        invalidCount += 1;
        updateEntryRowCalculation(row);
        return;
      }
      const completedMark = buildCompletedSubjectMark(rawMark);
      if (completedMark.total > 100) {
        invalidCount += 1;
        updateEntryRowCalculation(row);
        return;
      }

      const rowSection = normalizeSectionForClass(selectedClass, selectedSection || getStudentSection(student));
      const applicableSubjects = getApplicableSubjectsForStudent(student, subjectObjects);
      const allSubjects = applicableSubjects.map((subject) => subject.name);
      const existingResult = findResult(studentId, selectedClass, selectedYear, rowSection);
      const publishMeta = getPublishMetaForSave(existingResult, now);
      if (publishMeta.wasPublished) editedPublishedCount += 1;

      const marks = existingResult?.marks ? { ...existingResult.marks } : {};
      marks[selectedSubject] = completedMark;
      const summary = calculateSummary(marks, applicableSubjects);
      const localResult = {
        id: existingResult?.id || createResultId(studentId, selectedClass, selectedYear),
        studentId: student.id,
        name: student.name,
        roll: student.roll,
        className: selectedClass,
        sectionName: rowSection,
        year: selectedYear,
        examName: FINAL_EXAM_NAME,
        subjects: allSubjects,
        marks,
        subjectGrades: buildSubjectGrades(marks, applicableSubjects),
        totalMarks: summary.totalMarks,
        average: summary.average,
        gpa: summary.gpa,
        totalPoint: summary.totalPoint,
        rankingScore: Number(summary.gpa),
        finalGrade: summary.finalGrade,
        completedSubjects: summary.completedSubjects,
        totalSubjects: allSubjects.length,
        publishStatus: publishMeta.publishStatus,
        isPublished: publishMeta.isPublished,
        publishedAt: publishMeta.publishedAt,
        lastEditedAfterPublishAt: publishMeta.lastEditedAfterPublishAt,
        createdAt: existingResult?.createdAt || now,
        updatedAt: now
      };
      localUpdates.push(localResult);
      supabasePayloads.push({
        student_id: student.id,
        name_snapshot: student.name,
        roll_snapshot: student.roll,
        class_name: selectedClass,
        section_name: rowSection,
        academic_year: selectedYear,
        exam_name: FINAL_EXAM_NAME,
        subjects: allSubjects,
        marks,
        subject_grades: localResult.subjectGrades,
        total_marks: summary.totalMarks,
        average: summary.average,
        gpa: Number(summary.gpa),
        total_point: summary.totalPoint,
        ranking_score: Number(summary.gpa),
        final_grade: summary.finalGrade,
        completed_subjects: summary.completedSubjects,
        total_subjects: allSubjects.length,
        publish_status: publishMeta.publishStatus,
        is_published: publishMeta.isPublished,
        published_at: publishMeta.publishedAt,
        last_edited_after_publish_at: publishMeta.wasPublished ? now : publishMeta.lastEditedAfterPublishAt,
        unpublished_at: publishMeta.wasPublished ? now : null,
        unpublished_reason: publishMeta.wasPublished ? "Edited after publish" : null
      });
      savedCount += 1;
    });

    if (!savedCount) return showStatus(invalidCount ? "Please fix invalid marks first." : "No marks found to save.", "error");
    setSavingState(true);

    if (hasSupabaseClient()) {
      const { error } = await window.bhsSupabase.from("results").upsert(supabasePayloads, { onConflict: "student_id,academic_year,class_name,exam_name" });
      setSavingState(false);
      if (error) {
        console.error("Supabase result save error:", error);
        showStatus(error.message || "Failed to save marks.", "error");
        return;
      }
      await reloadResultsFromSupabase();
    } else {
      localUpdates.forEach((resultItem) => upsertLocalResult(resultItem));
      saveToStorage(RESULTS_KEY, results);
      setSavingState(false);
    }

    const publishEditNote = editedPublishedCount ? ` ${editedPublishedCount} published result(s) moved back to Draft. Re-publish after correction.` : "";
    showStatus(`${savedCount} student mark(s) saved successfully.${publishEditNote}${invalidCount ? ` ${invalidCount} invalid row(s) skipped.` : ""}`, "success");
    renderManageResults();
    loadStudentsForResult(false);
    resetExportPreview();
  }

  function clearMarks() {
    document.querySelectorAll(".part-input").forEach((input) => { input.value = ""; });
    document.querySelectorAll(".subject-total-cell, .subject-point-cell, .subject-grade-cell").forEach((cell) => { cell.textContent = "-"; });
    document.querySelectorAll(".mark-status").forEach((cell) => setRowStatus(cell, "Pending", "pending"));
    showStatus("Marks cleared from current view only.", "success");
  }

  /* =========================================================
     MANAGE RESULTS
  ========================================================= */

  function setupManageResultTableHead() {
    if (!elements.manageResultHead) return;
    elements.manageResultHead.innerHTML = `
      <tr>
        <th>Rank</th>
        <th>Name</th>
        <th>Roll</th>
        <th>Class</th>
        <th>Group</th>
        <th>Total Marks</th>
        <th>GPA</th>
        <th>Total Point</th>
        <th>Grade</th>
        <th>Status</th>
        <th>Action</th>
      </tr>
    `;
  }

  function renderManageResults() {
    refreshData();
    setupManageResultTableHead();
    const selectedYear = getSelectedExamYear();
    const selectedClass = elements.manageClassFilter?.value || "";
    const selectedSection = getSelectedSectionFor("manage", true);
    const searchText = elements.manageResultSearch?.value.trim().toLowerCase() || "";

    if (!selectedClass) {
      hideManageTable();
      if (elements.manageResultSubtitle) elements.manageResultSubtitle.textContent = `Select a class to view GPA ranking for Exam Year ${selectedYear}.`;
      elements.manageResultsBody.innerHTML = `<tr><td colspan="11" class="empty-table-message">Select a class first.</td></tr>`;
      return;
    }

    showManageTable();
    if (elements.manageResultSubtitle) {
      elements.manageResultSubtitle.textContent = `Showing Class ${selectedClass}${getSectionSuffix(selectedClass, selectedSection, true)} GPA ranking for Final Exam, Exam Year ${selectedYear}.`;
    }

    const classStudents = getClassStudents(selectedClass, selectedYear, selectedSection);
    if (!classStudents.length) {
      elements.manageResultsBody.innerHTML = `<tr><td colspan="11" class="empty-table-message">No students found in Class ${selectedClass}${getSectionSuffix(selectedClass, selectedSection, true)}, Exam Year ${selectedYear}.</td></tr>`;
      return;
    }

    let rankedRows = buildRankedManageRows(classStudents, selectedClass, selectedYear, selectedSection);
    if (searchText) {
      rankedRows = rankedRows.filter((row) => String(row.student.name || "").toLowerCase().includes(searchText) || String(row.student.roll || "").toLowerCase().includes(searchText));
    }
    if (!rankedRows.length) {
      elements.manageResultsBody.innerHTML = `<tr><td colspan="11" class="empty-table-message">No matching student found.</td></tr>`;
      return;
    }
    elements.manageResultsBody.innerHTML = rankedRows.map((row) => renderManageResultRow(row, selectedClass)).join("");
  }

  function renderManageResultRow(row, selectedClass) {
    const student = row.student;
    const result = row.result;
    const sectionName = result?.sectionName || getStudentSection(student);
    const subjects = getApplicableSubjectsForStudent(student, getSubjectsForClassSection(selectedClass, sectionName));
    const isComplete = result ? hasAllSubjectMarks(result, subjects) : false;
    const viewButton = result ? `<button type="button" class="btn btn-info btn-xs" data-action="view" data-id="${escapeAttr(result.id)}"><i class="fas fa-eye"></i> View</button>` : "";
    const isPublished = result && isResultPublished(result);
    const editButton = `<button type="button" class="btn btn-warning btn-xs" data-action="edit" data-id="${escapeAttr(result ? result.id : "")}" data-student-id="${escapeAttr(student.id)}" data-class-name="${escapeAttr(selectedClass)}" data-section-name="${escapeAttr(sectionName)}"><i class="fas fa-edit"></i> ${isPublished ? "Edit Published" : result ? "Edit" : "Add"}</button>`;
    const unpublishButton = isPublished ? `<button type="button" class="btn btn-danger btn-xs" data-action="unpublishOne" data-id="${escapeAttr(result.id)}"><i class="fas fa-rotate-left"></i> Make Draft</button>` : "";

    return `
      <tr>
        <td>${escapeHTML(row.rank)}</td>
        <td>${escapeHTML(student.name)}</td>
        <td>${escapeHTML(student.roll)}</td>
        <td>Class ${escapeHTML(selectedClass)}</td>
        <td><span class="section-pill">${escapeHTML(sectionName)}</span></td>
        <td>${escapeHTML(result ? result.totalMarks : "-")}</td>
        <td>${escapeHTML(result ? formatGpa(result.gpa) : "-")}</td>
        <td>${escapeHTML(result ? formatNumber(result.totalPoint || 0) : "-")}</td>
        <td>${escapeHTML(result ? result.finalGrade : "-")}</td>
        <td><span class="${getPublishBadgeClass(result, isComplete)}">${escapeHTML(getPublishStatusText(result, isComplete))}</span></td>
        <td><div class="table-action-buttons">${viewButton}${editButton}${unpublishButton}</div></td>
      </tr>
    `;
  }

  function buildRankedManageRows(classStudents, className, year, sectionName = "") {
    const rows = classStudents.map((student) => {
      const studentSection = normalizeSectionForClass(className, sectionName || getStudentSection(student));
      const subjectObjects = getApplicableSubjectsForStudent(student, getSubjectsForClassSection(className, studentSection));
      const result = findResult(student.id, className, year, studentSection);
      const complete = result ? hasAllSubjectMarks(result, subjectObjects) : false;
      return { student, result, applicableSubjects: subjectObjects, isComplete: complete, rank: "-", rankingScoreValue: complete ? getRankingScoreValue(result) : null, totalMarkValue: complete ? Number(result.totalMarks || 0) : null };
    });
    return rankRows(rows);
  }

  function rankRows(rows) {
    const completeRows = rows.filter((row) => row.result && row.isComplete).sort((a, b) => {
      if (b.rankingScoreValue !== a.rankingScoreValue) return b.rankingScoreValue - a.rankingScoreValue;
      if (b.totalMarkValue !== a.totalMarkValue) return b.totalMarkValue - a.totalMarkValue;
      return getRollNumber(a.student.roll) - getRollNumber(b.student.roll);
    });
    let currentRank = 0;
    let previousScore = null;
    let previousTotal = null;
    completeRows.forEach((row, index) => {
      const samePosition = previousScore === row.rankingScoreValue && previousTotal === row.totalMarkValue;
      if (!samePosition) currentRank = index + 1;
      row.rank = currentRank;
      previousScore = row.rankingScoreValue;
      previousTotal = row.totalMarkValue;
    });
    const incompleteRows = rows.filter((row) => !row.result || !row.isComplete).sort((a, b) => getRollNumber(a.student.roll) - getRollNumber(b.student.roll));
    return [...completeRows, ...incompleteRows];
  }

  async function handleManageResultActions(event) {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const action = button.dataset.action;
    if (action === "view") viewResult(button.dataset.id);
    if (action === "edit") await editResult(button.dataset.id, button.dataset.studentId, button.dataset.className, button.dataset.sectionName);
    if (action === "unpublishOne") await unpublishSingleResult(button.dataset.id, true);
  }

  async function editResult(id, studentId, className, sectionName) {
    refreshData();
    const result = id ? results.find((item) => String(item.id) === String(id)) : null;
    const selectedClass = result ? result.className : className;
    const selectedSection = normalizeSectionForClass(selectedClass, result ? result.sectionName : sectionName);
    const targetStudentId = result ? result.studentId : studentId;
    if (!selectedClass || !targetStudentId) return showStatus("Student result not found for editing.", "error");
    if (result && isResultPublished(result)) {
      const allowEdit = confirm("This result is already published. To edit it safely, it will be moved back to Draft. Continue?");
      if (!allowEdit) return;
      await unpublishSingleResult(result.id, false);
      refreshData();
    }
    const targetStudent = students.find((item) => String(item.id) === String(targetStudentId));
    const subjects = targetStudent ? getApplicableSubjectsForStudent(targetStudent, getSubjectsForClassSection(selectedClass, selectedSection)) : getSubjectsForClassSection(selectedClass, selectedSection);
    if (!subjects.length) return showStatus("No applicable subject found for this student. Check religion/optional subject setup.", "error");

    showTab("addResult");
    elements.resultClass.value = selectedClass;
    updateSectionControl(elements.resultClass, elements.resultSectionGroup, elements.resultSection, false);
    if (elements.resultSection) elements.resultSection.value = selectedSection;
    populateSubjectDropdown();
    const firstSavedSubject = result ? subjects.find((subject) => isCompleteSubjectMark(normalizeSubjectMark(result.marks?.[subject.name]))) : null;
    elements.resultSubject.value = firstSavedSubject?.name || subjects[0].name;
    loadStudentsForResult(false);
    highlightEditingStudent(targetStudentId);
    showStatus("Now edit this student's marks from Add Result section.", "success");
  }

  function hideManageTable() {
    if (!elements.manageResultTableWrap) return;
    elements.manageResultTableWrap.hidden = true;
    elements.manageResultTableWrap.style.display = "none";
  }
  function showManageTable() {
    if (!elements.manageResultTableWrap) return;
    elements.manageResultTableWrap.hidden = false;
    elements.manageResultTableWrap.style.display = "";
  }

  function highlightEditingStudent(studentId) {
    const targetRow = Array.from(elements.resultEntryBody.querySelectorAll("tr[data-student-id]")).find((row) => String(row.dataset.studentId) === String(studentId));
    if (!targetRow) return;
    document.querySelectorAll(".editing-row").forEach((row) => row.classList.remove("editing-row"));
    targetRow.classList.add("editing-row");
    targetRow.scrollIntoView({ behavior: "smooth", block: "center" });
    const input = targetRow.querySelector(".part-input");
    if (input) { input.focus(); input.select(); }
  }

  /* =========================================================
     REPORT / PUBLISH / EXPORT
  ========================================================= */

  function getReportData() {
    refreshData();
    const selectedClass = elements.exportClass?.value || "";
    const selectedSection = getSelectedSectionFor("export");
    const selectedYear = getSelectedExamYear();
    if (!selectedClass) return [];
    if (isGroupClass(selectedClass) && !selectedSection) return [];

    const classStudents = getClassStudents(selectedClass, selectedYear, selectedSection);
    const reportRows = classStudents.map((student) => {
      const rowSection = normalizeSectionForClass(selectedClass, selectedSection || getStudentSection(student));
      const subjects = getApplicableSubjectsForStudent(student, getSubjectsForClassSection(selectedClass, rowSection));
      const result = findResult(student.id, selectedClass, selectedYear, rowSection);
      const isComplete = result ? hasAllSubjectMarks(result, subjects) : false;
      return { student, result, applicableSubjects: subjects, isComplete, rank: "-", rankingScoreValue: result && isComplete ? getRankingScoreValue(result) : null, totalMarkValue: result && isComplete ? Number(result.totalMarks || 0) : null };
    });
    return rankRows(reportRows);
  }

  function previewReport(showMessage = true) {
    const selectedClass = elements.exportClass?.value || "";
    const selectedSection = getSelectedSectionFor("export");
    const selectedYear = getSelectedExamYear();
    if (isGroupClass(selectedClass) && !selectedSection) {
      elements.reportPreview.innerHTML = `<p class="empty-table-message">Select group/section first.</p>`;
      updatePublishButtonState(false);
      return;
    }
    const reportRows = getReportData();
    if (!reportRows.length) {
      elements.reportPreview.innerHTML = `<p class="empty-table-message">No student/result found for selected class/group.</p>`;
      updatePublishButtonState(false);
      updateClassEditButtonState(false);
      updateUnpublishButtonState(false);
      if (showMessage) showExportStatus("No student/result data available for preview.", "error");
      return;
    }

    const subjects = getSubjectsForClassSection(selectedClass, selectedSection);
    const reportStatus = getClassReportStatus(reportRows);
    const validation = validateClassReport(reportRows, subjects);
    elements.reportPreview.innerHTML = `
      <div class="report-card" id="reportContent">
        <div class="report-header">
          <h2>Baralai High School</h2>
          <p>Final Exam GPA Ranking Report</p>
          <p>Class ${escapeHTML(selectedClass)}${escapeHTML(getSectionSuffix(selectedClass, selectedSection))} | Exam Year ${escapeHTML(selectedYear)} | Status: ${escapeHTML(reportStatus.label)}</p>
        </div>
        ${renderReportSummary(reportRows, reportStatus, validation)}
        ${renderPublishNote(validation)}
        ${renderRankingReportTable(reportRows, subjects)}
      </div>
    `;
    updatePublishButtonState(validation.isValid && reportStatus.draftCount > 0);
    updateClassEditButtonState(reportRows.some((row) => row.result));
    updateUnpublishButtonState(reportStatus.publishedCount > 0);
    if (validation.isValid && reportStatus.draftCount > 0) showExportStatus("Preview ready. You can publish this result now.", "success");
    else if (validation.isValid && reportStatus.draftCount === 0) showExportStatus("This result is already published.", "success");
    else showExportStatus("Preview ready, but publishing is blocked because some marks are incomplete.", "error");
  }

  function renderReportSummary(reportRows, reportStatus, validation) {
    const completeRows = reportRows.filter((row) => row.result && row.isComplete);
    const highestGpa = completeRows.length ? Math.max(...completeRows.map((row) => Number(row.result.gpa || 0))) : 0;
    return `
      <div class="report-summary-grid">
        <div class="report-summary-item"><span>Total Students</span><strong>${reportRows.length}</strong></div>
        <div class="report-summary-item"><span>Highest GPA</span><strong>${formatGpa(highestGpa)}</strong></div>
        <div class="report-summary-item"><span>Published</span><strong>${reportStatus.publishedCount}</strong></div>
        <div class="report-summary-item"><span>Incomplete</span><strong>${validation.incompleteCount}</strong></div>
      </div>
    `;
  }

  function renderPublishNote(validation) {
    if (validation.isValid) return `<div class="publish-note success-note"><i class="fas fa-check-circle"></i>This report is ready to publish.</div>`;
    return `<div class="publish-note warning-note"><i class="fas fa-triangle-exclamation"></i>Some students have incomplete subject marks. Complete all subject marks before publishing.</div>`;
  }

  function renderRankingReportTable(reportRows, subjects) {
    const minWidth = Math.max(1280, 820 + (subjects.length * 142));
    return `
      <div class="table-responsive result-wide-scroll">
        <table class="table report-table ranking-report-table" style="--ranking-table-min-width:${minWidth}px">
          <thead>
            <tr>
              <th class="rank-col">Rank</th>
              <th class="name-col">Name</th>
              <th class="roll-col">Roll</th>
              <th class="group-col">Group</th>
              ${subjects.map((subject) => `<th class="subject-col"><span class="report-subject-head"><strong>${escapeHTML(buildSubjectLabel(subject))}</strong><small>Total / Point / Grade</small></span></th>`).join("")}
              <th class="total-col">Total Marks</th>
              <th class="gpa-col">GPA</th>
              <th class="point-col">Total Point</th>
              <th class="grade-col">Grade</th>
              <th class="status-col">Status</th>
            </tr>
          </thead>
          <tbody>${reportRows.map((row) => renderRankingReportRow(row, subjects)).join("")}</tbody>
        </table>
      </div>
    `;
  }

  function renderRankingReportRow(row, subjects) {
    const result = row.result;
    const student = row.student;
    return `
      <tr>
        <td class="rank-col">${escapeHTML(row.rank)}</td>
        <td class="name-col student-name-cell">${escapeHTML(result ? result.name : student.name)}</td>
        <td class="roll-col">${escapeHTML(result ? result.roll : student.roll)}</td>
        <td class="group-col">${escapeHTML(result?.sectionName || getStudentSection(student))}</td>
        ${subjects.map((subject) => `<td class="subject-col subject-mark-cell">${escapeHTML(isSubjectApplicableToStudent(student, subject) ? (result ? getSubjectDisplay(result, subject.name) : "-") : "N/A")}</td>`).join("")}
        <td class="total-col">${escapeHTML(result ? result.totalMarks : "-")}</td>
        <td class="gpa-col">${escapeHTML(result ? formatGpa(result.gpa) : "-")}</td>
        <td class="point-col">${escapeHTML(result ? formatNumber(result.totalPoint || 0) : "-")}</td>
        <td class="grade-col">${escapeHTML(result ? result.finalGrade : "-")}</td>
        <td class="status-col"><span class="${getPublishBadgeClass(result, row.isComplete)}">${escapeHTML(getPublishStatusText(result, row.isComplete))}</span></td>
      </tr>
    `;
  }

  function downloadReportPDF() {
    const reportRows = getReportData();
    if (!reportRows.length) return showExportStatus("No Final Exam result data available for PDF.", "error");
    if (!window.jspdf || !window.jspdf.jsPDF) return showExportStatus("jsPDF library not loaded.", "error");
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF("l", "mm", "a4");
    const selectedClass = elements.exportClass.value;
    const selectedSection = getSelectedSectionFor("export");
    const selectedYear = getSelectedExamYear();
    const subjects = getSubjectsForClassSection(selectedClass, selectedSection);
    const reportStatus = getClassReportStatus(reportRows);
    doc.setFontSize(16);
    doc.text("Baralai High School", 14, 15);
    doc.setFontSize(11);
    doc.text(`Final Exam GPA Ranking - Class ${selectedClass}${getSectionSuffix(selectedClass, selectedSection)} - Exam Year ${selectedYear} - ${reportStatus.label}`, 14, 23);
    const headers = ["Rank", "Name", "Roll", "Group", ...subjects.map(buildSubjectLabel), "Total Marks", "GPA", "Total Point", "Grade", "Status"];
    const body = reportRows.map((row) => {
      const result = row.result;
      const student = row.student;
      return [row.rank, result ? result.name : student.name, result ? result.roll : student.roll, result?.sectionName || getStudentSection(student), ...subjects.map((subject) => isSubjectApplicableToStudent(student, subject) ? (result ? getSubjectDisplay(result, subject.name) : "-") : "N/A"), result ? result.totalMarks : "-", result ? formatGpa(result.gpa) : "-", result ? formatNumber(result.totalPoint || 0) : "-", result ? result.finalGrade : "-", getPublishStatusText(result, row.isComplete)];
    });
    doc.autoTable({ startY: 30, head: [headers], body, styles: { fontSize: 7, cellPadding: 1.6 }, headStyles: { fillColor: [0, 51, 102], textColor: 255 } });
    doc.save(`gpa-ranking-result-class-${selectedClass}${selectedSection ? `-${selectedSection}` : ""}-${selectedYear}.pdf`);
  }

  function downloadReportExcel() {
    const reportRows = getReportData();
    if (!reportRows.length) return showExportStatus("No Final Exam result data available for Excel.", "error");
    if (!window.XLSX) return showExportStatus("XLSX library not loaded.", "error");
    const selectedClass = elements.exportClass.value;
    const selectedSection = getSelectedSectionFor("export");
    const selectedYear = getSelectedExamYear();
    const subjects = getSubjectsForClassSection(selectedClass, selectedSection);
    const data = reportRows.map((row) => {
      const result = row.result;
      const student = row.student;
      const excelRow = { Rank: row.rank, Name: result ? result.name : student.name, Roll: result ? result.roll : student.roll, Group: result?.sectionName || getStudentSection(student) };
      subjects.forEach((subject) => {
        const applicable = isSubjectApplicableToStudent(student, subject);
        const mark = normalizeSubjectMark(result?.marks?.[subject.name]);
        const grade = applicable && isCompleteSubjectMark(mark) ? getSubjectGradeInfo(mark.total) : null;
        const label = subject.code ? `${subject.name} (${subject.code})` : subject.name;
        excelRow[`${label} MCQ`] = applicable && result ? getPartValue(mark.mcq) : "N/A";
        excelRow[`${label} Written`] = applicable && result ? getPartValue(mark.written) : "N/A";
        excelRow[`${label} Practical`] = applicable && result ? getPartValue(mark.practical) : "N/A";
        excelRow[`${label} Total`] = grade ? formatNumber(mark.total) : applicable ? "-" : "N/A";
        excelRow[`${label} Point`] = grade ? grade.point : applicable ? "-" : "N/A";
        excelRow[`${label} Grade`] = grade ? grade.grade : applicable ? "-" : "N/A";
      });
      excelRow["Total Marks"] = result ? result.totalMarks : "-";
      excelRow.GPA = result ? formatGpa(result.gpa) : "-";
      excelRow["Total Point"] = result ? formatNumber(result.totalPoint || 0) : "-";
      excelRow["Final Grade"] = result ? result.finalGrade : "-";
      excelRow.Status = getPublishStatusText(result, row.isComplete);
      return excelRow;
    });
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "GPA Ranking Result");
    XLSX.writeFile(workbook, `gpa-ranking-result-class-${selectedClass}${selectedSection ? `-${selectedSection}` : ""}-${selectedYear}.xlsx`);
  }

  async function publishClassResults() {
    const selectedClass = elements.exportClass?.value || "";
    const selectedSection = getSelectedSectionFor("export");
    const selectedYear = getSelectedExamYear();
    if (!selectedClass) return showExportStatus("Please select a class first.", "error");
    if (isGroupClass(selectedClass) && !selectedSection) return showExportStatus("Please select group/section first.", "error");
    const reportRows = getReportData();
    const subjects = getSubjectsForClassSection(selectedClass, selectedSection);
    const validation = validateClassReport(reportRows, subjects);
    if (!reportRows.length) return showExportStatus("No result found to publish.", "error");
    if (!validation.isValid) {
      updatePublishButtonState(false);
      return showExportStatus("Cannot publish. Some students have incomplete subject marks.", "error");
    }
    const confirmPublish = confirm(`Publish Class ${selectedClass}${getSectionSuffix(selectedClass, selectedSection)} Final Exam result for Exam Year ${selectedYear}?`);
    if (!confirmPublish) return;
    const now = new Date().toISOString();
    const publishIds = reportRows.filter((row) => row.result && row.isComplete).map((row) => row.result.id);
    if (hasSupabaseClient()) {
      const uuidPublishIds = publishIds.filter(isUuid);
      const { error } = await window.bhsSupabase.from("results").update({ publish_status: "published", is_published: true, published_at: now }).in("id", uuidPublishIds);
      if (error) return showExportStatus(error.message || "Failed to publish result.", "error");
      await reloadResultsFromSupabase();
    } else {
      results = results.map((result) => publishIds.includes(result.id) ? { ...result, publishStatus: "published", isPublished: true, publishedAt: now, updatedAt: now } : result);
      saveToStorage(RESULTS_KEY, results);
    }
    showExportStatus(`Class ${selectedClass}${getSectionSuffix(selectedClass, selectedSection)} result published successfully. Total ${publishIds.length} result(s) published.`, "success");
    updatePublishButtonState(false);
    previewReport(false);
    renderManageResults();
  }

  async function unpublishClassResults() {
    const selectedClass = elements.exportClass?.value || "";
    const selectedSection = getSelectedSectionFor("export");
    const selectedYear = getSelectedExamYear();
    if (!selectedClass) return showExportStatus("Please select a class first.", "error");
    if (isGroupClass(selectedClass) && !selectedSection) return showExportStatus("Please select group/section first.", "error");
    const reportRows = getReportData();
    const publishedRows = reportRows.filter((row) => row.result && isResultPublished(row.result));
    if (!publishedRows.length) return showExportStatus("No published result found to undo.", "error");
    const confirmUndo = confirm(`Undo publish for Class ${selectedClass}${getSectionSuffix(selectedClass, selectedSection)}, Exam Year ${selectedYear}?`);
    if (!confirmUndo) return;
    await unpublishRows(publishedRows, "Manual class/group edit/undo publish");
    showExportStatus(`Class ${selectedClass}${getSectionSuffix(selectedClass, selectedSection)} result moved back to Draft.`, "success");
    previewReport(false);
    renderManageResults();
  }

  async function startWholeClassEdit() {
    const selectedClass = elements.exportClass?.value || "";
    const selectedSection = getSelectedSectionFor("export");
    const selectedYear = getSelectedExamYear();
    if (!selectedClass) return showExportStatus("Please select a class first.", "error");
    if (isGroupClass(selectedClass) && !selectedSection) return showExportStatus("Please select group/section first.", "error");
    const subjects = getSubjectsForClassSection(selectedClass, selectedSection);
    if (!subjects.length) return showExportStatus("No subject found for this class/group. Add subject first.", "error");
    const reportRows = getReportData();
    const publishedRows = reportRows.filter((row) => row.result && isResultPublished(row.result));
    if (publishedRows.length) {
      const confirmEdit = confirm("This class/group has published results. Published results will be moved back to Draft. Continue?");
      if (!confirmEdit) return;
      await unpublishRows(publishedRows, "Whole class/group edit started");
    }
    showTab("addResult");
    elements.resultClass.value = selectedClass;
    updateSectionControl(elements.resultClass, elements.resultSectionGroup, elements.resultSection, false);
    if (elements.resultSection) elements.resultSection.value = selectedSection;
    populateSubjectDropdown();
    elements.resultSubject.value = subjects[0].name;
    loadStudentsForResult(false);
    showStatus(`Class ${selectedClass}${getSectionSuffix(selectedClass, selectedSection)} result is ready for editing.`, "success");
  }

  async function unpublishSingleResult(id, showMessage = true) {
    const result = results.find((item) => String(item.id) === String(id));
    if (!result) {
      if (showMessage) showStatus("Result not found.", "error");
      return false;
    }
    if (!isResultPublished(result)) {
      if (showMessage) showStatus("This result is already in Draft.", "error");
      return true;
    }
    if (showMessage && !confirm(`Move ${result.name}'s published result back to Draft for editing?`)) return false;
    await unpublishRows([{ result }], "Individual result edit/undo publish");
    if (showMessage) showStatus("Published result moved back to Draft. You can edit and re-publish it.", "success");
    renderManageResults();
    resetExportPreview();
    return true;
  }

  async function unpublishRows(rows, reason) {
    const now = new Date().toISOString();
    const ids = rows.map((row) => row.result.id);
    if (hasSupabaseClient()) {
      const uuidIds = ids.filter(isUuid);
      const { error } = await window.bhsSupabase.from("results").update({ publish_status: "draft", is_published: false, published_at: null, unpublished_at: now, unpublished_reason: reason }).in("id", uuidIds);
      if (error) throw error;
      await reloadResultsFromSupabase();
    } else {
      results = results.map((result) => ids.includes(result.id) ? { ...result, publishStatus: "draft", isPublished: false, publishedAt: null, unpublishedAt: now, unpublishedReason: reason, updatedAt: now } : result);
      saveToStorage(RESULTS_KEY, results);
    }
  }

  function validateClassReport(reportRows, subjects) {
    let incompleteCount = 0;
    reportRows.forEach((row) => {
      const applicable = row.applicableSubjects || getApplicableSubjectsForStudent(row.student, subjects);
      if (!row.result || !hasAllSubjectMarks(row.result, applicable)) incompleteCount += 1;
    });
    return { isValid: reportRows.length > 0 && subjects.length > 0 && incompleteCount === 0, incompleteCount };
  }

  function getClassReportStatus(reportRows) {
    let publishedCount = 0, draftCount = 0, incompleteCount = 0;
    reportRows.forEach((row) => {
      if (!row.result || !row.isComplete) { incompleteCount += 1; return; }
      if (isResultPublished(row.result)) publishedCount += 1;
      else draftCount += 1;
    });
    let label = "Draft";
    if (incompleteCount > 0) label = "Incomplete Draft";
    if (publishedCount > 0 && draftCount === 0 && incompleteCount === 0) label = "Published";
    if (publishedCount > 0 && (draftCount > 0 || incompleteCount > 0)) label = "Partially Published";
    return { label, publishedCount, draftCount, incompleteCount };
  }

  /* =========================================================
     MODAL
  ========================================================= */

  function viewResult(id) {
    const result = results.find((item) => String(item.id) === String(id));
    if (!result) return showStatus("Result not found.", "error");
    const allSubjectsForResult = getSubjectsForClassSection(result.className, result.sectionName);
    const subjects = getResultSubjectObjects(result, allSubjectsForResult);
    const completed = `${result.completedSubjects || 0}/${result.totalSubjects || subjects.length}`;
    const isComplete = hasAllSubjectMarks(result, subjects);
    const resultRank = getRankForResult(result);
    elements.resultModalTitle.textContent = `${result.name} - Final Exam`;
    elements.resultModalBasic.innerHTML = `
      <div class="result-info-item"><span class="result-info-label">Name</span><span class="result-info-value">${escapeHTML(result.name)}</span></div>
      <div class="result-info-item"><span class="result-info-label">Roll</span><span class="result-info-value">${escapeHTML(result.roll)}</span></div>
      <div class="result-info-item rank-info-item"><span class="result-info-label">Rank</span><span class="result-info-value">${escapeHTML(resultRank)}</span></div>
      <div class="result-info-item"><span class="result-info-label">Class</span><span class="result-info-value">Class ${escapeHTML(result.className)}</span></div>
      <div class="result-info-item"><span class="result-info-label">Group</span><span class="result-info-value">${escapeHTML(result.sectionName || GENERAL_SECTION)}</span></div>
      <div class="result-info-item"><span class="result-info-label">Exam Year</span><span class="result-info-value">${escapeHTML(result.year)}</span></div>
      <div class="result-info-item"><span class="result-info-label">Completed</span><span class="result-info-value">${escapeHTML(completed)}</span></div>
      <div class="result-info-item"><span class="result-info-label">Total Marks</span><span class="result-info-value">${escapeHTML(result.totalMarks)}</span></div>
      <div class="result-info-item"><span class="result-info-label">Total Point</span><span class="result-info-value">${escapeHTML(formatNumber(result.totalPoint || 0))}</span></div>
      <div class="result-info-item"><span class="result-info-label">GPA / Grade</span><span class="result-info-value">${escapeHTML(formatGpa(result.gpa))} (${escapeHTML(result.finalGrade)})</span></div>
      <div class="result-info-item"><span class="result-info-label">Status</span><span class="result-info-value">${escapeHTML(getPublishStatusText(result, isComplete))}</span></div>
    `;
    elements.resultModalMarks.innerHTML = subjects.map((subject) => renderSubjectDetailItem(result, subject)).join("");
    showResultModal();
  }

  function renderSubjectDetailItem(result, subject) {
    const mark = normalizeSubjectMark(result?.marks?.[subject.name]);
    if (!isCompleteSubjectMark(mark)) {
      return `<div class="result-mark-item subject-detail-item"><span class="result-mark-label">${escapeHTML(buildSubjectLabel(subject))}</span><span class="result-mark-value">Incomplete</span></div>`;
    }
    const grade = getSubjectGradeInfo(mark.total);
    return `
      <div class="result-mark-item subject-detail-item">
        <span class="result-mark-label">${escapeHTML(buildSubjectLabel(subject))}<small>${escapeHTML(formatSubjectType(subject.type))}</small></span>
        <span class="result-mark-value">MCQ: ${escapeHTML(getPartValue(mark.mcq))}, Written: ${escapeHTML(getPartValue(mark.written))}, Practical: ${escapeHTML(getPartValue(mark.practical))}<br>Total: ${escapeHTML(formatNumber(mark.total))}, Point: ${escapeHTML(grade.point)}, Grade: ${escapeHTML(grade.grade)}</span>
      </div>`;
  }

  function showResultModal() { elements.resultModal?.classList.add("show"); document.body.style.overflow = "hidden"; }
  function hideResultModal() { elements.resultModal?.classList.remove("show"); document.body.style.overflow = ""; }

  /* =========================================================
     SUPABASE LOADERS / MAPPERS
  ========================================================= */

  async function loadSupabaseInitialData() {
    if (!hasSupabaseClient()) { refreshData(); return; }
    try { await Promise.all([reloadStudentsFromSupabase(), reloadResultsFromSupabase(), reloadSubjectsFromSupabase()]); }
    catch (error) { console.error("Supabase initial load error:", error); refreshData(); }
  }

  function hasSupabaseClient() { return Boolean(window.bhsSupabase && typeof window.bhsSupabase.from === "function"); }

  async function reloadStudentsFromSupabase() {
    let data = [];
    try {
      data = await window.bhsFetchAllRows(
        "students",
        "id, name, roll, class_name, section_name, academic_year, guardian_name, phone, address, religion, optional_subject_name, optional_subject_code, status, created_at, updated_at",
        [
          { column: "academic_year", options: { ascending: false } },
          { column: "class_name", options: { ascending: true } },
          { column: "section_name", options: { ascending: true } },
          { column: "roll", options: { ascending: true } }
        ]
      );
    } catch (error) { console.error("Supabase students load error:", error); return; }
    students = (data || []).map(mapStudentFromSupabase);
    saveToStorage(STUDENTS_KEY, students);
  }

  function mapStudentFromSupabase(row) {
    return { id: row.id, name: row.name || "", roll: row.roll || "", guardianName: row.guardian_name || "", phone: row.phone || "", address: row.address || "", className: row.class_name || "", sectionName: row.section_name || GENERAL_SECTION, religion: normalizeReligion(row.religion), optionalSubjectName: row.optional_subject_name || "", optionalSubjectCode: row.optional_subject_code || "", year: row.academic_year || "", status: row.status || "active", createdAt: row.created_at, updatedAt: row.updated_at };
  }

  async function reloadResultsFromSupabase() {
    let data = [];
    try {
      data = await window.bhsFetchAllRows(
        "results",
        "id, student_id, name_snapshot, roll_snapshot, class_name, section_name, academic_year, exam_name, subjects, marks, subject_grades, total_marks, average, gpa, total_point, final_grade, completed_subjects, total_subjects, publish_status, is_published, published_at, ranking_score, last_edited_after_publish_at, unpublished_at, unpublished_reason, created_at, updated_at",
        [
          { column: "academic_year", options: { ascending: false } },
          { column: "class_name", options: { ascending: true } },
          { column: "section_name", options: { ascending: true } },
          { column: "roll_snapshot", options: { ascending: true } }
        ]
      );
    } catch (error) { console.error("Supabase results load error:", error); return; }
    results = (data || []).map(mapResultFromSupabase);
    saveToStorage(RESULTS_KEY, results);
  }

  function mapResultFromSupabase(row) {
    return { id: row.id, studentId: row.student_id, name: row.name_snapshot || "", roll: row.roll_snapshot || "", className: row.class_name || "", sectionName: row.section_name || GENERAL_SECTION, year: row.academic_year || "", examName: row.exam_name || FINAL_EXAM_NAME, subjects: Array.isArray(row.subjects) ? row.subjects : [], marks: row.marks && typeof row.marks === "object" ? row.marks : {}, subjectGrades: row.subject_grades && typeof row.subject_grades === "object" ? row.subject_grades : {}, totalMarks: Number(row.total_marks || 0), average: Number(row.average || 0), gpa: formatGpa(row.gpa || 0), totalPoint: Number(row.total_point || 0), rankingScore: Number(row.ranking_score ?? row.gpa ?? 0), finalGrade: row.final_grade || "", completedSubjects: Number(row.completed_subjects || 0), totalSubjects: Number(row.total_subjects || 0), publishStatus: row.publish_status || "draft", isPublished: row.is_published === true, publishedAt: row.published_at, lastEditedAfterPublishAt: row.last_edited_after_publish_at, unpublishedAt: row.unpublished_at, unpublishedReason: row.unpublished_reason, createdAt: row.created_at, updatedAt: row.updated_at };
  }

  async function reloadSubjectsFromSupabase() {
    const { data, error } = await window.bhsSupabase
      .from("subjects")
      .select("class_name, section_name, subject_name, subject_code, subject_type, sort_order, is_active")
      .eq("is_active", true)
      .order("class_name", { ascending: true })
      .order("section_name", { ascending: true })
      .order("sort_order", { ascending: true })
      .order("subject_name", { ascending: true });
    if (error) { console.error("Supabase subjects load error:", error); return; }
    subjectsByClass = buildSubjectsObjectFromRows(data || []);
    saveToStorage(SUBJECTS_KEY, subjectsByClass);
  }

  function buildSubjectsObjectFromRows(rows) {
    const subjectMap = emptySubjectObject();
    rows.forEach((row) => {
      const className = String(row.class_name || "");
      const sectionName = normalizeSectionForClass(className, row.section_name || GENERAL_SECTION);
      const subjectName = String(row.subject_name || "").trim();
      if (!className || !subjectName) return;
      if (!subjectMap[className]) subjectMap[className] = {};
      if (!subjectMap[className][sectionName]) subjectMap[className][sectionName] = [];
      subjectMap[className][sectionName].push({ name: subjectName, code: row.subject_code || "", type: row.subject_type || "compulsory", sortOrder: Number(row.sort_order || 0), isActive: row.is_active !== false });
    });
    return subjectMap;
  }

  /* =========================================================
     CALC HELPERS
  ========================================================= */

  function readSubjectMarkFromRow(row) {
    const readInput = (part) => row.querySelector(`.part-input[data-part="${part}"]`)?.value.trim() || "";
    return { mcq: readInput("mcq"), written: readInput("written"), practical: readInput("practical") };
  }
  function hasAnySubjectInput(mark) { return hasValue(mark.mcq) || hasValue(mark.written) || hasValue(mark.practical); }
  function canSaveSubjectMark(mark) { return isValidRequiredMark(mark.mcq) && isValidRequiredMark(mark.written) && isValidOptionalMark(mark.practical); }
  function isValidRequiredMark(value) { if (!hasValue(value)) return false; const number = Number(value); return !Number.isNaN(number) && number >= 0 && number <= 100; }
  function isValidOptionalMark(value) { if (!hasValue(value)) return true; const number = Number(value); return !Number.isNaN(number) && number >= 0 && number <= 100; }

  function buildCompletedSubjectMark(mark) {
    const mcq = Number(mark.mcq || 0);
    const written = Number(mark.written || 0);
    const practical = hasValue(mark.practical) ? Number(mark.practical) : 0;
    const total = Number((mcq + written + practical).toFixed(2));
    const gradeInfo = getSubjectGradeInfo(total);
    return { mcq, written, practical, total, point: Number(gradeInfo.point), grade: gradeInfo.grade };
  }

  function normalizeSubjectMark(value) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const mcq = hasValue(value.mcq) ? Number(value.mcq) : "";
      const written = hasValue(value.written) ? Number(value.written) : "";
      const practical = hasValue(value.practical) ? Number(value.practical) : 0;
      const total = hasValue(value.total) ? Number(value.total) : Number((Number(mcq || 0) + Number(written || 0) + Number(practical || 0)).toFixed(2));
      const gradeInfo = getSubjectGradeInfo(total);
      return { mcq, written, practical, total, point: hasValue(value.point) ? Number(value.point) : Number(gradeInfo.point), grade: value.grade || gradeInfo.grade };
    }
    if (hasValue(value) && !Number.isNaN(Number(value))) {
      const total = Number(value);
      const gradeInfo = getSubjectGradeInfo(total);
      return { mcq: "", written: total, practical: 0, total, point: Number(gradeInfo.point), grade: gradeInfo.grade };
    }
    return { mcq: "", written: "", practical: "", total: "", point: "", grade: "" };
  }

  function isCompleteSubjectMark(mark) {
    return hasValue(mark.mcq) && hasValue(mark.written) && isValidRequiredMark(mark.mcq) && isValidRequiredMark(mark.written) && isValidOptionalMark(mark.practical) && hasValue(mark.total) && Number(mark.total) <= 100;
  }

  function calculateSummary(marks, subjectObjects) {
    let totalMarks = 0;
    let totalPointForGpa = 0;
    let denominator = 0;
    let completedSubjects = 0;
    let hasRequiredFail = false;

    subjectObjects.forEach((subject) => {
      const mark = normalizeSubjectMark(marks[subject.name]);
      if (!isCompleteSubjectMark(mark)) return;
      completedSubjects += 1;
      totalMarks += Number(mark.total || 0);
      const point = Number(mark.point || 0);
      if (subject.type === "non_gpa") return;
      if (subject.type === "optional_4th") {
        totalPointForGpa += Math.max(0, point - 2);
        return;
      }
      denominator += 1;
      totalPointForGpa += point;
      if (point === 0) hasRequiredFail = true;
    });

    totalMarks = Number(totalMarks.toFixed(2));
    totalPointForGpa = Number(totalPointForGpa.toFixed(2));
    const average = completedSubjects ? Number((totalMarks / completedSubjects).toFixed(2)) : 0;
    const rawGpa = denominator ? (hasRequiredFail ? 0 : Math.min(5, totalPointForGpa / denominator)) : 0;
    const gpa = Number(rawGpa.toFixed(2));
    const finalGrade = getFinalGradeFromGpa(gpa);
    return { totalMarks, totalPoint: totalPointForGpa, completedSubjects, average, gpa: formatGpa(gpa), finalGrade };
  }

  function buildSubjectGrades(marks, subjectObjects) {
    const gradeMap = {};
    subjectObjects.forEach((subject) => {
      const mark = normalizeSubjectMark(marks[subject.name]);
      if (!isCompleteSubjectMark(mark)) return;
      gradeMap[subject.name] = { total: Number(mark.total), point: Number(mark.point), grade: mark.grade || getSubjectGradeInfo(mark.total).grade, code: subject.code || "", type: subject.type || "compulsory" };
    });
    return gradeMap;
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

  function getFinalGradeFromGpa(gpa) {
    const point = Number(gpa || 0);
    if (point >= 5) return "A+";
    if (point >= 4) return "A";
    if (point >= 3.5) return "A-";
    if (point >= 3) return "B";
    if (point >= 2) return "C";
    if (point >= 1) return "D";
    return "F";
  }

  function getSubjectDisplay(result, subjectName) {
    const mark = normalizeSubjectMark(result?.marks?.[subjectName]);
    if (!isCompleteSubjectMark(mark)) return "-";
    const grade = getSubjectGradeInfo(mark.total);
    return `${formatNumber(mark.total)} / ${grade.point} / ${grade.grade}`;
  }

  /* =========================================================
     DATA HELPERS
  ========================================================= */

  function upsertLocalResult(resultItem) {
    const existingIndex = results.findIndex((item) => String(item.studentId) === String(resultItem.studentId) && String(item.className) === String(resultItem.className) && String(item.year) === String(resultItem.year) && String(item.examName) === FINAL_EXAM_NAME);
    if (existingIndex >= 0) results[existingIndex] = resultItem;
    else results.push(resultItem);
  }

  function findResult(studentId, className, year, sectionName = "") {
    const normalizedSection = normalizeSectionForClass(className, sectionName);
    return results.find((result) => String(result.studentId) === String(studentId) && String(result.className) === String(className) && String(result.year) === String(year) && String(result.examName) === FINAL_EXAM_NAME && (!normalizedSection || normalizeSectionForClass(className, result.sectionName) === normalizedSection));
  }

  function createResultId(studentId, className, year) { return `${studentId}_${className}_${year}_${FINAL_EXAM_NAME}`.replace(/\s+/g, "_").toLowerCase(); }

  function getClassStudents(className, year, sectionName = "") {
    return students.filter((student) => {
      const classMatches = String(student.className) === String(className) && String(student.year) === String(year);
      if (!classMatches) return false;
      if (!isGroupClass(className)) return true;
      if (!sectionName) return true;
      return normalizeSectionForClass(className, getStudentSection(student)) === normalizeSectionForClass(className, sectionName);
    }).sort((a, b) => getRollNumber(a.roll) - getRollNumber(b.roll));
  }

  function hasAllSubjectMarks(result, subjects) {
    let subjectObjects = normalizeSubjectArray(subjects);
    if (result && Array.isArray(result.subjects) && result.subjects.length) {
      const resultNames = new Set(result.subjects.map((name) => String(name)));
      subjectObjects = subjectObjects.filter((subject) => resultNames.has(subject.name));
    }
    if (!result || !result.marks || !subjectObjects.length) return false;
    return subjectObjects.every((subject) => isCompleteSubjectMark(normalizeSubjectMark(result.marks[subject.name])));
  }

  function getRankForResult(result) {
    if (!result) return "-";
    const classStudents = getClassStudents(result.className, result.year, result.sectionName);
    const rankedRows = buildRankedManageRows(classStudents, result.className, result.year, result.sectionName);
    const matchedRow = rankedRows.find((row) => row.result && String(row.result.id) === String(result.id));
    return matchedRow ? matchedRow.rank : "-";
  }

  function getRankingScoreValue(result) { return Number(result?.rankingScore ?? result?.ranking_score ?? result?.gpa ?? 0); }
  function getPublishStatusText(result, isComplete = true) { if (!result) return "Missing"; if (!isComplete) return "Incomplete"; if (isResultPublished(result)) return "Published"; return "Draft"; }
  function getPublishBadgeClass(result, isComplete = true) { if (!result || !isComplete) return "publish-badge incomplete"; if (isResultPublished(result)) return "publish-badge published"; return "publish-badge draft"; }
  function isResultPublished(result) { return !!(result && (result.publishStatus === "published" || result.isPublished === true)); }

  function getPublishMetaForSave(existingResult, now) {
    const wasPublished = isResultPublished(existingResult);
    if (wasPublished) return { wasPublished: true, publishStatus: "draft", isPublished: false, publishedAt: null, lastEditedAfterPublishAt: now };
    return { wasPublished: false, publishStatus: existingResult?.publishStatus || "draft", isPublished: existingResult?.isPublished || false, publishedAt: existingResult?.publishedAt || null, lastEditedAfterPublishAt: existingResult?.lastEditedAfterPublishAt || null };
  }

  function resetExportPreview() {
    if (!elements.reportPreview) return;
    elements.reportPreview.innerHTML = `<p class="empty-table-message">Click Preview Report to view GPA ranking report.</p>`;
    updatePublishButtonState(false);
    updateClassEditButtonState(false);
    updateUnpublishButtonState(false);
    showExportStatus("", "muted");
  }
  function updatePublishButtonState(canPublish) { if (elements.publishClassResultBtn) elements.publishClassResultBtn.disabled = !canPublish; }
  function updateClassEditButtonState(canEdit) { if (elements.editClassResultBtn) elements.editClassResultBtn.disabled = !canEdit; }
  function updateUnpublishButtonState(canUndo) { if (elements.unpublishClassResultBtn) elements.unpublishClassResultBtn.disabled = !canUndo; }

  function loadSubjects() {
    const savedSubjects = loadFromStorage(SUBJECTS_KEY, null);
    if (!savedSubjects) return emptySubjectObject();
    return normalizeStoredSubjects(savedSubjects);
  }

  function emptySubjectObject() {
    return { "6": { General: [] }, "7": { General: [] }, "8": { General: [] }, "9": { Science: [], Arts: [], Commerce: [] }, "10": { Science: [], Arts: [], Commerce: [] } };
  }

  function normalizeStoredSubjects(saved) {
    const base = emptySubjectObject();
    Object.entries(saved || {}).forEach(([className, value]) => {
      if (Array.isArray(value)) {
        base[className] = base[className] || {};
        base[className][GENERAL_SECTION] = value.map((item, index) => normalizeSubjectItem(item, index));
      } else if (value && typeof value === "object") {
        base[className] = base[className] || {};
        Object.entries(value).forEach(([sectionName, list]) => {
          base[className][normalizeSectionForClass(className, sectionName)] = Array.isArray(list) ? list.map((item, index) => normalizeSubjectItem(item, index)) : [];
        });
      }
    });
    return base;
  }

  function normalizeSubjectArray(list) { return Array.isArray(list) ? list.map((item, index) => normalizeSubjectItem(item, index)) : []; }
  function normalizeSubjectItem(item, index = 0) {
    if (typeof item === "string") return { name: item, code: "", type: "compulsory", sortOrder: index + 1, isActive: true };
    return { name: item?.name || item?.subject_name || "", code: item?.code || item?.subject_code || "", type: item?.type || item?.subject_type || "compulsory", sortOrder: Number(item?.sortOrder || item?.sort_order || index + 1), isActive: item?.isActive !== false && item?.is_active !== false };
  }

  function getSubjectsForClassSection(className, sectionName = "") {
    if (!className) return [];
    const normalizedSection = normalizeSectionForClass(className, sectionName);
    if (!subjectsByClass[className]) subjectsByClass[className] = isGroupClass(className) ? { Science: [], Arts: [], Commerce: [] } : { General: [] };
    if (!subjectsByClass[className][normalizedSection]) subjectsByClass[className][normalizedSection] = [];
    return [...subjectsByClass[className][normalizedSection]].map((item, index) => normalizeSubjectItem(item, index));
  }

  function setSubjectsForClassSection(className, sectionName, list) {
    const normalizedSection = normalizeSectionForClass(className, sectionName);
    if (!subjectsByClass[className]) subjectsByClass[className] = {};
    subjectsByClass[className][normalizedSection] = normalizeSubjectArray(list);
  }

  function refreshData() {
    students = loadFromStorage(STUDENTS_KEY, []);
    results = loadFromStorage(RESULTS_KEY, []);
    subjectsByClass = loadSubjects();
  }
  function syncCache() { saveToStorage(STUDENTS_KEY, students); saveToStorage(RESULTS_KEY, results); saveToStorage(SUBJECTS_KEY, subjectsByClass); }

  /* =========================================================
     SECTION HELPERS
  ========================================================= */

  function isGroupClass(className) { return GROUP_CLASSES.has(String(className)); }
  function getStudentSection(student) { return normalizeSectionForClass(student?.className, student?.sectionName || student?.section_name || GENERAL_SECTION); }
  function normalizeSectionForClass(className, sectionName = "") {
    if (!isGroupClass(className)) return GENERAL_SECTION;
    const value = String(sectionName || "").trim();
    if (/^(science|sci)$/i.test(value)) return "Science";
    if (/^(arts|humanities|humanity)$/i.test(value)) return "Arts";
    if (/^(commerce|business|business studies)$/i.test(value)) return "Commerce";
    return value && GROUP_SECTIONS.includes(value) ? value : "";
  }
  function getSelectedSectionFor(area, allowAll = false) {
    const map = { result: elements.resultSection, manage: elements.manageSectionFilter, subject: elements.subjectSection, export: elements.exportSection };
    const classMap = { result: elements.resultClass, manage: elements.manageClassFilter, subject: elements.subjectClass, export: elements.exportClass };
    const className = classMap[area]?.value || "";
    if (!isGroupClass(className)) return GENERAL_SECTION;
    const value = map[area]?.value || "";
    if (allowAll && !value) return "";
    return normalizeSectionForClass(className, value);
  }
  function getSectionLabel(sectionName) { if (sectionName === "Arts") return "Arts / Humanities"; if (sectionName === "Commerce") return "Commerce / Business Studies"; return sectionName || GENERAL_SECTION; }
  function getSectionSuffix(className, sectionName, allowAll = false) { if (!isGroupClass(className)) return ""; if (!sectionName && allowAll) return " - All Groups"; return sectionName ? ` - ${getSectionLabel(sectionName)}` : ""; }

  /* =========================================================
     SMALL HELPERS
  ========================================================= */

  function setRowStatus(cell, text, statusClass) { if (!cell) return; cell.textContent = text; cell.classList.remove("saved", "pending", "ready", "error"); cell.classList.add(statusClass); }
  function buildSubjectLabel(subject) { const item = normalizeSubjectItem(subject); return item.code ? `${item.name} (${item.code})` : item.name; }
  function formatSubjectType(type) { return ({ compulsory: "Compulsory", religion: "Religion", group_required: "Group Required", optional_4th: "Optional / 4th", non_gpa: "Non-GPA" })[type] || "Compulsory"; }
  function getPartValue(value) { return hasValue(value) ? formatNumber(value) : "-"; }
  function getRollNumber(roll) { const number = Number(roll); return Number.isNaN(number) ? 999999 : number; }
  function isUuid(value) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || "")); }
  function setSavingState(isSaving) { if (!elements.saveResultsBtn) return; elements.saveResultsBtn.disabled = isSaving; elements.saveResultsBtn.innerHTML = isSaving ? `<i class="fas fa-spinner fa-spin"></i> Saving...` : `<i class="fas fa-save"></i> Save Component Marks`; }
  function loadFromStorage(key, fallback) { try { const value = localStorage.getItem(key); return value ? JSON.parse(value) : fallback; } catch (error) { console.error(`Storage read error for ${key}:`, error); return fallback; } }
  function saveToStorage(key, value) {
    if (typeof window.bhsSafeSetLocalJSON === "function") {
      window.bhsSafeSetLocalJSON(key, value);
      return;
    }
    try { localStorage.setItem(key, JSON.stringify(value)); }
    catch (error) { console.warn(`Storage write skipped for ${key}:`, error); }
  }
  function showStatus(message, type = "success") { showTimedStatus(elements.resultStatus, message, type); }
  function showSubjectStatus(message, type = "success") { showTimedStatus(elements.subjectsStatus, message, type); }
  function showTimedStatus(element, message, type = "success") { if (!element) return; element.textContent = message; element.className = type === "success" ? "status-success" : "status-error"; setTimeout(() => { element.textContent = ""; element.className = "mt-2 text-muted"; }, 3200); }
  function showExportStatus(message, type = "muted") { if (!elements.exportStatus) return; elements.exportStatus.textContent = message; if (type === "success") elements.exportStatus.className = "status-success"; else if (type === "error") elements.exportStatus.className = "status-error"; else elements.exportStatus.className = "mt-2 text-muted"; }
  function hasValue(value) { return value !== undefined && value !== null && String(value).trim() !== ""; }
  function formatNumber(value) { const number = Number(value || 0); if (Number.isNaN(number)) return "0"; return Number.isInteger(number) ? String(number) : number.toFixed(2); }
  function formatGpa(value) { const number = Number(value || 0); if (Number.isNaN(number)) return "0.00"; return number.toFixed(2); }
  function escapeHTML(value) { return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }
  function escapeAttr(value) { return escapeHTML(value); }
});
