function safeSetStudentJSON(key, value) {
    if (typeof window.bhsSafeSetLocalJSON === "function") {
        window.bhsSafeSetLocalJSON(key, value);
        return;
    }
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
        console.warn(`Student cache skipped for ${key}:`, error);
    }
}

document.addEventListener("DOMContentLoaded", () => {
    const STORAGE_KEY = "bhs_students";
    const YEAR_STORAGE_KEY = "bhs_selected_exam_year";

    const studentForm = document.getElementById("studentForm");
    const studentId = document.getElementById("studentId");
    const studentName = document.getElementById("studentName");
    const studentRoll = document.getElementById("studentRoll");
    const guardianName = document.getElementById("guardianName");
    const phone = document.getElementById("phone");
    const studentAddress = document.getElementById("studentAddress");
    const studentSection = document.getElementById("studentSection");
    const studentSectionGroup = document.getElementById("studentSectionGroup");
    const studentSectionFilter = document.getElementById("studentSectionFilter");
    const studentSectionFilterBox = document.getElementById("studentSectionFilterBox");
    const studentReligion = document.getElementById("studentReligion");
    const studentOptionalSubject = document.getElementById("studentOptionalSubject");
    const studentOptionalSubjectGroup = document.getElementById("studentOptionalSubjectGroup");

    const classSelect = document.getElementById("classSelect");
    const submitStudentBtn = document.getElementById("submitStudentBtn");
    const cancelEditBtn = document.getElementById("cancelEditBtn");
    const refreshBtn = document.getElementById("refreshBtn");
    const downloadPdfBtn = document.getElementById("downloadPdfBtn");
    const downloadExcelBtn = document.getElementById("downloadExcelBtn");

    const studentsTableBody = document.getElementById("studentsTableBody");
    const listSubTitle = document.getElementById("listSubTitle");
    const ajaxStatus = document.getElementById("ajaxStatus");
    const studentSearch = document.getElementById("studentSearch");

    const SECTION_CLASSES = ["9", "10"];
    const STUDENT_SECTIONS = ["Science", "Arts", "Commerce"];
    const STUDENT_RELIGIONS = ["Islam", "Hindu"];
    const GENERAL_SECTION = "General";

    let students = [];

    init();

    async function init() {
        createModalIfMissing();
        bindEvents();
        toggleStudentSectionField();
        toggleStudentSectionFilter();
        toggleOptionalSubjectField();
        bindExamYearSelectWhenReady();
        renderStudents();
        showStatus("Loading students from Supabase...", "info", false);
        await loadStudentsFromSupabase();
        renderStudents();
        setNextStudentRoll();
    }

    function bindEvents() {
        if (studentForm) {
            studentForm.addEventListener("submit", handleStudentSubmit);
        }

        if (classSelect) {
            classSelect.addEventListener("change", async function () {
                toggleStudentSectionField();
                toggleStudentSectionFilter();
                await loadOptionalSubjectsForCurrentForm();
                renderStudents();
                setNextStudentRoll();
            });
        }

        if (studentSection) {
            studentSection.addEventListener("change", async function () {
                await loadOptionalSubjectsForCurrentForm();
                setNextStudentRoll();
            });
        }

        if (studentSearch) {
            studentSearch.addEventListener("input", renderStudents);
        }

        if (studentSectionFilter) {
            studentSectionFilter.addEventListener("change", renderStudents);
        }

        if (refreshBtn) {
            refreshBtn.addEventListener("click", async function () {
                showStatus("Refreshing students...", "info", false);
                await loadStudentsFromSupabase();
                renderStudents();
                setNextStudentRoll();
                showStatus("Student list refreshed.", "success");
            });
        }

        if (cancelEditBtn) {
            cancelEditBtn.addEventListener("click", function () {
                resetForm();
            });
        }

        if (downloadPdfBtn) {
            downloadPdfBtn.addEventListener("click", downloadStudentsPDF);
        }

        if (downloadExcelBtn) {
            downloadExcelBtn.addEventListener("click", downloadStudentsExcel);
        }

        if (studentsTableBody) {
            studentsTableBody.addEventListener("click", function (event) {
                const button = event.target.closest("button[data-action]");
                if (!button) return;

                const action = button.dataset.action;
                const id = button.dataset.id;

                if (action === "view") viewStudent(id);
                if (action === "edit") editStudent(id);
                if (action === "delete") deleteStudent(id);
            });
        }

        document.addEventListener("click", function (event) {
            if (event.target.closest("#closeStudentModal")) {
                hideStudentModal();
            }

            if (event.target.closest("#studentModalOkBtn")) {
                hideStudentModal();
            }

            const modal = document.getElementById("studentModal");

            if (modal && event.target === modal) {
                hideStudentModal();
            }
        });

        document.addEventListener("keydown", function (event) {
            if (event.key === "Escape") {
                hideStudentModal();
            }
        });

        window.addEventListener("bhsExamYearReady", function () {
            bindExamYearSelectWhenReady();
            renderStudents();
            setNextStudentRoll();
        });

        window.addEventListener("bhsExamYearChanged", function () {
            renderStudents();
            setNextStudentRoll();
        });
    }

    function getExamYearSelect() {
        return (
            document.getElementById("examYear") ||
            document.getElementById("examYearSelect") ||
            document.getElementById("yearSelect") ||
            document.querySelector(".exam-year-select select") ||
            document.querySelector(".year-dropdown")
        );
    }

    function getSelectedExamYear() {
        const examYearSelect = getExamYearSelect();

        if (examYearSelect && examYearSelect.value) {
            return String(examYearSelect.value);
        }

        const storedYear = localStorage.getItem(YEAR_STORAGE_KEY);

        if (storedYear) {
            return String(storedYear);
        }

        return String(new Date().getFullYear());
    }


    function requiresStudentSection(className) {
        return SECTION_CLASSES.includes(String(className));
    }

    function normalizeStudentSection(className, sectionName) {
        if (!requiresStudentSection(className)) {
            return GENERAL_SECTION;
        }

        const normalized = String(sectionName || "").trim();
        return STUDENT_SECTIONS.includes(normalized) ? normalized : "";
    }

    function getCurrentFormSection() {
        const selectedClass = classSelect ? classSelect.value : "";
        return normalizeStudentSection(selectedClass, studentSection ? studentSection.value : "");
    }

    function formatStudentSection(student) {
        const sectionName = student?.sectionName || GENERAL_SECTION;
        return requiresStudentSection(student?.className) ? sectionName : GENERAL_SECTION;
    }

    function toggleStudentSectionField() {
        if (!studentSectionGroup || !studentSection || !classSelect) return;

        const selectedClass = classSelect.value;
        const shouldShow = requiresStudentSection(selectedClass);

        studentSectionGroup.style.display = shouldShow ? "block" : "none";
        studentSection.required = shouldShow;

        if (!shouldShow) {
            studentSection.value = "";
        }
    }

    function toggleStudentSectionFilter() {
        if (!studentSectionFilterBox || !studentSectionFilter || !classSelect) return;

        const selectedClass = classSelect.value;
        const shouldShow = requiresStudentSection(selectedClass);

        studentSectionFilterBox.style.display = shouldShow ? "block" : "none";

        if (!shouldShow) {
            studentSectionFilter.value = "";
        }
    }


    function normalizeReligion(value) {
        const text = String(value || "").trim();
        return STUDENT_RELIGIONS.includes(text) ? text : "Islam";
    }

    function getOptionalSubjectSelection() {
        if (!studentOptionalSubject || !studentOptionalSubject.value) {
            return { name: "", code: "" };
        }

        const selectedOption = studentOptionalSubject.options[studentOptionalSubject.selectedIndex];
        return {
            name: studentOptionalSubject.value,
            code: selectedOption ? selectedOption.dataset.code || "" : ""
        };
    }

    function toggleOptionalSubjectField() {
        if (!studentOptionalSubjectGroup || !classSelect) return;
        const selectedClass = classSelect.value;
        const shouldShow = requiresStudentSection(selectedClass);
        studentOptionalSubjectGroup.style.display = shouldShow ? "block" : "none";
        if (!shouldShow && studentOptionalSubject) {
            studentOptionalSubject.innerHTML = `<option value="">No optional subject</option>`;
            studentOptionalSubject.value = "";
        }
    }

    async function loadOptionalSubjectsForCurrentForm(preferredName = "") {
        toggleOptionalSubjectField();
        if (!studentOptionalSubject || !classSelect || !requiresStudentSection(classSelect.value)) return;

        const selectedClass = classSelect.value;
        const selectedSection = getCurrentFormSection();
        studentOptionalSubject.innerHTML = `<option value="">${selectedSection ? "No optional subject" : "Select section first"}</option>`;
        studentOptionalSubject.disabled = !selectedSection;

        if (!selectedSection) return;

        let optionSubjects = [];
        if (window.bhsSupabase) {
            const { data, error } = await window.bhsSupabase
                .from("subjects")
                .select("subject_name, subject_code, sort_order")
                .eq("class_name", String(selectedClass))
                .eq("section_name", String(selectedSection))
                .eq("subject_type", "optional_4th")
                .eq("is_active", true)
                .order("sort_order", { ascending: true });

            if (!error && Array.isArray(data)) {
                optionSubjects = data.map(function (row) {
                    return {
                        name: row.subject_name || "",
                        code: row.subject_code || ""
                    };
                }).filter(function (item) { return item.name; });
            } else if (error) {
                console.warn("Optional subject load warning:", error);
            }
        }

        studentOptionalSubject.disabled = false;
        studentOptionalSubject.innerHTML = `<option value="">No optional subject</option>` + optionSubjects.map(function (subject) {
            return `<option value="${escapeAttr(subject.name)}" data-code="${escapeAttr(subject.code)}">${escapeHTML(subject.code ? `${subject.name} (${subject.code})` : subject.name)}</option>`;
        }).join("");

        if (preferredName) {
            studentOptionalSubject.value = preferredName;
        }
    }

    function bindExamYearSelectWhenReady() {
        const examYearSelect = getExamYearSelect();

        if (examYearSelect && examYearSelect.dataset.studentsYearBound !== "true") {
            examYearSelect.dataset.studentsYearBound = "true";

            if (examYearSelect.value) {
                localStorage.setItem(YEAR_STORAGE_KEY, examYearSelect.value);
            }

            examYearSelect.addEventListener("change", function () {
                localStorage.setItem(YEAR_STORAGE_KEY, examYearSelect.value);
                renderStudents();
                setNextStudentRoll();
            });

            renderStudents();
            setNextStudentRoll();
            return;
        }

        const headerContainer = document.getElementById("admin-header-container");

        if (!headerContainer || headerContainer.dataset.yearObserverReady === "true") {
            return;
        }

        headerContainer.dataset.yearObserverReady = "true";

        const observer = new MutationObserver(() => {
            const select = getExamYearSelect();

            if (select) {
                bindExamYearSelectWhenReady();
                observer.disconnect();
            }
        });

        observer.observe(headerContainer, {
            childList: true,
            subtree: true
        });
    }

    async function loadStudentsFromSupabase() {
        if (!window.bhsSupabase) {
            console.error("Supabase client not found.");
            students = loadStudentsFromCache();
            renderStudents();
            showStatus("Supabase connection not found. Showing cached data.", "error");
            return;
        }

        let data = [];

        try {
            data = await window.bhsFetchAllRows(
                "students",
                "id, student_code, name, roll, class_name, section_name, academic_year, guardian_name, phone, address, religion, optional_subject_name, optional_subject_code, status, promotion_status, promoted_from, created_at, updated_at",
                [
                    { column: "academic_year", options: { ascending: false } },
                    { column: "class_name", options: { ascending: true } },
                    { column: "roll", options: { ascending: true } }
                ]
            );
        } catch (error) {
            console.error("Supabase students load error:", error);
            students = loadStudentsFromCache();
            renderStudents();
            showStatus("Could not load all students from Supabase. Showing cached data.", "error");
            return;
        }

        students = (data || []).map(dbToStudent);
        cacheStudents();
        clearStatus();
    }

    function loadStudentsFromCache() {
        try {
            const cached = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
            return Array.isArray(cached) ? cached : [];
        } catch (error) {
            console.error("LocalStorage read error:", error);
            return [];
        }
    }

    function cacheStudents() {
        safeSetStudentJSON(STORAGE_KEY, students);
    }

    function dbToStudent(row) {
        return {
            id: row.id,
            studentCode: row.student_code || "",
            name: row.name || "",
            roll: row.roll || "",
            guardianName: row.guardian_name || "",
            phone: row.phone || "",
            address: row.address || "",
            className: row.class_name || "",
            sectionName: row.section_name || GENERAL_SECTION,
            religion: normalizeReligion(row.religion),
            optionalSubjectName: row.optional_subject_name || "",
            optionalSubjectCode: row.optional_subject_code || "",
            year: row.academic_year || "",
            status: row.status || "active",
            promotionStatus: row.promotion_status || "",
            promotedFrom: row.promoted_from || null,
            createdAt: row.created_at || "",
            updatedAt: row.updated_at || ""
        };
    }

    function studentToDb(student) {
        return {
            name: student.name,
            roll: student.roll,
            class_name: student.className,
            section_name: normalizeStudentSection(student.className, student.sectionName),
            academic_year: student.year,
            religion: normalizeReligion(student.religion),
            optional_subject_name: requiresStudentSection(student.className) ? (student.optionalSubjectName || null) : null,
            optional_subject_code: requiresStudentSection(student.className) ? (student.optionalSubjectCode || null) : null,
            guardian_name: student.guardianName,
            phone: student.phone,
            address: student.address || null,
            status: student.status || "active"
        };
    }

    function getNextStudentRoll() {
        const selectedClass = classSelect ? classSelect.value : "";
        const selectedYear = getSelectedExamYear();

        if (!selectedClass || !selectedYear) {
            return "";
        }

        // Roll is unique class/year-wise, not section-wise.
        // Class 9 Science roll 1 and Class 9 Arts roll 1 would create conflicts,
        // so the next roll is calculated across the whole class.
        const rollNumbers = students
            .filter((student) => {
                return (
                    String(student.className) === String(selectedClass) &&
                    String(student.year) === String(selectedYear)
                );
            })
            .map((student) => Number(student.roll))
            .filter((roll) => Number.isFinite(roll));

        const maxRoll = rollNumbers.length > 0 ? Math.max(...rollNumbers) : 0;

        return String(maxRoll + 1);
    }

    function setNextStudentRoll(options = {}) {
        if (!studentRoll) return;
        if (studentId && studentId.value) return;

        const nextRoll = getNextStudentRoll();
        studentRoll.value = nextRoll;

        if (options.focusRoll === true && nextRoll) {
            studentRoll.focus();
            studentRoll.select();
        }
    }

    async function handleStudentSubmit(event) {
        event.preventDefault();

        if (!window.bhsSupabase) {
            showStatus("Supabase connection not found.", "error");
            return;
        }

        const selectedClass = classSelect ? classSelect.value : "";
        const selectedYear = getSelectedExamYear();

        if (!selectedClass) {
            showStatus("Please select a class first.", "error");
            return;
        }

        if (!selectedYear) {
            showStatus("Please select an exam year first.", "error");
            return;
        }

        const editingId = studentId ? studentId.value : "";

        const optionalSelection = getOptionalSubjectSelection();

        const newStudent = {
            id: editingId,
            name: studentName.value.trim(),
            roll: studentRoll.value.trim(),
            guardianName: guardianName.value.trim(),
            phone: phone.value.trim(),
            address: studentAddress.value.trim(),
            className: selectedClass,
            sectionName: getCurrentFormSection(),
            religion: normalizeReligion(studentReligion ? studentReligion.value : "Islam"),
            optionalSubjectName: optionalSelection.name,
            optionalSubjectCode: optionalSelection.code,
            year: selectedYear,
            status: "active"
        };

        if (requiresStudentSection(selectedClass) && !newStudent.sectionName) {
            showStatus("Please select Science, Arts, or Commerce section for Class 9/10.", "error");
            return;
        }

        if (!newStudent.religion) {
            showStatus("Please select student religion.", "error");
            return;
        }

        if (
            !newStudent.name ||
            !newStudent.roll ||
            !newStudent.guardianName ||
            !newStudent.phone
        ) {
            showStatus("Please fill all required fields.", "error");
            return;
        }

        const rollPattern = /^[0-9]+$/;

        if (!rollPattern.test(newStudent.roll)) {
            showStatus("Roll must be a number only.", "error");
            return;
        }

        const phonePattern = /^01[0-9]{9}$/;

        if (!phonePattern.test(newStudent.phone)) {
            showStatus("Please enter a valid Bangladeshi phone number. Example: 01712345678", "error");
            return;
        }

        const duplicateRoll = students.some((student) => {
            return (
                String(student.id) !== String(newStudent.id) &&
                String(student.roll) === String(newStudent.roll) &&
                String(student.className) === String(newStudent.className) &&
                String(student.year) === String(newStudent.year)
            );
        });

        if (duplicateRoll) {
            showStatus("This roll already exists in this class and exam year.", "error");
            return;
        }

        setSubmitLoading(true);

        if (editingId) {
            const { data, error } = await window.bhsSupabase
                .from("students")
                .update(studentToDb(newStudent))
                .eq("id", editingId)
                .select()
                .single();

            setSubmitLoading(false);

            if (error) {
                console.error("Supabase student update error:", error);
                showStatus(getReadableSupabaseError(error, "Student update failed."), "error");
                return;
            }

            const updatedStudent = dbToStudent(data);
            students = students.map((student) => {
                return String(student.id) === String(editingId) ? updatedStudent : student;
            });

            cacheStudents();
            resetForm({ focusRoll: true });
            renderStudents();
            showStatus("Student updated successfully.", "success");
            return;
        }

        const { data, error } = await window.bhsSupabase
            .from("students")
            .insert(studentToDb(newStudent))
            .select()
            .single();

        setSubmitLoading(false);

        if (error) {
            console.error("Supabase student insert error:", error);
            showStatus(getReadableSupabaseError(error, "Student add failed."), "error");
            return;
        }

        students.push(dbToStudent(data));
        cacheStudents();
        resetForm({ focusRoll: true });
        renderStudents();
        showStatus("Student added successfully.", "success");
    }

    function getReadableSupabaseError(error, fallbackMessage) {
        if (!error) return fallbackMessage;

        if (error.code === "23505") {
            return "This roll already exists in this class and exam year.";
        }

        return error.message || fallbackMessage;
    }

    function setSubmitLoading(isLoading) {
        if (!submitStudentBtn) return;

        submitStudentBtn.disabled = isLoading;
        submitStudentBtn.innerHTML = isLoading
            ? `<i class="fas fa-spinner fa-spin"></i> Saving...`
            : studentId && studentId.value
                ? "Update Student"
                : "Add Student";
    }

    function getFilteredStudents() {
        const selectedClass = classSelect ? classSelect.value : "";
        const selectedYear = getSelectedExamYear();
        const selectedSectionFilter = studentSectionFilter ? studentSectionFilter.value : "";
        const searchText = studentSearch ? studentSearch.value.trim().toLowerCase() : "";

        let filteredStudents = [...students];

        if (selectedClass) {
            filteredStudents = filteredStudents.filter((student) => {
                return String(student.className) === String(selectedClass);
            });
        }

        if (selectedYear) {
            filteredStudents = filteredStudents.filter((student) => {
                return String(student.year) === String(selectedYear);
            });
        }

        if (requiresStudentSection(selectedClass) && selectedSectionFilter) {
            filteredStudents = filteredStudents.filter((student) => {
                return String(formatStudentSection(student)) === String(selectedSectionFilter);
            });
        }

        if (searchText) {
            filteredStudents = filteredStudents.filter((student) => {
                const studentNameText = String(student.name || "").toLowerCase();
                const studentClass = String(student.className || "").toLowerCase();
                const studentClassText = `class ${studentClass}`;
                const studentRollText = String(student.roll || "").toLowerCase();
                const studentSectionText = String(formatStudentSection(student)).toLowerCase();
                const phoneText = String(student.phone || "").toLowerCase();
                const religionText = String(student.religion || "").toLowerCase();
                const optionalText = String(student.optionalSubjectName || "").toLowerCase();

                return (
                    studentNameText.includes(searchText) ||
                    studentClass.includes(searchText) ||
                    studentClassText.includes(searchText) ||
                    studentRollText.includes(searchText) ||
                    studentSectionText.includes(searchText) ||
                    religionText.includes(searchText) ||
                    optionalText.includes(searchText) ||
                    phoneText.includes(searchText)
                );
            });
        }

        filteredStudents.sort((a, b) => {
            return Number(a.roll) - Number(b.roll);
        });

        return filteredStudents;
    }

    function renderStudents() {
        if (!studentsTableBody || !listSubTitle || !classSelect) return;

        const selectedClass = classSelect.value;
        const selectedYear = getSelectedExamYear();
        const selectedSectionFilter = studentSectionFilter ? studentSectionFilter.value : "";
        const sectionLabel = requiresStudentSection(selectedClass) && selectedSectionFilter
            ? `, ${selectedSectionFilter} Section`
            : "";
        const filteredStudents = getFilteredStudents();

        studentsTableBody.innerHTML = "";

        if (filteredStudents.length === 0) {
            studentsTableBody.innerHTML = `
                <tr>
                    <td colspan="8" class="empty-table-message">
                        No students found.
                    </td>
                </tr>
            `;

            listSubTitle.textContent = selectedClass
                ? `No students found in Class ${selectedClass}${sectionLabel}, Exam Year ${selectedYear}.`
                : `No students found from all classes, Exam Year ${selectedYear}.`;

            return;
        }

        filteredStudents.forEach((student, index) => {
            const row = document.createElement("tr");

            row.innerHTML = `
                <td>${index + 1}</td>
                <td>${escapeHTML(student.name)}</td>
                <td>${escapeHTML(student.roll)}</td>
                <td>Class ${escapeHTML(student.className)}</td>
                <td>${escapeHTML(formatStudentSection(student))}</td>
                <td>${escapeHTML(student.religion || "Islam")}</td>
                <td>${escapeHTML(student.optionalSubjectName || "-")}</td>
                <td>
                    <div class="table-action-buttons">
                        <button type="button" class="btn btn-info btn-xs" data-action="view" data-id="${student.id}">
                            <i class="fas fa-eye"></i>
                        </button>

                        <button type="button" class="btn btn-warning btn-xs" data-action="edit" data-id="${student.id}">
                            <i class="fas fa-edit"></i>
                        </button>

                        <button type="button" class="btn btn-danger btn-xs" data-action="delete" data-id="${student.id}">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            `;

            studentsTableBody.appendChild(row);
        });

        listSubTitle.textContent = selectedClass
            ? `${filteredStudents.length} student(s) showing in Class ${selectedClass}${sectionLabel}, Exam Year ${selectedYear}.`
            : `${filteredStudents.length} student(s) showing from all classes, Exam Year ${selectedYear}.`;
    }

    function viewStudent(id) {
        const student = students.find((student) => {
            return String(student.id) === String(id);
        });

        if (!student) {
            showStatus("Student not found.", "error");
            return;
        }

        createModalIfMissing();

        document.getElementById("modalStudentName").textContent = student.name || "-";
        document.getElementById("modalStudentRoll").textContent = student.roll || "-";
        document.getElementById("modalStudentClass").textContent = "Class " + (student.className || "-");
        document.getElementById("modalStudentSection").textContent = formatStudentSection(student);
        const religionEl = document.getElementById("modalStudentReligion");
        if (religionEl) religionEl.textContent = student.religion || "Islam";
        const optionalEl = document.getElementById("modalStudentOptional");
        if (optionalEl) optionalEl.textContent = student.optionalSubjectName || "-";
        document.getElementById("modalStudentYear").textContent = student.year || "N/A";
        document.getElementById("modalGuardianName").textContent = student.guardianName || "-";
        document.getElementById("modalStudentPhone").textContent = student.phone || "-";
        document.getElementById("modalStudentAddress").textContent = student.address || "N/A";

        showStudentModal();
    }

    function createModalIfMissing() {
        if (document.getElementById("studentModal")) {
            ensureModalYearField();
            return;
        }

        const modalHTML = `
            <div class="student-modal" id="studentModal">
                <div class="student-modal-box">
                    <div class="student-modal-header">
                        <div class="student-modal-title">
                            <i class="fas fa-user-graduate"></i>
                            <h3>Student Details</h3>
                        </div>

                        <button type="button" class="student-modal-close" id="closeStudentModal">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>

                    <div class="student-modal-body">
                        <div class="student-detail-item">
                            <span class="detail-label">Name</span>
                            <span class="detail-value" id="modalStudentName">-</span>
                        </div>

                        <div class="student-detail-item">
                            <span class="detail-label">Roll</span>
                            <span class="detail-value" id="modalStudentRoll">-</span>
                        </div>

                        <div class="student-detail-item">
                            <span class="detail-label">Class</span>
                            <span class="detail-value" id="modalStudentClass">-</span>
                        </div>

                        <div class="student-detail-item">
                            <span class="detail-label">Section</span>
                            <span class="detail-value" id="modalStudentSection">-</span>
                        </div>

                        <div class="student-detail-item">
                            <span class="detail-label">Religion</span>
                            <span class="detail-value" id="modalStudentReligion">-</span>
                        </div>

                        <div class="student-detail-item">
                            <span class="detail-label">Optional Subject</span>
                            <span class="detail-value" id="modalStudentOptional">-</span>
                        </div>

                        <div class="student-detail-item">
                            <span class="detail-label">Exam Year</span>
                            <span class="detail-value" id="modalStudentYear">-</span>
                        </div>

                        <div class="student-detail-item">
                            <span class="detail-label">Guardian</span>
                            <span class="detail-value" id="modalGuardianName">-</span>
                        </div>

                        <div class="student-detail-item">
                            <span class="detail-label">Phone</span>
                            <span class="detail-value" id="modalStudentPhone">-</span>
                        </div>

                        <div class="student-detail-item">
                            <span class="detail-label">Address</span>
                            <span class="detail-value" id="modalStudentAddress">-</span>
                        </div>
                    </div>

                    <div class="student-modal-footer">
                        <button type="button" class="btn btn-primary" id="studentModalOkBtn">
                            OK
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML("beforeend", modalHTML);
    }


    function ensureModalSectionField() {
        if (document.getElementById("modalStudentSection")) {
            return;
        }

        const modalStudentClass = document.getElementById("modalStudentClass");
        const classItem = modalStudentClass
            ? modalStudentClass.closest(".student-detail-item")
            : null;

        if (!classItem) return;

        const sectionItem = document.createElement("div");
        sectionItem.className = "student-detail-item";
        sectionItem.innerHTML = `
            <span class="detail-label">Section</span>
            <span class="detail-value" id="modalStudentSection">-</span>
        `;

        classItem.insertAdjacentElement("afterend", sectionItem);
    }

    function ensureModalYearField() {
        ensureModalSectionField();

        if (document.getElementById("modalStudentYear")) {
            return;
        }

        const modalStudentClass = document.getElementById("modalStudentClass");
        const classItem = modalStudentClass
            ? modalStudentClass.closest(".student-detail-item")
            : null;

        if (!classItem) return;

        const yearItem = document.createElement("div");
        yearItem.className = "student-detail-item";
        yearItem.innerHTML = `
            <span class="detail-label">Exam Year</span>
            <span class="detail-value" id="modalStudentYear">-</span>
        `;

        classItem.insertAdjacentElement("afterend", yearItem);
    }

    function showStudentModal() {
        const studentModal = document.getElementById("studentModal");
        if (!studentModal) return;

        studentModal.classList.add("show");
        document.body.style.overflow = "hidden";
    }

    function hideStudentModal() {
        const studentModal = document.getElementById("studentModal");
        if (!studentModal) return;

        studentModal.classList.remove("show");
        document.body.style.overflow = "";
    }

    async function editStudent(id) {
        const student = students.find((student) => {
            return String(student.id) === String(id);
        });

        if (!student) {
            showStatus("Student not found.", "error");
            return;
        }

        studentId.value = student.id;
        studentName.value = student.name;
        studentRoll.value = student.roll;
        guardianName.value = student.guardianName;
        phone.value = student.phone;
        studentAddress.value = student.address || "";
        classSelect.value = student.className;
        toggleStudentSectionField();
        if (studentSection) {
            studentSection.value = requiresStudentSection(student.className) ? formatStudentSection(student) : "";
        }
        if (studentReligion) {
            studentReligion.value = normalizeReligion(student.religion);
        }
        await loadOptionalSubjectsForCurrentForm(student.optionalSubjectName || "");
        if (studentOptionalSubject) {
            studentOptionalSubject.value = student.optionalSubjectName || "";
        }

        const examYearSelect = getExamYearSelect();

        if (examYearSelect && student.year) {
            examYearSelect.value = String(student.year);
            localStorage.setItem(YEAR_STORAGE_KEY, String(student.year));
        }

        submitStudentBtn.textContent = "Update Student";
        cancelEditBtn.style.display = "inline-flex";

        studentForm.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });

        renderStudents();
    }

    async function deleteStudent(id) {
        const student = students.find((student) => {
            return String(student.id) === String(id);
        });

        if (!student) {
            showStatus("Student not found.", "error");
            return;
        }

        const confirmDelete = confirm(`Are you sure you want to delete ${student.name}?`);

        if (!confirmDelete) return;

        const { error } = await window.bhsSupabase
            .from("students")
            .delete()
            .eq("id", id);

        if (error) {
            console.error("Supabase student delete error:", error);
            showStatus(error.message || "Student delete failed.", "error");
            return;
        }

        students = students.filter((student) => {
            return String(student.id) !== String(id);
        });

        cacheStudents();
        renderStudents();
        resetForm();

        showStatus("Student deleted successfully.", "success");
    }

    function resetForm(options = {}) {
        if (!studentForm) return;

        studentForm.reset();
        studentId.value = "";
        submitStudentBtn.textContent = "Add Student";
        submitStudentBtn.disabled = false;
        cancelEditBtn.style.display = "none";
        toggleStudentSectionField();
        toggleOptionalSubjectField();
        if (studentReligion) studentReligion.value = "Islam";
        if (studentOptionalSubject) studentOptionalSubject.innerHTML = `<option value="">No optional subject</option>`;

        setNextStudentRoll(options);
    }

    function getStudentsForDownload() {
        return getFilteredStudents().map((student, index) => {
            return {
                Serial: index + 1,
                Name: student.name,
                Roll: student.roll,
                Class: "Class " + student.className,
                Section: formatStudentSection(student),
                Religion: student.religion || "Islam",
                OptionalSubject: student.optionalSubjectName || "-",
                Year: student.year || "N/A",
                Guardian: student.guardianName,
                Phone: student.phone,
                Address: student.address || "N/A"
            };
        });
    }

    function downloadStudentsPDF() {
        const data = getStudentsForDownload();

        if (data.length === 0) {
            showStatus("No student data available for PDF download.", "error");
            return;
        }

        if (!window.jspdf || !window.jspdf.jsPDF) {
            showStatus("jsPDF library not loaded. Please add jsPDF CDN in HTML.", "error");
            return;
        }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF("p", "mm", "a4");

        const selectedClass = classSelect.value ? `Class ${classSelect.value}` : "All Classes";
        const selectedYear = getSelectedExamYear();

        doc.setFontSize(16);
        doc.text("Baralai High School", 14, 15);

        doc.setFontSize(11);
        doc.text(`Student List - ${selectedClass} - Exam Year ${selectedYear}`, 14, 23);

        doc.autoTable({
            startY: 30,
            head: [["Serial", "Name", "Roll", "Class", "Section", "Year", "Guardian", "Phone", "Address"]],
            body: data.map((student) => [
                student.Serial,
                student.Name,
                student.Roll,
                student.Class,
                student.Section,
                student.Year,
                student.Guardian,
                student.Phone,
                student.Address
            ]),
            styles: {
                fontSize: 8,
                cellPadding: 3
            },
            headStyles: {
                fillColor: [0, 51, 102],
                textColor: 255
            }
        });

        const fileName = classSelect.value
            ? `students-class-${classSelect.value}-year-${selectedYear}.pdf`
            : `students-all-classes-year-${selectedYear}.pdf`;

        doc.save(fileName);

        showStatus("PDF downloaded successfully.", "success");
    }

    function downloadStudentsExcel() {
        const data = getStudentsForDownload();

        if (data.length === 0) {
            showStatus("No student data available for Excel download.", "error");
            return;
        }

        const selectedYear = getSelectedExamYear();

        const fileName = classSelect.value
            ? `students-class-${classSelect.value}-year-${selectedYear}.xlsx`
            : `students-all-classes-year-${selectedYear}.xlsx`;

        if (window.XLSX) {
            const worksheet = XLSX.utils.json_to_sheet(data);
            const workbook = XLSX.utils.book_new();

            XLSX.utils.book_append_sheet(workbook, worksheet, "Students");
            XLSX.writeFile(workbook, fileName);

            showStatus("Excel downloaded successfully.", "success");
            return;
        }

        downloadStudentsCSV(data);
    }

    function downloadStudentsCSV(data) {
        const headers = Object.keys(data[0]);

        const rows = data.map((student) => {
            return headers.map((header) => {
                return `"${String(student[header]).replaceAll('"', '""')}"`;
            }).join(",");
        });

        const csvContent = [headers.join(","), ...rows].join("\n");

        const blob = new Blob([csvContent], {
            type: "text/csv;charset=utf-8;"
        });

        const selectedYear = getSelectedExamYear();

        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = classSelect.value
            ? `students-class-${classSelect.value}-year-${selectedYear}.csv`
            : `students-all-classes-year-${selectedYear}.csv`;

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        showStatus("CSV downloaded successfully. You can open it with Excel.", "success");
    }

    function showStatus(message, type = "success", autoHide = true) {
        if (!ajaxStatus) return;

        ajaxStatus.textContent = message;

        if (type === "success") {
            ajaxStatus.className = "status-success";
        } else if (type === "info") {
            ajaxStatus.className = "mt-2 text-muted";
        } else {
            ajaxStatus.className = "status-error";
        }

        if (autoHide) {
            setTimeout(() => {
                clearStatus();
            }, 2500);
        }
    }

    function clearStatus() {
        if (!ajaxStatus) return;

        ajaxStatus.textContent = "";
        ajaxStatus.className = "mt-2 text-muted";
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
});

