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
DROP TABLE IF EXISTS public.jam_sessions CASCADE;
DROP TABLE IF EXISTS public.device_leases CASCADE;
DROP TABLE IF EXISTS public.devices CASCADE;
DROP TABLE IF EXISTS public.playback_state CASCADE;
DROP TABLE IF EXISTS public.playback_history CASCADE;
DROP TABLE IF EXISTS public.processed_commands CASCADE;
DROP TABLE IF EXISTS public.playback_sessions CASCADE;
DROP TABLE IF EXISTS public.user_playback_state CASCADE;
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

-- 4. CONNECT TO DEVICE REGISTRY
CREATE TABLE IF NOT EXISTS public.connect_devices (
    device_id TEXT PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    device_name TEXT NOT NULL,
    device_type TEXT NOT NULL DEFAULT 'desktop',
    platform TEXT DEFAULT 'web',
    capabilities JSONB DEFAULT '{"play":true,"pause":true,"seek":true,"volume":true,"shuffle":true,"repeat":true,"queue_control":true,"handoff":true}'::jsonb,
    is_online BOOLEAN DEFAULT TRUE,
    last_seen TIMESTAMPTZ DEFAULT NOW(),
    app_version TEXT DEFAULT '1.0.0',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.connect_devices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view and manage connect devices" ON public.connect_devices;
CREATE POLICY "Users can view and manage connect devices"
    ON public.connect_devices FOR ALL
    USING (auth.uid() = user_id OR auth.role() = 'authenticated')
    WITH CHECK (auth.uid() = user_id);

-- 5. CONNECT PAIRINGS (Different Account PIN Handshake)
CREATE TABLE IF NOT EXISTS public.connect_pairings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pin_code TEXT NOT NULL,
    host_device_id TEXT NOT NULL,
    host_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    guest_device_id TEXT,
    guest_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '5 minutes')
);

ALTER TABLE public.connect_pairings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can manage pairings" ON public.connect_pairings;
CREATE POLICY "Authenticated users can manage pairings"
    ON public.connect_pairings FOR ALL
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

-- 6. CONNECT AUTHORIZATIONS (Trusted Cross-Device Control)
CREATE TABLE IF NOT EXISTS public.connect_authorizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    controller_device_id TEXT NOT NULL,
    player_device_id TEXT NOT NULL,
    granted_by_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(controller_device_id, player_device_id)
);

ALTER TABLE public.connect_authorizations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage connect authorizations" ON public.connect_authorizations;
CREATE POLICY "Users can manage connect authorizations"
    ON public.connect_authorizations FOR ALL
    USING (auth.uid() = granted_by_user_id OR auth.role() = 'authenticated')
    WITH CHECK (auth.uid() = granted_by_user_id);

-- 7. CONFIGURE REALTIME
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'liked_songs') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.liked_songs;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'playlists') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.playlists;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'connect_devices') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.connect_devices;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'connect_pairings') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.connect_pairings;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'connect_authorizations') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.connect_authorizations;
    END IF;
END $$;


