import * as Sp from "./supabase-auth.js";
import { whenDocumentReady } from "./dom-ready.js";
import { guardSupabaseOrHalt } from "./supabase-guard.js";

async function init() {
  if (!guardSupabaseOrHalt()) return;

  const main = document.querySelector(".page");
  if (main) main.style.visibility = "hidden";

  try {
    const s = await Sp.spGetSessionProfile();
    if (!s?.session) {
      window.location.replace("login.html?next=index.html");
      return;
    }
    if (s.profile?.must_change_password) {
      window.location.replace("change-password.html?required=1");
      return;
    }
    const prof = s.profile;
    document.getElementById("userBarName").textContent = prof?.username || s.session.user.email || "";
    document.getElementById("userBarRole").textContent = Sp.isProfileAdmin(prof) ? "Administrator" : "User";
    if (Sp.isProfileAdmin(prof)) {
      document.getElementById("adminLink").hidden = false;
    }
    document.getElementById("logoutBtn").addEventListener("click", async () => {
      await Sp.spSignOut();
      window.location.href = "login.html";
    });

    window.SiteConfig.applySiteConfigToDashboard();
  } catch (e) {
    console.error(e);
    window.location.replace("login.html?next=index.html");
    return;
  }

  if (main) main.style.visibility = "";

  window.CloudPulseHistory?.init();

  await new Promise((resolve, reject) => {
    const t = document.createElement("script");
    t.src = "app.js";
    t.onload = resolve;
    t.onerror = () => reject(new Error("Failed to load app.js"));
    document.body.appendChild(t);
  });
}

whenDocumentReady(init);
