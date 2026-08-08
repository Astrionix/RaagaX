CREATE TABLE IF NOT EXISTS playback_sessions (
  session_id TEXT PRIMARY KEY,
  active_device_id TEXT,
  song_id TEXT,
  song_data JSONB,
  "current_time" NUMERIC,
  is_playing BOOLEAN,
  queue JSONB,
  queue_index INTEGER,
  shuffle BOOLEAN,
  repeat_mode TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Realtime
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'playback_sessions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE playback_sessions;
  END IF;
END $$;
