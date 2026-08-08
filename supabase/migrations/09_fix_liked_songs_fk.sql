-- Drop the strict foreign key constraint on song_id
-- We need to drop this because users can like songs that are streamed directly 
-- from third-party providers (like JioSaavn) which might not exist in our 
-- canonical_songs table yet.

ALTER TABLE public.liked_songs 
  DROP CONSTRAINT IF EXISTS liked_songs_song_id_fkey;
