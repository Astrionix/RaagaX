-- ============================================================================
-- RAAGAX LEAN DATABASE SCHEMA (CORE 4 TABLES ONLY)
-- Drop all unwanted background tables and keep only essential cloud data.
-- ============================================================================

-- 1. DROP ALL UNWANTED / BLOAT TABLES
DROP TABLE IF EXISTS public.listening_events CASCADE;
DROP TABLE IF EXISTS public.user_events CASCADE;
DROP TABLE IF EXISTS public.canonical_songs CASCADE;
DROP TABLE IF EXISTS public.dynamic_home_playlists CASCADE;
DROP TABLE IF EXISTS public.recommendation_snapshots CASCADE;
DROP TABLE IF EXISTS public.ai_recommendations CASCADE;
DROP TABLE IF EXISTS public.user_artist_affinity CASCADE;
DROP TABLE IF EXISTS public.user_genre_affinity CASCADE;
DROP TABLE IF EXISTS public.user_language_affinity CASCADE;
DROP TABLE IF EXISTS public.user_languages CASCADE;
DROP TABLE IF EXISTS public.user_artists CASCADE;
DROP TABLE IF EXISTS public.user_preferences CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.recently_played CASCADE;
DROP TABLE IF EXISTS public.user_downloads CASCADE;
DROP TABLE IF EXISTS public.user_favorites CASCADE;
DROP TABLE IF EXISTS public.user_library_state CASCADE;
DROP TABLE IF EXISTS public.device_leases CASCADE;
DROP TABLE IF EXISTS public.devices CASCADE;
DROP TABLE IF EXISTS public.playback_state CASCADE;
DROP TABLE IF EXISTS public.playback_history CASCADE;
DROP TABLE IF EXISTS public.processed_commands CASCADE;
DROP TABLE IF EXISTS public.playback_sessions CASCADE;
DROP TABLE IF EXISTS public.saved_albums CASCADE;
DROP TABLE IF EXISTS public.charts CASCADE;

-- 2. CORE TABLE 1: LIKED SONGS (User Favorites Cloud Sync)
CREATE TABLE IF NOT EXISTS public.liked_songs (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    song_id TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, song_id)
);

ALTER TABLE public.liked_songs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own liked songs" ON public.liked_songs;
CREATE POLICY "Users can manage their own liked songs"
    ON public.liked_songs
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_liked_songs_user ON public.liked_songs(user_id, created_at DESC);

-- 3. CORE TABLE 2: PLAYLISTS (User Playlists Cloud Sync)
CREATE TABLE IF NOT EXISTS public.playlists (
    id TEXT PRIMARY KEY,
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    cover_url TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.playlists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own playlists" ON public.playlists;
CREATE POLICY "Users can manage their own playlists"
    ON public.playlists
    FOR ALL
    USING (auth.uid() = owner_id)
    WITH CHECK (auth.uid() = owner_id);

-- 4. CORE TABLE 3: PLAYLIST SONGS (Songs within Playlists)
CREATE TABLE IF NOT EXISTS public.playlist_songs (
    playlist_id TEXT NOT NULL REFERENCES public.playlists(id) ON DELETE CASCADE,
    song_id TEXT NOT NULL,
    position INT NOT NULL DEFAULT 0,
    added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (playlist_id, song_id)
);

ALTER TABLE public.playlist_songs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage songs in their playlists" ON public.playlist_songs;
CREATE POLICY "Users can manage songs in their playlists"
    ON public.playlist_songs
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.playlists 
            WHERE playlists.id = playlist_songs.playlist_id 
              AND playlists.owner_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.playlists 
            WHERE playlists.id = playlist_songs.playlist_id 
              AND playlists.owner_id = auth.uid()
        )
    );

CREATE INDEX IF NOT EXISTS idx_playlist_songs_order ON public.playlist_songs(playlist_id, position ASC);

-- 5. CORE TABLE 4: JAM SESSIONS (Live Group Listening Sync)
CREATE TABLE IF NOT EXISTS public.jam_sessions (
    id TEXT PRIMARY KEY,
    room_code TEXT UNIQUE NOT NULL,
    host_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    host_device_id TEXT,
    active_track_id TEXT,
    position_ms BIGINT NOT NULL DEFAULT 0,
    is_playing BOOLEAN NOT NULL DEFAULT FALSE,
    revision BIGINT NOT NULL DEFAULT 1,
    participants JSONB NOT NULL DEFAULT '[]'::jsonb,
    queue JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.jam_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can access jam sessions" ON public.jam_sessions;
CREATE POLICY "Authenticated users can access jam sessions"
    ON public.jam_sessions
    FOR ALL
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

-- 6. CONFIGURE REALTIME (KEEP ONLY JAM & LIKED SONGS)
-- First remove any old publication tables
DO $$
DECLARE
    tbl text;
    tables_to_remove text[] := ARRAY[
        'listening_events',
        'user_events',
        'canonical_songs',
        'dynamic_home_playlists',
        'recommendation_snapshots',
        'ai_recommendations',
        'user_artist_affinity',
        'user_genre_affinity',
        'user_language_affinity',
        'user_languages',
        'user_artists',
        'user_preferences',
        'profiles',
        'recently_played',
        'user_downloads',
        'user_favorites',
        'user_library_state',
        'saved_albums',
        'devices',
        'playback_sessions',
        'playback_state'
    ];
BEGIN
    FOREACH tbl IN ARRAY tables_to_remove LOOP
        IF EXISTS (
            SELECT 1 FROM pg_publication_tables 
            WHERE pubname = 'supabase_realtime' AND tablename = tbl
        ) THEN
            EXECUTE format('ALTER PUBLICATION supabase_realtime DROP TABLE public.%I', tbl);
        END IF;
    END LOOP;
END $$;

-- Enable Realtime ONLY for jam_sessions and liked_songs
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'jam_sessions') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.jam_sessions;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'liked_songs') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.liked_songs;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'playlists') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.playlists;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'user_playback_state') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.user_playback_state;
    END IF;
END $$;

-- ============================================================================
-- 5. SPOTIFY CONNECT ACTIVE PLAYBACK STATE TABLE (Cross-Device Passive Sync)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.user_playback_state (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    device_id TEXT NOT NULL,
    device_name TEXT NOT NULL,
    device_type TEXT DEFAULT 'mobile',
    current_track_id TEXT,
    track_title TEXT,
    artist_name TEXT,
    cover_url TEXT,
    audio_url TEXT,
    progress_ms BIGINT DEFAULT 0,
    duration_ms BIGINT DEFAULT 0,
    is_playing BOOLEAN DEFAULT false,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE public.user_playback_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can sync own playback state" ON public.user_playback_state;
CREATE POLICY "Users can sync own playback state"
    ON public.user_playback_state FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

