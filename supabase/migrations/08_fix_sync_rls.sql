-- Fix for 403 Forbidden errors when the frontend tries to update playback_sessions

-- 1. Ensure RLS is disabled for this table so anon clients can update their sessions
ALTER TABLE public.playback_sessions DISABLE ROW LEVEL SECURITY;

-- 2. Explicitly grant permissions to the anon and authenticated roles
GRANT ALL ON TABLE public.playback_sessions TO anon;
GRANT ALL ON TABLE public.playback_sessions TO authenticated;
GRANT ALL ON TABLE public.playback_sessions TO service_role;
