-- Migration: 19_youtube_discovery
-- Description: Creates a table to cache verified new releases discovered via YouTube.

CREATE TABLE verified_releases (
    id TEXT PRIMARY KEY, -- The JioSaavn/Canonical ID
    title TEXT NOT NULL,
    artist TEXT NOT NULL,
    cover_url TEXT,
    audio_url TEXT,
    youtube_published_at TIMESTAMPTZ,
    official_release_date DATE,
    language TEXT NOT NULL DEFAULT 'Telugu',
    discovered_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- We can store the full JSON payload for flexibility
    song_metadata JSONB NOT NULL
);

-- Index for fast queries sorted by official release date
CREATE INDEX idx_verified_releases_date ON verified_releases(official_release_date DESC);
CREATE INDEX idx_verified_releases_lang ON verified_releases(language);

-- Allow public read access
ALTER TABLE verified_releases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to verified releases" 
ON verified_releases FOR SELECT USING (true);
