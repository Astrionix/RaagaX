-- ==============================================================================
-- RaagaX Telemetry & Admin Dashboard: Supabase Schema & Row-Level Security (RLS)
-- ==============================================================================
-- Execute this script in your Supabase SQL Editor (https://supabase.com/dashboard/project/_/sql)
-- to secure the `user_activity` table and establish authentic Admin RBAC.
-- ==============================================================================

-- 1. Ensure required extensions exist
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Create the `user_activity` table if it doesn't already exist
CREATE TABLE IF NOT EXISTS public.user_activity (
    user_tag TEXT PRIMARY KEY,
    user_name TEXT DEFAULT '',
    song_title TEXT DEFAULT '',
    artist TEXT DEFAULT '',
    video_id TEXT DEFAULT '',
    cover_url TEXT DEFAULT '',
    album_name TEXT DEFAULT '',
    duration_text TEXT DEFAULT '',
    is_playing BOOLEAN DEFAULT false,
    joined_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- 3. Performance Indexes for Realtime Queries & Filters
CREATE INDEX IF NOT EXISTS idx_user_activity_user_tag ON public.user_activity(user_tag);
CREATE INDEX IF NOT EXISTS idx_user_activity_updated_at ON public.user_activity(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_activity_is_playing ON public.user_activity(is_playing);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.user_activity ENABLE ROW LEVEL SECURITY;

-- Clean up any legacy or duplicate policies before applying
DROP POLICY IF EXISTS "Allow anon insert user activity" ON public.user_activity;
DROP POLICY IF EXISTS "Allow anon update user activity" ON public.user_activity;
DROP POLICY IF EXISTS "Allow anon select friends user activity" ON public.user_activity;
DROP POLICY IF EXISTS "Allow authenticated admin all activity" ON public.user_activity;
DROP POLICY IF EXISTS "Allow admin select user activity" ON public.user_activity;
DROP POLICY IF EXISTS "Allow admin delete user activity" ON public.user_activity;
DROP POLICY IF EXISTS "Allow admin update user activity" ON public.user_activity;

-- ==============================================================================
-- 5. Row-Level Security Policies
-- ==============================================================================

-- Policy A: Allow anonymous mobile & desktop clients to report playback presence (Insert / Upsert)
CREATE POLICY "Allow anon insert user activity"
    ON public.user_activity
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

-- Policy B: Allow anonymous mobile & desktop clients to update their playback presence
CREATE POLICY "Allow anon update user activity"
    ON public.user_activity
    FOR UPDATE
    TO anon, authenticated
    USING (true)
    WITH CHECK (true);

-- Policy C: Allow mobile and desktop clients to read friend playback states
-- (Required for in-app social activity / friend presence feed)
CREATE POLICY "Allow anon select friends user activity"
    ON public.user_activity
    FOR SELECT
    TO anon, authenticated
    USING (true);

-- Policy D: Full administrative rights (SELECT, UPDATE, DELETE) for authenticated Admin users
-- Only authenticated users logged in through Supabase Auth can batch-clean stale sessions or delete records
CREATE POLICY "Allow authenticated admin all activity"
    ON public.user_activity
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- ==============================================================================
-- Optional: Restrict Admin Management to Specific Admin Email Addresses
-- Uncomment below if you only want designated admin emails to access the dashboard:
-- ==============================================================================
/*
DROP POLICY IF EXISTS "Allow authenticated admin all activity" ON public.user_activity;
CREATE POLICY "Allow specific admin users all activity"
    ON public.user_activity
    FOR ALL
    TO authenticated
    USING (auth.jwt() ->> 'email' IN ('admin@raaga.me', 'owner@raaga.me'))
    WITH CHECK (auth.jwt() ->> 'email' IN ('admin@raaga.me', 'owner@raaga.me'));
*/

-- ==============================================================================
-- 6. Enable Realtime Broadcasting
-- ==============================================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'user_activity'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.user_activity;
    END IF;
END $$;

-- ==============================================================================
-- 7. Deduplication Trigger: Automatically Prevent Duplicate User Entries on App Updates
-- ==============================================================================
-- When a user updates their app or logs in with a new session, this trigger automatically
-- preserves their earliest joined_at date and deletes previous duplicate rows for that user.
CREATE OR REPLACE FUNCTION public.clean_duplicate_user_activity()
RETURNS TRIGGER AS $$
DECLARE
    min_joined TIMESTAMPTZ;
BEGIN
    IF NEW.user_name IS NOT NULL 
       AND TRIM(NEW.user_name) <> '' 
       AND NOT (NEW.user_name ILIKE 'Listener %') 
       AND LOWER(TRIM(NEW.user_name)) <> 'guest' THEN
       
        -- Carry over earliest authentic joined_at if older session existed
        SELECT MIN(joined_at) INTO min_joined
        FROM public.user_activity
        WHERE LOWER(TRIM(user_name)) = LOWER(TRIM(NEW.user_name))
          AND user_tag <> NEW.user_tag;
          
        IF min_joined IS NOT NULL AND (NEW.joined_at IS NULL OR min_joined < NEW.joined_at) THEN
            NEW.joined_at := min_joined;
        END IF;

        -- Purge stale duplicate entries for this registered user
        DELETE FROM public.user_activity
        WHERE LOWER(TRIM(user_name)) = LOWER(TRIM(NEW.user_name))
          AND user_tag <> NEW.user_tag;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_clean_duplicate_user_activity ON public.user_activity;
CREATE TRIGGER trg_clean_duplicate_user_activity
    BEFORE INSERT OR UPDATE ON public.user_activity
    FOR EACH ROW
    EXECUTE FUNCTION public.clean_duplicate_user_activity();

-- ==============================================================================
-- 8. One-Time Maintenance Script: Clean Existing Duplicates in SQL Editor
-- ==============================================================================
-- If you have historical duplicate user records in your database, execute this:
/*
WITH RankedUsers AS (
    SELECT 
        user_tag,
        user_name,
        joined_at,
        updated_at,
        ROW_NUMBER() OVER (
            PARTITION BY LOWER(TRIM(user_name)) 
            ORDER BY updated_at DESC
        ) as rn,
        MIN(joined_at) OVER (
            PARTITION BY LOWER(TRIM(user_name))
        ) as earliest_joined
    FROM public.user_activity
    WHERE user_name IS NOT NULL 
      AND TRIM(user_name) <> '' 
      AND NOT (user_name ILIKE 'Listener %')
      AND LOWER(TRIM(user_name)) <> 'guest'
)
-- 1. Preserve earliest joined date on the latest active row
UPDATE public.user_activity u
SET joined_at = r.earliest_joined
FROM RankedUsers r
WHERE u.user_tag = r.user_tag AND r.rn = 1 AND u.joined_at <> r.earliest_joined;

-- 2. Delete older duplicate rows (keeping rn = 1)
DELETE FROM public.user_activity
WHERE user_tag IN (
    SELECT user_tag FROM (
        SELECT user_tag, ROW_NUMBER() OVER (
            PARTITION BY LOWER(TRIM(user_name)) 
            ORDER BY updated_at DESC
        ) as rn
        FROM public.user_activity
        WHERE user_name IS NOT NULL 
          AND TRIM(user_name) <> '' 
          AND NOT (user_name ILIKE 'Listener %')
          AND LOWER(TRIM(user_name)) <> 'guest'
    ) sub WHERE sub.rn > 1
);
*/

-- ==============================================================================
-- 9. How to Create an Admin User in Supabase
-- ==============================================================================
-- 1. Go to your Supabase Dashboard: https://supabase.com/dashboard
-- 2. Navigate to: Authentication -> Users
-- 3. Click "Add User" -> "Create User"
-- 4. Enter your admin email (e.g. admin@raaga.me) and a strong password.
-- 5. Confirm email automatically (check "Auto Confirm").
-- 6. Use these credentials to sign into the Raaga Admin Dashboard!
-- ==============================================================================
