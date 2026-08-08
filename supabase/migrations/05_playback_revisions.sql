-- Migration to add revision tracking for race-condition prevention in playback_sessions

ALTER TABLE playback_sessions
ADD COLUMN IF NOT EXISTS revision INTEGER DEFAULT 0;