// promotion function

(function () {
    document.addEventListener("DOMContentLoaded", function () {
        initStudentPageSectionSwitch();
    });

    window.addEventListener("hashchange", function () {
        switchStudentPageSection();
    });

    function initStudentPageSectionSwitch() {
        const addStudentLink =
            document.getElementById("bhsAddStudentMenuLink") ||
            document.getElementById("addStudentLink");

        const promoteClassLink =
            document.getElementById("bhsPromoteClassMenuLink") ||
            document.getElementById("promoteClassLink");

        if (addStudentLink) {
            addStudentLink.addEventListener("click", function () {
                setTimeout(switchStudentPageSection, 50);
            });
        }

        if (promoteClassLink) {
            promoteClassLink.addEventListener("click", function () {
                setTimeout(switchStudentPageSection, 50);
            });
        }

        switchStudentPageSection();
    }

    function switchStudentPageSection() {
        const addStudentSection = document.getElementById("add-student");
        const promoteClassSection = document.getElementById("promote-class");

        const addStudentLink =
            document.getElementById("bhsAddStudentMenuLink") ||
            document.getElementById("addStudentLink");

        const promoteClassLink =
            document.getElementById("bhsPromoteClassMenuLink") ||
            document.getElementById("promoteClassLink");

        const currentHash = window.location.hash || "#add-student";

        if (!addStudentSection || !promoteClassSection) return;

        addStudentLink?.classList.remove("active");
        promoteClassLink?.classList.remove("active");

        if (currentHash === "#promote-class") {
            addStudentSection.style.display = "none";
            promoteClassSection.style.display = "block";
            promoteClassLink?.classList.add("active");
            updatePageTitle("Class Promotion");
        } else {
            addStudentSection.style.display = "block";
            promoteClassSection.style.display = "none";
            addStudentLink?.classList.add("active");
            updatePageTitle("Manage Students");
        }
    }

    function updatePageTitle(titleText) {
        const titleElement =
            document.querySelector(".admin-page-title h2") ||
            document.querySelector(".page-title h2") ||
            document.querySelector(".admin-header h2") ||
            document.querySelector("h2");

        if (!titleElement) return;

        if (titleText === "Class Promotion") {
            titleElement.innerHTML = `<i class="fas fa-level-up-alt"></i> Class Promotion`;
        } else {
            titleElement.innerHTML = `<i class="fas fa-user-graduate"></i> Manage Students`;
        }
    }
})();

