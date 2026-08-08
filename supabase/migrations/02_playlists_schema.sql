-- 1. Create Playlists Table
CREATE TABLE IF NOT EXISTS public.playlists (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  language TEXT NOT NULL,
  cover_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Create Playlist Songs Mapping Table
CREATE TABLE IF NOT EXISTS public.playlist_songs (
  playlist_id TEXT NOT NULL REFERENCES public.playlists(id) ON DELETE CASCADE,
  song_id TEXT NOT NULL REFERENCES public.canonical_songs(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  
  PRIMARY KEY (playlist_id, song_id)
);

-- 3. Enable RLS but allow public read access for the Home Page API
ALTER TABLE public.playlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playlist_songs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access on playlists" 
ON public.playlists FOR SELECT USING (true);

CREATE POLICY "Allow public read access on playlist_songs" 
ON public.playlist_songs FOR SELECT USING (true);
