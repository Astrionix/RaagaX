-- Migration: Dynamic Home Playlists
-- Creates a table to securely cache resolved dynamic playlists so the home screen loads instantly

CREATE TABLE IF NOT EXISTS public.dynamic_home_playlists (
    id TEXT PRIMARY KEY, -- e.g., 'telugu_workout'
    language TEXT NOT NULL,
    category TEXT NOT NULL,
    playlist_id TEXT NOT NULL,
    title TEXT,
    image_url TEXT,
    last_resolved TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.dynamic_home_playlists ENABLE ROW LEVEL SECURITY;

-- Allow public read access (Home screen is visible to all)
CREATE POLICY "Dynamic playlists are readable by everyone" 
    ON public.dynamic_home_playlists FOR SELECT 
    USING (true);

-- Allow service role full access
CREATE POLICY "Service role can manage dynamic playlists"
    ON public.dynamic_home_playlists FOR ALL
    USING (true);
