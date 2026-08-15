-- ============================================================================
-- MASTER SQL SCRIPT TO RESET AND RECREATE ALL 37 RAAGAX DATABASE TABLES
-- ============================================================================

-- ============================================================================
-- 1. ENABLE EXTENSIONS
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 2. DROP ALL EXISTING CONFIGURATIONS (In reverse order of dependencies)
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
            'claim_playback_lease',
            'commit_playback_state',
            'increment_library_revision',
            'update_user_language_score',
            'match_songs',
            'match_similar_songs'
        ) AND pronamespace = 'public'::regnamespace
    ) LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS ' || r.proc_signature || ' CASCADE';
    END LOOP;
END $$;

DROP TABLE IF EXISTS public.device_leases CASCADE;
DROP TABLE IF EXISTS public.discovery_jobs CASCADE;
DROP TABLE IF EXISTS public.song_resolution_cache CASCADE;
DROP TABLE IF EXISTS public.spotify_playlist_cache CASCADE;

DROP TABLE IF EXISTS public.playback_history CASCADE;
DROP TABLE IF EXISTS public.ai_recommendations CASCADE;
DROP TABLE IF EXISTS public.user_favorites CASCADE;
DROP TABLE IF EXISTS public.user_library_state CASCADE;
DROP TABLE IF EXISTS public.listening_events CASCADE;
DROP TABLE IF EXISTS public.recommendation_snapshots CASCADE;
DROP TABLE IF EXISTS public.user_language_affinity CASCADE;
DROP TABLE IF EXISTS public.user_genre_affinity CASCADE;
DROP TABLE IF EXISTS public.user_artist_affinity CASCADE;
DROP TABLE IF EXISTS public.user_events CASCADE;
DROP TABLE IF EXISTS public.playback_state CASCADE;
DROP TABLE IF EXISTS public.processed_commands CASCADE;
DROP TABLE IF EXISTS public.playback_sessions CASCADE;
DROP TABLE IF EXISTS public.devices CASCADE;
DROP TABLE IF EXISTS public.user_downloads CASCADE;
DROP TABLE IF EXISTS public.recently_played CASCADE;
DROP TABLE IF EXISTS public.saved_albums CASCADE;
DROP TABLE IF EXISTS public.playlist_songs CASCADE;
DROP TABLE IF EXISTS public.playlists CASCADE;
DROP TABLE IF EXISTS public.liked_songs CASCADE;
DROP TABLE IF EXISTS public.user_artists CASCADE;
DROP TABLE IF EXISTS public.user_languages CASCADE;
DROP TABLE IF EXISTS public.user_preferences CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

DROP TABLE IF EXISTS public.verified_releases CASCADE;
DROP TABLE IF EXISTS public.music_sources CASCADE;
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
CREATE TABLE public.artists (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  image_url TEXT,
  language TEXT,
  type TEXT
);

CREATE TABLE public.movies (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  language TEXT,
  release_date DATE,
  poster_url TEXT
);

