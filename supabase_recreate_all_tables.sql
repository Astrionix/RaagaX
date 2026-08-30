-- ============================================================================
-- MASTER SQL SCRIPT TO RESET AND RECREATE ALL CORE RAAGAX DATABASE TABLES
-- ============================================================================

-- ============================================================================
-- 1. ENABLE EXTENSIONS
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 2. DROP ALL EXISTING TABLES & CONFIGURATIONS
-- ============================================================================
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT oid::regprocedure AS proc_signature
        FROM pg_proc
        WHERE proname IN (
            'update_playlists_updated_at',
            'increment_library_revision',
            'update_user_language_score',
            'cap_recently_played'
        ) AND pronamespace = 'public'::regnamespace
    ) LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS ' || r.proc_signature || ' CASCADE';
    END LOOP;
END $$;

DROP TABLE IF EXISTS public.device_leases CASCADE;
DROP TABLE IF EXISTS public.processed_commands CASCADE;
DROP TABLE IF EXISTS public.playback_sessions CASCADE;
DROP TABLE IF EXISTS public.playback_state CASCADE;
DROP TABLE IF EXISTS public.devices CASCADE;
DROP TABLE IF EXISTS public.user_downloads CASCADE;
DROP TABLE IF EXISTS public.user_favorites CASCADE;
DROP TABLE IF EXISTS public.playback_history CASCADE;

DROP TABLE IF EXISTS public.ai_recommendations CASCADE;
DROP TABLE IF EXISTS public.listening_events CASCADE;
DROP TABLE IF EXISTS public.recommendation_snapshots CASCADE;
DROP TABLE IF EXISTS public.user_language_affinity CASCADE;
DROP TABLE IF EXISTS public.user_genre_affinity CASCADE;
DROP TABLE IF EXISTS public.user_artist_affinity CASCADE;
DROP TABLE IF EXISTS public.user_events CASCADE;

DROP TABLE IF EXISTS public.user_library_state CASCADE;
DROP TABLE IF EXISTS public.recently_played CASCADE;
DROP TABLE IF EXISTS public.saved_albums CASCADE;
DROP TABLE IF EXISTS public.playlist_songs CASCADE;
DROP TABLE IF EXISTS public.playlists CASCADE;
DROP TABLE IF EXISTS public.liked_songs CASCADE;
DROP TABLE IF EXISTS public.user_artists CASCADE;
DROP TABLE IF EXISTS public.user_languages CASCADE;
DROP TABLE IF EXISTS public.user_preferences CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

DROP TABLE IF EXISTS public.dynamic_home_playlists CASCADE;
DROP TABLE IF EXISTS public.charts CASCADE;
DROP TABLE IF EXISTS public.movie_songs CASCADE;
DROP TABLE IF EXISTS public.song_artists CASCADE;
DROP TABLE IF EXISTS public.canonical_songs CASCADE;
DROP TABLE IF EXISTS public.movies CASCADE;
DROP TABLE IF EXISTS public.artists CASCADE;

-- ============================================================================
-- 3. CREATE CATALOG SCHEMAS & INDEXES
-- ============================================================================
CREATE TABLE public.canonical_songs (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  artist TEXT,
  album TEXT,
  language TEXT,
  cover_url TEXT,
  duration TEXT,
  movie_name TEXT,
  singers JSONB,
  music_director TEXT,
  lyricist TEXT,
  release_date DATE,
  playable_url TEXT,
  popularity_score FLOAT DEFAULT 0.0,
  trend_score FLOAT DEFAULT 0.0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE public.dynamic_home_playlists (
    id TEXT PRIMARY KEY,
    language TEXT NOT NULL,
    category TEXT NOT NULL,
    playlist_id TEXT NOT NULL,
    title TEXT,
    image_url TEXT,
    last_resolved TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 4. CREATE USER LIBRARY SCHEMAS & INDEXES
-- ============================================================================
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE,
    display_name TEXT,
    avatar_url TEXT,
    preferred_language TEXT DEFAULT 'te',
    onboarding_completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.user_preferences (
    user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    theme TEXT DEFAULT 'dark',
    audio_quality TEXT DEFAULT '320kbps',
    crossfade_sec INT DEFAULT 3,
    autoplay_enabled BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.user_languages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    language_id TEXT NOT NULL,
    priority INT DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, language_id)
);

CREATE TABLE public.user_artists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    artist_id TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, artist_id)
);

CREATE TABLE public.liked_songs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    song_id TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, song_id)
);

CREATE TABLE public.playlists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    cover_url TEXT,
    visibility TEXT DEFAULT 'private' CHECK (visibility IN ('public', 'private', 'unlisted')),
    is_collaborative BOOLEAN DEFAULT FALSE,
    follower_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.playlist_songs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    playlist_id UUID NOT NULL REFERENCES public.playlists(id) ON DELETE CASCADE,
    song_id TEXT NOT NULL,
    position INT NOT NULL,
    added_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(playlist_id, song_id)
);

