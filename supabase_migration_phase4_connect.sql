-- Phase 4: Connect Recovery Architecture & Hardening

-- 1. Extend devices table to support instance tracking
ALTER TABLE public.devices 
ADD COLUMN IF NOT EXISTS instance_id TEXT;

-- 2. Enhance playback_sessions with strict server-authoritative state versioning
ALTER TABLE public.playback_sessions
ADD COLUMN IF NOT EXISTS state_version BIGINT DEFAULT 1,
ADD COLUMN IF NOT EXISTS owner_instance_id TEXT;

-- 3. Device Leases enhancement for strict fencing
ALTER TABLE public.device_leases
ADD COLUMN IF NOT EXISTS instance_id TEXT,
ADD COLUMN IF NOT EXISTS lease_version BIGINT DEFAULT 1;

-- 4. Processed Commands (Idempotency)
CREATE TABLE IF NOT EXISTS public.processed_commands (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    command_id TEXT NOT NULL,
    session_id TEXT NOT NULL REFERENCES public.playback_sessions(session_id) ON DELETE CASCADE,
    session_epoch BIGINT NOT NULL,
    sequence_number BIGINT NOT NULL,
    result TEXT NOT NULL,
    processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(command_id, session_id)
);

-- 5. Atomic RPC for claiming lease
-- This is critical for preventing split-brain renderer takeover.
CREATE OR REPLACE FUNCTION public.claim_playback_lease(
    p_session_id TEXT,
    p_device_id TEXT,
    p_instance_id TEXT,
    p_lease_token TEXT,
    p_expires_at TIMESTAMPTZ,
    p_force_takeover BOOLEAN DEFAULT false
) RETURNS JSONB AS $$
DECLARE
    v_current_lease RECORD;
    v_new_epoch BIGINT;
    v_new_lease_version BIGINT;
    v_user_id UUID;
BEGIN
    -- Get user_id from auth context
    v_user_id := auth.uid();
    
    -- Check if session exists
    IF NOT EXISTS (SELECT 1 FROM public.playback_sessions WHERE session_id = p_session_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'session_not_found');
    END IF;

    -- Lock the lease row
    SELECT * INTO v_current_lease 
    FROM public.device_leases 
    WHERE session_id = p_session_id 
    FOR UPDATE;

    IF FOUND THEN
        -- Lease exists
        IF v_current_lease.device_id = p_device_id AND v_current_lease.instance_id = p_instance_id THEN
            -- Same device renewing lease
            UPDATE public.device_leases 
            SET expires_at = p_expires_at, 
                lease_version = lease_version + 1,
                lease_token = p_lease_token
            WHERE session_id = p_session_id
            RETURNING lease_version, lease_epoch INTO v_new_lease_version, v_new_epoch;
            
            RETURN jsonb_build_object('success', true, 'epoch', v_new_epoch, 'lease_version', v_new_lease_version);
        ELSIF v_current_lease.expires_at < NOW() OR p_force_takeover = true THEN
            -- Lease expired or forced takeover
            v_new_epoch := v_current_lease.lease_epoch + 1;
            
            UPDATE public.device_leases 
            SET device_id = p_device_id,
                instance_id = p_instance_id,
                expires_at = p_expires_at,
                lease_epoch = v_new_epoch,
                lease_version = 1,
                lease_token = p_lease_token
            WHERE session_id = p_session_id;

            -- Also update session owner
            UPDATE public.playback_sessions
            SET owner_instance_id = p_instance_id,
                active_device_id = p_device_id,
                session_epoch = v_new_epoch
            WHERE session_id = p_session_id;

            RETURN jsonb_build_object('success', true, 'epoch', v_new_epoch, 'lease_version', 1);
        ELSE
            -- Lease active and owned by someone else
            RETURN jsonb_build_object(
                'success', false, 
                'error', 'lease_active',
                'owner_device_id', v_current_lease.device_id,
                'owner_instance_id', v_current_lease.instance_id,
                'epoch', v_current_lease.lease_epoch
            );
        END IF;
    ELSE
        -- Create new lease
        INSERT INTO public.device_leases (
            user_id, session_id, device_id, instance_id, lease_token, lease_epoch, lease_version, expires_at
        ) VALUES (
            v_user_id, p_session_id, p_device_id, p_instance_id, p_lease_token, 1, 1, p_expires_at
        );
        
        -- Update session owner
        UPDATE public.playback_sessions
        SET owner_instance_id = p_instance_id,
            active_device_id = p_device_id,
            session_epoch = 1
        WHERE session_id = p_session_id;
        
        RETURN jsonb_build_object('success', true, 'epoch', 1, 'lease_version', 1);
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
