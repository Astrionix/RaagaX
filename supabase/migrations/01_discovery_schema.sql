-- 1. Create Canonical Songs Table
CREATE TABLE IF NOT EXISTS public.canonical_songs (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  artist TEXT,
  album TEXT,
  language TEXT,
  cover_url TEXT,
  duration TEXT,
  raw_data JSONB, -- Stores things like downloadUrls array
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Create Charts Table
CREATE TABLE IF NOT EXISTS public.charts (
  section_name TEXT NOT NULL, -- 'trending', 'new_releases', 'top100'
  language TEXT NOT NULL,
  song_id TEXT NOT NULL REFERENCES public.canonical_songs(id) ON DELETE CASCADE,
  rank INTEGER NOT NULL,
  discovered_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  -- Composite primary key to ensure a song is only at one rank per section/language
  PRIMARY KEY (section_name, language, song_id)
);

-- 3. Enable RLS (Row Level Security) but allow public read access for the Home Page API
ALTER TABLE public.canonical_songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.charts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access on canonical_songs" 
ON public.canonical_songs FOR SELECT USING (true);

CREATE POLICY "Allow public read access on charts" 
ON public.charts FOR SELECT USING (true);

-- The backend API (which uses SUPABASE_SERVICE_ROLE_KEY) will bypass RLS for INSERTS and UPDATES.
