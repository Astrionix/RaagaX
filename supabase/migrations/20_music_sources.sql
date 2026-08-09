-- Create the music_sources table
CREATE TABLE IF NOT EXISTS public.music_sources (
    channel_id TEXT PRIMARY KEY,
    handle TEXT,
    label_name TEXT NOT NULL,
    primary_languages TEXT[] NOT NULL DEFAULT '{}',
    is_verified BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 1,
    last_checked TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Add indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_music_sources_priority ON public.music_sources(priority DESC);
CREATE INDEX IF NOT EXISTS idx_music_sources_languages ON public.music_sources USING GIN (primary_languages);

-- Set up RLS
ALTER TABLE public.music_sources ENABLE ROW LEVEL SECURITY;

-- Allow public read access to music_sources
CREATE POLICY "Allow public read access on music_sources" ON public.music_sources FOR SELECT USING (true);

-- Allow service role to perform all operations
CREATE POLICY "Allow service role full access on music_sources" ON public.music_sources FOR ALL USING (true) WITH CHECK (true);
