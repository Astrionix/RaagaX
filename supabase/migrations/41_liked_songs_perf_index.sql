-- 41. Liked Songs Performance Index
-- Creates a compound index on (user_id, created_at DESC) to speed up chronological fetches of liked songs.
CREATE INDEX IF NOT EXISTS idx_liked_songs_user_created ON public.liked_songs(user_id, created_at DESC);
