-- Add release_date to canonical_songs to allow strict date filtering at the database level
ALTER TABLE public.canonical_songs
ADD COLUMN IF NOT EXISTS release_date TIMESTAMP WITH TIME ZONE;
