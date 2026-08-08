-- 1. Upgrade playback_history table to support weighted actions
ALTER TABLE public.playback_history
ADD COLUMN IF NOT EXISTS completion_percentage float DEFAULT 0.0,
ADD COLUMN IF NOT EXISTS play_duration_sec int DEFAULT 0,
ADD COLUMN IF NOT EXISTS context text DEFAULT 'home', -- 'home', 'search', 'artist', 'radio', 'playlist'
ADD COLUMN IF NOT EXISTS session_id text;

-- 2. Create a materialized view to calculate user affinities dynamically
-- This computes an affinity score for each user and artist/genre based on their historical actions
-- Likes (+3), Completes (+1), Skips (-1)
CREATE MATERIALIZED VIEW IF NOT EXISTS public.user_artist_affinity AS
SELECT 
    user_id,
    artist,
    SUM(
        CASE 
            WHEN action = 'like' THEN 3.0
            WHEN action = 'play' AND completion_percentage >= 0.9 THEN 1.0
            WHEN action = 'play' AND completion_percentage > 0.5 THEN 0.5
            WHEN action = 'skip' THEN -1.0
            ELSE 0.1
        END
    ) as affinity_score
FROM public.playback_history
WHERE artist IS NOT NULL
GROUP BY user_id, artist;

-- Create an index to query affinities quickly
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_artist_affinity 
ON public.user_artist_affinity(user_id, artist);

-- Function to easily refresh the materialized view
CREATE OR REPLACE FUNCTION refresh_user_affinities()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.user_artist_affinity;
END;
$$;
