-- 18_cross_device_sync.sql

-- 1. Create Devices Table if not exists
CREATE TABLE IF NOT EXISTS public.devices (
  device_id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  device_name TEXT,
  device_type TEXT,
  is_online BOOLEAN DEFAULT true,
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own devices" ON public.devices;
CREATE POLICY "Users can manage their own devices" 
ON public.devices FOR ALL USING (auth.uid() = user_id);

-- 2. Drop and Recreate Playback Sessions Table for True Sync
DROP TABLE IF EXISTS public.playback_sessions CASCADE;

CREATE TABLE public.playback_sessions (
  session_id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  
  active_device_id TEXT REFERENCES public.devices(device_id) ON DELETE SET NULL,
  
  song_id TEXT,
  song_data JSONB, -- Cache of the song metadata so remote devices don't need to re-fetch
  
  position_ms BIGINT DEFAULT 0,
  is_playing BOOLEAN DEFAULT false,
  
  queue JSONB DEFAULT '[]'::jsonb,
  queue_index INTEGER DEFAULT 0,
  
  shuffle BOOLEAN DEFAULT false,
  repeat_mode TEXT DEFAULT 'off',
  
  state_version INTEGER DEFAULT 1,
  updated_at TIMESTAMP(3) WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP(3) -- High precision timestamp
);

-- Enable RLS
ALTER TABLE public.playback_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own playback sessions" 
ON public.playback_sessions FOR ALL USING (auth.uid() = user_id);

-- Enable Realtime
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'playback_sessions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE playback_sessions;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'devices'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE devices;
  END IF;
END $$;
