import { isSupabaseConfigured } from "./supabase-client.js";

const MESSAGE =
  "<section class=\"card auth-card\" style=\"max-width:520px;margin:40px auto;padding:28px;\">" +
  "<h1 style=\"margin:0 0 10px;font-size:1.35rem;\">Supabase is required</h1>" +
  "<p class=\"subtitle\" style=\"margin:0 0 16px;line-height:1.5;\">CloudPulse stores all accounts in Supabase. " +
  "Copy <code>supabase-keys.example.js</code> to <code>supabase-keys.js</code>, add your <strong>Project URL</strong> and " +
  "<strong>anon key</strong> from Supabase → Settings → API, then refresh this page.</p>" +
  "<p style=\"margin:0;font-size:0.88rem;color:#90a4c8;\">Run <code>supabase/schema.sql</code> in the SQL editor and follow <code>supabase/seed-admin.sql</code> for the built-in admin account.</p>" +
  "</section>";

/**
 * If Supabase is not configured, replace the main layout with instructions and return false.
 */
export function guardSupabaseOrHalt() {
  if (isSupabaseConfigured()) return true;
  const root =
    document.querySelector(".auth-shell") ||
    document.querySelector(".admin-layout") ||
    document.querySelector("main.page") ||
    document.body;
  root.innerHTML = MESSAGE;
  return false;
}