(function () {
    const STUDENTS_KEY = "bhs_students";
    const RESULTS_KEY = "bhs_results";
    const SELECTED_YEAR_KEY = "bhs_selected_exam_year";
    const FINAL_EXAM_NAME = "Final Exam";
    const GENERAL_SECTION = "General";

    document.addEventListener("DOMContentLoaded", function () {
        initClassPromotionSetup();
    });

    function initClassPromotionSetup() {
        const fromYear = document.getElementById("promotionFromYear");
        const fromClass = document.getElementById("promotionFromClass");
        const toYear = document.getElementById("promotionToYear");
        const toClass = document.getElementById("promotionToClass");
        const resetBtn = document.getElementById("resetPromotionBtn");
        const loadBtn = document.getElementById("loadPromotionStudentsBtn");

        if (!fromYear || !fromClass || !toYear || !toClass) return;

        populatePromotionYears();

        fromYear.addEventListener("change", function () {
            autoSetPromotionToYear();
            clearPromotionStatus();
        });

        fromClass.addEventListener("change", function () {
            autoSetPromotionToClass();
            clearPromotionStatus();
        });

        toYear.addEventListener("change", clearPromotionStatus);
        toClass.addEventListener("change", clearPromotionStatus);

        if (resetBtn) {
            resetBtn.addEventListener("click", resetPromotionForm);
        }

        if (loadBtn) {
            loadBtn.addEventListener("click", function () {
                validatePromotionBasicInputs();
            });
        }

        autoSetDefaultPromotionValues();
    }

    function populatePromotionYears() {
        const fromYear = document.getElementById("promotionFromYear");
        const toYear = document.getElementById("promotionToYear");

        if (!fromYear || !toYear) return;

        const years = getAvailablePromotionYears();

        fromYear.innerHTML = `<option value="">Select Year</option>`;
        toYear.innerHTML = `<option value="">Select Year</option>`;

        years.forEach(function (year) {
            fromYear.innerHTML += `<option value="${year}">Exam Year ${year}</option>`;
        });

        const toYears = [...new Set(years.map((year) => Number(year) + 1))]
            .filter(Boolean)
            .sort((a, b) => b - a);

        toYears.forEach(function (year) {
            toYear.innerHTML += `<option value="${year}">Exam Year ${year}</option>`;
        });
    }

    function getAvailablePromotionYears() {
        const students = readArrayFromStorage(STUDENTS_KEY);
        const results = readArrayFromStorage(RESULTS_KEY);
        const currentYear = new Date().getFullYear();
        const selectedYear = localStorage.getItem(SELECTED_YEAR_KEY);

        const years = [
            selectedYear,
            currentYear,
            ...students.map(getStudentYear),
            ...results.map(getResultYear)
        ]
            .filter(Boolean)
            .map(Number)
            .filter((year) => !Number.isNaN(year));

        return [...new Set(years)].sort((a, b) => b - a);
    }

    function autoSetDefaultPromotionValues() {
        const fromYear = document.getElementById("promotionFromYear");
        const toYear = document.getElementById("promotionToYear");

        if (!fromYear || !toYear) return;

        const selectedYear = localStorage.getItem(SELECTED_YEAR_KEY);
        const currentYear = new Date().getFullYear();

        const defaultFromYear = selectedYear || currentYear;

        if ([...fromYear.options].some((option) => option.value === String(defaultFromYear))) {
            fromYear.value = String(defaultFromYear);
        }

        autoSetPromotionToYear();
    }

    function autoSetPromotionToYear() {
        const fromYear = document.getElementById("promotionFromYear");
        const toYear = document.getElementById("promotionToYear");

        if (!fromYear || !toYear) return;

        if (!fromYear.value) {
            toYear.value = "";
            return;
        }

        const nextYear = String(Number(fromYear.value) + 1);

        if (![...toYear.options].some((option) => option.value === nextYear)) {
            toYear.innerHTML += `<option value="${nextYear}">Exam Year ${nextYear}</option>`;
        }

        toYear.value = nextYear;
    }

    function autoSetPromotionToClass() {
        const fromClass = document.getElementById("promotionFromClass");
        const toClass = document.getElementById("promotionToClass");

        if (!fromClass || !toClass) return;

        const currentClass = Number(fromClass.value);

        if (!currentClass) {
            toClass.value = "";
            return;
        }

        if (currentClass >= 10) {
            toClass.value = "";
            showPromotionStatus(
                "Class 10 promotion is disabled for now. Later you can add Alumni/Graduated system.",
                "warning"
            );
            return;
        }

        const nextClass = String(currentClass + 1);

        if ([...toClass.options].some((option) => option.value === nextClass)) {
            toClass.value = nextClass;
        }
    }

    function validatePromotionBasicInputs() {
        const fromYear = document.getElementById("promotionFromYear")?.value;
        const fromClass = document.getElementById("promotionFromClass")?.value;
        const toYear = document.getElementById("promotionToYear")?.value;
        const toClass = document.getElementById("promotionToClass")?.value;

        clearPromotionStatus();

        if (!fromYear) {
            showPromotionStatus("Please select From Exam Year.", "error");
            return false;
        }

        if (!fromClass) {
            showPromotionStatus("Please select From Class.", "error");
            return false;
        }

        if (!toYear) {
            showPromotionStatus("Please select To Exam Year.", "error");
            return false;
        }

        if (!toClass) {
            showPromotionStatus("Please select To Class.", "error");
            return false;
        }

        if (Number(fromClass) >= 10) {
            showPromotionStatus("Class 10 promotion is disabled for now.", "warning");
            return false;
        }

        if (String(fromYear) === String(toYear) && String(fromClass) === String(toClass)) {
            showPromotionStatus("From class and target class cannot be the same.", "error");
            return false;
        }

        if (Number(toYear) <= Number(fromYear)) {
            showPromotionStatus("To Exam Year must be greater than From Exam Year.", "error");
            return false;
        }

        showPromotionStatus(
            "Basic setup completed. Next step will load all students and result status.",
            "success"
        );

        return true;
    }

    function resetPromotionForm() {
        const fromYear = document.getElementById("promotionFromYear");
        const fromClass = document.getElementById("promotionFromClass");
        const toYear = document.getElementById("promotionToYear");
        const toClass = document.getElementById("promotionToClass");
        const tableBody = document.getElementById("promotionTableBody");

        if (fromYear) fromYear.value = "";
        if (fromClass) fromClass.value = "";
        if (toYear) toYear.value = "";
        if (toClass) toClass.value = "";

        updatePromotionCounter(0, 0, 0, 0);

        if (tableBody) {
            tableBody.innerHTML = `
        <tr>
          <td colspan="12" class="empty-table-message">
            No students loaded for promotion.
          </td>
        </tr>
      `;
        }

        clearPromotionStatus();

        const summaryContent = document.getElementById("promotionSummaryContent");
        if (summaryContent) {
            summaryContent.innerHTML = "No promotion completed yet.";
        }
    }

    function updatePromotionCounter(total, eligible, failed, selected) {
        const totalCount = document.getElementById("promotionTotalCount");
        const eligibleCount = document.getElementById("promotionEligibleCount");
        const failedCount = document.getElementById("promotionFailedCount");
        const selectedCount = document.getElementById("promotionSelectedCount");

        if (totalCount) totalCount.textContent = total;
        if (eligibleCount) eligibleCount.textContent = eligible;
        if (failedCount) failedCount.textContent = failed;
        if (selectedCount) selectedCount.textContent = selected;
    }

    function showPromotionStatus(message, type) {
        const status = document.getElementById("promotionStatus");

        if (!status) return;

        status.textContent = message;
        status.className = `promotion-status ${type}`;
    }

    function clearPromotionStatus() {
        const status = document.getElementById("promotionStatus");

        if (!status) return;

        status.textContent = "";
        status.className = "promotion-status";
    }

    async function fetchPromotionSourceData() {
        if (!hasPromotionSupabaseClient()) {
            throw new Error("Supabase connection not found. Promotion requires Supabase data.");
        }

        const [studentsData, resultsData] = await Promise.all([
            window.bhsFetchAllRows(
                "students",
                "id, student_code, name, roll, class_name, section_name, academic_year, guardian_name, phone, address, religion, optional_subject_name, optional_subject_code, status, promotion_status, promoted_from, created_at, updated_at",
                [
                    { column: "academic_year", options: { ascending: false } },
                    { column: "class_name", options: { ascending: true } },
                    { column: "roll", options: { ascending: true } }
                ]
            ),

            window.bhsFetchAllRows(
                "results",
                "id, student_id, name_snapshot, roll_snapshot, class_name, section_name, academic_year, exam_name, subjects, marks, subject_grades, total_marks, average, gpa, total_point, final_grade, completed_subjects, total_subjects, publish_status, is_published, published_at, ranking_score, last_edited_after_publish_at, unpublished_at, unpublished_reason, created_at, updated_at",
                [
                    { column: "academic_year", options: { ascending: false } },
                    { column: "class_name", options: { ascending: true } },
                    { column: "roll_snapshot", options: { ascending: true } }
                ]
            )
        ]);

        const students = (studentsData || []).map(mapPromotionStudentFromSupabase);
        const results = (resultsData || []).map(mapPromotionResultFromSupabase);

        safeSetStudentJSON(STUDENTS_KEY, students);
        safeSetStudentJSON(RESULTS_KEY, results);

        return { students, results };
    }

    function hasPromotionSupabaseClient() {
        return Boolean(window.bhsSupabase && typeof window.bhsSupabase.from === "function");
    }

    function mapPromotionStudentFromSupabase(row) {
        return {
            id: row.id,
            studentCode: row.student_code || "",
            name: row.name || "",
            roll: row.roll || "",
            guardianName: row.guardian_name || "",
            phone: row.phone || "",
            address: row.address || "",
            className: row.class_name || "",
            sectionName: row.section_name || GENERAL_SECTION,
            religion: normalizeReligion(row.religion),
            optionalSubjectName: row.optional_subject_name || "",
            optionalSubjectCode: row.optional_subject_code || "",
            year: row.academic_year || "",
            status: row.status || "active",
            promotionStatus: row.promotion_status || "",
            promotedFrom: row.promoted_from || null,
            createdAt: row.created_at || "",
            updatedAt: row.updated_at || ""
        };
    }

    function mapPromotionResultFromSupabase(row) {
        return {
            id: row.id,
            studentId: row.student_id || "",
            name: row.name_snapshot || "",
            roll: row.roll_snapshot || "",
            className: row.class_name || "",
            sectionName: row.section_name || GENERAL_SECTION,
            year: row.academic_year || "",
            examName: row.exam_name || FINAL_EXAM_NAME,
            subjects: Array.isArray(row.subjects) ? row.subjects : [],
            marks: row.marks && typeof row.marks === "object" ? row.marks : {},
            subjectGrades: row.subject_grades && typeof row.subject_grades === "object" ? row.subject_grades : {},
            totalMarks: Number(row.total_marks || 0),
            average: Number(row.average || 0),
            gpa: Number(row.gpa || 0),
            totalPoint: Number(row.total_point || 0),
            rankingScore: Number(row.ranking_score ?? row.gpa ?? 0),
            finalGrade: row.final_grade || "",
            completedSubjects: Number(row.completed_subjects || 0),
            totalSubjects: Number(row.total_subjects || 0),
            publishStatus: row.publish_status || "draft",
            isPublished: Boolean(row.is_published),
            publishedAt: row.published_at || "",
            lastEditedAfterPublishAt: row.last_edited_after_publish_at || "",
            unpublishedAt: row.unpublished_at || "",
            unpublishedReason: row.unpublished_reason || "",
            createdAt: row.created_at || "",
            updatedAt: row.updated_at || ""
        };
    }

    function readArrayFromStorage(key) {
        try {
            const data = JSON.parse(localStorage.getItem(key) || "[]");
            return Array.isArray(data) ? data : [];
        } catch (error) {
            return [];
        }
    }

    function getStudentYear(student) {
        return student?.year || student?.examYear || student?.studentYear || "";
    }

    function getResultYear(result) {
        return result?.year || result?.examYear || result?.exam_year || "";
    }

    window.bhsFetchPromotionSourceData = fetchPromotionSourceData;
})();

