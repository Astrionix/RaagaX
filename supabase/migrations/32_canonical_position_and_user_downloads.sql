-- 32_canonical_position_and_user_downloads.sql
-- Completes cross-device canonical position sync, user downloads registry, and devices RLS policies

-- 1. Upgrade playback_sessions table with canonical position and durable sync fields
ALTER TABLE public.playback_sessions
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS canonical_position_ms BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'idle',
  ADD COLUMN IF NOT EXISTS session_epoch BIGINT DEFAULT 1,
  ADD COLUMN IF NOT EXISTS sequence_number BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS server_timestamp BIGINT DEFAULT 0;

-- Ensure RLS on playback_sessions
ALTER TABLE public.playback_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view and manage their own playback sessions" ON public.playback_sessions;
CREATE POLICY "Users can view and manage their own playback sessions"
  ON public.playback_sessions
  FOR ALL
  USING (auth.uid() = user_id OR user_id IS NULL)
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- 2. Create authoritative user_downloads table
CREATE TABLE IF NOT EXISTS public.user_downloads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  song_id TEXT NOT NULL,
  song_title TEXT,
  song_artist TEXT,
  song_cover TEXT,
  song_duration INTEGER DEFAULT 0,
  song_version TEXT DEFAULT '1.0',
  downloaded_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT user_downloads_user_song_unique UNIQUE (user_id, song_id)
);

CREATE INDEX IF NOT EXISTS idx_user_downloads_user_id ON public.user_downloads(user_id);
CREATE INDEX IF NOT EXISTS idx_user_downloads_downloaded_at ON public.user_downloads(downloaded_at DESC);

-- Enable RLS on user_downloads
ALTER TABLE public.user_downloads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view and manage their own downloads" ON public.user_downloads;
CREATE POLICY "Users can view and manage their own downloads"
  ON public.user_downloads
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 3. Ensure devices table RLS allows authenticated users to manage their own devices
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view and manage their own devices" ON public.devices;
CREATE POLICY "Users can view and manage their own devices"
  ON public.devices
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 4. Enable Supabase Realtime Publication for user_downloads and playback_sessions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'user_downloads'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_downloads;
  END IF;
END $$;