CREATE TABLE public.saved_albums (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    album_id TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, album_id)
);

CREATE TABLE public.recently_played (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    song_id TEXT NOT NULL,
    played_at TIMESTAMPTZ DEFAULT NOW(),
    position_ms INT DEFAULT 0,
    duration_ms INT DEFAULT 0,
    completed BOOLEAN DEFAULT FALSE,
    source_type TEXT,
    source_id TEXT
);

CREATE TABLE public.user_library_state (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    revision BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 5. CREATE EVENTS & ANALYTICAL AFFINITY TABLES
-- ============================================================================
CREATE TABLE public.user_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    song_id TEXT,
    album_id TEXT,
    artist_id TEXT,
    playlist_id TEXT,
    query TEXT,
    source_type TEXT,
    source_id TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.user_artist_affinity (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    artist_id TEXT NOT NULL,
    score INT DEFAULT 0,
    like_count INT DEFAULT 0,
    play_count INT DEFAULT 0,
    interaction_count INT DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_interaction TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, artist_id)
);

CREATE TABLE public.user_genre_affinity (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    genre TEXT NOT NULL,
    score INT DEFAULT 0,
    interaction_count INT DEFAULT 0,
    last_interaction TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, genre)
);

CREATE TABLE public.user_language_affinity (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    language VARCHAR(50) NOT NULL,
    score INT DEFAULT 0,
    state VARCHAR(20) DEFAULT 'BLOCKED',
    search_count INT DEFAULT 0,
    play_count INT DEFAULT 0,
    like_count INT DEFAULT 0,
    playlist_add_count INT DEFAULT 0,
    last_interaction_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, language)
);

CREATE TABLE public.recommendation_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    items JSONB NOT NULL,
    generated_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    algorithm_version TEXT DEFAULT 'v1.0'
);

CREATE TABLE public.listening_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  song_id TEXT NOT NULL,
  device_id TEXT,
  event_type TEXT NOT NULL CHECK (event_type IN ('play', 'pause', 'complete', 'skip', 'like', 'unlike', 'replay', 'search', 'add_to_queue')),
  position_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_listening_events_user_id ON public.listening_events(user_id);
CREATE INDEX IF NOT EXISTS idx_listening_events_song_id ON public.listening_events(song_id);
CREATE INDEX IF NOT EXISTS idx_listening_events_created_at ON public.listening_events(created_at);

CREATE TABLE public.ai_recommendations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    song_ids TEXT[] NOT NULL DEFAULT '{}',
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE
);

-- ============================================================================
-- 6. ENABLE ROW LEVEL SECURITY (RLS) & ASSIGN POLICIES
-- ============================================================================
ALTER TABLE public.canonical_songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dynamic_home_playlists ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_languages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_artists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.liked_songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playlist_songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_albums ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recently_played ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_library_state ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.user_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_artist_affinity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_genre_affinity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_language_affinity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recommendation_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listening_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_recommendations ENABLE ROW LEVEL SECURITY;

-- Grants to PostgREST roles
GRANT ALL ON TABLE public.canonical_songs TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.listening_events TO anon, authenticated, service_role;

-- Read policies
CREATE POLICY "Allow public read access on canonical_songs" ON public.canonical_songs FOR SELECT USING (true);
CREATE POLICY "Allow insert on canonical_songs" ON public.canonical_songs FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update on canonical_songs" ON public.canonical_songs FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Dynamic playlists are readable by everyone" ON public.dynamic_home_playlists FOR SELECT USING (true);

-- Personal read/write policies
CREATE POLICY "Users access own profile" ON public.profiles FOR ALL USING (auth.uid() = id);
CREATE POLICY "Users access own preferences" ON public.user_preferences FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users access own languages" ON public.user_languages FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users access own artists" ON public.user_artists FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users access own liked_songs" ON public.liked_songs FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can view their own playlists" ON public.playlists FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "Users can view public playlists" ON public.playlists FOR SELECT USING (visibility = 'public');
CREATE POLICY "Anyone can view RaagaX global playlists" ON public.playlists FOR SELECT USING (owner_id IS NULL);
CREATE POLICY "Users can insert their own playlists" ON public.playlists FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Users can update their own playlists" ON public.playlists FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "Users can delete their own playlists" ON public.playlists FOR DELETE USING (auth.uid() = owner_id);
CREATE POLICY "Users access own saved_albums" ON public.saved_albums FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users access own recently_played" ON public.recently_played FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can view their own library state" ON public.user_library_state FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users access own user_events" ON public.user_events FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users access own artist_affinity" ON public.user_artist_affinity FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users access own genre_affinity" ON public.user_genre_affinity FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own language affinity" ON public.user_language_affinity FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users access own recommendation_snapshots" ON public.recommendation_snapshots FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users access own ai_recommendations" ON public.ai_recommendations FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view songs of playlists they can view" ON public.playlist_songs FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.playlists p WHERE p.id = playlist_songs.playlist_id AND (p.owner_id = auth.uid() OR p.visibility = 'public' OR p.owner_id IS NULL))
);
CREATE POLICY "Users can add songs to their own playlists" ON public.playlist_songs FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.playlists p WHERE p.id = playlist_songs.playlist_id AND p.owner_id = auth.uid())
);
CREATE POLICY "Users can update songs in their own playlists" ON public.playlist_songs FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.playlists p WHERE p.id = playlist_songs.playlist_id AND p.owner_id = auth.uid())
);
CREATE POLICY "Users can delete songs from their own playlists" ON public.playlist_songs FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.playlists p WHERE p.id = playlist_songs.playlist_id AND p.owner_id = auth.uid())
);