(function () {
    const STUDENTS_KEY = "bhs_students";
    const RESULTS_KEY = "bhs_results";
    const FINAL_EXAM_NAME = "Final Exam";
    const SECTION_CLASSES = ["9", "10"];
    const STUDENT_SECTIONS = ["Science", "Arts", "Commerce"];
    const STUDENT_RELIGIONS = ["Islam", "Hindu"];
    const GENERAL_SECTION = "General";

    let promotionLoadedStudents = [];
    let promotionExistingTargetStudents = [];
    let promotionActiveTargetSection = "";
    let promotionActiveTargetOptional = { name: "", code: "" };

    document.addEventListener("DOMContentLoaded", function () {
        initPromotionStudentLoader();
    });

    function initPromotionStudentLoader() {
        const loadBtn = document.getElementById("loadPromotionStudentsBtn");
        const selectEligibleBtn = document.getElementById("selectEligibleStudentsBtn");
        const unselectAllBtn = document.getElementById("unselectAllPromotionBtn");
        const targetSection = document.getElementById("promotionTargetSection");
        const targetOptional = document.getElementById("promotionTargetOptionalSubject");
        const toClass = document.getElementById("promotionToClass");
        const fromClass = document.getElementById("promotionFromClass");
        const resetBtn = document.getElementById("resetPromotionBtn");

        if (loadBtn) {
            loadBtn.addEventListener("click", loadPromotionStudents);
        }

        if (selectEligibleBtn) {
            selectEligibleBtn.addEventListener("click", selectEligiblePromotionStudents);
        }

        if (unselectAllBtn) {
            unselectAllBtn.addEventListener("click", unselectAllPromotionStudents);
        }

        if (targetSection) {
            targetSection.addEventListener("change", async function () {
                promotionActiveTargetSection = normalizeSectionForClass(
                    document.getElementById("promotionToClass")?.value,
                    this.value
                );
                promotionActiveTargetOptional = { name: "", code: "" };
                await loadPromotionTargetOptionalSubjects();
                applyPromotionOptionalToCurrentSection();
                updateNewRolls();
                renderPromotionTable();
                updatePromotionCounts();

                if (promotionActiveTargetSection) {
                    showPromotionStatus(
                        `Now selecting students for ${promotionActiveTargetSection} section. Choose an optional subject if needed, then select students.`,
                        "info"
                    );
                }
            });
        }

        if (targetOptional) {
            targetOptional.addEventListener("change", function () {
                promotionActiveTargetOptional = getPromotionActiveTargetOptional();
                applyPromotionOptionalToCurrentSection();
                renderPromotionTable();
                updatePromotionCounts();
            });
        }

        [toClass, fromClass].forEach(function (select) {
            if (!select) return;
            select.addEventListener("change", function () {
                promotionActiveTargetSection = "";
                promotionActiveTargetOptional = { name: "", code: "" };
                if (targetSection) targetSection.value = "";
                if (targetOptional) targetOptional.value = "";
                updatePromotionTargetSectionBox();
                loadPromotionTargetOptionalSubjects();
                renderPromotionTable();
                updatePromotionCounts();
            });
        });

        if (resetBtn) {
            resetBtn.addEventListener("click", function () {
                promotionExistingTargetStudents = [];
                promotionActiveTargetSection = "";
                promotionActiveTargetOptional = { name: "", code: "" };
                if (targetSection) targetSection.value = "";
                if (targetOptional) targetOptional.value = "";
                updatePromotionTargetSectionBox();
                loadPromotionTargetOptionalSubjects();
            });
        }

        updatePromotionTargetSectionBox();
    }

    function updatePromotionTargetSectionBox() {
        const box = document.getElementById("promotionTargetSectionBox");
        const optionalBox = document.getElementById("promotionTargetOptionalBox");
        const select = document.getElementById("promotionTargetSection");
        const optionalSelect = document.getElementById("promotionTargetOptionalSubject");
        const toClass = document.getElementById("promotionToClass")?.value;

        if (!box) return;

        if (requiresSection(toClass)) {
            box.style.display = "flex";
            if (optionalBox) optionalBox.style.display = promotionActiveTargetSection ? "block" : "none";
        } else {
            box.style.display = "none";
            if (optionalBox) optionalBox.style.display = "none";
            promotionActiveTargetSection = "";
            promotionActiveTargetOptional = { name: "", code: "" };
            if (select) select.value = "";
            if (optionalSelect) {
                optionalSelect.innerHTML = `<option value="">No optional subject</option>`;
                optionalSelect.value = "";
            }
        }
    }

    function getPromotionActiveTargetSection() {
        const toClass = document.getElementById("promotionToClass")?.value || promotionLoadedStudents[0]?.toClass || "";
        const selectedValue = document.getElementById("promotionTargetSection")?.value || promotionActiveTargetSection || "";
        return normalizeSectionForClass(toClass, selectedValue);
    }


    function getPromotionActiveTargetOptional() {
        const select = document.getElementById("promotionTargetOptionalSubject");
        if (!select || !select.value) return { name: "", code: "" };
        const option = select.options[select.selectedIndex];
        return {
            name: select.value,
            code: option ? option.dataset.code || "" : ""
        };
    }

    async function loadPromotionTargetOptionalSubjects(preferredName = "") {
        const optionalBox = document.getElementById("promotionTargetOptionalBox");
        const optionalSelect = document.getElementById("promotionTargetOptionalSubject");
        const toClass = document.getElementById("promotionToClass")?.value || "";
        const targetSection = getPromotionActiveTargetSection();

        if (!optionalSelect) return;

        if (!requiresSection(toClass) || !targetSection) {
            if (optionalBox) optionalBox.style.display = "none";
            optionalSelect.innerHTML = `<option value="">No optional subject</option>`;
            optionalSelect.value = "";
            promotionActiveTargetOptional = { name: "", code: "" };
            return;
        }

        if (optionalBox) optionalBox.style.display = "block";
        optionalSelect.innerHTML = `<option value="">Loading optional subjects...</option>`;
        optionalSelect.disabled = true;

        let optionSubjects = [];
        if (window.bhsSupabase) {
            const { data, error } = await window.bhsSupabase
                .from("subjects")
                .select("subject_name, subject_code, sort_order")
                .eq("class_name", String(toClass))
                .eq("section_name", String(targetSection))
                .eq("subject_type", "optional_4th")
                .eq("is_active", true)
                .order("sort_order", { ascending: true });

            if (!error && Array.isArray(data)) {
                optionSubjects = data.map(function (row) {
                    return {
                        name: row.subject_name || "",
                        code: row.subject_code || ""
                    };
                }).filter(function (item) { return item.name; });
            } else if (error) {
                console.warn("Promotion optional subject load warning:", error);
            }
        }

        optionalSelect.disabled = false;
        optionalSelect.innerHTML = `<option value="">No optional subject / keep existing</option>` + optionSubjects.map(function (subject) {
            return `<option value="${escapeAttr(subject.name)}" data-code="${escapeAttr(subject.code)}">${escapeHTML(subject.code ? `${subject.name} (${subject.code})` : subject.name)}</option>`;
        }).join("");

        if (preferredName) {
            optionalSelect.value = preferredName;
        }

        promotionActiveTargetOptional = getPromotionActiveTargetOptional();
    }

    function applyPromotionOptionalToCurrentSection() {
        const activeSection = getPromotionActiveTargetSection();
        const activeOptional = getPromotionActiveTargetOptional();

        if (!activeSection) return;

        promotionLoadedStudents.forEach(function (student) {
            if (!student.selected) return;
            if (getEffectiveTargetSection(student) !== activeSection) return;

            if (activeOptional.name) {
                student.targetOptionalSubjectName = activeOptional.name;
                student.targetOptionalSubjectCode = activeOptional.code;
            }
        });

        window.bhsPromotionLoadedStudents = promotionLoadedStudents;
    }

    function getPromotionVisibleRows() {
        const toClass = document.getElementById("promotionToClass")?.value || promotionLoadedStudents[0]?.toClass || "";
        const activeSection = getPromotionActiveTargetSection();

        return promotionLoadedStudents
            .map(function (student, index) {
                return { student, index };
            })
            .filter(function (row) {
                if (!requiresSection(toClass)) return true;

                const assignedSection = getEffectiveTargetSection(row.student);

                if (row.student.selected && assignedSection) {
                    return assignedSection === activeSection;
                }

                return true;
            });
    }

    async function loadPromotionStudents() {
        const fromYear = document.getElementById("promotionFromYear")?.value;
        const fromClass = document.getElementById("promotionFromClass")?.value;
        const toYear = document.getElementById("promotionToYear")?.value;
        const toClass = document.getElementById("promotionToClass")?.value;

        clearPromotionStatus();
        clearPromotionSummary();

        if (!validatePromotionInputs(fromYear, fromClass, toYear, toClass)) return;

        showPromotionStatus("Loading all students and result status from Supabase...", "info");

        let students = [];
        let results = [];

        try {
            const sourceData = await window.bhsFetchPromotionSourceData();
            students = sourceData.students;
            results = sourceData.results;
        } catch (error) {
            console.error("Promotion data load error:", error);
            renderEmptyPromotionTable();
            showPromotionStatus(error.message || "Could not load promotion data from Supabase.", "error");
            return;
        }

        promotionExistingTargetStudents = students.filter(function (student) {
            return (
                String(getStudentYear(student)) === String(toYear) &&
                String(getStudentClass(student)) === String(toClass)
            );
        });

        updatePromotionTargetSectionBox();
        await loadPromotionTargetOptionalSubjects();

        const sourceStudents = students
            .filter(function (student) {
                return (
                    String(getStudentYear(student)) === String(fromYear) &&
                    String(getStudentClass(student)) === String(fromClass)
                );
            })
            .sort(function (a, b) {
                return Number(getStudentRoll(a)) - Number(getStudentRoll(b));
            });

        if (!sourceStudents.length) {
            renderEmptyPromotionTable();
            showPromotionStatus(
                `No student found in Class ${fromClass}, Exam Year ${fromYear}.`,
                "error"
            );
            return;
        }

        const finalExamResults = results.filter(function (result) {
            return (
                isFinalExamResult(result) &&
                String(getResultYear(result)) === String(fromYear) &&
                String(getResultClass(result)) === String(fromClass)
            );
        });

        const promotionRows = sourceStudents
            .map(function (student) {
                const result = findMatchingFinalResult(finalExamResults, student, fromYear, fromClass);
                const resultStatus = getPromotionResultStatus(result);
                const subjects = result ? getResultSubjects(result) : [];
                const totalMarks = result ? getResultTotalMarks(result) : 0;
                const gpa = result ? getResultGPA(result) : 0;
                const grade = result ? getResultFinalGrade(result) : "-";
                const failed = resultStatus.status === "failed";
                const eligible = resultStatus.status === "passed";

                return {
                    id: generatePromotionRowId(result, student),
                    resultId: result?.id || "",
                    studentId: student.id || "",
                    oldStudent: student || null,
                    rawResult: result || null,
                    name: getStudentName(student) || getResultStudentName(result) || "Student",
                    oldRoll: getStudentRoll(student) || getResultRoll(result) || "",
                    oldSection: getStudentSection(student),
                    oldOptionalSubjectName: student.optionalSubjectName || "",
                    oldOptionalSubjectCode: student.optionalSubjectCode || "",
                    targetOptionalSubjectName: requiresSection(toClass) ? (student.optionalSubjectName || "") : "",
                    targetOptionalSubjectCode: requiresSection(toClass) ? (student.optionalSubjectCode || "") : "",
                    fromYear,
                    fromClass,
                    toYear,
                    toClass,
                    targetSection: getInitialTargetSectionForBulkMode(student, fromClass, toClass),
                    subjects,
                    totalMarks,
                    gpa,
                    grade,
                    failed,
                    eligible,
                    resultStatus: resultStatus.status,
                    resultStatusText: resultStatus.label,
                    selected: shouldAutoSelectPromotionRow(eligible, fromClass, toClass),
                    rank: 0,
                    newRoll: "",
                    remarks: resultStatus.remarks
                };
            })
            .sort(function (a, b) {
                const aRankable = a.resultStatus === "passed" || a.resultStatus === "failed";
                const bRankable = b.resultStatus === "passed" || b.resultStatus === "failed";

                if (aRankable && !bRankable) return -1;
                if (!aRankable && bRankable) return 1;

                const gpaDiff = Number(b.gpa) - Number(a.gpa);
                if (gpaDiff !== 0) return gpaDiff;

                const totalDiff = Number(b.totalMarks) - Number(a.totalMarks);
                if (totalDiff !== 0) return totalDiff;

                return Number(a.oldRoll) - Number(b.oldRoll);
            });

        promotionRows.forEach(function (item, index) {
            item.rank = index + 1;
        });

        promotionLoadedStudents = promotionRows;
        window.bhsPromotionLoadedStudents = promotionLoadedStudents;

        promotionActiveTargetSection = getPromotionActiveTargetSection();

        updateNewRolls();
        renderPromotionTable();
        updatePromotionCounts();

        const eligibleCount = promotionLoadedStudents.filter((student) => student.eligible).length;
        const manualCount = promotionLoadedStudents.length - eligibleCount;

        const sectionHint = requiresSection(toClass)
            ? " Select a target section below, then tick students for that section."
            : "";

        showPromotionStatus(
            `${promotionLoadedStudents.length} student(s) loaded. ${eligibleCount} published passed student(s) found. ${manualCount} student(s) need admin decision.${sectionHint}`,
            "success"
        );
    }

    function renderPromotionTable() {
        const tableBody = document.getElementById("promotionTableBody");

        if (!tableBody) return;

        if (!promotionLoadedStudents.length) {
            renderEmptyPromotionTable();
            return;
        }

        const visibleRows = getPromotionVisibleRows();

        if (!visibleRows.length) {
            tableBody.innerHTML = `
        <tr>
          <td colspan="12" class="empty-table-message">
            No student available for this section. Selected students in other sections are hidden.
          </td>
        </tr>
      `;
            return;
        }

        const sectionRequired = requiresSection(document.getElementById("promotionToClass")?.value || promotionLoadedStudents[0]?.toClass);
        const activeSection = getPromotionActiveTargetSection();

        tableBody.innerHTML = visibleRows
            .map(function (row) {
                const student = row.student;
                const index = row.index;
                const statusClass = student.eligible ? "pass" : "fail";
                const statusText = student.resultStatusText || (student.eligible ? "Pass" : "Needs Decision");
                const checked = student.selected ? "checked" : "";
                const disabled = sectionRequired && !activeSection ? "disabled" : "";

                return `
          <tr>
            <td>
              <input
                type="checkbox"
                class="promotion-checkbox"
                data-index="${index}"
                ${checked}
                ${disabled}
              />
            </td>

            <td><strong>${escapeHTML(student.rank)}</strong></td>
            <td>${escapeHTML(student.oldRoll)}</td>
            <td><strong>${student.selected && student.newRoll ? escapeHTML(student.newRoll) : "-"}</strong></td>
            <td>${renderPromotionSectionCell(student)}</td>
            <td>${renderPromotionOptionalCell(student)}</td>
            <td>${escapeHTML(student.name)}</td>
            <td><strong>${escapeHTML(student.totalMarks)}</strong></td>
            <td>${escapeHTML(Number(student.gpa).toFixed(2))}</td>
            <td><strong>${escapeHTML(student.grade)}</strong></td>

            <td>
              <span class="promotion-status-badge ${statusClass}">
                ${statusText}
              </span>
            </td>

            <td>${escapeHTML(student.remarks)}</td>
          </tr>
        `;
            })
            .join("");

        bindPromotionCheckboxes();
    }

    function renderPromotionSectionCell(student) {
        if (!requiresSection(student.toClass)) {
            return `<span class="promotion-section-badge">${GENERAL_SECTION}</span>`;
        }

        const assignedSection = getEffectiveTargetSection(student);
        const activeSection = getPromotionActiveTargetSection();

        if (student.selected && assignedSection) {
            return `<span class="promotion-section-badge success">${escapeHTML(assignedSection)}</span>`;
        }

        if (activeSection) {
            return `<span class="promotion-section-badge muted">Will go to ${escapeHTML(activeSection)}</span>`;
        }

        return `<span class="promotion-section-badge warning">Select section first</span>`;
    }


    function renderPromotionOptionalCell(student) {
        if (!requiresSection(student.toClass)) {
            return `<span class="promotion-section-badge muted">-</span>`;
        }

        const optional = getEffectiveTargetOptional(student);
        if (student.selected && optional.name) {
            return `<span class="promotion-section-badge success">${escapeHTML(optional.name)}</span>`;
        }

        if (student.selected) {
            return `<span class="promotion-section-badge muted">No optional</span>`;
        }

        const activeOptional = getPromotionActiveTargetOptional();
        if (getPromotionActiveTargetSection() && activeOptional.name) {
            return `<span class="promotion-section-badge muted">Will use ${escapeHTML(activeOptional.name)}</span>`;
        }

        return `<span class="promotion-section-badge muted">-</span>`;
    }

    function getEffectiveTargetOptional(student) {
        if (!requiresSection(student?.toClass)) {
            return { name: "", code: "" };
        }

        if (student?.targetOptionalSubjectName) {
            return {
                name: student.targetOptionalSubjectName || "",
                code: student.targetOptionalSubjectCode || ""
            };
        }

        return {
            name: student?.oldOptionalSubjectName || student?.oldStudent?.optionalSubjectName || "",
            code: student?.oldOptionalSubjectCode || student?.oldStudent?.optionalSubjectCode || ""
        };
    }

    function bindPromotionCheckboxes() {
        const checkboxes = document.querySelectorAll(".promotion-checkbox");

        checkboxes.forEach(function (checkbox) {
            checkbox.addEventListener("change", function () {
                const index = Number(this.dataset.index);
                const student = promotionLoadedStudents[index];

                if (!student) return;

                const sectionRequired = requiresSection(student.toClass);
                const activeSection = getPromotionActiveTargetSection();

                if (sectionRequired && !activeSection) {
                    this.checked = false;
                    showPromotionStatus("Please select Science, Arts, or Commerce section first.", "warning");
                    return;
                }

                if (this.checked) {
                    student.selected = true;
                    student.targetSection = sectionRequired ? activeSection : GENERAL_SECTION;
                    const activeOptional = getPromotionActiveTargetOptional();
                    if (sectionRequired && activeOptional.name) {
                        student.targetOptionalSubjectName = activeOptional.name;
                        student.targetOptionalSubjectCode = activeOptional.code;
                    }
                    student.remarks = student.eligible
                        ? `Selected for ${student.targetSection}`
                        : `Manually selected for ${student.targetSection}`;
                } else {
                    student.selected = false;
                    student.newRoll = "";
                    student.targetSection = sectionRequired ? "" : GENERAL_SECTION;
                    student.targetOptionalSubjectName = "";
                    student.targetOptionalSubjectCode = "";
                    student.remarks = student.eligible
                        ? "Unselected by admin"
                        : (student.resultStatusText || "Needs decision") + " - unselected";
                }

                updateNewRolls();
                renderPromotionTable();
                updatePromotionCounts();
            });
        });
    }

    function updateNewRolls() {
        promotionLoadedStudents.forEach(function (student, index) {
            student.newRoll = "";

            if (!student.selected) return;

            const targetSection = getEffectiveTargetSection(student);

            if (requiresSection(student.toClass) && !targetSection) {
                return;
            }

            // Roll will follow the overall merit/rank position, not section-wise serial.
            // Example: rank 11 selected for Arts will keep new roll 11, not Arts roll 1.
            const rankRoll = Number(student.rank);
            const fallbackRoll = Number(student.oldRoll);

            if (!Number.isNaN(rankRoll) && rankRoll > 0) {
                student.newRoll = String(rankRoll);
                return;
            }

            if (!Number.isNaN(fallbackRoll) && fallbackRoll > 0) {
                student.newRoll = String(fallbackRoll);
                return;
            }

            student.newRoll = String(index + 1);
        });

        window.bhsPromotionLoadedStudents = promotionLoadedStudents;
    }

    function selectEligiblePromotionStudents() {
        if (!promotionLoadedStudents.length) {
            showPromotionStatus("Please load students first.", "warning");
            return;
        }

        const toClass = document.getElementById("promotionToClass")?.value || promotionLoadedStudents[0]?.toClass || "";
        const activeSection = getPromotionActiveTargetSection();

        if (requiresSection(toClass) && !activeSection) {
            showPromotionStatus("Please select a target section first, then use Select Eligible.", "warning");
            return;
        }

        const visibleRows = getPromotionVisibleRows();
        let selectedNow = 0;

        visibleRows.forEach(function (row) {
            const student = row.student;

            if (!student.eligible) return;

            student.selected = true;
            student.targetSection = requiresSection(student.toClass) ? activeSection : GENERAL_SECTION;
            const activeOptional = getPromotionActiveTargetOptional();
            if (requiresSection(student.toClass) && activeOptional.name) {
                student.targetOptionalSubjectName = activeOptional.name;
                student.targetOptionalSubjectCode = activeOptional.code;
            }
            student.remarks = `Selected for ${student.targetSection}`;
            selectedNow++;
        });

        updateNewRolls();
        renderPromotionTable();
        updatePromotionCounts();

        showPromotionStatus(
            requiresSection(toClass)
                ? `${selectedNow} eligible student(s) selected for ${activeSection}. Switch section to select other students.`
                : `${selectedNow} eligible student(s) selected.`,
            selectedNow ? "success" : "warning"
        );
    }

    function unselectAllPromotionStudents() {
        if (!promotionLoadedStudents.length) {
            showPromotionStatus("Please load students first.", "warning");
            return;
        }

        const toClass = document.getElementById("promotionToClass")?.value || promotionLoadedStudents[0]?.toClass || "";
        const activeSection = getPromotionActiveTargetSection();

        if (requiresSection(toClass) && !activeSection) {
            showPromotionStatus("Please select a target section first, then unselect students for that section.", "warning");
            return;
        }

        const visibleRows = getPromotionVisibleRows();
        let unselectedNow = 0;

        visibleRows.forEach(function (row) {
            const student = row.student;

            if (requiresSection(student.toClass)) {
                if (getEffectiveTargetSection(student) !== activeSection) return;
            }

            if (student.selected) unselectedNow++;

            student.selected = false;
            student.newRoll = "";
            student.targetSection = requiresSection(student.toClass) ? "" : GENERAL_SECTION;
            student.targetOptionalSubjectName = "";
            student.targetOptionalSubjectCode = "";
            student.remarks = student.eligible ? "Unselected by admin" : (student.resultStatusText || "Needs decision") + " - unselected";
        });

        updateNewRolls();
        renderPromotionTable();
        updatePromotionCounts();

        showPromotionStatus(
            requiresSection(toClass)
                ? `${unselectedNow} student(s) unselected from ${activeSection}.`
                : "All students unselected.",
            "warning"
        );
    }

    function updatePromotionCounts() {
        const total = promotionLoadedStudents.length;
        const eligible = promotionLoadedStudents.filter((student) => student.eligible).length;
        const failed = promotionLoadedStudents.filter((student) => !student.eligible).length;
        const selected = promotionLoadedStudents.filter((student) => student.selected).length;
        const toClass = document.getElementById("promotionToClass")?.value || promotionLoadedStudents[0]?.toClass || "";
        const activeSection = getPromotionActiveTargetSection();
        const visibleRows = promotionLoadedStudents.length ? getPromotionVisibleRows() : [];
        const selectedInView = visibleRows.filter((row) => row.student.selected).length;

        setText("promotionTotalCount", total);
        setText("promotionEligibleCount", eligible);
        setText("promotionFailedCount", failed);
        setText("promotionSelectedCount", selected);

        const subtitle = document.getElementById("promotionListSubTitle");
        if (subtitle) {
            if (!total) {
                subtitle.textContent = "Select year and class, then load students.";
            } else if (requiresSection(toClass)) {
                subtitle.textContent = activeSection
                    ? `${activeSection} section view: ${visibleRows.length} available student(s), ${selectedInView} selected here. Total selected across sections: ${selected}.`
                    : `${total} student(s) loaded. Select Science, Arts, or Commerce first to start choosing students.`;
            } else {
                subtitle.textContent = `${selected} selected from ${total} loaded student(s). All source students are shown; admin can manually decide promotion.`;
            }
        }
    }

    function validatePromotionInputs(fromYear, fromClass, toYear, toClass) {
        if (!fromYear) {
            showPromotionStatus("Please select From Exam Year.", "error");
            return false;
        }

        if (!fromClass) {
            showPromotionStatus("Please select From Class.", "error");
            return false;
        }

        if (!toYear) {
            showPromotionStatus("Please select To Exam Year.", "error");
            return false;
        }

        if (!toClass) {
            showPromotionStatus("Please select To Class.", "error");
            return false;
        }

        if (Number(fromClass) >= 10) {
            showPromotionStatus("Class 10 promotion is disabled for now.", "warning");
            return false;
        }

        if (Number(toYear) <= Number(fromYear)) {
            showPromotionStatus("To Exam Year must be greater than From Exam Year.", "error");
            return false;
        }

        if (Number(toClass) !== Number(fromClass) + 1) {
            showPromotionStatus("To Class must be the next upper class.", "error");
            return false;
        }

        return true;
    }

    function renderEmptyPromotionTable() {
        const tableBody = document.getElementById("promotionTableBody");

        if (tableBody) {
            tableBody.innerHTML = `
        <tr>
          <td colspan="12" class="empty-table-message">
            No students loaded for promotion.
          </td>
        </tr>
      `;
        }

        promotionLoadedStudents = [];
        promotionExistingTargetStudents = [];
        window.bhsPromotionLoadedStudents = promotionLoadedStudents;
        updatePromotionCounts();
    }

    function clearPromotionSummary() {
        const summary = document.getElementById("promotionSummaryContent");

        if (summary) {
            summary.innerHTML = "No promotion completed yet.";
        }
    }

    function findMatchingFinalResult(results, student, year, className) {
        const byId = results.find(function (result) {
            return String(getResultStudentId(result) || "") === String(student.id || "");
        });

        if (byId) return byId;

        const byRoll = results.find(function (result) {
            return (
                String(getResultYear(result)) === String(year) &&
                String(getResultClass(result)) === String(className) &&
                String(getResultRoll(result)) === String(getStudentRoll(student))
            );
        });

        if (byRoll) return byRoll;

        return results.find(function (result) {
            return (
                String(getResultYear(result)) === String(year) &&
                String(getResultClass(result)) === String(className) &&
                normalizeText(getResultStudentName(result)) === normalizeText(getStudentName(student))
            );
        }) || null;
    }

    function getPromotionResultStatus(result) {
        if (!result) {
            return {
                status: "no-result",
                label: "No Result",
                remarks: "No final exam result - admin can manually select"
            };
        }

        if (!isPublishedResult(result)) {
            return {
                status: "unpublished",
                label: "Unpublished",
                remarks: "Result is draft/unpublished - admin can manually select"
            };
        }

        const totalSubjects = Number(result.totalSubjects || 0);
        const completedSubjects = Number(result.completedSubjects || 0);

        if (totalSubjects > 0 && completedSubjects < totalSubjects) {
            return {
                status: "incomplete",
                label: "Incomplete",
                remarks: "Result is incomplete - admin can manually select"
            };
        }

        if (isFailedResult(result)) {
            return {
                status: "failed",
                label: "Fail",
                remarks: "Failed - admin can manually select"
            };
        }

        return {
            status: "passed",
            label: "Pass",
            remarks: "Eligible"
        };
    }

    function findMatchingStudent(students, result, year, className) {
        const resultStudentId = getResultStudentId(result);
        const resultRoll = getResultRoll(result);
        const resultName = getResultStudentName(result);

        if (resultStudentId) {
            const byId = students.find((student) => String(student.id) === String(resultStudentId));
            if (byId) return byId;
        }

        const byRoll = students.find(function (student) {
            return (
                String(getStudentYear(student)) === String(year) &&
                String(getStudentClass(student)) === String(className) &&
                String(getStudentRoll(student)) === String(resultRoll)
            );
        });

        if (byRoll) return byRoll;

        const byName = students.find(function (student) {
            return (
                String(getStudentYear(student)) === String(year) &&
                String(getStudentClass(student)) === String(className) &&
                normalizeText(getStudentName(student)) === normalizeText(resultName)
            );
        });

        return byName || null;
    }


    function requiresSection(className) {
        return SECTION_CLASSES.includes(String(className));
    }

    function getStudentSection(student) {
        const sectionName = student?.sectionName || student?.section || student?.group || GENERAL_SECTION;
        return String(sectionName || GENERAL_SECTION);
    }

    function normalizeSectionForClass(className, sectionName) {
        if (!requiresSection(className)) {
            return GENERAL_SECTION;
        }

        const normalized = String(sectionName || "").trim();
        return STUDENT_SECTIONS.includes(normalized) ? normalized : "";
    }

    function getDefaultTargetSection(student, fromClass, toClass) {
        if (!requiresSection(toClass)) {
            return GENERAL_SECTION;
        }

        if (requiresSection(fromClass)) {
            return normalizeSectionForClass(toClass, getStudentSection(student));
        }

        return "";
    }

    function getInitialTargetSectionForBulkMode(student, fromClass, toClass) {
        if (!requiresSection(toClass)) {
            return GENERAL_SECTION;
        }

        if (requiresSection(fromClass)) {
            return normalizeSectionForClass(toClass, getStudentSection(student));
        }

        return "";
    }

    function shouldAutoSelectPromotionRow(eligible, fromClass, toClass) {
        if (!eligible) return false;

        // For section-based promotion, admin selects a target section first, then selects students.
        if (requiresSection(toClass)) return false;

        return true;
    }

    function getEffectiveTargetSection(student) {
        return normalizeSectionForClass(student?.toClass, student?.targetSection);
    }

    function isPublishedResult(result) {
        return result?.publishStatus === "published" || result?.isPublished === true;
    }

    function isFinalExamResult(result) {
        const examName = result?.examName || result?.exam || result?.examType || FINAL_EXAM_NAME;
        return String(examName).toLowerCase() === FINAL_EXAM_NAME.toLowerCase();
    }

    function isFailedResult(result) {
        const gpa = Number(getResultGPA(result));
        const grade = String(getResultFinalGrade(result)).toUpperCase();
        const subjects = getResultSubjects(result);

        const hasSubjectFail = subjects.some(function (subject) {
            const mark = Number(getResultMark(result, subject));
            return Number.isNaN(mark) || mark < 33;
        });

        return gpa <= 0 || grade === "F" || hasSubjectFail;
    }

    function getResultSubjects(result) {
        if (Array.isArray(result?.subjects) && result.subjects.length) {
            return result.subjects
                .map(function (subject) {
                    if (typeof subject === "string") return subject;
                    return subject.name || subject.subject || "";
                })
                .filter(Boolean);
        }

        if (result?.marks && typeof result.marks === "object") {
            return Object.keys(result.marks);
        }

        return [];
    }

    function getResultMark(result, subjectName) {
        if (result?.marks && result.marks[subjectName] !== undefined) {
            return result.marks[subjectName];
        }

        if (Array.isArray(result?.subjects)) {
            const found = result.subjects.find(function (subject) {
                if (typeof subject === "string") return false;
                return subject.name === subjectName || subject.subject === subjectName;
            });

            if (found && typeof found === "object") {
                return found.marks ?? found.mark ?? found.number ?? "";
            }
        }

        return "";
    }

    function getResultTotalMarks(result) {
        if (result?.totalMarks !== undefined && result?.totalMarks !== "") {
            return Number(result.totalMarks);
        }

        if (result?.total !== undefined && result?.total !== "") {
            return Number(result.total);
        }

        return getResultSubjects(result).reduce(function (sum, subject) {
            return sum + (Number(getResultMark(result, subject)) || 0);
        }, 0);
    }

    function getResultGPA(result) {
        if (result?.gpa !== undefined && result?.gpa !== "") {
            return Number(result.gpa);
        }

        if (result?.finalGPA !== undefined && result?.finalGPA !== "") {
            return Number(result.finalGPA);
        }

        const subjects = getResultSubjects(result);

        if (!subjects.length) return 0;

        const totalGPA = subjects.reduce(function (sum, subject) {
            return sum + getSubjectGPA(Number(getResultMark(result, subject)));
        }, 0);

        return Number((totalGPA / subjects.length).toFixed(2));
    }

    function getSubjectGPA(mark) {
        if (Number.isNaN(mark)) return 0;
        if (mark >= 80) return 5;
        if (mark >= 70) return 4;
        if (mark >= 60) return 3.5;
        if (mark >= 50) return 3;
        if (mark >= 40) return 2;
        if (mark >= 33) return 1;
        return 0;
    }

    function getResultFinalGrade(result) {
        if (result?.finalGrade) return result.finalGrade;
        if (result?.grade) return result.grade;

        const gpa = Number(getResultGPA(result));

        if (gpa >= 5) return "A+";
        if (gpa >= 4) return "A";
        if (gpa >= 3.5) return "A-";
        if (gpa >= 3) return "B";
        if (gpa >= 2) return "C";
        if (gpa >= 1) return "D";
        return "F";
    }

    function getResultStudentId(result) {
        return result?.studentId || result?.student_id || result?.studentID || "";
    }

    function getResultYear(result) {
        return result?.year || result?.examYear || result?.exam_year || "";
    }

    function getResultClass(result) {
        return result?.className || result?.class || result?.studentClass || "";
    }

    function getResultRoll(result) {
        return result?.roll || result?.studentRoll || result?.student_roll || "";
    }

    function getResultStudentName(result) {
        return result?.name || result?.studentName || result?.student_name || "";
    }

    function getStudentYear(student) {
        return student?.year || student?.examYear || student?.studentYear || "";
    }

    function getStudentClass(student) {
        return student?.className || student?.class || student?.studentClass || "";
    }

    function getStudentRoll(student) {
        return student?.roll || student?.studentRoll || student?.student_roll || "";
    }

    function getStudentName(student) {
        return student?.name || student?.studentName || student?.student_name || "";
    }

    function generatePromotionRowId(result, student) {
        return (
            result?.id ||
            student?.id ||
            `promotion_${Date.now()}_${Math.random().toString(36).slice(2)}`
        );
    }

    function readArrayFromStorage(key) {
        try {
            const data = JSON.parse(localStorage.getItem(key) || "[]");
            return Array.isArray(data) ? data : [];
        } catch (error) {
            return [];
        }
    }

    function showPromotionStatus(message, type) {
        const status = document.getElementById("promotionStatus");

        if (!status) return;

        status.textContent = message;
        status.className = `promotion-status ${type}`;
    }

    function clearPromotionStatus() {
        const status = document.getElementById("promotionStatus");

        if (!status) return;

        status.textContent = "";
        status.className = "promotion-status";
    }

    function setText(id, value) {
        const element = document.getElementById(id);
        if (element) element.textContent = value;
    }

    function normalizeText(value) {
        return String(value || "").trim().toLowerCase();
    }

    function escapeHTML(value) {
        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }
})();

