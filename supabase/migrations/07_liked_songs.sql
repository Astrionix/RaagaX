CREATE TABLE IF NOT EXISTS public.liked_songs (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    song_id TEXT NOT NULL REFERENCES public.canonical_songs(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    PRIMARY KEY (user_id, song_id)
);

-- Enable RLS
ALTER TABLE public.liked_songs ENABLE ROW LEVEL SECURITY;

-- Allow users to manage their own liked songs
CREATE POLICY "Users can manage their own liked songs"
    ON public.liked_songs
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Expose to Realtime (Optional, for instant UI updates across devices)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'liked_songs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE liked_songs;
  END IF;
END $$;
