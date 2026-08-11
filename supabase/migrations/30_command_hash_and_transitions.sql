-- 30_command_hash_and_transitions.sql
-- Audit logging for transition_id, command_hash, and state_version_before/after

ALTER TABLE public.processed_commands
  ADD COLUMN IF NOT EXISTS command_hash TEXT,
  ADD COLUMN IF NOT EXISTS transition_id TEXT,
  ADD COLUMN IF NOT EXISTS state_version_before BIGINT,
  ADD COLUMN IF NOT EXISTS state_version_after BIGINT,
  ADD COLUMN IF NOT EXISTS execution_result TEXT DEFAULT 'APPLIED';

-- Hardened Transactional State Commit RPC with Hash Validation
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
  p_command_id TEXT DEFAULT NULL,
  p_command_hash TEXT DEFAULT NULL,
  p_transition_id TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_session RECORD;
  v_old_revision BIGINT;
  v_new_revision BIGINT;
  v_existing_hash TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;

  -- 1. Idempotency & Command Hash Integrity Check
  IF p_command_id IS NOT NULL THEN
    SELECT command_hash INTO v_existing_hash 
    FROM public.processed_commands 
    WHERE command_id = p_command_id;

    IF FOUND THEN
      IF p_command_hash IS NOT NULL AND v_existing_hash IS NOT NULL AND v_existing_hash != p_command_hash THEN
        RETURN jsonb_build_object('success', false, 'error', 'payload_tampered_mismatch');
      END IF;
      RETURN jsonb_build_object('success', true, 'duplicate', true, 'message', 'command_already_processed');
    END IF;
  END IF;

  -- 2. Lock session row and verify ownership
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

  v_old_revision := v_session.revision;
  v_new_revision := v_old_revision + 1;

  -- 3. Commit state update
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

  -- 4. Record command in processed_commands log with hash and version trace
  IF p_command_id IS NOT NULL THEN
    INSERT INTO public.processed_commands (
      command_id, session_id, source_device_id, command_type, session_epoch,
      command_hash, transition_id, state_version_before, state_version_after, execution_result
    ) VALUES (
      p_command_id, p_session_id, p_device_id, 'COMMIT_STATE', p_expected_epoch,
      p_command_hash, p_transition_id, v_old_revision, v_new_revision, 'APPLIED'
    ) ON CONFLICT (command_id) DO NOTHING;
  END IF;

  RETURN jsonb_build_object('success', true, 'revision', v_new_revision, 'epoch', v_session.epoch);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
