/* =========================================================
   BHS Admin Profile + Admin Management System
   Requires:
   1. Supabase CDN
   2. supabase-config.js -> window.bhsSupabase
   3. SQL functions from sql/admin_profile_feature.sql
========================================================= */
(function () {
  const USER_INFO_KEY = "userInfo";
  let currentProfile = null;
  let currentUser = null;
  let initialized = false;

  document.addEventListener("DOMContentLoaded", function () {
    // Bind immediately because admin header is loaded dynamically by component.js.
    // The click handlers use event delegation, so they will work even if the header appears later.
    bootAdminProfileFeature();
  });

  function bootAdminProfileFeature() {
    if (!initialized) {
      initialized = true;
      injectAdminProfileStyles();
      createProfileModal();
      createAddAdminModal();
      createManageAdminsModal();
      createEditAdminModal();
      bindProfileFeatureEvents();
    }

    waitForHeaderAndSupabase(loadCurrentAdminProfile);
  }

  function waitForHeaderAndSupabase(callback) {
    let attempts = 0;
    const timer = setInterval(function () {
      attempts += 1;
      const headerReady = document.getElementById("adminProfileBtn") && document.getElementById("adminPopup");
      const supabaseReady = window.bhsSupabase;

      if (headerReady && supabaseReady) {
        clearInterval(timer);
        callback();
        return;
      }

      if (attempts > 120) {
        clearInterval(timer);
        console.warn("Admin profile feature could not initialize. Header or Supabase missing.");
      }
    }, 100);
  }

  async function initAdminProfileFeature() {
    // Backward compatibility alias.
    bootAdminProfileFeature();
  }

  async function loadCurrentAdminProfile() {
    try {
      const { data: sessionData, error: sessionError } = await window.bhsSupabase.auth.getSession();

      if (sessionError || !sessionData.session || !sessionData.session.user) {
        console.warn("No active admin session found.");
        return;
      }

      currentUser = sessionData.session.user;

      const { data, error } = await window.bhsSupabase
        .from("admin_profiles")
        .select("id, full_name, email, designation, role, status")
        .eq("id", currentUser.id)
        .single();

      if (error) {
        console.error("Admin profile load error:", error);
        return;
      }

      currentProfile = data;
      syncProfileToLocalStorage();
      updateHeaderProfileUI();
    } catch (error) {
      console.error("Admin profile initialize error:", error);
    }
  }

  function syncProfileToLocalStorage() {
    if (!currentProfile || !currentUser) return;

    const userInfo = {
      id: currentUser.id,
      name: currentProfile.full_name || "Admin",
      email: currentProfile.email || currentUser.email || "",
      designation: currentProfile.designation || "Administrator",
      role: currentProfile.role || "admin",
      loginTime: new Date().toISOString()
    };

    if (typeof window.bhsSafeSetLocalJSON === "function") {
      window.bhsSafeSetLocalJSON(USER_INFO_KEY, userInfo);
    } else {
      try { localStorage.setItem(USER_INFO_KEY, JSON.stringify(userInfo)); }
      catch (error) { console.warn("Admin user cache skipped:", error); }
    }
  }

  function updateHeaderProfileUI() {
    if (!currentProfile) return;

    const name = currentProfile.full_name || "Admin";
    const email = currentProfile.email || currentUser?.email || "";
    const designation = currentProfile.designation || "Administrator";
    const firstLetter = getFirstLetter(name);

    setText("headerAdminName", name);
    setText("headerAdminAvatar", firstLetter);

    // Fallback for older header.html that had no IDs inside .admin-profile.
    const oldAdminName = document.querySelector("#adminProfileBtn .admin-name");
    if (oldAdminName && !document.getElementById("headerAdminName")) {
      oldAdminName.innerHTML = `<span id="headerAdminName">${escapeHtml(name)}</span> <i class="fas fa-chevron-down"></i>`;
    }

    const oldAvatar = document.querySelector("#adminProfileBtn .admin-avatar");
    if (oldAvatar && !document.getElementById("headerAdminAvatar")) {
      oldAvatar.id = "headerAdminAvatar";
      oldAvatar.textContent = firstLetter;
    }

    const popupAvatarEl = document.getElementById("popupAvatar");
    if (popupAvatarEl && popupAvatarEl.tagName === "IMG") {
      const replacement = document.createElement("div");
      replacement.id = "popupAvatar";
      replacement.className = "popup-avatar popup-avatar-text";
      replacement.textContent = firstLetter;
      popupAvatarEl.replaceWith(replacement);
    } else {
      setText("popupAvatar", firstLetter);
    }
    setText("popupName", name);
    setText("popupEmail", email);
    setText("popupDesignation", designation);

    ensureAddAdminButtonExists();
    ensureManageAdminsButtonExists();
    bindDynamicHeaderButtons();

    const addAdminBtn = document.getElementById("popupAddAdminBtn");
    const manageAdminsBtn = document.getElementById("popupManageAdminsBtn");
    const canManageAdmins = isHeadOfAdministration(currentProfile);
    if (addAdminBtn) {
      addAdminBtn.hidden = !canManageAdmins;
    }
    if (manageAdminsBtn) {
      manageAdminsBtn.hidden = !canManageAdmins;
    }
  }

  function bindProfileFeatureEvents() {
    document.addEventListener("click", function (event) {
      const profileBtn = event.target.closest("#popupProfileBtn") || getOldProfileButton(event.target);
      const addAdminBtn = event.target.closest("#popupAddAdminBtn");
      const manageAdminsBtn = event.target.closest("#popupManageAdminsBtn");
      const manageRefreshBtn = event.target.closest("#refreshAdminListBtn");
      const editAdminBtn = event.target.closest(".bhs-admin-row-edit");
      const deleteAdminBtn = event.target.closest(".bhs-admin-row-delete");
      const profileClose = event.target.closest("#closeAdminProfileModal, #cancelAdminProfileEdit");
      const addClose = event.target.closest("#closeAddAdminModal, #cancelAddAdmin");
      const manageClose = event.target.closest("#closeManageAdminsModal, #closeManageAdminsBtn");
      const editClose = event.target.closest("#closeEditAdminModal, #cancelEditAdmin");
      const profileOverlay = document.getElementById("adminProfileModalOverlay");
      const addOverlay = document.getElementById("addAdminModalOverlay");
      const manageOverlay = document.getElementById("manageAdminsModalOverlay");
      const editOverlay = document.getElementById("editAdminModalOverlay");

      if (profileBtn) {
        event.preventDefault();
        event.stopPropagation();
        closeAdminPopupIfOpen();
        openProfileModal();
        return;
      }

      if (addAdminBtn) {
        event.preventDefault();
        event.stopPropagation();
        closeAdminPopupIfOpen();
        openAddAdminModal();
        return;
      }

      if (manageAdminsBtn) {
        event.preventDefault();
        event.stopPropagation();
        closeAdminPopupIfOpen();
        openManageAdminsModal();
        return;
      }

      if (manageRefreshBtn) {
        event.preventDefault();
        loadAdminList();
        return;
      }

      if (editAdminBtn) {
        event.preventDefault();
        openEditAdminModal(editAdminBtn.dataset.adminId);
        return;
      }

      if (deleteAdminBtn) {
        event.preventDefault();
        deleteAdminProfile(deleteAdminBtn.dataset.adminId, deleteAdminBtn.dataset.adminName);
        return;
      }

      if (profileClose) {
        event.preventDefault();
        closeProfileModal();
        return;
      }

      if (addClose) {
        event.preventDefault();
        closeAddAdminModal();
        return;
      }

      if (manageClose) {
        event.preventDefault();
        closeManageAdminsModal();
        return;
      }

      if (editClose) {
        event.preventDefault();
        closeEditAdminModal();
        return;
      }

      if (event.target === profileOverlay) closeProfileModal();
      if (event.target === addOverlay) closeAddAdminModal();
      if (event.target === manageOverlay) closeManageAdminsModal();
      if (event.target === editOverlay) closeEditAdminModal();
    }, true);

    document.addEventListener("submit", async function (event) {
      if (event.target && event.target.id === "adminProfileForm") {
        event.preventDefault();
        await saveProfileChanges();
      }

      if (event.target && event.target.id === "addAdminForm") {
        event.preventDefault();
        await createAdminProfile();
      }

      if (event.target && event.target.id === "editAdminForm") {
        event.preventDefault();
        await saveEditedAdminProfile();
      }
    });
  }

  async function openProfileModal() {
    if (!currentProfile) {
      await loadCurrentAdminProfile();
    }
    if (!currentProfile) {
      alert("Admin profile not loaded. Please refresh and try again.");
      return;
    }

    setValue("editAdminName", currentProfile.full_name || "");
    setValue("editAdminEmail", currentProfile.email || currentUser?.email || "");
    setValue("editAdminDesignation", currentProfile.designation || "Administrator");
    setValue("editAdminCurrentPassword", "");
    setValue("editAdminNewPassword", "");
    setValue("editAdminConfirmPassword", "");
    setText("adminProfileAvatarPreview", getFirstLetter(currentProfile.full_name || "Admin"));
    setProfileMessage("");

    showModal("adminProfileModalOverlay");
  }

  function closeProfileModal() {
    hideModal("adminProfileModalOverlay");
  }

  async function saveProfileChanges() {
    const saveBtn = document.getElementById("saveAdminProfileBtn");
    const fullName = getValue("editAdminName");
    const email = getValue("editAdminEmail");
    const currentPassword = getValue("editAdminCurrentPassword");
    const newPassword = getValue("editAdminNewPassword");
    const confirmPassword = getValue("editAdminConfirmPassword");

    if (!fullName) {
      setProfileMessage("Please enter admin name.", "error");
      return;
    }

    if (newPassword || confirmPassword || currentPassword) {
      if (!currentPassword) {
        setProfileMessage("Current password is required to change password.", "error");
        return;
      }

      if (!newPassword || newPassword.length < 6) {
        setProfileMessage("New password must be at least 6 characters.", "error");
        return;
      }

      if (newPassword !== confirmPassword) {
        setProfileMessage("New password and confirm password do not match.", "error");
        return;
      }
    }

    setButtonLoading(saveBtn, true, "Saving...");

    try {
      const { data: updatedProfile, error: profileError } = await window.bhsSupabase.rpc(
        "update_my_admin_profile",
        {
          p_full_name: fullName,
          p_email: email || currentUser.email
        }
      );

      if (profileError) throw profileError;

      if (newPassword) {
        const verify = await window.bhsSupabase.auth.signInWithPassword({
          email: currentUser.email,
          password: currentPassword
        });

        if (verify.error) {
          throw new Error("Current password is incorrect.");
        }

        const { error: passwordError } = await window.bhsSupabase.auth.updateUser({
          password: newPassword
        });

        if (passwordError) throw passwordError;
      }

      currentProfile = Array.isArray(updatedProfile) ? updatedProfile[0] : updatedProfile;
      syncProfileToLocalStorage();
      updateHeaderProfileUI();
      setProfileMessage("Profile updated successfully.", "success");

      setTimeout(closeProfileModal, 700);
    } catch (error) {
      console.error("Profile save error:", error);
      setProfileMessage(error.message || "Failed to update profile.", "error");
    } finally {
      setButtonLoading(saveBtn, false, "Save Changes");
    }
  }

  function openAddAdminModal() {
    if (!currentProfile || !isHeadOfAdministration(currentProfile)) {
      alert("Only Head of Administration can add admins.");
      return;
    }

    setValue("newAdminName", "");
    setValue("newAdminEmail", "");
    setValue("newAdminPassword", "");
    setValue("newAdminConfirmPassword", "");
    setValue("newAdminDesignation", "Administrator");
    setValue("newAdminRole", "admin");
    setValue("newAdminStatus", "active");
    setAddAdminMessage("");
    showModal("addAdminModalOverlay");
  }

  function closeAddAdminModal() {
    hideModal("addAdminModalOverlay");
  }


  async function openManageAdminsModal() {
    if (!currentProfile || !isHeadOfAdministration(currentProfile)) {
      alert("Only Head of Administration can manage admin profiles.");
      return;
    }

    setManageAdminsMessage("");
    showModal("manageAdminsModalOverlay");
    await loadAdminList();
  }

  function closeManageAdminsModal() {
    hideModal("manageAdminsModalOverlay");
  }

  function closeEditAdminModal() {
    hideModal("editAdminModalOverlay");
  }

  async function loadAdminList() {
    const tableBody = document.getElementById("adminListTableBody");
    const emptyBox = document.getElementById("adminListEmpty");
    const countBox = document.getElementById("adminListCount");

    if (!tableBody) return;

    tableBody.innerHTML = `<tr><td colspan="7" class="bhs-admin-list-loading"><i class="fas fa-spinner fa-spin"></i> Loading admins...</td></tr>`;
    if (emptyBox) emptyBox.hidden = true;
    setManageAdminsMessage("");

    try {
      const { data, error } = await window.bhsSupabase.rpc("head_list_admin_profiles");
      if (error) throw error;

      const admins = Array.isArray(data) ? data : [];
      if (countBox) countBox.textContent = `${admins.length} admin${admins.length === 1 ? "" : "s"}`;

      if (!admins.length) {
        tableBody.innerHTML = "";
        if (emptyBox) emptyBox.hidden = false;
        return;
      }

      tableBody.innerHTML = admins.map(renderAdminListRow).join("");
    } catch (error) {
      console.error("Admin list load error:", error);
      tableBody.innerHTML = "";
      setManageAdminsMessage(error.message || "Failed to load admin list.", "error");
    }
  }

  function renderAdminListRow(admin) {
    const isSelf = currentUser && admin.id === currentUser.id;
    const statusClass = admin.status === "active" ? "active" : "inactive";
    const roleLabel = formatRole(admin.role);
    const name = admin.full_name || "Admin";

    return `
      <tr>
        <td>
          <div class="bhs-admin-list-person">
            <div class="bhs-admin-list-avatar">${escapeHtml(getFirstLetter(name))}</div>
            <div>
              <strong>${escapeHtml(name)} ${isSelf ? '<span class="bhs-self-badge">You</span>' : ""}</strong>
              <span>${escapeHtml(shortId(admin.id))}</span>
            </div>
          </div>
        </td>
        <td>${escapeHtml(admin.email || "-")}</td>
        <td>${escapeHtml(admin.designation || "Administrator")}</td>
        <td><span class="bhs-role-badge">${escapeHtml(roleLabel)}</span></td>
        <td><span class="bhs-status-badge ${statusClass}">${escapeHtml(admin.status || "active")}</span></td>
        <td>${formatDate(admin.created_at)}</td>
        <td>
          <div class="bhs-admin-row-actions">
            <button type="button" class="bhs-admin-row-btn bhs-admin-row-edit" data-admin-id="${escapeHtml(admin.id)}">
              <i class="fas fa-pen"></i> Edit
            </button>
            <button type="button" class="bhs-admin-row-btn danger bhs-admin-row-delete" data-admin-id="${escapeHtml(admin.id)}" data-admin-name="${escapeHtml(name)}" ${isSelf ? "disabled title='You cannot delete yourself'" : ""}>
              <i class="fas fa-trash"></i> Delete
            </button>
          </div>
        </td>
      </tr>
    `;
  }

  async function openEditAdminModal(adminId) {
    if (!adminId) return;

    try {
      const { data, error } = await window.bhsSupabase.rpc("head_list_admin_profiles");
      if (error) throw error;
      const admin = (Array.isArray(data) ? data : []).find((item) => item.id === adminId);

      if (!admin) {
        alert("Admin profile not found.");
        return;
      }

      setValue("editTargetAdminId", admin.id);
      setValue("editTargetAdminName", admin.full_name || "");
      setValue("editTargetAdminEmail", admin.email || "");
      setValue("editTargetAdminDesignation", admin.designation || "Administrator");
      setValue("editTargetAdminRole", admin.role || "admin");
      setValue("editTargetAdminStatus", admin.status || "active");
      setText("editAdminPreviewAvatar", getFirstLetter(admin.full_name || "Admin"));
      setText("editAdminPreviewName", admin.full_name || "Admin");
      setText("editAdminPreviewEmail", admin.email || "");
      setEditAdminMessage("");
      showModal("editAdminModalOverlay");
    } catch (error) {
      console.error("Open admin edit error:", error);
      setManageAdminsMessage(error.message || "Failed to open admin editor.", "error");
    }
  }

  async function saveEditedAdminProfile() {
    const saveBtn = document.getElementById("saveEditAdminBtn");
    const targetUserId = getValue("editTargetAdminId");
    const fullName = getValue("editTargetAdminName");
    const email = getValue("editTargetAdminEmail");
    const designation = getValue("editTargetAdminDesignation") || "Administrator";
    const role = getValue("editTargetAdminRole") || "admin";
    const status = getValue("editTargetAdminStatus") || "active";

    if (!targetUserId || !fullName || !email) {
      setEditAdminMessage("Name and email are required.", "error");
      return;
    }

    setButtonLoading(saveBtn, true, "Saving...");

    try {
      const { error } = await window.bhsSupabase.rpc("head_update_admin_profile", {
        p_target_user_id: targetUserId,
        p_full_name: fullName,
        p_email: email,
        p_designation: designation,
        p_role: role,
        p_status: status
      });
      if (error) throw error;

      setEditAdminMessage("Admin profile updated successfully.", "success");
      await loadAdminList();

      if (targetUserId === currentUser?.id) {
        await loadCurrentAdminProfile();
      }

      setTimeout(closeEditAdminModal, 700);
    } catch (error) {
      console.error("Admin update error:", error);
      setEditAdminMessage(error.message || "Failed to update admin profile.", "error");
    } finally {
      setButtonLoading(saveBtn, false, "Save Admin");
    }
  }

  async function deleteAdminProfile(adminId, adminName) {
    if (!adminId) return;

    if (currentUser && adminId === currentUser.id) {
      alert("You cannot delete your own admin account while logged in.");
      return;
    }

    const confirmed = confirm(`Permanently delete ${adminName || "this admin"}?

This will remove both:
1. Supabase Authentication user
2. Admin profile access

This action cannot be undone.`);
    if (!confirmed) return;

    try {
      await callAdminFunction("delete-admin-user", {
        targetUserId: adminId,
        softDelete: false
      });

      setManageAdminsMessage("Admin user deleted successfully.", "success");
      await loadAdminList();
    } catch (error) {
      console.error("Admin delete error:", error);
      setManageAdminsMessage(error.message || "Failed to delete admin user.", "error");
    }
  }


  async function createAdminProfile() {
    const saveBtn = document.getElementById("saveNewAdminBtn");
    const fullName = getValue("newAdminName");
    const email = getValue("newAdminEmail");
    const password = getValue("newAdminPassword");
    const confirmPassword = getValue("newAdminConfirmPassword");
    const designation = getValue("newAdminDesignation") || "Administrator";
    const role = getValue("newAdminRole") || "admin";
    const status = getValue("newAdminStatus") || "active";

    if (!fullName || !email || !password) {
      setAddAdminMessage("Full name, email, and temporary password are required.", "error");
      return;
    }

    if (password.length < 6) {
      setAddAdminMessage("Temporary password must be at least 6 characters.", "error");
      return;
    }

    if (password !== confirmPassword) {
      setAddAdminMessage("Password and confirm password do not match.", "error");
      return;
    }

    setButtonLoading(saveBtn, true, "Creating...");

    try {
      await callAdminFunction("create-admin", {
        fullName,
        email,
        password,
        designation,
        role,
        status
      });

      setAddAdminMessage("Admin user created successfully.", "success");
      if (document.getElementById("manageAdminsModalOverlay")?.classList.contains("show")) {
        await loadAdminList();
      }

      setTimeout(closeAddAdminModal, 900);
    } catch (error) {
      console.error("Add admin error:", error);
      setAddAdminMessage(error.message || "Failed to create admin user.", "error");
    } finally {
      setButtonLoading(saveBtn, false, "Create Admin");
    }
  }


  async function callAdminFunction(functionName, body) {
    if (!window.bhsSupabase || !window.bhsSupabase.functions || typeof window.bhsSupabase.functions.invoke !== "function") {
      throw new Error(`Admin Edge Function ${functionName} is not available. Deploy Supabase functions from the included /supabase/functions folder.`);
    }

    const { data, error } = await window.bhsSupabase.functions.invoke(functionName, {
      body
    });

    if (error) {
      let message = error.message || "Admin function request failed.";

      try {
        if (error.context && typeof error.context.json === "function") {
          const details = await error.context.json();
          if (details && details.error) {
            message = details.error;
          }
        }
      } catch (_) {
        // Keep default message.
      }

      if (/not found|function/i.test(message)) {
        message = `${functionName} Edge Function is not deployed yet. Deploy the included Supabase function, then try again.`;
      }

      throw new Error(message);
    }

    if (data && data.error) {
      throw new Error(data.error);
    }

    return data;
  }

  function createProfileModal() {
    const existingModal = document.getElementById("adminProfileModalOverlay");
    if (existingModal) {
      if (existingModal.classList.contains("bhs-admin-modal-overlay")) {
        return;
      }
      existingModal.remove();
    }

    const modal = document.createElement("div");
    modal.id = "adminProfileModalOverlay";
    modal.className = "bhs-admin-modal-overlay";
    modal.innerHTML = `
      <div class="bhs-admin-modal">
        <div class="bhs-admin-modal-header">
          <div>
            <h3>Edit Profile</h3>
            <p>Update your admin name and password.</p>
          </div>
          <button type="button" class="bhs-admin-modal-close" id="closeAdminProfileModal">
            <i class="fas fa-times"></i>
          </button>
        </div>

        <form id="adminProfileForm" class="bhs-admin-form">
          <div class="bhs-profile-preview">
            <div class="bhs-profile-preview-avatar" id="adminProfileAvatarPreview">A</div>
            <div>
              <strong id="adminProfilePreviewName">Admin Profile</strong>
              <span>Personal admin account</span>
            </div>
          </div>

          <div class="bhs-admin-form-grid">
            <div class="bhs-admin-form-group">
              <label>Admin Name</label>
              <input type="text" id="editAdminName" required />
            </div>

            <div class="bhs-admin-form-group">
              <label>Email</label>
              <input type="email" id="editAdminEmail" readonly />
              <small>Email is used for login. Change it from Supabase Authentication if needed.</small>
            </div>

            <div class="bhs-admin-form-group">
              <label>Designation</label>
              <input type="text" id="editAdminDesignation" readonly />
              <small>Designation controls admin permission.</small>
            </div>

            <div class="bhs-admin-form-group">
              <label>Current Password</label>
              <input type="password" id="editAdminCurrentPassword" placeholder="Required only for password change" />
            </div>

            <div class="bhs-admin-form-group">
              <label>New Password</label>
              <input type="password" id="editAdminNewPassword" placeholder="Optional" />
            </div>

            <div class="bhs-admin-form-group">
              <label>Confirm New Password</label>
              <input type="password" id="editAdminConfirmPassword" placeholder="Optional" />
            </div>
          </div>

          <div id="adminProfileMessage" class="bhs-admin-message"></div>

          <div class="bhs-admin-modal-actions">
            <button type="button" class="bhs-admin-cancel-btn" id="cancelAdminProfileEdit">Cancel</button>
            <button type="submit" class="bhs-admin-save-btn" id="saveAdminProfileBtn">
              <i class="fas fa-save"></i> Save Changes
            </button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(modal);
  }

  function createAddAdminModal() {
    if (document.getElementById("addAdminModalOverlay")) return;

    const modal = document.createElement("div");
    modal.id = "addAdminModalOverlay";
    modal.className = "bhs-admin-modal-overlay";
    modal.innerHTML = `
      <div class="bhs-admin-modal bhs-add-admin-modal">
        <div class="bhs-admin-modal-header">
          <div>
            <h3>Add Admin</h3>
            <p>Create a new Supabase Auth user and admin profile automatically.</p>
          </div>
          <button type="button" class="bhs-admin-modal-close" id="closeAddAdminModal">
            <i class="fas fa-times"></i>
          </button>
        </div>

        <div class="bhs-admin-note bhs-admin-note-compact">
          UID will be created automatically through the included Supabase Edge Function.
        </div>

        <form id="addAdminForm" class="bhs-admin-form">
          <div class="bhs-admin-form-grid">
            <div class="bhs-admin-form-group">
              <label>Full Name</label>
              <input type="text" id="newAdminName" placeholder="Example: Rahim Uddin" required />
            </div>

            <div class="bhs-admin-form-group">
              <label>Email</label>
              <input type="email" id="newAdminEmail" placeholder="admin@example.com" required />
            </div>

            <div class="bhs-admin-form-group">
              <label>Temporary Password</label>
              <input type="password" id="newAdminPassword" placeholder="Minimum 6 characters" required />
            </div>

            <div class="bhs-admin-form-group">
              <label>Confirm Password</label>
              <input type="password" id="newAdminConfirmPassword" placeholder="Repeat temporary password" required />
            </div>

            <div class="bhs-admin-form-group">
              <label>Designation</label>
              <input type="text" id="newAdminDesignation" value="Administrator" />
            </div>

            <div class="bhs-admin-form-group">
              <label>Role</label>
              <select id="newAdminRole">
                <option value="admin">Admin</option>
                <option value="editor">Editor</option>
                <option value="super_admin">Super Admin</option>
              </select>
            </div>

            <div class="bhs-admin-form-group">
              <label>Status</label>
              <select id="newAdminStatus">
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>

          <div id="addAdminMessage" class="bhs-admin-message"></div>

          <div class="bhs-admin-modal-actions">
            <button type="button" class="bhs-admin-cancel-btn" id="cancelAddAdmin">Cancel</button>
            <button type="submit" class="bhs-admin-save-btn" id="saveNewAdminBtn">
              <i class="fas fa-user-plus"></i> Create Admin
            </button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(modal);
  }




  function createManageAdminsModal() {
    if (document.getElementById("manageAdminsModalOverlay")) return;

    const modal = document.createElement("div");
    modal.id = "manageAdminsModalOverlay";
    modal.className = "bhs-admin-modal-overlay";
    modal.innerHTML = `
      <div class="bhs-admin-modal bhs-manage-admins-modal">
        <div class="bhs-admin-modal-header">
          <div>
            <h3>Manage Admins</h3>
            <p>View, edit, and remove admin access.</p>
          </div>
          <button type="button" class="bhs-admin-modal-close" id="closeManageAdminsModal">
            <i class="fas fa-times"></i>
          </button>
        </div>

        <div class="bhs-admin-list-toolbar">
          <div>
            <strong>All Admin Profiles</strong>
            <span id="adminListCount">0 admins</span>
          </div>
          <button type="button" class="bhs-admin-small-btn" id="refreshAdminListBtn">
            <i class="fas fa-sync-alt"></i> Refresh
          </button>
        </div>

        <div id="manageAdminsMessage" class="bhs-admin-message bhs-admin-list-message"></div>

        <div class="bhs-admin-table-wrap">
          <table class="bhs-admin-table">
            <thead>
              <tr>
                <th>Admin</th>
                <th>Email</th>
                <th>Designation</th>
                <th>Role</th>
                <th>Status</th>
                <th>Created</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody id="adminListTableBody"></tbody>
          </table>
        </div>

        <div id="adminListEmpty" class="bhs-admin-empty" hidden>
          <i class="fas fa-users-slash"></i>
          <p>No admin profile found.</p>
        </div>

        <div class="bhs-admin-note bhs-admin-note-inside">
          <strong>Delete note:</strong> Delete will remove both the Supabase Auth user and the admin profile through Edge Function.
        </div>

        <div class="bhs-admin-modal-actions bhs-admin-list-actions">
          <button type="button" class="bhs-admin-cancel-btn" id="closeManageAdminsBtn">Close</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
  }

  function createEditAdminModal() {
    if (document.getElementById("editAdminModalOverlay")) return;

    const modal = document.createElement("div");
    modal.id = "editAdminModalOverlay";
    modal.className = "bhs-admin-modal-overlay";
    modal.innerHTML = `
      <div class="bhs-admin-modal bhs-add-admin-modal">
        <div class="bhs-admin-modal-header">
          <div>
            <h3>Edit Admin</h3>
            <p>Only Head of Administration can update admin permission fields.</p>
          </div>
          <button type="button" class="bhs-admin-modal-close" id="closeEditAdminModal">
            <i class="fas fa-times"></i>
          </button>
        </div>

        <form id="editAdminForm" class="bhs-admin-form">
          <div class="bhs-profile-preview">
            <div class="bhs-profile-preview-avatar" id="editAdminPreviewAvatar">A</div>
            <div>
              <strong id="editAdminPreviewName">Admin</strong>
              <span id="editAdminPreviewEmail">admin@example.com</span>
            </div>
          </div>

          <div class="bhs-admin-form-grid">
            <div class="bhs-admin-form-group bhs-admin-form-full">
              <label>Auth User UID</label>
              <input type="text" id="editTargetAdminId" readonly />
            </div>

            <div class="bhs-admin-form-group">
              <label>Full Name</label>
              <input type="text" id="editTargetAdminName" required />
            </div>

            <div class="bhs-admin-form-group">
              <label>Email</label>
              <input type="email" id="editTargetAdminEmail" required />
            </div>

            <div class="bhs-admin-form-group">
              <label>Designation</label>
              <input type="text" id="editTargetAdminDesignation" />
            </div>

            <div class="bhs-admin-form-group">
              <label>Role</label>
              <select id="editTargetAdminRole">
                <option value="admin">Admin</option>
                <option value="editor">Editor</option>
                <option value="super_admin">Super Admin</option>
              </select>
            </div>

            <div class="bhs-admin-form-group">
              <label>Status</label>
              <select id="editTargetAdminStatus">
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>

          <div id="editAdminMessage" class="bhs-admin-message"></div>

          <div class="bhs-admin-modal-actions">
            <button type="button" class="bhs-admin-cancel-btn" id="cancelEditAdmin">Cancel</button>
            <button type="submit" class="bhs-admin-save-btn" id="saveEditAdminBtn">
              <i class="fas fa-save"></i> Save Admin
            </button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(modal);
  }
  function injectAdminProfileStyles() {
    if (document.getElementById("bhsAdminProfileInjectedCss")) return;

    const link = document.createElement("link");
    link.id = "bhsAdminProfileInjectedCss";
    link.rel = "stylesheet";
    link.href = "../assets/css/admin-profile.css";
    document.head.appendChild(link);
  }


  function getOldProfileButton(target) {
    const button = target.closest(".popup-content button, .popup-content .btn-secondary");
    if (!button) return null;
    const text = String(button.textContent || "").trim().toLowerCase();
    return text.includes("profile") ? button : null;
  }

  function ensureAddAdminButtonExists() {
    if (document.getElementById("popupAddAdminBtn")) return;

    const popupContent = document.querySelector("#adminPopup .popup-content");
    const logoutBtn = document.getElementById("popupLogoutBtn");
    if (!popupContent || !logoutBtn) return;

    const btn = document.createElement("button");
    btn.className = "btn-secondary admin-add-btn";
    btn.id = "popupAddAdminBtn";
    btn.type = "button";
    btn.hidden = true;
    btn.innerHTML = '<i class="fas fa-user-plus"></i> Add Admin';
    popupContent.insertBefore(btn, logoutBtn);
  }

  function ensureManageAdminsButtonExists() {
    if (document.getElementById("popupManageAdminsBtn")) return;

    const popupContent = document.querySelector("#adminPopup .popup-content");
    const logoutBtn = document.getElementById("popupLogoutBtn");
    if (!popupContent || !logoutBtn) return;

    const btn = document.createElement("button");
    btn.className = "btn-secondary admin-manage-btn";
    btn.id = "popupManageAdminsBtn";
    btn.type = "button";
    btn.hidden = true;
    btn.innerHTML = '<i class="fas fa-users-cog"></i> Manage Admins';
    popupContent.insertBefore(btn, logoutBtn);
  }

  function bindDynamicHeaderButtons() {
    const profileBtn = document.getElementById("popupProfileBtn");
    if (profileBtn && !profileBtn.dataset.bhsProfileBound) {
      profileBtn.dataset.bhsProfileBound = "true";
      profileBtn.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        closeAdminPopupIfOpen();
        openProfileModal();
      });
    }

    const addAdminBtn = document.getElementById("popupAddAdminBtn");
    if (addAdminBtn && !addAdminBtn.dataset.bhsAddAdminBound) {
      addAdminBtn.dataset.bhsAddAdminBound = "true";
      addAdminBtn.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        closeAdminPopupIfOpen();
        openAddAdminModal();
      });
    }

    const manageAdminsBtn = document.getElementById("popupManageAdminsBtn");
    if (manageAdminsBtn && !manageAdminsBtn.dataset.bhsManageAdminsBound) {
      manageAdminsBtn.dataset.bhsManageAdminsBound = "true";
      manageAdminsBtn.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        closeAdminPopupIfOpen();
        openManageAdminsModal();
      });
    }
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function isHeadOfAdministration(profile) {
    const designation = String(profile?.designation || "").trim().toLowerCase();
    const role = String(profile?.role || "").trim().toLowerCase();
    return designation === "head of administration" || role === "super_admin";
  }

  function closeAdminPopupIfOpen() {
    const popup = document.getElementById("adminPopup");
    if (popup) popup.classList.remove("show");
  }

  function showModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.classList.add("show");
    document.body.style.overflow = "hidden";
  }

  function hideModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.classList.remove("show");
    document.body.style.overflow = "";
  }

  function setProfileMessage(text, type) {
    setMessage("adminProfileMessage", text, type);
  }

  function setAddAdminMessage(text, type) {
    setMessage("addAdminMessage", text, type);
  }

  function setManageAdminsMessage(text, type) {
    setMessage("manageAdminsMessage", text, type);
  }

  function setEditAdminMessage(text, type) {
    setMessage("editAdminMessage", text, type);
  }

  function setMessage(id, text, type) {
    const message = document.getElementById(id);
    if (!message) return;
    message.textContent = text || "";
    message.className = "bhs-admin-message";
    if (text) message.classList.add(type === "success" ? "success" : "error");
  }

  function setButtonLoading(button, isLoading, text) {
    if (!button) return;
    button.disabled = isLoading;
    if (isLoading) {
      button.dataset.originalText = button.innerHTML;
      button.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${text}`;
    } else {
      button.innerHTML = button.dataset.originalText || text;
    }
  }

  function setText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  }

  function setValue(id, value) {
    const element = document.getElementById(id);
    if (element) element.value = value || "";
  }

  function getValue(id) {
    const element = document.getElementById(id);
    return element ? element.value.trim() : "";
  }

  function getFirstLetter(name) {
    const cleanName = String(name || "Admin").trim();
    return cleanName ? cleanName.charAt(0).toUpperCase() : "A";
  }

  function formatRole(role) {
    const value = String(role || "admin");
    if (value === "super_admin") return "Super Admin";
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  function shortId(id) {
    const value = String(id || "");
    if (value.length <= 12) return value;
    return value.slice(0, 8) + "..." + value.slice(-4);
  }

  function formatDate(value) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });
  }

  window.bhsReloadAdminProfile = loadCurrentAdminProfile;
  window.bhsLoadAdminList = loadAdminList;
})();
