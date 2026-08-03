import { supabase, isSupabaseConfigured, SUPABASE_URL, SUPABASE_ANON_KEY } from "./supabase-client.js";

export { isSupabaseConfigured, supabase };

/** True for role admin or reserved bootstrap username "admin" (blocked for normal registration). */
export function isProfileAdmin(profile) {
  if (!profile) return false;
  if (profile.role === "admin") return true;
  return String(profile.username || "").trim().toLowerCase() === "admin";
}

export function effectiveProfileRole(profile) {
  return isProfileAdmin(profile) ? "admin" : "user";
}

export async function spGetSessionProfile() {
  if (!supabase) return null;
  const {
    data: { session },
    error: sErr
  } = await supabase.auth.getSession();
  if (sErr || !session) return null;
  const { data: profile, error: pErr } = await supabase
    .from("profiles")
    .select("id, username, email, role, created_at, must_change_password")
    .eq("id", session.user.id)
    .maybeSingle();
  if (pErr) throw pErr;
  return { session, profile };
}

export async function spSignIn(email, password) {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw error;
  const { data: profile, error: pErr } = await supabase
    .from("profiles")
    .select("id, username, email, role, must_change_password")
    .eq("id", data.user.id)
    .maybeSingle();
  if (pErr) throw pErr;
  if (!profile) {
    throw new Error(
      "Your account signed in, but no row exists in public.profiles. Run supabase/schema.sql in the Supabase SQL editor (including the auth trigger), then try again or re-register."
    );
  }
  return { user: data.user, profile };
}

export async function spSignInWithUsername(username, password) {
  if (!supabase) throw new Error("Supabase is not configured.");
  const u = String(username || "").trim();
  if (!u) throw new Error("Enter your username.");
  const { data: email, error: rErr } = await supabase.rpc("get_email_for_username_login", { p_username: u });
  if (rErr) {
    const msg = String(rErr.message || rErr);
    if (/could not find the function|schema cache|pgrst/i.test(msg)) {
      throw new Error(
        "Database function get_email_for_username_login is missing. In Supabase → SQL, run the file " +
          "supabase/fix-username-login-rpc.sql (or the RPC section in supabase/schema.sql), wait a few seconds, then try again."
      );
    }
    throw rErr;
  }
  if (!email || typeof email !== "string") {
    throw new Error("Invalid username or password.");
  }
  return spSignIn(email, password);
}

export async function spSignUp(email, password, username) {
  if (!supabase) throw new Error("Supabase is not configured.");
  if (String(username || "").trim().toLowerCase() === "admin") {
    throw new Error('Username "admin" is reserved for the built-in administrator.');
  }
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: {
      data: { username: username.trim() }
    }
  });
  if (error) throw error;
  return data;
}

export async function spSignOut() {
  if (!supabase) return;
  await supabase.auth.signOut();
}

export async function spChangeOwnPassword(currentEmail, currentPassword, newPassword) {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { error: vErr } = await supabase.auth.signInWithPassword({
    email: currentEmail.trim(),
    password: currentPassword
  });
  if (vErr) throw new Error("Current password is incorrect.");
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
  const {
    data: { session }
  } = await supabase.auth.getSession();
  if (session?.user?.id) {
    const { error: pErr } = await supabase
      .from("profiles")
      .update({ must_change_password: false })
      .eq("id", session.user.id);
    if (pErr) console.warn("[CloudPulse] Could not clear must_change_password on profile:", pErr);
  }
}

export async function spListProfiles() {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, email, role, created_at, must_change_password")
    .order("username", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function spUpdateProfileRow(userId, { username, email, role }) {
  if (!supabase) throw new Error("Supabase is not configured.");
  const patch = {};
  if (username !== undefined) patch.username = username.trim();
  if (email !== undefined) patch.email = email.trim().toLowerCase();
  if (role !== undefined) patch.role = role;
  const { error } = await supabase.from("profiles").update(patch).eq("id", userId);
  if (error) throw error;
}

export async function spAdminSaveUserViaEdge(userId, { username, email, role, newPassword }) {
  return spInvokeAdminEdge({
    action: "update_user",
    userId,
    username,
    email,
    role,
    password: newPassword && String(newPassword).trim() ? String(newPassword).trim() : undefined
  });
}

export async function spInvokeAdminEdge(body) {
  if (!supabase) throw new Error("Supabase is not configured.");
  const {
    data: { session }
  } = await supabase.auth.getSession();
  if (!session) throw new Error("Not signed in.");
  const fnUrl = `${SUPABASE_URL.replace(/\/$/, "")}/functions/v1/admin-user`;
  const res = await fetch(fnUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY
    },
    body: JSON.stringify(body)
  });
  let json = {};
  try {
    json = await res.json();
  } catch {
    /* ignore */
  }
  if (!res.ok) {
    throw new Error(json.error || json.message || `Admin API failed (${res.status})`);
  }
  return json;
}
