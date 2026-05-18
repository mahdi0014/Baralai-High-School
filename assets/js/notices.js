const NOTICE_STORAGE_KEY = "bhs_notices";
const MAX_FILE_SIZE = 2 * 1024 * 1024;

let notices = [];
let editingNoticeId = null;

document.addEventListener("DOMContentLoaded", async () => {
  initNoticeEvents();
  setDefaultNoticeDate();
  await loadNotices();
  renderNotices();
  updateNoticeSummary();
});

function getSupabaseClient() {
  if (!window.bhsSupabase) {
    console.error("Supabase client not found. Please check supabase-config.js script order.");
    return null;
  }

  return window.bhsSupabase;
}

function dbNoticeToApp(row) {
  return {
    id: row.id,
    title: row.title || "",
    category: row.category || "General Notice",
    date: row.notice_date || "",
    status: row.status || "draft",
    priority: row.priority || "normal",
    isImportant: Boolean(row.is_important),
    description: row.description || "",
    attachment: row.attachment || null,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null
  };
}

function appNoticeToDb(data) {
  return {
    title: data.title,
    category: data.category,
    notice_date: data.date,
    status: data.status,
    priority: data.priority,
    is_important: Boolean(data.isImportant),
    description: data.description,
    attachment: data.attachment || null
  };
}

async function loadNotices() {
  const client = getSupabaseClient();

  if (!client) {
    loadNoticesFromCache();
    return;
  }

  const { data, error } = await client
    .from("notices")
    .select("id, title, category, notice_date, status, priority, is_important, description, attachment, created_at, updated_at")
    .order("is_important", { ascending: false })
    .order("notice_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Notice load error:", error);
    alert("Could not load notices from Supabase. Please check RLS policy and console error.");
    loadNoticesFromCache();
    return;
  }

  notices = (data || []).map(dbNoticeToApp);
  saveNoticesToCache();
}

function loadNoticesFromCache() {
  const storedNotices = localStorage.getItem(NOTICE_STORAGE_KEY);

  try {
    notices = storedNotices ? JSON.parse(storedNotices) : [];
  } catch {
    notices = [];
    saveNoticesToCache();
  }
}

function saveNoticesToCache() {
  if (typeof window.bhsSafeSetLocalJSON === "function") {
    window.bhsSafeSetLocalJSON(NOTICE_STORAGE_KEY, notices);
  } else {
    try { localStorage.setItem(NOTICE_STORAGE_KEY, JSON.stringify(notices)); }
    catch (error) { console.warn("Notice cache skipped:", error); }
  }
}

