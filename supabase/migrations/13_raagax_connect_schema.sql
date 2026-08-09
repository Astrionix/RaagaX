-- 13_raagax_connect_schema.sql

-- 1. Create devices table
CREATE TABLE IF NOT EXISTS devices (
    device_id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    device_name TEXT NOT NULL,
    device_type TEXT NOT NULL,
    platform TEXT,
    is_online BOOLEAN DEFAULT false,
    last_seen TIMESTAMPTZ DEFAULT NOW(),
    capabilities JSONB DEFAULT '{}'::jsonb,
    volume INTEGER DEFAULT 100
);

-- 2. Refactor playback_sessions
-- Drop old table if it exists as it's ephemeral
DROP TABLE IF EXISTS playback_sessions CASCADE;

CREATE TABLE playback_sessions (
    session_id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    active_device_id TEXT REFERENCES devices(device_id) ON DELETE SET NULL,

    song_id TEXT,
    song_data JSONB,
    position_ms BIGINT DEFAULT 0,
    is_playing BOOLEAN DEFAULT false,

    queue JSONB DEFAULT '[]'::jsonb,
    queue_index INTEGER DEFAULT 0,

    shuffle BOOLEAN DEFAULT false,
    repeat_mode TEXT DEFAULT 'off',

    state_version BIGINT DEFAULT 0,

    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Set up RLS
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE playback_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own devices"
    ON devices
    FOR ALL
    USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own playback sessions"
    ON playback_sessions
    FOR ALL
    USING (auth.uid() = user_id);

-- 4. Enable Realtime
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'devices'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE devices;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'playback_sessions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE playback_sessions;
  END IF;
END $$;
