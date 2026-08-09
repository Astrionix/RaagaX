-- Migration: 21_youtube_discovery_v2
-- Description: Updates the verified_releases table to use the robust v2 schema with sources and verification.

ALTER TABLE verified_releases DROP COLUMN IF EXISTS audio_url;

ALTER TABLE verified_releases 
ADD COLUMN IF NOT EXISTS sources JSONB,
ADD COLUMN IF NOT EXISTS verification JSONB,
ADD COLUMN IF NOT EXISTS playable BOOLEAN DEFAULT false;

-- Create an index to quickly find unplayable songs if we ever want to run a cron job to find sources for them
CREATE INDEX IF NOT EXISTS idx_verified_releases_playable ON verified_releases(playable);
