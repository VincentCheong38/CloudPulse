let keysMod;
try {
  keysMod = await import("./supabase-keys.js");
} catch {
  keysMod = await import("./supabase-keys.example.js");
}

const url = String(keysMod.SUPABASE_URL || "").trim();
const key = String(keysMod.SUPABASE_ANON_KEY || "").trim();

function keysLookValid() {
  return Boolean(
    url &&
      key &&
      url.startsWith("https://") &&
      url.includes(".supabase.co") &&
      key.startsWith("eyJ") &&
      key.length > 100
  );
}

export const SUPABASE_URL = url;
export const SUPABASE_ANON_KEY = key;

export let supabase = null;

if (keysLookValid()) {
  try {
    let createClientFn;
    try {
      const mod = await import("https://esm.sh/@supabase/supabase-js@2");
      createClientFn = mod.createClient;
    } catch {
      const mod = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm");
      createClientFn = mod.createClient;
    }
    supabase = createClientFn(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: localStorage,
        storageKey: "cloudpulse_sb_auth"
      }
    });
  } catch (e) {
    console.warn(
      "[CloudPulse] Could not load @supabase/supabase-js from CDN. Check network or use local auth only.",
      e
    );
  }
}

/** True only when the browser client initialized (keys valid + SDK loaded). */
export function isSupabaseConfigured() {
  return supabase !== null;
}
