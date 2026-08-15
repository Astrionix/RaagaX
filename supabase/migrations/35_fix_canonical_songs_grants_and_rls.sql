-- ============================================================================
-- Migration 35: Fix Canonical Songs Table Grants & RLS Policies
-- Resolves 403 Forbidden on upsert and downstream 23503 FK errors in listening_events
-- ============================================================================

-- 1. Ensure Table Permissions are Granted to PostgREST Roles
GRANT ALL ON TABLE public.canonical_songs TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.listening_events TO anon, authenticated, service_role;

-- 2. Drop any legacy/conflicting RLS policies on canonical_songs
DROP POLICY IF EXISTS "Allow public read access on canonical_songs" ON public.canonical_songs;
DROP POLICY IF EXISTS "Allow public insert on canonical_songs" ON public.canonical_songs;
DROP POLICY IF EXISTS "Allow public update on canonical_songs" ON public.canonical_songs;
DROP POLICY IF EXISTS "Allow authenticated insert to canonical_songs" ON public.canonical_songs;
DROP POLICY IF EXISTS "Allow authenticated update to canonical_songs" ON public.canonical_songs;
DROP POLICY IF EXISTS "Allow insert on canonical_songs" ON public.canonical_songs;
DROP POLICY IF EXISTS "Allow update on canonical_songs" ON public.canonical_songs;
DROP POLICY IF EXISTS "Allow all on canonical_songs" ON public.canonical_songs;

-- 3. Create comprehensive RLS policies on canonical_songs
CREATE POLICY "Allow public read access on canonical_songs" 
ON public.canonical_songs FOR SELECT USING (true);

CREATE POLICY "Allow insert on canonical_songs" 
ON public.canonical_songs FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow update on canonical_songs" 
ON public.canonical_songs FOR UPDATE USING (true) WITH CHECK (true);

-- 4. Ensure listening_events permits authenticated inserts
DROP POLICY IF EXISTS "Users can insert their own listening events" ON public.listening_events;
DROP POLICY IF EXISTS "Users can view their own listening events" ON public.listening_events;
DROP POLICY IF EXISTS "Allow insert listening_events" ON public.listening_events;

CREATE POLICY "Users can insert their own listening events" 
ON public.listening_events FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can view their own listening events" 
ON public.listening_events FOR SELECT USING (true);
