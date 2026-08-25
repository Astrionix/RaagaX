-- ============================================================================
-- MIGRATION: 38_ultra_lite_schema_cleanup.sql
-- Description:
-- 1. Drops unused legacy catalog & join tables:
--    - artists, movies, movie_songs, song_artists, charts
-- 2. Drops duplicate & client-managed tables:
--    - user_favorites (replaced by user_artists & saved_albums)
--    - playback_state (replaced by playback_sessions)
--    - user_downloads (managed 100% locally in client IndexedDB)
-- 3. Adds auto-cap trigger on recently_played to keep only the last 30 songs per user.
-- ============================================================================

-- 1. Drop unused legacy catalog and join tables
DROP TABLE IF EXISTS public.song_artists CASCADE;
DROP TABLE IF EXISTS public.movie_songs CASCADE;
DROP TABLE IF EXISTS public.charts CASCADE;
DROP TABLE IF EXISTS public.movies CASCADE;
DROP TABLE IF EXISTS public.artists CASCADE;

-- 2. Drop duplicate / client-managed tables
DROP TABLE IF EXISTS public.user_favorites CASCADE;
DROP TABLE IF EXISTS public.playback_state CASCADE;
DROP TABLE IF EXISTS public.user_downloads CASCADE;

-- 3. Auto-cap recently_played table to last 30 songs per user
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
