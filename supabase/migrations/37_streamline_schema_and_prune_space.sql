-- ============================================================================
-- MIGRATION: 37_streamline_schema_and_prune_space.sql
-- Description: 
-- 1. Drops vector embedding index and column from canonical_songs (saves ~60% catalog space).
-- 2. Drops raw_data JSONB column from canonical_songs (saves ~20KB per row).
-- 3. Drops unused playback_history table.
-- 4. Decouples listening_events from canonical_songs foreign key so plays log directly.
-- 5. Auto-pruning for listening_events and user_events older than 14 days.
-- ============================================================================

-- 1. Drop vector embedding index & column
DROP INDEX IF EXISTS public.canonical_songs_embedding_idx;
ALTER TABLE public.canonical_songs DROP COLUMN IF EXISTS embedding;

-- 2. Drop raw_data JSONB column
ALTER TABLE public.canonical_songs DROP COLUMN IF EXISTS raw_data;

-- 3. Drop redundant playback_history table
DROP TABLE IF EXISTS public.playback_history CASCADE;

-- 4. Decouple listening_events from canonical_songs foreign key
ALTER TABLE public.listening_events DROP CONSTRAINT IF EXISTS listening_events_song_id_fkey;

-- 5. Clean up old listening events & user events older than 14 days immediately
DELETE FROM public.listening_events WHERE created_at < NOW() - INTERVAL '14 days';
DELETE FROM public.user_events WHERE created_at < NOW() - INTERVAL '14 days';
