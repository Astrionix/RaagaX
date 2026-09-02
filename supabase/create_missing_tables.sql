-- ============================================================================
-- RAAGAX: FIX MISSING TABLES & PREVENT 404s
-- Run this in Supabase SQL Editor to restore library revision sync & affinity
-- ============================================================================

-- 1. USER LIBRARY REVISION SYNC TABLE
CREATE TABLE IF NOT EXISTS public.user_library_state (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    revision BIGINT NOT NULL DEFAULT 1,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.user_library_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own library state" ON public.user_library_state;
CREATE POLICY "Users can manage their own library state"
    ON public.user_library_state FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Enable Realtime for user_library_state
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_library_state;

-- 2. USER ARTIST AFFINITY TABLE
CREATE TABLE IF NOT EXISTS public.user_artist_affinity (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    artist_id TEXT NOT NULL,
    score FLOAT NOT NULL DEFAULT 1.0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, artist_id)
);

ALTER TABLE public.user_artist_affinity ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their artist affinity" ON public.user_artist_affinity;
CREATE POLICY "Users can manage their artist affinity"
    ON public.user_artist_affinity FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 3. USER LANGUAGE AFFINITY TABLE
CREATE TABLE IF NOT EXISTS public.user_language_affinity (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    language TEXT NOT NULL,
    score FLOAT NOT NULL DEFAULT 1.0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, language)
);

ALTER TABLE public.user_language_affinity ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their language affinity" ON public.user_language_affinity;
CREATE POLICY "Users can manage their language affinity"
    ON public.user_language_affinity FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 4. USER GENRE AFFINITY TABLE
CREATE TABLE IF NOT EXISTS public.user_genre_affinity (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    genre TEXT NOT NULL,
    score FLOAT NOT NULL DEFAULT 1.0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, genre)
);

ALTER TABLE public.user_genre_affinity ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their genre affinity" ON public.user_genre_affinity;
CREATE POLICY "Users can manage their genre affinity"
    ON public.user_genre_affinity FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 5. RELOAD POSTGREST SCHEMA CACHE
NOTIFY pgrst, 'reload schema';
