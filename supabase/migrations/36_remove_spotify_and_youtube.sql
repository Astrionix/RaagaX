-- ============================================================================
-- MIGRATION: 36_remove_spotify_and_youtube.sql
-- Description: Drop Spotify playlist cache, YouTube verified releases, music sources,
--              song resolution cache, and background discovery job queues.
-- Reclaims significant Supabase storage and eliminates external scraping bloat.
-- ============================================================================

DROP TABLE IF EXISTS public.spotify_playlist_cache CASCADE;
DROP TABLE IF EXISTS public.song_resolution_cache CASCADE;
DROP TABLE IF EXISTS public.discovery_jobs CASCADE;
DROP TABLE IF EXISTS public.music_sources CASCADE;
DROP TABLE IF EXISTS public.verified_releases CASCADE;
