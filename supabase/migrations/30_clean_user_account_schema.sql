-- ============================================================================
-- RAAGAX CLEAN RELATIONAL USER ACCOUNT SCHEMA MIGRATION
-- Music Catalog remains global (songs, albums, artists)
-- User Account owns all personal relational data & preferences
-- ============================================================================

-- 1. PROFILES
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE,
    display_name TEXT,
    avatar_url TEXT,
    preferred_language TEXT DEFAULT 'te',
    onboarding_completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. USER PREFERENCES
CREATE TABLE IF NOT EXISTS public.user_preferences (
    user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    theme TEXT DEFAULT 'dark',
    audio_quality TEXT DEFAULT '320kbps',
    crossfade_sec INT DEFAULT 3,
    autoplay_enabled BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. USER LANGUAGES
CREATE TABLE IF NOT EXISTS public.user_languages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    language_id TEXT NOT NULL,
    priority INT DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, language_id)
);

-- 4. USER ARTISTS
CREATE TABLE IF NOT EXISTS public.user_artists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    artist_id TEXT NOT NULL,
    preference_score INT DEFAULT 10,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, artist_id)
);

-- 5. LIKED SONGS (Global Song Reference)
CREATE TABLE IF NOT EXISTS public.liked_songs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    song_id TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, song_id)
);

-- 6. PLAYLISTS
CREATE TABLE IF NOT EXISTS public.playlists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    cover_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. PLAYLIST SONGS (Cascades on Playlist deletion, Global Songs untouched)
CREATE TABLE IF NOT EXISTS public.playlist_songs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    playlist_id UUID NOT NULL REFERENCES public.playlists(id) ON DELETE CASCADE,
    song_id TEXT NOT NULL,
    position INT NOT NULL,
    added_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(playlist_id, song_id)
);

-- 8. SAVED ALBUMS
CREATE TABLE IF NOT EXISTS public.saved_albums (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    album_id TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, album_id)
);

-- 9. RECENTLY PLAYED
CREATE TABLE IF NOT EXISTS public.recently_played (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    song_id TEXT NOT NULL,
    played_at TIMESTAMPTZ DEFAULT NOW(),
    position_ms INT DEFAULT 0,
    duration_ms INT DEFAULT 0,
    completed BOOLEAN DEFAULT FALSE,
    source_type TEXT,
    source_id TEXT
);

-- 10. PLAYBACK STATE (Cross-Device Playback Checkpoint)
CREATE TABLE IF NOT EXISTS public.playback_state (
    user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    song_id TEXT,
    position_ms INT DEFAULT 0,
    queue_snapshot JSONB,
    current_index INT DEFAULT 0,
    repeat_mode TEXT DEFAULT 'off',
    shuffle_mode BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. USER EVENTS (Raw Interaction Logs)
CREATE TABLE IF NOT EXISTS public.user_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL, -- SEARCH, PLAY, COMPLETE, REPLAY, LIKE, UNLIKE, ADD_TO_PLAYLIST, SKIP, etc.
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

-- 12. USER ARTIST AFFINITY
CREATE TABLE IF NOT EXISTS public.user_artist_affinity (
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    artist_id TEXT NOT NULL,
    score INT DEFAULT 0,
    interaction_count INT DEFAULT 0,
    last_interaction TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, artist_id)
);

-- 13. USER GENRE AFFINITY
CREATE TABLE IF NOT EXISTS public.user_genre_affinity (
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    genre TEXT NOT NULL,
    score INT DEFAULT 0,
    interaction_count INT DEFAULT 0,
    last_interaction TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, genre)
);

-- 14. USER LANGUAGE AFFINITY
CREATE TABLE IF NOT EXISTS public.user_language_affinity (
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    language TEXT NOT NULL,
    score INT DEFAULT 0,
    interaction_count INT DEFAULT 0,
    last_interaction TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, language)
);

-- 15. RECOMMENDATION SNAPSHOTS (3-Day Stable Engine Snapshots)
CREATE TABLE IF NOT EXISTS public.recommendation_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    items JSONB NOT NULL,
    generated_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    algorithm_version TEXT DEFAULT 'v1.0'
);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Strict Isolation: Authenticated users can only read/write their own account data
-- ============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_languages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_artists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.liked_songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playlist_songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_albums ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recently_played ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playback_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_artist_affinity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_genre_affinity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_language_affinity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recommendation_snapshots ENABLE ROW LEVEL SECURITY;

-- Simple auth.uid() policies
CREATE POLICY "Users access own profile" ON public.profiles FOR ALL USING (auth.uid() = id);
CREATE POLICY "Users access own preferences" ON public.user_preferences FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users access own languages" ON public.user_languages FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users access own artists" ON public.user_artists FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users access own liked_songs" ON public.liked_songs FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users access own playlists" ON public.playlists FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users access own saved_albums" ON public.saved_albums FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users access own recently_played" ON public.recently_played FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users access own playback_state" ON public.playback_state FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users access own user_events" ON public.user_events FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users access own artist_affinity" ON public.user_artist_affinity FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users access own genre_affinity" ON public.user_genre_affinity FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users access own language_affinity" ON public.user_language_affinity FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users access own recommendation_snapshots" ON public.recommendation_snapshots FOR ALL USING (auth.uid() = user_id);

-- Playlist Songs Policy (indirect ownership via playlists.user_id)
CREATE POLICY "Users access own playlist_songs" ON public.playlist_songs FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.playlists p 
        WHERE p.id = playlist_songs.playlist_id AND p.user_id = auth.uid()
    )
);