(function () {
    const STUDENTS_KEY = "bhs_students";
    const SECTION_CLASSES = ["9", "10"];
    const STUDENT_SECTIONS = ["Science", "Arts", "Commerce"];
    const STUDENT_RELIGIONS = ["Islam", "Hindu"];
    const GENERAL_SECTION = "General";

    document.addEventListener("DOMContentLoaded", function () {
        const promoteBtn = document.getElementById("promoteSelectedStudentsBtn");

        if (promoteBtn) {
            promoteBtn.addEventListener("click", promoteSelectedStudents);
        }
    });

    async function promoteSelectedStudents() {
        const loadedStudents = Array.isArray(window.bhsPromotionLoadedStudents)
            ? window.bhsPromotionLoadedStudents
            : [];

        const fromYear = document.getElementById("promotionFromYear")?.value;
        const fromClass = document.getElementById("promotionFromClass")?.value;
        const toYear = document.getElementById("promotionToYear")?.value;
        const toClass = document.getElementById("promotionToClass")?.value;

        clearPromotionSaveStatus();

        if (!fromYear || !fromClass || !toYear || !toClass) {
            showPromotionSaveStatus("Please select promotion year and class first.", "error");
            return;
        }

        if (!loadedStudents.length) {
            showPromotionSaveStatus("Please load students before promotion.", "error");
            return;
        }

        const selectedStudents = loadedStudents.filter(function (student) {
            return student.selected === true;
        });

        if (!selectedStudents.length) {
            showPromotionSaveStatus("No student selected for promotion.", "error");
            return;
        }

        if (!hasPromotionSupabaseClient()) {
            showPromotionSaveStatus("Supabase connection not found. Promotion cannot be saved.", "error");
            return;
        }

        const confirmMessage =
            `Are you sure you want to promote ${selectedStudents.length} student(s) ` +
            `from Class ${fromClass}, Exam Year ${fromYear} to Class ${toClass}, Exam Year ${toYear}?`;

        if (!confirm(confirmMessage)) {
            return;
        }

        setPromotionSaveLoading(true);
        showPromotionSaveStatus("Checking existing students in Supabase...", "info");

        let students = [];

        try {
            students = await loadStudentsForPromotionSave();
        } catch (error) {
            console.error("Promotion save student load error:", error);
            setPromotionSaveLoading(false);
            showPromotionSaveStatus(error.message || "Could not check existing students from Supabase.", "error");
            return;
        }

        // Existing target-class students are allowed now because section-wise promotion may be completed in multiple batches.
        // New rolls follow the overall rank/merit position, not section-wise serial.

        const selectedMissingIds = selectedStudents.filter(function (student) {
            return !(student.studentId || student.oldStudent?.id);
        });

        if (selectedMissingIds.length) {
            setPromotionSaveLoading(false);
            showPromotionSaveStatus(
                `${selectedMissingIds.length} selected student(s) could not be promoted because student ID was missing.`,
                "error"
            );
            return;
        }

        const missingTargetSections = selectedStudents.filter(function (student) {
            return requiresSection(student.toClass) && !getEffectiveTargetSection(student);
        });

        if (missingTargetSections.length) {
            setPromotionSaveLoading(false);
            showPromotionSaveStatus(
                `Please select Science/Arts/Commerce section for ${missingTargetSections.length} selected student(s).`,
                "error"
            );
            return;
        }

        showPromotionSaveStatus("Moving selected students to target class in Supabase transaction...", "info");

        let moveResults = [];

        const transactionRows = selectedStudents.map(function (student, index) {
            const studentId = student.studentId || student.oldStudent?.id;
            return {
                student_id: studentId,
                student: movedStudentToDb(student, index + 1),
                history: buildPromotionHistoryRow(student)
            };
        });

        const { data: movedRows, error: transactionError } = await window.bhsSupabase
            .rpc("promote_students_transaction", { p_rows: transactionRows });

        if (transactionError) {
            console.error("Supabase promotion transaction error:", transactionError);
            setPromotionSaveLoading(false);
            showPromotionSaveStatus(
                transactionError.message || "Promotion failed. No student was moved because the transaction was rolled back.",
                "error"
            );
            return;
        }

        moveResults = Array.isArray(movedRows)
            ? movedRows.map(mapStudentFromSupabaseForPromotionSave)
            : [];

        setPromotionSaveLoading(false);

        const movedIds = new Set(moveResults.map((student) => String(student.id)));
        const updatedStudents = [
            ...students.filter((student) => !movedIds.has(String(student.id))),
            ...moveResults
        ];

        safeSetStudentJSON(STUDENTS_KEY, updatedStudents);

        showPromotionSaveStatus(
            `${moveResults.length} student(s) moved successfully to Class ${toClass}, Exam Year ${toYear}.`,
            "success"
        );

        renderPromotionSummary({
            fromYear,
            fromClass,
            toYear,
            toClass,
            totalFound: loadedStudents.length,
            eligible: loadedStudents.filter((student) => student.eligible).length,
            failed: loadedStudents.filter((student) => !student.eligible).length,
            selected: selectedStudents.length,
            promoted: moveResults.length,
            skipped: loadedStudents.length - selectedStudents.length
        });
    }

    function movedStudentToDb(student, serial) {
        const oldStudent = student.oldStudent || {};

        return {
            name: getValue(oldStudent, ["name", "studentName", "student_name"], student.name),
            roll: String(student.newRoll || serial),
            class_name: String(student.toClass),
            section_name: getEffectiveTargetSection(student),
            academic_year: String(student.toYear),
            religion: normalizeReligion(getValue(oldStudent, ["religion"], "Islam")),
            optional_subject_name: getEffectiveTargetOptional(student).name || null,
            optional_subject_code: getEffectiveTargetOptional(student).code || null,
            guardian_name: getValue(oldStudent, ["guardianName", "guardian", "guardian_name"], null),
            phone: getValue(oldStudent, ["phone", "mobile", "contact"], null),
            address: getValue(oldStudent, ["address", "studentAddress"], null),
            status: "active",
            promotion_status: "promoted",
            promoted_from: {
                studentId: student.studentId || oldStudent.id || "",
                resultId: student.resultId || "",
                year: String(student.fromYear),
                className: String(student.fromClass),
                fromSection: String(student.oldSection || getStudentSection(oldStudent)),
                toSection: String(getEffectiveTargetSection(student)),
                oldOptionalSubject: String(student.oldOptionalSubjectName || ""),
                targetOptionalSubject: String(getEffectiveTargetOptional(student).name || ""),
                oldRoll: String(student.oldRoll || ""),
                rank: student.rank ? Number(student.rank) : null,
                totalMarks: Number(student.totalMarks) || 0,
                gpa: Number(student.gpa || 0).toFixed(2),
                grade: student.grade || "",
                resultStatus: student.resultStatus || "",
                promotedAt: new Date().toISOString()
            }
        };
    }

    function buildPromotionHistoryRow(student) {
        const studentId = student.studentId || student.oldStudent?.id || null;

        return {
            from_student_id: studentId,
            to_student_id: studentId,
            result_id: student.resultId || null,
            from_year: String(student.fromYear),
            from_class: String(student.fromClass),
            from_section: String(student.oldSection || getStudentSection(student.oldStudent)),
            to_year: String(student.toYear),
            to_class: String(student.toClass),
            to_section: String(getEffectiveTargetSection(student)),
            from_optional_subject: String(student.oldOptionalSubjectName || ""),
            to_optional_subject: String(getEffectiveTargetOptional(student).name || ""),
            old_roll: String(student.oldRoll || ""),
            new_roll: String(student.newRoll || ""),
            rank: student.rank ? Number(student.rank) : null,
            total_marks: Number(student.totalMarks) || 0,
            gpa: Number(student.gpa) || 0,
            grade: student.grade && student.grade !== "-" ? student.grade : null,
            remarks: student.remarks || student.resultStatusText || "Manual promotion",
            status: student.eligible ? "promoted" : "manual"
        };
    }

    async function savePromotionHistory(selectedStudents) {
        const historyRows = selectedStudents.map(buildPromotionHistoryRow);

        if (!historyRows.length) return;

        const { error } = await window.bhsSupabase
            .from("student_promotions")
            .insert(historyRows);

        if (error) {
            console.warn("Promotion history save warning:", error);
        }
    }

    function renderPromotionSummary(data) {
        const summary = document.getElementById("promotionSummaryContent");

        if (!summary) return;

        summary.innerHTML = `
      <div class="promotion-summary-success">
        <p>
          <strong>Promotion Completed Successfully.</strong>
        </p>

        <div class="promotion-summary-grid">
          <div>
            <span>From</span>
            <strong>Class ${escapeHTML(data.fromClass)}, ${escapeHTML(data.fromYear)}</strong>
          </div>

          <div>
            <span>To</span>
            <strong>Class ${escapeHTML(data.toClass)}, ${escapeHTML(data.toYear)}</strong>
          </div>

          <div>
            <span>Total Found</span>
            <strong>${escapeHTML(data.totalFound)}</strong>
          </div>

          <div>
            <span>Eligible</span>
            <strong>${escapeHTML(data.eligible)}</strong>
          </div>

          <div>
            <span>Failed</span>
            <strong>${escapeHTML(data.failed)}</strong>
          </div>

          <div>
            <span>Selected</span>
            <strong>${escapeHTML(data.selected)}</strong>
          </div>

          <div>
            <span>Promoted</span>
            <strong>${escapeHTML(data.promoted)}</strong>
          </div>

          <div>
            <span>Skipped</span>
            <strong>${escapeHTML(data.skipped)}</strong>
          </div>
        </div>
      </div>
    `;
    }

    async function loadStudentsForPromotionSave() {
        const { data, error } = await window.bhsSupabase
            .from("students")
            .select("id, student_code, name, roll, class_name, section_name, academic_year, guardian_name, phone, address, religion, optional_subject_name, optional_subject_code, status, promotion_status, promoted_from, created_at, updated_at")
            .order("academic_year", { ascending: false })
            .order("class_name", { ascending: true })
            .order("roll", { ascending: true });

        if (error) {
            throw new Error(error.message || "Could not load students from Supabase.");
        }

        return (data || []).map(mapStudentFromSupabaseForPromotionSave);
    }

    function promotedStudentToDb(student) {
        return {
            name: student.name,
            roll: student.roll,
            class_name: student.className,
            section_name: normalizeSectionForClass(student.className, student.sectionName),
            academic_year: student.year,
            religion: normalizeReligion(student.religion),
            optional_subject_name: requiresSection(student.className) ? (student.optionalSubjectName || null) : null,
            optional_subject_code: requiresSection(student.className) ? (student.optionalSubjectCode || null) : null,
            guardian_name: student.guardianName || null,
            phone: student.phone || null,
            address: student.address || null,
            status: student.status || "active",
            promotion_status: student.promotionStatus || "promoted",
            promoted_from: student.promotedFrom || null
        };
    }

    function mapStudentFromSupabaseForPromotionSave(row) {
        return {
            id: row.id,
            studentCode: row.student_code || "",
            name: row.name || "",
            roll: row.roll || "",
            guardianName: row.guardian_name || "",
            phone: row.phone || "",
            address: row.address || "",
            className: row.class_name || "",
            sectionName: row.section_name || GENERAL_SECTION,
            religion: normalizeReligion(row.religion),
            optionalSubjectName: row.optional_subject_name || "",
            optionalSubjectCode: row.optional_subject_code || "",
            year: row.academic_year || "",
            status: row.status || "active",
            promotionStatus: row.promotion_status || "",
            promotedFrom: row.promoted_from || null,
            createdAt: row.created_at || "",
            updatedAt: row.updated_at || ""
        };
    }

    function hasPromotionSupabaseClient() {
        return Boolean(window.bhsSupabase && typeof window.bhsSupabase.from === "function");
    }

    function setPromotionSaveLoading(isLoading) {
        const button = document.getElementById("promoteSelectedStudentsBtn");

        if (!button) return;

        button.disabled = Boolean(isLoading);
        button.classList.toggle("promotion-btn-disabled", Boolean(isLoading));

        if (isLoading) {
            button.dataset.originalText = button.dataset.originalText || button.innerHTML;
            button.innerHTML = `
        <i class="fas fa-spinner fa-spin"></i>
        Saving Promotion...
      `;
        } else if (button.dataset.originalText) {
            button.innerHTML = button.dataset.originalText;
        }
    }

    function readArrayFromStorage(key) {
        try {
            const data = JSON.parse(localStorage.getItem(key) || "[]");
            return Array.isArray(data) ? data : [];
        } catch (error) {
            return [];
        }
    }

    function getStudentYear(student) {
        return student?.year || student?.examYear || student?.studentYear || "";
    }

    function getStudentClass(student) {
        return student?.className || student?.class || student?.studentClass || "";
    }


    function requiresSection(className) {
        return SECTION_CLASSES.includes(String(className));
    }

    function normalizeSectionForClass(className, sectionName) {
        if (!requiresSection(className)) {
            return GENERAL_SECTION;
        }

        const normalized = String(sectionName || "").trim();
        return STUDENT_SECTIONS.includes(normalized) ? normalized : "";
    }

    function getEffectiveTargetSection(student) {
        return normalizeSectionForClass(student?.toClass, student?.targetSection);
    }

    function getStudentSection(student) {
        return String(student?.sectionName || student?.section || GENERAL_SECTION);
    }

    function getValue(object, keys, fallback) {
        for (const key of keys) {
            if (object && object[key] !== undefined && object[key] !== null && object[key] !== "") {
                return object[key];
            }
        }

        return fallback;
    }

    function createUniqueStudentId() {
        return `student_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    }

    function showPromotionSaveStatus(message, type) {
        const status = document.getElementById("promotionStatus");

        if (!status) return;

        status.textContent = message;
        status.className = `promotion-status ${type}`;
    }

    function clearPromotionSaveStatus() {
        const status = document.getElementById("promotionStatus");

        if (!status) return;

        status.textContent = "";
        status.className = "promotion-status";
    }

    function escapeHTML(value) {
        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }
})();

(function () {
    document.addEventListener("DOMContentLoaded", function () {
        initPromotionFinalPolish();
    });

    function initPromotionFinalPolish() {
        const promoteBtn = document.getElementById("promoteSelectedStudentsBtn");
        const resetBtn = document.getElementById("resetPromotionBtn");
        const loadBtn = document.getElementById("loadPromotionStudentsBtn");

        if (promoteBtn) {
            promoteBtn.addEventListener("click", function () {
                setTimeout(handlePromotionAfterSaveUI, 800);
            });
        }

        if (resetBtn) {
            resetBtn.addEventListener("click", function () {
                unlockPromotionUI();
            });
        }

        if (loadBtn) {
            loadBtn.addEventListener("click", function () {
                unlockPromotionUI();
            });
        }
    }

    function handlePromotionAfterSaveUI() {
        const status = document.getElementById("promotionStatus");
        const summary = document.getElementById("promotionSummaryContent");
        const promoteBtn = document.getElementById("promoteSelectedStudentsBtn");

        const isSuccess =
            status &&
            status.classList.contains("success") &&
            (status.textContent.toLowerCase().includes("promoted successfully") ||
             status.textContent.toLowerCase().includes("moved successfully"));

        if (!isSuccess) return;

        disablePromotionTableSelection();

        if (promoteBtn) {
            promoteBtn.disabled = true;
            promoteBtn.classList.add("promotion-btn-disabled");
            promoteBtn.innerHTML = `
        <i class="fas fa-check-circle"></i>
        Promotion Completed
      `;
        }

        if (summary) {
            summary.scrollIntoView({
                behavior: "smooth",
                block: "center"
            });
        }
    }

    function disablePromotionTableSelection() {
        const checkboxes = document.querySelectorAll(".promotion-checkbox");

        checkboxes.forEach(function (checkbox) {
            checkbox.disabled = true;
        });

        const rows = document.querySelectorAll("#promotionTableBody tr");

        rows.forEach(function (row) {
            row.classList.add("promotion-row-locked");
        });
    }

    function unlockPromotionUI() {
        const promoteBtn = document.getElementById("promoteSelectedStudentsBtn");

        if (promoteBtn) {
            promoteBtn.disabled = false;
            promoteBtn.classList.remove("promotion-btn-disabled");
            promoteBtn.innerHTML = `
        <i class="fas fa-level-up-alt"></i>
        Promote Selected Students
      `;
        }

        const rows = document.querySelectorAll("#promotionTableBody tr");
        rows.forEach(function (row) {
            row.classList.remove("promotion-row-locked");
        });
    }
})();

(function () {
    document.addEventListener("DOMContentLoaded", function () {
        initAddStudentClickableSection();
    });

    window.addEventListener("hashchange", function () {
        activateStudentSectionByHash();
    });

    function initAddStudentClickableSection() {
        const addStudentLink =
            document.getElementById("bhsAddStudentMenuLink") ||
            document.getElementById("addStudentLink");

        const promoteClassLink =
            document.getElementById("bhsPromoteClassMenuLink") ||
            document.getElementById("promoteClassLink");

        if (addStudentLink) {
            addStudentLink.addEventListener("click", function () {
                window.location.hash = "add-student";

                setTimeout(function () {
                    activateStudentSectionByHash();
                    focusAddStudentForm();
                }, 80);
            });
        }

        if (promoteClassLink) {
            promoteClassLink.addEventListener("click", function () {
                window.location.hash = "promote-class";

                setTimeout(function () {
                    activateStudentSectionByHash();
                }, 80);
            });
        }

        activateStudentSectionByHash();
    }

    function activateStudentSectionByHash() {
        const addSection = document.getElementById("add-student");
        const promoteSection = document.getElementById("promote-class");

        const addStudentLink =
            document.getElementById("bhsAddStudentMenuLink") ||
            document.getElementById("addStudentLink");

        const promoteClassLink =
            document.getElementById("bhsPromoteClassMenuLink") ||
            document.getElementById("promoteClassLink");

        if (!addSection || !promoteSection) return;

        addStudentLink?.classList.remove("active");
        promoteClassLink?.classList.remove("active");

        if (window.location.hash === "#promote-class") {
            addSection.classList.remove("active-student-section");
            promoteSection.classList.add("active-student-section");
            promoteClassLink?.classList.add("active");
            updateStudentPageHeading("Class Promotion");
            return;
        }

        addSection.classList.add("active-student-section");
        promoteSection.classList.remove("active-student-section");
        addStudentLink?.classList.add("active");
        updateStudentPageHeading("Manage Students");
    }

    function focusAddStudentForm() {
        const nameInput =
            document.getElementById("studentName") ||
            document.querySelector("input[placeholder='Enter student name']");

        if (nameInput) {
            nameInput.focus();
        }
    }

    function updateStudentPageHeading(title) {
        const heading =
            document.querySelector(".admin-content-header h2") ||
            document.querySelector(".admin-header h2") ||
            document.querySelector(".page-title h2") ||
            document.querySelector("h2");

        if (!heading) return;

        if (title === "Class Promotion") {
            heading.innerHTML = `<i class="fas fa-level-up-alt"></i> Class Promotion`;
        } else {
            heading.innerHTML = `<i class="fas fa-user-graduate"></i> Manage Students`;
        }
    }
})();


(function () {
    document.addEventListener(
        "click",
        function (event) {
            const openBtn = event.target.closest("#openAddStudentFormBtn");
            const closeBtn = event.target.closest("#hideAddStudentFormBtn");
            const editBtn = event.target.closest("button[data-action='edit']");
            const cancelBtn = event.target.closest("#cancelEditBtn");

            if (openBtn) {
                event.preventDefault();
                event.stopPropagation();
                event.stopImmediatePropagation();

                toggleAddStudentForm();
                return;
            }

            if (closeBtn) {
                event.preventDefault();
                event.stopPropagation();
                event.stopImmediatePropagation();

                hideAddStudentFormFinal();
                return;
            }

            if (editBtn) {
                setTimeout(function () {
                    showAddStudentFormFinal(false);
                }, 150);
            }

            if (cancelBtn) {
                setTimeout(function () {
                    hideAddStudentFormFinal();
                }, 150);
            }
        },
        true
    );

    document.addEventListener("DOMContentLoaded", function () {
        setTimeout(function () {
            hideAddStudentFormFinal();
        }, 300);
    });

    function toggleAddStudentForm() {
        const formCard = document.getElementById("addStudentForm");

        if (!formCard) return;

        const isOpen = formCard.classList.contains("add-student-form-visible");

        if (isOpen) {
            hideAddStudentFormFinal();
        } else {
            showAddStudentFormFinal(true);
        }
    }

    function showAddStudentFormFinal(shouldFocus) {
        const formCard = document.getElementById("addStudentForm");
        const openBtn = document.getElementById("openAddStudentFormBtn");
        const studentName = document.getElementById("studentName");

        if (!formCard) return;

        formCard.classList.remove("add-student-form-hidden");
        formCard.classList.add("add-student-form-visible");

        if (openBtn) {
            openBtn.innerHTML = `
        <i class="fas fa-chevron-up"></i>
        Close Form
      `;
        }

        formCard.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });

        if (shouldFocus && studentName) {
            setTimeout(function () {
                studentName.focus();
            }, 350);
        }
    }

    function hideAddStudentFormFinal() {
        const formCard = document.getElementById("addStudentForm");
        const openBtn = document.getElementById("openAddStudentFormBtn");

        if (!formCard) return;

        formCard.classList.add("add-student-form-hidden");
        formCard.classList.remove("add-student-form-visible");

        if (openBtn) {
            openBtn.innerHTML = `
        <i class="fas fa-plus"></i>
        Add Student
      `;
        }
    }

    window.showAddStudentFormFinal = showAddStudentFormFinal;
    window.hideAddStudentFormFinal = hideAddStudentFormFinal;
})();
/* =========================================================
   FLAT SIDEBAR HASH SUPPORT
   Add Students, Manage Students and Promote Classes are now
   separate main sidebar links.
========================================================= */
(function () {
  function setStudentFlatLinkActive() {
    const hash = window.location.hash || "#add-student";
    const links = [
      document.getElementById("bhsAddStudentMenuLink"),
      document.getElementById("bhsManageStudentMenuLink"),
      document.getElementById("bhsPromoteClassMenuLink"),
    ];

    links.forEach(function (link) {
      if (link) link.classList.remove("active");
    });

    if (hash === "#promote-class") {
      document.getElementById("bhsPromoteClassMenuLink")?.classList.add("active");
      return;
    }

    if (hash === "#manage-students") {
      document.getElementById("bhsManageStudentMenuLink")?.classList.add("active");
      return;
    }

    document.getElementById("bhsAddStudentMenuLink")?.classList.add("active");
  }

  function openAddSectionOnly() {
    const addSection = document.getElementById("add-student");
    const promoteSection = document.getElementById("promote-class");

    if (addSection) {
      addSection.style.display = "block";
      addSection.classList.add("active-student-section");
    }

    if (promoteSection) {
      promoteSection.style.display = "none";
      promoteSection.classList.remove("active-student-section");
    }
  }

  function closeAddForm() {
    const formCard = document.getElementById("addStudentForm");
    if (!formCard) return;

    formCard.classList.add("add-student-form-hidden");
    formCard.classList.remove("add-student-form-visible");
  }

  function openAddForm() {
    const formCard = document.getElementById("addStudentForm");
    if (!formCard) return;

    formCard.classList.remove("add-student-form-hidden");
    formCard.classList.add("add-student-form-visible");

    setTimeout(function () {
      formCard.scrollIntoView({ behavior: "smooth", block: "start" });
      document.getElementById("studentName")?.focus();
    }, 80);
  }

  function scrollToStudentList() {
    const listCard = document.getElementById("studentList");
    if (!listCard) return;

    setTimeout(function () {
      listCard.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  }

  function handleStudentHashNavigation() {
    const hash = window.location.hash || "#add-student";

    if (hash === "#manage-students") {
      openAddSectionOnly();
      closeAddForm();
      scrollToStudentList();
    }

    if (hash === "#add-student") {
      openAddSectionOnly();
      openAddForm();
    }

    setTimeout(setStudentFlatLinkActive, 120);
  }

  document.addEventListener("click", function (event) {
    const manageLink = event.target.closest("#bhsManageStudentMenuLink");
    const addLink = event.target.closest("#bhsAddStudentMenuLink");

    if (manageLink) {
      setTimeout(handleStudentHashNavigation, 120);
    }

    if (addLink) {
      setTimeout(handleStudentHashNavigation, 120);
    }
  });

  window.addEventListener("hashchange", function () {
    setTimeout(handleStudentHashNavigation, 120);
  });

  document.addEventListener("DOMContentLoaded", function () {
    setTimeout(handleStudentHashNavigation, 500);
    setTimeout(handleStudentHashNavigation, 1000);
  });
})();
