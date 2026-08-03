import * as Sp from "./supabase-auth.js";
import { whenDocumentReady } from "./dom-ready.js";
import { guardSupabaseOrHalt } from "./supabase-guard.js";

async function init() {
  if (!guardSupabaseOrHalt()) return;

  let currentProfile = null;
  try {
    const s = await Sp.spGetSessionProfile();
    if (!s?.session) {
      window.location.replace("login.html?next=admin.html");
      return;
    }
    if (s.profile?.must_change_password) {
      window.location.replace("change-password.html?required=1");
      return;
    }
    if (!Sp.isProfileAdmin(s.profile)) {
      window.location.replace("index.html");
      return;
    }
    currentProfile = s.profile;
  } catch (e) {
    console.error(e);
    window.location.replace("login.html?next=admin.html");
    return;
  }

  const msg = document.getElementById("adminMsg");
  function flash(text, ok) {
    msg.textContent = text;
    msg.className = "admin-msg visible " + (ok ? "ok" : "error");
    setTimeout(() => {
      msg.classList.remove("visible");
    }, 3200);
  }

  function shouldHideDeleteButton(editingUser) {
    if (!editingUser?.id) return true;
    if (currentProfile && editingUser.id === currentProfile.id) return true;
    const role =
      editingUser.role !== undefined
        ? editingUser.role
        : document.getElementById("editRole")?.value;
    if (role === "admin" || Sp.isProfileAdmin(editingUser)) return true;
    return false;
  }

  function syncDeleteButton(editingUser) {
    const del = document.getElementById("btnDeleteUser");
    if (!del) return;
    const hide = shouldHideDeleteButton(editingUser);
    del.hidden = hide;
    del.style.display = hide ? "none" : "";
  }

  function syncDeleteButtonFromForm() {
    const id = document.getElementById("editUserId").value;
    if (!id) {
      syncDeleteButton(null);
      return;
    }
    syncDeleteButton({
      id,
      username: document.getElementById("editUsername").value,
      role: document.getElementById("editRole").value
    });
  }

  function fillEditForm(u) {
    document.getElementById("editUserId").value = u.id;
    document.getElementById("editUsername").value = u.username;
    document.getElementById("editEmail").value = u.email;
    document.getElementById("editRole").value = Sp.effectiveProfileRole(u);
    document.getElementById("editPassword").value = "";
    syncDeleteButton(u);
  }

  document.getElementById("btnLogout").addEventListener("click", async () => {
    await Sp.spSignOut();
    window.location.href = "login.html";
  });

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  async function renderUsers() {
    const tbody = document.getElementById("userTableBody");
    tbody.innerHTML = "";
    const users = await Sp.spListProfiles();
    users
      .slice()
      .sort((a, b) => String(a.username).localeCompare(String(b.username)))
      .forEach((u) => {
        const displayRole = Sp.effectiveProfileRole(u);
        const tr = document.createElement("tr");
        tr.innerHTML =
          "<td>" +
          escapeHtml(u.username) +
          "</td>" +
          "<td>" +
          escapeHtml(u.email) +
          "</td>" +
          "<td><span class=\"badge-role " +
          escapeHtml(displayRole) +
          "\">" +
          escapeHtml(displayRole) +
          "</span></td>" +
          "<td></td>";
        const td = tr.querySelector("td:last-child");
        const wrap = document.createElement("div");
        wrap.className = "row-actions";
        const edit = document.createElement("button");
        edit.type = "button";
        edit.textContent = "Edit";
        edit.addEventListener("click", () => {
          fillEditForm(u);
        });
        wrap.appendChild(edit);
        td.appendChild(wrap);
        tbody.appendChild(tr);
      });
  }

  syncDeleteButton(null);
  document.getElementById("editRole").addEventListener("change", syncDeleteButtonFromForm);

  document.getElementById("btnDeleteUser").addEventListener("click", async () => {
    const id = document.getElementById("editUserId").value;
    if (!id) {
      flash("Select a user to delete.", false);
      return;
    }
    if (currentProfile && id === currentProfile.id) {
      flash("You cannot delete your own account.", false);
      return;
    }
    const role = document.getElementById("editRole").value;
    if (role === "admin" || Sp.isProfileAdmin({ role, username: document.getElementById("editUsername").value })) {
      flash("Administrator accounts cannot be deleted from here.", false);
      return;
    }
    if (!confirm("Delete this user? They will no longer be able to sign in.")) return;
    try {
      await Sp.spInvokeAdminEdge({ action: "delete_user", userId: id });
      flash("User deleted.", true);
      document.getElementById("editUserForm").reset();
      document.getElementById("editUserId").value = "";
      syncDeleteButton(null);
      await renderUsers();
    } catch (ex) {
      flash(ex.message || "Delete failed.", false);
    }
  });

  document.getElementById("editUserForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = document.getElementById("editUserId").value;
    if (!id) {
      flash("Pick a user with Edit first.", false);
      return;
    }
    const fields = {
      username: document.getElementById("editUsername").value,
      email: document.getElementById("editEmail").value,
      role: document.getElementById("editRole").value,
      newPassword: document.getElementById("editPassword").value
    };
    try {
      await Sp.spAdminSaveUserViaEdge(id, fields);
      flash("User saved.", true);
      document.getElementById("editPassword").value = "";
      await renderUsers();
    } catch (ex) {
      flash(ex.message || "Save failed.", false);
    }
  });

  function loadSiteForm() {
    const c = window.SiteConfig.getSiteConfig();
    document.getElementById("cfgEyebrow").value = c.eyebrow || "";
    document.getElementById("cfgBadge1").value = c.badge1 || "";
    document.getElementById("cfgBadge2").value = c.badge2 || "";
    document.getElementById("cfgBadge3").value = c.badge3 || "";
    document.getElementById("cfgHeroRest").value = c.heroTitleRest || "";
    document.getElementById("cfgHeroSub").value = c.heroSubtitle || "";
    document.getElementById("cfgTab1").value = c.tabOverview || "";
    document.getElementById("cfgTab2").value = c.tabPerformance || "";
    document.getElementById("cfgTab3").value = c.tabReliability || "";
    document.getElementById("cfgTab4").value = c.tabFinops || "";
    document.getElementById("cfgTab5").value = c.tabHistory || "";
  }

  document.getElementById("siteConfigForm").addEventListener("submit", (e) => {
    e.preventDefault();
    window.SiteConfig.saveSiteConfig({
      eyebrow: document.getElementById("cfgEyebrow").value,
      badge1: document.getElementById("cfgBadge1").value,
      badge2: document.getElementById("cfgBadge2").value,
      badge3: document.getElementById("cfgBadge3").value,
      heroTitleRest: document.getElementById("cfgHeroRest").value,
      heroSubtitle: document.getElementById("cfgHeroSub").value,
      tabOverview: document.getElementById("cfgTab1").value,
      tabPerformance: document.getElementById("cfgTab2").value,
      tabReliability: document.getElementById("cfgTab3").value,
      tabFinops: document.getElementById("cfgTab4").value,
      tabHistory: document.getElementById("cfgTab5").value
    });
    flash("Dashboard copy saved. Open the dashboard to see changes.", true);
  });

  document.getElementById("btnResetSite").addEventListener("click", () => {
    if (!confirm("Reset dashboard copy to factory defaults?")) return;
    window.SiteConfig.resetSiteConfig();
    loadSiteForm();
    flash("Defaults restored.", true);
  });

  await renderUsers();
  loadSiteForm();
}

whenDocumentReady(init);
