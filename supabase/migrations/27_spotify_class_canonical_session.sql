-- 27_spotify_class_canonical_session.sql
-- Upgrades devices and playback_sessions to Authoritative Spotify-Class Session model

-- 1. Ensure Devices Table has canonical fields
ALTER TABLE public.devices 
  ADD COLUMN IF NOT EXISTS platform TEXT DEFAULT 'web',
  ADD COLUMN IF NOT EXISTS instance_id TEXT,
  ADD COLUMN IF NOT EXISTS capabilities JSONB DEFAULT '{"audio": true, "video": false, "seek": true, "volume": true, "remoteControl": true}'::jsonb;

-- 2. Ensure Playback Sessions Table has Lease, Epoch, Revision, Context
ALTER TABLE public.playback_sessions
  ADD COLUMN IF NOT EXISTS epoch BIGINT DEFAULT 1,
  ADD COLUMN IF NOT EXISTS revision BIGINT DEFAULT 1,
  ADD COLUMN IF NOT EXISTS lease_id TEXT,
  ADD COLUMN IF NOT EXISTS lease_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS active_renderer TEXT DEFAULT 'audio',
  ADD COLUMN IF NOT EXISTS context_data JSONB DEFAULT '{}'::jsonb;

-- 3. Atomic Lease Claim RPC with Epoch & Revision Control
CREATE OR REPLACE FUNCTION public.claim_playback_lease(
  p_session_id TEXT,
  p_device_id TEXT,
  p_instance_id TEXT,
  p_lease_token TEXT,
  p_expires_at TIMESTAMPTZ,
  p_force_takeover BOOLEAN DEFAULT false
) RETURNS JSONB AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_session RECORD;
  v_new_epoch BIGINT;
  v_new_revision BIGINT;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;

  SELECT * INTO v_session FROM public.playback_sessions 
  WHERE session_id = p_session_id AND user_id = v_user_id;

  IF NOT FOUND THEN
    -- Initialize new canonical session for user
    INSERT INTO public.playback_sessions (
      session_id, user_id, active_device_id, lease_id, lease_expires_at, epoch, revision, is_playing
    ) VALUES (
      p_session_id, v_user_id, p_device_id, p_lease_token, p_expires_at, 1, 1, false
    );
    RETURN jsonb_build_object('success', true, 'epoch', 1, 'revision', 1, 'lease_version', 1);
  END IF;

  -- Verify current lease validity
  IF v_session.active_device_id = p_device_id AND v_session.lease_id = p_lease_token THEN
    -- Same device renewing current lease
    UPDATE public.playback_sessions
    SET lease_expires_at = p_expires_at,
        updated_at = NOW()
    WHERE session_id = p_session_id;

    RETURN jsonb_build_object('success', true, 'epoch', v_session.epoch, 'revision', v_session.revision, 'lease_version', 1);
  END IF;

  -- Takeover requested or lease expired
  IF p_force_takeover OR v_session.lease_expires_at IS NULL OR v_session.lease_expires_at < NOW() THEN
    v_new_epoch := v_session.epoch + 1;
    v_new_revision := v_session.revision + 1;

    UPDATE public.playback_sessions
    SET active_device_id = p_device_id,
        lease_id = p_lease_token,
        lease_expires_at = p_expires_at,
        epoch = v_new_epoch,
        revision = v_new_revision,
        updated_at = NOW()
    WHERE session_id = p_session_id;

    RETURN jsonb_build_object('success', true, 'epoch', v_new_epoch, 'revision', v_new_revision, 'lease_version', 1);
  END IF;

  RETURN jsonb_build_object('success', false, 'error', 'lease_owned_by_other_device', 'active_device', v_session.active_device_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Commit Authoritative Playback State RPC (guarantees strict revision increment)
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
  p_context_data JSONB DEFAULT '{}'::jsonb
) RETURNS JSONB AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_session RECORD;
  v_new_revision BIGINT;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;

  SELECT * INTO v_session FROM public.playback_sessions 
  WHERE session_id = p_session_id AND user_id = v_user_id;

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
  WHERE session_id = p_session_id;

  RETURN jsonb_build_object('success', true, 'revision', v_new_revision, 'epoch', v_session.epoch);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
