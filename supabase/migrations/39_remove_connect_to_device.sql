-- ============================================================================
-- MIGRATION: 39_remove_connect_to_device.sql
-- Description: Completely removes all Connect to Device tables, RPC functions,
-- and Realtime publications from Supabase.
-- ============================================================================

-- 1. Drop Connect RPC Functions
DROP FUNCTION IF EXISTS public.claim_playback_lease CASCADE;
DROP FUNCTION IF EXISTS public.commit_playback_state CASCADE;

-- 2. Drop Connect Tables
DROP TABLE IF EXISTS public.device_leases CASCADE;
DROP TABLE IF EXISTS public.playback_sessions CASCADE;
DROP TABLE IF EXISTS public.processed_commands CASCADE;
DROP TABLE IF EXISTS public.devices CASCADE;