CREATE TABLE public.canonical_songs (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  artist TEXT,
  album TEXT,
  language TEXT,
  cover_url TEXT,
  duration TEXT,
  raw_data JSONB,
  movie_id TEXT REFERENCES public.movies(id) ON DELETE SET NULL,
  movie_name TEXT,
  singers JSONB,
  music_director TEXT,
  lyricist TEXT,
  release_date DATE,
  playable_url TEXT,
  popularity_score FLOAT DEFAULT 0.0,
  trend_score FLOAT DEFAULT 0.0,
  embedding vector(1536),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS canonical_songs_embedding_idx 
ON public.canonical_songs 
USING hnsw (embedding vector_cosine_ops);

CREATE TABLE public.song_artists (
  song_id TEXT REFERENCES public.canonical_songs(id) ON DELETE CASCADE,
  artist_id TEXT REFERENCES public.artists(id) ON DELETE CASCADE,
  role TEXT,
  PRIMARY KEY (song_id, artist_id, role)
);

CREATE TABLE public.movie_songs (
  movie_id TEXT REFERENCES public.movies(id) ON DELETE CASCADE,
  song_id TEXT REFERENCES public.canonical_songs(id) ON DELETE CASCADE,
  PRIMARY KEY (movie_id, song_id)
);

CREATE TABLE public.charts (
  section_name TEXT NOT NULL,
  language TEXT NOT NULL,
  song_id TEXT NOT NULL REFERENCES public.canonical_songs(id) ON DELETE CASCADE,
  rank INTEGER NOT NULL,
  discovered_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (section_name, language, song_id)
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

CREATE TABLE public.music_sources (
    channel_id TEXT PRIMARY KEY,
    handle TEXT,
    label_name TEXT NOT NULL,
    primary_languages TEXT[] NOT NULL DEFAULT '{}',
    is_verified BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 1,
    last_checked TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_music_sources_priority ON public.music_sources(priority DESC);
CREATE INDEX IF NOT EXISTS idx_music_sources_languages ON public.music_sources USING GIN (primary_languages);

CREATE TABLE public.verified_releases (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    artist TEXT NOT NULL,
    cover_url TEXT,
    audio_url TEXT,
    youtube_published_at TIMESTAMPTZ,
    official_release_date DATE,
    language TEXT NOT NULL DEFAULT 'Telugu',
    discovered_at TIMESTAMPTZ DEFAULT NOW(),
    song_metadata JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_verified_releases_date ON verified_releases(official_release_date DESC);
CREATE INDEX IF NOT EXISTS idx_verified_releases_lang ON verified_releases(language);

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
    preference_score INT DEFAULT 10,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, artist_id)
);

CREATE TABLE public.liked_songs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    song_id TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, song_id)
);

CREATE TABLE public.playlists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    cover_url TEXT,
    visibility TEXT DEFAULT 'private' CHECK (visibility IN ('public', 'private', 'unlisted')),
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

CREATE TABLE public.user_downloads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  song_id TEXT NOT NULL,
  song_title TEXT,
  song_artist TEXT,
  song_cover TEXT,
  song_duration INTEGER DEFAULT 0,
  song_version TEXT DEFAULT '1.0',
  downloaded_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT user_downloads_user_song_unique UNIQUE (user_id, song_id)
);

CREATE INDEX IF NOT EXISTS idx_user_downloads_user_id ON public.user_downloads(user_id);
CREATE INDEX IF NOT EXISTS idx_user_downloads_downloaded_at ON public.user_downloads(downloaded_at DESC);

CREATE TABLE public.user_favorites (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    item_id TEXT NOT NULL,
    item_type TEXT NOT NULL CHECK (item_type IN ('artist', 'album')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, item_id, item_type)
);

