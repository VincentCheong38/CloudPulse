# CloudPulse: Full guide — linking Supabase for users and admins

This guide explains how to connect your CloudPulse app to **Supabase** so **admin** and **user** accounts (and related profile data) live in a real database with secure authentication. It assumes you keep the current **HTML + vanilla JavaScript** structure and replace the demo **`localStorage`** layer with Supabase.

---

## Table of contents

1. [What Supabase will replace](#1-what-supabase-will-replace)
2. [Architecture overview](#2-architecture-overview)
3. [Prerequisites](#3-prerequisites)
4. [Step 1 — Create a Supabase project](#step-1--create-a-supabase-project)
5. [Step 2 — Enable Auth and configure URLs](#step-2--enable-auth-and-configure-urls)
6. [Step 3 — Create the database schema](#step-3--create-the-database-schema)
7. [Step 4 — Row Level Security (RLS) policies](#step-4--row-level-security-rls-policies)
8. [Step 5 — Create the first admin](#step-5--create-the-first-admin)
9. [Step 6 — Add the Supabase client (detailed)](#step-6--add-the-supabase-client-to-your-site-detailed)
10. [Step 7 — Map screens to Supabase (detailed)](#step-7--map-screens-to-supabase-detailed)
11. [Step 8 — Admin: changing other users (detailed)](#step-8--admin-changing-other-users-detailed)
12. [Step 9 — Deploy and environment variables (detailed)](#step-9--deploy-and-environment-variables-detailed)
13. [Step 10 — Retire demo localStorage auth (detailed)](#step-10--retire-demo-localstorage-auth-detailed)
14. [Security checklist](#security-checklist)
15. [Troubleshooting](#troubleshooting)

---

## 1. What Supabase will replace

| Current (demo) | With Supabase |
|----------------|---------------|
| Users in `localStorage` (`cloudpulse_users`) | `auth.users` + `public.profiles` |
| Passwords encoded in the browser | **Supabase Auth** (hashed server-side) |
| Session JSON in `localStorage` | Supabase session (JWT), persisted by the client |
| Admin edits users in the browser only | Admin updates via **RLS + policies** and/or **Edge Functions** with privileged access |

**Important:** Do **not** store plain-text passwords in Postgres. Always use **`auth.signUp` / `signInWithPassword` / `updateUser({ password })`**.

---

## 2. Architecture overview

```text
Browser (your HTML/JS)
    │
    │  HTTPS + anon key (public)
    ▼
Supabase API
    ├── Auth service     → sign up, sign in, sessions, password reset
    └── Postgres         → profiles (username, role, …)
            └── RLS      → who can read/update which rows
```

- **Normal users:** JS uses the **`anon`** key; Postgres **RLS** ensures users only touch their own data (unless policy allows more).
- **Admin actions on other users:** Prefer a **Supabase Edge Function** (or small Node server) that uses the **service role** key **only on the server**, never in the browser.

---

## 3. Prerequisites

- A Supabase account ([supabase.com](https://supabase.com)).
- Your site served over **HTTPS** (Supabase Auth and cookies work reliably; `file://` is problematic).
- Basic familiarity with SQL and JavaScript `async`/`await`.

---

## Step 1 — Create a Supabase project

1. Log in to the [Supabase Dashboard](https://supabase.com/dashboard).
2. Click **New project**.
3. Choose **organization**, **name**, **database password** (save it), **region** (closest to your users).
4. Wait until the project shows **Healthy**.

You will need:

- **Project URL** — *Settings → API → Project URL*
- **`anon` `public` key** — *Settings → API → Project API keys → anon*

Never expose the **`service_role`** key in frontend code.

---

## Step 2 — Enable Auth and configure URLs

1. Go to **Authentication → Providers**.
2. Ensure **Email** is enabled (default for email + password).
3. **Authentication → URL configuration**
   - **Site URL:** your production origin, e.g. `https://yourdomain.com`
   - **Redirect URLs:** add any paths you use for email confirmation or magic links, e.g.  
     `https://yourdomain.com/**` and `http://localhost:5173/**` for local dev.

4. **Authentication → Email templates** (optional)  
   Customize confirmation / reset emails.

**Email confirmation:** Under **Authentication → Providers → Email**, you can require email confirmation before first sign-in. For development you may **disable** confirm email to test faster; re-enable for production.

---

## Step 3 — Create the database schema

Supabase already has **`auth.users`**. You add a **`public.profiles`** table (or `app_users`) keyed by the same `id` as `auth.users.id`.

Open **SQL Editor → New query** and run:

```sql
-- Profiles: one row per auth user
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null,
  role text not null default 'user'
    check (role in ('admin', 'user')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One username across the app (case-sensitive; you can switch to citext extension if you prefer)
create unique index profiles_username_lower on public.profiles (lower(username));

-- Keep updated_at in sync (optional but useful)
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();
```

### Auto-create profile when a user signs up

Run:

```sql
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    coalesce((new.raw_user_meta_data->>'role')::text, 'user')
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();
```

**Notes:**

- `raw_user_meta_data->>'username'` is filled if you pass `options.data.username` in `signUp` from the client.
- Default **`role`** is **`user`**. Your **first admin** should be promoted manually (see Step 5) so random sign-ups are never admin by default.

---

## Step 4 — Row Level Security (RLS) policies

Enable RLS and add policies:

```sql
alter table public.profiles enable row level security;

-- Anyone signed in can read their own profile
create policy "profiles_select_own"
on public.profiles for select
using (auth.uid() = id);

-- Users can update only their own row (username etc., not role — see below)
create policy "profiles_update_own"
on public.profiles for update
using (auth.uid() = id)
with check (auth.uid() = id);

-- Optional: allow insert only via trigger (recommended) — no insert policy for anon
-- The trigger above runs as SECURITY DEFINER and bypasses RLS for the insert from auth.users
```

**Role changes (admin promotes/demotes users):**

- **Option A (simple):** Do **not** let clients update `role` via RLS. Only an **Edge Function** (service role) updates `role`.
- **Option B (RLS only):** Add a policy allowing `update` when `exists (select 1 from public.profiles me where me.id = auth.uid() and me.role = 'admin')` **and** carefully restrict which columns can change (harder in pure RLS).

For production, **Option A** is clearer and safer.

Example policy if admins may read all profiles from the client (optional; often you still use a function for listing):

```sql
create policy "profiles_select_all_if_admin"
on public.profiles for select
using (
  exists (
    select 1 from public.profiles me
    where me.id = auth.uid() and me.role = 'admin'
  )
);
```

Combine with your product rules (e.g. hide emails if you don’t store them in `profiles`).

---

## Step 5 — Create the first admin

After **you** sign up once (or create a user in **Authentication → Users**):

1. **Authentication → Users** — copy the user’s **UUID**.
2. **SQL Editor:**

```sql
update public.profiles
set role = 'admin'
where id = 'PASTE-USER-UUID-HERE';
```

From then on, use **admin-only** paths (Edge Function) to create more admins if needed.

---

## Step 6 — Add the Supabase client to your site (detailed)

This section answers: **where** to create files, **what** to put in them, and **how** the browser loads them—for your **CloudPulse** layout (flat HTML + JS next to `index.html`).

### 6.1 Where to create `supabase-client.js`

For this project, the natural place is the **same folder as `index.html`**, i.e. your **project root**:

```text
CloudTest/
  index.html
  login.html
  register.html
  admin.html
  change-password.html
  auth.js
  app.js
  styles.css
  auth-pages.css
  supabase-client.js    ← create this file here
```

**Why the root?** Your pages load scripts with paths like `src="auth.js"`. A sibling file `src="supabase-client.js"` works the same way and keeps imports simple.

**Optional alternative:** a subfolder, e.g. `js/supabase-client.js`. Then every HTML path becomes `src="js/supabase-client.js"` and any other module that imports it must use a **relative URL** (`./js/supabase-client.js` or `../supabase-client.js` depending on location). For a small static site, **root is fine**.

### 6.2 ES modules vs classic scripts (important)

The Supabase JS v2 client is normally used with **`import`**. In HTML, that means:

```html
<script type="module" src="supabase-client.js"></script>
```

**Not** `<script src="supabase-client.js">` without `type="module"`** if the file contains `import` — the browser will throw a syntax error.

**`file://`:** Opening `index.html` directly from disk often **breaks** ES module loading or CORS. Use a local server instead, for example from the project folder:

```bash
cd /path/to/CloudTest
python3 -m http.server 8080
```

Then open `http://localhost:8080/index.html`.

### 6.3 Contents of `supabase-client.js` (Option A — CDN import)

Create **`supabase-client.js`** in the project root with:

```javascript
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Replace with your Project URL and anon key (Dashboard → Settings → API)
const supabaseUrl = "https://YOUR_PROJECT_ID.supabase.co";
const supabaseAnonKey = "YOUR_ANON_PUBLIC_KEY";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

- **`supabaseUrl`:** looks like `https://abcdefghij.supabase.co`.
- **`supabaseAnonKey`:** long JWT string labeled **anon** / **public** — safe to embed in frontend **only** because **RLS** must protect your tables.

**Security:** Avoid committing real keys to Git. Common patterns:

1. **Local override file (gitignored):** keep `supabase-config.local.js` out of Git and import it only on your machine (more setup).
2. **Build step:** a tiny script replaces placeholders in `supabase-client.js` when you deploy.
3. **Vite / bundler:** use `import.meta.env.VITE_SUPABASE_URL` (see Option B below).

Add to **`.gitignore`** (if you ever put secrets in a local file):

```gitignore
supabase-config.local.js
.env
.env.local
```

### 6.4 Using the client from non-module scripts

Your **`login.html`** today uses a normal `<script>` block, not `type="module"`. You have two clean options:

**Pattern 1 — Attach to `window` from one module**

In **`supabase-client.js`**, after `createClient`, also expose globally:

```javascript
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = "https://....supabase.co";
const supabaseAnonKey = "....";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
window.supabase = supabase;
```

In **`login.html`** (order matters):

```html
<script type="module" src="supabase-client.js"></script>
<script>
  window.addEventListener("DOMContentLoaded", async () => {
    if (!window.supabase) {
      console.error("Supabase client not loaded");
      return;
    }
    const { data } = await window.supabase.auth.getSession();
    // ... rest of login logic
  });
</script>
```

**Caveat:** `DOMContentLoaded` may fire before the module finishes. Safer: put login logic **inside** a small bootstrap module **`auth-bootstrap.js`** that imports `./supabase-client.js` and then runs guards/forms.

**Pattern 2 — Single entry module `app-auth.js`**

Create **`app-auth.js`**:

```javascript
import { supabase } from "./supabase-client.js";

async function initLoginPage() {
  const { data: { session } } = await supabase.auth.getSession();
  // ...
}

initLoginPage();
```

In **`login.html`**:

```html
<script type="module" src="app-auth.js"></script>
```

Move all login-related JS from inline `<script>` into **`app-auth.js`** so everything runs after `import` resolves.

### 6.5 Option B — Vite (npm) project (more “production”)

If you later move to Vite:

1. `npm create vite@latest cloudpulse -- --template vanilla`
2. Copy your HTML/JS into `src/` or keep `public/` for static assets.
3. `npm install @supabase/supabase-js`
4. Create **`src/supabase-client.js`**:

```javascript
import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);
```

5. Project root **`.env`** (gitignored):

```env
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
```

6. `npm run dev` → usually `http://localhost:5173`.

Here **`supabase-client.js` lives under `src/`** because Vite resolves modules from there. The **built** site ends up in `dist/` for upload to Netlify/Vercel.

### 6.6 Verify Step 6 works

1. Add **`supabase-client.js`** (root or `src/`).
2. Serve over **HTTP** locally (not `file://`).
3. Open DevTools → **Console** — no import errors.
4. Temporarily run:

```javascript
const { data, error } = await supabase.from("profiles").select("count");
console.log(data, error);
```

(Adjust table name; you may get an RLS error until policies exist — that still proves the client talks to Supabase.)

---

## Step 7 — Map screens to Supabase (detailed)

Assume **`profiles`** has columns: `id`, `username`, `role` (and you use **email** from `auth.users` for sign-in).

### 7.1 `register.html`

1. Keep fields: **email**, **password**, **confirm password**, **username** (display name stored in profile via trigger metadata).
2. On submit, **`await supabase.auth.signUp({...})`** as in the short example below.
3. If **“Confirm email”** is enabled in Supabase:
   - `data.session` may be **`null`** until the user clicks the link.
   - Show: “Check your email to confirm your account,” and **do not** redirect to `index.html` as logged-in.
4. If email confirmation is **off** (dev only), you may get a session immediately; then redirect to **`login.html`** or straight to **`index.html`** per your product choice.

```javascript
const { data, error } = await supabase.auth.signUp({
  email,
  password,
  options: { data: { username: chosenUsername } }
});
if (error) throw error;
```

Your SQL trigger (Step 3) should read `raw_user_meta_data->>'username'` and insert **`profiles`**.

### 7.2 `login.html`

1. **Simplest product change:** label the field **Email** (not “Username”) and use `signInWithPassword({ email, password })`.
2. After a successful sign-in, read **`profiles`** for `role`:

```javascript
const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({ email, password });
if (authErr) throw authErr;

const { data: profile, error: profErr } = await supabase
  .from("profiles")
  .select("role, username")
  .eq("id", authData.user.id)
  .single();

if (profErr) throw profErr;

if (profile.role === "admin") {
  location.href = "admin.html";
} else {
  location.href = "index.html";
}
```

3. **If you insist on “username” on the login form:** first `select` from `profiles` where `username` equals input (requires an RLS policy that allows **anonymous** read — usually **not** desired). Better: store **email** as the login identifier users remember.

### 7.3 `index.html` (dashboard) — session guard

Today you run an inline check with **`Auth.getSession()`**. Replace with **async** Supabase:

```javascript
const { data: { session } } = await supabase.auth.getSession();
if (!session) {
  location.replace("login.html?next=index.html");
}
```

**Placement:** this must run **before** you render sensitive UI. Options:

- One **`<script type="module" src="guard-index.js">`** at the top of `<body>` that only imports `supabase`, awaits `getSession()`, and redirects or continues by injecting the rest of the page (heavier refactor), or
- Keep HTML visible but hide `<main>` until guard passes (flash of content — acceptable with a “Loading…” overlay).

**Optional listener:**

```javascript
supabase.auth.onAuthStateChange((_event, session) => {
  if (!session) location.href = "login.html";
});
```

Put this once on pages that need live sign-out detection.

### 7.4 `admin.html`

1. Same guard as index, but redirect non-admins to **`index.html`** after loading **profile**:

```javascript
const { data: { session } } = await supabase.auth.getSession();
if (!session) {
  location.replace("login.html?next=admin.html");
  return;
}
const { data: profile } = await supabase.from("profiles").select("role").eq("id", session.user.id).single();
if (profile.role !== "admin") {
  location.replace("index.html");
}
```

2. **User list:** either query `profiles` (if RLS allows admins to `select` all — see guide Step 4) or call your **Edge Function** (Step 8) that returns a sanitized list.

### 7.5 `change-password.html`

1. Guard session like above.
2. Optional: verify “current password” with `signInWithPassword({ email: session.user.email, password: current })` before updating.
3. Update password:

```javascript
const { error } = await supabase.auth.updateUser({ password: newPassword });
if (error) throw error;
```

4. **Email change** is different: `updateUser({ email: newEmail })` may require confirmation flow depending on settings.

### 7.6 User bar — sign out (`index.html` / `admin.html`)

Replace **`Auth.logout()`** with:

```javascript
await supabase.auth.signOut();
location.href = "login.html";
```

### 7.7 What to remove or stop using

- Remove **`auth.js`** session writes to `localStorage` for production, or branch: `if (USE_SUPABASE) { ... } else { Auth.login(...) }`.
- **`Auth.applySiteConfigToDashboard()`** can stay until you move site settings to Supabase.

---

## Step 8 — Admin: changing other users (detailed)

### 8.1 Why a server-side path

The browser **`anon`** key is untrusted. Any client could try to call the REST API. **RLS** stops most abuse, but **changing another user’s password or email** is an **Auth Admin** capability and must use the **service role** on a **trusted server**.

### 8.2 Edge Function layout

1. Install Supabase CLI: see [Supabase CLI docs](https://supabase.com/docs/guides/cli).
2. In your project folder: `supabase login`, `supabase link --project-ref YOUR_PROJECT_REF`.
3. `supabase functions new admin-user` — creates something like `supabase/functions/admin-user/index.ts`.

### 8.3 Secrets

In Dashboard: **Project Settings → Edge Functions → Secrets** (or CLI `supabase secrets set`), set:

- `SUPABASE_SERVICE_ROLE_KEY` — **service_role** key (never ship to the browser).

### 8.4 Function logic (outline)

1. Read **`Authorization: Bearer <access_token>`** from the request.
2. Create a Supabase client with **anon key + that JWT** to resolve the user and `profiles.role === 'admin'`.
3. If not admin → **403**.
4. If admin → create a **second** client with **`service_role`** and call `auth.admin.updateUserById`, `deleteUser`, etc., based on a JSON body like `{ "action": "set_password", "userId": "...", "password": "..." }`.

### 8.5 Deploy

```bash
supabase functions deploy admin-user
```

Invoke URL:

```text
https://YOUR_PROJECT_REF.supabase.co/functions/v1/admin-user
```

### 8.6 Browser call (from `admin.html` after refactor)

```javascript
const { data: { session } } = await supabase.auth.getSession();
const res = await fetch(`${supabaseUrl}/functions/v1/admin-user`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${session.access_token}`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({ action: "update_user", userId, email, password })
});
const json = await res.json();
if (!res.ok) throw new Error(json.error || res.statusText);
```

Use your real **`supabaseUrl`** (same as in the client). Handle **CORS**: Supabase Edge Functions can return `Access-Control-Allow-Origin` for your site origin; configure in the function if preflight fails.

---

## Step 9 — Deploy and environment variables (detailed)

### 9.1 Why HTTPS

Supabase Auth refresh tokens and modern cookie policies expect a **secure origin**. Deploy to **HTTPS** before final testing.

### 9.2 Static host examples

| Host | What you set |
|------|----------------|
| **Netlify** | Site settings → **Environment variables**; if using a build command that inlines env into JS, add `VITE_*` or custom `SUPABASE_URL` |
| **Vercel** | Project → **Settings → Environment Variables** |
| **Cloudflare Pages** | **Settings → Environment variables** in the Pages project |

For **pure static** files with **no build step**, you still must get URL/key into `supabase-client.js` — either manual replace at deploy time or a one-line **build script** in CI that runs `envsubst` or `sed`.

### 9.3 Supabase Dashboard alignment

After you know the production URL (e.g. `https://cloudpulse.example.com`):

1. **Authentication → URL configuration → Site URL** = that origin.
2. **Redirect URLs** include `https://cloudpulse.example.com/**`.

### 9.4 Production Auth settings

- Turn **email confirmation** on.
- Review rate limits and captcha options if you expect abuse.

---

## Step 10 — Retire demo `localStorage` auth (detailed)

### 10.1 Order of operations (recommended)

1. Complete Steps 1–5 in Supabase (schema + first admin).
2. Add **`supabase-client.js`** and verify `getSession()` / `signIn` in isolation (Step 6).
3. Migrate **login + register** first (Step 7.1–7.2).
4. Migrate **guards** on `index.html`, `admin.html`, `change-password.html` (Step 7.3–7.4).
5. Migrate **change password** and **sign out** (Step 7.5–7.6).
6. Implement **Edge Function** for admin user maintenance (Step 8); point **`admin.html`** forms at it.
7. Remove **`Auth.ensureSeedAdmin()`** and **`localStorage` user list** from production.
8. Keep or migrate **site copy** (`Auth.applySiteConfigToDashboard`) per Step 10 below.

### 10.2 Splitting code paths (optional during migration)

- **`auth.js`** — rename conceptually to “legacy local demo.”
- **`auth-supabase.js`** — new module: `signInSupabase`, `registerSupabase`, `guardPage`, etc.
- A single flag **`const USE_SUPABASE = true`** in one config file switches behavior while you test.

### 10.3 Site configuration (hero / tabs)

Either:

- Leave **`localStorage`** + `applySiteConfigToDashboard()` for admin-edited copy, or
- Create **`public.site_settings`** (key/value or one JSON row) and load it on `index.html` after session is valid, with RLS so only **admin** can `update`.

---

## Security checklist

- [ ] **`anon` key** only in the client; **`service_role`** only on server/Edge Functions.
- [ ] **RLS enabled** on every user-facing table.
- [ ] **No default admin** credentials in the login UI.
- [ ] **HTTPS** everywhere.
- [ ] **Email confirmation** enabled for production.
- [ ] Rate limiting / abuse considerations (Supabase has some defaults; review Auth settings).
- [ ] **CORS**: Edge Functions and Auth redirect URLs match your real domains.

---

## Troubleshooting

| Issue | What to check |
|-------|----------------|
| `signUp` succeeds but no profile | Trigger `on_auth_user_created` exists; check **Database → Logs** |
| “Invalid API key” | URL and `anon` key from the same project; no stray spaces |
| RLS blocks reads | Policies for `select`; use **Table Editor** with “Run as user” or JWT debugger |
| Session lost on refresh | `getSession()` timing; ensure you await auth before redirecting |
| Email link goes to localhost | **Site URL** and **Redirect URLs** in Auth settings |
| CORS on Edge Function | Function **CORS headers** and allowed origins |

---

## Summary

1. Create **profiles** + **trigger** on `auth.users` for new rows.  
2. Use **Auth** for passwords; store **`role`** and **`username`** in **`profiles`**.  
3. Use **RLS** for self-service; use **Edge Functions + service role** for admin maintenance.  
4. Wire **register / login / logout / change password / guards** to Supabase in your existing pages.  
5. Deploy on **HTTPS** with env-based keys.

When you are ready to implement this in the repo (replace `auth.js` with a Supabase-backed module and optional Edge Function stubs), you can do that as a follow-up task step by step.
