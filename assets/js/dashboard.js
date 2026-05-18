// Dashboard - Supabase Connected
(function () {
  const STUDENTS_KEY = "bhs_students";
  const RESULTS_KEY = "bhs_results";
  const YEAR_KEY = "bhs_selected_exam_year";
  const FINAL_EXAM_NAME = "Final Exam";
  const BASE_YEAR = 2026;
  const CLASSES = ["6", "7", "8", "9", "10"];
  const DASHBOARD_TAB_KEY = "bhs_dashboard_active_tab";

  let resultComparisonChart = null;
  let allStudents = [];
  let allResults = [];
  let isLoading = false;
  const dashboardExactStatsCache = {};


  function forceDefaultDashboardAfterLogin() {
    const shouldForceDashboard = sessionStorage.getItem("bhs_login_default_dashboard");

    if (!shouldForceDashboard) return;

    sessionStorage.removeItem("bhs_login_default_dashboard");
    localStorage.removeItem("bhs_dashboard_active_tab");

    if (window.location.hash !== "#dashboard") {
      history.replaceState(null, "", "dashboard.html#dashboard");
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    forceDefaultDashboardAfterLogin();
    initDashboard();
  });

  async function initDashboard() {
    initDashboardTabs();
    bindDashboardEvents();
    bindYearDropdownWhenReady();

    setDashboardStatus("Loading Supabase data...");
    await loadDashboardData();

    window.addEventListener("storage", function () {
      hydrateFromLocalStorage();
      renderDashboard();
    });

    window.bhsRefreshDashboard = async function () {
      await loadDashboardData();
    };
  }

  function initDashboardTabs() {
    const hashTab = (window.location.hash || "").replace("#", "");
    const savedTab = hashTab || localStorage.getItem(DASHBOARD_TAB_KEY) || "dashboard";
    activateDashboardTab(savedTab);

    document.addEventListener("click", function (event) {
      const tabButton = event.target.closest("[data-dashboard-tab]");
      if (!tabButton) return;

      const tabName = tabButton.getAttribute("data-dashboard-tab");
      const isSidebarLink = tabButton.matches("a");

      if (isSidebarLink && isDashboardPage()) {
        event.preventDefault();
        history.pushState(null, "", "#" + tabName);
        window.dispatchEvent(new Event("hashchange"));
      }

      activateDashboardTabWithRender(tabName);
    });

    window.addEventListener("hashchange", function () {
      const tabName = (window.location.hash || "").replace("#", "") || "dashboard";
      activateDashboardTabWithRender(tabName);
    });
  }

  function activateDashboardTabWithRender(tabName) {
    localStorage.setItem(DASHBOARD_TAB_KEY, tabName);
    activateDashboardTab(tabName);

    setTimeout(function () {
      renderDashboard();
      if (tabName === "dashboard") rebuildChartAfterTabShow();
    }, 120);
  }

  function isDashboardPage() {
    return window.location.pathname.toLowerCase().includes("dashboard.html");
  }

  function activateDashboardTab(tabName) {
    const buttons = document.querySelectorAll("[data-dashboard-tab]");
    const sections = document.querySelectorAll("[data-dashboard-section]");

    if (!buttons.length || !sections.length) return;

    buttons.forEach(function (button) {
      button.classList.remove("active");
    });

    sections.forEach(function (section) {
      section.classList.remove("active");
    });

    let activeButton = document.querySelector('[data-dashboard-tab="' + tabName + '"]');
    let activeSection = document.querySelector('[data-dashboard-section="' + tabName + '"]');

    if (!activeButton || !activeSection) {
      tabName = "dashboard";
      activeButton = document.querySelector('[data-dashboard-tab="dashboard"]');
      activeSection = document.querySelector('[data-dashboard-section="dashboard"]');
      localStorage.setItem(DASHBOARD_TAB_KEY, tabName);
    }

    if (activeButton) activeButton.classList.add("active");
    if (activeSection) activeSection.classList.add("active");
  }

  function bindDashboardEvents() {
    document.addEventListener("click", function (event) {
      const topButton = event.target.closest("[data-action='view-class-top10']");
      const studentResultCard = event.target.closest("[data-action='view-student-result']");
      const closeButton = event.target.closest("#closeDashboardTopModal");
      const modal = document.getElementById("dashboardTopModal");

      if (topButton) {
        openClassTop10Modal(topButton.dataset.className);
        return;
      }

      if (studentResultCard) {
        openStudentResultModal(studentResultCard.dataset.resultId);
        return;
      }

      if (closeButton) {
        closeTopModal();
      }

      if (modal && event.target === modal) {
        closeTopModal();
      }
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") closeTopModal();
    });
  }

  function bindYearDropdownWhenReady() {
    let tries = 0;

    const timer = setInterval(function () {
      const yearSelect = getExamYearSelect();
      tries += 1;

      if (yearSelect) {
        syncExamYearSelect(yearSelect);

        if (yearSelect.dataset.dashboardBound !== "true") {
          yearSelect.dataset.dashboardBound = "true";

          yearSelect.addEventListener("change", function () {
            localStorage.setItem(YEAR_KEY, yearSelect.value);
            renderDashboard();
            refreshExactDashboardStats(yearSelect.value);
            rebuildChartAfterTabShow();
          });
        }

        renderDashboard();
        clearInterval(timer);
      }

      if (tries > 120) clearInterval(timer);
    }, 100);
  }

  function syncExamYearSelect(yearSelect) {
    const storedYear = localStorage.getItem(YEAR_KEY);

    if (storedYear) {
      const exists = Array.from(yearSelect.options || []).some(function (option) {
        return String(option.value) === String(storedYear);
      });

      if (exists) yearSelect.value = storedYear;
    }

    if (yearSelect.value) localStorage.setItem(YEAR_KEY, yearSelect.value);
  }


  async function countSupabaseRows(tableName, applyFilters) {
    let query = window.bhsSupabase
      .from(tableName)
      .select("id", { count: "exact", head: true });

    if (typeof applyFilters === "function") {
      query = applyFilters(query);
    }

    const { count, error } = await query;
    if (error) throw error;
    return Number(count || 0);
  }

  async function fetchExactDashboardStats(selectedYear) {
    if (!window.bhsSupabase) return null;

    const year = String(selectedYear || getSelectedYear());
    if (dashboardExactStatsCache[year]) return dashboardExactStatsCache[year];

    const classFilter = CLASSES;

    const baseStudentFilter = function (query) {
      return query
        .eq("academic_year", year)
        .in("class_name", classFilter);
    };

    const baseResultFilter = function (query) {
      return query
        .eq("academic_year", year)
        .eq("exam_name", FINAL_EXAM_NAME)
        .in("class_name", classFilter);
    };

    const [totalStudents, completedResults, passedResults] = await Promise.all([
      countSupabaseRows("students", baseStudentFilter),
      countSupabaseRows("results", baseResultFilter),
      countSupabaseRows("results", function (query) {
        return baseResultFilter(query).gt("gpa", 0);
      })
    ]);

    const failedResults = Math.max(completedResults - passedResults, 0);
    const pendingResults = Math.max(totalStudents - completedResults, 0);
    const passRate = completedResults ? (passedResults / completedResults) * 100 : 0;

    dashboardExactStatsCache[year] = {
      totalStudents,
      completedResults,
      passedResults,
      failedResults,
      pendingResults,
      passRate
    };

    return dashboardExactStatsCache[year];
  }

  function applyExactPassingRateStats(stats) {
    if (!stats) return;

    setText("dashboardPassingRate", stats.passRate.toFixed(1) + "%");
    setText("dashboardTotalStudents", stats.totalStudents);
    setText("dashboardPassedStudents", stats.passedResults);
    setText("dashboardFailedStudents", stats.failedResults);
    setText("dashboardPendingResults", stats.pendingResults);
  }

  async function refreshExactDashboardStats(selectedYear) {
    try {
      const stats = await fetchExactDashboardStats(selectedYear);
      applyExactPassingRateStats(stats);
    } catch (error) {
      console.warn("Dashboard exact count fallback failed:", error);
    }
  }

  function safeSetLocalJSON(key, value) {
    if (typeof window.bhsSafeSetLocalJSON === "function") {
      window.bhsSafeSetLocalJSON(key, value);
      return;
    }
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.warn(`Dashboard cache skipped for ${key}:`, error);
    }
  }

  async function loadDashboardData() {
    if (isLoading) return;
    isLoading = true;

    try {
      if (!window.bhsSupabase) {
        hydrateFromLocalStorage();
        setDashboardStatus("Offline cache");
        renderDashboard();
        return;
      }

      const [studentsData, resultsData] = await Promise.all([
        window.bhsFetchAllRows("students", "*", [
          { column: "academic_year", options: { ascending: false } },
          { column: "class_name", options: { ascending: true } },
          { column: "roll", options: { ascending: true } }
        ]),

        window.bhsFetchAllRows("results", "*", [
          { column: "academic_year", options: { ascending: false } },
          { column: "class_name", options: { ascending: true } },
          { column: "ranking_score", options: { ascending: false, nullsFirst: false } },
          { column: "total_marks", options: { ascending: false, nullsFirst: false } }
        ])
      ]);

      allStudents = (studentsData || []).map(normalizeStudentFromSupabase);
      allResults = (resultsData || []).map(normalizeResultFromSupabase);

      safeSetLocalJSON(STUDENTS_KEY, allStudents);
      safeSetLocalJSON(RESULTS_KEY, allResults);

      setDashboardStatus("Live Supabase Data");
      setLastUpdated();
      renderDashboard();
      refreshExactDashboardStats(getSelectedYear());
    } catch (error) {
      console.error("Dashboard Supabase load error:", error);
      hydrateFromLocalStorage();
      setDashboardStatus("Cache mode");
      renderDashboard();
    } finally {
      isLoading = false;
    }
  }

  function hydrateFromLocalStorage() {
    allStudents = getData(STUDENTS_KEY);
    allResults = getData(RESULTS_KEY);
  }

  function normalizeStudentFromSupabase(row) {
    return {
      id: row.id,
      studentId: row.student_code || row.student_id || row.id,
      name: row.name || row.student_name || "-",
      roll: row.roll || row.roll_no || "-",
      className: normalizeClass(row.class_name || row.className || row.class || ""),
      sectionName: row.section_name || row.sectionName || "General",
      year: String(row.academic_year || row.year || BASE_YEAR),
      guardianName: row.guardian_name || row.guardianName || "",
      phone: row.phone || row.guardian_phone || "",
      address: row.address || "",
      status: row.status || "active",
      createdAt: row.created_at || row.createdAt || null,
      updatedAt: row.updated_at || row.updatedAt || null
    };
  }

  function normalizeResultFromSupabase(row) {
    const totalMarks = toNumber(row.total_marks ?? row.totalMarks ?? row.totalMark);
    const totalPoint = toNumber(row.total_point ?? row.totalPoint);
    const gpa = toNumber(row.gpa ?? row.final_gpa ?? row.finalGpa);
    const rankingScore = toNumber(row.ranking_score ?? row.rankingScore ?? gpa);

    return {
      id: row.id,
      studentId: row.student_id || row.studentId,
      name: row.name_snapshot || row.name || row.student_name || "-",
      roll: row.roll_snapshot || row.roll || row.roll_no || "-",
      className: normalizeClass(row.class_name || row.className || row.class || ""),
      sectionName: row.section_name || row.sectionName || "General",
      year: String(row.academic_year || row.exam_year || row.year || BASE_YEAR),
      examName: row.exam_name || row.examName || FINAL_EXAM_NAME,
      subjects: Array.isArray(row.subjects) ? row.subjects : safeJsonArray(row.subjects),
      marks: row.marks && typeof row.marks === "object" ? row.marks : safeJsonObject(row.marks),
      subjectGrades: row.subject_grades && typeof row.subject_grades === "object" ? row.subject_grades : safeJsonObject(row.subject_grades),
      totalMarks,
      average: toNumber(row.average),
      gpa,
      totalPoint,
      rankingScore,
      finalGrade: row.final_grade || row.finalGrade || row.grade || getGradeFromGpa(gpa),
      completedSubjects: toNumber(row.completed_subjects ?? row.completedSubjects),
      totalSubjects: toNumber(row.total_subjects ?? row.totalSubjects),
      publishStatus: row.publish_status || row.publishStatus || row.status || "draft",
      isPublished: row.is_published === true || row.isPublished === true,
      publishedAt: row.published_at || row.publishedAt || null,
      createdAt: row.created_at || row.createdAt || null,
      updatedAt: row.updated_at || row.updatedAt || null
    };
  }

  function renderDashboard() {
    const selectedYear = getSelectedYear();

    if (!allStudents.length && !allResults.length) hydrateFromLocalStorage();

    const yearStudents = filterByYear(allStudents, selectedYear);
    const yearResults = filterByYear(allResults, selectedYear).filter(isFinalExamResult);

    setDashboardYear(selectedYear);
    renderPassingRate(yearStudents, yearResults);
    renderClassPerformanceGrid(yearStudents, yearResults);
    renderSchoolTop10Card(yearStudents, yearResults);

    if (isSectionActive("dashboard")) {
      renderResultComparisonChart(allStudents, allResults, selectedYear);
    }
  }

  function rebuildChartAfterTabShow() {
    const selectedYear = getSelectedYear();

    setTimeout(function () {
      renderResultComparisonChart(allStudents, allResults, selectedYear);

      if (resultComparisonChart) resultComparisonChart.resize();
    }, 150);
  }

  function isSectionActive(sectionName) {
    const section = document.querySelector('[data-dashboard-section="' + sectionName + '"]');
    if (!section) return true;
    return section.classList.contains("active");
  }

  function renderPassingRate(students, results) {
    const selectedYear = getSelectedYear();
    const exactStats = dashboardExactStatsCache[String(selectedYear)];

    if (exactStats) {
      applyExactPassingRateStats(exactStats);
      return;
    }

    const completedResults = results.filter(isCompletedResult);
    const passedResults = completedResults.filter(isPassed);

    const failedResults = completedResults.filter(function (result) {
      return !isPassed(result);
    });

    const pendingResults = Math.max(students.length - completedResults.length, 0);
    const passRate = completedResults.length ? (passedResults.length / completedResults.length) * 100 : 0;

    setText("dashboardPassingRate", passRate.toFixed(1) + "%");
    setText("dashboardTotalStudents", students.length);
    setText("dashboardPassedStudents", passedResults.length);
    setText("dashboardFailedStudents", failedResults.length);
    setText("dashboardPendingResults", pendingResults);

    refreshExactDashboardStats(selectedYear);
  }

  function renderClassPerformanceGrid(students, results) {
    const grid = document.getElementById("classPerformanceGrid");
    if (!grid) return;

    const classRows = buildClassPerformanceData(students, results);

    if (!classRows.length) {
      grid.innerHTML = `<div class="db-empty-item">No class performance data found.</div>`;
      return;
    }

    grid.innerHTML = classRows
      .map(function (item) {
        const passRateClass = item.passRate >= 80 ? "success" : item.passRate >= 50 ? "warning" : "danger";

        return `
          <div class="db-class-card">
            <div class="db-class-top">
              <div>
                <span class="db-class-rank">${getRankText(item.rank)}</span>
                <h4>Class ${escapeHTML(item.className)}</h4>
              </div>

              <div class="db-class-icon">
                <i class="fas fa-graduation-cap"></i>
              </div>
            </div>

            <div class="db-class-progress">
              <div class="db-class-progress-info">
                <span>Pass Rate</span>
                <strong class="${passRateClass}">${item.passRate.toFixed(1)}%</strong>
              </div>

              <div class="db-progress-wrap full">
                <div class="db-progress-bar" style="width:${clamp(item.passRate, 0, 100)}%"></div>
              </div>
            </div>

            <div class="db-class-metrics">
              <div><span>Students</span><strong>${item.totalStudents}</strong></div>
              <div><span>Completed</span><strong>${item.completed}</strong></div>
              <div><span>Published</span><strong>${item.published}</strong></div>
              <div><span>Pass</span><strong>${item.pass}</strong></div>
              <div><span>Fail</span><strong>${item.fail}</strong></div>
              <div><span>Pending</span><strong>${item.pending}</strong></div>
            </div>

            <div class="db-class-footer">
              <div>
                <span>Average GPA</span>
                <strong>${item.avgGpa.toFixed(2)}</strong>
              </div>

              <button
                type="button"
                class="db-top-btn"
                data-action="view-class-top10"
                data-class-name="${escapeHTML(item.className)}"
              >
                <i class="fas fa-list-ol"></i>
                View Top 10
              </button>
            </div>
          </div>
        `;
      })
      .join("");
  }

  function buildClassPerformanceData(students, results) {
    const rows = CLASSES.map(function (className) {
      const classStudents = students.filter(function (student) {
        return normalizeClass(student.className || student.class || student.studentClass) === className;
      });

      const classResults = results.filter(function (result) {
        return normalizeClass(result.className || result.class || result.studentClass) === className;
      });

      const completedResults = classResults.filter(isCompletedResult);
      const publishedResults = completedResults.filter(isPublishedResult);
      const passCount = completedResults.filter(isPassed).length;
      const failCount = completedResults.length - passCount;
      const pendingCount = Math.max(classStudents.length - completedResults.length, 0);
      const passRate = completedResults.length ? (passCount / completedResults.length) * 100 : 0;
      const avgGpa = getAverageGpa(completedResults);

      return {
        className,
        totalStudents: classStudents.length,
        completed: completedResults.length,
        published: publishedResults.length,
        pass: passCount,
        fail: failCount,
        pending: pendingCount,
        passRate,
        avgGpa,
        rank: 0
      };
    });

    rows.sort(function (a, b) {
      return b.passRate - a.passRate || b.avgGpa - a.avgGpa || b.totalStudents - a.totalStudents || Number(a.className) - Number(b.className);
    });

    rows.forEach(function (row, index) {
      row.rank = index + 1;
    });

    return rows;
  }

  function renderSchoolTop10Card(students, results) {
    const list = document.getElementById("schoolTop10CardList");
    if (!list) return;

    const topStudents = buildTopStudents(students, results, "").slice(0, 10);

    if (!topStudents.length) {
      list.innerHTML = `<div class="db-empty-item">No completed result found.</div>`;
      return;
    }

    list.innerHTML = topStudents
      .map(function (student) {
        return `
          <div class="db-school-top-item" data-action="view-student-result" data-result-id="${escapeHTML(student.resultId)}" title="Click to view full result">
            <div class="db-school-top-rank">${getRankText(student.rank)}</div>

            <div class="db-school-top-info">
              <h4>${escapeHTML(student.name)}</h4>
              <div class="db-school-top-meta">
                <span>Class ${escapeHTML(student.className)}</span>
                <span>Roll ${escapeHTML(student.roll)}</span>
                <span>Grade ${escapeHTML(student.finalGrade)}</span>
              </div>

              <div class="db-school-top-inline-score">
                <span>Total Marks: <strong>${formatNumber(student.totalMarks)}</strong></span>
                <span>Ranking Score: <strong>${formatNumber(student.rankingScore)}</strong></span>
                <span>Total Point: <strong>${formatNumber(student.totalPoint)}</strong></span>
                <span>GPA: <strong>${formatNumber(student.gpa)}</strong></span>
              </div>
            </div>
          </div>
        `;
      })
      .join("");
  }

  function openClassTop10Modal(className) {
    const selectedYear = getSelectedYear();
    const students = filterByYear(allStudents, selectedYear);
    const results = filterByYear(allResults, selectedYear).filter(isFinalExamResult);
    const topStudents = buildTopStudents(students, results, className).slice(0, 10);

    setText("dashboardTopModalTitle", "Class " + className + " Top 10 Students");
    setText(
      "dashboardTopModalSubtitle",
      "Exam Year " + selectedYear + " • Based on ranking score first, then total marks."
    );

    renderTopStudentsModal(topStudents);
    showTopModal();
  }

  function buildTopStudents(students, results, className) {
    const filteredResults = results.filter(function (result) {
      const resultClass = normalizeClass(result.className || result.class || result.studentClass);
      const classMatched = className ? resultClass === normalizeClass(className) : true;
      return classMatched && isFinalExamResult(result) && isCompletedResult(result);
    });

    const rows = filteredResults.map(function (result) {
      const student = findStudentForResult(students, result);
      const gpa = getGpa(result);
      const totalMarks = getTotalMarks(result);
      const rankingScore = getRankingScore(result);
      const totalPoint = getTotalPoint(result);

      const classValue = normalizeClass(
        (student && (student.className || student.class || student.studentClass)) ||
        result.className ||
        result.class ||
        result.studentClass
      );

      return {
        resultId: result.id,
        studentId: result.studentId || (student && (student.id || student.studentId)) || "",
        name: (student && (student.name || student.studentName)) || result.name || result.studentName || "-",
        roll: (student && (student.roll || student.studentRoll)) || result.roll || result.studentRoll || "-",
        className: classValue || "-",
        year: result.year || (student && student.year) || getSelectedYear(),
        examName: result.examName || FINAL_EXAM_NAME,
        subjects: Array.isArray(result.subjects) ? result.subjects : [],
        marks: result.marks && typeof result.marks === "object" ? result.marks : {},
        subjectGrades: result.subjectGrades && typeof result.subjectGrades === "object" ? result.subjectGrades : {},
        completedSubjects: result.completedSubjects || 0,
        totalSubjects: result.totalSubjects || 0,
        publishStatus: result.publishStatus || "draft",
        isPublished: result.isPublished === true,
        totalMarks,
        gpa,
        totalPoint,
        rankingScore,
        finalGrade: result.finalGrade || result.grade || getGradeFromGpa(gpa)
      };
    });

    rows.sort(function (a, b) {
      if (b.rankingScore !== a.rankingScore) return b.rankingScore - a.rankingScore;
      if (b.totalMarks !== a.totalMarks) return b.totalMarks - a.totalMarks;
      return getRollNumber(a.roll) - getRollNumber(b.roll);
    });

    return rows.map(function (row, index) {
      return { ...row, rank: index + 1 };
    });
  }

  function findStudentForResult(students, result) {
    return students.find(function (student) {
      const studentId = student.id || student.studentId;
      const resultStudentId = result.studentId || result.studentID || result.id;

      const sameId = studentId && resultStudentId && String(studentId) === String(resultStudentId);

      const sameRoll = String(student.roll || student.studentRoll || "") === String(result.roll || result.studentRoll || "");

      const sameClass =
        normalizeClass(student.className || student.class || student.studentClass) ===
        normalizeClass(result.className || result.class || result.studentClass);

      const sameYear = String(student.year || student.academicYear || "") === String(result.year || result.examYear || "");

      return sameId || (sameRoll && sameClass && sameYear);
    });
  }

  function renderTopStudentsModal(students) {
    const modalBody = document.getElementById("dashboardTopModalBody");
    if (!modalBody) return;

    if (!students.length) {
      modalBody.innerHTML = `
        <div class="db-modal-empty">
          <i class="fas fa-info-circle"></i>
          <h4>No completed result found</h4>
          <p>Please complete/save all subject marks first from Result Management.</p>
        </div>
      `;
      return;
    }

    modalBody.innerHTML = `
      <div class="db-top-student-list">
        ${students
        .map(function (student) {
          return `
              <div class="db-top-student-card" data-action="view-student-result" data-result-id="${escapeHTML(student.resultId)}" title="Click to view full result">
                <div class="db-top-student-rank">${getRankText(student.rank)}</div>

                <div class="db-top-student-info">
                  <h4>${escapeHTML(student.name)}</h4>
                  <p>
                    <span>Class ${escapeHTML(student.className)}</span>
                    <span>Roll ${escapeHTML(student.roll)}</span>
                    <span>Grade ${escapeHTML(student.finalGrade)}</span>
                  </p>
                  <div class="db-top-student-inline-score">
                    <span>Total Marks: <strong>${formatNumber(student.totalMarks)}</strong></span>
                    <span>Ranking Score: <strong>${formatNumber(student.rankingScore)}</strong></span>
                    <span>Total Point: <strong>${formatNumber(student.totalPoint)}</strong></span>
                    <span>GPA: <strong>${formatNumber(student.gpa)}</strong></span>
                  </div>
                </div>
              </div>
            `;
        })
        .join("")}
      </div>
    `;
  }

  function showTopModal() {
    const modal = document.getElementById("dashboardTopModal");
    if (!modal) return;
    modal.classList.add("show");
    document.body.style.overflow = "hidden";
  }

  function closeTopModal() {
    const modal = document.getElementById("dashboardTopModal");
    if (!modal) return;
    modal.classList.remove("show");
    document.body.style.overflow = "";
  }

  function openStudentResultModal(resultId) {
    const selectedYear = getSelectedYear();
    const students = filterByYear(allStudents, selectedYear);
    const results = filterByYear(allResults, selectedYear).filter(isFinalExamResult);
    const topStudents = buildTopStudents(students, results, "");
    const student = topStudents.find(function (row) {
      return String(row.resultId) === String(resultId);
    });

    if (!student) {
      setText("dashboardTopModalTitle", "Result not found");
      setText("dashboardTopModalSubtitle", "Please refresh the dashboard and try again.");
      const modalBody = document.getElementById("dashboardTopModalBody");
      if (modalBody) {
        modalBody.innerHTML = `<div class="db-modal-empty"><i class="fas fa-circle-info"></i><h4>No result details found</h4><p>The selected student's result could not be loaded.</p></div>`;
      }
      showTopModal();
      return;
    }

    setText("dashboardTopModalTitle", student.name + " - Result Details");
    setText(
      "dashboardTopModalSubtitle",
      "Rank " + student.rank + " • Class " + student.className + " • Roll " + student.roll + " • " + student.examName
    );

    renderStudentResultModal(student);
    showTopModal();
  }

  function renderStudentResultModal(student) {
    const modalBody = document.getElementById("dashboardTopModalBody");
    if (!modalBody) return;

    const subjectRows = buildSubjectRows(student);
    const statusText = student.isPublished || String(student.publishStatus).toLowerCase() === "published" ? "Published" : "Draft";
    const completedText = formatNumber(student.completedSubjects) + "/" + formatNumber(student.totalSubjects);

    modalBody.innerHTML = `
      <div class="db-result-detail-wrap">
        <div class="db-result-detail-summary">
          <div><span>Rank</span><strong>${getRankText(student.rank)}</strong></div>
          <div><span>Name</span><strong>${escapeHTML(student.name)}</strong></div>
          <div><span>Class</span><strong>Class ${escapeHTML(student.className)}</strong></div>
          <div><span>Roll</span><strong>${escapeHTML(student.roll)}</strong></div>
          <div><span>Total Marks</span><strong>${formatNumber(student.totalMarks)}</strong></div>
          <div><span>Total Point</span><strong>${formatNumber(student.totalPoint)}</strong></div>
          <div><span>GPA</span><strong>${formatNumber(student.gpa)}</strong></div>
          <div><span>Grade</span><strong>${escapeHTML(student.finalGrade)}</strong></div>
          <div><span>Completed</span><strong>${completedText}</strong></div>
          <div><span>Status</span><strong>${escapeHTML(statusText)}</strong></div>
        </div>

        <div class="db-result-subject-table-wrap">
          <table class="db-result-subject-table">
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
            <tbody>
              ${subjectRows.length ? subjectRows.map(renderSubjectRow).join("") : `<tr><td colspan="7" class="db-result-empty-cell">No subject marks found.</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function buildSubjectRows(student) {
    const subjects = Array.isArray(student.subjects) ? student.subjects : [];
    const marks = student.marks && typeof student.marks === "object" ? student.marks : {};
    const subjectGrades = student.subjectGrades && typeof student.subjectGrades === "object" ? student.subjectGrades : {};

    return subjects.map(function (subject) {
      const mark = normalizeSubjectMark(marks[subject]);
      const gradeInfo = subjectGrades[subject] || {};
      const total = hasValue(mark.total) ? mark.total : gradeInfo.total;
      const point = hasValue(mark.point) ? mark.point : gradeInfo.point;
      const grade = mark.grade || gradeInfo.grade || "-";

      return {
        subject,
        mcq: mark.mcq,
        written: mark.written,
        practical: mark.practical,
        total,
        point,
        grade
      };
    });
  }

  function renderSubjectRow(row) {
    return `
      <tr>
        <td>${escapeHTML(row.subject)}</td>
        <td>${formatCellValue(row.mcq)}</td>
        <td>${formatCellValue(row.written)}</td>
        <td>${formatCellValue(row.practical)}</td>
        <td><strong>${formatCellValue(row.total)}</strong></td>
        <td>${formatCellValue(row.point)}</td>
        <td><strong>${escapeHTML(row.grade || "-")}</strong></td>
      </tr>
    `;
  }

  function renderResultComparisonChart(students, results, selectedYear) {
    const canvas = document.getElementById("resultComparisonChart");
    if (!canvas) return;

    const yearRows = buildYearComparisonData(students, results, selectedYear);
    const labels = yearRows.map(row => row.year);
    const passRates = yearRows.map(row => Number(row.passRate.toFixed(1)));
    const avgGpas = yearRows.map(row => Number(row.avgGpa.toFixed(2)));

    if (!window.Chart) {
      drawCanvasFallback(canvas, yearRows);
      return;
    }

    if (resultComparisonChart) resultComparisonChart.destroy();

    resultComparisonChart = new Chart(canvas, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            type: "bar",
            label: "Pass Rate (%)",
            data: passRates,
            borderRadius: 8,
            yAxisID: "y"
          },
          {
            type: "line",
            label: "Average GPA",
            data: avgGpas,
            tension: 0.35,
            pointRadius: 4,
            borderWidth: 3,
            yAxisID: "y1"
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: "bottom" },
          tooltip: {
            callbacks: {
              afterLabel: function (context) {
                const row = yearRows[context.dataIndex];
                return "Completed: " + row.completed + ", Pass: " + row.pass + ", Fail: " + row.fail;
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            max: 100,
            ticks: {
              callback: function (value) {
                return value + "%";
              }
            }
          },
          y1: {
            beginAtZero: true,
            max: 5,
            position: "right",
            grid: { drawOnChartArea: false }
          }
        }
      }
    });
  }

  function buildYearComparisonData(students, results, selectedYear) {
    const years = getComparisonYears(students, results, selectedYear);

    return years.map(function (year) {
      const yearStudents = filterByYear(students, year);
      const yearResults = filterByYear(results, year).filter(isFinalExamResult);
      const completedResults = yearResults.filter(isCompletedResult);
      const passResults = completedResults.filter(isPassed);
      const failResults = completedResults.filter(function (result) {
        return !isPassed(result);
      });

      return {
        year: String(year),
        totalStudents: yearStudents.length,
        completed: completedResults.length,
        pass: passResults.length,
        fail: failResults.length,
        passRate: completedResults.length ? (passResults.length / completedResults.length) * 100 : 0,
        avgGpa: getAverageGpa(completedResults)
      };
    });
  }

  function getComparisonYears(students, results, selectedYear) {
    const years = new Set();
    years.add(String(BASE_YEAR));

    const selectedNumber = Number(selectedYear);
    if (!Number.isNaN(selectedNumber) && selectedNumber >= BASE_YEAR) years.add(String(selectedNumber));

    const currentYear = new Date().getFullYear();
    if (currentYear >= BASE_YEAR) years.add(String(currentYear));

    const yearSelect = getExamYearSelect();
    if (yearSelect) {
      Array.from(yearSelect.options || []).forEach(function (option) {
        const optionYear = Number(option.value);
        if (!Number.isNaN(optionYear) && optionYear >= BASE_YEAR) years.add(String(optionYear));
      });
    }

    students.concat(results).forEach(function (item) {
      const itemYear = Number(item.year || item.examYear || item.academicYear || item.session);
      if (!Number.isNaN(itemYear) && itemYear >= BASE_YEAR) years.add(String(itemYear));
    });

    const sortedYears = Array.from(years).map(Number).filter(year => year >= BASE_YEAR).sort((a, b) => a - b);
    const lastYear = Math.max.apply(null, sortedYears.length ? sortedYears : [BASE_YEAR]);

    return Array.from({ length: lastYear - BASE_YEAR + 1 }, function (_, index) {
      return String(BASE_YEAR + index);
    });
  }

  function drawCanvasFallback(canvas, yearRows) {
    const context = canvas.getContext("2d");
    if (!context) return;

    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width || 600;
    canvas.height = rect.height || 300;

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.font = "15px Arial";
    context.fillText("Chart.js not loaded. Result summary:", 20, 35);

    yearRows.forEach(function (row, index) {
      context.fillText(
        row.year + ": " + row.passRate.toFixed(1) + "% Pass, Avg GPA " + row.avgGpa.toFixed(2),
        20,
        70 + index * 26
      );
    });
  }

  function isFinalExamResult(result) {
    return String(result.examName || FINAL_EXAM_NAME) === FINAL_EXAM_NAME;
  }

  function isCompletedResult(result) {
    if (!result || !isFinalExamResult(result)) return false;

    const totalSubjects = Number(result.totalSubjects || 0);
    const completedSubjects = Number(result.completedSubjects || 0);

    if (totalSubjects > 0) return completedSubjects >= totalSubjects;

    if (Array.isArray(result.subjects) && result.subjects.length && result.marks && typeof result.marks === "object") {
      return result.subjects.every(function (subject) {
        const mark = result.marks[subject];
        return mark !== "" && mark !== null && mark !== undefined;
      });
    }

    return Number(result.totalMarks || 0) > 0 || Number(result.gpa || 0) > 0;
  }

  function isPublishedResult(result) {
    const status = String(result.publishStatus || result.status || "").toLowerCase();
    return result.isPublished === true || status === "published";
  }

  function isPassed(result) {
    const grade = String(result.finalGrade || result.grade || "").toUpperCase();
    const gpa = getGpa(result);
    if (grade === "F") return false;
    return gpa > 0;
  }

  function getTotalMarks(result) {
    const savedTotal = Number(result.totalMarks || result.totalMark || 0);
    return Number.isNaN(savedTotal) ? 0 : savedTotal;
  }

  function getGpa(result) {
    const value = Number(result.gpa || result.GPA || result.finalGpa || 0);
    return Number.isNaN(value) ? 0 : value;
  }

  function getTotalPoint(result) {
    const value = Number(result.totalPoint || result.total_point || 0);
    return Number.isNaN(value) ? 0 : value;
  }

  function getRankingScore(result) {
    const value = Number(result.rankingScore || result.ranking_score || result.gpa || 0);
    return Number.isNaN(value) ? 0 : value;
  }

  function getAverageGpa(results) {
    if (!results.length) return 0;
    return results.reduce(function (sum, result) {
      return sum + getGpa(result);
    }, 0) / results.length;
  }

  function getGradeFromGpa(gpa) {
    if (gpa >= 5) return "A+";
    if (gpa >= 4) return "A";
    if (gpa >= 3.5) return "A-";
    if (gpa >= 3) return "B";
    if (gpa >= 2) return "C";
    if (gpa >= 1) return "D";
    return "F";
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
      return {
        mcq: "",
        written: total,
        practical: 0,
        total,
        point: Number(gradeInfo.point),
        grade: gradeInfo.grade
      };
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

  function hasValue(value) {
    return value !== "" && value !== null && value !== undefined;
  }

  function formatCellValue(value) {
    return hasValue(value) ? formatNumber(value) : "-";
  }

  function filterByYear(data, selectedYear) {
    return data.filter(function (item) {
      const itemYear = item.year || item.examYear || item.academicYear || item.session || selectedYear;
      return String(itemYear) === String(selectedYear);
    });
  }

  function getData(key) {
    try {
      const data = JSON.parse(localStorage.getItem(key) || "[]");
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.error("Dashboard localStorage read error:", key, error);
      return [];
    }
  }

  function getExamYearSelect() {
    return (
      document.querySelector(".exam-year-select select") ||
      document.querySelector("select#examYear") ||
      document.getElementById("examYearSelect") ||
      document.getElementById("yearSelect") ||
      document.querySelector(".year-dropdown")
    );
  }

  function getSelectedYear() {
    const yearSelect = getExamYearSelect();
    if (yearSelect && yearSelect.value) return String(yearSelect.value);

    const storedYear = localStorage.getItem(YEAR_KEY);
    if (storedYear) return String(storedYear);

    return String(BASE_YEAR);
  }

  function normalizeClass(value) {
    return String(value || "").replace(/class/gi, "").replace(/-/g, "").trim();
  }

  function getRankText(rank) {
    if (rank === 1) return "🥇 1st";
    if (rank === 2) return "🥈 2nd";
    if (rank === 3) return "🥉 3rd";
    return rank + "th";
  }

  function getRollNumber(roll) {
    const number = Number(roll);
    return Number.isNaN(number) ? 999999 : number;
  }

  function setText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  }

  function setDashboardYear(year) {
    setText("dashboardExamYear", String(year));

    const duplicateExamYear = document.getElementById("examYear");
    if (duplicateExamYear && duplicateExamYear.tagName !== "SELECT") {
      duplicateExamYear.textContent = String(year);
    }
  }

  function setDashboardStatus(status) {
    setText("dashboardStatus", status);
  }

  function setLastUpdated() {
    const now = new Date();
    const formatted = now.toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true
    });

    setText("lastUpdated", formatted);
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(Number(value) || 0, min), max);
  }

  function formatNumber(value) {
    const number = Number(value);
    if (Number.isNaN(number)) return "0";
    return Number.isInteger(number) ? String(number) : number.toFixed(2);
  }

  function toNumber(value) {
    const number = Number(value);
    return Number.isNaN(number) ? 0 : number;
  }

  function safeJsonArray(value) {
    if (Array.isArray(value)) return value;
    if (!value) return [];
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  }

  function safeJsonObject(value) {
    if (value && typeof value === "object" && !Array.isArray(value)) return value;
    if (!value) return {};
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch (_) {
      return {};
    }
  }

  function escapeHTML(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
})();