CREATE TABLE public.user_library_state (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    revision BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 5. CREATE DEVICES & PLAYBACK HANDOFF SESSIONS
-- ============================================================================
CREATE TABLE public.devices (
  device_id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  device_name TEXT,
  device_type TEXT,
  platform TEXT DEFAULT 'web',
  instance_id TEXT,
  capabilities JSONB DEFAULT '{"audio": true, "video": false, "seek": true, "volume": true, "remoteControl": true}'::jsonb,
  is_online BOOLEAN DEFAULT true,
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE public.playback_sessions (
  session_id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  active_device_id TEXT REFERENCES public.devices(device_id) ON DELETE SET NULL,
  active_renderer TEXT DEFAULT 'audio',
  song_id TEXT,
  song_data JSONB,
  position_ms BIGINT DEFAULT 0,
  canonical_position_ms BIGINT NOT NULL DEFAULT 0,
  is_playing BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'idle',
  queue JSONB DEFAULT '[]'::jsonb,
  queue_index INTEGER DEFAULT 0,
  shuffle BOOLEAN DEFAULT false,
  repeat_mode TEXT DEFAULT 'off',
  epoch BIGINT DEFAULT 1,
  session_epoch BIGINT DEFAULT 1,
  revision BIGINT DEFAULT 1,
  sequence_number BIGINT DEFAULT 0,
  server_timestamp BIGINT DEFAULT 0,
  lease_id TEXT,
  lease_expires_at TIMESTAMPTZ,
  context_data JSONB DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.processed_commands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    command_id TEXT NOT NULL,
    session_id TEXT NOT NULL REFERENCES public.playback_sessions(session_id) ON DELETE CASCADE,
    session_epoch BIGINT NOT NULL,
    sequence_number BIGINT NOT NULL,
    result TEXT NOT NULL,
    processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(command_id, session_id)
);

CREATE TABLE public.playback_state (
    user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    song_id TEXT,
    position_ms INT DEFAULT 0,
    queue_snapshot JSONB,
    current_index INT DEFAULT 0,
    repeat_mode TEXT DEFAULT 'off',
    shuffle_mode BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 6. CREATE WORKER QUEUES & DYNAMIC RESOLUTION CACHES
-- ============================================================================
CREATE TABLE public.device_leases (
    session_id TEXT PRIMARY KEY REFERENCES public.playback_sessions(session_id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    device_id TEXT REFERENCES public.devices(device_id) ON DELETE SET NULL,
    instance_id TEXT,
    lease_token TEXT,
    lease_epoch BIGINT DEFAULT 1,
    lease_version BIGINT DEFAULT 1,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.discovery_jobs (
    playlist_id TEXT PRIMARY KEY,
    language TEXT NOT NULL,
    category TEXT NOT NULL,
    status TEXT NOT NULL, -- e.g., 'pending', 'processing', 'completed', 'dead_letter'
    attempts INTEGER DEFAULT 0,
    locked_at TIMESTAMP WITH TIME ZONE,
    locked_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE public.song_resolution_cache (
    cache_key TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    artist TEXT NOT NULL,
    jiosaavn_song_id TEXT,
    status TEXT NOT NULL, -- 'resolved', 'not_found', 'failed'
    raw_response JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE public.spotify_playlist_cache (
    playlist_id TEXT PRIMARY KEY,
    playlist_name TEXT,
    language TEXT,
    category TEXT DEFAULT 'Playlist',
    track_count INTEGER DEFAULT 0,
    resolved_count INTEGER DEFAULT 0,
    data JSONB,
    fetched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 7. CREATE EVENTS & ANALYTICAL AFFINITY TABLES
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
  song_id TEXT NOT NULL REFERENCES public.canonical_songs(id) ON DELETE CASCADE,
  device_id TEXT,
  event_type TEXT NOT NULL CHECK (event_type IN ('play', 'pause', 'complete', 'skip', 'like', 'unlike', 'replay', 'search', 'add_to_queue')),
  position_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_listening_events_user_id ON public.listening_events(user_id);
CREATE INDEX IF NOT EXISTS idx_listening_events_song_id ON public.listening_events(song_id);
CREATE INDEX IF NOT EXISTS idx_listening_events_created_at ON public.listening_events(created_at);

CREATE TABLE public.playback_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    song_id TEXT,
    played_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    playback_duration_ms INTEGER DEFAULT 0,
    completed BOOLEAN DEFAULT false,
    completion_percentage float DEFAULT 0.0,
    play_duration_sec int DEFAULT 0,
    context text DEFAULT 'home',
    session_id text
);

CREATE TABLE public.ai_recommendations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    song_ids TEXT[] NOT NULL DEFAULT '{}',
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE
);

-- ============================================================================
-- 8. ENABLE ROW LEVEL SECURITY (RLS) & ASSIGN POLICIES
-- ============================================================================
ALTER TABLE public.artists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.canonical_songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.song_artists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movie_songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.charts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dynamic_home_playlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.music_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verified_releases ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_languages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_artists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.liked_songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playlist_songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_albums ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recently_played ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_downloads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_library_state ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playback_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playback_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_artist_affinity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_genre_affinity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_language_affinity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recommendation_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listening_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playback_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_recommendations ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.device_leases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discovery_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.song_resolution_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spotify_playlist_cache ENABLE ROW LEVEL SECURITY;

-- Grants to PostgREST roles
GRANT ALL ON TABLE public.canonical_songs TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.listening_events TO anon, authenticated, service_role;

-- Read policies
CREATE POLICY "Allow public read access on artists" ON public.artists FOR SELECT USING (true);
CREATE POLICY "Allow public read access on movies" ON public.movies FOR SELECT USING (true);
CREATE POLICY "Allow public read access on canonical_songs" ON public.canonical_songs FOR SELECT USING (true);
CREATE POLICY "Allow insert on canonical_songs" ON public.canonical_songs FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update on canonical_songs" ON public.canonical_songs FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read access on song_artists" ON public.song_artists FOR SELECT USING (true);
CREATE POLICY "Allow public read access on movie_songs" ON public.movie_songs FOR SELECT USING (true);
CREATE POLICY "Allow public read access on charts" ON public.charts FOR SELECT USING (true);
CREATE POLICY "Dynamic playlists are readable by everyone" ON public.dynamic_home_playlists FOR SELECT USING (true);
CREATE POLICY "Allow public read access on music_sources" ON public.music_sources FOR SELECT USING (true);
CREATE POLICY "Allow public read access to verified releases" ON public.verified_releases FOR SELECT USING (true);

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
CREATE POLICY "Users access own downloads" ON public.user_downloads FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users access own favorites" ON public.user_favorites FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can view their own library state" ON public.user_library_state FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users access own devices" ON public.devices FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users access own playback sessions" ON public.playback_sessions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users access own playback_state" ON public.playback_state FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users access own user_events" ON public.user_events FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users access own artist_affinity" ON public.user_artist_affinity FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users access own genre_affinity" ON public.user_genre_affinity FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own language affinity" ON public.user_language_affinity FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users access own recommendation_snapshots" ON public.recommendation_snapshots FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users access own playback_history" ON public.playback_history FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users access own ai_recommendations" ON public.ai_recommendations FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users access own device leases" ON public.device_leases FOR ALL USING (auth.uid() = user_id);

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
CREATE POLICY "Allow service role full access on music_sources" ON public.music_sources FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role can manage discovery jobs" ON public.discovery_jobs FOR ALL USING (true);
CREATE POLICY "Service role can manage song resolution cache" ON public.song_resolution_cache FOR ALL USING (true);
CREATE POLICY "Service role can manage spotify playlist cache" ON public.spotify_playlist_cache FOR ALL USING (true);

-- ============================================================================
-- 8. CONFIGURE REALTIME PUBLICATION CHANNELS
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'playback_sessions') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.playback_sessions;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'devices') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.devices;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'user_downloads') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_downloads;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'user_favorites') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_favorites;
  END IF;
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
-- 9. TRIGGERS
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

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.handle_playlist_change()
RETURNS TRIGGER AS $$
DECLARE
    v_owner_id UUID;
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_owner_id := COALESCE(OLD.owner_id, (OLD.user_id)::uuid);
    ELSE
        v_owner_id := COALESCE(NEW.owner_id, (NEW.user_id)::uuid);
    END IF;

    IF v_owner_id IS NOT NULL THEN
        PERFORM increment_library_revision(v_owner_id);
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.handle_playlist_songs_change()
RETURNS TRIGGER AS $$
DECLARE
    v_playlist_id UUID;
    v_owner_id UUID;
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_playlist_id := OLD.playlist_id;
    ELSE
        v_playlist_id := NEW.playlist_id;
    END IF;

    IF v_playlist_id IS NOT NULL THEN
        SELECT COALESCE(owner_id, (user_id)::uuid) INTO v_owner_id
        FROM public.playlists
        WHERE id = v_playlist_id;

        IF v_owner_id IS NOT NULL THEN
            PERFORM increment_library_revision(v_owner_id);
        END IF;
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER update_playlists_timestamp
    BEFORE UPDATE ON public.playlists
    FOR EACH ROW
    EXECUTE FUNCTION update_playlists_updated_at();

-- ============================================================================
-- 10. RPC STORED PROCEDURES (Similarity search & Lease Control)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.match_songs(
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  exclude_ids text[] DEFAULT '{}'
)
RETURNS TABLE (
  id text,
  title text,
  artist text,
  album text,
  language text,
  cover_url text,
  duration int,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    cs.id,
    cs.title,
    cs.artist,
    cs.album,
    cs.language,
    cs.cover_url,
    CAST(cs.duration AS int),
    1 - (cs.embedding <=> query_embedding) AS similarity
  FROM public.canonical_songs cs
  WHERE cs.embedding IS NOT NULL
    AND cs.id != ALL(exclude_ids)
    AND 1 - (cs.embedding <=> query_embedding) > match_threshold
  ORDER BY cs.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.match_similar_songs(
  target_song_id text,
  match_count int DEFAULT 10,
  match_threshold float DEFAULT 0.5
)
RETURNS TABLE (
  id text,
  title text,
  artist text,
  album text,
  language text,
  cover_url text,
  duration int,
  similarity float
)
LANGUAGE plpgsql
AS $$
DECLARE
  target_embedding vector(1536);
BEGIN
  SELECT embedding INTO target_embedding
  FROM public.canonical_songs
  WHERE id = target_song_id;

  IF target_embedding IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT * FROM public.match_songs(
    target_embedding, 
    match_threshold, 
    match_count, 
    ARRAY[target_song_id]
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_playback_lease(
  p_session_id TEXT,
  p_device_id TEXT,
  p_instance_id TEXT,
  p_lease_token TEXT,
  p_expires_at TIMESTAMPTZ,
  p_force_takeover BOOLEAN DEFAULT false
) RETURNS JSONB AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_session RECORD;
  v_new_epoch BIGINT;
  v_new_revision BIGINT;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;

  SELECT * INTO v_session 
  FROM public.playback_sessions 
  WHERE session_id = p_session_id AND user_id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.playback_sessions (
      session_id, user_id, active_device_id, lease_id, lease_expires_at, epoch, revision, is_playing
    ) VALUES (
      p_session_id, v_user_id, p_device_id, p_lease_token, p_expires_at, 1, 1, false
    );
    RETURN jsonb_build_object('success', true, 'epoch', 1, 'revision', 1, 'lease_version', 1);
  END IF;

  IF v_session.active_device_id = p_device_id AND v_session.lease_id = p_lease_token THEN
    UPDATE public.playback_sessions
    SET lease_expires_at = p_expires_at,
        updated_at = NOW()
    WHERE session_id = p_session_id AND user_id = v_user_id;

    RETURN jsonb_build_object('success', true, 'epoch', v_session.epoch, 'revision', v_session.revision, 'lease_version', 1);
  END IF;

  IF p_force_takeover OR v_session.lease_expires_at IS NULL OR v_session.lease_expires_at < NOW() THEN
    v_new_epoch := v_session.epoch + 1;
    v_new_revision := v_session.revision + 1;

    UPDATE public.playback_sessions
    SET active_device_id = p_device_id,
        lease_id = p_lease_token,
        lease_expires_at = p_expires_at,
        epoch = v_new_epoch,
        revision = v_new_revision,
        updated_at = NOW()
    WHERE session_id = p_session_id AND user_id = v_user_id;

    RETURN jsonb_build_object('success', true, 'epoch', v_new_epoch, 'revision', v_new_revision, 'lease_version', 1);
  END IF;

  RETURN jsonb_build_object(
    'success', false, 
    'error', 'lease_owned_by_other_device', 
    'active_device', v_session.active_device_id,
    'expires_at', v_session.lease_expires_at
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.commit_playback_state(
  p_session_id TEXT,
  p_device_id TEXT,
  p_lease_id TEXT,
  p_expected_epoch BIGINT,
  p_song_id TEXT,
  p_song_data JSONB,
  p_position_ms BIGINT,
  p_is_playing BOOLEAN,
  p_queue JSONB,
  p_queue_index INTEGER,
  p_shuffle BOOLEAN,
  p_repeat_mode TEXT,
  p_context_data JSONB DEFAULT '{}'::jsonb
) RETURNS JSONB AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_session RECORD;
  v_new_revision BIGINT;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;

  SELECT * INTO v_session 
  FROM public.playback_sessions 
  WHERE session_id = p_session_id AND user_id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'session_not_found');
  END IF;

  IF v_session.active_device_id != p_device_id OR v_session.lease_id != p_lease_id OR v_session.epoch != p_expected_epoch THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'stale_authority', 
      'current_epoch', v_session.epoch, 
      'active_device', v_session.active_device_id
    );
  END IF;

  v_new_revision := v_session.revision + 1;

  UPDATE public.playback_sessions
  SET song_id = COALESCE(p_song_id, song_id),
      song_data = COALESCE(p_song_data, song_data),
      position_ms = p_position_ms,
      is_playing = p_is_playing,
      queue = COALESCE(p_queue, queue),
      queue_index = COALESCE(p_queue_index, queue_index),
      shuffle = COALESCE(p_shuffle, shuffle),
      repeat_mode = COALESCE(p_repeat_mode, repeat_mode),
      context_data = COALESCE(p_context_data, context_data),
      revision = v_new_revision,
      updated_at = NOW()
  WHERE session_id = p_session_id AND user_id = v_user_id;

  RETURN jsonb_build_object('success', true, 'revision', v_new_revision, 'epoch', v_session.epoch);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION increment_library_revision(p_user_id uuid)
RETURNS bigint AS $$
DECLARE
    new_revision bigint;
BEGIN
    INSERT INTO public.user_library_state (user_id, revision, updated_at)
    VALUES (p_user_id, 1, now())
    ON CONFLICT (user_id) DO UPDATE
    SET revision = user_library_state.revision + 1,
        updated_at = now()
    RETURNING revision into new_revision;
    
    RETURN new_revision;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION update_user_language_score(
    p_user_id UUID,
    p_language VARCHAR(50),
    p_weight INT,
    p_action VARCHAR(50)
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_current_score INT := 0;
    v_new_score INT := 0;
    v_new_state VARCHAR(20) := 'BLOCKED';
    v_is_selected BOOLEAN := FALSE;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM user_languages
        WHERE user_id = p_user_id AND language_id = p_language
    ) INTO v_is_selected;

    SELECT score INTO v_current_score
    FROM user_language_affinity
    WHERE user_id = p_user_id AND language = p_language;

    IF v_current_score IS NULL THEN
        v_current_score := 0;
    END IF;

    v_new_score := GREATEST(0, v_current_score + p_weight);

    IF v_is_selected THEN
        v_new_state := 'ACTIVE';
    ELSIF p_action IN ('LIKE', 'ADD_TO_PLAYLIST', 'FOLLOW_ARTIST') OR v_new_score >= 15 THEN
        v_new_state := 'EXPLICIT';
    ELSIF v_new_score >= 5 THEN
        v_new_state := 'DISCOVERED';
    ELSE
        v_new_state := 'BLOCKED';
    END IF;

    INSERT INTO user_language_affinity (
        user_id,
        language,
        score,
        state,
        search_count,
        play_count,
        like_count,
        playlist_add_count,
        last_interaction_at
    )
    VALUES (
        p_user_id,
        p_language,
        v_new_score,
        v_new_state,
        CASE WHEN p_action = 'SEARCH' THEN 1 ELSE 0 END,
        CASE WHEN p_action IN ('PLAY', 'PLAY_HALF', 'COMPLETE') THEN 1 ELSE 0 END,
        CASE WHEN p_action = 'LIKE' THEN 1 ELSE 0 END,
        CASE WHEN p_action = 'ADD_TO_PLAYLIST' THEN 1 ELSE 0 END,
        NOW()
    )
    ON CONFLICT (user_id, language) DO UPDATE SET
        score = EXCLUDED.score,
        state = EXCLUDED.state,
        search_count = user_language_affinity.search_count + EXCLUDED.search_count,
        play_count = user_language_affinity.play_count + EXCLUDED.play_count,
        like_count = user_language_affinity.like_count + EXCLUDED.like_count,
        playlist_add_count = user_language_affinity.playlist_add_count + EXCLUDED.playlist_add_count,
        last_interaction_at = NOW();
END;
$$;

-- ============================================================================
-- 11. RELOAD SCHEMA CACHE
-- ============================================================================
NOTIFY pgrst, 'reload schema';
