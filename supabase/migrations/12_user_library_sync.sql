-- 1. Create User Favorites Table
CREATE TABLE IF NOT EXISTS public.user_favorites (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    item_id TEXT NOT NULL,
    item_type TEXT NOT NULL CHECK (item_type IN ('artist', 'album')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    PRIMARY KEY (user_id, item_id, item_type)
);

-- Enable RLS
ALTER TABLE public.user_favorites ENABLE ROW LEVEL SECURITY;

-- Allow users to manage their own favorites
CREATE POLICY "Users can manage their own favorites"
    ON public.user_favorites
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Expose to Realtime (Optional)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'user_favorites'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE user_favorites;
  END IF;
END $$;


-- 2. Fix Playback History Constraints
-- Drop the strict foreign key constraint on song_id so that users can 
-- log history for third-party streamed songs (e.g. JioSaavn)
ALTER TABLE public.playback_history 
  DROP CONSTRAINT IF EXISTS playback_history_song_id_fkey;
