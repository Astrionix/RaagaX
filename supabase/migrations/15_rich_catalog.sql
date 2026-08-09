-- 1. Artists Table
CREATE TABLE IF NOT EXISTS public.artists (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  image_url TEXT,
  language TEXT,
  type TEXT -- e.g., 'singer', 'composer'
);

-- 2. Movies Table
CREATE TABLE IF NOT EXISTS public.movies (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  language TEXT,
  release_date DATE,
  poster_url TEXT
);

-- 3. Extend canonical_songs
ALTER TABLE public.canonical_songs 
ADD COLUMN IF NOT EXISTS movie_id TEXT REFERENCES public.movies(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS movie_name TEXT,
ADD COLUMN IF NOT EXISTS singers JSONB,
ADD COLUMN IF NOT EXISTS music_director TEXT,
ADD COLUMN IF NOT EXISTS lyricist TEXT,
ADD COLUMN IF NOT EXISTS release_date DATE,
ADD COLUMN IF NOT EXISTS playable_url TEXT,
ADD COLUMN IF NOT EXISTS popularity_score FLOAT DEFAULT 0.0,
ADD COLUMN IF NOT EXISTS trend_score FLOAT DEFAULT 0.0,
ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- 4. Song Artists Relationship
CREATE TABLE IF NOT EXISTS public.song_artists (
  song_id TEXT REFERENCES public.canonical_songs(id) ON DELETE CASCADE,
  artist_id TEXT REFERENCES public.artists(id) ON DELETE CASCADE,
  role TEXT, -- 'singer', 'composer', 'music_director', 'lyricist', 'featured_artist'
  PRIMARY KEY (song_id, artist_id, role)
);

-- 5. Movie Songs Relationship
CREATE TABLE IF NOT EXISTS public.movie_songs (
  movie_id TEXT REFERENCES public.movies(id) ON DELETE CASCADE,
  song_id TEXT REFERENCES public.canonical_songs(id) ON DELETE CASCADE,
  PRIMARY KEY (movie_id, song_id)
);

-- 6. Enable RLS and public read
ALTER TABLE public.artists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.song_artists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movie_songs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access on artists" ON public.artists FOR SELECT USING (true);
CREATE POLICY "Allow public read access on movies" ON public.movies FOR SELECT USING (true);
CREATE POLICY "Allow public read access on song_artists" ON public.song_artists FOR SELECT USING (true);
CREATE POLICY "Allow public read access on movie_songs" ON public.movie_songs FOR SELECT USING (true);
