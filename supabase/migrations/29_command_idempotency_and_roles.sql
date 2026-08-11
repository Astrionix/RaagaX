-- 29_command_idempotency_and_roles.sql
-- Transactional Command Idempotency and Role Separation for Connect Engine

-- 1. Ensure processed_commands table exists for idempotency caching
CREATE TABLE IF NOT EXISTS public.processed_commands (
  command_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  source_device_id TEXT NOT NULL,
  command_type TEXT NOT NULL,
  session_epoch BIGINT NOT NULL,
  processed_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.processed_commands ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage processed commands" ON public.processed_commands;
CREATE POLICY "Users can manage processed commands" ON public.processed_commands FOR ALL USING (true);

-- 2. Hardened Transactional State Commit RPC with Idempotency Check
CREATE OR REPLACE FUNCTION public.commit_playback_state(
  p_session_id TEXT,
  p_device_id TEXT,
  p_lease_id TEXT,
  p_expected_epoch BIGINT,
  p_song_id TEXT,
  p_song_data JSONB,
  p_position_ms BIGINT,
  p_is_playing BOOLEAN,
  p_queue JSONB,
  p_queue_index INTEGER,
  p_shuffle BOOLEAN,
  p_repeat_mode TEXT,
  p_context_data JSONB DEFAULT '{}'::jsonb,
  p_command_id TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_session RECORD;
  v_new_revision BIGINT;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;

  -- Idempotency check: if command_id was already processed, ignore safely
  IF p_command_id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.processed_commands WHERE command_id = p_command_id) THEN
      RETURN jsonb_build_object('success', true, 'duplicate', true, 'message', 'command_already_processed');
    END IF;
  END IF;

  -- Lock session row and verify ownership
  SELECT * INTO v_session 
  FROM public.playback_sessions 
  WHERE session_id = p_session_id AND user_id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'session_not_found');
  END IF;

  -- Validate device lease & epoch authority
  IF v_session.active_device_id != p_device_id OR v_session.lease_id != p_lease_id OR v_session.epoch != p_expected_epoch THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'stale_authority', 
      'current_epoch', v_session.epoch, 
      'active_device', v_session.active_device_id
    );
  END IF;

  v_new_revision := v_session.revision + 1;

  -- Commit state update
  UPDATE public.playback_sessions
  SET song_id = COALESCE(p_song_id, song_id),
      song_data = COALESCE(p_song_data, song_data),
      position_ms = p_position_ms,
      is_playing = p_is_playing,
      queue = COALESCE(p_queue, queue),
      queue_index = COALESCE(p_queue_index, queue_index),
      shuffle = COALESCE(p_shuffle, shuffle),
      repeat_mode = COALESCE(p_repeat_mode, repeat_mode),
      context_data = COALESCE(p_context_data, context_data),
      revision = v_new_revision,
      updated_at = NOW()
  WHERE session_id = p_session_id AND user_id = v_user_id;

  -- Record command in processed_commands log
  IF p_command_id IS NOT NULL THEN
    INSERT INTO public.processed_commands (
      command_id, session_id, source_device_id, command_type, session_epoch
    ) VALUES (
      p_command_id, p_session_id, p_device_id, 'COMMIT_STATE', p_expected_epoch
    ) ON CONFLICT (command_id) DO NOTHING;
  END IF;

  RETURN jsonb_build_object('success', true, 'revision', v_new_revision, 'epoch', v_session.epoch);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
