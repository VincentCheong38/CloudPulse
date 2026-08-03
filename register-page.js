import * as Sp from "./supabase-auth.js";
import { whenDocumentReady } from "./dom-ready.js";
import { guardSupabaseOrHalt } from "./supabase-guard.js";

async function init() {
  if (!guardSupabaseOrHalt()) return;

  const form = document.getElementById("registerForm");
  const err = document.getElementById("authError");
  const ok = document.getElementById("authSuccess");

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
      console.warn("[CloudPulse] Auth session without profiles row. Signing out.");
      await Sp.spSignOut();
    }
  } catch (e) {
    console.warn("[CloudPulse] Optional session check failed (ignored):", e);
  }

  function showError(message) {
    ok.classList.remove("visible");
    err.textContent = message;
    err.classList.add("visible");
  }

  function showSuccess(message) {
    err.classList.remove("visible");
    ok.textContent = message;
    ok.classList.add("visible");
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    err.classList.remove("visible");
    ok.classList.remove("visible");
    const username = document.getElementById("username").value;
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    const password2 = document.getElementById("password2").value;
    if (username.trim().toLowerCase() === "admin") {
      showError('Username "admin" is reserved for the built-in administrator.');
      return;
    }
    if (password !== password2) {
      showError("Passwords do not match.");
      return;
    }
    try {
      const data = await Sp.spSignUp(email, password, username);
      if (data.session) {
        showSuccess("Account created. Redirecting to sign in…");
        setTimeout(() => {
          window.location.href = "login.html?registered=1";
        }, 600);
      } else {
        showSuccess("Check your email to confirm your account, then sign in with your username.");
      }
    } catch (ex) {
      showError(ex.message || "Unable to register.");
    }
  });
}

whenDocumentReady(init);
