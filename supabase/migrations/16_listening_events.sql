-- 1. Listening Events Table
CREATE TABLE IF NOT EXISTS public.listening_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  song_id TEXT NOT NULL REFERENCES public.canonical_songs(id) ON DELETE CASCADE,
  device_id TEXT,
  
  event_type TEXT NOT NULL CHECK (event_type IN ('play', 'pause', 'complete', 'skip', 'like', 'unlike', 'replay', 'search', 'add_to_queue')),
  position_ms INTEGER,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Indexes for fast analytics queries
CREATE INDEX IF NOT EXISTS idx_listening_events_user_id ON public.listening_events(user_id);
CREATE INDEX IF NOT EXISTS idx_listening_events_song_id ON public.listening_events(song_id);
CREATE INDEX IF NOT EXISTS idx_listening_events_created_at ON public.listening_events(created_at);

-- 3. Enable RLS
ALTER TABLE public.listening_events ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
CREATE POLICY "Users can insert their own listening events"
ON public.listening_events FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own listening events"
ON public.listening_events FOR SELECT
USING (auth.uid() = user_id);
