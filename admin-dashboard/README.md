# Raaga Admin Dashboard

Live real-time user playback telemetry and session monitoring for RaagaX.

## Security & Authentication

The dashboard uses **Supabase Authentication** coupled with **PostgreSQL Row-Level Security (RLS)**:
- **No hardcoded secrets or PINs**: Access requires an authenticated Supabase user session.
- **Role-based policies**:
  - Anonymous mobile/desktop clients can insert and update their own active playback status via public anon key.
  - Telemetry logs, global user feeds, batch cleanup of stale sessions, and deletions are strictly governed by Supabase RLS.
- **Session Persistence**: Sessions persist in the browser and automatically refresh JWT access tokens.
- **Password & Magic Link Support**: Administrators can log in using either email/password or passwordless OTP magic links.

---

## 1. Supabase Database Setup & RLS

1. Open your project in the [Supabase Dashboard](https://supabase.com/dashboard).
2. Go to the **SQL Editor**.
3. Open and run [`supabase_schema_and_rls.sql`](./supabase_schema_and_rls.sql).
   - Enables RLS on `public.user_activity`.
   - Sets up permissive INSERT/UPDATE policies for anonymous music client telemetry.
   - Sets up authenticated management policies for the admin dashboard.
   - Activates Realtime publication on `public.user_activity`.

---

## 2. Creating an Admin User

1. In Supabase Dashboard, navigate to **Authentication** -> **Users**.
2. Click **Add User** -> **Create User**.
3. Enter your admin email (e.g. `admin@raaga.me`) and a secure password.
4. Check **Auto Confirm User?** to bypass email confirmation if desired.
5. Use these credentials in the login dialog at `admin-dashboard/index.html` (or on your custom domain).

---

## 3. Deployment

### Option A: Cloudflare Worker with Wrangler
```bash
cd admin-dashboard
npx wrangler deploy
```

### Option B: Cloudflare Workers Web Dashboard (Single File)
1. Copy the contents of [`cloudflare-worker-standalone.js`](./cloudflare-worker-standalone.js).
2. Paste into the Cloudflare Worker web editor.
3. Deploy and attach to your custom route (e.g., `admin.raaga.me`).