function initNoticeEvents() {
  const openNoticeFormBtn = document.getElementById("openNoticeFormBtn");
  const closeNoticeFormBtn = document.getElementById("closeNoticeFormBtn");
  const noticeForm = document.getElementById("noticeForm");
  const resetNoticeBtn = document.getElementById("resetNoticeBtn");
  const noticeSearchInput = document.getElementById("noticeSearchInput");
  const noticeCategoryFilter = document.getElementById("noticeCategoryFilter");
  const noticeStatusFilter = document.getElementById("noticeStatusFilter");
  const refreshNoticeBtn = document.getElementById("refreshNoticeBtn");
  const noticeList = document.getElementById("noticeList");
  const closeNoticeModalBtn = document.getElementById("closeNoticeModalBtn");
  const noticeDetailsModal = document.getElementById("noticeDetailsModal");

  if (openNoticeFormBtn) {
    openNoticeFormBtn.addEventListener("click", openNoticeForm);
  }

  if (closeNoticeFormBtn) {
    closeNoticeFormBtn.addEventListener("click", closeNoticeForm);
  }

  if (noticeForm) {
    noticeForm.addEventListener("submit", handleNoticeSubmit);
  }

  if (resetNoticeBtn) {
    resetNoticeBtn.addEventListener("click", () => {
      setTimeout(resetNoticeForm, 0);
    });
  }

  if (noticeSearchInput) {
    noticeSearchInput.addEventListener("input", renderNotices);
  }

  if (noticeCategoryFilter) {
    noticeCategoryFilter.addEventListener("change", renderNotices);
  }

  if (noticeStatusFilter) {
    noticeStatusFilter.addEventListener("change", renderNotices);
  }

  if (refreshNoticeBtn) {
    refreshNoticeBtn.addEventListener("click", async () => {
      refreshNoticeBtn.disabled = true;
      refreshNoticeBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Refreshing`;

      await loadNotices();
      renderNotices();
      updateNoticeSummary();

      refreshNoticeBtn.disabled = false;
      refreshNoticeBtn.innerHTML = `<i class="fas fa-sync-alt"></i> Refresh`;
    });
  }

  if (noticeList) {
    noticeList.addEventListener("click", handleNoticeAction);
  }

  if (closeNoticeModalBtn) {
    closeNoticeModalBtn.addEventListener("click", closeNoticeModal);
  }

  if (noticeDetailsModal) {
    noticeDetailsModal.addEventListener("click", (event) => {
      if (event.target === noticeDetailsModal) {
        closeNoticeModal();
      }
    });
  }
}

function openNoticeForm() {
  const noticeFormCard = document.getElementById("noticeFormCard");

  if (!noticeFormCard) return;

  noticeFormCard.classList.add("active");
  noticeFormCard.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

function closeNoticeForm() {
  const noticeFormCard = document.getElementById("noticeFormCard");

  if (!noticeFormCard) return;

  noticeFormCard.classList.remove("active");
  resetNoticeForm();
}

function resetNoticeForm() {
  const noticeForm = document.getElementById("noticeForm");

  if (noticeForm) {
    noticeForm.reset();
  }

  editingNoticeId = null;

  setValue("noticeId", "");
  setValue("existingNoticeAttachment", "");
  setText("noticeFormTitle", "Add New Notice");
  setHTML("saveNoticeBtn", `<i class="fas fa-save"></i> Save Notice`);

  setDefaultNoticeDate(true);
}

function setDefaultNoticeDate(force = false) {
  const noticeDate = document.getElementById("noticeDate");

  if (noticeDate && (force || !noticeDate.value)) {
    noticeDate.value = new Date().toISOString().split("T")[0];
  }
}

async function handleNoticeSubmit(event) {
  event.preventDefault();

  const noticeId = document.getElementById("noticeId")?.value || "";
  const title = document.getElementById("noticeTitle")?.value.trim() || "";
  const category = document.getElementById("noticeCategory")?.value || "";
  const date = document.getElementById("noticeDate")?.value || "";
  const status = document.getElementById("noticeStatus")?.value || "";
  const priority = document.getElementById("noticePriority")?.value || "";
  const description = document.getElementById("noticeDescription")?.value.trim() || "";
  const noticeAttachment = document.getElementById("noticeAttachment");
  const saveNoticeBtn = document.getElementById("saveNoticeBtn");

  if (!title || !category || !date || !status || !priority || !description) {
    alert("Please fill all required fields.");
    return;
  }

  let attachment = null;

  if (noticeId) {
    const oldNotice = notices.find((notice) => String(notice.id) === String(noticeId));
    attachment = oldNotice ? oldNotice.attachment : null;
  }

  if (noticeAttachment && noticeAttachment.files.length > 0) {
    const file = noticeAttachment.files[0];
    const validation = validateNoticeFile(file);

    if (!validation.valid) {
      alert(validation.message);
      return;
    }

    attachment = await convertFileToBase64(file);
  }

  const duplicateNotice = notices.find((notice) => {
    return (
      notice.title.toLowerCase() === title.toLowerCase() &&
      notice.date === date &&
      String(notice.id) !== String(noticeId)
    );
  });

  if (duplicateNotice) {
    alert("This notice title already exists for the selected date.");
    return;
  }

  const noticeData = {
    title,
    category,
    date,
    status,
    priority,
    isImportant: priority === "important",
    description,
    attachment
  };

  setButtonLoading(saveNoticeBtn, true, noticeId ? "Updating..." : "Saving...");

  try {
    if (noticeId) {
      await updateNotice(noticeId, noticeData);
      alert("Notice updated successfully.");
    } else {
      await addNotice(noticeData);
      alert("Notice added successfully.");
    }

    renderNotices();
    updateNoticeSummary();
    closeNoticeForm();
  } catch (error) {
    console.error("Notice save error:", error);
    alert(error.message || "Could not save notice.");
  } finally {
    setButtonLoading(saveNoticeBtn, false);
  }
}

async function addNotice(data) {
  const client = getSupabaseClient();

  if (!client) {
    throw new Error("Supabase connection not found.");
  }

  const { data: insertedNotice, error } = await client
    .from("notices")
    .insert(appNoticeToDb(data))
    .select("id, title, category, notice_date, status, priority, is_important, description, attachment, created_at, updated_at")
    .single();

  if (error) {
    throw error;
  }

  notices.unshift(dbNoticeToApp(insertedNotice));
  sortNotices();
  saveNoticesToCache();
}

async function updateNotice(id, updatedData) {
  const client = getSupabaseClient();

  if (!client) {
    throw new Error("Supabase connection not found.");
  }

  const { data: updatedNotice, error } = await client
    .from("notices")
    .update(appNoticeToDb(updatedData))
    .eq("id", id)
    .select("id, title, category, notice_date, status, priority, is_important, description, attachment, created_at, updated_at")
    .single();

  if (error) {
    throw error;
  }

  notices = notices.map((notice) =>
    String(notice.id) === String(id) ? dbNoticeToApp(updatedNotice) : notice
  );

  sortNotices();
  saveNoticesToCache();
}

function validateNoticeFile(file) {
  const allowedExtensions = ["pdf", "doc", "docx", "jpg", "jpeg", "png"];
  const fileExtension = file.name.split(".").pop().toLowerCase();

  if (!allowedExtensions.includes(fileExtension)) {
    return {
      valid: false,
      message: "Only PDF, DOC, DOCX, JPG, JPEG and PNG files are allowed."
    };
  }

  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      message: "File size must be less than 2 MB."
    };
  }

  return {
    valid: true,
    message: "Valid file."
  };
}

function convertFileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      resolve({
        name: file.name,
        type: file.type,
        size: file.size,
        dataUrl: reader.result
      });
    };

    reader.onerror = () => {
      reject(new Error("File reading failed."));
    };

    reader.readAsDataURL(file);
  });
}

function getFilteredNotices() {
  const searchText =
    document.getElementById("noticeSearchInput")?.value.toLowerCase().trim() || "";

  const categoryFilter =
    document.getElementById("noticeCategoryFilter")?.value || "all";

  const statusFilter =
    document.getElementById("noticeStatusFilter")?.value || "all";

  return notices
    .filter((notice) => {
      const matchesSearch =
        notice.title.toLowerCase().includes(searchText) ||
        notice.description.toLowerCase().includes(searchText) ||
        notice.category.toLowerCase().includes(searchText);

      const matchesCategory =
        categoryFilter === "all" || notice.category === categoryFilter;

      const matchesStatus =
        statusFilter === "all" || notice.status === statusFilter;

      return matchesSearch && matchesCategory && matchesStatus;
    })
    .sort((a, b) => {
      if (a.isImportant !== b.isImportant) {
        return Number(b.isImportant) - Number(a.isImportant);
      }

      return new Date(b.date) - new Date(a.date);
    });
}

function renderNotices() {
  const noticeList = document.getElementById("noticeList");

  if (!noticeList) return;

  const filteredNotices = getFilteredNotices();

  if (filteredNotices.length === 0) {
    noticeList.innerHTML = `
      <div class="empty-state" id="emptyNoticeState">
        <i class="fas fa-bullhorn"></i>
        <h3>No Notice Found</h3>
        <p>Please add a new notice or change your search/filter.</p>
      </div>
    `;
    return;
  }

  noticeList.innerHTML = filteredNotices
    .map((notice) => {
      const descriptionPreview = limitText(notice.description, 120);

      return `
        <div class="notice-item ${notice.isImportant ? "important" : ""}">
          <div class="notice-content">
            <h4>${escapeHTML(notice.title)}</h4>

            <p>${escapeHTML(descriptionPreview)}</p>

            <div class="notice-meta">
              <span class="notice-badge category">
                <i class="fas fa-folder"></i>
                ${escapeHTML(notice.category)}
              </span>

              <span class="notice-badge date">
                <i class="fas fa-calendar-alt"></i>
                ${formatNoticeDate(notice.date)}
              </span>

              <span class="notice-badge ${notice.status}">
                <i class="fas ${notice.status === "published" ? "fa-check-circle" : "fa-file-alt"}"></i>
                ${capitalizeText(notice.status)}
              </span>

              ${
                notice.isImportant
                  ? `
                    <span class="notice-badge important">
                      <i class="fas fa-star"></i>
                      Important
                    </span>
                  `
                  : ""
              }

              ${
                notice.attachment
                  ? `
                    <span class="notice-badge attachment">
                      <i class="fas fa-paperclip"></i>
                      File Attached
                    </span>
                  `
                  : ""
              }
            </div>
          </div>

          <div class="notice-actions">
            <button class="action-btn view" data-action="view" data-id="${notice.id}" title="View Notice">
              <i class="fas fa-eye"></i>
            </button>

            <button class="action-btn edit" data-action="edit" data-id="${notice.id}" title="Edit Notice">
              <i class="fas fa-edit"></i>
            </button>

            <button class="action-btn publish" data-action="toggle-status" data-id="${notice.id}" title="Change Status">
              <i class="fas ${notice.status === "published" ? "fa-file-alt" : "fa-check"}"></i>
            </button>

            <button class="action-btn delete" data-action="delete" data-id="${notice.id}" title="Delete Notice">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>
      `;
    })
    .join("");
}

async function handleNoticeAction(event) {
  const button = event.target.closest("[data-action]");

  if (!button) return;

  const action = button.dataset.action;
  const id = button.dataset.id;

  if (action === "view") {
    viewNotice(id);
  }

  if (action === "edit") {
    editNotice(id);
  }

  if (action === "delete") {
    await deleteNotice(id);
  }

  if (action === "toggle-status") {
    await toggleNoticeStatus(id);
  }
}

function viewNotice(id) {
  const notice = notices.find((item) => String(item.id) === String(id));

  if (!notice) {
    alert("Notice not found.");
    return;
  }

  setText("modalNoticeTitle", notice.title);

  setHTML(
    "modalNoticeCategory",
    `<i class="fas fa-folder"></i> ${escapeHTML(notice.category)}`
  );

  setHTML(
    "modalNoticeDate",
    `<i class="fas fa-calendar-alt"></i> ${formatNoticeDate(notice.date)}`
  );

  setHTML(
    "modalNoticeStatus",
    `<i class="fas ${notice.status === "published" ? "fa-check-circle" : "fa-file-alt"}"></i> ${capitalizeText(notice.status)}`
  );

  setText("modalNoticeDescription", notice.description);

  const modalAttachmentBox = document.getElementById("modalAttachmentBox");
  const modalNoticeAttachment = document.getElementById("modalNoticeAttachment");

  if (notice.attachment && notice.attachment.dataUrl && modalAttachmentBox && modalNoticeAttachment) {
    modalAttachmentBox.classList.add("active");
    modalNoticeAttachment.href = notice.attachment.dataUrl;
    modalNoticeAttachment.download = notice.attachment.name || "notice-attachment";
    modalNoticeAttachment.innerHTML = `
      <i class="fas fa-paperclip"></i>
      ${escapeHTML(notice.attachment.name || "View Attached File")}
    `;
  } else if (modalAttachmentBox && modalNoticeAttachment) {
    modalAttachmentBox.classList.remove("active");
    modalNoticeAttachment.href = "#";
    modalNoticeAttachment.removeAttribute("download");
  }

  document.getElementById("noticeDetailsModal")?.classList.add("active");
}

function closeNoticeModal() {
  const noticeDetailsModal = document.getElementById("noticeDetailsModal");

  if (noticeDetailsModal) {
    noticeDetailsModal.classList.remove("active");
  }
}

function editNotice(id) {
  const notice = notices.find((item) => String(item.id) === String(id));

  if (!notice) {
    alert("Notice not found.");
    return;
  }

  editingNoticeId = notice.id;

  setValue("noticeId", notice.id);
  setValue("noticeTitle", notice.title);
  setValue("noticeCategory", notice.category);
  setValue("noticeDate", notice.date);
  setValue("noticeStatus", notice.status);
  setValue("noticePriority", notice.priority);
  setValue("noticeDescription", notice.description);
  setValue("noticeAttachment", "");
  setValue("existingNoticeAttachment", notice.attachment ? JSON.stringify(notice.attachment) : "");

  setText("noticeFormTitle", "Update Notice");
  setHTML("saveNoticeBtn", `<i class="fas fa-save"></i> Update Notice`);

  openNoticeForm();
}

async function deleteNotice(id) {
  const notice = notices.find((item) => String(item.id) === String(id));

  if (!notice) {
    alert("Notice not found.");
    return;
  }

  const confirmDelete = confirm(
    `Are you sure you want to delete "${notice.title}"?`
  );

  if (!confirmDelete) return;

  const client = getSupabaseClient();

  if (!client) {
    alert("Supabase connection not found.");
    return;
  }

  const { error } = await client
    .from("notices")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Notice delete error:", error);
    alert("Could not delete notice.");
    return;
  }

  notices = notices.filter((item) => String(item.id) !== String(id));
  saveNoticesToCache();
  renderNotices();
  updateNoticeSummary();

  alert("Notice deleted successfully.");
}

async function toggleNoticeStatus(id) {
  const notice = notices.find((item) => String(item.id) === String(id));

  if (!notice) {
    alert("Notice not found.");
    return;
  }

  const nextStatus = notice.status === "published" ? "draft" : "published";

  const client = getSupabaseClient();

  if (!client) {
    alert("Supabase connection not found.");
    return;
  }

  const { data: updatedNotice, error } = await client
    .from("notices")
    .update({ status: nextStatus })
    .eq("id", id)
    .select("id, title, category, notice_date, status, priority, is_important, description, attachment, created_at, updated_at")
    .single();

  if (error) {
    console.error("Notice status update error:", error);
    alert("Could not update notice status.");
    return;
  }

  notices = notices.map((item) =>
    String(item.id) === String(id) ? dbNoticeToApp(updatedNotice) : item
  );

  sortNotices();
  saveNoticesToCache();
  renderNotices();
  updateNoticeSummary();

  alert(
    nextStatus === "published"
      ? "Notice published successfully."
      : "Notice moved to draft successfully."
  );
}

function updateNoticeSummary() {
  setText("totalNotices", notices.length);
  setText(
    "publishedNotices",
    notices.filter((notice) => notice.status === "published").length
  );
  setText(
    "draftNotices",
    notices.filter((notice) => notice.status === "draft").length
  );
  setText(
    "importantNotices",
    notices.filter((notice) => notice.isImportant).length
  );
}

function sortNotices() {
  notices.sort((a, b) => {
    if (a.isImportant !== b.isImportant) {
      return Number(b.isImportant) - Number(a.isImportant);
    }

    return new Date(b.date) - new Date(a.date);
  });
}

function setButtonLoading(button, isLoading, loadingText = "Saving...") {
  if (!button) return;

  if (isLoading) {
    button.disabled = true;
    button.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${loadingText}`;
  } else {
    button.disabled = false;
    button.innerHTML = editingNoticeId
      ? `<i class="fas fa-save"></i> Update Notice`
      : `<i class="fas fa-save"></i> Save Notice`;
  }
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

function setHTML(id, value) {
  const element = document.getElementById(id);
  if (element) element.innerHTML = value;
}

function setValue(id, value) {
  const element = document.getElementById(id);
  if (element) element.value = value;
}

function formatNoticeDate(dateString) {
  if (!dateString) return "No Date";

  const date = new Date(dateString);

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function limitText(text, limit) {
  if (!text) return "";

  if (text.length <= limit) {
    return text;
  }

  return text.substring(0, limit).trim() + "...";
}

function capitalizeText(text) {
  if (!text) return "";

  return text.charAt(0).toUpperCase() + text.slice(1);
}

function escapeHTML(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
