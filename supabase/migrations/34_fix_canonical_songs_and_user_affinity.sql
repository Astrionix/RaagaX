-- ============================================================================
-- Migration 34: Fix Canonical Songs RLS, User Events & Affinity Foreign Keys
-- ============================================================================

-- 1. Canonical Songs: Allow authenticated and public clients to insert/update catalog entries
DROP POLICY IF EXISTS "Allow public read access on canonical_songs" ON public.canonical_songs;
DROP POLICY IF EXISTS "Allow public insert on canonical_songs" ON public.canonical_songs;
DROP POLICY IF EXISTS "Allow public update on canonical_songs" ON public.canonical_songs;
DROP POLICY IF EXISTS "Allow authenticated insert to canonical_songs" ON public.canonical_songs;
DROP POLICY IF EXISTS "Allow authenticated update to canonical_songs" ON public.canonical_songs;
DROP POLICY IF EXISTS "Allow insert on canonical_songs" ON public.canonical_songs;
DROP POLICY IF EXISTS "Allow update on canonical_songs" ON public.canonical_songs;

CREATE POLICY "Allow public read access on canonical_songs" 
ON public.canonical_songs FOR SELECT USING (true);

CREATE POLICY "Allow insert on canonical_songs" 
ON public.canonical_songs FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow update on canonical_songs" 
ON public.canonical_songs FOR UPDATE USING (true);

-- 2. User Events: Ensure FK references auth.users(id) and RLS is solid
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'user_events_user_id_fkey') THEN
    ALTER TABLE public.user_events DROP CONSTRAINT user_events_user_id_fkey;
  END IF;
END $$;

ALTER TABLE public.user_events
  ADD CONSTRAINT user_events_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 3. User Artist Affinity: Ensure columns and auth.users(id) FK
ALTER TABLE public.user_artist_affinity
  ADD COLUMN IF NOT EXISTS like_count INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS play_count INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'user_artist_affinity_user_id_fkey') THEN
    ALTER TABLE public.user_artist_affinity DROP CONSTRAINT user_artist_affinity_user_id_fkey;
  END IF;
END $$;

ALTER TABLE public.user_artist_affinity
  ADD CONSTRAINT user_artist_affinity_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 4. User Genre & Language Affinity: Ensure auth.users(id) FK
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'user_genre_affinity_user_id_fkey') THEN
    ALTER TABLE public.user_genre_affinity DROP CONSTRAINT user_genre_affinity_user_id_fkey;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'user_language_affinity_user_id_fkey') THEN
    ALTER TABLE public.user_language_affinity DROP CONSTRAINT user_language_affinity_user_id_fkey;
  END IF;
END $$;

ALTER TABLE public.user_genre_affinity
  ADD CONSTRAINT user_genre_affinity_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.user_language_affinity
  ADD CONSTRAINT user_language_affinity_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