CREATE POLICY "Users can insert their own listening events" ON public.listening_events FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view their own listening events" ON public.listening_events FOR SELECT USING (auth.uid() = user_id);

-- System roles policies
CREATE POLICY "Service role can manage dynamic playlists" ON public.dynamic_home_playlists FOR ALL USING (true);

-- ============================================================================
-- 7. CONFIGURE REALTIME PUBLICATION CHANNELS
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'liked_songs') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.liked_songs;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'playlists') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.playlists;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'playlist_songs') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.playlist_songs;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'saved_albums') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.saved_albums;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'user_library_state') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_library_state;
  END IF;
END $$;

-- ============================================================================
-- 8. TRIGGERS & FUNCTIONS
-- ============================================================================
CREATE OR REPLACE FUNCTION update_playlists_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE OR REPLACE FUNCTION public.handle_user_library_change()
RETURNS TRIGGER AS $$
DECLARE
    v_user_id UUID;
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_user_id := OLD.user_id;
    ELSE
        v_user_id := NEW.user_id;
    END IF;

    IF v_user_id IS NOT NULL THEN
        PERFORM increment_library_revision(v_user_id);
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.increment_library_revision(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
    INSERT INTO public.user_library_state (user_id, revision, updated_at)
    VALUES (p_user_id, 1, now())
    ON CONFLICT (user_id)
    DO UPDATE SET revision = public.user_library_state.revision + 1, updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Auto-Cap recently_played to latest 30 tracks per user
CREATE OR REPLACE FUNCTION public.cap_recently_played()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM public.recently_played
  WHERE id IN (
    SELECT id FROM public.recently_played
    WHERE user_id = NEW.user_id
    ORDER BY played_at DESC
    OFFSET 30
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_cap_recently_played ON public.recently_played;

CREATE TRIGGER trigger_cap_recently_played
AFTER INSERT ON public.recently_played
FOR EACH ROW EXECUTE FUNCTION public.cap_recently_played();

-- ============================================================================
-- 10. JAM SESSIONS DURABLE SHARED STORAGE
-- ============================================================================
DROP TABLE IF EXISTS public.jam_sessions CASCADE;

CREATE TABLE public.jam_sessions (
    jam_id TEXT PRIMARY KEY,
    join_code TEXT UNIQUE NOT NULL,
    host_id TEXT NOT NULL,
    host_name TEXT NOT NULL,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    state TEXT NOT NULL DEFAULT 'PAUSED',
    track_id TEXT,
    current_song JSONB,
    position_ms BIGINT DEFAULT 0,
    base_position_ms BIGINT DEFAULT 0,
    server_timestamp BIGINT NOT NULL,
    start_at_server_time BIGINT NOT NULL,
    timeline_start_server_ms BIGINT NOT NULL,
    lead_time_ms INT DEFAULT 400,
    revision INT DEFAULT 1,
    generation INT DEFAULT 1,
    timeline_id TEXT DEFAULT 'TL_1',
    transition_id TEXT DEFAULT 'TR_1',
    permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
    participants JSONB NOT NULL DEFAULT '{}'::jsonb,
    queue JSONB NOT NULL DEFAULT '[]'::jsonb,
    history JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_nearby_discoverable BOOLEAN DEFAULT TRUE,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL,
    last_activity_at BIGINT NOT NULL,
    expires_at BIGINT NOT NULL
);

CREATE INDEX idx_jam_sessions_join_code ON public.jam_sessions(join_code);
CREATE INDEX idx_jam_sessions_status ON public.jam_sessions(status);
CREATE INDEX idx_jam_sessions_expires_at ON public.jam_sessions(expires_at);
CREATE INDEX idx_jam_sessions_last_activity ON public.jam_sessions(last_activity_at);

