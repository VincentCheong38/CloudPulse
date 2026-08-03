import * as Sp from "./supabase-auth.js";
import { whenDocumentReady } from "./dom-ready.js";
import { guardSupabaseOrHalt } from "./supabase-guard.js";

function formatLoginError(ex) {
  const raw = (ex && (ex.message || ex.error_description || String(ex))) || "";
  const m = raw.toLowerCase();
  if (m.includes("invalid login") || m.includes("invalid credentials")) {
    return "Invalid username or password.";
  }
  return raw || "Unable to sign in.";
}

function afterSuccessfulLogin(profile, next) {
  const mustChange = Boolean(profile.must_change_password);
  if (mustChange) {
    window.location.replace("change-password.html?required=1");
    return;
  }
  if (Sp.isProfileAdmin(profile)) {
    window.location.replace("admin.html");
    return;
  }
  const dest = next && next !== "admin.html" ? next : "index.html";
  window.location.replace(dest);
}

async function init() {
  if (!guardSupabaseOrHalt()) return;

  const err = document.getElementById("authError");
  const ok = document.getElementById("authOk");
  const form = document.getElementById("loginForm");

  try {
    const s = await Sp.spGetSessionProfile();
    if (s?.session && s.profile) {
      if (s.profile.must_change_password) {
        window.location.replace("change-password.html?required=1");
        return;
      }
      window.location.replace(Sp.isProfileAdmin(s.profile) ? "admin.html" : "index.html");
      return;
    }
    if (s?.session && !s.profile) {
      console.warn("[CloudPulse] Auth session without profiles row—signing out. Run supabase/schema.sql.");
      await Sp.spSignOut();
    }
  } catch (e) {
    console.warn("[CloudPulse] Optional session check failed (ignored):", e);
  }

  const reg = new URLSearchParams(window.location.search).get("registered");
  if (reg === "1") {
    ok.textContent = "Registration complete. Sign in with your username and password.";
    ok.classList.add("visible");
  }

  function showError(message) {
    err.textContent = message;
    err.classList.add("visible");
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    err.classList.remove("visible");
    const params = new URLSearchParams(window.location.search);
    const next = params.get("next");
    const username = document.getElementById("loginUsername").value.trim();
    const password = document.getElementById("password").value;

    try {
      const { profile } = await Sp.spSignInWithUsername(username, password);
      afterSuccessfulLogin(profile, next);
    } catch (ex) {
      showError(formatLoginError(ex));
    }
  });
}

whenDocumentReady(init);
