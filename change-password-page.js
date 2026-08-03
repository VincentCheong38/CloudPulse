import * as Sp from "./supabase-auth.js";
import { whenDocumentReady } from "./dom-ready.js";
import { guardSupabaseOrHalt } from "./supabase-guard.js";

function showRequiredBanner() {
  const b = document.getElementById("requiredBanner");
  if (!b) return;
  const params = new URLSearchParams(window.location.search);
  if (params.get("required") === "1") {
    b.hidden = false;
    b.textContent =
      "You must set a new password before continuing. Your username stays the same; only the password changes.";
  }
}

async function init() {
  if (!guardSupabaseOrHalt()) return;

  showRequiredBanner();

  try {
    const s = await Sp.spGetSessionProfile();
    if (!s?.session || !s.profile) {
      window.location.replace("login.html?next=change-password.html");
      return;
    }
    document.getElementById("backLink").href = Sp.isProfileAdmin(s.profile) ? "admin.html" : "index.html";
    wireFormSupabase(s.profile);
  } catch (e) {
    console.error(e);
    window.location.replace("login.html?next=change-password.html");
  }
}

function wireFormSupabase(profile) {
  const err = document.getElementById("authError");
  const ok = document.getElementById("authOk");
  const required = new URLSearchParams(window.location.search).get("required") === "1";
  const email = profile.email;
  document.getElementById("pwForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    err.classList.remove("visible");
    ok.classList.remove("visible");
    const current = document.getElementById("currentPw").value;
    const a = document.getElementById("newPw").value;
    const b = document.getElementById("newPw2").value;
    if (a !== b) {
      err.textContent = "New passwords do not match.";
      err.classList.add("visible");
      return;
    }
    try {
      await Sp.spChangeOwnPassword(email, current, a);
      if (required) {
        window.location.replace(Sp.isProfileAdmin(profile) ? "admin.html" : "index.html");
        return;
      }
      ok.textContent = "Password updated. You can continue working.";
      ok.classList.add("visible");
      document.getElementById("pwForm").reset();
    } catch (ex) {
      err.textContent = ex.message || "Could not update password.";
      err.classList.add("visible");
    }
  });
}

whenDocumentReady(init);
