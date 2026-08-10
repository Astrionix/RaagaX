-- RaagaX Intelligence Engine Tables

-- 1. music_sources (YouTube Channels to scrape)
CREATE TABLE IF NOT EXISTS public.music_sources (
    channel_id TEXT PRIMARY KEY,
    channel_name TEXT NOT NULL,
    languages TEXT[] NOT NULL, -- e.g. ['Telugu', 'Tamil']
    priority INTEGER DEFAULT 1, -- Higher priority channels are fetched first
    verified BOOLEAN DEFAULT false,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. release_candidates (Raw fetch from RSS/YouTube before scoring)
CREATE TABLE IF NOT EXISTS public.release_candidates (
    id TEXT PRIMARY KEY, -- e.g., yt_videoId
    title TEXT NOT NULL,
    channel_id TEXT REFERENCES public.music_sources(channel_id),
    youtube_published_at TIMESTAMP WITH TIME ZONE,
    status TEXT DEFAULT 'pending', -- pending, accepted, rejected, review
    score INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. release_validation (The Historical Ledger for Self-Improvement)
CREATE TABLE IF NOT EXISTS public.release_validation (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    candidate_id TEXT REFERENCES public.release_candidates(id),
    title TEXT NOT NULL,
    predicted_result TEXT NOT NULL, -- 'song' | 'trailer' | 'old' | etc
    actual_result TEXT, -- NULL until human verification marks it false positive/negative
    score INTEGER,
    reason TEXT,
    confidence NUMERIC,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Note: canonical_songs already exists in the project schema.
